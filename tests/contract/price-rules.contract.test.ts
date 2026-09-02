/**
 * Module Pricing — referentiel des regles de prix contre le contrat (story
 * E10.6).
 *
 * Exerce reellement `createPriceRulesRoutes()` via `createGescomApiHandler`,
 * avec un `PriceRulesRepository` et un `CustomersRepository` en memoire
 * (aucune dependance a Supabase) et un `OutboxRepository` en memoire pour
 * verifier `price_rule.changed` (CA10). Chaque reponse est confrontee au
 * contrat via `checkResponseAgainstContract`.
 *
 * Hors perimetre (E10.7) : aucun test de `resolvePriceRule` ici.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  OutboxPublisher,
  type ApiPrincipal,
  type OutboxEvent,
  type OutboxRepository,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { PriceRulesService } from '@/modules/pricing/application/price-rules-service';
import type { PriceRuleDto } from '@/modules/pricing/api/contracts';
import { createPriceRulesRoutes } from '@/server/api/price-rules-routes';
import { createGescomApiHandler } from '@/server/api';
import { InMemoryCustomersRepository } from './_fakes/customers-repository.fake.ts';
import { InMemoryPriceRulesRepository } from './_fakes/price-rules-repository.fake.ts';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');
const RANGE_ID = '11111111-1111-4111-8111-111111111100';
const UNKNOWN_RANGE_ID = '11111111-1111-4111-8111-111111119999';

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const studioPrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze(['price-rules:read']),
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    return credential.key === 'cle-studio' ? studioPrincipal : null;
  },
};

let sequence = 0;
function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8200-${String(sequence).padStart(12, '0')}`;
}

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

let priceRules: InMemoryPriceRulesRepository;
let customers: InMemoryCustomersRepository;
let outboxRepository: InMemoryOutboxRepository;
let handler: (request: Request) => Promise<Response>;
let customerId: string;

beforeEach(async () => {
  priceRules = new InMemoryPriceRulesRepository();
  priceRules.knownProductRanges.add(RANGE_ID);
  customers = new InMemoryCustomersRepository();
  outboxRepository = new InMemoryOutboxRepository();
  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-02T10:00:00.000Z'),
    newEventId: () => uuid(),
  });
  const service = new PriceRulesService({ repository: priceRules, customers, outbox });
  handler = createGescomApiHandler({
    routes: createPriceRulesRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-6',
  });

  const created = await customers.create(TENANT, USER, { type: 'individual', civility: 'mr', first_name: 'Jean', last_name: 'Dupont' });
  customerId = created.id;
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

async function createGlobalRule(overrides: Partial<Record<string, unknown>> = {}) {
  const response = await call('/api/v1/price-rules', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
    body: JSON.stringify({
      name: 'Marge minimale standard',
      scope: 'global',
      value_type: 'margin_rate',
      value: '0.5000',
      starts_on: '2026-09-01',
      ...overrides,
    }),
  });
  await expectContract(response, { status: 201, dataSchema: 'PriceRule' });
  return (await response.json()) as { data: PriceRuleDto };
}

describe('module Pricing — referentiel des regles de prix (E10.6) contre le contrat', () => {
  it('CA1/CA10 — cree une regle globale et publie price_rule.changed(created)', async () => {
    const { data } = await createGlobalRule();
    expect(data.scope).toBe('global');
    expect(data.customer_id).toBeNull();
    expect(data.product_range_id).toBeNull();
    expect(data.is_active).toBe(true);
    expect(outboxRepository.events).toHaveLength(1);
    expect(outboxRepository.events[0]).toMatchObject({
      name: 'price_rule.changed',
      tenantId: TENANT,
      aggregateType: 'price_rule',
      aggregateId: data.id,
      payload: { rule_id: data.id, action: 'created' },
    });
  });

  it('CA2 — scope=customer sans customer_id est refuse en 422 price_rule.invalid_scope', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: 'Regle client',
        scope: 'customer',
        value_type: 'margin_rate',
        value: '0.1000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('price_rule.invalid_scope');
  });

  it('CA2 — scope=global avec un customer_id fourni est refuse en 422 price_rule.invalid_scope', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: 'Globale avec client',
        scope: 'global',
        customer_id: customerId,
        value_type: 'margin_rate',
        value: '0.1000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('price_rule.invalid_scope');
  });

  it('CA2 — un customer_id inconnu du tenant est refuse en 422 price_rule.customer_unknown', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: 'Client inconnu',
        scope: 'customer',
        customer_id: uuid(),
        value_type: 'margin_rate',
        value: '0.1000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('price_rule.customer_unknown');
  });

  it('CA2 — un product_range_id inconnu du catalogue est refuse en 422 price_rule.product_range_unknown', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: 'Gamme inconnue',
        scope: 'range',
        product_range_id: UNKNOWN_RANGE_ID,
        value_type: 'discount_rate',
        value: '0.1000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('price_rule.product_range_unknown');
  });

  it('CA2 — scope=customer_range coherent avec des cibles connues est accepte', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: 'Client + gamme',
        scope: 'customer_range',
        customer_id: customerId,
        product_range_id: RANGE_ID,
        value_type: 'margin_rate',
        value: '0.5000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 201, dataSchema: 'PriceRule' });
  });

  it('CA1 — ends_on anterieure ou egale a starts_on est refuse en 422 price_rule.invalid_period', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: 'Periode inversee',
        scope: 'global',
        value_type: 'margin_rate',
        value: '0.5000',
        starts_on: '2026-09-10',
        ends_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('price_rule.invalid_period');
  });

  it('CA1 — un nom vide est refuse en 422 api.validation_failed', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: '   ',
        scope: 'global',
        value_type: 'margin_rate',
        value: '0.5000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('CA1 — un taux negatif est refuse en 422 api.validation_failed (le signe n est jamais dans value)', async () => {
    const response = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        name: 'Taux negatif',
        scope: 'global',
        value_type: 'margin_rate',
        value: '-0.5000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(response, { status: 422 });
  });

  it('M2 — GET /price-rules/{id} emet un ETag exploitable par le PATCH', async () => {
    const { data: rule } = await createGlobalRule();
    const detail = await call(`/api/v1/price-rules/${rule.id}`, { headers: asUser });
    await expectContract(detail, { status: 200, dataSchema: 'PriceRule' });
    const etag = detail.headers.get('etag');
    expect(etag).toBeTruthy();

    const patched = await call(`/api/v1/price-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag! },
      body: JSON.stringify({ value: '0.6000' }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'PriceRule' });
  });

  it('CA9 — un PATCH sans If-Match est refuse en 428, un If-Match perime en 409', async () => {
    const { data: rule } = await createGlobalRule();

    const withoutIfMatch = await call(`/api/v1/price-rules/${rule.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ value: '0.6000' }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    const stale = await call(`/api/v1/price-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': '"stale-etag"' },
      body: JSON.stringify({ value: '0.6000' }),
    });
    await expectContract(stale, { status: 409 });
  });

  it('CA — scope/customer_id/product_range_id/value_type sont immuables : un PATCH qui les porte est refuse', async () => {
    const { data: rule } = await createGlobalRule();
    const etag = (await call(`/api/v1/price-rules/${rule.id}`, { headers: asUser })).headers.get('etag')!;

    const response = await call(`/api/v1/price-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ scope: 'range' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('CA — un PATCH ne portant QUE is_active publie activated/deactivated ; toute autre modification publie updated', async () => {
    const { data: rule } = await createGlobalRule();
    outboxRepository.events.length = 0;

    const etag1 = (await call(`/api/v1/price-rules/${rule.id}`, { headers: asUser })).headers.get('etag')!;
    await call(`/api/v1/price-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag1 },
      body: JSON.stringify({ is_active: false }),
    });
    expect(outboxRepository.events.at(-1)).toMatchObject({ payload: { action: 'deactivated' } });

    const etag2 = (await call(`/api/v1/price-rules/${rule.id}`, { headers: asUser })).headers.get('etag')!;
    await call(`/api/v1/price-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag2 },
      body: JSON.stringify({ is_active: true }),
    });
    expect(outboxRepository.events.at(-1)).toMatchObject({ payload: { action: 'activated' } });

    const etag3 = (await call(`/api/v1/price-rules/${rule.id}`, { headers: asUser })).headers.get('etag')!;
    await call(`/api/v1/price-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag3 },
      body: JSON.stringify({ name: 'Renommee' }),
    });
    expect(outboxRepository.events.at(-1)).toMatchObject({ payload: { action: 'updated' } });
  });

  it('CA5 — liste, filtre par statut et par nom', async () => {
    await createGlobalRule({ name: 'Marge carterie' });
    const { data: disabled } = await createGlobalRule({ name: 'Marge affiches' });
    const etag = (await call(`/api/v1/price-rules/${disabled.id}`, { headers: asUser })).headers.get('etag')!;
    await call(`/api/v1/price-rules/${disabled.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ is_active: false }),
    });

    const all = await call('/api/v1/price-rules', { headers: asUser });
    await expectContract(all, { status: 200 });
    expect(((await all.json()) as { data: PriceRuleDto[] }).data).toHaveLength(2);

    const activeOnly = await call('/api/v1/price-rules?status=active', { headers: asUser });
    await expectContract(activeOnly, { status: 200 });
    const activeBody = (await activeOnly.json()) as { data: PriceRuleDto[] };
    expect(activeBody.data).toHaveLength(1);
    expect(activeBody.data[0]?.name).toBe('Marge carterie');

    const searched = await call('/api/v1/price-rules?q=affiches', { headers: asUser });
    await expectContract(searched, { status: 200 });
    expect(((await searched.json()) as { data: PriceRuleDto[] }).data).toHaveLength(1);
  });

  it('CA5 — pagine par curseur et refuse un sort different de celui du curseur en cours', async () => {
    await createGlobalRule({ name: 'Regle 1' });
    await createGlobalRule({ name: 'Regle 2' });

    const firstPage = await call('/api/v1/price-rules?page[size]=1', { headers: asUser });
    await expectContract(firstPage, { status: 200 });
    const firstBody = (await firstPage.json()) as { data: PriceRuleDto[]; meta: { next_cursor: string | null } };
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.meta.next_cursor).toBeTruthy();

    const nextPage = await call(
      `/api/v1/price-rules?page[size]=1&page[cursor]=${encodeURIComponent(firstBody.meta.next_cursor!)}`,
      { headers: asUser },
    );
    await expectContract(nextPage, { status: 200 });
    expect(((await nextPage.json()) as { data: PriceRuleDto[] }).data).toHaveLength(1);

    const mismatchedSort = await call(
      `/api/v1/price-rules?sort=-starts_on&page[cursor]=${encodeURIComponent(firstBody.meta.next_cursor!)}`,
      { headers: asUser },
    );
    await expectContract(mismatchedSort, { status: 422 });
    const mismatchedBody = (await mismatchedSort.json()) as { code: string };
    expect(mismatchedBody.code).toBe('api.validation_failed');
  });

  it('CA8 — Studio (cle de service, scope price-rules:read) peut lire mais pas ecrire', async () => {
    const { data: rule } = await createGlobalRule();

    const readable = await call(`/api/v1/price-rules/${rule.id}`, {
      headers: { 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(readable, { status: 200, dataSchema: 'PriceRule' });

    const writeAttempt = await call('/api/v1/price-rules', {
      method: 'POST',
      headers: {
        'X-Magrit-Service-Key': 'cle-studio',
        'Content-Type': 'application/json',
        'Idempotency-Key': `create-${uuid()}`,
      },
      body: JSON.stringify({
        name: 'Ecriture Studio',
        scope: 'global',
        value_type: 'margin_rate',
        value: '0.1000',
        starts_on: '2026-09-01',
      }),
    });
    await expectContract(writeAttempt, { status: 403 });
  });

  it('CA4 — marge publique standard : null tant que non definie, ETag exploitable pour le premier PUT', async () => {
    const initial = await call(`/api/v1/product-ranges/${RANGE_ID}/default-margins`, { headers: asUser });
    await expectContract(initial, { status: 200, dataSchema: 'ProductRangeDefaultMargin' });
    const initialBody = (await initial.json()) as { data: { margin_rate: string | null } };
    expect(initialBody.data.margin_rate).toBeNull();
    const etag = initial.headers.get('etag');
    expect(etag).toBeTruthy();

    const set = await call(`/api/v1/product-ranges/${RANGE_ID}/default-margins`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag! },
      body: JSON.stringify({ margin_rate: '0.4000' }),
    });
    await expectContract(set, { status: 200, dataSchema: 'ProductRangeDefaultMargin' });
    const setBody = (await set.json()) as { data: { margin_rate: string | null } };
    expect(setBody.data.margin_rate).toBe('0.4000');

    const reread = await call(`/api/v1/product-ranges/${RANGE_ID}/default-margins`, { headers: asUser });
    const rereadBody = (await reread.json()) as { data: { margin_rate: string | null } };
    expect(rereadBody.data.margin_rate).toBe('0.4000');
  });

  it('CA4 — une gamme inconnue rend 404 price_rule.product_range_unknown, en GET comme en PUT', async () => {
    const get = await call(`/api/v1/product-ranges/${UNKNOWN_RANGE_ID}/default-margins`, { headers: asUser });
    await expectContract(get, { status: 404 });
    expect(((await get.json()) as { code: string }).code).toBe('price_rule.product_range_unknown');

    const put = await call(`/api/v1/product-ranges/${UNKNOWN_RANGE_ID}/default-margins`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': '"whatever"' },
      body: JSON.stringify({ margin_rate: '0.1000' }),
    });
    await expectContract(put, { status: 404 });
  });

  it('CA7 — une regle inconnue du tenant rend 404, jamais une autre reponse', async () => {
    const response = await call(`/api/v1/price-rules/${uuid()}`, { headers: asUser });
    await expectContract(response, { status: 404 });
  });
});
