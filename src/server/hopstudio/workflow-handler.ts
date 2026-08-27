import { hopeStudioWorkflowCommandSchema } from '../../modules/hopstudio/api/contracts.ts';
import {
  HopeStudioWorkflowUnavailableError,
  type HopeStudioWorkflowGateway,
} from '../../modules/hopstudio/application/hopstudio-workflow-gateway.ts';

const PATH = /^\/api\/v1\/tenants\/([^/]+)\/integrations\/hopstudio\/workflow\/?$/;

export type HopeStudioWorkflowHandlerOptions = Readonly<{
  userId: string;
  isTenantMember(tenantId: string): Promise<boolean>;
  gateway: HopeStudioWorkflowGateway;
  onTrace?: (event: Readonly<Record<string, unknown>>) => void;
}>;

export function isHopeStudioWorkflowRequest(request: Request): boolean {
  return request.method === 'POST' && PATH.test(new URL(request.url).pathname);
}

/** Façade Web standard, déployable indépendamment du runtime qui l'héberge. */
export async function handleHopeStudioWorkflow(
  request: Request,
  options: HopeStudioWorkflowHandlerOptions,
): Promise<Response> {
  const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
  const match = PATH.exec(new URL(request.url).pathname);
  const tenantId = decodeURIComponent(match?.[1] ?? '');
  if (!tenantId) return problem(404, 'api.not_found', 'Ressource introuvable', requestId);
  if (!await options.isTenantMember(tenantId)) {
    return problem(403, 'hopstudio.permission_denied', 'Accès HopeStudio interdit pour ce tenant', requestId);
  }

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return problem(400, 'api.invalid_json', 'Corps JSON invalide', requestId);
  }
  const command = hopeStudioWorkflowCommandSchema.safeParse(payload);
  if (!command.success) {
    return problem(422, 'api.validation_failed', 'Requête de workflow HopeStudio invalide', requestId);
  }
  if (command.data.context.tenantId !== tenantId) {
    return problem(403, 'hopstudio.tenant_mismatch', 'Le contexte ne correspond pas au tenant de la route', requestId);
  }

  const action = new URLSearchParams(command.data.context.body).get('action') ?? 'unknown';
  options.onTrace?.({ requestId, stage: 'callback.received', tenantId, userId: options.userId, action });
  try {
    const result = await options.gateway.execute({
      tenantId,
      userId: options.userId,
      traceId: requestId,
      body: command.data.context.body,
      signal: request.signal,
    });
    return Response.json(result, { headers: { 'X-Request-Id': requestId } });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return problem(499, 'hopstudio.request_aborted', 'Requête HopeStudio annulée', requestId);
    }
    return problem(
      502,
      'hopstudio.workflow_unavailable',
      error instanceof Error ? error.message : 'HopeStudio indisponible',
      requestId,
    );
  }
}

function problem(status: number, code: string, detail: string, requestId: string): Response {
  return Response.json({
    type: 'about:blank',
    title: 'Workflow HopeStudio indisponible',
    status,
    code,
    detail,
    requestId,
  }, {
    status,
    headers: {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'X-Request-Id': requestId,
    },
  });
}
