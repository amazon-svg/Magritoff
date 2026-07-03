/**
 * Tests vitest pour PortalCatalog.helpers.ts (Stories S-CONSO-4 + S-CONSO-5, Sprint 4 Phase 2).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ShopProduct } from '../../../../src/app/contexts/ShopsContext';
import type { Gamme } from '../../../../src/app/utils/productEnrichment';
import {
  DEFAULT_SORT_KEY,
  filterProductsByTextQuery,
  loadSortKey,
  saveSortKey,
  sortKeyStorageKey,
  SORT_OPTIONS,
  sortProductsBy,
} from '../../../../src/app/components/shop/portal/PortalCatalog.helpers';

function makeProduct(opts: Partial<ShopProduct>): ShopProduct {
  return {
    id: 'p',
    shop_id: 's',
    product_id: null,
    name: 'Produit test',
    category: '',
    description: '',
    price_ht: 0,
    image_url: '',
    config: {},
    display_order: 0,
    created_at: '2026-05-18T10:00:00Z',
    ...opts,
  } as ShopProduct;
}

const GAMMES: Gamme[] = [
  {
    slug: 'carte_visite_standard',
    name: 'Carte de visite standard',
    parent_slug: 'carterie',
    display_order: 11,
    matching_rules: { kind: 'leaflet', size_near: { width: 85, height: 55, tol: 3 } },
  } as Gamme,
];

describe('filterProductsByTextQuery (S-CONSO-4)', () => {
  const products = [
    makeProduct({ id: 'p1', name: 'Carte de visite mat 350g', description: 'Premium' }),
    makeProduct({ id: 'p2', name: 'Flyer A5 brillant', description: 'Recto-verso' }),
    makeProduct({ id: 'p3', name: 'Kakémono PVC', description: '80x200 cm' }),
  ];

  it('query vide → retourne tous les produits', () => {
    expect(filterProductsByTextQuery(products, '')).toHaveLength(3);
    expect(filterProductsByTextQuery(products, '   ')).toHaveLength(3);
  });

  it('query case-insensitive sur name', () => {
    expect(filterProductsByTextQuery(products, 'FLYER')).toHaveLength(1);
    expect(filterProductsByTextQuery(products, 'flyer')[0].id).toBe('p2');
  });

  it('query match description', () => {
    expect(filterProductsByTextQuery(products, 'recto-verso')).toHaveLength(1);
    expect(filterProductsByTextQuery(products, 'premium')[0].id).toBe('p1');
  });

  it('query match dimensions dans description', () => {
    expect(filterProductsByTextQuery(products, '80x200')[0].id).toBe('p3');
  });

  it('query sans match → array vide', () => {
    expect(filterProductsByTextQuery(products, 'xyz123')).toEqual([]);
  });

  it('avec gammes : match sur gamme.name resolu', () => {
    const productWithConfig = makeProduct({
      id: 'pcv',
      name: 'Mon produit',
      description: 'Test',
      config: { clariprintData: { kind: 'leaflet', width: 85, height: 55 } } as any,
    });
    const result = filterProductsByTextQuery([productWithConfig], 'carte', GAMMES);
    expect(result).toHaveLength(1);
  });
});

describe('sortProductsBy (S-CONSO-5)', () => {
  const products = [
    makeProduct({ id: 'a', price_ht: 50, display_order: 3, created_at: '2026-05-01T10:00:00Z' }),
    makeProduct({ id: 'b', price_ht: 100, display_order: 1, created_at: '2026-05-10T10:00:00Z' }),
    makeProduct({ id: 'c', price_ht: 25, display_order: 2, created_at: '2026-05-05T10:00:00Z' }),
  ];

  it('display_order ASC (par défaut)', () => {
    const sorted = sortProductsBy(products, 'display_order');
    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('price_asc : prix croissant', () => {
    const sorted = sortProductsBy(products, 'price_asc');
    expect(sorted.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('price_desc : prix décroissant', () => {
    const sorted = sortProductsBy(products, 'price_desc');
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('newest : created_at DESC', () => {
    const sorted = sortProductsBy(products, 'newest');
    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('non-mutant : products original inchange', () => {
    const before = products.map((p) => p.id).join(',');
    sortProductsBy(products, 'price_desc');
    expect(products.map((p) => p.id).join(',')).toBe(before);
  });

  it('created_at null → fallback 0 (mis en dernier)', () => {
    const list = [
      makeProduct({ id: 'a', created_at: '2026-05-10T10:00:00Z' }),
      // @ts-expect-error test null safety
      makeProduct({ id: 'b', created_at: null }),
    ];
    const sorted = sortProductsBy(list, 'newest');
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

// Mock localStorage minimal pour env node (vitest default).
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

describe('localStorage persistance sortKey (S-CONSO-5)', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = mockLocalStorage;
    mockLocalStorage.clear();
  });
  afterEach(() => {
    mockLocalStorage.clear();
    delete (globalThis as any).localStorage;
  });

  it('sortKeyStorageKey : clé par slug', () => {
    expect(sortKeyStorageKey('imprimerie-ipa')).toBe('magrit.shop.imprimerie-ipa.sort');
    expect(sortKeyStorageKey('boutique-1')).toBe('magrit.shop.boutique-1.sort');
  });

  it('loadSortKey : fallback default si rien en localStorage', () => {
    expect(loadSortKey('imprimerie-ipa')).toBe(DEFAULT_SORT_KEY);
  });

  it('saveSortKey + loadSortKey : roundtrip', () => {
    saveSortKey('imprimerie-ipa', 'price_desc');
    expect(loadSortKey('imprimerie-ipa')).toBe('price_desc');
  });

  it('saveSortKey default → supprime la clé localStorage (cleanup)', () => {
    saveSortKey('imprimerie-ipa', 'price_asc');
    saveSortKey('imprimerie-ipa', DEFAULT_SORT_KEY);
    expect(localStorage.getItem(sortKeyStorageKey('imprimerie-ipa'))).toBeNull();
  });

  it('loadSortKey : valeur corrompue → fallback default', () => {
    localStorage.setItem(sortKeyStorageKey('imprimerie-ipa'), 'invalid_key');
    expect(loadSortKey('imprimerie-ipa')).toBe(DEFAULT_SORT_KEY);
  });

  it('SORT_OPTIONS : 4 options dans l ordre', () => {
    expect(SORT_OPTIONS).toHaveLength(4);
    expect(SORT_OPTIONS[0].value).toBe('display_order');
    expect(SORT_OPTIONS[1].value).toBe('price_asc');
    expect(SORT_OPTIONS[2].value).toBe('price_desc');
    expect(SORT_OPTIONS[3].value).toBe('newest');
  });
});
