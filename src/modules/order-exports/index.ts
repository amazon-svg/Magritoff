/**
 * Entree publique du module Exports de commandes (E10.18e-2 — premiere
 * consommation par une UI, `src/modules/commercial-orders/ui/`).
 *
 * `tests/architecture/modular-ui-boundaries.test.ts` n autorise un import
 * inter-modules depuis un fichier `ui/` que par cette racine (ou par
 * `ui/index.ts`, absent ici : ce module n a pas d ecran propre, seulement un
 * client consomme par l ecran d un AUTRE module — `commercial-orders`).
 */
export { OrderExportsApiClient } from './api/client';
export type { ListCommercialOrderExportsQuery, ListCommercialOrderExportsResponse } from './api/client';
export {
  orderExportFiltersSchema,
  orderExportFormatSchema,
  orderExportGranularitySchema,
  orderExportSchema,
  orderExportsListSchema,
  orderExportStatusSchema,
  requestOrderExportCommandSchema,
  type OrderExportDto,
  type OrderExportFiltersDto,
  type OrderExportFormat,
  type OrderExportGranularity,
  type OrderExportStatus,
  type RequestOrderExportCommand,
} from './api/contracts';
