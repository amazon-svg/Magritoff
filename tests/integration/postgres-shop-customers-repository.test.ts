import { decodeCursor } from '../../src/modules/_shared/application/index.ts';
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

  it('pagine sans doublon malgré les dates égales et une insertion entre deux pages', async () => {
    for (let index = 0; index < 23; index++) await service.create(ownerId, tenantId, shopId, { email: `page-${index}@example.test` });
    await pool.query(`update public.shop_customer_accounts set created_at='2026-10-09T10:00:00.123456Z' where tenant_id=$1 and email like 'page-%'`, [tenantId]);
    const first = await service.listPage(ownerId, tenantId, shopId, { size: 10, cursor: null });
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).toBeTruthy();
    await service.create(ownerId, tenantId, shopId, { email: 'inserted-between-pages@example.test' });
    const ids = first.items.map(account => account.id);
    let next = first.nextCursor;
    while (next) {
      const page = await service.listPage(ownerId, tenantId, shopId, { size: 10, cursor: decodeCursor(next) });
      expect(page.items.length).toBeLessThanOrEqual(10);
      ids.push(...page.items.map(account => account.id)); next = page.nextCursor;
    }
    expect(new Set(ids).size).toBe(ids.length);
    const beforeInsertion = (await service.list(ownerId, tenantId, shopId)).filter(account => account.email !== 'inserted-between-pages@example.test');
    expect(ids.sort()).toEqual(beforeInsertion.map(account => account.id).sort());
    await expect(service.listPage(memberId, tenantId, shopId, { size: 20, cursor: null })).rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('calcule le CA exact par devise hors brouillons et annulations et isole le client', async () => {
    const account = await service.create(ownerId, tenantId, shopId, { email: 'ca@example.test' });
    const other = await service.create(ownerId, tenantId, shopId, { email: 'other-ca@example.test' });
    const otherShop = randomUUID();
    await pool.query(`insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Autre boutique')`, [otherShop, tenantId, ownerId, `other-${otherShop}`]);
    for (const [status, amount, currency] of [['validated','100.10','EUR'], ['invoiced','25.20','EUR'], ['delivered','40.00','USD'], ['draft','999','EUR'], ['cancelled','500','EUR']]) {
      await pool.query(`insert into public.tenant_orders(id,tenant_id,shop_id,created_by,shop_customer_account_id,status,total_ht,currency)
        values($1,$2,$3,$4,$5,$6::public.tenant_order_status,$7,$8)`, [randomUUID(), tenantId, shopId, ownerId, account.id, status, amount, currency]);
    }
    const detail = await service.detail(ownerId, tenantId, shopId, account.id);
    expect(detail.orderCount).toBe(5);
    expect(detail.revenue).toEqual([{ currency: 'EUR', totalHt: '125.30', orderCount: 2 }, { currency: 'USD', totalHt: '40.00', orderCount: 1 }]);
    expect((await service.detail(ownerId, tenantId, shopId, other.id)).orderCount).toBe(0);
    await expect(service.detail(ownerId, tenantId, otherShop, account.id)).rejects.toMatchObject({ code: 'account_not_found' });
    await expect(service.update(ownerId, tenantId, otherShop, account.id, { enabled: false })).rejects.toMatchObject({ code: 'account_not_found' });
    await expect(service.detail(memberId, tenantId, shopId, account.id)).rejects.toMatchObject({ code: 'permission_denied' });
    const first = await service.ordersPage(ownerId, tenantId, shopId, account.id, { size: 2, cursor: null });
    const second = await service.ordersPage(ownerId, tenantId, shopId, account.id, { size: 2, cursor: decodeCursor(first.nextCursor!) });
    const third = await service.ordersPage(ownerId, tenantId, shopId, account.id, { size: 2, cursor: decodeCursor(second.nextCursor!) });
    expect(new Set([...first.items, ...second.items, ...third.items].map(order => order.id)).size).toBe(5);
    expect(third.nextCursor).toBeNull();
  });

  it('suspend, révoque les sessions définitivement et réactive sans perdre commandes ni interlocuteur', async () => {
    const account = await service.create(ownerId, tenantId, shopId, { email: 'suspend@example.test', customerContactId: contactId });
    await pool.query(`update public.shop_customer_accounts set status='active',activated_at=clock_timestamp() where id=$1`, [account.id]);
    await pool.query(`insert into public.tenant_orders(id,tenant_id,shop_id,created_by,shop_customer_account_id,status,total_ht) values($1,$2,$3,$4,$5,'validated',19.50)`, [randomUUID(), tenantId, shopId, ownerId, account.id]);
    const hash = Buffer.alloc(32, 12);
    await pool.query(`insert into private.shop_customer_sessions(shop_customer_account_id,shop_id,token_hash,expires_at) values($1,$2,$3,clock_timestamp()+interval '1 hour')`, [account.id, shopId, hash]);
    expect((await pool.query('select * from magrit.resolve_storefront_session($1)', [hash])).rowCount).toBe(1);
    await expect(service.update(memberId, tenantId, shopId, account.id, { enabled: false })).rejects.toMatchObject({ code: 'permission_denied' });
    const suspended = await service.update(ownerId, tenantId, shopId, account.id, { enabled: false, fullName: 'Nouveau nom' });
    expect(suspended).toMatchObject({ status: 'suspended', fullName: 'Nouveau nom', customerContactId: contactId });
    expect(suspended.suspendedAt).toBeTruthy();
    expect((await pool.query('select * from magrit.resolve_storefront_session($1)', [hash])).rowCount).toBe(0);
    const active = await service.update(ownerId, tenantId, shopId, account.id, { enabled: true });
    expect(active).toMatchObject({ status: 'active', suspendedAt: null });
    expect(await service.detail(ownerId, tenantId, shopId, account.id)).toMatchObject({ orderCount: 1, revenue: [{ totalHt: '19.50' }] });
    expect((await pool.query('select * from magrit.resolve_storefront_session($1)', [hash])).rowCount).toBe(0);
    const prepared = await service.create(ownerId, tenantId, shopId, { email: 'not-activated@example.test', initialStatus: 'delegated_only' });
    await service.update(ownerId, tenantId, shopId, prepared.id, { enabled: false });
    expect(await service.update(ownerId, tenantId, shopId, prepared.id, { enabled: true })).toMatchObject({ status: 'invited', activatedAt: null });
  });

});
