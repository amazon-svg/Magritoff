/**
 * Module Document PDF de commande (bon de commande, story E10.19b) contre le
 * contrat.
 *
 * Exerce reellement `createCommercialOrdersRoutes()` via
 * `createGescomApiHandler`, memes faux que `commercial-orders.contract.test.ts`
 * (`InMemoryCommercialOrdersRepository`, jamais reecrit deux fois) — ce
 * fichier ajoute un `OrderDocumentsService` REEL (pas un faux), branche sur
 * un faux referentiel de gabarits (controlable : gabarit `order` eligible ou
 * non) et un faux `OrderDocumentsRepository` en memoire — meme parti que
 * `quote-documents.contract.test.ts`. Le rendu pdf-lib est REEL (fond d une
 * page construit par le test), verifie ici cote FORME/HTTP ; le catalogue de
 * champs `order.*` a son propre test unitaire dedie
 * (`tests/modules/quote-documents/document-field-value-resolver.test.ts`).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
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
import { OrderDocumentsService } from '@/modules/order-documents/application/order-documents-service';
import type { OrderDocumentDto } from '@/modules/order-documents/api/contracts';
import type { OrderDocumentsRepository } from '@/modules/order-documents/application/order-documents-repository';
import type { QuoteDetailDto } from '@/modules/commercial-quotes/api/contracts';
import type { CommercialOrderDetailDto } from '@/modules/commercial-orders/api/contracts';
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
import { InMemoryCommercialOrdersRepository } from './_fakes/commercial-orders-repository.fake.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9014');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e71');

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

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') return credential.token === 'jeton-valide' ? userPrincipal : null;
    if (credential.key === 'cle-studio') return studioPrincipal;
    return null;
  },
};

let sequence = 0;
function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9400-${String(sequence).padStart(12, '0')}`;
}

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

/** Faux referentiel des documents PDF de commande — MEME parti que `InMemoryQuoteDocumentsRepository` du test soeur. */
class InMemoryOrderDocumentsRepository implements OrderDocumentsRepository {
  private readonly byOrder = new Map<string, OrderDocumentDto>();

  async findByOrderId(_tenantId: TenantId, orderId: string): Promise<OrderDocumentDto | null> {
    return this.byOrder.get(orderId) ?? null;
  }

  async store(
    _tenantId: TenantId,
    actor: UserId,
    params: Readonly<{ orderId: string; templateId: string; bytes: Uint8Array; pageCount: number; generatedAt: string }>,
  ): Promise<OrderDocumentDto> {
    if (this.byOrder.has(params.orderId)) {
      // MEME discipline que la contrainte unique reelle (order_id) + RPC
      // api_register_order_document : une course sur le MEME order_id est
      // refusee, jamais un remplacement silencieux.
      const { OrderDocumentAlreadyGeneratedError } = await import(
        '@/modules/order-documents/application/order-documents-repository'
      );
      throw new OrderDocumentAlreadyGeneratedError();
    }
    const document: OrderDocumentDto = {
      order_id: params.orderId,
      template_id: params.templateId,
      generated_at: params.generatedAt,
      generated_by: actor,
      generated_by_label: 'commercial@imprimerie-e10-19.test',
      byte_size: params.bytes.length,
      sha256: 'a'.repeat(64),
      content_type: 'application/pdf',
      page_count: params.pageCount,
      download_url: 'https://storage.test/signed-order-document',
      download_url_expires_at: '2026-09-10T10:05:00.000Z',
    };
    this.byOrder.set(params.orderId, document);
    return document;
  }
}

async function buildOrderTemplateBackground(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([595.28, 841.89]);
  return document.save();
}

let projectsRepository: InMemoryProjectsRepository;
let customersRepository: InMemoryCustomersRepository;
let quotesRepository: InMemoryCommercialQuotesRepository;
let ordersRepository: InMemoryCommercialOrdersRepository;
let priceRulesRepository: InMemoryPriceRulesRepository;
let outboxRepository: InMemoryOutboxRepository;
let orderDocumentsRepository: InMemoryOrderDocumentsRepository;
let quotesService: CommercialQuotesService;
let ordersService: CommercialOrdersService;
/** `true` -> `findEligibleTemplateForGeneration('order')` rend un gabarit valide ; `false` -> `null` (409 `order.document_template_missing`). */
let templateEligible: boolean;
let handler: (request: Request) => Promise<Response>;

