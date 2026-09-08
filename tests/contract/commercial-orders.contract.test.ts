/**
 * Module Commandes de gestion commerciale (E10.12, « bouton Valider ») contre
 * le contrat.
 *
 * Exerce reellement `createCommercialOrdersRoutes()` (avec
 * `createCommercialQuotesRoutes()` monte a cote, `convertQuote` en dependant
 * pour lire le devis a convertir) via `createGescomApiHandler`, avec les
 * memes faux en memoire que `commercial-quotes.contract.test.ts`
 * (`InMemoryCommercialQuotesRepository`, jamais reecrit deux fois) plus
 * `InMemoryCommercialOrdersRepository`, qui DELEGUE la transition du devis
 * source a `applyConversionForTest()` plutot que de la reimplementer.
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
import { CommercialOrdersService } from '@/modules/commercial-orders/application/commercial-orders-service';
import { ProductionStepsService } from '@/modules/production-steps/application/production-steps-service';
import type { QuoteAuditEntryDto, QuoteDetailDto } from '@/modules/commercial-quotes/api/contracts';
import type {
  CommercialOrderDetailDto,
  CommercialOrderDto,
} from '@/modules/commercial-orders/api/contracts';
import type { ProjectDto } from '@/modules/projects/api/contracts';
import { createProjectsRoutes } from '@/server/api/projects-routes';
import { createCommercialQuotesRoutes } from '@/server/api/commercial-quotes-routes';
import { createCommercialOrdersRoutes } from '@/server/api/commercial-orders-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';
import { InMemoryProjectsRepository } from './_fakes/projects-repository.fake.ts';
import { InMemoryCustomersRepository } from './_fakes/customers-repository.fake.ts';
import { InMemoryCommercialQuotesRepository } from './_fakes/commercial-quotes-repository.fake.ts';
import { InMemoryPriceRulesRepository } from './_fakes/price-rules-repository.fake.ts';
import { InMemoryCommercialOrdersRepository } from './_fakes/commercial-orders-repository.fake.ts';
import { InMemoryProductionStepsRepository } from './_fakes/production-steps-repository.fake.ts';

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
  scopes: Object.freeze(['orders:read']),
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
  return `00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`;
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
let ordersRepository: InMemoryCommercialOrdersRepository;
let priceRulesRepository: InMemoryPriceRulesRepository;
let outboxRepository: InMemoryOutboxRepository;
let productionStepsRepository: InMemoryProductionStepsRepository;
let quotesService: CommercialQuotesService;
let ordersService: CommercialOrdersService;
let productionStepsService: ProductionStepsService;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  projectsRepository = new InMemoryProjectsRepository();
  customersRepository = new InMemoryCustomersRepository();
  quotesRepository = new InMemoryCommercialQuotesRepository(projectsRepository);
  ordersRepository = new InMemoryCommercialOrdersRepository(quotesRepository);
  priceRulesRepository = new InMemoryPriceRulesRepository();
  outboxRepository = new InMemoryOutboxRepository();
  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-08T10:00:00.000Z'),
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
    now: () => new Date('2026-09-08T10:00:00.000Z'),
  });
  ordersService = new CommercialOrdersService({
    repository: ordersRepository,
    outbox,
    quotes: quotesService,
  });
  productionStepsRepository = new InMemoryProductionStepsRepository();
  productionStepsService = new ProductionStepsService({ repository: productionStepsRepository });
  handler = createGescomApiHandler({
    routes: [
      ...createProjectsRoutes(projectsService),
      ...createCommercialQuotesRoutes(quotesService),
      ...createCommercialOrdersRoutes(ordersService, quotesService, productionStepsService),
    ],
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-12',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };
const asStudio = { 'X-Magrit-Service-Key': 'cle-studio' };
const asStudioNoScope = { 'X-Magrit-Service-Key': 'cle-studio-sans-scope' };

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

async function createProject(customerId: string): Promise<ProjectDto> {
  const response = await call('/api/v1/projects', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `project-${uuid()}` },
    body: JSON.stringify({ customer_id: customerId, name: 'Projet E10.12' }),
  });
  const { data } = (await response.json()) as { data: ProjectDto };
  return data;
}

/**
 * Devis `draft` avec une ligne, cree directement par le faux (E10.3 exige un
 * `item_id` issu d un chiffrage de projet que ce fichier ne construit pas —
 * meme raccourci de fixture que `seedDraftQuoteForTest`, TEST UNIQUEMENT,
 * jamais un chemin d API).
 */
