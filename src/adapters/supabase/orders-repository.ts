import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { PortalOrdersCounters, PortalOrdersTab } from '../../modules/orders/api/contracts.ts';
import type {
  CreateOrderCommand,
  CreateOrderResult,
  DraftOrder,
  TransitionOrderCommand,
  TransitionOrderResult,
  UpdateDraftOrderCommand,
  UpdateDraftOrderResult,
  OrderCapabilities,
  OrderRoleAssignment,
  OrderRolesResponse,
} from '../../modules/orders/api/contracts.ts';
import { OrderCommandRejectedError } from '../../modules/orders/application/orders-repository.ts';
import type {
  AuditEventRecord,
  CreateOrderAuthorization,
  LegacyOrderRecord,
  OrdersRepository,
  OrderResourceAuthorization,
  PriceMismatchDetail,
  TaxRegime,
  TenantOrderRecord,
  StorefrontPortalOrdersRecord,
  TransitionOrderAuthorization,
} from '../../modules/orders/application/orders-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

type UserScopedClient = SupabaseClient<Database>;
/**
 * Q17-c (point 12 (h)) — `has_unverified_prices` et `tenant_order_items.price_origin`
 * sont des colonnes ajoutées par la migration Q17-a
 * (`20260919000100_gescom_q17a_storefront_order_price_revaluation.sql`), pas
 * encore reflétées dans `database.types.ts` généré (déploiement Supabase
 * distinct de ce lot, front seul). Même convention que `customer_name`/
 * `customer_email` juste en dessous : type élargi à la main plutôt qu une
 * régénération qui exigerait un déploiement.
 */
type TenantOrderRow = Database['public']['Tables']['tenant_orders']['Row'] & {
  tenant_order_items?: Array<{
    product_label: string;
    quantity: number;
    unit_price_ht: number;
    price_origin?: string | null;
  }> | null;
  customer_name?: string | null;
  customer_email?: string | null;
  has_unverified_prices?: boolean | null;
};

const TENANT_ORDER_SELECTION =
  'id, shop_id, created_at, total_ht, status, has_unverified_prices, tenant_order_items(product_label, quantity, unit_price_ht, price_origin)';

export class SupabaseOrdersRepository implements OrdersRepository {
  constructor(private readonly client: UserScopedClient) {}

  async getTenantTaxRegime(tenantId: string): Promise<TaxRegime | null> {
    const { data, error } = await this.client.from('tenants').select('tax_regime').eq('id', tenantId).maybeSingle();
    if (error) throw new Error(`Lecture du régime fiscal impossible: ${error.message}`);
    return normalizeTaxRegime(data?.tax_regime);
  }

  async getShopTaxRegime(shopId: string): Promise<TaxRegime | null> {
    const { data: shop, error: shopError } = await this.client.from('shops').select('tenant_id').eq('id', shopId).maybeSingle();
    if (shopError) throw new Error(`Lecture de la boutique impossible: ${shopError.message}`);
    if (!shop?.tenant_id) return null;
    return this.getTenantTaxRegime(shop.tenant_id);
  }

  async listTenantOrders(tenantId: string): Promise<readonly TenantOrderRecord[]> {
    const { data, error } = await this.client.from('tenant_orders').select(TENANT_ORDER_SELECTION)
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    if (error) throw new Error(`Lecture des commandes tenant impossible: ${error.message}`);
    return this.withCustomerIdentities(data ?? []);
  }

  async listTenantOrdersByIds(orderIds: readonly string[]): Promise<readonly TenantOrderRecord[]> {
    if (orderIds.length === 0) return [];
    const { data, error } = await this.client.from('tenant_orders').select(TENANT_ORDER_SELECTION).in('id', [...orderIds]);
    if (error) throw new Error(`Lecture des commandes portail impossible: ${error.message}`);
    return this.withCustomerIdentities(data ?? []);
  }

