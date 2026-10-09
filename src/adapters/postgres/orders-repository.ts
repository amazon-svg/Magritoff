import { resolveFixedStorefrontPrice } from './storefront-fixed-pricing.ts';
import { readCommercialOrderDetail } from './commercial-orders-repository.ts';
import {
  assertPrecondition,
  capabilityRequired,
  computeEntityTag,
  toIsoTimestamp,
} from '../../modules/_shared/application/index.ts';
import type { ListOrdersParams, OrderListRecord } from '../../modules/orders/application/orders-repository.ts';
import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import type {
  CreateOrderCommand,
  CreateOrderResult,
  DraftOrder,
  OrderDetail,
  UnifiedOrderDetail,
  UpdateOrderMetadataCommand,
  OrderCapabilities,
  OrderRolesResponse,
  PortalOrdersCounters,
  PortalOrdersTab,
  PriceOrigin,
  TransitionOrderCommand,
  TransitionOrderResult,
  UpdateDraftOrderCommand,
  UpdateDraftOrderResult,
} from '../../modules/orders/api/contracts.ts';
import {
  OrderCommandRejectedError,
  type AuditEventRecord,
  type CreateOrderAuthorization,
  type LegacyOrderRecord,
  type OrdersRepository,
  type OrderResourceAuthorization,
  type StorefrontPortalOrdersRecord,
  type TaxRegime,
  type TenantOrderRecord,
  type TransitionOrderAuthorization,
} from '../../modules/orders/application/orders-repository.ts';
import { storefrontTokenHash } from './storefront-authentication-gateway.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type Row = Record<string, unknown>;
type OrderContext = Readonly<{
  order_id: string;
  tenant_id: string;
  shop_id: string;
  created_by: string | null;
  shop_customer_account_id: string | null;
  status: string;
}>;
type StorefrontIdentity = Readonly<{
  account_id: string;
  shop_id: string;
  actor_magrit_user_id: string | null;
}>;

export interface OrdersNotificationGateway {
  transition(result: TransitionOrderResult, actorUserId: UserId | null, baseUrl: string): Promise<void>;
  created(result: CreateOrderResult, baseUrl: string): Promise<void>;
}

export class PostgresOrdersRepository implements OrdersRepository {
  constructor(
    private readonly tx: PostgresTransactionRunner,
    private readonly notifications: OrdersNotificationGateway,
  ) {}

  getUnifiedOrderDetail(tenantId: TenantId, orderId: string, actor: UserId | null): Promise<UnifiedOrderDetail | null> {
    return this.tx.run(
      { tenantId, ...(actor ? { userId: actor } : { actorKind: 'service' as const }) },
      (client) => readUnifiedOrderDetail(client, tenantId, orderId),
    );
  }

  updateOrderMetadata(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: UpdateOrderMetadataCommand,
    ifMatch: string,
  ): Promise<UnifiedOrderDetail | null> {
    return this.tx.run({ tenantId, userId: actor }, async (client) => {
      const current = (await client.query<Row>(`
        select id,tenant_id,shop_id,created_by,shop_customer_account_id,status,
               customer_reference,notes
          from public.tenant_orders where tenant_id=$1 and id=$2 for update
      `, [tenantId, orderId])).rows[0];
      if (!current) return null;
      const order = {
        order_id: String(current['id']), tenant_id: String(current['tenant_id']),
        shop_id: String(current['shop_id'] ?? ''), created_by: nullable(current['created_by']),
        shop_customer_account_id: nullable(current['shop_customer_account_id']), status: String(current['status']),
      } satisfies OrderContext;
      if (!await hasOrderCapability(client, order, actor, 'can_modify')) {
        throw capabilityRequired('can_modify', ['customer_reference', 'notes']);
      }
      const currentDetail = await readUnifiedOrderDetail(client, tenantId, orderId);
      if (!currentDetail) return null;
      const currentTag = await computeEntityTag(currentDetail);
      assertPrecondition(ifMatch, currentTag, currentDetail as unknown as Record<string, unknown>);

      const before = {
        customer_reference: nullableString(current['customer_reference']),
        notes: String(current['notes'] ?? ''),
      };
      const after = {
        customer_reference: command.customer_reference,
        notes: command.notes,
      };
      const changes = Object.fromEntries(
        (Object.keys(after) as (keyof typeof after)[])
          .filter((field) => before[field] !== after[field])
          .map((field) => [field, { before: before[field], after: after[field] }]),
      );
      if (Object.keys(changes).length > 0) {
        await client.query(`
          update public.tenant_orders set customer_reference=$3,notes=$4
           where tenant_id=$1 and id=$2
        `, [tenantId, orderId, after.customer_reference, after.notes]);
        await client.query(`
          insert into public.tenant_order_metadata_events(order_id,actor_id,changes)
          values($1,$2,$3::jsonb)
        `, [orderId, actor, JSON.stringify(changes)]);
      }
      return readUnifiedOrderDetail(client, tenantId, orderId);
    });
  }

