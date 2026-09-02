/**
 * Routes HTTP du module Pricing — referentiel des regles de prix (story
 * E10.6), sur la facade Gestion commerciale (`defineGescomRoute`, E10.0).
 *
 * Lecture ouverte aux cles de service (`price-rules:read`, deja declare par
 * E10.0/E10.6) : c est par elles que Clariprint et Studio liront la regle
 * applicable une fois `resolvePriceRule` livre par E10.7 — pas cet endpoint.
 * Ecriture reservee aux jetons utilisateur.
 *
 * Enregistrement obligatoire dans `gescom-routes.ts` (CA1) — sans quoi
 * `tests/architecture/gescom-api-socle-boundaries.test.ts` echoue.
 *
 * Hors perimetre (E10.7) : `POST /price-rules/resolve` n est pas implemente
 * ici, bien que decrit au contrat.
 */
import {
  createPriceRuleCommandSchema,
  priceRuleSchema,
  priceRuleStatusFilterSchema,
  priceRuleSortSchema,
  priceRulesListSchema,
  productRangeDefaultMarginSchema,
  setProductRangeDefaultMarginCommandSchema,
  updatePriceRuleCommandSchema,
} from '../../modules/pricing/api/contracts.ts';
import type { PriceRulesService } from '../../modules/pricing/application/price-rules-service.ts';
import {
  PriceRuleCommandRejectedError,
  PriceRuleNotFoundError,
  ProductRangeNotFoundError,
  type PriceRuleSortField,
} from '../../modules/pricing/application/price-rules-repository.ts';
import { uuidSchema } from '../../modules/_shared/api/index.ts';
import {
  assertPrecondition,
  buildPage,
  computeEntityTag,
  decodeCursor,
  problem,
  SHARED_PROBLEM_CODES,
  validationFailed,
} from '../../modules/_shared/application/index.ts';
import { defineGescomRoute, type GescomRoute, type GescomRequestContext } from './gescom-middleware.ts';

const SORT_TOKENS = ['-created_at', 'created_at', '-starts_on', 'starts_on'] as const;
type SortToken = (typeof SORT_TOKENS)[number];

