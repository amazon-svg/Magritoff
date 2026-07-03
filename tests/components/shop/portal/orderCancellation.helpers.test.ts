/**
 * Tests vitest pour orderCancellation.helpers.ts (Story S3.4 Sprint 5 AC6).
 */

import { describe, it, expect } from 'vitest';
import { formatCancelErrorMessage } from '../../../../src/app/components/shop/portal/orderCancellation.helpers';

describe('formatCancelErrorMessage', () => {
  it('null / undefined → message reseau generique', () => {
    expect(formatCancelErrorMessage(null)).toContain('reseau');
    expect(formatCancelErrorMessage(undefined)).toContain('reseau');
    expect(formatCancelErrorMessage({})).toContain('reseau');
  });

  it("pattern 'Authentication required' → message session expiree", () => {
    expect(formatCancelErrorMessage({ message: 'Authentication required (auth.uid() is null)' }))
      .toContain('session a expire');
  });

  it("pattern 'not found' → message commande supprimee race condition", () => {
    expect(formatCancelErrorMessage({ message: 'Tenant order abc-123 not found' }))
      .toContain("n'existe plus");
  });

  it("pattern 'Permission denied' → message droits insuffisants", () => {
    expect(formatCancelErrorMessage({ message: 'Permission denied: cancel requires owner or admin tenant' }))
      .toContain('droits pour annuler');
  });

  it("pattern 'Transition not allowed' → message status change race condition", () => {
    expect(formatCancelErrorMessage({ message: 'Transition draft -> cancelled not allowed in v1.1' }))
      .toContain("plus en statut Brouillon");
  });

  it("message inconnu non-vide → fallback avec message brut", () => {
    expect(formatCancelErrorMessage({ message: 'Custom DB error xyz' }))
      .toContain('Custom DB error xyz');
  });

  it("match insensible à la casse + tolère espaces", () => {
    expect(formatCancelErrorMessage({ message: 'AUTHENTICATION REQUIRED' }))
      .toContain('session a expire');
    expect(formatCancelErrorMessage({ message: '  Permission Denied  ' }))
      .toContain('droits pour annuler');
  });
});
