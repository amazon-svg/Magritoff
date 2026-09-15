/**
 * `OrderExportsApiClient` (E10.18e-2) — serialisation des parametres de
 * requete et cycle de vie de `Idempotency-Key`. Patron repris de
 * `tests/modules/commercial-orders/commercial-orders-api-client.test.ts` :
 * un `fetch` factice capture l URL et le corps REELLEMENT envoyes.
 *
 * Le point le plus important de ce fichier est NEGATIF : `request()` ne doit
 * JAMAIS generer sa propre `Idempotency-Key` (a la difference de tous les
 * autres clients E10, ex. `CommercialOrdersApiClient.convertQuote`) — la
 * consigne (docs/api/CONVENTIONS.md §8.24, E10.18e-2 point 4) exige un cycle
 * de vie pilote par l ecran. Le test dedie appelle `request()` DEUX FOIS
 * avec la MEME cle et verifie qu elle est transmise TELLE QUELLE les deux
 * fois — une regression qui appellerait `crypto.randomUUID()` en interne
 * ferait echouer ce test (deux valeurs differentes captees).
 */
import { describe, expect, it, vi } from 'vitest';
import { OrderExportsApiClient } from '@/modules/order-exports/api/client';
import { FetchApiClient } from '@/platform/api/fetch-api-client';
import type { OrderExportDto } from '@/modules/order-exports/api/contracts';

function fixtureExport(overrides: Partial<OrderExportDto> = {}): OrderExportDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'pending',
    format: 'xlsx',
    granularity: 'order',
    filters: {},
    layout_version: 1,
    requested_by: '22222222-2222-4222-8222-222222222222',
    requested_by_label: 'Alice Imprimeur',
    requested_at: '2026-09-15T10:00:00.000Z',
    started_at: null,
    completed_at: null,
    row_count: null,
    file_name: null,
    byte_size: null,
    sha256: null,
    content_type: null,
    download_url: null,
    download_url_expires_at: null,
    expires_at: null,
    attempts: 0,
    error_code: null,
    error_detail: null,
    ...overrides,
  };
}

