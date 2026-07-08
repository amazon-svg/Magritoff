/**
 * S2.20 — Tests landing catégorie : socle déterministe + overlay éditorial LLM.
 * « Jamais de page vide » (AC2) : le socle marche sans réseau ; l'overlay
 * n'applique que les champs non vides (ADR §4.15).
 */

import { describe, expect, it } from 'vitest';
import {
  buildCategoryLandingModel,
  buildFallbackIntro,
  mergeEditorial,
  categoryEditorialCacheKey,
} from '../../src/app/utils/catalogLanding';
import type { TaxonomyFamily, TaxonomyNode } from '../../src/app/utils/shopTaxonomy';

const node = (key: string, label: string, count: number): TaxonomyNode =>
  ({ key, label, count, featured: null, imageUrl: null, gammeSlugs: [key] });

const family = (over: Partial<TaxonomyFamily> = {}): TaxonomyFamily =>
  ({
    key: 'affiche',
    label: 'Affiches',
    count: 3,
    featured: null,
    imageUrl: null,
    gammeSlugs: ['affiche'],
    tone: '#DC2626',
    icon: (() => null) as never,
    subcategories: [node('affiche-grand', 'Grand format', 2), node('affiche-vide', 'Vide', 0)],
    ...over,
  }) as TaxonomyFamily;

const p = (id: string, display_order: number) =>
  ({ id, name: `P${id}`, display_order, config: {} }) as never;

describe('buildFallbackIntro', () => {
  it('accorde le pluriel', () => {
    expect(buildFallbackIntro({ label: 'Affiches', count: 3 })).toContain('3 produits');
    expect(buildFallbackIntro({ label: 'Affiches', count: 1 })).toContain('1 produit ');
  });
  it('gère une famille vide', () => {
    expect(buildFallbackIntro({ label: 'Affiches', count: 0 })).toContain('Configurez');
  });
});

describe('buildCategoryLandingModel', () => {
  it('titre = nom de famille, intro déterministe non vide', () => {
    const m = buildCategoryLandingModel(family(), [p('1', 0)]);
    expect(m.title).toBe('Affiches');
    expect(m.intro.length).toBeGreaterThan(0);
    expect(m.seo).toBe('');
    expect(m.familyKey).toBe('affiche');
    expect(m.gammeSlugs).toEqual(['affiche']);
  });

  it('best-sellers triés par display_order et cappés', () => {
    const m = buildCategoryLandingModel(family(), [p('c', 5), p('a', 1), p('b', 3), p('d', 9)], {
      maxBestSellers: 2,
    });
    expect(m.bestSellers.map((x: any) => x.id)).toEqual(['a', 'b']);
  });

  it('masque les sous-catégories sans produit', () => {
    const m = buildCategoryLandingModel(family(), [p('1', 0)]);
    expect(m.subcategories.map((s) => s.key)).toEqual(['affiche-grand']);
  });
});

describe('mergeEditorial', () => {
  const base = buildCategoryLandingModel(family(), [p('1', 0)]);

  it('remplace les champs éditoriaux non vides', () => {
    const m = mergeEditorial(base, { title: 'Vos affiches grand format', intro: 'Intro IA.', seo: 'meta' });
    expect(m.title).toBe('Vos affiches grand format');
    expect(m.intro).toBe('Intro IA.');
    expect(m.seo).toBe('meta');
  });

  it('ignore les champs vides / absents (garde le socle)', () => {
    const m = mergeEditorial(base, { title: '   ', intro: undefined });
    expect(m.title).toBe('Affiches');
    expect(m.intro).toBe(base.intro);
  });

  it('null editorial → socle inchangé', () => {
    expect(mergeEditorial(base, null)).toEqual(base);
  });
});

describe('categoryEditorialCacheKey', () => {
  it('clé stable par slug', () => {
    expect(categoryEditorialCacheKey('affiche')).toBe('magrit.shop.landing.affiche');
  });
});
