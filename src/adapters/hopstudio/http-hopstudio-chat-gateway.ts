import {
  hopStudioChatRequestSchema,
  type HopeStudioChatResult,
} from '../../modules/hopstudio/api/contracts.ts';
import {
  HopeStudioChatUnavailableError,
  type HopeStudioChatGateway,
  type HopeStudioChatGatewayRequest,
  type HopeStudioTraceSink,
} from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';
import { normalizeHopeStudioChatResponse } from './normalize-hopstudio-chat.ts';
import type { HopeStudioTenantConnection } from '../../modules/hopstudio/application/hopstudio-tenant-connection.ts';
import {
  noopExternalServiceRequestRegistry,
  type ExternalServiceRequestCompletion,
  type ExternalServiceRequestRegistry,
} from '../../modules/external-services/application/external-service-request-registry.ts';

const DEFAULT_CHAT_ID = 'hopes-chat-to-product-UI-full-lib';
const HOPSTUDIO_REQUEST_TIMEOUT_MS = 50_000;
export const HOPSTUDIO_CLARIPRINT_HEADERS = Object.freeze({
  user: 'X-CLARIPRINT-USER',
  password: 'X-CLARIPRINT-PASS',
  url: 'X-CLARIPRINT-URL',
});

export type HttpHopeStudioConnection = Omit<HopeStudioTenantConnection, 'tenantId'>;

export class HttpHopeStudioChatGateway implements HopeStudioChatGateway {
  private readonly endpoint: string;
  private readonly apiToken: string | null;
  private readonly clariprint: NonNullable<HttpHopeStudioConnection['clariprint']> | null;

  constructor(
    connection: string | HttpHopeStudioConnection,
    apiToken: string | null = null,
    private readonly chatId: string = DEFAULT_CHAT_ID,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly trace: HopeStudioTraceSink = () => {},
    private readonly registry: ExternalServiceRequestRegistry = noopExternalServiceRequestRegistry,
  ) {
    this.endpoint = normalizeEndpoint(typeof connection === 'string' ? connection : connection.hopeStudioUrl);
    this.apiToken = typeof connection === 'string' ? apiToken : connection.apiToken ?? null;
    this.clariprint = typeof connection === 'string' ? null : connection.clariprint ?? null;
  }

