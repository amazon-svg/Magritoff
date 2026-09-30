import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresQuoteNotificationGateway } from '../../src/adapters/postgres/quote-notification-gateway.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import { S3QuoteDocumentAttachmentGateway } from '../../src/adapters/s3/quote-document-attachment-gateway.ts';
import type { TenantId } from '../../src/kernel/ids/index.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('gateways portables de notification quote.sent', () => {
  let pool: Pool;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const actorId = randomUUID();
  const customerId = randomUUID();
  const contactId = randomUUID();
  const shopId = randomUUID();
  const accountId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const templateId = randomUUID();
  const storagePath = `${tenantId}/${quoteId}.pdf`;
  const bytes = new TextEncoder().encode('%PDF-1.7 notification portable');
  const storage = createS3Client({
    S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
    S3_FORCE_PATH_STYLE: 'true',
  });

  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query("insert into public.app_users(id,email_normalized,display_name) values($1,$2,'Worker owner')", [actorId, `worker-${actorId}@example.invalid`]);
    await pool.query("insert into public.tenants(id,slug,name) values($1,$2,'Worker tenant'),($3,$4,'Foreign tenant')", [tenantId, `worker-${tenantId}`, foreignTenantId, `foreign-${foreignTenantId}`]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [tenantId, actorId]);
    await pool.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,'worker-shop','Boutique Worker')", [shopId, tenantId, actorId]);
    await pool.query("insert into public.customers(id,tenant_id,type,civility,first_name,last_name) values($1,$2,'individual','mrs','Alice','Client')", [customerId, tenantId]);
    await pool.query("insert into public.customer_contacts(id,customer_id,first_name,last_name,email,is_primary) values($1,$2,'Alice','Client','alice@example.test',true)", [contactId, customerId]);
    await pool.query(`insert into public.shop_customer_accounts(id,shop_id,tenant_id,email,normalized_email,full_name,status,customer_contact_id,activated_at)
      values($1,$2,$3,'alice@example.test','alice@example.test','Alice Client','active',$4,clock_timestamp())`, [accountId, shopId, tenantId, contactId]);
    await pool.query("insert into public.projects(id,tenant_id,customer_id,name) values($1,$2,$3,'Projet worker')", [projectId, tenantId, customerId]);
    await pool.query("insert into public.commercial_quotes(id,tenant_id,customer_id,project_id,number,status,valid_until) values($1,$2,$3,$4,'DEV-2026-00888','sent','2026-12-31')", [quoteId, tenantId, customerId, projectId]);
    await pool.query(`insert into public.document_pdf_templates(id,tenant_id,name,status,storage_path,byte_size,sha256,page_count,pages,is_default,created_by)
      values($1,$2,'Worker PDF','ready',$3,100,$4,1,$5::jsonb,true,$6)`, [templateId, tenantId, `${tenantId}/${templateId}.pdf`, 'b'.repeat(64), JSON.stringify([{ index: 0, width_pt: 595, height_pt: 842 }]), actorId]);
    await pool.query(`insert into public.quote_documents(tenant_id,quote_id,template_id,storage_path,byte_size,sha256,page_count,generated_at,generated_by)
      values($1,$2,$3,$4,$5,$6,1,clock_timestamp(),$7)`, [tenantId, quoteId, templateId, storagePath, bytes.length, 'c'.repeat(64), actorId]);
    await storage.send(new PutObjectCommand({ Bucket: 'quote-documents', Key: storagePath, Body: bytes, ContentType: 'application/pdf' }));
  });

  afterAll(async () => {
    await storage.send(new DeleteObjectCommand({ Bucket: 'quote-documents', Key: storagePath })).catch(() => undefined);
    if (pool) {
      await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, foreignTenantId]]);
      await pool.query('delete from public.app_users where id=$1', [actorId]);
      await pool.end();
    }
    storage.destroy();
  });

  it('résout le devis et ses destinataires dans le tenant explicite', async () => {
    const gateway = new PostgresQuoteNotificationGateway(new PostgresTransactionRunner(pool, 'magrit_worker'));
    await expect(gateway.getQuoteContext(tenantId, quoteId)).resolves.toEqual({ validUntil: '2026-12-31' });
    await expect(gateway.resolveRecipients(tenantId, customerId)).resolves.toEqual([{
      email: 'alice@example.test', customerName: 'Alice Client', shopSlug: 'worker-shop', shopName: 'Boutique Worker',
    }]);
    await expect(gateway.getQuoteContext(foreignTenantId, quoteId)).resolves.toBeNull();
    await expect(gateway.resolveRecipients(foreignTenantId, customerId)).resolves.toEqual([]);
  });

  it('lit une seule pièce jointe depuis S3 et refuse le tenant étranger', async () => {
    const gateway = new S3QuoteDocumentAttachmentGateway(
      new PostgresTransactionRunner(pool, 'magrit_worker'), storage, 'quote-documents',
    );
    await expect(gateway.findAttachment(tenantId, quoteId)).resolves.toEqual({
      base64Content: Buffer.from(bytes).toString('base64'),
    });
    await expect(gateway.findAttachment(foreignTenantId, quoteId)).resolves.toBeNull();
  });

  it('interdit les projections worker au rôle API', async () => {
    const api = new PostgresTransactionRunner(pool, 'magrit_api');
    await expect(api.run({}, (client) => client.query(
      'select * from magrit.outbox_quote_recipients($1,$2)', [tenantId, customerId],
    ))).rejects.toMatchObject({ code: '42501' });
  });
});
