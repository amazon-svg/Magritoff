/**
 * Test unitaire de `QuoteDocumentsService` (story E10.10b-4c), avec des FAUX
 * pour les trois ports (gabarit eligible, donnees client, referentiel des
 * documents) : verifie l ORCHESTRATION (quand generer, quand rendre `null`,
 * quand lever `QuoteDocumentGenerationFailedError`), pas le rendu lui-meme
 * (deja couvert par `quote-document-renderer.test.ts`).
 *
 * qa-review B4-bis (E10.10b-4c) — `renderForFirstSend()`/`persistRendered()`
 * remplacent l ancien `generateForFirstSend()` (qui stockait AVANT l envoi) :
 * ce fichier verifie desormais que `renderForFirstSend()` NE PERSISTE RIEN
 * (jamais `repository.store` appele), et que `persistRendered()` est la
 * SEULE methode qui y touche.
 */
import { describe, expect, it, vi } from 'vitest';
import { QuoteDocumentsService } from '@/modules/quote-documents/application/quote-documents-service';
import {
  QuoteDocumentGenerationFailedError,
  QuoteDocumentNotFoundError,
} from '@/modules/quote-documents/application/quote-documents-repository';
import type { TenantId, UserId } from '@/kernel';
import { PDFDocument } from 'pdf-lib';

const TENANT = 'tenant-1' as TenantId;
const ACTOR = 'user-1' as UserId;

async function buildBackground(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([595.28, 841.89]);
  return document.save();
}

function baseQuote() {
  return {
    id: 'quote-1',
    customerId: 'customer-1',
    number: 'DEV-2026-00042',
    validUntil: null,
    totals: {
      linesSubtotal: null,
      globalDiscount: null,
      netTotal: '120.00',
      vatRate: '0.2000',
      vatAmount: '24.00',
      totalInclTax: '144.00',
    },
    lines: [
      {
        position: 1,
        label: 'Flyers A5',
        productConfig: {},
        quantity: 200,
        priceBeforeDiscount: null,
        discountRate: null,
        price: '120.00',
      },
    ],
  };
}

