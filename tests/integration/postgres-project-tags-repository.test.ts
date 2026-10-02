import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresIdempotencyStore } from '../../src/adapters/postgres/idempotency-store.ts';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresProjectTagsRepository } from '../../src/adapters/postgres/project-tags-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { ProjectTagsService } from '../../src/modules/project-tags/application/project-tags-service.ts';
import { createGescomApiHandler } from '../../src/server/api/gescom-middleware.ts';
import { createProjectTagsRoutes } from '../../src/server/api/project-tags-routes.ts';
import { LocalApiPrincipalVerifier } from '../../src/server/auth/local-api-principal-verifier.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresProjectTagsRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresProjectTagsRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const localSubject = `project-tags-session-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresProjectTagsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'Project Tags Admin')
    `, [adminId, `project-tags-${adminId}@example.invalid`]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Project Tags Integration'), ($3, $4, 'Foreign Project Tags')
    `, [tenantId, `project-tags-${tenantId}`, foreignTenantId, `project-tags-${foreignTenantId}`]);
    await pool.query(`
      insert into public.tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'admin')
    `, [tenantId, adminId]);
    await pool.query(`
      insert into public.user_identities (
        app_user_id, provider_type, provider_id, issuer, subject
      ) values ($1, 'local', 'better-auth', 'urn:magrit:local', $2)
    `, [adminId, localSubject]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id = $1', [adminId]);
    await pool.end();
  });

  it('rend une creation concurrente idempotente sur le libelle normalise', async () => {
    const [first, second] = await Promise.all([
      repository.createOrGet(tenantId, { label: 'Urgent', color: 'red' }),
      repository.createOrGet(tenantId, { label: '  urgent  ', color: 'red' }),
    ]);
    expect(first.tag.id).toBe(second.tag.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(first.tag.label).toBe(second.tag.label);
    expect(first.tag.label.trim().toLowerCase()).toBe('urgent');
  });

  it('recherche sans syntaxe fournisseur et isole les tenants', async () => {
    const tag = (await repository.createOrGet(tenantId, {
      label: 'Client, fidèle', color: 'blue',
    })).tag;
    await expect(repository.list(tenantId, { q: 'Client,  fidèle' }))
      .resolves.toContainEqual(expect.objectContaining({ id: tag.id }));
    await expect(repository.findById(foreignTenantId, tag.id)).resolves.toBeNull();
    await expect(repository.findManyByIds(foreignTenantId, [tag.id])).resolves.toEqual([]);
  });

  it('supprime un tag libre et refuse un identifiant hors tenant', async () => {
    const tag = (await repository.createOrGet(tenantId, {
      label: 'À supprimer', color: 'slate',
    })).tag;
    await repository.delete(tenantId, tag.id);
    await expect(repository.findById(tenantId, tag.id)).resolves.toBeNull();
    await expect(repository.delete(foreignTenantId, tag.id)).rejects.toMatchObject({
      name: 'ProjectTagNotFoundError',
    });
  });

  it('sert la facade locale et rejoue la creation HTTP sans doublon', async () => {
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const handle = createGescomApiHandler({
      routes: createProjectTagsRoutes(new ProjectTagsService({ repository })),
      principalVerifier: new LocalApiPrincipalVerifier({
        identities: new PostgresOidcIdentityDirectory(pool),
        sessions: { async getSession() { return { user: { id: localSubject } }; } },
      }),
      idempotencyStore: new PostgresIdempotencyStore(transactions),
      requestIdFactory: () => 'project-tags-integration',
    });
    const request = () => new Request('http://api.local/api/v1/project-tags', {
      method: 'POST',
      headers: {
        cookie: 'better-auth.session_token=opaque',
        'x-magrit-tenant': tenantId,
        'content-type': 'application/json',
        'idempotency-key': 'project-tag-create-001',
      },
      body: JSON.stringify({ label: 'Façade locale' }),
    });

    const first = await handle(request());
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { data: { id: string } };
    const replay = await handle(request());
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    await expect(replay.json()).resolves.toMatchObject({ data: { id: firstBody.data.id } });

    const count = await pool.query(
      'select count(*)::integer as count from public.project_tags where id = $1',
      [firstBody.data.id],
    );
    expect(count.rows[0]?.count).toBe(1);
  });
});
