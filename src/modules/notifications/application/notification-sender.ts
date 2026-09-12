/**
 * Drain d ENVOI reel des notifications (story E10.15c, contrat §8.23 §3(c)).
 *
 * Distinct du `NotificationDispatchConsumer` (qui MET EN FILE, sans jamais
 * ouvrir de connexion reseau) : ce module vide la file, un lot borne a la
 * fois, en appelant l adaptateur du canal concerne. Meme raisonnement que
 * `OutboxDispatcher` (reclamation atomique, remise, verdict), mais un
 * mecanisme DEDIE plutot qu une reutilisation : les verdicts different
 * (`retryable` distingue un echec a retenter d un echec definitif, ce que
 * `OutboxDispatcher` ne connait pas), et la file est `notification_logs`,
 * pas `outbox_events`.
 *
 * Invoque par l Edge Function `magrit-notification-sender`, son PROPRE
 * `pg_cron` a la minute (§8.23 §3(c) : « pas dans le tour du drain outbox,
 * qui ferait attendre la publication des faits metier derriere vingt-cinq
 * appels reseau »).
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import type { NotificationChannel } from '../api/contracts.ts';
import type { NotificationChannelAdapter } from './notification-channel-adapter.ts';

/** Message reclame, PRET a etre remis — `recipient` n est jamais `null` ici : les entrees `dropped` (aucun destinataire) ne sont jamais `pending`, donc jamais reclamees. */
export type ClaimedNotificationMessage = Readonly<{
  id: string;
  tenantId: TenantId;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  attempts: number;
}>;

/** Reglages du drain d envoi — memes valeurs par defaut que le drain outbox (§8.23 §9 reserve (e), "cadence/tentatives/fraicheur reprises du drain outbox"). */
export type NotificationSendSettings = Readonly<{
  limit: number;
  maxAttempts: number;
  maxAgeSeconds: number;
}>;

export const DEFAULT_NOTIFICATION_SEND_SETTINGS: NotificationSendSettings = Object.freeze({
  limit: 25,
  maxAttempts: 5,
  maxAgeSeconds: 24 * 60 * 60,
});

/**
 * Port d acces a `notification_logs` cote ENVOI. L implementation Supabase
 * (`src/adapters/supabase/notification-send-repository.ts`) delegue la
 * reclamation a `api_claim_notification_messages` (`service_role` SEUL).
 */
export interface NotificationSendRepository {
  /** Reclame un lot, ATOMIQUEMENT (skip locked cote base). */
  claim(settings: NotificationSendSettings): Promise<readonly ClaimedNotificationMessage[]>;
  /** Marque le message accepte par le prestataire (`status = 'sent'`, `sent_at = now()`). */
  markSent(id: string, providerMessageId: string | null): Promise<void>;
  /** Echec RETENTABLE : `status` reste `pending` (attempts/next_attempt_at DEJA avances par la reclamation), seul `last_error` est ecrit. */
  markRetry(id: string, reason: string): Promise<void>;
  /** Echec DEFINITIF (non retentable, ou canal sans adaptateur) : `status -> 'failed'` immediatement, sans attendre l epuisement des tentatives. */
  markFailed(id: string, reason: string): Promise<void>;
}

export type NotificationSendReport = Readonly<{
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}>;

export type NotificationSenderDependencies = Readonly<{
  repository: NotificationSendRepository;
  /** Un adaptateur par canal ARME. Un canal reclame sans adaptateur (ex. `sms` avant E10.15e) echoue DEFINITIVEMENT, jamais en boucle de reprise. */
  adapters: Partial<Record<NotificationChannel, NotificationChannelAdapter>>;
  settings?: NotificationSendSettings;
  onUnhandledError?: (error: unknown, message: ClaimedNotificationMessage) => void;
}>;

export class NotificationSender {
  private readonly settings: NotificationSendSettings;

  constructor(private readonly dependencies: NotificationSenderDependencies) {
    this.settings = dependencies.settings ?? DEFAULT_NOTIFICATION_SEND_SETTINGS;
  }

  async runOnce(): Promise<NotificationSendReport> {
    const claimed = await this.dependencies.repository.claim(this.settings);
    let sent = 0;
    let retried = 0;
    let failed = 0;

    for (const message of claimed) {
      const adapter = this.dependencies.adapters[message.channel];
      if (!adapter) {
        await this.dependencies.repository.markFailed(
          message.id,
          `notification.channel_not_implemented: aucun adaptateur pour le canal ${message.channel}`,
        );
        failed += 1;
        continue;
      }

      let delivery: Awaited<ReturnType<NotificationChannelAdapter['send']>>;
      try {
        delivery = await adapter.send({
          channel: message.channel,
          to: message.recipient,
          subject: message.subject,
          body: message.body,
        });
      } catch (error) {
        // Defense en profondeur (meme discipline que `OutboxDispatcher`) : un
        // adaptateur ne doit normalement jamais lever (patron Resend), un
        // socle ne doit pas en dependre pour rester correct. Traite comme un
        // echec RETENTABLE.
        this.dependencies.onUnhandledError?.(error, message);
        delivery = {
          sent: false,
          reason: error instanceof Error ? error.message : 'erreur inattendue de l adaptateur',
          retryable: true,
        };
      }

      if (delivery.sent) {
        await this.dependencies.repository.markSent(message.id, delivery.providerMessageId ?? null);
        sent += 1;
        continue;
      }

      // CORRIGE 2026-09-12 (B2, qa-review) : `api_claim_notification_messages`
      // n accepte pour reclamation QUE `attempts < p_max_attempts` (avant
      // increment) — la reclamation qui produit CE message a donc pu porter
      // `attempts` jusqu a `p_max_attempts` (sa DERNIERE reclamation
      // possible : la prochaine exigerait `attempts < p_max_attempts`, ce qui
      // sera faux). Un echec RETENTABLE sur cette derniere chance ne doit
      // PLUS partir en `markRetry` : la ligne resterait `pending` a jamais,
      // jamais plus reclamable, jamais visible comme un echec — exactement
      // le silence que `failed` existe pour rendre VISIBLE.
      if (delivery.retryable && message.attempts < this.settings.maxAttempts) {
        await this.dependencies.repository.markRetry(message.id, delivery.reason);
        retried += 1;
      } else {
        await this.dependencies.repository.markFailed(message.id, delivery.reason);
        failed += 1;
      }
    }

    return Object.freeze({ claimed: claimed.length, sent, retried, failed });
  }
}
