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
 * Compose le drain. Trois `event_name` ont desormais un consommateur :
 * `quote.sent` -> client (E10.10b-3), `order_files.purge_scheduled` ->
 * rappel de purge (E10.22a), `order.step_changed` -> mise en file des
 * notifications configurees (E10.15c). Tout AUTRE `event_name` (`quote.
 * created`/`quote.accepted`/`quote.rejected`/`customer.created`…) est LIVRE
 * sans traitement par le socle (`OutboxDispatcher`, "aucun consommateur
 * enregistre" — §8.13sexies point 3), PAS un oubli de cablage.
 *
 * Chaque entree du registre est un `CompositeOutboxConsumer` (E10.15c,
 * contrat §8.23 §3(a)), MEME quand elle ne compose qu un seul consommateur
 * aujourd hui : c est le point d extension EXPLICITE ou E10.15d ajoutera le
 * futur consommateur de notifications sur `quote.sent`, EN PREMIER dans la
 * liste (il est idempotent, `quoteSentConsumer` ne l est pas — §8.23 §3(a)).
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

  // E10.15c — mise en file (JAMAIS d envoi reseau) des notifications
  // configurees sur `order.step_changed`, SEUL evenement branche par ce lot
  // (§8.23 §8). MEME client `service_role` : la lecture du contexte
  // (commande/client/etapes) et l ecriture idempotente/regroupante dans
  // `notification_logs` passent toutes deux par des chemins reserves a ce
  // role.
  const notificationDispatchGateway = new SupabaseNotificationDispatchGateway(dependencies.serviceRoleClient);
  const notificationDispatchConsumer = new NotificationDispatchConsumer({
    gateway: notificationDispatchGateway,
    logs: notificationDispatchGateway,
    baseUrl: dependencies.publicAppUrl,
  });

  const consumers: OutboxConsumerRegistry = {
    'quote.sent': new CompositeOutboxConsumer([quoteSentConsumer]),
    'order_files.purge_scheduled': new CompositeOutboxConsumer([orderFilePurgeNoticeConsumer]),
    'order.step_changed': new CompositeOutboxConsumer([notificationDispatchConsumer]),
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
