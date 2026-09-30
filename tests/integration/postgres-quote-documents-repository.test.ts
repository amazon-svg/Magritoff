import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresQuoteDocumentsRepository } from '../../src/adapters/postgres/quote-documents-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresQuoteDocumentsRepository — PostgreSQL et S3 reels', () => {
  let pool: Pool;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const templateId = randomUUID();
  const bucket = 'quote-documents';
  const finalPath = `${tenantId}/${quoteId}.pdf`;
  const previewPath = `${tenantId}/previews/${quoteId}.pdf`;
  const storage = createS3Client({
    S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
    S3_REGION: process.env['S3_REGION'] ?? 'us-east-1',
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
    S3_FORCE_PATH_STYLE: 'true',
  });

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query(`insert into public.app_users (id,email_normalized,display_name) values ($1,$2,'Quote Document User')`,
      [actorId, `quote-document-${actorId}@example.invalid`]);
    await pool.query(`insert into public.tenants (id,slug,name) values ($1,$2,'Quote Documents'),($3,$4,'Foreign Quote Documents')`,
      [tenantId, `quote-documents-${tenantId}`, foreignTenantId, `quote-documents-${foreignTenantId}`]);
    await pool.query(`insert into public.tenant_members (tenant_id,user_id,role) values ($1,$2,'admin')`, [tenantId, actorId]);
    await pool.query(`insert into public.customers (id,tenant_id,type,civility,first_name,last_name) values ($1,$2,'individual','mr','Jean','Document')`,
      [customerId, tenantId]);
    await pool.query(`insert into public.projects (id,tenant_id,customer_id,name) values ($1,$2,$3,'Projet document')`,
      [projectId, tenantId, customerId]);
    await pool.query(`insert into public.commercial_quotes (id,tenant_id,customer_id,project_id,number,status) values ($1,$2,$3,$4,'DEV-2026-00777','sent')`,
      [quoteId, tenantId, customerId, projectId]);
    await pool.query(`
      insert into public.document_pdf_templates (
        id,tenant_id,name,status,storage_path,byte_size,sha256,page_count,pages,is_default,created_by
      ) values ($1,$2,'Document quote','ready',$3,100,$4,1,$5::jsonb,true,$6)
    `, [templateId, tenantId, `${tenantId}/${templateId}.pdf`, 'a'.repeat(64),
      JSON.stringify([{ index: 0, width_pt: 595.28, height_pt: 841.89 }]), actorId]);
  });

  afterAll(async () => {
    await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: finalPath })).catch(() => undefined);
    await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: previewPath })).catch(() => undefined);
    if (pool) {
      await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, foreignTenantId]]);
      await pool.query('delete from public.app_users where id=$1', [actorId]);
      await pool.end();
    }
    storage.destroy();
  });

  it('stocke une piece definitive une seule fois et la rend uniquement dans son tenant', async () => {
    const repository = new PostgresQuoteDocumentsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    const bytes = new TextEncoder().encode('%PDF-1.7 document definitif');
    const generatedAt = new Date('2026-09-30T12:00:00.000Z').toISOString();
    const stored = await repository.store(tenantId, actorId, {
      quoteId, templateId, bytes, pageCount: 1, generatedAt,
    });

    expect(stored).toMatchObject({
      quote_id: quoteId,
      template_id: templateId,
      generated_at: generatedAt,
      byte_size: bytes.length,
      content_type: 'application/pdf',
      page_count: 1,
    });
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.download_url).toContain('X-Amz-Signature=');
    await expect(repository.findByQuoteId(tenantId, quoteId)).resolves.toMatchObject({ quote_id: quoteId });
    await expect(repository.findByQuoteId(foreignTenantId, quoteId)).resolves.toBeNull();
    await expect(repository.findForStorefrontSession('not-migrated', quoteId)).resolves.toBeNull();
    await expect(repository.store(tenantId, actorId, {
      quoteId, templateId, bytes: new TextEncoder().encode('replacement'), pageCount: 1, generatedAt,
    })).rejects.toThrow('existe deja');

    const object = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: finalPath }));
    await expect(object.Body?.transformToByteArray()).resolves.toEqual(bytes);
  });

  it('remplace l apercu sans creer de ligne definitive', async () => {
    const repository = new PostgresQuoteDocumentsRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    const first = new TextEncoder().encode('%PDF-1.7 preview one');
    const second = new TextEncoder().encode('%PDF-1.7 preview two');
    const params = {
      quoteId, templateId, pageCount: 1,
      generatedAt: new Date('2026-09-30T12:05:00.000Z').toISOString(),
    };
    await repository.storePreview(tenantId, { ...params, bytes: first });
    const preview = await repository.storePreview(tenantId, { ...params, bytes: second });
    expect(preview).toMatchObject({ quote_id: quoteId, watermark: 'DRAFT', byte_size: second.length });
    expect(preview.download_url).toContain('X-Amz-Signature=');
    const object = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: previewPath }));
    await expect(object.Body?.transformToByteArray()).resolves.toEqual(second);
  });
});