describe('QuoteDocumentsService.renderForFirstSend', () => {
  it('rend null quand AUCUN gabarit n est eligible (cas NOMINAL (a) — jamais une erreur)', async () => {
    const templates = { findEligibleTemplateForGeneration: vi.fn(async () => null) };
    const customers = { findCustomerForDocument: vi.fn(async () => null) };
    const repository = {
      findByQuoteId: vi.fn(),
      findForStorefrontSession: vi.fn(),
      store: vi.fn(),
    };
    const service = new QuoteDocumentsService({ templates, customers, repository });

    const result = await service.renderForFirstSend(TENANT, baseQuote(), '2026-09-09T10:00:00.000Z');

    expect(result).toBeNull();
    expect(repository.store).not.toHaveBeenCalled();
  });

  it('rend le document EN MEMOIRE quand un gabarit est eligible — B4-bis : AUCUNE persistance ici', async () => {
    const backgroundBytes = await buildBackground();
    const templates = {
      findEligibleTemplateForGeneration: vi.fn(async () => ({
        templateId: 'template-1',
        backgroundBytes,
        pages: [{ index: 0, width_pt: 595.28, height_pt: 841.89 }],
        placements: [
          {
            field: 'quote.number' as const,
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
      })),
    };
    const customers = {
      findCustomerForDocument: vi.fn(async () => ({
        companyName: 'Établissements Dupont & Fils',
        contactName: null,
        billingLine1: null,
        billingLine2: null,
        billingPostalCode: null,
        billingCity: null,
        billingCountry: null,
        email: null,
        phone: null,
        siret: null,
        vatNumber: null,
      })),
    };
    const repository = {
      findByQuoteId: vi.fn(),
      findForStorefrontSession: vi.fn(),
      store: vi.fn(),
    };
    const service = new QuoteDocumentsService({ templates, customers, repository });

    const result = await service.renderForFirstSend(TENANT, baseQuote(), '2026-09-09T10:00:00.000Z');

    expect(result).toMatchObject({ templateId: 'template-1', pageCount: 1, generatedAt: '2026-09-09T10:00:00.000Z' });
    expect(result?.bytes).toBeInstanceOf(Uint8Array);
    // B4-bis, coeur du correctif : renderForFirstSend NE PERSISTE JAMAIS.
    expect(repository.store).not.toHaveBeenCalled();
  });

  it('leve QuoteDocumentGenerationFailedError quand un gabarit ETAIT eligible mais le fond est illisible (500, pas de repli silencieux)', async () => {
    const templates = {
      findEligibleTemplateForGeneration: vi.fn(async () => ({
        templateId: 'template-1',
        backgroundBytes: new TextEncoder().encode('pas un PDF'),
        pages: [],
        placements: [],
        linesBlock: null,
      })),
    };
    const customers = { findCustomerForDocument: vi.fn(async () => null) };
    const repository = { findByQuoteId: vi.fn(), findForStorefrontSession: vi.fn(), store: vi.fn() };
    const service = new QuoteDocumentsService({ templates, customers, repository });

    await expect(
      service.renderForFirstSend(TENANT, baseQuote(), '2026-09-09T10:00:00.000Z'),
    ).rejects.toBeInstanceOf(QuoteDocumentGenerationFailedError);
    expect(repository.store).not.toHaveBeenCalled();
  });

  it('leve QuoteDocumentGenerationFailedError quand la resolution du gabarit eligible echoue (qa-review B3 — appel desormais DANS le try)', async () => {
    const templates = {
      findEligibleTemplateForGeneration: vi.fn(async () => {
        throw new Error('panne reseau transitoire du service Storage');
      }),
    };
    const customers = { findCustomerForDocument: vi.fn(async () => null) };
    const repository = { findByQuoteId: vi.fn(), findForStorefrontSession: vi.fn(), store: vi.fn() };
    const service = new QuoteDocumentsService({ templates, customers, repository });

    await expect(
      service.renderForFirstSend(TENANT, baseQuote(), '2026-09-09T10:00:00.000Z'),
    ).rejects.toBeInstanceOf(QuoteDocumentGenerationFailedError);
  });

  it("client introuvable (defensif) : n echoue pas, rend quand meme le document en memoire", async () => {
    const backgroundBytes = await buildBackground();
    const templates = {
      findEligibleTemplateForGeneration: vi.fn(async () => ({
        templateId: 'template-1',
        backgroundBytes,
        pages: [{ index: 0, width_pt: 595.28, height_pt: 841.89 }],
        placements: [],
        linesBlock: null,
      })),
    };
    const customers = { findCustomerForDocument: vi.fn(async () => null) };
    const repository = { findByQuoteId: vi.fn(), findForStorefrontSession: vi.fn(), store: vi.fn() };
    const service = new QuoteDocumentsService({ templates, customers, repository });

    await expect(
      service.renderForFirstSend(TENANT, baseQuote(), '2026-09-09T10:00:00.000Z'),
    ).resolves.toMatchObject({ templateId: 'template-1' });
  });

  it('qa-review B5 (BLOQUANT, corrige) — un caractere hors CP1252 dans le nom du client (ou une designation de ligne) N EMPECHE PLUS la generation (chaine complete resolveur + moteur pdf-lib REEL)', async () => {
    const backgroundBytes = await buildBackground();
    const templates = {
      findEligibleTemplateForGeneration: vi.fn(async () => ({
        templateId: 'template-1',
        backgroundBytes,
        pages: [{ index: 0, width_pt: 595.28, height_pt: 841.89 }],
        placements: [
          {
            field: 'customer.company_name' as const,
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
        linesBlock: {
          page_index: 0,
          first_row_baseline_y: 600,
          row_height: 14,
          rows_per_page: 20,
          continuation_page_index: null,
          columns: [
            {
              field: 'line.label' as const,
              x: 50,
              width: 300,
              align: 'left' as const,
              font: 'helvetica' as const,
              font_size: 10,
              color: '#111111',
            },
          ],
        },
      })),
    };
    const customers = {
      findCustomerForDocument: vi.fn(async () => ({
        companyName: 'Łukasz Nowak Sp. z o.o.', // client reel : nom polonais hors WinAnsi
        contactName: null,
        billingLine1: null,
        billingLine2: null,
        billingPostalCode: null,
        billingCity: null,
        billingCountry: null,
        email: null,
        phone: null,
        siret: null,
        vatNumber: null,
      })),
    };
    const quoteWithProblematicLine = {
      ...baseQuote(),
      lines: [{ ...baseQuote().lines[0]!, label: 'Écriteau "Fermé ✓" — modèle Łódź' }],
    };
    const repository = { findByQuoteId: vi.fn(), findForStorefrontSession: vi.fn(), store: vi.fn() };
    const service = new QuoteDocumentsService({ templates, customers, repository });

    // AVANT le correctif, ceci levait `Error: WinAnsi cannot encode "Ł" (0x0141)`
    // depuis `pdf-lib`, remontee en `QuoteDocumentGenerationFailedError` —
    // le devis restait DEFINITIVEMENT inenvoyable tant que le gabarit etait
    // actif. Verifie ici que la generation ABOUTIT malgre tout.
    await expect(
      service.renderForFirstSend(TENANT, quoteWithProblematicLine, '2026-09-09T10:00:00.000Z'),
    ).resolves.toMatchObject({ templateId: 'template-1', pageCount: 1 });
  });
});

describe('QuoteDocumentsService.persistRendered', () => {
  it('stocke le document DEJA RENDU via repository.store()', async () => {
    const stored = {
      quote_id: 'quote-1',
      template_id: 'template-1',
      generated_at: '2026-09-09T10:00:00.000Z',
      byte_size: 100,
      sha256: 'a'.repeat(64),
      content_type: 'application/pdf' as const,
      page_count: 1,
      download_url: 'https://example.com/signed',
      download_url_expires_at: '2026-09-09T10:05:00.000Z',
    };
    const repository = {
      findByQuoteId: vi.fn(),
      findForStorefrontSession: vi.fn(),
      store: vi.fn(async () => stored),
    };
    const service = new QuoteDocumentsService({
      templates: { findEligibleTemplateForGeneration: vi.fn() },
      customers: { findCustomerForDocument: vi.fn() },
      repository,
    });

    const rendered = { templateId: 'template-1', bytes: new Uint8Array([1, 2, 3]), pageCount: 1, generatedAt: '2026-09-09T10:00:00.000Z' };
    const result = await service.persistRendered(TENANT, ACTOR, 'quote-1', rendered);

    expect(result).toEqual(stored);
    expect(repository.store).toHaveBeenCalledWith(TENANT, ACTOR, {
      quoteId: 'quote-1',
      templateId: 'template-1',
      bytes: rendered.bytes,
      pageCount: 1,
      generatedAt: '2026-09-09T10:00:00.000Z',
    });
  });

  it('propage l erreur si le stockage echoue (a l appelant de decider de degrader ou non — qa-review B4-bis)', async () => {
    const repository = {
      findByQuoteId: vi.fn(),
      findForStorefrontSession: vi.fn(),
      store: vi.fn(async () => {
        throw new Error('bucket indisponible');
      }),
    };
    const service = new QuoteDocumentsService({
      templates: { findEligibleTemplateForGeneration: vi.fn() },
      customers: { findCustomerForDocument: vi.fn() },
      repository,
    });

    const rendered = { templateId: 'template-1', bytes: new Uint8Array([1, 2, 3]), pageCount: 1, generatedAt: '2026-09-09T10:00:00.000Z' };
    await expect(service.persistRendered(TENANT, ACTOR, 'quote-1', rendered)).rejects.toThrow('bucket indisponible');
  });
});

describe('QuoteDocumentsService.getForQuote / getForStorefrontSession', () => {
  it('leve QuoteDocumentNotFoundError si le devis n a pas de document (404 quote.document_not_generated)', async () => {
    const repository = { findByQuoteId: vi.fn(async () => null), findForStorefrontSession: vi.fn(), store: vi.fn() };
    const service = new QuoteDocumentsService({
      templates: { findEligibleTemplateForGeneration: vi.fn() },
      customers: { findCustomerForDocument: vi.fn() },
      repository,
    });

    await expect(service.getForQuote(TENANT, 'quote-1')).rejects.toBeInstanceOf(QuoteDocumentNotFoundError);
  });

  it('getForStorefrontSession rend null sur toute cause confondue (404 indiscernable)', async () => {
    const repository = {
      findByQuoteId: vi.fn(),
      findForStorefrontSession: vi.fn(async () => null),
      store: vi.fn(),
    };
    const service = new QuoteDocumentsService({
      templates: { findEligibleTemplateForGeneration: vi.fn() },
      customers: { findCustomerForDocument: vi.fn() },
      repository,
    });

    await expect(service.getForStorefrontSession('token', 'quote-1')).resolves.toBeNull();
  });
});