  async listLegacyOrders(shopIds: readonly string[], customerEmail?: string): Promise<readonly LegacyOrderRecord[]> {
    if (shopIds.length === 0) return [];
    let query = this.client.from('shop_orders').select('*').in('shop_id', [...shopIds])
      .order('created_at', { ascending: false }).limit(100);
    if (customerEmail) query = query.eq('customer_email', customerEmail);
    const { data, error } = await query;
    if (error) throw new Error(`Lecture des commandes historiques impossible: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      shopId: row.shop_id,
      createdAt: row.created_at,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      items: parseLegacyItems(row.items),
      totalHt: row.total_ht,
      totalTtc: row.total_ttc,
      status: row.status,
    }));
  }

  async getPortalCounters(shopId: string, userId: UserId): Promise<PortalOrdersCounters> {
    const { data, error } = await this.client.rpc('get_portal_orders_counters', {
      p_shop_id: shopId, p_user_id: userId,
    });
    if (error) throw new Error(`Lecture des compteurs commandes impossible: ${error.message}`);
    const row = data?.[0];
    return {
      mine: row?.mine ?? 0,
      to_validate: row?.to_validate ?? 0,
      to_approve: row?.to_approve ?? 0,
      to_produce: row?.to_produce ?? 0,
    };
  }

  async getPortalOrderIds(shopId: string, userId: UserId, tab: PortalOrdersTab): Promise<readonly string[]> {
    const { data, error } = await this.client.rpc('get_portal_orders_workflow', {
      p_shop_id: shopId, p_tab: tab, p_user_id: userId,
    });
    if (error) throw new Error(`Lecture du workflow commandes impossible: ${error.message}`);
    return (data ?? []).map((row) => row.order_id);
  }

  async getAuthenticatedUserEmail(): Promise<string | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new Error(`Lecture de l identité impossible: ${error.message}`);
    return data.user?.email ?? null;
  }

  async getStorefrontPortalOrders(shopId: string, opaqueToken: string): Promise<StorefrontPortalOrdersRecord> {
    const { data, error } = await this.client.rpc('api_get_storefront_portal_orders', {
      p_shop_id: shopId,
      p_opaque_token: opaqueToken,
    });
    if (error) throw mapOrderCommandError(error.message, 'Lecture du portail boutique impossible');
    const result = toRecord(data);
    const rows = Array.isArray(result.orders) ? result.orders : [];
    return {
      orders: rows.map((row) => toTenantOrder(toRecord(row) as unknown as TenantOrderRow)),
      taxRegime: normalizeTaxRegime(typeof result.tax_regime === 'string' ? result.tax_regime : null),
    };
  }

  private async withCustomerIdentities(rows: readonly unknown[]): Promise<readonly TenantOrderRecord[]> {
    if (rows.length === 0) return [];
    const orderIds = rows.flatMap((row) => {
      const id = toRecord(row).id;
      return typeof id === 'string' ? [id] : [];
    });
    const { data, error } = await this.client.rpc('api_get_order_customer_identities', {
      p_order_ids: orderIds,
    });
    if (error) throw new Error(`Lecture des clients de commandes impossible: ${error.message}`);
    const identities = new Map((data ?? []).map((identity) => [identity.order_id, identity]));
    return rows.map((row) => {
      const typedRow = row as TenantOrderRow;
      const identity = identities.get(typedRow.id);
      return toTenantOrder({
        ...typedRow,
        customer_name: identity?.customer_name ?? null,
        customer_email: identity?.customer_email ?? null,
      });
    });
  }

  async listAuditEvents(orderId: string, authorization: OrderResourceAuthorization): Promise<readonly AuditEventRecord[]> {
    const { data, error } = await this.client.rpc('api_get_order_audit_for_identity', {
      p_order_id: orderId,
      p_opaque_token: authorization.storefrontToken,
    });
    if (error) throw mapOrderCommandError(error.message, 'Lecture de l audit impossible');
    return (data ?? []).map((row) => ({
      eventId: row.event_id,
      orderId: row.order_id,
      kind: row.kind,
      eventType: row.event_type,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      shopCustomerAccountId: row.shop_customer_account_id,
      actedByMagritUserId: row.acted_by_magrit_user_id,
      roleName: row.role_name,
      payload: toRecord(row.payload),
      occurredAt: row.occurred_at,
    }));
  }

  async transitionOrder(orderId: string, command: TransitionOrderCommand, authorization: TransitionOrderAuthorization): Promise<TransitionOrderResult> {
    const { data, error } = await this.client.rpc('api_transition_order_for_identity', {
      p_order_id: orderId,
      p_new_status_code: command.toStatus,
      p_reason: command.reason ?? null,
      p_idempotency_key: command.idempotencyKey,
      p_opaque_token: authorization.storefrontToken,
      p_acknowledge_unverified_prices: command.acknowledgeUnverifiedPrices ?? false,
    });
    if (error) {
      const message = error.message;
      // Q17-a (point 12 (d), (c)) — préfixes DISTINCTIFS vérifiés en PREMIER,
      // par `startsWith` et non `includes` : `product_label` porte un texte
      // choisi par l acheteur (`orders.price_changed`) et pourrait sinon
      // contenir accidentellement la sous-chaîne d un autre code
      // (`order_not_found`, etc.) et le faire classer à tort.
      if (message.startsWith('price_changed:')) {
        throw new OrderCommandRejectedError(
          'price_changed',
          'Le prix de certaines lignes a changé depuis leur dernière vérification.',
          parsePriceMismatches(message.slice('price_changed:'.length)),
        );
      }
      if (message.startsWith('unverified_prices:')) {
        throw new OrderCommandRejectedError('unverified_prices', message);
      }
      if (message.includes('order_not_found')) {
        throw new OrderCommandRejectedError('order_not_found', message);
      }
      if (message.includes('permission_denied')) {
        throw new OrderCommandRejectedError('permission_denied', message);
      }
      if (message.includes('transition_not_allowed') || message.includes('status_code_unknown')) {
        throw new OrderCommandRejectedError('transition_not_allowed', message);
      }
      throw new Error(`Transition de commande impossible: ${message}`);
    }
    const result = toRecord(data);
    const resultOrderId = result.order_id;
    const fromStatus = result.from_status;
    const toStatus = result.to_status;
    if (typeof resultOrderId !== 'string' || typeof fromStatus !== 'string' || typeof toStatus !== 'string') {
      throw new Error('La transition a retourné un résultat invalide.');
    }
    return {
      orderId: resultOrderId,
      fromStatus,
      toStatus,
      replayed: result.replayed === true,
    };
  }

  async notifyTransition(
    result: TransitionOrderResult,
    actorUserId: UserId | null,
    baseUrl: string,
  ): Promise<void> {
    const { error } = await this.client.functions.invoke('order-workflow-step', {
      body: {
        order_id: result.orderId,
        from_status: result.fromStatus,
        to_status: result.toStatus,
        actor_user_id: actorUserId,
        base_url: baseUrl,
      },
    });
    if (error) throw new Error(`Notification workflow impossible: ${error.message}`);
  }

  async createOrder(command: CreateOrderCommand, authorization: CreateOrderAuthorization): Promise<CreateOrderResult> {
    const parameters = {
      p_shop_id: command.shopId,
      p_currency: command.currency,
      p_notes: command.notes,
      // Q17-a (point 12 (f)) — le serveur ne prétend écrire aucun prix
      // ferme pour une ligne catalogue : il compare `expectedUnitPriceHt`
      // (ce que l acheteur a vu) au prix qu il recalcule lui-même, et ne
      // l écrit que pour une ligne `client_unverified`. La clé JSON envoyée
      // à la RPC reste `unit_price_ht` : c est un `numeric` côté SQL, une
      // chaîne décimale s y caste exactement comme un nombre.
      p_items: command.items.map((item) => ({
        product_id: item.productId,
        product_label: item.productLabel,
        clariprint_options: item.clariprintOptions,
        quantity: item.quantity,
        unit_price_ht: item.expectedUnitPriceHt,
      })),
      p_idempotency_key: command.idempotencyKey,
    };
    const { data, error } = authorization.kind === 'storefront_session'
      ? await this.client.rpc('api_create_storefront_order', { ...parameters, p_opaque_token: authorization.opaqueToken })
      : await this.client.rpc('api_create_tenant_order', parameters);
    if (error) throw mapOrderCommandError(error.message, 'Création de commande impossible');
    const result = toRecord(data);
    if (
      typeof result.order_id !== 'string' || typeof result.tenant_id !== 'string'
      || typeof result.shop_id !== 'string' || (typeof result.total_ht !== 'number' && typeof result.total_ht !== 'string')
      || typeof result.currency !== 'string'
    ) throw new Error('La création de commande a retourné un résultat invalide.');
    return {
      orderId: result.order_id,
      tenantId: result.tenant_id,
      shopId: result.shop_id,
      totalHt: toMoneyString(result.total_ht),
      currency: result.currency,
      replayed: result.replayed === true,
    };
  }

  async notifyOrderCreated(result: CreateOrderResult, baseUrl: string): Promise<void> {
    const { error } = await this.client.functions.invoke('send-order-notification', {
      body: {
        order_id: result.orderId,
        tenant_id: result.tenantId,
        shop_id: result.shopId,
        total_ht: result.totalHt,
        currency: result.currency,
        base_url: baseUrl,
      },
    });
    if (error) throw new Error(`Notification de création impossible: ${error.message}`);
  }

  async getDraftOrder(orderId: string, authorization: OrderResourceAuthorization): Promise<DraftOrder> {
    const { data, error } = await this.client.rpc('api_get_order_draft_for_identity', {
      p_order_id: orderId,
      p_opaque_token: authorization.storefrontToken,
    });
    if (error) throw mapOrderCommandError(error.message, 'Lecture du brouillon impossible');
    const result = toRecord(data);
    const items = Array.isArray(result.items) ? result.items.map((value) => {
      const item = toRecord(value);
      if (
        typeof item.id !== 'string' || typeof item.product_label !== 'string'
        || typeof item.quantity !== 'number'
        || (typeof item.unit_price_ht !== 'number' && typeof item.unit_price_ht !== 'string')
        || (typeof item.line_total_ht !== 'number' && typeof item.line_total_ht !== 'string')
        || !isPriceOrigin(item.price_origin)
      ) throw new Error('Le brouillon a retourné une ligne invalide.');
      return {
        id: item.id,
        productId: typeof item.product_id === 'string' ? item.product_id : null,
        productLabel: item.product_label,
        clariprintOptions: (item.clariprint_options ?? null) as DraftOrder['items'][number]['clariprintOptions'],
        quantity: item.quantity,
        unitPriceHt: toMoneyString(item.unit_price_ht),
        lineTotalHt: toMoneyString(item.line_total_ht),
        priceOrigin: item.price_origin,
      };
    }) : [];
    if (
      typeof result.order_id !== 'string' || typeof result.status !== 'string'
      || typeof result.created_at !== 'string'
      || (typeof result.total_ht !== 'number' && typeof result.total_ht !== 'string')
      || typeof result.has_unverified_prices !== 'boolean'
    ) throw new Error('Le brouillon a retourné un résultat invalide.');
    return {
      orderId: result.order_id,
      status: result.status,
      createdAt: result.created_at,
      totalHt: toMoneyString(result.total_ht),
      hasUnverifiedPrices: result.has_unverified_prices,
      items,
    };
  }

  async updateDraftOrder(
    orderId: string,
    command: UpdateDraftOrderCommand,
    authorization: OrderResourceAuthorization,
  ): Promise<UpdateDraftOrderResult> {
    const { data, error } = await this.client.rpc('api_update_order_draft_for_identity', {
      p_order_id: orderId,
      p_opaque_token: authorization.storefrontToken,
      // Q17-a (point 12 (e)) — ni `product_id` ni `clariprint_options` :
      // l identité catalogue de la ligne n est pas resoumise, elle reste
      // celle déjà en base (contrat `updateDraftOrderItemSchema`).
      p_items: command.items.map((item) => ({
        id: item.id,
        product_label: item.productLabel,
        quantity: item.quantity,
        unit_price_ht: item.expectedUnitPriceHt,
      })),
      p_idempotency_key: command.idempotencyKey,
    });
    if (error) throw mapOrderCommandError(error.message, 'Édition du brouillon impossible');
    const result = toRecord(data);
    if (
      typeof result.order_id !== 'string'
      || (typeof result.total_ht !== 'number' && typeof result.total_ht !== 'string')
    ) {
      throw new Error('L édition du brouillon a retourné un résultat invalide.');
    }
    return {
      orderId: result.order_id,
      totalHt: toMoneyString(result.total_ht),
      replayed: result.replayed === true,
    };
  }

  async getOrderRoles(orderId: string): Promise<OrderRolesResponse> {
    const { data, error } = await this.client.rpc('api_get_tenant_order_roles', {
      p_order_id: orderId,
    });
    if (error) throw mapOrderCommandError(error.message, 'Lecture des rôles Orders impossible');
    const result = toRecord(data);
    const roles: OrderRoleAssignment[] = Array.isArray(result.roles) ? result.roles.map((value) => {
      const role = toRecord(value);
      if (
        typeof role.assignment_id !== 'string' || typeof role.role_definition_id !== 'string'
        || typeof role.name !== 'string' || typeof role.notify_policy !== 'string'
        || typeof role.ordering_index !== 'number'
      ) throw new Error('Les rôles Orders ont retourné une assignation invalide.');
      return {
        assignmentId: role.assignment_id,
        roleDefinitionId: role.role_definition_id,
        name: role.name,
        capabilities: toRecord(role.capabilities) as OrderRoleAssignment['capabilities'],
        notifyPolicy: role.notify_policy as OrderRoleAssignment['notifyPolicy'],
        orderingIndex: role.ordering_index,
      };
    }) : [];
    if (typeof result.is_creator !== 'boolean') {
      throw new Error('Les rôles Orders ont retourné un résultat invalide.');
    }
    return {
      roles,
      capabilities: toRecord(result.capabilities) as OrderCapabilities,
      isCreator: result.is_creator,
    };
  }
}

function toTenantOrder(row: TenantOrderRow): TenantOrderRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    createdAt: row.created_at,
    customerName: row.customer_name ?? null,
    customerEmail: row.customer_email ?? null,
    totalHt: row.total_ht,
    status: row.status,
    // Q17-c (point 12 (h)) — commande antérieure à Q17-a (colonne absente
    // côté RPC/lecture directe selon le chemin) : repli sur `false`, jamais
    // une valeur inventée.
    hasUnverifiedPrices: row.has_unverified_prices ?? false,
    items: (row.tenant_order_items ?? []).map((item) => ({
      name: item.product_label,
      quantity: item.quantity,
      unitPriceHt: item.unit_price_ht,
      priceOrigin: isPriceOrigin(item.price_origin) ? item.price_origin : null,
    })),
  };
}

function parseLegacyItems(value: Json): LegacyOrderRecord['items'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, Json | undefined>;
    return [{
      name: typeof item.name === 'string' ? item.name : '—',
      quantity: typeof item.qty === 'number' ? item.qty : 1,
      unitPriceHt: typeof item.price_ht === 'number' ? item.price_ht : 0,
    }];
  });
}

function normalizeTaxRegime(value: string | null | undefined): TaxRegime | null {
  return value === 'metropole_fr' || value === 'dom_tom' || value === 'franchise_tva'
    || value === 'export_eu' || value === 'export_world' ? value : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapOrderCommandError(message: string, fallback: string): Error {
  // Q17-a (point 12 (b), (d)) — préfixes DISTINCTIFS vérifiés en PREMIER,
  // par `startsWith`, jamais `includes` : le message embarque un
  // `product_label` choisi par l acheteur (`price_changed`) ou un
  // `product_id` (`product_not_in_shop`), et l un ou l autre pourrait
  // accidentellement contenir la sous-chaîne d un autre code
  // (`order_not_found`, `permission_denied`...). Un `includes` générique les
  // classerait à tort — exactement la famille de défaut de câblage que ce
  // lot doit éviter.
  if (message.startsWith('price_changed:')) {
    return new OrderCommandRejectedError(
      'price_changed',
      'Le prix de certaines lignes a changé depuis leur ajout au panier.',
      parsePriceMismatches(message.slice('price_changed:'.length)),
    );
  }
  if (message.startsWith('product_not_in_shop:')) {
    return new OrderCommandRejectedError('product_not_in_shop', message);
  }
  if (message.startsWith('unverified_prices:')) {
    return new OrderCommandRejectedError('unverified_prices', message);
  }
  if (message.includes('order_not_found')) {
    return new OrderCommandRejectedError('order_not_found', message);
  }
  if (message.includes('shop_not_found')) {
    return new OrderCommandRejectedError('shop_not_found', message);
  }
  if (message.includes('invalid_order_items') || message.includes('invalid_currency')) {
    return new OrderCommandRejectedError('invalid_order_items', message);
  }
  if (message.includes('order_not_editable')) {
    return new OrderCommandRejectedError('order_not_editable', message);
  }
  if (message.includes('permission_denied')) {
    return new OrderCommandRejectedError('permission_denied', message);
  }
  if (message.includes('transition_not_allowed') || message.includes('status_code_unknown')) {
    return new OrderCommandRejectedError('transition_not_allowed', message);
  }
  return new Error(`${fallback}: ${message}`);
}

/**
 * Q17-a (point 12 (d)) — `raise exception 'price_changed:%', v_mismatches`
 * embarque un tableau JSON compact après le préfixe. Echec fermé : un
 * contenu illisible rend un tableau vide plutôt que de faire planter le
 * mapping d erreur (l appelant verra alors juste le message générique).
 */
function parsePriceMismatches(raw: string): PriceMismatchDetail[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (entry === null || typeof entry !== 'object') return [];
      const record = entry as Record<string, unknown>;
      const productLabel = typeof record.product_label === 'string' ? record.product_label : '';
      const submitted = typeof record.submitted === 'string' ? record.submitted : '0.00';
      const current = typeof record.current === 'string' ? record.current : '0.00';
      return [{ productLabel, submitted, current }];
    });
  } catch {
    return [];
  }
}

/**
 * `numeric(12,2)` : PostgREST rend un nombre ou une chaîne selon le driver,
 * normalisé en Money.
 *
 * SIGNALÉ (D6, qa-review round 1), NON CORRIGÉ ici : `.toFixed(2)` sur un
 * `number` refait, côté client JS, exactement le calcul flottant que
 * `Money` (chaîne décimale) existe pour éviter. Le risque réel est faible
 * (PostgREST rend déjà une chaîne pour `numeric` dans la configuration
 * actuelle de ce dépôt — la branche `number` de cette fonction n est prise
 * qu en repli), mais il existe. Même motif de non-correction que
 * `commercial-orders-repository.ts` (`toMoneyString`, convention déjà
 * établie ailleurs dans le dépôt) : corriger ce point demande une décision
 * transverse (introduire un parseur décimal exact partagé), pas un
 * correctif local à ce module.
 */
function toMoneyString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toFixed(2);
  return '0.00';
}

function isPriceOrigin(value: unknown): value is 'catalog' | 'quoted' | 'client_unverified' | 'legacy' {
  return value === 'catalog' || value === 'quoted' || value === 'client_unverified' || value === 'legacy';
}
