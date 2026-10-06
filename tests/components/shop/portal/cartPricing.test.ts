import { describe, expect, it } from 'vitest';
import {
  computePortalCartPricingSummary,
  computePortalCartTotalHt,
  resolveCartLinePricing,
} from '@/modules/orders/ui/storefront/cartPricing';
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

  it('signale un panier composé uniquement d une ligne à prix marché', () => {
    const marketLine = line(0, 2);
    const summary = computePortalCartPricingSummary([marketLine], 0.2);

    expect(summary.hasMarketPriceLine).toBe(true);
    expect(summary.subtotalHt).toBe(resolveCartLinePricing(marketLine).lineTotalHt);
    expect(summary.totalTtc).toBe(summary.subtotalHt + summary.taxAmount);
  });

  it('ne signale pas un panier dont toutes les lignes portent un prix ferme', () => {
    const summary = computePortalCartPricingSummary([line(42), line(18, 2)], 0.2);

    expect(summary.subtotalHt).toBe(78);
    expect(summary.taxAmount).toBeCloseTo(15.6);
    expect(summary.totalTtc).toBeCloseTo(93.6);
    expect(summary.hasMarketPriceLine).toBe(false);
  });

  it('signale un panier mixte sans modifier ses totaux', () => {
    const firmLine = line(42);
    const marketLine = line(0);
    const mixed = computePortalCartPricingSummary([firmLine, marketLine], 0.2);
    const firmOnly = computePortalCartPricingSummary([firmLine], 0.2);
    const marketOnly = computePortalCartPricingSummary([marketLine], 0.2);

    expect(mixed.hasMarketPriceLine).toBe(true);
    expect(mixed.subtotalHt).toBe(firmOnly.subtotalHt + marketOnly.subtotalHt);
    expect(mixed.taxAmount).toBeCloseTo(firmOnly.taxAmount + marketOnly.taxAmount);
    expect(mixed.totalTtc).toBeCloseTo(firmOnly.totalTtc + marketOnly.totalTtc);
  });

  it('traite un devis fournisseur négatif écarté comme un prix marché', () => {
    const rejectedQuote = line(0);
    rejectedQuote.product.config = {
      quantity: 500,
      clariprintQuote: { success: true, priceHT: -1 },
    };

    const summary = computePortalCartPricingSummary([rejectedQuote], 0.2);
    expect(summary.hasMarketPriceLine).toBe(true);
    expect(summary.subtotalHt).toBeGreaterThan(0);
  });
});
