import { describe, expect, it, vi } from 'vitest';
import { createAssistantChatHandler } from '@/server/api/assistant-chat-handler';

const payload = {
  content: [{ type: 'text' as const, text: '**500 Flyers A5**' }],
  configs: [],
  teachingNote: '',
  assumptions: [],
  clarification: null,
  clarificationOptions: [],
  mode: 'open' as const,
  truncatedCount: 0,
  model: 'gpt-test',
  usage: {},
  demoMode: false as const,
};

function request(body: unknown, streaming = false) {
  return new Request('http://magrit.test/api/v1/assistant/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(streaming ? { accept: 'text/event-stream' } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('assistant chat Node', () => {
  it('autorise un membre et renvoie le contrat JSON', async () => {
    const generate = vi.fn(async () => payload);
    const handler = createAssistantChatHandler({
      service: { generate } as any,
      actorResolver: { resolve: async () => ({ kind: 'user', userId: 'user-1' as any }) },
      authorizeTenant: async () => true,
    });
    const response = await handler(request({
      tenantId: 'tenant-1',
      messages: [{ role: 'user', content: 'Flyers' }],
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ model: 'gpt-test', demoMode: false });
    expect(generate).toHaveBeenCalledOnce();
  });

  it('renvoie le flux SSE Magrit sans exposer les événements fournisseur', async () => {
    const handler = createAssistantChatHandler({
      service: { generate: async () => payload } as any,
      actorResolver: { resolve: async () => ({ kind: 'user', userId: 'user-1' as any }) },
      authorizeTenant: async () => true,
    });
    const response = await handler(request({
      tenantId: 'tenant-1',
      messages: [{ role: 'user', content: 'Flyers' }],
    }, true));
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const body = await response.text();
    expect(body).toContain('event: delta');
    expect(body).toContain('event: done');
    expect(body).toContain('gpt-test');
  });

  it('refuse un espace auquel l’utilisateur n’appartient pas', async () => {
    const generate = vi.fn();
    const handler = createAssistantChatHandler({
      service: { generate } as any,
      actorResolver: { resolve: async () => ({ kind: 'user', userId: 'user-1' as any }) },
      authorizeTenant: async () => false,
    });
    const response = await handler(request({
      tenantId: 'tenant-2',
      messages: [{ role: 'user', content: 'Flyers' }],
    }));
    expect(response.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });
});
