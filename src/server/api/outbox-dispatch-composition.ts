/**
 * Point de composition UNIQUE du drain outbox (story E10.10b-3).
 *
 * Meme contre-mesure que `createMagritApiApplication()` pour la dette M1
 * (§8.2) : l Edge Function `magrit-outbox-dispatcher` ne fait qu instancier
 * les adaptateurs et appeler cette fonction — la vraie composition (quel
 * adaptateur pour quel port, quels reglages) vit ici, dans un fichier
 * typechecke et testable par vitest (contrairement au corps de l Edge
 * Function elle-meme, hors tsconfig — voir docs/api/CONVENTIONS.md,
 * "Ce qui est verifiable localement").
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CompositeOutboxConsumer,
  DEFAULT_OUTBOX_DISPATCH_SETTINGS,
  OutboxDispatcher,
  type ClaimedOutboxEvent,
  type DispatchReport,
  type OutboxConsumerRegistry,
  type OutboxDispatchSettings,
} from '../../modules/_shared/application/index.ts';
import { SupabaseOutboxDispatchRepository } from '../../adapters/supabase/outbox-dispatch-repository.ts';
import { SupabaseQuoteNotificationGateway } from '../../adapters/supabase/commercial-quotes-repository.ts';
import { SupabaseQuoteDocumentAttachmentGateway } from '../../adapters/supabase/quote-document-attachment-gateway.ts';
import { SupabaseNotificationDispatchGateway } from '../../adapters/supabase/notification-dispatch-repository.ts';
import { ResendQuoteSentEmailSender } from '../../adapters/resend/quote-sent-email-sender.ts';
import { QuoteSentNotificationConsumer } from '../../modules/commercial-quotes/application/quote-sent-notification-consumer.ts';
import { NotificationDispatchConsumer } from '../../modules/notifications/application/notification-dispatch-consumer.ts';
import { createOrderFilePurgeNoticeConsumer } from './order-file-purge-composition.ts';

export type OutboxDispatchApplicationDependencies = Readonly<{
  /** Client `service_role` — seul role habilite sur la file (`api_claim_outbox_events`, colonnes de suivi). */
  serviceRoleClient: SupabaseClient<any>;
  /** `null` -> `ResendQuoteSentEmailSender` rend systematiquement `{sent:false}` explicite, pas de repli silencieux. */
  resendApiKey: string | null;
  /** `MAGRIT_FROM_EMAIL`, format `Magrit <devis@magritapp.com>`. */
  fromEmail: string;
  /** `MAGRIT_PUBLIC_APP_URL`. `null` -> le consommateur `quote.sent` echoue explicitement (pas de lien devine). */
  publicAppUrl: string | null;
  fetchImplementation?: typeof fetch;
  settings?: OutboxDispatchSettings;
  onUnhandledError?: (error: unknown, event: ClaimedOutboxEvent) => void;
}>;

/**
 * Compose le drain. Six `event_name` ont desormais un consommateur :
 * `quote.sent` -> [notifications configurees, PUIS courriel client]
 * (E10.10b-3 + E10.15d-1, ORDRE OPPOSABLE, voir plus bas), `order_files.
 * purge_scheduled` -> rappel de purge (E10.22a), `order.step_changed` ->
 * mise en file des notifications configurees (E10.15c), `quote.converted`
 * et `customer.created` -> mise en file des notifications configurees
 * (E10.15d-1), `order.files_submitted` -> mise en file des notifications
 * configurees AVEC rendu differe (E10.15d-2, §8.23 point 11 : fenetre de
 * regroupement de 10 min, `{{files.count}}` arrete a la reclamation). Tout
 * AUTRE `event_name` (`quote.created`/`quote.accepted`/`quote.rejected`…)
 * est LIVRE sans traitement par le socle (`OutboxDispatcher`, "aucun
 * consommateur enregistre" — §8.13sexies point 3).
 *
 * Chaque entree du registre est un `CompositeOutboxConsumer` (E10.15c,
 * contrat §8.23 §3(a)), MEME quand elle ne compose qu un seul consommateur :
 * c est la COMPOSITION qui exprime l eventail, pas le registre du socle
 * (« un consommateur par evenement », inchange).
 *
 * ORDRE OPPOSABLE sur `quote.sent` (§8.23 §3(a)) : `notificationDispatchConsumer`
 * PASSE EN PREMIER. Il est IDEMPOTENT (index unique sur `(event_id,
 * template_id, destinataire)`, EN BASE) — un rejeu de ce composite (parce que
 * `quoteSentConsumer`, qui suit, a echoue) ne met donc JAMAIS deux fois en
 * file les notifications configurees. `quoteSentConsumer` (le courriel non
 * configurable, AVEC piece jointe PDF, E10.10b-3/4c) N EST PAS idempotent :
 * le placer en dernier laisse le risque de doublon EXACTEMENT ou il etait
 * avant ce lot, ni plus ni moins.
 */
