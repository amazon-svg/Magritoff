import { describe, expect, it } from 'vitest';
import { parseId, type UserId } from '@/kernel';
import {
  OrderCommandRejectedError,
  OrdersApiClient,
  OrdersService,
  type OrdersRepository,
} from '@/modules/orders';
import { FetchApiClient } from '@/platform/api';
import { createApiV1Application, createOrdersRoutes } from '@/server/api';
import { StorefrontSessionService } from '@/modules/shop-customers';
import { storefrontSessionCookiePolicy } from '@/server/storefront/session-cookie';

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
        quantity: 2, expectedUnitPriceHt: '75.00',
      }],
    })).resolves.toMatchObject({ totalHt: '150.00', replayed: false });
    const draftOrderId = '22222222-2222-4222-8222-222222222222';
    await expect(client.getDraft(draftOrderId)).resolves.toMatchObject({
      orderId: draftOrderId, status: 'draft', items: [{ productLabel: 'Flyers' }],
    });
    await expect(client.updateDraft(draftOrderId, {
      items: [{
        id: '44444444-4444-4444-8444-444444444444',
        productLabel: 'Flyers premium', quantity: 3, expectedUnitPriceHt: '60.00',
      }],
      idempotencyKey: 'update-af5-route',
    })).resolves.toMatchObject({ orderId: draftOrderId, totalHt: '180.00', replayed: false });
    await expect(client.getRoles(draftOrderId)).resolves.toMatchObject({
      isCreator: true, capabilities: { can_order: true },
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

  it('crée une commande avec la session boutique correspondant au shop', async () => {
    let authorization: unknown = null;
    let portalToken: string | null = null;
    const resourceTokens: Array<string | null> = [];
    let transitionAuthorization: unknown = null;
    let auditToken: string | null = null;
    const repository = repositoryStub();
    repository.createOrder = async (command, received) => {
      authorization = received;
      return {
        orderId: '22222222-2222-4222-8222-222222222222',
        tenantId: '33333333-3333-4333-8333-333333333333',
        shopId: command.shopId, totalHt: '150.00', currency: command.currency, replayed: false,
      };
    };
    repository.getStorefrontPortalOrders = async (_shopId, receivedToken) => {
      portalToken = receivedToken;
      return { orders: [], taxRegime: 'metropole_fr' };
    };
    repository.getDraftOrder = async (orderId, received) => {
      resourceTokens.push(received.storefrontToken);
      return {
        orderId, status: 'draft', createdAt: '2026-08-17T12:00:00.000Z', totalHt: '150.00',
        hasUnverifiedPrices: false,
        items: [{
          id: '55555555-5555-4555-8555-555555555555', productId: null, productLabel: 'Flyers',
          clariprintOptions: null, quantity: 2, unitPriceHt: '75.00', lineTotalHt: '150.00',
          priceOrigin: 'client_unverified',
        }],
      };
    };
    repository.updateDraftOrder = async (orderId, command, received) => {
      resourceTokens.push(received.storefrontToken);
      return { orderId, totalHt: command.items[0]?.expectedUnitPriceHt ?? '0.00', replayed: false };
    };
    repository.transitionOrder = async (orderId, command, received) => {
      transitionAuthorization = received;
      return { orderId, fromStatus: 'draft', toStatus: command.toStatus, replayed: false };
    };
    repository.listAuditEvents = async (_orderId, received) => {
      auditToken = received.storefrontToken;
      return [];
    };
    const shopId = '11111111-1111-4111-8111-111111111111';
    const sessions = new StorefrontSessionService({
      async resolve() { return {
        identity: { kind: 'shop_customer', shopId, shopCustomerAccountId: '44444444-4444-4444-8444-444444444444' },
        customer: { id: '44444444-4444-4444-8444-444444444444', shopId, email: 'client@example.com', fullName: 'Client', status: 'active' },
        expiresAt: '2026-08-17T12:00:00.000Z',
      }; },
      async revoke() { return true; },
    });
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository), sessions, storefrontSessionCookiePolicy(false)),
      requestIdFactory: () => 'request-um6-storefront',
    });
    const token = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-storefront';
    const response = await handler(new Request('https://magrit.test/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `magrit-storefront=${token}` },
      body: JSON.stringify({
        shopId, currency: 'EUR', notes: '', idempotencyKey: 'create-um6-storefront',
        items: [{ productId: null, productLabel: 'Flyers', clariprintOptions: null, quantity: 2, expectedUnitPriceHt: '75.00' }],
      }),
    }));
    expect(response.status).toBe(201);
    expect(authorization).toEqual({ kind: 'storefront_session', opaqueToken: token });
    const portalResponse = await handler(new Request(`https://magrit.test/api/v1/shops/${shopId}/orders`, {
      headers: { Cookie: `magrit-storefront=${token}` },
    }));
    expect(portalResponse.status).toBe(200);
    expect(portalToken).toBe(token);
    const orderId = '22222222-2222-4222-8222-222222222222';
    const draftResponse = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`, {
      headers: { Cookie: `magrit-storefront=${token}` },
    }));
    expect(draftResponse.status).toBe(200);
    const updateResponse = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: `magrit-storefront=${token}` },
      body: JSON.stringify({
        items: [{ id: '55555555-5555-4555-8555-555555555555', productLabel: 'Flyers premium', quantity: 2, expectedUnitPriceHt: '80.00' }],
        idempotencyKey: 'update-um6-storefront',
      }),
    }));
    expect(updateResponse.status).toBe(200);
    expect(resourceTokens).toEqual([token, token]);
    const transitionResponse = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `magrit-storefront=${token}` },
      body: JSON.stringify({ toStatus: 'cancelled', reason: null, idempotencyKey: 'cancel-um6-storefront' }),
    }));
    expect(transitionResponse.status).toBe(200);
    expect(transitionAuthorization).toEqual({ storefrontToken: token, magritUserId: null });
    const auditResponse = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/audit`, {
      headers: { Cookie: `magrit-storefront=${token}` },
    }));
    expect(auditResponse.status).toBe(200);
    expect(auditToken).toBe(token);
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

  it('traduit un historique appartenant à un autre compte en Problem Details 403', async () => {
    const repository = repositoryStub();
    repository.listAuditEvents = async () => {
      throw new OrderCommandRejectedError('permission_denied', 'order identity mismatch');
    };
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository)),
      requestIdFactory: () => 'request-um6-audit-forbidden',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-um6') }; } },
    });
    const response = await handler(new Request(
      'https://magrit.test/api/v1/orders/22222222-2222-4222-8222-222222222222/audit',
    ));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'orders.permission_denied', requestId: 'request-um6-audit-forbidden',
    });
  });

  it('traduit un brouillon verrouillé en Problem Details 409', async () => {
    const repository = repositoryStub();
    repository.updateDraftOrder = async () => {
      throw new OrderCommandRejectedError('order_not_editable', 'status is validated');
    };
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository)),
      requestIdFactory: () => 'request-af5-draft-conflict',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af5') }; } },
    });
    const response = await handler(new Request(
      'https://magrit.test/api/v1/orders/22222222-2222-4222-8222-222222222222/draft',
      {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            id: '44444444-4444-4444-8444-444444444444',
            productLabel: 'Flyers', quantity: 1, expectedUnitPriceHt: '10.00',
          }],
          idempotencyKey: 'update-af5-conflict',
        }),
      },
    ));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'orders.order_not_editable', requestId: 'request-af5-draft-conflict',
    });
  });

  // Q17-a (docs/api/CONVENTIONS.md §8.25 point 12 (f)) — le contrat n accepte
  // plus qu une chaîne décimale sur le prix d une ligne. Ce cas ÉCHOUAIT
  // avant ce lot (le nombre JSON était accepté) : c est le test qui le
  // prouve, pas seulement une affirmation du cadrage.
  it('refuse un prix de ligne envoyé en nombre JSON (Q17-a, expectedUnitPriceHt doit être une chaîne)', async () => {
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repositoryStub())),
      requestIdFactory: () => 'request-q17a-number-price',
    });
    const response = await handler(new Request('https://magrit.test/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: '11111111-1111-4111-8111-111111111111',
        currency: 'EUR', notes: '', idempotencyKey: 'q17a-number-price',
        items: [{ productId: null, productLabel: 'Flyers', clariprintOptions: null, quantity: 2, expectedUnitPriceHt: 75 }],
      }),
    }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe('api.validation_failed');
  });

  it('traduit un écart de prix recalculé en Problem Details 409 avec errors[] (Q17-a, point 12 (d))', async () => {
    const repository = repositoryStub();
    repository.createOrder = async () => {
      throw new OrderCommandRejectedError(
        'price_changed',
        'Le prix de certaines lignes a changé.',
        [{ productLabel: 'Flyers', submitted: '0.00', current: '12.00' }],
      );
    };
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository)),
      requestIdFactory: () => 'request-q17a-price-changed',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-q17a') }; } },
    });
    const response = await handler(new Request('https://magrit.test/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: '11111111-1111-4111-8111-111111111111',
        currency: 'EUR', notes: '', idempotencyKey: 'q17a-price-changed',
        items: [{ productId: null, productLabel: 'Flyers', clariprintOptions: null, quantity: 1, expectedUnitPriceHt: '0.00' }],
      }),
    }));
    expect(response.status).toBe(409);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'orders.price_changed',
      errors: [{ product_label: 'Flyers', submitted: '0.00', current: '12.00' }],
    });
  });

  it('traduit un produit hors catalogue de la boutique en Problem Details 422 (Q17-a, point 12 (b))', async () => {
    const repository = repositoryStub();
    repository.createOrder = async () => {
      throw new OrderCommandRejectedError('product_not_in_shop', 'product_not_in_shop: hors périmètre');
    };
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository)),
      requestIdFactory: () => 'request-q17a-not-in-shop',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-q17a') }; } },
    });
    const response = await handler(new Request('https://magrit.test/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: '11111111-1111-4111-8111-111111111111',
        currency: 'EUR', notes: '', idempotencyKey: 'q17a-not-in-shop',
        items: [{ productId: '99999999-9999-4999-8999-999999999999', productLabel: 'Hors catalogue', clariprintOptions: null, quantity: 1, expectedUnitPriceHt: '10.00' }],
      }),
    }));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: 'orders.product_not_in_shop' });
  });

  it('émet un ETag sur GET /draft et honore If-Match sans l exiger (Q17-a, point 12 (e))', async () => {
    const repository = repositoryStub();
    const orderId = '22222222-2222-4222-8222-222222222222';
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository)),
      requestIdFactory: () => 'request-q17a-etag',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-q17a') }; } },
    });

    const getResponse = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`));
    expect(getResponse.status).toBe(200);
    const etag = getResponse.headers.get('ETag');
    expect(etag).toBeTruthy();

    // If-Match ABSENT : non exigé, la modification passe (point 12 (e)).
    const putWithoutIfMatch = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: '44444444-4444-4444-8444-444444444444', productLabel: 'Flyers', quantity: 2, expectedUnitPriceHt: '75.00' }],
        idempotencyKey: 'q17a-etag-no-if-match',
      }),
    }));
    expect(putWithoutIfMatch.status).toBe(200);

    // If-Match PRÉSENT et CORRECT : passe.
    const putWithCorrectIfMatch = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag! },
      body: JSON.stringify({
        items: [{ id: '44444444-4444-4444-8444-444444444444', productLabel: 'Flyers', quantity: 2, expectedUnitPriceHt: '75.00' }],
        idempotencyKey: 'q17a-etag-correct-if-match',
      }),
    }));
    expect(putWithCorrectIfMatch.status).toBe(200);

    // If-Match PRÉSENT et FAUX : refuse en 409 api.resource_conflict.
    // DURCISSEMENT D3 (qa-review round 1) — code du socle E10
    // (`SHARED_PROBLEM_CODES.resourceConflict`), pas un `orders.draft_changed`
    // inventé localement : `assertPrecondition`/`resourceConflict` sont les
    // utilitaires PARTAGÉS (`_shared/application/concurrency.ts`).
    const putWithWrongIfMatch = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"0000000000000000000000000000000000000000000000000000000000000000"' },
      body: JSON.stringify({
        items: [{ id: '44444444-4444-4444-8444-444444444444', productLabel: 'Flyers', quantity: 2, expectedUnitPriceHt: '75.00' }],
        idempotencyKey: 'q17a-etag-wrong-if-match',
      }),
    }));
    expect(putWithWrongIfMatch.status).toBe(409);
    await expect(putWithWrongIfMatch.json()).resolves.toMatchObject({ code: 'api.resource_conflict' });

    // DURCISSEMENT D3 — `If-Match: *` et un ETag malformé sont des erreurs de
    // SYNTAXE (400 api.if_match_invalid), jamais un 409 : `readIfMatch` les
    // refuse AVANT toute comparaison à l état courant.
    const putWithWildcardIfMatch = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '*' },
      body: JSON.stringify({
        items: [{ id: '44444444-4444-4444-8444-444444444444', productLabel: 'Flyers', quantity: 2, expectedUnitPriceHt: '75.00' }],
        idempotencyKey: 'q17a-etag-wildcard-if-match',
      }),
    }));
    expect(putWithWildcardIfMatch.status).toBe(400);
    await expect(putWithWildcardIfMatch.json()).resolves.toMatchObject({ code: 'api.if_match_invalid' });

    const putWithMalformedIfMatch = await handler(new Request(`https://magrit.test/api/v1/orders/${orderId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': 'pas-un-etag' },
      body: JSON.stringify({
        items: [{ id: '44444444-4444-4444-8444-444444444444', productLabel: 'Flyers', quantity: 2, expectedUnitPriceHt: '75.00' }],
        idempotencyKey: 'q17a-etag-malformed-if-match',
      }),
    }));
    expect(putWithMalformedIfMatch.status).toBe(400);
    await expect(putWithMalformedIfMatch.json()).resolves.toMatchObject({ code: 'api.if_match_invalid' });
  });

  it('traduit un refus de validation pour prix non vérifié en Problem Details 409 (Q17-a, point 12 (c))', async () => {
    const repository = repositoryStub();
    repository.transitionOrder = async () => {
      throw new OrderCommandRejectedError('unverified_prices', 'unverified_prices: ["Flyers"]');
    };
    const handler = createApiV1Application({
      routes: createOrdersRoutes(new OrdersService(repository)),
      requestIdFactory: () => 'request-q17a-unverified',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-q17a') }; } },
    });
    const response = await handler(new Request('https://magrit.test/api/v1/orders/order-af4/transitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toStatus: 'validated', reason: null, idempotencyKey: 'q17a-unverified-transition',
      }),
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'orders.unverified_prices' });
  });
});

