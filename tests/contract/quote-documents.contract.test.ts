/**
 * Module Document PDF de devis contre le contrat (story E10.10b-4c).
 *
 * Exerce reellement `createQuoteDocumentsRoutes()` via
 * `createGescomApiHandler`, avec des FAUX en memoire (aucune dependance a
 * Supabase ni a `pdf-lib`). Chaque reponse est confrontee au contrat via
 * `checkResponseAgainstContract`.
 *
 * AUCUNE GENERATION n est exercee ici (contrat §8.18 §5, "aucune operation
 * publique de generation") : ces deux operations ne RENDENT qu une piece
 * deja produite, jamais un nouveau rendu. Le MOTEUR de generation a ses
 * propres tests unitaires (`tests/modules/quote-documents/`) ; le
 * BRANCHEMENT dans `sendQuote` est verifie par
 * `tests/modules/commercial-quotes/`, et la RLS reelle par
 * `tests/sql/gescom-e10-10b-4c-quote-documents.sql`.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import {
  InMemoryIdempotencyStore,
  type ApiPrincipal,
  type PrincipalVerifier,
} from '@/modules/_shared/application';
import { QuoteNotFoundError } from '@/modules/commercial-quotes/application/commercial-quotes-repository';
import type { CommercialQuotesService } from '@/modules/commercial-quotes/application/commercial-quotes-service';
import { QuoteDocumentsService } from '@/modules/quote-documents/application/quote-documents-service';
import type { QuoteDocumentDto } from '@/modules/quote-documents/api/contracts';
import type { QuoteDocumentsRepository } from '@/modules/quote-documents/application/quote-documents-repository';
import { createQuoteDocumentsRoutes } from '@/server/api/quote-documents-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness.ts';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9013');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5e70');

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

/** `Uuid` du contrat : identifiants de test valides, pas des slugs lisibles. */
const QUOTE_WITH_DOC = 'b1111111-1111-4111-8111-111111111111';
const QUOTE_WITHOUT_DOC = 'b2222222-2222-4222-8222-222222222222';
const QUOTE_UNKNOWN = 'b3333333-3333-4333-8333-333333333333';
const TEMPLATE_ID = 'c1111111-1111-4111-8111-111111111111';

/** `^[A-Za-z0-9_-]{32,512}$` (`readStorefrontSessionCookie`) : un jeton court est silencieusement rejete, pas juste "invalide en base". */
const SESSION_TOKEN = 'a'.repeat(40);

const userPrincipal: ApiPrincipal = Object.freeze({ kind: 'user', userId: USER, tenantId: TENANT });
const shopCustomerPrincipal: ApiPrincipal = Object.freeze({
  kind: 'shop_customer',
  accountId: 'account-1',
  shopId: 'shop-1',
  tenantId: TENANT,
  customerId: 'customer-1',
  sessionKind: 'direct',
  sessionToken: SESSION_TOKEN,
});

const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer') return credential.token === 'jeton-valide' ? userPrincipal : null;
    if (credential.kind === 'cookie') return credential.token === SESSION_TOKEN ? shopCustomerPrincipal : null;
    return null;
  },
};

/** Cote atelier : la route verifie l EXISTENCE du devis avant de traduire l absence de document. */
function fakeCommercialQuotesService(existingQuoteIds: readonly string[]): CommercialQuotesService {
  return {
    async getSummary(_tenantId: TenantId, quoteId: string) {
      if (!existingQuoteIds.includes(quoteId)) throw new QuoteNotFoundError();
      return {} as never;
    },
  } as unknown as CommercialQuotesService;
}

const SAMPLE_DOCUMENT: QuoteDocumentDto = Object.freeze({
  quote_id: QUOTE_WITH_DOC,
  template_id: TEMPLATE_ID,
  generated_at: '2026-09-09T10:00:00.000Z',
  byte_size: 12345,
  sha256: 'a'.repeat(64),
  content_type: 'application/pdf',
  page_count: 1,
  download_url: 'https://storage.test/signed-url',
  download_url_expires_at: '2026-09-09T10:05:00.000Z',
});

class InMemoryQuoteDocumentsRepository implements QuoteDocumentsRepository {
  /** cle : quoteId */
  private readonly byQuote = new Map<string, QuoteDocumentDto>();
  /** cle : `${sessionToken}:${quoteId}` — MEME logique de scoping que le SQL reel, simplifiee pour ce test de FORME. */
  private readonly storefrontVisible = new Set<string>();

