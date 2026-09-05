/**
 * Aiguillage entre les deux facades `/api/v1` (montage du socle E10.0).
 *
 * CE QUI EST VERIFIABLE ICI : la logique de routage elle-meme — quel handler
 * est appele pour quel chemin, et le refus des collisions. Les deux facades
 * sont bouchonnees, on observe laquelle recoit la requete.
 *
 * CE QUI NE L EST PAS : l execution reelle de l edge function, qui demande un
 * runtime Deno et un deploiement Supabase (Docker absent de la machine de
 * developpement, cf. docs/api/CONVENTIONS.md §8.1). Ce test couvre la
 * composition, pas le deploiement.
 */
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import {
  assertNoFacadeCollision,
  createApiFacadeRouter,
  defineGescomRoute,
  pathTemplatesOverlap,
} from '@/server/api';
import { defineJsonRoute, type ApiRoute } from '@/server/api/routes';
import type { GescomRoute } from '@/server/api/gescom-middleware';

function gescomRoute(method: 'GET' | 'POST' | 'PATCH', path: string, operationId: string): GescomRoute {
  return defineGescomRoute({
    method,
    path,
    operationId,
    requiredScopes: ['customers:read'],
    inputSchema: method === 'GET' ? null : z.object({ name: z.string() }),
    dataSchema: z.object({ id: z.string() }),
    async handle() {
      return { status: 200, data: { id: 'x' } };
    },
  });
}

function legacyRoute(method: 'GET' | 'POST', path: string): ApiRoute {
  return defineJsonRoute({
    method,
    path,
    authentication: 'required',
    inputSchema: null,
    outputSchema: z.object({ ok: z.boolean() }),
    async handle() {
      return { status: 200, body: { ok: true } };
    },
  });
}

function routerWith(gescom: readonly GescomRoute[], legacy: readonly ApiRoute[]) {
  const gescomHandle = vi.fn(async () => new Response('gescom', { status: 200 }));
  const legacyHandle = vi.fn(async () => new Response('legacy', { status: 200 }));
  const route = createApiFacadeRouter({
    gescom: { routes: gescom, handle: gescomHandle },
    legacy: { routes: legacy, handle: legacyHandle },
  });
  return { route, gescomHandle, legacyHandle };
}

const call = (route: (request: Request) => Promise<Response>, path: string, method = 'GET') =>
  route(new Request(`https://magrit.test${path}`, { method }));

describe('aiguillage des deux facades /api/v1', () => {
  it('envoie un chemin E10 a la facade Gestion commerciale', async () => {
    const { route, gescomHandle, legacyHandle } = routerWith(
      [gescomRoute('GET', '/customers', 'listCustomers')],
      [legacyRoute('GET', '/api/v1/tenants/{tenantId}/commercial')],
    );

    const response = await call(route, '/api/v1/customers');

    expect(await response.text()).toBe('gescom');
    expect(gescomHandle).toHaveBeenCalledOnce();
    expect(legacyHandle).not.toHaveBeenCalled();
  });

  it('laisse les chemins historiques a la facade historique', async () => {
    const { route, gescomHandle, legacyHandle } = routerWith(
      [gescomRoute('GET', '/customers', 'listCustomers')],
      [legacyRoute('GET', '/api/v1/tenants/{tenantId}/commercial')],
    );

    for (const path of [
      '/api/v1/tenants/11111111-1111-4111-8111-111111111111/commercial',
      '/api/v1/health',
      '/api/v1/session',
      '/api/v1/inconnue',
    ]) {
      const response = await call(route, path);
      expect(await response.text(), path).toBe('legacy');
    }
    expect(gescomHandle).not.toHaveBeenCalled();
    expect(legacyHandle).toHaveBeenCalledTimes(4);
  });

  it('reconnait un chemin E10 parametre', async () => {
    const { route, gescomHandle } = routerWith(
      [gescomRoute('GET', '/customers/{customerId}', 'getCustomer')],
      [],
    );

    await call(route, '/api/v1/customers/b1c2d3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d');
    expect(gescomHandle).toHaveBeenCalledOnce();
  });

  it('garde un chemin E10 sur sa facade meme pour une methode non declaree', async () => {
    // Sinon un DELETE non declare repondrait 404 au format historique
    // (`requestId` camelCase) a un client qui attend le format E10.
    const { route, gescomHandle, legacyHandle } = routerWith(
      [gescomRoute('GET', '/customers', 'listCustomers')],
      [],
    );

    await call(route, '/api/v1/customers', 'DELETE');
    expect(gescomHandle).toHaveBeenCalledOnce();
    expect(legacyHandle).not.toHaveBeenCalled();
  });

  it('n aiguille pas sur la query : seul le chemin decide', async () => {
    const { route, gescomHandle } = routerWith(
      [gescomRoute('GET', '/customers', 'listCustomers')],
      [],
    );

    await call(route, '/api/v1/customers?q=dupont&page[size]=10');
    expect(gescomHandle).toHaveBeenCalledOnce();
  });
});

describe('refus des collisions entre facades', () => {
  it('refuse au demarrage deux chemins identiques', () => {
    expect(() =>
      routerWith([gescomRoute('GET', '/customers', 'listCustomers')], [legacyRoute('GET', '/api/v1/customers')]),
    ).toThrow(/Collision entre les facades API/);
  });

  it('refuse un recouvrement par parametre, qui rendrait la route historique injoignable', () => {
    // `/api/v1/customers/{customerId}` (E10) capterait
    // `/api/v1/customers/export` (historique) : la seconde ne serait jamais
    // atteinte, en silence, en production.
    expect(() =>
      routerWith(
        [gescomRoute('GET', '/customers/{customerId}', 'getCustomer')],
        [legacyRoute('GET', '/api/v1/customers/export')],
      ),
    ).toThrow(/Collision entre les facades API/);
  });

  it('accepte des chemins de longueurs differentes', () => {
    expect(() =>
      routerWith(
        [gescomRoute('GET', '/customers', 'listCustomers')],
        [legacyRoute('GET', '/api/v1/tenants/{tenantId}/customers')],
      ),
    ).not.toThrow();
  });

  it('assertNoFacadeCollision nomme les deux chemins fautifs', () => {
    expect(() =>
      assertNoFacadeCollision(
        [gescomRoute('GET', '/customers', 'listCustomers')],
        [legacyRoute('GET', '/api/v1/customers')],
      ),
    ).toThrow(/\/api\/v1\/customers \(E10\) recouvre \/api\/v1\/customers \(historique\)/);
  });
});

describe('recouvrement de gabarits de chemin', () => {
  it.each([
    ['/api/v1/customers', '/api/v1/customers', true],
    ['/api/v1/customers/{id}', '/api/v1/customers/export', true],
    ['/api/v1/customers/{id}', '/api/v1/customers/{customerId}', true],
    ['/api/v1/customers', '/api/v1/customers/', true],
    ['/api/v1/customers', '/api/v1/quotes', false],
    ['/api/v1/customers', '/api/v1/customers/{id}', false],
    ['/api/v1/tenants/{t}/customers', '/api/v1/customers', false],
  ])('%s vs %s -> %s', (left, right, expected) => {
    expect(pathTemplatesOverlap(left, right)).toBe(expected);
    // La relation est symetrique : l ordre des facades ne change rien.
    expect(pathTemplatesOverlap(right, left)).toBe(expected);
  });
});
