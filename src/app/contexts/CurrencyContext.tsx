/**
 * CurrencyContext — Refacto multi-devise, TRANCHE 1.
 *
 * Point d acces unique a la devise cote composant React :
 *
 *   const currency = useCurrency();
 *   formatMoney(product.price_ht, currency)
 *
 * ─── Pourquoi un contexte plutot qu un simple `getCurrency(currentTenant)` ──
 *
 * Deux chemins de lecture coexistent dans Magrit :
 *
 *  1. Le dashboard et le portail : l utilisateur est membre du tenant, donc
 *     `currentTenant` est peuple → la devise vient de lui.
 *  2. La boutique publique `/shop/:slug` : le visiteur est ANONYME. La RLS
 *     `tenants_select` lui interdit de lire la table `tenants`, donc
 *     `currentTenant` est `null`. Sans override, un imprimeur en dollars
 *     verrait sa vitrine afficher des euros — exactement ce que la tranche 1
 *     doit supprimer.
 *
 * `PublicShop` resout donc la devise via la RPC `shop_currency(slug)` et
 * l injecte ici. Le reste de l arbre boutique (GammeTile, ProductOverlay,
 * PortalCart, StickyPriceBar…) consomme `useCurrency()` sans savoir lequel des
 * deux chemins l a alimente, et sans qu on ait a faire descendre une prop
 * `currency` a travers une dizaine de niveaux.
 *
 * Ordre de resolution : override explicite > devise du tenant courant >
 * `DEFAULT_CURRENCY`.
 */

import { createContext, ReactNode, useContext } from 'react';
import { useTenant } from './TenantContext';
import { CurrencyCode, getCurrency } from '../utils/currency';

/** `null` = pas d override, on retombe sur le tenant courant. */
const CurrencyOverrideContext = createContext<CurrencyCode | null>(null);

/**
 * Force la devise pour un sous-arbre. Utilise par la boutique publique, ou la
 * devise vient de la boutique visitee et non d une appartenance tenant.
 *
 * `currency` a `null` / `undefined` = pas d override (chargement en cours) :
 * les enfants retombent sur le tenant courant.
 */
export function CurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyCode | null | undefined;
  children: ReactNode;
}) {
  return (
    <CurrencyOverrideContext.Provider value={currency ?? null}>
      {children}
    </CurrencyOverrideContext.Provider>
  );
}

/**
 * Devise a utiliser pour tout affichage monetaire du composant appelant.
 *
 * Toujours une valeur exploitable : jamais `null`, jamais `undefined`. Un
 * composant monte avant l hydratation du tenant recoit `DEFAULT_CURRENCY`.
 */
export function useCurrency(): CurrencyCode {
  const override = useContext(CurrencyOverrideContext);
  const { currentTenant } = useTenant();
  return override ?? getCurrency(currentTenant);
}
