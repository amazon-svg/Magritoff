/**
 * Port du volet "purge reelle" (E10.22b, docs/api/CONVENTIONS.md §8.22 §5).
 * Implementation Supabase dans `src/adapters/supabase/order-file-purge-
 * repository.ts` (`SupabaseOrderFilePurgeExecutionRepository`) : reclame et
 * MARQUE les fichiers echus en base (meme regime que la suppression manuelle
 * d E10.17a — OCTETS DETRUITS, LIGNE CONSERVEE ; ordre PRESCRIT, ligne
 * d abord, objet ensuite), retire les objets de stockage PAR LOT
 * (best-effort, jamais bloquant — le point de non-retour est deja franchi
 * une fois la ligne marquee), puis emet UN evenement `order_files.purged`
 * PAR ESPACE concerne.
 *
 * LA GARDE DES DEUX RAPPELS CONFIRMES DELIVRES (arbitrage Arnaud du
 * 2026-09-10, §5 du contrat) est ENTIEREMENT portee par la fonction SQL
 * `api_claim_order_files_for_purge` — ce port ne la reimplemente JAMAIS cote
 * applicatif : un fichier que la garde ne laisse pas passer n est tout
 * simplement JAMAIS rendu par `purgeEligibleFiles`.
 *
 * AUCUN chemin de stockage n atteint ce port : le chemin est TOUJOURS
 * recalcule cote adaptateur depuis tenant/order/file, jamais transporte en
 * donnee (meme discipline que `SupabaseOrderFilesRepository`).
 */
export type PurgeExecutionSummary = Readonly<{
  tenantId: string;
  fileCount: number;
  orderCount: number;
  byteSizeFreed: number;
  /** Bornee a 50 entrees (§9 du contrat, `OrderFilesPurgedPayload.order_ids`). */
  orderIds: readonly string[];
}>;

/**
 * Motif de blocage — NEGATION EXACTE de la garde SQL de
 * `api_claim_order_files_for_purge` (§5 du contrat), voir la fonction
 * `api_count_blocked_order_file_purges`.
 */
export type BlockedPurgeReason =
  | 'rappel_non_emis'
  | 'rappels_identiques'
  | 'rappel_en_echec'
  | 'rappel_non_confirme';

export type BlockedPurgeCount = Readonly<{
  tenantId: string;
  reason: BlockedPurgeReason;
  count: number;
}>;

export interface PurgeExecutionRepository {
  /**
   * Un TOUR complet : reclame les fichiers echus dont les DEUX rappels sont
   * CONFIRMES DELIVRES, les marque (deleted_at/purged_at/deleted_by_label =
   * "Purge automatique"), retire leurs objets de stockage par lot
   * (best-effort), puis emet un evenement `order_files.purged` par espace
   * concerne. `limit` borne le nombre de fichiers traites en un tour.
   */
  purgeEligibleFiles(limit: number): Promise<readonly PurgeExecutionSummary[]>;

  /**
   * B1 (qa-review round 1, BLOQUANT) — arbitrage Arnaud, §5 du contrat :
   * "le balayage de purge compte les fichiers echus qu il refuse de
   * detruire, par espace et par motif". Lecture SEULE. Sans ce compte, un
   * bucket qui grossit indefiniment (ex. domaine Resend jamais verifie,
   * reserve (e) : aucun rappel jamais confirme) est INDISTINGUABLE d un
   * espace ou il n y a legitimement rien a purger — le mecanisme redevient
   * observable.
   */
  countBlockedFiles(): Promise<readonly BlockedPurgeCount[]>;
}
