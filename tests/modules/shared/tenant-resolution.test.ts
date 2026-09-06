import { describe, expect, it } from 'vitest';
import type { TenantId } from '@/kernel';
import {
  assertScopes,
  ProblemError,
  type ShopCustomerPrincipal,
} from '@/modules/_shared/application';

const SHOP_CUSTOMER_PRINCIPAL: ShopCustomerPrincipal = {
  kind: 'shop_customer',
  accountId: 'account-1',
  shopId: 'shop-1',
  tenantId: 'tenant-1' as TenantId,
  customerId: null,
  sessionKind: 'direct',
  sessionToken: 'token-1',
};

describe('assertScopes — troisieme couche du cloisonnement des modes (E10.10b-1 round 2, B2)', () => {
  it('sort sans erreur pour un ShopCustomerPrincipal quand requiredScopes est vide', () => {
    expect(() => assertScopes(SHOP_CUSTOMER_PRINCIPAL, [])).not.toThrow();
  });

  it('refuse explicitement, 403 identity.actor_kind_required, quand un ShopCustomerPrincipal atteint requiredScopes non vide', () => {
    // Cas structurellement inatteignable par le handler reel (la couche 2
    // de createGescomApiHandler refuse deja un ShopCustomerPrincipal sur
    // toute route non `shop_customer`, et defineGescomRoute interdit a une
    // route `shop_customer` de declarer des scopes) : ce test appelle la
    // fonction directement, sans passer par le middleware, pour prouver que
    // CETTE assertion refuse par elle-meme si les couches en amont
    // disparaissaient un jour — sans lui, rien ne le prouverait (qa-review
    // E10.10b-1 round 2, reserve R1).
    let caught: unknown;
    try {
      assertScopes(SHOP_CUSTOMER_PRINCIPAL, ['price-rules:read']);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProblemError);
    expect((caught as ProblemError).init.status).toBe(403);
    expect((caught as ProblemError).init.code).toBe('identity.actor_kind_required');
  });
});
