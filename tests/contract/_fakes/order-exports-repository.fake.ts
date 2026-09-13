/**
 * Faux repository Exports de commandes (E10.18c), utilise par
 * `order-exports.contract.test.ts`. Reimplemente fidelement les regles
 * tenues EN BASE : capability par acteur, plafond de trois demandes non
 * terminees, `download_url` reserve au demandeur et au statut `ready`.
 */
import type { TenantId, UserId } from '@/kernel';
import type { OrderExportDto, OrderExportFiltersDto } from '@/modules/order-exports/api/contracts';
import {
  OrderExportAccessDeniedError,
  OrderExportPendingLimitReachedError,
  type ListOrderExportsFilters,
  type OrderExportsRepository,
  type RequestOrderExportParams,
} from '@/modules/order-exports/application/order-exports-repository';

let sequence = 0;
export function fakeExportUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9500-${String(sequence).padStart(12, '0')}`;
}

type StoredExport = {
  id: string;
  tenant_id: string;
  status: 'pending' | 'running' | 'ready' | 'failed' | 'expired';
  format: 'xlsx' | 'csv';
  granularity: 'order' | 'line';
  filters: OrderExportFiltersDto;
  layout_version: number;
  requested_by: string | null;
  requested_by_label: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  row_count: number | null;
  file_name: string | null;
  byte_size: number | null;
  sha256: string | null;
  content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'text/csv' | null;
  expires_at: string | null;
  attempts: number;
  error_code: string | null;
  error_detail: string | null;
};

export class InMemoryOrderExportsRepository implements OrderExportsRepository {
  private readonly exports = new Map<string, StoredExport>();
  /** Droit `can_export_orders` par tenant+acteur. `true` par defaut (equivalent d un admin). */
  private readonly actorCapabilities = new Map<string, boolean>();

  /** TEST UNIQUEMENT. */
  setActorCapabilityForTest(tenantId: string, actorId: string, capability: string, granted: boolean | null): void {
    const key = `${tenantId}:${actorId}:${capability}`;
    if (granted === null) this.actorCapabilities.delete(key);
    else this.actorCapabilities.set(key, granted);
  }

  /** TEST UNIQUEMENT — seed direct, sans passer par `request()`. */
  seedForTest(overrides: Partial<StoredExport> & { id: string; tenant_id: string; requested_by: string }): void {
    const now = new Date().toISOString();
    const row: StoredExport = {
      status: 'pending',
      format: 'csv',
      granularity: 'order',
      filters: {},
      layout_version: 1,
      requested_by_label: 'demandeur@example.test',
      requested_at: now,
      started_at: null,
      completed_at: null,
      row_count: null,
      file_name: null,
      byte_size: null,
      sha256: null,
      content_type: null,
      expires_at: null,
      attempts: 0,
      error_code: null,
      error_detail: null,
      ...overrides,
    };
    this.exports.set(row.id, row);
  }

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.actorCapabilities.get(`${tenantId}:${actorId}:${capability}`) ?? true;
  }

  async list(
    tenantId: TenantId,
    actor: UserId,
    filters: ListOrderExportsFilters,
  ): Promise<readonly OrderExportDto[]> {
    const rows = [...this.exports.values()]
      .filter((row) => row.tenant_id === tenantId)
      .filter((row) => filters.status === null || row.status === filters.status)
      .filter((row) => filters.format === null || row.format === filters.format)
      .filter((row) => filters.granularity === null || row.granularity === filters.granularity)
      .sort((a, b) => (a.requested_at < b.requested_at ? 1 : a.requested_at > b.requested_at ? -1 : b.id.localeCompare(a.id)));

    const sliced = filters.cursor
      ? rows.filter(
          (row) =>
            row.requested_at < filters.cursor!.sort ||
            (row.requested_at === filters.cursor!.sort && row.id < filters.cursor!.id),
        )
      : rows;

    return sliced.slice(0, filters.size + 1).map((row) => this.toDto(row, actor));
  }

  async request(
    tenantId: TenantId,
    actor: UserId,
    params: RequestOrderExportParams,
  ): Promise<OrderExportDto> {
    const authorized = await this.actorHasCapability(tenantId, actor, 'can_export_orders');
    if (!authorized) throw new OrderExportAccessDeniedError();

    const pendingCount = [...this.exports.values()].filter(
      (row) => row.tenant_id === tenantId && row.requested_by === actor && (row.status === 'pending' || row.status === 'running'),
    ).length;
    if (pendingCount >= 3) throw new OrderExportPendingLimitReachedError();

    const now = new Date().toISOString();
    const row: StoredExport = {
      id: fakeExportUuid(),
      tenant_id: tenantId,
      status: 'pending',
      format: params.format,
      granularity: params.granularity,
      filters: params.filters,
      layout_version: 1,
      requested_by: actor,
      requested_by_label: `${actor}@example.test`,
      requested_at: now,
      started_at: null,
      completed_at: null,
      row_count: null,
      file_name: null,
      byte_size: null,
      sha256: null,
      content_type: null,
      expires_at: null,
      attempts: 0,
      error_code: null,
      error_detail: null,
    };
    this.exports.set(row.id, row);
    return this.toDto(row, actor);
  }

  async findById(tenantId: TenantId, actor: UserId, exportId: string): Promise<OrderExportDto | null> {
    const row = this.exports.get(exportId);
    if (!row || row.tenant_id !== tenantId) return null;
    return this.toDto(row, actor);
  }

  private toDto(row: StoredExport, actor: UserId): OrderExportDto {
    const isOwnerReady = row.status === 'ready' && row.requested_by === actor;
    return {
      id: row.id,
      status: row.status,
      format: row.format,
      granularity: row.granularity,
      filters: row.filters,
      layout_version: row.layout_version,
      requested_by: row.requested_by,
      requested_by_label: row.requested_by_label,
      requested_at: row.requested_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      row_count: row.row_count,
      file_name: row.file_name,
      byte_size: row.byte_size,
      sha256: row.sha256,
      content_type: row.content_type,
      download_url: isOwnerReady ? `https://storage.test/order_exports/${row.id}.${row.format}` : null,
      download_url_expires_at: isOwnerReady ? new Date(Date.now() + 300_000).toISOString() : null,
      expires_at: row.expires_at,
      attempts: row.attempts,
      error_code: row.error_code,
      error_detail: row.error_detail,
    };
  }
}
