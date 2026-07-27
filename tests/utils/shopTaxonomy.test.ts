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
    expect(tax[0].tone).toMatch(/^#/);
    expect(tax[0].icon).toBeTruthy(); // composant lucide
  });

  it('repli démo-friendly : squelette des familles racines si aucun produit ne matche', () => {
    const tax = buildShopTaxonomy([], GAMMES);
    const keys = tax.map((f) => f.key);
    expect(keys).toContain('flyer');
    expect(keys).toContain('affiche');
    expect(tax.every((f) => f.count === 0)).toBe(true);
  });
});

// ─── Sous-catégories dérivées par FORMAT (repli catalogue seedé racine) ────────
// Retour Arnaud 2026-07-08 : quand les produits sont rattachés à la gamme RACINE
// (S-CAT-3), aucune gamme enfant n'est peuplée → le méga-menu déployait un
// panneau vide. On dérive alors les sous-catégories depuis les formats produit.

// Produit avec config.format (source de `resolveFormatLabel`), rattaché à une
// gamme racine explicite via gamme_slug (comme en prod post S-CAT-3).
const prodFmt = (id: string, name: string, gammeSlug: string, format: string, display_order = 0) =>
  ({ id, name, category: '', display_order, image_url: '', gamme_slug: gammeSlug, config: { format } }) as never;

// Arbre : Affiches (racine) → Affiche A3 / A2 / A1 (enfants format-based).
const AFFICHE_GAMMES: Gamme[] = [
  g('affiche', 'Affiches', null, 'affiche'),
  g('affiche_a3', 'Affiche A3', 'affiche', 'affichea3'),
  g('affiche_a2', 'Affiche A2', 'affiche', 'affichea2'),
  g('affiche_a1', 'Affiche A1', 'affiche', 'affichea1'),
];

describe('shopTaxonomy — sous-catégories dérivées par format (2026-07-08)', () => {
  it('dérive les sous-catégories depuis les formats quand aucune gamme enfant peuplée', () => {
    const products = [
      prodFmt('p1', 'Affiche vitrine A3', 'affiche', 'A3'),
      prodFmt('p2', 'Affiche vitrine A3 mate', 'affiche', 'A3'),
      prodFmt('p3', 'Affiche A2 brillante', 'affiche', 'A2'),
    ];
    const affiche = buildShopTaxonomy(products, AFFICHE_GAMMES).find((f) => f.key === 'affiche');
    expect(affiche).toBeTruthy();
    // Panneau utile : ≥ 1 sous-cat → le méga-menu s'ouvre.
    expect(affiche!.subcategories.length).toBe(2);
    // Tri par compteur décroissant : A3 (2) avant A2 (1).
    expect(affiche!.subcategories[0].count).toBe(2);
    expect(affiche!.subcategories[1].count).toBe(1);
  });

  it('porte formatKey (facette) et garde gammeSlugs au niveau FAMILLE (ADR-4.17)', () => {
    const products = [prodFmt('p1', 'Affiche A3', 'affiche', 'A3')];
    const affiche = buildShopTaxonomy(products, AFFICHE_GAMMES).find((f) => f.key === 'affiche');
    const sub = affiche!.subcategories[0];
    expect(sub.formatKey).toBe('A3');
    // Le filtre reste la famille (racine), pas une gamme enfant introuvable.
    expect(sub.gammeSlugs).toEqual(['affiche']);
  });

  it('aligne le libellé/slug sur la gamme enfant PIM quand le format correspond', () => {
    const products = [prodFmt('p1', 'Affiche A3', 'affiche', 'A3')];
    const affiche = buildShopTaxonomy(products, AFFICHE_GAMMES).find((f) => f.key === 'affiche');
    const sub = affiche!.subcategories[0];
    expect(sub.key).toBe('affiche_a3'); // slug PIM réutilisé
    expect(sub.label).toBe('Affiche A3'); // libellé pro aligné arbre PIM
  });

  it('ignore le bucket « Autre » (format inconnu) — jamais de sous-cat creuse', () => {
    const products = [
      prodFmt('p1', 'Affiche A3', 'affiche', 'A3'),
      prodFmt('p2', 'Affiche sans format', 'affiche', ''), // → « Autre »
    ];
    const affiche = buildShopTaxonomy(products, AFFICHE_GAMMES).find((f) => f.key === 'affiche');
    expect(affiche!.subcategories.map((s) => s.formatKey)).toEqual(['A3']);
  });

  it('famille sans aucun format reconnu → 0 sous-cat (panneau fermé, pas de « Autre »)', () => {
    const products = [
      prodFmt('p1', 'Affiche promo', 'affiche', ''),
      prodFmt('p2', 'Affiche event', 'affiche', ''),
    ];
    const affiche = buildShopTaxonomy(products, AFFICHE_GAMMES).find((f) => f.key === 'affiche');
    expect(affiche!.count).toBe(2); // la famille existe bien
    expect(affiche!.subcategories).toEqual([]); // mais aucun panneau creux
  });

  it('n\'écrase PAS les sous-catégories de gamme réelles quand des enfants sont peuplés', () => {
    // Produit rattaché à la gamme ENFANT (kind matche affiche_a3) → chemin gamme classique.
    const products = [prod('p1', 'Affiche A3', 'affichea3')];
    const affiche = buildShopTaxonomy(products, AFFICHE_GAMMES).find((f) => f.key === 'affiche');
    expect(affiche!.subcategories.map((s) => s.key)).toEqual(['affiche_a3']);
    // Chemin gamme : pas de formatKey (filtre par slug enfant).
    expect(affiche!.subcategories[0].formatKey).toBeUndefined();
  });
});
