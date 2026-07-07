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
