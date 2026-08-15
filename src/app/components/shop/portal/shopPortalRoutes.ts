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

import type { AccountSection, PortalView } from './types';
import { portalRuntimePaths, shopRootPath } from '../../../surfaces/portalRuntimePaths';

export interface PortalRouteMatch {
  view: PortalView;
  /** Renseigné uniquement pour view='product'. */
  productId?: string;
  /** Réservé S7.3 — slug de gamme si le chemin est `g/:gamme`. */
  gammeSlug?: string;
  /** S7.10 — section du hub Mon compte (view='account'). */
  accountSection?: AccountSection;
  /**
   * true si le chemin d'origine n'est pas canonique (legacy, inconnu,
   * placeholder) : le composant doit remplacer l'URL (navigate replace).
   */
  redirected: boolean;
}

const ACCOUNT_SECTIONS: readonly AccountSection[] = ['orders', 'quotes', 'profile'];
const ACCOUNT_PATHS: Readonly<Record<AccountSection, string>> = Object.freeze({
  orders: portalRuntimePaths.accountOrders,
  quotes: portalRuntimePaths.accountQuotes,
  profile: portalRuntimePaths.accountProfile,
});

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

  const normalizedPath = segments.join('/');
  if (normalizedPath === portalRuntimePaths.checkout) {
    return { view: 'checkout', redirected: false };
  }
  const accountSection = ACCOUNT_SECTIONS.find((section) => ACCOUNT_PATHS[section] === normalizedPath);
  if (accountSection) {
    return { view: 'account', accountSection, redirected: false };
  }

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
      // S7.10 — alias legacy : les commandes vivent sous /account/orders
      // (le redirect PublicShop préserve la query ?tab=).
      return { view: 'account', accountSection: 'orders', redirected: true };
    case 'thank-you':
      return rest.length === 0
        ? { view: 'thankYou', redirected: false }
        : { view: 'thankYou', redirected: true };
    case 'account': {
      // /account nu ou section inconnue → commandes (canonique).
      return { view: 'account', accountSection: 'orders', redirected: true };
    }
    case 'g': {
      // S7.3 — page gamme-configurateur. Sans slug (ou trop profond) : catalog.
      const gammeSlug = rest[0];
      if (gammeSlug && rest.length === 1) {
        return { view: 'gamme', gammeSlug, redirected: false };
      }
      return { view: 'catalog', redirected: true };
    }
    default:
      return { view: 'home', redirected: true };
  }
}

/**
 * Chemin canonique (relatif à `/shop/:slug`) d'une vue portail.
 * `param` : productId (view='product') ou gammeSlug (view='gamme').
 * Round-trip garanti avec parsePortalPath (AC5).
 */
export function portalPathForView(view: PortalView, param?: string): string {
  switch (view) {
    case 'home':
      return '';
    case 'catalog':
      return 'catalog';
    case 'product':
      // Sans productId on ne peut pas adresser une fiche → catalog.
      return param ? `p/${param}` : 'catalog';
    case 'gamme':
      // S7.3 — sans slug de gamme on retombe sur le catalogue.
      return param ? `g/${param}` : 'catalog';
    case 'orders':
      // S7.10 — les commandes vivent sous Mon compte.
      return ACCOUNT_PATHS.orders;
    case 'account':
      // param = section (orders par défaut).
      return ACCOUNT_PATHS[param && ACCOUNT_SECTIONS.includes(param as AccountSection) ? param as AccountSection : 'orders'];
    case 'thankYou':
      return 'thank-you';
    case 'checkout':
      return portalRuntimePaths.checkout;
    case 'cart':
      // Le panier est un drawer, pas une page : on reste sur le catalogue.
      return 'catalog';
    default:
      return '';
  }
}

/** URL absolue d'une vue portail pour une boutique donnée. */
export function shopUrl(slug: string, view: PortalView, param?: string): string {
  const path = portalPathForView(view, param);
  const root = shopRootPath(slug);
  return path ? `${root}/${path}` : root;
}
