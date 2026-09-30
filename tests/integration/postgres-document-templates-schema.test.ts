import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('schema gabarits et documents PDF — PostgreSQL reel', () => {
  let pool: Pool;
  let transactions: PostgresTransactionRunner;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const quoteId = randomUUID();
  const templateId = randomUUID();

  beforeAll(async () => {
    pool = createPostgresPool();
    transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    await pool.query(`insert into public.app_users (id,email_normalized,display_name) values ($1,$2,'Template User')`,
      [actorId, `template-${actorId}@example.invalid`]);
    await pool.query(`insert into public.tenants (id,slug,name) values ($1,$2,'Templates'),($3,$4,'Foreign Templates')`,
      [tenantId, `templates-${tenantId}`, foreignTenantId, `templates-${foreignTenantId}`]);
    await pool.query(`insert into public.tenant_members (tenant_id,user_id,role) values ($1,$2,'owner')`, [tenantId, actorId]);
    await pool.query(`insert into public.customers (id,tenant_id,type,civility,first_name,last_name) values ($1,$2,'individual','mr','Jean','PDF')`,
      [customerId, tenantId]);
    await pool.query(`insert into public.projects (id,tenant_id,customer_id,name) values ($1,$2,$3,'Projet PDF')`,
      [projectId, tenantId, customerId]);
    await pool.query(`insert into public.commercial_quotes (id,tenant_id,customer_id,project_id,number) values ($1,$2,$3,$4,'DEV-2026-00999')`,
      [quoteId, tenantId, customerId, projectId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id=any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id=$1', [actorId]);
    await pool.end();
  });

  it('autorise un administrateur du tenant a creer un gabarit et sa carte', async () => {
    await transactions.run({ tenantId, userId: actorId }, async (client) => {
      await client.query(`
        insert into public.document_pdf_templates (
          id,tenant_id,document_type,name,status,storage_path,byte_size,sha256,
          page_count,pages,is_default,created_by
        ) values ($1,$2,'quote','Devis standard','ready',$3,128,$4,1,$5::jsonb,true,$6)
      `, [templateId, tenantId, `${tenantId}/${templateId}.pdf`, 'a'.repeat(64),
        JSON.stringify([{ index: 0, width_pt: 595.28, height_pt: 841.89 }]), actorId]);
      await client.query(`
        insert into public.document_pdf_template_fields (
          template_id,tenant_id,field,page_index,x,y,width,max_lines,align,font,font_size,color
        ) values ($1,$2,'quote.number',0,40,800,200,1,'left','helvetica-bold',12,'#000000')
      `, [templateId, tenantId]);
    });

    const visible = await transactions.run({ tenantId }, (client) => client.query(
      'select count(*)::integer as count from public.document_pdf_templates where id=$1', [templateId],
    ));
    const hidden = await transactions.run({ tenantId: foreignTenantId }, (client) => client.query(
      'select count(*)::integer as count from public.document_pdf_templates where id=$1', [templateId],
    ));
    expect(visible.rows[0]?.count).toBe(1);
    expect(hidden.rows[0]?.count).toBe(0);
  });

  it('refuse une carte ou un document reliant deux tenants', async () => {
    await expect(transactions.run({ tenantId: foreignTenantId, userId: actorId }, (client) => client.query(`
      insert into public.document_pdf_template_fields (
        template_id,tenant_id,field,page_index,x,y,max_lines,align,font,font_size,color
      ) values ($1,$2,'quote.valid_until',0,10,10,1,'left','helvetica',10,'#000000')
    `, [templateId, foreignTenantId]))).rejects.toBeTruthy();

    const foreignTemplateId = randomUUID();
    await pool.query(`
      insert into public.document_pdf_templates (id,tenant_id,name,status,storage_path,byte_size,sha256,page_count,pages)
      values ($1,$2,'Foreign','ready',$3,10,$4,1,'[{"index":0,"width_pt":100,"height_pt":100}]')
    `, [foreignTemplateId, foreignTenantId, `${foreignTenantId}/${foreignTemplateId}.pdf`, 'b'.repeat(64)]);
    await expect(transactions.run({ tenantId, userId: actorId }, (client) => client.query(`
      insert into public.quote_documents (
        tenant_id,quote_id,template_id,storage_path,byte_size,sha256,page_count,generated_at,generated_by
      ) values ($1,$2,$3,$4,100,$5,1,now(),$6)
    `, [tenantId, quoteId, foreignTemplateId, `${tenantId}/${quoteId}.pdf`, 'c'.repeat(64), actorId]))).rejects.toBeTruthy();
  });

  it('persiste un document definitif append-only', async () => {
    await transactions.run({ tenantId, userId: actorId }, (client) => client.query(`
      insert into public.quote_documents (
        tenant_id,quote_id,template_id,storage_path,byte_size,sha256,page_count,generated_at,generated_by
      ) values ($1,$2,$3,$4,256,$5,1,now(),$6)
    `, [tenantId, quoteId, templateId, `${tenantId}/${quoteId}.pdf`, 'd'.repeat(64), actorId]));
    const privileges = await pool.query(`select
      has_table_privilege('magrit_api','public.quote_documents','INSERT') as can_insert,
      has_table_privilege('magrit_api','public.quote_documents','UPDATE') as can_update,
      has_table_privilege('magrit_api','public.quote_documents','DELETE') as can_delete`);
    expect(privileges.rows[0]).toEqual({ can_insert: true, can_update: false, can_delete: false });
  });
});
