/**
 * Schema Zod pour tenant_orders + tenant_order_items (Story S-MIGRATION-ORDERS).
 *
 * Aligne sur les tables livrees par S1.4 (cf. migration
 * 20260509_01_e1_orders_v1_1.sql + architecture.md §4.1). Utilise pour
 * valider les inserts front avant submitCart (defense-in-depth en sus
 * de la RLS tenant_orders_insert qui exige created_by = auth.uid()).
 *
 * ADR-ORDERS-1 (architecture.md §4.10) : ces schemas remplacent
 * shopOrder.schema.ts pour toutes les nouvelles ecritures de commandes.
 */

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidString = z.string().regex(UUID_RE, 'UUID v4 attendu');

/**
 * Enum statuts tenant_order_status (cf. migration S1.4 :
 *   {draft, validated, in_production, shipped, delivered, invoiced, cancelled}).
 * Lors d un INSERT depuis le panier, le statut initial est toujours `draft`.
 * Les transitions ulterieures passent par la RPC `update_tenant_order_status`.
 */
export const tenantOrderStatusEnum = z.enum([
  'draft',
  'validated',
  'in_production',
  'shipped',
  'delivered',
  'invoiced',
  'cancelled',
]);

/**
 * Schema d insertion tenant_orders. AC9 (S-MIGRATION-ORDERS) :
 * `created_by` est OBLIGATOIRE et doit matcher auth.uid() (cf. RLS check
 * `tenant_orders_insert WITH CHECK created_by = auth.uid()`).
 */
export const tenantOrderInsertSchema = z.object({
  tenant_id: uuidString,
  shop_id: uuidString,
  created_by: uuidString, // AC9 : auth requise (decision Arnaud B2)
  status: tenantOrderStatusEnum.default('draft'),
  total_ht: z.number().nonnegative(),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().default(''),
});

/**
 * Schema d insertion tenant_order_items. Une ligne par produit du panier.
 * Trigger PIM `trg_enqueue_pim_tenant_order_item` (P0.10) fire sur chaque
 * INSERT et cree 1 candidat dans `pim_candidates`.
 */
export const tenantOrderItemInsertSchema = z.object({
  order_id: uuidString,
  /**
   * UUID si le produit vient de shop_products ou product_library avec id UUID.
   * NULL si produit transient (e.g. `lib-...` legacy non migre).
   */
  product_id: uuidString.nullable().optional(),
  /** Snapshot du nom au moment du commit (immutable). */
  product_label: z.string().min(1),
  /** Snapshot config Clariprint pour audit + PIM ingestion (P0.10). */
  clariprint_options: z.record(z.string(), z.unknown()).nullable().optional(),
  quantity: z.number().int().positive(),
  unit_price_ht: z.number().nonnegative(),
  line_total_ht: z.number().nonnegative(),
});

export type TenantOrderStatus = z.infer<typeof tenantOrderStatusEnum>;
export type TenantOrderInsert = z.infer<typeof tenantOrderInsertSchema>;
export type TenantOrderItemInsert = z.infer<typeof tenantOrderItemInsertSchema>;
