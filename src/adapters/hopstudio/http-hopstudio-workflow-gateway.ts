import {
  HopeStudioWorkflowUnavailableError,
  type HopeStudioWorkflowGateway,
  type HopeStudioWorkflowRequest,
} from '../../modules/hopstudio/application/hopstudio-workflow-gateway.ts';
import type { HopeStudioTenantConnectionResolver } from '../../modules/hopstudio/application/hopstudio-tenant-connection.ts';
import type { HopeStudioTraceSink } from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';
import {
  noopExternalServiceRequestRegistry,
  type ExternalServiceRequestRegistry,
} from '../../modules/external-services/application/external-service-request-registry.ts';
import { HOPSTUDIO_CLARIPRINT_HEADERS } from './http-hopstudio-chat-gateway.ts';

const REQUEST_TIMEOUT_MS = 50_000;

/**
 * Relais générique des actions émises par l'UX headless (CallAI,
 * loadSession, loadBasket...). L'endpoint et les secrets proviennent
 * exclusivement de la configuration serveur du tenant.
 */
export class HttpHopeStudioWorkflowGateway implements HopeStudioWorkflowGateway {
  constructor(
    private readonly connections: HopeStudioTenantConnectionResolver,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly trace: HopeStudioTraceSink = () => {},
    private readonly registry: ExternalServiceRequestRegistry = noopExternalServiceRequestRegistry,
  ) {}

  async execute(request: HopeStudioWorkflowRequest): Promise<unknown> {
    const connection = await this.connections.resolve(request.tenantId);
    if (!connection || connection.tenantId !== request.tenantId) {
      throw new HopeStudioWorkflowUnavailableError(
        'HopeStudio n est pas configuré pour ce tenant.',
      );
    }

    const endpoint = normalizeEndpoint(connection.hopeStudioUrl);
    const form = enforceIdentity(new URLSearchParams(request.body), request.tenantId, request.userId);
    const action = form.get('action')?.trim() || 'unknown';
    const startedAt = Date.now();
    const registryId = crypto.randomUUID();
    const requestPayload = safeFormPayload(form);

    await safely(() => this.registry.start({
      id: registryId,
      correlationId: request.traceId,
      tenantId: request.tenantId,
      userId: request.userId,
      provider: 'hopstudio',
      operation: action,
      method: 'POST',
      url: safeEndpoint(endpoint),
      requestPayload,
      requestSizeBytes: byteLength(form.toString()),
      startedAt: new Date(startedAt).toISOString(),
      metadata: { source: 'hlux.customApiFetch' },
    }));

    this.trace({
      traceId: request.traceId,
      stage: 'workflow.start',
      action,
      endpoint: safeEndpoint(endpoint),
      tenantId: request.tenantId,
      hasClariprintCredentials: Boolean(connection.clariprint),
      hasClariprintUrl: Boolean(connection.clariprint?.url),
    });

    let response: Response;
    try {
      response = await this.fetchImplementation(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(connection.apiToken ? { Authorization: `Bearer ${connection.apiToken}` } : {}),
          ...(connection.clariprint ? {
            [HOPSTUDIO_CLARIPRINT_HEADERS.user]: connection.clariprint.user,
            [HOPSTUDIO_CLARIPRINT_HEADERS.password]: connection.clariprint.password,
            ...(connection.clariprint.url
              ? { [HOPSTUDIO_CLARIPRINT_HEADERS.url]: connection.clariprint.url }
              : {}),
          } : {}),
        },
        body: form.toString(),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      });
    } catch (error) {
      const timeout = (error as Error).name === 'TimeoutError';
      await safely(() => this.registry.complete({
        id: registryId,
        state: timeout ? 'timeout' : 'network_error',
        durationMs: Date.now() - startedAt,
        errorCode: timeout ? 'timeout' : 'network_error',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      }));
      if ((error as Error).name === 'AbortError') throw error;
      throw new HopeStudioWorkflowUnavailableError(
        timeout ? 'HopeStudio n a pas répondu dans le délai attendu.' : 'HopeStudio est indisponible.',
      );
    }

    const responseText = await response.text();
    const payload = parseJsonOrText(responseText);
    if (!response.ok) {
      await safely(() => this.registry.complete({
        id: registryId,
        state: 'http_error',
        httpStatus: response.status,
        responsePayload: payload,
        responseSizeBytes: byteLength(responseText),
        responseContentType: response.headers.get('content-type'),
        durationMs: Date.now() - startedAt,
        errorCode: `http_${response.status}`,
        errorMessage: `HopeStudio a répondu HTTP ${response.status}.`,
        completedAt: new Date().toISOString(),
      }));
      throw new HopeStudioWorkflowUnavailableError(
        `HopeStudio a répondu HTTP ${response.status}.`,
        response.status,
      );
    }
    if (typeof payload === 'string') {
      await safely(() => this.registry.complete({
        id: registryId,
        state: 'invalid_response',
        httpStatus: response.status,
        responsePayload: { preview: payload.slice(0, 1_000) },
        responseSizeBytes: byteLength(responseText),
        responseContentType: response.headers.get('content-type'),
        durationMs: Date.now() - startedAt,
        errorCode: 'invalid_json',
        errorMessage: 'Réponse JSON HopeStudio illisible.',
        completedAt: new Date().toISOString(),
      }));
      throw new HopeStudioWorkflowUnavailableError('Réponse JSON HopeStudio illisible.');
    }

    const usage = tokenUsage(payload);
    await safely(() => this.registry.complete({
      id: registryId,
      state: 'succeeded',
      httpStatus: response.status,
      responsePayload: payload,
      responseSizeBytes: byteLength(responseText),
      responseContentType: response.headers.get('content-type'),
      durationMs: Date.now() - startedAt,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      completedAt: new Date().toISOString(),
    }));
    this.trace({
      traceId: request.traceId,
      stage: 'workflow.completed',
      action,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    });
    return payload;
  }
}