  listOrders(tenantId: TenantId, params: ListOrdersParams): Promise<readonly OrderListRecord[]> {
    return this.tx.run({ tenantId, ...(params.actor ? { userId: params.actor } : { actorKind: 'service' as const }) }, async (client) => {
      const values: unknown[] = [tenantId];
      const predicates = ['orders.tenant_id=$1'];
      const add = (column: string, value: unknown, operator = '=') => {
        if (value === undefined || value === null) return;
        values.push(value);
        predicates.push(`${column} ${operator} $${values.length}`);
      };
      add('orders.order_origin', params.filters.origin);
      add('orders.status', params.filters.status);
      add('orders.customer_id', params.filters.customer_id);
      add('orders.quote_id', params.filters.quote_id);
      add('orders.shop_id', params.filters.shop_id);
      add('orders.current_production_step_id', params.filters.current_production_step_id);
      add('orders.created_at', params.createdAtFrom, '>=');
      add('orders.created_at', params.createdAtTo, '<');
      if (params.filters.customer_search) {
        values.push(params.filters.customer_search);
        predicates.push(`(strpos(lower(coalesce(identity.customer_name,'')),lower($${values.length}::text))>0
          or strpos(lower(coalesce(identity.customer_email,'')),lower($${values.length}::text))>0)`);
      }
      if (params.cursor) {
        values.push(params.cursor.sort, params.cursor.id);
        predicates.push(`(orders.created_at,orders.id)<($${values.length - 1}::timestamptz,$${values.length}::uuid)`);
      }
      values.push(params.size + 1);
      const result = await client.query(`
        select orders.id,orders.order_origin origin,orders.number,orders.shop_id,shops.name shop_name,
               orders.customer_id,identity.customer_name,identity.customer_email,orders.created_at,
               to_char(orders.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_created_at,
               orders.status,orders.currency,orders.total_ht::text,
               case when orders.order_origin='quote' then orders.total_incl_tax
                    else round(orders.total_ht*(1+case tenants.tax_regime
                      when 'metropole_fr' then .2000 when 'dom_tom' then .0850 else 0 end),2)
               end::text total_ttc,
               orders.has_unverified_prices,orders.current_production_step_id,
               coalesce((select jsonb_agg(jsonb_build_object(
                 'name',item.product_label,'quantity',item.quantity,
                 'unit_price_ht',item.unit_price_ht::text,'price_origin',item.price_origin
               ) order by item.position nulls last,item.created_at,item.id)
                 from public.tenant_order_items item where item.order_id=orders.id),'[]'::jsonb) items
          from public.tenant_orders orders
          join public.tenants tenants on tenants.id=orders.tenant_id
          left join public.shops shops on shops.id=orders.shop_id and shops.tenant_id=orders.tenant_id
          left join public.customers customer on customer.id=orders.customer_id and customer.tenant_id=orders.tenant_id
          left join public.shop_customer_accounts account on account.id=orders.shop_customer_account_id and account.tenant_id=orders.tenant_id
          left join public.app_users creator on creator.id=orders.created_by
          cross join lateral (
            select case when orders.customer_id is not null
                     then case when customer.type='company' then customer.company_name
                          else nullif(concat_ws(' ',customer.first_name,customer.last_name),'') end
                     else coalesce(account.full_name,creator.display_name) end customer_name,
                   case when orders.customer_id is not null then null
                        else coalesce(account.email,creator.email_normalized) end customer_email
          ) identity
         where ${predicates.join(' and ')}
         order by orders.created_at desc,orders.id desc
         limit $${values.length}
      `, values);
      return result.rows.map((row) => ({
        id: row.id, origin: row.origin, items: row.items, number: row.number, shop_id: row.shop_id,
        shop_name: row.shop_name, customer_id: row.customer_id,
        customer_name: row.customer_name, customer_email: row.customer_email,
        cursorCreatedAt: row.cursor_created_at,
        created_at: toIsoTimestamp(row.created_at), status: row.status,
        currency: row.currency, total_ht: row.total_ht, total_ttc: row.total_ttc,
        has_unverified_prices: row.has_unverified_prices,
        current_production_step_id: row.current_production_step_id,
      }));
    });
  }

  getTenantTaxRegime(tenantId: string, actor: UserId): Promise<TaxRegime | null> {
    return this.tx.run(context(actor, tenantId), async (client) => {
      const row = (await client.query<{ tax_regime: string | null }>(
        'select tax_regime from public.tenants where id=$1', [tenantId],
      )).rows[0];
      return taxRegime(row?.tax_regime);
    });
  }

  async getShopTaxRegime(shopId: string, actor: UserId): Promise<TaxRegime | null> {
    const shop = await this.activeShop(shopId);
    if (shop === null) return null;
    return this.getTenantTaxRegime(shop.tenantId, actor);
  }

  listTenantOrders(tenantId: string, actor: UserId): Promise<readonly TenantOrderRecord[]> {
    return this.tx.run(context(actor, tenantId), (client) => readOrders(
      client,
      "orders.tenant_id=$1 and orders.order_origin='storefront'",
      [tenantId],
    ));
  }

  async listTenantOrdersByIds(orderIds: readonly string[], actor: UserId): Promise<readonly TenantOrderRecord[]> {
    if (orderIds.length === 0) return [];
    const first = await this.orderContext(orderIds[0]!);
    if (first === null) return [];
    return this.tx.run(context(actor, first.tenant_id), (client) => readOrders(
      client,
      "orders.id=any($1::uuid[]) and orders.order_origin='storefront'",
      [[...orderIds]],
    ));
  }

  listLegacyOrders(_shopIds: readonly string[], _customerEmail?: string): Promise<readonly LegacyOrderRecord[]> {
    // La base portable ne recrée pas `shop_orders`: son contenu est importé
    // dans `tenant_orders` pendant le cutover.
    return Promise.resolve([]);
  }

  async getPortalCounters(shopId: string, userId: UserId): Promise<PortalOrdersCounters> {
    const [mine, toValidate, toApprove, toProduce] = await Promise.all(
      (['mine', 'to_validate', 'to_approve', 'to_produce'] as const)
        .map((tab) => this.getPortalOrderIds(shopId, userId, tab)),
    );
    return {
      mine: mine?.length ?? 0,
      to_validate: toValidate?.length ?? 0,
      to_approve: toApprove?.length ?? 0,
      to_produce: toProduce?.length ?? 0,
    };
  }

