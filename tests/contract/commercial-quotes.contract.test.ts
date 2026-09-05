/**
 * Module Devis commerciaux (E10.3) contre le contrat.
 *
 * Exerce reellement `createCommercialQuotesRoutes()` via
 * `createGescomApiHandler`, avec un `CommercialQuotesRepository` en memoire
 * qui reutilise `InMemoryProjectsRepository`/`InMemoryCustomersRepository`
 * (E10.1/E10.4, jamais reecrits a la main) et un `OutboxRepository` en
 * memoire pour verifier `quote.created`. Chaque reponse est confrontee au
 * contrat via `checkResponseAgainstContract()`.
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
import { ProjectsService } from '@/modules/projects/application/projects-service';
import { PriceRulesService } from '@/modules/pricing/application/price-rules-service';
import { SingleCostPricingEngine } from '@/modules/pricing/application/single-cost-pricing-engine';
import { CommercialQuotesService } from '@/modules/commercial-quotes/application/commercial-quotes-service';
import type {
  QuoteDetailDto,
  QuoteDto,
  QuoteLineAuditEntryDto,
  QuoteLineDto,
} from '@/modules/commercial-quotes/api/contracts';
import type { ProjectDto } from '@/modules/projects/api/contracts';
import { createProjectsRoutes } from '@/server/api/projects-routes';
import { createCommercialQuotesRoutes } from '@/server/api/commercial-quotes-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';
import { InMemoryProjectsRepository } from './_fakes/projects-repository.fake.ts';
import { InMemoryCustomersRepository } from './_fakes/customers-repository.fake.ts';
import { InMemoryCommercialQuotesRepository } from './_fakes/commercial-quotes-repository.fake.ts';
import { InMemoryPriceRulesRepository } from './_fakes/price-rules-repository.fake.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

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
  scopes: Object.freeze(['quotes:read']),
});
const studioNoScopePrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze([]),
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      if (credential.token === 'jeton-valide') return userPrincipal;
      return null;
    }
    if (credential.key === 'cle-studio') return studioPrincipal;
    if (credential.key === 'cle-studio-sans-scope') return studioNoScopePrincipal;
    return null;
  },
};

let sequence = 0;
function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

let projectsRepository: InMemoryProjectsRepository;
let customersRepository: InMemoryCustomersRepository;
let quotesRepository: InMemoryCommercialQuotesRepository;
let priceRulesRepository: InMemoryPriceRulesRepository;
let outboxRepository: InMemoryOutboxRepository;
let quotesService: CommercialQuotesService;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  projectsRepository = new InMemoryProjectsRepository();
  customersRepository = new InMemoryCustomersRepository();
  quotesRepository = new InMemoryCommercialQuotesRepository(projectsRepository);
  priceRulesRepository = new InMemoryPriceRulesRepository();
  outboxRepository = new InMemoryOutboxRepository();
  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
    newEventId: () => uuid(),
  });
  const projectsService = new ProjectsService({
    repository: projectsRepository,
    customers: customersRepository,
    outbox,
  });
  const priceRulesService = new PriceRulesService({
    repository: priceRulesRepository,
    customers: customersRepository,
    outbox,
  });
  quotesService = new CommercialQuotesService({
    repository: quotesRepository,
    outbox,
    projects: projectsRepository,
    priceRules: priceRulesService,
    pricingEngine: new SingleCostPricingEngine(),
    now: () => new Date('2026-09-01T10:00:00.000Z'),
  });
  handler = createGescomApiHandler({
    routes: [...createProjectsRoutes(projectsService), ...createCommercialQuotesRoutes(quotesService)],
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-3',
  });
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

async function createCustomer(overrides: Partial<Record<string, unknown>> = {}) {
  return customersRepository.create(TENANT, USER, {
    type: 'company',
    company_name: 'Imprimerie IPA',
    siret: '73282932000074',
    ...overrides,
  } as any);
}

async function createProject(customerId: string, overrides: Partial<Record<string, unknown>> = {}) {
  const response = await call('/api/v1/projects', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `project-${uuid()}` },
    body: JSON.stringify({ name: 'Salon Imprim’Expo 2026', customer_id: customerId, ...overrides }),
  });
  await expectContract(response, { status: 201, dataSchema: 'Project' });
  return (await response.json()) as { data: ProjectDto };
}

async function addItem(projectId: string, label: string, quotePayload: Record<string, unknown>) {
  const response = await call(`/api/v1/projects/${projectId}/items`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `item-${uuid()}` },
    body: JSON.stringify({ label, quote_payload: quotePayload }),
  });
  await expectContract(response, { status: 201, dataSchema: 'ProjectItem' });
  return ((await response.json()) as { data: { id: string } }).data.id;
}

async function createQuote(
  projectId: string,
  itemIds: readonly string[],
  idempotencyKey = `quote-${uuid()}`,
) {
  const response = await call('/api/v1/quotes', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ project_id: projectId, item_ids: itemIds }),
  });
  return response;
}

describe('module Devis commerciaux (E10.3) contre le contrat', () => {
  it('CA2/CA3/CA4/CA5/CA6/évènement — cree un devis depuis deux elements coches, brouillon, publie quote.created', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const itemFlyer = await addItem(project.id, 'Flyer A5', {
      quantity: 1000,
      amounts: { clariprint_price_ht: '42.50', price: '45.00' },
    });
    const itemCard = await addItem(project.id, 'Carte de visite', {
      quantity: 500,
      amounts: { price: '12.30' },
    });
    const itemUnselected = await addItem(project.id, 'Non selectionne', { quantity: 100 });
    void itemUnselected;

    const response = await createQuote(project.id, [itemFlyer, itemCard]);
    await expectContract(response, { status: 201, dataSchema: 'QuoteDetail' });
    const { data } = (await response.json()) as { data: QuoteDetailDto };

    // CA4 — le client est herite du projet, jamais ressaisi.
    expect(data.customer_id).toBe(customer.id);
    expect(data.project_id).toBe(project.id);
    // CA5 — numero unique et sequentiel, format DEV-AAAA-NNNNN.
    expect(data.number).toMatch(/^DEV-\d{4}-00001$/);
    // CA6 — statut brouillon a la creation.
    expect(data.status).toBe('draft');
    // CA2/CA3 — exactement les deux elements coches deviennent des lignes,
    // chacune reprend project_item_id, la quantite et le prix de production.
    expect(data.lines).toHaveLength(2);
    const flyerLine = data.lines.find((line) => line.project_item_id === itemFlyer)!;
    expect(flyerLine.quantity).toBe(1000);
    expect(flyerLine.production_price).toBe('42.50'); // priorite clariprint_price_ht
    const cardLine = data.lines.find((line) => line.project_item_id === itemCard)!;
    expect(cardLine.quantity).toBe(500);
    expect(cardLine.production_price).toBe('12.30'); // repli sur price

    // E10.9 (E10.21 desormais livree) : la creation groupee valorise chaque
    // ligne (aucune regle de prix active dans ce test -> marge 0.0000,
    // sale_price demarre sur customer_price, remise et ecart de marge nuls).
    // `origin`/`project_item_id` : ce chemin ne cree que des lignes LIEES a
    // un chiffrage, jamais de ligne libre.
    for (const line of data.lines) {
      expect(line.origin).toBe('project_item');
      expect(line.public_price).toBe(line.production_price);
      expect(line.customer_price).toBe(line.production_price);
      expect(line.applied_margin_rate).toBe('0.0000');
      expect(line.applied_rule_id).toBeNull();
      expect(line.sale_price).toBe(line.production_price);
      expect(line.breakdown.length).toBeGreaterThan(0);
      expect(line.warnings).toEqual([]);
    }

    // `createProject`/`addItem` publient aussi leurs propres evenements sur
    // ce meme outbox partage : on isole `quote.created`, pas la taille totale.
    const quoteCreatedEvents = outboxRepository.events.filter((event) => event.name === 'quote.created');
    expect(quoteCreatedEvents).toHaveLength(1);
    expect(quoteCreatedEvents[0]).toMatchObject({
      name: 'quote.created',
      tenantId: TENANT,
      aggregateType: 'quote',
      aggregateId: data.id,
    });
  });

  it('CA7 — un meme element de projet alimente deux devis successifs, sans etre consomme', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const item = await addItem(project.id, 'Flyer A5', { quantity: 1000 });

    const first = await createQuote(project.id, [item]);
    await expectContract(first, { status: 201, dataSchema: 'QuoteDetail' });
    const firstBody = (await first.json()) as { data: QuoteDetailDto };

    const second = await createQuote(project.id, [item]);
    await expectContract(second, { status: 201, dataSchema: 'QuoteDetail' });
    const secondBody = (await second.json()) as { data: QuoteDetailDto };

    expect(secondBody.data.id).not.toBe(firstBody.data.id);
    expect(secondBody.data.number).not.toBe(firstBody.data.number);

    // L element de projet reste present et inchange dans le projet source.
    const detail = await call(`/api/v1/projects/${project.id}`, { headers: asUser });
    const detailBody = (await detail.json()) as { data: { items: { id: string }[] } };
    expect(detailBody.data.items.map((i) => i.id)).toEqual([item]);
  });

  it('CA8 — Idempotency-Key rejouee rend le devis deja cree, jamais un second', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const item = await addItem(project.id, 'Flyer A5', { quantity: 1000 });
    const key = `replay-${uuid()}`;

    const first = await createQuote(project.id, [item], key);
    await expectContract(first, { status: 201, dataSchema: 'QuoteDetail' });
    const firstBody = (await first.json()) as { data: QuoteDetailDto };
    expect(first.headers.get('Idempotency-Replayed')).toBeNull();

    const replayed = await createQuote(project.id, [item], key);
    await expectContract(replayed, { status: 201, dataSchema: 'QuoteDetail' });
    const replayedBody = (await replayed.json()) as { data: QuoteDetailDto };
    expect(replayed.headers.get('Idempotency-Replayed')).toBe('true');
    expect(replayedBody.data.id).toBe(firstBody.data.id);
    expect(replayedBody.data.number).toBe(firstBody.data.number);

    const list = await call(`/api/v1/quotes?project_id=${project.id}`, { headers: asUser });
    const listBody = (await list.json()) as { data: QuoteDto[] };
    expect(listBody.data).toHaveLength(1); // un seul devis reellement cree
  });

  it('non-duplication de numero — deux creations concurrentes recoivent des numeros distincts', async () => {
    // Lecon du sprint (docs/api/CONVENTIONS.md) : un faux qui ne serialise
    // pas correctement sa section critique de numerotation passerait le
    // typecheck sans que rien ne le detecte. Ce test lance deux creations
    // EN PARALLELE (Promise.all, cles d idempotence distinctes : ce n est
    // pas un rejeu, ce sont deux commandes reellement concurrentes) et
    // exige deux numeros distincts et sequentiels.
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const itemA = await addItem(project.id, 'Flyer A5', { quantity: 1000 });
    const itemB = await addItem(project.id, 'Carte de visite', { quantity: 500 });

    const [responseA, responseB] = await Promise.all([
      createQuote(project.id, [itemA]),
      createQuote(project.id, [itemB]),
    ]);
    await expectContract(responseA, { status: 201, dataSchema: 'QuoteDetail' });
    await expectContract(responseB, { status: 201, dataSchema: 'QuoteDetail' });
    const bodyA = (await responseA.json()) as { data: QuoteDetailDto };
    const bodyB = (await responseB.json()) as { data: QuoteDetailDto };

    expect(bodyA.data.number).not.toBe(bodyB.data.number);
    const numbers = [bodyA.data.number, bodyB.data.number].sort();
    expect(numbers[0]).toMatch(/-00001$/);
    expect(numbers[1]).toMatch(/-00002$/);

    const list = await call(`/api/v1/quotes?project_id=${project.id}`, { headers: asUser });
    const listBody = (await list.json()) as { data: QuoteDto[] };
    expect(listBody.data).toHaveLength(2);
    expect(new Set(listBody.data.map((q) => q.number)).size).toBe(2); // aucun doublon
  });

  it('CA3 (contrat) — item_ids absent du projet est refuse en 422 quote.items_invalid', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const otherProject = await createProject(customer.id, { name: 'Autre projet' });
    const otherItem = await addItem(otherProject.data.id, 'Element autre projet', { quantity: 1 });

    const response = await createQuote(project.id, [otherItem]);
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.items_invalid');
  });

  it('projet introuvable du tenant est refuse en 404 quote.project_not_found', async () => {
    const response = await call('/api/v1/quotes', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `quote-${uuid()}` },
      body: JSON.stringify({ project_id: uuid(), item_ids: [uuid()] }),
    });
    await expectContract(response, { status: 404 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.project_not_found');
  });

  it('liste, filtre par customer_id/project_id/status et pagine par curseur', async () => {
    const customerA = await createCustomer({ company_name: 'Client A' });
    const customerB = await createCustomer({ company_name: 'Client B', siret: '56078919152347' });
    const { data: projectA } = await createProject(customerA.id);
    const { data: projectB } = await createProject(customerB.id);
    const itemA1 = await addItem(projectA.id, 'A1', { quantity: 1 });
    const itemA2 = await addItem(projectA.id, 'A2', { quantity: 1 });
    const itemB = await addItem(projectB.id, 'B1', { quantity: 1 });

    await createQuote(projectA.id, [itemA1]);
    await createQuote(projectA.id, [itemA2]);
    await createQuote(projectB.id, [itemB]);

    const byCustomer = await call(`/api/v1/quotes?customer_id=${customerA.id}`, { headers: asUser });
    await expectContract(byCustomer, { status: 200 });
    expect(((await byCustomer.json()) as { data: QuoteDto[] }).data).toHaveLength(2);

    const byProject = await call(`/api/v1/quotes?project_id=${projectB.id}`, { headers: asUser });
    await expectContract(byProject, { status: 200 });
    expect(((await byProject.json()) as { data: QuoteDto[] }).data).toHaveLength(1);

    const byStatus = await call('/api/v1/quotes?status=draft', { headers: asUser });
    await expectContract(byStatus, { status: 200 });
    expect(((await byStatus.json()) as { data: QuoteDto[] }).data).toHaveLength(3);

    const paged = await call('/api/v1/quotes?page[size]=2', { headers: asUser });
    await expectContract(paged, { status: 200 });
    const pagedBody = (await paged.json()) as { data: QuoteDto[]; meta: { next_cursor: string | null } };
    expect(pagedBody.data).toHaveLength(2);
    expect(pagedBody.meta.next_cursor).not.toBeNull();
  });

  it('?customer_id= et ?project_id= malformes sont refuses en 400, jamais un 500', async () => {
    const badCustomer = await call('/api/v1/quotes?customer_id=abc', { headers: asUser });
    await expectContract(badCustomer, { status: 400 });

    const badProject = await call('/api/v1/quotes?project_id=abc', { headers: asUser });
    await expectContract(badProject, { status: 400 });
  });

  it('GET/PATCH proteges par ETag/If-Match (CA9), PATCH modifie validite et affichage des remises', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const item = await addItem(project.id, 'Flyer A5', { quantity: 1000 });
    const created = await createQuote(project.id, [item]);
    const { data: quote } = (await created.json()) as { data: QuoteDetailDto };

    const detail = await call(`/api/v1/quotes/${quote.id}`, { headers: asUser });
    await expectContract(detail, { status: 200, dataSchema: 'QuoteDetail' });
    const etag = detail.headers.get('etag');
    expect(etag).toBeTruthy();

    const withoutIfMatch = await call(`/api/v1/quotes/${quote.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ show_discounts: true }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    const patched = await call(`/api/v1/quotes/${quote.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag! },
      body: JSON.stringify({ show_discounts: true, valid_until: '2026-12-31' }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'Quote' });
    const patchedBody = (await patched.json()) as { data: QuoteDto };
    expect(patchedBody.data.show_discounts).toBe(true);
    expect(patchedBody.data.valid_until).toBe('2026-12-31');
  });

  it('un devis inconnu du tenant rend 404, jamais une autre reponse', async () => {
    const response = await call(`/api/v1/quotes/${uuid()}`, { headers: asUser });
    await expectContract(response, { status: 404 });
  });

  it('CA6 — supprime un devis brouillon, refuse sur tout autre statut (409)', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const item = await addItem(project.id, 'Flyer A5', { quantity: 1000 });
    const created = await createQuote(project.id, [item]);
    const { data: quote } = (await created.json()) as { data: QuoteDetailDto };

    quotesRepository.forceStatusForTest(quote.id, 'sent');
    const refused = await call(`/api/v1/quotes/${quote.id}`, { method: 'DELETE', headers: asUser });
    await expectContract(refused, { status: 409 });
    const refusedBody = (await refused.json()) as { code: string };
    expect(refusedBody.code).toBe('quote.delete_requires_draft');

    quotesRepository.forceStatusForTest(quote.id, 'draft');
    const removed = await call(`/api/v1/quotes/${quote.id}`, { method: 'DELETE', headers: asUser });
    await expectContract(removed, { status: 200 });
    const removedBody = (await removed.json()) as { data: { deleted: boolean } };
    expect(removedBody.data.deleted).toBe(true);

    const afterDelete = await call(`/api/v1/quotes/${quote.id}`, { headers: asUser });
    await expectContract(afterDelete, { status: 404 });
  });

  it('Studio (cle de service, scope quotes:read) peut lire mais pas ecrire', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const item = await addItem(project.id, 'Flyer A5', { quantity: 1000 });
    const created = await createQuote(project.id, [item]);
    const { data: quote } = (await created.json()) as { data: QuoteDetailDto };

    const readable = await call(`/api/v1/quotes/${quote.id}`, {
      headers: { 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(readable, { status: 200, dataSchema: 'QuoteDetail' });

    const writeAttempt = await call('/api/v1/quotes', {
      method: 'POST',
      headers: {
        'X-Magrit-Service-Key': 'cle-studio',
        'Content-Type': 'application/json',
        'Idempotency-Key': `create-${uuid()}`,
      },
      body: JSON.stringify({ project_id: project.id, item_ids: [item] }),
    });
    // authentication: 'user' sur createQuoteFromProject -> refuse toute cle de service.
    await expectContract(writeAttempt, { status: 403 });
  });

  it('une cle de service sans le scope quotes:read recoit 403', async () => {
    const response = await call('/api/v1/quotes', {
      headers: { 'X-Magrit-Service-Key': 'cle-studio-sans-scope' },
    });
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.scope_required');
  });
});

describe('module Devis commerciaux (E10.9) contre le contrat — lignes et audit', () => {
  async function createDraftQuote() {
    const customer = await createCustomer({ company_name: `Client ${uuid()}` });
    const { data: project } = await createProject(customer.id);
    const item = await addItem(project.id, 'Flyer A5', {
      quantity: 1000,
      amounts: { clariprint_price_ht: '100.00' },
    });
    const created = await createQuote(project.id, [item]);
    const { data: quote } = (await created.json()) as { data: QuoteDetailDto };
    return { customer, project, item, quote };
  }

  async function addFreeLine(quoteId: string, overrides: Partial<Record<string, unknown>> = {}) {
    return call(`/api/v1/quotes/${quoteId}/lines`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `line-${uuid()}` },
      body: JSON.stringify({
        label: 'Ligne libre',
        quantity: 10,
        production_price: '50.00',
        ...overrides,
      }),
    });
  }

  it('CA1, addLine elargi — ligne LIBRE : sale_price demarre sur customer_price, aucune remise', async () => {
    const { quote } = await createDraftQuote();
    const response = await addFreeLine(quote.id);
    await expectContract(response, { status: 201, dataSchema: 'QuoteLine' });
    expect(response.headers.get('etag')).toBeTruthy();
    const { data: line } = (await response.json()) as { data: QuoteLineDto };

    expect(line.origin).toBe('free');
    expect(line.project_item_id).toBeNull();
    expect(line.production_price).toBe('50.00');
    expect(line.public_price).toBe('50.00'); // aucune regle/marge active -> 0.0000
    expect(line.customer_price).toBe('50.00');
    expect(line.sale_price).toBe('50.00');
    expect(line.discount_rate).toBe('0.0000');
    expect(line.margin_variation).toBe('0.0000');
    expect(line.warnings).toEqual([]);
  });

  it('addLine elargi — ligne LIEE a un chiffrage : reprend label/production_price, quantite differente alerte production_cost_stale', async () => {
    const { quote, item } = await createDraftQuote();
    const response = await call(`/api/v1/quotes/${quote.id}/lines`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `line-${uuid()}` },
      body: JSON.stringify({ project_item_id: item, quantity: 2000 }),
    });
    await expectContract(response, { status: 201, dataSchema: 'QuoteLine' });
    const { data: line } = (await response.json()) as { data: QuoteLineDto };

    expect(line.origin).toBe('project_item');
    expect(line.project_item_id).toBe(item);
    expect(line.label).toBe('Flyer A5');
    expect(line.production_price).toBe('100.00'); // repris du chiffrage, jamais recalcule
    expect(line.quantity).toBe(2000);
    expect(line.warnings.map((w) => w.code)).toContain('production_cost_stale');
  });

  it('addLine — project_item_id hors du projet source est refuse en 422 quote_line.project_item_invalid', async () => {
    const { quote } = await createDraftQuote();
    const otherCustomer = await createCustomer({ company_name: `Autre ${uuid()}` });
    const { data: otherProject } = await createProject(otherCustomer.id);
    const otherItem = await addItem(otherProject.id, 'Hors projet', { quantity: 1 });

    const response = await call(`/api/v1/quotes/${quote.id}/lines`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `line-${uuid()}` },
      body: JSON.stringify({ project_item_id: otherItem }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote_line.project_item_invalid');
  });

  it('addLine sur un devis non brouillon est refuse en 409 quote_line.quote_not_draft', async () => {
    const { quote } = await createDraftQuote();
    quotesRepository.forceStatusForTest(quote.id, 'sent');
    const response = await addFreeLine(quote.id);
    await expectContract(response, { status: 409 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote_line.quote_not_draft');
  });

  it('getQuoteLine rend l ETag de la ligne ; une ligne d un autre devis rend 404', async () => {
    const { quote } = await createDraftQuote();
    const added = await addFreeLine(quote.id);
    const { data: line } = (await added.json()) as { data: QuoteLineDto };

    const fetched = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { headers: asUser });
    await expectContract(fetched, { status: 200, dataSchema: 'QuoteLine' });
    expect(fetched.headers.get('etag')).toBeTruthy();

    const { quote: otherQuote } = await createDraftQuote();
    const notFound = await call(`/api/v1/quotes/${otherQuote.id}/lines/${line.id}`, { headers: asUser });
    await expectContract(notFound, { status: 404 });
    expect(((await notFound.json()) as { code: string }).code).toBe('quote_line.not_found');
  });

  it('CA1-CA4, CA9 — updateQuoteLine : sale_price OU margin_rate, mutuellement exclusifs, If-Match protege', async () => {
    const { quote } = await createDraftQuote();
    const added = await addFreeLine(quote.id, { production_price: '100.00' });
    const { data: line } = (await added.json()) as { data: QuoteLineDto };
    const etag = (await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { headers: asUser })).headers.get(
      'etag',
    )!;

    const withoutIfMatch = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ sale_price: '90.00' }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    const both = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ sale_price: '90.00', margin_rate: '0.1000' }),
    });
    await expectContract(both, { status: 422 });

    // CA2/CA3 — sale_price a 90.00 sur customer_price 100.00 -> remise 10 %.
    const patched = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ sale_price: '90.00' }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'QuoteLine' });
    const { data: updated } = (await patched.json()) as { data: QuoteLineDto };
    expect(updated.sale_price).toBe('90.00');
    expect(updated.discount_rate).toBe('0.1000');
    expect(updated.production_price).toBe('100.00'); // colonne immuable (CA4)

    // If-Match perime (celui d avant le PATCH precedent) -> 409.
    const stale = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ quantity: 5 }),
    });
    await expectContract(stale, { status: 409 });
    expect(((await stale.json()) as { code: string }).code).toBe('api.resource_conflict');
  });

  it('CA7 amende — vente sous le cout : warning negative_margin, 200 jamais un refus', async () => {
    const { quote } = await createDraftQuote();
    const added = await addFreeLine(quote.id, { production_price: '100.00' });
    const { data: line } = (await added.json()) as { data: QuoteLineDto };
    const etag = (await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { headers: asUser })).headers.get(
      'etag',
    )!;

    const patched = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ sale_price: '40.00' }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'QuoteLine' });
    const { data: updated } = (await patched.json()) as { data: QuoteLineDto };
    expect(updated.warnings.map((w) => w.code)).toContain('negative_margin');
  });

  it('updateQuoteLine — margin_rate sur une ligne dont production_price vaut 0.00 est refuse (quote_line.margin_not_derivable)', async () => {
    const { quote } = await createDraftQuote();
    const added = await addFreeLine(quote.id, { production_price: '0.00' });
    const { data: line } = (await added.json()) as { data: QuoteLineDto };
    const etag = (await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { headers: asUser })).headers.get(
      'etag',
    )!;

    const response = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ margin_rate: '0.2000' }),
    });
    await expectContract(response, { status: 422 });
    expect(((await response.json()) as { code: string }).code).toBe('quote_line.margin_not_derivable');
  });

  it('updateQuoteLine — margin_rate produisant un sale_price negatif est refuse en 422 (qa-review C1, quote_line.invalid_margin_rate)', async () => {
    const { quote } = await createDraftQuote();
    const added = await addFreeLine(quote.id, { production_price: '100.00' });
    const { data: line } = (await added.json()) as { data: QuoteLineDto };
    const etag = (await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { headers: asUser })).headers.get(
      'etag',
    )!;

    // -2.0000 est un Rate valide au contrat (motif regex ^-?[0-9]{1,2}\.
    // [0-9]{4}$, remise/marge negative documentee comme acceptee) mais
    // produirait ici 100.00 * (1 - 2) = -100.00 : non representable en
    // Money. Avant ce correctif, `salePriceFromMarginRate` levait un `Error`
    // generique non rattrape par `withDomainErrors`, retombant sur un 500.
    const response = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ margin_rate: '-2.0000' }),
    });
    await expectContract(response, { status: 422 });
    expect(((await response.json()) as { code: string }).code).toBe('quote_line.invalid_margin_rate');
  });

  it('updateQuoteLine sur un devis non brouillon est refuse en 409 (qa-review, point mineur 5)', async () => {
    const { quote } = await createDraftQuote();
    const added = await addFreeLine(quote.id, { production_price: '100.00' });
    const { data: line } = (await added.json()) as { data: QuoteLineDto };
    const etag = (await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { headers: asUser })).headers.get(
      'etag',
    )!;
    quotesRepository.forceStatusForTest(quote.id, 'sent');

    const response = await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ sale_price: '90.00' }),
    });
    await expectContract(response, { status: 409 });
    expect(((await response.json()) as { code: string }).code).toBe('quote_line.quote_not_draft');
  });

  it('CA6 elargi — deleteQuoteLine retire la ligne et resserre les positions restantes', async () => {
    const { quote } = await createDraftQuote();
    const first = (await (await addFreeLine(quote.id, { label: 'Un' })).json()) as { data: QuoteLineDto };
    const second = (await (await addFreeLine(quote.id, { label: 'Deux' })).json()) as { data: QuoteLineDto };
    const third = (await (await addFreeLine(quote.id, { label: 'Trois' })).json()) as { data: QuoteLineDto };
    void first;

    const removed = await call(`/api/v1/quotes/${quote.id}/lines/${second.data.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    await expectContract(removed, { status: 200 });
    expect(((await removed.json()) as { data: { deleted: boolean } }).data.deleted).toBe(true);

    const detail = await call(`/api/v1/quotes/${quote.id}`, { headers: asUser });
    const { data } = (await detail.json()) as { data: QuoteDetailDto };
    // 4 lignes au depart (le chiffrage initial + 3 libres), 3 restantes,
    // positions contigues 0..2.
    expect(data.lines).toHaveLength(3);
    expect(data.lines.map((l) => l.position)).toEqual([0, 1, 2]);
    expect(data.lines.some((l) => l.id === third.data.id)).toBe(true);

    const gone = await call(`/api/v1/quotes/${quote.id}/lines/${second.data.id}`, { headers: asUser });
    await expectContract(gone, { status: 404 });
  });

  it('deleteQuoteLine sur un devis non brouillon est refuse en 409', async () => {
    const { quote } = await createDraftQuote();
    const line = (await (await addFreeLine(quote.id)).json()) as { data: QuoteLineDto };
    quotesRepository.forceStatusForTest(quote.id, 'accepted');
    const response = await call(`/api/v1/quotes/${quote.id}/lines/${line.data.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    await expectContract(response, { status: 409 });
    expect(((await response.json()) as { code: string }).code).toBe('quote_line.quote_not_draft');
  });

  it('reorderQuoteLines sur un devis non brouillon est refuse en 409 (qa-review, point mineur 5)', async () => {
    const { quote } = await createDraftQuote();
    const second = (await (await addFreeLine(quote.id, { label: 'Deux' })).json()) as { data: QuoteLineDto };
    // Statut force AVANT de lire l ETag : celui-ci reflete donc deja le
    // devis "sent", le test isole ainsi la garde d etat (409
    // quote_line.quote_not_draft) d un simple conflit d ETag perime
    // (409 api.resource_conflict, deja couvert par ailleurs).
    quotesRepository.forceStatusForTest(quote.id, 'sent');

    const detail = await call(`/api/v1/quotes/${quote.id}`, { headers: asUser });
    const etag = detail.headers.get('etag')!;
    const { data } = (await detail.json()) as { data: QuoteDetailDto };
    const firstId = data.lines.find((l) => l.id !== second.data.id)!.id;

    const response = await call(`/api/v1/quotes/${quote.id}/line-positions`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ line_ids: [second.data.id, firstId] }),
    });
    await expectContract(response, { status: 409 });
    expect(((await response.json()) as { code: string }).code).toBe('quote_line.quote_not_draft');
  });

  it('reorderQuoteLines — reordonne integralement les lignes, If-Match sur LE DEVIS', async () => {
    const { quote } = await createDraftQuote();
    const second = (await (await addFreeLine(quote.id, { label: 'Deux' })).json()) as { data: QuoteLineDto };
    const detailBefore = await call(`/api/v1/quotes/${quote.id}`, { headers: asUser });
    const quoteEtag = detailBefore.headers.get('etag')!;
    const { data: before } = (await detailBefore.json()) as { data: QuoteDetailDto };
    const firstId = before.lines.find((l) => l.id !== second.data.id)!.id;

    const withoutIfMatch = await call(`/api/v1/quotes/${quote.id}/line-positions`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ line_ids: [second.data.id, firstId] }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    const reordered = await call(`/api/v1/quotes/${quote.id}/line-positions`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': quoteEtag },
      body: JSON.stringify({ line_ids: [second.data.id, firstId] }),
    });
    await expectContract(reordered, { status: 200, dataSchema: 'QuoteDetail' });
    const { data: after } = (await reordered.json()) as { data: QuoteDetailDto };
    expect(after.lines.find((l) => l.id === second.data.id)!.position).toBe(0);
    expect(after.lines.find((l) => l.id === firstId)!.position).toBe(1);

    // B1 (qa-review, BLOQUANT) — le contrat promet que TOUTE ecriture de
    // ligne (dont le reordonnancement) avance updated_at du devis, donc son
    // ETag (openapi/magrit-core.v1.yaml, description du parametre If-Match
    // de reorderQuoteLines). Verifie DIRECTEMENT que l ETag a change...
    expect(reordered.headers.get('etag')).not.toBe(quoteEtag);
    // ...puis rejoue le MEME If-Match (desormais perime) sur un second
    // reordonnancement complet et valide : DOIT rendre 409, jamais un second
    // succes qui ecraserait silencieusement le premier en concurrence
    // optimiste inerte.
    const staleRetry = await call(`/api/v1/quotes/${quote.id}/line-positions`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': quoteEtag },
      body: JSON.stringify({ line_ids: [firstId, second.data.id] }),
    });
    await expectContract(staleRetry, { status: 409 });
    expect(((await staleRetry.json()) as { code: string }).code).toBe('api.resource_conflict');

    // Ensemble incomplet -> 422 quote_line.positions_mismatch, aucun effet.
    const mismatchEtag = reordered.headers.get('etag')!;
    const mismatch = await call(`/api/v1/quotes/${quote.id}/line-positions`, {
      method: 'PUT',
      headers: { ...jsonHeaders, 'If-Match': mismatchEtag },
      body: JSON.stringify({ line_ids: [firstId] }),
    });
    await expectContract(mismatch, { status: 422 });
    expect(((await mismatch.json()) as { code: string }).code).toBe('quote_line.positions_mismatch');
  });

  it('CA5/CA6 — listQuoteAuditEntries : une entree par champ change, garde can_manage_pricing, ligne supprimee reste interrogeable', async () => {
    const { quote } = await createDraftQuote();
    const added = await addFreeLine(quote.id, { production_price: '100.00' });
    const { data: line } = (await added.json()) as { data: QuoteLineDto };
    const etag = (await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { headers: asUser })).headers.get(
      'etag',
    )!;
    await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ sale_price: '80.00' }),
    });
    await call(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { method: 'DELETE', headers: asUser });

    const entries = await call(`/api/v1/quotes/${quote.id}/audit-entries?line_id=${line.id}`, {
      headers: asUser,
    });
    await expectContract(entries, { status: 200 });
    const { data } = (await entries.json()) as { data: QuoteLineAuditEntryDto[] };
    // added (creation) + updated/sale_price + updated/discount_rate + removed
    // — au moins ces 4 entrees, plus recentes en tete (removed en premier).
    expect(data[0]!.action).toBe('removed');
    expect(data.some((entry) => entry.action === 'added')).toBe(true);
    expect(data.some((entry) => entry.action === 'updated' && entry.field === 'sale_price')).toBe(true);
    expect(data.every((entry) => entry.field !== ('sale_margin_rate' as unknown))).toBe(true);

    // Garde d acces au droit dedie `can_manage_pricing` (403 identity.role_required, E10.11).
    quotesRepository.setActorCapabilityForTest(TENANT, USER, 'can_manage_pricing', false);
    const denied = await call(`/api/v1/quotes/${quote.id}/audit-entries`, { headers: asUser });
    await expectContract(denied, { status: 403 });
    expect(((await denied.json()) as { code: string }).code).toBe('identity.role_required');
    quotesRepository.setActorCapabilityForTest(TENANT, USER, 'can_manage_pricing', true);
  });
});
