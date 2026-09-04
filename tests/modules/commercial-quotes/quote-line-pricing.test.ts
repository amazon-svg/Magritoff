/**
 * Tests unitaires de l arithmetique du geste commercial (E10.9 CA1-CA3) :
 * derivation `sale_price` <-> `margin_rate`, `discount_rate`,
 * `margin_variation`, et les alertes (`negative_margin`,
 * `production_cost_stale`). Fonctions pures, aucun fake de repository ni de
 * reseau — meme discipline que `single-cost-pricing-engine.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  computeQuoteLineWarnings,
  deriveLineCommercials,
  discountRateOf,
  formatCentsToMoneyNonNegative,
  MarginNotDerivableError,
  marginVariationOf,
  parseMoneyNonNegativeToCents,
  parseRateToBasisPoints,
  saleMarginRateOf,
  salePriceFromMarginRate,
} from '@/modules/commercial-quotes/application/quote-line-pricing';

describe('salePriceFromMarginRate (CA1, UpdateQuoteLineCommand.margin_rate)', () => {
  it('applique sale_price = production_price * (1 + margin_rate), arrondi au centime', () => {
    expect(salePriceFromMarginRate('100.00', '0.2000')).toBe('120.00');
    expect(salePriceFromMarginRate('42.50', '0.5000')).toBe('63.75');
  });

  it('accepte un taux negatif (vente sous le cout, CA7 amende, jamais refusee)', () => {
    expect(salePriceFromMarginRate('100.00', '-0.1000')).toBe('90.00');
  });

  it('rejette une ligne dont production_price vaut 0.00 (quote_line.margin_not_derivable)', () => {
    expect(() => salePriceFromMarginRate('0.00', '0.2000')).toThrow(MarginNotDerivableError);
  });

  it('arrondit au centime le plus proche (demi a l ecart de zero)', () => {
    // 10.005 -> arrondi a 10.01 (moitie superieure), pas 10.00.
    expect(salePriceFromMarginRate('20.01', '-0.5000')).toBe('10.01');
  });
});

describe('saleMarginRateOf (QuoteLine.sale_margin_rate)', () => {
  it('calcule (sale_price - production_price) / production_price, arrondi a 4 decimales', () => {
    expect(saleMarginRateOf('120.00', '100.00')).toBe('0.2000');
    expect(saleMarginRateOf('90.00', '100.00')).toBe('-0.1000');
  });

  it('rend null quand production_price vaut 0.00 (marge sur zero indefinie)', () => {
    expect(saleMarginRateOf('50.00', '0.00')).toBeNull();
  });
});

describe('discountRateOf (QuoteLine.discount_rate, CA2)', () => {
  it('positif quand le commercial descend sous le prix client', () => {
    expect(discountRateOf('90.00', '100.00')).toBe('0.1000');
  });

  it('negatif quand le commercial majore le prix client', () => {
    expect(discountRateOf('110.00', '100.00')).toBe('-0.1000');
  });

  it('nul quand sale_price === customer_price (etat de creation, CA1)', () => {
    expect(discountRateOf('100.00', '100.00')).toBe('0.0000');
  });

  it('rend null quand customer_price vaut 0.00 (aucune base de remise)', () => {
    expect(discountRateOf('0.00', '0.00')).toBeNull();
  });
});

describe('marginVariationOf (QuoteLine.margin_variation, CA3)', () => {
  it('calcule sale_margin_rate - applied_margin_rate', () => {
    expect(marginVariationOf('0.3000', '0.2000')).toBe('0.1000');
    expect(marginVariationOf('0.1000', '0.2000')).toBe('-0.1000');
  });

  it('nul quand le commercial n a rien touche (sale_margin_rate === applied_margin_rate)', () => {
    expect(marginVariationOf('0.2000', '0.2000')).toBe('0.0000');
  });

  it('null exactement quand sale_margin_rate est null', () => {
    expect(marginVariationOf(null, '0.2000')).toBeNull();
  });
});

describe('deriveLineCommercials — enchainement unique (CA1-CA3)', () => {
  it('un geste commercial (sale_price impose) recalcule les trois grandeurs ensemble', () => {
    const result = deriveLineCommercials({
      salePrice: '90.00',
      productionPrice: '100.00',
      customerPrice: '120.00',
      appliedMarginRate: '0.2000',
    });
    expect(result.saleMarginRate).toBe('-0.1000');
    expect(result.discountRate).toBe('0.2500'); // (120-90)/120
    expect(result.marginVariation).toBe('-0.3000'); // -0.1000 - 0.2000
  });

  it('etat de creation (sale_price = customer_price) : remise et ecart de marge nuls', () => {
    const result = deriveLineCommercials({
      salePrice: '120.00',
      productionPrice: '100.00',
      customerPrice: '120.00',
      appliedMarginRate: '0.2000',
    });
    expect(result.saleMarginRate).toBe('0.2000');
    expect(result.discountRate).toBe('0.0000');
    expect(result.marginVariation).toBe('0.0000');
  });
});

describe('computeQuoteLineWarnings (CA7 amende)', () => {
  it('negative_margin uniquement quand sale_price est STRICTEMENT inferieur a production_price', () => {
    const atCost = computeQuoteLineWarnings({
      origin: 'free',
      quantity: 1,
      chiffrageQuantity: null,
      salePrice: '100.00',
      productionPrice: '100.00',
    });
    expect(atCost.map((w) => w.code)).not.toContain('negative_margin');

    const belowCost = computeQuoteLineWarnings({
      origin: 'free',
      quantity: 1,
      chiffrageQuantity: null,
      salePrice: '99.99',
      productionPrice: '100.00',
    });
    expect(belowCost.map((w) => w.code)).toContain('negative_margin');
  });

  it('production_cost_stale uniquement sur une ligne LIEE dont la quantite diverge du chiffrage', () => {
    const stale = computeQuoteLineWarnings({
      origin: 'project_item',
      quantity: 2000,
      chiffrageQuantity: 1000,
      salePrice: '100.00',
      productionPrice: '100.00',
    });
    expect(stale.map((w) => w.code)).toContain('production_cost_stale');

    // Jamais sur une ligne LIBRE, meme avec une divergence numerique
    // (chiffrageQuantity est toujours null sur une ligne libre).
    const free = computeQuoteLineWarnings({
      origin: 'free',
      quantity: 2000,
      chiffrageQuantity: null,
      salePrice: '100.00',
      productionPrice: '100.00',
    });
    expect(free.map((w) => w.code)).not.toContain('production_cost_stale');
  });

  it('aucune alerte quand tout est nominal', () => {
    expect(
      computeQuoteLineWarnings({
        origin: 'project_item',
        quantity: 1000,
        chiffrageQuantity: 1000,
        salePrice: '120.00',
        productionPrice: '100.00',
      }),
    ).toEqual([]);
  });
});

describe('arithmetique decimale de base (jamais de flottant, CA sprint)', () => {
  it('parseMoneyNonNegativeToCents/formatCentsToMoneyNonNegative sont inverses', () => {
    expect(formatCentsToMoneyNonNegative(parseMoneyNonNegativeToCents('1234.56'))).toBe('1234.56');
    expect(formatCentsToMoneyNonNegative(0n)).toBe('0.00');
  });

  it('parseRateToBasisPoints gere le signe explicitement', () => {
    expect(parseRateToBasisPoints('0.5000')).toBe(5000n);
    expect(parseRateToBasisPoints('-0.5000')).toBe(-5000n);
  });
});
