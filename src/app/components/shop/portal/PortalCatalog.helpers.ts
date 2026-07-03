/**
 * Helpers purs PortalCatalog (Stories S-CONSO-4 + S-CONSO-5, Sprint 4 Phase 2).
 *
 *  - filterProductsByTextQuery : filter case-insensitive substring sur name +
 *    description + gamme.name. Sert de fallback automatique quand claude-proxy
 *    timeout (S-CONSO-4).
 *  - sortProductsBy : tri grille catalogue par 'display_order' | 'price_asc' |
 *    'price_desc' | 'newest' (S-CONSO-5, design Sally Select shadcn).
 *  - sortKeyStorageKey : helper localStorage clé par slug (S-CONSO-5).
 *
 * Exportes purs pour testabilite vitest.
 */

import type { ShopProduct } from '../../../contexts/ShopsContext';
import type { Gamme } from '../../../utils/productEnrichment';
import { resolveGamme } from '../../../utils/productEnrichment';

// ─── S-CONSO-4 : filter texte (fallback IA down) ─────────────────────────────

/**
 * Filter case-insensitive substring sur name + description + gamme.name
 * resolu via productEnrichment. Pas `kind` (jargon technique B2B Sally).
 * Si query vide -> retourne tous les products.
 */
export function filterProductsByTextQuery(
  products: ShopProduct[],
  query: string,
  gammes: Gamme[] = [],
): ShopProduct[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return products;

  return products.filter((p) => {
    const gamme = gammes.length > 0 ? resolveGamme(p.config, gammes, p.name) : null;
    const haystack = [
      p.name,
      p.description ?? '',
      gamme?.name ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

// ─── S-CONSO-5 : tri grille catalogue ────────────────────────────────────────

export type SortKey = 'display_order' | 'price_asc' | 'price_desc' | 'newest';

/**
 * Liste des options tri pour le Select shadcn. Conservee dans l ordre d affichage.
 */
export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'display_order', label: 'Pertinence (défaut)' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'newest', label: 'Nouveautés' },
];

export const DEFAULT_SORT_KEY: SortKey = 'display_order';

/**
 * Tri non-mutant. Cle 'display_order' = curation atelier (respect Magrit MVP).
 * Fallback gracieux pour les fields undefined/null.
 */
export function sortProductsBy(products: ShopProduct[], sortKey: SortKey): ShopProduct[] {
  const copy = [...products];
  switch (sortKey) {
    case 'price_asc':
      copy.sort((a, b) => (a.price_ht ?? 0) - (b.price_ht ?? 0));
      break;
    case 'price_desc':
      copy.sort((a, b) => (b.price_ht ?? 0) - (a.price_ht ?? 0));
      break;
    case 'newest':
      copy.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      break;
    case 'display_order':
    default:
      copy.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }
  return copy;
}

/**
 * Cle localStorage du sortKey par boutique. Permet de retrouver le tri
 * prefere de l acheteur au retour sur la meme boutique (pas global tenant).
 */
export function sortKeyStorageKey(slug: string): string {
  return `magrit.shop.${slug}.sort`;
}

export function loadSortKey(slug: string): SortKey {
  try {
    const raw = localStorage.getItem(sortKeyStorageKey(slug));
    if (raw && SORT_OPTIONS.some((o) => o.value === raw)) {
      return raw as SortKey;
    }
  } catch {
    /* localStorage indispo (SSR ou private browsing) : fallback default */
  }
  return DEFAULT_SORT_KEY;
}

export function saveSortKey(slug: string, key: SortKey): void {
  try {
    if (key === DEFAULT_SORT_KEY) {
      localStorage.removeItem(sortKeyStorageKey(slug));
    } else {
      localStorage.setItem(sortKeyStorageKey(slug), key);
    }
  } catch {
    /* noop */
  }
}
