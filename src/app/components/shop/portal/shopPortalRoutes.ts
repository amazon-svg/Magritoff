/**
 * S7.1 — Routage route-driven du portail boutique (ADR §4.19-1).
 *
 * `/shop/:slug/*` : le splat (chemin après le slug) détermine la vue rendue
 * par PublicShop. Ces helpers sont PURS (pas de DOM, pas de router) pour
 * rester testables vitest.
 *
 * Mapping canonique :
 *   ''            → home
 *   'catalog'     → catalog
 *   'p/:productId'→ product   (lookup dans le catalogue chargé côté composant)
 *   'orders'      → orders    (`?tab=` géré par PortalOrders, hors scope ici)
 *   'thank-you'   → thankYou
 *   'account'…    → orders    (placeholder jusqu'à AccountHub S7.10)
 *   'g/:gamme'    → réservé S7.3 (page gamme) — replié sur catalog en attendant
 *   inconnu       → home      (jamais de 404 interne, AC3)
 */

import type { PortalView } from './types';

export interface PortalRouteMatch {
  view: PortalView;
  /** Renseigné uniquement pour view='product'. */
  productId?: string;
  /** Réservé S7.3 — slug de gamme si le chemin est `g/:gamme`. */
  gammeSlug?: string;
  /**
   * true si le chemin d'origine n'est pas canonique (legacy, inconnu,
   * placeholder) : le composant doit remplacer l'URL (navigate replace).
   */
  redirected: boolean;
}

/** Normalise un splat react-router : slashes de tête/queue, query exclue. */
function normalizeSplat(splat: string | undefined): string[] {
  return (splat ?? '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Résout le splat d'URL en vue portail. Ne jette jamais (AC3).
 */
export function parsePortalPath(splat: string | undefined): PortalRouteMatch {
  const segments = normalizeSplat(splat);

  if (segments.length === 0) return { view: 'home', redirected: false };

  const [head, ...rest] = segments;

  switch (head) {
    case 'catalog':
      return rest.length === 0
        ? { view: 'catalog', redirected: false }
        : { view: 'catalog', redirected: true };
    case 'p': {
      const productId = rest[0];
      if (productId && rest.length === 1) {
        return { view: 'product', productId, redirected: false };
      }
      // `p` sans id (ou trop profond) → catalog
      return { view: 'catalog', redirected: true };
    }
    case 'orders':
      return rest.length === 0
        ? { view: 'orders', redirected: false }
        : { view: 'orders', redirected: true };
    case 'thank-you':
      return rest.length === 0
        ? { view: 'thankYou', redirected: false }
        : { view: 'thankYou', redirected: true };
    case 'account':
      // Placeholder S7.10 : toutes les URLs compte pointent sur les commandes.
      return { view: 'orders', redirected: true };
    case 'g': {
      // Réservé S7.3 (page gamme). En attendant : catalog, slug conservé pour
      // que S7.3 n'ait qu'à brancher la vue sans retoucher le parseur.
      const gammeSlug = rest[0];
      return { view: 'catalog', gammeSlug, redirected: true };
    }
    default:
      return { view: 'home', redirected: true };
  }
}

/**
 * Chemin canonique (relatif à `/shop/:slug`) d'une vue portail.
 * Round-trip garanti avec parsePortalPath (AC5).
 */
export function portalPathForView(view: PortalView, productId?: string): string {
  switch (view) {
    case 'home':
      return '';
    case 'catalog':
      return 'catalog';
    case 'product':
      // Sans productId on ne peut pas adresser une fiche → catalog.
      return productId ? `p/${productId}` : 'catalog';
    case 'orders':
      return 'orders';
    case 'thankYou':
      return 'thank-you';
    case 'cart':
      // Le panier est un drawer, pas une page : on reste sur le catalogue.
      return 'catalog';
    default:
      return '';
  }
}

/** URL absolue d'une vue portail pour une boutique donnée. */
export function shopUrl(slug: string, view: PortalView, productId?: string): string {
  const path = portalPathForView(view, productId);
  return path ? `/shop/${slug}/${path}` : `/shop/${slug}`;
}
