import { describe, expect, it } from 'vitest';
import { resolvePrice } from '@/modules/clariprint/ui/helpers';
import {
  MARKET_PRICE_BADGE_LABEL,
  MARKET_PRICE_BADGE_TOOLTIP,
} from '@/modules/catalog/ui/storefront';
import { resolveProductCardPriceNotice } from '@/modules/catalog/ui/product-card/productCardPriceNotice';

describe('resolveProductCardPriceNotice — E1.fix-TF51', () => {
  it('rend le libellé et le texte partagés pour un prix marché', () => {
    expect(resolveProductCardPriceNotice('prix_marche')).toEqual({
      label: MARKET_PRICE_BADGE_LABEL,
      description: MARKET_PRICE_BADGE_TOOLTIP,
    });
  });

  it.each(['clariprint', 'library_cached', 'zero'] as const)(
    'ne rend aucun avertissement pour la source %s',
    (source) => {
      expect(resolveProductCardPriceNotice(source)).toBeNull();
    },
  );

  it('conserve le badge après une réponse Clariprint invalide et le retire après succès', () => {
    const product = { name: 'Cartes de visite', quantity: 1_000 };
    const rejected = resolvePrice(product, { success: true, priceHT: -1 });
    const confirmed = resolvePrice(product, { success: true, priceHT: 72 });

    expect(rejected.source).toBe('prix_marche');
    expect(resolveProductCardPriceNotice(rejected.source)).not.toBeNull();
    expect(confirmed.source).toBe('clariprint');
    expect(resolveProductCardPriceNotice(confirmed.source)).toBeNull();
  });
});
