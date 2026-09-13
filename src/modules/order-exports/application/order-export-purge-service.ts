/**
 * Orchestrateur de la purge de retention des fichiers d export (story
 * E10.18c, contrat §8.24 point 3(e), qa-review round 3, 2026-09-13). UN
 * TOUR = DEUX ETAGES, DANS CET ORDRE (meme discipline que `PurgeSweepService`,
 * E10.22b/E10.22c, aucune boucle interne) :
 *
 *   1. `OrderExportPurgeRepository.purgeExpiredFiles()` — reclamation
 *      normale (SQL, plafonnee par `purge_attempts`), retrait par lot,
 *      confirmation CIBLEE (jamais en bloc — voir le port pour l historique
 *      complet des corrections round 2/round 3).
 *   2. `OrderExportOrphanRepository.removeOrphanObjects()` — SOLUTION
 *      PORTEUSE (arbitrage architecte, round 3), APRES l etage 1 : rattrape
 *      tout objet non confirme retire par l etage 1, y compris une fois
 *      `purge_attempts` epuise. ETAPE 2 APRES ETAPE 1, meme raisonnement que
 *      E10.22c (« une confirmation DANS CE MEME TOUR rend immediatement
 *      l objet visible au balayage suivant, pas la peine d attendre »).
 *
 * Composition reelle : `src/server/api/order-export-purge-composition.ts`,
 * consommee par l Edge Function `magrit-order-file-purge` (E10.22b, ETENDUE).
 */
import type {
  OrderExportOrphanRepository,
  OrderExportPurgeRepository,
  OrderExportPurgeSummary,
} from './order-export-purge-repository.ts';
import {
  DEFAULT_ORDER_EXPORT_ORPHAN_LIMIT,
  DEFAULT_ORDER_EXPORT_ORPHAN_OLDER_THAN_HOURS,
  DEFAULT_ORDER_EXPORT_PURGE_LIMIT,
} from './order-export-purge-repository.ts';

export type OrderExportPurgeSettings = Readonly<{
  purgeLimit: number;
  orphanObjectOlderThanHours: number;
  orphanObjectLimit: number;
}>;

export const DEFAULT_ORDER_EXPORT_PURGE_SETTINGS: OrderExportPurgeSettings = Object.freeze({
  purgeLimit: DEFAULT_ORDER_EXPORT_PURGE_LIMIT,
  orphanObjectOlderThanHours: DEFAULT_ORDER_EXPORT_ORPHAN_OLDER_THAN_HOURS,
  orphanObjectLimit: DEFAULT_ORDER_EXPORT_ORPHAN_LIMIT,
});

export type OrderExportPurgeReport = Readonly<
  OrderExportPurgeSummary & {
    /** Etage 2 (round 3) — objets retires par le balayage d objets orphelins, INDEPENDANT de `objectsRemoved` de l etage 1. */
    orphanObjectsRemoved: number;
  }
>;

export type OrderExportPurgeServiceDependencies = Readonly<{
  purge: OrderExportPurgeRepository;
  orphans: OrderExportOrphanRepository;
  settings?: OrderExportPurgeSettings;
}>;

export class OrderExportPurgeService {
  private readonly settings: OrderExportPurgeSettings;

  constructor(private readonly dependencies: OrderExportPurgeServiceDependencies) {
    this.settings = dependencies.settings ?? DEFAULT_ORDER_EXPORT_PURGE_SETTINGS;
  }

  async runOnce(): Promise<OrderExportPurgeReport> {
    const purgeSummary = await this.dependencies.purge.purgeExpiredFiles(this.settings.purgeLimit);

    // Etage 2 (round 3, SOLUTION PORTEUSE) — APRES l etage 1, voir en-tete de fichier.
    const orphanObjectsRemoved = await this.dependencies.orphans.removeOrphanObjects(
      this.settings.orphanObjectOlderThanHours,
      this.settings.orphanObjectLimit,
    );

    return Object.freeze({ ...purgeSummary, orphanObjectsRemoved });
  }
}
