/**
 * Tests vitest pour orderTransitionErrors.helpers.ts (module neutre, dette
 * D3b, qa-review round 2 2026-09-16) — mutualise entre
 * orderCancellation.helpers.ts et orderValidation.helpers.ts.
 */

import { describe, it, expect } from 'vitest';
import { ApiClientError } from '@/platform/api';
import {
  isOrderNotEditable,
  isOrderNotFound,
  isPermissionDenied,
  isTransitionConflict,
  toRpcLikeError,
} from '@/modules/orders/ui/storefront/orderTransitionErrors.helpers';

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

describe('toRpcLikeError', () => {
  it('ApiClientError -> { message, code } depuis problem.detail/problem.code', () => {
    const err = apiError('orders.transition_not_allowed', 'transition_not_allowed: validated -> cancelled');
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

describe('isOrderNotFound', () => {
  it('code orders.order_not_found -> true', () => {
    expect(isOrderNotFound({ code: 'orders.order_not_found' }, 'peu importe')).toBe(true);
  });

  it("texte actuel avec tiret bas ('order_not_found: <uuid>') sans code -> true", () => {
    expect(isOrderNotFound(null, 'order_not_found: 7c1f1a4e-0000-0000-0000-000000000000')).toBe(true);
  });

  it("ancien texte espace ('not found') sans code -> true", () => {
    expect(isOrderNotFound(null, 'tenant order abc-123 not found')).toBe(true);
  });

  it('code different -> false, meme si le texte contient not found', () => {
    expect(isOrderNotFound({ code: 'orders.permission_denied' }, 'order_not_found: xyz')).toBe(false);
  });
});

describe('isPermissionDenied', () => {
  it('code orders.permission_denied -> true', () => {
    expect(isPermissionDenied({ code: 'orders.permission_denied' }, 'peu importe')).toBe(true);
  });

  it("texte actuel tiret bas ('permission_denied: order identity mismatch') sans code -> true", () => {
    expect(isPermissionDenied(null, 'permission_denied: order identity mismatch')).toBe(true);
  });

  it("ancien texte espace ('permission denied') sans code -> true", () => {
    expect(isPermissionDenied(null, 'permission denied: cancel requires owner or admin tenant')).toBe(true);
  });

  it('code different -> false', () => {
    expect(isPermissionDenied({ code: 'orders.order_not_found' }, 'permission_denied: x')).toBe(false);
  });
});

describe('isOrderNotEditable', () => {
  it('code orders.order_not_editable -> true', () => {
    expect(isOrderNotEditable({ code: 'orders.order_not_editable' }, 'peu importe')).toBe(true);
  });

  it("texte tiret bas ('order_not_editable') sans code -> true", () => {
    expect(isOrderNotEditable(null, 'order_not_editable: order is validated')).toBe(true);
  });

  it('code different -> false', () => {
    expect(isOrderNotEditable({ code: 'orders.transition_not_allowed' }, 'order_not_editable: x')).toBe(false);
  });
});

describe('isTransitionConflict', () => {
  it('code orders.transition_not_allowed -> true', () => {
    expect(isTransitionConflict({ code: 'orders.transition_not_allowed' }, 'peu importe')).toBe(true);
  });

  it("texte actuel tiret bas ('transition_not_allowed: from -> to') sans code -> true", () => {
    expect(isTransitionConflict(null, 'transition_not_allowed: validated -> cancelled')).toBe(true);
  });

  it("ancien texte espace ('not allowed') sans code -> true", () => {
    expect(isTransitionConflict(null, 'transition draft -> cancelled not allowed in v1.1')).toBe(true);
  });

  it('sans "transition" dans le texte et sans code -> false', () => {
    expect(isTransitionConflict(null, 'not found')).toBe(false);
  });

  // qa-review round 2 (mutation M6) : un 409 GENERIQUE (facade E10, pas le
  // domaine orders) ne doit JAMAIS etre requalifie en conflit de transition,
  // meme si son texte contenait incidemment 'transition'/'not_allowed'.
  it('409 api.idempotency_key_reused (code different) -> false, jamais un conflit de transition', () => {
    const err = apiError('api.idempotency_key_reused', 'La cle d idempotence a deja servi pour une requete differente.');
    const msg = String(err.message).toLowerCase();
    expect(isTransitionConflict(toRpcLikeError(err), msg)).toBe(false);
  });

  it('409 avec un autre code ORDERS mais un texte qui ressemble a un conflit -> false (le code fait autorite)', () => {
    const rpc = { code: 'api.idempotency_key_reused', message: 'transition_not_allowed: validated -> cancelled (piege)' };
    expect(isTransitionConflict(rpc, rpc.message.toLowerCase())).toBe(false);
  });
});
