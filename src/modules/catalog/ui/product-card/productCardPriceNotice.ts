import type { PriceResolution } from '@/modules/clariprint/ui/helpers';
import {
  MARKET_PRICE_BADGE_LABEL,
  MARKET_PRICE_BADGE_TOOLTIP,
} from '@/modules/catalog/ui/storefront/productPriceDisplay';

export interface ProductCardPriceNotice {
  label: string;
  description: string;
}

/**
 * L'atelier montre le même avertissement que la boutique uniquement lorsque
 * le montant résolu provient du prix marché. Un prix Clariprint, un prix en
 * cache et l'absence de prix ne doivent pas être présentés comme estimés.
 */
export function resolveProductCardPriceNotice(
  source: PriceResolution['source'],
): ProductCardPriceNotice | null {
  if (source !== 'prix_marche') return null;
  return {
    label: MARKET_PRICE_BADGE_LABEL,
    description: MARKET_PRICE_BADGE_TOOLTIP,
  };
}