export function createPriceRulesRoutes(service: PriceRulesService): readonly GescomRoute[] {
  return [
    defineGescomRoute({
      method: 'GET',
      path: '/price-rules',
      operationId: 'listPriceRules',
      requiredScopes: ['price-rules:read'],
      inputSchema: null,
      dataSchema: priceRulesListSchema,
      async handle(context) {
        const q = context.url.searchParams.get('q');
        const status = parseStatus(context.url.searchParams.get('status'));
        const customerId = parseUuidFilter(context.url.searchParams.get('customer_id'), 'customer_id');
        const productRangeId = parseUuidFilter(
          context.url.searchParams.get('product_range_id'),
          'product_range_id',
        );
        const sort = parseSort(context.url.searchParams.get('sort'));
        const filters: ListFilters = { q, status, customerId, productRangeId };
        const cursor = parseCursor(context.page.cursor, sort.field, filters);

        const result = await service.list(context.tenantId, {
          q,
          status,
          customerId,
          productRangeId,
          sort: { field: sort.field, direction: sort.direction },
          size: context.page.size,
          cursor,
        });
        const page = buildPage(result.rows, context.page, (row) => ({
          sort: encodeSortToken(
            sort.field,
            sort.field === 'starts_on' ? row.starts_on : row.created_at,
            filters,
          ),
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
      path: '/price-rules',
      operationId: 'createPriceRule',
      authentication: 'user',
      createsResource: true,
      inputSchema: createPriceRuleCommandSchema,
      dataSchema: priceRuleSchema,
      async handle(context, input) {
        return withDomainErrors(async () => ({
          status: 201,
          data: await service.create(context.tenantId, requireUserId(context), input),
        }));
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/price-rules/{priceRuleId}',
      operationId: 'getPriceRule',
      requiredScopes: ['price-rules:read'],
      inputSchema: null,
      dataSchema: priceRuleSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const rule = await service.getById(context.tenantId, context.params['priceRuleId']!);
          return { status: 200, data: rule, etag: await computeEntityTag(rule) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PATCH',
      path: '/price-rules/{priceRuleId}',
      operationId: 'updatePriceRule',
      authentication: 'user',
      inputSchema: updatePriceRuleCommandSchema,
      dataSchema: priceRuleSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const priceRuleId = context.params['priceRuleId']!;
          const current = await service.getById(context.tenantId, priceRuleId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.update(context.tenantId, priceRuleId, input);
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),

    defineGescomRoute({
      method: 'GET',
      path: '/product-ranges/{productRangeId}/default-margins',
      operationId: 'getProductRangeDefaultMargin',
      requiredScopes: ['price-rules:read'],
      inputSchema: null,
      dataSchema: productRangeDefaultMarginSchema,
      async handle(context) {
        return withDomainErrors(async () => {
          const margin = await service.getDefaultMargin(
            context.tenantId,
            context.params['productRangeId']!,
          );
          return { status: 200, data: margin, etag: await computeEntityTag(margin) };
        });
      },
    }),

    defineGescomRoute({
      method: 'PUT',
      path: '/product-ranges/{productRangeId}/default-margins',
      operationId: 'setProductRangeDefaultMargin',
      authentication: 'user',
      inputSchema: setProductRangeDefaultMarginCommandSchema,
      dataSchema: productRangeDefaultMarginSchema,
      async handle(context, input) {
        return withDomainErrors(async () => {
          const productRangeId = context.params['productRangeId']!;
          const current = await service.getDefaultMargin(context.tenantId, productRangeId);
          const currentTag = await computeEntityTag(current);
          assertPrecondition(context.ifMatch, currentTag, current);

          const updated = await service.setDefaultMargin(
            context.tenantId,
            productRangeId,
            requireUserId(context),
            input.margin_rate,
          );
          return { status: 200, data: updated, etag: await computeEntityTag(updated) };
        });
      },
    }),
  ];
}

function parseStatus(raw: string | null): 'active' | 'disabled' | null {
  if (raw === null) return null;
  const parsed = priceRuleStatusFilterSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationFailed([{ field: 'status', message: 'Valeur attendue : active ou disabled.' }]);
  }
  return parsed.data;
}

/**
 * Valide le format UUID d un filtre optionnel (`customer_id`,
 * `product_range_id`) — meme pattern que `commercial-quotes-routes.ts` /
 * `projects-routes.ts` pour les filtres de meme nature.
 */
function parseUuidFilter(raw: string | null, field: string): string | null {
  if (raw === null) return null;
  if (!uuidSchema.safeParse(raw).success) {
    throw validationFailed([{ field, message: 'UUID invalide.' }]);
  }
  return raw;
}

function parseSort(raw: string | null): Readonly<{
  field: PriceRuleSortField;
  direction: 'asc' | 'desc';
}> {
  const token = (raw ?? '-created_at') as SortToken;
  const parsed = priceRuleSortSchema.safeParse(token);
  if (!parsed.success) {
    throw validationFailed([
      { field: 'sort', message: 'Valeurs attendues : -created_at, created_at, -starts_on, starts_on.' },
    ]);
  }
  const direction = parsed.data.startsWith('-') ? ('desc' as const) : ('asc' as const);
  const field = (parsed.data.startsWith('-') ? parsed.data.slice(1) : parsed.data) as PriceRuleSortField;
  return { field, direction };
}

/** Jeu de filtres de `listPriceRules`, hors tri et pagination. */
type ListFilters = Readonly<{
  q: string | null;
  status: 'active' | 'disabled' | null;
  customerId: string | null;
  productRangeId: string | null;
}>;

/**
 * Empreinte stable du jeu de filtres courant, encodee dans le curseur au
 * meme titre que le champ de tri. `encodeURIComponent` garantit l absence du
 * separateur `|` dans le resultat, ce qui permet de le distinguer sans
 * ambiguite de la valeur de tri lors du decodage.
 */
function encodeFilterSignature(filters: ListFilters): string {
  return encodeURIComponent(
    JSON.stringify([filters.q, filters.status, filters.customerId, filters.productRangeId]),
  );
}

function encodeSortToken(field: PriceRuleSortField, value: string, filters: ListFilters): string {
  return `${field}|${encodeFilterSignature(filters)}|${value}`;
}

/**
 * Decode le curseur opaque et verifie qu il porte le MEME champ de tri ET LE
 * MEME JEU DE FILTRES que la requete courante — un ecart sur l un ou l autre
 * rend `api.validation_failed` plutot qu une page silencieusement
 * incoherente (contrat `listPriceRules`, note sur `sort` etendue par
 * symetrie a `q`/`status`/`customer_id`/`product_range_id`).
 */
function parseCursor(
  raw: string | null,
  requestedField: PriceRuleSortField,
  requestedFilters: ListFilters,
): Readonly<{ field: PriceRuleSortField; value: string; id: string }> | null {
  if (raw === null) return null;
  const decoded = decodeCursor(raw);
  const firstSeparator = decoded.sort.indexOf('|');
  const secondSeparator = firstSeparator === -1 ? -1 : decoded.sort.indexOf('|', firstSeparator + 1);

  if (firstSeparator === -1 || secondSeparator === -1) {
    throw validationFailed([
      { field: 'page[cursor]', message: 'Curseur illisible pour ce jeu de filtres et de tri.' },
    ]);
  }

  const cursorField = decoded.sort.slice(0, firstSeparator) as PriceRuleSortField;
  const cursorFilterSignature = decoded.sort.slice(firstSeparator + 1, secondSeparator);
  const cursorValue = decoded.sort.slice(secondSeparator + 1);

  if (cursorField !== requestedField || cursorFilterSignature !== encodeFilterSignature(requestedFilters)) {
    throw validationFailed([
      {
        field: 'page[cursor]',
        message:
          'Le tri ou les filtres demandes ne correspondent pas a ceux encodes dans ce curseur. Reprendre le meme `sort` et le meme jeu de filtres.',
      },
    ]);
  }
  return { field: cursorField, value: cursorValue, id: decoded.id };
}

/** L identifiant utilisateur qui cree/modifie la ressource (audit `created_by`/`updated_by`). */
function requireUserId(context: GescomRequestContext): import('../../kernel/ids/index.ts').UserId {
  if (context.principal.kind !== 'user') {
    // Ne devrait jamais arriver : la route est `authentication: 'user'`, donc
    // `assertUserPrincipal` a deja ecarte toute cle de service avant `handle`.
    throw problem({
      status: 403,
      title: 'Acteur utilisateur requis',
      code: SHARED_PROBLEM_CODES.actorKindRequired,
    });
  }
  return context.principal.userId;
}

/** Traduit les erreurs de domaine du module Pricing en Problem RFC 7807. */
async function withDomainErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PriceRuleNotFoundError) {
      throw problem({
        status: 404,
        title: 'Règle de prix introuvable',
        code: 'price_rule.not_found',
      });
    }
    if (error instanceof ProductRangeNotFoundError) {
      throw problem({
        status: 404,
        title: 'Gamme de produits introuvable',
        code: 'price_rule.product_range_unknown',
      });
    }
    if (error instanceof PriceRuleCommandRejectedError) {
      throw problem({
        status: 422,
        title: 'Commande refusée',
        code: error.code,
        detail: error.message,
        ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
      });
    }
    throw error;
  }
}