async function createDraftQuote(): Promise<QuoteDetailDto> {
  const customer = await createCustomer();
  const project = await createProject(customer.id);
  return quotesRepository.seedDraftQuoteForTest(TENANT, USER, {
    customerId: customer.id,
    projectId: project.id,
  });
}

/** Devis `sent` avec une ligne, pret a etre converti — passe par l API REELLE pour la ligne et l envoi. */
async function createSentQuote(): Promise<QuoteDetailDto> {
  const draft = await createDraftQuote();

  const addLineResponse = await call(`/api/v1/quotes/${draft.id}/lines`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `line-${uuid()}` },
    body: JSON.stringify({ label: 'Flyers A5', quantity: 500, production_price: '100.00' }),
  });
  expect(addLineResponse.status).toBe(201);

  const etagResponse = await call(`/api/v1/quotes/${draft.id}`, { headers: asUser });
  const etag = etagResponse.headers.get('etag')!;

  const sendResponse = await call(`/api/v1/quotes/${draft.id}/transmissions`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'If-Match': etag, 'Idempotency-Key': `send-${uuid()}` },
    body: JSON.stringify({}),
  });
  expect(sendResponse.status).toBe(201);
  const { data: sent } = (await sendResponse.json()) as { data: QuoteDetailDto };
  return sent;
}

async function convert(quoteId: string): Promise<Response> {
  return call(`/api/v1/quotes/${quoteId}/conversions`, {
    method: 'POST',
    headers: { ...asUser, 'Idempotency-Key': `conv-${uuid()}` },
  });
}

