import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresShopCustomersRepository } from '../../src/adapters/postgres/shop-customers-repository.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { ShopCustomersService } from '../../src/modules/shop-customers/application/shop-customers-service.ts';

const enabled = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1';
const describeIntegration = enabled ? describe : describe.skip;

describeIntegration('PostgresShopCustomersRepository — PostgreSQL reel', () => {
  let pool: Pool; let repository: PostgresShopCustomersRepository; let service: ShopCustomersService;
  const tenantId=randomUUID() as TenantId, ownerId=randomUUID() as UserId, memberId=randomUUID() as UserId;
  const shopId=randomUUID(), customerId=randomUUID(), contactId=randomUUID();
  beforeAll(async()=>{pool=createPostgresPool();repository=new PostgresShopCustomersRepository(new PostgresTransactionRunner(pool,'magrit_api'));service=new ShopCustomersService(repository);
    await pool.query(`insert into public.app_users(id,email_normalized,display_name) values($1,$2,'Owner'),($3,$4,'Member')`,[ownerId,`owner-${ownerId}@example.invalid`,memberId,`member-${memberId}@example.invalid`]);
    await pool.query(`insert into public.tenants(id,slug,name) values($1,$2,'Shop customers integration')`,[tenantId,`shop-customers-${tenantId}`]);
    await pool.query(`insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')`,[tenantId,ownerId,memberId]);
    await pool.query(`insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Boutique')`,[shopId,tenantId,ownerId,`boutique-${shopId}`]);
    await pool.query(`insert into public.customers(id,tenant_id,type,civility,first_name,last_name,created_by) values($1,$2,'individual','mrs','Alice','Client',$3)`,[customerId,tenantId,ownerId]);
    await pool.query(`insert into public.customer_contacts(id,customer_id,first_name,last_name,email) values($1,$2,'Alice','Client','alice@example.test')`,[contactId,customerId]);
  });
  afterAll(async()=>{if(!pool)return;await pool.query('delete from public.tenants where id=$1',[tenantId]);await pool.query('delete from public.app_users where id=any($1::uuid[])',[[ownerId,memberId]]);await pool.end();});

  it('cree et isole les comptes clients avec email normalise',async()=>{
    await expect(service.create(memberId,tenantId,shopId,{email:'client@example.test'})).rejects.toMatchObject({code:'permission_denied'});
    const created=await service.create(ownerId,tenantId,shopId,{email:' Client@Example.Test ',fullName:'Client Test'});
    expect(created).toMatchObject({shopId,email:'Client@Example.Test',normalizedEmail:'client@example.test',status:'invited'});
    await expect(service.create(ownerId,tenantId,shopId,{email:'client@example.test'})).rejects.toMatchObject({code:'duplicate_email'});
    expect(await service.list(ownerId,tenantId,shopId)).toHaveLength(1);
  });

  it('cree une seule fois le compte miroir de delegation',async()=>{
    const role=await pool.query<{id:string}>(`insert into public.tenant_role_definitions(tenant_id,name,description,capabilities) values($1,'Impersonation test','', '{"can_impersonate_shop_customer":true}') returning id`,[tenantId]);
    await pool.query(`insert into public.tenant_role_assignments(role_definition_id,user_id,assigned_by) values($1,$2,$3)`,[role.rows[0]!.id,memberId,ownerId]);
    const first=await service.ensureSelf(memberId,tenantId,shopId);const second=await service.ensureSelf(memberId,tenantId,shopId);
    expect(first.created).toBe(true);expect(second).toMatchObject({created:false,customer:{id:first.customer.id,status:'delegated_only',authSubjectId:null}});
  });

  it('relie puis revoque un acces issu d un interlocuteur du meme tenant',async()=>{
    const account=(await service.list(ownerId,tenantId,shopId)).find(x=>x.normalizedEmail==='client@example.test')!;
    const linked=await service.linkContact(ownerId,tenantId,account.id,contactId);
    expect(linked).toMatchObject({customerContactId:contactId,status:'invited'});
    expect(await service.listForContact(ownerId,tenantId,contactId)).toHaveLength(1);
    await service.revokeForContact(ownerId,tenantId,shopId,contactId);
    expect(await service.findForContact(ownerId,tenantId,shopId,contactId)).toBeNull();
    expect((await service.findByEmail(ownerId,tenantId,shopId,'client@example.test'))).toMatchObject({status:'suspended',customerContactId:null});
  });
});
