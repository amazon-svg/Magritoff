import {
  parseId,
  type ActorContext,
  type AppError,
  type RequestId,
  type TenantId,
} from '../../../../kernel';
import type { IdentityService, TenantService } from '../../../../platform';
import type { AccessManagementQueries } from '../../application';
import type { AccessManagementApiErrorResponse } from '../../api';

export type AccessManagementHttpDependencies = Readonly<{
  identity: IdentityService;
  tenants: TenantService;
  queries: AccessManagementQueries;
}>;

export type AccessManagementHttpOptions = Readonly<{
  requestId?: string;
}>;

const jsonHeaders = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, idempotency-key, if-match, x-request-id',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Route = Readonly<{
  tenantId: TenantId;
  resource: 'me' | 'capabilities' | 'roles' | 'members' | 'modules';
  resourceId?: string;
}>;

function createRequestId(value?: string): RequestId {
  const candidate = value?.trim();
  const safe = candidate && candidate.length <= 128 ? candidate : crypto.randomUUID();
  const parsed = parseId<'RequestId'>(safe);
  if (!parsed.ok) throw new Error('A request identifier cannot be empty.');
  return parsed.value;
}

function jsonResponse<T>(body: T, status: number, requestId: RequestId): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, 'X-Request-Id': requestId },
  });
}

function errorResponse(
  requestId: RequestId,
  status: number,
  code: string,
  message: string,
  retryable = false,
): Response {
  const body: AccessManagementApiErrorResponse = {
    error: { code, message, retryable },
    requestId,
  };
  return jsonResponse(body, status, requestId);
}

function bearerToken(request: Request): string | null {
  const match = (request.headers.get('Authorization') ?? '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function parseRoute(request: Request): Route | null {
  const path = new URL(request.url).pathname;
  const match = path.match(
    /\/api\/v1\/tenants\/([^/]+)\/access\/(me|capabilities|roles|members|modules)(?:\/([^/]+))?\/?$/,
  );
  if (!match?.[1] || !match[2] || !uuidPattern.test(match[1])) return null;
  if (match[3] && match[2] !== 'roles') return null;
  const tenantId = parseId<'TenantId'>(match[1]);
  if (!tenantId.ok) return null;
  return {
    tenantId: tenantId.value,
    resource: match[2] as Route['resource'],
    ...(match[3] ? { resourceId: decodeURIComponent(match[3]) } : {}),
  };
}

function statusFor(error: AppError): number {
  if (error.code === 'identity.invalid_token' || error.code === 'identity.session_expired' ||
      error.code === 'identity.not_authenticated') return 401;
  if (error.code === 'access_management.not_found' || error.code === 'tenant.not_found') return 404;
  if (error.code.endsWith('.provider_unavailable') ||
      error.code === 'access_management.invalid_legacy_data') return 503;
  return 403;
}

function platformError(requestId: RequestId, error: AppError): Response {
  return errorResponse(
    requestId,
    statusFor(error),
    error.code,
    error.message,
    error.retryable,
  );
}

export async function handleAccessManagementRequest(
  request: Request,
  dependencies: AccessManagementHttpDependencies,
  options: AccessManagementHttpOptions = {},
): Promise<Response> {
  const requestId = createRequestId(
    options.requestId ?? request.headers.get('X-Request-Id') ?? undefined,
  );
  if (request.method === 'OPTIONS') return jsonResponse(undefined, 204, requestId);
  if (request.method !== 'GET') {
    return errorResponse(
      requestId,
      405,
      'api.method_not_allowed',
      'This increment only supports GET requests.',
    );
  }

  const route = parseRoute(request);
  if (!route) {
    return errorResponse(requestId, 404, 'api.route_not_found', 'The API route was not found.');
  }
  const token = bearerToken(request);
  if (!token) {
    return errorResponse(
      requestId,
      401,
      'identity.not_authenticated',
      'A Bearer access token is required.',
    );
  }

  try {
    const authenticated = await dependencies.identity.verifyToken(token);
    if (authenticated.ok === false) return platformError(requestId, authenticated.error);
    const membership = await dependencies.tenants.requireMembership(
      authenticated.value.identity.id,
      route.tenantId,
    );
    if (membership.ok === false) return platformError(requestId, membership.error);

    const actor: ActorContext = {
      kind: 'user',
      userId: authenticated.value.identity.id,
      tenantId: route.tenantId,
      requestId,
    };

    if (route.resource === 'me') {
      const result = await dependencies.queries.getMyTenantAccess(actor);
      return result.ok === false
        ? platformError(requestId, result.error)
        : jsonResponse(result.value, 200, requestId);
    }
    if (route.resource === 'modules') {
      const result = await dependencies.queries.listModules(actor);
      return result.ok === false
        ? platformError(requestId, result.error)
        : jsonResponse({ items: result.value }, 200, requestId);
    }
    if (route.resource === 'capabilities') {
      const result = await dependencies.queries.listCapabilityCatalog(actor);
      return result.ok === false
        ? platformError(requestId, result.error)
        : jsonResponse({ items: result.value }, 200, requestId);
    }
    if (route.resource === 'members') {
      const result = await dependencies.queries.listMemberAssignments(actor);
      return result.ok === false
        ? platformError(requestId, result.error)
        : jsonResponse({ items: result.value, nextCursor: null }, 200, requestId);
    }
    if (route.resourceId) {
      if (!uuidPattern.test(route.resourceId)) {
        return errorResponse(requestId, 400, 'api.invalid_request', 'The role identifier must be a UUID.');
      }
      const roleId = parseId<'RoleId'>(route.resourceId);
      if (!roleId.ok) {
        return errorResponse(requestId, 400, 'api.invalid_request', 'The role identifier is invalid.');
      }
      const result = await dependencies.queries.getRole(actor, roleId.value);
      return result.ok === false
        ? platformError(requestId, result.error)
        : jsonResponse(result.value, 200, requestId);
    }
    const status = new URL(request.url).searchParams.get('status') ?? 'active';
    if (status !== 'active' && status !== 'archived' && status !== 'all') {
      return errorResponse(
        requestId,
        400,
        'api.invalid_request',
        'The role status filter is invalid.',
      );
    }
    const result = await dependencies.queries.listRoles(actor, status);
    return result.ok === false
      ? platformError(requestId, result.error)
      : jsonResponse({ items: result.value }, 200, requestId);
  } catch {
    return errorResponse(
      requestId,
      500,
      'api.internal_error',
      'The request could not be completed.',
      true,
    );
  }
}
