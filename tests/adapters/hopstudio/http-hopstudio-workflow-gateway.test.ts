import { describe, expect, it, vi } from 'vitest';
import { HttpHopeStudioWorkflowGateway } from '@/adapters/hopstudio/http-hopstudio-workflow-gateway';

describe('HttpHopeStudioWorkflowGateway', () => {
  it('relaie une action HLUX en imposant l identité Magrit', async () => {
    const fetchMock = vi.fn(async (_url, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body));
      expect(form.get('tenant_id')).toBe('tenant-1');
      expect(form.get('user_id')).toBe('user-1');
      expect(JSON.parse(form.get('parameters_value') ?? '{}').session).toEqual({
        session_id: 'session-1',
        tenant_id: 'tenant-1',
        user_id: 'user-1',
      });
      return Response.json({ status: 'ok', datas: [] });
    });
    const gateway = new HttpHopeStudioWorkflowGateway({
      async resolve() {
        return {
          tenantId: 'tenant-1',
          hopeStudioUrl: 'https://hopstudio.test/json.wcl',
          clariprint: { user: 'login', password: 'secret' },
        };
      },
    }, fetchMock as unknown as typeof fetch);

    const result = await gateway.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      traceId: 'trace-1',
      body: new URLSearchParams({
        action: 'CallAI',
        tenant_id: 'tenant-frauduleux',
        user_id: 'user-frauduleux',
        parameters_value: JSON.stringify({
          prompt: 'Bonjour',
          session: { session_id: 'session-1', tenant_id: 'autre-tenant' },
        }),
      }).toString(),
      signal: new AbortController().signal,
    });

    expect(result).toEqual({ status: 'ok', datas: [] });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-CLARIPRINT-USER')).toBe('login');
  });
});
