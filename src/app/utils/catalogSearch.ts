/**
 * S2.21 — Autocomplétion recherche catalogue boutique.
 *
 * Helpers purs (testables vitest) qui dérivent des suggestions instantanées
 * (familles + produits) depuis une requête ≥ 2 caractères. Le fallback IA
 * « Demander à Magrit » (S-CONSO-4 / ADR §4.15) reste géré côté composant :
 * `hasNoMatch` signale seulement quand aucune suggestion locale ne matche.
 *
 * Réutilise buildShopTaxonomy (familles = gammes racines, ADR §4.17) et
 * resolveProductGamme pour le libellé de gamme d'un produit.
 */

import type { ShopProduct } from '../contexts/ShopsContext';
import type { Gamme } from './productEnrichment';
import { resolveProductGamme } from './productEnrichment';
import { buildShopTaxonomy } from './shopTaxonomy';

/** Seuil minimal de déclenchement de l'autocomplétion (AC1). */
export const MIN_QUERY_LENGTH = 2;

const DEFAULT_MAX_PRODUCTS = 5;
const DEFAULT_MAX_FAMILIES = 3;

export interface ProductSuggestion {
  type: 'product';
  id: string;
  label: string;
  /** Gamme ou description courte, affichée en sous-libellé. */
  sublabel: string;
  product: ShopProduct;
}

export interface FamilySuggestion {
  type: 'family';
  /** Clé stable de la famille (racine de gamme). */
  key: string;
  label: string;
  count: number;
  /** Slugs de gammes à filtrer (réutilise selectGammes du méga-menu). */
  gammeSlugs: string[];
}

export type SearchSuggestion = ProductSuggestion | FamilySuggestion;

/**
 * Minuscule + suppression des diacritiques (café → cafe). Rend le matching
 * accent-insensible, plus robuste que le substring brut de S-CONSO-4.
 */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Construit les suggestions instantanées pour une requête. Familles d'abord
 * (couverture plus large), puis produits. Retourne [] si la requête fait moins
 * de MIN_QUERY_LENGTH caractères.
 */
export function buildSearchSuggestions(
  query: string,
  products: ShopProduct[],
  gammes: Gamme[] = [],
  opts?: { maxProducts?: number; maxFamilies?: number },
): SearchSuggestion[] {
  const q = normalizeSearchText(query);
  if (q.length < MIN_QUERY_LENGTH) return [];

  const maxProducts = opts?.maxProducts ?? DEFAULT_MAX_PRODUCTS;
  const maxFamilies = opts?.maxFamilies ?? DEFAULT_MAX_FAMILIES;

  // ─── Familles (gammes racines) dont le libellé matche ────────────────────
  const families: FamilySuggestion[] = buildShopTaxonomy(products, gammes)
    .filter((f) => f.count > 0 && normalizeSearchText(f.label).includes(q))
    .slice(0, maxFamilies)
    .map((f) => ({
      type: 'family',
      key: f.key,
      label: f.label,
      count: f.count,
      gammeSlugs: f.gammeSlugs,
    }));

  // ─── Produits dont name / description / gamme matche ──────────────────────
  const productSuggestions: ProductSuggestion[] = [];
  for (const p of products) {
    if (productSuggestions.length >= maxProducts) break;
    const gamme = gammes.length > 0 ? resolveProductGamme(p, gammes) : null;
    const haystack = normalizeSearchText(
      [p.name, p.description ?? '', gamme?.name ?? ''].join(' '),
    );
    if (haystack.includes(q)) {
      productSuggestions.push({
        type: 'product',
        id: p.id,
        label: p.name,
        sublabel: gamme?.name ?? p.description ?? '',
        product: p,
      });
    }
  }

  return [...families, ...productSuggestions];
}

/**
 * True quand la requête est active (≥ MIN_QUERY_LENGTH) mais qu'aucune
 * suggestion locale ne matche → le composant propose « Demander à Magrit ».
 */
export function hasNoMatch(query: string, suggestions: SearchSuggestion[]): boolean {
  return normalizeSearchText(query).length >= MIN_QUERY_LENGTH && suggestions.length === 0;
}
