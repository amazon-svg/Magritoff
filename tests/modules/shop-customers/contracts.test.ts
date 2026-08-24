import { describe, expect, it } from 'vitest';
import {
  normalizeShopCustomerEmail,
  selfShopCustomerDelegationResultSchema,
  shopCustomerAccountKey,
  shopCustomerAccountSchema,
  storefrontIdentitySchema,
} from '@/modules/shop-customers';

const SHOP_A = '11111111-1111-4111-8111-111111111111';
const SHOP_B = '22222222-2222-4222-8222-222222222222';
const CUSTOMER = '33333333-3333-4333-8333-333333333333';
const MAGRIT_USER = '44444444-4444-4444-8444-444444444444';
const DELEGATION = '55555555-5555-4555-8555-555555555555';
const NOW = '2026-08-16T08:00:00+00:00';

describe('contrats des comptes clients boutique', () => {
  it('normalise l email et conserve une identité différente par boutique', () => {
    expect(normalizeShopCustomerEmail('  Client@Example.COM ')).toBe('client@example.com');
    expect(shopCustomerAccountKey(SHOP_A, 'Client@example.com'))
      .not.toBe(shopCustomerAccountKey(SHOP_B, 'Client@example.com'));
  });

  it('refuse un email normalisé incohérent avec l email métier', () => {
    const result = shopCustomerAccountSchema.safeParse({
      id: CUSTOMER, shopId: SHOP_A, email: 'client@example.com',
      normalizedEmail: 'other@example.com', fullName: 'Client Exemple',
      authSubjectId: null, status: 'delegated_only',
      createdByMagritUserId: MAGRIT_USER, createdAt: NOW,
      activatedAt: null, suspendedAt: null,
    });

    expect(result.success).toBe(false);
  });

  it('distingue une session client directe d une délégation Magrit', () => {
    expect(storefrontIdentitySchema.parse({
      kind: 'shop_customer', shopId: SHOP_A, shopCustomerAccountId: CUSTOMER,
    })).toEqual({
      kind: 'shop_customer', shopId: SHOP_A, shopCustomerAccountId: CUSTOMER,
    });
    expect(storefrontIdentitySchema.parse({
      kind: 'delegated_shop_customer', shopId: SHOP_A,
      shopCustomerAccountId: CUSTOMER, delegationId: DELEGATION,
      actorMagritUserId: MAGRIT_USER,
    })).toEqual(expect.objectContaining({
      kind: 'delegated_shop_customer', actorMagritUserId: MAGRIT_USER,
    }));
  });

  it('interdit tout secret dans le résultat de l action unifiée', () => {
    const base = {
      customer: {
        id: CUSTOMER, shopId: SHOP_A, email: 'client@example.com',
        normalizedEmail: 'client@example.com', fullName: 'Client Exemple',
        authSubjectId: null, status: 'delegated_only',
        createdByMagritUserId: MAGRIT_USER, createdAt: NOW,
        activatedAt: null, suspendedAt: null,
      },
      delegation: {
        id: DELEGATION, shopId: SHOP_A, shopCustomerAccountId: CUSTOMER,
        actorMagritUserId: MAGRIT_USER, issuedAt: NOW,
        expiresAt: '2026-08-16T08:15:00+00:00', revokedAt: null, reason: null,
      },
      storefrontPath: '/shop/example',
    };

    expect(selfShopCustomerDelegationResultSchema.safeParse(base).success).toBe(true);
    expect(selfShopCustomerDelegationResultSchema.safeParse({ ...base, password: 'secret' }).success).toBe(false);
    expect(selfShopCustomerDelegationResultSchema.safeParse({ ...base, accessToken: 'secret' }).success).toBe(false);
  });
});
