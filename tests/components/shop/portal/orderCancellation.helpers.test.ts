/**
 * Tests vitest pour orderCancellation.helpers.ts (Story S3.4 Sprint 5 AC6).
 *
 * Fix BCP-5 (recette navigateur 2026-09-15/16, CONVENTIONS §8.25 5.1) :
 * tests ajoutes pour la forme actuelle du message serveur
 * ('transition_not_allowed', tiret bas) qui echouait avant le fix
 * (l'ancien pattern-matching n'attrapait que 'not allowed', avec espace).
 */

import { describe, it, expect } from 'vitest';
import { ApiClientError } from '@/platform/api';
import {
  formatCancelErrorMessage,
  isTransitionConflict,
  toRpcLikeError,
} from '@/modules/orders/ui/storefront/orderCancellation.helpers';

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
      .toContain("plus en attente de validation");
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

  // BCP-5 (recette 2026-09-15/16) : forme ACTUELLE renvoyee par
  // POST /orders/{id}/transitions ('transition_not_allowed: from -> to',
  // tiret bas). Avant le fix, ce message tombait dans le fallback brut
  // ("Erreur lors de l'annulation : transition_not_allowed: validated ->
  // cancelled") au lieu du message clair.
  it("forme actuelle 'transition_not_allowed: validated -> cancelled' -> message clair (pas le texte technique)", () => {
    const result = formatCancelErrorMessage({ message: 'transition_not_allowed: validated -> cancelled' });
    expect(result).toContain("plus en attente de validation");
    expect(result).not.toContain('transition_not_allowed');
  });

  it("forme actuelle avec code metier ApiClientError privilegie le code (message annexe ignore)", () => {
    const err = new ApiClientError({
      type: 'about:blank',
      title: 'Transition impossible',
      status: 409,
      code: 'orders.transition_not_allowed',
      detail: 'transition_not_allowed: validated -> cancelled',
    });
    const result = formatCancelErrorMessage(toRpcLikeError(err));
    expect(result).toContain("plus en attente de validation");
    expect(result).not.toContain('transition_not_allowed');
  });

  it("ancienne forme RPC ('Transition ... not allowed', espace) continue de marcher", () => {
    expect(formatCancelErrorMessage({ message: 'Transition draft -> cancelled not allowed in v1.1' }))
      .toContain("plus en attente de validation");
  });

  it("isTransitionConflict reconnait le code metier meme sans texte 'transition'", () => {
    expect(isTransitionConflict({ code: 'orders.transition_not_allowed' }, 'peu importe')).toBe(true);
    expect(isTransitionConflict({ code: 'orders.permission_denied' }, 'transition not_allowed')).toBe(true);
    expect(isTransitionConflict(null, 'not found')).toBe(false);
  });

  describe('toRpcLikeError', () => {
    it('ApiClientError -> { message, code } depuis problem.detail/problem.code', () => {
      const err = new ApiClientError({
        type: 'about:blank',
        title: 'Transition impossible',
        status: 409,
        code: 'orders.transition_not_allowed',
        detail: 'transition_not_allowed: validated -> cancelled',
        requestId: 'req-test',
      });
      expect(toRpcLikeError(err)).toEqual({
        message: 'transition_not_allowed: validated -> cancelled',
        code: 'orders.transition_not_allowed',
      });
    });

    it('Error generique -> { message } sans code', () => {
      expect(toRpcLikeError(new Error('Panne reseau'))).toEqual({ message: 'Panne reseau' });
    });

    it('non-Error -> null', () => {
      expect(toRpcLikeError('oops')).toBeNull();
      expect(toRpcLikeError(null)).toBeNull();
      expect(toRpcLikeError(undefined)).toBeNull();
    });
  });
});
