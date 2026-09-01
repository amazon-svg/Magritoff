/**
 * Ouverture/revocation d un acces boutique depuis un interlocuteur (E10.5)
 * contre le contrat.
 *
 * Exerce reellement `createCustomerShopAccessRoutes()` + `createCustomersRoutes()`
 * via `createGescomApiHandler`, avec des repositories en memoire (aucune
 * dependance a Supabase). Le faux `CustomersRepository` est etendu pour
 * REFLETER la relation `shop_customer_accounts.customer_contact_id` (embed
 * PostgREST reel) plutot que de la court-circuiter : sans ca, le test ne
 * prouverait rien de CA3/CA4, seulement que l endpoint repond 201.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type OutboxEvent,
  type OutboxRepository,
  OutboxPublisher,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { CustomersService } from '@/modules/customers/application/customers-service';
import type { CustomerContactDto, CustomerDetailDto, CustomerDto } from '@/modules/customers/api/contracts';
import { createCustomersRoutes } from '@/server/api/customers-routes';
import { createCustomerShopAccessRoutes } from '@/server/api/customer-shop-access-routes';
import { createGescomApiHandler } from '@/server/api';
import { ShopCustomersService } from '@/modules/shop-customers/application/shop-customers-service';
import {
  ShopCustomerRejectedError,
  type CreateShopCustomerRecord,
  type ShopCustomersRepository,
} from '@/modules/shop-customers/application/shop-customers-repository';
import { StorefrontActivationService, type StorefrontActivationGateway, type StorefrontActivationIssue } from '@/modules/shop-customers/application/storefront-activation-service';
import type { StorefrontActivationEmailSender } from '@/modules/shop-customers/application/storefront-activation-email-sender';
import { CustomerContactShopAccessService } from '@/modules/shop-customers/application/customer-contact-shop-access-service';
import type { ShopCustomerAccount } from '@/modules/shop-customers/api/contracts';
import { checkResponseAgainstContract } from './_harness.ts';
import { InMemoryCustomersRepository, fakeUuid } from './_fakes/customers-repository.fake.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');
const SHOP_1 = '00000000-0000-4000-a000-000000000001';
const SHOP_2 = '00000000-0000-4000-a000-000000000002';

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer' && credential.token === 'jeton-valide') return userPrincipal;
    return null;
  },
};

/**
 * Etend le faux Clients (E10.4) pour REFLETER la relation inverse
 * `shop_customer_accounts.customer_contact_id`, exactement comme le fait
 * l embed PostgREST de l adaptateur Supabase reel
 * (`SHOP_ACCESS_EMBED` dans `src/adapters/supabase/customers-repository.ts`).
 */
class CustomersRepositoryWithShopAccess extends InMemoryCustomersRepository {
  constructor(private readonly shopAccounts: Map<string, ShopCustomerAccount>) {
    super();
  }

  async findContactById(
    tenantId: TenantId,
    customerId: string,
    contactId: string,
  ): Promise<CustomerContactDto | null> {
    const base = await super.findContactById(tenantId, customerId, contactId);
    return base ? { ...base, shop_accesses: this.accessesFor(contactId) } : base;
  }

  async listContacts(tenantId: TenantId, customerId: string): Promise<readonly CustomerContactDto[]> {
    const base = await super.listContacts(tenantId, customerId);
    return base.map((contact) => ({ ...contact, shop_accesses: this.accessesFor(contact.id) }));
  }

  private accessesFor(contactId: string): { shop_id: string; status: 'invited' | 'active' }[] {
    return [...this.shopAccounts.values()]
      .filter((account) => account.customerContactId === contactId)
      .filter((account): account is ShopCustomerAccount & { status: 'invited' | 'active' } =>
        account.status === 'invited' || account.status === 'active',
      )
      .map((account) => ({ shop_id: account.shopId, status: account.status }));
  }
}

/** Faux `ShopCustomersRepository` en memoire, fidele aux contraintes E10.5. */
class InMemoryShopCustomersRepository implements ShopCustomersRepository {
  constructor(
    private readonly accounts: Map<string, ShopCustomerAccount>,
    private readonly shopTenants: ReadonlyMap<string, string>,
  ) {}

  async migrationReport() {
    return [];
  }

  async list() {
    return [];
  }

