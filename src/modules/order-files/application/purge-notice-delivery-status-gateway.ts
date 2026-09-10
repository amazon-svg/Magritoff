/**
 * Port de relecture du statut de livraison aupres de Resend (E10.22a-bis,
 * `GET /emails/{email_id}`). Colocalise avec le reste du mecanisme de purge
 * dans `order-files/application/`.
 */
export type EmailDeliveryStatus = Readonly<{
  /**
   * `last_event` tel que rendu par Resend, SANS interpretation ici (voir
   * `PurgeSweepService` pour ce que chaque valeur autorise). `null` = la
   * relecture a echoue (reseau, cle absente, 4xx/5xx) -- traite comme
   * TOUJOURS PENDANT, jamais comme un echec de la livraison elle-meme.
   */
  lastEvent: string | null;
}>;

export interface EmailDeliveryStatusGateway {
  fetchStatus(providerMessageId: string): Promise<EmailDeliveryStatus | null>;
}
