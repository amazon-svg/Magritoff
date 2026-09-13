/**
 * Routes HTTP du module Exports de commandes (story E10.18c), sur la facade
 * Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * Trois operations, TOUTES gardees par `can_export_orders`, LECTURE
 * COMPRISE (ecart avec les autres modules E10, contrat §8.24 point 6) — la
 * garde vit dans `OrderExportsService` (RPC `user_has_capability`), PAS dans
 * `requiredScopes` (qui gouverne les CLES DE SERVICE, un axe distinct :
 * aucune cle de service n a acces a ce module, contrat : « un module tiers
 * qui veut les commandes a orders:read, lui offrir un classeur serait
 * publier un siphon »).
 *
 * `RequestOrderExportCommand.filters` HERITE de la MEME validation
 * calendaire que `listCommercialOrders` (`resolveCalendarBoundOrThrow`,
 * `src/modules/_shared/application/calendar-bounds.ts`) SANS EN RECOPIER LA
 * LOGIQUE (contrat §8.24 point 5 regle 7).
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1).
 */
import {
  orderExportFormatSchema,
  orderExportGranularitySchema,
  orderExportsListSchema,
  orderExportSchema,
  orderExportStatusSchema,
  requestOrderExportCommandSchema,
  type OrderExportFiltersDto,
} from '../../modules/order-exports/api/contracts.ts';
import type { OrderExportsService } from '../../modules/order-exports/application/order-exports-service.ts';
import {
  OrderExportAccessDeniedError,
  OrderExportNotFoundError,
  OrderExportPendingLimitReachedError,
} from '../../modules/order-exports/application/order-exports-repository.ts';
import { endOfDayInReferenceTimeZone, startOfDayInReferenceTimeZone } from '../../kernel/clock/index.ts';
import type { CustomersService } from '../../modules/customers/application/customers-service.ts';
import { CustomerNotFoundError } from '../../modules/customers/application/customers-repository.ts';
import type { CommercialQuotesService } from '../../modules/commercial-quotes/application/commercial-quotes-service.ts';
import { QuoteNotFoundError } from '../../modules/commercial-quotes/application/commercial-quotes-repository.ts';
import type { ProductionStepsService } from '../../modules/production-steps/application/production-steps-service.ts';
import {
  buildPage,
  decodeCursor,
  problem,
  resolveCalendarBoundOrThrow,
  roleRequired,
  SHARED_PROBLEM_CODES,
  validationFailed,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRequestContext, type GescomRoute } from './gescom-middleware.ts';

export function createOrderExportsRoutes(
  orderExports: OrderExportsService,
  customers: CustomersService,
  commercialQuotes: CommercialQuotesService,
  productionSteps: ProductionStepsService,
): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/commercial-order-exports',
      operationId: 'listCommercialOrderExports',
      // Aucune cle de service (contrat §8.24 point 6 : « un module tiers qui
      // veut les commandes a orders:read, lui offrir un classeur serait
      // publier un siphon ») : reservee aux jetons UTILISATEUR.
      authentication: 'user',
      inputSchema: null,
      dataSchema: orderExportsListSchema,
      async handle(context) {
        const statusParam = context.url.searchParams.get('status');
        const status = parseEnumParam(statusParam, orderExportStatusSchema, 'status');
        const formatParam = context.url.searchParams.get('format');
        const format = parseEnumParam(formatParam, orderExportFormatSchema, 'format');
        const granularityParam = context.url.searchParams.get('granularity');
        const granularity = parseEnumParam(granularityParam, orderExportGranularitySchema, 'granularity');

        const cursor = context.page.cursor ? decodeCursor(context.page.cursor) : null;

        const rows = await withOrderExportErrors(() =>
          orderExports.list(context.tenantId, requireUserId(context), {
            status,
            format,
            granularity,
            size: context.page.size,
            cursor,
          }),
        );
        const page = buildPage(rows, context.page, (row) => ({ sort: row.requested_at, id: row.id }));

        return {
          status: 200,
          data: page.items,
          meta: { next_cursor: page.nextCursor, page_size: context.page.size },
        };
      },
    }),

    defineGescomRoute({
      method: 'POST',
      path: '/commercial-order-exports',
      operationId: 'requestCommercialOrderExport',
      authentication: 'user',
      createsResource: true,
      inputSchema: requestOrderExportCommandSchema,
      dataSchema: orderExportSchema,
      async handle(context, input) {
        const filters = await resolveOrderExportFilters(context.tenantId, input.filters ?? {}, {
          customers,
          commercialQuotes,
          productionSteps,
        });

        const created = await withOrderExportErrors(() =>
          orderExports.request(context.tenantId, requireUserId(context), {
            format: input.format,
            granularity: input.granularity,
            filters,
          }),
        );

        return { status: 201, data: created };
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/commercial-order-exports/{exportId}',
      operationId: 'getCommercialOrderExport',
      authentication: 'user',
      inputSchema: null,
      dataSchema: orderExportSchema,
      async handle(context) {
        const exportId = context.params['exportId']!;
        const found = await withOrderExportErrors(() =>
          orderExports.getById(context.tenantId, requireUserId(context), exportId),
        );
        return { status: 200, data: found };
      },
    }),
  ];
}

