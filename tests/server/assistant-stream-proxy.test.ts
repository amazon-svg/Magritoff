import { describe, expect, it, vi } from 'vitest';
import { proxyAssistantChat } from '@/server/api/assistant-stream-proxy';

function request(body: unknown, streaming = true) {
  return new Request('https://magrit.test/api/v1/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(streaming ? { Accept: 'text/event-stream' } : {}) }, body: JSON.stringify(body) });
}

describe('façade streaming assistant', () => {
  it('relaie le flux SSE sans exposer l’URL legacy au navigateur', async () => {
    const upstream = 'event: delta\ndata: {"text":"Bon"}\n\nevent: done\ndata: {"configs":[]}\n\n';
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ userId: 'user-server', tenantId: 'tenant-1', messages: [{ role: 'user', content: 'Bonjour' }] });
      return new Response(upstream, { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const response = await proxyAssistantChat(request({ messages: [{ role: 'user', content: 'Bonjour' }], tenantId: 'tenant-1' }), { legacyBaseUrl: 'http://legacy.test', authorization: 'Bearer session', userId: 'user-server', authorizeTenant: async () => true, fetchImplementation: fetchMock as unknown as typeof fetch });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(await response.text()).toBe(upstream);
    expect(fetchMock).toHaveBeenCalledWith('http://legacy.test/claude-proxy-stream', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer session' }) }));
  });

  it('utilise la variante JSON lorsque le streaming est désactivé', async () => {
    const fetchMock = vi.fn(async () => Response.json({ configs: [] }));
    const response = await proxyAssistantChat(request({ messages: [{ role: 'user', content: 'Bonjour' }] }, false), { legacyBaseUrl: 'http://legacy.test', authorization: 'Bearer session', userId: 'user-server', fetchImplementation: fetchMock as unknown as typeof fetch });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('http://legacy.test/claude-proxy', expect.any(Object));
  });

  it('bloque un tenant non autorisé avant le proxy', async () => {
    const fetchMock = vi.fn();
    const response = await proxyAssistantChat(request({ messages: [{ role: 'user', content: 'Bonjour' }], tenantId: 'tenant-2' }), { legacyBaseUrl: 'http://legacy.test', authorization: 'Bearer session', userId: 'user-server', authorizeTenant: async () => false, fetchImplementation: fetchMock as unknown as typeof fetch });
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('autorise une session storefront limitée à la boutique demandée', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        userId: 'customer-account',
        tenantId: 'tenant-shop',
        messages: [{ role: 'user', content: 'Bonjour' }],
      });
      expect(String(init?.body)).not.toContain('shopSlug');
      return Response.json({ configs: [] });
    });
    const response = await proxyAssistantChat(
      request({ messages: [{ role: 'user', content: 'Bonjour' }], shopSlug: 'boutique-test' }, false),
      {
        legacyBaseUrl: 'http://legacy.test',
        authorization: 'Bearer anon-key',
        authorizeShop: async (shopSlug) => shopSlug === 'boutique-test'
          ? { userId: 'customer-account', tenantId: 'tenant-shop' }
          : null,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      },
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('bloque une session storefront utilisée sur une autre boutique', async () => {
    const fetchMock = vi.fn();
    const response = await proxyAssistantChat(
      request({ messages: [{ role: 'user', content: 'Bonjour' }], shopSlug: 'boutique-tierce' }),
      {
        legacyBaseUrl: 'http://legacy.test',
        authorizeShop: async () => null,
        fetchImplementation: fetchMock as unknown as typeof fetch,
      },
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('valide le contrat avant toute consommation IA', async () => {
    const fetchMock = vi.fn();
    const response = await proxyAssistantChat(request({ messages: [] }), { legacyBaseUrl: 'http://legacy.test', authorization: 'Bearer session', userId: 'user-server', fetchImplementation: fetchMock as unknown as typeof fetch });
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