  async findByNormalizedEmail(
    _actor: UserId,
    tenantId: string,
    shopId: string,
    normalizedEmail: string,
  ): Promise<ShopCustomerAccount | null> {
    this.requireShop(tenantId, shopId);
    return (
      [...this.accounts.values()].find(
        (account) => account.shopId === shopId && account.normalizedEmail === normalizedEmail,
      ) ?? null
    );
  }

  async create(
    _actor: UserId,
    tenantId: string,
    shopId: string,
    record: CreateShopCustomerRecord,
  ): Promise<ShopCustomerAccount> {
    this.requireShop(tenantId, shopId);
    // Reproduit `shop_customer_accounts_shop_email_unique`.
    const dupeEmail = [...this.accounts.values()].some(
      (account) => account.shopId === shopId && account.normalizedEmail === record.normalizedEmail,
    );
    if (dupeEmail) {
      throw new ShopCustomerRejectedError('duplicate_email', 'Un compte existe deja pour cet email dans cette boutique.');
    }
    // Reproduit `shop_customer_accounts_shop_contact_uidx` (CA3).
    if (record.customerContactId) {
      const dupeContact = [...this.accounts.values()].some(
        (account) => account.shopId === shopId && account.customerContactId === record.customerContactId,
      );
      if (dupeContact) {
        throw new ShopCustomerRejectedError('invalid_request', 'Un acces existe deja pour cet interlocuteur dans cette boutique.');
      }
    }
    const now = new Date().toISOString();
    const account: ShopCustomerAccount = {
      id: fakeUuid(),
      shopId,
      email: record.email,
      normalizedEmail: record.normalizedEmail,
      fullName: record.fullName,
      authSubjectId: null,
      status: record.status,
      createdByMagritUserId: record.createdByMagritUserId,
      customerContactId: record.customerContactId ?? null,
      createdAt: now,
      activatedAt: null,
      suspendedAt: null,
    };
    this.accounts.set(account.id, account);
    return account;
  }

  async ensureSelf(): Promise<never> {
    throw new Error('ensureSelf non exerce par ce fixture E10.5');
  }

  async findByCustomerContactId(
    _actor: UserId,
    tenantId: string,
    shopId: string,
    customerContactId: string,
  ): Promise<ShopCustomerAccount | null> {
    this.requireShop(tenantId, shopId);
    return (
      [...this.accounts.values()].find(
        (account) => account.shopId === shopId && account.customerContactId === customerContactId,
      ) ?? null
    );
  }

  async listByCustomerContactId(_actor: UserId, customerContactId: string): Promise<ShopCustomerAccount[]> {
    return [...this.accounts.values()].filter((account) => account.customerContactId === customerContactId);
  }

  async linkCustomerContact(
    _actor: UserId,
    accountId: string,
    customerContactId: string,
  ): Promise<ShopCustomerAccount> {
    const account = this.accounts.get(accountId);
    if (!account) throw new ShopCustomerRejectedError('account_not_found', 'Compte boutique introuvable.');
    // Reproduit la reactivation de l adaptateur Supabase (voir commentaire
    // `linkCustomerContact` reel) : un compte suspendu redevient invitable.
    const updated: ShopCustomerAccount = {
      ...account,
      customerContactId,
      ...(account.status !== 'active' ? { status: 'invited' as const, suspendedAt: null } : {}),
    };
    this.accounts.set(accountId, updated);
    return updated;
  }

  async revokeCustomerContactAccess(
    _actor: UserId,
    tenantId: string,
    shopId: string,
    customerContactId: string,
  ): Promise<void> {
    this.requireShop(tenantId, shopId);
    const found = [...this.accounts.entries()].find(
      ([, account]) => account.shopId === shopId && account.customerContactId === customerContactId,
    );
    if (!found) {
      throw new ShopCustomerRejectedError('account_not_found', 'Aucun acces boutique ouvert pour cet interlocuteur.');
    }
    const [id, account] = found;
    this.accounts.set(id, {
      ...account,
      customerContactId: null,
      status: 'suspended',
      suspendedAt: new Date().toISOString(),
    });
  }

  private requireShop(tenantId: string, shopId: string): void {
    if (this.shopTenants.get(shopId) !== tenantId) {
      throw new ShopCustomerRejectedError('shop_not_found', 'Boutique introuvable dans cet espace.');
    }
  }
}

