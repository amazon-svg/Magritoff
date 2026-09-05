/**
 * Routes HTTP du module Devis commerciaux (stories E10.3, E10.9), sur la
 * facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * Ecriture reservee aux jetons utilisateur (`authentication: 'user'`) :
 * cette story n ouvre aucun scope d ecriture aux cles de service. Lecture
 * ouverte a Studio via `quotes:read` (scope deja declare par E10.0), SAUF le
 * journal d audit des lignes (`listQuoteAuditEntries`) qui reste ferme aux
 * cles de service (contrat, en-tete de l operation) : c est une piece de
 * controle interne, opposee a un commercial, pas une donnee d integration.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 */
import {
  createQuoteFromProjectCommandSchema,
  createQuoteLineCommandSchema,
  deleteQuoteResultSchema,
  quoteDetailSchema,
  quoteLineAuditEntriesListSchema,
  quoteLineSchema,
  quoteSchema,
  quoteStatusSchema,
  quotesListSchema,
  reorderQuoteLinesCommandSchema,
  updateQuoteCommandSchema,
  updateQuoteLineCommandSchema,
  type QuoteDetailDto,
  type QuoteDto,
} from '../../modules/commercial-quotes/api/contracts.ts';
import {
  QuoteAuditAccessDeniedError,
  type CommercialQuotesService,
} from '../../modules/commercial-quotes/application/commercial-quotes-service.ts';
import {
  QuoteCommandRejectedError,
  QuoteDeleteRequiresDraftError,
  QuoteLineInvalidMarginRateError,
  QuoteLineInvalidQuantityError,
  QuoteLineMarginNotDerivableError,
  QuoteLineNotFoundError,
  QuoteLinePositionsMismatchError,
  QuoteLineProjectItemInvalidError,
  QuoteLineQuoteNotDraftError,
  QuoteNotFoundError,
  QuoteProjectNotFoundError,
} from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import {
  assertPrecondition,
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  roleRequired,
  SHARED_PROBLEM_CODES,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createCommercialQuotesRoutes(
  service: CommercialQuotesService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/quotes',
      operationId: 'listQuotes',
      requiredScopes: ['quotes:read'],
      inputSchema: null,
      dataSchema: quotesListSchema,
      async handle(context) {
        const customerIdParam = context.url.searchParams.get('customer_id');
        if (customerIdParam !== null && !uuidSchema.safeParse(customerIdParam).success) {
          throw problem({
            status: 400,
            title: 'Parametre invalide',
            code: SHARED_PROBLEM_CODES.validationFailed,
            detail: 'customer_id doit etre un UUID valide.',
            errors: [{ field: 'customer_id', message: 'UUID invalide.' }],
          });
        }
        const projectIdParam = context.url.searchParams.get('project_id');
        if (projectIdParam !== null && !uuidSchema.safeParse(projectIdParam).success) {
          throw problem({
            status: 400,
            title: 'Parametre invalide',
            code: SHARED_PROBLEM_CODES.validationFailed,
            detail: 'project_id doit etre un UUID valide.',
            errors: [{ field: 'project_id', message: 'UUID invalide.' }],
          });
        }
        const statusParam = context.url.searchParams.get('status');
        const status = quoteStatusSchema.safeParse(statusParam ?? undefined);
        const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;

        const result = await service.list(context.tenantId, {
          customerId: customerIdParam,
          projectId: projectIdParam,
          status: status.success ? status.data : null,
          size: context.page.size,
          cursor,
        });
        const page = buildPage(result.rows, context.page, (row) => ({
          sort: row.created_at,
          id: row.id,
        }));

        return {
          status: 200,
          data: page.items,
          meta: { next_cursor: page.nextCursor, page_size: context.page.size },
        };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/quotes',
      operationId: 'createQuoteFromProject',
      authentication: 'user',
      createsResource: true,
      inputSchema: createQuoteFromProjectCommandSchema,
      dataSchema: quoteDetailSchema,
      async handle(context, input) {
        return withDomainErrors(async () => ({
          status: 201,
          data: await service.createFromProjectItems(context.tenantId, requireUserId(context), input),
        }));
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/quotes/{quoteId}',
      operationId: 'getQuote',
      requiredScopes: ['quotes:read'],
      inputSchema: null,
      dataSchema: quoteDetailSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const detail = await service.getDetail(context.tenantId, context.params['quoteId']!);
          // L ETag porte sur les champs PROPRES au devis (CA9), pas sur ses
          // lignes : meme principe que getProject/updateProject (E10.1).
          // Aucun ETag de ligne n est emis ici (contrat) : c est
          // `getQuoteLine` qui fait foi pour la concurrence d une ligne.
          return { status: 200, data: detail, etag: await computeEntityTag(quoteSummaryOf(detail)) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/quotes/{quoteId}',
      operationId: 'updateQuote',
      authentication: 'user',
      inputSchema: updateQuoteCommandSchema,
      dataSchema: quoteSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const quoteId = context.params['quoteId']!;
          const current = await service.getSummary(context.tenantId, quoteId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, quoteId, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/quotes/{quoteId}',
      operationId: 'deleteQuote',
      authentication: 'user',
      inputSchema: null,
      dataSchema: deleteQuoteResultSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          await service.remove(context.tenantId, context.params['quoteId']!);
          return { status: 200, data: { deleted: true as const } };
        });
      },
    }),

    // -------------------------------------------------------------------------
    // E10.9 — lignes de devis.
    // -------------------------------------------------------------------------

    defineGescomRoute({
      method: 'POST',
      path: '/quotes/{quoteId}/lines',
      operationId: 'addQuoteLine',
      authentication: 'user',
      createsResource: true,
      inputSchema: createQuoteLineCommandSchema,
      dataSchema: quoteLineSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const line = await service.addLine(context.tenantId, context.params['quoteId']!, input);
          return { status: 201, data: line, etag: await computeEntityTag(line) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/quotes/{quoteId}/lines/{lineId}',
      operationId: 'getQuoteLine',
      requiredScopes: ['quotes:read'],
      inputSchema: null,
      dataSchema: quoteLineSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const line = await service.getLine(
            context.tenantId,
            context.params['quoteId']!,
            context.params['lineId']!,
          );
          return { status: 200, data: line, etag: await computeEntityTag(line) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/quotes/{quoteId}/lines/{lineId}',
      operationId: 'updateQuoteLine',
      authentication: 'user',
      inputSchema: updateQuoteLineCommandSchema,
      dataSchema: quoteLineSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const quoteId = context.params['quoteId']!;
          const lineId = context.params['lineId']!;
          const current = await service.getLine(context.tenantId, quoteId, lineId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.updateLine(context.tenantId, quoteId, lineId, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'DELETE',
      path: '/quotes/{quoteId}/lines/{lineId}',
      operationId: 'deleteQuoteLine',
      authentication: 'user',
      inputSchema: null,
      dataSchema: deleteQuoteResultSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          await service.removeLine(
            context.tenantId,
            context.params['quoteId']!,
            context.params['lineId']!,
          );
          return { status: 200, data: { deleted: true as const } };
        });
      },
    }),

    defineGescomRoute({
      method: 'PUT',
      path: '/quotes/{quoteId}/line-positions',
      operationId: 'reorderQuoteLines',
      authentication: 'user',
      inputSchema: reorderQuoteLinesCommandSchema,
      dataSchema: quoteDetailSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const quoteId = context.params['quoteId']!;
          const current = await service.getSummary(context.tenantId, quoteId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.reorderLines(context.tenantId, quoteId, input.line_ids);
          return { status: 200, data: updated, etag: await computeEntityTag(quoteSummaryOf(updated)) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/quotes/{quoteId}/audit-entries',
      operationId: 'listQuoteAuditEntries',
      authentication: 'user',
      inputSchema: null,
      dataSchema: quoteLineAuditEntriesListSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const lineIdParam = context.url.searchParams.get('line_id');
          if (lineIdParam !== null && !uuidSchema.safeParse(lineIdParam).success) {
            throw problem({
              status: 400,
              title: 'Parametre invalide',
              code: SHARED_PROBLEM_CODES.validationFailed,
              detail: 'line_id doit etre un UUID valide.',
              errors: [{ field: 'line_id', message: 'UUID invalide.' }],
            });
          }
          const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;
          const result = await service.listAuditEntries(
            context.tenantId,
            requireUserId(context),
            context.params['quoteId']!,
            { lineId: lineIdParam, size: context.page.size, cursor },
          );
          const page = buildPage(result.rows, context.page, (row) => ({
            sort: row.occurred_at,
            id: row.id,
          }));
          return {
            status: 200,
            data: page.items,
            meta: { next_cursor: page.nextCursor, page_size: context.page.size },
          };
        });
      },
    }),
  ];
}

