/**
 * Montage reel des deux facades (socle E10.0 + module Clients E10.4).
 *
 * Le test precedent bouchonne les deux facades pour verifier l aiguillage.
 * Celui-ci utilise la COMPOSITION REELLE — `createMagritApiApplication`, les
 * vraies routes de `gescomRoutes()`, la vraie facade historique — et verifie
 * qu une requete sur `/api/v1/customers` atteint bien le service Clients.
 *
 * C est ce qui manquait : E10.4 etait entierement teste en memoire, mais ses
 * endpoints n etaient composes dans aucun serveur. Un test qui monte la vraie
 * composition attrape le jour ou quelqu un retire le module du registre.
 *
 * LIMITE : ceci verifie la COMPOSITION, pas le DEPLOIEMENT. L edge function
 * `supabase/functions/magrit-api/index.ts` n est ni typecheckee (absente des
 * tsconfig) ni executable ici (Deno + Docker absents). Voir
 * docs/api/CONVENTIONS.md §8.1.
 */
import { describe, expect, it, vi } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import { InMemoryIdempotencyStore, OutboxPublisher } from '@/modules/_shared/application';
import type { ApiPrincipal, PrincipalVerifier } from '@/modules/_shared/application';
import { CustomersService } from '@/modules/customers/application/customers-service';
import type { CustomersRepository } from '@/modules/customers/application/customers-repository';
import { createMagritApiApplication } from '@/server/api';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const principal: ApiPrincipal = Object.freeze({
  kind: 'user',
  userId: USER,
  tenantId: TENANT,
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    return credential.kind === 'bearer' && credential.token === 'jeton-valide' ? principal : null;
  },
};

function buildApplication() {
  // `list` rend `size + 1` lignes au plus ; le decoupage est fait par
  // `buildPage()` cote route. Une liste vide suffit ici : ce test verifie le
  // MONTAGE, pas la pagination (couverte par tests/contract/customers).
  const list = vi.fn(async () => ({ rows: [] }));
  const repository = { list } as unknown as CustomersRepository;

  const handler = createMagritApiApplication({
    gescomServices: {
      customers: new CustomersService({
        repository,
        outbox: new OutboxPublisher({
          repository: { async append() {} },
          now: () => new Date('2026-09-01T08:30:00.000Z'),
          newEventId: () => 'c3d4e5f6-0718-4293-8a4b-5c6d7e8f9a0b',
        }),
      }),
    },
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-montage',
    // Aucune route historique injectee : `createApiV1Application` ajoute
    // toujours /api/v1/health, ce qui suffit a prouver que la facade
    // historique reste servie.
  });

  return { handler, list };
}

describe('composition reelle des deux facades', () => {
  it('sert /api/v1/customers par la facade E10, enveloppe data/meta comprise', async () => {
    const { handler, list } = buildApplication();

    const response = await handler(
      new Request('https://magrit.test/api/v1/customers', {
        headers: { Authorization: 'Bearer jeton-valide' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { data: unknown; meta: { request_id: string } };
    expect(body.meta.request_id).toBe('req-montage');
    expect(body.data).toEqual([]);
    // Le tenant vient du jeton, jamais de l URL.
    expect(list).toHaveBeenCalledOnce();
    expect(list.mock.calls[0]?.[0]).toBe(TENANT);
  });

  it('refuse /api/v1/customers sans jeton, au format Problem E10', async () => {
    const { handler } = buildApplication();

    const response = await handler(new Request('https://magrit.test/api/v1/customers'));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    const body = (await response.json()) as { code: string; request_id: string };
    expect(body.code).toBe('identity.authentication_required');
    // Format E10 : snake_case, pas le `requestId` de la facade historique.
    expect(body.request_id).toBe('req-montage');
  });

  it('continue de servir la facade historique, format historique inchange', async () => {
    const { handler } = buildApplication();

    const response = await handler(new Request('https://magrit.test/api/v1/health'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    // Payload nu, sans enveloppe : la facade historique n a pas bouge.
    expect(body).toMatchObject({ status: 'ok', apiVersion: 'v1' });
    expect(body['data']).toBeUndefined();
    expect(body['meta']).toBeUndefined();
  });

  it('rend un 404 historique sur un chemin inconnu des deux facades', async () => {
    const { handler } = buildApplication();

    const response = await handler(new Request('https://magrit.test/api/v1/inconnue'));

    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['requestId']).toBe('req-montage');
  });

  it('monte toutes les routes du registre E10, pas seulement la premiere', async () => {
    const { handler } = buildApplication();

    // Une methode non declaree sur un chemin E10 doit rendre un 405 au format
    // E10 : la preuve que le chemin appartient bien a cette facade.
    const response = await handler(
      new Request('https://magrit.test/api/v1/customers', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer jeton-valide' },
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect((await response.json()) as { code: string }).toMatchObject({
      code: 'api.method_not_allowed',
    });
  });
});
