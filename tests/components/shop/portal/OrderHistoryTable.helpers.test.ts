/**
 * Tests vitest pour les helpers purs de OrderHistoryTable (Story S3.1 Sprint 5).
 *
 * Cible applyFilters + applySort qui sont les fonctions metier critiques.
 * Le rendu UI est valide manuellement (TF Notion + smoke local).
 */

import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  applySort,
} from '../../../../src/app/components/shop/portal/OrderHistoryTable';
import type { OrderUI } from '../../../../src/app/components/shop/portal/PortalOrders.helpers';

function makeOrder(overrides: Partial<OrderUI>): OrderUI {
  return {
    id: 'o-default',
    source: 'v1_1',
    date: '2026-05-23T10:00:00Z',
    customer_name: 'Test User',
    customer_email: 't@example.com',
    items: [{ name: 'Cartes', qty: 500, price_ht: 100 }],
    total_ht: 500,
    total_ttc: 600,
    status: 'draft',
    ...overrides,
  };
}

const DEFAULT_STATE = {
  selectedStatuses: [],
  period: 'all' as const,
  customDateFrom: '',
  customDateTo: '',
  amountMinHt: '',
  sortBy: 'date' as const,
  sortDir: 'desc' as const,
};

describe('OrderHistoryTable.applyFilters', () => {
  it('no filter actif → renvoie tous les orders', () => {
    const orders = [makeOrder({ id: 'o1' }), makeOrder({ id: 'o2' })];
    expect(applyFilters(orders, DEFAULT_STATE)).toHaveLength(2);
  });

  it('filtre statut single → ne garde que les orders du statut coche', () => {
    const orders = [
      makeOrder({ id: 'o1', status: 'draft' }),
      makeOrder({ id: 'o2', status: 'validated' }),
      makeOrder({ id: 'o3', status: 'cancelled' }),
    ];
    const result = applyFilters(orders, { ...DEFAULT_STATE, selectedStatuses: ['draft'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('o1');
  });

  it('filtre statut multi → garde tous les statuts coches', () => {
    const orders = [
      makeOrder({ id: 'o1', status: 'draft' }),
      makeOrder({ id: 'o2', status: 'validated' }),
      makeOrder({ id: 'o3', status: 'cancelled' }),
    ];
    const result = applyFilters(orders, {
      ...DEFAULT_STATE,
      selectedStatuses: ['draft', 'cancelled'],
    });
    expect(result.map((o) => o.id).sort()).toEqual(['o1', 'o3']);
  });

  it('filtre periode 7j → masque les orders > 7 jours', () => {
    const now = Date.now();
    const orders = [
      makeOrder({ id: 'recent', date: new Date(now - 3 * 86_400_000).toISOString() }),
      makeOrder({ id: 'old', date: new Date(now - 10 * 86_400_000).toISOString() }),
    ];
    const result = applyFilters(orders, { ...DEFAULT_STATE, period: '7d' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('recent');
  });

  it('filtre periode custom date range (from + to)', () => {
    const orders = [
      makeOrder({ id: 'in', date: '2026-05-15T10:00:00Z' }),
      makeOrder({ id: 'before', date: '2026-04-30T10:00:00Z' }),
      makeOrder({ id: 'after', date: '2026-05-25T10:00:00Z' }),
    ];
    const result = applyFilters(orders, {
      ...DEFAULT_STATE,
      period: 'custom',
      customDateFrom: '2026-05-01',
      customDateTo: '2026-05-20',
    });
    expect(result.map((o) => o.id)).toEqual(['in']);
  });

  it('filtre montant HT min → masque les orders sous le seuil', () => {
    const orders = [
      makeOrder({ id: 'high', total_ht: 5000 }),
      makeOrder({ id: 'mid', total_ht: 500 }),
      makeOrder({ id: 'low', total_ht: 50 }),
    ];
    const result = applyFilters(orders, { ...DEFAULT_STATE, amountMinHt: '1000' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('high');
  });

  it('amountMinHt vide ou 0 ou non-numerique → pas de filtre', () => {
    const orders = [makeOrder({ total_ht: 50 })];
    expect(applyFilters(orders, { ...DEFAULT_STATE, amountMinHt: '' })).toHaveLength(1);
    expect(applyFilters(orders, { ...DEFAULT_STATE, amountMinHt: '0' })).toHaveLength(1);
    expect(applyFilters(orders, { ...DEFAULT_STATE, amountMinHt: 'abc' })).toHaveLength(1);
  });

  it('combinaison filtres (statut + periode + montant)', () => {
    const now = Date.now();
    const orders = [
      makeOrder({ id: 'match', status: 'draft', date: new Date(now - 2 * 86_400_000).toISOString(), total_ht: 2000 }),
      makeOrder({ id: 'wrong-status', status: 'cancelled', date: new Date(now - 2 * 86_400_000).toISOString(), total_ht: 2000 }),
      makeOrder({ id: 'too-old', status: 'draft', date: new Date(now - 30 * 86_400_000).toISOString(), total_ht: 2000 }),
      makeOrder({ id: 'too-cheap', status: 'draft', date: new Date(now - 2 * 86_400_000).toISOString(), total_ht: 500 }),
    ];
    const result = applyFilters(orders, {
      ...DEFAULT_STATE,
      selectedStatuses: ['draft'],
      period: '7d',
      amountMinHt: '1000',
    });
    expect(result.map((o) => o.id)).toEqual(['match']);
  });
});

describe('OrderHistoryTable.applySort', () => {
  const o1 = makeOrder({ id: 'o1', date: '2026-05-23T10:00:00Z', total_ht: 100, total_ttc: 120 });
  const o2 = makeOrder({ id: 'o2', date: '2026-05-22T10:00:00Z', total_ht: 500, total_ttc: 600 });
  const o3 = makeOrder({ id: 'o3', date: '2026-05-24T10:00:00Z', total_ht: 300, total_ttc: 360 });

  it('tri date desc (default) → plus recent en premier', () => {
    const sorted = applySort([o1, o2, o3], { ...DEFAULT_STATE, sortBy: 'date', sortDir: 'desc' });
    expect(sorted.map((o) => o.id)).toEqual(['o3', 'o1', 'o2']);
  });

  it('tri date asc → plus ancien en premier', () => {
    const sorted = applySort([o1, o2, o3], { ...DEFAULT_STATE, sortBy: 'date', sortDir: 'asc' });
    expect(sorted.map((o) => o.id)).toEqual(['o2', 'o1', 'o3']);
  });

  it('tri total_ht asc → croissant', () => {
    const sorted = applySort([o1, o2, o3], { ...DEFAULT_STATE, sortBy: 'total_ht', sortDir: 'asc' });
    expect(sorted.map((o) => o.id)).toEqual(['o1', 'o3', 'o2']);
  });

  it('tri total_ttc desc → decroissant', () => {
    const sorted = applySort([o1, o2, o3], { ...DEFAULT_STATE, sortBy: 'total_ttc', sortDir: 'desc' });
    expect(sorted.map((o) => o.id)).toEqual(['o2', 'o3', 'o1']);
  });

  it('ne mute pas le tableau source', () => {
    const input = [o1, o2, o3];
    const inputCopy = [...input];
    applySort(input, { ...DEFAULT_STATE, sortBy: 'total_ht', sortDir: 'asc' });
    expect(input).toEqual(inputCopy);
  });
});
