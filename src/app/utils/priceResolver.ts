/**
 * Helper unique de resolution du prix a afficher pour un produit Magrit.
 *
 * Concept "Prix marche" (decision Arnaud 2026-05-09)
 * ─────────────────────────────────────────────────
 * Le PRIX MARCHE est le tier de fallback deterministe TOUJOURS disponible
 * quand Clariprint n est pas en mesure de fournir un prix (instabilite API,
 * compte non configure, anomalies -1.2 EUR / NaN / undefined).
 *
 * - Aujourd hui : valeur estimee heuristique (cf. estimateMarketPriceHT()).
 * - Demain : prix calcule par le "panel Magrit" — agregat anonymise des
 *   parcs imprimeurs Pro souscrits, alimente automatiquement par Clariprint
 *   (cf. Vision Produit Magrit, roadmap V2+ panel Magrit).
 *
 * Cette valeur est affichee dans l UI avec un badge "Prix marche" pour que
 * l utilisateur sache que ce n est pas le prix exact Clariprint final.
 *
 * Hierarchie de resolution (par ordre de preference) :
 *  1. clariprintQuote.priceHT — source officielle, validee par sanitization
 *  2. product.price_ht — prix unitaire HT en cache bibliotheque (lui-meme
 *     issu d un calcul precedent Clariprint ou prix marche)
 *  3. prix_marche — fallback estimateMarketPriceHT() heuristique
 *  4. zero — securite, jamais affiche tel quel
 *
 * Avant ce module, chaque composant (ProductCard, QuoteModal, PortalCart,
 * PricingPanel, etc.) implementait sa propre hierarchie avec divergences
 * silencieuses (cf. PRICE_SOURCES.md, story S0.2).
 *
 * Decisions Arnaud (2026-05-09, sortie S0.2 + fix prix marche) :
 *   - En cas d anomalie Clariprint (validateClariprintResponse → success=false),
 *     on retombe sur prix_marche avec badge "Prix marche" (Decision 1 = C).
 *   - Helper cree maintenant pour beneficier de la proprete immediate (Decision 2 = OK).
 *   - PricingPanel repare pour utiliser ce helper (Decision 3 = A).
 *   - PortalProduct debride : bouton panier actif meme sans Clariprint, en
 *     utilisant le prix marche (decision Arnaud 2026-05-09 fix prix marche).
 */

import type { ClariprintQuoteResult } from './clariprintQuote';

export type PriceSource =
  | 'clariprint'      // Source officielle Clariprint, validee
  | 'library_cached'  // product.price_ht en cache bibliotheque
  | 'prix_marche'     // Fallback prix marche (heuristique aujourd hui, panel Magrit demain)
  | 'zero';           // Securite, jamais affiche tel quel

export interface PriceResolution {
  /** Prix HT a afficher, en EUR */
  priceHT: number;
  /** Source du prix resolu, pour decider de l affichage badge */
  source: PriceSource;
  /** True quand l utilisateur doit voir un badge "Prix marche" */
  isMarketPrice: boolean;
  /**
   * @deprecated Utiliser isMarketPrice (renome pour aligner avec le concept
   * structurant "Prix marche"). Maintenu temporairement pour compatibilite.
   */
  isEstimation: boolean;
}

/**
 * Calcule un prix marche estime pour un produit Magrit, sans dependre de
 * Clariprint. Heuristique basee sur le type de produit (carte, flyer,
 * brochure, etc.), la quantite, le grammage, le verso et les finitions.
 *
 * Cette fonction sera REMPLACEE en V2+ par un appel au panel Magrit
 * (table prix_marche_panel ou equivalent) une fois que les parcs imprimeurs
 * souscrits seront en nombre suffisant pour produire des agregats fiables.
 *
 * En attendant, elle fournit toujours une valeur > 0 (sauf cas degeneres
 * sans nom ni quantite, retour par defaut tres bas).
 */