  seedAtelier(quoteId: string, document: QuoteDocumentDto): void {
    this.byQuote.set(quoteId, document);
  }

  seedStorefront(sessionToken: string, quoteId: string): void {
    this.storefrontVisible.add(`${sessionToken}:${quoteId}`);
  }

  async findByQuoteId(_tenantId: TenantId, quoteId: string): Promise<QuoteDocumentDto | null> {
    return this.byQuote.get(quoteId) ?? null;
  }

  async findForStorefrontSession(sessionToken: string, quoteId: string): Promise<QuoteDocumentDto | null> {
    if (!this.storefrontVisible.has(`${sessionToken}:${quoteId}`)) return null;
    return this.byQuote.get(quoteId) ?? null;
  }

  async store(): Promise<QuoteDocumentDto> {
    throw new Error('store() non exerce par ce test de contrat (aucune generation exercee, voir en-tete de fichier).');
  }
}

let repository: InMemoryQuoteDocumentsRepository;
let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  repository = new InMemoryQuoteDocumentsRepository();
  repository.seedAtelier(QUOTE_WITH_DOC, SAMPLE_DOCUMENT);
  repository.seedStorefront(SESSION_TOKEN, QUOTE_WITH_DOC);

  const service = new QuoteDocumentsService({
    templates: { findEligibleTemplateForGeneration: async () => null },
    customers: { findCustomerForDocument: async () => null },
    repository,
  });

  handler = createGescomApiHandler({
    routes: createQuoteDocumentsRoutes(service, fakeCommercialQuotesService([QUOTE_WITH_DOC, QUOTE_WITHOUT_DOC])),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
    requestIdFactory: () => 'req-e10-10b-4c',
  });
});

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return handler(new Request(`https://magrit.test${path}`, init));
}

const asUser = { Authorization: 'Bearer jeton-valide' };
const asShopCustomer = { Cookie: `magrit-storefront=${SESSION_TOKEN}` };

async function expectContract(
  response: Response,
  expectation: Readonly<{ status: number; dataSchema?: string }>,
): Promise<void> {
  const check = await checkResponseAgainstContract(response, expectation);
  expect(check.errors, check.errors.join(' | ')).toEqual([]);
}

describe('GET /quotes/{quoteId}/documents (atelier)', () => {
  it('200 : rend le document deja produit', async () => {
    const response = await call(`/api/v1/quotes/${QUOTE_WITH_DOC}/documents`, { headers: asUser });
    await expectContract(response, { status: 200, dataSchema: 'QuoteDocument' });

    const body = (await response.json()) as { data: QuoteDocumentDto };
    expect(body.data.quote_id).toBe(QUOTE_WITH_DOC);
    expect(body.data.template_id).not.toBeNull();
  });

  it('404 quote.not_found : le devis n existe pas dans ce tenant', async () => {
    const response = await call(`/api/v1/quotes/${QUOTE_UNKNOWN}/documents`, { headers: asUser });
    await expectContract(response, { status: 404 });

    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.not_found');
  });

  it('404 quote.document_not_generated : le devis existe mais n a pas de document (cas LE PLUS FREQUENT)', async () => {
    const response = await call(`/api/v1/quotes/${QUOTE_WITHOUT_DOC}/documents`, { headers: asUser });
    await expectContract(response, { status: 404 });

    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.document_not_generated');
  });

  it('401 sans jeton', async () => {
    const response = await call(`/api/v1/quotes/${QUOTE_WITH_DOC}/documents`);
    expect(response.status).toBe(401);
  });
});

describe('GET /storefront-quotes/{quoteId}/documents (portail client)', () => {
  it('200 : rend le document, meme session que le portail', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_WITH_DOC}/documents`, { headers: asShopCustomer });
    await expectContract(response, { status: 200, dataSchema: 'QuoteDocument' });
  });

  it("404 INDISCERNABLE quote.not_found : devis sans document (aucune distinction avec un identifiant inconnu)", async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_WITHOUT_DOC}/documents`, { headers: asShopCustomer });
    await expectContract(response, { status: 404 });

    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.not_found');
  });

  it('404 quote.not_found : identifiant totalement inconnu — MEME code que "sans document" (indiscernable)', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_UNKNOWN}/documents`, { headers: asShopCustomer });
    await expectContract(response, { status: 404 });

    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('quote.not_found');
  });

  it('403 sur un jeton utilisateur (session boutique requise)', async () => {
    const response = await call(`/api/v1/storefront-quotes/${QUOTE_WITH_DOC}/documents`, { headers: asUser });
    expect(response.status).toBe(403);
  });
});
