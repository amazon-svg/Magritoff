/**
 * Tests vitest pour orderCancellation.helpers.ts (Story S3.4 Sprint 5 AC6).
 *
 * Fix BCP-5 (recette navigateur 2026-09-15/16, CONVENTIONS §8.25 5.1) :
 * tests ajoutes pour la forme actuelle du message serveur ('transition_not_allowed',
 * tiret bas) qui echouait avant le fix (l'ancien pattern-matching n'attrapait
 * que 'not allowed', avec espace).
 *
 * Fix qa-review round 2 (2026-09-16) : meme defaut sur order_not_found (404)
 * et permission_denied (403) — le texte technique brut (UUID inclus) fuyait
 * a l'ecran. La classification par code/texte (isOrderNotFound,
 * isPermissionDenied, isTransitionConflict, toRpcLikeError) vit desormais
 * dans le module neutre orderTransitionErrors.helpers.ts (dette D3b), teste
 * separement dans orderTransitionErrors.helpers.test.ts — ce fichier ne
 * teste plus que le RESULTAT de `formatCancelErrorMessage`.
 */

import { describe, it, expect } from 'vitest';
import { ApiClientError } from '@/platform/api';
import { formatCancelErrorMessage } from '@/modules/orders/ui/storefront/orderCancellation.helpers';
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

  it("pattern 'not found' (ancien texte espace) → message commande supprimee race condition", () => {
    expect(formatCancelErrorMessage({ message: 'Tenant order abc-123 not found' }))
      .toContain("n'existe plus");
  });

  it("pattern 'Permission denied' (ancien texte espace) → message droits insuffisants", () => {
    expect(formatCancelErrorMessage({ message: 'Permission denied: cancel requires owner or admin tenant' }))
      .toContain('droits pour annuler');
  });

  it("pattern 'Transition not allowed' (ancien texte espace) → message status change race condition", () => {
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
  // tiret bas). Avant le fix, ce message tombait dans le fallback brut.
  it("forme actuelle 'transition_not_allowed: validated -> cancelled' -> message clair (pas le texte technique)", () => {
    const result = formatCancelErrorMessage({ message: 'transition_not_allowed: validated -> cancelled' });
    expect(result).toContain("plus en attente de validation");
    expect(result).not.toContain('transition_not_allowed');
  });

  it("forme actuelle avec code metier ApiClientError privilegie le code (message annexe ignore)", () => {
    const err = apiError('orders.transition_not_allowed', 'transition_not_allowed: validated -> cancelled');
    const result = formatCancelErrorMessage(toRpcLikeError(err));
    expect(result).toContain("plus en attente de validation");
    expect(result).not.toContain('transition_not_allowed');
  });

  it("ancienne forme RPC ('Transition ... not allowed', espace) continue de marcher", () => {
    expect(formatCancelErrorMessage({ message: 'Transition draft -> cancelled not allowed in v1.1' }))
      .toContain("plus en attente de validation");
  });

  // qa-review round 2 (2026-09-16) — 404 : reproduction EXACTE du texte
  // rapporte en recette. `order_not_found: <uuid>` (tiret bas, UUID inclus)
  // ne matchait ni 'not found' (espace) ni aucun code -> fuyait a l'ecran.
  describe('404 order_not_found (qa-review round 2)', () => {
    const uuid = '7c1f1a4e-1234-4abc-8def-000000000000';

    it(`texte brut exact 'order_not_found: ${uuid}' -> message clair, jamais l'UUID`, () => {
      const result = formatCancelErrorMessage({ message: `order_not_found: ${uuid}` });
      expect(result).toContain("n'existe plus");
      expect(result).not.toContain('order_not_found');
      expect(result).not.toContain(uuid);
    });

    it('code metier orders.order_not_found (ApiClientError) -> message clair, jamais l UUID ni le code', () => {
      const err = apiError('orders.order_not_found', `order_not_found: ${uuid}`, 404);
      const result = formatCancelErrorMessage(toRpcLikeError(err));
      expect(result).toContain("n'existe plus");
      expect(result).not.toContain('order_not_found');
      expect(result).not.toContain(uuid);
    });
  });

  // qa-review round 2 (2026-09-16) — 403 : reproduction EXACTE du texte
  // rapporte en recette. `permission_denied: order identity mismatch`
  // (tiret bas) ne matchait pas 'permission denied' (espace) -> fuyait.
  describe('403 permission_denied (qa-review round 2)', () => {
    it("texte brut exact 'permission_denied: order identity mismatch' -> message clair, jamais le texte technique", () => {
      const result = formatCancelErrorMessage({ message: 'permission_denied: order identity mismatch' });
      expect(result).toContain('droits pour annuler');
      expect(result).not.toContain('permission_denied');
    });

    it('code metier orders.permission_denied (ApiClientError) -> message clair, jamais le code', () => {
      const err = apiError('orders.permission_denied', 'permission_denied: order identity mismatch', 403);
      const result = formatCancelErrorMessage(toRpcLikeError(err));
      expect(result).toContain('droits pour annuler');
      expect(result).not.toContain('permission_denied');
    });
  });

  // qa-review round 2 (2026-09-16) — order_not_editable : non atteignable
  // aujourd'hui par ce flux (cf. orderTransitionErrors.helpers.ts), traite
  // par defense — meme texte que useStorefrontOrderEditor.ts.
  it("code metier orders.order_not_editable -> message 'non modifiable', jamais le code brut", () => {
    const err = apiError('orders.order_not_editable', 'order_not_editable: order is validated', 409);
    const result = formatCancelErrorMessage(toRpcLikeError(err));
    expect(result).toContain('plus modifiable');
    expect(result).not.toContain('order_not_editable');
  });

  // qa-review round 2 (mutation M6) : un 409 dont le code n'est PAS
  // orders.transition_not_allowed ne doit jamais produire le message de
  // conflit de transition, meme texte confondant.
  it('409 api.idempotency_key_reused -> PAS le message de conflit de transition', () => {
    const err = apiError('api.idempotency_key_reused', 'La cle a deja servi pour une requete differente.', 409);
    const result = formatCancelErrorMessage(toRpcLikeError(err));
    expect(result).not.toContain('plus en attente de validation');
  });
});