/**
 * `OrderExportFilters` HERITE de la MEME validation que
 * `listCommercialOrders` (contrat : « CHAQUE CHAMP EST LE JUMEAU EXACT »),
 * dans le MEME ORDRE de controle : etape de production (422
 * `production_step.not_found`, code NOMME au contrat), puis client/devis
 * (422 `api.validation_failed`, generique — contrat : « client ou devis
 * inconnu »), puis calendrier (422 `api.validation_failed`, MEME fonction
 * que la grille), puis `created_from <= created_to`.
 */
async function resolveOrderExportFilters(
  tenantId: GescomRequestContext['tenantId'],
  filters: OrderExportFiltersDto,
  deps: {
    customers: CustomersService;
    commercialQuotes: CommercialQuotesService;
    productionSteps: ProductionStepsService;
  },
): Promise<OrderExportFiltersDto> {
  if (filters.current_production_step_id) {
    if (!(await deps.productionSteps.exists(tenantId, filters.current_production_step_id))) {
      throw problem({
        status: 422,
        title: 'Étape de production introuvable',
        code: 'production_step.not_found',
        detail: 'filters.current_production_step_id ne correspond a aucune etape de ce tenant.',
      });
    }
  }

  if (filters.customer_id) {
    try {
      await deps.customers.getSummary(tenantId, filters.customer_id);
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw validationFailed([{ field: 'filters.customer_id', message: 'Client introuvable dans ce tenant.' }]);
      }
      throw error;
    }
  }

  if (filters.quote_id) {
    try {
      await deps.commercialQuotes.getSummary(tenantId, filters.quote_id);
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        throw validationFailed([{ field: 'filters.quote_id', message: 'Devis introuvable dans ce tenant.' }]);
      }
      throw error;
    }
  }

  const createdFrom = filters.created_from ?? null;
  const createdTo = filters.created_to ?? null;
  if (createdFrom !== null && createdTo !== null && createdFrom > createdTo) {
    throw validationFailed([
      { field: 'filters.created_from', message: 'created_from doit etre anterieure ou egale a created_to.' },
    ]);
  }
  if (createdFrom !== null) {
    resolveCalendarBoundOrThrow('filters.created_from', createdFrom, startOfDayInReferenceTimeZone);
  }
  if (createdTo !== null) {
    resolveCalendarBoundOrThrow('filters.created_to', createdTo, endOfDayInReferenceTimeZone);
  }

  // Filtres ENREGISTRES TELS QUELS (dates en YYYY-MM-DD, jamais resolues en
  // UTC ici) — contrat : « republies a l identique » ; la resolution
  // Europe/Paris -> UTC est refaite EN SQL par `api_read_order_export_rows`
  // a chaque lecture (voir la migration 20260913000000).
  return {
    customer_id: filters.customer_id ?? null,
    quote_id: filters.quote_id ?? null,
    status: filters.status ?? null,
    current_production_step_id: filters.current_production_step_id ?? null,
    created_from: createdFrom,
    created_to: createdTo,
  };
}

function parseEnumParam<T extends string>(
  raw: string | null,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  field: string,
): T | null {
  if (raw === null) return null;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw problem({
      status: 400,
      title: 'Parametre invalide',
      code: SHARED_PROBLEM_CODES.validationFailed,
      detail: `${field} invalide.`,
      errors: [{ field, message: 'Valeur inattendue.' }],
    });
  }
  return parsed.data as T;
}

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

async function withOrderExportErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof OrderExportAccessDeniedError) {
      throw roleRequired(['can_export_orders']);
    }
    if (error instanceof OrderExportNotFoundError) {
      throw problem({
        status: 404,
        title: 'Export introuvable',
        code: 'order_export.not_found',
      });
    }
    if (error instanceof OrderExportPendingLimitReachedError) {
      throw problem({
        status: 422,
        title: 'Trop de demandes en file',
        code: 'order_export.pending_limit_reached',
        detail: error.message,
      });
    }
    throw error;
  }
}
