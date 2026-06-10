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

// ─── S-ORDER-ROLES-3-UI helpers (Sprint 6+, 2026-06-09) ──────────────────

import {
  computeTabVisibility,
  TAB_LABELS,
  TAB_QUERY_PARAM,
  TAB_FROM_QUERY,
  TAB_EMPTY_STATES,
  type PortalOrdersTab,
} from '../../../../src/app/components/shop/portal/PortalOrders.helpers';

describe('S-ORDER-ROLES-3-UI — computeTabVisibility', () => {
  it('mine est toujours visible meme a zero', () => {
    const vis = computeTabVisibility({ mine: 0, to_validate: 0, to_approve: 0, to_produce: 0 });
    expect(vis.mine).toBe(true);
  });

  it('to_validate visible si compteur > 0', () => {
    const vis = computeTabVisibility({ mine: 5, to_validate: 3, to_approve: 0, to_produce: 0 });
    expect(vis.to_validate).toBe(true);
    expect(vis.to_approve).toBe(false);
    expect(vis.to_produce).toBe(false);
  });

  it('to_approve visible uniquement si compteur > 0', () => {
    const vis = computeTabVisibility({ mine: 0, to_validate: 0, to_approve: 1, to_produce: 0 });
    expect(vis.to_approve).toBe(true);
    expect(vis.to_validate).toBe(false);
  });

  it('to_produce visible uniquement si compteur > 0', () => {
    const vis = computeTabVisibility({ mine: 0, to_validate: 0, to_approve: 0, to_produce: 2 });
    expect(vis.to_produce).toBe(true);
  });

  it('aucun tab workflow visible si tous compteurs zero', () => {
    const vis = computeTabVisibility({ mine: 0, to_validate: 0, to_approve: 0, to_produce: 0 });
    expect(vis.to_validate).toBe(false);
    expect(vis.to_approve).toBe(false);
    expect(vis.to_produce).toBe(false);
  });
});

describe('S-ORDER-ROLES-3-UI — TAB_LABELS (FR brand voice)', () => {
  it.each([
    ['mine', 'Mes commandes'],
    ['to_validate', 'À valider'],
    ['to_approve', 'À approuver'],
    ['to_produce', 'À produire'],
  ] as Array<[PortalOrdersTab, string]>)('tab %s a le label "%s"', (tab, label) => {
    expect(TAB_LABELS[tab]).toBe(label);
  });

  it('aucun label ne contient d anglicisme jargon (lesson 2026-05-22)', () => {
    const blacklist = ['validate', 'approve', 'produce', 'pending', 'queue', 'inbox'];
    for (const label of Object.values(TAB_LABELS)) {
      const lower = label.toLowerCase();
      for (const word of blacklist) {
        expect(lower).not.toContain(word);
      }
    }
  });
});

describe('S-ORDER-ROLES-3-UI — TAB_QUERY_PARAM / TAB_FROM_QUERY round-trip', () => {
  it.each([
    'mine',
    'to_validate',
    'to_approve',
    'to_produce',
  ] as PortalOrdersTab[])('round-trip pour tab %s', (tab) => {
    const queryParam = TAB_QUERY_PARAM[tab];
    expect(queryParam).toBeTruthy();
    expect(TAB_FROM_QUERY[queryParam]).toBe(tab);
  });

  it('query params utilisent dashes pour URL clarity', () => {
    expect(TAB_QUERY_PARAM.mine).toBe('mine');
    expect(TAB_QUERY_PARAM.to_validate).toBe('to-validate');
    expect(TAB_QUERY_PARAM.to_approve).toBe('to-approve');
    expect(TAB_QUERY_PARAM.to_produce).toBe('to-produce');
  });

  it('TAB_FROM_QUERY retourne undefined pour query string inconnue', () => {
    expect(TAB_FROM_QUERY['unknown']).toBeUndefined();
    expect(TAB_FROM_QUERY['']).toBeUndefined();
  });
});

describe('S-ORDER-ROLES-3-UI — TAB_EMPTY_STATES presents pour chaque tab', () => {
  it.each([
    'mine',
    'to_validate',
    'to_approve',
    'to_produce',
  ] as PortalOrdersTab[])('tab %s a un empty state avec title + body', (tab) => {
    const state = TAB_EMPTY_STATES[tab];
    expect(state.title).toBeTruthy();
    expect(state.body).toBeTruthy();
  });

  it('seul mine a un ctaLabel (CTA Voir le catalogue)', () => {
    expect(TAB_EMPTY_STATES.mine.ctaLabel).toBeTruthy();
    expect(TAB_EMPTY_STATES.to_validate.ctaLabel).toBeUndefined();
    expect(TAB_EMPTY_STATES.to_approve.ctaLabel).toBeUndefined();
    expect(TAB_EMPTY_STATES.to_produce.ctaLabel).toBeUndefined();
  });
});
