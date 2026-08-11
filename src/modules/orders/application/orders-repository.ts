import type { UserId } from '../../../kernel/ids/index.ts';
import type { PortalOrdersCounters, PortalOrdersTab } from '../api/contracts.ts';

export type TaxRegime =
  | 'metropole_fr'
  | 'dom_tom'
  | 'franchise_tva'
  | 'export_eu'
  | 'export_world';

export type LegacyOrderRecord = Readonly<{
  id: string;
  shopId: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  items: readonly Readonly<{ name: string; quantity: number; unitPriceHt: number }>[];
  totalHt: number;
  totalTtc: number;
  status: string;
}>;

export type TenantOrderRecord = Readonly<{
  id: string;
  shopId: string;
  createdAt: string;
  items: readonly Readonly<{ name: string; quantity: number; unitPriceHt: number }>[];
  totalHt: number;
  status: string;
}>;

export type AuditEventRecord = Readonly<{
  eventId: string;
  orderId: string;
  kind: string;
  eventType: string;
  actorId: string | null;
  actorEmail: string | null;
  roleName: string | null;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

export interface OrdersRepository {
  getTenantTaxRegime(tenantId: string): Promise<TaxRegime | null>;
  getShopTaxRegime(shopId: string): Promise<TaxRegime | null>;
  listTenantOrders(tenantId: string): Promise<readonly TenantOrderRecord[]>;
  listTenantOrdersByIds(orderIds: readonly string[]): Promise<readonly TenantOrderRecord[]>;
  listLegacyOrders(shopIds: readonly string[], customerEmail?: string): Promise<readonly LegacyOrderRecord[]>;
  getPortalCounters(shopId: string, userId: UserId): Promise<PortalOrdersCounters>;
  getPortalOrderIds(shopId: string, userId: UserId, tab: PortalOrdersTab): Promise<readonly string[]>;
  getAuthenticatedUserEmail(): Promise<string | null>;
  listAuditEvents(orderId: string): Promise<readonly AuditEventRecord[]>;
}
