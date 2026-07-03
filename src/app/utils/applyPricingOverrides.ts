/**
 * A4.5 — Application des prix négociés per-shop (overrides).
 *
 * Use case : pour un client B2B avec négociation contractuelle, l'admin
 * tenant fixe un prix override (table `shop_product_pricing`). Le portail
 * acheteur affiche alors ce prix au lieu du tarif catalogue
 * `product_library.price_ht`.
 *
 * Helper pur : injecté entre le fetch DB et le `setProducts` côté
 * `PublicShop.refetchProducts`. Testable sans React.
 *
 * Stratégie : si un override est trouvé pour `product.product_id`, on
 * **remplace** `price_ht` par la valeur override (numéro de carte de
 * crédit affiché = ce que l'acheteur paie). On expose aussi
 * `price_ht_override` pour traçabilité côté UI (badge "Tarif négocié").
 */

export interface PricingOverride {
  library_product_id: string;
  price_ht_override: number;
}

/**
 * Produit minimal pris en entrée (compatible ShopProduct + DisplayProduct).
 * On exige `product_id` (la jonction se fait sur `library_product_id`).
 */
export interface PriceableProduct {
  product_id?: string | null;
  price_ht: number;
}

/**
 * Retourne une nouvelle liste de produits avec :
 *   - `price_ht` remplacé par le prix override quand un match existe.
 *   - `price_ht_override` ajouté (number si overridden, null sinon) pour
 *     que l'UI puisse afficher un badge ou l'admin tenant un comparatif.
 *
 * Aucun side-effect : les inputs ne sont pas mutés.
 */
export function applyPricingOverrides<P extends PriceableProduct>(
  products: P[],
  overrides: PricingOverride[],
): (P & { price_ht_override: number | null })[] {
  if (!Array.isArray(products)) return [];
  if (!Array.isArray(overrides) || overrides.length === 0) {
    return products.map((p) => ({ ...p, price_ht_override: null }));
  }

  const byId = new Map<string, number>();
  for (const o of overrides) {
    if (o && typeof o.library_product_id === "string" && typeof o.price_ht_override === "number") {
      byId.set(o.library_product_id, o.price_ht_override);
    }
  }

  return products.map((p) => {
    const pid = p.product_id;
    if (!pid) return { ...p, price_ht_override: null };
    const override = byId.get(pid);
    if (typeof override === "number") {
      return { ...p, price_ht: override, price_ht_override: override };
    }
    return { ...p, price_ht_override: null };
  });
}
