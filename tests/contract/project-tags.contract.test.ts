/**
 * Module Tags de projet (E10.2) contre le contrat.
 *
 * Exerce reellement `createProjectTagsRoutes()` ET `createProjectsRoutes()`
 * via `createGescomApiHandler`, avec des repositories en memoire (aucune
 * dependance a Supabase). Chaque reponse est confrontee au contrat via
 * `checkResponseAgainstContract()`.
 *
 * CA verifies ici :
 *  - CA1 : un projet accepte 0 a N tags, chacun avec une couleur de la
 *    palette fermee.
 *  - CA2 : creation a la volee, idempotente sur le libelle normalise (200
 *    sur l existant, 201 sur une creation reelle), concurrence geree cote
 *    base (deux creations "concurrentes" du meme libelle rendent le MEME
 *    identifiant).
 *  - CA3 : scope tenant — le meme libelle dans deux tenants ne collisionne
 *    pas.
 *  - CA4 : recherche plein texte (nom projet + nom client), y compris une
 *    virgule dans le terme (lecon E10.4 — une requete PostgREST cassee par
 *    une virgule non echappee rendait un 500) ; filtre multi-tags en ET
 *    logique.
 *  - CA5 : retirer un tag d un projet ne le supprime pas du tenant ; un tag
 *    encore utilise ne se supprime pas (409 `project_tag.in_use`) ; un tag
 *    non utilise se supprime.
 *  - CA6 : les tags apparaissent dans `GET /projects` (liste) ET
 *    `GET /projects/{id}` (detail).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  OutboxPublisher,
  type ApiPrincipal,
  type OutboxRepository,
  type OutboxEvent,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { ProjectsService } from '@/modules/projects/application/projects-service';
import { ProjectTagsService } from '@/modules/project-tags/application/project-tags-service';
import type { ProjectDto } from '@/modules/projects/api/contracts';
import type { ProjectTagDto } from '@/modules/project-tags/api/contracts';
import { createProjectsRoutes } from '@/server/api/projects-routes';
import { createProjectTagsRoutes } from '@/server/api/project-tags-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';
import { InMemoryProjectsRepository } from './_fakes/projects-repository.fake.ts';
import { InMemoryCustomersRepository } from './_fakes/customers-repository.fake.ts';
import { InMemoryProjectTagsRepository } from './_fakes/project-tags-repository.fake.ts';

const TENANT_A = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const TENANT_B = brand<TenantId>('8a1e3b2f-2d5c-4f9b-ad4e-6c7f8a9b0123');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

function principalFor(tenantId: TenantId): ApiPrincipal {
  return Object.freeze({ kind: 'user', userId: USER, tenantId });
}

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
let projectTagsRepository: InMemoryProjectTagsRepository;
let customerNames: Map<string, string>;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  projectTagsRepository = new InMemoryProjectTagsRepository();
  projectsRepository = new InMemoryProjectsRepository(projectTagsRepository);
  customersRepository = new InMemoryCustomersRepository();
  // CA4 : le faux Projets n a pas de reference directe au faux Clients
  // (fakes de modules distincts, non couples) ; la recherche par nom de
  // client est simulee via cette table de correspondance, remplie par
  // `createCustomer()` ci-dessous. L adaptateur Supabase reel, lui, resout
  // ce nom par une requete SQL (voir `findCustomerIdsByName`).
  customerNames = new Map();
  projectsRepository.customerNames = customerNames;

  const outbox = new OutboxPublisher({
    repository: new InMemoryOutboxRepository(),
    now: () => new Date('2026-09-02T10:00:00.000Z'),
    newEventId: () => uuid(),
  });
  const projectsService = new ProjectsService({
    repository: projectsRepository,
    customers: customersRepository,
    projectTags: projectTagsRepository,
    outbox,
  });
  const projectTagsService = new ProjectTagsService({ repository: projectTagsRepository });

  const verifier: PrincipalVerifier = {
    async verify(credential) {
      if (credential.kind !== 'bearer') return null;
      if (credential.token === 'jeton-tenant-a') return principalFor(TENANT_A);
      if (credential.token === 'jeton-tenant-b') return principalFor(TENANT_B);
      return null;
    },
  };

  handler = createGescomApiHandler({
    routes: [...createProjectsRoutes(projectsService), ...createProjectTagsRoutes(projectTagsService)],
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-2',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asTenantA = { Authorization: 'Bearer jeton-tenant-a' };
const asTenantB = { Authorization: 'Bearer jeton-tenant-b' };
const jsonHeadersA = { ...asTenantA, 'Content-Type': 'application/json' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

async function createTag(
  label: string,
  headers: Record<string, string> = jsonHeadersA,
): Promise<{ status: number; tag: ProjectTagDto }> {
  const response = await call('/api/v1/project-tags', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `tag-${uuid()}` },
    body: JSON.stringify({ label }),
  });
  const body = (await response.json()) as { data: ProjectTagDto };
  return { status: response.status, tag: body.data };
}

async function createCustomer(name: string, tenant: 'a' | 'b' = 'a') {
  const tenantId = tenant === 'a' ? TENANT_A : TENANT_B;
  const created = await customersRepository.create(tenantId, USER, {
    type: 'company',
    company_name: name,
    siret: tenant === 'a' ? '73282932000074' : `5607891915${sequence.toString().padStart(4, '0')}`,
  } as any);
  customerNames.set(created.id, name);
  return created;
}

async function createProject(
  customerId: string,
  overrides: Partial<Record<string, unknown>> = {},
  headers: Record<string, string> = jsonHeadersA,
): Promise<ProjectDto> {
  const response = await call('/api/v1/projects', {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': `project-${uuid()}` },
    body: JSON.stringify({ name: 'Projet', customer_id: customerId, ...overrides }),
  });
  const body = (await response.json()) as { data: ProjectDto };
  return body.data;
}

describe('module Tags de projet (E10.2) contre le contrat', () => {
  it('CA2 — cree un tag a la volee, 201 sur une creation reelle', async () => {
    const { status, tag } = await createTag('Urgent');
    expect(status).toBe(201);
    expect(tag.label).toBe('Urgent');
    expect(['slate', 'blue', 'green', 'amber', 'red', 'violet']).toContain(tag.color);

    const response = await call('/api/v1/project-tags', {
      method: 'POST',
      headers: { ...jsonHeadersA, 'Idempotency-Key': `tag-${uuid()}` },
      body: JSON.stringify({ label: 'Urgent' }),
    });
    await expectContract(response, { status: 200, dataSchema: 'ProjectTag' });
  });

  it('CA2 — creation idempotente sur le libelle normalise (trim, casse) : rend 200 avec l EXISTANT, jamais 409', async () => {
    const first = await createTag('Urgent');
    expect(first.status).toBe(201);

    const response = await call('/api/v1/project-tags', {
      method: 'POST',
      headers: { ...jsonHeadersA, 'Idempotency-Key': `tag-${uuid()}` },
      body: JSON.stringify({ label: '  urgent  ' }),
    });
    await expectContract(response, { status: 200, dataSchema: 'ProjectTag' });
    const body = (await response.json()) as { data: ProjectTagDto };
    expect(body.data.id).toBe(first.tag.id);
    // Affiche TEL QUE SAISI a la premiere creation, pas re-normalise.
    expect(body.data.label).toBe('Urgent');
  });

  it('CA2 — deux creations concurrentes du meme libelle rendent le MEME identifiant, jamais deux tags jumeaux', async () => {
    const [first, second] = await Promise.all([createTag('Presse'), createTag('presse')]);
    expect(first.tag.id).toBe(second.tag.id);
    // Exactement une des deux tentatives a cree la ressource (201), l autre
    // a relu l existant (200) — jamais les deux en 201.
    expect([first.status, second.status].sort()).toEqual([200, 201]);

    const list = await call('/api/v1/project-tags', { headers: asTenantA });
    const listBody = (await list.json()) as { data: ProjectTagDto[] };
    expect(listBody.data.filter((tag) => tag.label.toLowerCase() === 'presse')).toHaveLength(1);
  });

  it('CA3 — le meme libelle dans deux tenants distincts ne collisionne pas', async () => {
    const inA = await createTag('Prioritaire', jsonHeadersA);
    expect(inA.status).toBe(201);

    const responseB = await call('/api/v1/project-tags', {
      method: 'POST',
      headers: { ...asTenantB, 'Content-Type': 'application/json', 'Idempotency-Key': `tag-${uuid()}` },
      body: JSON.stringify({ label: 'Prioritaire' }),
    });
    await expectContract(responseB, { status: 201, dataSchema: 'ProjectTag' });
    const bodyB = (await responseB.json()) as { data: ProjectTagDto };
    expect(bodyB.data.id).not.toBe(inA.tag.id);
    expect(bodyB.data.tenant_id).toBe(TENANT_B);
  });

  it('CA2 — libelle vide (apres trim) est refuse en validation de forme', async () => {
    const response = await call('/api/v1/project-tags', {
      method: 'POST',
      headers: { ...jsonHeadersA, 'Idempotency-Key': `tag-${uuid()}` },
      body: JSON.stringify({ label: '   ' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('CA2 — autocompletion : `q` filtre les tags du tenant par libelle', async () => {
    await createTag('Urgent');
    await createTag('Presse offset');
    await createTag('Standard');

    const response = await call('/api/v1/project-tags?q=pres', { headers: asTenantA });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: ProjectTagDto[] };
    expect(body.data.map((tag) => tag.label)).toEqual(['Presse offset']);
  });

  it('CA1/CA6 — un projet accepte 0 a N tags, affiches dans la liste ET la fiche detaillee', async () => {
    const customer = await createCustomer('Client Tags');
    const project = await createProject(customer.id);
    const urgent = await createTag('Urgent');
    const presse = await createTag('Presse');

    const etag = (await call(`/api/v1/projects/${project.id}`, { headers: asTenantA })).headers.get('etag')!;
    const replaced = await call(`/api/v1/projects/${project.id}/tags`, {
      method: 'PUT',
      headers: { ...jsonHeadersA, 'If-Match': etag },
      body: JSON.stringify({ tag_ids: [urgent.tag.id, presse.tag.id] }),
    });
    await expectContract(replaced, { status: 200, dataSchema: 'Project' });
    const replacedBody = (await replaced.json()) as { data: ProjectDto };
    expect(replacedBody.data.tags.map((t) => t.id).sort()).toEqual([urgent.tag.id, presse.tag.id].sort());

    // CA6 — visible dans la liste.
    const list = await call('/api/v1/projects', { headers: asTenantA });
    await expectContract(list, { status: 200 });
    const listBody = (await list.json()) as { data: ProjectDto[] };
    const row = listBody.data.find((p) => p.id === project.id)!;
    expect(row.tags.map((t) => t.id).sort()).toEqual([urgent.tag.id, presse.tag.id].sort());

    // CA6 — visible dans la fiche detaillee.
    const detail = await call(`/api/v1/projects/${project.id}`, { headers: asTenantA });
    await expectContract(detail, { status: 200, dataSchema: 'ProjectDetail' });
    const detailBody = (await detail.json()) as { data: { tags: ProjectTagDto[] } };
    expect(detailBody.data.tags.map((t) => t.id).sort()).toEqual([urgent.tag.id, presse.tag.id].sort());
  });

  it('CA6 — PUT /projects/{id}/tags exige If-Match (428) et refuse un ETag perime (409)', async () => {
    const customer = await createCustomer('Client Concurrence');
    const project = await createProject(customer.id);
    const tag = await createTag('Urgent');

    const withoutIfMatch = await call(`/api/v1/projects/${project.id}/tags`, {
      method: 'PUT',
      headers: jsonHeadersA,
      body: JSON.stringify({ tag_ids: [tag.tag.id] }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    const stale = await call(`/api/v1/projects/${project.id}/tags`, {
      method: 'PUT',
      headers: { ...jsonHeadersA, 'If-Match': '"0123456789abcdef0123456789abcdef"' },
      body: JSON.stringify({ tag_ids: [tag.tag.id] }),
    });
    await expectContract(stale, { status: 409 });
  });

  it('CA6 — PUT /projects/{id}/tags refuse un tag_id inconnu du tenant (422 project.tag_unknown)', async () => {
    const customer = await createCustomer('Client Tag Inconnu');
    const project = await createProject(customer.id);
    const etag = (await call(`/api/v1/projects/${project.id}`, { headers: asTenantA })).headers.get('etag')!;

    const response = await call(`/api/v1/projects/${project.id}/tags`, {
      method: 'PUT',
      headers: { ...jsonHeadersA, 'If-Match': etag },
      body: JSON.stringify({ tag_ids: [uuid()] }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('project.tag_unknown');
  });

  it('CA5 — retirer un tag d un projet ne le supprime pas du tenant', async () => {
    const customer = await createCustomer('Client Retrait');
    const project = await createProject(customer.id);
    const tag = await createTag('Urgent');

    const etag1 = (await call(`/api/v1/projects/${project.id}`, { headers: asTenantA })).headers.get('etag')!;
    await call(`/api/v1/projects/${project.id}/tags`, {
      method: 'PUT',
      headers: { ...jsonHeadersA, 'If-Match': etag1 },
      body: JSON.stringify({ tag_ids: [tag.tag.id] }),
    });

    const etag2 = (await call(`/api/v1/projects/${project.id}`, { headers: asTenantA })).headers.get('etag')!;
    const cleared = await call(`/api/v1/projects/${project.id}/tags`, {
      method: 'PUT',
      headers: { ...jsonHeadersA, 'If-Match': etag2 },
      body: JSON.stringify({ tag_ids: [] }),
    });
    const clearedBody = (await cleared.json()) as { data: ProjectDto };
    expect(clearedBody.data.tags).toEqual([]);

    // Le tag reste disponible au niveau du tenant.
    const list = await call('/api/v1/project-tags', { headers: asTenantA });
    const listBody = (await list.json()) as { data: ProjectTagDto[] };
    expect(listBody.data.map((t) => t.id)).toContain(tag.tag.id);
  });

  it('CA5 — un tag encore utilise ne peut pas etre supprime (409), un tag non utilise le peut', async () => {
    const customer = await createCustomer('Client Suppression');
    const project = await createProject(customer.id);
    const used = await createTag('Utilise');
    const unused = await createTag('Inutilise');

    const etag = (await call(`/api/v1/projects/${project.id}`, { headers: asTenantA })).headers.get('etag')!;
    await call(`/api/v1/projects/${project.id}/tags`, {
      method: 'PUT',
      headers: { ...jsonHeadersA, 'If-Match': etag },
      body: JSON.stringify({ tag_ids: [used.tag.id] }),
    });

    const refused = await call(`/api/v1/project-tags/${used.tag.id}`, {
      method: 'DELETE',
      headers: asTenantA,
    });
    await expectContract(refused, { status: 409 });
    const refusedBody = (await refused.json()) as { code: string };
    expect(refusedBody.code).toBe('project_tag.in_use');

    const accepted = await call(`/api/v1/project-tags/${unused.tag.id}`, {
      method: 'DELETE',
      headers: asTenantA,
    });
    await expectContract(accepted, { status: 200 });
    const acceptedBody = (await accepted.json()) as { data: { deleted: boolean } };
    expect(acceptedBody.data.deleted).toBe(true);
  });

  it('DELETE /project-tags/{id} sur un tag inconnu rend 404', async () => {
    const response = await call(`/api/v1/project-tags/${uuid()}`, {
      method: 'DELETE',
      headers: asTenantA,
    });
    await expectContract(response, { status: 404 });
  });

  it('CA3 — un membre du tenant B ne voit ni ne peut retirer un tag du tenant A', async () => {
    const tagA = await createTag('Confidentiel', jsonHeadersA);
    const list = await call('/api/v1/project-tags', { headers: asTenantB });
    const listBody = (await list.json()) as { data: ProjectTagDto[] };
    expect(listBody.data.map((t) => t.id)).not.toContain(tagA.tag.id);

    const response = await call(`/api/v1/project-tags/${tagA.tag.id}`, {
      method: 'DELETE',
      headers: asTenantB,
    });
    // Le tag existe mais hors du tenant du jeton -> 404, jamais 403 (CA4 du socle E10.0).
    await expectContract(response, { status: 404 });
  });

  it('CA4 — recherche plein texte sur le nom du projet ET le nom du client, virgule comprise sans planter', async () => {
    const customer = await createCustomer('Dupont, Martin & Fils');
    const other = await createCustomer('Autre Client');
    const matching = await createProject(customer.id, { name: 'Salon Imprim’Expo' });
    await createProject(other.id, { name: 'Autre projet' });

    // Recherche par nom de CLIENT, avec une virgule dans le terme (lecon
    // E10.4 : casser la requete PostgREST sur une virgule non echappee
    // rendait 500).
    const response = await call(
      `/api/v1/projects?q=${encodeURIComponent('Dupont, Martin')}`,
      { headers: asTenantA },
    );
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: ProjectDto[] };
    expect(body.data.map((p) => p.id)).toEqual([matching.id]);
  });

  it('CA4 — filtre multi-tags en ET logique : seuls les projets portant TOUS les tags demandes sont rendus', async () => {
    const customer = await createCustomer('Client Filtre');
    const both = await createProject(customer.id, { name: 'Projet AB' });
    const onlyA = await createProject(customer.id, { name: 'Projet A' });
    const neither = await createProject(customer.id, { name: 'Projet Aucun' });
    const tagA = await createTag('Alpha');
    const tagB = await createTag('Beta');

    async function assignTags(project: ProjectDto, tagIds: string[]) {
      const etag = (await call(`/api/v1/projects/${project.id}`, { headers: asTenantA })).headers.get('etag')!;
      await call(`/api/v1/projects/${project.id}/tags`, {
        method: 'PUT',
        headers: { ...jsonHeadersA, 'If-Match': etag },
        body: JSON.stringify({ tag_ids: tagIds }),
      });
    }
    await assignTags(both, [tagA.tag.id, tagB.tag.id]);
    await assignTags(onlyA, [tagA.tag.id]);
    void neither;

    const response = await call(
      `/api/v1/projects?tag_ids=${tagA.tag.id},${tagB.tag.id}`,
      { headers: asTenantA },
    );
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: ProjectDto[] };
    expect(body.data.map((p) => p.id)).toEqual([both.id]);
  });

  it('CA4 — un tag_ids malforme rend 400, jamais un 500', async () => {
    const response = await call('/api/v1/projects?tag_ids=pas-un-uuid', { headers: asTenantA });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });
});
