import { randomBytes } from 'node:crypto';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type { StorefrontActivationGateway } from '../../modules/shop-customers/application/storefront-activation-service.ts';
import type { IssuedStorefrontSession } from '../../modules/shop-customers/application/storefront-authentication-service.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';
import { hashStorefrontPassword, STOREFRONT_SESSION_SECONDS, storefrontTokenHash } from './storefront-authentication-gateway.ts';

type Account={account_id:string;shop_id:string;email:string;full_name:string;status:string};
export class PostgresStorefrontActivationGateway implements StorefrontActivationGateway {
  constructor(private readonly tx:PostgresTransactionRunner){}
  issue(actorId:string,tenantId:string,shopId:string,accountId:string,expiresInSeconds:number){return this.tx.run({userId:actorId as UserId,tenantId:tenantId as TenantId},async c=>{const token=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+expiresInSeconds*1000);const row=(await c.query<{customer_email:string;customer_name:string;shop_name:string;shop_slug:string}>('select * from magrit.issue_storefront_activation($1,$2,$3,$4,$5)',[tenantId,shopId,accountId,storefrontTokenHash(token),expiresAt])).rows[0];return row?{token,customerEmail:row.customer_email,customerName:row.customer_name,shopName:row.shop_name,shopSlug:row.shop_slug}:null;});}
  async activate(token:string,password:string):Promise<IssuedStorefrontSession|null>{const passwordHash=await hashStorefrontPassword(password);const sessionToken=randomBytes(32).toString('base64url');const issuedAt=new Date(),expiresAt=new Date(issuedAt.getTime()+STOREFRONT_SESSION_SECONDS*1000);return this.tx.run({},async c=>{const row=(await c.query<Account>('select * from magrit.activate_storefront_account($1,$2,$3,$4,$5)',[storefrontTokenHash(token),passwordHash,storefrontTokenHash(sessionToken),issuedAt,expiresAt])).rows[0];return row?{opaqueToken:sessionToken,maxAgeSeconds:STOREFRONT_SESSION_SECONDS,session:{identity:{kind:'shop_customer',shopId:row.shop_id,shopCustomerAccountId:row.account_id},customer:{id:row.account_id,shopId:row.shop_id,email:row.email,fullName:row.full_name,status:'active'},expiresAt:expiresAt.toISOString()}}:null;});}
}
