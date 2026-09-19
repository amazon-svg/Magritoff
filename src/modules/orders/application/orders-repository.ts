import type { UserId } from '../../../kernel/ids/index.ts';
import type { PortalOrdersCounters, PortalOrdersTab } from '../api/contracts.ts';
import type {
  CreateOrderCommand,
  CreateOrderResult,
  DraftOrder,
  UpdateDraftOrderCommand,
  UpdateDraftOrderResult,
  OrderRolesResponse,
  PriceOrigin,
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
  customerName: string | null;
  customerEmail: string | null;
  items: readonly Readonly<{
    name: string;
    quantity: number;
    unitPriceHt: number;
    /** Q17-c (point 12 (h)) — `null` sur un chemin qui ne l a pas encore renseigné. */
    priceOrigin: PriceOrigin | null;
  }>[];
  totalHt: number;
  status: string;
  /** Q17-c (point 12 (h)) — miroir de `tenant_orders.has_unverified_prices`. */
  hasUnverifiedPrices: boolean;
}>;

export type AuditEventRecord = Readonly<{
  eventId: string;
  orderId: string;
  kind: string;
  eventType: string;
  actorId: string | null;
  actorEmail: string | null;
  shopCustomerAccountId: string | null;
  actedByMagritUserId: string | null;
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
  | 'permission_denied'
  /** Q17-a (point 12 (b)) — le product_id d une ligne n appartient pas au catalogue de la boutique. */
  | 'product_not_in_shop'
  /** Q17-a (point 12 (d)) — le prix recalculé par le serveur diffère du prix soumis. */
  | 'price_changed'
  /** Q17-a (point 12 (c)) — une ligne `client_unverified` bloque `draft -> validated` sans acquittement. */
  | 'unverified_prices';

/**
 * Q17-a (point 12 (d)) — une entrée par ligne dont le prix a changé entre
 * l affichage et la validation. `submitted`/`current` sont déjà en `Money`
 * (chaîne décimale), tels que le serveur les a produits.
 */
export type PriceMismatchDetail = Readonly<{
  productLabel: string;
  submitted: string;
  current: string;
}>;

export type CreateOrderAuthorization =
  | Readonly<{ kind: 'magrit_user' }>
  | Readonly<{ kind: 'storefront_session'; opaqueToken: string }>;

export type PortalOrdersAuthorization =
  | Readonly<{ kind: 'magrit_user'; userId: UserId }>
  | Readonly<{ kind: 'storefront_session'; opaqueToken: string }>;

export type OrderResourceAuthorization = Readonly<{
  storefrontToken: string | null;
}>;

export type TransitionOrderAuthorization = Readonly<{
  storefrontToken: string | null;
  magritUserId: UserId | null;
}>;

export type StorefrontPortalOrdersRecord = Readonly<{
  orders: readonly TenantOrderRecord[];
  taxRegime: TaxRegime | null;
}>;

export class OrderCommandRejectedError extends Error {
  constructor(
    public readonly code: OrderCommandRejectionCode,
    message: string,
    /** Q17-a — renseigné seulement pour `price_changed` (point 12 (d)). */
    public readonly priceMismatches: readonly PriceMismatchDetail[] = [],
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
  listAuditEvents(orderId: string, authorization: OrderResourceAuthorization): Promise<readonly AuditEventRecord[]>;
  transitionOrder(orderId: string, command: TransitionOrderCommand, authorization: TransitionOrderAuthorization): Promise<TransitionOrderResult>;
  notifyTransition(
    result: TransitionOrderResult,
    actorUserId: UserId | null,
    baseUrl: string,
  ): Promise<void>;
  createOrder(command: CreateOrderCommand, authorization: CreateOrderAuthorization): Promise<CreateOrderResult>;
  notifyOrderCreated(result: CreateOrderResult, baseUrl: string): Promise<void>;
  getDraftOrder(orderId: string, authorization: OrderResourceAuthorization): Promise<DraftOrder>;
  updateDraftOrder(orderId: string, command: UpdateDraftOrderCommand, authorization: OrderResourceAuthorization): Promise<UpdateDraftOrderResult>;
  getOrderRoles(orderId: string): Promise<OrderRolesResponse>;
}
