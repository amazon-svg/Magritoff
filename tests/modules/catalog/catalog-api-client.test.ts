import { describe, expect, it, vi } from 'vitest';
import { CatalogApiClient } from '@/modules/catalog/api/client';
import { FetchApiClient } from '@/platform/api/fetch-api-client';

describe('CatalogApiClient', () => {
  it('utilise le contrat tenant des souscriptions de gammes', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify([{ gammeSlug: 'flyers', active: true, displayOrder: 0 }]));
    });
    const client = new CatalogApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));

    await client.gammeSubscriptions(tenantId);
    await client.setGammeSubscriptions(tenantId, { subscriptions: [{ gammeSlug: 'flyers', active: true }] });

    expect(calls).toEqual([
      { url: `/api/v1/tenants/${tenantId}/catalog/gamme-subscriptions`, method: 'GET', body: null },
      { url: `/api/v1/tenants/${tenantId}/catalog/gamme-subscriptions`, method: 'PUT', body: { subscriptions: [{ gammeSlug: 'flyers', active: true }] } },
    ]);
  });

  it('consomme les lectures et commandes PIM versionnées', async () => {
    const calls: string[] = [];
    const gamme = { id: '22222222-2222-4222-8222-222222222222', slug: 'flyers', name: 'Flyers', parentSlug: null, matchingRules: {}, displayOrder: 0, imageUrl: null };
    const definition = { id: '33333333-3333-4333-8333-333333333333', gammeSlug: 'flyers', variationFilter: {}, locale: 'fr', name: null, keywords: null, titleTemplate: null, shortDescriptionTemplate: null, descriptionTemplate: null, h1Template: null, seoTitle: null, seoDescription: null, schemaOrgType: null, usageExamples: [], faq: [], qualityScore: null, generatedBy: null, validatedBy: 'pending', imageUrl: null, commercialPitch: null, benefits: null, useCases: null, technicalSpec: null, lastReviewedAt: null, version: 1 };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'; const url = String(input); calls.push(`${method} ${url}`);
      if (method === 'GET') return new Response(JSON.stringify({ gammes: [gamme], definitions: [definition] }));
      if (method === 'PUT' && url.includes('/gammes/')) return new Response(JSON.stringify(gamme));
      if (method === 'PUT') return new Response(JSON.stringify(definition));
      return new Response(JSON.stringify({ removed: true }));
    });
    const client = new CatalogApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));
    await client.pimCatalog();
    await client.upsertPimGamme({ slug: 'flyers', name: 'Flyers' });
    await client.deletePimGamme('flyers');
    await client.upsertPimDefinition({ gammeSlug: 'flyers', variationFilter: {}, locale: 'fr' });
    await client.deletePimDefinition(definition.id);
    expect(calls).toEqual([
      'GET /api/v1/catalog/pim', 'PUT /api/v1/catalog/pim/gammes/flyers', 'DELETE /api/v1/catalog/pim/gammes/flyers',
      'PUT /api/v1/catalog/pim/definitions', `DELETE /api/v1/catalog/pim/definitions/${definition.id}`,
    ]);
  });

  it('consomme les opérations PIM longues via la façade catalogue', async () => {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'; const url = String(input);
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === 'GET') return new Response(JSON.stringify({ pendingCount: 2 }));
      if (url.endsWith('/ingestion')) return new Response(JSON.stringify({ dryRun: true, totalCandidates: 0, matched: [], rejected: [], enriched: [], errors: [] }));
      return new Response(JSON.stringify({ generated: { name: 'Flyer' } }));
    });
    const client = new CatalogApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));
    expect(await client.pimPendingCandidates()).toBe(2);
    await client.runPimIngest(true);
    expect(await client.generatePimDefinition({ gammeSlug: 'flyers', locale: 'fr' })).toEqual({ name: 'Flyer' });
    expect(calls).toEqual([
      { method: 'GET', url: '/api/v1/catalog/pim/ingestion', body: null },
      { method: 'POST', url: '/api/v1/catalog/pim/ingestion', body: { dryRun: true } },
      { method: 'POST', url: '/api/v1/catalog/pim/generation', body: { gammeSlug: 'flyers', locale: 'fr', variationFilter: {}, mode: 'generate' } },
    ]);
  });
});
