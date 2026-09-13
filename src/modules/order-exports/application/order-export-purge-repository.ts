/**
 * Ports de la purge de retention DES FICHIERS d export (story E10.18c,
 * contrat §8.24 point 3(e), CORRIGE qa-review round 1 PUIS round 2 PUIS
 * round 3, 2026-09-13).
 *
 * REGLE OPPOSABLE, tranchee par l architecte : une purge de LIGNES se fait
 * en SQL direct (`api_claim_order_exports_for_purge`, migration
 * `20260913000000`, marque `ready`/`expired` -> `expired`, transactionnel,
 * ET rend le `storage_path` de chaque fichier dont le retrait n est PAS
 * ENCORE confirme) ; une purge d OBJETS DE STOCKAGE passe par l API
 * Storage, donc par une Edge Function.
 *
 * ⚠️ HISTORIQUE DES DEUX CORRECTIONS, A LIRE AVANT DE MODIFIER CE PORT —
 * chacune a ferme un cas que l autre laissait passer, et les deux sont
 * necessaires ensemble :
 *
 * ROUND 2 : la ligne passait `expired` DES LA RECLAMATION, et le trigger
 * d immuabilite interdit TOUTE sortie de `expired` — un export deja
 * `expired` n etait donc PLUS JAMAIS reclame, meme si `remove()` echouait.
 * CORRIGE : `storage_path` n est mis a `null` que par
 * `api_confirm_order_export_files_purged()`, APRES un retrait confirme —
 * une ligne `expired` dont `storage_path` reste non nul est RE-RECLAMEE.
 *
 * ROUND 3 : le cas « `remove()` en ERREUR » etait clos, mais le RETRAIT
 * PARTIEL — qui NE LEVE AUCUNE ERREUR — contournait encore la reprise :
 * confirmer TOUS les ids reclames des que `remove()` rendait `error: null`,
 * SANS REGARDER `data`, effacait `storage_path` meme pour les fichiers dont
 * l objet binaire SURVIVAIT (lot de 3, `remove()` rendant `{data: [1
 * element], error: null}` -> 3 confirmations, 2 orphelins DEFINITIFS).
 *
 * LE FAIT ETABLI (code source du serveur Storage, pas de memoire) qui rend
 * tout FILTRAGE sur `data` une APPROXIMATION, jamais une preuve : `data` =
 * les lignes REELLEMENT supprimees de `storage.objects`, MAIS (i) la RLS
 * filtre SILENCIEUSEMENT ce qui n est pas visible (faux negatif possible :
 * absent de `data` ne veut pas dire absent du bucket) ; (ii) quand le
 * backend S3 sous-jacent rend un 200 avec des erreurs PAR CLE, l adaptateur
 * serveur N INSPECTE PAS `result.Errors` — un chemin peut figurer dans
 * `data` ALORS QUE L OBJET BINAIRE SURVIT (faux positif possible).
 * CONSEQUENCE OPPOSABLE : filtrer sur `data` est la MEILLEURE APPROXIMATION
 * DISPONIBLE, jamais une preuve — ce port ne doit JAMAIS confirmer un id
 * dont le chemin n apparait pas dans `data`, mais confirmer un id dont le
 * chemin y apparait reste un pari, pas une certitude.
 *
 * ARBITRAGE ARCHITECTE (round 3) — DEUX MECANISMES, PAS UN SEUL :
 *  (a) `purge_attempts` (colonne, plafond 3, ALIGNE sur `attempts`) : au-dela
 *      de trois reclamations SANS confirmation reussie, `api_claim_order_
 *      exports_for_purge` CESSE de rendre la ligne, SANS RIEN CONFIRMER —
 *      elle reste visible (`expired`, `storage_path` non nul, `purge_
 *      attempts` au plafond), jamais un nouveau statut.
 *  (c) `OrderExportOrphanRepository` (ci-dessous) — SOLUTION PORTEUSE, PAS
 *      UN COMPLEMENT : un balayage INDEPENDANT du bucket `order_exports`
 *      (`api_claim_orphan_order_export_objects`, migration `20260913000000`
 *      section 9), qui rattrape TOUT objet non confirme retire — y compris
 *      apres epuisement de `purge_attempts`. Motif : toute solution, y
 *      compris un filtre parfait sur `data`, finit par un cas ou l on n a
 *      pas pu confirmer et ou il faut bien s arreter ; sans filet
 *      independant, chaque branche de l arbre se termine par une fuite. CE
 *      FILET EST SUR ICI (contrairement a `commercial_order_files`,
 *      E10.22c, ou une course reelle a ete documentee, migration
 *      `20260910000700`) : le chemin `<tenant_id>/<export_id>.<ext>` porte
 *      un `export_id` NEUF a CHAQUE DEMANDE, jamais reutilise — aucune
 *      confirmation legitime ne peut jamais rattraper un objet que ce
 *      balayage vient de retirer.
 *
 * CONSOMMES par l Edge Function `magrit-order-file-purge` (E10.22b, ETENDUE
 * PAR CE LOT — PAS une troisieme Edge Function), DANS CET ORDRE (reclamation
 * PUIS orphelins, meme discipline que `PurgeSweepService`, E10.22b/E10.22c).
 */
