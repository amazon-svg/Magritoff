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
// `dateOnlySchema` : meme regle YYYY-MM-DD que `expected_delivery_date`
// (E10.16), definie une seule fois dans commercial-quotes, reprise ici sans
// duplication (meme import direct que fait deja commercial-orders/api/
// contracts.ts pour ce meme schema).
import { dateOnlySchema } from '../../modules/commercial-quotes/api/contracts.ts';
import { endOfDayInReferenceTimeZone, startOfDayInReferenceTimeZone } from '../../kernel/clock/index.ts';
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
import { orderDocumentSchema } from '../../modules/order-documents/api/contracts.ts';
import {
  OrderDocumentAlreadyGeneratedError,
  OrderDocumentGenerationFailedError,
  OrderDocumentNotFoundError,
  OrderDocumentTemplateMissingError,
} from '../../modules/order-documents/application/order-documents-repository.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import {
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  resolveCalendarBoundOrThrow,
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

        // E10.18a — bornes de periode, "la periode a la grille d abord"
        // (docs/api/CONVENTIONS.md §8.24 point 2) : AUCUNE borne au contrat
        // avant ce lot, ajoutees ICI pour que l export (E10.18c+) puisse les
        // reprendre a l identique. `created_from`/`created_to` : jour civil
        // `YYYY-MM-DD` (contrat, `format: date`), ENTENDU dans le fuseau de
        // reference du produit (`Europe/Paris`, `src/kernel/clock`), jamais
        // UTC — la conversion est faite ICI, une seule fois, avant que le
        // service/l adaptateur ne voient quoi que ce soit.
        const { createdAtFrom, createdAtTo } = parseCreatedAtRange(context.url.searchParams);

        const sort = parseSort(context.url.searchParams.get('sort'));
        const cursor = context.page.cursor ? decodeOrderCursor(context.page.cursor, sort) : null;

        const result = await orders.list(context.tenantId, {
          customerId: customerIdParam,
          quoteId: quoteIdParam,
          status: status.success ? status.data : null,
          currentProductionStepId: stepIdParam,
          createdAtFrom,
          createdAtTo,
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

    // ── E10.19b — bon de commande PDF. AUCUNE generation sur le GET (contrat
    // §8.20 §6, "cette operation ne produit rien") ; la production est une
    // ACTION EXPLICITE et REJOUABLE (POST), arbitrage (C2).
    defineGescomRoute({
      method: 'GET',
      path: '/commercial-orders/{orderId}/documents',
      operationId: 'getOrderDocument',
      requiredScopes: ['orders:read'],
      inputSchema: null,
      dataSchema: orderDocumentSchema,
      async handle(context) {
        const orderId = context.params['orderId']!;
        return withCommercialOrderErrors(
          async () => {
            const document = await orders.getDocument(context.tenantId, orderId);
            return { status: 200, data: document };
          },
          undefined,
          'order.not_found',
        );
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/commercial-orders/{orderId}/documents',
      operationId: 'generateOrderDocument',
      // Contrat : `security: [bearerAuth]` SEUL, AUCUNE `serviceKey` —
      // "produire" est le geste d une personne, jamais d un module tiers.
      authentication: 'user',
      createsResource: true,
      inputSchema: null,
      dataSchema: orderDocumentSchema,
      async handle(context) {
        const orderId = context.params['orderId']!;
        return withCommercialOrderErrors(
          async () => {
            const document = await orders.generateDocument(context.tenantId, requireUserId(context), orderId);
            return { status: 201, data: document };
          },
          undefined,
          'order.not_found',
        );
      },
    }),
  ];
}

/**
 * E10.18a — `created_from`/`created_to` de `listCommercialOrders`. Rend des
 * instants UTC DEJA RESOLUS (ou `null`), jamais les chaines `YYYY-MM-DD`
 * brutes : le service et l adaptateur ne connaissent pas le fuseau de
 * reference (`src/kernel/clock`), seule cette route le fait.
 *
 * Trois causes d echec distinctes (qa-review E10.18a round 1, B1 ; corrige
 * en 422 le 2026-09-12 suite a l amendement architecte du contrat) :
 *   - forme illisible (`YYYY-MM-DD` attendu, verifie par `dateOnlySchema`,
 *     regex de FORME seulement) -> 400 `api.validation_failed`, meme parti
 *     que les autres parametres de requete de cette operation (`customer_id`,
 *     `quote_id`, `current_production_step_id`) ;
 *   - forme correcte mais jour INEXISTANT dans le calendrier (`2026-06-31`,
 *     `2026-02-30`, `2026-00-10`, `2026-99-99`...) -> **422**
 *     `api.validation_failed`, PAS 400 : le `pattern` du contrat borne la
 *     forme, jamais le calendrier (`openapi/magrit-core.v1.yaml` ~ligne 4284).
 *     Une regex de forme ne suffit pas : sans controle CALENDRIER,
 *     `startOfDayInReferenceTimeZone`/`endOfDayInReferenceTimeZone`
 *     (`src/kernel/clock/timezone.ts`) acceptaient ces dates et `Date.UTC`
 *     les reportait EN SILENCE sur le mois/l annee suivants
 *     (`created_to=2026-06-31` rendait le 1er juillet 23:59:59.999) — 200 OK
 *     et une periode fausse d un jour, sans erreur. Le controle vit
 *     desormais dans `civilDateToUtc()` (source unique, couvre aussi le
 *     futur export E10.18c) : il leve un `TypeError`, capture ici et traduit
 *     en 422, MEME code/statut que la borne inversee ci-dessous (meme
 *     famille de defaut : une date qui trompe silencieusement une cloture) ;
 *   - `created_from` POSTERIEUR a `created_to` -> 422
 *     `api.validation_failed` (contrat, EXPLICITEMENT ce code et ce statut :
 *     "jamais une page vide qui laisserait croire a une absence de
 *     commandes").
 */
function parseCreatedAtRange(
  searchParams: URLSearchParams,
): Readonly<{ createdAtFrom: string | null; createdAtTo: string | null }> {
  const createdFromParam = searchParams.get('created_from');
  const createdToParam = searchParams.get('created_to');

  if (createdFromParam !== null && !dateOnlySchema.safeParse(createdFromParam).success) {
    throw problem({
      status: 400,
      title: 'Parametre invalide',
      code: SHARED_PROBLEM_CODES.validationFailed,
      detail: 'created_from doit etre une date YYYY-MM-DD.',
      errors: [{ field: 'created_from', message: 'Date invalide.' }],
    });
  }
  if (createdToParam !== null && !dateOnlySchema.safeParse(createdToParam).success) {
    throw problem({
      status: 400,
      title: 'Parametre invalide',
      code: SHARED_PROBLEM_CODES.validationFailed,
      detail: 'created_to doit etre une date YYYY-MM-DD.',
      errors: [{ field: 'created_to', message: 'Date invalide.' }],
    });
  }
  // Comparaison LEXICOGRAPHIQUE valide : les deux chaines sont deja
  // verifiees `YYYY-MM-DD` (meme longueur, meme format) a ce point.
  if (createdFromParam !== null && createdToParam !== null && createdFromParam > createdToParam) {
    throw validationFailed([
      { field: 'created_from', message: 'created_from doit etre anterieure ou egale a created_to.' },
    ]);
  }

  return {
    createdAtFrom: createdFromParam
      ? resolveCalendarBoundOrThrow('created_from', createdFromParam, startOfDayInReferenceTimeZone)
      : null,
    createdAtTo: createdToParam
      ? resolveCalendarBoundOrThrow('created_to', createdToParam, endOfDayInReferenceTimeZone)
      : null,
  };
}

// `resolveCalendarBoundOrThrow` (validation calendaire, 422 sur jour
// inexistant) vit desormais dans `src/modules/_shared/application/
// calendar-bounds.ts` (EXTRAIT ici en E10.18c pour que
// `requestCommercialOrderExport` en herite SANS EN RECOPIER LA LOGIQUE,
// docs/api/CONVENTIONS.md §8.24 point 5 regle 7) — importee en tete de ce
// fichier, comportement INCHANGE.

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
  // E10.19b — `getOrderDocument`/`generateOrderDocument` documentent EXPLICITEMENT
  // le code `order.not_found` au contrat (§8.20 §6/§7), la ou les operations
  // plus anciennes de ce fichier n avaient jamais precise de code au-dela du
  // generique `$ref: NotFound`. Parametre optionnel, retro-compatible avec
  // tous les appels existants (defaut INCHANGE).
  orderNotFoundCode: string = SHARED_PROBLEM_CODES.notFound,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof QuoteNotFoundError) {
      throw problem({ status: 404, title: 'Devis introuvable', code: SHARED_PROBLEM_CODES.notFound });
    }
    if (error instanceof CommercialOrderNotFoundError) {
      throw problem({ status: 404, title: 'Commande introuvable', code: orderNotFoundCode });
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
    // E10.19b — bon de commande PDF. `document_not_generated` EST LE CAS
    // NOMINAL (contrat §8.20 §6) : aucune commande n a de document tant que
    // personne n a clique « Produire le bon de commande ».
    if (error instanceof OrderDocumentNotFoundError) {
      throw problem({
        status: 404,
        title: 'Aucun bon de commande',
        code: 'order.document_not_generated',
        detail: error.message,
      });
    }
    if (error instanceof OrderDocumentAlreadyGeneratedError) {
      throw problem({
        status: 409,
        title: 'Bon de commande deja produit',
        code: 'order.document_already_generated',
        detail: error.message,
      });
    }
    if (error instanceof OrderDocumentTemplateMissingError) {
      throw problem({
        status: 409,
        title: 'Aucun gabarit de bon de commande',
        code: 'order.document_template_missing',
        detail: error.message,
      });
    }
    if (error instanceof OrderDocumentGenerationFailedError) {
      // 500 — AUCUN code metier stable au contrat pour ce cas (meme parti
      // que `quote.document_generation_failed`, jamais formalise en reponse
      // JSON Schema dans le YAML) : propage telle quelle, le socle transverse
      // la traduit en `api.internal_error`.
      throw error;
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
