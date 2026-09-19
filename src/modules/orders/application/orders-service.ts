import type {
  OrderAuditTrail,
  OrdersList,
  OrderSummary,
  PortalOrdersResponse,
  PortalOrdersTab,
  TransitionOrderCommand,
  TransitionOrderResult,
  CreateOrderCommand,
  CreateOrderResult,
  DraftOrder,
  UpdateDraftOrderCommand,
  UpdateDraftOrderResult,
  OrderRolesResponse,
} from '../api/contracts.ts';
import type {
  CreateOrderAuthorization,
  LegacyOrderRecord,
  OrdersRepository,
  OrderResourceAuthorization,
  PortalOrdersAuthorization,
  TaxRegime,
  TenantOrderRecord,
  TransitionOrderAuthorization,
} from './orders-repository.ts';

const PORTAL_TABS: readonly PortalOrdersTab[] = ['mine', 'to_validate', 'to_approve', 'to_produce'];

export class OrdersService {
  constructor(private readonly repository: OrdersRepository) {}

  async listTenantOrders(tenantId: string, shopIds: readonly string[]): Promise<OrdersList> {
    const taxRate = taxRateFor(await this.repository.getTenantTaxRegime(tenantId));
    const [legacy, tenant] = await Promise.all([
      this.repository.listLegacyOrders(shopIds),
      this.repository.listTenantOrders(tenantId),
    ]);
    return { orders: sortOrders([...legacy.map(toLegacySummary), ...tenant.map((order) => toTenantSummary(order, taxRate))]) };
  }

  /**
   * MAJEUR 4 (qa-review round 1), CORRIGÉ round 3 — `listPortalOrders` est
   * une surface ACHETEUR DE BOUT EN BOUT, les DEUX branches
   * d'autorisation confondues. Vérifié par grep exhaustif (round 3) :
   * `OrdersApiClient.listPortalOrders` n'a que deux appelants dans tout le
   * dépôt, `useStorefrontOrderList.ts` et `useStorefrontOrderLifecycle.ts`
   * — tous deux des hooks acheteur. L'atelier n'appelle JAMAIS cette
   * méthode : il utilise `listTenantOrders`. La branche `magrit_user`
   * (ci-dessous) ne se déclenche pas pour un membre de l'atelier, mais
   * pour l'acheteur titulaire d'un compte Magrit SANS cookie de session
   * boutique valide — précisément le cas d'un valideur/approbateur de
   * l'organisation cliente, celui pour qui les onglets `to_validate`/
   * `to_approve` existent. `hideUnverifiedPriceMarkers` s'applique donc
   * sur la TOTALITÉ de la réponse, une seule fois, après construction des
   * quatre jeux de données — jamais une branche seulement.
   */
  async listPortalOrders(shopId: string, authorization: PortalOrdersAuthorization): Promise<PortalOrdersResponse> {
    const response = await this.buildPortalOrdersResponse(shopId, authorization);
    return {
      counters: response.counters,
      datasets: {
        mine: response.datasets.mine.map(hideUnverifiedPriceMarkers),
        to_validate: response.datasets.to_validate.map(hideUnverifiedPriceMarkers),
        to_approve: response.datasets.to_approve.map(hideUnverifiedPriceMarkers),
        to_produce: response.datasets.to_produce.map(hideUnverifiedPriceMarkers),
      },
    };
  }

  private async buildPortalOrdersResponse(shopId: string, authorization: PortalOrdersAuthorization): Promise<PortalOrdersResponse> {
    if (authorization.kind === 'storefront_session') {
      const storefront = await this.repository.getStorefrontPortalOrders(shopId, authorization.opaqueToken);
      const mine = sortOrders(storefront.orders.map((order) => toTenantSummary(order, taxRateFor(storefront.taxRegime))));
      return {
        counters: { mine: mine.length, to_validate: 0, to_approve: 0, to_produce: 0 },
        datasets: { mine, to_validate: [], to_approve: [], to_produce: [] },
      };
    }
    const userId = authorization.userId;
    const [counters, idsByTab, email] = await Promise.all([
      this.repository.getPortalCounters(shopId, userId),
      Promise.all(PORTAL_TABS.map((tab) => this.repository.getPortalOrderIds(shopId, userId, tab))),
      this.repository.getAuthenticatedUserEmail(),
    ]);
    const uniqueIds = Array.from(new Set(idsByTab.flat()));
    const [tenantOrders, legacy, taxRegime] = await Promise.all([
      this.repository.listTenantOrdersByIds(uniqueIds),
      this.repository.listLegacyOrders([shopId], email ?? undefined),
      this.repository.getShopTaxRegime(shopId),
    ]);
    const taxRate = taxRateFor(taxRegime);
    const byId = new Map(tenantOrders.map((order) => [order.id, toTenantSummary(order, taxRate)]));
    const dataset = (index: number) => idsByTab[index]?.flatMap((id) => {
      const order = byId.get(id);
      return order ? [order] : [];
    }) ?? [];

    return {
      counters,
      datasets: {
        mine: sortOrders([...legacy.map(toLegacySummary), ...dataset(0)]),
        to_validate: dataset(1),
        to_approve: dataset(2),
        to_produce: dataset(3),
      },
    };
  }

