/**
 * Point de composition UNIQUE du drain d envoi des notifications (story
 * E10.15c, contrat §8.23 §3(c)).
 *
 * Le processus Node `worker:notifications` instancie les adaptateurs puis
 * appelle cette composition typecheckee et testable.
 */
import type { NotificationChannel } from '../../modules/notifications/api/contracts.ts';
import type { NotificationChannelAdapter } from '../../modules/notifications/application/notification-channel-adapter.ts';
import {
  DEFAULT_NOTIFICATION_SEND_SETTINGS,
  NotificationSender,
  type ClaimedNotificationMessage,
  type NotificationSendReport,
  type NotificationSendSettings,
} from '../../modules/notifications/application/notification-sender.ts';
import { PostgresNotificationSendRepository } from '../../adapters/postgres/notification-send-repository.ts';
import type { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { ResendNotificationEmailSender } from '../../adapters/resend/notification-email-sender.ts';

/**
 * Compose le drain d envoi avec le SEUL adaptateur livre a ce jour : `email`
 * (Resend). `sms` n a AUCUN adaptateur enregistre (E10.15e, fournisseur non
 * tranche — §8.23 point 7, reserve (b)) : un message `sms` reclame echoue
 * DEFINITIVEMENT (`notification.channel_not_implemented`), jamais en boucle
 * de reprise — voir `NotificationSender.runOnce()`.
 */
export type PostgresNotificationSendApplicationDependencies = Readonly<{
  transactions: PostgresTransactionRunner;
  resendApiKey: string | null;
  fromEmail: string;
  emailAdapter?: NotificationChannelAdapter;
  fetchImplementation?: typeof fetch;
  settings?: NotificationSendSettings;
  onUnhandledError?: (error: unknown, message: ClaimedNotificationMessage) => void;
}>;

/** Composition portable destinée au worker Node, sans client ni API Supabase. */
export function createPostgresNotificationSendApplication(
  dependencies: PostgresNotificationSendApplicationDependencies,
): Readonly<{ runOnce: () => Promise<NotificationSendReport> }> {
  return createNotificationSender(
    new PostgresNotificationSendRepository(dependencies.transactions),
    dependencies,
  );
}

function createNotificationSender(
  repository: ConstructorParameters<typeof NotificationSender>[0]['repository'],
  dependencies: Omit<PostgresNotificationSendApplicationDependencies, 'transactions' | 'emailAdapter'> & {
    emailAdapter?: NotificationChannelAdapter;
  },
): Readonly<{ runOnce: () => Promise<NotificationSendReport> }> {
  const emailSender = dependencies.emailAdapter
    ?? new ResendNotificationEmailSender(
      dependencies.resendApiKey,
      dependencies.fromEmail,
      dependencies.fetchImplementation ?? globalThis.fetch,
    );
  const adapters: Partial<Record<NotificationChannel, NotificationChannelAdapter>> = { email: emailSender };
  const sender = new NotificationSender({
    repository,
    adapters,
    settings: dependencies.settings ?? DEFAULT_NOTIFICATION_SEND_SETTINGS,
    ...(dependencies.onUnhandledError === undefined ? {} : { onUnhandledError: dependencies.onUnhandledError }),
  });
  return Object.freeze({ runOnce: () => sender.runOnce() });
}