export type OrderExportPurgeSummary = Readonly<{
  /** Nombre de LIGNES reclamees et marquees `expired` durant ce tour (contrat point 3(f) : la ligne SURVIT toujours, seul le fichier expire — inclut les lignes deja `expired` d un tour precedent dont le retrait restait a confirmer). */
  filesMarkedExpired: number;
  /**
   * Nombre d OBJETS dont le retrait a ete CONFIRME durant ce tour — derive
   * du nombre de lignes REELLEMENT mises a jour par `api_confirm_order_
   * export_files_purged()` (jamais de `rows.length`), APPELEE UNIQUEMENT
   * pour les ids dont le chemin figure dans `data` (round 3 : jamais tous
   * les ids reclames en bloc). `data` reste une APPROXIMATION (voir
   * historique ci-dessus) : ce chiffre peut donc, dans de rares cas,
   * surestimer legerement le retrait reel (faux positif S3 par cle) — il ne
   * peut PAS le sous-estimer au point de perdre la trace d un objet, c est
   * la propriete que ce port garantit. Un chiffre INFERIEUR a
   * `filesMarkedExpired` signale des fichiers dont l objet N A PAS ete
   * confirme retire — a JOURNALISER par l appelant (voir Edge Function).
   */
  objectsRemoved: number;
}>;

export interface OrderExportPurgeRepository {
  /**
   * Reclame les exports `ready`/`expired` echus dont l objet Storage n a
   * PAS ENCORE ete confirme retire (`storage_path` non nul, `purge_attempts`
   * sous le plafond), les marque/maintient `expired` (SQL, transactionnel),
   * PUIS retire leurs objets Storage par lot (best-effort). Confirme
   * UNIQUEMENT les ids dont le chemin figure dans la reponse de retrait
   * (round 3 — voir historique de ce fichier) : un retrait partiel ou en
   * erreur laisse les autres lignes REELLEMENT re-reclamables au tour
   * suivant (`storage_path` n est efface qu apres confirmation CIBLEE,
   * jamais en bloc).
   */
  purgeExpiredFiles(limit: number): Promise<OrderExportPurgeSummary>;
}

/**
 * SOLUTION PORTEUSE (round 3, voir historique ci-dessus) — balayage
 * INDEPENDANT du bucket `order_exports`, PAS un complement au filtrage sur
 * `data` de `OrderExportPurgeRepository`. Meme discipline que
 * `OrphanObjectRepository` (`src/modules/order-files/application/orphan-object-repository.ts`,
 * E10.22c), mais AUCUNE ligne a marquer pour la categorie « jamais
 * referencee » ; pour la categorie « purge_attempts epuise », l implementation
 * confirme (via `api_confirm_order_export_files_purged`) les objets
 * effectivement retires, fermant l invariant meme pour les lignes a bout de
 * tentatives normales.
 */
export interface OrderExportOrphanRepository {
  /**
   * Retire, par lot, best-effort, les objets du bucket `order_exports`
   * candidats a l orphelinat (voir `api_claim_orphan_order_export_objects`
   * pour les deux categories). Rend le nombre d objets DONT LE RETRAIT A
   * ETE CONFIRME (meme discipline d approximation que `data`, voir
   * historique de ce fichier).
   */
  removeOrphanObjects(olderThanHours: number, limit: number): Promise<number>;
}

export const DEFAULT_ORDER_EXPORT_PURGE_LIMIT = 500;
export const DEFAULT_ORDER_EXPORT_ORPHAN_OLDER_THAN_HOURS = 24;
export const DEFAULT_ORDER_EXPORT_ORPHAN_LIMIT = 200;
