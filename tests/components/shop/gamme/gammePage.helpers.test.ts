/**
 * Tests unitaires S7.3 — helpers purs de la page gamme.
 */

import { describe, expect, it } from 'vitest';
import {
  collectDescendantSlugs,
  pickDefaultProduct,
  priceBadgeForPhase,
  resolveGammeInfo,
  selectGammeProducts,
} from '../../../../src/app/components/shop/gamme/gammePage.helpers';
import type { Gamme } from '../../../../src/app/utils/productEnrichment';
import type { ShopProduct } from '../../../../src/app/contexts/ShopsContext';

const gammes = [
  { id: '1', slug: 'flyer', name: 'Flyers', parent_slug: null, matching_rules: {}, display_order: 1 },
  { id: '2', slug: 'flyer_a6', name: 'Flyer A6', parent_slug: 'flyer', matching_rules: {}, display_order: 2 },
  { id: '3', slug: 'flyer_a5', name: 'Flyer A5', parent_slug: 'flyer', matching_rules: {}, display_order: 3 },
  { id: '4', slug: 'affiche', name: 'Affiches', parent_slug: null, matching_rules: {}, display_order: 4 },
] as unknown as Gamme[];

const makeProduct = (id: string, gamme_slug: string | null): ShopProduct =>
  ({
    id,
    shop_id: 's',
    product_id: null,
    name: `P-${id}`,
    category: '',
    description: '',
    price_ht: 10,
    image_url: '',
    config: {},
    display_order: 0,
    created_at: '',
    gamme_slug,
  }) as unknown as ShopProduct;

describe('resolveGammeInfo (S7.3)', () => {
  it('gamme racine → family = elle-même', () => {
    const { gamme, family } = resolveGammeInfo('flyer', gammes);
    expect(gamme?.slug).toBe('flyer');
    expect(family?.slug).toBe('flyer');
  });
  it('sous-gamme → family = racine', () => {
    const { gamme, family } = resolveGammeInfo('flyer_a6', gammes);
    expect(gamme?.slug).toBe('flyer_a6');
    expect(family?.slug).toBe('flyer');
  });
  it('slug inconnu ou absent → null (état vide, pas de crash)', () => {
    expect(resolveGammeInfo('nope', gammes)).toEqual({ gamme: null, family: null });
    expect(resolveGammeInfo(undefined, gammes)).toEqual({ gamme: null, family: null });
  });
});

describe('collectDescendantSlugs', () => {
  it('racine → inclut elle-même + enfants', () => {
    expect(collectDescendantSlugs('flyer', gammes)).toEqual(
      new Set(['flyer', 'flyer_a6', 'flyer_a5']),
    );
  });
  it('feuille → singleton', () => {
    expect(collectDescendantSlugs('flyer_a6', gammes)).toEqual(new Set(['flyer_a6']));
  });
});

describe('selectGammeProducts (ADR-4.17 : gamme explicite autoritaire)', () => {
  const products = [
    makeProduct('a', 'flyer'),
    makeProduct('b', 'flyer_a6'),
    makeProduct('c', 'affiche'),
    makeProduct('d', null),
  ];
  it('page famille → produits de la famille ET des sous-gammes', () => {
    const out = selectGammeProducts(products, gammes, 'flyer');
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('page sous-gamme → uniquement la sous-gamme', () => {
    expect(selectGammeProducts(products, gammes, 'flyer_a6').map((p) => p.id)).toEqual(['b']);
  });
  it('slug absent → vide', () => {
    expect(selectGammeProducts(products, gammes, undefined)).toEqual([]);
  });
});

describe('pickDefaultProduct', () => {
  it('1er produit, null si vide', () => {
    expect(pickDefaultProduct([makeProduct('a', 'flyer')])?.id).toBe('a');
    expect(pickDefaultProduct([])).toBeNull();
  });
});

describe('priceBadgeForPhase — un prix porte toujours sa source', () => {
  it('ready → badge Clariprint', () => {
    expect(priceBadgeForPhase({ kind: 'ready', priceHT: 1, priceTTC: 1.2 }).kind).toBe(
      'clariprint',
    );
  });
  it('error avec repli → ⚠️ Prix marché', () => {
    const badge = priceBadgeForPhase({
      kind: 'error',
      errorKind: 'network',
      message: '',
      fallbackPriceHT: 42,
    });
    expect(badge.kind).toBe('marche');
  });
  it('error sans repli (missing_required_product) → Prix sur demande', () => {
    expect(
      priceBadgeForPhase({
        kind: 'error',
        errorKind: 'missing_required_product',
        message: '',
      }).kind,
    ).toBe('demande');
  });
  it('idle/loading → pas de badge', () => {
    expect(priceBadgeForPhase({ kind: 'idle' }).kind).toBe('none');
    expect(priceBadgeForPhase({ kind: 'loading' }).kind).toBe('none');
  });
});
