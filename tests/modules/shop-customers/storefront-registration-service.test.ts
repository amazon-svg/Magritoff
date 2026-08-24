import { describe, expect, it, vi } from 'vitest';
import {
  StorefrontRegistrationRejectedError,
  StorefrontRegistrationService,
  type IssuedStorefrontSession,
  type StorefrontRegistrationGateway,
} from '@/modules/shop-customers';

const SHOP = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque';

describe('StorefrontRegistrationService', () => {
  it('normalise les données avant la transaction atomique', async () => {
    const gateway = stubGateway(issuedSession());
    await new StorefrontRegistrationService(gateway).register('ma-boutique', {
      email: ' Client@Example.COM ', fullName: ' Client Exemple ', password: 'mot-de-passe-solide',
    });
    expect(gateway.register).toHaveBeenCalledWith(
      'ma-boutique', 'client@example.com', 'Client Exemple', 'mot-de-passe-solide',
    );
  });

  it('traduit tout refus atomique en erreur neutre', async () => {
    const service = new StorefrontRegistrationService(stubGateway(null));
    await expect(service.register('ma-boutique', {
      email: 'client@example.com', fullName: 'Client Exemple', password: 'mot-de-passe-solide',
    })).rejects.toBeInstanceOf(StorefrontRegistrationRejectedError);
  });

  it('refuse une délégation ou un jeton incohérent retourné par l infrastructure', async () => {
    const delegated = issuedSession();
    delegated.session.identity = {
      kind: 'delegated_shop_customer', shopId: SHOP, shopCustomerAccountId: CUSTOMER,
      delegationId: '33333333-3333-4333-8333-333333333333', actorMagritUserId: '44444444-4444-4444-8444-444444444444',
    };
    await expect(registerWith(delegated)).rejects.toThrow('ne peut pas émettre une délégation');
    await expect(registerWith({ ...issuedSession(), opaqueToken: 'secret lisible' })).rejects.toThrow('jeton non opaque');
  });
});

function registerWith(result: IssuedStorefrontSession) {
  return new StorefrontRegistrationService(stubGateway(result)).register('ma-boutique', {
    email: 'client@example.com', fullName: 'Client Exemple', password: 'mot-de-passe-solide',
  });
}

function stubGateway(result: IssuedStorefrontSession | null): StorefrontRegistrationGateway {
  return { register: vi.fn(async () => result) };
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
