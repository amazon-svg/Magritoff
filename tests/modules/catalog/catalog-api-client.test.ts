import { describe, expect, it, vi } from 'vitest';
import { CatalogApiClient } from '../../../src/modules/catalog/api/client';
import { FetchApiClient } from '../../../src/platform/api/fetch-api-client';

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
});
