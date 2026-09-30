import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { StorefrontSession } from '../../modules/shop-customers/api/contracts.ts';
import type { IssuedStorefrontSession, StorefrontAuthenticationGateway } from '../../modules/shop-customers/application/storefront-authentication-service.ts';
import type { StorefrontRegistrationGateway } from '../../modules/shop-customers/application/storefront-registration-service.ts';
import type { StorefrontSessionGateway } from '../../modules/shop-customers/application/storefront-session-service.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

const scrypt = promisify(scryptCallback);
export const STOREFRONT_SESSION_SECONDS = 28_800;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_SECONDS = 900;
const DUMMY_HASH = 'scrypt-v1$AAAAAAAAAAAAAAAAAAAAAA==$L9VwT8zA0VWvGFyPPB5jCCv0p42X+Y6pWZXdFKcU4HVGJQTuM7P5E2HwJf6O8cF1bFVeoV0sLr3ZV+GxBclppw==';

type AccountRow = {id:string;shop_id:string;email:string;full_name:string;status:string};
type AuthenticationRow = AccountRow & {password_hash:string;failed_attempt_count:number;locked_until:Date|null};
type CredentialRow = {password_hash:string;failed_attempt_count:number;locked_until:Date|null};

export class PostgresStorefrontAuthenticationGateway implements StorefrontAuthenticationGateway,StorefrontRegistrationGateway,StorefrontSessionGateway {
  constructor(private readonly tx:PostgresTransactionRunner){}
  async authenticate(shopSlug:string,normalizedEmail:string,password:string):Promise<IssuedStorefrontSession|null>{
    return this.tx.run({},async c=>{
      const account=(await c.query<AuthenticationRow>(`select account_id id,shop_id,email,full_name,status,password_hash,failed_attempt_count,locked_until from magrit.storefront_authentication_record($1,$2)`,[shopSlug,normalizedEmail])).rows[0];
      if(!account){await verify(password,DUMMY_HASH);return null;}
      const credential=(await c.query<CredentialRow>('select password_hash,failed_attempt_count,locked_until from private.shop_customer_credentials where shop_customer_account_id=$1 for update',[account.id])).rows[0];
      if(!credential){await verify(password,DUMMY_HASH);return null;}
      const matches=await verify(password,credential.password_hash);
      const now=new Date();
      if(credential.locked_until&&credential.locked_until>now)return null;
      if(!matches||account.status!=='active'){
        if(!matches){const failures=credential.failed_attempt_count+1;await c.query(`update private.shop_customer_credentials set failed_attempt_count=$2::integer,last_failed_at=$3::timestamptz,locked_until=case when $2::integer>=$4::integer then $3::timestamptz+make_interval(secs=>$5::double precision) else null end,updated_at=$3::timestamptz where shop_customer_account_id=$1`,[account.id,failures,now,MAX_FAILED_ATTEMPTS,LOCK_SECONDS]);}
        return null;
      }
      await c.query('update private.shop_customer_credentials set failed_attempt_count=0,last_failed_at=null,locked_until=null,updated_at=$2 where shop_customer_account_id=$1',[account.id,now]);
      return issue(c,account,now);
    });
  }
  async register(shopSlug:string,normalizedEmail:string,fullName:string,password:string):Promise<IssuedStorefrontSession|null>{
    const passwordHash=await hashStorefrontPassword(password);
    try{return await this.tx.run({},async c=>{
      const now=new Date();
      const account=(await c.query<AccountRow>(`select account_id id,shop_id,email,full_name,status from magrit.register_storefront_account($1,$2,$3,$4)`,[shopSlug,normalizedEmail,fullName,passwordHash])).rows[0];
      if(!account)return null;
      return issue(c,account,now);
    });}catch(error){if((error as {code?:string}).code==='23505')return null;throw error;}
  }
  resolve(opaqueToken:string):Promise<StorefrontSession|null>{return this.tx.run({},async c=>{
    const row=(await c.query<Record<string,unknown>>('select * from magrit.resolve_storefront_session($1)',[storefrontTokenHash(opaqueToken)])).rows[0];
    if(!row)return null;
    return session(row);
  });}
  revoke(opaqueToken:string):Promise<boolean>{return this.tx.run({},async c=>(await c.query('update private.shop_customer_sessions set revoked_at=coalesce(revoked_at,clock_timestamp()) where token_hash=$1 and revoked_at is null',[storefrontTokenHash(opaqueToken)])).rowCount===1);}
}

async function issue(c:{query:(text:string,values?:unknown[])=>Promise<unknown>},account:AccountRow,now:Date):Promise<IssuedStorefrontSession>{const token=randomBytes(32).toString('base64url');const expires=new Date(now.getTime()+STOREFRONT_SESSION_SECONDS*1000);await c.query('insert into private.shop_customer_sessions(shop_customer_account_id,shop_id,token_hash,issued_at,expires_at,last_seen_at) values($1,$2,$3,$4,$5,$4)',[account.id,account.shop_id,storefrontTokenHash(token),now,expires]);return{opaqueToken:token,maxAgeSeconds:STOREFRONT_SESSION_SECONDS,session:{identity:{kind:'shop_customer',shopId:account.shop_id,shopCustomerAccountId:account.id},customer:{id:account.id,shopId:account.shop_id,email:account.email,fullName:account.full_name,status:'active'},expiresAt:expires.toISOString()}};}
function session(row:Record<string,unknown>):StorefrontSession{return{identity:row['session_kind']==='delegated'?{kind:'delegated_shop_customer',shopId:String(row['shop_id']),shopCustomerAccountId:String(row['account_id']),delegationId:String(row['delegation_id']),actorMagritUserId:String(row['actor_magrit_user_id'])}:{kind:'shop_customer',shopId:String(row['shop_id']),shopCustomerAccountId:String(row['account_id'])},customer:{id:String(row['account_id']),shopId:String(row['shop_id']),email:String(row['email']),fullName:String(row['full_name']),status:row['status'] as 'active'|'delegated_only'|'invited'},expiresAt:iso(row['expires_at'])};}
export async function hashStorefrontPassword(password:string){const salt=randomBytes(16);const derived=await scrypt(password,salt,64) as Buffer;return `scrypt-v1$${salt.toString('base64')}$${derived.toString('base64')}`;}
async function verify(password:string,encoded:string){const parts=encoded.split('$');if(parts.length!==3||parts[0]!=='scrypt-v1')return false;const salt=Buffer.from(parts[1]!,'base64'),expected=Buffer.from(parts[2]!,'base64');const actual=await scrypt(password,salt,expected.length) as Buffer;return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function storefrontTokenHash(token:string){return createHash('sha256').update(token,'utf8').digest();}
function iso(value:unknown){return value instanceof Date?value.toISOString():new Date(String(value)).toISOString();}
