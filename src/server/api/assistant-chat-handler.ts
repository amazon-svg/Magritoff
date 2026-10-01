import { parseId, type RequestId, type UserId } from '../../kernel/ids/index.ts';
import { assistantChatCommandSchema } from '../../modules/diagnostics/api/contracts.ts';
import { AiCompletionUnavailableError } from '../../modules/diagnostics/application/ai-completion-gateway.ts';
import type { AssistantChatService } from '../../modules/diagnostics/application/assistant-chat-service.ts';
import type { ActorResolver } from './api-v1-handler.ts';

export type AssistantChatHandlerOptions = Readonly<{
  service: AssistantChatService;
  actorResolver?: ActorResolver;
  authorizeTenant(actor: UserId, tenantId: string): Promise<boolean>;
  authorizeShop?(request: Request, shopSlug: string): Promise<Readonly<{
    userId: string;
    tenantId: string;
  }> | null>;
}>;

export function createAssistantChatHandler(options: AssistantChatHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return problem(400, 'api.invalid_json', 'Corps JSON invalide.', requestId);
    }
    const parsed = assistantChatCommandSchema.safeParse(payload);
    if (!parsed.success) {
      const details = parsed.error.issues.slice(0, 3)
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join(' ; ');
      return problem(422, 'api.validation_failed', `Requête assistant invalide — ${details}`, requestId);
    }

    if (parsed.data.shopSlug) {
      const storefront = options.authorizeShop
        ? await options.authorizeShop(request, parsed.data.shopSlug)
        : null;
      if (!storefront) {
        return problem(401, 'storefront.session_required', 'Une session valide pour cette boutique est requise.', requestId);
      }
    } else {
      const tenantId = parsed.data.tenantId ?? null;
      if (!tenantId || !options.actorResolver) {
        return problem(401, 'identity.authentication_required', 'Authentification requise.', requestId);
      }
      const typedRequestId = parseId<'RequestId'>(requestId);
      if (!typedRequestId.ok) return problem(400, 'api.invalid_request_id', 'Identifiant de requête invalide.', requestId);
      const actor = await options.actorResolver.resolve(request, {
        requestId: typedRequestId.value as RequestId,
        params: { tenantId },
      });
      if (actor?.kind !== 'user') {
        return problem(401, 'identity.authentication_required', 'Authentification requise.', requestId);
      }
      if (!await options.authorizeTenant(actor.userId, tenantId)) {
        return problem(403, 'assistant.permission_denied', 'Accès assistant interdit pour cet espace.', requestId);
      }
    }

    try {
      const result = await options.service.generate(parsed.data);
      if (request.headers.get('accept')?.includes('text/event-stream')) {
        return sse(result, requestId);
      }
      return Response.json(result, { headers: { 'x-request-id': requestId } });
    } catch (error) {
      if (error instanceof AiCompletionUnavailableError) {
        const status = error.code === 'not_configured' ? 503 : 502;
        return problem(status, `assistant.${error.code}`, error.message, requestId);
      }
      if (error instanceof SyntaxError) {
        return problem(502, 'assistant.invalid_response', 'Le fournisseur IA a renvoyé une réponse JSON invalide.', requestId);
      }
      return problem(502, 'assistant.invalid_response', error instanceof Error ? error.message : 'Réponse IA inexploitable.', requestId);
    }
  };
}

export function isAssistantChatRequest(request: Request): boolean {
  return request.method === 'POST' && new URL(request.url).pathname === '/api/v1/assistant/chat';
}

function sse(payload: Awaited<ReturnType<AssistantChatService['generate']>>, requestId: string): Response {
  const encoder = new TextEncoder();
  const summary = payload.content[0]?.text ?? '';
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (summary) controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: summary })}\n\n`));
      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(payload)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'x-request-id': requestId,
    },
  });
}

function problem(status: number, code: string, detail: string, requestId: string): Response {
  return Response.json({
    type: 'about:blank',
    title: 'Assistant indisponible',
    status,
    code,
    detail,
    requestId,
  }, {
    status,
    headers: {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'x-request-id': requestId,
    },
  });
}
