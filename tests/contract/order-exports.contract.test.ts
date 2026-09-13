/**
 * `GET/POST /commercial-order-exports`, `GET /commercial-order-exports/{id}`
 * contre le contrat (story E10.18c).
 *
 * Exerce reellement `createOrderExportsRoutes()` via
 * `createGescomApiHandler`, avec un `OrderExportsRepository` en memoire
 * (`InMemoryOrderExportsRepository`, aucune dependance a Supabase). Chaque
 * reponse est confrontee au contrat via `checkResponseAgainstContract`.
 *
 * Ce que ce fichier NE couvre PAS : le comportement reel en base (RLS,
 * trigger d immuabilite, `api_request_order_export`/`api_claim_order_exports`/
 * `api_read_order_export_rows` — SEULE preuve d isolation de tenant,
 * `tests/sql/gescom-e10-18c-order-exports.sql`), le rendu CSV
 * (`tests/modules/order-exports/csv-renderer.test.ts`) et le drain de
 * generation (`tests/modules/order-exports/order-export-generation-service.test.ts`).
 * La validation `quote_id` inconnu (422) n est pas exercee ici non plus :
 * `CommercialQuotesService` a un graphe de dependances lourd (projets,
 * regles de prix, moteur de prix, documents) sans rapport avec ce module ;
 * le chemin de code est IDENTIQUE a celui, deja teste, de
 * `commercial-orders.contract.test.ts`.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import { InMemoryIdempotencyStore, type ApiPrincipal, type PrincipalVerifier } from '@/modules/_shared/application';
import { OrderExportsService } from '@/modules/order-exports/application/order-exports-service';
import type { OrderExportDto } from '@/modules/order-exports/api/contracts';
import { CustomersService } from '@/modules/customers/application/customers-service';
import { CommercialQuotesService } from '@/modules/commercial-quotes/application/commercial-quotes-service';
import { ProductionStepsService } from '@/modules/production-steps/application/production-steps-service';
import { createOrderExportsRoutes } from '@/server/api/order-exports-routes';
import { createGescomApiHandler } from '@/server/api';
import { InMemoryOrderExportsRepository, fakeExportUuid } from './_fakes/order-exports-repository.fake.ts';
import { InMemoryCustomersRepository } from './_fakes/customers-repository.fake.ts';
import { InMemoryCommercialQuotesRepository } from './_fakes/commercial-quotes-repository.fake.ts';
import { InMemoryProductionStepsRepository } from './_fakes/production-steps-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const OTHER_TENANT = brand<TenantId>('11111111-1111-4111-8111-111111111111');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');
const OTHER_USER = brand<UserId>('b2c3d4e5-f6a7-4809-9011-2b3c4d5e6f7a');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const otherUserPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: OTHER_USER, tenantId: TENANT });

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      if (credential.token === 'jeton-valide') return userPrincipal;
      if (credential.token === 'jeton-autre-membre') return otherUserPrincipal;
      return null;
    }
    return null;
  },
};

let repository: InMemoryOrderExportsRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryOrderExportsRepository();
  const service = new OrderExportsService({ repository });
  const customers = new CustomersService({ repository: new InMemoryCustomersRepository() });
  const commercialQuotes = new CommercialQuotesService({
    repository: new InMemoryCommercialQuotesRepository(),
    outbox: { publish: async () => {} } as any,
    projects: { findById: async () => null } as any,
    priceRules: {} as any,
    pricingEngine: {} as any,
    documents: {} as any,
  });
  const productionSteps = new ProductionStepsService({ repository: new InMemoryProductionStepsRepository() });

  handler = createGescomApiHandler({
    routes: createOrderExportsRoutes(service, customers, commercialQuotes, productionSteps),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-18c',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const asOtherUser = { Authorization: 'Bearer jeton-autre-membre' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

function postExportBody(overrides: Partial<{ format: string; granularity: string; filters: unknown }> = {}): string {
  return JSON.stringify({ format: 'csv', granularity: 'order', ...overrides });
}

describe('POST /commercial-order-exports (E10.18c) contre le contrat', () => {
  it('cree une demande pending, filtres republies a l identique', async () => {
    const response = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': 'key-request-1' },
      body: postExportBody({ filters: { status: 'validated' } }),
    });
    await expectContract(response, { status: 201 });
    const { data } = (await response.json()) as { data: OrderExportDto };
    expect(data.status).toBe('pending');
    expect(data.format).toBe('csv');
    expect(data.granularity).toBe('order');
    // La route normalise les filtres (nulls explicites sur les champs
    // omis) avant de les enregistrer — republies A L IDENTIQUE ensuite.
    expect(data.filters).toEqual({
      customer_id: null,
      quote_id: null,
      status: 'validated',
      current_production_step_id: null,
      created_from: null,
      created_to: null,
    });
    expect(data.requested_by).toBe(USER);
    expect(data.download_url).toBeNull();
  });

  it('403 identity.role_required sans le droit can_export_orders', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_export_orders', false);
    const response = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': 'key-request-2' },
      body: postExportBody(),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.role_required');
  });

  it('422 order_export.pending_limit_reached a la quatrieme demande non terminee', async () => {
    for (let i = 0; i < 3; i += 1) {
      const response = await call('/api/v1/commercial-order-exports', {
        method: 'POST',
        headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': `key-limit-${i}-xxxxx` },
        body: postExportBody(),
      });
      expect(response.status).toBe(201);
    }
    const fourth = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': 'key-limit-3-xxxxx' },
      body: postExportBody(),
    });
    expect(fourth.status).toBe(422);
    const body = (await fourth.json()) as { code: string };
    expect(body.code).toBe('order_export.pending_limit_reached');
  });

  it('422 api.validation_failed sur une date de calendrier inexistante (2026-06-31)', async () => {
    const response = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': 'key-calendar-1' },
      body: postExportBody({ filters: { created_from: '2026-06-31' } }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('422 quand created_from est posterieure a created_to', async () => {
    const response = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': 'key-order-inv1' },
      body: postExportBody({ filters: { created_from: '2026-06-30', created_to: '2026-06-01' } }),
    });
    expect(response.status).toBe(422);
  });

  it('422 production_step.not_found sur une etape inconnue du tenant', async () => {
    const response = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': 'key-step-inv1' },
      body: postExportBody({ filters: { current_production_step_id: '00000000-0000-4000-9200-999999999999' } }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('production_step.not_found');
  });

  it('422 sur un customer_id inconnu du tenant', async () => {
    const response = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { ...asUser, 'Content-Type': 'application/json', 'Idempotency-Key': 'key-customer-1' },
      body: postExportBody({ filters: { customer_id: '00000000-0000-4000-9000-999999999999' } }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('401 sans jeton', async () => {
    const response = await call('/api/v1/commercial-order-exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-anon-inv1' },
      body: postExportBody(),
    });
    expect(response.status).toBe(401);
  });
});

describe('GET /commercial-order-exports/{exportId} (E10.18c) contre le contrat', () => {
  it('download_url reserve au DEMANDEUR sur un export ready, null pour un autre membre (jamais 403)', async () => {
    const exportId = fakeExportUuid();
    repository.seedForTest({ id: exportId, tenant_id: TENANT, requested_by: USER, status: 'ready', row_count: 3 });

    const asOwner = await call(`/api/v1/commercial-order-exports/${exportId}`, { headers: asUser });
    await expectContract(asOwner, { status: 200 });
    const ownerBody = (await asOwner.json()) as { data: OrderExportDto };
    expect(ownerBody.data.download_url).not.toBeNull();

    const asOther = await call(`/api/v1/commercial-order-exports/${exportId}`, { headers: asOtherUser });
    expect(asOther.status).toBe(200);
    const otherBody = (await asOther.json()) as { data: OrderExportDto };
    expect(otherBody.data.download_url).toBeNull();
    expect(otherBody.data.status).toBe('ready');
    expect(otherBody.data.row_count).toBe(3);
  });

  it('404 order_export.not_found pour un identifiant inconnu', async () => {
    const response = await call(`/api/v1/commercial-order-exports/${fakeExportUuid()}`, { headers: asUser });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order_export.not_found');
  });

  it('404 identique pour un export d un autre tenant (jamais une reponse distincte)', async () => {
    const exportId = fakeExportUuid();
    repository.seedForTest({ id: exportId, tenant_id: OTHER_TENANT, requested_by: USER, status: 'ready' });
    const response = await call(`/api/v1/commercial-order-exports/${exportId}`, { headers: asUser });
    expect(response.status).toBe(404);
  });

  it('403 sans le droit can_export_orders, meme pour son propre export', async () => {
    const exportId = fakeExportUuid();
    repository.seedForTest({ id: exportId, tenant_id: TENANT, requested_by: USER, status: 'pending' });
    repository.setActorCapabilityForTest(TENANT, USER, 'can_export_orders', false);
    const response = await call(`/api/v1/commercial-order-exports/${exportId}`, { headers: asUser });
    expect(response.status).toBe(403);
  });
});

describe('GET /commercial-order-exports (E10.18c) contre le contrat', () => {
  it('TENANT-LARGE : voit les demandes de TOUS les membres, du plus recent au plus ancien', async () => {
    repository.seedForTest({
      id: fakeExportUuid(),
      tenant_id: TENANT,
      requested_by: OTHER_USER,
      requested_at: '2026-09-12T08:00:00.000Z',
    });
    repository.seedForTest({
      id: fakeExportUuid(),
      tenant_id: TENANT,
      requested_by: USER,
      requested_at: '2026-09-12T09:00:00.000Z',
    });

    const response = await call('/api/v1/commercial-order-exports', { headers: asUser });
    await expectContract(response, { status: 200 });
    const { data } = (await response.json()) as { data: OrderExportDto[] };
    expect(data).toHaveLength(2);
    expect(data[0]?.requested_at).toBe('2026-09-12T09:00:00.000Z');
    // Meme si USER n est pas l auteur de la seconde entree, il la VOIT (registre
    // tenant-large) — seul le download_url lui serait refuse si elle etait ready.
    expect(data.map((row) => row.requested_by)).toEqual(expect.arrayContaining([USER, OTHER_USER]));
  });

  it('filtre par status/format/granularity', async () => {
    repository.seedForTest({ id: fakeExportUuid(), tenant_id: TENANT, requested_by: USER, status: 'ready', format: 'csv' });
    repository.seedForTest({ id: fakeExportUuid(), tenant_id: TENANT, requested_by: USER, status: 'pending', format: 'csv' });

    const response = await call('/api/v1/commercial-order-exports?status=ready', { headers: asUser });
    const { data } = (await response.json()) as { data: OrderExportDto[] };
    expect(data).toHaveLength(1);
    expect(data[0]?.status).toBe('ready');
  });

  it('403 sans le droit can_export_orders', async () => {
    repository.setActorCapabilityForTest(TENANT, USER, 'can_export_orders', false);
    const response = await call('/api/v1/commercial-order-exports', { headers: asUser });
    expect(response.status).toBe(403);
  });

  it('pagination par curseur — page[size] borne la page, meta.next_cursor present', async () => {
    repository.seedForTest({ id: fakeExportUuid(), tenant_id: TENANT, requested_by: USER });
    repository.seedForTest({ id: fakeExportUuid(), tenant_id: TENANT, requested_by: USER });

    const paged = await call('/api/v1/commercial-order-exports?page[size]=1', { headers: asUser });
    await expectContract(paged, { status: 200 });
    const body = (await paged.json()) as { data: OrderExportDto[]; meta: { next_cursor: string | null } };
    expect(body.data).toHaveLength(1);
    expect(body.meta.next_cursor).not.toBeNull();
  });
});
