/**
 * Resolution du tenant et de l acteur (story E10.0, CA4 et CA5 ; troisieme
 * mode ajoute par E10.10b-1, docs/api/CONVENTIONS.md §8.13 ; regle de
 * precedence des credentials corrigee par E10.10b-1 round 2, §3.6/§8.13ter ;
 * quatrieme mode ajoute par E10.20a, docs/api/CONVENTIONS.md §8.21/§3.6).
 *
 * REGLE OPPOSABLE : le tenant vient TOUJOURS du jeton d authentification. Il
 * n est jamais lu dans un parametre de chemin ni de requete. Une requete qui
 * tente d adresser un tenant par l URL est refusee, pas silencieusement
 * ignoree — sinon la regle se perd des la premiere route pressee.
 *
 * Quatre modes d authentification :
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
 *  - `upload_link` : lien public de depot borne a UNE commande
 *                (`commercial_order_upload_links`, E10.20a), en-tete opaque
 *                `X-Magrit-Upload-Link` (schema de securite `orderUploadLink`).
 *                NI role NI scope, comme `shop_customer` : ce n est pas une
 *                portee concedee, c est une capacite BORNEE A UN OBJET — une
 *                commande, et rien d autre. Le tenant et la commande sont
 *                portes par le jeton lui-meme, jamais par un en-tete de
 *                selection.
 *
 * PRECEDENCE, PAS SYMETRIE DE NON-CUMUL (§3.6) : `Authorization` et
 * `X-Magrit-Service-Key` sont posees EXPLICITEMENT par l appelant ; le cookie
 * storefront est attache PASSIVEMENT par le navigateur a toute requete de
 * l origine (`Path=/`, impose par le prefixe `__Host-`) ; `X-Magrit-Upload-
 * Link` est pose EXPLICITEMENT par l appelant (en pratique la page de depot,
 * qui le lit de son URL) — MAIS, NUANCE CAPITALE (qa-review round 1, B1,
 * BLOQUANT, corrige) : contrairement a `Authorization`/`X-Magrit-Service-
 * Key`, dont le statut de credential EXPLICITE est INCONDITIONNEL (ils
 * gagnent toujours, quelle que soit la route atteinte), l en-tete de lien
 * ne gagne face au cookie QUE sur sa PROPRE operation (`orderUploadLink`).
 * Hors de ce mode, il est IGNORE au sens le plus strict — il ne fait
 * meme pas perdre le cookie, contrairement au comportement initial livre
 * par E10.20a et corrige en qa-review. Motif : E10.20b sert la page de
 * depot sur la surface `storefront`, MEME ORIGINE que la boutique — un
 * acheteur qui porterait une session boutique valide ET, par un hasard de
 * client HTTP partage, cet en-tete, ne doit JAMAIS voir sa session boutique
 * evincee sur une operation qui ne la lui demande pas.
 *
 * Hors des operations `storefrontSession`/`orderUploadLink`, une credential
 * explicite l emporte et le cookie/l en-tete de lien sont IGNORES sans
 * erreur. Sur les operations `storefrontSession`, le cumul avec une
 * credential explicite reste refuse en 400 — la boutique ne pose jamais de
 * Bearer legitimement (`StorefrontRuntimeBoundary` compose son client SANS
 * `accessTokenProvider`). MEME REGIME sur les operations `orderUploadLink` :
 * un `Authorization`/`X-Magrit-Service-Key` present EN MEME TEMPS que
 * `X-Magrit-Upload-Link` est refuse en 400 — la page de depot appelle sans
 * jeton par construction, le cumul ne peut etre que delibere. `Authorization`
 * + `X-Magrit-Service-Key` ensemble restent refuses partout, inchange : ce
 * sont deux identites explicites, pas une passive et une explicite.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import { SERVICE_KEY_HEADER, TENANT_SELECTION_HEADER, UPLOAD_LINK_HEADER } from '../api/contracts.ts';
import {
  readStorefrontSessionCookie,
  storefrontSessionCookiePolicy,
} from '../../../server/storefront/session-cookie.ts';
import {
  authenticationRequired,
  problem,
  scopeRequired,
  SHARED_PROBLEM_CODES,
  uploadLinkInvalid,
} from './problem.ts';

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

/**
 * E10.20a — porteur d un lien public de depot (`commercial_order_upload_
 * links`), borne a UNE commande. NI role NI capability, comme
 * `ShopCustomerPrincipal` : ce n est pas une portee concedee, c est une
 * capacite bornee a un objet.
 */