  async getPortalOrderIds(shopId: string, userId: UserId, tab: PortalOrdersTab): Promise<readonly string[]> {
    const shop = await this.activeShop(shopId);
    if (shop === null) return [];
    return this.tx.run(context(userId, shop.tenantId), async (client) => {
      const maxValidator = (await client.query<{ value: number | null }>(`
        select max(ordering_index) value from public.tenant_role_definitions
         where tenant_id=$1 and archived_at is null and capabilities @> '{"can_validate":true}'::jsonb
      `, [shop.tenantId])).rows[0]?.value ?? null;
      const predicates: Record<PortalOrdersTab, string> = {
        mine: `(orders.created_by=$2 or exists(
          select 1 from public.tenant_order_roles assignment
          join public.tenant_role_definitions role on role.id=assignment.role_definition_id
          where assignment.order_id=orders.id and assignment.user_id=$2 and assignment.revoked_at is null
            and role.archived_at is null and role.name='Acheteur'))`,
        to_validate: `orders.status='draft' and exists(
          select 1 from public.tenant_order_roles assignment
          join public.tenant_role_definitions role on role.id=assignment.role_definition_id
          where assignment.order_id=orders.id and assignment.user_id=$2 and assignment.revoked_at is null
            and role.archived_at is null and role.capabilities @> '{"can_validate":true}'::jsonb
            and ($3::integer is null or role.ordering_index<$3))`,
        to_approve: `orders.status='draft' and $3::integer is not null and exists(
          select 1 from public.tenant_order_roles assignment
          join public.tenant_role_definitions role on role.id=assignment.role_definition_id
          where assignment.order_id=orders.id and assignment.user_id=$2 and assignment.revoked_at is null
            and role.archived_at is null and role.capabilities @> '{"can_validate":true}'::jsonb
            and role.ordering_index=$3)`,
        to_produce: `orders.status in ('validated','in_production') and exists(
          select 1 from public.tenant_order_roles assignment
          join public.tenant_role_definitions role on role.id=assignment.role_definition_id
          where assignment.order_id=orders.id and assignment.user_id=$2 and assignment.revoked_at is null
            and role.archived_at is null and role.name='Producteur')`,
      };
      return (await client.query<{ id: string }>(`
        select distinct orders.id from public.tenant_orders orders
         where orders.shop_id=$1 and ${predicates[tab]}
         order by orders.id
      `, [shopId, userId, maxValidator])).rows.map((row) => row.id);
    });
  }

  getAuthenticatedUserEmail(actor: UserId): Promise<string | null> {
    return this.tx.run({ userId: actor }, async (client) => (
      await client.query<{ email_normalized: string }>(
        'select email_normalized from public.app_users where id=$1', [actor],
      )
    ).rows[0]?.email_normalized ?? null);
  }

  async getStorefrontPortalOrders(shopId: string, opaqueToken: string): Promise<StorefrontPortalOrdersRecord> {
    return this.withStorefront(opaqueToken, async (client, identity, tenantId) => {
      if (identity.shop_id !== shopId) throw rejected('permission_denied', 'La session appartient à une autre boutique.');
      const orders = await readOrders(client, 'orders.shop_id=$1 and orders.shop_customer_account_id=$2', [shopId, identity.account_id]);
      const regime = (await client.query<{ tax_regime: string | null }>(
        'select tax_regime from public.tenants where id=$1', [tenantId],
      )).rows[0]?.tax_regime;
      return { orders, taxRegime: taxRegime(regime) };
    });
  }

  async listAuditEvents(orderId: string, authorization: OrderResourceAuthorization): Promise<readonly AuditEventRecord[]> {
    return this.withOrderAccess(orderId, authorization, async (client) => {
      const rows = (await client.query<Row>(`
        select event.id event_id,event.order_id,'status' kind,'status_transition' event_type,
               event.actor_id,actor.email_normalized actor_email,event.shop_customer_account_id,
               event.acted_by_magrit_user_id,null::text role_name,
               jsonb_build_object('from_status',event.from_status,'to_status',event.to_status,
                 'reason',event.reason,'metadata',event.metadata) payload,event.created_at occurred_at
          from public.tenant_order_status_events event
          left join public.app_users actor on actor.id=event.actor_id
         where event.order_id=$1
        union all
        select event.id,event.order_id,'role',event.event_type,event.actor_user_id,
               actor.email_normalized,null,null,role.name,event.payload,event.occurred_at
          from public.tenant_order_role_events event
          left join public.app_users actor on actor.id=event.actor_user_id
          left join public.tenant_role_definitions role on role.id=event.role_definition_id
         where event.order_id=$1
        union all
        select event.id,event.order_id,'metadata','metadata_updated',event.actor_id,
               actor.email_normalized,null,null,null,
               jsonb_build_object('changes',event.changes),event.occurred_at
          from public.tenant_order_metadata_events event
          left join public.app_users actor on actor.id=event.actor_id
         where event.order_id=$1
         order by occurred_at,event_id
      `, [orderId])).rows;
      return rows.map(auditEvent);
    });
  }

