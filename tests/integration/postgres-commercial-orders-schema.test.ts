import { describe,expect,it } from 'vitest';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
const enabled=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1';
(enabled?describe:describe.skip)('schéma unifié des commandes',()=>{
  it('supprime les tables concurrentes et conserve les colonnes devis dans orders',async()=>{const pool=createPostgresPool();try{
    const r=await pool.query(`select
      to_regclass('public.commercial_orders') is null as no_commercial_orders,
      to_regclass('public.commercial_order_lines') is null as no_commercial_order_lines,
      exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='tenant_orders' and column_name='quote_id') as orders_support_quotes,
      exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='tenant_order_items' and column_name='source_quote_line_id') as items_support_quotes`);
    expect(r.rows[0]).toEqual({
      no_commercial_orders:true,no_commercial_order_lines:true,
      orders_support_quotes:true,items_support_quotes:true,
    });
  }finally{await pool.end();}});
});
