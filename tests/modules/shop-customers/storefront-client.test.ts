import { describe, expect, it, vi } from 'vitest';
import { StorefrontIdentityApiClient } from '@/modules/shop-customers';
import { FetchApiClient } from '@/platform/api';

const SHOP = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const DELEGATION = '33333333-3333-4333-8333-333333333333';
const ACTOR = '44444444-4444-4444-8444-444444444444';

describe('StorefrontIdentityApiClient', () => {
  it('ouvre une session directe avec le contexte de boutique', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ session: {
      identity: { kind: 'shop_customer', shopId: SHOP, shopCustomerAccountId: CUSTOMER },
      customer: { id: CUSTOMER, shopId: SHOP, email: 'client@example.com', fullName: 'Client Exemple', status: 'active' },
      expiresAt: '2026-08-17T10:30:00.000Z',
    } }));
    const client = new StorefrontIdentityApiClient(new FetchApiClient('', fetchMock as typeof fetch));

    await expect(client.authenticate('boutique-test', {
      email: ' Client@Example.com ', password: 'mot-de-passe-solide',
    })).resolves.toMatchObject({ identity: { kind: 'shop_customer', shopId: SHOP } });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/storefront/boutique-test/session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'Client@Example.com', password: 'mot-de-passe-solide' }),
      }),
    );
  });

  it('crée un compte propre à une boutique puis ouvre sa session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ session: {
      identity: { kind: 'shop_customer', shopId: SHOP, shopCustomerAccountId: CUSTOMER },
      customer: { id: CUSTOMER, shopId: SHOP, email: 'client@example.com', fullName: 'Client Exemple', status: 'active' },
      expiresAt: '2026-08-17T10:30:00.000Z',
    } }));
    const client = new StorefrontIdentityApiClient(new FetchApiClient('', fetchMock as typeof fetch));

    await client.register('boutique-test', {
      email: ' Client@Example.com ', fullName: ' Client Exemple ', password: 'mot-de-passe-solide',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/storefront/boutique-test/registration',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'Client@Example.com', fullName: 'Client Exemple', password: 'mot-de-passe-solide' }),
      }),
    );
  });

  it('lit puis ferme une session déléguée sans contrat workspace', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ session: {
        identity: {
          kind: 'delegated_shop_customer', shopId: SHOP,
          shopCustomerAccountId: CUSTOMER, delegationId: DELEGATION,
          actorMagritUserId: ACTOR,
        },
        customer: {
          id: CUSTOMER, shopId: SHOP, email: 'client@example.com',
          fullName: 'Client Exemple', status: 'invited',
        },
        expiresAt: '2026-08-17T10:30:00.000Z',
      } }))
      .mockResolvedValueOnce(Response.json({ ended: true }));
    const client = new StorefrontIdentityApiClient(
      new FetchApiClient('', fetchMock as typeof fetch),
    );

    await expect(client.current()).resolves.toMatchObject({
      identity: { kind: 'delegated_shop_customer', delegationId: DELEGATION },
      customer: { status: 'invited' },
    });
    await expect(client.end()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/storefront/session/current');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('demande puis applique une récupération de mot de passe boutique', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ accepted: true }, { status: 202 })).mockResolvedValueOnce(Response.json({ reset: true }));
    const client = new StorefrontIdentityApiClient(new FetchApiClient('', fetchMock as typeof fetch));
    await client.requestPasswordRecovery('boutique-test', { email: ' Client@Example.com ' });
    await client.resetPassword({ token: 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque', password: 'nouveau-secret' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/storefront/boutique-test/password-recovery');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/storefront/password-reset');
  });
});