function fakeFetch(onCall: (input: RequestInfo | URL, init?: RequestInit) => void, body: unknown): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    onCall(input, init);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('OrderExportsApiClient.list — serialisation des parametres de requete', () => {
  it('transmet status/format/granularite/pagination quand fournis', async () => {
    let capturedUrl = '';
    const client = new OrderExportsApiClient(
      new FetchApiClient(
        'https://magrit.test',
        fakeFetch((input) => (capturedUrl = String(input)), {
          data: [fixtureExport()],
          meta: { request_id: 'req-1', next_cursor: 'cursor-2' },
        }),
      ),
    );

    const result = await client.list({ status: 'ready', format: 'csv', granularity: 'line', pageSize: 10, pageCursor: 'cursor-1' });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('status')).toBe('ready');
    expect(url.searchParams.get('format')).toBe('csv');
    expect(url.searchParams.get('granularity')).toBe('line');
    expect(url.searchParams.get('page[size]')).toBe('10');
    expect(url.searchParams.get('page[cursor]')).toBe('cursor-1');
    expect(result.nextCursor).toBe('cursor-2');
    expect(result.items).toHaveLength(1);
  });

  it('n envoie aucun parametre quand ils sont tous absents', async () => {
    let capturedUrl = '';
    const client = new OrderExportsApiClient(
      new FetchApiClient(
        'https://magrit.test',
        fakeFetch((input) => (capturedUrl = String(input)), { data: [], meta: { request_id: 'req-1', next_cursor: null } }),
      ),
    );

    const result = await client.list();

    const url = new URL(capturedUrl);
    expect([...url.searchParams.keys()]).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

describe('OrderExportsApiClient.request — cycle de vie de Idempotency-Key PILOTE PAR L APPELANT', () => {
  it('transmet la cle fournie TELLE QUELLE, sans jamais en generer une elle-meme', async () => {
    // Mutation qui ferait tomber ce test : remplacer `idempotencyKey` par
    // `crypto.randomUUID()` dans `client.ts` — les deux appels capteraient
    // alors des valeurs DIFFERENTES.
    const capturedKeys: (string | null)[] = [];
    const client = new OrderExportsApiClient(
      new FetchApiClient(
        'https://magrit.test',
        fakeFetch((_input, init) => capturedKeys.push(new Headers(init?.headers).get('Idempotency-Key')), {
          data: fixtureExport(),
          meta: { request_id: 'req-1' },
        }),
      ),
    );

    await client.request({ format: 'xlsx', granularity: 'order' }, 'export-key-a');
    await client.request({ format: 'xlsx', granularity: 'order' }, 'export-key-a');

    expect(capturedKeys).toEqual(['export-key-a', 'export-key-a']);
  });

  it('transmet le format/la granularite/les filtres du corps sans les alterer', async () => {
    let capturedBody: unknown;
    const client = new OrderExportsApiClient(
      new FetchApiClient(
        'https://magrit.test',
        fakeFetch(
          (_input, init) => {
            capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
          },
          { data: fixtureExport(), meta: { request_id: 'req-1' } },
        ),
      ),
    );

    await client.request(
      { format: 'csv', granularity: 'line', filters: { customer_id: '33333333-3333-4333-8333-333333333333' } },
      'export-key-b',
    );

    expect(capturedBody).toEqual({
      format: 'csv',
      granularity: 'line',
      filters: { customer_id: '33333333-3333-4333-8333-333333333333' },
    });
  });
});

describe('OrderExportsApiClient.get — reemission de l URL de telechargement', () => {
  it('rend l export tel que servi, y compris un download_url frais', async () => {
    const client = new OrderExportsApiClient(
      new FetchApiClient(
        'https://magrit.test',
        fakeFetch(() => undefined, {
          data: fixtureExport({ status: 'ready', download_url: 'https://storage.test/fresh-url', row_count: 12 }),
          meta: { request_id: 'req-1' },
        }),
      ),
    );

    const result = await client.get('11111111-1111-4111-8111-111111111111');

    expect(result.download_url).toBe('https://storage.test/fresh-url');
    expect(result.row_count).toBe(12);
  });

  it('MOYEN C02 (qa-review round 1) — appelle le CHEMIN /{id}, jamais une query string', async () => {
    // Mutation qui ferait tomber ce test :
    // `path: `${ORDER_EXPORTS_BASE_PATH}?id=${exportId}`` au lieu du chemin.
    let capturedUrl = '';
    const client = new OrderExportsApiClient(
      new FetchApiClient(
        'https://magrit.test',
        fakeFetch((input) => (capturedUrl = String(input)), { data: fixtureExport(), meta: { request_id: 'req-1' } }),
      ),
    );

    await client.get('export-xyz');

    const url = new URL(capturedUrl);
    expect(url.pathname.endsWith('/commercial-order-exports/export-xyz')).toBe(true);
    expect(url.search).toBe('');
  });
});

describe('OrderExportsApiClient.request — methode HTTP (MOYEN C03, qa-review round 1)', () => {
  it('envoie un POST, jamais un GET', async () => {
    // Mutation qui ferait tomber ce test : retirer `method: 'POST'` du
    // `client.request()` (la requete partirait alors en GET, methode par
    // defaut de `FetchApiClient`).
    let capturedMethod = '';
    const client = new OrderExportsApiClient(
      new FetchApiClient(
        'https://magrit.test',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          capturedMethod = init?.method ?? 'GET';
          return new Response(JSON.stringify({ data: fixtureExport(), meta: { request_id: 'req-1' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }) as unknown as typeof fetch,
      ),
    );

    await client.request({ format: 'xlsx', granularity: 'order' }, 'export-key-c');

    expect(capturedMethod).toBe('POST');
  });
});
