import { afterAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresCommercialOrdersRepository } from '../../src/adapters/postgres/commercial-orders-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/index.ts';

const enabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const fixture = (name: string) => process.env[`MAGRIT_E44B_${name}_ID`] ?? '';

(enabled ? describe : describe.skip)('E4.4b — reprise réelle des commandes historiques', () => {
  let pool: Pool;
  afterAll(async () => pool?.end());

  it('conserve l agrégat, ses montants, son auteur, ses dates et ses références', async () => {
    pool = createPostgresPool();
    const order = (await pool.query(`select id,tenant_id,order_origin,customer_id,quote_id,number,status,
      current_production_step_id,customer_reference,lines_subtotal::text,global_discount::text,
      effective_discount_rate::text,net_total::text,vat_rate::text,vat_regime,vat_amount::text,
      total_incl_tax::text,created_by,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') created_at,
      to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') updated_at
      from public.tenant_orders where id=$1`, [fixture('ORDER')])).rows[0];
    expect(order).toEqual({
      id: fixture('ORDER'), tenant_id: fixture('TENANT'), order_origin: 'quote',
      customer_id: fixture('CUSTOMER'), quote_id: fixture('QUOTE'), number: 'CDE-2026-00444',
      status: 'validated', current_production_step_id: fixture('STEP'), customer_reference: 'REF-EXTERNE-44',
      lines_subtotal: '75.00', global_discount: '5.00', effective_discount_rate: '0.0667',
      net_total: '70.00', vat_rate: '0.2000', vat_regime: 'metropole_fr', vat_amount: '14.00',
      total_incl_tax: '84.00', created_by: fixture('USER'),
      created_at: '2026-09-01T08:15:30.123456Z', updated_at: '2026-09-02T09:16:31.654321Z',
    });

    const line = (await pool.query(`select id,order_id,source_quote_line_id,line_origin,product_label,
      description_html,clariprint_options,quantity,position,production_price::text,public_price::text,
      customer_price::text,sale_price::text,unit_price_ht::text,line_total_ht::text,price_origin,
      to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') created_at
      from public.tenant_order_items where id=$1`, [fixture('ORDER_LINE')])).rows[0];
    expect(line).toEqual(expect.objectContaining({
      id: fixture('ORDER_LINE'), order_id: fixture('ORDER'), source_quote_line_id: fixture('QUOTE_LINE'),
      line_origin: 'free', product_label: 'Ligne reprise', description_html: '<p>Conservée</p>',
      clariprint_options: { papier: 'mat' }, quantity: 2, position: 0, production_price: '40.00',
      public_price: '90.00', customer_price: '75.00', sale_price: '75.00', unit_price_ht: '37.50',
      line_total_ht: '75.00', price_origin: 'quoted', created_at: '2026-09-01T08:16:00.111222Z',
    }));
  });

  it('rebranche sans changer les audits, fichiers, documents, liens et notifications', async () => {
    const references = await pool.query(`select
      (select order_id from public.commercial_order_step_changes where id=$1) step_order,
      (select order_id from public.commercial_order_files where id=$2) file_order,
      (select order_line_id from public.commercial_order_files where id=$2) file_line,
      (select order_id from public.order_documents where id=$3) document_order,
      (select order_id from public.commercial_order_upload_links where id=$4) upload_link_order,
      (select aggregate_id from public.notification_logs where id=$5) notification_order`, [
      fixture('STEP_CHANGE'), fixture('FILE'), fixture('DOCUMENT'), fixture('UPLOAD_LINK'), fixture('NOTIFICATION'),
    ]);
    expect(references.rows[0]).toEqual({
      step_order: fixture('ORDER'), file_order: fixture('ORDER'), file_line: fixture('ORDER_LINE'),
      document_order: fixture('ORDER'), upload_link_order: fixture('ORDER'), notification_order: fixture('ORDER'),
    });
    const audit = (await pool.query(`select actor_id,actor_label,note,
      to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') occurred_at
      from public.commercial_order_step_changes where id=$1`, [fixture('STEP_CHANGE')])).rows[0];
    expect(audit).toEqual({ actor_id: fixture('USER'), actor_label: 'Auteur historique',
      note: 'Étape conservée', occurred_at: '2026-09-03T10:00:00.333444Z' });
  });

  it('a supprimé les deux anciennes tables après une reprise sans doublon', async () => {
    const state = (await pool.query(`select
      to_regclass('public.commercial_orders') is null old_orders_removed,
      to_regclass('public.commercial_order_lines') is null old_lines_removed,
      (select count(*)::integer from public.tenant_orders where id=$1) order_count,
      (select count(*)::integer from public.tenant_order_items where id=$2) line_count`,
    [fixture('ORDER'), fixture('ORDER_LINE')])).rows[0];
    expect(state).toEqual({ old_orders_removed: true, old_lines_removed: true, order_count: 1, line_count: 1 });
  });

  it('refuse une étape de production quand le statut administratif est bloquant', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('magrit.tenant_id',$1,true),
        set_config('magrit.user_id',$2,true),set_config('magrit.order_transition','on',true)`,
      [fixture('TENANT'), fixture('USER')]);
      await client.query("update public.tenant_orders set status='cancelled' where id=$1", [fixture('ORDER')]);
      await expect(client.query(
        'select * from magrit.change_commercial_order_step($1,$2,$3,$4,$5,$6)',
        [fixture('TENANT'), fixture('ORDER'), fixture('STEP'), fixture('USER'), null, null],
      )).rejects.toThrow('order.administrative_status_blocked');
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  it('applique et journalise une étape sur une commande boutique', async () => {
    const repository = new PostgresCommercialOrdersRepository(new PostgresTransactionRunner(pool, 'magrit_api'));
    const tenant = fixture('TENANT') as TenantId;
    const actor = fixture('USER') as UserId;
    const context = await repository.findStepChangeContext(tenant, fixture('STOREFRONT_ORDER'), actor);
    expect(context).toMatchObject({ number: null, customerId: null, status: 'validated' });

    const entry = await repository.changeProductionStep(tenant, fixture('STOREFRONT_ORDER'), actor, {
      step_id: fixture('STEP'),
    }, null);
      expect(entry).toMatchObject({
        order_id: fixture('STOREFRONT_ORDER'), from_step_id: null, to_step_id: fixture('STEP'),
      });
    const history = await repository.listStepChanges(tenant, fixture('STOREFRONT_ORDER'), {
      size: 10, cursor: null,
    }, actor);
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0]?.id).toBe(entry.id);
  });
});
