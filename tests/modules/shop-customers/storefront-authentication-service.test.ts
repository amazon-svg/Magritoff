import { describe, expect, it, vi } from 'vitest';
import {
  StorefrontAuthenticationRejectedError,
  StorefrontAuthenticationService,
  type IssuedStorefrontSession,
  type StorefrontAuthenticationGateway,
} from '../../../src/modules/shop-customers';

const SHOP = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque';

describe('StorefrontAuthenticationService', () => {
  it('normalise boutique et email avant la transaction atomique', async () => {
    const gateway = stubGateway(issuedSession());
    await new StorefrontAuthenticationService(gateway).authenticate('ma-boutique', {
      email: ' Client@Example.COM ', password: 'mot-de-passe-solide',
    });
    expect(gateway.authenticate).toHaveBeenCalledWith(
      'ma-boutique', 'client@example.com', 'mot-de-passe-solide',
    );
  });

  it('traduit tout refus atomique en erreur neutre', async () => {
    const service = new StorefrontAuthenticationService(stubGateway(null));
    await expect(service.authenticate('ma-boutique', {
      email: 'absent@example.com', password: 'mot-de-passe-solide',
    })).rejects.toBeInstanceOf(StorefrontAuthenticationRejectedError);
  });

  it('refuse un jeton ou une durée incohérents retournés par l infrastructure', async () => {
    await expect(new StorefrontAuthenticationService(stubGateway({
      ...issuedSession(), opaqueToken: 'secret lisible',
    })).authenticate('ma-boutique', {
      email: 'client@example.com', password: 'mot-de-passe-solide',
    })).rejects.toThrow('jeton non opaque');

    await expect(new StorefrontAuthenticationService(stubGateway({
      ...issuedSession(), maxAgeSeconds: 100_000,
    })).authenticate('ma-boutique', {
      email: 'client@example.com', password: 'mot-de-passe-solide',
    })).rejects.toThrow('durée invalide');
  });
});

function stubGateway(result: IssuedStorefrontSession | null): StorefrontAuthenticationGateway {
  return { authenticate: vi.fn(async () => result) };
}

function issuedSession(): IssuedStorefrontSession {
  return {
    opaqueToken: TOKEN,
    maxAgeSeconds: 28_800,
    session: {
      identity: { kind: 'shop_customer', shopId: SHOP, shopCustomerAccountId: CUSTOMER },
      customer: { id: CUSTOMER, shopId: SHOP, email: 'client@example.com', fullName: 'Client Exemple', status: 'active' },
      expiresAt: '2026-08-16T18:00:00.000Z',
    },
  };
}
