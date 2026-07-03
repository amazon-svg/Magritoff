/**
 * Tests vitest pour orderValidation.helpers.ts (Sprint 5 fix 2026-05-25).
 */

import { describe, it, expect } from 'vitest';
import { formatValidateErrorMessage } from '../../../../src/app/components/shop/portal/orderValidation.helpers';

describe('formatValidateErrorMessage', () => {
  it('null / undefined → message reseau generique', () => {
    expect(formatValidateErrorMessage(null)).toContain('reseau');
    expect(formatValidateErrorMessage(undefined)).toContain('reseau');
    expect(formatValidateErrorMessage({})).toContain('reseau');
  });

  it("pattern 'Authentication required' → message session expiree", () => {
    expect(formatValidateErrorMessage({ message: 'Authentication required' }))
      .toContain('session a expire');
  });

  it("pattern 'not found' → message commande supprimee", () => {
    expect(formatValidateErrorMessage({ message: 'Tenant order xyz not found' }))
      .toContain("n'existe plus");
  });

  it("pattern 'Permission denied: validate requires admin tenant' → message specifique admin", () => {
    expect(formatValidateErrorMessage({
      message: 'Permission denied: validate requires admin tenant',
    })).toContain("administrateur tenant peut valider");
  });

  it("pattern 'Transition draft -> validated not allowed' → message status non draft", () => {
    expect(formatValidateErrorMessage({
      message: 'Transition draft -> validated not allowed in v1.1',
    })).toContain("plus en statut Brouillon");
  });

  it("message inconnu non-vide → fallback avec message brut", () => {
    expect(formatValidateErrorMessage({ message: 'Custom DB error xyz' }))
      .toContain('Custom DB error xyz');
  });

  it("match insensible casse", () => {
    expect(formatValidateErrorMessage({ message: 'PERMISSION DENIED: VALIDATE REQUIRES ADMIN TENANT' }))
      .toContain("administrateur tenant peut valider");
  });
});
