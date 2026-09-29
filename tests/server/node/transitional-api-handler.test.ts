import { describe, expect, it, vi } from 'vitest';
import { createTransitionalApiHandler } from '../../../src/server/node/transitional-api-handler.ts';

describe('facade API Node de transition', () => {
  it('traite les chemins deja migres sans appeler l API historique', async () => {
    const legacyFetch = vi.fn();
    const handler = createTransitionalApiHandler({
      localHandler: async () => Response.json({ status: 'local' }),
      legacyApiUrl: 'https://legacy.example/functions/v1/magrit-api',
      fetch: legacyFetch,
    });

    const response = await handler(new Request('http://node.local/api/v1/health'));

    await expect(response.json()).resolves.toEqual({ status: 'local' });
    expect(legacyFetch).not.toHaveBeenCalled();
  });

  it('permet d activer localement une famille de routes sans intercepter les autres', async () => {
    const legacyFetch = vi.fn(async () => Response.json({ status: 'legacy' }));
    const handler = createTransitionalApiHandler({
      localHandler: async () => Response.json({ status: 'local' }),
      legacyApiUrl: 'https://legacy.example',
      fetch: legacyFetch,
      isLocalRequest: (_request, url) => /^\/api\/v1\/tenants\/[^/]+\/conversations/.test(url.pathname),
    });

    const local = await handler(new Request('http://node.local/api/v1/tenants/t1/conversations'));
    const legacy = await handler(new Request('http://node.local/api/v1/tenants/t1/orders'));

    await expect(local.json()).resolves.toEqual({ status: 'local' });
    await expect(legacy.json()).resolves.toEqual({ status: 'legacy' });
    expect(legacyFetch).toHaveBeenCalledTimes(1);
  });

  it('relaie methode, chemin, query, autorisation et corps des routes restantes', async () => {
    const legacyFetch = vi.fn(async (request: Request) => Response.json({
      url: request.url,
      method: request.method,
      authorization: request.headers.get('authorization'),
      body: await request.text(),
    }));
    const handler = createTransitionalApiHandler({
      localHandler: async () => new Response(null, { status: 404 }),
      legacyApiUrl: 'https://legacy.example/functions/v1/magrit-api/',
      fetch: legacyFetch,
    });

    const response = await handler(new Request('http://node.local/api/v1/orders?page=2', {
      method: 'POST',
      headers: { authorization: 'Bearer opaque', 'content-type': 'application/json' },
      body: '{"name":"test"}',
    }));

    await expect(response.json()).resolves.toEqual({
      url: 'https://legacy.example/functions/v1/magrit-api/api/v1/orders?page=2',
      method: 'POST',
      authorization: 'Bearer opaque',
      body: '{"name":"test"}',
    });
  });

  it('rend une indisponibilite explicite quand une route n est pas encore migree', async () => {
    const handler = createTransitionalApiHandler({
      localHandler: async () => Response.json({ status: 'local' }),
    });

    const response = await handler(new Request('http://node.local/api/v1/orders'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'api.route_not_migrated' });
  });

  it('masque une panne reseau de l API historique derriere une erreur 502 stable', async () => {
    const handler = createTransitionalApiHandler({
      localHandler: async () => new Response(null, { status: 404 }),
      legacyApiUrl: 'https://legacy.example/functions/v1/magrit-api',
      fetch: vi.fn().mockRejectedValue(new Error('adresse interne')),
    });

    const response = await handler(new Request('http://node.local/api/v1/orders'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      type: 'about:blank',
      title: 'API historique indisponible',
      status: 502,
      code: 'api.legacy_unavailable',
    });
  });

  it('refuse une URL historique pouvant contenir des secrets', () => {
    expect(() => createTransitionalApiHandler({
      localHandler: async () => new Response(),
      legacyApiUrl: 'https://user:secret@legacy.example/api',
    })).toThrow(/identifiants/);
  });
});
