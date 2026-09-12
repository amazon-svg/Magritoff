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
import { createNullQuoteDocumentsService } from './_fakes/quote-documents-service.fake.ts';
import { createNullOrderDocumentsService } from './_fakes/order-documents-service.fake.ts';
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
    documents: createNullQuoteDocumentsService(),
    now: () => new Date('2026-09-08T10:00:00.000Z'),
  });
  ordersService = new CommercialOrdersService({
    repository: ordersRepository,
    outbox,
    quotes: quotesService,
    documents: createNullOrderDocumentsService(),
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
    // E10.16 — devis converti depuis `sent` (jamais decide au portail) :
    // AUCUN compte boutique n a rien decide, donc RIEN a recopier. C est le
    // cas le plus frequent (§0 verification n°2, docs/api/CONVENTIONS.md
    // §8.17), a ne surtout pas confondre avec une anomalie.
    expect(order.customer_contact_id).toBeNull();
    // Aucun ecrivain dans ce lot (reserve (h) du contrat) : NULL sur 100%
    // des commandes tant qu une story n aura pas tranche qui la saisit.
    expect(order.expected_delivery_date).toBeNull();
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
      createdAtFrom: null,
      createdAtTo: null,
      sort: '-created_at',
      size: 10,
      cursor: null,
    });
    expect(list.rows).toHaveLength(1);
  });

  it('convertQuote — devis ACCEPTED (le client a repondu) : source_quote_status=accepted, interlocuteur RESOLU (E10.16)', async () => {
    const quote = await createSentQuote();
    // Simule l acceptation cote client (E10.10b-2) directement en base de
    // test : ce fichier ne monte pas la facade storefront.
    quotesRepository.forceStatusForTest(quote.id, 'accepted');

    // E10.16 — DIFFERENCIE du scenario `sent` ci-dessus (consigne opposable
    // du contrat, docs/api/CONVENTIONS.md §8.17 §7) : ici la chaine de
    // derivation `commercial_quotes.decided_by_account_id` ->
    // `shop_customer_accounts.customer_contact_id` -> `customer_contacts`
    // EST reellement exercee, pas seulement rendue null par defaut.
    const accountId = uuid();
    const contactId = uuid();
    quotesRepository.setDecidedByAccountIdForTest(quote.id, accountId);
    ordersRepository.registerShopAccountContactForTest(accountId, contactId);

    const response = await convert(quote.id);
    await expectContract(response, { status: 201, dataSchema: 'CommercialOrderDetail' });
    const { data: order } = (await response.json()) as { data: CommercialOrderDetailDto };
    expect(order.source_quote_status).toBe('accepted');
    expect(order.customer_contact_id).toBe(contactId);
    expect(order.expected_delivery_date).toBeNull();
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
      createdAtFrom: null,
      createdAtTo: null,
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

  it('listCommercialOrders — created_from/created_to : bornes INCLUSIVES aux deux bords d un mois, fuseau Europe/Paris (E10.18a)', async () => {
    // Une commande passee a 2026-08-31T22:30:00Z (1er septembre 00h30 a
    // Paris, CEST) : l exemple ecrit noir sur blanc au contrat
    // (docs/api/CONVENTIONS.md §8.24 point 5 regle 8). Elle DOIT entrer dans
    // une demande de septembre et sortir d une demande d aout — filtree en
    // UTC naif, elle tomberait a tort dans le mois comptable precedent.
    const quoteLowEdge = await createSentQuote();
    const convertLowEdge = await convert(quoteLowEdge.id);
    const { data: orderLowEdge } = (await convertLowEdge.json()) as { data: CommercialOrderDetailDto };
    ordersRepository.setCreatedAtForTest(orderLowEdge.id, '2026-08-31T22:30:00.000Z');

    // Symetrique a l autre bord : 2026-09-30T22:30:00Z vaut 1er octobre
    // 00h30 a Paris (CEST encore actif fin septembre) — DOIT sortir d une
    // demande de septembre et entrer dans une demande d octobre.
    const quoteHighEdge = await createSentQuote();
    const convertHighEdge = await convert(quoteHighEdge.id);
    const { data: orderHighEdge } = (await convertHighEdge.json()) as { data: CommercialOrderDetailDto };
    ordersRepository.setCreatedAtForTest(orderHighEdge.id, '2026-09-30T22:30:00.000Z');

    const idsOf = (rows: readonly CommercialOrderDto[]): string[] => rows.map((r) => r.id);

    const septemberRange = await call('/api/v1/commercial-orders?created_from=2026-09-01&created_to=2026-09-30', {
      headers: asStudio,
    });
    await expectContract(septemberRange, { status: 200 });
    const { data: septemberRows } = (await septemberRange.json()) as { data: CommercialOrderDto[] };
    // BORD BAS : entre dans septembre.
    expect(idsOf(septemberRows)).toContain(orderLowEdge.id);
    // BORD HAUT (symetrique) : sort de septembre.
    expect(idsOf(septemberRows)).not.toContain(orderHighEdge.id);

    const augustRange = await call('/api/v1/commercial-orders?created_from=2026-08-01&created_to=2026-08-31', {
      headers: asStudio,
    });
    const { data: augustRows } = (await augustRange.json()) as { data: CommercialOrderDto[] };
    // BORD BAS : sort d aout, malgre un instant UTC encore le 31 aout.
    expect(idsOf(augustRows)).not.toContain(orderLowEdge.id);

    const octoberRange = await call('/api/v1/commercial-orders?created_from=2026-10-01&created_to=2026-10-31', {
      headers: asStudio,
    });
    const { data: octoberRows } = (await octoberRange.json()) as { data: CommercialOrderDto[] };
    // BORD HAUT : entre dans octobre, malgre un instant UTC encore le 30 septembre.
    expect(idsOf(octoberRows)).toContain(orderHighEdge.id);

    // Combine avec sort=production_step (E10.13) : le filtre de periode doit
    // s appliquer sur CE chemin aussi (fonction SQL dediee,
    // list_commercial_orders_by_production_step), pas seulement sur le tri
    // par defaut (§8.24 point 8, "aucun lot n a de valeur s il ignore un
    // filtre deja publie sur le meme endpoint").
    const septemberByStep = await call(
      '/api/v1/commercial-orders?created_from=2026-09-01&created_to=2026-09-30&sort=production_step',
      { headers: asStudio },
    );
    await expectContract(septemberByStep, { status: 200 });
    const { data: septemberByStepRows } = (await septemberByStep.json()) as { data: CommercialOrderDto[] };
    expect(idsOf(septemberByStepRows)).toContain(orderLowEdge.id);
    expect(idsOf(septemberByStepRows)).not.toContain(orderHighEdge.id);

    // Absente des deux cotes -> aucune borne (comportement inchange).
    const unbounded = await call('/api/v1/commercial-orders', { headers: asStudio });
    const { data: unboundedRows } = (await unbounded.json()) as { data: CommercialOrderDto[] };
    expect(idsOf(unboundedRows)).toContain(orderLowEdge.id);
    expect(idsOf(unboundedRows)).toContain(orderHighEdge.id);
  });

  it('listCommercialOrders — created_from mal forme : 400 ; created_from posterieure a created_to : 422 api.validation_failed', async () => {
    const malformed = await call('/api/v1/commercial-orders?created_from=2026-9-1', { headers: asStudio });
    expect(malformed.status).toBe(400);
    const malformedBody = (await malformed.json()) as { code: string };
    expect(malformedBody.code).toBe('api.validation_failed');

    const malformedTo = await call('/api/v1/commercial-orders?created_to=01-09-2026', { headers: asStudio });
    expect(malformedTo.status).toBe(400);

    const inverted = await call(
      '/api/v1/commercial-orders?created_from=2026-09-30&created_to=2026-09-01',
      { headers: asStudio },
    );
    expect(inverted.status).toBe(422);
    const invertedBody = (await inverted.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(invertedBody.code).toBe('api.validation_failed');
    expect(invertedBody.errors?.[0]?.field).toBe('created_from');

    // Bornes EGALES (un seul jour) : acceptees, jamais un 422 (INCLUS des deux cotes).
    const sameDay = await call(
      '/api/v1/commercial-orders?created_from=2026-09-01&created_to=2026-09-01',
      { headers: asStudio },
    );
    expect(sameDay.status).toBe(200);
  });

  // qa-review E10.18a round 1, B1 : une date de FORME valide (`YYYY-MM-DD`)
  // mais de CALENDRIER impossible (31 juin n existe pas) doit etre rejetee,
  // jamais reportee en silence sur le mois suivant par `Date.UTC`. **422**,
  // pas 400 : le `pattern` du contrat borne la forme, pas le calendrier
  // (amendement architecte, `openapi/magrit-core.v1.yaml` ~ligne 4284) — meme
  // code/statut que la borne inversee (meme famille de defaut : une date qui
  // pourrait tromper silencieusement une cloture comptable).
  it('listCommercialOrders — created_to=2026-06-31 (jour inexistant, juin n a que 30 jours) : 422 api.validation_failed, jamais 200 avec une borne decalee', async () => {
    const response = await call('/api/v1/commercial-orders?created_to=2026-06-31', { headers: asStudio });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(body.code).toBe('api.validation_failed');
    expect(body.errors?.[0]?.field).toBe('created_to');
  });

  it('listCommercialOrders — created_from=2026-02-30 (jour inexistant) : 422 api.validation_failed', async () => {
    const response = await call('/api/v1/commercial-orders?created_from=2026-02-30', { headers: asStudio });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string; errors?: Array<{ field: string }> };
    expect(body.code).toBe('api.validation_failed');
    expect(body.errors?.[0]?.field).toBe('created_from');
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
    // E10.16 — devis converti depuis `sent` : mêmes valeurs NULL que celles
    // rendues par `convertQuote()`, la lecture ne recalcule rien.
    expect(detail.customer_contact_id).toBeNull();
    expect(detail.expected_delivery_date).toBeNull();

    const missing = await call(`/api/v1/commercial-orders/${uuid()}`, { headers: asStudio });
    expect(missing.status).toBe(404);
  });
});
