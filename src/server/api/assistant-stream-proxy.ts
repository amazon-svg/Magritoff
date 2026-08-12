import { assistantChatCommandSchema } from '../../modules/diagnostics/api/contracts.ts';

export type AssistantStreamProxyOptions = Readonly<{
  legacyBaseUrl: string;
  authorization: string;
  userId: string;
  authorizeTenant?: (tenantId: string) => Promise<boolean>;
  fetchImplementation?: typeof fetch;
}>;

export async function proxyAssistantChat(request: Request, options: AssistantStreamProxyOptions): Promise<Response> {
  let payload: unknown;
  try { payload = await request.json(); } catch { return problem(400, 'api.invalid_json', 'Corps JSON invalide'); }
  const parsed = assistantChatCommandSchema.safeParse(payload);
  if (!parsed.success) return problem(422, 'api.validation_failed', 'Requête assistant invalide');
  if (parsed.data.tenantId && options.authorizeTenant && !await options.authorizeTenant(parsed.data.tenantId)) {
    return problem(403, 'assistant.permission_denied', 'Accès assistant interdit pour ce tenant');
  }
  const streaming = request.headers.get('accept')?.includes('text/event-stream') ?? false;
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  try {
    const upstream = await fetchImplementation(`${options.legacyBaseUrl}/${streaming ? 'claude-proxy-stream' : 'claude-proxy'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: options.authorization, ...(streaming ? { Accept: 'text/event-stream' } : {}) },
      body: JSON.stringify({ ...parsed.data, userId: options.userId }),
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
