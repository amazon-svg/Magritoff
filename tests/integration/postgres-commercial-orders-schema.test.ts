import { describe,expect,it } from 'vitest';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
const enabled=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1';
(enabled?describe:describe.skip)('schéma portable commercial orders',()=>{
  it('ferme les écritures API et remplace auth.users par app_users',async()=>{const pool=createPostgresPool();try{
    const r=await pool.query(`select
      has_table_privilege('magrit_api','public.commercial_orders','INSERT') as order_insert,
      has_table_privilege('magrit_api','public.commercial_order_lines','UPDATE') as line_update,
      exists(select 1 from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu using(constraint_name,constraint_schema)
        where tc.table_name='commercial_orders' and ccu.table_name='app_users') as references_app_users`);
    expect(r.rows[0]).toEqual({order_insert:false,line_update:false,references_app_users:true});
  }finally{await pool.end();}});
});
