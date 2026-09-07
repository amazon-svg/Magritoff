/**
 * Routes HTTP du module Devis du portail client (stories E10.10b-1,
 * E10.10b-2), sur la facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * TROISIEME mode d authentification de la facade : `authentication:
 * 'shop_customer'`, jamais `requiredScopes` (ce type d acteur n a ni scope ni
 * capability — `defineGescomRoute` refuse deja la definition inverse).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 */
import {
  storefrontQuoteDecisionCommandSchema,
  storefrontQuoteDetailSchema,
  storefrontQuoteStatusSchema,
  storefrontQuotesListSchema,
} from '../../modules/storefront-quotes/api/contracts.ts';
import {
  StorefrontQuoteDecisionExpiredError,
  StorefrontQuoteDecisionForbiddenDelegatedError,
  StorefrontQuoteDecisionForbiddenStatusError,
} from '../../modules/storefront-quotes/application/storefront-quotes-repository.ts';
import type { StorefrontQuotesService } from '../../modules/storefront-quotes/application/storefront-quotes-service.ts';
import {
  assertPrecondition,
  assertShopCustomerPrincipal,
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  readIfMatch,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute } from './gescom-middleware.ts';

export function createStorefrontQuotesRoutes(
  service: StorefrontQuotesService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/storefront-quotes',
      operationId: 'listStorefrontQuotes',
      authentication: 'shop_customer',
      inputSchema: null,
      dataSchema: storefrontQuotesListSchema,
      async handle(context) {
        const principal = assertShopCustomerPrincipal(context.principal);

        // Meme permissivite que listQuotes (commercial-quotes-routes.ts) :
        // une valeur hors enumeration (notamment 'draft', qui n existe pas de
        // ce cote de la facade) est traitee comme « pas de filtre », pas comme
        // une erreur — la fonction SQL applique de toute facon sa propre
        // seconde ligne de defense (statuts autorises en dur).
        const statusParam = context.url.searchParams.get('status');
        const status = storefrontQuoteStatusSchema.safeParse(statusParam ?? undefined);

        const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;

        const rows = await service.list(principal.sessionToken, {
          status: status.success ? status.data : null,
          limit: context.page.size + 1,
          cursor,
        });
        const page = buildPage(rows, context.page, (row) => ({ sort: row.issued_at, id: row.id }));

        return {
          status: 200,
          data: page.items,
          meta: { next_cursor: page.nextCursor, page_size: context.page.size },
        };
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/storefront-quotes/{quoteId}',
      operationId: 'getStorefrontQuote',
      authentication: 'shop_customer',
      inputSchema: null,
      dataSchema: storefrontQuoteDetailSchema,
      async handle(context) {
        const principal = assertShopCustomerPrincipal(context.principal);

        const detail = await service.getDetail(principal.sessionToken, context.params['quoteId']!);
        // 404 INDISCERNABLE (contrat) : identifiant inconnu, devis d un autre
        // client, devis d un autre espace, devis encore draft rendent tous le
        // meme `null` depuis la fonction SQL, traduit ici en LA MEME reponse,
        // sans jamais distinguer laquelle des quatre causes s est produite.
        if (detail === null) {
          throw problem({ status: 404, title: 'Devis introuvable', code: 'quote.not_found' });
        }

        return { status: 200, data: detail, etag: await computeEntityTag(detail) };
      },
    }),

    // -------------------------------------------------------------------------
    // E10.10b-2 — decision du client. PREMIERE ecriture de la facade servie a
    // un acteur qui n est PAS membre du tenant.
    // -------------------------------------------------------------------------
    defineGescomRoute({
      method: 'POST',
      path: '/storefront-quotes/{quoteId}/decisions',
      operationId: 'decideStorefrontQuote',
      authentication: 'shop_customer',
      createsResource: true,
      inputSchema: storefrontQuoteDecisionCommandSchema,
      dataSchema: storefrontQuoteDetailSchema,
      async handle(context, input) {
        const principal = assertShopCustomerPrincipal(context.principal);
        const quoteId = context.params['quoteId']!;

        // ORDRE DES REFUS, normatif (contrat, decision #3) : 404 (invisible)
        // -> 403 (session deleguee) -> 409 (statut) -> 409 (peremption) ->
        // 428/400/409 (precondition, EN DERNIER — inverse de sendQuote,
        // parce que les refus 2 a 4 portent sur l etat courant et ne se
        // rattrapent PAS par une relecture, alors qu api.resource_conflict
        // invite precisement a relire puis rejouer).
        const current = await service.getDetail(principal.sessionToken, quoteId);
        if (current === null) {
          throw problem({ status: 404, title: 'Devis introuvable', code: 'quote.not_found' });
        }

        if (principal.sessionKind === 'delegated') {
          throw problem({
            status: 403,
            title: 'Session deleguee refusee',
            code: 'quote.decision_forbidden_delegated',
            detail: "Une session deleguee ne peut ni accepter ni refuser un devis.",
          });
        }

        if (current.status !== 'sent') {
          throw problem({
            status: 409,
            title: 'Decision impossible',
            code: 'quote.decision_forbidden_status',
            detail: "Seul un devis 'sent' peut etre accepte ou refuse.",
            currentState: current,
          });
        }

        if (current.expired) {
          throw problem({
            status: 409,
            title: 'Devis perime',
            code: 'quote.decision_expired',
            detail: 'La date de validite de ce devis est depassee.',
            currentState: current,
          });
        }

        // Precondition EN DERNIER (voir plus haut). Porte sur l ETag de
        // `getStorefrontQuote`, publie par E10.10b-1 en prevision de cette
        // operation exacte.
        const ifMatch = readIfMatch(context.request, true);
        assertPrecondition(ifMatch, await computeEntityTag(current), current);

        const decided = await withDecisionDomainErrors(
          () => service.decide(context.tenantId, principal.sessionToken, quoteId, input.decision),
          current,
        );
        if (decided === null) {
          // Course tres improbable entre la lecture ci-dessus et l ecriture
          // atomique (session revoquee entre-temps, par exemple) : meme 404
          // indiscernable que le reste de la facade, jamais un code distinct
          // qui apprendrait quoi que ce soit sur ce qui a change.
          throw problem({ status: 404, title: 'Devis introuvable', code: 'quote.not_found' });
        }

        return { status: 201, data: decided, etag: await computeEntityTag(decided) };
      },
    }),
  ];
}

