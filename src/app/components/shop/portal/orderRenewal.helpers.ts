/**
 * Helpers purs pour le renouvellement de commande (Story S3.3 Sprint 5).
 *
 * Cible : reconstruire un panier à partir des items snapshotés d'une commande
 * passée (tenant_order_items) en résolvant chaque item contre le catalogue
 * shop courant (ShopProduct[]).
 *
 * Stratégie de matching :
 *   1. Si item.product_id (UUID) présent et match un produit du catalogue
 *      → ligne ajoutée au cart avec la qty originale
 *   2. Sinon (product_id null OU produit retiré) → warning + skip
 *
 * Décision de conception (S3.3 AC2 / AC3) :
 *   - On NE tente PAS de fuzzy match par product_label (trop fragile, risque
 *     d'ajouter le mauvais produit silencieusement). Préférence pour un
 *     warning explicite que l'acheteur peut traiter manuellement.
 *   - On préserve les options Clariprint snapshotées (clariprint_options jsonb)
 *     en les mergeant dans le `config` du ShopProduct catalogue courant pour
 *     conserver les choix faits à la commande originale (matière, finition,
 *     etc.) tout en bénéficiant de l'image / prix courants du catalogue.
 */

import type { ShopProduct } from '../../../contexts/ShopsContext';
import type { CartLine } from './types';

/**
 * DTO d'un item de commande tel que renvoyé par la query Supabase
 * SELECT * FROM tenant_order_items WHERE order_id = ?
 */
export interface OrderItemRow {
  product_id: string | null;
  product_label: string | null;
  clariprint_options: Record<string, unknown> | null;
  quantity: number;
  unit_price_ht: number | null;
}

export interface RebuildResult {
  /** Lignes prêtes à injecter via setCart(). */
  lines: CartLine[];
  /**
   * Warnings utilisateur (1 par item non résolu).
   * Format prêt à afficher dans un banner.
   */
  warnings: string[];
  /** Métriques pour debug / observabilité (logs ou banner détaillé). */
  stats: {
    matched: number;
    skipped: number;
    total: number;
  };
}

/**
 * Reconstruit un cart depuis les items d'une commande passée.
 *
 * @param items - items snapshotés tenant_order_items (any order_id)
 * @param currentShopProducts - catalogue shop courant (ShopProduct[])
 * @returns lines (à passer à setCart) + warnings (à afficher en banner)
 */
export function rebuildCartFromOrderItems(
  items: OrderItemRow[],
  currentShopProducts: ShopProduct[],
): RebuildResult {
  const productById = new Map<string, ShopProduct>();
  for (const p of currentShopProducts) productById.set(p.id, p);

  const lines: CartLine[] = [];
  const warnings: string[] = [];
  let matched = 0;
  let skipped = 0;

  for (const item of items) {
    const label = item.product_label?.trim() || 'Produit sans libellé';
    const qty = Math.max(1, Math.floor(item.quantity || 1));

    if (!item.product_id) {
      warnings.push(`Produit indisponible : ${label} (référence catalogue manquante)`);
      skipped++;
      continue;
    }

    const product = productById.get(item.product_id);
    if (!product) {
      warnings.push(`Produit indisponible : ${label} (retiré du catalogue)`);
      skipped++;
      continue;
    }

    // Merge options Clariprint snapshotées avec config produit catalogue.
    // Les snapshots ont priorité (préservent les choix de la commande originale)
    // mais la config courante reste accessible pour les clés non snapshotées
    // (ex: image_url, default prix marché).
    const mergedConfig: Record<string, unknown> = {
      ...(product.config ?? {}),
      ...(item.clariprint_options ?? {}),
    };

    lines.push({
      product: { ...product, config: mergedConfig },
      qty,
    });
    matched++;
  }

  return {
    lines,
    warnings,
    stats: { matched, skipped, total: items.length },
  };
}
