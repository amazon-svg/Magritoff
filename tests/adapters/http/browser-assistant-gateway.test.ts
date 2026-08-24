import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserApiAssistantGateway } from '../../../src/adapters/http/browser-assistant-gateway';
import { AssistantStreamError } from '../../../src/modules/diagnostics';

describe('BrowserApiAssistantGateway', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('décode les deltas et retourne le payload done', async () => {
    const fetchMock = vi.fn(async () => new Response([
      'event: delta',
      'data: {"text":"Bon"}',
      '',
      'event: delta',
      'data: {"text":"jour"}',
      '',
      'event: done',
      'data: {"configs":[],"demoMode":false}',
      '',
      '',
    ].join('\n')));
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const result = await new BrowserApiAssistantGateway().send({
      accessToken: 'token-test',
      streaming: true,
      body: { messages: [] },
      signal: new AbortController().signal,
      onDelta: (delta) => deltas.push(delta),
    });

    expect(deltas).toEqual(['Bon', 'jour']);
    expect(result).toEqual({ configs: [], demoMode: false });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/assistant/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    }));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({ Authorization: 'Bearer token-test', Accept: 'text/event-stream' });
  });

  it('classe une réponse 402 comme erreur billing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('payment required', { status: 402 })));

    await expect(new BrowserApiAssistantGateway().send({
      accessToken: 'token-test',
      streaming: false,
      body: {},
      signal: new AbortController().signal,
    })).rejects.toMatchObject<Partial<AssistantStreamError>>({ kind: 'billing', status: 402 });
  });

  it('laisse le cookie HttpOnly porter une requête storefront', async () => {
    const fetchMock = vi.fn(async () => Response.json({ configs: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await new BrowserApiAssistantGateway(false).send({
      streaming: false,
      body: { messages: [{ role: 'user', content: 'Bonjour' }], shopSlug: 'boutique-test' },
      signal: new AbortController().signal,
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).not.toHaveProperty('Authorization');
  });

  it('refuse un bearer Magrit sur le transport storefront', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(new BrowserApiAssistantGateway(false).send({
      accessToken: 'token-interdit',
      streaming: false,
      body: { shopSlug: 'boutique-test' },
      signal: new AbortController().signal,
    })).rejects.toMatchObject<Partial<AssistantStreamError>>({ kind: 'protocol' });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
