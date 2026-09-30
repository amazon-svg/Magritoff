import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';

const integrationEnabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('schema devis commerciaux — PostgreSQL reel', () => {
  let pool: Pool;
  let transactions: PostgresTransactionRunner;
  const tenantId = randomUUID() as TenantId;
  const foreignTenantId = randomUUID() as TenantId;
  const userId = randomUUID() as UserId;
  const customerId = randomUUID();
  const projectId = randomUUID();
  const projectItemId = randomUUID();
  const quoteId = randomUUID();
  const lineId = randomUUID();

  beforeAll(async () => {
    pool = createPostgresPool();
    transactions = new PostgresTransactionRunner(pool, 'magrit_api');
    await pool.query(`
      insert into public.app_users (id, email_normalized, display_name)
      values ($1,$2,'Quote Schema User')
    `, [userId, `quote-schema-${userId}@example.invalid`]);
    await pool.query(`
      insert into public.tenants (id, slug, name)
      values ($1,$2,'Quote Schema'), ($3,$4,'Foreign Quote Schema')
    `, [tenantId, `quote-${tenantId}`, foreignTenantId, `quote-${foreignTenantId}`]);
    await pool.query(`
      insert into public.customers (
        id, tenant_id, type, civility, first_name, last_name, created_by
      ) values ($1,$2,'individual','mr','Jean','Devis',$3)
    `, [customerId, tenantId, userId]);
    await pool.query(`
      insert into public.projects (id, tenant_id, customer_id, name, created_by)
      values ($1,$2,$3,'Projet devis',$4)
    `, [projectId, tenantId, customerId, userId]);
    await pool.query(`
      insert into public.project_items (id, tenant_id, project_id, label, position)
      values ($1,$2,$3,'Impression A4',0)
    `, [projectItemId, tenantId, projectId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('delete from public.tenants where id = any($1::uuid[])', [[tenantId, foreignTenantId]]);
    await pool.query('delete from public.app_users where id = $1', [userId]);
    await pool.end();
  });

  it('persiste un devis et une ligne pricee dans le contexte tenant', async () => {
    await transactions.run({ tenantId, userId }, async (client) => {
      await client.query(`
        insert into public.commercial_quote_number_counters (tenant_id, year, last_value)
        values ($1, 2026, 1)
      `, [tenantId]);
      await client.query(`
        insert into public.commercial_quotes (
          id, tenant_id, customer_id, project_id, number, created_by
        ) values ($1,$2,$3,$4,'DEV-2026-00001',$5)
      `, [quoteId, tenantId, customerId, projectId, userId]);
      await client.query(`
        insert into public.commercial_quote_lines (
          id, quote_id, origin, project_item_id, label, product_config,
          quantity, chiffrage_quantity, position, production_price,
          public_price, customer_price, applied_margin_rate, sale_price, breakdown
        ) values (
          $1,$2,'project_item',$3,'Impression A4','{}',100,100,0,
          40.00,60.00,55.00,0.3750,55.00,
          '[{"post":"total","cost":"40.00","margin_rate":"0.3750","price":"55.00","source":"clariprint"}]'
        )
      `, [lineId, quoteId, projectItemId]);
    });

    const visible = await transactions.run({ tenantId }, (client) => client.query(
      'select count(*)::integer as count from public.commercial_quote_lines where quote_id = $1',
      [quoteId],
    ));
    expect(visible.rows[0]?.count).toBe(1);
    const hidden = await transactions.run({ tenantId: foreignTenantId }, (client) => client.query(
      'select count(*)::integer as count from public.commercial_quotes where id = $1',
      [quoteId],
    ));
    expect(hidden.rows[0]?.count).toBe(0);
  });

  it('refuse les positions dupliquees et les remises globales ambigues', async () => {
    await expect(transactions.run({ tenantId, userId }, (client) => client.query(`
      insert into public.commercial_quote_lines (
        quote_id, origin, label, quantity, position, production_price,
        public_price, customer_price, applied_margin_rate, sale_price, breakdown
      ) values (
        $1,'free','Doublon',1,0,10,12,12,0.2,12,
        '[{"post":"total","cost":"10.00","margin_rate":"0.2000","price":"12.00","source":"prix_marche"}]'
      )
    `, [quoteId]))).rejects.toMatchObject({ code: '23505' });

    await expect(transactions.run({ tenantId, userId }, (client) => client.query(`
      update public.commercial_quotes
         set global_discount_rate = 0.1, target_net_total = 45
       where id = $1
    `, [quoteId]))).rejects.toMatchObject({ code: '23514' });
  });

  it('rend les lignes immuables une fois le devis envoye', async () => {
    await transactions.run({ tenantId, userId }, (client) => client.query(
      "update public.commercial_quotes set status = 'sent', sent_at = now(), last_sent_at = now(), sent_by = $2 where id = $1",
      [quoteId, userId],
    ));
    await expect(transactions.run({ tenantId, userId }, (client) => client.query(
      'update public.commercial_quote_lines set quantity = 101 where id = $1',
      [lineId],
    ))).rejects.toMatchObject({ code: 'P0001', message: 'quote_line.quote_not_draft' });
  });

  it('borne les journaux en append-only pour le role API', async () => {
    const privileges = await pool.query(`
      select
        has_table_privilege('magrit_api', 'public.commercial_quote_line_audit', 'INSERT') as can_insert,
        has_table_privilege('magrit_api', 'public.commercial_quote_line_audit', 'UPDATE') as can_update,
        has_table_privilege('magrit_api', 'public.commercial_quote_header_audit', 'DELETE') as can_delete,
        has_table_privilege('magrit_api', 'public.price_rules_audit', 'UPDATE') as can_update_price_audit
    `);
    expect(privileges.rows[0]).toEqual({
      can_insert: true,
      can_update: false,
      can_delete: false,
      can_update_price_audit: false,
    });
  });
});