/**
 * Sous-ensemble d un devis detaille correspondant a la ressource `Quote`
 * (sans `lines`). Utilise UNIQUEMENT pour la base de calcul de l ETag (CA9),
 * meme principe que `projectSummaryOf` (E10.1).
 */
function quoteSummaryOf(detail: QuoteDetailDto): QuoteDto {
  const { lines: _lines, ...summary } = detail;
  return summary;
}

/** L identifiant utilisateur qui cree la ressource (audit `created_by`). */
function requireUserId(context: GescomRequestContext): import('../../kernel/ids/index.ts').UserId {
  if (context.principal.kind !== 'user') {
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
    });
  }
  return context.principal.userId;
}

/** Traduit les erreurs de domaine du module Devis commerciaux en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof QuoteNotFoundError) {
      throw problem({ status: 404, title: 'Devis introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof QuoteLineNotFoundError) {
      throw problem({
        status: 404,
        title: 'Ligne de devis introuvable',
        code: 'quote_line.not_found',
        detail: error.message,
      });
    }
    if (error instanceof QuoteProjectNotFoundError) {
      throw problem({
        status: 404,
        title: 'Projet introuvable',
        code: 'quote.project_not_found',
        detail: error.message,
      });
    }
    if (error instanceof QuoteDeleteRequiresDraftError) {
      throw problem({
        status: 409,
        title: 'Suppression impossible',
        code: 'quote.delete_requires_draft',
        detail: error.message,
      });
    }
    if (error instanceof QuoteLineQuoteNotDraftError) {
      throw problem({
        status: 409,
        title: 'Devis non brouillon',
        code: 'quote_line.quote_not_draft',
        detail: error.message,
      });
    }
    if (error instanceof QuoteLineProjectItemInvalidError) {
      throw problem({
        status: 422,
        title: 'Element de projet invalide',
        code: 'quote_line.project_item_invalid',
        detail: error.message,
      });
    }
    if (error instanceof QuoteLineInvalidQuantityError) {
      throw problem({
        status: 422,
        title: 'Quantite invalide',
        code: 'quote_line.invalid_quantity',
        detail: error.message,
      });
    }
    if (error instanceof QuoteLineMarginNotDerivableError) {
      throw problem({
        status: 422,
        title: 'Marge non derivable',
        code: 'quote_line.margin_not_derivable',
        detail: error.message,
      });
    }
    if (error instanceof QuoteLineInvalidMarginRateError) {
      // qa-review C1 — un taux negatif au point de rendre le prix de vente
      // NEGATIF (ex. -2.0000) : 422, jamais un 500. Distinct de
      // `quote_line.margin_not_derivable` (production_price = 0.00, division
      // indefinie) : ici le calcul est defini, c est son RESULTAT qui sort du
      // domaine representable.
      throw problem({
        status: 422,
        title: 'Taux de marge invalide',
        code: 'quote_line.invalid_margin_rate',
        detail: error.message,
      });
    }
    if (error instanceof QuoteLinePositionsMismatchError) {
      throw problem({
        status: 422,
        title: 'Reordonnancement invalide',
        code: 'quote_line.positions_mismatch',
        detail: error.message,
      });
    }
    if (error instanceof QuoteAuditAccessDeniedError) {
      // E10.11 — meme code deja publie en v1 (§3.5, regle 3 de docs/api/
      // CONVENTIONS.md), etabli desormais par `can_manage_pricing` plutot
      // que par la garde grossiere « role admin » d E10.9.
      throw roleRequired(['can_manage_pricing']);
    }
    if (error instanceof QuoteCommandRejectedError) {
      // `permission_denied`/`authentication_required` : defense en profondeur
      // de la fonction Postgres (RLS-equivalent, verifie a nouveau ce que
      // `authentication: 'user'` a deja verifie cote facade). Jamais atteint
      // en usage normal ; 403 est la reponse correcte si ca l etait.
      const isAuthorizationIssue =
        error.code === 'quote.permission_denied' || error.code === 'quote.authentication_required';
      throw problem({
        status: isAuthorizationIssue ? 403 : 422,
        title: isAuthorizationIssue ? 'Acces refuse' : 'Commande refusee',
        code: error.code,
        detail: error.message,
        ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
      });
    }
    throw error;
  }
}
