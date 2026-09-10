/**
 * Module Journal des changements d etape de production (E10.14, « modale
 * unifiee de changement de statut et historique horodate ») contre le
 * contrat.
 *
 * Exerce reellement `createCommercialOrdersRoutes()` via
 * `createGescomApiHandler`, memes faux que `commercial-orders.contract.test.ts`
 * (`InMemoryCommercialOrdersRepository`, jamais reecrit deux fois) — ce
 * fichier ajoute seulement l enregistrement des etapes de production
 * necessaires a `changeProductionStep` (`registerProductionStepForTest()`,
 * ce faux ne partage pas `InMemoryProductionStepsRepository`).
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
import type { QuoteDetailDto } from '@/modules/commercial-quotes/api/contracts';
import type { CommercialOrderDetailDto, OrderStepChangeDto } from '@/modules/commercial-orders/api/contracts';
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

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9013');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e70');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const studioWritePrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze(['orders:write', 'orders:read']),
});
const studioReadOnlyPrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze(['orders:read']),
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      if (credential.token === 'jeton-valide') return userPrincipal;
      return null;
    }
    if (credential.key === 'cle-studio-write') return studioWritePrincipal;
    if (credential.key === 'cle-studio-read') return studioReadOnlyPrincipal;
    return null;
  },
};

let sequence = 0;
function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9100-${String(sequence).padStart(12, '0')}`;
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

// Deux etapes du tenant, ENREGISTREES sur le faux repository de commandes
// (registerProductionStepForTest, ce faux ne partage pas
// InMemoryProductionStepsRepository) — meme jeu que E10.13 mais reduit au
// strict necessaire.
const STEP_RECU = brand<string>('00000000-0000-4000-9200-000000000101');
const STEP_PAO = brand<string>('00000000-0000-4000-9200-000000000102');
const STEP_LIVRE = brand<string>('00000000-0000-4000-9200-000000000103');
const STEP_INACTIVE = brand<string>('00000000-0000-4000-9200-000000000104');
const STEP_OTHER_TENANT = brand<string>('00000000-0000-4000-9200-000000000199');

beforeEach(() => {
  projectsRepository = new InMemoryProjectsRepository();
  customersRepository = new InMemoryCustomersRepository();
  quotesRepository = new InMemoryCommercialQuotesRepository(projectsRepository);
  ordersRepository = new InMemoryCommercialOrdersRepository(quotesRepository);
  priceRulesRepository = new InMemoryPriceRulesRepository();
  outboxRepository = new InMemoryOutboxRepository();
  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-09T10:00:00.000Z'),
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
    now: () => new Date('2026-09-09T10:00:00.000Z'),
  });
  ordersService = new CommercialOrdersService({
    repository: ordersRepository,
    outbox,
    quotes: quotesService,
    documents: createNullOrderDocumentsService(),
  });
  productionStepsRepository = new InMemoryProductionStepsRepository();
  productionStepsService = new ProductionStepsService({ repository: productionStepsRepository });

  ordersRepository.registerProductionStepForTest(STEP_RECU, TENANT, true);
  ordersRepository.registerProductionStepForTest(STEP_PAO, TENANT, true);
  ordersRepository.registerProductionStepForTest(STEP_LIVRE, TENANT, true);
  ordersRepository.registerProductionStepForTest(STEP_INACTIVE, TENANT, false);
  ordersRepository.registerProductionStepForTest(STEP_OTHER_TENANT, 'tenant-etranger', true);

  handler = createGescomApiHandler({
    routes: [
      ...createProjectsRoutes(projectsService),
      ...createCommercialQuotesRoutes(quotesService),
      ...createCommercialOrdersRoutes(ordersService, quotesService, productionStepsService),
    ],
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-14',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };
const asStudioWrite = { 'X-Magrit-Service-Key': 'cle-studio-write' };
const asStudioReadOnly = { 'X-Magrit-Service-Key': 'cle-studio-read' };

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
    company_name: 'Imprimerie E10.14',
    siret: '73282932000074',
    ...overrides,
  } as any);
}

async function createProject(customerId: string): Promise<ProjectDto> {
  const response = await call('/api/v1/projects', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `project-${uuid()}` },
    body: JSON.stringify({ customer_id: customerId, name: 'Projet E10.14' }),
  });
  const { data } = (await response.json()) as { data: ProjectDto };
  return data;
}

async function createSentQuote(): Promise<QuoteDetailDto> {
  const customer = await createCustomer();
  const project = await createProject(customer.id);
  const draft = await quotesRepository.seedDraftQuoteForTest(TENANT, USER, {
    customerId: customer.id,
    projectId: project.id,
  });

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

/** Commande validee, posee EXPLICITEMENT sur STEP_RECU (le faux ne pose jamais d etape a la conversion). */
async function createOrderOnStepRecu(): Promise<CommercialOrderDetailDto> {
  const quote = await createSentQuote();
  const response = await call(`/api/v1/quotes/${quote.id}/conversions`, {
    method: 'POST',
    headers: { ...asUser, 'Idempotency-Key': `conv-${uuid()}` },
  });
  expect(response.status).toBe(201);
  const { data: order } = (await response.json()) as { data: CommercialOrderDetailDto };
  ordersRepository.setCurrentProductionStepIdForTest(order.id, STEP_RECU);
  return { ...order, current_production_step_id: STEP_RECU };
}

