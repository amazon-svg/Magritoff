import { describe, expect, it, vi } from 'vitest';
import { HttpHopeStudioChatGateway } from '@/adapters/hopstudio/http-hopstudio-chat-gateway';

describe('HttpHopeStudioChatGateway', () => {
  it('appelle CallAI avec une identité serveur et normalise la réponse', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body));
      expect(form.get('action')).toBe('CallAI');
      expect(form.get('id')).toBe('hopes-chat-to-product-UI-full-lib');
      expect(JSON.parse(form.get('parameters_value') ?? '{}')).toEqual({
        prompt: 'Je veux 500 flyers',
        session: { tenant_id: 'tenant-1', user_id: 'user-1' },
      });
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' });
      return Response.json({
        response: {
          event: { deck: [{ selected: 'Flyer', configuration: { quantity: 500 } }] },
          session: { DBK: 'session-1' },
        },
      });
    });
    const gateway = new HttpHopeStudioChatGateway(
      'https://hopstudio.test',
      'secret',
      undefined,
      fetchMock as unknown as typeof fetch,
    );

    const result = await gateway.chat({
      messages: [{ role: 'user', content: 'Je veux 500 flyers' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({ provider: 'hopstudio', sessionRef: 'session-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hopstudio.test/json.wcl',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('injecte la configuration Clariprint du tenant dans les en-têtes HopeStudio', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        'X-CLARIPRINT-USER': 'tenant-login',
        'X-CLARIPRINT-PASS': 'tenant-password',
        'X-CLARIPRINT-URL': 'https://clariprint.tenant.test/json.wcl',
      });
      return Response.json({ response: {} });
    });
    const gateway = new HttpHopeStudioChatGateway({
      hopeStudioUrl: 'https://hopstudio.tenant.test/json.wcl',
      clariprint: {
        user: 'tenant-login',
        password: 'tenant-password',
        url: 'https://clariprint.tenant.test/json.wcl',
      },
    }, null, undefined, fetchMock as unknown as typeof fetch);

    await gateway.chat({
      messages: [{ role: 'user', content: 'Je veux 500 flyers' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    });
  });

  it('omet l en-tête URL Clariprint lorsque le tenant ne la définit pas', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-CLARIPRINT-USER')).toBe('tenant-login');
      expect(headers.get('X-CLARIPRINT-PASS')).toBe('tenant-password');
      expect(headers.has('X-CLARIPRINT-URL')).toBe(false);
      return Response.json({ response: {} });
    });
    const gateway = new HttpHopeStudioChatGateway({
      hopeStudioUrl: 'https://hopstudio.tenant.test',
      clariprint: { user: 'tenant-login', password: 'tenant-password' },
    }, null, undefined, fetchMock as unknown as typeof fetch);

    await gateway.chat({
      messages: [{ role: 'user', content: 'Bonjour' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    });
  });

  it('appelle HopeStudio sans en-têtes Clariprint quand le tenant ne fournit pas d identifiants', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('X-CLARIPRINT-USER')).toBe(false);
      expect(headers.has('X-CLARIPRINT-PASS')).toBe(false);
      expect(headers.has('X-CLARIPRINT-URL')).toBe(false);
      return Response.json({ response: {} });
    });
    const gateway = new HttpHopeStudioChatGateway({
      hopeStudioUrl: 'https://hopstudio.tenant.test/json.wcl',
    }, null, undefined, fetchMock as unknown as typeof fetch);

    await gateway.chat({
      messages: [{ role: 'user', content: 'Bonjour' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    });
  });

  it('hydrate les références DBK avec loadSessionParts avant normalisation', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body));
      if (form.get('action') === 'CallAI') {
        return Response.json({
          response: {
            event: { deck: ['card-dbk-1'] },
            session: {
              UID: 'session-uid-1',
              DBK: 'session-dbk-1',
              tenant_id: 'tenant-1',
              user_id: 'user-1',
            },
          },
        });
      }
      expect(Object.fromEntries(form)).toMatchObject({
        action: 'loadSessionParts',
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        session_id: 'session-uid-1',
        data_key: 'card-dbk-1',
      });
      return Response.json({
        status: 'ok',
        datas: {
          UID: 'card-uid-1',
          DBK: 'card-dbk-1',
          selected: 'Flyer',
          configuration: { quantity: 500, width: 21, height: 29.7 },
        },
      });
    });
    const gateway = new HttpHopeStudioChatGateway(
      'https://hopstudio.test',
      null,
      undefined,
      fetchMock as unknown as typeof fetch,
    );

    const result = await gateway.chat({
      messages: [{ role: 'user', content: 'Je veux 500 flyers' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.sessionRef).toBe('session-uid-1');
    expect(result.configs).toEqual([
      expect.objectContaining({
        clariprint: expect.objectContaining({ quantity: 500 }),
        hopStudio: { cardRef: 'card-uid-1', dataRef: 'card-dbk-1' },
      }),
    ]);
  });

  it('transmet la référence de session retournée par l échange précédent', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body));
      expect(JSON.parse(form.get('parameters_value') ?? '{}')).toMatchObject({
        session: {
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          session_id: 'session-existante',
          DBK: 'XL_DEFAULT_session-existante',
        },
      });
      return Response.json({ response: { session: { UID: 'session-existante' } } });
    });
    const gateway = new HttpHopeStudioChatGateway(
      'https://hopstudio.test',
      null,
      undefined,
      fetchMock as unknown as typeof fetch,
    );
    await gateway.chat({
      messages: [{ role: 'user', content: 'Et en 1000 exemplaires ?' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      sessionRef: 'session-existante',
      sessionDataRef: 'XL_DEFAULT_session-existante',
      signal: new AbortController().signal,
    });
  });

  it('transforme un timeout réseau en erreur HopeStudio explicite', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      await new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(init.signal.reason);
          return;
        }
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
      return Response.json({});
    });
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      AbortSignal.abort(new DOMException('timeout', 'TimeoutError')),
    );
    const gateway = new HttpHopeStudioChatGateway(
      'https://hopstudio.test',
      null,
      undefined,
      fetchMock as unknown as typeof fetch,
    );

    await expect(gateway.chat({
      messages: [{ role: 'user', content: 'Bonjour' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    })).rejects.toThrow('HopeStudio n’a pas répondu sous 50 secondes');

    timeoutSpy.mockRestore();
  });

  it('émet des traces structurées sans valeurs d authentification', async () => {
    const trace = vi.fn();
    const gateway = new HttpHopeStudioChatGateway(
      {
        hopeStudioUrl: 'https://hopstudio.test/json.wcl?secret=query',
        apiToken: 'bearer-secret',
        clariprint: { user: 'login-secret', password: 'password-secret' },
      },
      null,
      undefined,
      vi.fn(async () => Response.json({ response: {} })) as unknown as typeof fetch,
      trace,
    );

    await gateway.chat({
      messages: [{ role: 'user', content: 'Bonjour' }],
      tenantId: 'tenant-1',
      userId: 'utilisateur-secret-1234',
      traceId: 'trace-1',
      signal: new AbortController().signal,
    });

    expect(trace).toHaveBeenCalledWith(expect.objectContaining({
      traceId: 'trace-1',
      stage: 'call_ai.start',
      endpoint: 'https://hopstudio.test/json.wcl',
      userId: 'util…1234',
      hasClariprintCredentials: true,
    }));
    const serialized = JSON.stringify(trace.mock.calls);
    expect(serialized).not.toContain('bearer-secret');
    expect(serialized).not.toContain('login-secret');
    expect(serialized).not.toContain('password-secret');
    expect(serialized).not.toContain('secret=query');
  });

  it('enregistre l entrée, la sortie, la durée HTTP et les tokens disponibles', async () => {
    const registry = {
      start: vi.fn(async () => {}),
      complete: vi.fn(async () => {}),
    };
    const gateway = new HttpHopeStudioChatGateway(
      'https://hopstudio.test/json.wcl',
      null,
      undefined,
      vi.fn(async () => Response.json({
        response: { usage: { input_tokens: 120, output_tokens: 45 } },
      })) as unknown as typeof fetch,
      undefined,
      registry,
    );

    await gateway.chat({
      messages: [{ role: 'user', content: 'Je veux 500 flyers' }],
      tenantId: 'tenant-1',
      userId: 'user-1',
      traceId: 'trace-registry-1',
      signal: new AbortController().signal,
    });

    expect(registry.start).toHaveBeenCalledWith(expect.objectContaining({
      correlationId: 'trace-registry-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      provider: 'hopstudio',
      operation: 'CallAI',
      url: 'https://hopstudio.test/json.wcl',
      requestPayload: expect.objectContaining({
        action: 'CallAI',
        parameters_value: expect.objectContaining({ prompt: 'Je veux 500 flyers' }),
      }),
    }));
    expect(registry.complete).toHaveBeenCalledWith(expect.objectContaining({
      state: 'succeeded',
      httpStatus: 200,
      inputTokens: 120,
      outputTokens: 45,
      responsePayload: expect.objectContaining({ response: expect.any(Object) }),
    }));
  });
});
