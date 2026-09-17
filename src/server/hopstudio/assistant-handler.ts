import { assistantChatCommandSchema } from '../../modules/diagnostics/api/contracts.ts';
import type { HopeStudioChatGateway } from '../../modules/hopstudio/application/hopstudio-chat-gateway.ts';

export type HopeStudioAssistantIdentity = Readonly<{
  userId: string;
  tenantId: string;
}>;

export interface HopeStudioAssistantIdentityResolver {
  resolve(
    request: Request,
    context: Readonly<{ tenantId?: string; shopSlug?: string }>,
  ): Promise<HopeStudioAssistantIdentity | null>;
}

export type HopeStudioAssistantHandlerOptions = Readonly<{
  gateway: HopeStudioChatGateway;
  identityResolver: HopeStudioAssistantIdentityResolver;
  onUnexpectedError?: (
    error: unknown,
    context: Readonly<{ requestId: string; tenantId: string; userId: string }>,
  ) => void;
}>;

/**
 * Façade HTTP autonome du chat HopeStudio.
 *
 * Elle utilise uniquement les standards Web Request/Response : elle peut être
 * montée dans un serveur Node, Deno ou autre runtime sans passer par Supabase.
 */
export function createHopeStudioAssistantHandler(options: HopeStudioAssistantHandlerOptions) {
  return async function handle(request: Request): Promise<Response> {
    const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/v1/assistant/chat') {
      return problem(404, 'api.not_found', 'Ressource introuvable', requestId);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return problem(400, 'api.invalid_json', 'Corps JSON invalide', requestId);
    }

    const command = assistantChatCommandSchema.safeParse(payload);
    if (!command.success) {
      return problem(422, 'api.validation_failed', validationDetail(command.error.issues), requestId);
    }

    const identity = await options.identityResolver.resolve(request, {
      ...(command.data.tenantId ? { tenantId: command.data.tenantId } : {}),
      ...(command.data.shopSlug ? { shopSlug: command.data.shopSlug } : {}),
    });
    if (!identity) {
      return problem(401, 'identity.authentication_required', 'Authentification requise', requestId);
    }

    try {
      const result = await options.gateway.chat({
        messages: command.data.messages,
        tenantId: identity.tenantId,
        userId: identity.userId,
        traceId: requestId,
        ...(command.data.sessionRef ? { sessionRef: command.data.sessionRef } : {}),
        ...(command.data.sessionDataRef ? { sessionDataRef: command.data.sessionDataRef } : {}),
        signal: request.signal,
      });
      return request.headers.get('accept')?.includes('text/event-stream')
        ? doneEvent(result, requestId)
        : Response.json(result, { headers: { 'X-Request-Id': requestId } });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return problem(499, 'assistant.request_aborted', 'Requête assistant annulée', requestId);
      }
      options.onUnexpectedError?.(error, {
        requestId,
        tenantId: identity.tenantId,
        userId: identity.userId,
      });
      return problem(
        502,
        'assistant.hopstudio_unavailable',
        error instanceof Error ? error.message : 'HopeStudio indisponible',
        requestId,
      );
    }
  };
}

function validationDetail(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  const details = issues.slice(0, 3).map((issue) => {
    const path = issue.path.map(String).join('.') || 'body';
    return `${path}: ${issue.message}`;
  });
  return `Requête assistant invalide — ${details.join(' ; ')}`;
}

function doneEvent(payload: unknown, requestId: string): Response {
  return new Response(`event: done\ndata: ${JSON.stringify(payload)}\n\n`, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Request-Id': requestId,
    },
  });
}

function problem(status: number, code: string, detail: string, requestId: string): Response {
  return Response.json(
    {
      type: 'about:blank',
      title: status === 401 ? 'Authentification requise' : 'Assistant indisponible',
      status,
      code,
      detail,
      requestId,
    },
    {
      status,
      headers: {
        'Content-Type': 'application/problem+json; charset=utf-8',
        'X-Request-Id': requestId,
      },
    },
  );
}