  transitionOrder(
    orderId: string,
    command: TransitionOrderCommand,
    authorization: TransitionOrderAuthorization,
  ): Promise<TransitionOrderResult> {
    return this.withTransitionAccess(orderId, authorization, async (client, principal) => {
      const receipt = await lockAndReadReceipt(
        client, principal.kind, principal.id, 'order.transition', command.idempotencyKey,
      );
      if (receipt !== null) return transitionResult(receipt, true);

      const locked = await lockOrder(client, orderId);
      const transition = (await client.query<{ required_capability: string | null; self_service_creator: boolean }>(`
        select required_capability,self_service_creator
          from public.tenant_order_status_transitions
         where tenant_id=$1 and from_status_code=$2 and to_status_code=$3 and archived_at is null
      `, [locked.tenant_id, locked.status, command.toStatus])).rows[0];
      if (transition === undefined) throw rejected('transition_not_allowed', `${locked.status} -> ${command.toStatus}`);

      if (principal.kind === 'storefront_customer') {
        if (command.toStatus !== 'cancelled' || locked.status !== 'draft') {
          throw rejected('permission_denied', 'Un client boutique ne peut annuler que son brouillon.');
        }
      } else if (!(transition.self_service_creator && locked.created_by === principal.id)) {
        const capability = transition.required_capability;
        const allowed = capability !== null && await hasOrderCapability(client, locked, principal.id, capability);
        if (!allowed) throw rejected('permission_denied', `La capacité ${capability ?? 'requise'} est absente.`);
      }

      const acknowledgedLabels: string[] = [];
      if (locked.status === 'draft' && command.toStatus !== 'cancelled') {
        const items = (await client.query<Row>(
          'select id,product_id,product_label,clariprint_options,quantity,unit_price_ht from public.tenant_order_items where order_id=$1 order by created_at,id for update',
          [orderId],
        )).rows;
        for (const item of items) {
          const classified = await classifyLine(
            client,
            locked.shop_id,
            item['product_id'],
            item['clariprint_options'],
            money(item['unit_price_ht']),
            locked.shop_customer_account_id,
          );
          if (classified.mismatch) {
            throw new OrderCommandRejectedError('price_changed', 'Le prix catalogue a changé.', [{
              productLabel: String(item['product_label']),
              submitted: money(item['unit_price_ht']),
              current: classified.price,
            }]);
          }
          if (classified.origin === 'client_unverified') acknowledgedLabels.push(String(item['product_label']));
        }
        if (acknowledgedLabels.length > 0 && !command.acknowledgeUnverifiedPrices) {
          throw rejected('unverified_prices', 'Des lignes portent un prix non vérifié.');
        }
      }

      await client.query("select set_config('magrit.order_transition','on',true)");
      await client.query(`
        update public.tenant_orders set status=$2::public.tenant_order_status,
          cancelled_at=case when $2::text='cancelled' then clock_timestamp() else cancelled_at end
         where id=$1
      `, [orderId, command.toStatus]);
      await client.query(`
        insert into public.tenant_order_status_events(
          order_id,actor_id,shop_customer_account_id,acted_by_magrit_user_id,
          from_status,to_status,reason,metadata
        ) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      `, [
        orderId,
        principal.kind === 'magrit_user' ? principal.id : principal.actorMagritUserId,
        principal.kind === 'storefront_customer' ? principal.id : null,
        principal.kind === 'storefront_customer' ? principal.actorMagritUserId : null,
        locked.status,
        command.toStatus,
        command.reason ?? null,
        JSON.stringify({
          source: principal.kind,
          ...(acknowledgedLabels.length === 0 ? {} : {
            acknowledged_unverified_prices: true,
            acknowledged_line_labels: acknowledgedLabels,
          }),
        }),
      ]);
      const result = { orderId, fromStatus: locked.status, toStatus: command.toStatus, replayed: false };
      await storeReceipt(client, principal.kind, principal.id, 'order.transition', command.idempotencyKey, orderId, result);
      return result;
    });
  }

  notifyTransition(result: TransitionOrderResult, actorUserId: UserId | null, baseUrl: string): Promise<void> {
    return this.notifications.transition(result, actorUserId, baseUrl);
  }

  async createOrder(command: CreateOrderCommand, authorization: CreateOrderAuthorization): Promise<CreateOrderResult> {
    if (authorization.kind === 'storefront_session') {
      return this.withStorefront(authorization.opaqueToken, async (client, identity, tenantId) => {
        if (identity.shop_id !== command.shopId) throw rejected('permission_denied', 'Session boutique incohérente.');
        return create(client, command, tenantId, {
          kind: 'storefront_customer', id: identity.account_id, actorMagritUserId: identity.actor_magrit_user_id,
        });
      });
    }
    const shop = await this.activeShop(command.shopId);
    if (shop === null) throw rejected('shop_not_found', 'Boutique introuvable.');
    return this.tx.run(context(authorization.userId, shop.tenantId), (client) => create(
      client, command, shop.tenantId, { kind: 'magrit_user', id: authorization.userId },
    ));
  }

  notifyOrderCreated(result: CreateOrderResult, baseUrl: string): Promise<void> {
    return this.notifications.created(result, baseUrl);
  }

  getDraftOrder(orderId: string, authorization: OrderResourceAuthorization): Promise<DraftOrder> {
    return this.withOrderAccess(orderId, authorization, async (client) => {
      const order = (await client.query<Row>(`
        select id,status,created_at,total_ht,has_unverified_prices from public.tenant_orders where id=$1
      `, [orderId])).rows[0];
      if (order === undefined) throw rejected('order_not_found', 'Commande introuvable.');
      const items = (await client.query<Row>(`
        select id,product_id,product_label,clariprint_options,quantity,unit_price_ht,line_total_ht,price_origin
          from public.tenant_order_items where order_id=$1 order by created_at,id
      `, [orderId])).rows.map(draftItem);
      return {
        orderId: String(order['id']), status: String(order['status']), createdAt: iso(order['created_at']),
        totalHt: money(order['total_ht']), hasUnverifiedPrices: order['has_unverified_prices'] === true, items,
      };
    });
  }

  getOrderDetail(orderId: string, authorization: OrderResourceAuthorization): Promise<OrderDetail> {
    return this.withOrderAccess(orderId, authorization, (client) => readStorefrontOrderDetail(client, orderId));
  }

