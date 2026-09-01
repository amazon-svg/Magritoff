/**
 * Module Clients contre le contrat (story E10.4).
 *
 * Exerce reellement `createCustomersRoutes()` via `createGescomApiHandler`,
 * avec un `CustomersRepository` en memoire (aucune dependance a Supabase) et
 * un `OutboxRepository` en memoire pour verifier `customer.created` (CA10).
 * Chaque reponse est confrontee au contrat via `checkResponseAgainstContract`.
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
import {
  CustomerCommandRejectedError,
  CustomerNotFoundError,
  type CustomersRepository,
  type ListCustomersParams,
  type ListCustomersResult,
} from '@/modules/customers/application/customers-repository';
import { CustomersService } from '@/modules/customers/application/customers-service';
import type {
  CreateCustomerCommand,
  CreateCustomerContactCommand,
  CustomerContactDto,
  CustomerDetailDto,
  CustomerDto,
  UpdateCustomerCommand,
  UpdateCustomerContactCommand,
} from '@/modules/customers/api/contracts';
import { createCustomersRoutes } from '@/server/api/customers-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const OTHER_TENANT = brand<TenantId>('11111111-1111-4111-8111-111111111111');
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
  scopes: Object.freeze(['customers:read']),
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

/** Repository en memoire, sans dependance a Supabase — fidele au trigger DB. */
class InMemoryCustomersRepository implements CustomersRepository {
  private readonly customers = new Map<string, CustomerDto>();
  private readonly contacts = new Map<string, CustomerContactDto>();

