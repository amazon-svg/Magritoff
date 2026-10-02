/**
 * Point de composition de la purge de retention DES FICHIERS d export
 * (story E10.18c, contrat §8.24 point 3(e), CORRIGE qa-review round 1 PUIS
 * round 2 PUIS round 3, 2026-09-13 — voir `order-export-purge-repository.ts`
 * pour l historique complet des deux corrections : la reprise n etait pas
 * reelle au round 2, le retrait partiel la contournait encore au round 3).
 *
 * Le worker Node de purge instancie les deux adaptateurs ; la composition,
 * typecheckee et testable, vit ici via `OrderExportPurgeService`
 * (DEUX etages : reclamation normale PUIS balayage d objets orphelins,
 * SOLUTION PORTEUSE arbitree par l architecte au round 3).
 *
 * PAS branche dans `PurgeSweepService` (order-files) : ce sont deux
 * RESSOURCES distinctes (fichiers de commande vs. fichiers d export), qui ne
 * partagent ni bucket ni table, seulement le meme DECLENCHEUR quotidien.
 * Le worker Node appelle les deux applications l une apres l autre — voir
 * `src/server/node/order-file-purge-worker-main.ts`.
 */
import type { S3Client } from '@aws-sdk/client-s3';
import {
  PostgresOrderExportOrphanRepository,
  PostgresOrderExportPurgeRepository,
} from '../../adapters/postgres/order-exports-repository.ts';
import type { PostgresTransactionRunner } from '../../adapters/postgres/transaction-runner.ts';
import {
  OrderExportPurgeService,
  type OrderExportPurgeReport,
  type OrderExportPurgeSettings,
} from '../../modules/order-exports/application/order-export-purge-service.ts';

export type PostgresOrderExportPurgeDependencies = Readonly<{
  transactions: PostgresTransactionRunner;
  storage: S3Client;
  settings?: OrderExportPurgeSettings;
}>;

export function createPostgresOrderExportPurgeApplication(
  dependencies: PostgresOrderExportPurgeDependencies,
): Readonly<{ runOnce: () => Promise<OrderExportPurgeReport> }> {
  const service = new OrderExportPurgeService({
    purge: new PostgresOrderExportPurgeRepository(dependencies.transactions, dependencies.storage),
    orphans: new PostgresOrderExportOrphanRepository(dependencies.transactions, dependencies.storage),
    ...(dependencies.settings === undefined ? {} : { settings: dependencies.settings }),
  });
  return Object.freeze({ runOnce: () => service.runOnce() });
}