  updateDraftOrder(
    orderId: string,
    command: UpdateDraftOrderCommand,
    authorization: OrderResourceAuthorization,
  ): Promise<UpdateDraftOrderResult> {
    return this.withOrderAccess(orderId, authorization, async (client, principal) => {
      const receipt = await lockAndReadReceipt(client, principal.kind, principal.id, 'order.update', command.idempotencyKey);
      if (receipt !== null) return updateResult(receipt, true);
      const locked = await lockOrder(client, orderId);
      if (locked.status !== 'draft') throw rejected('order_not_editable', 'La commande n’est plus un brouillon.');
      if (principal.kind === 'magrit_user' && locked.created_by !== principal.id) {
        throw rejected('permission_denied', 'Seul le créateur peut modifier ce brouillon.');
      }

      const existing = (await client.query<Row>(`
        select id,product_id,clariprint_options from public.tenant_order_items
         where order_id=$1 order by created_at,id for update
      `, [orderId])).rows;
      const byId = new Map(existing.map((item) => [String(item['id']), item]));
      if (command.items.some((item) => !byId.has(item.id)) || new Set(command.items.map((item) => item.id)).size !== command.items.length) {
        throw rejected('invalid_order_items', 'Une ligne ne correspond pas à cette commande.');
      }
      await client.query(
        'delete from public.tenant_order_items where order_id=$1 and not(id=any($2::uuid[]))',
        [orderId, command.items.map((item) => item.id)],
      );
      let total = 0;
      let hasUnverified = false;
      for (const item of command.items) {
        const current = byId.get(item.id)!;
        const classified = await classifyLine(
          client,
          locked.shop_id,
          current['product_id'],
          current['clariprint_options'],
          item.expectedUnitPriceHt,
          locked.shop_customer_account_id,
        );
        if (classified.mismatch) throw new OrderCommandRejectedError('price_changed', 'Le prix catalogue a changé.', [{
          productLabel: item.productLabel, submitted: item.expectedUnitPriceHt, current: classified.price,
        }]);
        const unitPrice = Number(classified.price);
        const lineTotal = roundMoney(unitPrice * item.quantity);
        total = roundMoney(total + lineTotal);
        hasUnverified ||= classified.origin === 'client_unverified';
        await client.query(`
          update public.tenant_order_items set product_label=$2,quantity=$3,unit_price_ht=$4,
            line_total_ht=$5,price_origin=$6 where id=$1 and order_id=$7
        `, [item.id, item.productLabel, item.quantity, classified.price, lineTotal.toFixed(2), classified.origin, orderId]);
      }
      await client.query(
        'update public.tenant_orders set total_ht=$2,has_unverified_prices=$3 where id=$1',
        [orderId, total.toFixed(2), hasUnverified],
      );
      const result = { orderId, totalHt: total.toFixed(2), replayed: false };
      await storeReceipt(client, principal.kind, principal.id, 'order.update', command.idempotencyKey, orderId, result);
      return result;
    });
  }

  async getOrderRoles(orderId: string, actor: UserId): Promise<OrderRolesResponse> {
    const order = await this.orderContext(orderId);
    if (order === null) throw rejected('order_not_found', 'Commande introuvable.');
    return this.tx.run(context(actor, order.tenant_id), async (client) => {
      const roles = (await client.query<Row>(`
        select assignment.id assignment_id,role.id role_definition_id,role.name,role.capabilities,
               role.notify_policy,role.ordering_index
          from public.tenant_order_roles assignment
          join public.tenant_role_definitions role on role.id=assignment.role_definition_id
         where assignment.order_id=$1 and assignment.user_id=$2 and assignment.revoked_at is null
           and role.archived_at is null order by role.ordering_index,role.id
      `, [orderId, actor])).rows;
      const capabilities = emptyCapabilities();
      for (const row of roles) {
        for (const [key, value] of Object.entries(record(row['capabilities']))) {
          if (key in capabilities && value === true) capabilities[key as keyof OrderCapabilities] = true;
        }
      }
      const isCreator = order.created_by === actor;
      if (isCreator) capabilities.can_order = true;
      return {
        roles: roles.map((row) => ({
          assignmentId: String(row['assignment_id']), roleDefinitionId: String(row['role_definition_id']),
          name: String(row['name']), capabilities: record(row['capabilities']),
          notifyPolicy: notifyPolicy(row['notify_policy']), orderingIndex: Number(row['ordering_index']),
        })),
        capabilities,
        isCreator,
      };
    });
  }

  private activeShop(shopId: string): Promise<{ shopId: string; tenantId: string } | null> {
    return this.tx.run({}, async (client) => {
      const row = (await client.query<{ shop_id: string; tenant_id: string }>(
        'select * from magrit.active_shop_context($1)', [shopId],
      )).rows[0];
      return row === undefined ? null : { shopId: row.shop_id, tenantId: row.tenant_id };
    });
  }

  private orderContext(orderId: string): Promise<OrderContext | null> {
    return this.tx.run({}, async (client) => (
      await client.query<OrderContext>('select * from magrit.order_context($1)', [orderId])
    ).rows[0] ?? null);
  }

  private withStorefront<T>(
    token: string,
    operation: (client: PoolClient, identity: StorefrontIdentity, tenantId: string) => Promise<T>,
  ): Promise<T> {
    return this.tx.run({}, async (client) => {
      const identity = (await client.query<StorefrontIdentity>(
        'select account_id,shop_id,actor_magrit_user_id from magrit.resolve_storefront_session($1)',
        [storefrontTokenHash(token)],
      )).rows[0];
      if (identity === undefined) throw rejected('permission_denied', 'Session boutique invalide ou expirée.');
      const shop = (await client.query<{ tenant_id: string }>(
        'select tenant_id from magrit.active_shop_context($1)', [identity.shop_id],
      )).rows[0];
      if (shop === undefined) throw rejected('shop_not_found', 'Boutique introuvable.');
      await client.query(`select set_config('magrit.tenant_id',$1,true),
        set_config('magrit.storefront_account_id',$2,true)`, [shop.tenant_id, identity.account_id]);
      return operation(client, identity, shop.tenant_id);
    });
  }

