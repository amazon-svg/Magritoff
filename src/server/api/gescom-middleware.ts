/**
 * Middleware transverse de la facade Gestion commerciale (story E10.0).
 *
 * Il branche sur HTTP le socle de src/modules/_shared/ et rend structurellement
 * impossibles les ecarts aux criteres du sprint : une route qui oublie
 * `Idempotency-Key` sur une creation ou `If-Match` sur un PATCH ne se declare
 * meme pas — `defineGescomRoute` refuse la definition au chargement du module,
 * pas en production.
 *
 * Pourquoi une facade distincte de `createApiV1Handler` : la forme de reponse
 * differe. L API historique renvoie le payload nu et un probleme en
 * `requestId` (camelCase) ; E10 impose l enveloppe `{ data, meta }` et un
 * probleme en `request_id` (snake_case). Reecrire l historique casserait les
 * clients existants (R5) ; les deux facades coexistent et partagent le meme
 * routage (`compilePathTemplate`).
 */
import type { z } from 'zod';
import { systemClock, type Clock } from '../../kernel/clock/index.ts';
import type { TenantId } from '../../kernel/ids/index.ts';
import {
  checkResourcePath,
  ETAG_HEADER,
  GESCOM_API_BASE_PATH,
  IDEMPOTENCY_REPLAYED_HEADER,
  JSON_MEDIA_TYPE,
  PROBLEM_MEDIA_TYPE,
  REQUEST_ID_HEADER,
  type MetaDto,
  type ProblemDto,
} from '../../modules/_shared/api/index.ts';
import {
  assertScopes,
  assertUserPrincipal,
  fingerprintRequest,
  idempotencyInProgress,
  idempotencyKeyReused,
  internalError,
  parsePageParams,
  problem,
  ProblemError,
  readIdempotencyKey,
  readIfMatch,
  resolvePrincipal,
  SHARED_PROBLEM_CODES,
  validationFailed,
  type ApiPrincipal,
  type IdempotencyRequest,
  type IdempotencyStore,
  type PageParams,
  type PrincipalVerifier,
  type ServiceScope,
} from '../../modules/_shared/application/index.ts';
import { compilePathTemplate } from './api-v1-handler.ts';
import type { HttpMethod } from './routes.ts';

export type GescomAuthentication = 'user' | 'service' | 'any';

export type GescomRequestContext = Readonly<{
  request: Request;
  url: URL;
  requestId: string;
  params: Readonly<Record<string, string>>;
  principal: ApiPrincipal;
  /** Tenant resolu depuis le jeton, jamais depuis l URL (CA4). */
  tenantId: TenantId;
  page: PageParams;
  /** Valeur de `If-Match`, deja validee. `null` hors PATCH. */
  ifMatch: string | null;
}>;

export type GescomRouteResult<TData> = Readonly<{
  status: number;
  data: TData;
  /** Complements de `meta`. `request_id` est ajoute par la facade. */
  meta?: Readonly<{ next_cursor?: string | null; page_size?: number }>;
  /** ETag de la representation renvoyee, exige des qu elle est modifiable. */
  etag?: string;
  headers?: Readonly<Record<string, string>>;
}>;

export type GescomRouteDefinition<TInput, TData> = Readonly<{
  method: HttpMethod;
  /** Chemin RELATIF au prefixe `/api/v1`, ex. `/price-rules/{ruleId}`. */
  path: string;
  /** `operationId` correspondant dans openapi/magrit-core.v1.yaml (CA1). */
  operationId: string;
  authentication?: GescomAuthentication;
  requiredScopes?: readonly ServiceScope[];
  /** Vrai sur un POST creant une ressource metier -> `Idempotency-Key` exige (CA8). */
  createsResource?: boolean;
  inputSchema: z.ZodType<TInput> | null;
  dataSchema: z.ZodType<TData>;
  handle(context: GescomRequestContext, input: TInput): Promise<GescomRouteResult<TData>>;
}>;

export type GescomRoute = Readonly<{
  method: HttpMethod;
  /** Chemin absolu, prefixe compris. */
  path: string;
  relativePath: string;
  operationId: string;
  authentication: GescomAuthentication;
  requiredScopes: readonly ServiceScope[];
  createsResource: boolean;
  concurrencyGuarded: boolean;
  execute(
    context: GescomRequestContext,
    input: unknown,
  ): Promise<GescomRouteResult<unknown>>;
  parseInput(request: Request): Promise<unknown>;
}>;

/**
 * Declare une route de la facade. Les invariants du sprint sont verifies ICI,
 * au chargement du module : une definition non conforme fait echouer le
 * demarrage, pas la premiere requete d un client.
 */
