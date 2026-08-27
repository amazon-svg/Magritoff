import { describe, expect, it, vi } from 'vitest';
import { createHopeStudioAssistantHandler } from '@/server/hopstudio';

const result = {
  success: true as const,
  configs: [],
  teachingNote: null,
  demoMode: false as const,
  provider: 'hopstudio' as const,
  sessionRef: null,
  sessionDataRef: null,
};

function request(streaming = false) {
  return new Request('https://adapter.test/api/v1/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': 'request-correlation-1',
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
    expect(response.headers.get('x-request-id')).toBe('request-correlation-1');
    expect(await response.json()).toEqual(result);
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-autorisé',
      userId: 'user-autorisé',
    }));
  });

  it('corrèle l erreur affichée avec le log backend', async () => {
    const onUnexpectedError = vi.fn();
    const handler = createHopeStudioAssistantHandler({
      gateway: { async chat() { throw new Error('Réponse HopeStudio invalide'); } },
      identityResolver: {
        async resolve() { return { tenantId: 'tenant-autorisé', userId: 'user-autorisé' }; },
      },
      onUnexpectedError,
    });

    const response = await handler(request());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      code: 'assistant.hopstudio_unavailable',
      detail: 'Réponse HopeStudio invalide',
      requestId: 'request-correlation-1',
    });
    expect(onUnexpectedError).toHaveBeenCalledWith(
      expect.any(Error),
      {
        requestId: 'request-correlation-1',
        tenantId: 'tenant-autorisé',
        userId: 'user-autorisé',
      },
    );
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
