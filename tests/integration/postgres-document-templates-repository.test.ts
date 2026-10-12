import { withAuthenticatedPostgresRequest } from '../../src/adapters/postgres/authenticated-request-context';
import { createGescomApiHandler } from '../../src/server/api/gescom-middleware';
import { createDocumentTemplatesRoutes } from '../../src/server/api/document-templates-routes';
import { InMemoryIdempotencyStore } from '../../src/modules/_shared/application';
import { FetchApiClient } from '../../src/platform/api/fetch-api-client';
import { DocumentTemplatesApiClient } from '../../src/modules/document-templates/api/client';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresDocumentTemplatesRepository } from '../../src/adapters/postgres/document-templates-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { DocumentTemplatesService } from '../../src/modules/document-templates/application/document-templates-service.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('PostgresDocumentTemplatesRepository — PostgreSQL et S3 reels', () => {
  let pool: Pool;
  const tenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const storage = createS3Client({
    S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
    S3_REGION: process.env['S3_REGION'] ?? 'us-east-1',
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
    S3_FORCE_PATH_STYLE: 'true',
  });
  const bucket = 'document-pdf-templates';

  function itAsUser(name: string, operation: () => Promise<void>) {
    it(name, () => withAuthenticatedPostgresRequest({ tenantId, userId: actorId }, operation));
  }
  beforeAll(async () => {
    pool = createPostgresPool();
    await pool.query(
      `insert into public.app_users (id,email_normalized,display_name)
       values ($1,$2,'Document Templates Admin')`,
      [actorId, `document-templates-${actorId}@example.invalid`],
    );
    await pool.query(
      `insert into public.tenants (id,slug,name) values ($1,$2,'Document Templates')`,
      [tenantId, `document-templates-${tenantId}`],
    );
    await pool.query(
      `insert into public.tenant_members (tenant_id,user_id,role) values ($1,$2,'admin')`,
      [tenantId, actorId],
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query('delete from public.tenants where id=$1', [tenantId]);
      await pool.query('delete from public.app_users where id=$1', [actorId]);
      await pool.end();
    }
    storage.destroy();
  });

  itAsUser('gere le cycle complet du gabarit et conserve son statut par defaut au remplacement', async () => {
    const repository = new PostgresDocumentTemplatesRepository(
      new PostgresTransactionRunner(pool, 'magrit_api'),
      storage,
      bucket,
    );
    const service = new DocumentTemplatesService({ repository });
    const created = await service.create(tenantId, actorId, {
      name: 'Devis portable',
      document_type: 'quote',
      is_default: true,
    });

    expect(created.template).toMatchObject({ status: 'awaiting_upload', is_default: false });
    expect(created.upload.url).toContain('X-Amz-Signature=');
    expect(created.upload.path).toBe(`${tenantId}/${created.template.id}.pdf`);

    const firstPdf = await makePdf(595.28, 841.89, 'Premier fond');
    await storage.send(new PutObjectCommand({
      Bucket: bucket,
      Key: created.upload.path,
      Body: firstPdf,
      ContentType: 'application/pdf',
    }));
    const ready = await service.confirmUpload(tenantId, actorId, created.template.id, {
      reset_fields: false,
    });
    expect(ready).toMatchObject({ status: 'ready', is_default: true, page_count: 1 });
    expect(ready.pages).toEqual([{ index: 0, width_pt: 595.28, height_pt: 841.89 }]);
    expect(ready.background_url).toContain('X-Amz-Signature=');

    const fields = await service.replaceFields(tenantId, actorId, created.template.id, {
      placements: [{
        field: 'quote.number', page_index: 0, x: 40, y: 800, width: 180,
        max_lines: 1, align: 'left', font: 'helvetica-bold', font_size: 12, color: '#000000',
      }],
      lines_block: null,
    });
    expect(fields.placements).toHaveLength(1);
    const eligible = await repository.findEligibleTemplateForGeneration(tenantId, 'quote');
    expect(eligible).toMatchObject({
      templateId: created.template.id,
      placements: [expect.objectContaining({ field: 'quote.number' })],
    });
    expect(eligible?.backgroundBytes).toEqual(firstPdf);

    const replacementTicket = await service.issueUploadUrl(tenantId, actorId, created.template.id);
    const replacementPdf = await makePdf(595.28, 841.89, 'Fond remplace');
    await storage.send(new PutObjectCommand({
      Bucket: bucket,
      Key: replacementTicket.path,
      Body: replacementPdf,
      ContentType: 'application/pdf',
    }));
    const replaced = await service.confirmUpload(tenantId, actorId, created.template.id, {
      reset_fields: false,
    });
    expect(replaced.is_default).toBe(true);
    expect(replaced.has_field_map).toBe(true);

    await service.remove(tenantId, actorId, created.template.id);
    await expect(service.getById(tenantId, created.template.id)).rejects.toMatchObject({
      name: 'DocumentPdfTemplateNotFoundError',
    });
    await expect(storage.send(new GetObjectCommand({ Bucket: bucket, Key: replacementTicket.path })))
      .rejects.toBeTruthy();
  });
  itAsUser('enregistre via le client HTTP un champ commande sans largeur, puis le relit', async () => {
    const repository = new PostgresDocumentTemplatesRepository(new PostgresTransactionRunner(pool, 'magrit_api'), storage);
    const templateId = randomUUID();
    await pool.query("insert into public.document_pdf_templates(id,tenant_id,document_type,name,status,storage_path,byte_size,sha256,page_count,pages,created_by) values($1,$2,'order','BC HTTP','ready',$3,100,$4,1,$5::jsonb,$6)", [templateId, tenantId, `${tenantId}/${templateId}.pdf`, 'a'.repeat(64), JSON.stringify([{ index:0,width_pt:595.28,height_pt:841.89 }]), actorId]);
    const handler = createGescomApiHandler({ routes: createDocumentTemplatesRoutes(new DocumentTemplatesService({ repository })),
      principalVerifier: { async verify() { return { kind: 'user', tenantId, userId: actorId }; } }, idempotencyStore: new InMemoryIdempotencyStore() });
    const api = new DocumentTemplatesApiClient(new FetchApiClient('https://magrit.test', (input, init) => handler(new Request(input, init)), async () => 'fixture'));
    const before = await api.getFields(templateId);
    const saved = await api.replaceFields(templateId, { placements:[{ field:'order.number',page_index:0,x:535.25,y:820.5,max_lines:1,align:'left',font:'helvetica',font_size:11,color:'#111111' }],lines_block:null }, before.etag!);
    expect(saved.data.placements).toMatchObject([{ field:'order.number',x:535.25,y:820.5,width:null }]);
    expect((await api.getFields(templateId)).data).toEqual(saved.data);
  });

});

async function makePdf(width: number, height: number, label: string): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([width, height]);
  page.drawText(label, { x: 40, y: height - 40, size: 12 });
  return document.save();
}
