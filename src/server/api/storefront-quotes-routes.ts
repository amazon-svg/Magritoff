/**
 * Routes HTTP du module Devis du portail client (story E10.10b-1), sur la
 * facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * TROISIEME mode d authentification de la facade : `authentication:
 * 'shop_customer'`, jamais `requiredScopes` (ce type d acteur n a ni scope ni
 * capability — `defineGescomRoute` refuse deja la definition inverse).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 */
import {
  storefrontQuoteDetailSchema,
  storefrontQuoteStatusSchema,
  storefrontQuotesListSchema,
} from '../../modules/storefront-quotes/api/contracts.ts';
import type { StorefrontQuotesService } from '../../modules/storefront-quotes/application/storefront-quotes-service.ts';
import {
  assertShopCustomerPrincipal,
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
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
  ];
}
