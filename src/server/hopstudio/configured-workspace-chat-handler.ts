import { TenantAwareHopeStudioChatGateway } from '../../adapters/hopstudio/tenant-aware-hopstudio-chat-gateway.ts';
import { assistantChatCommandSchema } from '../../modules/diagnostics/api/contracts.ts';
import type { HopeStudioTenantConnectionResolver } from '../../modules/hopstudio/application/hopstudio-tenant-connection.ts';
import type { HopeStudioTenantSettingsRepository } from '../../modules/hopstudio/application/hopstudio-tenant-settings-service.ts';
import { createHopeStudioAssistantHandler } from './assistant-handler.ts';
import type { HopeStudioTraceSink } from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';
import type { ExternalServiceRequestRegistry } from '../../modules/external-services/application/external-service-request-registry.ts';

export type ConfiguredWorkspaceChatStore =
  HopeStudioTenantSettingsRepository & HopeStudioTenantConnectionResolver;

export type ConfiguredWorkspaceChatOptions = Readonly<{
  userId: string;
  settings: ConfiguredWorkspaceChatStore;
  isTenantMember(tenantId: string): Promise<boolean>;
  fetchImplementation?: typeof fetch;
  onTrace?: HopeStudioTraceSink;
  registry?: ExternalServiceRequestRegistry;
  onRequestStart?: (context: Readonly<{
    requestId: string;
    tenantId: string;
    messageCount: number;
    hasSessionRef: boolean;
    hasSessionDataRef: boolean;
  }>) => void;
  onRequestCompleted?: (context: Readonly<{
    requestId: string;
    tenantId: string;
    status: number;
    durationMs: number;
  }>) => void;
  onUnexpectedError?: (
    error: unknown,
    context: Readonly<{ requestId: string; tenantId: string; userId: string }>,
  ) => void;
}>;

/**
 * Retourne null quand Clariprint Studio est désactivé : le compositeur peut
 * alors conserver le fournisseur assistant historique. Si l intégration est
 * activée, la requête est consommée exclusivement par HopeStudio.
 */
export async function tryHandleConfiguredWorkspaceChat(
  request: Request,
  options: ConfiguredWorkspaceChatOptions,
): Promise<Response | null> {
  let payload: unknown;
  try {
    payload = await request.clone().json();
  } catch {
    return null;
  }
  const command = assistantChatCommandSchema.safeParse(payload);
  const tenantId = command.success ? command.data.tenantId : null;
  if (!tenantId) return null;

  if (!await options.isTenantMember(tenantId)) {
    return problem(403, 'assistant.permission_denied', 'Accès assistant interdit pour ce tenant');
  }

  const settings = await options.settings.get(tenantId);
  if (!settings.enabled) return null;

  const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
  const startedAt = Date.now();
  options.onRequestStart?.({
    requestId,
    tenantId,
    messageCount: command.data.messages.length,
    hasSessionRef: Boolean(command.data.sessionRef),
    hasSessionDataRef: Boolean(command.data.sessionDataRef),
  });

  const handler = createHopeStudioAssistantHandler({
    gateway: new TenantAwareHopeStudioChatGateway(
      options.settings,
      options.fetchImplementation ?? globalThis.fetch,
      options.onTrace ?? (() => {}),
      options.registry,
    ),
    identityResolver: {
      async resolve() {
        return { tenantId, userId: options.userId };
      },
    },
    ...(options.onUnexpectedError
      ? { onUnexpectedError: options.onUnexpectedError }
      : {}),
  });
  const response = await handler(new Request(request, {
    headers: withRequestId(request.headers, requestId),
  }));
  options.onRequestCompleted?.({
    requestId,
    tenantId,
    status: response.status,
    durationMs: Date.now() - startedAt,
  });
  return response;
}

function withRequestId(headers: Headers, requestId: string): Headers {
  const next = new Headers(headers);
  next.set('X-Request-Id', requestId);
  return next;
}

function problem(status: number, code: string, detail: string): Response {
  return Response.json({
    type: 'about:blank',
    title: 'Accès assistant interdit',
    status,
    code,
    detail,
    requestId: crypto.randomUUID(),
  }, {
    status,
    headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
  });
}