export function defineGescomRoute<TInput, TData>(
  definition: GescomRouteDefinition<TInput, TData>,
): GescomRoute {
  assertRoutePath(definition.method, definition.path);

  const authentication = definition.authentication ?? 'any';
  const requiredScopes = Object.freeze([...(definition.requiredScopes ?? [])]);

  // CA5 — portee FERMEE par defaut. Une route joignable par une cle de service
  // sans scope declare serait ouverte a n importe quelle cle du tenant : le
  // module Studio pourrait ecrire la ou il n a que la lecture. Une route
  // reservee aux utilisateurs (`authentication: 'user'`) n a pas de scope :
  // ses droits viennent des roles du tenant, verifies par la RLS.
  if (authentication !== 'user' && requiredScopes.length === 0) {
    throw new TypeError(
      `${definition.operationId} : une route joignable par cle de service doit declarer requiredScopes (CA5). ` +
        `Sinon, la restreindre explicitement avec authentication: 'user'.`,
    );
  }

  const createsResource = definition.createsResource ?? false;
  if (createsResource && definition.method !== 'POST') {
    throw new TypeError(
      `${definition.operationId} : createsResource ne vaut que pour un POST (CA8).`,
    );
  }
  if (
    (definition.method === 'PATCH' || definition.method === 'PUT') &&
    definition.inputSchema === null
  ) {
    throw new TypeError(`${definition.operationId} : un PATCH/PUT doit declarer un inputSchema.`);
  }

  return Object.freeze({
    method: definition.method,
    path: `${GESCOM_API_BASE_PATH}${definition.path}`,
    relativePath: definition.path,
    operationId: definition.operationId,
    authentication,
    requiredScopes,
    createsResource,
    // CA9 : tout PATCH est protege, sans exception declarative possible.
    // E10.2 etend la MEME garde a PUT : un remplacement complet d une
    // sous-ressource (ex. PUT /projects/{id}/tags) expose au meme risque
    // d ecrasement concurrent qu un PATCH, et merite la meme protection
    // If-Match/ETag plutot qu un mecanisme distinct.
    concurrencyGuarded: definition.method === 'PATCH' || definition.method === 'PUT',
    async parseInput(request) {
      return parseJsonInput(request, definition.inputSchema);
    },
    async execute(context, input) {
      const result = await definition.handle(context, input as TInput);
      const parsed = definition.dataSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new TypeError(
          `${definition.operationId} : la reponse viole le contrat de sa ressource.`,
        );
      }
      return { ...result, data: parsed.data };
    },
  });
}

export type GescomApiHandlerOptions = Readonly<{
  routes: readonly GescomRoute[];
  principalVerifier: PrincipalVerifier;
  idempotencyStore: IdempotencyStore;
  clock?: Clock;
  requestIdFactory?: () => string;
  onUnexpectedError?: (error: unknown, requestId: string) => void;
}>;

export function createGescomApiHandler(options: GescomApiHandlerOptions) {
  const requestIdFactory = options.requestIdFactory ?? (() => crypto.randomUUID());
  const clock = options.clock ?? systemClock;
  void clock;
  const compiled = options.routes.map((route) => ({
    route,
    matchPath: compilePathTemplate(route.path),
  }));
  assertUniqueOperationIds(options.routes);

  return async function handle(request: Request): Promise<Response> {
    const requestId = request.headers.get(REQUEST_ID_HEADER) ?? requestIdFactory();
    const url = new URL(request.url);

    const pathMatches = compiled.flatMap(({ route, matchPath }) => {
      const params = matchPath(url.pathname);
      return params === null ? [] : [{ route, params }];
    });
    const matched = pathMatches.find(({ route }) => route.method === request.method);

    if (!matched) {
      const pathExists = pathMatches.length > 0;
      return renderProblem(
        {
          type: 'about:blank',
          title: pathExists ? 'Methode non autorisee' : 'Ressource introuvable',
          status: pathExists ? 405 : 404,
          code: pathExists
            ? SHARED_PROBLEM_CODES.methodNotAllowed
            : SHARED_PROBLEM_CODES.notFound,
          request_id: requestId,
        },
        requestId,
      );
    }

    const { route, params } = matched;
    let idempotency: IdempotencyRequest | null = null;

    try {
      const principal = await resolvePrincipal(request, options.principalVerifier, params);
      if (route.authentication === 'user') assertUserPrincipal(principal);
      if (route.authentication === 'service' && principal.kind !== 'service') {
        throw problem({
          status: 403,
          title: 'Cle de service requise',
          code: SHARED_PROBLEM_CODES.actorKindRequired,
        });
      }
      assertScopes(principal, route.requiredScopes);

      const page = parsePageParams(url);
      const ifMatch = readIfMatch(request, route.concurrencyGuarded);
      const input = await route.parseInput(request);

      if (route.createsResource) {
        const key = readIdempotencyKey(request, true);
        if (key === null) throw internalError();
        idempotency = {
          tenantId: principal.tenantId,
          key,
          // L empreinte couvre la query : deux POST au meme chemin avec des
          // query differentes ne sont pas la meme requete.
          fingerprint: await fingerprintRequest(request.method, url, input),
        };
        const lookup = await options.idempotencyStore.begin(idempotency);
        if (lookup.outcome === 'conflict') throw idempotencyKeyReused(key);
        if (lookup.outcome === 'in_progress') throw idempotencyInProgress(key);
        if (lookup.outcome === 'replayed') {
          return renderSuccess(
            lookup.record.status,
            // `meta.request_id` est recale sur la requete COURANTE : le contrat
            // promet qu il vaut l en-tete X-Request-Id, et rendre celui de la
            // premiere tentative casserait la correlation des traces du client.
            rewriteEnvelopeRequestId(lookup.record.body, requestId),
            requestId,
            {
              [IDEMPOTENCY_REPLAYED_HEADER]: 'true',
              ...(lookup.record.etag === null ? {} : { [ETAG_HEADER]: lookup.record.etag }),
            },
          );
        }
      }

      const context: GescomRequestContext = Object.freeze({
        request,
        url,
        requestId,
        params,
        principal,
        tenantId: principal.tenantId,
        page,
        ifMatch,
      });

      const result = await route.execute(context, input);
      const body = buildEnvelope(result, requestId);
      const headers: Record<string, string> = { ...(result.headers ?? {}) };
      if (result.etag !== undefined) headers[ETAG_HEADER] = result.etag;

      if (idempotency !== null) {
        await options.idempotencyStore.complete(idempotency, {
          status: result.status,
          body,
          etag: result.etag ?? null,
        });
      }

      return renderSuccess(result.status, body, requestId, headers);
    } catch (error) {
      if (idempotency !== null) await safeRelease(options.idempotencyStore, idempotency);

      if (error instanceof ProblemError) {
        return renderProblem(error.toProblem(requestId), requestId);
      }

      options.onUnexpectedError?.(error, requestId);
      return renderProblem(internalError().toProblem(requestId), requestId);
    }
  };
}

