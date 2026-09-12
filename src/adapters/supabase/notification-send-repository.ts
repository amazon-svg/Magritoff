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
  NotificationSendSeal,
  NotificationSendSettings,
} from '../../modules/notifications/application/notification-sender.ts';
import type { NotificationChannel } from '../../modules/notifications/api/contracts.ts';
import type { DeferredRenderPayload, RenderedSegment } from '../../modules/notifications/application/notification-tag-renderer.ts';

/** Ligne rendue par `api_claim_notification_messages` (setof public.notification_logs) — `occurrence_count`/`deferred_render` (E10.15d-2) traversent la fonction SANS changer sa signature (§8.23 point 11.4 §6). */
type ClaimedNotificationMessageRow = Readonly<{
  id: string;
  tenant_id: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  attempts: number;
  occurrence_count: number;
  deferred_render: unknown;
}>;

function isNotificationChannel(value: string): value is NotificationChannel {
  return value === 'email' || value === 'sms';
}

/** Validation DEFENSIVE de la forme JSON de `deferred_render` (colonne INTERNE, jamais typee par le contrat) — une forme inattendue rend `null` (chemin E10.15c/d-1, jamais une exception). */
function isRenderedSegment(value: unknown): value is RenderedSegment {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (record.kind === 'literal' && typeof record.text === 'string') ||
    (record.kind === 'tag' && typeof record.id === 'string')
  );
}

function isRenderedSegmentArray(value: unknown): value is readonly RenderedSegment[] {
  return Array.isArray(value) && value.every(isRenderedSegment);
}

function toDeferredRender(value: unknown): DeferredRenderPayload | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isRenderedSegmentArray(record.body)) return null;
  const subject = record.subject;
  if (subject !== null && subject !== undefined && !isRenderedSegmentArray(subject)) return null;
  return { body: record.body, subject: (subject as readonly RenderedSegment[] | null) ?? null };
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

  /**
   * `seal` non nul (E10.15d-2, §8.23 point 11.3 §7) : LA MEME `UPDATE` qui
   * pose `status = 'sent'` ecrit AUSSI `subject`/`body` = texte final et
   * `deferred_render = null` — c est le SCEAU, une seule ecriture SQL, jamais
   * deux. `seal` nul : comportement E10.15c/d-1 INCHANGE (aucune colonne de
   * texte dans l `UPDATE`). Le `grant update (subject, body, deferred_render)`
   * (migration E10.15d-2) est necessaire a ce chemin — sans lui, 42501.
   */
  async markSent(id: string, providerMessageId: string | null, seal: NotificationSendSeal | null): Promise<void> {
    const update: Record<string, unknown> = {
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: providerMessageId,
    };
    if (seal) {
      update.subject = seal.subject;
      update.body = seal.body;
      update.deferred_render = null;
    }
    const { error } = await this.client.from('notification_logs').update(update).eq('id', id);
    if (error) throw new Error(`Marquage 'sent' de la notification ${id} impossible: ${error.message}`);
  }

  /** AUCUN sceau ici (point 11.3 §8) : le statut reste `pending`, `subject`/`body`/`deferred_render` ne bougent pas — la reclamation suivante refait le rendu differe avec le compteur d alors. */
  async markRetry(id: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from('notification_logs')
      .update({ last_error: reason.slice(0, 2000) })
      .eq('id', id);
    if (error) throw new Error(`Enregistrement de l echec retentable de la notification ${id} impossible: ${error.message}`);
  }

  /** `seal` : meme discipline que `markSent` — un echec DEFINITIF est aussi une transition vers un statut TERMINAL (point 11.3 §7, « verdict terminal »). */
  async markFailed(id: string, reason: string, seal: NotificationSendSeal | null): Promise<void> {
    const update: Record<string, unknown> = { status: 'failed', last_error: reason.slice(0, 2000) };
    if (seal) {
      update.subject = seal.subject;
      update.body = seal.body;
      update.deferred_render = null;
    }
    const { error } = await this.client.from('notification_logs').update(update).eq('id', id);
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
    occurrenceCount: row.occurrence_count,
    deferredRender: toDeferredRender(row.deferred_render),
  });
}
