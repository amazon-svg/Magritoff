import type { PoolClient } from 'pg';
import type { TenantId,UserId } from '../../kernel/ids/index.ts';
import type { CreateLibrary,LibraryDto,UpdateLibrary } from '../../modules/libraries/api/contracts.ts';
import { LibraryRejectedError,type LibrariesRepository } from '../../modules/libraries/application/libraries-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type LibraryRow={id:string;tenant_id:string;user_id:string;name:string;description:string;created_at:Date};
const COLUMNS='id,tenant_id,user_id,name,description,created_at';

export class PostgresLibrariesRepository implements LibrariesRepository{
  constructor(private readonly tx:PostgresTransactionRunner){}
  list(actor:UserId,tenantId:string):Promise<LibraryDto[]>{return this.run(actor,tenantId,async c=>(await c.query<LibraryRow>(`select ${COLUMNS} from public.libraries where tenant_id=$1 order by created_at desc,id`,[tenantId])).rows.map(dto));}
  create(actor:UserId,tenantId:string,input:CreateLibrary):Promise<LibraryDto>{return this.run(actor,tenantId,async c=>dto((await c.query<LibraryRow>(`insert into public.libraries(tenant_id,user_id,name,description) values($1,$2,$3,$4) returning ${COLUMNS}`,[tenantId,actor,input.name,input.description])).rows[0]!));}
  update(actor:UserId,tenantId:string,id:string,input:UpdateLibrary):Promise<LibraryDto>{return this.run(actor,tenantId,async c=>{const patch=Object.entries(input);if(patch.length===0)throw new LibraryRejectedError('invalid_library','Une modification est requise.');const row=(await c.query<LibraryRow>(`update public.libraries set ${patch.map(([key],index)=>`${key}=$${index+3}`).join(',')} where tenant_id=$1 and id=$2 returning ${COLUMNS}`,[tenantId,id,...patch.map(([,value])=>value)])).rows[0];if(!row)throw notFound();return dto(row);});}
  remove(actor:UserId,tenantId:string,id:string):Promise<void>{return this.run(actor,tenantId,async c=>{if((await c.query('delete from public.libraries where tenant_id=$1 and id=$2',[tenantId,id])).rowCount!==1)throw notFound();});}
  private async run<T>(actor:UserId,tenantId:string,operation:(client:PoolClient)=>Promise<T>):Promise<T>{try{return await this.tx.run({userId:actor,tenantId:tenantId as TenantId},operation);}catch(error){if(error instanceof LibraryRejectedError)throw error;const value=error as {code?:string;message?:string};if(value.code?.startsWith('23'))throw new LibraryRejectedError('invalid_library',value.message??'Bibliothèque invalide.');throw new LibraryRejectedError('permission_denied',value.message??String(error));}}
}
function dto(row:LibraryRow):LibraryDto{return{id:row.id,tenant_id:row.tenant_id,user_id:row.user_id,name:row.name,description:row.description,created_at:row.created_at.toISOString()};}
function notFound(){return new LibraryRejectedError('not_found','Bibliothèque introuvable.');}
