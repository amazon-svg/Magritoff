import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { fixedClock, parseId, type TenantId, type UserId } from '@/kernel';
import {
  ApiClientError,
  FetchApiClient,
  SystemApiClient,
} from '@/platform/api';
import { createApiV1Application, createApiV1Handler, defineJsonRoute } from '@/server/api';

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

  // E10.4 — le module Clients est le premier a exiger Idempotency-Key / If-Match
  // et a lire l ETag de reponse depuis l UI ; ces deux capacites sont ajoutees
  // au client transverse plutot que dupliquees module par module.
  it('transmet des en-tetes personnalises (Idempotency-Key, If-Match)', async () => {
    let received: Request | null = null;
    const client = new FetchApiClient('https://magrit.test', async (input, init) => {
      received = new Request(input, init);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await client.request({
      method: 'POST',
      path: '/api/v1/customers',
      body: { type: 'individual' },
      headers: { 'Idempotency-Key': 'creation-client-01' },
      responseSchema: z.object({ ok: z.boolean() }),
    });

    expect(received?.headers.get('Idempotency-Key')).toBe('creation-client-01');
  });

  it('requestWithEtag rend la donnee et l ETag de la reponse', async () => {
    const client = new FetchApiClient('https://magrit.test', async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', ETag: '"abc123"' },
      }),
    );

    await expect(
      client.requestWithEtag({
        path: '/api/v1/customers',
        responseSchema: z.object({ ok: z.boolean() }),
      }),
    ).resolves.toEqual({ data: { ok: true }, etag: '"abc123"' });
  });

  it('comprend un Problem au format E10 (request_id, current_state) sans que l appelant le sache', async () => {
    const client = new FetchApiClient('https://magrit.test', async () =>
      new Response(
        JSON.stringify({
          type: 'about:blank',
          title: 'Conflit de version',
          status: 409,
          code: 'api.resource_conflict',
          request_id: 'req-gescom-1',
          current_state: { id: 'c1', is_active: true },
        }),
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    await expect(
      client.request({ path: '/api/v1/customers/c1', responseSchema: z.unknown() }),
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      problem: {
        status: 409,
        code: 'api.resource_conflict',
        requestId: 'req-gescom-1',
        currentState: { id: 'c1', is_active: true },
      },
    } satisfies Partial<ApiClientError>);
  });

  // BCP-6b (correction qa-review round 1, point BLOQUANT) — le client est le
  // seul point commun a toutes les actions storefront (`useStorefrontApi`
  // le memoise sur l `apiClient` unique du runtime), donc le seul endroit ou
  // brancher une revalidation de session sur TOUTE reponse 401 sans toucher
  // aux modules d action (`useStorefrontOrderLifecycle`, etc.).
  describe('onUnauthorized', () => {
    it('notifie sur un 401, jamais sur un autre statut', async () => {
      let status = 401;
      const client = new FetchApiClient('https://magrit.test', async () =>
        new Response(
          JSON.stringify({ type: 'about:blank', title: 'x', status, code: 'x', request_id: 'r' }),
          { status },
        ),
      );
      let notifications = 0;
      client.onUnauthorized(() => { notifications += 1; });

      await client.request({ path: '/api/v1/customers', responseSchema: z.unknown() }).catch(() => undefined);
      expect(notifications).toBe(1);

      status = 500;
      await client.request({ path: '/api/v1/customers', responseSchema: z.unknown() }).catch(() => undefined);
      expect(notifications).toBe(1);
    });

    it('ne notifie jamais sur une reponse en succes', async () => {
      const client = new FetchApiClient('https://magrit.test', async () =>
        new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }),
      );
      let notifications = 0;
      client.onUnauthorized(() => { notifications += 1; });

      await client.request({ path: '/api/v1/customers', responseSchema: z.object({ ok: z.boolean() }) });

      expect(notifications).toBe(0);
    });

    it('desabonne : le rappel rendu par onUnauthorized coupe la notification', async () => {
      const client = new FetchApiClient('https://magrit.test', async () =>
        new Response(
          JSON.stringify({ type: 'about:blank', title: 'x', status: 401, code: 'x', request_id: 'r' }),
          { status: 401 },
        ),
      );
      let notifications = 0;
      const unsubscribe = client.onUnauthorized(() => { notifications += 1; });
      unsubscribe();

      await client.request({ path: '/api/v1/customers', responseSchema: z.unknown() }).catch(() => undefined);

      expect(notifications).toBe(0);
    });

    it('notifie chaque abonne independamment, requestForm et requestWithEtag inclus', async () => {
      const client = new FetchApiClient('https://magrit.test', async () =>
        new Response(
          JSON.stringify({ type: 'about:blank', title: 'x', status: 401, code: 'x', request_id: 'r' }),
          { status: 401 },
        ),
      );
      let a = 0;
      let b = 0;
      client.onUnauthorized(() => { a += 1; });
      client.onUnauthorized(() => { b += 1; });

      await client.requestWithEtag({ path: '/api/v1/customers', responseSchema: z.unknown() }).catch(() => undefined);
      const form = new FormData();
      await client.requestForm({ method: 'POST', path: '/api/v1/assets', form, responseSchema: z.unknown() }).catch(() => undefined);

      expect(a).toBe(2);
      expect(b).toBe(2);
    });
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
