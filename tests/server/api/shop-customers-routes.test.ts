import { describe, expect, it, vi } from 'vitest';
import { encodeCursor } from '@/modules/_shared/application';
import { parseId, type UserId } from '@/kernel';
import {
  ShopCustomersApiClient,
  ShopCustomerInvitationService,
  ShopCustomersService,
  StorefrontActivationService,
  type ShopCustomerAccount,
  type ShopCustomersRepository,
  type StorefrontActivationEmailSender,
  type StorefrontActivationGateway,
} from '@/modules/shop-customers';
import { FetchApiClient } from '@/platform/api';
import {
  createApiV1Application,
  createShopCustomerInvitationRoutes,
  createShopCustomersRoutes,
} from '@/server/api';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SHOP = '22222222-2222-4222-8222-222222222222';
const CUSTOMER = '33333333-3333-4333-8333-333333333333';

describe('routes ShopCustomers API v1', () => {
  it('partage les contrats de liste et création entre serveur et client', async () => {
    const handler = application(repositoryStub());
    const client = new ShopCustomersApiClient(
      new FetchApiClient('https://magrit.test', bridgeTo(handler), () => 'jwt-um1'),
    );

    await expect(client.list(TENANT, SHOP)).resolves.toEqual([]);
    await expect(client.create(TENANT, SHOP, {
      email: 'Client.Exemple@Example.com',
    })).resolves.toMatchObject({
      shopId: SHOP,
      normalizedEmail: 'client.exemple@example.com',
      fullName: 'Client Exemple',
      status: 'invited',
    });
  });

  it('partage la pagination serveur et sa position opaque avec le client', async () => {
    const repository = repositoryStub();
    const list = vi.spyOn(repository, 'listPage');
    const client = new ShopCustomersApiClient(new FetchApiClient('https://magrit.test', bridgeTo(application(repository)), () => 'jwt'));
    const cursor = encodeCursor({ sort: '2026-10-09T08:00:00.123456Z', id: CUSTOMER });
    await expect(client.listPage(TENANT, SHOP, { size: 20, cursor })).resolves.toMatchObject({ items: [{ id: CUSTOMER }], nextCursor: null });
    expect(list).toHaveBeenCalledWith(actor(), TENANT, SHOP, { size: 20, cursor: { sort: '2026-10-09T08:00:00.123456Z', id: CUSTOMER } });
  });

  it.each(['page[size]=0', 'page[size]=101', 'page[size]=1.2', 'page[cursor]=broken',
    `page[cursor]=${encodeCursor({ sort: 'not-a-date', id: CUSTOMER })}`,
    `page[cursor]=${encodeCursor({ sort: '2026-10-09T08:00:00Z', id: 'invalid' })}`])('refuse une pagination invalide : %s', async query => {
    const response = await application(repositoryStub())(new Request(`https://magrit.test/api/v1/tenants/${TENANT}/shops/${SHOP}/customers/page?${query}`, { headers: { Authorization: 'Bearer jwt' } }));
    expect(response.status).toBe(422);
  });

  it('partage détail, commandes et mise à jour sans mutation de l’email', async () => {
    const repository = repositoryStub();
    const update = vi.spyOn(repository, 'update');
    const client = new ShopCustomersApiClient(new FetchApiClient('https://magrit.test', bridgeTo(application(repository)), () => 'jwt'));
    await expect(client.detail(TENANT, SHOP, CUSTOMER)).resolves.toMatchObject({ orderCount: 2, revenue: [{ totalHt: '125.00' }] });
    await expect(client.ordersPage(TENANT, SHOP, CUSTOMER)).resolves.toEqual({ items: [], nextCursor: null });
    await expect(client.update(TENANT, SHOP, CUSTOMER, { fullName: ' Nom corrigé ', enabled: false })).resolves.toMatchObject({ fullName: 'Nom corrigé', status: 'suspended' });
    expect(update).toHaveBeenCalledWith(actor(), TENANT, SHOP, CUSTOMER, { fullName: 'Nom corrigé', enabled: false });
    const response = await application(repository)(new Request(`https://magrit.test/api/v1/tenants/${TENANT}/shops/${SHOP}/customers/${CUSTOMER}`, { method: 'PATCH', headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'other@example.com' }) }));
    expect(response.status).toBe(422);
  });

  it('traduit le doublon boutique/email en Problem Details 409', async () => {
    const repository = repositoryStub();
    repository.findByNormalizedEmail = async () => account();
    const response = await application(repository)(new Request(
      `https://magrit.test/api/v1/tenants/${TENANT}/shops/${SHOP}/customers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-um1' },
        body: JSON.stringify({ email: 'client@example.com', fullName: 'Client Exemple' }),
      },
    ));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'shop_customers.duplicate_email',
    });
  });

  it('refuse la liste sans authentification', async () => {
    const handler = createApiV1Application({
      routes: createShopCustomersRoutes(new ShopCustomersService(repositoryStub())),
      requestIdFactory: () => 'request-um1',
    });
    const response = await handler(new Request(
      `https://magrit.test/api/v1/tenants/${TENANT}/shops/${SHOP}/customers`,
    ));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'identity.authentication_required',
    });
  });

  it('expose la création idempotente du compte miroir via le client partagé', async () => {
    const repository = repositoryStub();
    const client = new ShopCustomersApiClient(
      new FetchApiClient('https://magrit.test', bridgeTo(application(repository)), () => 'jwt-um4'),
    );

    await expect(client.ensureSelf(TENANT, SHOP)).resolves.toMatchObject({
      customer: { id: CUSTOMER, shopId: SHOP, normalizedEmail: 'client@example.com' },
      created: true,
    });
  });

  it('expose l invitation email comme une commande HTTP unique', async () => {
    const repository = repositoryStub();
    const handler = createApiV1Application({
      routes: [
        ...createShopCustomersRoutes(new ShopCustomersService(repository)),
        ...createShopCustomerInvitationRoutes(invitationService(repository)),
      ],
      requestIdFactory: () => 'request-ux31-3',
      actorResolver: { async resolve() { return { kind: 'user', userId: actor() }; } },
    });
    const client = new ShopCustomersApiClient(
      new FetchApiClient('https://magrit.test', bridgeTo(handler), () => 'jwt-ux31-3'),
    );

    await expect(client.invite(TENANT, SHOP, {
      email: 'nouveau.client@example.com',
    })).resolves.toMatchObject({
      created: true,
      customer: { shopId: SHOP, status: 'invited' },
      activation: {
        sent: true,
        link: 'https://magrit.test/shop/boutique-test/activate?token=abcdefghijklmnopqrstuvwxyzABCDE_1234567890-invitation',
      },
    });
  });
});

