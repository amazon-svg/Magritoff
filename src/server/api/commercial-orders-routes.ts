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
  changeOrderProductionStepCommandSchema,
  commercialOrderDetailSchema,
  commercialOrdersListSchema,
  commercialOrderSortSchema,
  commercialOrderStatusSchema,
  orderStepChangeSchema,
  orderStepChangesListSchema,
} from '../../modules/commercial-orders/api/contracts.ts';
import type { CommercialOrderSort } from '../../modules/commercial-orders/api/contracts.ts';
import type { CommercialOrdersService } from '../../modules/commercial-orders/application/commercial-orders-service.ts';
import {
  CommercialOrderNotFoundError,
  OrderStepUnchangedError,
  ProductionStepInactiveError,
  QuoteConversionForbiddenStatusError,
} from '../../modules/commercial-orders/application/commercial-orders-repository.ts';
import type { CommercialQuotesService } from '../../modules/commercial-quotes/application/commercial-quotes-service.ts';
import { QuoteNotFoundError } from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import type { ProductionStepsService } from '../../modules/production-steps/application/production-steps-service.ts';
import { ProductionStepNotFoundError } from '../../modules/production-steps/application/production-steps-repository.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import {
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  SHARED_PROBLEM_CODES,
  validationFailed,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

export function createCommercialOrdersRoutes(
  orders: CommercialOrdersService,
  quotes: CommercialQuotesService,
  productionSteps: ProductionStepsService,
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

        // E10.13 CA6 — `current_production_step_id` doit appartenir au tenant
        // du jeton, SINON 422 `production_step.not_found` — jamais une page
        // silencieusement vide, qui laisserait croire a une absence de
        // commandes plutot qu a un identifiant errone (contrat).
        const stepIdParam = context.url.searchParams.get('current_production_step_id');
        if (stepIdParam !== null) {
          if (!uuidSchema.safeParse(stepIdParam).success) {
            throw problem({
              status: 400,
              title: 'Parametre invalide',
              code: SHARED_PROBLEM_CODES.validationFailed,
              detail: 'current_production_step_id doit etre un UUID valide.',
              errors: [{ field: 'current_production_step_id', message: 'UUID invalide.' }],
            });
          }
          if (!(await productionSteps.exists(context.tenantId, stepIdParam))) {
            throw problem({
              status: 422,
              title: 'Étape de production introuvable',
              code: 'production_step.not_found',
              detail: 'current_production_step_id ne correspond a aucune etape de ce tenant.',
            });
          }
        }

        const sort = parseSort(context.url.searchParams.get('sort'));
        const cursor = context.page.cursor ? decodeOrderCursor(context.page.cursor, sort) : null;

        const result = await orders.list(context.tenantId, {
          customerId: customerIdParam,
          quoteId: quoteIdParam,
          status: status.success ? status.data : null,
          currentProductionStepId: stepIdParam,
          sort,
          size: context.page.size,
          cursor,
        });
        const page = buildPage(result.rows, context.page, (row) => ({
          sort: encodeOrderCursorToken(sort, row),
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

    // ── E10.14 — journal des changements d etape, GET + POST sur la MEME
    // ressource (contrat, decision #1 : le POST y CREE l entree, le GET LIT
    // la suite). Colonne gauche de la modale unique (historique) / colonne
    // droite (etapes du tenant, servie par listProductionSteps, deja montee).
    defineGescomRoute({
      method: 'GET',
      path: '/commercial-orders/{orderId}/step-changes',
      operationId: 'listOrderStepChanges',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: orderStepChangesListSchema,
      async handle(context) {
        return withCommercialOrderErrors(async () => {
          const orderId = context.params['orderId']!;
          const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;
          const result = await orders.listStepChanges(context.tenantId, orderId, {
            size: context.page.size,
            cursor,
          });
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

    defineGescomRoute({
      method: 'POST',
      path: '/commercial-orders/{orderId}/step-changes',
      operationId: 'changeOrderProductionStep',
      requiredScopes: ['orders:write'],
      createsResource: true,
      inputSchema: changeOrderProductionStepCommandSchema,
      dataSchema: orderStepChangeSchema,
      async handle(context, input) {
        const orderId = context.params['orderId']!;
        // Auteur resolu du PRINCIPAL, jamais du corps (contrat,
        // `ChangeOrderProductionStepCommand` n a aucun champ d auteur).
        // `null` pour un jeton utilisateur (la fonction SQL resout l e-mail
        // elle-meme depuis `auth.uid()`) ; `module:<serviceId>` pour une cle
        // de service (decision #10 / #12, premiere ecriture E10 joignable
        // par cle de service, arbitrage Arnaud 2026-09-09).
        const serviceActorLabel = context.principal.kind === 'service' ? `module:${context.principal.serviceId}` : null;
        const actor = context.principal.kind === 'user' ? context.principal.userId : null;
        return withCommercialOrderErrors(
          async () => {
            const entry = await orders.changeProductionStep(context.tenantId, orderId, actor, input, serviceActorLabel);
            // AUCUN ETag ici (contrat) : celui de la commande vient de
            // s invalider, un appelant qui le detient encore doit relire
            // getCommercialOrder avant tout PATCH futur.
            return { status: 201, data: entry };
          },
          // `current_state` sur 409 `order.step_unchanged` — RELU APRES
          // l echec, jamais avant (meme discipline B2 qu E10.12).
          async () => {
            const order = await orders.getSummary(context.tenantId, orderId);
            return { current_production_step_id: order.current_production_step_id };
          },
        );
      },
    }),
  ];
}

/** Defaut `-created_at` : ordre servi avant E10.13, ajouter `sort` ne change donc le comportement d aucun appelant existant. */
function parseSort(raw: string | null): CommercialOrderSort {
  const parsed = commercialOrderSortSchema.safeParse(raw ?? '-created_at');
  if (!parsed.success) {
    throw validationFailed([
      { field: 'sort', message: 'Valeurs attendues : -created_at, created_at, production_step, -production_step.' },
    ]);
  }
  return parsed.data;
}

/**
 * Encode le curseur opaque avec le TOKEN DE TRI en tete (`decodeOrderCursor`
 * verifie qu un curseur repris porte le MEME `sort` que la requete courante,
 * meme regle que `listPriceRules`) suivi de la valeur de positionnement :
 * `created_at` ISO pour `-created_at`/`created_at`, ou
 * `${current_production_step_id ?? ''}|${created_at}` pour
 * `production_step`/`-production_step` — DECODE PAR L ADAPTATEUR
 * (`SupabaseCommercialOrdersRepository.listByProductionStep`), jamais ici :
 * cette route reste agnostique du mecanisme de lecture choisi pour ce tri.
 */
function encodeOrderCursorToken(
  sort: CommercialOrderSort,
  row: Readonly<{ created_at: string; current_production_step_id: string | null }>,
): string {
  if (sort === 'production_step' || sort === '-production_step') {
    return `${sort}|${row.current_production_step_id ?? ''}|${row.created_at}`;
  }
  return `${sort}|${row.created_at}`;
}

function decodeOrderCursor(
  raw: string,
  requestedSort: CommercialOrderSort,
): Readonly<{ sort: string; id: string }> {
  const decoded = decodeCursor(raw);
  const separator = decoded.sort.indexOf('|');
  if (separator === -1) {
    throw validationFailed([{ field: 'page[cursor]', message: 'Curseur illisible pour ce tri.' }]);
  }
  const cursorSort = decoded.sort.slice(0, separator);
  if (cursorSort !== requestedSort) {
    throw validationFailed([
      {
        field: 'page[cursor]',
        message: 'Le tri demande ne correspond pas a celui encode dans ce curseur. Reprendre le meme sort.',
      },
    ]);
  }
  return { sort: decoded.sort.slice(separator + 1), id: decoded.id };
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
    // E10.14 — decision #7 du contrat : reposer l etape courante est un
    // REFUS, pas un succes silencieux. `current_state` releve APRES l echec
    // (meme discipline B2), jamais avant.
    if (error instanceof OrderStepUnchangedError) {
      const currentState = await readCurrentStateSafely(getCurrentState);
      throw problem({
        status: 409,
        title: 'Étape déjà atteinte',
        code: 'order.step_unchanged',
        detail: error.message,
        ...(currentState ? { currentState } : {}),
      });
    }
    // E10.14 — decision #8 : code NEUF, distinct de production_step.not_found
    // (E10.13, branche generique ci-dessous via CommercialOrderNotFoundError/
    // ProductionStepNotFoundError).
    if (error instanceof ProductionStepInactiveError) {
      throw problem({
        status: 422,
        title: 'Étape de production désactivée',
        code: 'production_step.inactive',
        detail: error.message,
      });
    }
    if (error instanceof ProductionStepNotFoundError) {
      throw problem({
        status: 422,
        title: 'Étape de production introuvable',
        code: 'production_step.not_found',
        detail: error.message,
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