  private async withOrderAccess<T>(
    orderId: string,
    authorization: OrderResourceAuthorization,
    operation: (
      client: PoolClient,
      principal: Principal,
      order: OrderContext,
    ) => Promise<T>,
  ): Promise<T> {
    const order = await this.orderContext(orderId);
    if (order === null) throw rejected('order_not_found', 'Commande introuvable.');
    if (authorization.storefrontToken !== null) {
      try {
        return await this.withStorefront(authorization.storefrontToken, async (client, identity) => {
          if (identity.account_id !== order.shop_customer_account_id || identity.shop_id !== order.shop_id) {
            throw rejected('permission_denied', 'La commande n’appartient pas à cette session boutique.');
          }
          return operation(client, {
            kind: 'storefront_customer', id: identity.account_id,
            actorMagritUserId: identity.actor_magrit_user_id,
          }, order);
        });
      } catch (error) {
        const canFallbackToMagrit = authorization.magritUserId !== null
          && error instanceof OrderCommandRejectedError
          && error.code === 'permission_denied';
        if (!canFallbackToMagrit) throw error;
      }
    }
    if (authorization.magritUserId === null) throw rejected('permission_denied', 'Identité requise.');
    const magritUserId = authorization.magritUserId;
    return this.tx.run(context(magritUserId, order.tenant_id), (client) => operation(
      client, { kind: 'magrit_user', id: magritUserId }, order,
    ));
  }

  private withTransitionAccess<T>(
    orderId: string,
    authorization: TransitionOrderAuthorization,
    operation: (client: PoolClient, principal: Principal, order: OrderContext) => Promise<T>,
  ): Promise<T> {
    return this.withOrderAccess(orderId, {
      storefrontToken: authorization.storefrontToken,
      magritUserId: authorization.magritUserId,
    }, operation);
  }
}

type Principal =
  | Readonly<{ kind: 'magrit_user'; id: UserId }>
  | Readonly<{ kind: 'storefront_customer'; id: string; actorMagritUserId: string | null }>;

async function create(
  client: PoolClient,
  command: CreateOrderCommand,
  tenantId: string,
  principal: Principal,
): Promise<CreateOrderResult> {
  const receipt = await lockAndReadReceipt(client, principal.kind, principal.id, 'order.create', command.idempotencyKey);
  if (receipt !== null) return createResult(receipt, true);
  const classified = [];
  const mismatches = [];
  for (const item of command.items) {
    const line = await classifyLine(
      client,
      command.shopId,
      item.productId,
      item.clariprintOptions,
      item.expectedUnitPriceHt,
      principal.kind === 'storefront_customer' ? principal.id : null,
    );
    if (line.mismatch) mismatches.push({
      productLabel: item.productLabel, submitted: item.expectedUnitPriceHt, current: line.price,
    });
    classified.push({ item, ...line });
  }
  if (mismatches.length > 0) throw new OrderCommandRejectedError(
    'price_changed', 'Le prix de certaines lignes a changé.', mismatches,
  );
  const total = classified.reduce(
    (sum, line) => roundMoney(sum + Number(line.price) * line.item.quantity), 0,
  );
  const hasUnverified = classified.some((line) => line.origin === 'client_unverified');
  const order = (await client.query<{ id: string }>(`
    insert into public.tenant_orders(
      tenant_id,shop_id,created_by,shop_customer_account_id,acted_by_magrit_user_id,
      total_ht,currency,notes,has_unverified_prices
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id
  `, [
    tenantId, command.shopId,
    principal.kind === 'magrit_user' ? principal.id : null,
    principal.kind === 'storefront_customer' ? principal.id : null,
    principal.kind === 'storefront_customer' ? principal.actorMagritUserId : null,
    total.toFixed(2), command.currency, command.notes, hasUnverified,
  ])).rows[0];
  if (order === undefined) throw new Error('Commande non créée.');
  for (const line of classified) {
    const lineTotal = roundMoney(Number(line.price) * line.item.quantity);
    await client.query(`
      insert into public.tenant_order_items(
        order_id,product_id,product_label,clariprint_options,quantity,
        unit_price_ht,line_total_ht,price_origin
      ) values($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
    `, [
      order.id, line.item.productId, line.item.productLabel,
      JSON.stringify(line.config ?? line.item.clariprintOptions ?? {}), line.item.quantity,
      line.price, lineTotal.toFixed(2), line.origin,
    ]);
  }
  const result = {
    orderId: order.id, tenantId, shopId: command.shopId,
    totalHt: total.toFixed(2), currency: command.currency, replayed: false,
  };
  await storeReceipt(client, principal.kind, principal.id, 'order.create', command.idempotencyKey, order.id, result);
  return result;
}

async function classifyLine(
  client: PoolClient,
  shopId: string,
  productId: unknown,
  clariprintOptions: unknown,
  submitted: string,
  accountId: string | null = null,
): Promise<{ price: string; origin: PriceOrigin; mismatch: boolean; config?: Record<string, unknown> }> {
  if (typeof productId === 'string') {
    const fixed = await resolveFixedStorefrontPrice(client, shopId, productId, accountId);
    if (fixed) return { price: fixed.price, origin: 'catalog', mismatch: fixed.price !== submitted, config: fixed.config };
  }
  const row = (await client.query<{
    resolved_unit_price_ht: string;
    price_origin: PriceOrigin;
    in_scope: boolean;
    mismatch: boolean;
  }>(
    'select * from magrit.classify_storefront_order_line($1,$2,$3::jsonb,$4::numeric)',
    [shopId, typeof productId === 'string' ? productId : null, JSON.stringify(record(clariprintOptions)), submitted],
  )).rows[0];
  if (row === undefined || !row.in_scope) {
    throw rejected('product_not_in_shop', 'Produit absent du catalogue de la boutique.');
  }
  return {
    price: money(row.resolved_unit_price_ht),
    origin: priceOrigin(row.price_origin) ?? 'client_unverified',
    mismatch: row.mismatch,
  };
}

