/**
 * Resolution du tenant et de l acteur (story E10.0, CA4 et CA5 ; troisieme
 * mode ajoute par E10.10b-1, docs/api/CONVENTIONS.md §8.13).
 *
 * REGLE OPPOSABLE : le tenant vient TOUJOURS du jeton d authentification. Il
 * n est jamais lu dans un parametre de chemin ni de requete. Une requete qui
 * tente d adresser un tenant par l URL est refusee, pas silencieusement
 * ignoree — sinon la regle se perd des la premiere route pressee.
 *
 * Trois modes d authentification, jamais combines deux a deux :
 *  - `user`    : Bearer JWT utilisateur Supabase (`Authorization: Bearer ...`).
 *  - `service` : cle de service a portee explicite pour un module tiers
 *                (Studio, Clariprint Data), en-tete `X-Magrit-Service-Key`.
 *                La cle porte son tenant ET sa liste de scopes.
 *  - `shop_customer` : session boutique (`shop_customer_accounts`, E10.5),
 *                cookie opaque `__Host-magrit-storefront`/`magrit-storefront`
 *                (schema de securite `storefrontSession`, E10.10b-1). PAS un
 *                role, PAS un scope : le cookie designe une boutique, la
 *                boutique un tenant (`shops.tenant_id`) — le tenant est donc
 *                porte par la credential elle-meme, jamais par un en-tete.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import { SERVICE_KEY_HEADER, TENANT_SELECTION_HEADER } from '../api/contracts.ts';
import {
  readStorefrontSessionCookie,
  storefrontSessionCookiePolicy,
} from '../../../server/storefront/session-cookie.ts';
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

/** Session directe du client, ou delegation d un membre Magrit qui le depanne. */
export type ShopCustomerSessionKind = 'direct' | 'delegated';

/**
 * E10.10b-1 — compte client boutique (`shop_customer_accounts`). N a NI role
 * NI scope : ses droits ne sont pas une portee concedee, c est son identite
 * qui delimite ce qu il voit. `customerId` est `null` quand le compte n a
 * aucun interlocuteur (`customer_contact_id`) rattache — E10.5 CA3, compte
 * auto-inscrit ou legacy.
 */
export type ShopCustomerPrincipal = Readonly<{
  kind: 'shop_customer';
  accountId: string;
  shopId: string;
  tenantId: TenantId;
  customerId: string | null;
  sessionKind: ShopCustomerSessionKind;
  /**
   * Jeton opaque de la session, PORTE PAR LE PRINCIPAL : contrairement a un
   * JWT utilisateur (ou `auth.uid()` suffit cote base), une session boutique
   * n a pas d equivalent implicite en base — chaque fonction `security
   * definer` qui lit les donnees du client (`api_list_storefront_quotes`,
   * `api_get_storefront_quote`) doit RE-VERIFIER ce jeton elle-meme (meme
   * mecanisme que `api_get_storefront_portal_orders`, jamais un
   * `accountId` transmis en clair — voir la migration E10.10b-1 pour le
   * raisonnement de securite complet).
   */
  sessionToken: string;
}>;

/** Acteur authentifie, tenant deja resolu. Aucun code metier ne le reconstruit. */
export type ApiPrincipal = UserPrincipal | ServicePrincipal | ShopCustomerPrincipal;

export type BearerCredential = Readonly<{ kind: 'bearer'; token: string }>;
export type ServiceKeyCredential = Readonly<{ kind: 'service_key'; key: string }>;
/** E10.10b-1 — cookie de session storefront, cf. `storefrontSession` (openapi). */
export type CookieCredential = Readonly<{ kind: 'cookie'; token: string }>;
export type ApiCredential = BearerCredential | ServiceKeyCredential | CookieCredential;

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
 * Deux credentials simultanees (peu importe lesquelles des trois) sont un
 * appel ambigu : refuse. E10.10b-1 — le cookie de session storefront compte
 * desormais comme une troisieme credential, avec la MEME regle de non-cumul :
 * une requete doit dire QUI elle est, pas proposer plusieurs identites au
 * serveur pour qu il choisisse la plus permissive.
 */
