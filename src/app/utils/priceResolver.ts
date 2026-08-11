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
 * ZONE MONETAIRE (arbitrage Arnaud 2026-08-10) : le prix marche est calibre
 * PAR DEVISE, sur les prix d imprimeurs travaillant dans cette devise. Il
 * n est jamais converti. Une devise sans zone calibree ne recoit AUCUN prix
 * marche — la cascade tombe alors sur `zero` et l ecran affiche « Prix sur
 * demande ». Voir `marketPriceZones.ts`.
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
import { DEFAULT_CURRENCY, formatMoney, type CurrencyCode } from './currency';
import {
  resolveMarketPriceFamily,
  resolveMarketPriceZone,
} from './marketPriceZones';

export type PriceSource =
  | 'clariprint'      // Source officielle Clariprint, validee
  | 'library_cached'  // product.price_ht en cache bibliotheque
  | 'prix_marche'     // Fallback prix marche (heuristique aujourd hui, panel Magrit demain)
  | 'zero';           // Securite, jamais affiche tel quel

export interface PriceResolution {
  /** Prix HT a afficher, libelle dans la devise de l imprimeur (cf. currency.ts) */
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
 * Retourne 0 dans trois cas : produit absent, cas degenere sans nom ni
 * quantite, et — depuis l arbitrage du 2026-08-10 — devise sans ZONE
 * MONETAIRE calibree. Ce dernier cas est normal : il vaut mieux ne pas servir
 * de prix que d en servir un calibre dans une autre monnaie.
 */
export function estimateMarketPriceHT(
  product: any,
  quantityOverride?: number,
  /**
   * Devise de l imprimeur — determine la ZONE MONETAIRE de calibration
   * (arbitrage Arnaud 2026-08-10, cf. `marketPriceZones.ts`).
   *
   * Retourne 0 quand la devise n a pas de zone calibree : l imprimeur voit
   * alors « Prix sur demande » plutot qu une valeur calibree dans une autre
   * monnaie et simplement relibellee.
   */
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number {
  if (!product) return 0;

  // Zone monetaire : pas de zone calibree → pas de prix marche. C est un etat
  // normal du systeme, pas une erreur (cf. resolveMarketPriceZone).
  const zone = resolveMarketPriceZone(currency);
  if (!zone?.basePerUnit) return 0;

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

  // Prix de base : niveau propre a la zone, famille propre au produit.
  const base = zone.basePerUnit[resolveMarketPriceFamily(name)];

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

  // Plancher de la zone, pour eviter zero (sauf produit explicitement sans nom)
  if (price < zone.floor && name) price = zone.floor;

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
  /**
   * Devise de l imprimeur — selectionne la zone monetaire du prix marche
   * (arbitrage Arnaud 2026-08-10). Sans zone calibree pour cette devise, la
   * cascade tombe sur `zero` : « Prix sur demande » plutot qu un prix faux.
   */
  currency: CurrencyCode = DEFAULT_CURRENCY,
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
  const marketPrice = estimateMarketPriceHT(product, undefined, currency);
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
 * Exemple : "12,50 €" ou "12,50 € (Prix marche)".
 *
 * Multi-devise tranche 1 : la devise est desormais un parametre OBLIGATOIRE.
 * Avant, cette fonction forcait `currency: 'EUR'` — c etait l un des deux
 * helpers de formatage concurrents du projet. Le formatage lui-meme est
 * delegue a `formatMoney()` : ici on ne fait plus que porter la mention
 * « Prix marche ».
 *
 * La devise vient de `getCurrency(currentTenant)` cote util, `useCurrency()`
 * cote composant React.
 */
export function formatPrice(
  resolution: PriceResolution,
  currency: CurrencyCode,
  locale = 'fr-FR',
): string {
  const formatted = formatMoney(resolution.priceHT, currency, { locale });
  return resolution.isMarketPrice ? `${formatted} (Prix marché)` : formatted;
}
