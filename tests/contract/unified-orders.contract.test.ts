import { storefrontDetail, quoteDetail } from '../modules/orders/_fixtures/unified-order-detail';
import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from '@/modules/orders/application/orders-service';
import type { OrdersRepository } from '@/modules/orders/application/orders-repository';
import type { OrderListEntry } from '@/modules/orders/api/contracts';
import type { ApiPrincipal, PrincipalVerifier } from '@/modules/_shared/application';
import { InMemoryIdempotencyStore, encodeCursor, decodeCursor } from '@/modules/_shared/application';
import { createGescomApiHandler } from '@/server/api';
import { createUnifiedOrdersRoutes } from '@/server/api/unified-orders-routes';
import { checkResponseAgainstContract, checkAgainstSchema } from './_harness';

const tenantId = '00000000-0000-4000-9000-000000000001';
const userId = '00000000-0000-4000-9000-000000000002';
const base: OrderListEntry = {
  id: '00000000-0000-4000-9000-000000000003', origin: 'storefront', number: null,
  items: [{ name: 'Flyer', quantity: 2, unit_price_ht: '12.50', price_origin: 'catalog' }],
  shop_id: '00000000-0000-4000-9000-000000000004', shop_name: 'Atelier Lumière',
  customer_id: null, customer_name: 'Jean', customer_email: 'jean@example.invalid',
  created_at: '2026-10-05T12:00:00.000Z', status: 'draft', currency: 'EUR',
  total_ht: '25.00', total_ttc: '30.00', has_unverified_prices: false,
  current_production_step_id: null,
};
const quote: OrderListEntry = {
  ...base, id: '00000000-0000-4000-9000-000000000005', origin: 'quote',
  number: 'CDE-2026-00001', shop_id: null, shop_name: null,
  customer_id: '00000000-0000-4000-9000-000000000006', customer_email: null,
  status: 'validated', total_ht: '123.45', total_ttc: '130.24',
};

function setup(rows: OrderListEntry[] = [quote, base]) {
  const listOrders = vi.fn().mockResolvedValue(rows);
  const service = new OrdersService({ listOrders } as unknown as OrdersRepository);
  const principal = { kind: 'user', tenantId, userId } as ApiPrincipal;
  const verifier: PrincipalVerifier = { verify: async (credential) => credential.kind === 'bearer' ? principal : null };
  const handler = createGescomApiHandler({
    routes: createUnifiedOrdersRoutes(service), principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(), requestIdFactory: () => 'req-orders',
  });
  const request = (query = '') => handler(new Request(`https://example.invalid/api/v1/order-summaries${query}`, {
    headers: { Authorization: 'Bearer test' },
  }));
  return { request, listOrders };
}

