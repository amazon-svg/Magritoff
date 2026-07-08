/**
 * S2.21 — Tests autocomplétion recherche catalogue (produits + familles).
 * Familles d'abord, produits ensuite ; fallback Magrit si aucun match (ADR §4.15).
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeSearchText,
  buildSearchSuggestions,
  hasNoMatch,
  MIN_QUERY_LENGTH,
} from '../../src/app/utils/catalogSearch';
import type { Gamme } from '../../src/app/utils/productEnrichment';

const gammes: Gamme[] = [
  { slug: 'affiche', name: 'Affiches', parent_slug: null } as never,
  { slug: 'carterie', name: 'Carterie', parent_slug: null } as never,
  { slug: 'flyer', name: 'Flyers', parent_slug: null } as never,
];

const p = (id: string, name: string, gamme_slug: string, description = '') =>
  ({ id, name, description, gamme_slug, config: {} }) as never;

const products = [
  p('1', 'Affiche A2 événement', 'affiche'),
  p('2', 'Affiche A1 vitrine', 'affiche'),
  p('3', 'Carte de visite premium', 'carterie'),
  p('4', 'Flyer A5 promo', 'flyer'),
];

describe('normalizeSearchText', () => {
  it('minuscule et supprime les accents', () => {
    expect(normalizeSearchText('Évènement Café')).toBe('evenement cafe');
  });
  it('gère null/undefined', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
  });
});

describe('buildSearchSuggestions — seuil', () => {
  it(`retourne [] sous ${MIN_QUERY_LENGTH} caractères`, () => {
    expect(buildSearchSuggestions('a', products, gammes)).toEqual([]);
    expect(buildSearchSuggestions('', products, gammes)).toEqual([]);
  });
});

describe('buildSearchSuggestions — familles puis produits', () => {
  it('propose la famille Affiches ET les produits affiche, familles en tête', () => {
    const s = buildSearchSuggestions('affiche', products, gammes);
    expect(s[0]).toMatchObject({ type: 'family', label: 'Affiches' });
    expect(s.filter((x) => x.type === 'product').map((x: any) => x.id)).toEqual(['1', '2']);
  });

  it('la suggestion famille porte les gammeSlugs à filtrer', () => {
    const s = buildSearchSuggestions('affiche', products, gammes);
    const fam = s.find((x) => x.type === 'family') as any;
    expect(fam.gammeSlugs).toContain('affiche');
    expect(fam.count).toBe(2);
  });

  it('matche un produit par son nom sans famille correspondante', () => {
    const s = buildSearchSuggestions('premium', products, gammes);
    expect(s.every((x) => x.type === 'product')).toBe(true);
    expect((s[0] as any).id).toBe('3');
  });
});

describe('buildSearchSuggestions — accent-insensible + caps', () => {
  it('matche malgré les accents', () => {
    const s = buildSearchSuggestions('evenement', products, gammes);
    expect((s[0] as any).id).toBe('1');
  });

  it('respecte les caps maxFamilies / maxProducts', () => {
    const many = Array.from({ length: 10 }, (_, i) => p(`x${i}`, `Affiche modèle ${i}`, 'affiche'));
    const s = buildSearchSuggestions('affiche', many, gammes, { maxProducts: 3, maxFamilies: 1 });
    expect(s.filter((x) => x.type === 'family')).toHaveLength(1);
    expect(s.filter((x) => x.type === 'product')).toHaveLength(3);
  });
});

describe('hasNoMatch', () => {
  it('true si ≥ seuil et aucune suggestion', () => {
    const s = buildSearchSuggestions('zzzz', products, gammes);
    expect(s).toEqual([]);
    expect(hasNoMatch('zzzz', s)).toBe(true);
  });
  it('false si des suggestions existent', () => {
    const s = buildSearchSuggestions('affiche', products, gammes);
    expect(hasNoMatch('affiche', s)).toBe(false);
  });
  it('false sous le seuil', () => {
    expect(hasNoMatch('z', [])).toBe(false);
  });
});