function enforceIdentity(form: URLSearchParams, tenantId: string, userId: string): URLSearchParams {
  form.set('tenant_id', tenantId);
  form.set('user_id', userId);
  const parametersValue = form.get('parameters_value');
  if (!parametersValue) return form;
  try {
    const parameters = JSON.parse(parametersValue) as Record<string, unknown>;
    const currentSession = isRecord(parameters.session) ? parameters.session : {};
    parameters.session = { ...currentSession, tenant_id: tenantId, user_id: userId };
    form.set('parameters_value', JSON.stringify(parameters));
  } catch {
    // Le serveur HopeStudio reste responsable des paramètres non JSON.
  }
  return form;
}

function normalizeEndpoint(value: string): string {
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (!url.pathname || url.pathname === '/') url.pathname = '/json.wcl';
  return url.toString();
}

function safeEndpoint(value: string): string {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`;
}

function safeFormPayload(form: URLSearchParams): Record<string, unknown> {
  const payload = Object.fromEntries(form.entries()) as Record<string, unknown>;
  if (typeof payload.parameters_value === 'string') {
    payload.parameters_value = parseJsonOrText(payload.parameters_value);
  }
  return payload;
}

function parseJsonOrText(value: string): unknown {
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

function tokenUsage(payload: unknown) {
  const root = isRecord(payload) ? payload : {};
  const response = isRecord(root.response) ? root.response : {};
  const usage = isRecord(root.usage) ? root.usage : isRecord(response.usage) ? response.usage : {};
  return {
    inputTokens: integer(usage.input_tokens, usage.inputTokens),
    outputTokens: integer(usage.output_tokens, usage.outputTokens),
  };
}

function integer(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function safely(operation: () => Promise<void>): Promise<void> {
  try { await operation(); } catch { /* Le registre ne bloque jamais l'appel métier. */ }
}
