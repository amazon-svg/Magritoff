/**
 * Tests vitest pour orderRenewal.helpers.ts (Story S3.3 Sprint 5 AC5).
 */

import { describe, it, expect } from 'vitest';
import {
  rebuildCartFromOrderItems,
  type OrderItemRow,
} from '../../../../src/app/components/shop/portal/orderRenewal.helpers';
import type { ShopProduct } from '../../../../src/app/contexts/ShopsContext';

function makeProduct(overrides: Partial<ShopProduct>): ShopProduct {
  return {
    id: 'prod-default',
    shop_id: 'shop-1',
    product_id: null,
    name: 'Produit test',
    category: 'cards',
    description: '',
    price_ht: 100,
    image_url: '',
    config: {},
    display_order: 0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<OrderItemRow>): OrderItemRow {
  return {
    product_id: 'prod-1',
    product_label: 'Cartes de visite 85x55',
    clariprint_options: { material: 'Couché 350g', finish: 'mat' },
    quantity: 500,
    unit_price_ht: 100,
    ...overrides,
  };
}

describe('rebuildCartFromOrderItems', () => {
  it('items vides → cart vide + 0 warning', () => {
    const r = rebuildCartFromOrderItems([], []);
    expect(r.lines).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats).toEqual({ matched: 0, skipped: 0, total: 0 });
  });

  it('1 item product_id matchant catalogue → 1 ligne cart, qty correcte', () => {
    const items = [makeItem({ product_id: 'prod-1', quantity: 250 })];
    const products = [makeProduct({ id: 'prod-1', name: 'Cartes pro' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].product.id).toBe('prod-1');
    expect(r.lines[0].qty).toBe(250);
    expect(r.warnings).toEqual([]);
    expect(r.stats).toEqual({ matched: 1, skipped: 0, total: 1 });
  });

  it('1 item product_id absent du catalogue → 0 ligne + 1 warning avec label', () => {
    const items = [
      makeItem({ product_id: 'prod-retire', product_label: 'Flyer A5 brillant' }),
    ];
    const products = [makeProduct({ id: 'autre' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Flyer A5 brillant');
    expect(r.warnings[0]).toContain('retiré du catalogue');
    expect(r.stats).toEqual({ matched: 0, skipped: 1, total: 1 });
  });

  it('1 item product_id null (legacy library sans UUID) → 0 ligne + 1 warning explicite', () => {
    const items = [makeItem({ product_id: null, product_label: 'Kakemono 80x200' })];
    const products = [makeProduct({ id: 'prod-1' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Kakemono 80x200');
    expect(r.warnings[0]).toContain('référence catalogue manquante');
  });

  it('2 items mix matchant/absent → 1 ligne + 1 warning', () => {
    const items = [
      makeItem({ product_id: 'prod-ok', product_label: 'OK', quantity: 100 }),
      makeItem({ product_id: 'prod-absent', product_label: 'Indispo' }),
    ];
    const products = [makeProduct({ id: 'prod-ok', name: 'Produit valide' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].qty).toBe(100);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Indispo');
    expect(r.stats).toEqual({ matched: 1, skipped: 1, total: 2 });
  });

  it('préserve les options Clariprint snapshot (merge avec config catalogue)', () => {
    const items = [
      makeItem({
        product_id: 'prod-1',
        clariprint_options: { material: 'Recyclé 250g', finish: 'soft-touch' },
      }),
    ];
    const products = [
      makeProduct({
        id: 'prod-1',
        config: { material: 'Couché 350g', dimensions: { w: 85, h: 55 } },
      }),
    ];
    const r = rebuildCartFromOrderItems(items, products);
    // snapshot écrase la valeur catalogue
    expect((r.lines[0].product.config as any).material).toBe('Recyclé 250g');
    // snapshot ajoute une clé absente du catalogue
    expect((r.lines[0].product.config as any).finish).toBe('soft-touch');
    // clés catalogue non snapshotées sont préservées
    expect((r.lines[0].product.config as any).dimensions).toEqual({ w: 85, h: 55 });
  });

  it('quantity invalide (0, NaN, négatif) → fallback qty=1', () => {
    const items = [
      makeItem({ product_id: 'prod-1', quantity: 0 }),
      makeItem({ product_id: 'prod-1', quantity: -50 }),
    ];
    const products = [makeProduct({ id: 'prod-1' })];
    const r = rebuildCartFromOrderItems(items, products);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].qty).toBe(1);
    expect(r.lines[1].qty).toBe(1);
  });

  it('product_label vide ou null → fallback label générique dans warning', () => {
    const items = [makeItem({ product_id: null, product_label: null })];
    const r = rebuildCartFromOrderItems(items, []);
    expect(r.warnings[0]).toContain('Produit sans libellé');
  });
});
