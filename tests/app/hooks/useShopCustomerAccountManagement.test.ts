import { describe, expect, it } from 'vitest';
import { shopCustomerManagementError } from '@/modules/shop-customers/ui/hooks/useShopCustomerAccountManagement';

describe('shopCustomerManagementError', () => {
  it('conserve un message métier exploitable', () => {
    expect(shopCustomerManagementError(new Error('Compte déjà présent.'), 'Échec.'))
      .toBe('Compte déjà présent.');
  });

  it('utilise le fallback pour une erreur sans contrat', () => {
    expect(shopCustomerManagementError({ code: 500 }, 'Échec contrôlé.'))
      .toBe('Échec contrôlé.');
  });
});
