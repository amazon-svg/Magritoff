/**
 * Tests S2.33 — buildPimGeneratedProducts (helper pur).
 */

import { describe, it, expect } from 'vitest';
import {
  buildPimGeneratedProducts,
  isPimGenerated,
  PIM_GENERATED_SOURCE,
  PIM_DEFAULT_QUANTITY,
} from '../../src/app/utils/buildPimGeneratedProducts';
import type { Gamme } from '../../src/app/utils/productEnrichment';

const gamme = (slug: string, name: string, matching_rules: any = {}): Gamme =>
  ({ slug, name, matching_rules } as Gamme);

describe('buildPimGeneratedProducts — S2.33', () => {
  it('genere un produit par gamme, price_ht=0, marqueur source', () => {
    const out = buildPimGeneratedProducts([
      gamme('carterie', 'Carterie', { kind: 'leaflet', size_range: { max_dim: 150 } }),
      gamme('flyer', 'Flyers', { kind: 'leaflet' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('Carterie');
    expect(out[0].gamme_slug).toBe('carterie');
    expect(out[0].price_ht).toBe(0);
    expect(out[0].active).toBe(true);
    expect(out[0].library_id).toBeNull();
    expect((out[0].config as any).source).toBe(PIM_GENERATED_SOURCE);
  });

  it('reporte kind + dimensions depuis size_near dans clariprintData', () => {
    const out = buildPimGeneratedProducts([
      gamme('carte_visite_standard', 'Carte de visite standard', {
        kind: 'leaflet',
        size_near: { width: 85, height: 55, tol: 3 },
      }),
    ]);
    const cp = (out[0].config as any).clariprintData;
    expect(cp.kind).toBe('leaflet');
    expect(cp.width).toBe(85);
    expect(cp.height).toBe(55);
    expect(cp.quantity).toBe(PIM_DEFAULT_QUANTITY);
  });

  it('sans size_near : pas de width/height (overlay applique ses defauts)', () => {
    const out = buildPimGeneratedProducts([
      gamme('flyer', 'Flyers', { kind: 'leaflet', size_range: { min_dim: 100, max_dim: 300 } }),
    ]);
    const cp = (out[0].config as any).clariprintData;
    expect(cp.width).toBeUndefined();
    expect(cp.height).toBeUndefined();
    expect(cp.kind).toBe('leaflet');
  });

  it('kind absent -> fallback leaflet', () => {
    const out = buildPimGeneratedProducts([gamme('x', 'X', {})]);
    expect((out[0].config as any).kind).toBe('leaflet');
    expect((out[0].config as any).clariprintData.kind).toBe('leaflet');
  });

  it('kind en tableau -> prend le premier', () => {
    const out = buildPimGeneratedProducts([
      gamme('multi', 'Multi', { kind: ['folded', 'leaflet'] }),
    ]);
    expect((out[0].config as any).kind).toBe('folded');
  });

  it('isPimGenerated distingue genere vs manuel', () => {
    const [gen] = buildPimGeneratedProducts([gamme('a', 'A')]);
    expect(isPimGenerated(gen.config)).toBe(true);
    expect(isPimGenerated({ id: 'manuel' })).toBe(false);
    expect(isPimGenerated(null)).toBe(false);
  });
});
