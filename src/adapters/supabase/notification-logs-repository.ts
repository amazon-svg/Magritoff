/**
 * Implementation Supabase du port de LECTURE du journal des notifications
 * (story E10.15c, `GET /notification-logs`).
 *
 * `client` est le client REQUETE (JWT de l appelant, RLS active) — jamais
 * `service_role` : la lecture est ouverte a tout membre du tenant sans
 * garde de capability (contrat), la policy `notification_logs_select`
 * suffit a l isoler par tenant.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type { NotificationLogDto } from '../../modules/notifications/api/contracts.ts';
import type {
  NotificationLogsListFilter,
  NotificationLogsRepository,
} from '../../modules/notifications/application/notification-logs-repository.ts';

export class SupabaseNotificationLogsRepository implements NotificationLogsRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async list(tenantId: TenantId, filter: NotificationLogsListFilter): Promise<readonly NotificationLogDto[]> {
    let query = this.client
      .from('notification_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(filter.size + 1);

    if (filter.eventName) query = query.eq('event_name', filter.eventName);
    if (filter.channel) query = query.eq('channel', filter.channel);
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.templateId) query = query.eq('template_id', filter.templateId);
    if (filter.aggregateId) query = query.eq('aggregate_id', filter.aggregateId);
    if (filter.cursor) {
      // Curseur composite (created_at, id) — meme discipline que les autres
      // listes paginees du depot (ex. listCustomers) : `created_at` seul ne
      // departage pas deux lignes de meme horodatage.
      query = query.or(
        `created_at.lt.${filter.cursor.sort},and(created_at.eq.${filter.cursor.sort},id.lt.${filter.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(`Lecture du journal des notifications impossible: ${error.message}`);
    return (data ?? []).map(toNotificationLogDto);
  }
}

function toNotificationLogDto(row: Record<string, any>): NotificationLogDto {
  return {
    id: row.id,
    event_id: row.event_id,
    event_name: row.event_name,
    template_id: row.template_id ?? null,
    channel: row.channel,
    status: row.status,
    aggregate_type: row.aggregate_type,
    aggregate_id: row.aggregate_id,
    recipient: row.recipient ?? null,
    subject: row.subject ?? null,
    body: row.body,
    attempts: row.attempts,
    occurrence_count: row.occurrence_count,
    provider_message_id: row.provider_message_id ?? null,
    last_error: row.last_error ?? null,
    created_at: toIsoTimestamp(row.created_at),
    sent_at: toIsoTimestampOrNull(row.sent_at),
  };
}
