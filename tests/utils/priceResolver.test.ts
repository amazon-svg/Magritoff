/**
 * Tests vitest pour src/app/utils/priceResolver.ts (Story R0 - garde-fou).
 *
 * Couvre AC4 : hierarchie clariprint > library_cached > prix_marche > zero,
 * + edge cases prix negatif filtre, quantite rebate, fingerprint.
 *
 * Zone froide critique (audit refacto 2026-05-11 §6.3) : ce module est consomme
 * par ProductCard, QuoteModal, PortalCart, PortalProduct, PricingPanel. Toute
 * regression silencieuse y est catastrophique.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateMarketPriceHT,
  formatPrice,
  resolvePrice,
} from '../../src/app/utils/priceResolver';
import type { ClariprintQuoteResult } from '../../src/app/utils/clariprintQuote';

const baseProduct = {
  name: 'Flyer A5 quadri',
  quantity: 1000,
  price_ht: 80,
  price: undefined,
};

describe('resolvePrice - hierarchie de resolution', () => {
  it('1. Clariprint valide → source=clariprint (priorite absolue)', () => {
    const quote: ClariprintQuoteResult = { success: true, priceHT: 95.50 };
    const res = resolvePrice(baseProduct, quote);
    expect(res.priceHT).toBe(95.50);
    expect(res.source).toBe('clariprint');
    expect(res.isMarketPrice).toBe(false);
  });

  it('2. Clariprint absent → fallback library_cached (product.price_ht)', () => {
    const res = resolvePrice(baseProduct, null);
    expect(res.priceHT).toBe(80);
    expect(res.source).toBe('library_cached');
    expect(res.isMarketPrice).toBe(false);
  });

  it('3. Clariprint success=false → fallback library_cached', () => {
    const quote: ClariprintQuoteResult = { success: false, error: 'API down' };
    const res = resolvePrice(baseProduct, quote);
    expect(res.source).toBe('library_cached');
  });

  it('4. Clariprint priceHT negatif → fallback library_cached (anomalie filtree)', () => {
    const quote: ClariprintQuoteResult = { success: true, priceHT: -1.2 };
    const res = resolvePrice(baseProduct, quote);
    expect(res.source).toBe('library_cached');
    expect(res.priceHT).toBe(80);
  });

  it('5. Clariprint priceHT=undefined → fallback library_cached', () => {
    const quote: ClariprintQuoteResult = { success: true } as ClariprintQuoteResult;
    const res = resolvePrice(baseProduct, quote);
    expect(res.source).toBe('library_cached');
  });

  it('6. Pas de library_cached → fallback prix_marche (champ legacy product.price)', () => {
    const product = { ...baseProduct, price_ht: undefined, price: 50 };
    const res = resolvePrice(product, null);
    expect(res.priceHT).toBe(50);
    expect(res.source).toBe('prix_marche');
    expect(res.isMarketPrice).toBe(true);
  });

  it('7. Rien en cache → estimateMarketPriceHT calcul a la volee', () => {
    const product = { name: 'Flyer A5', quantity: 1000 };
    const res = resolvePrice(product, null);
    expect(res.source).toBe('prix_marche');
    expect(res.priceHT).toBeGreaterThan(0);
    expect(res.isMarketPrice).toBe(true);
  });

  it('8. Produit null → source=zero (securite absolue)', () => {
    const res = resolvePrice(null, null);
    expect(res.source).toBe('zero');
    expect(res.priceHT).toBe(0);
  });

  it('9. Clariprint priceHT=0 → source=clariprint (gratuit explicite, pas une anomalie)', () => {
    const quote: ClariprintQuoteResult = { success: true, priceHT: 0 };
    const res = resolvePrice(baseProduct, quote);
    expect(res.source).toBe('clariprint');
    expect(res.priceHT).toBe(0);
  });

  it('10. product.price_ht negatif → ignore, fallback prix_marche', () => {
    const product = { name: 'Flyer A5', quantity: 1000, price_ht: -10 };
    const res = resolvePrice(product, null);
    expect(res.source).toBe('prix_marche');
    expect(res.priceHT).toBeGreaterThan(0);
  });
});

describe('estimateMarketPriceHT - heuristique par type produit', () => {
  it('Carte de visite 1000 ex → prix bas (0.08 * 1000 = 80 €)', () => {
    const price = estimateMarketPriceHT({ name: 'Cartes de visite', quantity: 1000 });
    // 0.08 * 1000 = 80, puis degressivite 0.9 = 72
    expect(price).toBeCloseTo(72, 0);
  });

  it('Flyer 500 ex → prix proportionnel a la quantite', () => {
    const price = estimateMarketPriceHT({ name: 'Flyer A5', quantity: 500 });
    // 0.12 * 500 = 60, pas de degressivite
    expect(price).toBe(60);
  });

  it('Degressivite volume : 5000 ex applique 0.7', () => {
    const p1000 = estimateMarketPriceHT({ name: 'Flyer A5', quantity: 1000 });
    const p5000 = estimateMarketPriceHT({ name: 'Flyer A5', quantity: 5000 });
    // ratio attendu : (5000 * 0.7) / (1000 * 0.9) = 3500 / 900 ≈ 3.89
    expect(p5000 / p1000).toBeCloseTo(3.89, 1);
  });

  it('Pelliculage finition → augmente le prix (qty * 0.05 puis degressivite)', () => {
    const sans = estimateMarketPriceHT({ name: 'Flyer A5', quantity: 500 });
    const avec = estimateMarketPriceHT({
      name: 'Flyer A5',
      quantity: 500,
      finishRecto: 'pelliculage brillant',
    });
    // qty=500 : pas de degressivite, +0.05*500 = +25 net
    expect(avec - sans).toBeCloseTo(25, 0);
  });

  it('Produit null → 0', () => {
    expect(estimateMarketPriceHT(null)).toBe(0);
  });

  it('Produit sans name → minimum tres bas (default 0.15 * 500 = 75)', () => {
    const price = estimateMarketPriceHT({ quantity: 500 });
    expect(price).toBeGreaterThan(0);
    expect(price).toBeLessThan(200);
  });
});

describe('formatPrice - rendu human-readable', () => {
  it('Prix Clariprint → format EUR simple', () => {
    const formatted = formatPrice({
      priceHT: 12.50,
      source: 'clariprint',
      isMarketPrice: false,
      isEstimation: false,
    });
    expect(formatted).toContain('12,50');
    expect(formatted).toContain('€');
    expect(formatted).not.toContain('Prix marché');
  });

  it('Prix marche → suffixe "(Prix marche)" pour transparence utilisateur', () => {
    const formatted = formatPrice({
      priceHT: 100,
      source: 'prix_marche',
      isMarketPrice: true,
      isEstimation: true,
    });
    expect(formatted).toContain('Prix marché');
  });
});
