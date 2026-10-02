import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId } from '../../src/kernel/ids/index.ts';
import { PostgresIdempotencyStore } from '../../src/adapters/postgres/idempotency-store.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresIdempotencyStore — PostgreSQL reel', () => {
  let pool: Pool;
  let store: PostgresIdempotencyStore;
  const tenantId = randomUUID() as TenantId;
  const otherTenantId = randomUUID() as TenantId;
  const fingerprint = 'a'.repeat(64);
  const otherFingerprint = 'b'.repeat(64);

  beforeAll(async () => {
    pool = createPostgresPool();
    store = new PostgresIdempotencyStore(new PostgresTransactionRunner(pool, 'magrit_api'));
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1, $2, 'Idempotency A'), ($3, $4, 'Idempotency B')
    `, [tenantId, `idempotency-${tenantId}`, otherTenantId, `idempotency-${otherTenantId}`]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, otherTenantId]]);
    await pool.end();
  });

  it('reserve, bloque une concurrence et detecte une reutilisation differente', async () => {
    const request = { tenantId, key: 'create.order.001', fingerprint };
    await expect(store.begin(request)).resolves.toEqual({ outcome: 'fresh' });
    await expect(store.begin(request)).resolves.toEqual({ outcome: 'in_progress' });
    await expect(store.begin({ ...request, fingerprint: otherFingerprint })).resolves.toEqual({
      outcome: 'conflict',
    });
  });

  it('memorise puis rejoue la reponse, isolee par tenant', async () => {
    const request = { tenantId, key: 'create.order.002', fingerprint };
    await store.begin(request);
    await store.complete(request, {
      status: 201,
      body: { data: { id: 'order-1' }, meta: { request_id: 'first' } },
      etag: '"etag-1"',
    });
    await expect(store.begin(request)).resolves.toEqual({
      outcome: 'replayed',
      record: {
        status: 201,
        body: { data: { id: 'order-1' }, meta: { request_id: 'first' } },
        etag: '"etag-1"',
      },
    });
    await expect(store.begin({ ...request, tenantId: otherTenantId })).resolves.toEqual({
      outcome: 'fresh',
    });
  });

  it('libere un echec et reprend un bail abandonne au contenu identique', async () => {
    const released = { tenantId, key: 'create.order.003', fingerprint };
    await store.begin(released);
    await store.release(released);
    await expect(store.begin(released)).resolves.toEqual({ outcome: 'fresh' });

    const stale = { tenantId, key: 'create.order.004', fingerprint };
    await store.begin(stale);
    await pool.query(`
      update public.api_idempotency_keys
         set locked_until = clock_timestamp() - interval '1 second'
       where tenant_id = $1 and idempotency_key = $2
    `, [tenantId, stale.key]);
    await expect(store.begin(stale)).resolves.toEqual({ outcome: 'fresh' });
  });
});