async function readOrders(client: PoolClient, predicate: string, parameters: unknown[]): Promise<TenantOrderRecord[]> {
  const rows = (await client.query<Row>(`
    select orders.id,orders.shop_id,orders.created_at,orders.total_ht,orders.status,
           orders.has_unverified_prices,
           coalesce(account.full_name,creator.display_name,split_part(creator.email_normalized,'@',1)) customer_name,
           coalesce(account.email,creator.email_normalized) customer_email,
           coalesce(jsonb_agg(jsonb_build_object(
             'name',item.product_label,'quantity',item.quantity,
             'unitPriceHt',item.unit_price_ht,'priceOrigin',item.price_origin
           ) order by item.created_at,item.id) filter(where item.id is not null),'[]'::jsonb) items
      from public.tenant_orders orders
      left join public.tenant_order_items item on item.order_id=orders.id
      left join public.shop_customer_accounts account on account.id=orders.shop_customer_account_id
      left join public.app_users creator on creator.id=orders.created_by
     where ${predicate}
     group by orders.id,account.full_name,account.email,creator.display_name,creator.email_normalized
     order by orders.created_at desc,orders.id desc limit 100
  `, parameters)).rows;
  return rows.map(orderRecord);
}

async function lockAndReadReceipt(
  client: PoolClient,
  actorKind: Principal['kind'],
  actorId: string,
  commandType: string,
  key: string,
): Promise<Row | null> {
  await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [
    `${actorKind}:${actorId}:${commandType}:${key}`,
  ]);
  return (await client.query<{ result: Row }>(`
    select result from public.order_command_receipts
     where actor_kind=$1 and actor_id=$2 and command_type=$3 and idempotency_key=$4
  `, [actorKind, actorId, commandType, key])).rows[0]?.result ?? null;
}

async function lockOrder(client: PoolClient, orderId: string): Promise<OrderContext> {
  const order = (await client.query<OrderContext>(`
    select id order_id,tenant_id,shop_id,created_by,shop_customer_account_id,status
      from public.tenant_orders where id=$1 for update
  `, [orderId])).rows[0];
  if (order === undefined) throw rejected('order_not_found', 'Commande introuvable.');
  return order;
}

async function storeReceipt(
  client: PoolClient,
  actorKind: Principal['kind'],
  actorId: string,
  commandType: string,
  key: string,
  aggregateId: string,
  result: object,
): Promise<void> {
  await client.query(`
    insert into public.order_command_receipts(
      actor_kind,actor_id,command_type,idempotency_key,aggregate_id,result
    ) values($1,$2,$3,$4,$5,$6::jsonb)
  `, [actorKind, actorId, commandType, key, aggregateId, JSON.stringify(result)]);
}

async function hasOrderCapability(
  client: PoolClient,
  order: OrderContext,
  actor: string,
  capability: string,
): Promise<boolean> {
  const result = await client.query<{ allowed: boolean }>(`
    select (
      magrit.actor_has_capability($1,$3)
      or exists(
        select 1 from public.tenant_order_roles assignment
        join public.tenant_role_definitions role on role.id=assignment.role_definition_id
        where assignment.order_id=$2 and assignment.user_id=$4 and assignment.revoked_at is null
          and role.archived_at is null and role.capabilities @> jsonb_build_object($3,true)
      )
    ) allowed
  `, [order.tenant_id, order.order_id, capability, actor]);
  return result.rows[0]?.allowed === true;
}

function orderRecord(row: Row): TenantOrderRecord {
  const items = Array.isArray(row['items']) ? row['items'] : [];
  return {
    id: String(row['id']), shopId: String(row['shop_id']), createdAt: iso(row['created_at']),
    customerName: nullable(row['customer_name']), customerEmail: nullable(row['customer_email']),
    items: items.map((value) => {
      const item = record(value);
      return {
        name: String(item['name']), quantity: Number(item['quantity']),
        unitPriceHt: Number(item['unitPriceHt']), priceOrigin: priceOrigin(item['priceOrigin']),
      };
    }),
    totalHt: Number(row['total_ht']), status: String(row['status']),
    hasUnverifiedPrices: row['has_unverified_prices'] === true,
  };
}

function auditEvent(row: Row): AuditEventRecord {
  return {
    eventId: String(row['event_id']), orderId: String(row['order_id']), kind: String(row['kind']),
    eventType: String(row['event_type']), actorId: nullable(row['actor_id']),
    actorEmail: nullable(row['actor_email']), shopCustomerAccountId: nullable(row['shop_customer_account_id']),
    actedByMagritUserId: nullable(row['acted_by_magrit_user_id']), roleName: nullable(row['role_name']),
    payload: record(row['payload']), occurredAt: iso(row['occurred_at']),
  };
}

function draftItem(row: Row): DraftOrder['items'][number] {
  return {
    id: String(row['id']), productId: nullable(row['product_id']), productLabel: String(row['product_label']),
    clariprintOptions: Object.keys(record(row['clariprint_options'])).length === 0
      ? null
      : record(row['clariprint_options']) as DraftOrder['items'][number]['clariprintOptions'],
    quantity: Number(row['quantity']), unitPriceHt: money(row['unit_price_ht']),
    lineTotalHt: money(row['line_total_ht']), priceOrigin: priceOrigin(row['price_origin']) ?? 'legacy',
  };
}

