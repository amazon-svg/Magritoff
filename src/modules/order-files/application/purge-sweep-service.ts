/**
 * Orchestrateur du balayage quotidien de purge (E10.22a/E10.22a-bis/E10.22b/
 * E10.22c/E10.22d, docs/api/CONVENTIONS.md §8.22/§8.22bis §3-§6). UN TOUR =
 * SEPT etapes, dans cet ordre, aucune boucle interne (meme discipline que
 * `OutboxDispatcher`, isolat a duree bornee) :
 *
 *   0. (E10.22d, §4 du contrat, VIVACITE) Remet a NULL, dans les espaces
 *      ARMES uniquement, les pointeurs de rappels CREES AVANT l activation
 *      courante -- sans cette etape, la garde etendue de l etape 4
 *      (confirmed_at >= enabled_at) bloquerait pour toujours un fichier dont
 *      les deux rappels datent d une activation anterieure a une
 *      reactivation. AUCUN filtre de tenant n est ecrit ICI ou ailleurs dans
 *      ce service en TypeScript : la garde (comme le filtre "espace arme")
 *      vit ENTIEREMENT en SQL (`api_reset_stale_order_file_purge_notices`),
 *      jamais reimplementee cote application.
 *
 *   1. Reclame les DEUX paliers (`first` J+20, `second` J+15 -- reglages
 *      confirmes au contrat). N ENVOIE AUCUN COURRIEL : ecrit `order_files.
 *      purge_scheduled` dans `outbox_events`, c est le drain EXISTANT
 *      (`magrit-outbox-dispatcher`, minute par minute) qui le remet au
 *      `PurgeNoticeNotificationConsumer`.
 *   2. Relit `GET /emails/{id}` (E10.22a-bis) pour les livraisons ACCEPTEES
 *      pas encore CONFIRMEES : SEUL `delivered` confirme (propage
 *      `notices.confirmed_at` cote base, via `recordDeliveryCheck`) ; tout
 *      AUTRE statut (y compris inconnu) reste PENDANT -- c est la fenetre de
 *      l etape 3, jamais une enumeration de statuts devinee, qui debloque le
 *      cas general (Resend NE DOCUMENTE PAS d enumeration exhaustive de
 *      `last_event`, §0 du contrat).
 *   3. Expire les rappels sans AUCUNE livraison confirmee au bout de la
 *      fenetre (3 jours proposes, reserve (h) du contrat) -- relance
 *      automatique au tour suivant.
 *
 *      ORDRE 2 AVANT 3, NON ACCESSOIRE (qa-review round 1, N1) : dans le
 *      tour ou la fenetre de 3 jours se ferme, une confirmation Resend
 *      arrivee ENTRE-TEMPS doit avoir la CHANCE d etre consignee avant que
 *      le rappel ne soit marque en echec pour defaut de confirmation --
 *      inverser ferait expirer, dans ce tour precis, un rappel que la
 *      RELECTURE DU MEME TOUR aurait pourtant confirme l instant d apres.
 *
 *   4. (E10.22b) PURGE REELLE : reclame et marque les fichiers echus dont
 *      LES DEUX rappels sont CONFIRMES DELIVRES (garde entierement portee
 *      par `api_claim_order_files_for_purge`, cote SQL -- ce service ne la
 *      reimplemente jamais), retire leurs objets de stockage par lot
 *      (best-effort, cote adaptateur), emet UN evenement `order_files.
 *      purged` par espace concerne. ETAPE 4 APRES l etape 2 : une
 *      confirmation relue DANS CE MEME TOUR rend IMMEDIATEMENT le fichier
 *      purgeable, sans attendre le tour suivant.
 *
 *   5. (E10.22c) OBJETS ORPHELINS : retire, PAR LOT, les objets du bucket
 *      sans ligne correspondante depuis plus de 24h (reserve (b) du
 *      contrat), OU dont la ligne est deja marquee `deleted_at` par l etape 4
 *      CI-DESSUS OU par une suppression manuelle (M2, qa-review round 1 --
 *      retrait precedent echoue -- ETAPE 5 APRES L ETAPE 4, meme
 *      raisonnement : un echec de retrait DANS CE TOUR peut etre rattrape
 *      DANS CE MEME TOUR). Ferme la dette D7 d E10.20b.
 *
 *   6. (E10.22b, B1 -- BLOQUANT qa-review round 1, arbitrage Arnaud, §5 du
 *      contrat) COMPTE DES BLOCAGES : `api_count_blocked_order_file_purges`,
 *      lecture SEULE, APRES la purge reelle (etape 4) pour refleter le
 *      RELIQUAT post-tour -- par tenant et par motif (rappel_non_emis /
 *      rappels_identiques / rappel_en_echec / rappel_non_confirme). SANS ce
 *      compte, "filesPurged: 0" est INDISTINGUABLE entre "rien n est du" et
 *      "4000 fichiers bloques, motif : rappel jamais confirme" (ex. domaine
 *      Resend non verifie, reserve (e)) -- c est la raison d etre des deux
 *      tables de suivi construites en E10.22a. Journalise par l Edge
 *      Function a chaque tour.
 */
import type {
  ClaimedPurgeNoticeStage,
  PurgeSweepRepository,
} from './purge-sweep-repository.ts';
import type { EmailDeliveryStatusGateway } from './purge-notice-delivery-status-gateway.ts';
import type { BlockedPurgeCount, PurgeExecutionRepository } from './purge-execution-repository.ts';
import type { OrphanObjectRepository } from './orphan-object-repository.ts';