  async chat(request: HopeStudioChatGatewayRequest): Promise<HopeStudioChatResult> {
    const { signal, traceId = crypto.randomUUID(), ...input } = request;
    const parsed = hopStudioChatRequestSchema.parse(input);
    const prompt = [...parsed.messages].reverse().find((message) => message.role === 'user')?.content;
    if (!prompt) throw new HopeStudioChatUnavailableError('Aucun message utilisateur à transmettre à HopeStudio.');
    const chatStartedAt = Date.now();

    const form = new URLSearchParams({
      action: 'CallAI',
      id: this.chatId,
      parameters_value: JSON.stringify({
        prompt,
        session: {
          tenant_id: parsed.tenantId,
          user_id: parsed.userId,
          ...(parsed.sessionRef ? { session_id: parsed.sessionRef } : {}),
          ...(parsed.sessionDataRef ? { DBK: parsed.sessionDataRef } : {}),
        },
      }),
    });

    try {
      this.emit(traceId, 'call_ai.start', {
        endpoint: safeEndpoint(this.endpoint),
        chatId: this.chatId,
        promptLength: prompt.length,
        messageCount: parsed.messages.length,
        tenantId: parsed.tenantId,
        userId: maskIdentifier(parsed.userId),
        hasSessionRef: Boolean(parsed.sessionRef),
        hasSessionDataRef: Boolean(parsed.sessionDataRef),
        hasClariprintCredentials: Boolean(this.clariprint),
        hasClariprintUrl: Boolean(this.clariprint?.url),
      });
      const payload = await this.postForm(form, signal, {
        traceId,
        tenantId: parsed.tenantId,
        userId: parsed.userId,
      });
      const result = normalizeHopeStudioChatResponse(
        await this.hydrateDeckReferences(payload, parsed.tenantId, parsed.userId, signal, traceId),
      );
      this.emit(traceId, 'call_ai.completed', {
        elapsedMs: Date.now() - chatStartedAt,
        configCount: result.configs.length,
        hasSessionRef: Boolean(result.sessionRef),
        hasSessionDataRef: Boolean(result.sessionDataRef),
      });
      return result;
    } catch (error) {
      this.emit(traceId, 'call_ai.failed', {
        elapsedMs: Date.now() - chatStartedAt,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof HopeStudioChatUnavailableError) throw error;
      if ((error as Error).name === 'AbortError') throw error;
      throw new HopeStudioChatUnavailableError('Réponse JSON HopeStudio illisible.');
    }
  }

  private async hydrateDeckReferences(
    payload: unknown,
    tenantId: string,
    userId: string,
    signal: AbortSignal,
    traceId: string,
  ): Promise<unknown> {
    const response = asRecord(asRecord(payload).response);
    const event = asRecord(response.event);
    if (!Array.isArray(event.deck)) return payload;

    const references = event.deck.filter((card): card is string => typeof card === 'string' && card.trim() !== '');
    if (references.length === 0) return payload;
    if (references.length > 50) {
      throw new HopeStudioChatUnavailableError('HopeStudio a retourné trop de cartes produit.');
    }

    const session = asRecord(response.session);
    const sessionId = firstString(session.UID, session.session_id);
    this.emit(traceId, 'cards.hydration.start', {
      referenceCount: references.length,
      hasSessionId: Boolean(sessionId),
    });
    const hydrated = await Promise.all(event.deck.map(async (card) => {
      if (typeof card !== 'string' || !card.trim()) return card;
      const cardPayload = asRecord(await this.postForm(new URLSearchParams({
        action: 'loadSessionParts',
        tenant_id: firstString(session.tenant_id) ?? tenantId,
        user_id: firstString(session.user_id) ?? userId,
        session_id: sessionId ?? '',
        event_id: '',
        data_key: card,
      }), signal, { traceId, tenantId, userId }));
      if (cardPayload.status !== 'ok' || !isRecord(cardPayload.datas)) {
        throw new HopeStudioChatUnavailableError(
          `La carte HopeStudio ${card} ne peut pas être chargée.`,
        );
      }
      return cardPayload.datas;
    }));
    this.emit(traceId, 'cards.hydration.completed', { referenceCount: references.length });

    return {
      ...asRecord(payload),
      response: {
        ...response,
        event: { ...event, deck: hydrated },
      },
    };
  }

  private async postForm(
    form: URLSearchParams,
    signal: AbortSignal,
    context: Readonly<{ traceId: string; tenantId: string; userId: string }>,
  ): Promise<unknown> {
    const { traceId, tenantId, userId } = context;
    const action = form.get('action') ?? 'unknown';
    const startedAt = Date.now();
    const registryId = crypto.randomUUID();
    const requestPayload = formPayload(form);
    await this.registryStart({
      id: registryId,
      correlationId: traceId,
      tenantId,
      userId,
      provider: 'hopstudio',
      operation: action,
      method: 'POST',
      url: safeEndpoint(this.endpoint),
      requestPayload,
      requestSizeBytes: byteLength(JSON.stringify(requestPayload)),
      startedAt: new Date(startedAt).toISOString(),
      metadata: { chatId: action === 'CallAI' ? this.chatId : null },
    }, traceId);
    let response: Response;
    try {
      response = await this.fetchImplementation(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
          ...(this.clariprint ? {
            [HOPSTUDIO_CLARIPRINT_HEADERS.user]: this.clariprint.user,
            [HOPSTUDIO_CLARIPRINT_HEADERS.password]: this.clariprint.password,
            ...(this.clariprint.url
              ? { [HOPSTUDIO_CLARIPRINT_HEADERS.url]: this.clariprint.url }
              : {}),
          } : {}),
        },
        body: form.toString(),
        signal: AbortSignal.any([signal, AbortSignal.timeout(HOPSTUDIO_REQUEST_TIMEOUT_MS)]),
      });
    } catch (error) {
      const timeout = (error as Error).name === 'TimeoutError';
      await this.registryComplete({
        id: registryId,
        state: timeout ? 'timeout' : 'network_error',
        durationMs: Date.now() - startedAt,
        errorCode: timeout ? 'timeout' : 'network_error',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      }, traceId);
      this.emit(traceId, 'http.failed', {
        action,
        elapsedMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        error: error instanceof Error ? error.message : String(error),
      });
      if ((error as Error).name === 'AbortError') throw error;
      if ((error as Error).name === 'TimeoutError') {
        throw new HopeStudioChatUnavailableError(
          `HopeStudio n’a pas répondu sous ${HOPSTUDIO_REQUEST_TIMEOUT_MS / 1_000} secondes.`,
        );
      }
      throw new HopeStudioChatUnavailableError(
        error instanceof Error ? error.message : 'HopeStudio est indisponible.',
      );
    }
    this.emit(traceId, 'http.response', {
      action,
      elapsedMs: Date.now() - startedAt,
      status: response.status,
      contentType: response.headers.get('content-type'),
    });
    let responseText: string;
    try {
      responseText = await response.text();
    } catch (error) {
      await this.registryComplete({
        id: registryId,
        state: 'network_error',
        httpStatus: response.status,
        responseContentType: response.headers.get('content-type'),
        durationMs: Date.now() - startedAt,
        errorCode: 'response_body_unreadable',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      }, traceId);
      throw new HopeStudioChatUnavailableError('Corps de réponse HopeStudio illisible.');
    }
    if (!response.ok) {
      await this.registryComplete({
        id: registryId,
        state: 'http_error',
        httpStatus: response.status,
        responsePayload: parseJsonOrText(responseText),
        responseSizeBytes: byteLength(responseText),
        responseContentType: response.headers.get('content-type'),
        durationMs: Date.now() - startedAt,
        errorCode: `http_${response.status}`,
        errorMessage: `HopeStudio a répondu HTTP ${response.status}.`,
        completedAt: new Date().toISOString(),
      }, traceId);
      this.emit(traceId, 'http.error_body', {
        action,
        bodyLength: responseText.length,
        bodyPreview: safeBodyPreview(responseText),
      });
      throw new HopeStudioChatUnavailableError(
        `HopeStudio a répondu HTTP ${response.status}.`,
        response.status,
      );
    }
    try {
      const payload = JSON.parse(responseText) as unknown;
      const usage = extractTokenUsage(payload);
      await this.registryComplete({
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
      }, traceId);
      this.emit(traceId, 'http.parsed', {
        action,
        bodyLength: responseText.length,
        payloadShape: describePayloadShape(payload),
      });
      return payload;
    } catch {
      await this.registryComplete({
        id: registryId,
        state: 'invalid_response',
        httpStatus: response.status,
        responsePayload: { preview: safeBodyPreview(responseText) },
        responseSizeBytes: byteLength(responseText),
        responseContentType: response.headers.get('content-type'),
        durationMs: Date.now() - startedAt,
        errorCode: 'invalid_json',
        errorMessage: 'Réponse JSON HopeStudio illisible.',
        completedAt: new Date().toISOString(),
      }, traceId);
      this.emit(traceId, 'http.invalid_json', {
        action,
        bodyLength: responseText.length,
        bodyPreview: safeBodyPreview(responseText),
      });
      throw new HopeStudioChatUnavailableError('Réponse JSON HopeStudio illisible.');
    }
  }

  private emit(traceId: string, stage: string, details: Record<string, unknown>): void {
    this.trace({ traceId, stage, ...details });
  }

  private async registryStart(
    request: Parameters<ExternalServiceRequestRegistry['start']>[0],
    traceId: string,
  ): Promise<void> {
    try {
      await this.registry.start(request);
      this.emit(traceId, 'registry.started', { registryId: request.id, operation: request.operation });
    } catch (error) {
      this.emit(traceId, 'registry.start_failed', {
        registryId: request.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async registryComplete(
    request: ExternalServiceRequestCompletion,
    traceId: string,
  ): Promise<void> {
    try {
      await this.registry.complete(request);
      this.emit(traceId, 'registry.completed', { registryId: request.id, state: request.state });
    } catch (error) {
      this.emit(traceId, 'registry.complete_failed', {
        registryId: request.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new TypeError('HOPSTUDIO_URL est requis.');
  const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  if (!url.pathname || url.pathname === '/') url.pathname = '/json.wcl';
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function maskIdentifier(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function safeBodyPreview(value: string): string {
  return value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;"']+/gi, '$1[MASQUÉ]')
    .replace(/(x-clariprint-(?:user|pass)\s*[:=]\s*)[^\s,;"']+/gi, '$1[MASQUÉ]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 1_000);
}

function safeEndpoint(value: string): string {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`;
}

function describePayloadShape(payload: unknown): string {
  if (payload === null) return 'null';
  if (Array.isArray(payload)) return `array(${payload.length})`;
  if (typeof payload !== 'object') return typeof payload;
  const root = payload as Record<string, unknown>;
  const response = isRecord(root.response) ? root.response : null;
  return JSON.stringify({
    rootKeys: Object.keys(root).slice(0, 12),
    responseKeys: response ? Object.keys(response).slice(0, 12) : [],
  });
}

function formPayload(form: URLSearchParams): Record<string, unknown> {
  const payload = Object.fromEntries(form.entries()) as Record<string, unknown>;
  if (typeof payload.parameters_value === 'string') {
    payload.parameters_value = parseJsonOrText(payload.parameters_value);
  }
  return payload;
}

function parseJsonOrText(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function extractTokenUsage(payload: unknown): { inputTokens: number | null; outputTokens: number | null } {
  const root = asRecord(payload);
  const response = asRecord(root.response);
  const usage = Object.keys(asRecord(root.usage)).length > 0
    ? asRecord(root.usage)
    : asRecord(response.usage);
  return {
    inputTokens: nonNegativeInteger(usage.input_tokens, usage.inputTokens),
    outputTokens: nonNegativeInteger(usage.output_tokens, usage.outputTokens),
  };
}

function nonNegativeInteger(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}
