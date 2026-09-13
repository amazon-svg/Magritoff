/**
 * Point de composition de la purge de retention DES FICHIERS d export
 * (story E10.18c, contrat §8.24 point 3(e), CORRIGE qa-review round 1 PUIS
 * round 2 PUIS round 3, 2026-09-13 — voir `order-export-purge-repository.ts`
 * pour l historique complet des deux corrections : la reprise n etait pas
 * reelle au round 2, le retrait partiel la contournait encore au round 3).
 *
 * Meme contre-mesure que `createOrderFilePurgeSweepApplication()`/
 * `createOutboxDispatchApplication()` pour la dette M1 (§8.2) : l Edge
 * Function `magrit-order-file-purge` (E10.22b, ETENDUE PAR CE LOT — PAS une
 * troisieme Edge Function) ne fait qu instancier les deux adaptateurs — la
 * composition, typecheckee et testable, vit ici, via `OrderExportPurgeService`
 * (DEUX etages : reclamation normale PUIS balayage d objets orphelins,
 * SOLUTION PORTEUSE arbitree par l architecte au round 3).
 *
 * PAS branche dans `PurgeSweepService` (order-files) : ce sont deux
 * RESSOURCES distinctes (fichiers de commande vs. fichiers d export), qui ne
 * partagent ni bucket ni table, seulement le meme DECLENCHEUR quotidien.
 * L Edge Function appelle les deux applications l une apres l autre — voir
 * `supabase/functions/magrit-order-file-purge/index.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseOrderExportOrphanRepository,
  SupabaseOrderExportPurgeRepository,
} from '../../adapters/supabase/order-exports-repository.ts';
import {
  OrderExportPurgeService,
  type OrderExportPurgeReport,
  type OrderExportPurgeSettings,
} from '../../modules/order-exports/application/order-export-purge-service.ts';

export type OrderExportPurgeDependencies = Readonly<{
  /** Client `service_role` — seul role habilite sur `api_claim_order_exports_for_purge`/`api_confirm_order_export_files_purged`/`api_claim_orphan_order_export_objects` et le bucket `order_exports`. */
  serviceRoleClient: SupabaseClient<any>;
  settings?: OrderExportPurgeSettings;
}>;

export function createOrderExportPurgeApplication(
  dependencies: OrderExportPurgeDependencies,
): Readonly<{ runOnce: () => Promise<OrderExportPurgeReport> }> {
  const purge = new SupabaseOrderExportPurgeRepository(dependencies.serviceRoleClient);
  const orphans = new SupabaseOrderExportOrphanRepository(dependencies.serviceRoleClient);
  const service = new OrderExportPurgeService({
    purge,
    orphans,
    ...(dependencies.settings === undefined ? {} : { settings: dependencies.settings }),
  });
  return Object.freeze({ runOnce: () => service.runOnce() });
}
