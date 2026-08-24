/**
 * Tests unitaires S7.5 — helpers SEO de la page gamme.
 */

import { describe, expect, it } from 'vitest';
import {
  buildGammeJsonLd,
  buildGammeSeo,
} from '@/modules/catalog/ui/storefront/gamme/gammeSeo.helpers';
import type {
  Gamme,
  ProductDefinition,
} from '@/modules/catalog/ui/helpers/productEnrichment';

const gamme = { id: '1', slug: 'flyer', name: 'Flyers', parent_slug: null } as Gamme;
const family = { id: '0', slug: 'imprimes', name: 'Imprimés', parent_slug: null } as Gamme;
const options = { format: 'A5', paper: '170g', finishingFront: 'mat' };

const def = {
  gamme_slug: 'flyer',
  locale: 'fr',
  seo_title: 'Flyer {{format}} imprimé | Quadri',
  seo_description: 'Flyer {{format}} {{grammage}}g finition {{finition}}.',
} as ProductDefinition;

describe('buildGammeSeo (S7.5 AC1)', () => {
  it('seo_* résolus avec la config courante', () => {
    const seo = buildGammeSeo(def, gamme, 'flyer', 'ERAM', options);
    expect(seo.title).toBe('Flyer A5 imprimé | Quadri');
    expect(seo.description).toBe('Flyer A5 170g finition mat.');
  });

  it('repli « Impression {Gamme} — {Boutique} » sans définition', () => {
    const seo = buildGammeSeo(null, gamme, 'flyer', 'ERAM', options);
    expect(seo.title).toBe('Impression Flyers — ERAM');
    expect(seo.description).toContain('ERAM');
  });

  it('gamme inconnue → slug puis générique, jamais vide', () => {
    const seo = buildGammeSeo(null, null, 'mystere', 'ERAM', null);
    expect(seo.title).toContain('mystere');
    expect(seo.description.length).toBeGreaterThan(10);
  });
});

describe('buildGammeJsonLd (S7.5 AC2) — offers seulement sur prix réel', () => {
  const base = {
    seo: { title: 'T', description: 'D' },
    gamme,
    family,
    shopName: 'ERAM',
    canonical: 'https://x.tld/shop/eram/g/flyer',
    shopUrl: 'https://x.tld/shop/eram',
  };

  it('phase ready → Offer avec prix Clariprint', () => {
    const ld = buildGammeJsonLd({
      ...base,
      phase: { kind: 'ready', priceHT: 152, priceTTC: 182.4 },
    });
    const graph = ld['@graph'] as Array<Record<string, unknown>>;
    const product = graph[0];
    expect((product.offers as Record<string, unknown>).price).toBe(152);
  });

  it.each([
    [{ kind: 'idle' } as const],
    [{ kind: 'loading' } as const],
    [
      {
        kind: 'error',
        errorKind: 'network',
        message: '',
        fallbackPriceHT: 84,
      } as const,
    ],
  ])('pas d offers hors ready (prix marché jamais engagé) %#', (phase) => {
    const ld = buildGammeJsonLd({ ...base, phase });
    const graph = ld['@graph'] as Array<Record<string, unknown>>;
    expect(graph[0].offers).toBeUndefined();
  });

  it('BreadcrumbList Accueil › Famille › Gamme, positions 1..3', () => {
    const ld = buildGammeJsonLd({ ...base, phase: { kind: 'idle' } });
    const graph = ld['@graph'] as Array<Record<string, unknown>>;
    const crumbs = (graph[1].itemListElement as Array<Record<string, unknown>>);
    expect(crumbs.map((c) => c.name)).toEqual(['Accueil', 'Imprimés', 'Flyers']);
    expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3]);
  });

  it('famille = gamme → pas de doublon de crumb', () => {
    const ld = buildGammeJsonLd({ ...base, family: gamme, phase: { kind: 'idle' } });
    const graph = ld['@graph'] as Array<Record<string, unknown>>;
    const crumbs = (graph[1].itemListElement as Array<Record<string, unknown>>);
    expect(crumbs.map((c) => c.name)).toEqual(['Accueil', 'Flyers']);
  });
});
