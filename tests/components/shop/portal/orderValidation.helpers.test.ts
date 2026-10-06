/**
 * Tests vitest pour orderValidation.helpers.ts (Sprint 5 fix 2026-05-25).
 *
 * Fix BCP-5 (recette navigateur 2026-09-15/16, CONVENTIONS §8.25 5.1(b)) :
 * meme defaut que orderCancellation.helpers.ts — tests ajoutes pour la forme
 * actuelle du message serveur ('transition_not_allowed', tiret bas).
 *
 * Fix qa-review round 2 (2026-09-16) : meme defaut sur order_not_found (404)
 * et permission_denied (403). Classification mutualisee dans le module
 * neutre orderTransitionErrors.helpers.ts (dette D3b), testee separement
 * dans orderTransitionErrors.helpers.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { ApiClientError } from '@/platform/api';
import { formatValidateErrorMessage } from '@/modules/orders/ui/storefront/orderValidation.helpers';
import { toRpcLikeError } from '@/modules/orders/ui/storefront/orderTransitionErrors.helpers';

function apiError(code: string, detail: string, status = 409) {
  return new ApiClientError({
    type: 'about:blank',
    title: 'Erreur',
    status,
    code,
    detail,
    requestId: 'req-test',
  });
}

describe('formatValidateErrorMessage', () => {
  it('null / undefined → message reseau generique', () => {
    expect(formatValidateErrorMessage(null)).toContain('réseau');
    expect(formatValidateErrorMessage(undefined)).toContain('réseau');
    expect(formatValidateErrorMessage({})).toContain('réseau');
  });

  it("code identity.authentication_required → message session expiree", () => {
    expect(formatValidateErrorMessage({ code: 'identity.authentication_required', message: 'detail interne' }))
      .toContain('session a expire');
  });

  it("message sans code → message générique sans texte serveur", () => {
    const result = formatValidateErrorMessage({ message: 'Custom DB error xyz' });
    expect(result).toContain('validation a échoué');
    expect(result).not.toContain('Custom DB error xyz');
  });

  // BCP-5 (recette 2026-09-15/16) : forme ACTUELLE renvoyee par
  // POST /orders/{id}/transitions ('transition_not_allowed: from -> to',
  // tiret bas). Avant le fix, ce message tombait dans le fallback brut.
  it("texte seul 'transition_not_allowed' -> message générique", () => {
    const result = formatValidateErrorMessage({ message: 'transition_not_allowed: cancelled -> validated' });
    expect(result).toContain('validation a échoué');
    expect(result).not.toContain('transition_not_allowed');
  });

  it("forme actuelle avec code metier ApiClientError privilegie le code", () => {
    const err = apiError('orders.transition_not_allowed', 'transition_not_allowed: cancelled -> validated');
    const result = formatValidateErrorMessage(toRpcLikeError(err));
    expect(result).toContain("plus en attente de validation");
    expect(result).not.toContain('transition_not_allowed');
  });

  // qa-review round 2 (2026-09-16) — meme defaut cote validation, meme
  // reproduction EXACTE que cote annulation.
  describe('404 order_not_found (qa-review round 2)', () => {
    const uuid = '7c1f1a4e-1234-4abc-8def-000000000000';

    it(`texte brut exact 'order_not_found: ${uuid}' -> message clair, jamais l'UUID`, () => {
      const result = formatValidateErrorMessage({ message: `order_not_found: ${uuid}` });
      expect(result).toContain('validation a échoué');
      expect(result).not.toContain('order_not_found');
      expect(result).not.toContain(uuid);
    });

    it('code metier orders.order_not_found (ApiClientError) -> message clair', () => {
      const err = apiError('orders.order_not_found', `order_not_found: ${uuid}`, 404);
      const result = formatValidateErrorMessage(toRpcLikeError(err));
      expect(result).toContain("n'existe plus");
      expect(result).not.toContain('order_not_found');
      expect(result).not.toContain(uuid);
    });
  });

  describe('403 permission_denied (qa-review round 2)', () => {
    it("texte brut exact 'permission_denied: order identity mismatch' (sans 'admin tenant') -> message generique, jamais le texte technique", () => {
      const result = formatValidateErrorMessage({ message: 'permission_denied: order identity mismatch' });
      expect(result).toContain('validation a échoué');
      expect(result).not.toContain('permission_denied');
    });

    it("code metier orders.permission_denied + 'admin tenant' dans le detail -> message specifique admin", () => {
      const err = apiError('orders.permission_denied', 'permission_denied: transition requires admin tenant', 403);
      const result = formatValidateErrorMessage(toRpcLikeError(err));
      expect(result).toContain('droits pour valider');
      expect(result).not.toContain('permission_denied');
    });

    it('code metier orders.permission_denied sans admin tenant -> message generique, jamais le code', () => {
      const err = apiError('orders.permission_denied', 'permission_denied: order identity mismatch', 403);
      const result = formatValidateErrorMessage(toRpcLikeError(err));
      expect(result).toContain('droits pour valider');
      expect(result).not.toContain('permission_denied');
    });
  });

  it("code metier orders.order_not_editable -> message 'non modifiable', jamais le code brut", () => {
    const err = apiError('orders.order_not_editable', 'order_not_editable: order is validated', 409);
    const result = formatValidateErrorMessage(toRpcLikeError(err));
    expect(result).toContain('plus modifiable');
    expect(result).not.toContain('order_not_editable');
  });

  // qa-review round 2 (mutation M6) : un 409 dont le code n'est PAS
  // orders.transition_not_allowed ne doit jamais produire le message de
  // conflit de transition.
  it('409 api.idempotency_key_reused -> PAS le message de conflit de transition', () => {
    const err = apiError('api.idempotency_key_reused', 'La cle a deja servi pour une requete differente.', 409);
    const result = formatValidateErrorMessage(toRpcLikeError(err));
    expect(result).not.toContain('plus en attente de validation');
  });

  // Q17-c (docs/api/CONVENTIONS.md §8.25 point 12 (c)) — repli defensif :
  // avant ce lot, ce refus tombait dans le fallback generique et exposait le
  // texte technique 'unverified_prices: [...]' tel quel a l ecran.
  describe('409 orders.unverified_prices (Q17-c, repli defensif)', () => {
    it("texte brut 'unverified_prices: [\"Flyers\"]' -> message clair, jamais le texte technique", () => {
      const result = formatValidateErrorMessage({ message: 'unverified_prices: ["Flyers"]' });
      expect(result).toContain('validation a échoué');
      expect(result).not.toContain('unverified_prices');
    });

    it('code metier orders.unverified_prices (ApiClientError) -> message clair', () => {
      const err = apiError('orders.unverified_prices', 'unverified_prices: ["Flyers"]', 409);
      const result = formatValidateErrorMessage(toRpcLikeError(err));
      expect(result).toContain('Rechargez la page');
      expect(result).not.toContain('unverified_prices');
    });
  });
});
