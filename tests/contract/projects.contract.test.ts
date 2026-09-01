/**
 * Module Projets (E10.1) contre le contrat.
 *
 * Exerce reellement `createProjectsRoutes()` via `createGescomApiHandler`,
 * avec un `ProjectsRepository` et un `CustomersRepository` en memoire (aucune
 * dependance a Supabase) et un `OutboxRepository` en memoire pour verifier
 * `project.created`. Chaque reponse est confrontee au contrat via
 * `checkResponseAgainstContract()`.
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
import type { ProjectDetailDto, ProjectDto, ProjectItemDto } from '@/modules/projects/api/contracts';
import { createProjectsRoutes } from '@/server/api/projects-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';
import { InMemoryProjectsRepository } from './_fakes/projects-repository.fake.ts';
import { InMemoryCustomersRepository } from './_fakes/customers-repository.fake.ts';

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
  scopes: Object.freeze(['projects:read']),
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
let outboxRepository: InMemoryOutboxRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  projectsRepository = new InMemoryProjectsRepository();
  customersRepository = new InMemoryCustomersRepository();
  outboxRepository = new InMemoryOutboxRepository();
  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
    newEventId: () => uuid(),
  });
  const service = new ProjectsService({
    repository: projectsRepository,
    customers: customersRepository,
    outbox,
  });
  handler = createGescomApiHandler({
    routes: createProjectsRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-1',
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
    headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
    body: JSON.stringify({ name: 'Salon Imprim’Expo 2026', customer_id: customerId, ...overrides }),
  });
  await expectContract(response, { status: 201, dataSchema: 'Project' });
  return (await response.json()) as { data: ProjectDto };
}

describe('module Projets (E10.1) contre le contrat', () => {
  it('CA3/évènement — cree un projet rattache a un client existant et publie project.created', async () => {
    const customer = await createCustomer();
    const { data } = await createProject(customer.id);

    expect(data.customer_id).toBe(customer.id);
    expect(data.status).toBe('active');
    expect(data.tags).toEqual([]);
    expect(outboxRepository.events).toHaveLength(1);
    expect(outboxRepository.events[0]).toMatchObject({
      name: 'project.created',
      tenantId: TENANT,
      aggregateType: 'project',
      aggregateId: data.id,
    });
  });

  it('CA3 — customer_id absent est refuse en 422 project.customer_required', async () => {
    const response = await call('/api/v1/projects', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ name: 'Projet sans client' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string; errors?: { field: string }[] };
    expect(body.code).toBe('project.customer_required');
    expect(body.errors?.some((e) => e.field === 'customer_id')).toBe(true);
  });

  it('CA3 — customer_id inconnu du tenant est refuse EXACTEMENT avec le meme code que customer_id absent', async () => {
    const response = await call('/api/v1/projects', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ name: 'Projet client fantome', customer_id: uuid() }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('project.customer_required');
  });

  it('CA3 — nom vide est refuse en validation de forme (distinct du cas customer_id)', async () => {
    const customer = await createCustomer();
    const response = await call('/api/v1/projects', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ name: '', customer_id: customer.id }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('CA2 — liste les projets du tenant, tries par derniere modification decroissante', async () => {
    const customer = await createCustomer();
    const { data: first } = await createProject(customer.id, { name: 'Premier' });
    const { data: second } = await createProject(customer.id, { name: 'Second' });

    // Modifie le premier APRES le second : il doit remonter en tete de liste.
    const etag = (
      await call(`/api/v1/projects/${first.id}`, { headers: asUser })
    ).headers.get('etag')!;
    await call(`/api/v1/projects/${first.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ name: 'Premier renomme' }),
    });

    const list = await call('/api/v1/projects', { headers: asUser });
    await expectContract(list, { status: 200 });
    const listBody = (await list.json()) as { data: ProjectDto[] };
    expect(listBody.data.map((p) => p.id)).toEqual([first.id, second.id]);
  });

  it('CA2 — filtre par customer_id et par statut, pagine par curseur', async () => {
    const customerA = await createCustomer({ company_name: 'Client A' });
    const customerB = await createCustomer({ company_name: 'Client B', siret: '56078919152347' });
    await createProject(customerA.id, { name: 'Projet A1' });
    await createProject(customerA.id, { name: 'Projet A2' });
    await createProject(customerB.id, { name: 'Projet B1' });

    const filtered = await call(`/api/v1/projects?customer_id=${customerA.id}`, { headers: asUser });
    await expectContract(filtered, { status: 200 });
    const filteredBody = (await filtered.json()) as { data: ProjectDto[] };
    expect(filteredBody.data).toHaveLength(2);

    const paged = await call('/api/v1/projects?page[size]=1', { headers: asUser });
    await expectContract(paged, { status: 200 });
    const pagedBody = (await paged.json()) as {
      data: ProjectDto[];
      meta: { next_cursor: string | null };
    };
    expect(pagedBody.data).toHaveLength(1);
    expect(pagedBody.meta.next_cursor).not.toBeNull();

    const searched = await call('/api/v1/projects?q=B1', { headers: asUser });
    await expectContract(searched, { status: 200 });
    const searchedBody = (await searched.json()) as { data: ProjectDto[] };
    expect(searchedBody.data).toHaveLength(1);
    expect(searchedBody.data[0]?.name).toBe('Projet B1');
  });

  it('B4 (qa-review) — ?customer_id= malforme est refuse en 400, jamais un 500', async () => {
    const response = await call('/api/v1/projects?customer_id=abc', { headers: asUser });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('B2 (qa-review) — enchaine page 1 -> page 2 -> page 3 sans doublon ni trou', async () => {
    // Le faux repository doit honorer le curseur EXACTEMENT comme
    // l adaptateur Supabase (filtre keyset + tri updated_at desc, id desc) :
    // sans ca, un client qui suit `meta.next_cursor` (Studio en premier)
    // rendrait indefiniment la meme page.
    const customer = await createCustomer();
    const created: ProjectDto[] = [];
    for (let index = 0; index < 5; index += 1) {
      const { data } = await createProject(customer.id, { name: `Projet ${index}` });
      created.push(data);
    }
    const expectedIds = [...created].reverse().map((p) => p.id); // updated_at desc = ordre de creation inverse

    const seenIds: string[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    do {
      const response = await call(
        `/api/v1/projects?page[size]=2${cursor ? `&page[cursor]=${encodeURIComponent(cursor)}` : ''}`,
        { headers: asUser },
      );
      await expectContract(response, { status: 200 });
      const body = (await response.json()) as { data: ProjectDto[]; meta: { next_cursor: string | null } };
      seenIds.push(...body.data.map((p) => p.id));
      cursor = body.meta.next_cursor;
      pageCount += 1;
      expect(pageCount).toBeLessThanOrEqual(10); // filet de securite anti-boucle infinie
    } while (cursor !== null);

    expect(pageCount).toBe(3); // 5 elements, page[size]=2 -> 2 + 2 + 1
    expect(seenIds).toEqual(expectedIds); // aucun doublon, aucun trou, ordre respecte
  });

  it('CA6 — renomme, change de client et archive/reactive un projet, proteges par If-Match', async () => {
    const customerA = await createCustomer({ company_name: 'Client A' });
    const customerB = await createCustomer({ company_name: 'Client B', siret: '56078919152347' });
    const { data: project } = await createProject(customerA.id);

    const detail = await call(`/api/v1/projects/${project.id}`, { headers: asUser });
    await expectContract(detail, { status: 200, dataSchema: 'ProjectDetail' });
    const etag = detail.headers.get('etag');
    expect(etag).toBeTruthy();

    const withoutIfMatch = await call(`/api/v1/projects/${project.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'archived' }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    const renamed = await call(`/api/v1/projects/${project.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag! },
      body: JSON.stringify({ name: 'Renomme', customer_id: customerB.id, status: 'archived' }),
    });
    await expectContract(renamed, { status: 200, dataSchema: 'Project' });
    const renamedBody = (await renamed.json()) as { data: ProjectDto };
    expect(renamedBody.data.name).toBe('Renomme');
    expect(renamedBody.data.customer_id).toBe(customerB.id);
    expect(renamedBody.data.status).toBe('archived');

    // CA6 — jamais un DELETE : la ressource reste lisible apres archivage.
    const stillReadable = await call(`/api/v1/projects/${project.id}`, { headers: asUser });
    await expectContract(stillReadable, { status: 200, dataSchema: 'ProjectDetail' });
  });

  it('CA6 — changer de client vers un customer_id inconnu est refuse (meme code que la creation)', async () => {
    const customerA = await createCustomer();
    const { data: project } = await createProject(customerA.id);
    const etag = (
      await call(`/api/v1/projects/${project.id}`, { headers: asUser })
    ).headers.get('etag')!;

    const response = await call(`/api/v1/projects/${project.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ customer_id: uuid() }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('project.customer_required');
  });

  it('CA7 — un projet inconnu du tenant rend 404, jamais une autre reponse', async () => {
    const response = await call(`/api/v1/projects/${uuid()}`, { headers: asUser });
    await expectContract(response, { status: 404 });
  });

  it('CA4/CA5 — ajoute un element de chiffrage et le restitue dans la fiche detaillee', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);

    const quotePayload = {
      id: 'product-1',
      name: 'Flyer A5',
      quantity: 1000,
      format: 'A5',
      material: 'Couché brillant',
      weight: 135,
    };
    const clariprintConfig = { reference: 'leaflet', quantity: 1000 };

    const added = await call(`/api/v1/projects/${project.id}/items`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `item-${uuid()}` },
      body: JSON.stringify({
        label: 'Flyer A5',
        quote_payload: quotePayload,
        clariprint_config: clariprintConfig,
      }),
    });
    await expectContract(added, { status: 201, dataSchema: 'ProjectItem' });
    const addedBody = (await added.json()) as { data: ProjectItemDto };
    expect(addedBody.data.quote_payload).toEqual(quotePayload);
    expect(addedBody.data.clariprint_config).toEqual(clariprintConfig);
    expect(addedBody.data.position).toBe(0);

    const detail = await call(`/api/v1/projects/${project.id}`, { headers: asUser });
    await expectContract(detail, { status: 200, dataSchema: 'ProjectDetail' });
    const detailBody = (await detail.json()) as { data: ProjectDetailDto };
    expect(detailBody.data.items).toHaveLength(1);
    expect(detailBody.data.items[0]?.quote_payload).toEqual(quotePayload);
  });

  it('CA4 — un second element prend la position suivante, dans l ordre d ajout', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);

    await call(`/api/v1/projects/${project.id}/items`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `item-${uuid()}` },
      body: JSON.stringify({ label: 'Premier', quote_payload: { id: 1 } }),
    });
    const second = await call(`/api/v1/projects/${project.id}/items`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `item-${uuid()}` },
      body: JSON.stringify({ label: 'Second', quote_payload: { id: 2 } }),
    });
    const secondBody = (await second.json()) as { data: ProjectItemDto };
    expect(secondBody.data.position).toBe(1);
  });

  it('CA5 — retire un element du projet (retrait du lien, pas suppression d historique)', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);
    const added = await call(`/api/v1/projects/${project.id}/items`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `item-${uuid()}` },
      body: JSON.stringify({ label: 'A retirer', quote_payload: { id: 1 } }),
    });
    const { data: item } = (await added.json()) as { data: ProjectItemDto };

    const removed = await call(`/api/v1/projects/${project.id}/items/${item.id}`, {
      method: 'DELETE',
      headers: asUser,
    });
    await expectContract(removed, { status: 200 });
    const removedBody = (await removed.json()) as { data: { removed: boolean } };
    expect(removedBody.data.removed).toBe(true);

    const detail = await call(`/api/v1/projects/${project.id}`, { headers: asUser });
    const detailBody = (await detail.json()) as { data: ProjectDetailDto };
    expect(detailBody.data.items).toEqual([]);
  });

  it('CA8 — Studio (cle de service, scope projects:read) peut lire mais pas ecrire', async () => {
    const customer = await createCustomer();
    const { data: project } = await createProject(customer.id);

    const readable = await call(`/api/v1/projects/${project.id}`, {
      headers: { 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(readable, { status: 200, dataSchema: 'ProjectDetail' });

    const writeAttempt = await call('/api/v1/projects', {
      method: 'POST',
      headers: {
        'X-Magrit-Service-Key': 'cle-studio',
        'Content-Type': 'application/json',
        'Idempotency-Key': `create-${uuid()}`,
      },
      body: JSON.stringify({ name: 'X', customer_id: customer.id }),
    });
    // authentication: 'user' sur createProject -> refuse toute cle de service.
    await expectContract(writeAttempt, { status: 403 });
  });

  it('CA8 — une cle de service sans le scope projects:read recoit 403', async () => {
    const response = await call('/api/v1/projects', {
      headers: { 'X-Magrit-Service-Key': 'cle-studio-sans-scope' },
    });
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.scope_required');
  });
});
