import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresOrderFilesRepository } from '../../src/adapters/postgres/order-files-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('PostgresOrderFilesRepository — PostgreSQL et S3 réels', () => {
  let pool: Pool;
  let orderId: string;
  let orderLineId: string;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const quoteLineId = randomUUID();
  const objectPaths = new Set<string>();
  const bucket = 'commercial-order-files';
  const storage = createS3Client({
    S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
    S3_REGION: process.env['S3_REGION'] ?? 'us-east-1',
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
    S3_FORCE_PATH_STYLE: 'true',
  });

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query(
      "insert into public.app_users(id, email_normalized, display_name) values ($1, $2, 'Order File User')",
      [actorId, `order-file-${actorId}@example.invalid`],
    );
    await pool.query(
      `insert into public.tenants(id, slug, name)
       values ($1, $2, 'Order Files'), ($3, $4, 'Foreign Order Files')`,
      [tenantId, `order-files-${tenantId}`, foreignTenantId, `order-files-${foreignTenantId}`],
    );
    await pool.query("insert into public.tenant_members(tenant_id, user_id, role) values ($1, $2, 'member')", [
      tenantId,
      actorId,
    ]);
    await pool.query(
      "insert into public.customers(id, tenant_id, type, civility, first_name, last_name) values ($1, $2, 'individual', 'mr', 'Jean', 'Fichier')",
      [customerId, tenantId],
    );
    await pool.query(
      "insert into public.projects(id, tenant_id, customer_id, name) values ($1, $2, $3, 'Projet fichier')",
      [projectId, tenantId, customerId],
    );
    await pool.query(
      `insert into public.commercial_quotes(
         id, tenant_id, customer_id, project_id, number, status, created_by
       ) values ($1, $2, $3, $4, 'DEV-2026-00889', 'draft', $5)`,
      [quoteId, tenantId, customerId, projectId, actorId],
    );
    await pool.query(
      `insert into public.commercial_quote_lines(
         id, quote_id, origin, label, product_config, quantity, position,
         production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
       ) values ($1, $2, 'free', 'Fichier', '{}', 1, 0, 10, 20, 20, .5, 20, '[{"label":"base","amount":"20.00"}]')`,
      [quoteLineId, quoteId],
    );
    await pool.query(
      "update public.commercial_quotes set status = 'sent', sent_at = clock_timestamp() where id = $1",
      [quoteId],
    );
    const transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    orderId = await transactions.run({ tenantId, userId: actorId }, async (client) => (
      await client.query('select magrit.convert_commercial_quote($1, $2) as id', [tenantId, quoteId])
    ).rows[0].id);
    orderLineId = (
      await pool.query('select id from public.tenant_order_items where order_id = $1', [orderId])
    ).rows[0].id;
  });

  afterAll(async () => {
    for (const path of objectPaths) {
      await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: path })).catch(() => undefined);
    }
    if (pool) {
      await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
      await pool.query('delete from public.app_users where id = $1', [actorId]);
      await pool.end();
    }
    storage.destroy();
  });

  it('émet, confirme, relit, modifie et supprime un fichier sans Supabase', async () => {
    const repository = new PostgresOrderFilesRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    const ticket = await repository.issueUploadUrl(tenantId, orderId);
    expect(ticket).toMatchObject({
      file_id: expect.any(String),
      path: `${tenantId}/${orderId}/${ticket.file_id}`,
      max_byte_size: 50 * 1024 * 1024,
    });
    expect(ticket.url).toContain('X-Amz-Signature=');

    const bytes = new TextEncoder().encode('%PDF-1.7 fichier de commande');
    objectPaths.add(ticket.path);
    const upload = await fetch(ticket.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf', 'If-None-Match': '*' },
      body: bytes,
    });
    expect(upload.status, await upload.text()).toBe(200);
    const overwrite = await fetch(ticket.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf', 'If-None-Match': '*' },
      body: new TextEncoder().encode('replacement'),
    });
    expect(overwrite.status).toBe(412);

    const confirmed = await repository.confirmUpload(tenantId, orderId, actorId, {
      file_id: ticket.file_id,
      filename: 'bon-a-tirer.pdf',
      order_line_id: orderLineId,
      visibility: 'internal',
    });
    expect(confirmed).toMatchObject({
      id: ticket.file_id,
      order_id: orderId,
      order_line_id: orderLineId,
      filename: 'bon-a-tirer.pdf',
      content_type: 'application/pdf',
      byte_size: bytes.length,
      visibility: 'internal',
      deposited_by: actorId,
      deposited_by_label: 'Order File User',
      deposited_via: 'workspace',
    });
    expect(confirmed.purge_at).toBeTruthy();

    await expect(repository.listByOrder(tenantId, orderId)).resolves.toEqual([confirmed]);
    await expect(repository.listByOrder(foreignTenantId, orderId)).resolves.toBeNull();
    const detail = await repository.findById(tenantId, orderId, ticket.file_id);
    expect(detail).toMatchObject({ id: ticket.file_id, download_url: expect.stringContaining('X-Amz-Signature=') });

    const visible = await repository.updateVisibility(
      tenantId,
      orderId,
      ticket.file_id,
      actorId,
      { visibility: 'customer' },
    );
    expect(visible.visibility).toBe('customer');
    await expect(repository.confirmUpload(tenantId, orderId, actorId, {
      file_id: ticket.file_id,
      filename: 'copie.pdf',
    })).rejects.toMatchObject({ name: 'OrderFileAlreadyConfirmedError' });

    await repository.remove(tenantId, orderId, ticket.file_id, actorId);
    await expect(repository.findRawById(tenantId, orderId, ticket.file_id)).resolves.toBeNull();
    await expect(storage.send(new GetObjectCommand({ Bucket: bucket, Key: ticket.path }))).rejects.toBeTruthy();
  });

  it('refuse une confirmation sans objet et un rattachement à une ligne étrangère', async () => {
    const repository = new PostgresOrderFilesRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    await expect(repository.confirmUpload(tenantId, orderId, actorId, {
      file_id: randomUUID(),
      filename: 'absent.pdf',
    })).rejects.toMatchObject({ name: 'OrderFileUploadMissingError' });

    const ticket = await repository.issueUploadUrl(tenantId, orderId);
    objectPaths.add(ticket.path);
    await storage.send(new PutObjectCommand({
      Bucket: bucket,
      Key: ticket.path,
      Body: new Uint8Array([1, 2, 3]),
      ContentType: 'image/png',
    }));
    await expect(repository.confirmUpload(tenantId, orderId, actorId, {
      file_id: ticket.file_id,
      filename: 'image.png',
      order_line_id: randomUUID(),
    })).rejects.toMatchObject({ name: 'OrderFileLineNotFoundError' });
  });
});
