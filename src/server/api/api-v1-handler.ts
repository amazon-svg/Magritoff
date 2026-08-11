import { parseId, type ActorContext, type RequestId, type TenantId, type UserId } from '../../kernel';
import { API_V1_BASE_PATH, type ApiProblem } from '../../platform/api';
import { ApiHttpError } from './errors';
import type { ApiRequestContext, ApiRoute } from './routes';

export type ResolvedActor =
  | Readonly<{ kind: 'user'; userId: UserId; tenantId: TenantId }>
  | Readonly<{ kind: 'system'; systemId: string; tenantId?: TenantId }>;

export interface ActorResolver {
  resolve(
    request: Request,
    context: Readonly<{
      requestId: RequestId;
      params: Readonly<Record<string, string>>;
    }>,
  ): Promise<ResolvedActor | null>;
}

export type ApiV1HandlerOptions = Readonly<{
  routes: readonly ApiRoute[];
  actorResolver?: ActorResolver;
  requestIdFactory?: () => string;
  onUnexpectedError?: (error: unknown, requestId: RequestId) => void;
}>;

const anonymousActorResolver: ActorResolver = Object.freeze({
  async resolve() {
    return null;
  },
});

export function createApiV1Handler(options: ApiV1HandlerOptions) {
  const actorResolver = options.actorResolver ?? anonymousActorResolver;
  const requestIdFactory = options.requestIdFactory ?? (() => crypto.randomUUID());
  const compiledRoutes = options.routes.map((route) => ({
    route,
    matchPath: compilePathTemplate(route.path),
  }));

  return async function handle(request: Request): Promise<Response> {
    const requestId = toRequestId(request.headers.get('x-request-id') ?? requestIdFactory());
    const url = new URL(request.url);

    if (!url.pathname.startsWith(`${API_V1_BASE_PATH}/`)) {
      return problemResponse(
        {
          type: 'about:blank',
          title: 'Ressource introuvable',
          status: 404,
          code: 'api.not_found',
          requestId,
        },
        requestId,
      );
    }

    const pathMatches = compiledRoutes.flatMap(({ route, matchPath }) => {
      const params = matchPath(url.pathname);
      return params === null ? [] : [{ route, params }];
    });
    const matched = pathMatches.find(({ route }) => route.method === request.method);

    if (!matched) {
      const pathExists = pathMatches.length > 0;
      return problemResponse(
        {
          type: 'about:blank',
          title: pathExists ? 'Méthode non autorisée' : 'Ressource introuvable',
          status: pathExists ? 405 : 404,
          code: pathExists ? 'api.method_not_allowed' : 'api.not_found',
          requestId,
        },
        requestId,
      );
    }

    try {
      const resolvedActor = await actorResolver.resolve(request, {
        requestId,
        params: matched.params,
      });
      if (matched.route.authentication === 'required' && resolvedActor === null) {
        return problemResponse(
          {
            type: 'about:blank',
            title: 'Authentification requise',
            status: 401,
            code: 'identity.authentication_required',
            requestId,
          },
          requestId,
        );
      }

      const context: ApiRequestContext = Object.freeze({
        request,
        requestId,
        params: matched.params,
        actor: resolvedActor === null ? null : attachRequestId(resolvedActor, requestId),
      });
      const result = await matched.route.execute(context);

      return jsonResponse(result.body, result.status, requestId, result.headers);
    } catch (error) {
      if (error instanceof ApiHttpError) {
        return problemResponse({ ...error.problem, requestId }, requestId);
      }

      options.onUnexpectedError?.(error, requestId);
      return problemResponse(
        {
          type: 'about:blank',
          title: 'Erreur interne',
          status: 500,
          code: 'api.internal_error',
          requestId,
        },
        requestId,
      );
    }
  };
}

function compilePathTemplate(template: string) {
  const parameterNames: string[] = [];
  const escaped = template
    .split('/')
    .map((segment) => {
      const parameter = /^\{([A-Za-z][A-Za-z0-9_]*)\}$/.exec(segment);
      if (parameter?.[1]) {
        parameterNames.push(parameter[1]);
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const expression = new RegExp(`^${escaped}/?$`);

  return (path: string): Readonly<Record<string, string>> | null => {
    const match = expression.exec(path);
    if (!match) return null;

    return Object.freeze(
      Object.fromEntries(
        parameterNames.map((name, index) => [name, decodePathSegment(match[index + 1] ?? '')]),
      ),
    );
  };
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function attachRequestId(actor: ResolvedActor, requestId: RequestId): ActorContext {
  if (actor.kind === 'user') return Object.freeze({ ...actor, requestId });
  return Object.freeze({ ...actor, requestId });
}

function toRequestId(value: string): RequestId {
  const parsed = parseId<'RequestId'>(value);
  if (parsed.ok) return parsed.value;
  throw new TypeError('Le générateur de request ID a retourné une valeur vide.');
}

function jsonResponse(
  body: unknown,
  status: number,
  requestId: RequestId,
  additionalHeaders?: Readonly<Record<string, string>>,
): Response {
  const headers = new Headers(additionalHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('x-request-id', requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

function problemResponse(problem: ApiProblem, requestId: RequestId): Response {
  const response = jsonResponse(problem, problem.status, requestId);
  response.headers.set('Content-Type', 'application/problem+json; charset=utf-8');
  return response;
}
