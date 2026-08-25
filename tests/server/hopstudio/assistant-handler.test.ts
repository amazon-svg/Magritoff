import { describe, expect, it, vi } from 'vitest';
import { createHopeStudioAssistantHandler } from '@/server/hopstudio';

const result = {
  success: true as const,
  configs: [],
  teachingNote: null,
  demoMode: false as const,
  provider: 'hopstudio' as const,
  sessionRef: null,
};

function request(streaming = false) {
  return new Request('https://adapter.test/api/v1/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(streaming ? { Accept: 'text/event-stream' } : {}),
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Bonjour' }],
      tenantId: 'tenant-demandé',
    }),
  });
}

describe('façade HTTP autonome HopeStudio', () => {
  it('utilise exclusivement l’identité résolue par le serveur', async () => {
    const chat = vi.fn(async () => result);
    const handler = createHopeStudioAssistantHandler({
      gateway: { chat },
      identityResolver: {
        async resolve(_request, context) {
          expect(context.tenantId).toBe('tenant-demandé');
          return { tenantId: 'tenant-autorisé', userId: 'user-autorisé' };
        },
      },
    });

    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-autorisé',
      userId: 'user-autorisé',
    }));
  });

  it('convertit le résultat en événement SSE done', async () => {
    const handler = createHopeStudioAssistantHandler({
      gateway: { async chat() { return result; } },
      identityResolver: { async resolve() { return { tenantId: 'tenant', userId: 'user' }; } },
    });

    const response = await handler(request(true));
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(await response.text()).toContain('event: done');
  });

  it('refuse une requête sans identité vérifiée', async () => {
    const chat = vi.fn();
    const handler = createHopeStudioAssistantHandler({
      gateway: { chat },
      identityResolver: { async resolve() { return null; } },
    });

    const response = await handler(request());
    expect(response.status).toBe(401);
    expect(chat).not.toHaveBeenCalled();
  });
});

