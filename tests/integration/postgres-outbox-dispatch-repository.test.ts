import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresOutboxDispatchRepository } from '../../src/adapters/postgres/outbox-dispatch-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId } from '../../src/kernel/ids/index.ts';
import { DEFAULT_OUTBOX_DISPATCH_SETTINGS } from '../../src/modules/_shared/application/index.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresOutboxDispatchRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresOutboxDispatchRepository;
  const tenantId = randomUUID() as TenantId;

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresOutboxDispatchRepository(
      new PostgresTransactionRunner(pool, 'magrit_worker'),
    );
    await pool.query(
      'insert into public.tenants(id,slug,name) values($1,$2,$3)',
      [tenantId, `outbox-dispatch-${tenantId}`, 'Outbox dispatch integration'],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      'update public.outbox_events set published_at=coalesce(published_at,clock_timestamp()) where tenant_id=$1',
      [tenantId],
    );
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.end();
  });

  it('reclame, applique le backoff puis enregistre les verdicts', async () => {
    const eventId = await insertEvent({ occurredAt: new Date('2001-01-01T00:00:00.000Z') });
    const settings = { ...DEFAULT_OUTBOX_DISPATCH_SETTINGS, limit: 1, maxAgeSeconds: 1_000_000_000 };
    const firstClaim = await repository.claim(settings);

    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]).toMatchObject({ id: eventId, deliveryAttempts: 1, name: 'customer.created' });
    await repository.markFailed(eventId, 'x'.repeat(2100));

    let row = (await pool.query(
      'select delivery_attempts,next_attempt_at,last_error,published_at from public.outbox_events where id=$1',
      [eventId],
    )).rows[0];
    expect(row.delivery_attempts).toBe(1);
    expect(row.last_error).toHaveLength(2000);
    expect(row.published_at).toBeNull();
    expect(row.next_attempt_at.getTime()).toBeGreaterThan(Date.now() + 50_000);

    await pool.query('update public.outbox_events set next_attempt_at=clock_timestamp() where id=$1', [eventId]);
    const secondClaim = await repository.claim(settings);
    expect(secondClaim[0]).toMatchObject({ id: eventId, deliveryAttempts: 2 });
    row = (await pool.query(
      'select next_attempt_at from public.outbox_events where id=$1',
      [eventId],
    )).rows[0];
    expect(row.next_attempt_at.getTime()).toBeGreaterThan(Date.now() + 290_000);

    await repository.markDelivered(eventId);
    row = (await pool.query(
      'select published_at,last_error from public.outbox_events where id=$1',
      [eventId],
    )).rows[0];
    expect(row.published_at).toBeInstanceOf(Date);
    expect(row.last_error).toBeNull();
  });

  it('met au rebut les evenements trop vieux sans les rendre au worker', async () => {
    const eventId = await insertEvent({ occurredAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    const claimed = await repository.claim({ ...DEFAULT_OUTBOX_DISPATCH_SETTINGS, limit: 10_000 });

    expect(claimed.some((event) => event.id === eventId)).toBe(false);
    const row = (await pool.query(
      'select delivery_attempts,last_error from public.outbox_events where id=$1',
      [eventId],
    )).rows[0];
    expect(row.delivery_attempts).toBe(5);
    expect(row.last_error).toContain('outbox_stale');
  });

  it('saute une ligne verrouillee et reserve la suivante', async () => {
    const oldestId = await insertEvent({ occurredAt: new Date('2002-01-01T00:00:00.000Z') });
    const nextId = await insertEvent({ occurredAt: new Date('2003-01-01T00:00:00.000Z') });
    const locker = await pool.connect();
    try {
      await locker.query('begin');
      await locker.query('select id from public.outbox_events where id=$1 for update', [oldestId]);
      const claimed = await repository.claim({
        ...DEFAULT_OUTBOX_DISPATCH_SETTINGS,
        limit: 1,
        maxAgeSeconds: 1_000_000_000,
      });
      expect(claimed[0]?.id).toBe(nextId);
      await repository.markDelivered(nextId);
    } finally {
      await locker.query('rollback');
      locker.release();
    }
    await pool.query('update public.outbox_events set published_at=clock_timestamp() where id=$1', [oldestId]);
  });

  it('refuse la reclamation au role API', async () => {
    const apiTransactions = new PostgresTransactionRunner(pool, 'magrit_api');
    await expect(apiTransactions.run({}, (client) => client.query(
      'select * from magrit.claim_outbox_events(1,5,86400)',
    ))).rejects.toMatchObject({ code: '42501' });
  });

  async function insertEvent(options: { occurredAt: Date }): Promise<string> {
    const id = randomUUID();
    await pool.query(`
      insert into public.outbox_events(
        id,tenant_id,event_name,event_version,aggregate_type,aggregate_id,payload,occurred_at,next_attempt_at
      ) values($1,$2,'customer.created',1,'customer',$3,'{}'::jsonb,$4,clock_timestamp())
    `, [id, tenantId, randomUUID(), options.occurredAt]);
    return id;
  }
});
