import { assistantChatCommandSchema } from '../../modules/diagnostics/api/contracts.ts';

export type AssistantStreamProxyOptions = Readonly<{
  legacyBaseUrl: string;
  authorization?: string;
  userId?: string;
  authorizeTenant?: (tenantId: string) => Promise<boolean>;
  authorizeShop?: (shopSlug: string) => Promise<Readonly<{ userId: string; tenantId: string }> | null>;
  fetchImplementation?: typeof fetch;
}>;

export async function proxyAssistantChat(request: Request, options: AssistantStreamProxyOptions): Promise<Response> {
  let payload: unknown;
  try { payload = await request.json(); } catch { return problem(400, 'api.invalid_json', 'Corps JSON invalide'); }
  const parsed = assistantChatCommandSchema.safeParse(payload);
  if (!parsed.success) return problem(
    422,
    'api.validation_failed',
    `Requête assistant invalide — ${parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join(' ; ')}`,
  );
  let userId = options.userId;
  let tenantId = parsed.data.tenantId ?? undefined;
  if (parsed.data.shopSlug) {
    const storefront = options.authorizeShop
      ? await options.authorizeShop(parsed.data.shopSlug)
      : null;
    if (!storefront) {
      return problem(403, 'assistant.permission_denied', 'Accès assistant interdit pour cette boutique');
    }
    userId = storefront.userId;
    tenantId = storefront.tenantId;
  } else if (tenantId && options.authorizeTenant && !await options.authorizeTenant(tenantId)) {
    return problem(403, 'assistant.permission_denied', 'Accès assistant interdit pour ce tenant');
  }
  if (!userId) return problem(401, 'identity.authentication_required', 'Authentification requise');
  const streaming = request.headers.get('accept')?.includes('text/event-stream') ?? false;
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  try {
    const {
      shopSlug: _shopSlug,
      sessionRef: _sessionRef,
      sessionDataRef: _sessionDataRef,
      ...upstreamCommand
    } = parsed.data;
    const upstream = await fetchImplementation(`${options.legacyBaseUrl}/${streaming ? 'claude-proxy-stream' : 'claude-proxy'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.authorization ? { Authorization: options.authorization } : {}), ...(streaming ? { Accept: 'text/event-stream' } : {}) },
      body: JSON.stringify({ ...upstreamCommand, tenantId, userId }),
      signal: request.signal,
    });
    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') ?? (streaming ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8'));
    headers.set('Cache-Control', 'no-cache, no-transform');
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return problem(502, 'assistant.upstream_unavailable', error instanceof Error ? error.message : 'Assistant indisponible');
  }
}

function problem(status: number, code: string, detail: string): Response {
  return Response.json({ type: 'about:blank', title: 'Assistant indisponible', status, code, detail, requestId: crypto.randomUUID() }, { status, headers: { 'Content-Type': 'application/problem+json; charset=utf-8' } });
}

export function isAssistantChatRequest(request: Request): boolean {
  const url = new URL(request.url);
  return request.method === 'POST' && (url.pathname === '/api/v1/assistant/chat' || url.pathname.endsWith('/api/v1/assistant/chat'));
}