export type UploadLinkPrincipal = Readonly<{
  kind: 'upload_link';
  linkId: string;
  orderId: string;
  tenantId: TenantId;
  /**
   * Jeton opaque du lien, PORTE PAR LE PRINCIPAL — meme raison que
   * `ShopCustomerPrincipal.sessionToken` : chaque fonction `security definer`
   * qui agit au nom du porteur du lien doit RE-VERIFIER ce jeton elle-meme,
   * jamais faire confiance a `linkId`/`orderId` transmis en clair comme des
   * identifiants deja authentifies.
   */
  token: string;
}>;

/** Acteur authentifie, tenant deja resolu. Aucun code metier ne le reconstruit. */
export type ApiPrincipal = UserPrincipal | ServicePrincipal | ShopCustomerPrincipal | UploadLinkPrincipal;

export type BearerCredential = Readonly<{ kind: 'bearer'; token: string }>;
export type ServiceKeyCredential = Readonly<{ kind: 'service_key'; key: string }>;
/** E10.10b-1 — cookie de session storefront, cf. `storefrontSession` (openapi). */
export type CookieCredential = Readonly<{ kind: 'cookie'; token: string }>;
/** E10.20a — en-tete `X-Magrit-Upload-Link`, cf. `orderUploadLink` (openapi). */
export type UploadLinkCredential = Readonly<{ kind: 'upload_link'; token: string }>;
export type ApiCredential =
  | BearerCredential
  | ServiceKeyCredential
  | CookieCredential
  | UploadLinkCredential;

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
 * Resultat de la lecture des credentials d une requete (§3.6). La LECTURE est
 * independante de la route ; c est le REFUS du cumul explicite+cookie qui est
 * conditionnel a l operation (`storefrontSession` ou non) — decision que
 * seul l appelant (`resolvePrincipal`) peut prendre, cette fonction ne
 * connaissant pas le mode de la route atteinte.
 */
export type CredentialReadOutcome = Readonly<{
  /**
   * Credential retenue pour resoudre l acteur. Une credential explicite
   * (Bearer ou cle de service) l emporte toujours. En son absence :
   * sur une operation `orderUploadLink`, l en-tete de lien l emporte sur le
   * cookie ; sur TOUTE AUTRE operation, l en-tete de lien est IGNORE
   * (§3.6 branche 4 — corrige en qa-review round 1, B1 : il ne doit JAMAIS
   * evincer un cookie de session boutique valide en dehors de son propre
   * mode) et le cookie, s il est present, est retenu. `null` si rien
   * d applicable n est presente.
   */
  credential: ApiCredential | null;
  /**
   * Vrai si un cookie de session storefront etait present EN MEME TEMPS
   * qu une credential explicite, meme si le cookie n a pas ete retenu dans
   * `credential`. Sur une operation `storefrontSession`, ce cumul reste un
   * signal d ambiguite reel (§3.6 branche 2) : `resolvePrincipal` le refuse.
   * Hors de ces operations, c est un non-evenement (§3.6 branche 1) : le
   * cookie est attache passivement par le navigateur, l ignorer ne perd
   * aucune information que l appelant ait voulu transmettre.
   */
  cookiePresentWithExplicit: boolean;
  /**
   * E10.20a — vrai si `X-Magrit-Upload-Link` etait present EN MEME TEMPS
   * qu une credential explicite (Bearer ou cle de service), meme si l en-tete
   * n a pas ete retenu dans `credential`. Sur une operation `orderUploadLink`,
   * ce cumul est un signal d ambiguite reel (§3.6 branche 4) :
   * `resolvePrincipal` le refuse. Hors de ces operations, c est un
   * non-evenement : l en-tete de lien est simplement ignore (et ne doit
   * JAMAIS evincer un cookie de session boutique — qa-review round 1, B1).
   */
  uploadLinkPresentWithExplicit: boolean;
}>;

