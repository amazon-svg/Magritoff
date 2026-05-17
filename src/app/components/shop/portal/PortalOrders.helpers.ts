/**
 * Helpers purs PortalOrders dual-read (Story S-DUAL-READ, Sprint 4 Phase 1).
 *
 * Normalise les commandes de 2 cohorts en une interface UI commune `Order`
 * (cf. ADR-ORDERS-1 architecture.md §4.10) :
 *  - Cohort legacy `shop_orders` : items JSONB inline, status text libre
 *  - Cohort v1.1 `tenant_orders` + `tenant_order_items` : items relationnels,
 *    status enum strict
 *
 * Exportes purs pour testabilite vitest (pas de dependance Supabase).
 */

export type OrderSource = 'legacy' | 'v1_1';

export interface OrderUI {
  id: string;
  source: OrderSource;
  date: string; // ISO
  customer_name: string;
  customer_email: string;
  items: Array<{ name: string; qty: number; price_ht: number }>;
  total_ht: number;
  total_ttc: number;
  status: string; // raw status (mapping vers label UI fait dans STATUS_LABELS)
}

// ─── Format DTO Supabase (depuis les 2 queries) ────────────────────────────

export interface ShopOrderRow {
  id: string;
  shop_id: string;
  customer_name: string | null;
  customer_email: string | null;
  items: Array<{ name?: string; qty?: number; price_ht?: number }> | null;
  total_ht: number | null;
  total_ttc: number | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

export interface TenantOrderRow {
  id: string;
  shop_id: string;
  tenant_id: string;
  created_by: string;
  status: string;
  total_ht: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  // Items relationnels (join supabase select avec inner tenant_order_items)
  tenant_order_items?: Array<{
    product_label: string;
    quantity: number;
    unit_price_ht: number;
    line_total_ht: number;
  }> | null;
}

/**
 * Normalise un shop_orders legacy en OrderUI commun. Applique TVA 20% par
 * defaut (les shop_orders legacy stockent deja total_ttc, on l utilise).
 * Customer name/email peuvent etre null pour anciens enregistrements.
 */
export function normalizeShopOrder(row: ShopOrderRow): OrderUI {
  return {
    id: row.id,
    source: 'legacy',
    date: row.created_at,
    customer_name: row.customer_name ?? '—',
    customer_email: row.customer_email ?? '',
    items: Array.isArray(row.items)
      ? row.items.map((it) => ({
          name: it.name ?? '—',
          qty: typeof it.qty === 'number' ? it.qty : 1,
          price_ht: typeof it.price_ht === 'number' ? it.price_ht : 0,
        }))
      : [],
    total_ht: typeof row.total_ht === 'number' ? row.total_ht : 0,
    total_ttc: typeof row.total_ttc === 'number' ? row.total_ttc : 0,
    status: row.status ?? 'pending',
  };
}

/**
 * Normalise un tenant_orders v1.1 (joint avec tenant_order_items) en OrderUI.
 * `total_ttc` doit etre calcule cote caller via `applyTax` car tenant_orders
 * ne stocke pas total_ttc (uniquement total_ht + currency).
 */
export function normalizeTenantOrder(
  row: TenantOrderRow,
  taxedTotal: (ht: number) => number,
): OrderUI {
  const items = Array.isArray(row.tenant_order_items)
    ? row.tenant_order_items.map((it) => ({
        name: it.product_label ?? '—',
        qty: it.quantity ?? 1,
        price_ht: it.unit_price_ht ?? 0,
      }))
    : [];
  const total_ht = typeof row.total_ht === 'number' ? row.total_ht : 0;
  return {
    id: row.id,
    source: 'v1_1',
    date: row.created_at,
    customer_name: '—', // v1.1 stocke created_by (uuid), pas de nom denormalise
    customer_email: '', // idem
    items,
    total_ht,
    total_ttc: taxedTotal(total_ht),
    status: row.status,
  };
}

/**
 * Mapping unifie raw_status -> label UI + className (port de PortalOrders
 * STATUS_LABELS etendu avec les statuts tenant_order_status v1.1).
 */
export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  // shop_orders legacy
  pending: { label: 'En attente', className: 'bg-warn-bg text-warn-fg border-warn-fg/20' },
  approved: { label: 'Validée', className: 'bg-ok-bg text-ok-fg border-ok-line' },
  // tenant_orders v1.1
  draft: { label: 'Brouillon', className: 'bg-warn-bg text-warn-fg border-warn-fg/20' },
  validated: { label: 'Validée', className: 'bg-ok-bg text-ok-fg border-ok-line' },
  in_production: { label: 'En production', className: 'bg-info-bg text-info-fg border-info-fg/20' },
  shipped: { label: 'Expédiée', className: 'bg-info-bg text-info-fg border-info-fg/20' },
  delivered: { label: 'Livrée', className: 'bg-ok-bg text-ok-fg border-ok-line' },
  invoiced: { label: 'Facturée', className: 'bg-ok-bg text-ok-fg border-ok-line' },
  cancelled: { label: 'Annulée', className: 'bg-err-bg text-err-fg border-err-fg/20' },
};

/**
 * Merge + tri chronologique DESC de 2 cohorts d orders normalises.
 */
export function mergeAndSortOrders(legacy: OrderUI[], v1_1: OrderUI[]): OrderUI[] {
  return [...legacy, ...v1_1].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
