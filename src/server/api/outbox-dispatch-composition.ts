/**
 * Point de composition UNIQUE du drain outbox (story E10.10b-3).
 *
 * Le worker Node instancie les adaptateurs et appelle cette composition,
 * typecheckee et testable par vitest.
 */
import type { S3Client } from '@aws-sdk/client-s3';
import {
  CompositeOutboxConsumer,
  DEFAULT_OUTBOX_DISPATCH_SETTINGS,
  OutboxDispatcher,
  type ClaimedOutboxEvent,
  type DispatchReport,
  type OutboxConsumerRegistry,
  type OutboxDispatchRepository,
  type OutboxDispatchSettings,
} from '../../modules/_shared/application/index.ts';
import { PostgresOutboxDispatchRepository } from '../../adapters/postgres/outbox-dispatch-repository.ts';
import { PostgresQuoteNotificationGateway } from '../../adapters/postgres/quote-notification-gateway.ts';
import { PostgresNotificationDispatchGateway } from '../../adapters/postgres/notification-dispatch-gateway.ts';
import type { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { S3QuoteDocumentAttachmentGateway } from '../../adapters/s3/quote-document-attachment-gateway.ts';
import { ResendQuoteSentEmailSender } from '../../adapters/resend/quote-sent-email-sender.ts';
import { QuoteSentNotificationConsumer } from '../../modules/commercial-quotes/application/quote-sent-notification-consumer.ts';
import { NotificationDispatchConsumer } from '../../modules/notifications/application/notification-dispatch-consumer.ts';
import { createPostgresOrderFilePurgeNoticeConsumer } from './order-file-purge-composition.ts';

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
export type PostgresOutboxDispatchApplicationDependencies = Readonly<{
  transactions: PostgresTransactionRunner;
  storage: S3Client;
  repository?: OutboxDispatchRepository;
  resendApiKey: string | null;
  fromEmail: string;
  publicAppUrl: string | null;
  fetchImplementation?: typeof fetch;
  settings?: OutboxDispatchSettings;
  onUnhandledError?: (error: unknown, event: ClaimedOutboxEvent) => void;
}>;

/** Composition complète du drain Node : PostgreSQL pour les files/projections et S3 pour les PDF. */
export function createPostgresOutboxDispatchApplication(
  dependencies: PostgresOutboxDispatchApplicationDependencies,
): Readonly<{ runOnce: () => Promise<DispatchReport> }> {
  const quoteGateway = new PostgresQuoteNotificationGateway(dependencies.transactions);
  const documents = new S3QuoteDocumentAttachmentGateway(dependencies.transactions, dependencies.storage);
  const emailSender = new ResendQuoteSentEmailSender(
    dependencies.resendApiKey,
    dependencies.fromEmail,
    dependencies.fetchImplementation ?? globalThis.fetch,
  );
  const quoteSentConsumer = new QuoteSentNotificationConsumer({
    gateway: quoteGateway,
    emailSender,
    documents,
    baseUrl: dependencies.publicAppUrl,
  });
  const notificationGateway = new PostgresNotificationDispatchGateway(dependencies.transactions);
  const notificationConsumer = new NotificationDispatchConsumer({
    gateway: notificationGateway,
    logs: notificationGateway,
    baseUrl: dependencies.publicAppUrl,
  });
  const purgeNoticeConsumer = createPostgresOrderFilePurgeNoticeConsumer({
    transactions: dependencies.transactions,
    resendApiKey: dependencies.resendApiKey,
    fromEmail: dependencies.fromEmail,
    publicAppUrl: dependencies.publicAppUrl,
    ...(dependencies.fetchImplementation === undefined
      ? {}
      : { fetchImplementation: dependencies.fetchImplementation }),
  });
  const consumers: OutboxConsumerRegistry = {
    'quote.sent': new CompositeOutboxConsumer([notificationConsumer, quoteSentConsumer]),
    'order_files.purge_scheduled': new CompositeOutboxConsumer([purgeNoticeConsumer]),
    'order.step_changed': new CompositeOutboxConsumer([notificationConsumer]),
    'quote.converted': new CompositeOutboxConsumer([notificationConsumer]),
    'customer.created': new CompositeOutboxConsumer([notificationConsumer]),
    'order.files_submitted': new CompositeOutboxConsumer([notificationConsumer]),
  };
  const dispatcher = new OutboxDispatcher({
    repository: dependencies.repository ?? new PostgresOutboxDispatchRepository(dependencies.transactions),
    consumers,
    settings: dependencies.settings ?? DEFAULT_OUTBOX_DISPATCH_SETTINGS,
    ...(dependencies.onUnhandledError === undefined
      ? {}
      : { onUnhandledError: dependencies.onUnhandledError }),
  });
  return Object.freeze({ runOnce: () => dispatcher.runOnce() });
}
