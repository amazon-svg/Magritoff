import { resolvePrice, type PriceResolution } from '@/modules/clariprint/ui/helpers';
import type { ClariprintQuoteResult } from '@/modules/clariprint';
import type { CartLine } from '@/modules/orders/ui/storefront/types';

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
