import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresOrderDocumentsRepository } from '../../src/adapters/postgres/order-documents-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('PostgresOrderDocumentsRepository — PostgreSQL et S3 réels', () => {
  let pool: Pool;
  let orderId: string;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const quoteLineId = randomUUID();
  const templateId = randomUUID();
  const quoteTemplateId = randomUUID();
  const bucket = 'order-documents';
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
      "insert into public.app_users(id, email_normalized, display_name) values ($1, $2, 'Order Document User')",
      [actorId, `order-document-${actorId}@example.invalid`],
    );
    await pool.query(
      `insert into public.tenants(id, slug, name)
       values ($1, $2, 'Order Documents'), ($3, $4, 'Foreign Order Documents')`,
      [tenantId, `order-documents-${tenantId}`, foreignTenantId, `order-documents-${foreignTenantId}`],
    );
    await pool.query("insert into public.tenant_members(tenant_id, user_id, role) values ($1, $2, 'admin')", [
      tenantId,
      actorId,
    ]);
    await pool.query(
      "insert into public.customers(id, tenant_id, type, civility, first_name, last_name) values ($1, $2, 'individual', 'mr', 'Jean', 'Document')",
      [customerId, tenantId],
    );
    await pool.query(
      "insert into public.projects(id, tenant_id, customer_id, name) values ($1, $2, $3, 'Projet document')",
      [projectId, tenantId, customerId],
    );
    await pool.query(
      `insert into public.commercial_quotes(
         id, tenant_id, customer_id, project_id, number, status, created_by
       ) values ($1, $2, $3, $4, 'DEV-2026-00888', 'draft', $5)`,
      [quoteId, tenantId, customerId, projectId, actorId],
    );
    await pool.query(
      `insert into public.commercial_quote_lines(
         id, quote_id, origin, label, product_config, quantity, position,
         production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
       ) values ($1, $2, 'free', 'Document', '{}', 1, 0, 10, 20, 20, .5, 20, '[{"label":"base","amount":"20.00"}]')`,
      [quoteLineId, quoteId],
    );
    await pool.query(
      "update public.commercial_quotes set status = 'sent', sent_at = clock_timestamp() where id = $1",
      [quoteId],
    );
    orderId = await new PostgresTransactionRunner(pool, 'magrit_api').run(
      { tenantId, userId: actorId },
      async (client) => (
        await client.query('select magrit.convert_commercial_quote($1, $2) as id', [tenantId, quoteId])
      ).rows[0].id,
    );
    await pool.query(
      `insert into public.document_pdf_templates(
         id, tenant_id, document_type, name, status, storage_path, byte_size, sha256,
         page_count, pages, is_default, created_by
       ) values
         ($1, $2, 'order', 'Bon de commande', 'ready', $3, 100, $4, 1, $5::jsonb, true, $6),
         ($7, $2, 'quote', 'Devis', 'ready', $8, 100, $4, 1, $5::jsonb, true, $6)`,
      [
        templateId,
        tenantId,
        `${tenantId}/${templateId}.pdf`,
        'a'.repeat(64),
        JSON.stringify([{ index: 0, width_pt: 595.28, height_pt: 841.89 }]),
        actorId,
        quoteTemplateId,
        `${tenantId}/${quoteTemplateId}.pdf`,
      ],
    );
  });

  afterAll(async () => {
    if (orderId) {
      await storage
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: `${tenantId}/${orderId}.pdf` }))
        .catch(() => undefined);
    }
    if (pool) {
      await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
      await pool.query('delete from public.app_users where id = $1', [actorId]);
      await pool.end();
    }
    storage.destroy();
  });

  it('stocke le bon une seule fois, avec son auteur, et isole sa lecture', async () => {
    const repository = new PostgresOrderDocumentsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    const bytes = new TextEncoder().encode('%PDF-1.7 bon de commande');
    const generatedAt = '2026-09-30T12:00:00.000Z';
    const stored = await repository.store(tenantId, actorId, {
      orderId,
      templateId,
      bytes,
      pageCount: 1,
      generatedAt,
    });

    expect(stored).toMatchObject({
      order_id: orderId,
      template_id: templateId,
      generated_at: generatedAt,
      generated_by: actorId,
      generated_by_label: 'Order Document User',
      byte_size: bytes.length,
      content_type: 'application/pdf',
      page_count: 1,
    });
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.download_url).toContain('X-Amz-Signature=');
    await expect(repository.findByOrderId(tenantId, orderId)).resolves.toMatchObject({ order_id: orderId });
    await expect(repository.findByOrderId(foreignTenantId, orderId)).resolves.toBeNull();

    await expect(
      repository.store(tenantId, actorId, {
        orderId,
        templateId,
        bytes: new TextEncoder().encode('replacement'),
        pageCount: 1,
        generatedAt,
      }),
    ).rejects.toMatchObject({ name: 'OrderDocumentAlreadyGeneratedError' });
    const object = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: `${tenantId}/${orderId}.pdf` }));
    await expect(object.Body?.transformToByteArray()).resolves.toEqual(bytes);
  });

  it('refuse une commande absente avant tout dépôt S3', async () => {
    const repository = new PostgresOrderDocumentsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    await expect(
      repository.store(tenantId, actorId, {
        orderId: randomUUID(),
        templateId: quoteTemplateId,
        bytes: new TextEncoder().encode('%PDF-1.7 invalide'),
        pageCount: 1,
        generatedAt: '2026-09-30T12:05:00.000Z',
      }),
    ).rejects.toMatchObject({ name: 'CommercialOrderNotFoundError' });
  });
});
