/**
 * S2.15 (Epic 2, FR-ECOM-05) — Sections dérivées de la home boutique.
 *
 * Bloc "Nouveautés" : les N derniers produits intégrés à la boutique, triés par
 * date d'ajout décroissante. Data-driven (pas de curation manuelle) : le tri
 * vient de created_at ; le badge "Nouveau" est porté par la ProductCard (S2.12).
 */

import type { ShopProduct } from "../contexts/ShopsContext";

/**
 * Résout les N produits les plus récemment ajoutés (created_at desc).
 * Les produits sans date sont placés en fin (jamais présentés comme nouveaux).
 * Retourne [] si la liste est vide (la section se replie côté UI).
 */
export function resolveNewProducts(products: ShopProduct[], limit: number): ShopProduct[] {
  if (!products.length || limit <= 0) return [];
  const ts = (p: ShopProduct): number => {
    const v = p.created_at ? new Date(p.created_at).getTime() : NaN;
    return Number.isFinite(v) ? v : -Infinity; // sans date → en fin
  };
  return [...products].sort((a, b) => ts(b) - ts(a)).slice(0, limit);
}

/**
 * S2.16 (Epic 2, FR-ECOM-06, option C) — Résumé du panier en cours pour le bloc
 * « Votre panier en cours » de la home boutique (reprise en un clic).
 *
 * Total HT tax-agnostique : la TTC est appliquée côté composant via `applyTax`
 * (le taux dépend du tenant courant). Renvoie `null` si le panier est vide, pour
 * que la section se replie (AC3, symétrie avec le bloc Nouveautés).
 */
export interface CartResumeSummary {
  /** Nombre de lignes distinctes dans le panier. */
  lineCount: number;
  /** Somme des quantités (articles). */
  itemCount: number;
  /** Somme HT (prix_ht * qty), prix/quantités invalides ignorés. */
  totalHT: number;
}

export function summarizeCartResume(
  cart: { product: { price_ht?: number | null }; qty: number }[] | null | undefined,
): CartResumeSummary | null {
  if (!cart || cart.length === 0) return null;
  let itemCount = 0;
  let totalHT = 0;
  for (const l of cart) {
    const qty = Number.isFinite(l.qty) && l.qty > 0 ? l.qty : 0;
    const unit =
      typeof l.product?.price_ht === 'number' && Number.isFinite(l.product.price_ht)
        ? l.product.price_ht
        : 0;
    itemCount += qty;
    totalHT += unit * qty;
  }
  return { lineCount: cart.length, itemCount, totalHT };
}
