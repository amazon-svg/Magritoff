/**
 * Point de composition UNIQUE du drain d envoi des notifications (story
 * E10.15c, contrat §8.23 §3(c)).
 *
 * Meme contre-mesure que `createOutboxDispatchApplication()`/
 * `createMagritApiApplication()` pour la dette M1 (§8.2) : l Edge Function
 * `magrit-notification-sender` ne fait qu instancier les adaptateurs et
 * appeler cette fonction — la vraie composition (quel adaptateur pour quel
 * canal, quels reglages) vit ici, dans un fichier typechecke et testable
 * par vitest.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationChannel } from '../../modules/notifications/api/contracts.ts';
import type { NotificationChannelAdapter } from '../../modules/notifications/application/notification-channel-adapter.ts';
import {
  DEFAULT_NOTIFICATION_SEND_SETTINGS,
  NotificationSender,
  type ClaimedNotificationMessage,
  type NotificationSendReport,
  type NotificationSendSettings,
} from '../../modules/notifications/application/notification-sender.ts';
import { SupabaseNotificationSendRepository } from '../../adapters/supabase/notification-send-repository.ts';
import { ResendNotificationEmailSender } from '../../adapters/resend/notification-email-sender.ts';

export type NotificationSendApplicationDependencies = Readonly<{
  /** Client `service_role` — seul role habilite sur la file (`api_claim_notification_messages`, colonnes de suivi). */
  serviceRoleClient: SupabaseClient<any>;
  /** `null` -> `ResendNotificationEmailSender` rend systematiquement `{sent:false, retryable:true}` explicite, pas de repli silencieux. */
  resendApiKey: string | null;
  /** `MAGRIT_FROM_EMAIL`, format `Magrit <devis@magritapp.com>`. */
  fromEmail: string;
  fetchImplementation?: typeof fetch;
  settings?: NotificationSendSettings;
  onUnhandledError?: (error: unknown, message: ClaimedNotificationMessage) => void;
}>;

/**
 * Compose le drain d envoi avec le SEUL adaptateur livre a ce jour : `email`
 * (Resend). `sms` n a AUCUN adaptateur enregistre (E10.15e, fournisseur non
 * tranche — §8.23 point 7, reserve (b)) : un message `sms` reclame echoue
 * DEFINITIVEMENT (`notification.channel_not_implemented`), jamais en boucle
 * de reprise — voir `NotificationSender.runOnce()`.
 */
export function createNotificationSendApplication(
  dependencies: NotificationSendApplicationDependencies,
): Readonly<{ runOnce: () => Promise<NotificationSendReport> }> {
  const repository = new SupabaseNotificationSendRepository(dependencies.serviceRoleClient);
  const emailSender = new ResendNotificationEmailSender(
    dependencies.resendApiKey,
    dependencies.fromEmail,
    dependencies.fetchImplementation ?? globalThis.fetch,
  );

  const adapters: Partial<Record<NotificationChannel, NotificationChannelAdapter>> = {
    email: emailSender,
  };

  const sender = new NotificationSender({
    repository,
    adapters,
    settings: dependencies.settings ?? DEFAULT_NOTIFICATION_SEND_SETTINGS,
    ...(dependencies.onUnhandledError === undefined ? {} : { onUnhandledError: dependencies.onUnhandledError }),
  });

  return Object.freeze({ runOnce: () => sender.runOnce() });
}
