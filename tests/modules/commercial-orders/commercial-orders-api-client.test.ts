/**
 * `CommercialOrdersApiClient.list()` — serialisation des parametres de
 * requete (E10.18e-1, qa-review round 1, 2026-09-14, M3) : avant ce
 * correctif, `currentProductionStepId`/`sort` n etaient exerces par AUCUN
 * test — un oubli de serialisation dans `client.ts` (M06/M07 de la campagne
 * de mutation) survivait sans qu aucune gate ne le voie. Patron repris de
 * `tests/platform/api/fetch-api-client.test.ts` : un `fetch` factice capture
 * l URL reellement construite.
 */
import { describe, expect, it, vi } from 'vitest';
import { CommercialOrdersApiClient } from '@/modules/commercial-orders/api/client';
import { FetchApiClient } from '@/platform/api/fetch-api-client';

function fakeFetchCapturingUrl(onUrl: (url: string) => void): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    onUrl(String(input));
    return new Response(JSON.stringify({ data: [], meta: { request_id: 'req-1', next_cursor: null } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('CommercialOrdersApiClient.list — serialisation des parametres de requete', () => {
  it('transmet current_production_step_id et sort dans la query string quand ils sont fournis', async () => {
    // Mutation qui ferait tomber ce test : supprimer la ligne qui appelle
    // `params.set('current_production_step_id', ...)` ou celle qui appelle
    // `params.set('sort', ...)` dans `client.ts` (M06/M07 de la campagne de
    // mutation qa-review round 1).
    let capturedUrl = '';
    const client = new CommercialOrdersApiClient(
      new FetchApiClient('https://magrit.test', fakeFetchCapturingUrl((u) => (capturedUrl = u))),
    );

    await client.list({ currentProductionStepId: 'step-1', sort: 'production_step' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('current_production_step_id')).toBe('step-1');
    expect(url.searchParams.get('sort')).toBe('production_step');
  });

  it('transmet le tri inverse par etape tel quel', async () => {
    let capturedUrl = '';
    const client = new CommercialOrdersApiClient(
      new FetchApiClient('https://magrit.test', fakeFetchCapturingUrl((u) => (capturedUrl = u))),
    );

    await client.list({ sort: '-production_step' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('sort')).toBe('-production_step');
  });

  it('n envoie ni l un ni l autre parametre quand ils sont absents', async () => {
    let capturedUrl = '';
    const client = new CommercialOrdersApiClient(
      new FetchApiClient('https://magrit.test', fakeFetchCapturingUrl((u) => (capturedUrl = u))),
    );

    await client.list({});

    const url = new URL(capturedUrl);
    expect(url.searchParams.has('current_production_step_id')).toBe(false);
    expect(url.searchParams.has('sort')).toBe(false);
  });

  it('combine periode, client, etape et tri dans la meme requete', async () => {
    let capturedUrl = '';
    const client = new CommercialOrdersApiClient(
      new FetchApiClient('https://magrit.test', fakeFetchCapturingUrl((u) => (capturedUrl = u))),
    );

    await client.list({
      createdFrom: '2026-09-01',
      createdTo: '2026-09-30',
      customerId: 'cust-1',
      currentProductionStepId: 'step-1',
      sort: 'production_step',
      pageSize: 50,
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('created_from')).toBe('2026-09-01');
    expect(url.searchParams.get('created_to')).toBe('2026-09-30');
    expect(url.searchParams.get('customer_id')).toBe('cust-1');
    expect(url.searchParams.get('current_production_step_id')).toBe('step-1');
    expect(url.searchParams.get('sort')).toBe('production_step');
    expect(url.searchParams.get('page[size]')).toBe('50');
  });
});
