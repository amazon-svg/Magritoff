import { describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  StorefrontActivationService,
  type StorefrontActivationEmailSender,
  type StorefrontActivationGateway,
} from '../../../src/modules/shop-customers';
import { createApiV1Application, createStorefrontActivationRoutes } from '../../../src/server/api';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const TENANT = '22222222-2222-4222-8222-222222222222';
const SHOP = '33333333-3333-4333-8333-333333333333';
const CUSTOMER = '44444444-4444-4444-8444-444444444444';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-activation';

describe('routes d activation storefront', () => {
  it('envoie le lien et le conserve comme repli manuel', async () => {
    const activationGateway = gateway();
    const emailSender = sender({ sent: true });
    const response = await application(activationGateway, emailSender)(issueRequest());

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      sent: true,
      link: `http://localhost:5176/shop/boutique-test/activate?token=${TOKEN}`,
      expiresInSeconds: 86_400,
    });
    expect(activationGateway.issue).toHaveBeenCalledWith(ACTOR, TENANT, SHOP, CUSTOMER, 86_400);
    expect(emailSender.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'client@example.com',
      shopName: 'Boutique Test',
      link: `http://localhost:5176/shop/boutique-test/activate?token=${TOKEN}`,
    }));
  });

  it('active le credential via la route publique', async () => {
    const activationGateway = gateway();
    const response = await application(activationGateway)(new Request(
      'https://magrit.test/api/v1/storefront/activation',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, password: 'mot-de-passe-solide' }),
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ activated: true });
    expect(activationGateway.activate).toHaveBeenCalledWith(TOKEN, 'mot-de-passe-solide');
  });

  it('retourne un refus neutre pour un jeton invalide ou expiré', async () => {
    const activationGateway = gateway();
    vi.mocked(activationGateway.activate).mockResolvedValue(false);
    const response = await application(activationGateway)(new Request(
      'https://magrit.test/api/v1/storefront/activation',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, password: 'mot-de-passe-solide' }),
      },
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'storefront.activation_failed',
      detail: 'Lien d’activation invalide ou expiré.',
    });
  });

  it('refuse l émission sans session Magrit', async () => {
    const handler = createApiV1Application({
      routes: createStorefrontActivationRoutes(new StorefrontActivationService(gateway(), sender({ sent: false }))),
      requestIdFactory: () => 'request-um2-9',
    });
    const response = await handler(issueRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'identity.authentication_required',
    });
  });
});

function application(activationGateway: StorefrontActivationGateway, emailSender = sender({ sent: false, reason: 'Non configuré' })) {
  return createApiV1Application({
    routes: createStorefrontActivationRoutes(new StorefrontActivationService(activationGateway, emailSender)),
    requestIdFactory: () => 'request-um2-9',
    actorResolver: { async resolve() { return { kind: 'user', userId: actor() }; } },
  });
}

function issueRequest() {
  return new Request(
    `https://magrit.test/api/v1/tenants/${TENANT}/shops/${SHOP}/customers/${CUSTOMER}/activation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-um2-9', Origin: 'http://localhost:5176' },
      body: JSON.stringify({}),
    },
  );
}

function gateway(): StorefrontActivationGateway {
  return {
    issue: vi.fn(async () => ({
      token: TOKEN,
      customerEmail: 'client@example.com',
      customerName: 'Client Exemple',
      shopName: 'Boutique Test',
      shopSlug: 'boutique-test',
    })),
    activate: vi.fn(async () => true),
  };
}

function sender(delivery: Awaited<ReturnType<StorefrontActivationEmailSender['send']>>): StorefrontActivationEmailSender {
  return { send: vi.fn(async () => delivery) };
}

function actor(): UserId {
  const parsed = parseId<'UserId'>(ACTOR);
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
