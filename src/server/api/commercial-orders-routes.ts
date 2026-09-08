/**
 * Routes HTTP du module Commandes de gestion commerciale (story E10.12), sur
 * la facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * `convertQuote` vit ici : le chemin `/quotes/{quoteId}/conversions` porte le
 * segment `quotes`, mais l operation CREE et REND une ressource
 * `CommercialOrder`, pas un `Quote` (voir `../../modules/commercial-orders/
 * api/contracts.ts`). Ecriture reservee aux jetons utilisateur
 * (`authentication: 'user'`), SANS aucune garde de capability — decision #9
 * du contrat (arbitrage Arnaud, 2026-09-08, docs/api/CONVENTIONS.md §8.14,
 * reserve (b) close) : tout membre du tenant peut valider. Lecture
 * (`listCommercialOrders`/`getCommercialOrder`) ouverte a Studio via le
 * scope `orders:read` (deja publie par le socle E10.0, jamais consomme
 * jusqu ici).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import {
  commercialOrderDetailSchema,
  commercialOrdersListSchema,
  commercialOrderStatusSchema,
} from '../../modules/commercial-orders/api/contracts.ts';
import type { CommercialOrdersService } from '../../modules/commercial-orders/application/commercial-orders-service.ts';
import {
  CommercialOrderNotFoundError,
  QuoteConversionForbiddenStatusError,
} from '../../modules/commercial-orders/application/commercial-orders-repository.ts';
import type { CommercialQuotesService } from '../../modules/commercial-quotes/application/commercial-quotes-service.ts';
import { QuoteNotFoundError } from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import {
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  SHARED_PROBLEM_CODES,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createCommercialOrdersRoutes(
  orders: CommercialOrdersService,
  quotes: CommercialQuotesService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'POST',
      path: '/quotes/{quoteId}/conversions',
      operationId: 'convertQuote',
      authentication: 'user',
      createsResource: true,
      // `ConvertQuoteCommand` est un objet FERME sans propriete — pas de
      // corps a valider (contrat, `requestBody.required: false`). Meme choix
      // que `duplicateQuote` (`inputSchema: null`) : aucun champ a lire, le
      // corps n est meme pas parcouru.
      inputSchema: null,
      dataSchema: commercialOrderDetailSchema,
      async handle(context) {
        const quoteId = context.params['quoteId']!;
        // Aucune lecture prealable ici (qa-review round 1, B2) : le 404
        // "devis introuvable" est deja garanti AVANT toute ecriture par
        // `CommercialOrdersService.convert()`, qui lit le devis
        // (`quotes.getSummary`) avant de deleguer a la transition SQL. Une
        // lecture DUPLIQUEE ici, faite avant la tentative, pouvait devenir
        // perimee si le devis changeait d etat PENDANT la course meme que le
        // contrat expose (ex. une conversion concurrente vient de reussir
        // entre cette lecture et l echec de celle-ci) — `current_state`
        // rendu au client aurait alors pu contredire le message d erreur
        // (§8.14, prouve en execution par qa-review). `current_state` est
        // desormais relu SEULEMENT en cas d echec, dans la branche 409 de
        // `withCommercialOrderErrors`.
        return withCommercialOrderErrors(
          async () => {
            const order = await orders.convert(context.tenantId, requireUserId(context), quoteId);
            return { status: 201, data: order, etag: await computeEntityTag(order) };
          },
          () => quotes.getSummary(context.tenantId, quoteId),
        );
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/commercial-orders',
      operationId: 'listCommercialOrders',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: commercialOrdersListSchema,
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
        const quoteIdParam = context.url.searchParams.get('quote_id');
        if (quoteIdParam !== null && !uuidSchema.safeParse(quoteIdParam).success) {
          throw problem({
            status: 400,
            title: 'Parametre invalide',
            code: SHARED_PROBLEM_CODES.validationFailed,
            detail: 'quote_id doit etre un UUID valide.',
            errors: [{ field: 'quote_id', message: 'UUID invalide.' }],
          });
        }
        const statusParam = context.url.searchParams.get('status');
        const status = commercialOrderStatusSchema.safeParse(statusParam ?? undefined);
        const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;

        const result = await orders.list(context.tenantId, {
          customerId: customerIdParam,
          quoteId: quoteIdParam,
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
      method: 'GET',
      path: '/commercial-orders/{orderId}',
      operationId: 'getCommercialOrder',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: commercialOrderDetailSchema,
      async handle(context) {
        return withCommercialOrderErrors(async () => {
          const detail = await orders.getDetail(context.tenantId, context.params['orderId']!);
          return { status: 200, data: detail, etag: await computeEntityTag(detail) };
        });
      },
    }),
  ];
}

/** L identifiant utilisateur qui valide la conversion (audit `created_by`). */
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

/**
 * Traduit les erreurs de domaine du module Commandes en Problem RFC 7807.
 * `getCurrentState` (optionnel) fournit `current_state` (contrat,
 * `quote.conversion_forbidden_status`) — RELU par le CALLER, APRES l echec de
 * la tentative de conversion (qa-review round 1, B2), jamais reutilise a
 * partir d une lecture faite avant la tentative : ce serait exactement la
 * meme fenetre de peremption que celle corrigee cote SQL (B1).
 */
async function withCommercialOrderErrors<T>(
  operation: () => Promise<T>,
  getCurrentState?: () => Promise<Readonly<Record<string, unknown>>>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof QuoteNotFoundError) {
      throw problem({ status: 404, title: 'Devis introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof CommercialOrderNotFoundError) {
      throw problem({ status: 404, title: 'Commande introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof QuoteConversionForbiddenStatusError) {
      const currentState = await readCurrentStateSafely(getCurrentState);
      throw problem({
        status: 409,
        title: 'Conversion impossible',
        code: 'quote.conversion_forbidden_status',
        detail: error.message,
        ...(currentState ? { currentState } : {}),
      });
    }
    throw error;
  }
}

/**
 * Relit l etat du devis pour `current_state`, APRES l echec, jamais avant
 * (B2). Si cette relecture echoue a son tour (cas pathologique — le devis a
 * disparu entre la conversion refusee et cette relecture), `current_state`
 * est simplement omis plutot que de masquer le 409 d origine sous une autre
 * erreur.
 */
async function readCurrentStateSafely(
  getCurrentState?: () => Promise<Readonly<Record<string, unknown>>>,
): Promise<Readonly<Record<string, unknown>> | undefined> {
  if (!getCurrentState) return undefined;
  try {
    return await getCurrentState();
  } catch {
    return undefined;
  }
}
