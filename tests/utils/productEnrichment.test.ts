/**
 * Tests vitest pour productEnrichment.resolveGamme (Story P0.9, Sprint 4).
 *
 * Vérifie la nouvelle convention cm/mm robuste introduite par P0.9 :
 *  - typeof string  -> LLM Clariprint cm -> conversion x10 mm
 *  - typeof number  -> admin/code mm direct
 *
 * Couvre les 5 cas du smoke test P0.4 (kakemono, étiquette, banderole,
 * dépliant DL, carte de visite) qui ont permis de découvrir ce bug.
 */

import { describe, it, expect } from 'vitest';
import { resolveGamme, type Gamme } from '../../src/app/utils/productEnrichment';

// Fixtures minimales : seulement les gammes pertinentes aux tests, plus
// quelques distracteurs pour valider le tri par specificity + filterByName.
const FIXTURES: Gamme[] = [
  // Carterie root + carte de visite standard
  {
    slug: 'carterie',
    name: 'Carterie',
    parent_slug: null,
    display_order: 10,
    matching_rules: { kind: 'leaflet', size_range: { max_dim: 150 } },
  },
  {
    slug: 'carte_visite_standard',
    name: 'Carte de visite standard',
    parent_slug: 'carterie',
    display_order: 11,
    matching_rules: {
      kind: 'leaflet',
      size_near: { width: 85, height: 55, tol: 3 },
    },
  },
  // Flyer root + flyer A4 (distracteur pour kakemono)
  {
    slug: 'flyer',
    name: 'Flyers',
    parent_slug: null,
    display_order: 20,
    matching_rules: { kind: 'leaflet', size_range: { min_dim: 100, max_dim: 300 } },
  },
  // Affiche root (distracteur pour banderole)
  {
    slug: 'affiche',
    name: 'Affiches',
    parent_slug: null,
    display_order: 30,
    matching_rules: { kind: 'leaflet', size_range: { min_dim: 297 } },
  },
  // P0.2 — Nouvelles gammes du sprint
  {
    slug: 'kakemono',
    name: 'Kakémonos / Roll-ups',
    parent_slug: null,
    display_order: 35,
    matching_rules: { kind: 'leaflet', size_range: { min_dim: 1500 } },
  },
  {
    slug: 'roll_up_80x200',
    name: 'Roll-up standard 80×200 cm',
    parent_slug: 'kakemono',
    display_order: 36,
    matching_rules: {
      kind: 'leaflet',
      size_near: { width: 800, height: 2000, tol: 50 },
    },
  },
  {
    slug: 'etiquette',
    name: 'Étiquettes / Stickers',
    parent_slug: null,
    display_order: 37,
    matching_rules: { kind: 'leaflet', size_range: { max_dim: 100 } },
  },
  {
    slug: 'banderole',
    name: 'Banderoles',
    parent_slug: null,
    display_order: 38,
    matching_rules: { kind: 'leaflet', size_range: { min_dim: 1000, max_dim: 1500 } },
  },
  // Dépliant root + DL
  {
    slug: 'depliant',
    name: 'Dépliants',
    parent_slug: null,
    display_order: 40,
    matching_rules: { kind: 'folded' },
  },
  {
    slug: 'depliant_plie_dl',
    name: 'Dépliant plié DL (3 volets)',
    parent_slug: 'depliant',
    display_order: 41,
    matching_rules: {
      kind: 'folded',
      size_near: { width: 210, height: 100, tol: 5 },
    },
  },
];

