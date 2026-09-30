import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresPool } from '../../src/adapters/postgres/pool.ts';
import { PostgresStorefrontAuthenticationGateway } from '../../src/adapters/postgres/storefront-authentication-gateway.ts';
import { PostgresTransactionRunner } from '../../src/adapters/postgres/transaction-runner.ts';
import type { TenantId, UserId } from '../../src/kernel/ids/index.ts';
import { StorefrontAuthenticationService } from '../../src/modules/shop-customers/application/storefront-authentication-service.ts';
import { StorefrontRegistrationService } from '../../src/modules/shop-customers/application/storefront-registration-service.ts';
import { StorefrontSessionService } from '../../src/modules/shop-customers/application/storefront-session-service.ts';

const enabled=process.env['MAGRIT_POSTGRES_INTEGRATION']==='1';const describeIntegration=enabled?describe:describe.skip;
describeIntegration('PostgresStorefrontAuthenticationGateway — PostgreSQL reel',()=>{
  let pool:Pool,gateway:PostgresStorefrontAuthenticationGateway,authentication:StorefrontAuthenticationService,registration:StorefrontRegistrationService,sessions:StorefrontSessionService;
  const tenantId=randomUUID() as TenantId,ownerId=randomUUID() as UserId,shopId=randomUUID(),slug=`public-${randomUUID()}`;
  beforeAll(async()=>{pool=createPostgresPool();gateway=new PostgresStorefrontAuthenticationGateway(new PostgresTransactionRunner(pool,'magrit_api'));authentication=new StorefrontAuthenticationService(gateway);registration=new StorefrontRegistrationService(gateway);sessions=new StorefrontSessionService(gateway);await pool.query('insert into public.app_users(id,email_normalized) values($1,$2)',[ownerId,`owner-${ownerId}@example.invalid`]);await pool.query(`insert into public.tenants(id,slug,name) values($1,$2,'Storefront auth')`,[tenantId,`storefront-${tenantId}`]);await pool.query(`insert into public.tenant_members(tenant_id,user_id,role) values($1,$2,'owner')`,[tenantId,ownerId]);await pool.query(`insert into public.shops(id,tenant_id,owner_user_id,slug,name) values($1,$2,$3,$4,'Storefront')`,[shopId,tenantId,ownerId,slug]);});
  afterAll(async()=>{if(!pool)return;await pool.query('delete from public.tenants where id=$1',[tenantId]);await pool.query('delete from public.app_users where id=$1',[ownerId]);await pool.end();});
  it('refuse l inscription lorsque la boutique reste privee',async()=>{await expect(registration.register(slug,{email:'buyer@example.test',fullName:'Buyer',password:'correct-password'})).rejects.toMatchObject({code:'registration_failed'});});
  it('inscrit, resout, revoque puis reconnecte sans stocker les secrets en clair',async()=>{
    await pool.query(`update public.shops set access_mode='self_signup' where id=$1`,[shopId]);
    const issued=await registration.register(slug,{email:' Buyer@Example.Test ',fullName:'Buyer Test',password:'correct-password'});
    expect(issued.session).toMatchObject({identity:{kind:'shop_customer',shopId},customer:{email:'buyer@example.test',status:'active'}});
    expect(await sessions.current(issued.opaqueToken)).toEqual(issued.session);
    const stored=await pool.query<{password_hash:string;token_hash:Buffer}>(`select credential.password_hash,session.token_hash from private.shop_customer_credentials credential join private.shop_customer_sessions session on session.shop_customer_account_id=credential.shop_customer_account_id where session.shop_id=$1`,[shopId]);
    expect(stored.rows[0]!.password_hash).toMatch(/^scrypt-v1\$/);expect(stored.rows[0]!.password_hash).not.toContain('correct-password');expect(stored.rows[0]!.token_hash.toString('utf8')).not.toContain(issued.opaqueToken);
    await sessions.end(issued.opaqueToken);expect(await sessions.current(issued.opaqueToken)).toBeNull();
    const authenticated=await authentication.authenticate(slug,{email:'buyer@example.test',password:'correct-password'});expect(authenticated.session.customer.id).toBe(issued.session.customer.id);
    await expect(registration.register(slug,{email:'buyer@example.test',fullName:'Duplicate',password:'another-password'})).rejects.toMatchObject({code:'registration_failed'});
  });
  it('compte les echecs et verrouille temporairement le credential',async()=>{
    for(let attempt=0;attempt<5;attempt+=1)await expect(authentication.authenticate(slug,{email:'buyer@example.test',password:'wrong-password'})).rejects.toMatchObject({code:'authentication_failed'});
    await expect(authentication.authenticate(slug,{email:'buyer@example.test',password:'correct-password'})).rejects.toMatchObject({code:'authentication_failed'});
    const state=await pool.query<{failed_attempt_count:number;locked:boolean}>(`select failed_attempt_count,locked_until>clock_timestamp() locked from private.shop_customer_credentials credential join public.shop_customer_accounts account on account.id=credential.shop_customer_account_id where account.shop_id=$1`,[shopId]);expect(state.rows[0]).toEqual({failed_attempt_count:5,locked:true});
  });
});
