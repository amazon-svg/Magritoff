/**
 * S2.19 — Tests facettes légères catalogue (Format + Prix).
 * Le format est un FILTRE (facette), pas une catégorie (ADR-4.17).
 */

import { describe, expect, it } from 'vitest';
import {
  resolveFormatLabel,
  deriveFormatFacets,
  derivePriceFacets,
  applyFacets,
  hasActiveFacets,
} from '../../src/app/utils/catalogFacets';

const p = (id: string, format: string, price_ht: number) =>
  ({ id, config: { format }, price_ht }) as never;

describe('catalogFacets — resolveFormatLabel', () => {
  it('extrait la taille A depuis un format verbeux', () => {
    expect(resolveFormatLabel({ config: { format: 'A5 (148 × 210 mm)' } } as never)).toBe('A5');
  });
  it('extrait les dimensions si pas de A-size', () => {
    expect(resolveFormatLabel({ config: { format: '85 × 55 mm (standard)' } } as never)).toBe('85 × 55 mm');
  });
  it('retourne Autre si format absent', () => {
    expect(resolveFormatLabel({ config: {} } as never)).toBe('Autre');
  });
});

describe('catalogFacets — deriveFormatFacets', () => {
  it('compte et trie les formats par occurrence décroissante', () => {
    const facets = deriveFormatFacets([
      p('a', 'A5 (148 × 210 mm)', 50),
      p('b', 'A5 (148 × 210 mm)', 60),
      p('c', 'A2 (420 × 594 mm)', 200),
    ]);
    expect(facets[0]).toMatchObject({ label: 'A5', count: 2 });
    expect(facets.find((f) => f.label === 'A2')?.count).toBe(1);
  });
});

describe('catalogFacets — derivePriceFacets', () => {
  it('répartit en tranches et masque les tranches vides', () => {
    const facets = derivePriceFacets([p('a', 'A5', 50), p('b', 'A5', 300), p('c', 'A5', 900)]);
    expect(facets.map((f) => f.key).sort()).toEqual(['100_500', 'gt500', 'lt100']);
  });
  it('ne renvoie que les tranches non vides', () => {
    const facets = derivePriceFacets([p('a', 'A5', 50), p('b', 'A5', 60)]);
    expect(facets).toHaveLength(1);
    expect(facets[0].key).toBe('lt100');
  });
});

describe('catalogFacets — applyFacets', () => {
  const products = [p('a', 'A5 (148 × 210 mm)', 50), p('b', 'A2 (420 × 594 mm)', 300), p('c', 'A5 (148 × 210 mm)', 900)];

  it('filtre par format (OU)', () => {
    const r = applyFacets(products, { formats: new Set(['A5']), price: null });
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'c']);
  });
  it('filtre par tranche de prix', () => {
    const r = applyFacets(products, { formats: new Set(), price: '100_500' });
    expect(r.map((x) => x.id)).toEqual(['b']);
  });
  it('combine format ET prix', () => {
    const r = applyFacets(products, { formats: new Set(['A5']), price: 'gt500' });
    expect(r.map((x) => x.id)).toEqual(['c']);
  });
  it('sans sélection, retourne tout', () => {
    expect(applyFacets(products, { formats: new Set(), price: null })).toHaveLength(3);
  });

  it('hasActiveFacets reflète la sélection', () => {
    expect(hasActiveFacets({ formats: new Set(), price: null })).toBe(false);
    expect(hasActiveFacets({ formats: new Set(['A5']), price: null })).toBe(true);
    expect(hasActiveFacets({ formats: new Set(), price: 'lt100' })).toBe(true);
  });
});
