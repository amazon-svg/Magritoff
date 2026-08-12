import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { fixedClock, parseId, type TenantId, type UserId } from '../../../src/kernel';
import {
  ApiClientError,
  FetchApiClient,
  SystemApiClient,
} from '../../../src/platform/api';
import { createApiV1Application, createApiV1Handler, defineJsonRoute } from '../../../src/server/api';

describe('client fetch API Magrit', () => {
  it('appelle fetch avec le receveur global attendu par les navigateurs', async () => {
    let receiver: unknown;
    const receiverSensitiveFetch = function (this: unknown) {
      receiver = this;
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok', apiVersion: 'v1', timestamp: '2026-08-11T12:30:00.000Z' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    } as typeof fetch;
    const client = new SystemApiClient(
      new FetchApiClient('https://magrit.test', receiverSensitiveFetch),
    );

    await client.health();

    expect(receiver).toBe(globalThis);
  });

  it('partage le contrat health avec la composition serveur', async () => {
    const handler = createApiV1Application({
      clock: fixedClock('2026-08-11T12:30:00.000Z'),
      requestIdFactory: () => 'request-client',
    });
    const client = new SystemApiClient(
      new FetchApiClient('https://magrit.test', bridgeTo(handler)),
    );

    await expect(client.health()).resolves.toEqual({
      status: 'ok',
      apiVersion: 'v1',
      timestamp: '2026-08-11T12:30:00.000Z',
    });
  });

  it('transforme un Problem Details en ApiClientError typée', async () => {
    const handler = createApiV1Application({ requestIdFactory: () => 'request-client' });
    const client = new FetchApiClient('https://magrit.test', bridgeTo(handler));

    const promise = client.request({
      path: '/api/v1/missing',
      responseSchema: z.object({ ok: z.boolean() }),
    });

    await expect(promise).rejects.toMatchObject({
      name: 'ApiClientError',
      problem: { status: 404, code: 'api.not_found', requestId: 'request-client' },
    } satisfies Partial<ApiClientError>);
  });

  it('propage le bearer token sans connaître son fournisseur', async () => {
    const route = defineJsonRoute({
      method: 'GET',
      path: '/api/v1/protected',
      authentication: 'required',
      inputSchema: null,
      outputSchema: z.object({ userId: z.string() }),
      async handle(context) {
        return {
          status: 200,
          body: { userId: context.actor?.kind === 'user' ? context.actor.userId : '' },
        };
      },
    });
    const handler = createApiV1Handler({
      routes: [route],
      requestIdFactory: () => 'request-client',
      actorResolver: {
        async resolve(request) {
          if (request.headers.get('Authorization') !== 'Bearer transition-token') return null;
          return {
            kind: 'user',
            userId: id<'UserId'>('user-1') as UserId,
            tenantId: id<'TenantId'>('tenant-1') as TenantId,
          };
        },
      },
    });
    const client = new FetchApiClient(
      'https://magrit.test',
      bridgeTo(handler),
      async () => 'transition-token',
    );

    await expect(
      client.request({
        path: '/api/v1/protected',
        responseSchema: z.object({ userId: z.string() }),
      }),
    ).resolves.toEqual({ userId: 'user-1' });
  });

  it('refuse une route qui contourne le préfixe versionné', async () => {
    const client = new FetchApiClient('https://magrit.test', async () => new Response());

    await expect(
      client.request({ path: '/functions/v1/probe', responseSchema: z.unknown() }),
    ).rejects.toThrow('/api/v1/');
  });

  it('envoie un FormData sans forcer un Content-Type incomplet', async () => {
    let received: Request | null = null;
    const client = new FetchApiClient('https://magrit.test', async (input, init) => {
      received = new Request(input, init);
      return new Response(JSON.stringify({ uploaded: true }), { headers: { 'Content-Type': 'application/json' } });
    }, () => 'form-token');
    const form = new FormData(); form.set('kind', 'logo'); form.set('asset', new Blob(['png'], { type: 'image/png' }), 'logo.png');

    await expect(client.requestForm({ method: 'POST', path: '/api/v1/assets', form, responseSchema: z.object({ uploaded: z.literal(true) }) })).resolves.toEqual({ uploaded: true });

    expect(received?.headers.get('Authorization')).toBe('Bearer form-token');
    expect(received?.headers.get('Content-Type')).toContain('multipart/form-data; boundary=');
    const receivedForm = await received?.formData();
    expect(receivedForm?.get('kind')).toBe('logo');
    expect(receivedForm?.get('asset')).toBeInstanceOf(Blob);
  });
});

function bridgeTo(handler: (request: Request) => Promise<Response>): typeof fetch {
  return async (input, init) => handler(new Request(input, init));
}

function id<Name extends string>(value: string) {
  const result = parseId<Name>(value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
