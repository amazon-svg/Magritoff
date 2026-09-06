/**
 * Module Devis du portail client contre le contrat (story E10.10b-1).
 *
 * Exerce reellement `createStorefrontQuotesRoutes()` via
 * `createGescomApiHandler`, avec un `StorefrontQuotesRepository` en memoire
 * (aucune dependance a Supabase) et un `PrincipalVerifier` qui reproduit le
 * comportement du vrai `SupabaseApiPrincipalVerifier` pour le troisieme mode
 * d authentification : une session boutique valide resout un
 * `ShopCustomerPrincipal`, tout le reste rend `null` (401).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { StorefrontQuotesService } from '@/modules/storefront-quotes/application/storefront-quotes-service';
import type {
  ListStorefrontQuotesCriteria,
  StorefrontQuotesRepository,
} from '@/modules/storefront-quotes/application/storefront-quotes-repository';
import type { StorefrontQuoteDetailDto, StorefrontQuoteDto } from '@/modules/storefront-quotes/api/contracts';
import { createStorefrontQuotesRoutes } from '@/server/api/storefront-quotes-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkAgainstSchema, checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9012');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e6f');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });

/** Jeton de session valide au format attendu (`^[A-Za-z0-9_-]{32,512}$`). */
const VALID_TOKEN = 'a'.repeat(40);
const OTHER_ACCOUNT_TOKEN = 'b'.repeat(40);
/** Compte sans interlocuteur rattache (E10.5 CA3) : customerId null. */
const NO_CONTACT_TOKEN = 'c'.repeat(40);

const shopCustomerPrincipal: ApiPrincipal = Object.freeze({
  kind: 'shop_customer',
  accountId: 'account-1',
  shopId: 'shop-1',
  tenantId: TENANT,
  customerId: 'customer-1',
  sessionKind: 'direct',
  sessionToken: VALID_TOKEN,
});

const otherAccountPrincipal: ApiPrincipal = Object.freeze({
  kind: 'shop_customer',
  accountId: 'account-2',
  shopId: 'shop-1',
  tenantId: TENANT,
  customerId: 'customer-2',
  sessionKind: 'direct',
  sessionToken: OTHER_ACCOUNT_TOKEN,
});

const noContactPrincipal: ApiPrincipal = Object.freeze({
  kind: 'shop_customer',
  accountId: 'account-3',
  shopId: 'shop-1',
  tenantId: TENANT,
  customerId: null,
  sessionKind: 'direct',
  sessionToken: NO_CONTACT_TOKEN,
});

const servicePrincipal: ApiPrincipal = Object.freeze({
  kind: 'service',
  serviceId: 'studio',
  tenantId: TENANT,
  scopes: Object.freeze([]),
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') {
      return credential.token === 'jeton-valide' ? userPrincipal : null;
    }
    if (credential.kind === 'cookie') {
      if (credential.token === VALID_TOKEN) return shopCustomerPrincipal;
      if (credential.token === OTHER_ACCOUNT_TOKEN) return otherAccountPrincipal;
      if (credential.token === NO_CONTACT_TOKEN) return noContactPrincipal;
      return null;
    }
    return credential.key === 'cle-studio' ? servicePrincipal : null;
  },
};

const QUOTE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_QUOTE_ID = '22222222-2222-4222-8222-222222222222';

const quoteSummary: StorefrontQuoteDto = Object.freeze({
  id: QUOTE_ID,
  number: 'DEV-2026-00042',
  status: 'sent',
  issued_at: '2026-09-01T10:00:00.000Z',
  valid_until: '2026-12-31',
  expired: false,
  totals: Object.freeze({
    lines_subtotal: '1000.00',
    global_discount: '50.00',
    effective_discount_rate: '0.0500',
    net_total: '950.00',
    vat_rate: '0.2000',
    vat_regime: 'metropole_fr',
    vat_amount: '190.00',
    total_incl_tax: '1140.00',
  }),
});

const quoteDetail: StorefrontQuoteDetailDto = Object.freeze({
  ...quoteSummary,
  lines: [
    Object.freeze({
      id: '33333333-3333-4333-8333-333333333333',
      label: 'Flyers A5',
      product_config: { format: 'A5' },
      quantity: 500,
      position: 0,
      price_before_discount: '1000.00',
      discount_rate: '0.0500',
      price: '950.00',
    }),
  ],
});

/**
 * Reproduit fidelement ce que la fonction SQL `api_list_storefront_quotes`
 * garantit (E10.10b-1) : SEUL le compte titulaire du token voit `quoteSummary`,
 * jamais un autre compte meme du meme tenant ; un compte sans interlocuteur
 * (customerId null) ne voit jamais rien.
 */
class InMemoryStorefrontQuotesRepository implements StorefrontQuotesRepository {
  async list(
    sessionToken: string,
    _criteria: ListStorefrontQuotesCriteria,
  ): Promise<readonly StorefrontQuoteDto[]> {
    if (sessionToken === VALID_TOKEN) return [quoteSummary];
    return [];
  }

