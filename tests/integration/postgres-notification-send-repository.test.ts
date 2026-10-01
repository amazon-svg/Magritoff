import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresNotificationSendRepository } from '../../src/adapters/postgres/notification-send-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId } from '../../src/kernel/ids/index.ts';
import { DEFAULT_NOTIFICATION_SEND_SETTINGS } from '../../src/modules/notifications/application/notification-sender.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresNotificationSendRepository — PostgreSQL reel', () => {
  let pool: Pool;
  let repository: PostgresNotificationSendRepository;
  const tenantId = randomUUID() as TenantId;
  const templateId = randomUUID();

  beforeAll(async () => {
    pool = createPostgresPool();
    repository = new PostgresNotificationSendRepository(
      new PostgresTransactionRunner(pool, 'magrit_worker'),
    );
    await pool.query(
      'insert into public.tenants(id,slug,name) values($1,$2,$3)',
      [tenantId, `notification-send-${tenantId}`, 'Notification send integration'],
    );
    await pool.query(
      `insert into public.notification_templates(
         id,tenant_id,event_name,channel,audience,recipients,name,subject,body,is_active
       ) values($1,$2,'order.files_submitted','email','explicit',array['client@example.test'],
                'Envoi','Sujet','Corps',true)`,
      [templateId, tenantId],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.end();
  });

  it('reclame, applique le backoff et scelle un rendu differe au verdict', async () => {
    const messageId = await insertMessage({
      createdAt: new Date(),
      deferredRender: {
        subject: [{ kind: 'literal', text: 'Sujet final' }],
        body: [{ kind: 'literal', text: 'Corps final' }],
      },
    });
    const settings = { ...DEFAULT_NOTIFICATION_SEND_SETTINGS, limit: 1 };

    const firstClaim = await repository.claim(settings);
    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]).toMatchObject({ id: messageId, attempts: 1, occurrenceCount: 2 });
    expect(firstClaim[0]?.deferredRender).not.toBeNull();

    await repository.markRetry(messageId, 'x'.repeat(2100));
    let row = (await pool.query(
      'select status,attempts,next_attempt_at,last_error from public.notification_logs where id=$1',
      [messageId],
    )).rows[0];
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(1);
    expect(row.last_error).toHaveLength(2000);
    expect(row.next_attempt_at.getTime()).toBeGreaterThan(Date.now() + 50_000);

    await pool.query('update public.notification_logs set next_attempt_at=clock_timestamp() where id=$1', [messageId]);
    const secondClaim = await repository.claim(settings);
    expect(secondClaim[0]).toMatchObject({ id: messageId, attempts: 2 });
    await repository.markSent(messageId, 'provider-1', { subject: 'Sujet final', body: 'Corps final' });

    row = (await pool.query(
      `select status,sent_at,provider_message_id,subject,body,deferred_render,last_error
         from public.notification_logs where id=$1`,
      [messageId],
    )).rows[0];
    expect(row).toMatchObject({
      status: 'sent',
      provider_message_id: 'provider-1',
      subject: 'Sujet final',
      body: 'Corps final',
      deferred_render: null,
      last_error: null,
    });
    expect(row.sent_at).toBeInstanceOf(Date);
  });

  it('met au rebut un message trop vieux sans le rendre au worker', async () => {
    const messageId = await insertMessage({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    const claimed = await repository.claim({ ...DEFAULT_NOTIFICATION_SEND_SETTINGS, limit: 10_000 });

    expect(claimed.some((message) => message.id === messageId)).toBe(false);
    const row = (await pool.query(
      'select status,attempts,last_error from public.notification_logs where id=$1',
      [messageId],
    )).rows[0];
    expect(row).toMatchObject({ status: 'failed', attempts: 5 });
    expect(row.last_error).toContain('notification_stale');
  });

  it('saute une ligne verrouillee et reserve la suivante', async () => {
    const oldestId = await insertMessage({ createdAt: new Date('2026-09-01T00:00:00.000Z') });
    const nextId = await insertMessage({ createdAt: new Date('2026-09-02T00:00:00.000Z') });
    const locker = await pool.connect();
    try {
      await locker.query('begin');
      await locker.query('select id from public.notification_logs where id=$1 for update', [oldestId]);
      const claimed = await repository.claim({
        ...DEFAULT_NOTIFICATION_SEND_SETTINGS,
        limit: 1,
        maxAgeSeconds: 1_000_000_000,
      });
      expect(claimed[0]?.id).toBe(nextId);
      await repository.markFailed(nextId, 'definitif', null);
    } finally {
      await locker.query('rollback');
      locker.release();
    }
    await repository.markFailed(oldestId, 'nettoyage', null);
  });

  it('refuse la reclamation au role API', async () => {
    const apiTransactions = new PostgresTransactionRunner(pool, 'magrit_api');
    await expect(apiTransactions.run({}, (client) => client.query(
      'select * from magrit.claim_notification_messages(1,5,86400)',
    ))).rejects.toMatchObject({ code: '42501' });
  });

  async function insertMessage(options: { createdAt: Date; deferredRender?: unknown }): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `insert into public.notification_logs(
         id,tenant_id,event_id,event_name,aggregate_type,aggregate_id,template_id,
         channel,status,recipient,subject,body,occurrence_count,next_attempt_at,deferred_render,created_at
       ) values($1,$2,$3,'order.files_submitted','order',$4,$5,'email','pending',
                'client@example.test','Sujet provisoire','Corps provisoire',2,clock_timestamp(),$6,$7)`,
      [id, tenantId, randomUUID(), randomUUID(), templateId, options.deferredRender ?? null, options.createdAt],
    );
    return id;
  }
});
