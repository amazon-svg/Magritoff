/**
 * Implementation Supabase du port `NotificationSendRepository` (story
 * E10.15c) — cote ENVOI du drain (`NotificationSender`), distinct de
 * `SupabaseNotificationDispatchGateway` (mise en file).
 *
 * `client` DOIT etre un client `service_role` — la reclamation delegue a
 * `api_claim_notification_messages` (`security definer`, grantee au SEUL
 * `service_role`) et les verdicts ecrivent sur des colonnes dont le `grant
 * update` est, lui aussi, reserve a `service_role`. Meme raisonnement que
 * `SupabaseOutboxDispatchRepository` (E10.10b-3).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClaimedNotificationMessage,
  NotificationSendRepository,
  NotificationSendSettings,
} from '../../modules/notifications/application/notification-sender.ts';
import type { NotificationChannel } from '../../modules/notifications/api/contracts.ts';

/** Ligne rendue par `api_claim_notification_messages` (setof public.notification_logs). */
type ClaimedNotificationMessageRow = Readonly<{
  id: string;
  tenant_id: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  attempts: number;
}>;

function isNotificationChannel(value: string): value is NotificationChannel {
  return value === 'email' || value === 'sms';
}

export class SupabaseNotificationSendRepository implements NotificationSendRepository {
  /** @param client Client `service_role` — seul role habilite sur la file et sur la fonction de reclamation. */
  constructor(private readonly client: SupabaseClient<any>) {}

  async claim(settings: NotificationSendSettings): Promise<readonly ClaimedNotificationMessage[]> {
    const { data, error } = await this.client.rpc('api_claim_notification_messages', {
      p_limit: settings.limit,
      p_max_attempts: settings.maxAttempts,
      p_max_age: `${settings.maxAgeSeconds} seconds`,
    });
    if (error) throw new Error(`Reclamation des notifications a envoyer impossible: ${error.message}`);
    const rows = (data ?? []) as readonly ClaimedNotificationMessageRow[];
    // `api_claim_notification_messages` exclut deja `recipient is null` (voir
    // la migration) : le filtre ci-dessous est une DEFENSE EN PROFONDEUR, pas
    // le chemin nominal.
    return rows.filter((row): row is ClaimedNotificationMessageRow & { recipient: string } => row.recipient !== null).map(toClaimedNotificationMessage);
  }

  async markSent(id: string, providerMessageId: string | null): Promise<void> {
    const { error } = await this.client
      .from('notification_logs')
      .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerMessageId })
      .eq('id', id);
    if (error) throw new Error(`Marquage 'sent' de la notification ${id} impossible: ${error.message}`);
  }

  async markRetry(id: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from('notification_logs')
      .update({ last_error: reason.slice(0, 2000) })
      .eq('id', id);
    if (error) throw new Error(`Enregistrement de l echec retentable de la notification ${id} impossible: ${error.message}`);
  }

  async markFailed(id: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from('notification_logs')
      .update({ status: 'failed', last_error: reason.slice(0, 2000) })
      .eq('id', id);
    if (error) throw new Error(`Marquage 'failed' de la notification ${id} impossible: ${error.message}`);
  }
}

function toClaimedNotificationMessage(
  row: ClaimedNotificationMessageRow & { recipient: string },
): ClaimedNotificationMessage {
  return Object.freeze({
    id: row.id,
    tenantId: row.tenant_id as ClaimedNotificationMessage['tenantId'],
    channel: isNotificationChannel(row.channel) ? row.channel : 'email',
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    attempts: row.attempts,
  });
}
