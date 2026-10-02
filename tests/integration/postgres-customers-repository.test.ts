import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { PostgresCustomersRepository } from '../../src/adapters/postgres/customers-repository.ts';
import { PostgresIdempotencyStore } from '../../src/adapters/postgres/idempotency-store.ts';
import { PostgresOidcIdentityDirectory } from '../../src/adapters/postgres/oidc-identity-directory.ts';
import { PostgresOutboxRepository } from '../../src/adapters/postgres/outbox-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { OutboxPublisher } from '../../src/modules/_shared/application/index.ts';
import { CustomersService } from '../../src/modules/customers/application/customers-service.ts';
import { CustomerCommandRejectedError } from '../../src/modules/customers/application/customers-repository.ts';
import { createCustomersRoutes } from '../../src/server/api/customers-routes.ts';
import { createGescomApiHandler } from '../../src/server/api/gescom-middleware.ts';
import { LocalApiPrincipalVerifier } from '../../src/server/auth/local-api-principal-verifier.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresCustomersRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresCustomersRepository;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const adminId = randomUUID() as UserId;
  const localSubject = `customers-session-${randomUUID()}`;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresCustomersRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
    );
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1, $2, 'Customers Admin')
    `, [adminId, `customers-admin-${adminId}@example.invalid`]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Customers Integration'), ($3, $4, 'Foreign Customers')
    `, [tenantId, `customers-${tenantId}`, foreignTenantId, `customers-${foreignTenantId}`]);
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
    await pool.query(
      'update public.outbox_events set published_at = clock_timestamp() where tenant_id = $1',
      [tenantId],
    );
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id = $1', [adminId]);
    await pool.end();
  });

  it('persiste, recherche et isole strictement les clients par tenant', async () => {
    const company = await repository.create(tenantId, adminId, {
      type: 'company',
      company_name: 'Imprimerie Atlas',
      siret: '73282932000074',
    });
    await repository.create(tenantId, adminId, {
      type: 'individual',
      civility: 'mrs',
      first_name: 'Jeanne',
      last_name: 'Martin',
    });

    await expect(repository.findById(foreignTenantId, company.id)).resolves.toBeNull();
    await expect(repository.list(tenantId, {
      q: 'atlas', type: 'company', size: 10, cursor: null,
    })).resolves.toMatchObject({ rows: [{ id: company.id, company_name: 'Imprimerie Atlas' }] });

    const firstPage = await repository.list(tenantId, {
      q: null, type: null, size: 1, cursor: null,
    });
    expect(firstPage.rows).toHaveLength(2);
    const nextPage = await repository.list(tenantId, {
      q: null,
      type: null,
      size: 10,
      cursor: { sort: firstPage.rows[0]!.created_at, id: firstPage.rows[0]!.id },
    });
    expect(nextPage.rows).not.toContainEqual(expect.objectContaining({ id: firstPage.rows[0]!.id }));

    await expect(repository.create(tenantId, adminId, {
      type: 'company',
      company_name: 'SIRET duplique',
      siret: '73282932000074',
    })).rejects.toMatchObject<CustomerCommandRejectedError>({
      code: 'customer.siret_already_used',
    });
  });

  it('invalide la verification lors d un changement de SIRET', async () => {
    const company = await repository.create(tenantId, adminId, {
      type: 'company',
      company_name: 'Entreprise vérifiée',
      siret: '55210055400013',
    });
    const verified = await repository.markSiretVerified(tenantId, company.id, {
      verified: true,
      verifiedAt: '2026-09-30T12:00:00.000Z',
      siret: company.siret!,
    });
    expect(verified.siret_verified).toBe(true);

    const updated = await repository.update(tenantId, company.id, { siret: '35600000000048' });
    expect(updated).toMatchObject({
      siret: '35600000000048',
      siret_verified: false,
      siret_verified_at: null,
    });
  });

  it('garantit un seul interlocuteur principal et refuse les acces croises', async () => {
    const customer = await repository.create(tenantId, adminId, {
      type: 'individual',
      civility: 'mr',
      first_name: 'Louis',
      last_name: 'Bernard',
    });
    const first = await repository.createContact(tenantId, customer.id, {
      first_name: 'Alice', last_name: 'Durand', email: 'alice@example.invalid', is_primary: true,
    });
    const second = await repository.createContact(tenantId, customer.id, {
      first_name: 'Bruno', last_name: 'Petit', email: 'bruno@example.invalid', is_primary: true,
    });

    await expect(repository.listContacts(tenantId, customer.id)).resolves.toEqual([
      expect.objectContaining({ id: second.id, is_primary: true }),
      expect.objectContaining({ id: first.id, is_primary: false }),
    ]);
    await expect(repository.findContactById(foreignTenantId, customer.id, second.id))
      .resolves.toBeNull();
  });

  it('sert la facade locale et rejoue un POST sans doublonner client ni evenement', async () => {
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const service = new CustomersService({
      repository,
      outbox: new OutboxPublisher({
        repository: new PostgresOutboxRepository(transactions),
        now: () => new Date('2026-09-30T12:00:00.000Z'),
        newEventId: () => randomUUID(),
      }),
    });
    const handle = createGescomApiHandler({
      routes: createCustomersRoutes(service),
      principalVerifier: new LocalApiPrincipalVerifier({
        identities: new PostgresOidcIdentityDirectory(pool),
        sessions: { async getSession() { return { user: { id: localSubject } }; } },
      }),
      idempotencyStore: new PostgresIdempotencyStore(transactions),
      requestIdFactory: () => 'customers-integration',
    });
    const headers = {
      cookie: 'better-auth.session_token=opaque',
      'x-magrit-tenant': tenantId,
      'content-type': 'application/json',
      'idempotency-key': 'customer-create-001',
    };
    const request = () => new Request('http://api.local/api/v1/customers', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'individual', civility: 'mrs', first_name: 'API', last_name: 'Cliente',
      }),
    });

    const firstResponse = await handle(request());
    expect(firstResponse.status).toBe(201);
    const firstBody = await firstResponse.json() as { data: { id: string } };
    const replay = await handle(request());
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    await expect(replay.json()).resolves.toMatchObject({ data: { id: firstBody.data.id } });

    const customerCount = await pool.query(
      'select count(*)::integer as count from public.customers where id = $1',
      [firstBody.data.id],
    );
    const eventCount = await pool.query(`
      select count(*)::integer as count from public.outbox_events
       where tenant_id = $1 and event_name = 'customer.created' and aggregate_id = $2
    `, [tenantId, firstBody.data.id]);
    expect(customerCount.rows[0]?.count).toBe(1);
    expect(eventCount.rows[0]?.count).toBe(1);
  });
});
