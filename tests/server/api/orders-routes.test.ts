import { describe, expect, it } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  OrderCommandRejectedError,
  OrdersApiClient,
  OrdersService,
  type OrdersRepository,
} from '../../../src/modules/orders';
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
    await expect(client.transition('order-af4', {
      toStatus: 'validated', reason: null, idempotencyKey: 'transition-af5-route',
    })).resolves.toEqual({
      orderId: 'order-af4', fromStatus: 'draft', toStatus: 'validated', replayed: false,
    });
    await expect(client.create({
      shopId: '11111111-1111-4111-8111-111111111111',
      currency: 'EUR', notes: '', idempotencyKey: 'create-af5-route',
      items: [{
        productId: null, productLabel: 'Flyers', clariprintOptions: null,
        quantity: 2, unitPriceHt: 75,
      }],
    })).resolves.toMatchObject({ totalHt: 150, replayed: false });
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

  it('traduit un conflit de transition en Problem Details 409', async () => {
    const repository = repositoryStub();
    repository.transitionOrder = async () => {
      throw new OrderCommandRejectedError('transition_not_allowed', 'validated -> validated');
    };
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository)),
      requestIdFactory: () => 'request-af5-conflict',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af5') }; } },
    });
    const response = await handler(new Request('https://magrit.test/api/v1/orders/order-af4/transitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toStatus: 'validated', reason: null, idempotencyKey: 'transition-af5-conflict',
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'orders.transition_not_allowed', requestId: 'request-af5-conflict',
    });
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
    transitionOrder: async (orderId, command) => ({
      orderId, fromStatus: 'draft', toStatus: command.toStatus, replayed: false,
    }),
    notifyTransition: async () => undefined,
    createOrder: async (command) => ({
      orderId: '22222222-2222-4222-8222-222222222222',
      tenantId: '33333333-3333-4333-8333-333333333333',
      shopId: command.shopId,
      totalHt: command.items.reduce((sum, item) => sum + item.quantity * item.unitPriceHt, 0),
      currency: command.currency,
      replayed: false,
    }),
    notifyOrderCreated: async () => undefined,
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
