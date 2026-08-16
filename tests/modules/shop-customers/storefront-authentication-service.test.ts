import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '../../../src/kernel/clock';
import {
  StorefrontAuthenticationRejectedError,
  StorefrontAuthenticationService,
  type IssuedStorefrontSession,
  type ShopCustomerAccount,
  type StorefrontAuthenticationRepository,
  type StorefrontCredentialVerifier,
  type StorefrontSessionIssuer,
} from '../../../src/modules/shop-customers';

const SHOP = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque';

describe('StorefrontAuthenticationService', () => {
  it('résout toujours le compte par boutique et email normalisé', async () => {
    const dependencies = stubs();
    const service = createService(dependencies);

    await service.authenticate('ma-boutique', {
      email: ' Client@Example.COM ', password: 'mot-de-passe-solide',
    });

    expect(dependencies.repository.findAccountByNormalizedEmail)
      .toHaveBeenCalledWith(SHOP, 'client@example.com');
    expect(dependencies.sessions.issueDirect).toHaveBeenCalledWith(
      expect.objectContaining({ id: CUSTOMER, shopId: SHOP }),
      new Date('2026-08-16T18:00:00.000Z'),
    );
  });

  it('effectue une vérification factice pour un email inconnu', async () => {
    const dependencies = stubs();
    vi.mocked(dependencies.repository.findAccountByNormalizedEmail).mockResolvedValue(null);

    await expect(createService(dependencies).authenticate('ma-boutique', {
      email: 'inconnu@example.com', password: 'mot-de-passe-solide',
    })).rejects.toBeInstanceOf(StorefrontAuthenticationRejectedError);

    expect(dependencies.credentials.performDummyVerification)
      .toHaveBeenCalledWith('mot-de-passe-solide');
    expect(dependencies.credentials.verify).not.toHaveBeenCalled();
  });

  it('retourne le même refus neutre pour mauvais secret, verrouillage et suspension', async () => {
    for (const scenario of [
      { verification: 'mismatched' as const, status: 'active' as const },
      { verification: 'locked' as const, status: 'active' as const },
      { verification: 'matched' as const, status: 'suspended' as const },
    ]) {
      const dependencies = stubs(scenario);
      const promise = createService(dependencies).authenticate('ma-boutique', {
        email: 'client@example.com', password: 'mot-de-passe-solide',
      });
      await expect(promise).rejects.toMatchObject({
        code: 'authentication_failed', message: 'Email ou mot de passe incorrect.',
      });
      expect(dependencies.sessions.issueDirect).not.toHaveBeenCalled();
    }
  });

  it('refuse une session incohérente retournée par l infrastructure', async () => {
    const dependencies = stubs();
    vi.mocked(dependencies.sessions.issueDirect).mockResolvedValue({
      ...issuedSession(), opaqueToken: 'secret lisible',
    });

    await expect(createService(dependencies).authenticate('ma-boutique', {
      email: 'client@example.com', password: 'mot-de-passe-solide',
    })).rejects.toThrow('jeton non opaque');
  });
});

function createService(dependencies: ReturnType<typeof stubs>) {
  return new StorefrontAuthenticationService(
    dependencies.repository,
    dependencies.credentials,
    dependencies.sessions,
    fixedClock('2026-08-16T10:00:00.000Z'),
  );
}

function stubs(overrides: {
  verification?: 'matched' | 'mismatched' | 'locked';
  status?: ShopCustomerAccount['status'];
} = {}) {
  const accountValue = account({ status: overrides.status ?? 'active' });
  const repository: StorefrontAuthenticationRepository = {
    findActiveShopBySlug: vi.fn(async () => ({ id: SHOP, slug: 'ma-boutique', active: true })),
    findAccountByNormalizedEmail: vi.fn(async () => accountValue),
  };
  const credentials: StorefrontCredentialVerifier = {
    verify: vi.fn(async () => overrides.verification ?? 'matched'),
    performDummyVerification: vi.fn(async () => undefined),
    recordFailedAttempt: vi.fn(async () => undefined),
    clearFailedAttempts: vi.fn(async () => undefined),
  };
  const sessions: StorefrontSessionIssuer = {
    issueDirect: vi.fn(async () => issuedSession()),
  };
  return { repository, credentials, sessions };
}

function account(overrides: Partial<ShopCustomerAccount> = {}): ShopCustomerAccount {
  return {
    id: CUSTOMER, shopId: SHOP, email: 'client@example.com',
    normalizedEmail: 'client@example.com', fullName: 'Client Exemple',
    authSubjectId: null, status: 'active', createdByMagritUserId: null,
    createdAt: '2026-08-16T08:00:00+00:00',
    activatedAt: '2026-08-16T08:00:00+00:00', suspendedAt: null,
    ...overrides,
  };
}

function issuedSession(): IssuedStorefrontSession {
  return {
    opaqueToken: TOKEN,
    session: {
      identity: { kind: 'shop_customer', shopId: SHOP, shopCustomerAccountId: CUSTOMER },
      customer: {
        id: CUSTOMER, shopId: SHOP, email: 'client@example.com',
        fullName: 'Client Exemple', status: 'active',
      },
      expiresAt: '2026-08-16T18:00:00.000Z',
    },
  };
}