export function estimateMarketPriceHT(product: any, quantityOverride?: number): number {
  if (!product) return 0;

  // Resolution config Clariprint imbriquee si presente
  const cfg = product.clariprintData ?? product.config?.clariprintData ?? product.config ?? product;

  // P18 v2 (2026-06-24) : quantityOverride prioritaire (quantite choisie dans
  // l'overlay) sur la quantite figee du produit. Corrige le "prix pour 1" quand
  // l'utilisateur change la quantite et que le devis Clariprint live echoue.
  const qty =
    Number.isFinite(quantityOverride) && (quantityOverride as number) > 0
      ? (quantityOverride as number)
      : Number(cfg.quantity ?? product.quantity ?? 500);
  const name = String(product.name ?? cfg.name ?? '').toLowerCase();

  let base = 0.15; // Defaut universel (EUR / unite)
  if (name.includes('carte') && name.includes('visite')) base = 0.08;
  else if (name.includes('flyer') || name.includes('tract')) base = 0.12;
  else if (name.includes('brochure') || name.includes('catalogue')) base = 1.5;
  else if (name.includes('affiche') || name.includes('poster')) base = 5.0;
  else if (name.includes('depliant') || name.includes('dépliant')) base = 0.25;
  else if (name.includes('etiquette') || name.includes('étiquette')) base = 0.04;
  else if (name.includes('kakemono') || name.includes('roll-up')) base = 35.0;
  else if (name.includes('packaging') || name.includes('boite')) base = 0.6;

  let price = base * qty;

  const weight = Number(cfg.weight ?? product.weight ?? 0);
  if (weight > 300) price *= 1.3;
  else if (weight > 200) price *= 1.15;

  const printingVerso = String(
    product.printing?.verso ?? cfg.back_colors ?? '',
  ).toLowerCase();
  if (printingVerso && printingVerso !== 'sans impression' && printingVerso !== '0') {
    price *= 1.4;
  }

  const finishRecto = String(
    product.finishRecto ?? cfg.finishing_front ?? '',
  ).toLowerCase();
  if (finishRecto.includes('pelliculage')) price += qty * 0.05;

  // Degressivite par volume
  if (qty >= 5000) price *= 0.7;
  else if (qty >= 2000) price *= 0.8;
  else if (qty >= 1000) price *= 0.9;

  // Plancher a 1 EUR pour eviter zero (sauf produit explicitement sans nom)
  if (price < 1 && name) price = 1;

  return Math.round(price * 100) / 100;
}

/**
 * Resout le prix HT a afficher pour un produit, selon la hierarchie standard.
 *
 * @param product Le produit Magrit (catalogue, panier, devis, etc.)
 * @param clariprintQuote Resultat eventuel d un appel Clariprint (deja valide
 *                        via validateClariprintResponse upstream)
 */
export function resolvePrice(
  product: any,
  clariprintQuote?: ClariprintQuoteResult | null,
): PriceResolution {
  // 1. Clariprint — source officielle si validee
  if (
    clariprintQuote?.success &&
    typeof clariprintQuote.priceHT === 'number' &&
    Number.isFinite(clariprintQuote.priceHT) &&
    clariprintQuote.priceHT >= 0
  ) {
    return {
      priceHT: clariprintQuote.priceHT,
      source: 'clariprint',
      isMarketPrice: false,
      isEstimation: false,
    };
  }

  // 2. Prix bibliotheque en cache (price_ht) — issu d un calcul precedent
  if (
    typeof product?.price_ht === 'number' &&
    Number.isFinite(product.price_ht) &&
    product.price_ht > 0
  ) {
    return {
      priceHT: product.price_ht,
      source: 'library_cached',
      isMarketPrice: false,
      isEstimation: false,
    };
  }

  // 3. Prix marche — fallback heuristique (ou panel Magrit en V2+)
  // Champ legacy product.price (defini par certains call-sites avant l adoption
  // du module priceResolver) → traite comme prix marche.
  if (
    typeof product?.price === 'number' &&
    Number.isFinite(product.price) &&
    product.price > 0
  ) {
    return {
      priceHT: product.price,
      source: 'prix_marche',
      isMarketPrice: true,
      isEstimation: true, // legacy compat
    };
  }

  // Calcul a la volee si rien n est cache
  const marketPrice = estimateMarketPriceHT(product);
  if (marketPrice > 0) {
    return {
      priceHT: marketPrice,
      source: 'prix_marche',
      isMarketPrice: true,
      isEstimation: true, // legacy compat
    };
  }

  // 4. Securite absolue
  return {
    priceHT: 0,
    source: 'zero',
    isMarketPrice: true,
    isEstimation: true, // legacy compat
  };
}

/**
 * Format human-readable d un PriceResolution.
 * Exemple : "12,50 EUR" ou "12,50 EUR (Prix marche)"
 */
export function formatPrice(resolution: PriceResolution, locale = 'fr-FR'): string {
  const formatted = resolution.priceHT.toLocaleString(locale, {
    style: 'currency',
    currency: 'EUR',
  });
  return resolution.isMarketPrice ? `${formatted} (Prix marché)` : formatted;
}
