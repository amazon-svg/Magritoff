/**
 * Helpers neutres de classification des erreurs de transition de commande
 * (annulation, validation — Story S3.4/S-VALIDATE-DRAFT-MVP, Sprint 5).
 *
 * Module partagé par `orderCancellation.helpers.ts` et
 * `orderValidation.helpers.ts` (qa-review round 2, 2026-09-16, dette D3b) :
 * la classification d'erreur (code métier vs texte brut) est identique pour
 * les deux flux, seul le message final change.
 *
 * `POST /orders/{id}/transitions` (src/modules/orders/api/client.ts) sert un
 * problem RFC 7807 construit par `toHttpError()`
 * (src/server/api/orders-routes.ts:269-283) à partir d'un
 * `OrderCommandRejectedError` (src/modules/orders/application/orders-repository.ts) :
 *
 *   code                          | detail (texte brut sous-jacent)
 *   -------------------------------|--------------------------------------
 *   orders.order_not_found         | 'order_not_found: <uuid>'
 *   orders.permission_denied       | 'permission_denied: <raison>'
 *   orders.transition_not_allowed  | 'transition_not_allowed: <from> -> <to>'
 *   orders.order_not_editable      | 'order_not_editable: <raison>'
 *
 * Le texte brut utilise le TIRET BAS (`_`), jamais l'espace de l'ancien RPC
 * `update_tenant_order_status` ('not found', 'permission denied', 'not
 * allowed'). qa-review round 2 (2026-09-16) a constaté que les formateurs ne
 * reconnaissaient QUE l'ancienne forme espacée pour 'not found'/'permission
 * denied' — le 404 et le 403 affichaient donc le texte technique brut (UUID
 * inclus) à l'écran, exactement le même défaut que celui déjà corrigé pour
 * le conflit de transition. `toRpcLikeError()` expose le code stable
 * (`ApiClientError.problem.code`) : chaque `is*()` ci-dessous s'appuie
 * exclusivement dessus. Une erreur sans code reste volontairement non classée.
 */

import { ApiClientError } from '@/platform/api';

export interface RpcLikeError {
  message?: string;
  code?: string;
  details?: string;
}

/**
 * Convertit une erreur catchee (typiquement `ApiClientError` du client API,
 * ou une `Error` generique) en `RpcLikeError` exploitable par
 * `formatCancelErrorMessage`/`formatValidateErrorMessage`.
 *
 * `ApiClientError` ne porte pas de `.code` de premier niveau : le code
 * metier stable RFC 7807 vit dans `.problem.code`. On l'expose ici pour que
 * les helpers de formatage puissent preferer le code au texte, plus robuste
 * qu'un pattern-matching sur `error.message`.
 */
export function toRpcLikeError(cause: unknown): RpcLikeError | null {
  if (cause instanceof ApiClientError) {
    return { message: cause.message, code: cause.problem.code };
  }
  if (cause instanceof Error) return { message: cause.message };
  return null;
}

/** Codes métier stables portés par `ApiClientError.problem.code`. */
export const ORDER_ERROR_CODE = {
  AUTHENTICATION_REQUIRED: 'identity.authentication_required',
  NOT_FOUND: 'orders.order_not_found',
  PERMISSION_DENIED: 'orders.permission_denied',
  NOT_EDITABLE: 'orders.order_not_editable',
  TRANSITION_NOT_ALLOWED: 'orders.transition_not_allowed',
  /** Q17-a (point 12 (c)) — refus `draft -> validated` sans acquittement explicite. */
  UNVERIFIED_PRICES: 'orders.unverified_prices',
} as const;

/**
 * Verdict par code : égalité stricte, sans repli sur le texte — qa-review round 2
 * (2026-09-16, mutation M6) a montré qu'un 409 générique à la façade E10
 * (ex. `api.idempotency_key_reused`) ne doit jamais être requalifié en
 * conflit de transition (ni en 404/403) même si son texte y ressemblait par
 * accident. Une erreur générique sans code n'est pas requalifiée.
 */
function hasCode(err: RpcLikeError | null | undefined, code: string): boolean {
  const errCode = String(err?.code ?? '').toLowerCase();
  return errCode === code;
}

export function isAuthenticationRequired(err: RpcLikeError | null | undefined): boolean {
  return hasCode(err, ORDER_ERROR_CODE.AUTHENTICATION_REQUIRED);
}

/** Commande introuvable (404), classée exclusivement par son code stable. */
export function isOrderNotFound(err: RpcLikeError | null | undefined, _msg?: string): boolean {
  return hasCode(err, ORDER_ERROR_CODE.NOT_FOUND);
}

/** Droits insuffisants (403), classés exclusivement par leur code stable. */
export function isPermissionDenied(err: RpcLikeError | null | undefined, _msg?: string): boolean {
  return hasCode(err, ORDER_ERROR_CODE.PERMISSION_DENIED);
}

/**
 * Commande non modifiable (409, `order_not_editable`) : n'est pas produit
 * aujourd'hui par `POST /orders/{id}/transitions` (seuls order_not_found,
 * permission_denied, transition_not_allowed en sortent, cf.
 * `transitionOrder()` dans src/adapters/supabase/orders-repository.ts) —
 * c'est `updateDraft` (édition, `useStorefrontOrderEditor.ts`) qui le
 * produit, sur un chemin distinct. Traité ici par défense (qa-review round
 * 2) : si un jour la surface change, le texte technique ne fuitera pas.
 */
export function isOrderNotEditable(err: RpcLikeError | null | undefined, _msg?: string): boolean {
  return hasCode(err, ORDER_ERROR_CODE.NOT_EDITABLE);
}

/**
 * Reconnaît un conflit de transition (commande déjà transitionnée ailleurs)
 * par le code métier stable de la route actuelle.
 *
 * qa-review round 2 (mutation M6) : un 409 dont le code
 * n'est pas `orders.transition_not_allowed` (ex. `api.idempotency_key_reused`)
 * est rejeté immédiatement. Voir le test dédié dans
 * orderTransitionErrors.helpers.test.ts.
 */
export function isTransitionConflict(err: RpcLikeError | null | undefined, _msg?: string): boolean {
  return hasCode(err, ORDER_ERROR_CODE.TRANSITION_NOT_ALLOWED);
}

/**
 * Q17-c (docs/api/CONVENTIONS.md §8.25 point 12 (c)) — refus défensif : la
 * confirmation nommée de `ValidateOrderConfirmDialog` acquitte déjà
 * `acknowledgeUnverifiedPrices` quand `order.hasUnverifiedPrices` est vrai,
 * donc ce refus ne devrait plus atteindre l écran dans le cas nominal. Il
 * reste atteignable si l état affiché est PÉRIMÉ (une ligne devient
 * `client_unverified` entre le chargement de la liste et le clic) : sans ce
 * classement, le texte technique `unverified_prices: [...]` fuiterait tel
 * quel, exactement le défaut déjà corrigé pour les autres codes de ce
 * fichier.
 */
export function isUnverifiedPrices(err: RpcLikeError | null | undefined, _msg?: string): boolean {
  return hasCode(err, ORDER_ERROR_CODE.UNVERIFIED_PRICES);
}
