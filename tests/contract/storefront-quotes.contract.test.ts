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
  OutboxPublisher,
  type ApiPrincipal,
  type OutboxEvent,
  type OutboxRepository,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { StorefrontQuotesService } from '@/modules/storefront-quotes/application/storefront-quotes-service';
import {
  StorefrontQuoteDecisionExpiredError,
  StorefrontQuoteDecisionForbiddenStatusError,
  type ListStorefrontQuotesCriteria,
  type StorefrontQuoteDecisionResult,
  type StorefrontQuotesRepository,
} from '@/modules/storefront-quotes/application/storefront-quotes-repository';
import type {
  StorefrontQuoteDecision,
  StorefrontQuoteDetailDto,
  StorefrontQuoteDto,
} from '@/modules/storefront-quotes/api/contracts';
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
/** E10.10b-2 — session DELEGUEE du meme compte que VALID_TOKEN. */
const DELEGATED_TOKEN = 'd'.repeat(40);

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

/**
 * E10.10b-2 — MEME compte que `shopCustomerPrincipal` (`account-1`), mais
 * `sessionKind: 'delegated'` : un membre Magrit qui depanne ce client voit
 * les memes devis (lecture inchangee) mais ne peut ni accepter ni refuser
 * (contrat §8.13quinquies, confirme §8.13 point 7).
 */
