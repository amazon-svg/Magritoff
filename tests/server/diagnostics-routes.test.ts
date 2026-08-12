import { describe, expect, it } from 'vitest';
import { DiagnosticsApiClient } from '../../src/modules/diagnostics/api/client';
import type { AiDiagnosticsGateway } from '../../src/modules/diagnostics/application/ai-diagnostics-gateway';
import { DiagnosticsService } from '../../src/modules/diagnostics/application/diagnostics-service';
import { FetchApiClient } from '../../src/platform/api';
import { createApiV1Application } from '../../src/server/api/composition';
import { createDiagnosticsRoutes } from '../../src/server/api/diagnostics-routes';

const diagnostic = {
  provider: 'TestAI', configured: true, reachable: true,
  summary: 'Connexion fonctionnelle.', checks: [{ name: 'API', status: 'ok' as const }],
  testedAt: '2026-08-12T12:00:00.000Z',
};
const gateway: AiDiagnosticsGateway = { async testConnection() { return diagnostic; } };
const handler = createApiV1Application({
  routes: createDiagnosticsRoutes(new DiagnosticsService(gateway)),
  actorResolver: { async resolve() { return { kind: 'system', systemId: 'diagnostics-test' }; } },
  requestIdFactory: () => 'diagnostics-test',
});
const bridge = ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;

describe('route API Diagnostics', () => {
  it('partage le contrat fournisseur neutre avec le client navigateur', async () => {
    const client = new DiagnosticsApiClient(new FetchApiClient('https://magrit.test', bridge, () => 'token'));
    expect(await client.aiProvider()).toEqual(diagnostic);
  });

  it('exige une identité avant de lancer le diagnostic', async () => {
    const anonymous = createApiV1Application({ routes: createDiagnosticsRoutes(new DiagnosticsService(gateway)), requestIdFactory: () => 'anonymous-test' });
    const response = await anonymous(new Request('http://localhost/api/v1/diagnostics/ai'));
    expect(response.status).toBe(401);
  });
});