/**
 * Lit la credential de la requete. `Authorization` + `X-Magrit-Service-Key`
 * ensemble restent refuses ICI, inconditionnellement (§3.6 : deux identites
 * explicites proposees au serveur pour qu il choisisse la plus permissive).
 * Le cookie storefront et l en-tete de lien de depot, eux, ne sont jamais
 * refuses a la lecture : une credential explicite les fait simplement gagner
 * (PRECEDENCE), et cette fonction se contente de signaler le cumul a
 * l appelant — c est lui qui sait si l operation atteinte est
 * `storefrontSession`/`orderUploadLink` et doit donc le refuser.
 *
 * `isUploadLinkOperation` (qa-review round 1, B1 — BLOQUANT, corrige) :
 * CONTRAIREMENT au cookie (toujours candidat, quelle que soit la route),
 * l en-tete de lien n est retenu comme credential QUE si l operation
 * atteinte est `orderUploadLink`. Sur toute AUTRE operation, il est
 * IGNORE — au sens strict : ni retenu, ni evinceur du cookie — et la
 * SELECTION retombe sur le cookie s il est present. Avant ce correctif,
 * l en-tete gagnait INCONDITIONNELLEMENT sur le cookie (meme hors de son
 * propre mode), ce qui evincait a tort la session boutique d un acheteur
 * portant passivement l en-tete (page de depot et boutique sur la MEME
 * origine des E10.20b, cookie ET en-tete alors attaches ensemble a toute
 * requete) et rendait 403 `identity.actor_kind_required` a une session
 * pourtant legitime, au lieu du 400 d ambiguite ou du succes attendu.
 */
