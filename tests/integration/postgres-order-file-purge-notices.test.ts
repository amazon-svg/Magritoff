import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import {
  PostgresOrderFilePurgeNoticeGateway,
  PostgresOrderFilePurgeSweepRepository,
} from '../../src/adapters/postgres/order-file-purge-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import type { TenantId } from '../../src/kernel/ids/index.ts';
import { createPostgresOutboxDispatchApplication } from '../../src/server/api/outbox-dispatch-composition.ts';
import type {
  ClaimedOutboxEvent,
  OutboxDispatchRepository,
} from '../../src/modules/_shared/application/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('rappels de purge PostgreSQL', () => {
  let pool: Pool;
  let sweep: PostgresOrderFilePurgeSweepRepository;
  let gateway: PostgresOrderFilePurgeNoticeGateway;
  const tenantId = randomUUID() as TenantId;
  const actorId = randomUUID();
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const orderId = randomUUID();
  const fileId = randomUUID();

  beforeAll(async () => {
    pool = createPostgresPool();
    const worker = new PostgresTransactionRunner(pool, 'magrit_worker');
    sweep = new PostgresOrderFilePurgeSweepRepository(worker);
    gateway = new PostgresOrderFilePurgeNoticeGateway(worker);
    await pool.query(
      "insert into public.app_users(id,email_normalized,display_name) values($1,$2,'Responsable purge')",
      [actorId, `purge-${actorId}@example.invalid`],
    );
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Purge portable')", [
      tenantId, `purge-${tenantId}`,
    ]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [tenantId, actorId]);
    await pool.query(
      `insert into public.commercial_settings(tenant_id,order_file_purge_enabled)
       values($1,true) on conflict(tenant_id) do update set order_file_purge_enabled=true`,
      [tenantId],
    );
    await pool.query(
      "insert into public.customers(id,tenant_id,type,civility,first_name,last_name) values($1,$2,'individual','mr','Client','Purge')",
      [customerId, tenantId],
    );
    await pool.query("insert into public.projects(id,tenant_id,customer_id,name) values($1,$2,$3,'Projet purge')", [
      projectId, tenantId, customerId,
    ]);
    await pool.query(
      `insert into public.commercial_quotes(id,tenant_id,customer_id,project_id,number,status,valid_until,created_by)
       values($1,$2,$3,$4,'DEV-2026-00991','sent','2026-12-31',$5)`,
      [quoteId, tenantId, customerId, projectId, actorId],
    );
    await pool.query(
      `insert into public.commercial_orders(
         id,tenant_id,customer_id,quote_id,number,status,source_quote_status,lines_subtotal,
         global_discount,net_total,vat_rate,vat_amount,total_incl_tax,created_by
       ) values($1,$2,$3,$4,'CDE-2026-00991','validated','sent',100,0,100,.2,20,120,$5)`,
      [orderId, tenantId, customerId, quoteId, actorId],
    );
    await pool.query(
      `insert into public.commercial_order_files(
         id,order_id,filename,content_type,byte_size,storage_path,deposited_by,deposited_by_label,purge_at
       ) values($1,$2,'archive.pdf','application/pdf',123,$3,$4,'Responsable purge',clock_timestamp())`,
      [fileId, orderId, `${tenantId}/${orderId}/${fileId}`, actorId],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      'update public.outbox_events set published_at=coalesce(published_at,clock_timestamp()) where tenant_id=$1',
      [tenantId],
    );
    await pool.query(
      `update public.commercial_order_file_purge_notice_deliveries delivery
          set failed_at=coalesce(delivery.failed_at,clock_timestamp())
         from public.commercial_order_file_purge_notices notice
        where notice.id=delivery.notice_id and notice.tenant_id=$1`,
      [tenantId],
    );
    await pool.query(
      'update public.commercial_order_file_purge_notices set failed_at=coalesce(failed_at,clock_timestamp()) where tenant_id=$1',
      [tenantId],
    );
    await pool.query('delete from public.tenants where id=$1', [tenantId]);
    await pool.query('delete from public.app_users where id=$1', [actorId]);
    await pool.end();
  });

  it('émet les deux paliers et consigne une preuve de livraison', async () => {
    await expect(gateway.resolveRecipients(tenantId)).resolves.toEqual([{
      userId: actorId, email: `purge-${actorId}@example.invalid`,
    }]);
    await expect(gateway.getTenantSlug(tenantId)).resolves.toBe(`purge-${tenantId}`);

    const first = await sweep.claimNotices('first', 40);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ tenantId, fileCount: 1, orderCount: 1 });
    await expect(sweep.claimNotices('first', 40)).resolves.toEqual([]);

    const second = await sweep.claimNotices('second', 40);
    expect(second).toHaveLength(1);
    expect(second[0]?.noticeId).not.toBe(first[0]?.noticeId);
    const outbox = await pool.query(
      `select payload from public.outbox_events
        where tenant_id=$1 and event_name='order_files.purge_scheduled' order by occurred_at`,
      [tenantId],
    );
    expect(outbox.rows).toHaveLength(2);
    expect(outbox.rows[0]?.payload).toMatchObject({ stage: 'first', file_count: 1, order_count: 1 });

    const delivery = await gateway.recordDeliveryAttempt(first[0]!.noticeId, {
      userId: actorId,
      email: `purge-${actorId}@example.invalid`,
    }, { providerMessageId: 'resend-message-1' });
    expect(delivery.accepted).toBe(true);
    await pool.query(
      "update public.commercial_order_file_purge_notice_deliveries set next_check_at='1990-01-01T00:00:00Z' where id=$1",
      [delivery.id],
    );
    const pending = await sweep.claimDeliveriesForRecheck(1);
    expect(pending).toEqual([{
      deliveryId: delivery.id,
      noticeId: first[0]!.noticeId,
      providerMessageId: 'resend-message-1',
    }]);
    await sweep.recordDeliveryCheck(delivery.id, 'delivered');
    const notice = await pool.query(
      'select accepted_at,confirmed_at,failed_at from public.commercial_order_file_purge_notices where id=$1',
      [first[0]!.noticeId],
    );
    expect(notice.rows[0]?.accepted_at).toBeInstanceOf(Date);
    expect(notice.rows[0]?.confirmed_at).toBeInstanceOf(Date);
    expect(notice.rows[0]?.failed_at).toBeNull();
  });

  it('réserve les fonctions de mutation au worker', async () => {
    const api = new PostgresTransactionRunner(pool, 'magrit_api');
    await expect(api.run({}, (client) => client.query(
      "select * from magrit.claim_order_file_purge_notices('first',40)",
    ))).rejects.toMatchObject({ code: '42501' });
  });

  it('remet les événements via la composition outbox Node sans appel externe', async () => {
    const storage = createS3Client({
      S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
      S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
      S3_FORCE_PATH_STYLE: 'true',
    });
    const fetchImplementation = async () => new Response(JSON.stringify({ id: randomUUID() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    try {
      const rows = (await pool.query<{
        id: string;tenant_id: TenantId;event_name: ClaimedOutboxEvent['name'];event_version: number;
        aggregate_type: string;aggregate_id: string;payload: Record<string, unknown>;
        occurred_at: Date;delivery_attempts: number;
      }>(`select id,tenant_id,event_name,event_version,aggregate_type,aggregate_id,payload,
                 occurred_at,delivery_attempts
            from public.outbox_events
           where tenant_id=$1 and event_name='order_files.purge_scheduled' and published_at is null
           order by occurred_at`, [tenantId])).rows;
      const fixtureRepository: OutboxDispatchRepository = {
        async claim() {
          return rows.map((row) => ({
            id: row.id,tenantId: row.tenant_id,name: row.event_name,version: row.event_version,
            aggregateType: row.aggregate_type,aggregateId: row.aggregate_id,payload: row.payload,
            occurredAt: row.occurred_at.toISOString(),deliveryAttempts: row.delivery_attempts+1,
          }));
        },
        async markDelivered(eventId) {
          await pool.query(
            'update public.outbox_events set published_at=clock_timestamp(),last_error=null where id=$1 and tenant_id=$2',
            [eventId,tenantId],
          );
        },
        async markFailed(eventId,reason) {
          await pool.query(
            'update public.outbox_events set last_error=$3 where id=$1 and tenant_id=$2',
            [eventId,tenantId,reason],
          );
        },
      };
      const application = createPostgresOutboxDispatchApplication({
        transactions: new PostgresTransactionRunner(pool, 'magrit_worker'),
        storage,
        repository: fixtureRepository,
        resendApiKey: 'test-only',
        fromEmail: 'Magrit <test@example.invalid>',
        publicAppUrl: 'https://magrit.example.test',
        fetchImplementation,
        settings: { limit: 2, maxAttempts: 5, maxAgeSeconds: 2_000_000_000 },
      });
      const report = await application.runOnce();
      expect(report).toMatchObject({ claimed: 2, delivered: 2, failed: 0 });
      const state = await pool.query(
        `select count(*) filter(where published_at is not null)::int published,
                count(*) filter(where published_at is null)::int pending
           from public.outbox_events where tenant_id=$1 and event_name='order_files.purge_scheduled'`,
        [tenantId],
      );
      expect(state.rows[0]).toEqual({ published: 2, pending: 0 });
      const deliveries = await pool.query(
        `select count(*)::int as count from public.commercial_order_file_purge_notice_deliveries delivery
          join public.commercial_order_file_purge_notices notice on notice.id=delivery.notice_id
         where notice.tenant_id=$1`,
        [tenantId],
      );
      expect(deliveries.rows[0]?.count).toBe(2);
    } finally {
      storage.destroy();
    }
  });
});
