/**
 * Helpers purs pour ShopGammesSidebar (Story S2.2, Epic 2).
 *
 * Surface :
 *  - groupProductsByGamme(products, gammes) -> Map<slug, ShopProduct[]>
 *      Utilise resolveGamme() existant (productEnrichment.ts) pour matcher
 *      chaque produit a une gamme. Produits non-matchant placent dans
 *      la cle '__no_gamme__' (filtree par UI si compteur 0).
 *  - buildGammeTree(gammes) -> { roots, childrenByParent }
 *      Regroupe par parent_slug pour rendu hierarchique.
 *  - loadExpandedGammes(shopSlug) -> Set<string>
 *      Hydrate depuis localStorage avec defensive try/catch.
 *  - saveExpandedGammes(shopSlug, expanded) -> void
 *      Serialise vers localStorage (JSON Array.from(set)).
 *  - filterProductsByExpandedGammes(products, gammeMap, expandedSlugs) -> ShopProduct[]
 *      Filtre additif : set vide = all, sinon union des gammes deplices.
 *
 * Pattern repo : helpers logiques purs testables sans rendering React.
 */

import type { ShopProduct } from "../../contexts/ShopsContext";
import type { Gamme } from "../../utils/productEnrichment";
import { resolveGamme } from "../../utils/productEnrichment";

export const NO_GAMME_KEY = "__no_gamme__";
export const EXPANDED_GAMMES_KEY_PREFIX = "magrit_shop_expanded_gammes__";

/**
 * Regroupe les produits par slug de gamme via resolveGamme (matching rules
 * Clariprint -> PIM). Produits non-matchant -> NO_GAMME_KEY.
 *
 * Complexite O(P*G) ou P=produits, G=gammes. Memoiser cote consommateur.
 */
export function groupProductsByGamme(
  products: ShopProduct[],
  gammes: Gamme[],
): Map<string, ShopProduct[]> {
  const map = new Map<string, ShopProduct[]>();
  for (const product of products) {
    const gamme = resolveGamme(product.config, gammes);
    const key = gamme?.slug ?? NO_GAMME_KEY;
    const list = map.get(key);
    if (list) {
      list.push(product);
    } else {
      map.set(key, [product]);
    }
  }
  return map;
}

export interface GammeTree {
  /** Gammes racines (parent_slug === null), triees par display_order. */
  roots: Gamme[];
  /** Map parent_slug -> Gamme[] enfants tries par display_order. */
  childrenByParent: Map<string, Gamme[]>;
}

/**
 * Construit la hierarchie 2 niveaux des gammes : racines + enfants par parent.
 * Les gammes orphelines (parent_slug pointant vers un slug inexistant) sont
 * promues en racine pour ne pas etre perdues dans l'UI.
 */
export function buildGammeTree(gammes: Gamme[]): GammeTree {
  const slugSet = new Set(gammes.map((g) => g.slug));
  const sorted = [...gammes].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const roots: Gamme[] = [];
  const childrenByParent = new Map<string, Gamme[]>();
  for (const g of sorted) {
    if (g.parent_slug && slugSet.has(g.parent_slug)) {
      const list = childrenByParent.get(g.parent_slug);
      if (list) list.push(g);
      else childrenByParent.set(g.parent_slug, [g]);
    } else {
      roots.push(g);
    }
  }
  return { roots, childrenByParent };
}

/**
 * Hydrate l'etat deplie depuis localStorage. Defensive : SSR safe (typeof
 * window check), JSON malformed -> Set vide, types non-string ignores.
 */
export function loadExpandedGammes(shopSlug: string): Set<string> {
  if (typeof window === "undefined" || !shopSlug) return new Set();
  try {
    const raw = window.localStorage.getItem(EXPANDED_GAMMES_KEY_PREFIX + shopSlug);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Sauvegarde l'etat deplie dans localStorage. Defensive : SSR safe, quota
 * exceeded silently degraded (l'etat session reste fonctionnel).
 */
export function saveExpandedGammes(
  shopSlug: string,
  expanded: Set<string>,
): void {
  if (typeof window === "undefined" || !shopSlug) return;
  try {
    window.localStorage.setItem(
      EXPANDED_GAMMES_KEY_PREFIX + shopSlug,
      JSON.stringify(Array.from(expanded)),
    );
  } catch {
    // QuotaExceededError ou storage disabled — silently degrade
  }
}

/**
 * Filtre additif : retourne tous les produits si expandedSlugs est vide,
 * sinon l'union des produits matchant les gammes deplices.
 *
 * Conserve l'ordre d'origine des produits (display_order). Pas de dedup
 * necessaire car gammeMap a chaque produit dans une seule gamme.
 */
export function filterProductsByExpandedGammes(
  products: ShopProduct[],
  gammeMap: Map<string, ShopProduct[]>,
  expandedSlugs: Set<string>,
): ShopProduct[] {
  if (expandedSlugs.size === 0) return products;
  const allowedIds = new Set<string>();
  for (const slug of expandedSlugs) {
    const list = gammeMap.get(slug);
    if (list) {
      for (const p of list) allowedIds.add(p.id);
    }
  }
  return products.filter((p) => allowedIds.has(p.id));
}