export function readCredential(request: Request): ApiCredential | null {
  const authorization = request.headers.get('authorization');
  const serviceKey = request.headers.get(SERVICE_KEY_HEADER);
  const cookieHeader = request.headers.get('cookie');

  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const trimmedServiceKey =
    serviceKey && serviceKey.trim().length > 0 ? serviceKey.trim() : undefined;
  // Le nom du cookie differe entre production (`__Host-` exige HTTPS) et
  // developpement local : on cherche les deux, un seul peut etre present a la
  // fois puisqu ils partagent le meme navigateur/protocole.
  const cookieToken =
    readStorefrontSessionCookie(cookieHeader, storefrontSessionCookiePolicy(true)) ??
    readStorefrontSessionCookie(cookieHeader, storefrontSessionCookiePolicy(false)) ??
    undefined;

  const presentedCount = [bearer, trimmedServiceKey, cookieToken].filter(
    (value) => value !== undefined,
  ).length;

  if (presentedCount > 1) {
    throw problem({
      status: 400,
      title: 'Authentification ambigue',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail:
        `Fournir une seule credential a la fois : Bearer utilisateur, ${SERVICE_KEY_HEADER}, ` +
        'ou la session boutique (cookie) — jamais deux.',
    });
  }

  if (bearer) return Object.freeze({ kind: 'bearer' as const, token: bearer });
  if (trimmedServiceKey) return Object.freeze({ kind: 'service_key' as const, key: trimmedServiceKey });
  if (cookieToken) return Object.freeze({ kind: 'cookie' as const, token: cookieToken });
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
 * E10.10b-1 — `X-Magrit-Tenant` REFUSE (pas ignore) sur une session boutique.
 * Le cookie designe une boutique, la boutique un tenant (`shops.tenant_id`) :
 * il n y a rien a choisir. Un en-tete silencieusement sans effet apprend a un
 * appelant qu il peut le poser ; le jour ou une story se tromperait en le
 * lisant, la faille serait deja installee dans les clients (openapi,
 * description de `storefrontSession`).
 */
function assertNoTenantSelectionOnCookieSession(request: Request, credential: ApiCredential): void {
  if (credential.kind !== 'cookie') return;
  const requested = request.headers.get(TENANT_SELECTION_HEADER);
  if (requested !== null && requested.trim().length > 0) {
    throw problem({
      status: 400,
      title: 'Tenant non adressable',
      code: SHARED_PROBLEM_CODES.tenantNotAddressable,
      detail: `${TENANT_SELECTION_HEADER} n a pas d effet sur une session boutique : le tenant est porte par le cookie.`,
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
      `Fournir un Bearer JWT utilisateur, une cle de service ${SERVICE_KEY_HEADER}, ou une session boutique.`,
    );
  }
  assertNoTenantSelectionOnCookieSession(request, credential);

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

/**
 * Verifie que l acteur porte tous les scopes exiges par l operation (CA5).
 *
 * FERME PAR DEFAUT : une cle de service qui atteint une operation sans scope
 * declare est REFUSEE, elle ne passe pas. Le contraire — laisser passer quand
 * la liste est vide — transformait chaque oubli de declaration en ouverture
 * silencieuse de l operation a toutes les cles du tenant.
 *
 * `defineGescomRoute` refuse deja une telle route a la definition ; cette
 * seconde barriere couvre les appelants qui composent le middleware autrement.
 *
 * E10.10b-1 — DOIT sortir tot pour un `ShopCustomerPrincipal` : ce type d
 * acteur n a NI scope de service NI role Magrit (openapi, description de
 * `storefrontSession`). Sans ce garde explicite, il tomberait dans la branche
 * generique ci-dessous (qui suppose un `principal.scopes`) et un refus
 * deviendrait un 403 de PANNE (bug de branchement), pas un 403 de securite
 * voulu — exactement le risque signale par le cadrage de la story.
 */
export function assertScopes(
  principal: ApiPrincipal,
  requiredScopes: readonly ServiceScope[],
): void {
  // Un JWT utilisateur ne porte pas de scope de service : ses droits sont
  // portes par les roles du tenant, verifies par la RLS et le service metier.
  if (principal.kind === 'user') return;
  // Un compte client boutique n a ni scope ni role : `defineGescomRoute`
  // interdit deja qu une route `shop_customer` declare `requiredScopes`, donc
  // `requiredScopes` est toujours vide ici pour ce type d acteur.
  if (principal.kind === 'shop_customer') return;

  if (requiredScopes.length === 0) {
    throw problem({
      status: 403,
      title: 'Operation fermee aux cles de service',
      code: SHARED_PROBLEM_CODES.scopeRequired,
      detail:
        'Cette operation ne declare aucun scope : elle est reservee aux jetons utilisateur.',
    });
  }

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

/**
 * E10.10b-1 — restreint une operation aux comptes client boutique. Utilise
 * par les routes `storefront-quotes-routes.ts` pour retrouver un
 * `ShopCustomerPrincipal` fortement type (et son `sessionToken`) depuis
 * `context.principal`, en defense en profondeur : `createGescomApiHandler`
 * a deja verifie `route.authentication === 'shop_customer'` avant d atteindre
 * le handler, ce garde ne devrait donc jamais se declencher en pratique.
 */
export function assertShopCustomerPrincipal(principal: ApiPrincipal): ShopCustomerPrincipal {
  if (principal.kind !== 'shop_customer') {
    throw problem({
      status: 403,
      title: 'Session boutique requise',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail: 'Cette operation exige une session de compte client boutique.',
    });
  }
  return principal;
}
