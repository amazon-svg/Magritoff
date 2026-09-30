import type { TenantId,UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { CreateNotificationTemplateCommand,NotificationTemplateDto,UpdateNotificationTemplateCommand } from '../../modules/notifications/api/contracts.ts';
import { NotificationTemplateLimitReachedError,NotificationTemplateNotFoundError,NotificationTemplateProductionStepInvalidError,type NotificationTemplatesListFilter,type NotificationTemplatesRepository } from '../../modules/notifications/application/notification-templates-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type Row=Record<string,unknown>;
export class PostgresNotificationTemplatesRepository implements NotificationTemplatesRepository{
  constructor(private readonly tx:PostgresTransactionRunner){}
  list(tenantId:TenantId,filter:NotificationTemplatesListFilter){return this.tx.run({tenantId},async c=>{
    const values:unknown[]=[tenantId];const clauses=['tenant_id=$1'];
    if(filter.eventName){values.push(filter.eventName);clauses.push(`event_name=$${values.length}`);}
    if(filter.channel){values.push(filter.channel);clauses.push(`channel=$${values.length}`);}
    if(filter.status){values.push(filter.status==='active');clauses.push(`is_active=$${values.length}`);}
    const r=await c.query(`select * from public.notification_templates where ${clauses.join(' and ')} order by event_name,name`,values);
    return Object.freeze(r.rows.map(toDto));
  });}
  findById(tenantId:TenantId,id:string){return this.tx.run({tenantId},async c=>toDtoOrNull((await c.query('select * from public.notification_templates where tenant_id=$1 and id=$2',[tenantId,id])).rows[0]));}
  create(tenantId:TenantId,actor:UserId,command:CreateNotificationTemplateCommand){return this.tx.run({tenantId,userId:actor},async c=>{
    try{const r=await c.query(`insert into public.notification_templates(tenant_id,event_name,channel,audience,recipients,production_step_id,name,subject,body,is_active)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,[tenantId,command.event_name,command.channel,command.audience,command.recipients??null,command.production_step_id??null,command.name,command.subject??null,command.body,command.is_active]);return toDto(r.rows[0]);}
    catch(e){throw mapError(e);}
  });}
  update(tenantId:TenantId,actor:UserId,id:string,command:UpdateNotificationTemplateCommand){return this.tx.run({tenantId,userId:actor},async c=>{
    const values:unknown[]=[];const sets:string[]=[];for(const [key,value] of Object.entries(command)){values.push(value??null);sets.push(`${key}=$${values.length}`);}values.push(tenantId,id);
    try{const r=await c.query(`update public.notification_templates set ${sets.join(',')} where tenant_id=$${values.length-1} and id=$${values.length} returning *`,values);if(!r.rows[0])throw new NotificationTemplateNotFoundError();return toDto(r.rows[0]);}catch(e){if(e instanceof NotificationTemplateNotFoundError)throw e;throw mapError(e);}
  });}
  actorHasCapability(tenantId:TenantId,actor:UserId,capability:string){return this.tx.run({tenantId,userId:actor},async c=>Boolean((await c.query('select magrit.actor_has_capability($1,$2) as allowed',[tenantId,capability])).rows[0]?.allowed));}
  isSmsEnabled(tenantId:TenantId){return this.tx.run({tenantId},async c=>Boolean((await c.query('select notification_sms_enabled from public.commercial_settings where tenant_id=$1',[tenantId])).rows[0]?.notification_sms_enabled));}
  stepBelongsToTenant(tenantId:TenantId,stepId:string){return this.tx.run({tenantId},async c=>(await c.query('select 1 from public.production_steps where tenant_id=$1 and id=$2',[tenantId,stepId])).rowCount===1);}
}
function toDtoOrNull(row:Row|undefined){return row?toDto(row):null;}
function toDto(row:Row):NotificationTemplateDto{return {id:String(row['id']),event_name:row['event_name'] as NotificationTemplateDto['event_name'],channel:row['channel'] as NotificationTemplateDto['channel'],audience:row['audience'] as NotificationTemplateDto['audience'],recipients:(row['recipients'] as string[]|null)??null,production_step_id:(row['production_step_id'] as string|null)??null,name:String(row['name']),subject:(row['subject'] as string|null)??null,body:String(row['body']),is_active:Boolean(row['is_active']),created_at:toIsoTimestamp(row['created_at'] as Date|string),created_by:(row['created_by'] as string|null)??null,updated_at:toIsoTimestamp(row['updated_at'] as Date|string),updated_by:(row['updated_by'] as string|null)??null};}
function mapError(error:unknown):Error{const e=error as {code?:string;message?:string};const m=e.message??'';if(m.includes('limit_reached'))return new NotificationTemplateLimitReachedError(m);if(m.includes('step_tenant_mismatch')||e.code==='23503')return new NotificationTemplateProductionStepInvalidError(m);return error instanceof Error?error:new Error(m);}
