import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresLibrariesRepository } from '../../src/adapters/postgres/libraries-repository.ts';
import { PostgresLibraryProductsRepository } from '../../src/adapters/postgres/library-products-repository.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId,UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1'?describe:describe.skip;
describeIntegration('Bibliotheques produits — PostgreSQL reel',()=>{
  let pool:Pool,libraries:PostgresLibrariesRepository,products:PostgresLibraryProductsRepository;
  const tenantId=randomUUID() as TenantId,ownerId=randomUUID() as UserId;
  beforeAll(async()=>{pool=createPostgresPool();const tx=new PostgresTransactionRunner(pool,'magrit_api');libraries=new PostgresLibrariesRepository(tx);products=new PostgresLibraryProductsRepository(tx);await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)',[ownerId,`libraries-${ownerId}@example.invalid`]);await pool.query(`insert into public.tenants(id,slug,name) values($1,$2,'Bibliotheques')`,[tenantId,`libraries-${tenantId}`]);await pool.query(`insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')`,[tenantId,ownerId]);});
  afterAll(async()=>{if(!pool)return;await pool.query('delete from public.tenants where id=$1',[tenantId]);await pool.query('delete from public.app_users where id=$1',[ownerId]);await pool.end();});
  it('gere le cycle complet bibliotheque et produit',async()=>{const library=await libraries.create(ownerId,tenantId,{name:'Supports',description:'Catalogue supports'});expect(await libraries.list(ownerId,tenantId)).toContainEqual(library);const product=await products.create(ownerId,tenantId,{library_id:library.id,name:'Flyer A5',category:'Flyers',description:'',price_ht:12,image_url:'',config:{format:'A5'},active:true,gamme_slug:null});expect(product).toMatchObject({tenant_id:tenantId,user_id:ownerId,price_ht:12});const updated=await products.update(ownerId,tenantId,product.id,{price_ht:14,active:false});expect(updated).toMatchObject({price_ht:14,active:false});await products.remove(ownerId,tenantId,product.id);expect(await products.list(ownerId,tenantId)).toEqual([]);await libraries.remove(ownerId,tenantId,library.id);expect(await libraries.list(ownerId,tenantId)).toEqual([]);});
  it('remplace atomiquement les produits PIM generes',async()=>{const input=(name:string)=>({library_id:null,name,category:'PIM',description:'',price_ht:0,image_url:'',config:{source:'pim-generated'},active:true,gamme_slug:null});expect(await products.replacePimGenerated(ownerId,tenantId,[input('Premier'),input('Second')])).toBe(2);expect(await products.replacePimGenerated(ownerId,tenantId,[input('Final')])).toBe(1);expect((await products.list(ownerId,tenantId)).map(row=>row.name)).toEqual(['Final']);expect(await products.clearPimGenerated(ownerId,tenantId)).toBe(1);});
  it('refuse un utilisateur hors tenant',async()=>{const outsider=randomUUID() as UserId;await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)',[outsider,`outside-${outsider}@example.invalid`]);await expect(libraries.list(outsider,tenantId)).resolves.toEqual([]);await expect(libraries.create(outsider,tenantId,{name:'Interdite',description:''})).rejects.toMatchObject({code:'permission_denied'});await pool.query('delete from public.app_users where id=$1',[outsider]);});
});