const delegatedPrincipal: ApiPrincipal = Object.freeze({
  kind: 'shop_customer',
  accountId: 'account-1',
  shopId: 'shop-1',
  tenantId: TENANT,
  customerId: 'customer-1',
  sessionKind: 'delegated',
  sessionToken: DELEGATED_TOKEN,
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
      if (credential.token === DELEGATED_TOKEN) return delegatedPrincipal;
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

// ---------------------------------------------------------------------------
// E10.10b-2 — fixtures DEDIEES a la decision, toutes possedees par le compte
// `VALID_TOKEN` (sauf A2_QUOTE_ID, du compte OTHER_ACCOUNT_TOKEN, utilise
// pour la reserve d idempotence §8.13quinquies). `findById`/`decide` les
// servent, `list` reste INCHANGE (toujours `[quoteSummary]` pour VALID_TOKEN)
// pour ne pas casser les deux tests de liste deja verts (E10.10b-1).
// ---------------------------------------------------------------------------

const REJECT_QUOTE_ID = '44444444-4444-4444-8444-444444444444';
const ALREADY_DECIDED_QUOTE_ID = '55555555-5555-4555-8555-555555555555';
const EXPIRED_QUOTE_ID = '66666666-6666-4666-8666-666666666666';
const A2_QUOTE_ID = '77777777-7777-4777-8777-777777777777';

function detailOf(id: string, patch: Readonly<Partial<StorefrontQuoteDetailDto>> = {}): StorefrontQuoteDetailDto {
  return Object.freeze({ ...quoteDetail, id, ...patch });
}

const rejectQuoteDetail = detailOf(REJECT_QUOTE_ID);
const alreadyDecidedQuoteDetail = detailOf(ALREADY_DECIDED_QUOTE_ID, { status: 'accepted' });
const expiredQuoteDetail = detailOf(EXPIRED_QUOTE_ID, { expired: true, valid_until: '2020-01-01' });
const a2QuoteDetail = detailOf(A2_QUOTE_ID);

/**
 * Reproduit fidelement ce que les fonctions SQL `api_list_storefront_quotes`/
 * `api_get_storefront_quote`/`api_decide_storefront_quote` garantissent
 * (E10.10b-1, E10.10b-2) : SEUL le compte titulaire du token voit un devis,
 * jamais un autre compte meme du meme tenant ; un compte sans interlocuteur
 * (customerId null) ne voit jamais rien ; `decide` REFUSE un devis pas `sent`
 * (`quote.decision_forbidden_status`) ou perime (`quote.decision_expired`),
 * jamais la session DELEGUEE — verifiee par la ROUTE, en amont, sur
 * `principal.sessionKind`, jamais ici (§8.13quinquies, ordre des refus).
 */
class InMemoryStorefrontQuotesRepository implements StorefrontQuotesRepository {
  private readonly quotes = new Map<string, StorefrontQuoteDetailDto>([
    [QUOTE_ID, quoteDetail],
    [REJECT_QUOTE_ID, rejectQuoteDetail],
    [ALREADY_DECIDED_QUOTE_ID, alreadyDecidedQuoteDetail],
    [EXPIRED_QUOTE_ID, expiredQuoteDetail],
    [A2_QUOTE_ID, a2QuoteDetail],
  ]);

  private readonly owners = new Map<string, string>([
    [QUOTE_ID, VALID_TOKEN],
    [REJECT_QUOTE_ID, VALID_TOKEN],
    [ALREADY_DECIDED_QUOTE_ID, VALID_TOKEN],
    [EXPIRED_QUOTE_ID, VALID_TOKEN],
    [A2_QUOTE_ID, OTHER_ACCOUNT_TOKEN],
  ]);

  /** `customer_id` NE FAIT PARTIE d AUCUNE representation client — necessaire uniquement a `decide()` pour l evenement sortant. */
  private readonly quoteCustomerIds = new Map<string, string>([
    [QUOTE_ID, 'customer-1'],
    [REJECT_QUOTE_ID, 'customer-1'],
    [ALREADY_DECIDED_QUOTE_ID, 'customer-1'],
    [EXPIRED_QUOTE_ID, 'customer-1'],
    [A2_QUOTE_ID, 'customer-2'],
  ]);

  /**
   * `DELEGATED_TOKEN` designe le MEME compte/interlocuteur que `VALID_TOKEN`
   * (contrat E10.10b-1, point 7 : "session deleguee, lecture autorisee,
   * representation identique") — seul `sessionKind` differe, verifie par la
   * ROUTE sur le `principal`, jamais ici. Normalise l identite AVANT de
   * comparer au proprietaire, exactement ce que fait
   * `api_resolve_shop_customer_session` cote base (les deux jetons resolvent
   * le meme `account_id`).
   */
  private ownerIdentityOf(sessionToken: string): string {
    return sessionToken === DELEGATED_TOKEN ? VALID_TOKEN : sessionToken;
  }

  async list(
    sessionToken: string,
    _criteria: ListStorefrontQuotesCriteria,
  ): Promise<readonly StorefrontQuoteDto[]> {
    if (sessionToken === VALID_TOKEN) return [quoteSummary];
    return [];
  }

  async findById(sessionToken: string, quoteId: string): Promise<StorefrontQuoteDetailDto | null> {
    // Indiscernable : token valide mais quoteId d un autre client, token d un
    // autre compte, token sans interlocuteur -> null dans tous les cas.
    if (this.owners.get(quoteId) !== this.ownerIdentityOf(sessionToken)) return null;
    return this.quotes.get(quoteId) ?? null;
  }

  async decide(
    sessionToken: string,
    quoteId: string,
    decision: StorefrontQuoteDecision,
  ): Promise<StorefrontQuoteDecisionResult | null> {
    if (this.owners.get(quoteId) !== this.ownerIdentityOf(sessionToken)) return null;
    const current = this.quotes.get(quoteId);
    if (!current) return null;
    if (current.status !== 'sent') throw new StorefrontQuoteDecisionForbiddenStatusError();
    if (current.expired) throw new StorefrontQuoteDecisionExpiredError();

    const updated = detailOf(quoteId, { status: decision });
    this.quotes.set(quoteId, updated);
    return { detail: updated, customerId: this.quoteCustomerIds.get(quoteId) ?? 'customer-unknown' };
  }
}

class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEvent[] = [];
  async append(events: readonly OutboxEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

let handler: (request: Request) => Promise<Response>;
let outboxRepository: InMemoryOutboxRepository;

beforeEach(() => {
  outboxRepository = new InMemoryOutboxRepository();
  const outbox = new OutboxPublisher({
    repository: outboxRepository,
    now: () => new Date('2026-09-07T10:00:00.000Z'),
    newEventId: () => `00000000-0000-4000-8000-${String(outboxRepository.events.length).padStart(12, '0')}`,
  });
  handler = createGescomApiHandler({
    routes: createStorefrontQuotesRoutes(
      new StorefrontQuotesService({ repository: new InMemoryStorefrontQuotesRepository(), outbox }),
    ),
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

// ---------------------------------------------------------------------------
// E10.10b-2 — POST /storefront-quotes/{quoteId}/decisions (decideStorefrontQuote).
// ---------------------------------------------------------------------------
const jsonHeaders = { 'Content-Type': 'application/json' };

async function getEtag(quoteId: string, token: string): Promise<string> {
  const response = await call(`/api/v1/storefront-quotes/${quoteId}`, { headers: asShopCustomer(token) });
  const etag = response.headers.get('etag');
  if (!etag) throw new Error(`ETag manquant pour ${quoteId} (fixture de test invalide)`);
  return etag;
}

function decide(
  quoteId: string,
  token: string,
  body: Readonly<Record<string, unknown>>,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<Response> {
  return call(`/api/v1/storefront-quotes/${quoteId}/decisions`, {
    method: 'POST',
    headers: { ...asShopCustomer(token), ...jsonHeaders, ...extraHeaders },
    body: JSON.stringify(body),
  });
}

describe('POST /storefront-quotes/{quoteId}/decisions (decideStorefrontQuote)', () => {
  it('201 — ACCEPTE un devis sent, ETag publie, StorefrontQuoteDetail rendu (jamais QuoteDetail)', async () => {
    const etag = await getEtag(QUOTE_ID, VALID_TOKEN);
    const response = await decide(
      QUOTE_ID,
      VALID_TOKEN,
      { decision: 'accepted' },
      { 'Idempotency-Key': 'decision-accept-key-001', 'If-Match': etag },
    );
    await expectContract(response, { status: 201, dataSchema: 'StorefrontQuoteDetail' });
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
    const body = (await response.json()) as { data: { status: string } };
    expect(body.data.status).toBe('accepted');

    // Evenement sortant ECRIT (contrat, decision #6) — customer_id transite
    // dans l EVENEMENT (systeme tiers), JAMAIS dans la representation client
    // ci-dessus (`body.data` ne porte pas customer_id, verifie par le schema).
    const events = outboxRepository.events.filter((event) => event.name === 'quote.accepted');
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toEqual({ quote_id: QUOTE_ID, customer_id: 'customer-1', number: quoteDetail.number });
    expect(events[0]?.aggregateType).toBe('quote');
    expect(events[0]?.aggregateId).toBe(QUOTE_ID);
  });

  it('201 — REFUSE un devis sent, symetrique exact', async () => {
    const etag = await getEtag(REJECT_QUOTE_ID, VALID_TOKEN);
    const response = await decide(
      REJECT_QUOTE_ID,
      VALID_TOKEN,
      { decision: 'rejected' },
      { 'Idempotency-Key': 'decision-reject-key-001', 'If-Match': etag },
    );
    await expectContract(response, { status: 201, dataSchema: 'StorefrontQuoteDetail' });
    const body = (await response.json()) as { data: { status: string } };
    expect(body.data.status).toBe('rejected');

    const events = outboxRepository.events.filter((event) => event.name === 'quote.rejected');
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toEqual({
      quote_id: REJECT_QUOTE_ID,
      customer_id: 'customer-1',
      number: quoteDetail.number,
    });
  });

  it('Idempotency-Key rejouee — meme reponse memorisee, Idempotency-Replayed: true, AUCUNE seconde decision', async () => {
    const etag = await getEtag(QUOTE_ID, VALID_TOKEN);
    const key = 'decision-replay-key-001';
    const first = await decide(QUOTE_ID, VALID_TOKEN, { decision: 'accepted' }, { 'Idempotency-Key': key, 'If-Match': etag });
    expect(first.status).toBe(201);

    const replay = await decide(QUOTE_ID, VALID_TOKEN, { decision: 'accepted' }, { 'Idempotency-Key': key, 'If-Match': etag });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    const firstBody = (await first.json()) as { data: unknown };
    const replayBody = (await replay.json()) as { data: unknown };
    expect(replayBody.data).toEqual(firstBody.data);
  });

  it.each([
    ['identifiant inconnu', OTHER_QUOTE_ID, VALID_TOKEN],
    ["devis d un autre client (jamais distingue de l'inconnu)", QUOTE_ID, OTHER_ACCOUNT_TOKEN],
    ['compte sans interlocuteur (jamais distingue)', QUOTE_ID, NO_CONTACT_TOKEN],
  ])('404 quote.not_found INDISCERNABLE — %s', async (_label, quoteId, token) => {
    const response = await decide(quoteId, token, { decision: 'accepted' }, { 'Idempotency-Key': `key-404-${quoteId}` });
    await expectContract(response, { status: 404 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.not_found');
  });

  it('403 quote.decision_forbidden_delegated — une session DELEGUEE ne peut ni accepter ni refuser', async () => {
    const response = await decide(
      QUOTE_ID,
      DELEGATED_TOKEN,
      { decision: 'accepted' },
      { 'Idempotency-Key': 'decision-delegated-key' },
    );
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.decision_forbidden_delegated');
  });

  it('403 identity.actor_kind_required — un jeton utilisateur Magrit atteint l operation, AUCUN cookie storefront', async () => {
    // Bearer SEUL (pas de cookie) : cloisonnement des modes (§3.6, couche 2),
    // distinct du cumul cookie+Bearer sur une operation storefrontSession
    // (deja teste par les GET, 400 identity.actor_kind_required).
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_ID}/decisions`, {
      method: 'POST',
      headers: { ...jsonHeaders, Authorization: 'Bearer jeton-valide', 'Idempotency-Key': 'decision-user-key' },
      body: JSON.stringify({ decision: 'accepted' }),
    });
    await expectContract(response, { status: 403 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('identity.actor_kind_required');
  });

  it("409 quote.decision_forbidden_status — le devis n est plus 'sent' (deja accepted)", async () => {
    const response = await decide(
      ALREADY_DECIDED_QUOTE_ID,
      VALID_TOKEN,
      { decision: 'rejected' },
      { 'Idempotency-Key': 'decision-already-decided-key' },
    );
    await expectContract(response, { status: 409 });
    const body = (await response.json()) as { code: string; current_state: { status: string } };
    expect(body.code).toBe('quote.decision_forbidden_status');
    expect(body.current_state.status).toBe('accepted');
  });

  it('409 quote.decision_expired — valid_until depassee a l horloge du serveur', async () => {
    const response = await decide(
      EXPIRED_QUOTE_ID,
      VALID_TOKEN,
      { decision: 'accepted' },
      { 'Idempotency-Key': 'decision-expired-key' },
    );
    await expectContract(response, { status: 409 });
    const body = (await response.json()) as { code: string; current_state: { expired: boolean } };
    expect(body.code).toBe('quote.decision_expired');
    expect(body.current_state.expired).toBe(true);
  });

  it('428 api.if_match_required — precondition absente, EN DERNIER dans l ordre des refus', async () => {
    const response = await decide(QUOTE_ID, VALID_TOKEN, { decision: 'accepted' }, { 'Idempotency-Key': 'decision-no-if-match-key' });
    await expectContract(response, { status: 428 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.if_match_required');
  });

  it('400 api.if_match_invalid — If-Match: * desactiverait le controle de concurrence', async () => {
    const response = await decide(
      QUOTE_ID,
      VALID_TOKEN,
      { decision: 'accepted' },
      { 'Idempotency-Key': 'decision-star-if-match-key', 'If-Match': '*' },
    );
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.if_match_invalid');
  });

  it('409 api.resource_conflict — If-Match perime (devis relu entre-temps)', async () => {
    const response = await decide(
      QUOTE_ID,
      VALID_TOKEN,
      { decision: 'accepted' },
      { 'Idempotency-Key': 'decision-stale-if-match-key', 'If-Match': '"0000000000000000000000000000ff"' },
    );
    await expectContract(response, { status: 409 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.resource_conflict');
  });

  it('422 api.validation_failed — decision hors enumeration (converted, draft, sent ne sont pas des decisions de client)', async () => {
    const response = await decide(
      QUOTE_ID,
      VALID_TOKEN,
      { decision: 'converted' },
      { 'Idempotency-Key': 'decision-invalid-value-key' },
    );
    await expectContract(response, { status: 422 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.validation_failed');
  });

  it('400 api.idempotency_key_required — POST creant une ressource, cle exigee', async () => {
    const response = await decide(QUOTE_ID, VALID_TOKEN, { decision: 'accepted' });
    await expectContract(response, { status: 400 });
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('api.idempotency_key_required');
  });

  it('401 — aucune credential fournie', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_ID}/decisions`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'Idempotency-Key': 'decision-no-credential-key' },
      body: JSON.stringify({ decision: 'accepted' }),
    });
    await expectContract(response, { status: 401 });
  });

  it(
    'reserve §8.13quinquies (defaut de socle corrige) — DEUX comptes clients distincts choisissant la MEME ' +
      'valeur d Idempotency-Key sur DEUX devis differents ne se bloquent plus mutuellement',
    async () => {
      const key = 'meme-cle-deux-comptes-distincts';
      const etagA1 = await getEtag(QUOTE_ID, VALID_TOKEN);
      const etagA2 = await getEtag(A2_QUOTE_ID, OTHER_ACCOUNT_TOKEN);

      const first = await decide(QUOTE_ID, VALID_TOKEN, { decision: 'accepted' }, { 'Idempotency-Key': key, 'If-Match': etagA1 });
      expect(first.status).toBe(201);

      const second = await decide(
        A2_QUOTE_ID,
        OTHER_ACCOUNT_TOKEN,
        { decision: 'accepted' },
        { 'Idempotency-Key': key, 'If-Match': etagA2 },
      );
      // AVANT le correctif, le second appel aurait recu 409
      // api.idempotency_key_reused : la cle stockee etait partagee par
      // ESPACE seul, pas par COMPTE — un client aurait pu en bloquer un
      // autre du meme imprimeur. Les deux doivent reussir.
      expect(second.status).toBe(201);
      const secondBody = (await second.json()) as { data: { status: string } };
      expect(secondBody.data.status).toBe('accepted');
    },
  );
});
