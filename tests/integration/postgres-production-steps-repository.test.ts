import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresIdempotencyStore } from '../../src/adapters/postgres/idempotency-store.ts';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresProductionStepsRepository } from '../../src/adapters/postgres/production-steps-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { ProductionStepLabelConflictError } from '../../src/modules/production-steps/application/production-steps-repository.ts';
import { ProductionStepsService } from '../../src/modules/production-steps/application/production-steps-service.ts';
import { createGescomApiHandler } from '../../src/server/api/gescom-middleware.ts';
import { createProductionStepsRoutes } from '../../src/server/api/production-steps-routes.ts';
import { LocalApiPrincipalVerifier } from '../../src/server/auth/local-api-principal-verifier.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresProductionStepsRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresProductionStepsRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const memberId = randomUUID() as UserId;
  const localSubject = `production-session-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresProductionStepsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'Production Admin'), ($3, $4, 'Production Member')
    `, [
      adminId, `production-admin-${adminId}@example.invalid`,
      memberId, `production-member-${memberId}@example.invalid`,
    ]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Production Integration'), ($3, $4, 'Foreign Production')
    `, [tenantId, `production-${tenantId}`, foreignTenantId, `production-${foreignTenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'admin'), ($1, $3, 'member')
    `, [tenantId, adminId, memberId]);
    await pool.query(`
      insert into public.user_identities (
        app_user_id, provider_type, provider_id, issuer, subject
      ) values ($1, 'local', 'better-auth', 'urn:magrit:local', $2)
    `, [adminId, localSubject]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id = any($1::uuid[])', [[adminId, memberId]]);
    await pool.end();
  });

  it('initialise les six etapes standard et isole les tenants', async () => {
    const { all } = await repository.list(tenantId);
    expect(all.map((step) => step.label)).toEqual([
      'Fichier reçu', 'PAO', 'Fichier validé', 'En cours de production',
      "En cours d'expédition", 'Livré',
    ]);
    expect(all.map((step) => step.position)).toEqual([0, 1, 2, 3, 4, 5]);
    await expect(repository.findById(foreignTenantId, all[0]!.id)).resolves.toBeNull();
  });

  it('applique les capacites administrateur et les invariants transactionnels', async () => {
    await expect(repository.actorHasCapability(
      tenantId, adminId, 'can_manage_production_steps',
    )).resolves.toBe(true);
    await expect(repository.actorHasCapability(
      tenantId, memberId, 'can_manage_production_steps',
    )).resolves.toBe(false);

    const created = await repository.create(tenantId, adminId, {
      label: 'Contrôle qualité', color: 'blue', is_terminal: false,
    });
    expect(created.position).toBe(6);
    await expect(repository.create(tenantId, adminId, {
      label: '  contrôle QUALITÉ  ', color: 'red', is_terminal: false,
    })).rejects.toBeInstanceOf(ProductionStepLabelConflictError);

    const updated = await repository.update(tenantId, adminId, created.id, {
      is_active: false,
    });
    expect(updated.is_active).toBe(false);

    const beforeReorder = (await repository.list(tenantId)).all;
    const reversedIds = beforeReorder.map((step) => step.id).reverse();
    const reordered = await repository.reorder(tenantId, adminId, reversedIds);
    expect(reordered.map((step) => step.id)).toEqual(reversedIds);
    expect(reordered.map((step) => step.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);

    await repository.remove(tenantId, adminId, created.id);
    expect((await repository.list(tenantId)).all.map((step) => step.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('sert la facade locale et rejoue un POST sans creer de doublon', async () => {
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const handle = createGescomApiHandler({
      routes: createProductionStepsRoutes(new ProductionStepsService({ repository })),
      principalVerifier: new LocalApiPrincipalVerifier({
        identities: new PostgresOidcIdentityDirectory(pool),
        sessions: { async getSession() { return { user: { id: localSubject } }; } },
      }),
      idempotencyStore: new PostgresIdempotencyStore(transactions),
      requestIdFactory: () => 'production-integration',
    });
    const headers = {
      cookie: 'better-auth.session_token=opaque',
      'x-magrit-tenant': tenantId,
      'content-type': 'application/json',
      'idempotency-key': 'production-create-001',
    };
    const request = () => new Request('http://api.local/api/v1/production-steps', {
      method: 'POST', headers,
      body: JSON.stringify({ label: 'BAT validé', color: 'green', is_terminal: false }),
    });

    const first = await handle(request());
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { data: { id: string } };
    const replay = await handle(request());
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    await expect(replay.json()).resolves.toMatchObject({ data: { id: firstBody.data.id } });
    expect((await repository.list(tenantId)).all.filter((step) => step.label === 'BAT validé')).toHaveLength(1);
  });
});
