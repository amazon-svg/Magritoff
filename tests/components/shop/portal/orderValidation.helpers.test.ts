/**
 * Tests vitest pour orderValidation.helpers.ts (Sprint 5 fix 2026-05-25).
 *
 * Fix BCP-5 (recette navigateur 2026-09-15/16, CONVENTIONS §8.25 5.1(b)) :
 * meme defaut que orderCancellation.helpers.ts — tests ajoutes pour la forme
 * actuelle du message serveur ('transition_not_allowed', tiret bas).
 */

import { describe, it, expect } from 'vitest';
import { ApiClientError } from '@/platform/api';
import { formatValidateErrorMessage } from '@/modules/orders/ui/storefront/orderValidation.helpers';
import { toRpcLikeError } from '@/modules/orders/ui/storefront/orderCancellation.helpers';

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
    })).toContain("plus en attente de validation");
  });

  it("message inconnu non-vide → fallback avec message brut", () => {
    expect(formatValidateErrorMessage({ message: 'Custom DB error xyz' }))
      .toContain('Custom DB error xyz');
  });

  it("match insensible casse", () => {
    expect(formatValidateErrorMessage({ message: 'PERMISSION DENIED: VALIDATE REQUIRES ADMIN TENANT' }))
      .toContain("administrateur tenant peut valider");
  });

  // BCP-5 (recette 2026-09-15/16) : forme ACTUELLE renvoyee par
  // POST /orders/{id}/transitions ('transition_not_allowed: from -> to',
  // tiret bas). Avant le fix, ce message tombait dans le fallback brut.
  it("forme actuelle 'transition_not_allowed: cancelled -> validated' -> message clair (pas le texte technique)", () => {
    const result = formatValidateErrorMessage({ message: 'transition_not_allowed: cancelled -> validated' });
    expect(result).toContain("plus en attente de validation");
    expect(result).not.toContain('transition_not_allowed');
  });

  it("forme actuelle avec code metier ApiClientError privilegie le code", () => {
    const err = new ApiClientError({
      type: 'about:blank',
      title: 'Transition impossible',
      status: 409,
      code: 'orders.transition_not_allowed',
      detail: 'transition_not_allowed: cancelled -> validated',
      requestId: 'req-test',
    });
    const result = formatValidateErrorMessage(toRpcLikeError(err));
    expect(result).toContain("plus en attente de validation");
    expect(result).not.toContain('transition_not_allowed');
  });

  it("ancienne forme RPC ('Transition ... not allowed', espace) continue de marcher", () => {
    expect(formatValidateErrorMessage({
      message: 'Transition draft -> validated not allowed in v1.1',
    })).toContain("plus en attente de validation");
  });
});
