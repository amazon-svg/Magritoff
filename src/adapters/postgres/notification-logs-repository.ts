import type { TenantId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp,toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type { NotificationLogDto } from '../../modules/notifications/api/contracts.ts';
import type { NotificationLogsListFilter,NotificationLogsRepository } from '../../modules/notifications/application/notification-logs-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

export class PostgresNotificationLogsRepository implements NotificationLogsRepository{
  constructor(private readonly tx:PostgresTransactionRunner){}
  list(tenantId:TenantId,filter:NotificationLogsListFilter){return this.tx.run({tenantId},async c=>{
    const values:unknown[]=[tenantId];const clauses=['tenant_id=$1'];
    for(const [column,value] of [['event_name',filter.eventName],['channel',filter.channel],['status',filter.status],['template_id',filter.templateId],['aggregate_id',filter.aggregateId]] as const){if(value){values.push(value);clauses.push(`${column}=$${values.length}`);}}
    if(filter.cursor){values.push(filter.cursor.sort,filter.cursor.id);clauses.push(`(created_at<$${values.length-1} or(created_at=$${values.length-1} and id<$${values.length}))`);}
    values.push(filter.size+1);const r=await c.query(`select * from public.notification_logs where ${clauses.join(' and ')} order by created_at desc,id desc limit $${values.length}`,values);return Object.freeze(r.rows.map(toDto));
  });}
}
function toDto(row:Record<string,unknown>):NotificationLogDto{return {id:String(row['id']),event_id:String(row['event_id']),event_name:row['event_name'] as NotificationLogDto['event_name'],template_id:(row['template_id'] as string|null)??null,channel:row['channel'] as NotificationLogDto['channel'],status:row['status'] as NotificationLogDto['status'],aggregate_type:String(row['aggregate_type']),aggregate_id:String(row['aggregate_id']),recipient:(row['recipient'] as string|null)??null,subject:(row['subject'] as string|null)??null,body:String(row['body']),attempts:Number(row['attempts']),occurrence_count:Number(row['occurrence_count']),provider_message_id:(row['provider_message_id'] as string|null)??null,last_error:(row['last_error'] as string|null)??null,created_at:toIsoTimestamp(row['created_at'] as Date|string),sent_at:toIsoTimestampOrNull(row['sent_at'] as Date|string|null)};}