function application(repository: ShopCustomersRepository) {
  return createApiV1Application({
    routes: createShopCustomersRoutes(new ShopCustomersService(repository)),
    requestIdFactory: () => 'request-um1',
    actorResolver: { async resolve() { return { kind: 'user', userId: actor() }; } },
  });
}

function repositoryStub(): ShopCustomersRepository {
  return {
    listPage: async () => ({ items: [account()], nextCursor: null }),
    detail: async () => ({ customer: account(), orderCount: 2, revenue: [{ currency: 'EUR', totalHt: '125.00', orderCount: 1 }] }),
    ordersPage: async () => ({ items: [], nextCursor: null }),
    update: async (_actor, _tenant, _shop, _id, command) => account({ fullName: command.fullName ?? 'Client Exemple',
      ...(command.enabled === false ? { status: 'suspended', suspendedAt: '2026-10-09T10:00:00Z' } : {}) }),
    list: async () => [],
    findByNormalizedEmail: async () => null,
    create: async (_actor, _tenantId, shopId, record) => account({
      shopId,
      email: record.email,
      normalizedEmail: record.normalizedEmail,
      fullName: record.fullName,
      status: record.status,
    }),
    ensureSelf: async () => ({ customer: account({ status: 'delegated_only' }), created: true }),
    findByCustomerContactId: async () => null,
    listByCustomerContactId: async () => [],
    linkCustomerContact: async () => account(),
    revokeCustomerContactAccess: async () => undefined,
  };
}

function account(overrides: Partial<ShopCustomerAccount> = {}): ShopCustomerAccount {
  return {
    id: CUSTOMER, shopId: SHOP, email: 'client@example.com',
    normalizedEmail: 'client@example.com', fullName: 'Client Exemple',
    authSubjectId: null, status: 'invited', createdByMagritUserId: actor(),
    createdAt: '2026-08-16T08:00:00+00:00', activatedAt: null,
    suspendedAt: null, ...overrides,
  };
}

function invitationService(repository: ShopCustomersRepository) {
  const gateway: StorefrontActivationGateway = {
    issue: async () => ({
      token: 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-invitation',
      customerEmail: 'nouveau.client@example.com',
      customerName: 'Nouveau Client',
      shopName: 'Boutique Test',
      shopSlug: 'boutique-test',
    }),
    activate: async () => null,
  };
  const sender: StorefrontActivationEmailSender = {
    send: async () => ({ sent: true }),
  };
  return new ShopCustomerInvitationService(
    new ShopCustomersService(repository),
    new StorefrontActivationService(gateway, sender),
  );
}

function bridgeTo(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
}

function actor(): UserId {
  const parsed = parseId<'UserId'>('44444444-4444-4444-8444-444444444444');
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
