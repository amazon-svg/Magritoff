/**
 * Routes HTTP du module Document PDF de devis (story E10.10b-4c), sur la
 * facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * AUCUNE GENERATION ICI (contrat §8.18 §5, "Aucune operation publique de
 * generation") : ces deux operations ne RENDENT qu une piece deja produite
 * par `sendQuote` (module `commercial-quotes`), ou 404.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 */
import { quoteDocumentSchema } from '../../modules/quote-documents/api/contracts.ts';
import type { QuoteDocumentsService } from '../../modules/quote-documents/application/quote-documents-service.ts';
import { QuoteDocumentNotFoundError } from '../../modules/quote-documents/application/quote-documents-repository.ts';
import { QuoteNotFoundError } from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import type { CommercialQuotesService } from '../../modules/commercial-quotes/application/commercial-quotes-service.ts';
import { assertShopCustomerPrincipal, problem } from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute } from './gescom-middleware.ts';

export function createQuoteDocumentsRoutes(
  quoteDocuments: QuoteDocumentsService,
  commercialQuotes: CommercialQuotesService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/quotes/{quoteId}/documents',
      operationId: 'getQuoteDocument',
      requiredScopes: ['quotes:read'],
      inputSchema: null,
      dataSchema: quoteDocumentSchema,
      async handle(context) {
        const quoteId = context.params['quoteId']!;

        // DEUX codes 404 DISTINCTS (contrat, cote atelier) : le devis
        // n existe pas dans ce tenant (`quote.not_found`), ou il n a pas de
        // document (`quote.document_not_generated`, cas LE PLUS FREQUENT —
        // tout tenant sans gabarit configure, ou tout devis envoye avant
        // E10.10b-4c). Verifier l EXISTENCE du devis d abord evite de rendre
        // `document_not_generated` sur un identifiant qui n a jamais existe.
        try {
          await commercialQuotes.getSummary(context.tenantId, quoteId);
        } catch (error) {
          if (error instanceof QuoteNotFoundError) {
            throw problem({ status: 404, title: 'Devis introuvable', code: 'quote.not_found' });
          }
          throw error;
        }

        try {
          const document = await quoteDocuments.getForQuote(context.tenantId, quoteId);
          return { status: 200, data: document };
        } catch (error) {
          if (error instanceof QuoteDocumentNotFoundError) {
            throw problem({
              status: 404,
              title: 'Aucun document',
              code: 'quote.document_not_generated',
              detail: error.message,
            });
          }
          throw error;
        }
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/storefront-quotes/{quoteId}/documents',
      operationId: 'getStorefrontQuoteDocument',
      authentication: 'shop_customer',
      inputSchema: null,
      dataSchema: quoteDocumentSchema,
      async handle(context) {
        const principal = assertShopCustomerPrincipal(context.principal);
        const document = await quoteDocuments.getForStorefrontSession(
          principal.sessionToken,
          context.params['quoteId']!,
        );
        // 404 INDISCERNABLE sur TOUTES les causes (contrat, b-1 decision 5) :
        // devis inconnu, d un autre client/tenant, encore draft, sans
        // document — un seul et meme code, jamais de distinction.
        if (document === null) {
          throw problem({ status: 404, title: 'Devis introuvable', code: 'quote.not_found' });
        }
        return { status: 200, data: document };
      },
    }),
  ];
}