beforeEach(async () => {
  projectsRepository = new InMemoryProjectsRepository();
  customersRepository = new InMemoryCustomersRepository();
  quotesRepository = new InMemoryCommercialQuotesRepository(projectsRepository);
  ordersRepository = new InMemoryCommercialOrdersRepository(quotesRepository);
  priceRulesRepository = new InMemoryPriceRulesRepository();
  outboxRepository = new InMemoryOutboxRepository();
  orderDocumentsRepository = new InMemoryOrderDocumentsRepository();
  templateEligible = true;

  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-10T10:00:00.000Z'),
    newEventId: () => uuid(),
  });
  const projectsService = new ProjectsService({ repository: projectsRepository, customers: customersRepository, outbox });
  const priceRulesService = new PriceRulesService({ repository: priceRulesRepository, customers: customersRepository, outbox });
  quotesService = new CommercialQuotesService({
    repository: quotesRepository,
    outbox,
    projects: projectsRepository,
    priceRules: priceRulesService,
    pricingEngine: new SingleCostPricingEngine(),
    documents: createNullQuoteDocumentsService(),
    now: () => new Date('2026-09-10T10:00:00.000Z'),
  });

  const backgroundBytes = await buildOrderTemplateBackground();
  const orderDocumentsService = new OrderDocumentsService({
    templates: {
      findEligibleTemplateForGeneration: async () =>
        templateEligible
          ? {
              templateId: 'e0000000-0000-4000-9500-000000000001',
              backgroundBytes,
              pages: [{ index: 0, width_pt: 595.28, height_pt: 841.89 }],
              placements: [
                {
                  field: 'order.number' as const,
                  page_index: 0,
                  x: 50,
                  y: 700,
                  width: null,
                  max_lines: 1,
                  align: 'left' as const,
                  font: 'helvetica' as const,
                  font_size: 12,
                  color: '#111111',
                },
              ],
              linesBlock: null,
            }
          : null,
    },
    customers: { findCustomerForDocument: async () => null },
    repository: orderDocumentsRepository,
  });

  ordersService = new CommercialOrdersService({
    repository: ordersRepository,
    outbox,
    quotes: quotesService,
    documents: orderDocumentsService,
  });

  handler = createGescomApiHandler({
    routes: [
      ...createProjectsRoutes(projectsService),
      ...createCommercialQuotesRoutes(quotesService),
      ...createCommercialOrdersRoutes(ordersService, quotesService, { exists: async () => true } as any),
    ],
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-19b',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const jsonHeaders = { ...asUser, 'Content-Type': 'application/json' };
const asStudio = { 'X-Magrit-Service-Key': 'cle-studio' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

async function createCustomer() {
  return customersRepository.create(TENANT, USER, {
    type: 'company',
    company_name: 'Imprimerie E10.19',
    siret: '73282932000074',
  } as any);
}

async function createProject(customerId: string): Promise<ProjectDto> {
  const response = await call('/api/v1/projects', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `project-${uuid()}` },
    body: JSON.stringify({ customer_id: customerId, name: 'Projet E10.19' }),
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

  await call(`/api/v1/quotes/${draft.id}/lines`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `line-${uuid()}` },
    body: JSON.stringify({ label: 'Flyers A5', quantity: 500, production_price: '100.00' }),
  });

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

async function createOrder(): Promise<CommercialOrderDetailDto> {
  const quote = await createSentQuote();
  const response = await call(`/api/v1/quotes/${quote.id}/conversions`, {
    method: 'POST',
    headers: { ...asUser, 'Idempotency-Key': `conv-${uuid()}` },
  });
  expect(response.status).toBe(201);
  const { data: order } = (await response.json()) as { data: CommercialOrderDetailDto };
  return order;
}

describe('GET /commercial-orders/{orderId}/documents (E10.19b)', () => {
  it('404 order.not_found : commande introuvable', async () => {
    const response = await call(`/api/v1/commercial-orders/${uuid()}/documents`, { headers: asUser });
    await expectContract(response, { status: 404 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order.not_found');
  });

  it('404 order.document_not_generated : CAS NOMINAL, la commande existe mais personne n a produit son bon de commande', async () => {
    const order = await createOrder();
    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, { headers: asUser });
    await expectContract(response, { status: 404 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order.document_not_generated');
  });

  it('200 : rend le document deja produit (schema OrderDocument, generated_by_label present)', async () => {
    const order = await createOrder();
    const generate = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': `doc-${uuid()}` },
    });
    expect(generate.status).toBe(201);

    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, { headers: asUser });
    await expectContract(response, { status: 200, dataSchema: 'OrderDocument' });
    const body = (await response.json()) as { data: OrderDocumentDto };
    expect(body.data.order_id).toBe(order.id);
    expect(body.data.generated_by_label).toBe('commercial@imprimerie-e10-19.test');
  });

  it('lecture ouverte a une cle de service orders:read', async () => {
    const order = await createOrder();
    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, { headers: asStudio });
    await expectContract(response, { status: 404 });
  });
});

describe('POST /commercial-orders/{orderId}/documents (E10.19b, action EXPLICITE)', () => {
  it('Idempotency-Key exigee (400 sans en-tete)', async () => {
    const order = await createOrder();
    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: asUser,
    });
    expect(response.status).toBe(400);
  });

  it('403 identity.actor_kind_required sur une cle de service (bearerAuth SEUL, contrat)', async () => {
    const order = await createOrder();
    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asStudio, 'Idempotency-Key': `doc-${uuid()}` },
    });
    expect(response.status).toBe(403);
  });

  it('404 order.not_found : commande introuvable', async () => {
    const response = await call(`/api/v1/commercial-orders/${uuid()}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': `doc-${uuid()}` },
    });
    await expectContract(response, { status: 404 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order.not_found');
  });

  it('409 order.document_template_missing : AUCUN gabarit order eligible, AUCUN repli sur un gabarit quote', async () => {
    templateEligible = false;
    const order = await createOrder();
    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': `doc-${uuid()}` },
    });
    await expectContract(response, { status: 409 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('order.document_template_missing');
  });

  it('201 : produit le document (rendu pdf-lib REEL), schema OrderDocument, generated_by = acteur', async () => {
    const order = await createOrder();
    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': `doc-${uuid()}` },
    });
    await expectContract(response, { status: 201, dataSchema: 'OrderDocument' });
    const body = (await response.json()) as { data: OrderDocumentDto };
    expect(body.data.order_id).toBe(order.id);
    expect(body.data.generated_by).toBe(USER);
    expect(body.data.page_count).toBeGreaterThanOrEqual(1);
  });

  it('409 order.document_already_generated : une SECONDE production (cle d idempotence DIFFERENTE) est refusee, "la lire, ne pas la reproduire"', async () => {
    const order = await createOrder();
    const first = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': `doc-${uuid()}` },
    });
    expect(first.status).toBe(201);

    const second = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': `doc-${uuid()}` },
    });
    await expectContract(second, { status: 409 });
    const body = (await second.json()) as { code: string };
    expect(body.code).toBe('order.document_already_generated');
  });

  it('rejeu de la MEME cle d idempotence : 201 identique, Idempotency-Replayed: true, AUCUNE seconde production', async () => {
    const order = await createOrder();
    const key = `doc-${uuid()}`;

    const first = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': key },
    });
    expect(first.status).toBe(201);
    const { data: firstDocument } = (await first.json()) as { data: OrderDocumentDto };

    const second = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': key },
    });
    expect(second.status).toBe(201);
    expect(second.headers.get('idempotency-replayed')).toBe('true');
    const { data: secondDocument } = (await second.json()) as { data: OrderDocumentDto };
    expect(secondDocument).toEqual(firstDocument);
  });

  // qa-review m1 (mineur, corrige) — `setCustomerReferenceForTest()` du faux
  // `InMemoryCommercialOrdersRepository` etait pose sans etre exerce par
  // aucun test. Preuve ICI, DE BOUT EN BOUT via la vraie route HTTP : une
  // commande dont `customer_reference` est renseigne (colonne gelee,
  // E10.19a) produit son bon de commande SANS erreur — la valeur exacte
  // imprimee (`order.customer_reference`) est prouvee par
  // `resolveOrderDocumentFieldValues`, deja teste unitairement
  // (document-field-value-resolver.test.ts), et sa transmission SANS
  // alteration par `generateDocument()` par
  // tests/modules/commercial-orders/commercial-orders-service.test.ts.
  it('customer_reference renseigne (E10.19a) : la production reussit (201), aucune regression sur ce champ jusqu ici jamais exerce', async () => {
    const order = await createOrder();
    ordersRepository.setCustomerReferenceForTest(order.id, 'PO-77451');

    const response = await call(`/api/v1/commercial-orders/${order.id}/documents`, {
      method: 'POST',
      headers: { ...asUser, 'Idempotency-Key': `doc-${uuid()}` },
    });
    await expectContract(response, { status: 201, dataSchema: 'OrderDocument' });
  });
});
