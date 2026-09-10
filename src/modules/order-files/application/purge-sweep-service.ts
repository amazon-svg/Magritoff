/**
 * Orchestrateur du balayage quotidien de purge (E10.22a/E10.22a-bis,
 * docs/api/CONVENTIONS.md §8.22 §3-§4). UN TOUR = trois etapes, dans cet
 * ordre, aucune boucle interne (meme discipline que `OutboxDispatcher`,
 * isolat a duree bornee) :
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
 * AUCUNE destruction ici (E10.22b, hors perimetre de ce lot) : ce service ne
 * fait que faire avancer les rappels vers "confirme delivre" ou "en echec,
 * relance demain".
 */
import type {
  ClaimedPurgeNoticeStage,
  PurgeSweepRepository,
} from './purge-sweep-repository.ts';
import type { EmailDeliveryStatusGateway } from './purge-notice-delivery-status-gateway.ts';

/** Reglages confirmes au contrat (§4, §10 reserve (h)) -- valeurs de depart, ajustables sans changer la forme. */
export type PurgeSweepSettings = Readonly<{
  /** Jours de recul depuis `purge_at` par palier. */
  leadDaysByStage: Readonly<Record<ClaimedPurgeNoticeStage, number>>;
  /** Fenetre de relecture avant qu un rappel sans confirmation soit marque en echec. */
  expiryWindowDays: number;
  /** Taille de lot pour la relecture de livraisons par tour. */
  deliveryRecheckLimit: number;
}>;

export const DEFAULT_PURGE_SWEEP_SETTINGS: PurgeSweepSettings = Object.freeze({
  leadDaysByStage: Object.freeze({ first: 20, second: 15 }),
  expiryWindowDays: 3,
  deliveryRecheckLimit: 50,
});

export type PurgeSweepReport = Readonly<{
  noticesCreated: number;
  noticesExpired: number;
  deliveriesChecked: number;
  deliveriesConfirmed: number;
}>;

export type PurgeSweepServiceDependencies = Readonly<{
  repository: PurgeSweepRepository;
  deliveryStatus: EmailDeliveryStatusGateway;
  settings?: PurgeSweepSettings;
}>;

export class PurgeSweepService {
  private readonly settings: PurgeSweepSettings;

  constructor(private readonly dependencies: PurgeSweepServiceDependencies) {
    this.settings = dependencies.settings ?? DEFAULT_PURGE_SWEEP_SETTINGS;
  }

  async runOnce(): Promise<PurgeSweepReport> {
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

    return Object.freeze({
      noticesCreated,
      noticesExpired: expired.length,
      deliveriesChecked: pending.length,
      deliveriesConfirmed,
    });
  }
}
