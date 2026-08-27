import { describe, expect, it, vi } from 'vitest';
import { tryHandleConfiguredWorkspaceChat } from '@/server/hopstudio/configured-workspace-chat-handler';

function request(tenantId = 'tenant-1') {
  return new Request('https://magrit.test/api/v1/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Je veux 500 flyers' }],
      tenantId,
    }),
  });
}

const empty = {
  hopeStudioUrl: null,
  clariprintUser: null,
  clariprintPasswordConfigured: false,
  clariprintUrl: null,
};

describe('routage du chat workspace vers HopeStudio', () => {
  it('laisse le fournisseur historique répondre lorsque HopeStudio est désactivé', async () => {
    const response = await tryHandleConfiguredWorkspaceChat(request(), {
      userId: 'user-1',
      async isTenantMember() { return true; },
      settings: {
        async get() { return { ...empty, enabled: false }; },
        async update() {},
        async resolve() { return null; },
      },
    });
    expect(response).toBeNull();
  });

  it('route une configuration active directement vers HopeStudio', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      response: {
        event: { message: 'Voici votre produit', deck: [] },
        session: { UID: 'session-1' },
      },
    }));
    const response = await tryHandleConfiguredWorkspaceChat(request(), {
      userId: 'user-1',
      async isTenantMember() { return true; },
      settings: {
        async get() {
          return {
            enabled: true,
            hopeStudioUrl: 'https://hopstudio.test/json.wcl',
            clariprintUser: 'login',
            clariprintPasswordConfigured: true,
            clariprintUrl: null,
          };
        },
        async update() {},
        async resolve() {
          return {
            tenantId: 'tenant-1',
            hopeStudioUrl: 'https://hopstudio.test/json.wcl',
            clariprint: { user: 'login', password: 'secret' },
          };
        },
      },
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      provider: 'hopstudio',
      teachingNote: 'Voici votre produit',
      sessionRef: 'session-1',
    });
    const sent = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const parameters = JSON.parse(
      new URLSearchParams(String(sent.body)).get('parameters_value') ?? '{}',
    );
    expect(parameters.session).toEqual({ tenant_id: 'tenant-1', user_id: 'user-1' });
  });

  it('bloque un tenant auquel l utilisateur n appartient pas', async () => {
    const get = vi.fn();
    const response = await tryHandleConfiguredWorkspaceChat(request('tenant-tierce'), {
      userId: 'user-1',
      async isTenantMember() { return false; },
      settings: { get, async update() {}, async resolve() { return null; } },
    });

    expect(response?.status).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });
});
