/**
 * Point de composition UNIQUE du drain de GENERATION des exports de
 * commandes (story E10.18c, contrat §8.24 §3(b)).
 *
 * Le processus Node `worker:order-exports` ne fait qu instancier les
 * adaptateurs et appeler cette fonction — la vraie composition (quel
 * renderer pour quel format) vit ici, dans un fichier typechecke et
 * testable par vitest.
 */
import type { S3Client } from '@aws-sdk/client-s3';
import { PostgresOrderExportRunRepository } from '../../adapters/postgres/order-exports-repository.ts';
import type { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import { S3OrderExportStorage } from '../../adapters/s3/order-exports-storage.ts';
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

/**
 * Compose le drain de generation avec les DEUX renderers livres (story
 * E10.18d) : `csv` (E10.18c) et `xlsx` (E10.18d, `write-excel-file` 4.1.1
 * entree `/node`). Avant E10.18d, `xlsx` n avait AUCUN renderer enregistre :
 * une demande xlsx reclamee echouait proprement
 * (`order_export.format_not_implemented`), jamais en boucle de reprise (voir
 * `OrderExportGenerationService.processOne`) — ce n est plus le cas.
 */
export type PostgresOrderExportRunApplicationDependencies = Readonly<{
  transactions: PostgresTransactionRunner;
  storage: S3Client;
  settings?: OrderExportRunSettings;
  onUnhandledError?: (error: unknown, exportId: string) => void;
}>;

export function createPostgresOrderExportRunApplication(
  dependencies: PostgresOrderExportRunApplicationDependencies,
): Readonly<{ runOnce: () => Promise<OrderExportGenerationReport> }> {
  const service = new OrderExportGenerationService({
    repository: new PostgresOrderExportRunRepository(dependencies.transactions),
    storage: new S3OrderExportStorage(dependencies.storage),
    renderers: { csv: csvOrderExportRenderer, xlsx: xlsxOrderExportRenderer },
    settings: dependencies.settings ?? DEFAULT_ORDER_EXPORT_RUN_SETTINGS,
    ...(dependencies.onUnhandledError === undefined
      ? {}
      : { onUnhandledError: dependencies.onUnhandledError }),
  });
  return Object.freeze({ runOnce: () => service.runOnce() });
}
