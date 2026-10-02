import { randomBytes } from 'node:crypto';
import type { StorefrontPasswordRecoveryGateway } from '../../modules/shop-customers/application/storefront-password-recovery-service.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';
import { hashStorefrontPassword, storefrontTokenHash } from './storefront-authentication-gateway.ts';

export class PostgresStorefrontPasswordRecoveryGateway implements StorefrontPasswordRecoveryGateway {
  constructor(private readonly tx:PostgresTransactionRunner){}
  issue(shopSlug:string,normalizedEmail:string){return this.tx.run({},async c=>{const token=randomBytes(32).toString('base64url');const row=(await c.query<{customer_email:string;customer_name:string;shop_name:string;shop_slug:string}>('select * from magrit.issue_storefront_password_recovery($1,$2,$3,$4)',[shopSlug,normalizedEmail,storefrontTokenHash(token),new Date()])).rows[0];return row?{token,customerEmail:row.customer_email,customerName:row.customer_name,shopName:row.shop_name,shopSlug:row.shop_slug}:null;});}
  async reset(token:string,password:string){const hash=await hashStorefrontPassword(password);return this.tx.run({},async c=>(await c.query<{reset:boolean}>('select magrit.reset_storefront_password($1,$2,$3) reset',[storefrontTokenHash(token),hash,new Date()])).rows[0]?.reset===true);}
}
