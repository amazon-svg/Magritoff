import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { PortalOrdersCounters, PortalOrdersTab } from '../../modules/orders/api/contracts.ts';
import type {
  AuditEventRecord,
  LegacyOrderRecord,
  OrdersRepository,
  TaxRegime,
  TenantOrderRecord,
} from '../../modules/orders/application/orders-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

type UserScopedClient = SupabaseClient<Database>;
type TenantOrderRow = Database['public']['Tables']['tenant_orders']['Row'] & {
  tenant_order_items?: Database['public']['Tables']['tenant_order_items']['Row'][] | null;
};

const TENANT_ORDER_SELECTION =
  'id, shop_id, created_at, total_ht, status, tenant_order_items(product_label, quantity, unit_price_ht)';

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
    return (data ?? []).map((row) => toTenantOrder(row as unknown as TenantOrderRow));
  }

  async listTenantOrdersByIds(orderIds: readonly string[]): Promise<readonly TenantOrderRecord[]> {
    if (orderIds.length === 0) return [];
    const { data, error } = await this.client.from('tenant_orders').select(TENANT_ORDER_SELECTION).in('id', [...orderIds]);
    if (error) throw new Error(`Lecture des commandes portail impossible: ${error.message}`);
    return (data ?? []).map((row) => toTenantOrder(row as unknown as TenantOrderRow));
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

  async listAuditEvents(orderId: string): Promise<readonly AuditEventRecord[]> {
    const { data, error } = await this.client.rpc('get_order_audit_trail', { p_order_id: orderId });
    if (error) throw new Error(`Lecture de l audit impossible: ${error.message}`);
    return (data ?? []).map((row) => ({
      eventId: row.event_id,
      orderId: row.order_id,
      kind: row.kind,
      eventType: row.event_type,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      roleName: row.role_name,
      payload: toRecord(row.payload),
      occurredAt: row.occurred_at,
    }));
  }
}

function toTenantOrder(row: TenantOrderRow): TenantOrderRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    createdAt: row.created_at,
    totalHt: row.total_ht,
    status: row.status,
    items: (row.tenant_order_items ?? []).map((item) => ({
      name: item.product_label,
      quantity: item.quantity,
      unitPriceHt: item.unit_price_ht,
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

function toRecord(value: Json): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
