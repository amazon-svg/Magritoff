import { describe, expect, it, vi } from 'vitest';
import { TenantAwareHopeStudioChatGateway } from '@/adapters/hopstudio/tenant-aware-hopstudio-chat-gateway';

const request = {
  messages: [{ role: 'user' as const, content: 'Bonjour' }],
  tenantId: 'tenant-1',
  userId: 'user-1',
  signal: new AbortController().signal,
};

describe('TenantAwareHopeStudioChatGateway', () => {
  it('résout et utilise exclusivement la connexion du tenant authentifié', async () => {
    const resolve = vi.fn(async () => ({
      tenantId: 'tenant-1',
      hopeStudioUrl: 'https://hopstudio.tenant.test',
      clariprint: { user: 'login-1', password: 'password-1' },
    }));
    const fetchMock = vi.fn(async (input, init?: RequestInit) => {
      expect(input).toBe('https://hopstudio.tenant.test/json.wcl');
      expect(init?.headers).toMatchObject({
        'X-CLARIPRINT-USER': 'login-1',
        'X-CLARIPRINT-PASS': 'password-1',
      });
      return Response.json({ response: {} });
    });

    await new TenantAwareHopeStudioChatGateway(
      { resolve },
      fetchMock as unknown as typeof fetch,
    ).chat(request);

    expect(resolve).toHaveBeenCalledWith('tenant-1');
  });

  it('refuse une connexion appartenant à un autre tenant', async () => {
    const gateway = new TenantAwareHopeStudioChatGateway({
      async resolve() {
        return {
          tenantId: 'tenant-2',
          hopeStudioUrl: 'https://hopstudio.tenant.test',
          clariprint: { user: 'login-2', password: 'password-2' },
        };
      },
    });

    await expect(gateway.chat(request)).rejects.toThrow(
      'ne correspond pas au tenant authentifié',
    );
  });
});
