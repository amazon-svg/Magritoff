import { describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  ShopCustomerRejectedError,
  ShopCustomersService,
  type ShopCustomerAccount,
  type ShopCustomersRepository,
} from '../../../src/modules/shop-customers';

const SHOP = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = '33333333-3333-4333-8333-333333333333';

describe('ShopCustomersService', () => {
  it('expose le rapport de migration legacy sans logique Supabase dans le service', async () => {
    const repository = repositoryStub();
    const service = new ShopCustomersService(repository);

    await expect(service.migrationReport(actor(), 'tenant-1')).resolves.toEqual([]);
    expect(repository.migrationReport).toHaveBeenCalledWith(actor(), 'tenant-1');
  });

  it('normalise l email avant de rechercher et créer le compte', async () => {
    const repository = repositoryStub();
    const service = new ShopCustomersService(repository);

    await service.create(actor(), 'tenant-1', SHOP, {
      email: ' Client@Example.COM ',
      fullName: 'Client Exemple',
      initialStatus: 'invited',
    });

    expect(repository.findByNormalizedEmail).toHaveBeenCalledWith(
      actor(), 'tenant-1', SHOP, 'client@example.com',
    );
    expect(repository.create).toHaveBeenCalledWith(
      actor(), 'tenant-1', SHOP,
      expect.objectContaining({
        email: 'Client@Example.COM',
        normalizedEmail: 'client@example.com',
        createdByMagritUserId: actor(),
      }),
    );
  });

  it('déduit un nom lisible lorsque l invitation ne fournit que l email', async () => {
    const repository = repositoryStub();
    const service = new ShopCustomersService(repository);

    await service.create(actor(), 'tenant-1', SHOP, {
      email: 'xavier.pechoultres@example.com',
    });

    expect(repository.create).toHaveBeenCalledWith(
      actor(), 'tenant-1', SHOP,
      expect.objectContaining({
        fullName: 'Xavier Pechoultres',
        status: 'invited',
      }),
    );
  });

  it('refuse un doublon dans la même boutique', async () => {
    const repository = repositoryStub();
    vi.mocked(repository.findByNormalizedEmail).mockResolvedValue(account());
    const service = new ShopCustomersService(repository);

    await expect(service.create(actor(), 'tenant-1', SHOP, {
      email: 'client@example.com', fullName: 'Client Exemple',
    })).rejects.toMatchObject<Partial<ShopCustomerRejectedError>>({ code: 'duplicate_email' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('ne recherche jamais un email au-delà de la boutique demandée', async () => {
    const repository = repositoryStub();
    const service = new ShopCustomersService(repository);

    await service.create(actor(), 'tenant-1', SHOP, {
      email: 'client@example.com', fullName: 'Client Exemple',
    });

    expect(repository.findByNormalizedEmail).toHaveBeenCalledOnce();
    expect(repository.findByNormalizedEmail).toHaveBeenCalledWith(
      actor(), 'tenant-1', SHOP, 'client@example.com',
    );
  });

  it('délègue la création idempotente du compte miroir au repository', async () => {
    const repository = repositoryStub();
    const service = new ShopCustomersService(repository);

    await expect(service.ensureSelf(actor(), 'tenant-1', SHOP)).resolves.toMatchObject({
      customer: { id: CUSTOMER, shopId: SHOP },
      created: true,
    });
    expect(repository.ensureSelf).toHaveBeenCalledWith(actor(), 'tenant-1', SHOP);
  });
});

function repositoryStub(): ShopCustomersRepository {
  return {
    migrationReport: vi.fn(async () => []),
    list: vi.fn(async () => []),
    findByNormalizedEmail: vi.fn(async () => null),
    create: vi.fn(async (_actor, _tenantId, shopId, record) => account({
      shopId,
      email: record.email,
      normalizedEmail: record.normalizedEmail,
      fullName: record.fullName,
      status: record.status,
      createdByMagritUserId: record.createdByMagritUserId,
    })),
    ensureSelf: vi.fn(async () => ({ customer: account({ status: 'delegated_only' }), created: true })),
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

function actor(): UserId {
  const parsed = parseId<'UserId'>('44444444-4444-4444-8444-444444444444');
  if (!parsed.ok) throw new Error('ID invalide');
  return parsed.value;
}