  async getAuditTrail(orderId: string, authorization: OrderResourceAuthorization = { storefrontToken: null }): Promise<OrderAuditTrail> {
    const events = await this.repository.listAuditEvents(orderId, authorization);
    return {
      events: events.map((event) => ({
        eventId: event.eventId,
        orderId: event.orderId,
        kind: event.kind === 'role' ? 'role' : 'status',
        eventType: event.eventType,
        actorId: event.actorId,
        actorEmail: event.actorEmail,
        shopCustomerAccountId: event.shopCustomerAccountId,
        actedByMagritUserId: event.actedByMagritUserId,
        roleName: event.roleName,
        payload: { ...event.payload },
        occurredAt: event.occurredAt,
      })),
    };
  }

  async transition(
    orderId: string,
    command: TransitionOrderCommand,
    authorization: TransitionOrderAuthorization,
    baseUrl: string,
  ): Promise<TransitionOrderResult> {
    const result = await this.repository.transitionOrder(orderId, command, authorization);
    if (!result.replayed) {
      void this.repository.notifyTransition(result, authorization.magritUserId, baseUrl).catch((error) => {
        console.warn('[OrdersService] notification de transition ignorée:', error);
      });
    }
    return result;
  }

  async create(command: CreateOrderCommand, baseUrl: string, authorization: CreateOrderAuthorization = { kind: 'magrit_user' }): Promise<CreateOrderResult> {
    const result = await this.repository.createOrder(command, authorization);
    if (!result.replayed) {
      void this.repository.notifyOrderCreated(result, baseUrl).catch((error) => {
        console.warn('[OrdersService] notification de création ignorée:', error);
      });
    }
    return result;
  }

  getDraft(orderId: string, authorization: OrderResourceAuthorization = { storefrontToken: null }): Promise<DraftOrder> {
    return this.repository.getDraftOrder(orderId, authorization);
  }

  updateDraft(orderId: string, command: UpdateDraftOrderCommand, authorization: OrderResourceAuthorization = { storefrontToken: null }): Promise<UpdateDraftOrderResult> {
    return this.repository.updateDraftOrder(orderId, command, authorization);
  }

  getRoles(orderId: string): Promise<OrderRolesResponse> {
    return this.repository.getOrderRoles(orderId);
  }
}

function toLegacySummary(order: LegacyOrderRecord): OrderSummary {
  return {
    id: order.id, shopId: order.shopId, source: 'legacy', createdAt: order.createdAt,
    customerName: order.customerName ?? '—', customerEmail: order.customerEmail ?? '',
    // Q17-c (point 12 (h)) — la cohorte legacy `shop_orders` n a jamais porté
    // la notion de prix vérifié : `priceOrigin` reste `null`, `hasUnverifiedPrices`
    // reste `false` (ni pastille ni acquittement pour ces commandes).
    items: order.items.map((item) => ({ ...item, priceOrigin: null })),
    totalHt: order.totalHt, totalTtc: order.totalTtc, status: order.status,
    hasUnverifiedPrices: false,
  };
}

function toTenantSummary(order: TenantOrderRecord, taxRate: number): OrderSummary {
  return {
    id: order.id, shopId: order.shopId, source: 'v1_1', createdAt: order.createdAt,
    customerName: order.customerName ?? '—', customerEmail: order.customerEmail ?? '',
    items: [...order.items], totalHt: order.totalHt,
    totalTtc: order.totalHt * (1 + taxRate), status: order.status,
    hasUnverifiedPrices: order.hasUnverifiedPrices,
  };
}

/**
 * MAJEUR 4 (qa-review round 1, corrigé round 3) — neutralise
 * `price_origin`/`hasUnverifiedPrices` avant de servir une commande à
 * l acheteur. Appliquée sur la TOTALITÉ de `listPortalOrders` (les deux
 * branches d autorisation, les quatre jeux de données) : voir le
 * commentaire de `listPortalOrders` pour la preuve que cette route entière
 * est une surface acheteur, jamais atelier. Exportée pour être testée
 * directement.
 *
 * TROISIÈME CHEMIN, NOMMÉ ET LAISSÉ OUVERT (round 3, pas une régression de
 * ce lot — elle vient de Q17-a) : `getDraftOrder`/`draftOrderSchema`
 * exposent aussi `priceOrigin` (non nullable) et `hasUnverifiedPrices`, et
 * `GET /api/v1/orders/{orderId}/draft` est appelé par trois hooks
 * acheteur, vérifié par grep exhaustif (round 3) : `useStorefrontOrderLifecycle.ts`,
 * `useStorefrontOrderEditor.ts`, `useStorefrontOrderReceipt.ts`. Ce lot ne
 * le ferme pas — périmètre de Q17-c limité à `OrderSummary`/`listPortalOrders`
 * — et ne le classe pas sous « corrigé ».
 */
export function hideUnverifiedPriceMarkers(order: OrderSummary): OrderSummary {
  return {
    ...order,
    hasUnverifiedPrices: false,
    items: order.items.map((item) => ({ ...item, priceOrigin: null })),
  };
}

function sortOrders(orders: OrderSummary[]): OrderSummary[] {
  return orders.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function taxRateFor(regime: TaxRegime | null): number {
  if (regime === 'dom_tom') return 0.085;
  if (regime === 'franchise_tva' || regime === 'export_eu' || regime === 'export_world') return 0;
  return 0.2;
}
