/**
 * Helpers de calcul panier extraits de CartContext (Story R0 - garde-fou).
 *
 * Pourquoi extraire ?
 *  - CartContext est un Provider React, difficile a tester en isolation sans
 *    @testing-library/react (non installe dans le projet).
 *  - Le calcul total HT / TTC est une logique pure : on l'isole ici pour
 *    pouvoir l'eprouver avec vitest en mode `environment: node`.
 *
 * Pattern coherent avec ShopProductCard.helpers.ts, ShopLayout.helpers.ts,
 * etc. (helpers extraits = testables sans DOM).
 */

import { applyTax } from './tax';

export interface CartItemLike {
  product: {
    /** Champ legacy : utilise par CartContext.tsx avant R0. */
    price?: number;
    /** Champ canonique introduit par le PIM. */
    price_ht?: number;
    /** Quantite (mode boutique). Defaut 1 (mode atelier devis). */
    qty?: number;
  };
}

/**
 * Resout le prix HT unitaire d'un item de panier. Tolere les 2 noms historiques
 * (`price` legacy CartContext + `price_ht` champ PIM) pour ne pas casser
 * les call-sites existants.
 */
function unitPriceHT(item: CartItemLike): number {
  const p = item.product;
  const price = typeof p.price_ht === 'number' ? p.price_ht : p.price;
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : 0;
}

/** Quantite d'un item (defaut 1). */
function unitQty(item: CartItemLike): number {
  const q = item.product.qty;
  return typeof q === 'number' && q > 0 ? q : 1;
}

/**
 * Total HT du panier : somme des `price_ht * qty` de chaque item.
 */
export function computeCartTotalHT(items: CartItemLike[]): number {
  return items.reduce((total, item) => total + unitPriceHT(item) * unitQty(item), 0);
}

/**
 * Total TTC du panier selon le taux de TVA applicable au tenant.
 *
 * `taxRate` doit etre resolu en amont via `getTaxRate(currentTenant)`.
 */
export function computeCartTotalTTC(items: CartItemLike[], taxRate: number): number {
  return applyTax(computeCartTotalHT(items), taxRate);
}

/**
 * Montant de la TVA seule (utile pour l'affichage de la ligne "TVA (20 %)").
 */
export function computeCartTaxAmount(items: CartItemLike[], taxRate: number): number {
  return computeCartTotalHT(items) * taxRate;
}
