/**
 * Helper TVA centralise (Story R0 - Spike H, refacto 2026-05).
 *
 * Avant ce module, le taux 20 % etait hardcode dans 22+ endroits (ProductCard,
 * QuoteModal, CartButton, PublicShop, CartContext, PortalCart, PortalProduct,
 * PortalHome, ProductOverlay, quote.ts, shopExport.ts, schemaOrg.ts).
 * Audit refacto 2026-05-11 bug critique B1 : risque conformite fiscale DGFIP
 * en cas de tenant DOM-TOM / franchise / export.
 *
 * Maintenant : un seul endroit, `getTaxRate(tenant)`, source de verite.
 *
 * La colonne `tenants.tax_regime` (migration 20260511_02_R0) porte le regime,
 * default `metropole_fr` pour ne rien casser sur les tenants existants.
 */

export type TaxRegime =
  | 'metropole_fr'  // TVA standard 20 %
  | 'dom_tom'       // TVA reduite 8.5 % (Reunion, Martinique, Guadeloupe)
  | 'franchise_tva' // TVA non applicable art. 293 B CGI (auto-entrepreneur)
  | 'export_eu'     // Export UE : autoliquidation acheteur, 0 %
  | 'export_world'; // Export hors UE : exoneration, 0 %

/**
 * Taux par regime. Valeurs aligners sur la legislation FR en vigueur 2026-05.
 * Toute modification doit faire l'objet d'une story dediee + ADR.
 */
const TAX_RATE_BY_REGIME: Record<TaxRegime, number> = {
  metropole_fr: 0.20,
  dom_tom: 0.085,
  franchise_tva: 0,
  export_eu: 0,
  export_world: 0,
};

/**
 * Taux de TVA par defaut quand aucun tenant n'est en scope.
 *
 * Utilise par les utils non-React (`schemaOrg.ts`, `shopExport.ts`, `quote.ts`)
 * et par les fallbacks defensifs cote composant.
 *
 * Le `metropole_fr` (20 %) reste le cas dominant Magrit en 2026 (audit refacto).
 */
export const DEFAULT_TAX_RATE = TAX_RATE_BY_REGIME.metropole_fr;

/**
 * Forme minimale d'un tenant attendue. Compatible avec `Tenant` et
 * `TenantWithMembership` definis dans `TenantContext.tsx`.
 *
 * Accepte `null` / `undefined` pour permettre des call-sites defensifs
 * (composants montes avant que le contexte tenant ne soit hydrate).
 */
export interface TaxableTenant {
  tax_regime?: TaxRegime | null;
}

/**
 * Resout le taux de TVA applicable au tenant.
 *
 * - `null` / `undefined` / `tax_regime` absent → `DEFAULT_TAX_RATE` (20 %).
 * - Regime inconnu (typage etire par cast) → `DEFAULT_TAX_RATE` (defensif).
 *
 * Retourne un nombre decimal (`0.20`, pas `20`).
 */
export function getTaxRate(tenant: TaxableTenant | null | undefined): number {
  const regime = tenant?.tax_regime;
  if (!regime) return DEFAULT_TAX_RATE;
  const rate = TAX_RATE_BY_REGIME[regime as TaxRegime];
  return typeof rate === 'number' ? rate : DEFAULT_TAX_RATE;
}

/**
 * Applique la TVA a un montant HT : `amount * (1 + taxRate)`.
 *
 * Centralise le pattern `priceHT * 1.2` qui fleurissait partout dans le code.
 */
export function applyTax(amountHT: number, taxRate: number): number {
  return amountHT * (1 + taxRate);
}

/**
 * Calcule le montant de TVA : `amount * taxRate`.
 *
 * Centralise le pattern `priceHT * 0.2` qui fleurissait partout dans le code.
 */
export function extractTaxAmount(amountHT: number, taxRate: number): number {
  return amountHT * taxRate;
}

/**
 * Formate un taux en pourcentage human-readable.
 *
 * Exemples :
 *   formatTaxLabel(0.20)  → "20 %"
 *   formatTaxLabel(0.085) → "8,5 %"
 *   formatTaxLabel(0)     → "0 %"
 */
export function formatTaxLabel(taxRate: number, locale = 'fr-FR'): string {
  const pct = taxRate * 100;
  // Sans decimale si entier, sinon 1 decimale (8.5 % par exemple)
  const formatted = Number.isInteger(pct)
    ? pct.toLocaleString(locale, { maximumFractionDigits: 0 })
    : pct.toLocaleString(locale, { maximumFractionDigits: 1 });
  return `${formatted} %`;
}
