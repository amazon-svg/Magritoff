/**
 * Resolution du tenant et de l acteur (story E10.0, CA4 et CA5).
 *
 * REGLE OPPOSABLE : le tenant vient TOUJOURS du jeton d authentification. Il
 * n est jamais lu dans un parametre de chemin ni de requete. Une requete qui
 * tente d adresser un tenant par l URL est refusee, pas silencieusement
 * ignoree — sinon la regle se perd des la premiere route pressee.
 *
 * Deux modes d authentification, jamais combines :
 *  - `user`    : Bearer JWT utilisateur Supabase (`Authorization: Bearer ...`).
 *  - `service` : cle de service a portee explicite pour un module tiers
 *                (Studio, Clariprint Data), en-tete `X-Magrit-Service-Key`.
 *                La cle porte son tenant ET sa liste de scopes.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import { SERVICE_KEY_HEADER } from '../api/contracts.ts';
import { authenticationRequired, problem, scopeRequired, SHARED_PROBLEM_CODES } from './problem.ts';

export type ServiceScope = string;

export type UserPrincipal = Readonly<{
  kind: 'user';
  userId: UserId;
  tenantId: TenantId;
}>;

export type ServicePrincipal = Readonly<{
  kind: 'service';
  serviceId: string;
  tenantId: TenantId;
  scopes: readonly ServiceScope[];
}>;

/** Acteur authentifie, tenant deja resolu. Aucun code metier ne le reconstruit. */
export type ApiPrincipal = UserPrincipal | ServicePrincipal;

export type BearerCredential = Readonly<{ kind: 'bearer'; token: string }>;
export type ServiceKeyCredential = Readonly<{ kind: 'service_key'; key: string }>;
export type ApiCredential = BearerCredential | ServiceKeyCredential;

/**
 * Port de verification des jetons. L implementation Supabase vit dans
 * src/adapters/supabase/ ; le socle n en connait que le contrat.
 */
export interface PrincipalVerifier {
  /** Retourne l acteur porte par la credential, ou null si elle est invalide. */
  verify(credential: ApiCredential): Promise<ApiPrincipal | null>;
}

/** Parametres de requete par lesquels un appelant tenterait d adresser un tenant. */
const TENANT_ADDRESSING_QUERY_KEYS = Object.freeze([
  'tenant',
  'tenant_id',
  'tenantId',
  'tenant-id',
  'espace',
]);

const TENANT_ADDRESSING_PATH_PARAMS = Object.freeze(['tenantId', 'tenant_id', 'tenant']);

/**
 * Lit la credential de la requete. Retourne null si aucune n est presente.
 * Deux credentials simultanees sont un appel ambigu : refuse.
 */
export function readCredential(request: Request): ApiCredential | null {
  const authorization = request.headers.get('authorization');
  const serviceKey = request.headers.get(SERVICE_KEY_HEADER);

  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (bearer && serviceKey) {
    throw problem({
      status: 400,
      title: 'Authentification ambigue',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail: `Fournir soit un Bearer utilisateur, soit ${SERVICE_KEY_HEADER}, jamais les deux.`,
    });
  }

  if (bearer) return Object.freeze({ kind: 'bearer' as const, token: bearer });
  if (serviceKey && serviceKey.trim().length > 0) {
    return Object.freeze({ kind: 'service_key' as const, key: serviceKey.trim() });
  }
  return null;
}

/**
 * Refuse toute tentative d adresser un tenant par l URL (CA4). Appele avant la
 * resolution : un appelant ne doit jamais croire que ce parametre a un effet.
 */
export function assertTenantNotAddressed(
  url: URL,
  pathParams: Readonly<Record<string, string>> = {},
): void {
  const offendingQuery = TENANT_ADDRESSING_QUERY_KEYS.filter((key) => url.searchParams.has(key));
  const offendingPath = TENANT_ADDRESSING_PATH_PARAMS.filter((key) => key in pathParams);
  const offending = [...offendingQuery, ...offendingPath];

  if (offending.length > 0) {
    throw problem({
      status: 400,
      title: 'Tenant non adressable',
      code: SHARED_PROBLEM_CODES.tenantNotAddressable,
      detail: `Le tenant est resolu depuis le jeton. Retirer : ${offending.join(', ')}.`,
    });
  }
}

/**
 * Resout l acteur et son tenant depuis la seule credential de la requete.
 * Leve un Problem 401 quand rien n est fourni ou que la credential est refusee.
 */
export async function resolvePrincipal(
  request: Request,
  verifier: PrincipalVerifier,
  pathParams: Readonly<Record<string, string>> = {},
): Promise<ApiPrincipal> {
  assertTenantNotAddressed(new URL(request.url), pathParams);

  const credential = readCredential(request);
  if (credential === null) {
    throw authenticationRequired(
      `Fournir un Bearer JWT utilisateur ou une cle de service ${SERVICE_KEY_HEADER}.`,
    );
  }

  const principal = await verifier.verify(credential);
  if (principal === null) throw authenticationRequired('Jeton refuse.');
  if (principal.tenantId.trim().length === 0) {
    throw problem({
      status: 403,
      title: 'Tenant introuvable dans le jeton',
      code: SHARED_PROBLEM_CODES.tenantNotResolved,
    });
  }

  return principal;
}

/** Verifie que l acteur porte tous les scopes exiges par l operation (CA5). */
export function assertScopes(
  principal: ApiPrincipal,
  requiredScopes: readonly ServiceScope[],
): void {
  if (requiredScopes.length === 0) return;
  // Un JWT utilisateur ne porte pas de scope de service : ses droits sont
  // portes par les roles du tenant, verifies par la RLS et le service metier.
  if (principal.kind === 'user') return;

  const missing = requiredScopes.filter((scope) => !principal.scopes.includes(scope));
  if (missing.length > 0) throw scopeRequired(missing);
}

/** Restreint une operation aux acteurs utilisateurs. */
export function assertUserPrincipal(principal: ApiPrincipal): UserPrincipal {
  if (principal.kind !== 'user') {
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail: 'Cette operation exige un jeton utilisateur, pas une cle de service.',
    });
  }
  return principal;
}
