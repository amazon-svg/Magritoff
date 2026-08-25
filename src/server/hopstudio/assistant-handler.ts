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
  onUnexpectedError?: (error: unknown) => void;
}>;

/**
 * Façade HTTP autonome du chat HopeStudio.
 *
 * Elle utilise uniquement les standards Web Request/Response : elle peut être
 * montée dans un serveur Node, Deno ou autre runtime sans passer par Supabase.
 */
export function createHopeStudioAssistantHandler(options: HopeStudioAssistantHandlerOptions) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/v1/assistant/chat') {
      return problem(404, 'api.not_found', 'Ressource introuvable');
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return problem(400, 'api.invalid_json', 'Corps JSON invalide');
    }

    const command = assistantChatCommandSchema.safeParse(payload);
    if (!command.success) {
      return problem(422, 'api.validation_failed', 'Requête assistant invalide');
    }

    const identity = await options.identityResolver.resolve(request, {
      ...(command.data.tenantId ? { tenantId: command.data.tenantId } : {}),
      ...(command.data.shopSlug ? { shopSlug: command.data.shopSlug } : {}),
    });
    if (!identity) {
      return problem(401, 'identity.authentication_required', 'Authentification requise');
    }

    try {
      const result = await options.gateway.chat({
        messages: command.data.messages,
        tenantId: identity.tenantId,
        userId: identity.userId,
        signal: request.signal,
      });
      return request.headers.get('accept')?.includes('text/event-stream')
        ? doneEvent(result)
        : Response.json(result);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return problem(499, 'assistant.request_aborted', 'Requête assistant annulée');
      }
      options.onUnexpectedError?.(error);
      return problem(
        502,
        'assistant.hopstudio_unavailable',
        error instanceof Error ? error.message : 'HopeStudio indisponible',
      );
    }
  };
}

function doneEvent(payload: unknown): Response {
  return new Response(`event: done\ndata: ${JSON.stringify(payload)}\n\n`, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

function problem(status: number, code: string, detail: string): Response {
  return Response.json(
    {
      type: 'about:blank',
      title: status === 401 ? 'Authentification requise' : 'Assistant indisponible',
      status,
      code,
      detail,
      requestId: crypto.randomUUID(),
    },
    { status, headers: { 'Content-Type': 'application/problem+json; charset=utf-8' } },
  );
}

