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

/**
 * qa-review round 1 — recette (11) : chaque refus, et chaque panne du
 * limiteur, doit se journaliser. C'EST LE SEUL PORT DE JOURNALISATION de ce
 * lot (celui déjà posé pour `client_ip_missing`/`ip_hmac_secret_missing`),
 * élargi plutôt que doublé — la façade historique n'a pas d'autre
 * mécanisme de journal structuré pour un refus INTENTIONNEL (429/503) :
 * `onUnexpectedError` (`api-v1-handler.ts`) ne sert qu'aux erreurs NON
 * gérées (500), jamais atteint ici puisque `ApiHttpError` est rattrapée
 * avant lui.
 *
 * qa-review round 2 — CORRECTIF : `key` a été RETIRÉ de l'événement
 * `refused`. Le cadrage l'interdit deux fois (§8.25 (11) « jamais une IP ni
 * son empreinte » ; point 2.4 « ni l'IP ni son empreinte ne figurent au
 * journal ») — pour un visiteur anonyme, `key` VAUT `ip:<hmac>`, l'empreinte
 * de son IP ; pour un visiteur avec session boutique, `key` vaut
 * `account:<uuid>`, un identifiant en clair. Aucun des deux n'est autorisé
 * au journal. Seul le point (4) autorise une trace : « les membres [sont]
 * traçables au journal par `user_id` ». D'où `userId`, optionnel, rempli
 * UNIQUEMENT quand `callerKind` vaut `'member'` — jamais d'IP, jamais
 * d'empreinte, jamais de `account:`, jamais de clé partagée.
 */
export type ClariprintRateLimitLogEvent =
  | Readonly<{ event: 'client_ip_missing' }>
  | Readonly<{ event: 'ip_hmac_secret_missing' }>
  | Readonly<{
      event: 'refused';
      requestId: string;
      /** L1 (`visitor`), L3 (`public`) ou l'étage atelier (`member`). */
      scope: 'visitor' | 'member' | 'public';
      callerKind: 'visitor' | 'member';
      /** Rempli UNIQUEMENT si `callerKind === 'member'` (point 2.3bis (4)). */
      userId?: string;
    }>
  | Readonly<{ event: 'unavailable'; requestId: string; reason: string }>;

/** Préfixe posé par `resolveClariprintQuoteCaller` sur la clé d'un membre (`user:<id>`). */
const MEMBER_KEY_PREFIX = 'user:';

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
  onRateLimitEvent: (event: ClariprintRateLimitLogEvent) => void;
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
        // Capturée pour le journal du `catch` (qa-review recette 11) : un
        // refus doit journaliser QUI a été refusé (portée + type d'appelant
        // + clé déjà hachée), pas seulement le fait du refus.
        let caller: ClariprintQuoteCaller | undefined;
        try {
          caller = await resolveClariprintQuoteCaller(context, callerDependencies);
          return { status: 200, body: await service.quote(command, caller) };
        } catch (error) {
          if (error instanceof ClariprintQuoteRateLimitedError) {
            if (caller) {
              callerDependencies.onRateLimitEvent({
                event: 'refused',
                requestId: context.requestId,
                scope: error.refusedScope,
                callerKind: caller.kind,
                // qa-review round 2 : JAMAIS l IP, son empreinte, ni le
                // compte boutique — seul le membre est tracable, par
                // user_id (point 2.3bis (4)).
                ...(caller.kind === 'member' && caller.key.startsWith(MEMBER_KEY_PREFIX)
                  ? { userId: caller.key.slice(MEMBER_KEY_PREFIX.length) }
                  : {}),
              });
            }
            throw toRateLimitHttpError(error);
          }
          if (error instanceof ClariprintQuoteBudgetUnavailableError) {
            // qa-review round 1 — recette (11) : AVANT ce correctif, cette
            // cause était avalée (503 rendu, aucune ligne de journal). Sans
            // elle, un déploiement de `magrit-api` AVANT la migration
            // refuserait tous les chiffrages sans qu'aucun journal ne le
            // montre.
            callerDependencies.onRateLimitEvent({
              event: 'unavailable',
              requestId: context.requestId,
              reason: error.message,
            });
            throw budgetUnavailableHttpError();
          }
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
    deps.onRateLimitEvent({ event: 'client_ip_missing' });
    return { kind: 'visitor', key: 'shared' };
  }

  if (!deps.ipHmacSecret) {
    deps.onRateLimitEvent({ event: 'ip_hmac_secret_missing' });
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
