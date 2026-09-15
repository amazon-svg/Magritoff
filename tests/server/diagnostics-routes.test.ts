import { describe, expect, it } from 'vitest';
import { parseId, type UserId } from '@/kernel/ids';
import { DiagnosticsApiClient } from '@/modules/diagnostics/api/client';
import type { AiDiagnosticsGateway } from '@/modules/diagnostics/application/ai-diagnostics-gateway';
import type { ClariprintDiagnosticsGateway } from '@/modules/diagnostics/application/clariprint-diagnostics-gateway';
import { DiagnosticsService } from '@/modules/diagnostics/application/diagnostics-service';
import type { PlatformAdminGateway } from '@/modules/diagnostics/application/platform-admin-gateway';
import { ApiClientError, FetchApiClient } from '@/platform/api';
import { createApiV1Application } from '@/server/api/composition';
import { createDiagnosticsRoutes } from '@/server/api/diagnostics-routes';

const diagnostic = {
  provider: 'TestAI', configured: true, reachable: true,
  summary: 'Connexion fonctionnelle.', checks: [{ name: 'API', status: 'ok' as const }],
  testedAt: '2026-08-12T12:00:00.000Z',
};
const clariprintDiagnostic = {
  service: 'Clariprint' as const, configured: true, reachable: true, authenticated: true,
  summary: 'Authentification réussie.', checks: [{ name: 'CheckAuth', status: 'ok' as const }],
  testedAt: '2026-08-12T12:00:00.000Z',
};

function actorId(raw: string): UserId {
  const parsed = parseId<'UserId'>(raw);
  if (!parsed.ok) throw new Error('acteur invalide');
  return parsed.value;
}

const noSpaceActor = actorId('11111111-1111-4111-8111-111111111111');
const ordinaryOwnerActor = actorId('22222222-2222-4222-8222-222222222222');
const platformAdminActor = actorId('33333333-3333-4333-8333-333333333333');

/** Compte les appels reellement lances a chaque passerelle (CA « aucun appel sortant sur un 403 »). */
function countingGateways() {
  let aiCalls = 0;
  let clariprintCalls = 0;
  const ai: AiDiagnosticsGateway = { async testConnection() { aiCalls += 1; return diagnostic; } };
  const clariprint: ClariprintDiagnosticsGateway = { async testConnection() { clariprintCalls += 1; return clariprintDiagnostic; } };
  return { ai, clariprint, get aiCalls() { return aiCalls; }, get clariprintCalls() { return clariprintCalls; } };
}

/**
 * Faux `is_super_admin()` : seul `platformAdminActor` est administrateur de
 * la plateforme. `noSpaceActor` (aucun espace) et `ordinaryOwnerActor`
 * (owner d un espace ordinaire, cree en libre-service) sont TOUS LES DEUX
 * refuses — un espace ne donne aucun droit sur ces routes (point 2.3ter).
 */
const platformAdmin: PlatformAdminGateway = {
  async isPlatformAdmin(actor) { return actor === platformAdminActor; },
};

function handlerFor(actor: UserId, gateways = countingGateways()) {
  const service = new DiagnosticsService(gateways.ai, gateways.clariprint, platformAdmin);
  const routes = createDiagnosticsRoutes(service);
  const app = createApiV1Application({
    routes,
    actorResolver: { async resolve() { return { kind: 'user', userId: actor }; } },
    requestIdFactory: () => 'diagnostics-test',
  });
  return { app, gateways };
}

describe('route API Diagnostics', () => {
  it('partage le contrat fournisseur neutre avec le client navigateur, pour un administrateur de la plateforme', async () => {
    const { app } = handlerFor(platformAdminActor);
    const bridge = ((input: RequestInfo | URL, init?: RequestInit) => app(new Request(input, init))) as typeof fetch;
    const client = new DiagnosticsApiClient(new FetchApiClient('https://magrit.test', bridge, () => 'token'));
    expect(await client.aiProvider()).toEqual(diagnostic);
    expect(await client.clariprint()).toEqual(clariprintDiagnostic);
  });

  it('exige une identité avant de lancer le diagnostic', async () => {
    const anonymous = createApiV1Application({
      routes: createDiagnosticsRoutes(new DiagnosticsService(countingGateways().ai, countingGateways().clariprint, platformAdmin)),
      requestIdFactory: () => 'anonymous-test',
    });
    const response = await anonymous(new Request('http://localhost/api/v1/diagnostics/ai'));
    expect(response.status).toBe(401);
  });

  describe.each([
    { path: '/api/v1/diagnostics/ai', calls: (g: ReturnType<typeof countingGateways>) => g.aiCalls },
    { path: '/api/v1/diagnostics/clariprint', calls: (g: ReturnType<typeof countingGateways>) => g.clariprintCalls },
  ])('$path — reserve a l administrateur de la plateforme (BCP-0c)', ({ path, calls }) => {
    it('refuse un compte sans aucun espace, avec 403 identity.role_required, SANS appel sortant', async () => {
      const { app, gateways } = handlerFor(noSpaceActor);
      const response = await app(new Request(`http://localhost${path}`));
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe('identity.role_required');
      expect(calls(gateways)).toBe(0);
    });

    it('refuse l owner d un espace ordinaire (cree en libre-service), avec 403 identity.role_required, SANS appel sortant', async () => {
      const { app, gateways } = handlerFor(ordinaryOwnerActor);
      const response = await app(new Request(`http://localhost${path}`));
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe('identity.role_required');
      expect(calls(gateways)).toBe(0);
    });

    it('laisse passer un administrateur de la plateforme, avec un vrai appel sortant', async () => {
      const { app, gateways } = handlerFor(platformAdminActor);
      const response = await app(new Request(`http://localhost${path}`));

      expect(response.status).toBe(200);
      expect(calls(gateways)).toBe(1);
    });
  });

  it('le client navigateur voit le 403 sous forme de ApiClientError avec le bon code', async () => {
    const { app } = handlerFor(noSpaceActor);
    const bridge = ((input: RequestInfo | URL, init?: RequestInit) => app(new Request(input, init))) as typeof fetch;
    const client = new DiagnosticsApiClient(new FetchApiClient('https://magrit.test', bridge, () => 'token'));

    await expect(client.aiProvider()).rejects.toMatchObject(
      expect.objectContaining({ problem: expect.objectContaining({ status: 403, code: 'identity.role_required' }) }),
    );
    const rejection = await client.aiProvider().catch((error) => error);
    expect(rejection).toBeInstanceOf(ApiClientError);
  });
});
