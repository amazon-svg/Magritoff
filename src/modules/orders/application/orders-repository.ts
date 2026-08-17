import type { UserId } from '../../../kernel/ids/index.ts';
import type { PortalOrdersCounters, PortalOrdersTab } from '../api/contracts.ts';
import type {
  CreateOrderCommand,
  CreateOrderResult,
  DraftOrder,
  UpdateDraftOrderCommand,
  UpdateDraftOrderResult,
  OrderRolesResponse,
  TransitionOrderCommand,
  TransitionOrderResult,
} from '../api/contracts.ts';

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

export type OrderCommandRejectionCode =
  | 'order_not_found'
  | 'shop_not_found'
  | 'invalid_order_items'
  | 'order_not_editable'
  | 'transition_not_allowed'
  | 'permission_denied';

export type CreateOrderAuthorization =
  | Readonly<{ kind: 'magrit_user' }>
  | Readonly<{ kind: 'storefront_session'; opaqueToken: string }>;

export type PortalOrdersAuthorization =
  | Readonly<{ kind: 'magrit_user'; userId: UserId }>
  | Readonly<{ kind: 'storefront_session'; opaqueToken: string }>;

export type StorefrontPortalOrdersRecord = Readonly<{
  orders: readonly TenantOrderRecord[];
  taxRegime: TaxRegime | null;
}>;

export class OrderCommandRejectedError extends Error {
  constructor(
    public readonly code: OrderCommandRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'OrderCommandRejectedError';
  }
}

export interface OrdersRepository {
  getTenantTaxRegime(tenantId: string): Promise<TaxRegime | null>;
  getShopTaxRegime(shopId: string): Promise<TaxRegime | null>;
  listTenantOrders(tenantId: string): Promise<readonly TenantOrderRecord[]>;
  listTenantOrdersByIds(orderIds: readonly string[]): Promise<readonly TenantOrderRecord[]>;
  listLegacyOrders(shopIds: readonly string[], customerEmail?: string): Promise<readonly LegacyOrderRecord[]>;
  getPortalCounters(shopId: string, userId: UserId): Promise<PortalOrdersCounters>;
  getPortalOrderIds(shopId: string, userId: UserId, tab: PortalOrdersTab): Promise<readonly string[]>;
  getAuthenticatedUserEmail(): Promise<string | null>;
  getStorefrontPortalOrders(shopId: string, opaqueToken: string): Promise<StorefrontPortalOrdersRecord>;
  listAuditEvents(orderId: string): Promise<readonly AuditEventRecord[]>;
  transitionOrder(orderId: string, command: TransitionOrderCommand): Promise<TransitionOrderResult>;
  notifyTransition(
    result: TransitionOrderResult,
    actorUserId: UserId,
    baseUrl: string,
  ): Promise<void>;
  createOrder(command: CreateOrderCommand, authorization: CreateOrderAuthorization): Promise<CreateOrderResult>;
  notifyOrderCreated(result: CreateOrderResult, baseUrl: string): Promise<void>;
  getDraftOrder(orderId: string): Promise<DraftOrder>;
  updateDraftOrder(orderId: string, command: UpdateDraftOrderCommand): Promise<UpdateDraftOrderResult>;
  getOrderRoles(orderId: string): Promise<OrderRolesResponse>;
}