function repositoryStub(): OrdersRepository {
  const order = {
    id: 'order-af4', shopId: 'shop-af4', createdAt: '2026-08-11T12:00:00.000Z',
    customerName: 'Client AF4', customerEmail: 'client-af4@magrit.test',
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
    getStorefrontPortalOrders: async () => ({ orders: [order], taxRegime: 'metropole_fr' }),
    listAuditEvents: async () => [{
      eventId: 'event-af4', orderId: 'order-af4', kind: 'status', eventType: 'status_transition',
      actorId: 'user-af4', actorEmail: null, shopCustomerAccountId: null,
      actedByMagritUserId: null, roleName: null, payload: {}, occurredAt: '2026-08-11T12:01:00.000Z',
    }],
    transitionOrder: async (orderId, command) => ({
      orderId, fromStatus: 'draft', toStatus: command.toStatus, replayed: false,
    }),
    notifyTransition: async () => undefined,
    createOrder: async (command) => ({
      orderId: '22222222-2222-4222-8222-222222222222',
      tenantId: '33333333-3333-4333-8333-333333333333',
      shopId: command.shopId,
      totalHt: command.items.reduce((sum, item) => sum + item.quantity * Number(item.expectedUnitPriceHt), 0).toFixed(2),
      currency: command.currency,
      replayed: false,
    }),
    notifyOrderCreated: async () => undefined,
    getDraftOrder: async (orderId) => ({
      orderId, status: 'draft', createdAt: '2026-08-11T12:00:00.000Z', totalHt: '150.00',
      hasUnverifiedPrices: false,
      items: [{
        id: '44444444-4444-4444-8444-444444444444', productId: null,
        productLabel: 'Flyers', clariprintOptions: null, quantity: 2,
        unitPriceHt: '75.00', lineTotalHt: '150.00', priceOrigin: 'client_unverified',
      }],
    }),
    updateDraftOrder: async (orderId, command) => ({
      orderId,
      totalHt: command.items.reduce((sum, item) => sum + item.quantity * Number(item.expectedUnitPriceHt), 0).toFixed(2),
      replayed: false,
    }),
    getOrderRoles: async () => ({
      roles: [], isCreator: true,
      capabilities: {
        can_quote: false, can_order: true, can_invite: false, can_validate: false,
        can_cancel: false, can_modify: false, can_export: false,
        can_manage_catalog: false, can_manage_roles: false,
      },
    }),
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
