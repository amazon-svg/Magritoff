import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId } from '../../src/kernel/ids/index.ts';
import { PostgresOutboxRepository } from '../../src/adapters/postgres/outbox-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { OutboxPublisher } from '../../src/modules/_shared/application/index.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresOutboxRepository — PostgreSQL reel', () => {
  let pool: Pool;
  const tenantId = randomUUID() as TenantId;
  const eventId = randomUUID();

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query(
      'insert into public.tenants (id, slug, name) values ($1, $2, $3)',
      [tenantId, `outbox-${tenantId}`, 'Outbox Integration'],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      'update public.outbox_events set published_at = clock_timestamp() where tenant_id = $1',
      [tenantId],
    );
    await pool.query('delete from public.tenants where id = $1', [tenantId]);
    await pool.end();
  });

  it('persiste une enveloppe complete via le publisher', async () => {
    const publisher = new OutboxPublisher({
      repository: new PostgresOutboxRepository(new PostgresTransactionRunner(pool, 'magrit_api')),
      now: () => new Date('2026-09-30T12:00:00.000Z'),
      newEventId: () => eventId,
    });
    await publisher.publish({
      name: 'customer.created',
      tenantId,
      aggregateType: 'customer',
      aggregateId: randomUUID(),
      payload: { customer_id: 'customer-1', type: 'company' },
    });

    const result = await pool.query(`
      select event_name, event_version, aggregate_type, payload, occurred_at
        from public.outbox_events where id = $1
    `, [eventId]);
    expect(result.rows[0]).toMatchObject({
      event_name: 'customer.created',
      event_version: 1,
      aggregate_type: 'customer',
      payload: { customer_id: 'customer-1', type: 'company' },
    });
    expect(result.rows[0]?.occurred_at.toISOString()).toBe('2026-09-30T12:00:00.000Z');
  });

  it('interdit la mutation du contenu et la suppression d un evenement en attente', async () => {
    await expect(pool.query(
      'update public.outbox_events set payload = $2::jsonb where id = $1',
      [eventId, JSON.stringify({ compromised: true })],
    )).rejects.toMatchObject({ code: '42501' });
    await expect(pool.query('delete from public.outbox_events where id = $1', [eventId]))
      .rejects.toMatchObject({ code: '42501' });
  });
});
