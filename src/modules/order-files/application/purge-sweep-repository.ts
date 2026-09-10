/**
 * Port (interface) du balayage quotidien de purge (E10.22a/E10.22a-bis,
 * docs/api/CONVENTIONS.md §8.22 §3-§4). Implementation Supabase dans
 * `src/adapters/supabase/order-file-purge-repository.ts` (client
 * `service_role`, delegue aux fonctions `security definer` de la migration
 * `20260910000500`). Consomme depuis `src/server/api/order-file-purge-
 * composition.ts`, appele par l Edge Function DEDIEE `magrit-order-file-
 * purge` (SECOND `pg_cron`, quotidien, distinct de `magrit-outbox-
 * dispatcher` -- §3 du contrat).
 *
 * Ce port ne fait JAMAIS partir de courriel : il cree les rappels et les
 * evenements `order_files.purge_scheduled` (le drain existant, minute par
 * minute, s occupe de l envoi via `PurgeNoticeNotificationConsumer`), et il
 * relit la PREUVE de livraison aupres de Resend pour la propager en base.
 */

export type ClaimedPurgeNoticeStage = 'first' | 'second';

export type ClaimedPurgeNoticeSummary = Readonly<{
  noticeId: string;
  tenantId: string;
  fileCount: number;
  orderCount: number;
}>;

export type ExpiredPurgeNoticeSummary = Readonly<{
  noticeId: string;
  tenantId: string;
  stage: ClaimedPurgeNoticeStage;
}>;

export type DeliveryPendingCheck = Readonly<{
  deliveryId: string;
  noticeId: string;
  providerMessageId: string;
}>;

export interface PurgeSweepRepository {
  /**
   * Reclame (transactionnellement, cote base) les fichiers atteignant CE
   * palier, groupe par (tenant, purge_at), verifie qu au moins un
   * destinataire existe, cree le rappel, rattache les fichiers, insere
   * `order_files.purge_scheduled`. `leadDays` = jours de recul depuis
   * `purge_at` (20 pour `first`, 15 pour `second`) -- JAMAIS depuis
   * `deposited_at`.
   */
  claimNotices(stage: ClaimedPurgeNoticeStage, leadDays: number): Promise<readonly ClaimedPurgeNoticeSummary[]>;

  /**
   * Expire les rappels sans AUCUNE livraison confirmee au bout de la
   * fenetre : `failed_at` pose, rattachement des fichiers REMIS A NULL
   * (relance au tour suivant, E10.22a-bis).
   */
  expireStaleNotices(window: Readonly<{ days: number }>): Promise<readonly ExpiredPurgeNoticeSummary[]>;

  /** Reclame les livraisons ACCEPTEES pas encore CONFIRMEES, pour relecture `GET /emails/{id}` (E10.22a-bis). */
  claimDeliveriesForRecheck(limit: number): Promise<readonly DeliveryPendingCheck[]>;

  /** Consigne `last_event` releve chez Resend pour UNE livraison. */
  recordDeliveryCheck(deliveryId: string, lastStatus: string): Promise<void>;
}
