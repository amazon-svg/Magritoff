import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { Pool } from 'pg';
import { PostgresShopCustomerDelegationGateway } from '../../src/adapters/postgres/shop-customer-delegation-gateway.ts';
import { PostgresStorefrontAuthenticationGateway } from '../../src/adapters/postgres/storefront-authentication-gateway.ts';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId,UserId } from '../../src/kernel/ids/index.ts';

const describeIntegration=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1'?describe:describe.skip;
describeIntegration('Delegation storefront — PostgreSQL reel',()=>{
  let pool:Pool,delegations:PostgresShopCustomerDelegationGateway,sessions:PostgresStorefrontAuthenticationGateway;
  const tenantId=randomUUID() as TenantId,ownerId=randomUUID() as UserId,shopId=randomUUID(),slug=`delegation-${randomUUID()}`;
  beforeAll(async()=>{pool=createPostgresPool();const tx=new PostgresTransactionRunner(pool,'magrit_api');delegations=new PostgresShopCustomerDelegationGateway(tx);sessions=new PostgresStorefrontAuthenticationGateway(tx);await pool.query('insert into public.app_users(id,email_normalized,display_name) values($1,$2,$3)',[ownerId,`owner-${ownerId}@example.invalid`,'Propriétaire']);await pool.query(`insert into public.tenants(id,slug,name) values($1,$2,'Delegation storefront')`,[tenantId,`delegation-${tenantId}`]);await pool.query(`insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')`,[tenantId,ownerId]);await pool.query(`insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Boutique delegation')`,[shopId,tenantId,ownerId,slug]);});
  afterAll(async()=>{if(!pool)return;await pool.query('delete from public.tenants where id=$1',[tenantId]);await pool.query('delete from public.app_users where id=$1',[ownerId]);await pool.end();});
  it('cree un compte miroir et remplace atomiquement la delegation precedente',async()=>{const first=await delegations.startSelf(ownerId,tenantId,shopId,'Support client',1800);expect(first?.result).toMatchObject({customer:{status:'delegated_only',fullName:'Propriétaire'},delegation:{actorMagritUserId:ownerId,reason:'Support client'},storefrontPath:`/shop/${slug}`});expect((await sessions.resolve(first!.opaqueToken))?.identity).toMatchObject({kind:'delegated_shop_customer',actorMagritUserId:ownerId});const second=await delegations.startSelf(ownerId,tenantId,shopId,null,1800);expect(second).not.toBeNull();expect(await sessions.resolve(first!.opaqueToken)).toBeNull();expect((await sessions.resolve(second!.opaqueToken))?.identity).toMatchObject({kind:'delegated_shop_customer',actorMagritUserId:ownerId});expect(await sessions.revoke(second!.opaqueToken)).toBe(true);expect(await sessions.resolve(second!.opaqueToken)).toBeNull();const revoked=(await pool.query<{revoked_at:Date|null}>('select revoked_at from private.shop_customer_delegations where id=$1',[second!.result.delegation.id])).rows[0];expect(revoked?.revoked_at).toBeInstanceOf(Date);});
  it('refuse un acteur sans appartenance',async()=>{const outsider=randomUUID();await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)',[outsider,`outsider-${outsider}@example.invalid`]);await expect(delegations.startSelf(outsider,tenantId,shopId,null,1800)).resolves.toBeNull();await pool.query('delete from public.app_users where id=$1',[outsider]);});
});
