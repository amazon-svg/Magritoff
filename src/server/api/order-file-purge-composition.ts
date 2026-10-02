/**
 * Points de composition du mecanisme de purge des fichiers de commande
 * (E10.22a/E10.22a-bis/E10.22b/E10.22c, docs/api/CONVENTIONS.md §8.22). Meme
 * Les workers Node ne font qu instancier des adaptateurs : toute la
 * composition, typecheckee et testable, vit ici.
 *
 * DEUX exports, pour DEUX consommateurs distincts (§3 du contrat) :
 *  - `createPostgresOrderFilePurgeSweepApplication()` -- le balayage quotidien.
 *    N ENVOIE AUCUN COURRIEL. Porte desormais CINQ etapes (E10.22a/a-bis :
 *    rappels + preuve de livraison ; E10.22b : purge REELLE des fichiers
 *    dont les deux rappels sont confirmes delivres ; E10.22c : objets
 *    orphelins, dette D7) -- voir `PurgeSweepService`.
 *  - `createPostgresOrderFilePurgeNoticeConsumer()` -- le consommateur outbox
 *    `order_files.purge_scheduled`, a BRANCHER dans le registre du drain
 *    (`outbox-dispatch-composition.ts`) : c est lui qui envoie le courriel via le
 *    relais deja fiable (reprise, backoff) d E10.10b-3. INCHANGE par E10.22b/
 *    E10.22c : `order_files.purged` n a AUCUN consommateur (§9 du contrat --
 *    seule trace versionnee, personne ne l ecoute aujourd hui).
 */
import type { S3Client } from '@aws-sdk/client-s3';
import {
  PostgresOrderFilePurgeExecutionRepository,
  PostgresOrderFilePurgeNoticeGateway,
  PostgresOrderFilePurgeSweepRepository,
  PostgresOrphanOrderFileObjectRepository,
} from '../../adapters/postgres/order-file-purge-repository.ts';
import type { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { ResendOrderFilePurgeNoticeEmailSender } from '../../adapters/resend/order-file-purge-notice-email-sender.ts';
import { ResendEmailDeliveryStatusGateway } from '../../adapters/resend/resend-email-delivery-status-gateway.ts';
import { PurgeNoticeNotificationConsumer } from '../../modules/order-files/application/purge-notice-notification-consumer.ts';
import {
  DEFAULT_PURGE_SWEEP_SETTINGS,
  PurgeSweepService,
  type PurgeSweepReport,
  type PurgeSweepSettings,
} from '../../modules/order-files/application/purge-sweep-service.ts';

export type PostgresOrderFilePurgeSweepDependencies = Readonly<{
  transactions: PostgresTransactionRunner;
  storage: S3Client;
  resendApiKey: string | null;
  fetchImplementation?: typeof fetch;
  settings?: PurgeSweepSettings;
}>;

/** Balayage portable PostgreSQL/S3 destiné au worker Node quotidien. */
export function createPostgresOrderFilePurgeSweepApplication(
  dependencies: PostgresOrderFilePurgeSweepDependencies,
): Readonly<{ runOnce: () => Promise<PurgeSweepReport> }> {
  const repository = new PostgresOrderFilePurgeSweepRepository(dependencies.transactions);
  const deliveryStatus = new ResendEmailDeliveryStatusGateway(
    dependencies.resendApiKey,
    dependencies.fetchImplementation ?? globalThis.fetch,
  );
  const execution = new PostgresOrderFilePurgeExecutionRepository(
    dependencies.transactions,
    dependencies.storage,
  );
  const orphans = new PostgresOrphanOrderFileObjectRepository(
    dependencies.transactions,
    dependencies.storage,
  );
  const service = new PurgeSweepService({
    repository,
    deliveryStatus,
    execution,
    orphans,
    settings: dependencies.settings ?? DEFAULT_PURGE_SWEEP_SETTINGS,
  });
  return Object.freeze({ runOnce: () => service.runOnce() });
}

export type PostgresOrderFilePurgeNoticeConsumerDependencies = Readonly<{
  transactions: PostgresTransactionRunner;
  resendApiKey: string | null;
  fromEmail: string;
  publicAppUrl: string | null;
  fetchImplementation?: typeof fetch;
}>;

/** Consommateur portable destiné au drain outbox Node. */
export function createPostgresOrderFilePurgeNoticeConsumer(
  dependencies: PostgresOrderFilePurgeNoticeConsumerDependencies,
): PurgeNoticeNotificationConsumer {
  const gateway = new PostgresOrderFilePurgeNoticeGateway(dependencies.transactions);
  const emailSender = new ResendOrderFilePurgeNoticeEmailSender(
    dependencies.resendApiKey,
    dependencies.fromEmail,
    dependencies.fetchImplementation ?? globalThis.fetch,
  );
  return new PurgeNoticeNotificationConsumer({
    recipients: gateway,
    deliveries: gateway,
    emailSender,
    publicAppUrl: dependencies.publicAppUrl,
  });
}
