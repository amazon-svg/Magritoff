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
import { ResendQuoteSentEmailSender } from '../../adapters/resend/quote-sent-email-sender.ts';
import { QuoteSentNotificationConsumer } from '../../modules/commercial-quotes/application/quote-sent-notification-consumer.ts';

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
 * Compose le drain avec son SEUL consommateur enregistre a ce jour :
 * `quote.sent` -> client (E10.10b-3). Tout autre `event_name` (`quote.
 * created`/`quote.accepted`/`quote.rejected`/`customer.created`…) est LIVRE
 * sans traitement par le socle (`OutboxDispatcher`, "aucun consommateur
 * enregistre" — §8.13sexies point 3), PAS un oubli de cablage : ajouter un
 * consommateur de plus est le SEUL changement a faire ici pour l ouvrir.
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

  const consumers: OutboxConsumerRegistry = {
    'quote.sent': quoteSentConsumer,
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
