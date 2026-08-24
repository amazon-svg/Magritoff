import { describe, expect, it, vi } from 'vitest';
import { StorefrontAuthenticationService, StorefrontRegistrationService, StorefrontSessionService, type StorefrontAuthenticationGateway, type StorefrontRegistrationGateway } from '@/modules/shop-customers';
import { createApiV1Application, createStorefrontSessionRoutes } from '@/server/api';
import { storefrontSessionCookiePolicy } from '@/server/storefront/session-cookie';

const SHOP = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque';

describe('route de session storefront', () => {
  it('place le secret en cookie HttpOnly et l exclut du JSON', async () => {
    const response = await handler(gateway(true))(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`magrit-storefront=${TOKEN}`);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.text();
    expect(body).not.toContain(TOKEN);
    expect(JSON.parse(body)).toMatchObject({ session: { customer: { id: CUSTOMER, shopId: SHOP } } });
  });

  it('retourne le même Problem Details 401 pour tout refus', async () => {
    const response = await handler(gateway(false))(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'storefront.authentication_failed',
      detail: 'Email ou mot de passe incorrect.',
    });
  });

  it('crée le compte boutique et place sa session en cookie HttpOnly', async () => {
    const registration = registrationGateway(true);
    const response = await handler(gateway(false), registration)(new Request(
      'https://magrit.test/api/v1/storefront/ma-boutique/registration',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ' Client@Example.com ', fullName: ' Client Exemple ', password: 'mot-de-passe-solide' }) },
    ));
    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain(`magrit-storefront=${TOKEN}`);
    expect(registration.register).toHaveBeenCalledWith('ma-boutique', 'client@example.com', 'Client Exemple', 'mot-de-passe-solide');
    expect(await response.text()).not.toContain(TOKEN);
  });

  it('ne révèle pas si un compte existe déjà ou si la boutique est privée', async () => {
    const response = await handler(gateway(false), registrationGateway(false))(new Request(
      'https://magrit.test/api/v1/storefront/ma-boutique/registration',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'client@example.com', fullName: 'Client Exemple', password: 'mot-de-passe-solide' }) },
    ));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'storefront.registration_failed' });
  });

  it('efface toujours le cookie à la déconnexion', async () => {
    const response = await handler(gateway(false))(new Request(
      'https://magrit.test/api/v1/storefront/session/current',
      { method: 'DELETE', headers: { Cookie: `magrit-storefront=${TOKEN}` } },
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    await expect(response.json()).resolves.toEqual({ ended: true });
  });
});

function handler(authenticationGateway: StorefrontAuthenticationGateway, registrationGateway = registrationGatewayDefault()) {
  return createApiV1Application({
    routes: createStorefrontSessionRoutes(
      new StorefrontAuthenticationService(authenticationGateway),
      new StorefrontRegistrationService(registrationGateway),
      new StorefrontSessionService({ resolve: async () => null, revoke: async () => true }),
      storefrontSessionCookiePolicy(false),
    ),
    requestIdFactory: () => 'request-storefront-um2',
  });
}

function registrationGatewayDefault(): StorefrontRegistrationGateway {
  return registrationGateway(false);
}

function request() {
  return new Request('https://magrit.test/api/v1/storefront/ma-boutique/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client@example.com', password: 'mot-de-passe-solide' }),
  });
}

function gateway(success: boolean): StorefrontAuthenticationGateway {
  return {
    authenticate: vi.fn(async () => success ? issued() : null),
  };
}

function registrationGateway(success: boolean): StorefrontRegistrationGateway {
  return { register: vi.fn(async () => success ? issued() : null) };
}

function issued() {
  return {
    opaqueToken: TOKEN,
    maxAgeSeconds: 28_800,
    session: {
      identity: { kind: 'shop_customer' as const, shopId: SHOP, shopCustomerAccountId: CUSTOMER },
      customer: { id: CUSTOMER, shopId: SHOP, email: 'client@example.com', fullName: 'Client Exemple', status: 'active' as const },
      expiresAt: '2026-08-16T18:00:00.000Z',
    },
  };
}
