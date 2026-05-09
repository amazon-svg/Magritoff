/**
 * Helper unique de résolution du prix à afficher pour un produit Magrit.
 *
 * Avant ce module, chaque composant (ProductCard, QuoteModal, PortalCart,
 * PricingPanel, etc.) implémentait sa propre hiérarchie de fallback, avec
 * des divergences silencieuses (cf. PRICE_SOURCES.md, story S0.2).
 *
 * Désormais : un seul point de vérité pour la règle.
 *
 * Hiérarchie (par ordre de préférence) :
 *  1. clariprintQuote.priceHT (si success=true ET valeur valide après sanitization)
 *  2. product.price_ht (libraires : prix unitaire HT en cache)
 *  3. estimatedPrice / product.price (fallback pédagogique — TODO: à supprimer
 *     après intégration Clariprint complète)
 *  4. 0 (sécurité)
 *
 * La source résolue est exposée pour que les composants puissent afficher
 * un badge "Estimation" / "Mode démo" quand le fallback est utilisé.
 *
 * Décisions Arnaud (2026-05-09, sortie S0.2) :
 *   - En cas d'anomalie Clariprint (validateClariprintResponse → success=false),
 *     on retombe sur estimatedPrice avec badge "Estimation" (Décision 1 = C).
 *   - Helper créé maintenant pour bénéficier de la propreté immédiate (Décision 2 = OK).
 *   - PricingPanel sera réparé pour utiliser ce helper (Décision 3 = A).
 *
 * TODO: une fois l'intégration Clariprint stabilisée et fiable, supprimer
 * la branche fallback estimedPrice / product.price (la source 3 ci-dessus).
 */

import type { ClariprintQuoteResult } from './clariprintQuote';

export type PriceSource =
  | 'clariprint'      // Source officielle, validée
  | 'library_cached'  // product.price_ht en cache bibliothèque
  | 'estimated'       // Fallback pédagogique (à afficher avec badge)
  | 'zero';           // Sécurité, jamais affiché tel quel

export interface PriceResolution {
  /** Prix HT à afficher, en € */
  priceHT: number;
  /** Source du prix résolu, pour décider de l'affichage badge */
  source: PriceSource;
  /** True quand l'utilisateur doit voir un badge "Estimation" / "Mode démo" */
  isEstimation: boolean;
}

/**
 * Résout le prix HT à afficher pour un produit, selon la hiérarchie standard.
 *
 * @param product Le produit Magrit (catalogue, panier, devis, etc.)
 * @param clariprintQuote Résultat éventuel d'un appel Clariprint (déjà validé
 *                        via validateClariprintResponse upstream)
 */
export function resolvePrice(
  product: any,
  clariprintQuote?: ClariprintQuoteResult | null,
): PriceResolution {
  // 1. Clariprint — source officielle si validée
  if (
    clariprintQuote?.success &&
    typeof clariprintQuote.priceHT === 'number' &&
    Number.isFinite(clariprintQuote.priceHT) &&
    clariprintQuote.priceHT >= 0
  ) {
    return {
      priceHT: clariprintQuote.priceHT,
      source: 'clariprint',
      isEstimation: false,
    };
  }

  // 2. Prix bibliothèque en cache (price_ht)
  if (
    typeof product?.price_ht === 'number' &&
    Number.isFinite(product.price_ht) &&
    product.price_ht > 0
  ) {
    return {
      priceHT: product.price_ht,
      source: 'library_cached',
      isEstimation: false,
    };
  }

  // 3. Fallback estimé (product.price ou estimatedPrice résolu en amont)
  if (
    typeof product?.price === 'number' &&
    Number.isFinite(product.price) &&
    product.price >= 0
  ) {
    return {
      priceHT: product.price,
      source: 'estimated',
      isEstimation: true,
    };
  }

  // 4. Sécurité absolue
  return {
    priceHT: 0,
    source: 'zero',
    isEstimation: true,
  };
}

/**
 * Format human-readable d'un PriceResolution.
 * Exemple : "12,50 €" ou "12,50 € (Estimation)"
 */
export function formatPrice(resolution: PriceResolution, locale = 'fr-FR'): string {
  const formatted = resolution.priceHT.toLocaleString(locale, {
    style: 'currency',
    currency: 'EUR',
  });
  return resolution.isEstimation ? `${formatted} (Estimation)` : formatted;
}