  async list(tenantId: TenantId, params: ListCustomersParams): Promise<ListCustomersResult> {
    const rows = [...this.customers.values()]
      .filter((c) => c.tenant_id === tenantId)
      .filter((c) => !params.type || c.type === params.type)
      .filter((c) => {
        if (!params.q) return true;
        const haystack = `${c.company_name ?? ''} ${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
        return haystack.includes(params.q.toLowerCase());
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return { rows };
  }

  async findById(tenantId: TenantId, customerId: string): Promise<CustomerDto | null> {
    const found = this.customers.get(customerId);
    return found && found.tenant_id === tenantId ? found : null;
  }

  async findDetailById(tenantId: TenantId, customerId: string): Promise<CustomerDetailDto | null> {
    const customer = await this.findById(tenantId, customerId);
    if (!customer) return null;
    const contacts = await this.listContacts(tenantId, customerId);
    return { ...customer, contacts: [...contacts], projects: [], quotes: [], orders: [] };
  }

  async create(
    tenantId: TenantId,
    _actor: UserId,
    command: CreateCustomerCommand,
  ): Promise<CustomerDto> {
    const now = new Date().toISOString();
    const customer: CustomerDto = {
      id: uuid(),
      tenant_id: tenantId,
      type: command.type,
      company_name: command.company_name ?? null,
      siret: command.siret ?? null,
      vat_number: command.vat_number ?? null,
      civility: command.civility ?? null,
      first_name: command.first_name ?? null,
      last_name: command.last_name ?? null,
      billing_address: command.billing_address ?? null,
      shipping_address: command.shipping_address ?? null,
      is_active: true,
      siret_verified: false,
      siret_verified_at: null,
      created_at: now,
      updated_at: now,
    };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async update(
    tenantId: TenantId,
    customerId: string,
    command: UpdateCustomerCommand,
  ): Promise<CustomerDto> {
    const current = await this.findById(tenantId, customerId);
    if (!current) throw new CustomerNotFoundError();
    const nextSiret = 'siret' in command ? (command.siret ?? null) : current.siret;
    // Reproduit le trigger DB `customers_reset_siret_verification` (M1) :
    // tout changement de SIRET remet le drapeau a plat, meme cote fake.
    const siretChanged = nextSiret !== current.siret;
    const updated: CustomerDto = {
      ...current,
      ...('company_name' in command ? { company_name: command.company_name ?? null } : {}),
      siret: nextSiret,
      ...('vat_number' in command ? { vat_number: command.vat_number ?? null } : {}),
      ...('civility' in command ? { civility: command.civility ?? null } : {}),
      ...('first_name' in command ? { first_name: command.first_name ?? null } : {}),
      ...('last_name' in command ? { last_name: command.last_name ?? null } : {}),
      ...('is_active' in command ? { is_active: command.is_active! } : {}),
      ...(siretChanged ? { siret_verified: false, siret_verified_at: null } : {}),
      updated_at: new Date().toISOString(),
    };
    this.customers.set(customerId, updated);
    return updated;
  }

  async listContacts(
    tenantId: TenantId,
    customerId: string,
  ): Promise<readonly CustomerContactDto[]> {
    void tenantId;
    return [...this.contacts.values()].filter((c) => c.customer_id === customerId);
  }

  async findContactById(
    _tenantId: TenantId,
    customerId: string,
    contactId: string,
  ): Promise<CustomerContactDto | null> {
    const contact = this.contacts.get(contactId);
    return contact && contact.customer_id === customerId ? contact : null;
  }

  async createContact(
    _tenantId: TenantId,
    customerId: string,
    command: CreateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    const now = new Date().toISOString();
    const contact: CustomerContactDto = {
      id: uuid(),
      customer_id: customerId,
      first_name: command.first_name,
      last_name: command.last_name,
      role: command.role ?? null,
      email: command.email,
      phone: command.phone ?? null,
      is_primary: command.is_primary ?? false,
      created_at: now,
      updated_at: now,
    };
    if (contact.is_primary) this.demoteOtherPrimaries(customerId, contact.id);
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async updateContact(
    _tenantId: TenantId,
    customerId: string,
    contactId: string,
    command: UpdateCustomerContactCommand,
  ): Promise<CustomerContactDto> {
    const current = this.contacts.get(contactId);
    if (!current || current.customer_id !== customerId) throw new CustomerNotFoundError();
    const updated: CustomerContactDto = {
      ...current,
      ...(command.first_name !== undefined ? { first_name: command.first_name } : {}),
      ...(command.last_name !== undefined ? { last_name: command.last_name } : {}),
      ...(command.role !== undefined ? { role: command.role } : {}),
      ...(command.email !== undefined ? { email: command.email } : {}),
      ...(command.phone !== undefined ? { phone: command.phone } : {}),
      ...(command.is_primary !== undefined ? { is_primary: command.is_primary } : {}),
      updated_at: new Date().toISOString(),
    };
    // Reproduit le trigger `customer_contacts_enforce_single_primary` (CA4).
    if (updated.is_primary) this.demoteOtherPrimaries(customerId, contactId);
    this.contacts.set(contactId, updated);
    return updated;
  }

  async markSiretVerified(
    tenantId: TenantId,
    customerId: string,
    result: Readonly<{ verified: boolean; verifiedAt: string }>,
  ): Promise<CustomerDto> {
    const current = await this.findById(tenantId, customerId);
    if (!current) throw new CustomerNotFoundError();
    const updated = {
      ...current,
      siret_verified: result.verified,
      siret_verified_at: result.verifiedAt,
    };
    this.customers.set(customerId, updated);
    return updated;
  }

  private demoteOtherPrimaries(customerId: string, keepId: string): void {
    for (const [id, contact] of this.contacts) {
      if (contact.customer_id === customerId && id !== keepId && contact.is_primary) {
        this.contacts.set(id, { ...contact, is_primary: false });
      }
    }
  }
}

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

let repository: InMemoryCustomersRepository;
let outboxRepository: InMemoryOutboxRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryCustomersRepository();
  outboxRepository = new InMemoryOutboxRepository();
  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-01T10:00:00.000Z'),
    newEventId: () => uuid(),
  });
  const service = new CustomersService({
    repository,
    outbox,
    clock: () => new Date('2026-09-01T10:00:00.000Z'),
    delay: async () => undefined,
  });
  handler = createGescomApiHandler({
    routes: createCustomersRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-4',
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

async function createCompany(overrides: Partial<Record<string, unknown>> = {}) {
  const response = await call('/api/v1/customers', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
    body: JSON.stringify({
      type: 'company',
      company_name: 'Imprimerie IPA',
      siret: '73282932000074',
      ...overrides,
    }),
  });
  await expectContract(response, { status: 201, dataSchema: 'Customer' });
  return (await response.json()) as { data: CustomerDto };
}

describe('module Clients (E10.4) contre le contrat', () => {
  it('CA2/CA10 — cree un client entreprise et publie customer.created', async () => {
    const { data } = await createCompany();
    expect(data.type).toBe('company');
    expect(data.siret_verified).toBe(false);
    expect(outboxRepository.events).toHaveLength(1);
    expect(outboxRepository.events[0]).toMatchObject({
      name: 'customer.created',
      tenantId: TENANT,
      aggregateType: 'customer',
      aggregateId: data.id,
    });
  });

  it('CA2 — un client entreprise sans SIRET est refuse en 422, champ par champ', async () => {
    const response = await call('/api/v1/customers', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ type: 'company', company_name: 'Sans Siret' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string; errors?: { field: string }[] };
    expect(body.code).toBe('api.validation_failed');
    expect(body.errors?.some((e) => e.field === 'siret')).toBe(true);
  });

  it('CA3 — un SIRET a 13 chiffres est refuse a la creation', async () => {
    const response = await call('/api/v1/customers', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ type: 'company', company_name: 'Court', siret: '1234567890123' }),
    });
    await expectContract(response, { status: 422 });
  });

  it('CA2 — un client particulier sans civilite/nom/prenom est refuse en 422', async () => {
    const response = await call('/api/v1/customers', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ type: 'individual' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { errors?: { field: string }[] };
    const fields = (body.errors ?? []).map((issue) => issue.field);
    expect(fields).toContain('civility');
    expect(fields).toContain('first_name');
    expect(fields).toContain('last_name');
  });

  it('M3 — un client particulier avec civilite est cree et la civilite est restituee', async () => {
    const response = await call('/api/v1/customers', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({
        type: 'individual',
        civility: 'mrs',
        first_name: 'Jeanne',
        last_name: 'Martin',
      }),
    });
    await expectContract(response, { status: 201, dataSchema: 'Customer' });
    const body = (await response.json()) as { data: CustomerDto };
    expect(body.data.civility).toBe('mrs');

    const detail = await call(`/api/v1/customers/${body.data.id}`, { headers: asUser });
    await expectContract(detail, { status: 200, dataSchema: 'CustomerDetail' });
    const detailBody = (await detail.json()) as { data: CustomerDetailDto };
    expect(detailBody.data.civility).toBe('mrs');
  });

  it('M3 — poser une civilite sur un client entreprise est refuse', async () => {
    const { data: customer } = await createCompany();
    const etag = (await call(`/api/v1/customers/${customer.id}`, { headers: asUser })).headers.get(
      'etag',
    )!;

    const response = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ civility: 'mr' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('customer.not_an_individual');
  });

  it('CA1 — liste et recherche les clients du tenant, pagine par curseur', async () => {
    await createCompany({ company_name: 'Alpha Impression' });
    await createCompany({ company_name: 'Beta Impression', siret: '56078919152347' });

    const all = await call('/api/v1/customers', { headers: asUser });
    await expectContract(all, { status: 200 });
    const allBody = (await all.json()) as { data: CustomerDto[] };
    expect(allBody.data).toHaveLength(2);

    const filtered = await call('/api/v1/customers?q=Alpha', { headers: asUser });
    await expectContract(filtered, { status: 200 });
    const filteredBody = (await filtered.json()) as { data: CustomerDto[] };
    expect(filteredBody.data).toHaveLength(1);
    expect(filteredBody.data[0]?.company_name).toBe('Alpha Impression');

    const paged = await call('/api/v1/customers?page[size]=1', { headers: asUser });
    await expectContract(paged, { status: 200 });
    const pagedBody = (await paged.json()) as {
      data: CustomerDto[];
      meta: { next_cursor: string | null };
    };
    expect(pagedBody.data).toHaveLength(1);
    expect(pagedBody.meta.next_cursor).not.toBeNull();
  });

  it('CA1 — la fiche detaillee expose les interlocuteurs et des points d extension vides', async () => {
    const { data: customer } = await createCompany();
    const detail = await call(`/api/v1/customers/${customer.id}`, { headers: asUser });
    await expectContract(detail, { status: 200, dataSchema: 'CustomerDetail' });
    const body = (await detail.json()) as { data: CustomerDetailDto };
    expect(body.data.contacts).toEqual([]);
    expect(body.data.projects).toEqual([]);
    expect(body.data.quotes).toEqual([]);
    expect(body.data.orders).toEqual([]);
  });

  it('M2 — GET /customers/{id} emet un ETag, declare au contrat, exploitable pour le PATCH', async () => {
    const { data: customer } = await createCompany();
    const detail = await call(`/api/v1/customers/${customer.id}`, { headers: asUser });
    await expectContract(detail, { status: 200, dataSchema: 'CustomerDetail' });
    const etag = detail.headers.get('etag');
    expect(etag).toBeTruthy();

    const patched = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag! },
      body: JSON.stringify({ vat_number: 'FR123456789' }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'Customer' });
  });

  it('CA7 — un client inconnu du tenant rend 404, jamais une autre reponse', async () => {
    const response = await call(`/api/v1/customers/${uuid()}`, { headers: asUser });
    await expectContract(response, { status: 404 });
  });

  it('CA8/CA9 — desactive un client via PATCH protege par If-Match', async () => {
    const { data: customer } = await createCompany();
    const detail = await call(`/api/v1/customers/${customer.id}`, { headers: asUser });
    const etag = detail.headers.get('etag');
    expect(etag).toBeTruthy();

    const withoutIfMatch = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ is_active: false }),
    });
    await expectContract(withoutIfMatch, { status: 428 });

    const patched = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag! },
      body: JSON.stringify({ is_active: false }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'Customer' });
    const body = (await patched.json()) as { data: CustomerDto };
    expect(body.data.is_active).toBe(false);
  });

  it('CA2 — modifier le SIRET d un client particulier est refuse', async () => {
    const created = await call('/api/v1/customers', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ type: 'individual', civility: 'mr', first_name: 'Jean', last_name: 'Dupont' }),
    });
    const { data: customer } = (await created.json()) as { data: CustomerDto };
    const detail = await call(`/api/v1/customers/${customer.id}`, { headers: asUser });
    const etag = detail.headers.get('etag')!;

    const response = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ siret: '73282932000074' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('customer.not_a_company');
  });

  it('CA3 — modifier un client entreprise avec un SIRET invalide est refuse', async () => {
    const { data: customer } = await createCompany();
    const detail = await call(`/api/v1/customers/${customer.id}`, { headers: asUser });
    const etag = detail.headers.get('etag')!;

    const response = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ siret: '12345678901234' }),
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('customer.siret_invalid');
  });

  it('M1 — remplacer un SIRET verifie retombe a siret_verified: false, sans re-verification', async () => {
    const { data: customer } = await createCompany({ siret: '73282932000074' });

    const verified = await call(`/api/v1/customers/${customer.id}/siret-verifications`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `verify-${uuid()}` },
    });
    await expectContract(verified, { status: 201, dataSchema: 'SiretVerificationResult' });
    const afterVerify = (await (await call(`/api/v1/customers/${customer.id}`, { headers: asUser })).json()) as {
      data: CustomerDetailDto;
    };
    expect(afterVerify.data.siret_verified).toBe(true);
    expect(afterVerify.data.siret_verified_at).not.toBeNull();

    const etag = (await call(`/api/v1/customers/${customer.id}`, { headers: asUser })).headers.get('etag')!;
    const patched = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      // SIRET B distinct, jamais soumis a la verification INSEE.
      body: JSON.stringify({ siret: '56078919152347' }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'Customer' });
    const patchedBody = (await patched.json()) as { data: CustomerDto };
    expect(patchedBody.data.siret).toBe('56078919152347');
    expect(patchedBody.data.siret_verified).toBe(false);
    expect(patchedBody.data.siret_verified_at).toBeNull();

    const reread = (await (await call(`/api/v1/customers/${customer.id}`, { headers: asUser })).json()) as {
      data: CustomerDetailDto;
    };
    expect(reread.data.siret_verified).toBe(false);
    expect(reread.data.siret_verified_at).toBeNull();
  });

  it('M1 — remettre le meme SIRET (aucun changement) ne remet pas siret_verified a false', async () => {
    const { data: customer } = await createCompany({ siret: '73282932000074' });
    await call(`/api/v1/customers/${customer.id}/siret-verifications`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `verify-${uuid()}` },
    });
    const etag = (await call(`/api/v1/customers/${customer.id}`, { headers: asUser })).headers.get('etag')!;

    const patched = await call(`/api/v1/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'If-Match': etag },
      body: JSON.stringify({ siret: '73282932000074' }),
    });
    await expectContract(patched, { status: 200, dataSchema: 'Customer' });
    const body = (await patched.json()) as { data: CustomerDto };
    expect(body.data.siret_verified).toBe(true);
  });

  it('CA4 — deux interlocuteurs, le second marque principal retrograde le premier', async () => {
    const { data: customer } = await createCompany();

    const first = await call(`/api/v1/customers/${customer.id}/contacts`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `contact-${uuid()}` },
      body: JSON.stringify({
        first_name: 'Alice',
        last_name: 'Martin',
        email: 'alice@example.test',
        is_primary: true,
      }),
    });
    await expectContract(first, { status: 201, dataSchema: 'CustomerContact' });
    const firstBody = (await first.json()) as { data: CustomerContactDto };
    expect(firstBody.data.is_primary).toBe(true);

    const second = await call(`/api/v1/customers/${customer.id}/contacts`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `contact-${uuid()}` },
      body: JSON.stringify({
        first_name: 'Bob',
        last_name: 'Durand',
        email: 'bob@example.test',
        is_primary: true,
      }),
    });
    await expectContract(second, { status: 201, dataSchema: 'CustomerContact' });

    const list = await call(`/api/v1/customers/${customer.id}/contacts`, { headers: asUser });
    await expectContract(list, { status: 200 });
    const listBody = (await list.json()) as { data: CustomerContactDto[] };
    const primaries = listBody.data.filter((c) => c.is_primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.first_name).toBe('Bob');
  });

  it('CA5 — un interlocuteur cree ne porte aucune trace de compte utilisateur ou d invitation', async () => {
    const { data: customer } = await createCompany();
    const response = await call(`/api/v1/customers/${customer.id}/contacts`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `contact-${uuid()}` },
      body: JSON.stringify({ first_name: 'Alice', last_name: 'Martin', email: 'alice@example.test' }),
    });
    await expectContract(response, { status: 201, dataSchema: 'CustomerContact' });
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(Object.keys(body.data).sort()).toEqual(
      [
        'created_at',
        'customer_id',
        'email',
        'first_name',
        'id',
        'is_primary',
        'last_name',
        'phone',
        'role',
        'updated_at',
      ].sort(),
    );
  });

  it('CA3 — verifie le SIRET d un client entreprise (bouchon INSEE, mocked: true)', async () => {
    const { data: customer } = await createCompany();
    const response = await call(`/api/v1/customers/${customer.id}/siret-verifications`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `verify-${uuid()}` },
    });
    await expectContract(response, { status: 201, dataSchema: 'SiretVerificationResult' });
    const body = (await response.json()) as { data: { verified: boolean; mocked: boolean } };
    expect(body.data.verified).toBe(true);
    expect(body.data.mocked).toBe(true);

    const detail = await call(`/api/v1/customers/${customer.id}`, { headers: asUser });
    const detailBody = (await detail.json()) as { data: CustomerDetailDto };
    expect(detailBody.data.siret_verified).toBe(true);
  });

  it('CA3 — verifier le SIRET d un client particulier est refuse', async () => {
    const created = await call('/api/v1/customers', {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `create-${uuid()}` },
      body: JSON.stringify({ type: 'individual', civility: 'mr', first_name: 'Jean', last_name: 'Dupont' }),
    });
    const { data: customer } = (await created.json()) as { data: CustomerDto };

    const response = await call(`/api/v1/customers/${customer.id}/siret-verifications`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `verify-${uuid()}` },
    });
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('customer.not_a_company');
  });

  it('CA8 — Studio (cle de service, scope customers:read) peut lire mais pas ecrire', async () => {
    const { data: customer } = await createCompany();

    const readable = await call(`/api/v1/customers/${customer.id}`, {
      headers: { 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(readable, { status: 200, dataSchema: 'CustomerDetail' });

    const writeAttempt = await call('/api/v1/customers', {
      method: 'POST',
      headers: {
        'X-Magrit-Service-Key': 'cle-studio',
        'Content-Type': 'application/json',
        'Idempotency-Key': `create-${uuid()}`,
      },
      body: JSON.stringify({ type: 'individual', first_name: 'X', last_name: 'Y' }),
    });
    // authentication: 'user' sur createCustomer -> refuse toute cle de service.
    await expectContract(writeAttempt, { status: 403 });
  });

  it('CA8 — une cle de service sans le scope customers:read recoit 403', async () => {
    const response = await call('/api/v1/customers', {
      headers: { 'X-Magrit-Service-Key': 'cle-studio-sans-scope' },
    });
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.scope_required');
  });
});
