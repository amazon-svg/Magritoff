/**
 * Contrat des adaptateurs de canal du drain d envoi (story E10.15c, contrat
 * §8.23 §6). Un port par canal (`email` aujourd hui, `sms` en E10.15e) : le
 * prestataire est une decision TARDIVE et REVERSIBLE, aucun code hors
 * `src/adapters/<presta>/` ne le connait.
 *
 * `retryable` est le champ que les six adaptateurs Resend anterieurs
 * n avaient pas besoin de porter : `{ sent: false, reason }` seul ne
 * distingue pas « Resend a renvoye 429 » (merite cinq tentatives) de
 * « cette adresse n existe pas » (n en merite aucune) — un echec NON
 * retentable fait passer le message en `failed` immediatement, jamais en
 * `pending`.
 */
import type { NotificationChannel } from '../api/contracts.ts';

export type RenderedNotification = Readonly<{
  channel: NotificationChannel;
  to: string;
  /** `null` en SMS (contrat §8.23 §4, `NotificationLog.subject`). */
  subject: string | null;
  /** Texte brut, DEJA rendu (balises substituees a la mise en file, jamais relu au modele). */
  body: string;
}>;

export type NotificationDelivery =
  | Readonly<{ sent: true; providerMessageId?: string }>
  | Readonly<{ sent: false; reason: string; retryable: boolean }>;

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  /** Ne leve JAMAIS (meme discipline que les adaptateurs Resend existants). */
  send(message: RenderedNotification): Promise<NotificationDelivery>;
}
