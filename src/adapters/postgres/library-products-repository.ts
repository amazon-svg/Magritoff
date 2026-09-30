import type { PoolClient } from 'pg';
import type { TenantId,UserId } from '../../kernel/ids/index.ts';
import type { LibraryProductDto,LibraryProductInput,UpdateLibraryProduct } from '../../modules/libraries/api/product-contracts.ts';
import { LibraryProductRejectedError,type LibraryProductsRepository } from '../../modules/libraries/application/library-products-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type ProductRow={id:string;tenant_id:string;user_id:string;library_id:string|null;name:string;category:string;description:string;price_ht:string;image_url:string;config:Record<string,unknown>;active:boolean;gamme_slug:string|null;created_at:Date};
const COLUMNS='id,tenant_id,user_id,library_id,name,category,description,price_ht,image_url,config,active,gamme_slug,created_at';
const PIM_GENERATED_SOURCE='pim-generated';

export class PostgresLibraryProductsRepository implements LibraryProductsRepository{
  constructor(private readonly tx:PostgresTransactionRunner){}
  list(actor:UserId,tenantId:string):Promise<LibraryProductDto[]>{return this.run(actor,tenantId,async c=>(await c.query<ProductRow>(`select ${COLUMNS} from public.product_library where tenant_id=$1 order by created_at desc,id`,[tenantId])).rows.map(dto));}
  create(actor:UserId,tenantId:string,input:LibraryProductInput):Promise<LibraryProductDto>{return this.run(actor,tenantId,async c=>dto(await insert(c,actor,tenantId,input)));}
  createMany(actor:UserId,tenantId:string,products:LibraryProductInput[]):Promise<LibraryProductDto[]>{return this.run(actor,tenantId,async c=>{const result:LibraryProductDto[]=[];for(const product of products)result.push(dto(await insert(c,actor,tenantId,product)));return result;});}
  replacePimGenerated(actor:UserId,tenantId:string,products:LibraryProductInput[]):Promise<number>{return this.run(actor,tenantId,async c=>{await c.query(`delete from public.product_library where tenant_id=$1 and config->>'source'=$2`,[tenantId,PIM_GENERATED_SOURCE]);for(const product of products)await insert(c,actor,tenantId,product);return products.length;});}
  clearPimGenerated(actor:UserId,tenantId:string):Promise<number>{return this.run(actor,tenantId,async c=>(await c.query(`delete from public.product_library where tenant_id=$1 and config->>'source'=$2`,[tenantId,PIM_GENERATED_SOURCE])).rowCount??0);}
  update(actor:UserId,tenantId:string,id:string,input:UpdateLibraryProduct):Promise<LibraryProductDto>{return this.run(actor,tenantId,async c=>{const patch=productPatch(input);const entries=Object.entries(patch);if(entries.length===0)throw new LibraryProductRejectedError('invalid_product','Une modification est requise.');const row=(await c.query<ProductRow>(`update public.product_library set ${entries.map(([key],index)=>`${key}=$${index+3}${key==='config'?'::jsonb':''}`).join(',')} where tenant_id=$1 and id=$2 returning ${COLUMNS}`,[tenantId,id,...entries.map(([,value])=>value)])).rows[0];if(!row)throw notFound();return dto(row);});}
  remove(actor:UserId,tenantId:string,id:string):Promise<void>{return this.run(actor,tenantId,async c=>{if((await c.query('delete from public.product_library where tenant_id=$1 and id=$2',[tenantId,id])).rowCount!==1)throw notFound();});}
  private async run<T>(actor:UserId,tenantId:string,operation:(client:PoolClient)=>Promise<T>):Promise<T>{try{return await this.tx.run({userId:actor,tenantId:tenantId as TenantId},operation);}catch(error){if(error instanceof LibraryProductRejectedError)throw error;const value=error as {code?:string;message?:string};if(value.code?.startsWith('23'))throw new LibraryProductRejectedError('invalid_product',value.message??'Produit invalide.');throw new LibraryProductRejectedError('permission_denied',value.message??String(error));}}
}
async function insert(c:PoolClient,actor:UserId,tenantId:string,input:LibraryProductInput):Promise<ProductRow>{return(await c.query<ProductRow>(`insert into public.product_library(tenant_id,user_id,library_id,name,category,description,price_ht,image_url,config,active,gamme_slug) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) returning ${COLUMNS}`,[tenantId,actor,input.library_id,input.name,input.category,input.description,input.price_ht,input.image_url,JSON.stringify(input.config),input.active,input.gamme_slug??null])).rows[0]!;}
function productPatch(input:UpdateLibraryProduct):Record<string,unknown>{const patch:Record<string,unknown>={};for(const[key,value]of Object.entries(input))patch[key]=key==='config'?JSON.stringify(value):value;return patch;}
function dto(row:ProductRow):LibraryProductDto{return{id:row.id,tenant_id:row.tenant_id,user_id:row.user_id,library_id:row.library_id,name:row.name,category:row.category,description:row.description,price_ht:Number(row.price_ht),image_url:row.image_url,config:row.config,active:row.active,gamme_slug:row.gamme_slug,created_at:row.created_at.toISOString()};}
function notFound(){return new LibraryProductRejectedError('not_found','Produit introuvable.');}
