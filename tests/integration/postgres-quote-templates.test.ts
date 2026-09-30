import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresQuoteTemplatesRepository } from '../../src/adapters/postgres/quote-templates-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId,UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1'?describe:describe.skip;
describeIntegration('Gabarits HTML de devis — PostgreSQL reel',()=>{
  let pool:Pool,repository:PostgresQuoteTemplatesRepository;
  const tenantId=randomUUID() as TenantId,ownerId=randomUUID() as UserId;
  beforeAll(async()=>{pool=createPostgresPool();repository=new PostgresQuoteTemplatesRepository(new PostgresTransactionRunner(pool,'magrit_api'));await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)',[ownerId,`templates-${ownerId}@example.invalid`]);await pool.query(`insert into public.tenants(id,slug,name) values($1,$2,'Templates')`,[tenantId,`templates-${tenantId}`]);await pool.query(`insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')`,[tenantId,ownerId]);});
  afterAll(async()=>{if(!pool)return;await pool.query('delete from public.tenants where id=$1',[tenantId]);await pool.query('delete from public.app_users where id=$1',[ownerId]);await pool.end();});
  it('gere creation, preference, modification et suppression',async()=>{const created=await repository.create(ownerId,tenantId,{name:'Atelier',style:'atelier',company_name:'Imprimerie',validity_days:30});expect(created).toMatchObject({name:'Atelier',style:'atelier',builtin:false});await repository.setDefault(ownerId,tenantId,created.id);expect(await repository.overview(ownerId,tenantId)).toMatchObject({templates:[expect.objectContaining({id:created.id})],defaultTemplateId:created.id});await repository.update(ownerId,tenantId,created.id,{name:'Atelier premium',validity_days:45});expect((await repository.overview(ownerId,tenantId)).templates[0]).toMatchObject({name:'Atelier premium',validity_days:45});await repository.remove(ownerId,tenantId,created.id);expect(await repository.overview(ownerId,tenantId)).toEqual({templates:[],defaultTemplateId:null});});
  it('accepte un builtin et refuse un gabarit custom inconnu',async()=>{await expect(repository.setDefault(ownerId,tenantId,'builtin-classique')).resolves.toBeUndefined();await expect(repository.setDefault(ownerId,tenantId,randomUUID())).rejects.toMatchObject({code:'not_found'});});
});
