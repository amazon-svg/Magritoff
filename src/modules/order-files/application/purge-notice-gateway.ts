/**
 * Ports (interfaces) de la preuve de livraison des rappels de purge
 * (E10.22a/E10.22a-bis, docs/api/CONVENTIONS.md §8.22). Colocalises dans le
 * module `order-files` (pas un module `order-file-purge` neuf) : le
 * mecanisme porte sur EXACTEMENT la meme table (`commercial_order_files`),
 * meme discipline que `quote-sent-notification-consumer.ts` dans
 * `commercial-quotes` plutot qu un module "notifications" separe.
 *
 * DEUX ROLES distincts, DEUX interfaces distinctes (meme separation que
 * `QuoteNotificationGateway` / `QuoteDocumentAttachmentGateway` en
 * commercial-quotes) :
 *  - `PurgeNoticeRecipientGateway` — resolution des destinataires A LA
 *    REMISE (jamais transportee par la charge utile de l evenement, §4 du
 *    contrat).
 *  - `PurgeNoticeDeliveryGateway` — consignation de ce que le consommateur
 *    outbox obtient de Resend (arbitrage Arnaud du 2026-09-10 : la remise du
 *    courriel AUTORISE une destruction quinze jours plus tard, c est le SEUL
 *    evenement du bus dont le consommateur doit "rendre compte").
 *
 * ECART CONSTATE avec la lettre du contrat §4 ("tous les owner, repli sur
 * admin") : `owner` n est plus une valeur ecrivable de `tenant_members`
 * depuis `20260814000200_admin_unique.sql` (migration DB). Ce port ne cite
 * aucun role : c est la fonction SQL `api_resolve_order_file_purge_
 * recipients` (implementation) qui porte cette decision, documentee et
 * assumee la-bas. Voir le rapport de fin de story pour le chemin de mise en
 * conformite du cadrage.
 */
import type { TenantId } from '../../../kernel/ids/index.ts';

export type PurgeNoticeRecipient = Readonly<{
  userId: string | null;
  email: string;
}>;

export interface PurgeNoticeRecipientGateway {
  /** Liste vide = cas NOMINAL (aucun destinataire joignable) : ne jamais lever. */
  resolveRecipients(tenantId: TenantId): Promise<readonly PurgeNoticeRecipient[]>;

  /**
   * Slug du tenant, pour composer le lien vers les fiches commande dans le
   * texte du rappel (§4 du contrat, qa-review round 1 B2). `null` = tenant
   * introuvable -- DEFENSIF, ne devrait pas arriver pour un evenement
   * reellement emis par ce tenant, traite comme "rien a notifier" par le
   * consommateur, jamais comme un echec.
   */
  getTenantSlug(tenantId: TenantId): Promise<string | null>;
}

/** Ce que le consommateur outbox a obtenu de Resend pour UN destinataire. */
export type PurgeNoticeDeliveryOutcome = Readonly<{
  /** `POST /emails` -> `{id}` (§0 du contrat). `null` = echec d envoi IMMEDIAT (pas d id obtenu) — "tentative faite", jamais une preuve. */
  providerMessageId: string | null;
}>;

export type PurgeNoticeDeliveryRecord = Readonly<{
  id: string;
  accepted: boolean;
}>;

export interface PurgeNoticeDeliveryGateway {
  /**
   * Consigne UNE tentative d envoi pour UN destinataire d UN rappel. Upsert
   * idempotent cote base (notice_id, recipient_email) : un rejeu de
   * l evenement outbox (au moins une fois) ne cree jamais une seconde ligne
   * de suivi, et ne regresse jamais une livraison deja CONFIRMEE.
   */
  recordDeliveryAttempt(
    noticeId: string,
    recipient: PurgeNoticeRecipient,
    outcome: PurgeNoticeDeliveryOutcome,
  ): Promise<PurgeNoticeDeliveryRecord>;
}