/** Reglages confirmes au contrat (§4, §5, §6, §10 reserves (b)/(h)) -- valeurs de depart, ajustables sans changer la forme. */
export type PurgeSweepSettings = Readonly<{
  /** Jours de recul depuis `purge_at` par palier. */
  leadDaysByStage: Readonly<Record<ClaimedPurgeNoticeStage, number>>;
  /** Fenetre de relecture avant qu un rappel sans confirmation soit marque en echec. */
  expiryWindowDays: number;
  /** Taille de lot pour la relecture de livraisons par tour. */
  deliveryRecheckLimit: number;
  /** E10.22b -- nombre maximal de fichiers PURGES (destruction reelle) par tour. */
  purgeExecutionLimit: number;
  /** E10.22c, reserve (b) du contrat -- delai avant qu un objet orphelin (jamais confirme) ne soit retire. */
  orphanObjectOlderThanHours: number;
  /** E10.22c -- nombre maximal d objets orphelins retires par tour. */
  orphanObjectLimit: number;
}>;

export const DEFAULT_PURGE_SWEEP_SETTINGS: PurgeSweepSettings = Object.freeze({
  leadDaysByStage: Object.freeze({ first: 20, second: 15 }),
  expiryWindowDays: 3,
  deliveryRecheckLimit: 50,
  purgeExecutionLimit: 500,
  orphanObjectOlderThanHours: 24,
  orphanObjectLimit: 200,
});

export type PurgeSweepReport = Readonly<{
  /** E10.22d, etape 0 -- nombre de fichiers dont un pointeur de rappel perime (activation anterieure) a ete remis a null. */
  staleNoticesReset: number;
  noticesCreated: number;
  noticesExpired: number;
  deliveriesChecked: number;
  deliveriesConfirmed: number;
  /** E10.22b -- nombre de fichiers effectivement marques purges durant ce tour. */
  filesPurged: number;
  /** E10.22b -- nombre d evenements order_files.purged emis (un par espace concerne). */
  purgeEventsEmitted: number;
  /** E10.22c -- nombre d objets orphelins traites (retrait best-effort) durant ce tour. */
  orphanObjectsRemoved: number;
  /** B1 (qa-review round 1) -- fichiers echus que la garde refuse de detruire, par espace et par motif, APRES la purge de ce tour. */
  blockedFiles: readonly BlockedPurgeCount[];
}>;

export type PurgeSweepServiceDependencies = Readonly<{
  repository: PurgeSweepRepository;
  deliveryStatus: EmailDeliveryStatusGateway;
  execution: PurgeExecutionRepository;
  orphans: OrphanObjectRepository;
  settings?: PurgeSweepSettings;
}>;

export class PurgeSweepService {
  private readonly settings: PurgeSweepSettings;

  constructor(private readonly dependencies: PurgeSweepServiceDependencies) {
    this.settings = dependencies.settings ?? DEFAULT_PURGE_SWEEP_SETTINGS;
  }

  async runOnce(): Promise<PurgeSweepReport> {
    // Etape 0 (E10.22d) -- EN TETE de tour, avant toute reclamation : voir
    // en-tete de fichier.
    const staleNoticesReset = await this.dependencies.repository.resetStaleNotices();

    let noticesCreated = 0;
    for (const stage of ['first', 'second'] as const) {
      const claimed = await this.dependencies.repository.claimNotices(stage, this.settings.leadDaysByStage[stage]);
      noticesCreated += claimed.length;
    }

    // Etape 2 AVANT etape 3 (qa-review round 1, N1) : voir en-tete de fichier.
    const pending = await this.dependencies.repository.claimDeliveriesForRecheck(this.settings.deliveryRecheckLimit);
    let deliveriesConfirmed = 0;
    for (const delivery of pending) {
      const status = await this.dependencies.deliveryStatus.fetchStatus(delivery.providerMessageId);
      // Relecture en echec (reseau, cle absente) : traitee comme TOUJOURS
      // PENDANTE -- ni confirmee, ni en echec. `last_status` reste
      // inchange, la fenetre de l etape 3 reste le seul deblocage general.
      if (!status || status.lastEvent === null) continue;

      await this.dependencies.repository.recordDeliveryCheck(delivery.deliveryId, status.lastEvent);
      if (status.lastEvent === 'delivered') deliveriesConfirmed += 1;
    }

    const expired = await this.dependencies.repository.expireStaleNotices({ days: this.settings.expiryWindowDays });

    // Etape 4 (E10.22b) -- APRES l etape 2, voir en-tete de fichier.
    const purged = await this.dependencies.execution.purgeEligibleFiles(this.settings.purgeExecutionLimit);
    const filesPurged = purged.reduce((sum, summary) => sum + summary.fileCount, 0);

    // Etape 5 (E10.22c) -- APRES l etape 4, voir en-tete de fichier.
    const orphanObjectsRemoved = await this.dependencies.orphans.removeOrphanObjects(
      this.settings.orphanObjectOlderThanHours,
      this.settings.orphanObjectLimit,
    );

    // Etape 6 (B1, qa-review round 1, BLOQUANT) -- APRES la purge (etape 4),
    // voir en-tete de fichier : reflete le reliquat post-tour.
    const blockedFiles = await this.dependencies.execution.countBlockedFiles();

    return Object.freeze({
      staleNoticesReset,
      noticesCreated,
      noticesExpired: expired.length,
      deliveriesChecked: pending.length,
      deliveriesConfirmed,
      filesPurged,
      purgeEventsEmitted: purged.length,
      orphanObjectsRemoved,
      blockedFiles,
    });
  }
}