  async findById(sessionToken: string, quoteId: string): Promise<StorefrontQuoteDetailDto | null> {
    if (sessionToken === VALID_TOKEN && quoteId === QUOTE_ID) return quoteDetail;
    // Indiscernable : token valide mais quoteId d un autre client, token d un
    // autre compte, token sans interlocuteur -> null dans tous les cas.
    return null;
  }
}

let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  handler = createGescomApiHandler({
    routes: createStorefrontQuotesRoutes(new StorefrontQuotesService(new InMemoryStorefrontQuotesRepository())),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-10b-1',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asShopCustomer = (token: string) => ({ Cookie: `magrit-storefront=${token}` });
const asUser = { Authorization: 'Bearer jeton-valide' };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

describe('GET /storefront-quotes (listStorefrontQuotes)', () => {
  it('200 — un compte avec interlocuteur voit ses devis sent/accepted/rejected/converted', async () => {
    const response = await call('/api/v1/storefront-quotes', { headers: asShopCustomer(VALID_TOKEN) });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: unknown[] };
    expect(body.data).toEqual([quoteSummary]);
    expect(checkAgainstSchema('StorefrontQuote', body.data[0]).errors).toEqual([]);
  });

  it('200 — CA7 : un compte SANS interlocuteur recoit une liste vide, pas 403', async () => {
    const response = await call('/api/v1/storefront-quotes', { headers: asShopCustomer(NO_CONTACT_TOKEN) });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it('200 — un compte du meme tenant mais different ne voit jamais les devis d un autre client', async () => {
    const response = await call('/api/v1/storefront-quotes', {
      headers: asShopCustomer(OTHER_ACCOUNT_TOKEN),
    });
    await expectContract(response, { status: 200 });
    const body = (await response.json()) as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it('401 — aucune credential fournie', async () => {
    const response = await call('/api/v1/storefront-quotes');
    await expectContract(response, { status: 401 });
  });

  it("403 identity.actor_kind_required — un jeton utilisateur Magrit atteint l operation, /quotes est la ressource atelier", async () => {
    const response = await call('/api/v1/storefront-quotes', { headers: asUser });
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it('400 api.tenant_not_addressable — X-Magrit-Tenant fourni sur une session boutique est REFUSE, pas ignore', async () => {
    const response = await call('/api/v1/storefront-quotes', {
      headers: { ...asShopCustomer(VALID_TOKEN), 'X-Magrit-Tenant': TENANT },
    });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.tenant_not_addressable');
  });

  it('400 identity.actor_kind_required — cookie ET Bearer presentes ensemble sont un cumul ambigu, refuse', async () => {
    const response = await call('/api/v1/storefront-quotes', {
      headers: { ...asShopCustomer(VALID_TOKEN), ...asUser },
    });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it('400 identity.actor_kind_required — cookie ET cle de service presentees ensemble sont un cumul ambigu, refuse (CA9, reserve non bloquante)', async () => {
    // Meme regle que cookie+Bearer ci-dessus (§3.6 branche 2), mais avec la
    // credential explicite qui n avait pas encore de cas de test dedie sur
    // une operation storefrontSession.
    const response = await call('/api/v1/storefront-quotes', {
      headers: { ...asShopCustomer(VALID_TOKEN), 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it('filtre status : une valeur hors enumeration (dont "draft") est traitee comme absente de filtre, jamais une erreur', async () => {
    const draft = await call('/api/v1/storefront-quotes?status=draft', {
      headers: asShopCustomer(VALID_TOKEN),
    });
    await expectContract(draft, { status: 200 });
    expect(((await draft.json()) as { data: unknown[] }).data).toEqual([quoteSummary]);
  });
});

describe('GET /storefront-quotes/{quoteId} (getStorefrontQuote)', () => {
  it('200 — devis visible, ETag publie', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_ID}`, {
      headers: asShopCustomer(VALID_TOKEN),
    });
    await expectContract(response, { status: 200, dataSchema: 'StorefrontQuoteDetail' });
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
    const body = (await response.json()) as { data: unknown };
    expect(body.data).toEqual(quoteDetail);
  });

  it.each([
    ['identifiant inconnu', OTHER_QUOTE_ID, VALID_TOKEN],
    ["devis d un autre client (jamais distingue de l'inconnu)", QUOTE_ID, OTHER_ACCOUNT_TOKEN],
    ['compte sans interlocuteur (jamais distingue)', QUOTE_ID, NO_CONTACT_TOKEN],
  ])('404 quote.not_found INDISCERNABLE — %s', async (_label, quoteId, token) => {
    const response = await call(`/api/v1/storefront-quotes/${quoteId}`, {
      headers: asShopCustomer(token),
    });
    await expectContract(response, { status: 404 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.not_found');
  });

  it('401 — aucune credential fournie', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_ID}`);
    await expectContract(response, { status: 401 });
  });

  it('403 identity.actor_kind_required — une cle de service atteint l operation', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_ID}`, {
      headers: { 'X-Magrit-Service-Key': 'cle-studio' },
    });
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it('400 api.tenant_not_addressable — meme refus que sur la liste', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_ID}`, {
      headers: { ...asShopCustomer(VALID_TOKEN), 'X-Magrit-Tenant': TENANT },
    });
    await expectContract(response, { status: 400 });
    expect(((await response.json()) as { code: string }).code).toBe('api.tenant_not_addressable');
  });
});
