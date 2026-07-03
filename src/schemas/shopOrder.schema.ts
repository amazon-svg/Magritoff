/**
 * Schema zod pour shop_orders (R4 - refacto 2026-05-11).
 *
 * Aligne sur la table `shop_orders` (cf. database.types.ts). Utilise pour
 * valider les inserts cote front avant submitCart (defense-in-depth en sus
 * du trigger UUID defensive applique en migration 20260511_03).
 */

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidString = z.string().regex(UUID_RE, 'UUID v4 attendu');

/** Item dans le JSONB `items` d'une shop_order. */
export const shopOrderItemSchema = z.object({
  /**
   * S-FIX-PANIER-11/05 (bug #4d) : product_id est OPTIONAL et doit etre UUID
   * si present. Les produits library (`lib-...`) sont envoyes via
   * `source_id` (jsonb arbitraire) pour eviter le cast trigger.
   */
  product_id: uuidString.optional(),
  source_id: z.string().optional(),
  name: z.string().min(1),
  qty: z.number().int().positive(),
  /** Nombre d exemplaires effectifs (S-FIX-PANIER-11/05). */
  quantity_ex: z.number().int().positive().nullable().optional(),
  price_ht: z.number().nonnegative(),
});

export const shopOrderInsertSchema = z.object({
  shop_id: uuidString,
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().default(''),
  items: z.array(shopOrderItemSchema).min(1, 'Le panier ne peut pas etre vide'),
  total_ht: z.number().nonnegative(),
  total_ttc: z.number().nonnegative(),
  notes: z.string().default(''),
  status: z.enum(['pending', 'approved', 'in_production', 'shipped', 'cancelled']).default('pending'),
});

export type ShopOrderItem = z.infer<typeof shopOrderItemSchema>;
export type ShopOrderInsert = z.infer<typeof shopOrderInsertSchema>;
