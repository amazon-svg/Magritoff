/**
 * Erreurs RFC 7807 de la facade Gestion commerciale (story E10.0, CA6).
 *
 * Toute erreur sortante est un `Problem` : meme forme, meme media type
 * `application/problem+json`, et surtout un `code` metier STABLE sur lequel un
 * appelant a le droit de brancher son comportement. Un code publie ne change
 * plus en v1 (CA13) : on en ajoute, on n en renomme pas.
 */
import type { ProblemDto, ProblemFieldErrorDto } from '../api/contracts.ts';

/** Codes transverses du socle. Les modules E10.x ajoutent les leurs. */
export const SHARED_PROBLEM_CODES = Object.freeze({
  invalidJson: 'api.invalid_json',
  validationFailed: 'api.validation_failed',
  notFound: 'api.not_found',
  methodNotAllowed: 'api.method_not_allowed',
  unsupportedMediaType: 'api.unsupported_media_type',
  internalError: 'api.internal_error',
  invalidPageParams: 'api.invalid_page_params',
  invalidCursor: 'api.invalid_cursor',
  idempotencyKeyRequired: 'api.idempotency_key_required',
  idempotencyKeyInvalid: 'api.idempotency_key_invalid',
  idempotencyKeyReused: 'api.idempotency_key_reused',
  idempotencyInProgress: 'api.idempotency_in_progress',
  ifMatchRequired: 'api.if_match_required',
  ifMatchInvalid: 'api.if_match_invalid',
  resourceConflict: 'api.resource_conflict',
  tenantNotAddressable: 'api.tenant_not_addressable',
  authenticationRequired: 'identity.authentication_required',
  tenantNotResolved: 'identity.tenant_not_resolved',
  scopeRequired: 'identity.scope_required',
  actorKindRequired: 'identity.actor_kind_required',
} as const);

export type SharedProblemCode =
  (typeof SHARED_PROBLEM_CODES)[keyof typeof SHARED_PROBLEM_CODES];

export type ProblemInit = Readonly<{
  status: number;
  title: string;
  code: string;
  detail?: string;
  instance?: string;
  type?: string;
  errors?: readonly ProblemFieldErrorDto[];
  currentState?: Readonly<Record<string, unknown>> | null;
}>;

/**
 * Erreur transportant un Problem complet. Le `request_id` n est pas connu du
 * code metier : il est injecte par la facade au moment du rendu.
 */
export class ProblemError extends Error {
  readonly init: ProblemInit;

  constructor(init: ProblemInit) {
    super(init.detail ?? init.title);
    this.name = 'ProblemError';
    this.init = Object.freeze({ ...init });
  }

  /** Rend le Problem complet, correle a la requete. */
  toProblem(requestId: string): ProblemDto {
    const { init } = this;
    return {
      type: init.type ?? 'about:blank',
      title: init.title,
      status: init.status,
      code: init.code,
      request_id: requestId,
      ...(init.detail === undefined ? {} : { detail: init.detail }),
      ...(init.instance === undefined ? {} : { instance: init.instance }),
      ...(init.errors === undefined ? {} : { errors: [...init.errors] }),
      ...(init.currentState === undefined ? {} : { current_state: init.currentState }),
    };
  }
}

export function problem(init: ProblemInit): ProblemError {
  return new ProblemError(init);
}

export function authenticationRequired(detail?: string): ProblemError {
  return problem({
    status: 401,
    title: 'Authentification requise',
    code: SHARED_PROBLEM_CODES.authenticationRequired,
    ...(detail === undefined ? {} : { detail }),
  });
}

export function scopeRequired(scopes: readonly string[]): ProblemError {
  return problem({
    status: 403,
    title: 'Portee de cle de service insuffisante',
    code: SHARED_PROBLEM_CODES.scopeRequired,
    detail: `La cle de service doit porter le scope : ${scopes.join(', ')}.`,
  });
}

export function validationFailed(errors: readonly ProblemFieldErrorDto[]): ProblemError {
  return problem({
    status: 422,
    title: 'Requete invalide',
    code: SHARED_PROBLEM_CODES.validationFailed,
    errors,
  });
}

/**
 * Conflit optimiste (CA9) : l etat courant accompagne le 409 pour que l
 * appelant rejoue sans relire la ressource.
 */
export function resourceConflict(
  currentState: Readonly<Record<string, unknown>>,
  detail?: string,
): ProblemError {
  return problem({
    status: 409,
    title: 'Conflit de version',
    code: SHARED_PROBLEM_CODES.resourceConflict,
    detail:
      detail ??
      'La ressource a change depuis la lecture. Rejouer la modification sur l etat courant.',
    currentState,
  });
}

export function internalError(): ProblemError {
  return problem({
    status: 500,
    title: 'Erreur interne',
    code: SHARED_PROBLEM_CODES.internalError,
  });
}