export function createOutboxDispatchApplication(
  dependencies: OutboxDispatchApplicationDependencies,
): Readonly<{ runOnce: () => Promise<DispatchReport> }> {
  const repository = new SupabaseOutboxDispatchRepository(dependencies.serviceRoleClient);
  const gateway = new SupabaseQuoteNotificationGateway(dependencies.serviceRoleClient);
  // E10.10b-4c — MEME client service_role : le bucket prive `quote_documents`
  // n a, comme `document_pdf_templates`, aucune policy `storage.objects`.
  const documents = new SupabaseQuoteDocumentAttachmentGateway(dependencies.serviceRoleClient);
  const emailSender = new ResendQuoteSentEmailSender(
    dependencies.resendApiKey,
    dependencies.fromEmail,
    dependencies.fetchImplementation ?? globalThis.fetch,
  );

  const quoteSentConsumer = new QuoteSentNotificationConsumer({
    gateway,
    emailSender,
    documents,
    baseUrl: dependencies.publicAppUrl,
  });

  // E10.22a -- MEME client service_role, MEME cle Resend, MEME expediteur :
  // le rappel de purge est un courriel de plus sur le relais EXISTANT,
  // aucune dependance neuve a cabler (§3 du contrat : "le courriel ne passe
  // pas par la nouvelle fonction [magrit-order-file-purge]").
  const orderFilePurgeNoticeConsumer = createOrderFilePurgeNoticeConsumer({
    serviceRoleClient: dependencies.serviceRoleClient,
    resendApiKey: dependencies.resendApiKey,
    fromEmail: dependencies.fromEmail,
    // MEME `publicAppUrl` que le consommateur devis (qa-review round 1 B2) :
    // deja disponible ici, une seule source pour les deux liens.
    publicAppUrl: dependencies.publicAppUrl,
    ...(dependencies.fetchImplementation ? { fetchImplementation: dependencies.fetchImplementation } : {}),
  });

  // E10.15c + E10.15d-1 + E10.15d-2 — mise en file (JAMAIS d envoi reseau)
  // des notifications configurees sur `order.step_changed` (E10.15c),
  // `quote.sent`, `quote.converted` et `customer.created` (E10.15d-1, §8.23
  // §11.5 : ces trois derniers sont INDEPENDANTS du rendu differe, meme
  // chemin EXACT qu order.step_changed) et `order.files_submitted`
  // (E10.15d-2, SEUL a emprunter le rendu differe de `{{files.count}}`).
  // MEME client `service_role` : la lecture du contexte (agregat) et
  // l ecriture idempotente/regroupante dans `notification_logs` passent
  // toutes deux par des chemins reserves a ce role. UNE SEULE INSTANCE,
  // composee sur les CINQ evenements ci-dessous (elle route elle-meme sur
  // `event.name`, §8.23).
  const notificationDispatchGateway = new SupabaseNotificationDispatchGateway(dependencies.serviceRoleClient);
  const notificationDispatchConsumer = new NotificationDispatchConsumer({
    gateway: notificationDispatchGateway,
    logs: notificationDispatchGateway,
    baseUrl: dependencies.publicAppUrl,
  });

  const consumers: OutboxConsumerRegistry = {
    // ORDRE OPPOSABLE, voir le commentaire de `createOutboxDispatchApplication`
    // ci-dessus : `notificationDispatchConsumer` (idempotent) EN PREMIER,
    // `quoteSentConsumer` (non idempotent) EN SECOND.
    'quote.sent': new CompositeOutboxConsumer([notificationDispatchConsumer, quoteSentConsumer]),
    'order_files.purge_scheduled': new CompositeOutboxConsumer([orderFilePurgeNoticeConsumer]),
    'order.step_changed': new CompositeOutboxConsumer([notificationDispatchConsumer]),
    'quote.converted': new CompositeOutboxConsumer([notificationDispatchConsumer]),
    'customer.created': new CompositeOutboxConsumer([notificationDispatchConsumer]),
    // E10.15d-2 — SEUL evenement a emprunter le rendu differe (§8.23 point
    // 11) : le consommateur reste IDEMPOTENT/SANS APPEL RESEAU, exactement
    // comme les quatre autres, c est `NotificationSender` (drain d envoi
    // separe) qui applique le sceau a la remise.
    'order.files_submitted': new CompositeOutboxConsumer([notificationDispatchConsumer]),
  };

  const dispatcher = new OutboxDispatcher({
    repository,
    consumers,
    settings: dependencies.settings ?? DEFAULT_OUTBOX_DISPATCH_SETTINGS,
    ...(dependencies.onUnhandledError === undefined
      ? {}
      : { onUnhandledError: dependencies.onUnhandledError }),
  });

  return Object.freeze({ runOnce: () => dispatcher.runOnce() });
}
