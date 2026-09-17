/**
 * Q14-a (docs/api/CONVENTIONS.md §8.25 point 3.7 (c)) — `buildPriceNotFirmWarnings`,
 * fonction pure extraite de `useStorefrontOrderLifecycle.renewOrder`. Pas de
 * rendu React, mêmes conventions que `useDashboardOrderManagement.test.ts`
 * (orchestration pure co-localisée avec le hook, testée sans rendu).
 */

import { describe, expect, it } from 'vitest';
import { buildPriceNotFirmWarnings } from '@/modules/orders/ui/hooks/useStorefrontOrderLifecycle';
import { packLine, toPackLine, copies, packs, ONE_PACK } from '@/modules/orders/ui/storefront/cartLine';
import type { ShopProduct } from '@/modules/shops';

function makeProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: 'prod-1',
    shop_id: 'shop-1',
    product_id: null,
    name: 'Cartes de visite 85x55',
    category: 'cards',
    description: '',
    price_ht: 0,
    image_url: '',
    config: {},
    display_order: 0,
    ...overrides,
  };
}

describe('buildPriceNotFirmWarnings — point 3.7 (c)', () => {
  it('ligne dont la source re-resolue est library_cached (price_ht en cache) -> aucun avertissement', () => {
    const line = packLine(makeProduct({ price_ht: 35 }), ONE_PACK);
    expect(buildPriceNotFirmWarnings([line])).toEqual([]);
  });

  it('ligne dont la source re-resolue est clariprint (quote stocke reussi) -> aucun avertissement', () => {
    const product = makeProduct({
      price_ht: 0,
      config: { clariprintQuote: { success: true, priceHT: 42 } },
    });
    const line = packLine(product, ONE_PACK);
    expect(buildPriceNotFirmWarnings([line])).toEqual([]);
  });

  it('ligne dont la source re-resolue est prix_marche -> UN avertissement portant le nom du produit', () => {
    const product = makeProduct({ name: 'Flyer A5', price_ht: 0 });
    const line = packLine(product, ONE_PACK);
    const warnings = buildPriceNotFirmWarnings([line]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Flyer A5');
    expect(warnings[0]).toContain('prix non définitif');
  });

  it('ligne dont la source re-resolue est zero -> UN avertissement', () => {
    const product = makeProduct({ name: '', price_ht: 0, config: { quantity: 0 } });
    const line = toPackLine(product, copies(0), packs(1));
    const warnings = buildPriceNotFirmWarnings([line]);
    expect(warnings).toHaveLength(1);
  });

  it('un avertissement PAR ligne non ferme, aucun pour les lignes fermes', () => {
    const firm = packLine(makeProduct({ id: 'prod-firm', name: 'Produit ferme', price_ht: 20 }), ONE_PACK);
    const notFirmA = packLine(makeProduct({ id: 'prod-a', name: 'Produit A', price_ht: 0 }), ONE_PACK);
    const notFirmB = packLine(makeProduct({ id: 'prod-b', name: 'Produit B', price_ht: 0 }), ONE_PACK);
    const warnings = buildPriceNotFirmWarnings([firm, notFirmA, notFirmB]);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes('Produit A'))).toBe(true);
    expect(warnings.some((w) => w.includes('Produit B'))).toBe(true);
    expect(warnings.some((w) => w.includes('Produit ferme'))).toBe(false);
  });

  it('aucune ligne -> aucun avertissement', () => {
    expect(buildPriceNotFirmWarnings([])).toEqual([]);
  });
});
