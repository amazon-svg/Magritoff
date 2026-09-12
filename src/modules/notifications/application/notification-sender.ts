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
import { joinDeferredSegments, type DeferredRenderPayload } from './notification-tag-renderer.ts';

/** Message reclame, PRET a etre remis — `recipient` n est jamais `null` ici : les entrees `dropped` (aucun destinataire) ne sont jamais `pending`, donc jamais reclamees. */
export type ClaimedNotificationMessage = Readonly<{
  id: string;
  tenantId: TenantId;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  attempts: number;
  /**
   * Compteur de regroupement ARRETE A LA RECLAMATION (§8.23 point 11.2) —
   * jamais relu apres coup : un fait survenu APRES la reclamation ouvre une
   * ligne NEUVE (`attempts = 0` la sort du regroupement, cote mise en file),
   * il n incremente jamais ce message-ci. Vaut `1` en PERMANENCE sur un
   * message SANS rendu differe (E10.15c/d-1, chemin inchange).
   */
  occurrenceCount: number;
  /**
   * RENDU DIFFERE (E10.15d-2, §8.23 point 11) — `null` sur TOUT message
   * E10.15c/d-1 (chemin INCHANGE, octet pour octet). Non nul UNIQUEMENT sur
   * un message `order.files_submitted` dont le modele emploie
   * `{{files.count}}` : `subject`/`body` portent alors le texte PROVISOIRE
   * (balise laissee en clair), et ce champ les SEGMENTS necessaires a la
   * reconstitution du texte final (`resolveFinalRender`, ci-dessous) — jamais
   * un re-balayage.
   */
  deferredRender: DeferredRenderPayload | null;
}>;

/** Texte FINAL (sujet + corps), SCELLE dans `notification_logs` par la MEME transition d etat qui pose le statut terminal (§8.23 point 11.3 §7). `null` = aucun sceau a poser (message SANS rendu differe, chemin E10.15c/d-1 inchange). */
export type NotificationSendSeal = Readonly<{ subject: string | null; body: string }>;

/**
 * Reconstitue le texte FINAL d un message reclame — CONCATENATION PURE des
 * segments (`joinDeferredSegments`), JAMAIS un second balayage du texte
 * PROVISOIRE (point 11.1). `null` si le message ne porte aucun rendu differe :
 * `subject`/`body` sont alors DEJA le texte final (chemin E10.15c/d-1
 * inchange), et AUCUN sceau n est necessaire (l ecriture de `subject`/`body`
 * a la mise en file suffit, elle est deja definitive).
 */
export function resolveFinalRender(
  message: ClaimedNotificationMessage,
): Readonly<{ subject: string | null; body: string; seal: NotificationSendSeal | null }> {
  if (!message.deferredRender) {
    return { subject: message.subject, body: message.body, seal: null };
  }
  const values = { 'files.count': String(message.occurrenceCount) };
  const body = joinDeferredSegments(message.deferredRender.body, values);
  const subject = message.deferredRender.subject
    ? joinDeferredSegments(message.deferredRender.subject, values)
    : message.subject;
  return { subject, body, seal: { subject, body } };
}

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
  /**
   * Marque le message accepte par le prestataire (`status = 'sent'`,
   * `sent_at = now()`). `seal` non nul (E10.15d-2, §8.23 point 11.3 §7) :
   * la MEME `UPDATE` ecrit AUSSI `subject`/`body` = texte final et
   * `deferred_render = null` — c est le SCEAU, une seule ecriture, jamais
   * deux. `seal` nul : comportement E10.15c/d-1 INCHANGE (aucune colonne de
   * texte touchee).
   */
  markSent(id: string, providerMessageId: string | null, seal: NotificationSendSeal | null): Promise<void>;
  /** Echec RETENTABLE : `status` reste `pending` (attempts/next_attempt_at DEJA avances par la reclamation), seul `last_error` est ecrit. AUCUN sceau ici (point 11.3 §8) : le statut reste `pending`, le texte provisoire et les segments restent en place, la tentative suivante refait le rendu differe avec le compteur d alors. */
  markRetry(id: string, reason: string): Promise<void>;
  /**
   * Echec DEFINITIF (non retentable, ou canal sans adaptateur) : `status ->
   * 'failed'` immediatement, sans attendre l epuisement des tentatives.
   * `seal` : meme discipline que `markSent` — un echec DEFINITIF est aussi
   * une transition vers un statut TERMINAL, donc scelle lui aussi (point
   * 11.3 §7, « verdict terminal »).
   */
  markFailed(id: string, reason: string, seal: NotificationSendSeal | null): Promise<void>;
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
      // E10.15d-2 (§8.23 point 11.3 §5-6) : reconstitution PURE (concatenation
      // de segments, jamais un balayage) du texte FINAL AVANT l appel au
      // canal — l ENVOYEUR NE BALAYE JAMAIS `body`/`subject`. `seal` reste
      // `null` sur tout message SANS rendu differe (E10.15c/d-1, chemin
      // INCHANGE : `subject`/`body` sont deja le texte final).
      const rendered = resolveFinalRender(message);

      const adapter = this.dependencies.adapters[message.channel];
      if (!adapter) {
        await this.dependencies.repository.markFailed(
          message.id,
          `notification.channel_not_implemented: aucun adaptateur pour le canal ${message.channel}`,
          rendered.seal,
        );
        failed += 1;
        continue;
      }

      let delivery: Awaited<ReturnType<NotificationChannelAdapter['send']>>;
      try {
        delivery = await adapter.send({
          channel: message.channel,
          to: message.recipient,
          subject: rendered.subject,
          body: rendered.body,
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
        // Verdict TERMINAL (point 11.3 §7) : LE SCEAU — la MEME `UPDATE` qui
        // pose `status = 'sent'` ecrit AUSSI le texte final et
        // `deferred_render = null`, quand `rendered.seal` n est pas nul.
        await this.dependencies.repository.markSent(message.id, delivery.providerMessageId ?? null, rendered.seal);
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
        // AUCUN sceau (point 11.3 §8) : le statut reste `pending`, le texte
        // provisoire et les segments restent en place tels quels.
        await this.dependencies.repository.markRetry(message.id, delivery.reason);
        retried += 1;
      } else {
        // Verdict TERMINAL (`failed`) : LE SCEAU, meme discipline que `markSent`.
        await this.dependencies.repository.markFailed(message.id, delivery.reason, rendered.seal);
        failed += 1;
      }
    }

    return Object.freeze({ claimed: claimed.length, sent, retried, failed });
  }
}
