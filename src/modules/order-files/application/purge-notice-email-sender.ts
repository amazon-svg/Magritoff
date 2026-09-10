/**
 * Port d envoi des rappels de purge (E10.22a). STRICTEMENT le patron de
 * `QuoteSentEmailSender` (commercial-quotes) : `send()` ne leve jamais, rend
 * `{sent, reason?}` — a UNE difference pres, EXIGEE par l arbitrage Arnaud du
 * 2026-09-10 (§0/§4 du contrat) : `POST /emails` ne rend qu un identifiant de
 * message, RIEN d autre. Ce port le remonte donc explicitement
 * (`providerMessageId`), pour que le consommateur puisse le consigner
 * (`PurgeNoticeDeliveryGateway`) — c est CE consignement, jamais le `sent`
 * booleen seul, qui autorisera une destruction quinze jours plus tard
 * (E10.22b).
 */

export type PurgeNoticeEmail = Readonly<{
  to: string;
  /** `first` (J+10) ou `second` (J+15) — DEUX textes distincts, voir l adaptateur Resend. */
  stage: 'first' | 'second';
  fileCount: number;
  orderCount: number;
  /** Deja formatee en francais lisible (ex. "12 octobre 2026"). */
  purgeAtLabel: string;
  daysBeforePurge: number;
  /**
   * Liens vers les fiches commande workspace, UN PAR `order_id` de la charge
   * utile (jusqu a 50, §4 du contrat, qa-review round 1 B2) — jamais un lien
   * vers un fichier (§4 du contrat : « aucun identifiant de fichier », aucun
   * geste possible depuis ce rappel). Toujours non vide : le consommateur
   * echoue explicitement plutot que d envoyer un rappel sans lien
   * (`MAGRIT_PUBLIC_APP_URL` absente -> aucun envoi, meme discipline que
   * `quote.sent`, §8.13sexies).
   */
  orderLinks: readonly string[];
}>;

export type PurgeNoticeEmailDelivery =
  | Readonly<{ sent: true; providerMessageId: string }>
  | Readonly<{ sent: false; reason: string }>;

export interface PurgeNoticeEmailSender {
  send(message: PurgeNoticeEmail): Promise<PurgeNoticeEmailDelivery>;
}