function transitionResult(row: Row, replayed: boolean): TransitionOrderResult {
  return { orderId: String(row['orderId']), fromStatus: String(row['fromStatus']), toStatus: String(row['toStatus']), replayed };
}
function createResult(row: Row, replayed: boolean): CreateOrderResult {
  return { orderId:String(row['orderId']),tenantId:String(row['tenantId']),shopId:String(row['shopId']),totalHt:String(row['totalHt']),currency:String(row['currency']),replayed };
}
function updateResult(row: Row, replayed: boolean): UpdateDraftOrderResult {
  return { orderId:String(row['orderId']),totalHt:String(row['totalHt']),replayed };
}
function context(actor: UserId, tenantId: string) { return { userId: actor, tenantId: tenantId as TenantId }; }
function record(value: unknown): Row { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}; }
function nullable(value: unknown): string | null { return value === null || value === undefined ? null : String(value); }
function nullableString(value: unknown): string | null {
  const normalized = nullable(value)?.trim() ?? '';
  return normalized === '' ? null : normalized;
}
function iso(value: unknown): string { return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString(); }
function money(value: unknown): string { return Number(value).toFixed(2); }
function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
function priceOrigin(value: unknown): PriceOrigin | null { return value === 'catalog'||value === 'quoted'||value === 'client_unverified'||value === 'legacy' ? value : null; }
function taxRegime(value: unknown): TaxRegime | null { return value === 'metropole_fr'||value === 'dom_tom'||value === 'franchise_tva'||value === 'export_eu'||value === 'export_world' ? value : null; }
function detailTaxRate(regime: TaxRegime | null): number {
  if (regime === 'dom_tom') return 0.085;
  if (regime === 'franchise_tva'||regime === 'export_eu'||regime === 'export_world') return 0;
  return 0.2;
}
function notifyPolicy(value: unknown): 'chain_next'|'all_roles'|'none' { return value === 'all_roles'||value === 'none' ? value : 'chain_next'; }
function rejected(code: ConstructorParameters<typeof OrderCommandRejectedError>[0], message: string) { return new OrderCommandRejectedError(code, message); }
function emptyCapabilities(): OrderCapabilities { return { can_quote:false,can_order:false,can_invite:false,can_validate:false,can_cancel:false,can_modify:false,can_export:false,can_manage_catalog:false,can_manage_roles:false }; }

async function readUnifiedOrderDetail(
  client: PoolClient,
  tenantId: TenantId,
  orderId: string,
): Promise<UnifiedOrderDetail | null> {
  const row = (await client.query<Row>(`
    select id,order_origin,number,shop_id,customer_id,quote_id,current_production_step_id,
           currency,has_unverified_prices,customer_reference,notes
      from public.tenant_orders where tenant_id=$1 and id=$2
  `, [tenantId, orderId])).rows[0];
  if (!row) return null;
  const relations = {
    id: String(row['id']), number: nullableString(row['number']),
    shop_id: nullableString(row['shop_id']), customer_id: nullableString(row['customer_id']),
    quote_id: nullableString(row['quote_id']),
    current_production_step_id: nullableString(row['current_production_step_id']),
    customer_reference: nullableString(row['customer_reference']),
    notes: String(row['notes'] ?? ''),
  };
  if (row['order_origin'] === 'quote') {
    const detail = await readCommercialOrderDetail(client, tenantId, orderId);
    if (!detail) return null;
    return { ...relations, origin: 'quote', detail,
      current_production_step_id: detail.current_production_step_id,
      created_at: detail.created_at, updated_at: detail.updated_at, status: detail.status,
      currency: String(row['currency']), total_ht: detail.totals.net_total, total_ttc: detail.totals.total_incl_tax,
      has_unverified_prices: row['has_unverified_prices'] === true };
  }
  const detail = await readStorefrontOrderDetail(client, orderId);
  return { ...relations, origin: 'storefront', detail,
    created_at: detail.createdAt, updated_at: detail.updatedAt,
    status: detail.status as UnifiedOrderDetail['status'], currency: detail.currency,
    total_ht: detail.totalHt, total_ttc: detail.totalTtc,
    has_unverified_prices: detail.hasUnverifiedPrices };
}

async function readStorefrontOrderDetail(client: PoolClient, orderId: string): Promise<OrderDetail> {
  const order = (await client.query<Row>(`
    select orders.id,orders.shop_id,shops.name shop_name,orders.status,
           orders.created_at,orders.updated_at,orders.total_ht,orders.currency,
           orders.notes,orders.has_unverified_prices,tenants.tax_regime,
           coalesce(account.full_name,creator.display_name) customer_name,
           coalesce(account.email,creator.email_normalized) customer_email
      from public.tenant_orders orders
      join public.shops shops on shops.id=orders.shop_id
      join public.tenants tenants on tenants.id=orders.tenant_id
      left join public.shop_customer_accounts account on account.id=orders.shop_customer_account_id
      left join public.app_users creator on creator.id=orders.created_by
     where orders.id=$1
  `, [orderId])).rows[0];
  if (order === undefined) throw rejected('order_not_found', 'Commande introuvable.');
  const items = (await client.query<Row>(`
    select id,product_id,product_label,clariprint_options,quantity,unit_price_ht,line_total_ht,price_origin
      from public.tenant_order_items where order_id=$1 order by created_at,id
  `, [orderId])).rows.map(draftItem);
  const totalHt = money(order['total_ht']);
  const rate = detailTaxRate(taxRegime(order['tax_regime']));
  return {
    orderId: String(order['id']),
    shopId: String(order['shop_id']),
    shopName: String(order['shop_name']),
    source: 'v1_1',
    status: String(order['status']),
    createdAt: iso(order['created_at']),
    updatedAt: iso(order['updated_at']),
    customerName: nullableString(order['customer_name']),
    customerEmail: nullableString(order['customer_email']),
    currency: String(order['currency']),
    notes: String(order['notes'] ?? ''),
    totalHt,
    totalTtc: roundMoney(Number(totalHt) * (1 + rate)).toFixed(2),
    hasUnverifiedPrices: order['has_unverified_prices'] === true,
    items,
  };
}
