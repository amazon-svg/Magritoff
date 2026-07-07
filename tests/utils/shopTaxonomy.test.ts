/**
 * S2.18 — Tests unitaires buildShopTaxonomy (fondation navigation E3).
 *
 * Taxonomie = arbre des gammes PIM (parent_slug). Familles = racines,
 * sous-catégories = enfants. Groupage produits→gamme via resolveGamme (cohérent
 * avec les pilules). Familles/sous-catégories filtrantes (gammeSlugs). Repli
 * démo-friendly (squelette) si aucun produit ne matche.
 */

import { describe, expect, it } from 'vitest';
import { buildShopTaxonomy } from '../../src/app/utils/shopTaxonomy';
import type { Gamme } from '../../src/app/utils/productEnrichment';

const prod = (id: string, name: string, kind: string, display_order = 0) =>
  ({ id, name, category: '', display_order, image_url: '', config: { kind } }) as never;

const g = (slug: string, name: string, parent: string | null, kind: string, extra: Partial<Gamme> = {}): Gamme =>
  ({ id: slug, slug, name, parent_slug: parent, matching_rules: { kind }, display_order: 0, ...extra }) as Gamme;

// Arbre de test : Flyers (racine) → Flyer A5 ; Affiches (racine, sans enfant).
const GAMMES: Gamme[] = [
  g('flyer', 'Flyers', null, 'flyer'),
  g('flyer_a5', 'Flyer A5', 'flyer', 'flyera5', { image_url: 'a5.png' }),
  g('affiche', 'Affiches', null, 'affiche'),
];

describe('shopTaxonomy — buildShopTaxonomy (S2.18)', () => {
  it('retourne [] si aucune gamme', () => {
    expect(buildShopTaxonomy([prod('a', 'Flyer', 'flyer')], [])).toEqual([]);
  });

  it('construit les familles depuis les racines de gammes (Affiches ≠ sous-cat de Flyers)', () => {
    const products = [
      prod('p1', 'Flyer A5', 'flyera5'),
      prod('p2', 'Flyers standard', 'flyer'),
      prod('p3', 'Affiche A2', 'affiche'),
    ];
    const tax = buildShopTaxonomy(products, GAMMES);
    const keys = tax.map((f) => f.key);
    expect(keys).toContain('flyer');
    expect(keys).toContain('affiche'); // famille racine à part entière
  });

  it('compte la famille = racine + enfants et trie par compteur décroissant', () => {
    const products = [
      prod('p1', 'Flyer A5', 'flyera5'),
      prod('p2', 'Flyers standard', 'flyer'),
      prod('p3', 'Affiche A2', 'affiche'),
    ];
    const tax = buildShopTaxonomy(products, GAMMES);
    expect(tax[0].key).toBe('flyer'); // 2 > 1
    expect(tax[0].count).toBe(2);
    expect(tax.find((f) => f.key === 'affiche')?.count).toBe(1);
  });

  it('expose les sous-catégories enfants avec produits (pas la racine directe)', () => {
    const products = [prod('p1', 'Flyer A5', 'flyera5'), prod('p2', 'Flyers standard', 'flyer')];
    const flyer = buildShopTaxonomy(products, GAMMES).find((f) => f.key === 'flyer');
    expect(flyer?.subcategories.map((s) => s.key)).toEqual(['flyer_a5']);
    expect(flyer?.subcategories[0].count).toBe(1);
    expect(flyer?.subcategories[0].imageUrl).toBe('a5.png');
  });

  it('porte les gammeSlugs filtrants (famille = racine + enfants)', () => {
    const flyer = buildShopTaxonomy([prod('p1', 'Flyer A5', 'flyera5')], GAMMES).find(
      (f) => f.key === 'flyer',
    );
    expect(flyer?.gammeSlugs.sort()).toEqual(['flyer', 'flyer_a5']);
    expect(flyer?.subcategories[0].gammeSlugs).toEqual(['flyer_a5']);
  });

  it('choisit la vignette vedette de plus petit display_order', () => {
    const products = [
      prod('p1', 'Flyer A5', 'flyera5', 5),
      prod('p2', 'Flyers standard', 'flyer', 1),
    ];
    const flyer = buildShopTaxonomy(products, GAMMES).find((f) => f.key === 'flyer');
    expect(flyer?.featured?.id).toBe('p2');
  });

  it('expose une identité famille (repère couleur) non vide', () => {
    const tax = buildShopTaxonomy([prod('p1', 'Flyer A5', 'flyera5')], GAMMES);
    expect(tax[0].identity.tone).toMatch(/^#/);
  });

  it('repli démo-friendly : squelette des familles racines si aucun produit ne matche', () => {
    const tax = buildShopTaxonomy([], GAMMES);
    const keys = tax.map((f) => f.key);
    expect(keys).toContain('flyer');
    expect(keys).toContain('affiche');
    expect(tax.every((f) => f.count === 0)).toBe(true);
  });
});