/** Construit l enveloppe `{ data, meta }` imposee a toute reponse de succes (CA6). */
export function buildEnvelope<TData>(
  result: GescomRouteResult<TData>,
  requestId: string,
): Readonly<{ data: TData; meta: MetaDto }> {
  const meta: MetaDto = {
    request_id: requestId,
    next_cursor: result.meta?.next_cursor ?? null,
    ...(result.meta?.page_size === undefined ? {} : { page_size: result.meta.page_size }),
  };
  return Object.freeze({ data: result.data, meta });
}

/**
 * Recale `meta.request_id` d une reponse memorisee sur la requete courante.
 * Le reste de l enveloppe — `data` compris — est rendu inchange : c est tout
 * l interet du rejeu.
 */
function rewriteEnvelopeRequestId(body: unknown, requestId: string): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const envelope = body as { data?: unknown; meta?: unknown };
  if (typeof envelope.meta !== 'object' || envelope.meta === null) return body;
  return {
    ...envelope,
    meta: { ...(envelope.meta as Record<string, unknown>), request_id: requestId },
  };
}

function renderSuccess(
  status: number,
  body: unknown,
  requestId: string,
  additionalHeaders: Readonly<Record<string, string>>,
): Response {
  const headers = new Headers(additionalHeaders);
  headers.set('Content-Type', JSON_MEDIA_TYPE);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

function renderProblem(problemBody: ProblemDto, requestId: string): Response {
  const headers = new Headers();
  headers.set('Content-Type', PROBLEM_MEDIA_TYPE);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(JSON.stringify(problemBody), { status: problemBody.status, headers });
}

async function parseJsonInput<T>(
  request: Request,
  schema: z.ZodType<T> | null,
): Promise<T | undefined> {
  if (schema === null) return undefined;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw problem({
      status: 400,
      title: 'Corps JSON invalide',
      code: SHARED_PROBLEM_CODES.invalidJson,
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw validationFailed(
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

/**
 * CA3 et CA4 : prefixe `/api/v1`, ressources au pluriel en kebab-case, aucun
 * segment de chemin ne designe un tenant.
 *
 * La regle elle-meme vit dans `src/modules/_shared/api/path-rules.ts` et est
 * partagee avec le lint du contrat : elle existait auparavant en deux
 * exemplaires qui avaient deja diverge sur le pluriel des sous-ressources.
 */
function assertRoutePath(method: HttpMethod, path: string): void {
  const violations = checkResourcePath(path, GESCOM_API_BASE_PATH);
  const first = violations[0];
  if (first !== undefined) {
    throw new TypeError(`Chemin ${method} ${path} : ${first.message} (${first.rule}).`);
  }
}

function assertUniqueOperationIds(routes: readonly GescomRoute[]): void {
  const seen = new Set<string>();
  for (const route of routes) {
    if (seen.has(route.operationId)) {
      throw new TypeError(`operationId duplique : ${route.operationId}.`);
    }
    seen.add(route.operationId);
  }
}

async function safeRelease(store: IdempotencyStore, request: IdempotencyRequest): Promise<void> {
  try {
    await store.release(request);
  } catch {
    // Liberer la cle est un confort ; echouer ici ne doit pas masquer l erreur
    // d origine, qui est celle que l appelant doit voir.
  }
}