class FakeActivationGateway implements StorefrontActivationGateway {
  constructor(private readonly accounts: Map<string, ShopCustomerAccount>) {}

  async issue(
    _actorId: string,
    _tenantId: string,
    shopId: string,
    accountId: string,
  ): Promise<StorefrontActivationIssue | null> {
    const account = this.accounts.get(accountId);
    // Le gateway reel refuse d emettre un lien pour un compte deja `active`
    // ou `suspended` — seuls `delegated_only`/`invited` sont activables.
    if (!account || (account.status !== 'delegated_only' && account.status !== 'invited')) return null;
    return {
      token: `token-${accountId}`,
      customerEmail: account.email,
      customerName: account.fullName,
      shopName: 'Boutique Test',
      shopSlug: shopId === SHOP_1 ? 'boutique-un' : 'boutique-deux',
    };
  }

  async activate(): Promise<never> {
    throw new Error('activate non exerce par ce fixture E10.5');
  }
}

const fakeEmailSender: StorefrontActivationEmailSender = {
  async send() {
    return { sent: true };
  },
};

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

let shopAccounts: Map<string, ShopCustomerAccount>;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  shopAccounts = new Map();
  const customersRepository = new CustomersRepositoryWithShopAccess(shopAccounts);
  const shopTenants = new Map([
    [SHOP_1, TENANT as string],
    [SHOP_2, TENANT as string],
  ]);
  const shopCustomersRepository = new InMemoryShopCustomersRepository(shopAccounts, shopTenants);

  const outbox = new OutboxPublisher({
    repository: new InMemoryOutboxRepository(),
    now: () => new Date('2026-09-01T10:00:00.000Z'),
    newEventId: () => fakeUuid(),
  });
  const customersService = new CustomersService({ repository: customersRepository, outbox });
  const shopCustomersService = new ShopCustomersService(shopCustomersRepository);
  const activationService = new StorefrontActivationService(new FakeActivationGateway(shopAccounts), fakeEmailSender);
  const shopAccessService = new CustomerContactShopAccessService(shopCustomersService, activationService);

  handler = createGescomApiHandler({
    routes: [
      ...createCustomersRoutes(customersService),
      ...createCustomerShopAccessRoutes(customersService, shopAccessService),
    ],
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-5',
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

async function createCompanyWithContact(email = 'contact@example.test') {
  const customerResponse = await call('/api/v1/customers', {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `create-${fakeUuid()}` },
    body: JSON.stringify({ type: 'company', company_name: 'Imprimerie E10.5', siret: '73282932000074' }),
  });
  const { data: customer } = (await customerResponse.json()) as { data: CustomerDto };

  const contactResponse = await call(`/api/v1/customers/${customer.id}/contacts`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': `contact-${fakeUuid()}` },
    body: JSON.stringify({ first_name: 'Alice', last_name: 'Martin', email }),
  });
  const { data: contact } = (await contactResponse.json()) as { data: CustomerContactDto };

  return { customer, contact };
}

async function getContact(customerId: string, contactId: string): Promise<CustomerContactDto> {
  const response = await call(`/api/v1/customers/${customerId}/contacts/${contactId}`, { headers: asUser });
  const body = (await response.json()) as { data: CustomerContactDto };
  return body.data;
}

