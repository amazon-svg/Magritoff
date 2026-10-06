import { resolvePrice, type PriceResolution } from '@/modules/clariprint/ui/helpers';
import type { ClariprintQuoteResult } from '@/modules/clariprint';
import type { CartLine } from '@/modules/orders/ui/storefront/types';
import { applyTax, extractTaxAmount } from '@/modules/orders/ui/helpers/tax';

export interface CartLinePricing {
  resolution: PriceResolution;
  unitPriceHt: number;
  lineTotalHt: number;
}

/**
 * Résout le prix canonique d'une ligne de panier.
 *
 * Les ajouts rapides du catalogue peuvent conserver `price_ht = 0` tant
 * qu'aucun devis Clariprint n'a été demandé. Dans ce cas, le panier affiche
 * le prix marché déterministe. Tous les consommateurs du panier (drawer,
 * checkout et création de commande) doivent réutiliser exactement ce prix.
 */
export function resolveCartLinePricing(line: CartLine): CartLinePricing {
  const clariprintQuote = (
    line.product.config as { clariprintQuote?: ClariprintQuoteResult } | null | undefined
  )?.clariprintQuote ?? null;
  const resolution = resolvePrice(line.product, clariprintQuote);
  return {
    resolution,
    unitPriceHt: resolution.priceHT,
    lineTotalHt: resolution.priceHT * line.qty,
  };
}

export function computePortalCartTotalHt(cart: readonly CartLine[]): number {
  return cart.reduce((total, line) => total + resolveCartLinePricing(line).lineTotalHt, 0);
}

export interface PortalCartPricingSummary {
  subtotalHt: number;
  taxAmount: number;
  totalTtc: number;
  hasMarketPriceLine: boolean;
}

/**
 * Résumé pur utilisé par le panier : l'avertissement sur un prix estimé est
 * dérivé des mêmes résolutions que les montants, sans modifier les totaux.
 */
export function computePortalCartPricingSummary(
  cart: readonly CartLine[],
  taxRate: number,
): PortalCartPricingSummary {
  const pricing = cart.map(resolveCartLinePricing);
  const subtotalHt = pricing.reduce((total, line) => total + line.lineTotalHt, 0);
  return {
    subtotalHt,
    taxAmount: extractTaxAmount(subtotalHt, taxRate),
    totalTtc: applyTax(subtotalHt, taxRate),
    hasMarketPriceLine: pricing.some((line) => line.resolution.isMarketPrice),
  };
}