/**
 * Traduit les erreurs de domaine de `StorefrontQuotesService.decide()` en
 * Problem RFC 7807. `currentState` est celui LU par la route avant l appel
 * (`current`) : dans le cas nominal ces erreurs ne se produisent pas ici (la
 * route les a deja ecartees plus haut) — cette traduction ne couvre que la
 * course, rarissime, ou l etat aurait change ENTRE cette lecture et l ecriture
 * atomique en base.
 */
async function withDecisionDomainErrors<T>(
  operation: () => Promise<T>,
  currentState: Readonly<Record<string, unknown>>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StorefrontQuoteDecisionForbiddenDelegatedError) {
      throw problem({
        status: 403,
        title: 'Session deleguee refusee',
        code: 'quote.decision_forbidden_delegated',
        detail: error.message,
      });
    }
    if (error instanceof StorefrontQuoteDecisionForbiddenStatusError) {
      throw problem({
        status: 409,
        title: 'Decision impossible',
        code: 'quote.decision_forbidden_status',
        detail: error.message,
        currentState,
      });
    }
    if (error instanceof StorefrontQuoteDecisionExpiredError) {
      throw problem({
        status: 409,
        title: 'Devis perime',
        code: 'quote.decision_expired',
        detail: error.message,
        currentState,
      });
    }
    throw error;
  }
}
