/**
 * Tests vitest pour PortalOrders.helpers.ts (Story S-DUAL-READ, Sprint 4 Phase 1).
 */

import { describe, it, expect } from 'vitest';
import {
  mergeAndSortOrders,
  normalizeShopOrder,
  normalizeTenantOrder,
  STATUS_LABELS,
  type OrderUI,
  type ShopOrderRow,
  type TenantOrderRow,
} from '../../../../src/app/components/shop/portal/PortalOrders.helpers';

const SHOP_ID = '9d6d69f8-e26b-4d10-8bd6-ba1519c0338b';
const TENANT_ID = '662cae96-79e7-4a33-ab98-820a4f758501';
const USER_ID = '8e29a136-95df-4ee2-84dd-2ea00a2e1f7c';

const taxedTotal = (ht: number) => ht * 1.2; // TVA 20%

describe('normalizeShopOrder (cohort legacy)', () => {
  it('row complet -> OrderUI source=legacy', () => {
    const row: ShopOrderRow = {
      id: 'order-legacy-1',
      shop_id: SHOP_ID,
      customer_name: 'Acheteur Test',
      customer_email: 'acheteur@test.fr',
      items: [
        { name: 'Carte de visite', qty: 500, price_ht: 2.5 },
        { name: 'Flyer A5', qty: 100, price_ht: 0.8 },
      ],
      total_ht: 1330,
      total_ttc: 1596,
      status: 'pending',
      notes: '',
      created_at: '2026-05-10T10:00:00Z',
    };
    const ui = normalizeShopOrder(row);
    expect(ui.source).toBe('legacy');
    expect(ui.id).toBe('order-legacy-1');
    expect(ui.customer_name).toBe('Acheteur Test');
    expect(ui.items).toHaveLength(2);
    expect(ui.items[0].name).toBe('Carte de visite');
    expect(ui.items[0].qty).toBe(500);
    expect(ui.total_ht).toBe(1330);
    expect(ui.total_ttc).toBe(1596);
    expect(ui.status).toBe('pending');
  });

  it('row null fields -> defaults safe', () => {
    const row: ShopOrderRow = {
      id: 'order-null',
      shop_id: SHOP_ID,
      customer_name: null,
      customer_email: null,
      items: null,
      total_ht: null,
      total_ttc: null,
      status: null,
      notes: null,
      created_at: '2026-05-10T10:00:00Z',
    };
    const ui = normalizeShopOrder(row);
    expect(ui.customer_name).toBe('—');
    expect(ui.items).toEqual([]);
    expect(ui.total_ht).toBe(0);
    expect(ui.status).toBe('pending');
  });
});

describe('normalizeTenantOrder (cohort v1.1)', () => {
  it('row avec items joints -> OrderUI source=v1_1 + total_ttc calcule', () => {
    const row: TenantOrderRow = {
      id: 'order-v11-1',
      shop_id: SHOP_ID,
      tenant_id: TENANT_ID,
      created_by: USER_ID,
      status: 'draft',
      total_ht: 1000,
      currency: 'EUR',
      notes: '',
      created_at: '2026-05-18T10:00:00Z',
      tenant_order_items: [
        { product_label: 'Kakémono 80x200', quantity: 1, unit_price_ht: 1000, line_total_ht: 1000 },
      ],
    };
    const ui = normalizeTenantOrder(row, taxedTotal);
    expect(ui.source).toBe('v1_1');
    expect(ui.id).toBe('order-v11-1');
    expect(ui.status).toBe('draft');
    expect(ui.items).toHaveLength(1);
    expect(ui.items[0].name).toBe('Kakémono 80x200');
    expect(ui.total_ht).toBe(1000);
    expect(ui.total_ttc).toBe(1200); // 1000 * 1.2
  });

  it('row sans items joints -> items vide', () => {
    const row: TenantOrderRow = {
      id: 'order-empty',
      shop_id: SHOP_ID,
      tenant_id: TENANT_ID,
      created_by: USER_ID,
      status: 'cancelled',
      total_ht: 0,
      currency: 'EUR',
      notes: '',
      created_at: '2026-05-18T10:00:00Z',
      tenant_order_items: null,
    };
    const ui = normalizeTenantOrder(row, taxedTotal);
    expect(ui.items).toEqual([]);
    expect(ui.total_ht).toBe(0);
    expect(ui.total_ttc).toBe(0);
  });
});

describe('mergeAndSortOrders', () => {
  it('merge 2 cohorts et trie chronologiquement DESC', () => {
    const legacy: OrderUI[] = [
      {
        id: 'l1',
        source: 'legacy',
        date: '2026-05-10T10:00:00Z',
        customer_name: 'A',
        customer_email: '',
        items: [],
        total_ht: 100,
        total_ttc: 120,
        status: 'pending',
      },
      {
        id: 'l2',
        source: 'legacy',
        date: '2026-05-05T10:00:00Z',
        customer_name: 'B',
        customer_email: '',
        items: [],
        total_ht: 50,
        total_ttc: 60,
        status: 'approved',
      },
    ];
    const v11: OrderUI[] = [
      {
        id: 'v1',
        source: 'v1_1',
        date: '2026-05-15T10:00:00Z',
        customer_name: '—',
        customer_email: '',
        items: [],
        total_ht: 200,
        total_ttc: 240,
        status: 'draft',
      },
    ];
    const merged = mergeAndSortOrders(legacy, v11);
    expect(merged).toHaveLength(3);
    expect(merged[0].id).toBe('v1'); // 2026-05-15
    expect(merged[1].id).toBe('l1'); // 2026-05-10
    expect(merged[2].id).toBe('l2'); // 2026-05-05
  });

  it('cohorts vides -> array vide', () => {
    expect(mergeAndSortOrders([], [])).toEqual([]);
  });
});

describe('STATUS_LABELS — couverture statuts shop_orders + tenant_orders', () => {
  const expectedKeys = [
    // shop_orders
    'pending',
    'approved',
    // tenant_orders v1.1
    'draft',
    'validated',
    'in_production',
    'shipped',
    'delivered',
    'invoiced',
    'cancelled',
  ];
  it.each(expectedKeys)('statut "%s" est mappe', (key) => {
    expect(STATUS_LABELS[key]).toBeDefined();
    expect(STATUS_LABELS[key].label).toBeTruthy();
    expect(STATUS_LABELS[key].className).toBeTruthy();
  });
});
