/**
 * Point de composition UNIQUE du drain de GENERATION des exports de
 * commandes (story E10.18c, contrat §8.24 §3(b)).
 *
 * Meme contre-mesure que `createNotificationSendApplication()`/
 * `createOutboxDispatchApplication()` pour la dette M1 (§8.2) : l Edge
 * Function `magrit-order-export-runner` ne fait qu instancier les
 * adaptateurs et appeler cette fonction — la vraie composition (quel
 * renderer pour quel format) vit ici, dans un fichier typechecke et
 * testable par vitest.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseOrderExportRunRepository,
} from '../../adapters/supabase/order-exports-repository.ts';
import { SupabaseOrderExportStorage } from '../../adapters/supabase/order-exports-storage.ts';
import { csvOrderExportRenderer } from '../../modules/order-exports/application/renderers/csv-renderer.ts';
import { xlsxOrderExportRenderer } from '../../modules/order-exports/application/renderers/xlsx-renderer.ts';
import {
  OrderExportGenerationService,
  type OrderExportGenerationReport,
} from '../../modules/order-exports/application/order-export-generation-service.ts';
import {
  DEFAULT_ORDER_EXPORT_RUN_SETTINGS,
  type OrderExportRunSettings,
} from '../../modules/order-exports/application/order-export-run-repository.ts';

export type OrderExportRunApplicationDependencies = Readonly<{
  /** Client `service_role` — seul role habilite sur la file (`api_claim_order_exports`, colonnes de suivi, bucket `order_exports`). */
  serviceRoleClient: SupabaseClient<any>;
  settings?: OrderExportRunSettings;
  onUnhandledError?: (error: unknown, exportId: string) => void;
}>;

/**
 * Compose le drain de generation avec les DEUX renderers livres (story
 * E10.18d) : `csv` (E10.18c) et `xlsx` (E10.18d, `write-excel-file` 4.1.1
 * entree `/node`). Avant E10.18d, `xlsx` n avait AUCUN renderer enregistre :
 * une demande xlsx reclamee echouait proprement
 * (`order_export.format_not_implemented`), jamais en boucle de reprise (voir
 * `OrderExportGenerationService.processOne`) — ce n est plus le cas.
 */
export function createOrderExportRunApplication(
  dependencies: OrderExportRunApplicationDependencies,
): Readonly<{ runOnce: () => Promise<OrderExportGenerationReport> }> {
  const repository = new SupabaseOrderExportRunRepository(dependencies.serviceRoleClient);
  const storage = new SupabaseOrderExportStorage(dependencies.serviceRoleClient);

  const service = new OrderExportGenerationService({
    repository,
    storage,
    renderers: { csv: csvOrderExportRenderer, xlsx: xlsxOrderExportRenderer },
    settings: dependencies.settings ?? DEFAULT_ORDER_EXPORT_RUN_SETTINGS,
    ...(dependencies.onUnhandledError === undefined ? {} : { onUnhandledError: dependencies.onUnhandledError }),
  });

  return Object.freeze({ runOnce: () => service.runOnce() });
}