describe('GET /orders — contrat commun E4.4b', () => {
  it('rend les deux origines et leurs relations facultatives dans une seule page conforme', async () => {
    const { request, listOrders } = setup();
    const response = await request('?page[size]=1');
    expect(response.status).toBe(200);
    expect(response.headers.get('deprecation')).toBeNull();
    expect(await checkResponseAgainstContract(response, { status: 200 })).toEqual({ valid: true, errors: [] });
    const body = await response.json();
    expect(checkAgainstSchema('OrderListEntry', body.data[0])).toEqual({ valid: true, errors: [] });
    expect(body.data).toEqual([quote]);
    expect(decodeCursor(body.meta.next_cursor)).toEqual({ sort: quote.created_at, id: quote.id });
    expect(listOrders).toHaveBeenCalledWith(tenantId, expect.objectContaining({ actor: userId, size: 1, cursor: null }));
  });

  it('transmet les filtres et des bornes civiles Europe/Paris avant la pagination', async () => {
    const { request, listOrders } = setup([]);
    const params = new URLSearchParams({ origin: 'quote', status: 'validated', customer_id: quote.customer_id!,
      customer_search: '  Jean  ', shop_id: base.shop_id!, current_production_step_id: base.id,
      created_from: '2026-10-05', created_to: '2026-10-05', 'page[cursor]': encodeCursor({ sort: base.created_at, id: base.id }),
    });
    expect((await request(`?${params}`)).status).toBe(200);
    expect(listOrders).toHaveBeenCalledWith(tenantId, expect.objectContaining({
      filters: expect.objectContaining({ origin: 'quote', customer_search: 'Jean', customer_id: quote.customer_id,
        shop_id: base.shop_id, current_production_step_id: base.id, status: 'validated' }),
      createdAtFrom: '2026-10-04T22:00:00.000Z', createdAtTo: '2026-10-05T22:00:00.000Z',
      cursor: { sort: base.created_at, id: base.id },
    }));
  });

  it.each([
    '?origin=other', '?status=pending', '?customer_id=bad', '?shop_id=bad', '?current_production_step_id=bad',
    '?created_from=2026-02-30', '?created_from=2026-10-06&created_to=2026-10-05', '?customer_search=%20',
    `?page[cursor]=${encodeCursor({ sort: 'invalid', id: base.id })}`,
    `?page[cursor]=${encodeCursor({ sort: base.created_at, id: 'invalid' })}`,
    '?page[size]=0', '?page[cursor]=bad',
  ])('refuse une sélection invalide sans interroger le repository (%s)', async (query) => {
    const { request, listOrders } = setup();
    expect((await request(query)).status).toBe(422);
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('utilise la position SQL précise sans exposer de champ interne dans le DTO', async () => {
    const { request } = setup([{ ...quote, cursorCreatedAt: '2026-10-05T12:00:00.000123Z' } as OrderListEntry, base]);
    const body = await (await request('?page[size]=1')).json();
    expect(decodeCursor(body.meta.next_cursor).sort).toBe('2026-10-05T12:00:00.000123Z');
    expect(body.data[0]).not.toHaveProperty('cursorCreatedAt');
  });

  it('ne renvoie pas de curseur après la dernière page', async () => {
    const { request } = setup([base]);
    const body = await (await request('?page[size]=1')).json();
    expect(body.meta.next_cursor).toBeNull();
  });

  it('accepte une clé de service limitée à orders:read sans inventer d’utilisateur', async () => {
    const { listOrders } = setup();
    const handler = createGescomApiHandler({ routes: createUnifiedOrdersRoutes(new OrdersService({ listOrders } as unknown as OrdersRepository)),
      principalVerifier: { verify: async () => ({ kind: 'service', serviceId: 'studio', tenantId, scopes: ['orders:read'] }) as ApiPrincipal },
      idempotencyStore: new InMemoryIdempotencyStore(),
    });
    expect((await handler(new Request('https://example.invalid/api/v1/order-summaries', { headers: { 'X-Magrit-Service-Key': 'test' } }))).status).toBe(200);
    expect(listOrders).toHaveBeenCalledWith(tenantId, expect.objectContaining({ actor: null }));
  });

  it('refuse une clé de service privée du scope orders:read', async () => {
    const { listOrders } = setup();
    const handler = createGescomApiHandler({ routes: createUnifiedOrdersRoutes(new OrdersService({ listOrders } as unknown as OrdersRepository)),
      principalVerifier: { verify: async () => ({ kind: 'service', serviceId: 'studio', tenantId, scopes: [] }) as ApiPrincipal },
      idempotencyStore: new InMemoryIdempotencyStore(),
    });
    expect((await handler(new Request('https://example.invalid/api/v1/order-summaries', { headers: { 'X-Magrit-Service-Key': 'test' } }))).status).toBe(403);
    expect(listOrders).not.toHaveBeenCalled();
  });
});


describe('GET /order-summaries/{orderId} — détail commun', () => {
  function detailSetup(detail: unknown = storefrontDetail, principal: ApiPrincipal = { kind: 'user', tenantId, userId } as ApiPrincipal) {
    const getUnifiedOrderDetail = vi.fn().mockResolvedValue(detail);
    const handler = createGescomApiHandler({
      routes: createUnifiedOrdersRoutes(new OrdersService({ getUnifiedOrderDetail } as unknown as OrdersRepository)),
      principalVerifier: { verify: async () => principal }, idempotencyStore: new InMemoryIdempotencyStore(),
    });
    return { getUnifiedOrderDetail, request: (id = base.id, headers: Record<string, string> = { Authorization: 'Bearer test' }) =>
      handler(new Request(`https://example.invalid/api/v1/order-summaries/${id}`, { headers })) };
  }

  it.each([storefrontDetail, quoteDetail])('rend les lignes et références de $origin par une lecture unique conforme', async (detail) => {
    const { request, getUnifiedOrderDetail } = detailSetup(detail);
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('deprecation')).toBeNull();
    expect(await checkResponseAgainstContract(response, { status: 200 })).toEqual({ valid: true, errors: [] });
    const body = await response.json();
    expect(checkAgainstSchema('UnifiedOrderDetail', body.data)).toEqual({ valid: true, errors: [] });
    expect(body.data).toEqual(detail);
    expect(getUnifiedOrderDetail).toHaveBeenCalledExactlyOnceWith(tenantId, base.id, userId);
  });

  it('rend un 404 unique quand la commande est absente du tenant', async () => {
    const { request } = detailSetup(null);
    const response = await request();
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('order.not_found');
  });

  it('refuse un identifiant invalide avant lecture SQL', async () => {
    const { request, getUnifiedOrderDetail } = detailSetup();
    expect((await request('incorrect')).status).toBe(422);
    expect(getUnifiedOrderDetail).not.toHaveBeenCalled();
  });

  it('accepte une clé de service limitée à orders:read', async () => {
    const { request, getUnifiedOrderDetail } = detailSetup(storefrontDetail,
      { kind: 'service', serviceId: 'studio', tenantId, scopes: ['orders:read'] } as ApiPrincipal);
    expect((await request(base.id, { 'X-Magrit-Service-Key': 'test' })).status).toBe(200);
    expect(getUnifiedOrderDetail).toHaveBeenCalledExactlyOnceWith(tenantId, base.id, null);
  });

  it('refuse le détail à une clé de service privée du scope orders:read', async () => {
    const { request, getUnifiedOrderDetail } = detailSetup(storefrontDetail,
      { kind: 'service', serviceId: 'studio', tenantId, scopes: [] } as ApiPrincipal);
    expect((await request(base.id, { 'X-Magrit-Service-Key': 'test' })).status).toBe(403);
    expect(getUnifiedOrderDetail).not.toHaveBeenCalled();
  });
});
