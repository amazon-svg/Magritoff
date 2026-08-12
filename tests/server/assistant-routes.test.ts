import { describe, expect, it } from 'vitest';
import { DiagnosticsApiClient } from '../../src/modules/diagnostics/api/client';
import type { AiCompletionGateway } from '../../src/modules/diagnostics/application/ai-completion-gateway';
import { AssistantService } from '../../src/modules/diagnostics/application/assistant-service';
import type { AssistantAccessGateway } from '../../src/modules/diagnostics/application/assistant-access-gateway';
import { FetchApiClient } from '../../src/platform/api';
import { createApiV1Application } from '../../src/server/api/composition';
import { createAssistantRoutes } from '../../src/server/api/assistant-routes';

const allowed: AssistantAccessGateway = { async isTenantMember() { return true; } };
function bridge(gateway: AiCompletionGateway, access: AssistantAccessGateway = allowed): typeof fetch {
  const handler = createApiV1Application({
    routes: createAssistantRoutes(new AssistantService(gateway, access)),
    actorResolver: { async resolve() { return { kind: 'user', userId: '00000000-0000-4000-8000-000000000001' as any }; } },
    requestIdFactory: () => 'assistant-test',
  });
  return ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
}

describe('route API assistant éditorial', () => {
  it('partage le contrat API et nettoie une réponse JSON balisée', async () => {
    const gateway: AiCompletionGateway = { async complete() { return { text: '```json\n{"title":"Imprimez mieux","intro":"Des supports utiles.","seo":"Impression B2B."}\n```', model: 'test' }; } };
    const client = new DiagnosticsApiClient(new FetchApiClient('https://magrit.test', bridge(gateway), () => 'token'));
    await expect(client.categoryEditorial('tenant-1', { familyName: 'Papeterie', subcategories: ['Carnets'], sampleProducts: ['Bloc-notes'] })).resolves.toEqual({ editorial: { title: 'Imprimez mieux', intro: 'Des supports utiles.', seo: 'Impression B2B.' }, generated: true });
  });

  it('conserve le socle déterministe si le fournisseur est indisponible', async () => {
    const gateway: AiCompletionGateway = { async complete() { throw new Error('offline'); } };
    const client = new DiagnosticsApiClient(new FetchApiClient('https://magrit.test', bridge(gateway), () => 'token'));
    await expect(client.categoryEditorial('tenant-1', { familyName: 'Papeterie', subcategories: [], sampleProducts: [] })).resolves.toEqual({ editorial: {}, generated: false });
  });

  it('refuse les appels anonymes', async () => {
    const service = new AssistantService({ async complete() { return { text: '{}', model: 'test' }; } }, allowed);
    const handler = createApiV1Application({ routes: createAssistantRoutes(service), requestIdFactory: () => 'anonymous-assistant' });
    const response = await handler(new Request('http://localhost/api/v1/tenants/tenant-1/assistant/category-editorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ familyName: 'Papeterie', subcategories: [], sampleProducts: [] }) }));
    expect(response.status).toBe(401);
  });

  it('refuse un utilisateur extérieur au tenant avant l’appel IA', async () => {
    let called = false;
    const gateway: AiCompletionGateway = { async complete() { called = true; return { text: '{}', model: 'test' }; } };
    const denied: AssistantAccessGateway = { async isTenantMember() { return false; } };
    const response = await bridge(gateway, denied)(new Request('https://magrit.test/api/v1/tenants/tenant-1/assistant/category-editorial', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' }, body: JSON.stringify({ familyName: 'Papeterie', subcategories: [], sampleProducts: [] }) }));
    expect(response.status).toBe(403);
    expect(called).toBe(false);
  });
});
