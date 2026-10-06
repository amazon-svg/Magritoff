import { storefrontDetail, quoteDetail } from './_fixtures/unified-order-detail';
import { describe, expect, it, vi } from 'vitest';
import { OrdersApiClient } from '@/modules/orders/api/client';
import { FetchApiClient } from '@/platform/api/fetch-api-client';
import { orderListEntryToUi } from '@/modules/orders/ui/hooks/useUnifiedOrders';
import type { OrderListEntry } from '@/modules/orders/api/contracts';

const order: OrderListEntry = {
  id: '00000000-0000-4000-9000-000000000001', origin: 'quote', number: 'CDE-2026-00001',
  shop_id: null, shop_name: null, customer_id: '00000000-0000-4000-9000-000000000002',
  customer_name: 'Jean', customer_email: null, created_at: '2026-10-05T12:00:00.000Z', status: 'validated',
  currency: 'EUR', total_ht: '123.45', total_ttc: '130.24', has_unverified_prices: false,
  current_production_step_id: null, items: [{ name: 'Flyer', quantity: 2, unit_price_ht: '61.73', price_origin: 'quoted' }],
};

describe('lecture commune du dashboard commandes', () => {
  it('charge une seule page et transmet tous les filtres sans appel client complémentaire', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ data: [order], meta: { request_id: 'test', next_cursor: 'suite' } }));
    const api = new OrdersApiClient(new FetchApiClient('https://magrit.test', fetcher));
    const response = await api.list({ pageSize: 50, pageCursor: 'precedent', origin: 'quote', status: 'validated',
      customer_search: 'Jean', customer_id: order.customer_id!, shop_id: order.id,
      quote_id: order.id, current_production_step_id: order.id,
      created_from: '2026-10-01', created_to: '2026-10-05' });
    expect(response).toEqual({ items: [order], nextCursor: 'suite' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/v1/order-summaries');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'page[size]': '50', 'page[cursor]': 'precedent', origin: 'quote', status: 'validated',
      customer_search: 'Jean', customer_id: order.customer_id, shop_id: order.id,
      quote_id: order.id, current_production_step_id: order.id,
      created_from: '2026-10-01', created_to: '2026-10-05',
    });
  });

  it('conserve référence, lien client, lignes et montants dans la grille', () => {
    expect(orderListEntryToUi(order)).toMatchObject({
      id: order.id, number: order.number, customer_id: order.customer_id, source: 'commercial',
      customer_name: 'Jean', total_ht: 123.45, total_ttc: 130.24,
      items: [{ name: 'Flyer', qty: 2, price_ht: 61.73, priceOrigin: 'quoted' }],
    });
    expect(orderListEntryToUi({ ...order, origin: 'storefront', number: null, customer_id: null, shop_name: 'Atelier Lumière', has_unverified_prices: true }))
      .toMatchObject({ source: 'v1_1', number: null, customer_id: null, shop_name: 'Atelier Lumière', hasUnverifiedPrices: true });
  });
});


describe('transport du détail commun', () => {
  it.each([storefrontDetail, quoteDetail])('charge $origin par une seule requête sans sondage historique', async (detail) => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ data: detail, meta: { request_id: 'test' } }));
    const api = new OrdersApiClient(new FetchApiClient('https://magrit.test', fetcher));
    expect(await api.getUnifiedDetail(detail.id)).toEqual(detail);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetcher.mock.calls[0][0])).pathname).toBe(`/api/v1/order-summaries/${detail.id}`);
  });
});
