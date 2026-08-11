import { describe, expect, it } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import { OrdersApiClient, OrdersService, type OrdersRepository } from '../../../src/modules/orders';
import { FetchApiClient } from '../../../src/platform/api';
import { createApiV1Application, createOrdersRoutes } from '../../../src/server/api';

describe('routes Orders API v1', () => {
  it('partage les contrats liste, portail et audit entre handler et client', async () => {
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repositoryStub())),
      requestIdFactory: () => 'request-af4',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af4') }; } },
    });
    const client = new OrdersApiClient(new FetchApiClient('https://magrit.test', bridgeTo(handler), () => 'jwt-af4'));

    await expect(client.listTenantOrders('tenant-af4', ['shop-af4'])).resolves.toMatchObject({
      orders: [{ id: 'order-af4', source: 'v1_1' }],
    });
    await expect(client.listPortalOrders('shop-af4')).resolves.toMatchObject({
      counters: { mine: 1 }, datasets: { mine: [{ id: 'order-af4' }] },
    });
    await expect(client.getAuditTrail('order-af4')).resolves.toMatchObject({
      events: [{ eventId: 'event-af4', orderId: 'order-af4' }],
    });
  });

  it('refuse les lectures sans authentification', async () => {
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repositoryStub())),
      requestIdFactory: () => 'request-af4',
    });
    const response = await handler(new Request('https://magrit.test/api/v1/shops/shop-af4/orders'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'identity.authentication_required' });
  });
});

function repositoryStub(): OrdersRepository {
  const order = {
    id: 'order-af4', shopId: 'shop-af4', createdAt: '2026-08-11T12:00:00.000Z',
    items: [], totalHt: 10, status: 'draft',
  };
  return {
    getTenantTaxRegime: async () => 'metropole_fr',
    getShopTaxRegime: async () => 'metropole_fr',
    listTenantOrders: async () => [order],
    listTenantOrdersByIds: async () => [order],
    listLegacyOrders: async () => [],
    getPortalCounters: async () => ({ mine: 1, to_validate: 0, to_approve: 0, to_produce: 0 }),
    getPortalOrderIds: async (_shopId, _userId, tab) => tab === 'mine' ? ['order-af4'] : [],
    getAuthenticatedUserEmail: async () => 'buyer@magrit.test',
    listAuditEvents: async () => [{
      eventId: 'event-af4', orderId: 'order-af4', kind: 'status', eventType: 'status_transition',
      actorId: 'user-af4', actorEmail: null, roleName: null, payload: {}, occurredAt: '2026-08-11T12:01:00.000Z',
    }],
  };
}

function bridgeTo(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
}

function id(value: string): UserId {
  const parsed = parseId<'UserId'>(value);
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
