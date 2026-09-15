import { clariprintQuoteCommandSchema, clariprintQuoteResultSchema } from '../../modules/clariprint/api/contracts.ts';
import {
  ClariprintQuoteBudgetUnavailableError,
  ClariprintQuoteRateLimitedError,
  type ClariprintQuoteCaller,
} from '../../modules/clariprint/application/clariprint-quote-budget.ts';
import { hmacSha256Hex, normalizeIpForRateLimit, resolveClientIp } from '../../modules/clariprint/application/clariprint-quote-rate-limit.ts';
import type { ClariprintService } from '../../modules/clariprint/application/clariprint-service.ts';
import type { StorefrontSessionService } from '../../modules/shop-customers/application/storefront-session-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { readStorefrontSessionCookie, type StorefrontSessionCookiePolicy } from '../storefront/session-cookie.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

/**
 * En-tête retenu SEUL pour l'IP du visiteur (docs/api/CONVENTIONS.md §8.25
 * point 2.3bis (5), mesure du 2026-09-15) : JAMAIS `x-forwarded-for` (à
 * aucune position), ni `true-client-ip`, `x-client-ip`, `forwarded`,
 * `x-real-ip`, ni `remoteAddr`.
 */
const CLIENT_IP_HEADER = 'cf-connecting-ip';

export type ClariprintRateLimitEvent = 'client_ip_missing' | 'ip_hmac_secret_missing';

export type ClariprintQuoteCallerDependencies = Readonly<{
  /**
   * Membre = jeton résolu en acteur `user` ET appartenance à au moins un
   * espace, lue par `current_user_tenant_ids()` (point 2.3bis (4)) : la
   * route et la base ne peuvent pas être en désaccord. Une erreur ICI
   * (base injoignable) doit être un échec FERMÉ — l'implémentation la lève
   * en `ClariprintQuoteBudgetUnavailableError`, jamais avalée en "visiteur".
   */
  isMember: (userId: string) => Promise<boolean>;
  storefrontSessions?: StorefrontSessionService;
  storefrontCookiePolicy?: StorefrontSessionCookiePolicy;
  /**
   * Secret d'Edge Function `MAGRIT_RATE_LIMIT_IP_HMAC_SECRET` — PAS un
   * secret Vault (point (3)). Absent : échec FERMÉ pour les visiteurs
   * anonymes, clé partagée, jamais l'IP en clair.
   */
  ipHmacSecret: string | null;
  onRateLimitEvent: (event: ClariprintRateLimitEvent) => void;
}>;

export function createClariprintRoutes(
  service: ClariprintService,
  callerDependencies: ClariprintQuoteCallerDependencies,
): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/clariprint/quote`,
      authentication: 'public',
      inputSchema: clariprintQuoteCommandSchema,
      outputSchema: clariprintQuoteResultSchema,
      async handle(context, command) {
        try {
          const caller = await resolveClariprintQuoteCaller(context, callerDependencies);
          return { status: 200, body: await service.quote(command, caller) };
        } catch (error) {
          if (error instanceof ClariprintQuoteRateLimitedError) throw toRateLimitHttpError(error);
          if (error instanceof ClariprintQuoteBudgetUnavailableError) throw budgetUnavailableHttpError();
          throw error;
        }
      },
    }),
  ];
}

/**
 * L'appelant (membre ou visiteur, avec sa clé) est établi ICI, par la
 * route — docs/api/CONVENTIONS.md §8.25 point 2.3bis (8). Ordre de
 * résolution, opposable (points (3) et (4)) :
 *   1. jeton résolu en acteur `user` ET appartenance à au moins un espace
 *      -> membre, clé = l'utilisateur ;
 *   2. sinon, session boutique valide (cookie) -> visiteur, clé = le compte ;
 *   3. sinon, `cf-connecting-ip` seul, normalisée puis HMAC -> visiteur,
 *      clé = l'IP ;
 *   4. sinon (en-tête absent/vide/multiple, OU secret absent) -> visiteur,
 *      clé PARTAGÉE ('shared'), un événement est journalisé.
 * Un jeton présent mais non résolu en membre (pas d'espace) n'est JAMAIS
 * exempté : il retombe au visiteur, comme un jeton absent.
 */
async function resolveClariprintQuoteCaller(
  context: ApiRequestContext,
  deps: ClariprintQuoteCallerDependencies,
): Promise<ClariprintQuoteCaller> {
  if (context.actor?.kind === 'user') {
    const member = await deps.isMember(context.actor.userId);
    if (member) return { kind: 'member', key: `user:${context.actor.userId}` };
  }

  if (deps.storefrontSessions && deps.storefrontCookiePolicy) {
    const token = readStorefrontSessionCookie(context.request.headers.get('cookie'), deps.storefrontCookiePolicy);
    const session = token ? await deps.storefrontSessions.current(token) : null;
    if (session) return { kind: 'visitor', key: `account:${session.identity.shopCustomerAccountId}` };
  }

  const ipResolution = resolveClientIp(context.request.headers.get(CLIENT_IP_HEADER));
  if (!ipResolution.ok) {
    deps.onRateLimitEvent('client_ip_missing');
    return { kind: 'visitor', key: 'shared' };
  }

  if (!deps.ipHmacSecret) {
    deps.onRateLimitEvent('ip_hmac_secret_missing');
    return { kind: 'visitor', key: 'shared' };
  }

  const hash = await hmacSha256Hex(deps.ipHmacSecret, normalizeIpForRateLimit(ipResolution.ip));
  return { kind: 'visitor', key: `ip:${hash}` };
}

function toRateLimitHttpError(error: ClariprintQuoteRateLimitedError): ApiHttpError {
  if (error.refusedScope === 'public') {
    return new ApiHttpError({
      type: 'about:blank',
      title: 'Plafond public de chiffrage atteint',
      status: 503,
      code: 'clariprint.public_quota_exhausted',
      detail: 'Le plafond quotidien de chiffrages publics est atteint.',
    });
  }
  return new ApiHttpError({
    type: 'about:blank',
    title: 'Trop de chiffrages',
    status: 429,
    code: 'api.rate_limited',
    detail: 'Trop de demandes de chiffrage dans un court intervalle.',
  });
}

function budgetUnavailableHttpError(): ApiHttpError {
  return new ApiHttpError({
    type: 'about:blank',
    title: 'Chiffrage indisponible',
    status: 503,
    code: 'clariprint.unavailable',
    detail: 'Le limiteur de débit est indisponible.',
  });
}
