import { describe, expect, it } from 'vitest';
import { computePortalCartTotalHt, resolveCartLinePricing } from '@/modules/orders/ui/storefront/cartPricing';
import type { CartLine } from '@/modules/orders/ui/storefront/types';

function line(priceHt: number, qty = 1): CartLine {
  return {
    qty,
    product: {
      id: 'product-1',
      shop_id: 'shop-1',
      product_id: null,
      name: 'Carterie',
      category: 'Carterie',
      description: '',
      price_ht: priceHt,
      image_url: '',
      config: { quantity: 500 },
      display_order: 0,
      created_at: '2026-08-19T00:00:00.000Z',
      tenant_id: 'tenant-1',
      gamme_slug: null,
    },
  };
}

describe('cartPricing', () => {
  it('réutilise le prix catalogue lorsqu il est disponible', () => {
    expect(resolveCartLinePricing(line(42, 2))).toMatchObject({
      unitPriceHt: 42,
      lineTotalHt: 84,
    });
  });

  it('résout un même prix marché non nul pour le panier, le checkout et la commande', () => {
    const quickAdd = line(0);
    const pricing = resolveCartLinePricing(quickAdd);

    expect(pricing.resolution.source).toBe('prix_marche');
    expect(pricing.unitPriceHt).toBeGreaterThan(0);
    expect(computePortalCartTotalHt([quickAdd])).toBe(pricing.lineTotalHt);
  });
});