describe('ouverture/revocation d un acces boutique depuis un interlocuteur (E10.5) contre le contrat', () => {
  it('CA2 — un interlocuteur fraichement cree ne porte encore aucun acces boutique', async () => {
    const { contact } = await createCompanyWithContact();
    expect(contact.shop_accesses).toEqual([]);
  });

  it('CA3 — ouvre un acces boutique explicite, distinct de la creation de l interlocuteur', async () => {
    const { customer, contact } = await createCompanyWithContact();

    const response = await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });
    await expectContract(response, { status: 201, dataSchema: 'CustomerContactShopAccess' });
    const body = (await response.json()) as { data: { shop_id: string; status: string } };
    expect(body.data).toEqual({ shop_id: SHOP_1, status: 'invited' });

    // Le compte cree porte bien `customer_contact_id` (verifie via la lecture
    // du contact, pas seulement via la reponse du POST).
    const refreshed = await getContact(customer.id, contact.id);
    expect(refreshed.shop_accesses).toEqual([{ shop_id: SHOP_1, status: 'invited' }]);
  });

  it('CA3 — un second acces pour LE MEME interlocuteur, DANS LA MEME boutique, est refuse (409)', async () => {
    const { customer, contact } = await createCompanyWithContact();
    await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });

    const response = await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });
    await expectContract(response, { status: 409 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('customer_contact.shop_access_already_open');
  });

  it('CA3 — controle positif : le MEME interlocuteur peut ouvrir un acces dans une AUTRE boutique', async () => {
    const { customer, contact } = await createCompanyWithContact();
    await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });

    const response = await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_2 }),
    });
    await expectContract(response, { status: 201, dataSchema: 'CustomerContactShopAccess' });

    const refreshed = await getContact(customer.id, contact.id);
    expect(refreshed.shop_accesses.map((a) => a.shop_id).sort()).toEqual([SHOP_1, SHOP_2].sort());
  });

  it('CA3 — un email deja utilise par le compte boutique d un AUTRE interlocuteur, dans la meme boutique, est refuse', async () => {
    const email = 'meme.email@example.test';
    const first = await createCompanyWithContact(email);
    await call(`/api/v1/customers/${first.customer.id}/contacts/${first.contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });

    const second = await createCompanyWithContact(email);
    const response = await call(`/api/v1/customers/${second.customer.id}/contacts/${second.contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });
    await expectContract(response, { status: 409 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('customer_contact.shop_access_email_conflict');
  });

  it('CA3 — revoque l acces : l interlocuteur redevient sans compte boutique (badge "none")', async () => {
    const { customer, contact } = await createCompanyWithContact();
    await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });

    const response = await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: { revoked: boolean } };
    expect(body.data).toEqual({ revoked: true });

    const refreshed = await getContact(customer.id, contact.id);
    expect(refreshed.shop_accesses).toEqual([]);
  });

  it('CA3 — apres revocation, un nouvel acces peut etre reouvert pour le meme interlocuteur/boutique', async () => {
    const { customer, contact } = await createCompanyWithContact();
    await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });
    await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });

    const response = await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });
    await expectContract(response, { status: 201, dataSchema: 'CustomerContactShopAccess' });
  });

  it('revoquer un acces qui n existe pas rend 404', async () => {
    const { customer, contact } = await createCompanyWithContact();

    const response = await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });
    await expectContract(response, { status: 404 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('customer_contact.shop_access_not_open');
  });

  it('ouvrir un acces pour un interlocuteur inconnu du tenant rend 404', async () => {
    const response = await call(
      `/api/v1/customers/${fakeUuid()}/contacts/${fakeUuid()}/shop-access`,
      {
        method: 'POST',
        headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
        body: JSON.stringify({ shop_id: SHOP_1 }),
      },
    );
    await expectContract(response, { status: 404 });
  });

  it('CA1 — l ecran Utilisateurs (facade membres) ne referme aucune donnee d interlocuteur (verification de forme du contrat)', async () => {
    // CustomerContactShopAccess n existe QUE sous /customers/.../contacts/...,
    // jamais sous /tenants/{tenantId}/members : verifie que le contrat ne
    // declare pas un tel chemin croise (garde documentaire contre une future
    // confusion des deux facades).
    const contract = await import('./_harness.ts').then((m) => m.loadContract());
    const paths = Object.keys((contract as { paths: Record<string, unknown> }).paths);
    expect(paths.some((p) => p.includes('/members') && p.includes('shop-access'))).toBe(false);
  });
});

describe('CustomerDetail expose aussi shop_accesses par interlocuteur', () => {
  it('la fiche client detaillee reflete l acces ouvert', async () => {
    const { customer, contact } = await createCompanyWithContact();
    await call(`/api/v1/customers/${customer.id}/contacts/${contact.id}/shop-access`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': `shop-access-${fakeUuid()}` },
      body: JSON.stringify({ shop_id: SHOP_1 }),
    });

    const detailResponse = await call(`/api/v1/customers/${customer.id}`, { headers: asUser });
    await expectContract(detailResponse, { status: 200, dataSchema: 'CustomerDetail' });
    const body = (await detailResponse.json()) as { data: CustomerDetailDto };
    expect(body.data.contacts[0]?.shop_accesses).toEqual([{ shop_id: SHOP_1, status: 'invited' }]);
  });
});
