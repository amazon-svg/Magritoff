/**
 * Port du drain de GENERATION des exports (story E10.18c) — distinct de
 * `OrderExportsRepository` (facade HTTP, client `authenticated`) : ce port
 * n est appele QUE par le runner (`magrit-order-export-runner`), sous
 * `service_role`, exactement comme `NotificationSendRepository` (E10.15c)
 * est distinct de `NotificationLogsRepository` (lecture HTTP).
 */
import type { TenantId } from '../../../kernel/ids/index.ts';
import type { OrderExportFiltersDto, OrderExportFormat, OrderExportGranularity } from '../api/contracts.ts';
import type { OrderExportRawRow } from './order-export-columns.ts';

export type ClaimedOrderExport = Readonly<{
  id: string;
  tenantId: TenantId;
  format: OrderExportFormat;
  granularity: OrderExportGranularity;
  /** Filtres ENREGISTRES (contrat : "le generateur ne recoit jamais de criteres, il lit ceux qui sont enregistres") — utilises ICI seulement pour NOMMER le fichier. */
  filters: OrderExportFiltersDto;
}>;

export type OrderExportRunSettings = Readonly<{
  limit: number;
  maxAttempts: number;
  maxAgeSeconds: number;
}>;

export const DEFAULT_ORDER_EXPORT_RUN_SETTINGS: OrderExportRunSettings = Object.freeze({
  // Plus PETIT que le drain de notification (25) : une generation est
  // memoire/CPU-intensive (contrat §8.24 point 4/7), un lot borne PROTEGE
  // les autres exports en file d un isolat qui deraperait sur un seul.
  limit: 5,
  maxAttempts: 3,
  maxAgeSeconds: 15 * 60,
});

export type OrderExportRowsPage = Readonly<{
  rows: readonly OrderExportRawRow[];
  /** Curseur opaque a retransmettre tel quel au prochain appel ; `null` -> derniere page atteinte. */
  nextAfter: unknown | null;
}>;

export type MarkOrderExportReadyParams = Readonly<{
  rowCount: number;
  storagePath: string;
  fileName: string;
  byteSize: number;
  sha256: string;
  contentType: string;
  completedAt: string;
  expiresAt: string;
}>;

export interface OrderExportRunRepository {
  /** Reclamation atomique (`api_claim_order_exports`, `for update skip locked`). */
  claim(settings: OrderExportRunSettings): Promise<readonly ClaimedOrderExport[]>;

  /**
   * Page de lignes via `api_read_order_export_rows` — LE SEUL chemin, jamais
   * un `from()` sur une vue `private` (contrat §8.24 point 4/5). `after`
   * transmis tel quel, jamais interprete cote application.
   */
  readRows(exportId: string, after: unknown | null, limit: number): Promise<OrderExportRowsPage>;

  markReady(id: string, params: MarkOrderExportReadyParams): Promise<void>;

  /** `completedAt` explicite : un echec est aussi un VERDICT, il porte un instant. */
  markFailed(id: string, code: string, detail: string, completedAt: string): Promise<void>;
}
