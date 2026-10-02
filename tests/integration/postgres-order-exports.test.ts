import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import {
  PostgresOrderExportOrphanRepository,
  PostgresOrderExportPurgeRepository,
  PostgresOrderExportsRepository,
} from '../../src/adapters/postgres/order-exports-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { createPostgresOrderExportRunApplication } from '../../src/server/api/order-export-composition.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('exports de commandes PostgreSQL/S3', () => {
  let pool: Pool;
  const tenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const quoteLineId = randomUUID();
  const orderId = randomUUID();
  const orderLineId = randomUUID();
  let exportId: string | null = null;
  const storage = createS3Client({
    S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
    S3_FORCE_PATH_STYLE: 'true',
  });

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query(
      "insert into public.app_users(id,email_normalized,display_name) values($1,$2,'Responsable exports')",
      [actorId, `exports-${actorId}@example.invalid`],
    );
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Exports portables')", [
      tenantId,
      `exports-${tenantId}`,
    ]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [
      tenantId,
      actorId,
    ]);
    await pool.query(
      "insert into public.customers(id,tenant_id,type,civility,first_name,last_name) values($1,$2,'individual','mr','Client','Export')",
      [customerId, tenantId],
    );
    await pool.query("insert into public.projects(id,tenant_id,customer_id,name) values($1,$2,$3,'Projet export')", [
      projectId,
      tenantId,
      customerId,
    ]);
    await pool.query(
      `insert into public.commercial_quotes(id,tenant_id,customer_id,project_id,number,status,valid_until,created_by)
       values($1,$2,$3,$4,'DEV-2026-00992','draft','2026-12-31',$5)`,
      [quoteId, tenantId, customerId, projectId, actorId],
    );
    await pool.query(
      `insert into public.commercial_quote_lines(
         id,quote_id,origin,label,product_config,quantity,position,production_price,
         public_price,customer_price,applied_margin_rate,sale_price,breakdown
       ) values($1,$2,'free','Ligne export','{}',2,0,40,100,90,.5,180,'[{"label":"base","amount":"180.00"}]')`,
      [quoteLineId, quoteId],
    );
    await pool.query(
      "update public.commercial_quotes set status='sent',sent_at=clock_timestamp() where id=$1",
      [quoteId],
    );
    await pool.query(
      `insert into public.commercial_orders(
         id,tenant_id,customer_id,quote_id,number,status,source_quote_status,lines_subtotal,
         global_discount,net_total,vat_rate,vat_amount,total_incl_tax,created_by
       ) values($1,$2,$3,$4,'CDE-2026-00992','validated','sent',180,0,180,.2,36,216,$5)`,
      [orderId, tenantId, customerId, quoteId, actorId],
    );
    await pool.query(
      `insert into public.commercial_order_lines(
         id,order_id,source_quote_line_id,origin,label,product_config,quantity,position,
         production_price,public_price,customer_price,applied_margin_rate,sale_price,breakdown
       ) values($1,$2,$3,'free','Ligne export','{}',2,0,40,100,90,.5,180,'[{"label":"base","amount":"180.00"}]')`,
      [orderLineId, orderId, quoteLineId],
    );
  });

  afterAll(async () => {
    if (exportId !== null) {
      await storage.send(new DeleteObjectCommand({
        Bucket: 'order-exports',
        Key: `${tenantId}/${exportId}.csv`,
      })).catch(() => undefined);
    }
    if (pool) {
      await pool.query('delete from public.tenants where id=$1', [tenantId]);
      await pool.query('delete from public.app_users where id=$1', [actorId]);
      await pool.end();
    }
    storage.destroy();
  });

  it('crée, génère et signe un export CSV sans Supabase', async () => {
    const apiTransactions = new PostgresTransactionRunner(pool, 'magrit_api');
    const repository = new PostgresOrderExportsRepository(apiTransactions, storage, 'order-exports');
    await expect(repository.actorHasCapability(tenantId, actorId, 'can_export_orders')).resolves.toBe(true);
    const requested = await repository.request(tenantId, actorId, {
      format: 'csv',
      granularity: 'line',
      filters: { customer_id: customerId },
    });
    exportId = requested.id;
    expect(requested).toMatchObject({ status: 'pending', requested_by: actorId, attempts: 0 });

    const application = createPostgresOrderExportRunApplication({
      transactions: new PostgresTransactionRunner(pool, 'magrit_worker'),
      storage,
    });
    await expect(application.runOnce()).resolves.toEqual({ claimed: 1, ready: 1, failed: 0 });

    const object = await storage.send(new GetObjectCommand({
      Bucket: 'order-exports',
      Key: `${tenantId}/${exportId}.csv`,
    }));
    const csv = await object.Body!.transformToString();
    expect(csv).toContain('CDE-2026-00992');
    expect(csv).toContain('Ligne export');

    const ready = await repository.findById(tenantId, actorId, exportId);
    expect(ready).toMatchObject({
      status: 'ready',
      requested_by: actorId,
      row_count: 1,
      byte_size: expect.any(Number),
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      download_url: expect.stringContaining(`${tenantId}/${exportId}.csv`),
    });
    await expect(repository.list(tenantId, actorId, {
      status: 'ready',
      format: 'csv',
      granularity: 'line',
      size: 20,
      cursor: null,
    })).resolves.toHaveLength(1);

    await pool.query(
      "update public.commercial_order_exports set expires_at=clock_timestamp()-interval '1 day' where id=$1",
      [exportId],
    );
    const workerTransactions = new PostgresTransactionRunner(pool, 'magrit_worker');
    const purge = new PostgresOrderExportPurgeRepository(workerTransactions, storage, 'order-exports');
    await expect(purge.purgeExpiredFiles(1)).resolves.toEqual({ filesMarkedExpired: 1, objectsRemoved: 1 });
    await expect(storage.send(new GetObjectCommand({
      Bucket: 'order-exports',
      Key: `${tenantId}/${exportId}.csv`,
    }))).rejects.toBeDefined();
    const expired = await pool.query(
      'select status,storage_path,purge_attempts from public.commercial_order_exports where id=$1',
      [exportId],
    );
    expect(expired.rows[0]).toEqual({ status: 'expired', storage_path: null, purge_attempts: 1 });

    const residualPath = `${tenantId}/${exportId}.csv`;
    await storage.send(new PutObjectCommand({ Bucket: 'order-exports', Key: residualPath, Body: 'residual' }));
    await pool.query(
      'update public.commercial_order_exports set storage_path=$2,purge_attempts=3 where id=$1',
      [exportId, residualPath],
    );
    const orphans = new PostgresOrderExportOrphanRepository(workerTransactions, storage, 'order-exports');
    await expect(orphans.removeOrphanObjects(24, 1)).resolves.toBe(1);
    await expect(storage.send(new GetObjectCommand({ Bucket: 'order-exports', Key: residualPath }))).rejects.toBeDefined();
    const recovered = await pool.query(
      'select storage_path from public.commercial_order_exports where id=$1',
      [exportId],
    );
    expect(recovered.rows[0]?.storage_path).toBeNull();
  });

  it('réserve les opérations du drain au worker', async () => {
    const api = new PostgresTransactionRunner(pool, 'magrit_api');
    await expect(api.run({ tenantId, userId: actorId }, (client) => client.query(
      'select * from magrit.claim_order_exports(1,3,900)',
    ))).rejects.toMatchObject({ code: '42501' });
  });
});