export function readCredential(
  request: Request,
  options: Readonly<{ isUploadLinkOperation?: boolean }> = {},
): CredentialReadOutcome {
  const authorization = request.headers.get('authorization');
  const serviceKey = request.headers.get(SERVICE_KEY_HEADER);
  const cookieHeader = request.headers.get('cookie');
  const uploadLinkHeader = request.headers.get(UPLOAD_LINK_HEADER);

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
  const uploadLinkToken =
    uploadLinkHeader && uploadLinkHeader.trim().length > 0 ? uploadLinkHeader.trim() : undefined;

  if (bearer !== undefined && trimmedServiceKey !== undefined) {
    throw problem({
      status: 400,
      title: 'Authentification ambigue',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail: `Fournir un seul jeton explicite a la fois : Bearer utilisateur ou ${SERVICE_KEY_HEADER}, jamais les deux.`,
    });
  }

  const explicit: ApiCredential | undefined =
    bearer !== undefined
      ? Object.freeze({ kind: 'bearer' as const, token: bearer })
      : trimmedServiceKey !== undefined
        ? Object.freeze({ kind: 'service_key' as const, key: trimmedServiceKey })
        : undefined;

  if (explicit !== undefined) {
    return Object.freeze({
      credential: explicit,
      cookiePresentWithExplicit: cookieToken !== undefined,
      uploadLinkPresentWithExplicit: uploadLinkToken !== undefined,
    });
  }

  // E10.20a, qa-review round 1 B1 — l en-tete de lien n est candidat QUE sur
  // sa propre operation. Hors de ce mode, il est totalement IGNORE : la
  // selection retombe sur le cookie (branche suivante) comme s il n avait
  // jamais ete envoye.
  if ((options.isUploadLinkOperation ?? false) && uploadLinkToken !== undefined) {
    return Object.freeze({
      credential: Object.freeze({ kind: 'upload_link' as const, token: uploadLinkToken }),
      cookiePresentWithExplicit: false,
      uploadLinkPresentWithExplicit: false,
    });
  }

  if (cookieToken !== undefined) {
    return Object.freeze({
      credential: Object.freeze({ kind: 'cookie' as const, token: cookieToken }),
      cookiePresentWithExplicit: false,
      uploadLinkPresentWithExplicit: false,
    });
  }

  return Object.freeze({
    credential: null,
    cookiePresentWithExplicit: false,
    uploadLinkPresentWithExplicit: false,
  });
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
 * E10.20a etend la MEME regle au lien de depot (§3.6 branche 4) : le jeton
 * designe un lien, le lien une commande, la commande un tenant — il n y a
 * rien a choisir dans les deux cas. Un en-tete silencieusement sans effet
 * apprend a un appelant qu il peut le poser ; le jour ou une story se
 * tromperait en le lisant, la faille serait deja installee dans les clients
 * (openapi, description de `storefrontSession`/`orderUploadLink`).
 */
function assertNoTenantSelectionOnTenantBearingCredential(
  request: Request,
  credential: ApiCredential,
): void {
  // E10.10b-1 round 2 (§3.6, §8.13ter B1) — `credential` est ici la
  // credential RETENUE par `resolvePrincipal`, jamais une credential ignoree.
  // Depuis la precedence de l explicite sur le passif/le lien, `credential.kind`
  // vaut `'cookie'`/`'upload_link'` UNIQUEMENT quand aucune credential
  // explicite n etait presente : un membre d atelier qui pose legitimement
  // `X-Magrit-Tenant` tout en portant passivement un cookie storefront
  // (Bearer retenu, cookie ignore) ne declenche donc jamais ce refus.
  if (credential.kind !== 'cookie' && credential.kind !== 'upload_link') return;
  const requested = request.headers.get(TENANT_SELECTION_HEADER);
  if (requested !== null && requested.trim().length > 0) {
    const carrier = credential.kind === 'cookie' ? 'le cookie' : 'le lien';
    throw problem({
      status: 400,
      title: 'Tenant non adressable',
      code: SHARED_PROBLEM_CODES.tenantNotAddressable,
      detail: `${TENANT_SELECTION_HEADER} n a pas d effet sur cette credential : le tenant est porte par ${carrier}.`,
    });
  }
}

/**
 * Resout l acteur et son tenant depuis la seule credential de la requete.
 * Leve un Problem 401 quand rien n est fourni ou que la credential est refusee.
 *
 * `isShopCustomerOperation`/`isUploadLinkOperation` portent l information de
 * route necessaire a §3.6 branches 2 et 4 : SEULE une operation
 * `storefrontSession`/`orderUploadLink` refuse le cumul d une credential
 * explicite avec le cookie/l en-tete de lien (400
 * `identity.actor_kind_required`). Hors de ces operations, le cumul est un
 * non-evenement — la credential explicite l emporte, le cookie/le lien sont
 * ignores silencieusement (branche 1).
 *
 * qa-review round 1 (B1, BLOQUANT, corrige) : contrairement au cookie, la
 * SELECTION de l en-tete de lien N EST PAS independante de la route — elle
 * est transmise a `readCredential` (`isUploadLinkOperation`) pour qu il ne
 * soit JAMAIS retenu, ni ne puisse evincer un cookie, hors de son propre
 * mode. Seul le REFUS d ambiguite (cumul avec une credential explicite,
 * ci-dessous) reste, lui, une decision purement locale a `resolvePrincipal`.
 */
export async function resolvePrincipal(
  request: Request,
  verifier: PrincipalVerifier,
  pathParams: Readonly<Record<string, string>> = {},
  options: Readonly<{ isShopCustomerOperation?: boolean; isUploadLinkOperation?: boolean }> = {},
): Promise<ApiPrincipal> {
  assertTenantNotAddressed(new URL(request.url), pathParams);

  const { credential, cookiePresentWithExplicit, uploadLinkPresentWithExplicit } = readCredential(
    request,
    { isUploadLinkOperation: options.isUploadLinkOperation ?? false },
  );

  if ((options.isShopCustomerOperation ?? false) && cookiePresentWithExplicit) {
    throw problem({
      status: 400,
      title: 'Authentification ambigue',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail:
        'Une session boutique ne peut pas etre presentee avec une credential explicite ' +
        `(Bearer ou ${SERVICE_KEY_HEADER}) sur cette operation.`,
    });
  }

  if ((options.isUploadLinkOperation ?? false) && uploadLinkPresentWithExplicit) {
    throw problem({
      status: 400,
      title: 'Authentification ambigue',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail:
        'Un lien de depot ne peut pas etre presente avec une credential explicite ' +
        `(Bearer ou ${SERVICE_KEY_HEADER}) sur cette operation.`,
    });
  }

  if (credential === null) {
    if (options.isUploadLinkOperation ?? false) throw uploadLinkInvalid();
    throw authenticationRequired(
      `Fournir un Bearer JWT utilisateur, une cle de service ${SERVICE_KEY_HEADER}, ou une session boutique.`,
    );
  }
  assertNoTenantSelectionOnTenantBearingCredential(request, credential);

  const principal = await verifier.verify(credential);
  if (principal === null) {
    if (credential.kind === 'upload_link') throw uploadLinkInvalid();
    throw authenticationRequired('Jeton refuse.');
  }
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
 *
 * E10.10b-1 round 2 (B2, §3.6/§8.13ter) — DEFENSE EN PROFONDEUR, troisieme
 * couche du cloisonnement des modes : la sortie pour `shop_customer` n est
 * plus INCONDITIONNELLE. Elle ne sort tot QUE si `requiredScopes` est vide —
 * le seul cas legitime, `defineGescomRoute` interdisant deja qu une route
 * `shop_customer` declare des scopes. Un `requiredScopes` non vide ICI
 * signifierait que la couche 2 (`createGescomApiHandler`, refus d un
 * `ShopCustomerPrincipal` sur toute route `authentication !== 'shop_customer'`)
 * a ete contournee ou n existe plus : cette assertion redevient alors le seul
 * filet, elle doit donc REFUSER explicitement plutot que sortir en silence.
 */
export function assertScopes(
  principal: ApiPrincipal,
  requiredScopes: readonly ServiceScope[],
): void {
  // Un JWT utilisateur ne porte pas de scope de service : ses droits sont
  // portes par les roles du tenant, verifies par la RLS et le service metier.
  if (principal.kind === 'user') return;

  if (principal.kind === 'shop_customer') {
    if (requiredScopes.length === 0) return;
    throw problem({
      status: 403,
      title: 'Session boutique refusee sur cette operation',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail: 'Une session boutique ne porte aucun scope pour satisfaire cette exigence.',
    });
  }

  // E10.20a — meme garde que `shop_customer` ci-dessus, meme motif : un
  // porteur de lien n a NI scope de service NI role Magrit (openapi,
  // description de `orderUploadLink`). `defineGescomRoute` interdit deja
  // qu une route `upload_link` declare des scopes ; un `requiredScopes` non
  // vide ICI signifierait que la couche 2 a ete contournee.
  if (principal.kind === 'upload_link') {
    if (requiredScopes.length === 0) return;
    throw problem({
      status: 403,
      title: 'Lien de depot refuse sur cette operation',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail: 'Un lien de depot ne porte aucun scope pour satisfaire cette exigence.',
    });
  }

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

/**
 * E10.20a — restreint une operation au porteur d un lien de depot. Utilise
 * par les routes `order-upload-links-routes.ts` pour retrouver un
 * `UploadLinkPrincipal` fortement type (et son `token`, RE-VERIFIABLE par
 * chaque fonction `security definer`) depuis `context.principal`, en defense
 * en profondeur : `createGescomApiHandler` a deja verifie
 * `route.authentication === 'upload_link'` avant d atteindre le handler, ce
 * garde ne devrait donc jamais se declencher en pratique.
 */
export function assertUploadLinkPrincipal(principal: ApiPrincipal): UploadLinkPrincipal {
  if (principal.kind !== 'upload_link') {
    throw problem({
      status: 403,
      title: 'Lien de depot requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
      detail: 'Cette operation exige un lien public de depot.',
    });
  }
  return principal;
}
