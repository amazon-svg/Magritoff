import { describe, expect, it } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  ShopCustomersApiClient,
  ShopCustomersService,
  type ShopCustomerAccount,
  type ShopCustomersRepository,
} from '../../../src/modules/shop-customers';
import { FetchApiClient } from '../../../src/platform/api';
import { createApiV1Application, createShopCustomersRoutes } from '../../../src/server/api';

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
    await expect(client.migrationReport(TENANT)).resolves.toEqual([]);
    await expect(client.create(TENANT, SHOP, {
      email: 'Client.Exemple@Example.com',
    })).resolves.toMatchObject({
      shopId: SHOP,
      normalizedEmail: 'client.exemple@example.com',
      fullName: 'Client Exemple',
      status: 'invited',
    });
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

  it('expose le rapport de migration via le BFF et son contrat partagé', async () => {
    const repository = repositoryStub();
    repository.migrationReport = async () => [{
      legacyUserId: actor(),
      shopId: SHOP,
      normalizedEmail: 'legacy@example.com',
      proposedAction: 'matched_existing',
      targetAccountId: CUSTOMER,
      migrationOutcome: 'created',
      ordersLinkedCount: 2,
      lastAttemptAt: '2026-08-17T18:00:00+00:00',
    }];
    const client = new ShopCustomersApiClient(
      new FetchApiClient('https://magrit.test', bridgeTo(application(repository)), () => 'jwt-um7'),
    );

    await expect(client.migrationReport(TENANT)).resolves.toEqual([
      expect.objectContaining({
        legacyUserId: actor(),
        shopId: SHOP,
        migrationOutcome: 'created',
        ordersLinkedCount: 2,
      }),
    ]);
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
    migrationReport: async () => [],
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

function bridgeTo(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
}

function actor(): UserId {
  const parsed = parseId<'UserId'>('44444444-4444-4444-8444-444444444444');
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
