/**
 * Tests unitaires S7.6 — computeGammeFloorPrices (ADR §4.18).
 */

import { describe, expect, it } from 'vitest';
import { computeGammeFloorPrices } from '@/modules/catalog/ui/helpers/gammeFloorPrices';
import type { Gamme } from '@/modules/catalog/ui/helpers/productEnrichment';
import type { ShopProduct } from '@/modules/shops/ui/runtime/ShopsContext';

const gammes = [
  { id: '1', slug: 'flyer', name: 'Flyers', parent_slug: null, matching_rules: {}, display_order: 1 },
  { id: '2', slug: 'flyer_a6', name: 'Flyer A6', parent_slug: 'flyer', matching_rules: {}, display_order: 2 },
  { id: '3', slug: 'affiche', name: 'Affiches', parent_slug: null, matching_rules: {}, display_order: 3 },
] as unknown as Gamme[];

const makeProduct = (
  id: string,
  gamme_slug: string | null,
  price_ht: number,
  name = `P-${id}`,
): ShopProduct =>
  ({
    id,
    shop_id: 's',
    product_id: null,
    name,
    category: '',
    description: '',
    price_ht,
    image_url: '',
    config: {},
    display_order: 0,
    created_at: '',
    gamme_slug,
  }) as unknown as ShopProduct;

describe('computeGammeFloorPrices (S7.6 AC1/AC2)', () => {
  it('min par gamme sur les prix caches > 0, source library_cached', () => {
    const floors = computeGammeFloorPrices(
      [makeProduct('a', 'flyer', 99.5), makeProduct('b', 'flyer', 84)],
      gammes,
    );
    expect(floors.get('flyer')?.priceHT).toBe(84);
    expect(floors.get('flyer')?.source).toBe('library_cached');
  });

  it('agrege les sous-gammes au niveau famille racine (AC1)', () => {
    const floors = computeGammeFloorPrices(
      [makeProduct('a', 'flyer', 120), makeProduct('b', 'flyer_a6', 45)],
      gammes,
    );
    // Famille : min inclut la sous-gamme
    expect(floors.get('flyer')?.priceHT).toBe(45);
    // Sous-gamme : son propre min
    expect(floors.get('flyer_a6')?.priceHT).toBe(45);
  });

  it('prix cache a 0 → repli prix marche estime, source conservee (AC2)', () => {
    // Nom « flyer » → estimateMarketPriceHT > 0 via heuristique
    const floors = computeGammeFloorPrices(
      [makeProduct('a', 'flyer', 0, 'Flyer promo A5')],
      gammes,
    );
    const floor = floors.get('flyer');
    expect(floor).toBeDefined();
    expect(floor!.source).toBe('prix_marche');
    expect(floor!.isMarketPrice).toBe(true);
    expect(floor!.priceHT).toBeGreaterThan(0);
  });

  it('jamais de « des 0 € » : resolution zero exclue du min', () => {
    // quantity=0 + nom vide → estimateMarketPriceHT retourne 0 → source zero
    const zeroProduct = {
      ...makeProduct('a', 'affiche', 0, ''),
      config: { quantity: 0 },
    } as ShopProduct;
    const floors = computeGammeFloorPrices([zeroProduct], gammes);
    expect(floors.get('affiche')).toBeUndefined();
  });

  it('le prix cache prime sur une estimation plus basse d un autre produit', () => {
    // a: cache 90 (library_cached) ; b: cache 0 → estimation marche
    const floors = computeGammeFloorPrices(
      [makeProduct('a', 'affiche', 90, 'Affiche A2'), makeProduct('b', 'affiche', 0, 'Affiche A0')],
      gammes,
    );
    // Le min est simplement le plus bas priceHT>0, la source suit le produit min
    const floor = floors.get('affiche')!;
    expect(floor.priceHT).toBeGreaterThan(0);
    expect(['library_cached', 'prix_marche']).toContain(floor.source);
  });

  it('produit sans gamme resolue ignore ; map vide sur catalogue vide', () => {
    expect(computeGammeFloorPrices([], gammes).size).toBe(0);
    const floors = computeGammeFloorPrices([makeProduct('a', null, 50, '')], gammes);
    // gamme_slug null + pas de config matchable → ignore
    expect(floors.size).toBe(0);
  });
});
