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

  /**
   * QUATRIÈME CHEMIN DE FUITE ACHETEUR (qa-review round 5), corrigé —
   * `GET /orders/{orderId}/audit`, branche `storefront_session`
   * (`api_get_order_audit_for_identity`, `supabase/migrations/20260817000500_storefront_order_audit.sql`),
   * rend `tenant_order_status_events.metadata` VERBATIM dans `payload`. Q17-a
   * y écrit, sur toute transition qui quitte un `draft` marqué,
   * `acknowledged_unverified_prices` et surtout `acknowledged_line_labels` —
   * la LISTE NOMINATIVE des lignes que le serveur n'a pas su vérifier.
   * Scénario : l'atelier valide en acquittant, l'acheteur ouvre le bouton
   * « Historique » sur SA PROPRE commande (`PortalOrders.tsx` →
   * `OrderAuditTrailModal` → cette méthode), et la réponse JSON énumère ses
   * propres lignes douteuses par leur nom. C'est strictement plus que le
   * `priceOrigin` déjà masqué par `hideUnverifiedPriceMarkers` : celui-là
   * disait « cette ligne est douteuse », celui-ci les nomme.
   *
   * La plomberie SQL date de Q17-a et la projection de cette RPC du
   * 2026-08-17 : ce n'est pas une régression de Q17-c. Mais cette métadonnée
   * n'existe que parce qu'on peut acquitter, et acquitter n'est atteignable
   * que depuis ce lot — comme pour Q19, c'est ce lot qui ouvre le robinet.
   *
   * Corrigé ICI, en TypeScript, sans nouvelle migration ni redéploiement
   * d'Edge Function.
   *
   * CE QUE `authorization.storefrontToken !== null` N'EST PAS (qa-review
   * round 6, corrigé) — j'avais écrit que ce prédicat était « EXACTEMENT »
   * la condition testée par la RPC. C'est FAUX, et c'est la troisième fois
   * dans ce lot qu'un masquage se justifiait par une lecture erronée de
   * « quelle branche sert qui » (round 2 : `magrit_user` dit « atelier »,
   * faux, une vraie fuite ; round 3 : corrigé). Le `if p_opaque_token is not
   * null` (ligne ~31 de la migration) ne garde que la TENTATIVE de
   * résolution de session. Le VRAI choix de branche, aux lignes ~44-48, est :
   *
   *   v_storefront_allowed := v_session_account_id is not null
   *     and v_session_account_id = v_order.shop_customer_account_id
   *     and v_session_shop_id    = v_order.shop_id;
   *
   * Trois conditions côté SQL (session résolue ET compte de LA commande ET
   * boutique de LA commande), une seule côté façade (session résolue,
   * n'importe laquelle). `authorization.storefrontToken !== null` est donc
   * un SUR-ENSEMBLE STRICT, délibérément assumé de ce côté-ci (sûr : on ne
   * sert jamais l'acheteur sans masquer) mais pas de l'autre.
   *
   * CONSÉQUENCE NOMMÉE : `orderResourceAuthorization` (`orders-routes.ts`)
   * pose `storefrontToken` dès qu'UNE session boutique valide existe dans le
   * cookie (`path: '/'`, donc envoyé sur toute requête de même origine), SANS
   * vérifier qu'elle correspond à LA commande consultée ni à son propriétaire.
   * Un membre de l'atelier qui a AUSSI une session boutique ouverte dans le
   * même navigateur — cas ordinaire : le smoke E2E de la DoD l'impose, le
   * pilote ERAM l'impose — et qui clique « Historique » sur une commande
   * qu'IL a lui-même validée en acquittant reçoit de la RPC la branche
   * atelier (métadonnées complètes), mais cette façade les masque quand même
   * (le cookie fait passer `storefrontToken !== null`). Il ne peut alors plus
   * relire ce qu'il a acquitté, sans aucun signal — c'est la traçabilité que
   * le point 12 (c) du cadrage exige.
   *
   * TRANCHÉ : le sur-masquage reste tel quel dans ce lot (voir test dédié
   * ci-dessous, qui l'épingle comme un comportement CHOISI). Le chemin de
   * mise en conformité, si ce compromis est jugé inacceptable, passe par la
   * RPC elle-même : lui faire RENDRE la branche qu'elle a réellement prise
   * (un discriminant explicite dans son résultat) plutôt que de la deviner
   * côté façade à partir d'un signal plus large qu'elle. C'est une migration
   * SQL, donc hors du périmètre front-only déclaré de ce lot — je ne la fais
   * pas ici, je la nomme.
   */
  async getAuditTrail(orderId: string, authorization: OrderResourceAuthorization = { storefrontToken: null }): Promise<OrderAuditTrail> {
    const events = await this.repository.listAuditEvents(orderId, authorization);
    const isBuyerBranch = authorization.storefrontToken !== null;
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
        payload: isBuyerBranch ? hideAcknowledgedPriceMetadata(event.payload) : { ...event.payload },
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

/**
 * QUATRIÈME CHEMIN DE FUITE ACHETEUR (qa-review round 5) — retire
 * `acknowledged_unverified_prices`/`acknowledged_line_labels` de
 * `payload.metadata` avant de servir un événement d'audit à l'acheteur. Ces
 * deux clés n'existent que dans `tenant_order_status_events.metadata`
 * (Q17-a, transition `draft` → hors `draft` avec acquittement) ; tout le
 * reste de `payload`/`metadata` (statuts, raison, indicateurs internes non
 * nominatifs) n'est pas concerné et reste inchangé. Exportée pour être
 * testée directement.
 */
export function hideAcknowledgedPriceMetadata(
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const metadata = payload['metadata'];
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { ...payload };
  }
  const { acknowledged_unverified_prices: _ack, acknowledged_line_labels: _labels, ...restMetadata } =
    metadata as Record<string, unknown>;
  return { ...payload, metadata: restMetadata };
}

function sortOrders(orders: OrderSummary[]): OrderSummary[] {
  return orders.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function taxRateFor(regime: TaxRegime | null): number {
  if (regime === 'dom_tom') return 0.085;
  if (regime === 'franchise_tva' || regime === 'export_eu' || regime === 'export_world') return 0;
  return 0.2;
}
