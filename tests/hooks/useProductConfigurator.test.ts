/**
 * Tests unitaires S7.2 — helpers purs du moteur useProductConfigurator.
 *
 * Convention useOrderRoles : le hook intègre l'appel réseau ClariprintAdapter,
 * validé en E2E/smoke ; les décisions (machine Phase, cascade prix, disabled)
 * sont des fonctions pures testées ici.
 */

import { describe, expect, it } from 'vitest';
import {
  buildConfiguredProduct,
  computeErrorPhase,
  computeSuccessPhase,
  isAddDisabled,
  resolveFinalPriceHT,
  type ConfiguratorPhase,
} from '@/modules/clariprint/ui/hooks/useProductConfigurator';
import { extractInitialOptions } from '@/modules/catalog/ui/storefront/ProductOverlay.helpers';
import type { ShopProduct } from '@/modules/shops/ui/runtime/ShopsContext';

const product = {
  id: 'p-1',
  shop_id: 's-1',
  product_id: null,
  name: 'Flyers A5',
  category: 'Flyer',
  description: '',
  price_ht: 99.5,
  image_url: '',
  config: { kind: 'leaflet', format: 'A5 (148 × 210 mm)', quantity: 500 },
  display_order: 0,
  created_at: '',
  gamme_slug: 'flyer',
} as unknown as ShopProduct;

const TAX = 0.2;

describe('computeSuccessPhase (S7.2 AC3)', () => {
  it('prix numérique → ready avec TTC appliqué', () => {
    const phase = computeSuccessPhase({ success: true, priceHT: 100 }, product, 500, TAX);
    expect(phase).toEqual({ kind: 'ready', priceHT: 100, priceTTC: 120 });
  });

  it('success=false (sanitization) → error undefined_field avec repli estimé', () => {
    const phase = computeSuccessPhase({ success: false }, product, 500, TAX);
    expect(phase.kind).toBe('error');
    if (phase.kind === 'error') {
      expect(phase.errorKind).toBe('undefined_field');
      expect(phase.fallbackPriceHT).toBeGreaterThan(0);
      expect(phase.fallbackPriceTTC).toBeCloseTo(phase.fallbackPriceHT! * 1.2, 5);
    }
  });

  it('priceHT non-numérique → repli estimé (jamais NaN affiché)', () => {
    const phase = computeSuccessPhase(
      { success: true, priceHT: undefined },
      product,
      500,
      TAX,
    );
    expect(phase.kind).toBe('error');
  });
});

describe('computeErrorPhase (S7.2 AC3)', () => {
  it.each(['negative_price', 'nan_price', 'undefined_field'] as const)(
    'anomalie Clariprint %s → repli Prix marché',
    (kind) => {
      const phase = computeErrorPhase(kind, product, 500, TAX);
      expect(phase.kind).toBe('error');
      if (phase.kind === 'error') {
        expect(phase.errorKind).toBe(kind);
        expect(phase.message).toContain('Prix marché');
        expect(phase.fallbackPriceHT).toBeGreaterThan(0);
      }
    },
  );

  it('missing_required_product → PAS de repli (add bloqué)', () => {
    const phase = computeErrorPhase('missing_required_product', product, 500, TAX);
    if (phase.kind === 'error') {
      expect(phase.fallbackPriceHT).toBeUndefined();
      expect(phase.message).toContain('non disponible');
    }
    expect(isAddDisabled(phase)).toBe(true);
  });

  it.each(['network', 'timeout', 'unknown'] as const)(
    'erreur transport %s → estimation + invite à réessayer',
    (kind) => {
      const phase = computeErrorPhase(kind, product, 1000, TAX);
      if (phase.kind === 'error') {
        expect(phase.message).toContain('réessayez');
        expect(phase.fallbackPriceHT).toBeGreaterThan(0);
      }
    },
  );

  it('le repli dépend de la quantité courante (pas du price_ht catalogue)', () => {
    const p500 = computeErrorPhase('network', product, 500, TAX);
    const p5000 = computeErrorPhase('network', product, 5000, TAX);
    if (p500.kind === 'error' && p5000.kind === 'error') {
      expect(p5000.fallbackPriceHT!).toBeGreaterThan(p500.fallbackPriceHT!);
    }
  });
});

describe('resolveFinalPriceHT — cascade ready > fallback > catalogue', () => {
  it('ready prime', () => {
    const phase: ConfiguratorPhase = { kind: 'ready', priceHT: 150, priceTTC: 180 };
    expect(resolveFinalPriceHT(phase, product)).toBe(150);
  });
  it('error avec fallback → fallback', () => {
    const phase: ConfiguratorPhase = {
      kind: 'error',
      errorKind: 'network',
      message: '',
      fallbackPriceHT: 42,
    };
    expect(resolveFinalPriceHT(phase, product)).toBe(42);
  });
  it('error sans fallback / loading / idle → prix catalogue', () => {
    expect(
      resolveFinalPriceHT(
        { kind: 'error', errorKind: 'missing_required_product', message: '' },
        product,
      ),
    ).toBe(99.5);
    expect(resolveFinalPriceHT({ kind: 'loading' }, product)).toBe(99.5);
    expect(resolveFinalPriceHT({ kind: 'idle' }, product)).toBe(99.5);
  });
});

describe('buildConfiguredProduct', () => {
  it('porte le prix final et le payload clariprintData', () => {
    const options = extractInitialOptions(product);
    const phase: ConfiguratorPhase = { kind: 'ready', priceHT: 123, priceTTC: 147.6 };
    const configured = buildConfiguredProduct(product, options, phase);
    expect(configured.price_ht).toBe(123);
    expect((configured.config as Record<string, unknown>).clariprintData).toBeDefined();
    // Le produit d origine n est pas muté
    expect(product.price_ht).toBe(99.5);
  });
});

describe('isAddDisabled', () => {
  it('uniquement missing_required_product', () => {
    expect(isAddDisabled({ kind: 'idle' })).toBe(false);
    expect(isAddDisabled({ kind: 'loading' })).toBe(false);
    expect(isAddDisabled({ kind: 'ready', priceHT: 1, priceTTC: 1.2 })).toBe(false);
    expect(
      isAddDisabled({ kind: 'error', errorKind: 'network', message: '' }),
    ).toBe(false);
    expect(
      isAddDisabled({
        kind: 'error',
        errorKind: 'missing_required_product',
        message: '',
      }),
    ).toBe(true);
  });
});