describe('Commandes de gestion commerciale (E10.12)', () => {
  it('convertQuote — devis SENT : commande 201, source_quote_status=sent, devis converti, evenement quote.converted, audit converted', async () => {
    const quote = await createSentQuote();

    const withoutIdempotency = await call(`/api/v1/quotes/${quote.id}/conversions`, {
      method: 'POST',
      headers: asUser,
    });
    expect(withoutIdempotency.status).toBe(400);

    const response = await convert(quote.id);
    await expectContract(response, { status: 201, dataSchema: 'CommercialOrderDetail' });
    expect(response.headers.get('etag')).toBeTruthy();

    const { data: order } = (await response.json()) as { data: CommercialOrderDetailDto };
    expect(order.status).toBe('validated');
    expect(order.source_quote_status).toBe('sent');
    expect(order.quote_id).toBe(quote.id);
    expect(order.customer_id).toBe(quote.customer_id);
    expect(order.number).toMatch(/^CDE-\d{4}-\d{5}$/);
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]!.label).toBe('Flyers A5');
    expect(order.lines[0]!.sale_price).toBe(quote.lines[0]!.sale_price);
    expect(order.lines[0]!.source_quote_line_id).toBe(quote.lines[0]!.id);
    expect(order.totals.net_total).toBe(quote.totals.net_total);

    const quoteAfter = await call(`/api/v1/quotes/${quote.id}`, { headers: asUser });
    const { data: quoteData } = (await quoteAfter.json()) as { data: QuoteDetailDto };
    expect(quoteData.status).toBe('converted');
    expect(quoteData.converted_at).toBeTruthy();

    const conversionEvents = outboxRepository.events.filter((event) => event.name === 'quote.converted');
    expect(conversionEvents).toHaveLength(1);
    expect(conversionEvents[0]).toMatchObject({
      name: 'quote.converted',
      tenantId: TENANT,
      aggregateType: 'quote',
      aggregateId: quote.id,
      payload: {
        quote_id: quote.id,
        customer_id: quote.customer_id,
        number: quote.number,
        order_id: order.id,
        order_number: order.number,
        source_quote_status: 'sent',
      },
    });

    quotesRepository.setActorCapabilityForTest(TENANT, USER, 'can_manage_pricing', true);
    const auditResponse = await call(`/api/v1/quotes/${quote.id}/header-audit-entries`, { headers: asUser });
    const { data: entries } = (await auditResponse.json()) as { data: QuoteAuditEntryDto[] };
    const convertedEntry = entries.find((entry) => entry.action === 'converted');
    expect(convertedEntry).toBeTruthy();
    expect(convertedEntry!.field).toBeNull();
    expect(convertedEntry!.quote_snapshot).toBeNull();
    expect(convertedEntry!.previous_value).toBe('sent');
    expect(convertedEntry!.new_value).toBe('converted');
    expect(convertedEntry!.actor_id).toBe(USER);
  });

  it('convertQuote — rejeu de la MEME cle d idempotence rend la commande deja creee, jamais une seconde', async () => {
    const quote = await createSentQuote();
    const key = `conv-${uuid()}`;

    const first = await call(`/api/v1/quotes/${quote.id}/conversions`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': key },
    });
    const { data: firstOrder } = (await first.json()) as { data: CommercialOrderDetailDto };

    const second = await call(`/api/v1/quotes/${quote.id}/conversions`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': key },
    });
    expect(second.status).toBe(201);
    const { data: secondOrder } = (await second.json()) as { data: CommercialOrderDetailDto };
    expect(secondOrder.id).toBe(firstOrder.id);

    const list = await ordersRepository.list(TENANT, {
      customerId: null,
      quoteId: quote.id,
      status: null,
      currentProductionStepId: null,
      sort: '-created_at',
      size: 10,
      cursor: null,
    });
    expect(list.rows).toHaveLength(1);
  });

  it('convertQuote — devis ACCEPTED (le client a repondu) : source_quote_status=accepted', async () => {
    const quote = await createSentQuote();
    // Simule l acceptation cote client (E10.10b-2) directement en base de
    // test : ce fichier ne monte pas la facade storefront.
    quotesRepository.forceStatusForTest(quote.id, 'accepted');

    const response = await convert(quote.id);
    await expectContract(response, { status: 201, dataSchema: 'CommercialOrderDetail' });
    const { data: order } = (await response.json()) as { data: CommercialOrderDetailDto };
    expect(order.source_quote_status).toBe('accepted');
  });

  it('convertQuote — devis DRAFT : refuse en 409 quote.conversion_forbidden_status avec current_state.status=draft', async () => {
    const draft = await createDraftQuote();

    const response = await convert(draft.id);
    expect(response.status).toBe(409);
    const problemBody = (await response.json()) as { code: string; current_state?: { status: string } };
    expect(problemBody.code).toBe('quote.conversion_forbidden_status');
    expect(problemBody.current_state?.status).toBe('draft');
  });

  it('convertQuote — devis REJECTED : refuse en 409', async () => {
    const quote = await createSentQuote();
    quotesRepository.forceStatusForTest(quote.id, 'rejected');

    const response = await convert(quote.id);
    expect(response.status).toBe(409);
    const problemBody = (await response.json()) as { current_state?: { status: string } };
    expect(problemBody.current_state?.status).toBe('rejected');
  });

  it('convertQuote — re-conversion d un devis DEJA converted : refuse en 409, une seule commande existe', async () => {
    const quote = await createSentQuote();
    const first = await convert(quote.id);
    expect(first.status).toBe(201);

    const second = await convert(quote.id);
    expect(second.status).toBe(409);
    const problemBody = (await second.json()) as { current_state?: { status: string } };
    expect(problemBody.current_state?.status).toBe('converted');

    const list = await ordersRepository.list(TENANT, {
      customerId: null,
      quoteId: quote.id,
      status: null,
      currentProductionStepId: null,
      sort: '-created_at',
      size: 10,
      cursor: null,
    });
    expect(list.rows).toHaveLength(1);
  });

  it('convertQuote — devis introuvable dans ce tenant : 404', async () => {
    const response = await convert(uuid());
    expect(response.status).toBe(404);
  });

  it('convertQuote — reserve un jeton UTILISATEUR : une cle de service est refusee en 403', async () => {
    const quote = await createSentQuote();
    const response = await call(`/api/v1/quotes/${quote.id}/conversions`, {
      method: 'POST',
      headers: { ...asStudio, 'Idempotency-Key': `conv-${uuid()}` },
    });
    expect(response.status).toBe(403);
  });

  it('listCommercialOrders — scope orders:read, filtre quote_id (0 ou 1 resultat), filtre customer_id, pagination', async () => {
    const noScope = await call('/api/v1/commercial-orders', { headers: asStudioNoScope });
    expect(noScope.status).toBe(403);

    const quoteA = await createSentQuote();
    const convertA = await convert(quoteA.id);
    const { data: orderA } = (await convertA.json()) as { data: CommercialOrderDetailDto };

    const quoteB = await createSentQuote();
    await convert(quoteB.id);

    const list = await call('/api/v1/commercial-orders', { headers: asStudio });
    await expectContract(list, { status: 200 });
    const { data: rows } = (await list.json()) as { data: CommercialOrderDto[] };
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const filteredByQuote = await call(`/api/v1/commercial-orders?quote_id=${quoteA.id}`, { headers: asStudio });
    const { data: filteredRows } = (await filteredByQuote.json()) as { data: CommercialOrderDto[] };
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]!.id).toBe(orderA.id);

    const filteredByUnknownQuote = await call(`/api/v1/commercial-orders?quote_id=${uuid()}`, {
      headers: asStudio,
    });
    const { data: emptyRows } = (await filteredByUnknownQuote.json()) as { data: CommercialOrderDto[] };
    expect(emptyRows).toHaveLength(0);

    const filteredByCustomer = await call(`/api/v1/commercial-orders?customer_id=${orderA.customer_id}`, {
      headers: asStudio,
    });
    const { data: byCustomer } = (await filteredByCustomer.json()) as { data: CommercialOrderDto[] };
    expect(byCustomer.length).toBeGreaterThanOrEqual(1);
    expect(byCustomer.every((row) => row.customer_id === orderA.customer_id)).toBe(true);

    const paged = await call('/api/v1/commercial-orders?page[size]=1', { headers: asStudio });
    const pagedBody = (await paged.json()) as { data: CommercialOrderDto[]; meta: { next_cursor: string | null } };
    expect(pagedBody.data).toHaveLength(1);
    expect(pagedBody.meta.next_cursor).toBeTruthy();
  });

  it('getCommercialOrder — fiche complete avec lignes ; 404 si introuvable', async () => {
    const quote = await createSentQuote();
    const convertResponse = await convert(quote.id);
    const { data: order } = (await convertResponse.json()) as { data: CommercialOrderDetailDto };

    const response = await call(`/api/v1/commercial-orders/${order.id}`, { headers: asStudio });
    await expectContract(response, { status: 200, dataSchema: 'CommercialOrderDetail' });
    expect(response.headers.get('etag')).toBeTruthy();
    const { data: detail } = (await response.json()) as { data: CommercialOrderDetailDto };
    expect(detail.lines).toHaveLength(1);

    const missing = await call(`/api/v1/commercial-orders/${uuid()}`, { headers: asStudio });
    expect(missing.status).toBe(404);
  });
});
