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

// ─── S-ORDER-ROLES-3-UI (Sprint 6+, wireframes Sally 2026-06-08) ─────────
// PortalOrders refondu en 4 tabs filtrés par rôle workflow. Chaque tab
// déclenche sa query SQL spécifique (mine / to_validate / to_approve /
// to_produce) qui filtre tenant_orders selon assignment role + statut.
// Compteurs des badges via RPC get_portal_orders_counters (migration
// 20260609000200) — 1 round-trip pour les 4 chiffres.

export type PortalOrdersTab = 'mine' | 'to_validate' | 'to_approve' | 'to_produce';

export interface PortalOrdersCounters {
  mine: number;
  to_validate: number;
  to_approve: number;
  to_produce: number;
}

export interface PortalOrdersTabVisibility {
  /** Tab "Mes commandes" toujours visible. */
  mine: true;
  /** Tab "À valider" visible si user a au moins 1 rôle can_validate intermédiaire. */
  to_validate: boolean;
  /** Tab "À approuver" visible si user a au moins 1 rôle can_validate final (ordering_index = MAX). */
  to_approve: boolean;
  /** Tab "À produire" visible si user a au moins 1 rôle 'Producteur' assigné. */
  to_produce: boolean;
}

/**
 * Détermine la visibilité des tabs depuis les compteurs RPC.
 *
 * Règle pragmatique MVP : un tab est visible s'il a au moins 1 commande
 * dans son périmètre OU si l'utilisateur a un rôle qui le qualifie (peu
 * importe le compteur). Pour MVP on se contente du compteur > 0 — un
 * validateur sans commande à valider ne voit pas le tab vide, on évite le
 * bruit visuel. La page reste accessible via deep-link (?tab=to-validate)
 * si l'utilisateur veut forcer.
 *
 * Cas particulier : "Mes commandes" toujours visible (acheteur primaire),
 * même à 0 — on affiche alors l'empty state CTA "Voir le catalogue".
 */
export function computeTabVisibility(
  counters: PortalOrdersCounters,
): PortalOrdersTabVisibility {
  return {
    mine: true,
    to_validate: counters.to_validate > 0,
    to_approve: counters.to_approve > 0,
    to_produce: counters.to_produce > 0,
  };
}

/**
 * Mapping tab UI → query string pour deep-linking (?tab=...).
 */
export const TAB_QUERY_PARAM: Record<PortalOrdersTab, string> = {
  mine: 'mine',
  to_validate: 'to-validate',
  to_approve: 'to-approve',
  to_produce: 'to-produce',
};

export const TAB_FROM_QUERY: Record<string, PortalOrdersTab> = {
  'mine': 'mine',
  'to-validate': 'to_validate',
  'to-approve': 'to_approve',
  'to-produce': 'to_produce',
};

/**
 * Libellé FR pour chaque tab (brand voice Magrit : direct, concret).
 * Lesson 2026-05-22 : bannir anglicismes.
 */
export const TAB_LABELS: Record<PortalOrdersTab, string> = {
  mine: 'Mes commandes',
  to_validate: 'À valider',
  to_approve: 'À approuver',
  to_produce: 'À produire',
};

/**
 * Empty state microcopy par tab (FR brand voice Magrit).
 */
export const TAB_EMPTY_STATES: Record<PortalOrdersTab, { title: string; body: string; ctaLabel?: string }> = {
  mine: {
    title: 'Aucune commande pour l\'instant',
    body: 'Vous n\'avez encore rien commandé dans cette boutique. Parcourez le catalogue pour ajouter vos premiers articles.',
    ctaLabel: 'Voir le catalogue',
  },
  to_validate: {
    title: 'Aucune commande à valider',
    body: 'Tout est à jour. Les nouvelles commandes s\'afficheront ici dès qu\'elles remonteront vers vous.',
  },
  to_approve: {
    title: 'Aucune approbation en attente',
    body: 'Les commandes vous remonteront ici une fois validées par les étapes précédentes.',
  },
  to_produce: {
    title: 'Atelier au repos',
    body: 'Aucune commande validée à produire pour l\'instant. Les commandes apparaîtront ici dès leur approbation finale.',
  },
};
