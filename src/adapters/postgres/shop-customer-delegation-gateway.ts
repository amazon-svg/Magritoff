import { randomBytes } from 'node:crypto';
import type { TenantId,UserId } from '../../kernel/ids/index.ts';
import { selfShopCustomerDelegationResultSchema } from '../../modules/shop-customers/api/contracts.ts';
import type { IssuedShopCustomerDelegation,ShopCustomerDelegationGateway } from '../../modules/shop-customers/application/shop-customer-delegation-service.ts';
import { storefrontTokenHash } from './storefront-authentication-gateway.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type DelegationRow={
  account_id:string;shop_id:string;email:string;normalized_email:string;full_name:string;
  account_status:string;auth_subject_id:string|null;created_by_magrit_user_id:string|null;
  account_created_at:Date;activated_at:Date|null;suspended_at:Date|null;delegation_id:string;
  actor_magrit_user_id:string;issued_at:Date;expires_at:Date;reason:string|null;shop_slug:string;
};

export class PostgresShopCustomerDelegationGateway implements ShopCustomerDelegationGateway {
  constructor(private readonly tx:PostgresTransactionRunner){}

  startSelf(actorId:string,tenantId:string,shopId:string,reason:string|null,expiresInSeconds:number):Promise<IssuedShopCustomerDelegation|null>{
    return this.tx.run({userId:actorId as UserId,tenantId:tenantId as TenantId},async client=>{
      const token=randomBytes(32).toString('base64url');
      const row=(await client.query<DelegationRow>(
        'select * from magrit.start_self_shop_customer_delegation($1,$2,$3,$4,$5,$6)',
        [tenantId,shopId,actorId,storefrontTokenHash(token),reason,expiresInSeconds],
      )).rows[0];
      if(!row)return null;
      const issuedAt=iso(row.issued_at),expiresAt=iso(row.expires_at);
      return {
        opaqueToken:token,
        maxAgeSeconds:Math.floor((Date.parse(expiresAt)-Date.parse(issuedAt))/1000),
        result:selfShopCustomerDelegationResultSchema.parse({
          customer:{
            id:row.account_id,shopId:row.shop_id,email:row.email,normalizedEmail:row.normalized_email,
            fullName:row.full_name,authSubjectId:row.auth_subject_id,status:row.account_status,
            createdByMagritUserId:row.created_by_magrit_user_id,customerContactId:null,
            createdAt:iso(row.account_created_at),activatedAt:nullableIso(row.activated_at),
            suspendedAt:nullableIso(row.suspended_at),
          },
          delegation:{
            id:row.delegation_id,shopId:row.shop_id,shopCustomerAccountId:row.account_id,
            actorMagritUserId:row.actor_magrit_user_id,issuedAt,expiresAt,revokedAt:null,reason:row.reason,
          },
          storefrontPath:`/shop/${row.shop_slug}`,
        }),
      };
    });
  }
}

function iso(value:Date|string){return value instanceof Date?value.toISOString():new Date(value).toISOString();}
function nullableIso(value:Date|string|null){return value===null?null:iso(value);}
