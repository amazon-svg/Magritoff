import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner';
import { withAuthenticatedPostgresRequest } from '../../src/adapters/postgres/authenticated-request-context';
import { createS3Client } from '../../src/adapters/s3/client';
import { PostgresCommercialOrdersRepository } from '../../src/adapters/postgres/commercial-orders-repository';
import { PostgresOrderDocumentsRepository } from '../../src/adapters/postgres/order-documents-repository';
import { PostgresDocumentTemplatesRepository } from '../../src/adapters/postgres/document-templates-repository';
import { PostgresOrderFilesRepository } from '../../src/adapters/postgres/order-files-repository';
import { PostgresOrderUploadLinksRepository } from '../../src/adapters/postgres/order-upload-links-repository';
import { OrderDocumentsService } from '../../src/modules/order-documents/application/order-documents-service';
import { CommercialOrdersService } from '../../src/modules/commercial-orders/application/commercial-orders-service';
import type { TenantId, UserId } from '../../src/kernel/ids';

const integration = process.env.MAGRIT_POSTGRES_INTEGRATION === '1' ? describe : describe.skip;
integration('commande boutique — PDF, fichiers et dépôt public réels', () => {
  let pool: Pool;
  const tenantId = randomUUID() as TenantId;
  const actor = randomUUID() as UserId;
  const shopId = randomUUID();
  const accountId = randomUUID();
  const orderId = randomUUID();
  const lineId = randomUUID();
  const templateId = randomUUID();
  const paths: { bucket: string; key: string }[] = [];
  const storage = createS3Client({ S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:58333',
    S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? 'magrit-local-secret', S3_FORCE_PATH_STYLE: 'true' });
  let orders: PostgresCommercialOrdersRepository;
  let documents: OrderDocumentsService;
  let files: PostgresOrderFilesRepository;
  let links: PostgresOrderUploadLinksRepository;
  const authenticated = <T>(operation: () => Promise<T>) => withAuthenticatedPostgresRequest({ tenantId, userId: actor }, operation);
  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query("insert into public.app_users(id,email_normalized,display_name) values($1,$2,'Gestionnaire')", [actor, `pdf-${actor}@example.invalid`]);
    await pool.query("insert into public.tenants(id,slug,name,tax_regime) values($1,$2,'PDF boutique','metropole_fr')", [tenantId, `pdf-${tenantId}`]);
    await pool.query("insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')", [tenantId, actor]);
    await pool.query("insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Boutique PDF')", [shopId, tenantId, actor, `pdf-${shopId}`]);
    await pool.query("insert into public.shop_customer_accounts(id,tenant_id,shop_id,email,normalized_email,full_name,status,activated_at) values($1,$2,$3,'acheteur@example.invalid','acheteur@example.invalid','Acheteur Boutique','active',clock_timestamp())", [accountId, tenantId, shopId]);
    await pool.query("insert into public.tenant_orders(id,tenant_id,shop_id,created_by,shop_customer_account_id,status,total_ht) values($1,$2,$3,$4,$5,'draft',25)", [orderId, tenantId, shopId, actor, accountId]);
    await pool.query("insert into public.tenant_order_items(id,order_id,product_label,clariprint_options,quantity,unit_price_ht,line_total_ht,price_origin) values($1,$2,'Article fixe','{}',2,12.50,25,'catalog')", [lineId, orderId]);
    const tx = new PostgresTransactionRunner(pool, 'magrit_api');
    orders = new PostgresCommercialOrdersRepository(tx);
    files = new PostgresOrderFilesRepository(tx, storage);
    links = new PostgresOrderUploadLinksRepository(tx, storage);
    const templates = new PostgresDocumentTemplatesRepository(tx, storage);
    documents = new OrderDocumentsService({ templates, customers: { async findCustomerForDocument() { throw new Error('Un compte boutique sans customer_id ne doit pas appeler le CRM'); } }, repository: new PostgresOrderDocumentsRepository(tx, storage) });
    const background = await PDFDocument.create(); background.addPage([595.28,841.89]);
    const bytes = await background.save();
    const key = `${tenantId}/${templateId}.pdf`;
    paths.push({ bucket: 'document-pdf-templates', key });
    await storage.send(new PutObjectCommand({ Bucket: 'document-pdf-templates', Key: key, Body: bytes, ContentType: 'application/pdf' }));
    await pool.query("insert into public.document_pdf_templates(id,tenant_id,document_type,name,status,storage_path,byte_size,sha256,page_count,pages,is_default,created_by) values($1,$2,'order','Bon boutique','ready',$3,$4,$5,1,$6::jsonb,true,$7)", [templateId, tenantId, key, bytes.length, 'a'.repeat(64), JSON.stringify([{ index: 0,width_pt: 595.28,height_pt: 841.89 }]), actor]);
    await templates.replaceFields(tenantId, actor, templateId, { placements: [
      'order.number', 'customer.contact_name', 'customer.email', 'totals.net_total', 'totals.vat_amount', 'totals.total_incl_tax'
    ].map((field, index) => ({ field, page_index: 0, x: 30, y: 750-index*30, width: 500, max_lines: 1, align: 'left', font: 'helvetica', font_size: 12, color: '#000000' })) as Parameters<typeof templates.replaceFields>[3]['placements'], lines_block: null });
  });
  afterAll(async () => {
    for (const path of paths) await storage.send(new DeleteObjectCommand({ Bucket: path.bucket, Key: path.key })).catch(() => undefined);
    storage.destroy();
    if (pool) {
      await pool.query('delete from public.tenants where id=$1', [tenantId]);
      await pool.query('delete from public.app_users where id=$1', [actor]); await pool.end();
    }
  });
  it('génère puis télécharge un vrai PDF boutique, garde les montants et interdit une seconde production', async () => authenticated(async () => {
    const data = await orders.findForDocumentGeneration(tenantId, orderId);
    expect(data).toMatchObject({ number: orderId, customerId: null, quoteNumber: null, showDiscounts: false,
      customerFallback: { contactName: 'Acheteur Boutique', email: 'acheteur@example.invalid' },
      totals: { net_total: '25.00', vat_rate: '0.2000', vat_amount: '5.00', total_incl_tax: '30.00' },
      lines: [{ position: 0, label: 'Article fixe', quantity: 2, salePrice: '25.00' }] });
    const service = new CommercialOrdersService({ repository: orders, documents, outbox: {} as never, quotes: {} as never });
    paths.push({ bucket: 'order-documents', key: `${tenantId}/${orderId}.pdf` });
    await pool.query('update public.document_pdf_templates set is_default=false where id=$1', [templateId]);
    await expect(service.generateDocument(tenantId, actor, orderId)).rejects.toMatchObject({ name: 'OrderDocumentTemplateMissingError' });
    await pool.query('update public.document_pdf_templates set is_default=true where id=$1', [templateId]);
    const generated = await service.generateDocument(tenantId, actor, orderId);
    const response = await fetch(generated.download_url);
    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(generated).toMatchObject({ order_id: orderId, byte_size: bytes.length, generated_by: actor });
    expect(await service.getDocument(tenantId, orderId)).toMatchObject({ sha256: generated.sha256 });
    await expect(service.generateDocument(tenantId, actor, orderId)).rejects.toMatchObject({ name: 'OrderDocumentAlreadyGeneratedError' });
    await expect(service.generateDocument(randomUUID() as TenantId, actor, orderId)).rejects.toMatchObject({ name: 'CommercialOrderNotFoundError' });
  }));
  it('dépose et télécharge un fichier rattaché à une ligne boutique', async () => authenticated(async () => {
    const ticket = await files.issueUploadUrl(tenantId, orderId);
    paths.push({ bucket: 'commercial-order-files', key: ticket.path });
    const bytes = new TextEncoder().encode('%PDF-1.7 BAT boutique');
    const upload = await fetch(ticket.url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'If-None-Match': '*' }, body: bytes });
    expect(upload.status).toBe(200);
    await files.confirmUpload(tenantId, orderId, actor, { file_id: ticket.file_id, filename: 'bat-boutique.pdf', order_line_id: lineId });
    const listed = await files.listByOrder(tenantId, orderId);
    expect(listed).toHaveLength(1);
    const file = await files.findById(tenantId, orderId, ticket.file_id);
    const download = await fetch(file!.download_url);
    expect(download.status).toBe(200);
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
  }));
  it('autorise un dépôt public sans session, puis refuse les liens expirés ou révoqués', async () => {
    const link = await links.create(tenantId, orderId, actor, { expires_in_days: 1, max_files: 1, label: 'Dépôt boutique' });
    // Hors contexte authentifié : reproduit le navigateur du destinataire.
    expect(await links.getContext(link.token)).toMatchObject({ order_number: orderId.slice(0,8).toUpperCase() });
    const ticket = await links.issueFileUploadUrl(link.token);
    paths.push({ bucket: 'commercial-order-files', key: ticket.path });
    const upload = await fetch(ticket.url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'If-None-Match': '*' }, body: new TextEncoder().encode('%PDF-1.7 dépôt public') });
    expect(upload.status).toBe(200);
    expect(await links.confirmFileUpload(link.token, { file_id: ticket.file_id, filename: 'depot-public.pdf' })).toMatchObject({ orderId, deposit: { deposited_count: 1 } });
    await expect(links.issueFileUploadUrl(link.token)).rejects.toMatchObject({ name: 'OrderUploadLinkFileLimitReachedError' });
    await expect(links.confirmFileUpload(link.token, { file_id: ticket.file_id, filename: 'depot-public.pdf' })).rejects.toMatchObject({ name: 'OrderFileAlreadyConfirmedError' });
    await pool.query("update public.commercial_order_upload_links set created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 second' where id=$1", [link.id]);
    expect(await links.resolvePrincipal(link.token)).toBeNull();
    await expect(links.issueFileUploadUrl(link.token)).rejects.toMatchObject({ name: 'OrderUploadLinkNotFoundError' });
    const revoked = await links.create(tenantId, orderId, actor, { expires_in_days: 1, max_files: 1, label: 'Révoqué' });
    await links.revoke(tenantId, orderId, revoked.id, actor);
    expect(await links.getContext(revoked.token)).toBeNull();
  });
});