describe('resolveGamme P0.9 — convention cm string vs mm number', () => {
  it('Carte de visite LLM string cm "8.5"/"5.5" → carte_visite_standard', () => {
    const config = {
      kind: 'leaflet',
      width: '8.5',
      height: '5.5',
    };
    const result = resolveGamme(config, FIXTURES, 'Carte de visite test');
    expect(result?.slug).toBe('carte_visite_standard');
  });

  it('Carte de visite admin mm number 85/55 → carte_visite_standard (non-régression)', () => {
    const config = {
      kind: 'leaflet',
      width: 85,
      height: 55,
    };
    const result = resolveGamme(config, FIXTURES, 'Carte de visite premium');
    expect(result?.slug).toBe('carte_visite_standard');
  });

  it('Kakémono LLM string cm "80"/"200" → kakemono ou roll_up_80x200', () => {
    const config = {
      kind: 'leaflet',
      width: '80',
      height: '200',
    };
    const result = resolveGamme(config, FIXTURES, 'Kakémono PVC test');
    expect(['kakemono', 'roll_up_80x200']).toContain(result?.slug);
  });

  it('Banderole LLM string cm "120"/"30" → banderole', () => {
    const config = {
      kind: 'leaflet',
      width: '120',
      height: '30',
    };
    const result = resolveGamme(config, FIXTURES, 'Banderole PVC test');
    expect(result?.slug).toBe('banderole');
  });

  it('Étiquette LLM string cm "5"/"5" → etiquette', () => {
    const config = {
      kind: 'leaflet',
      width: '5',
      height: '5',
    };
    // Name sans accent en debut : regex `\b[ée]tiquette\b` matche 'e' word-boundary.
    // Bug regex accents pre-existant cf. story future S-FIX-REGEX-ACCENTS.
    const result = resolveGamme(config, FIXTURES, 'Etiquette adhesive');
    expect(result?.slug).toBe('etiquette');
  });

  it('Dépliant DL LLM string cm "21"/"10" → depliant_plie_dl', () => {
    const config = {
      kind: 'folded',
      width: '21',
      height: '10',
    };
    const result = resolveGamme(config, FIXTURES, 'Dépliant DL 3 volets');
    expect(result?.slug).toBe('depliant_plie_dl');
  });

  it('Affiche A2 LLM string cm "42"/"59.4" → matche affiche ou plus précis si présent', () => {
    // 42 cm × 59.4 cm = 420 × 594 mm = A2
    const config = {
      kind: 'leaflet',
      width: '42',
      height: '59.4',
    };
    const result = resolveGamme(config, FIXTURES, 'Affiche A2 test');
    expect(result?.slug).toBe('affiche');
  });

  it('Dimensions absentes (undefined) avec kind:leaflet → gamme parent root (carterie) par tie-break display_order', () => {
    // Comportement intentionnel : si pas de dim, matching kind seul -> les gammes
    // root kind=leaflet matchent toutes. Tri specificity egale (kind:2) puis
    // display_order ASC : carterie (10) prime sur flyer (20), affiche (30), etc.
    const config = { kind: 'leaflet' };
    const result = resolveGamme(config, FIXTURES, 'Produit sans dim');
    expect(result?.slug).toBe('carterie');
  });

  it('Dimensions absentes (undefined) avec kind:folded → depliant (seule gamme root folded)', () => {
    const config = { kind: 'folded' };
    const result = resolveGamme(config, FIXTURES, 'Produit folded sans dim');
    expect(result?.slug).toBe('depliant');
  });

  it('clariprintData nested string cm prioritaire sur config top-level absent', () => {
    const config = {
      clariprintData: {
        kind: 'leaflet',
        width: '8.5',
        height: '5.5',
      },
    };
    const result = resolveGamme(config, FIXTURES, 'Carte visite via clariprintData');
    expect(result?.slug).toBe('carte_visite_standard');
  });

  it('ruleSpecificity DESC : size_near (carte_visite_standard) prime sur size_range (etiquette) à 85×55', () => {
    // Carte visite 85×55 mm matche carte_visite_standard (size_near 85x55 tol 3)
    // ET etiquette (max_dim 100). size_near doit primer.
    const config = {
      kind: 'leaflet',
      width: 85,
      height: 55,
    };
    // Pas de productName -> pas de filterByName -> resolution pure par specificity
    const result = resolveGamme(config, FIXTURES);
    expect(result?.slug).toBe('carte_visite_standard');
  });
});
