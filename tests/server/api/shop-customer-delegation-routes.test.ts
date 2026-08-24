import { describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '@/kernel';
import {
  ShopCustomerDelegationService,
  type ShopCustomerDelegationGateway,
} from '@/modules/shop-customers';
import { createApiV1Application, createShopCustomerDelegationRoutes } from '@/server/api';
import { storefrontSessionCookiePolicy } from '@/server/storefront/session-cookie';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const TENANT = '22222222-2222-4222-8222-222222222222';
const SHOP = '33333333-3333-4333-8333-333333333333';
const CUSTOMER = '44444444-4444-4444-8444-444444444444';
const DELEGATION = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-delegation';

describe('route de délégation storefront', () => {
  it('place le jeton en cookie HttpOnly et ne le renvoie jamais dans le JSON', async () => {
    const delegationGateway = gateway(true);
    const response = await application(delegationGateway)(request());

    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain(`magrit-storefront=${TOKEN}`);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=1800');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.text();
    expect(body).not.toContain(TOKEN);
    expect(JSON.parse(body)).toMatchObject({
      customer: { id: CUSTOMER, shopId: SHOP },
      delegation: { id: DELEGATION, actorMagritUserId: ACTOR },
      storefrontPath: '/shop/boutique-test',
    });
    expect(delegationGateway.startSelf).toHaveBeenCalledWith(ACTOR, TENANT, SHOP, 'Assistance client', 1_800);
  });

  it('refuse sans révéler si la boutique ou le compte existe', async () => {
    const response = await application(gateway(false))(request());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'shop_customers.delegation_denied',
      detail: 'Délégation interdite pour cette boutique.',
    });
  });
});

function application(delegationGateway: ShopCustomerDelegationGateway) {
  return createApiV1Application({
    routes: createShopCustomerDelegationRoutes(
      new ShopCustomerDelegationService(delegationGateway),
      storefrontSessionCookiePolicy(false),
    ),
    requestIdFactory: () => 'request-um5-1',
    actorResolver: { async resolve() { return { kind: 'user', userId: actor() }; } },
  });
}

function request() {
  return new Request(
    `https://magrit.test/api/v1/tenants/${TENANT}/shops/${SHOP}/customers/self-delegation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-um5' },
      body: JSON.stringify({ reason: 'Assistance client' }),
    },
  );
}

function gateway(success: boolean): ShopCustomerDelegationGateway {
  return {
    startSelf: vi.fn(async () => success ? {
      opaqueToken: TOKEN,
      maxAgeSeconds: 1_800,
      result: {
        customer: {
          id: CUSTOMER, shopId: SHOP, email: 'client@example.com', normalizedEmail: 'client@example.com',
          fullName: 'Client Exemple', authSubjectId: null, status: 'delegated_only',
          createdByMagritUserId: ACTOR, createdAt: '2026-08-16T20:00:00.000Z',
          activatedAt: null, suspendedAt: null,
        },
        delegation: {
          id: DELEGATION, shopId: SHOP, shopCustomerAccountId: CUSTOMER,
          actorMagritUserId: ACTOR, issuedAt: '2026-08-16T20:00:00.000Z',
          expiresAt: '2026-08-16T20:30:00.000Z', revokedAt: null, reason: 'Assistance client',
        },
        storefrontPath: '/shop/boutique-test',
      },
    } : null),
  };
}

function actor(): UserId {
  const parsed = parseId<'UserId'>(ACTOR);
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