describe('Journal des changements d etape de production (E10.14)', () => {
  it('changeOrderProductionStep — cas nominal (utilisateur) : 201, from/to corrects, order.step_changed publie', async () => {
    const order = await createOrderOnStepRecu();

    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO, note: 'fichier repasse en PAO, fond perdu manquant' }),
    });
    await expectContract(response, { status: 201, dataSchema: 'OrderStepChange' });
    expect(response.headers.get('etag')).toBeNull();

    const { data: entry } = (await response.json()) as { data: OrderStepChangeDto };
    expect(entry.order_id).toBe(order.id);
    expect(entry.from_step_id).toBe(STEP_RECU);
    expect(entry.to_step_id).toBe(STEP_PAO);
    expect(entry.note).toBe('fichier repasse en PAO, fond perdu manquant');
    expect(entry.actor_id).toBe(USER);

    const stepChangedEvents = outboxRepository.events.filter((event) => event.name === 'order.step_changed');
    expect(stepChangedEvents).toHaveLength(1);
    expect(stepChangedEvents[0]).toMatchObject({
      name: 'order.step_changed',
      tenantId: TENANT,
      aggregateType: 'order',
      aggregateId: order.id,
      payload: {
        step_change_id: entry.id,
        order_id: order.id,
        order_number: order.number,
        customer_id: order.customer_id,
        from_step_id: STEP_RECU,
        to_step_id: STEP_PAO,
      },
    });
  });

  it('changeOrderProductionStep — Idempotency-Key exigee (400 sans en-tete)', async () => {
    const order = await createOrderOnStepRecu();
    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    expect(response.status).toBe(400);
  });

  it('changeOrderProductionStep — reposer la MEME etape : 409 order.step_unchanged, current_state porte l etape courante', async () => {
    const order = await createOrderOnStepRecu();
    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_RECU }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; current_state?: { current_production_step_id: string } };
    expect(body.code).toBe('order.step_unchanged');
    expect(body.current_state?.current_production_step_id).toBe(STEP_RECU);
  });

  it('changeOrderProductionStep — rejeu de la MEME cle d idempotence : 201 identique, AUCUNE seconde entree, jamais le 409 step_unchanged', async () => {
    const order = await createOrderOnStepRecu();
    const key = `step-${uuid()}`;

    const first = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': key },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    expect(first.status).toBe(201);
    const { data: firstEntry } = (await first.json()) as { data: OrderStepChangeDto };

    const second = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': key },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    expect(second.status).toBe(201);
    expect(second.headers.get('idempotency-replayed')).toBe('true');
    const { data: secondEntry } = (await second.json()) as { data: OrderStepChangeDto };
    expect(secondEntry.id).toBe(firstEntry.id);

    const journal = await ordersRepository.listStepChanges(TENANT, order.id, { size: 10, cursor: null });
    expect(journal.rows).toHaveLength(1);
  });

  it('changeOrderProductionStep — etape hors tenant : 422 production_step.not_found', async () => {
    const order = await createOrderOnStepRecu();
    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_OTHER_TENANT }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('production_step.not_found');
  });

  it('changeOrderProductionStep — etape DESACTIVEE comme cible : 422 production_step.inactive (code neuf, distinct de not_found)', async () => {
    const order = await createOrderOnStepRecu();
    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_INACTIVE }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('production_step.inactive');
  });

  it('changeOrderProductionStep — saut direct (CA4) : de "Fichier reçu" a "Livré", accepte, aucune etape intermediaire exigee', async () => {
    const order = await createOrderOnStepRecu();
    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_LIVRE }),
    });
    await expectContract(response, { status: 201, dataSchema: 'OrderStepChange' });
    const { data: entry } = (await response.json()) as { data: OrderStepChangeDto };
    expect(entry.from_step_id).toBe(STEP_RECU);
    expect(entry.to_step_id).toBe(STEP_LIVRE);
  });

  it('changeOrderProductionStep — recul (CA4) : d une etape a une etape ANTERIEURE, accepte', async () => {
    const order = await createOrderOnStepRecu();
    await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_LIVRE }),
    });
    const back = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    await expectContract(back, { status: 201, dataSchema: 'OrderStepChange' });
    const { data: entry } = (await back.json()) as { data: OrderStepChangeDto };
    expect(entry.from_step_id).toBe(STEP_LIVRE);
    expect(entry.to_step_id).toBe(STEP_PAO);
  });

  it('changeOrderProductionStep — cle de service Studio avec orders:write : 201, actor_id NULL, actor_label module:studio', async () => {
    const order = await createOrderOnStepRecu();
    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...asStudioWrite, 'Content-Type': 'application/json', 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    await expectContract(response, { status: 201, dataSchema: 'OrderStepChange' });
    const { data: entry } = (await response.json()) as { data: OrderStepChangeDto };
    expect(entry.actor_id).toBeNull();
    expect(entry.actor_label).toBe('module:studio');
  });

  it('changeOrderProductionStep — cle de service SANS orders:write (orders:read seul) : 403', async () => {
    const order = await createOrderOnStepRecu();
    const response = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...asStudioReadOnly, 'Content-Type': 'application/json', 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    expect(response.status).toBe(403);
  });

  it('changeOrderProductionStep — commande introuvable : 404', async () => {
    const response = await call(`/api/v1/commercial-orders/${uuid()}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    expect(response.status).toBe(404);
  });

  it('changeOrderProductionStep — note vide refusee (api.validation_failed) ; note absente acceptee (note NULL)', async () => {
    const order = await createOrderOnStepRecu();

    const emptyNote = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO, note: '' }),
    });
    expect(emptyNote.status).toBe(422);

    const noNote = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    expect(noNote.status).toBe(201);
    const { data: entry } = (await noNote.json()) as { data: OrderStepChangeDto };
    expect(entry.note).toBeNull();
  });

  it('listOrderStepChanges — antichronologique, pagination par curseur, scope orders:read (utilisateur ET cle de service)', async () => {
    const order = await createOrderOnStepRecu();

    await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_PAO }),
    });
    await call(`/api/v1/commercial-orders/${order.id}/step-changes`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `step-${uuid()}` },
      body: JSON.stringify({ step_id: STEP_LIVRE }),
    });

    const list = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, { headers: asStudioReadOnly });
    await expectContract(list, { status: 200 });
    const { data: rows } = (await list.json()) as { data: OrderStepChangeDto[] };
    expect(rows).toHaveLength(2);
    // PLUS RECENT en premier : la derniere transition (vers Livré) devant.
    expect(rows[0]!.to_step_id).toBe(STEP_LIVRE);
    expect(rows[1]!.to_step_id).toBe(STEP_PAO);

    const paged = await call(`/api/v1/commercial-orders/${order.id}/step-changes?page[size]=1`, {
      headers: asUser,
    });
    const pagedBody = (await paged.json()) as { data: OrderStepChangeDto[]; meta: { next_cursor: string | null } };
    expect(pagedBody.data).toHaveLength(1);
    expect(pagedBody.meta.next_cursor).toBeTruthy();

    const secondPage = await call(
      `/api/v1/commercial-orders/${order.id}/step-changes?page[size]=1&page[cursor]=${encodeURIComponent(pagedBody.meta.next_cursor!)}`,
      { headers: asUser },
    );
    const secondPageBody = (await secondPage.json()) as { data: OrderStepChangeDto[] };
    expect(secondPageBody.data).toHaveLength(1);
    expect(secondPageBody.data[0]!.id).not.toBe(pagedBody.data[0]!.id);
  });

  it('listOrderStepChanges — commande jamais deplacee : journal VIDE ; commande introuvable : 404', async () => {
    const order = await createOrderOnStepRecu();
    const list = await call(`/api/v1/commercial-orders/${order.id}/step-changes`, { headers: asUser });
    await expectContract(list, { status: 200 });
    const { data: rows } = (await list.json()) as { data: OrderStepChangeDto[] };
    expect(rows).toHaveLength(0);

    const missing = await call(`/api/v1/commercial-orders/${uuid()}/step-changes`, { headers: asUser });
    expect(missing.status).toBe(404);
  });
});
