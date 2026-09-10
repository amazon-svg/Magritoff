/**
 * Test unitaire de `OrderDocumentsService` (story E10.19b), meme parti que
 * `tests/modules/quote-documents/quote-documents-service.test.ts` : des FAUX
 * pour les trois ports (gabarit eligible, donnees client, referentiel des
 * documents) verifient l ORCHESTRATION (quand generer, quand lever quelle
 * erreur), pas le rendu lui-meme (deja couvert par
 * `quote-document-renderer.test.ts`, REUTILISE tel quel par ce module).
 */
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { TenantId, UserId } from '@/kernel';
import { OrderDocumentsService } from '@/modules/order-documents/application/order-documents-service';
import {
  OrderDocumentAlreadyGeneratedError,
  OrderDocumentGenerationFailedError,
  OrderDocumentNotFoundError,
  OrderDocumentTemplateMissingError,
} from '@/modules/order-documents/application/order-documents-repository';

const TENANT = 'tenant-1' as TenantId;
const ACTOR = 'user-1' as UserId;

async function buildBackground(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([595.28, 841.89]);
  return document.save();
}

function baseOrder() {
  return {
    id: 'order-1',
    customerId: 'customer-1',
    number: 'CDE-2026-00017',
    createdAt: '2026-09-10T10:00:00.000Z',
    quoteNumber: 'DEV-2026-00042',
    customerReference: null,
    expectedDeliveryDate: null,
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

function emptyCustomer() {
  return {
    companyName: null,
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
  };
}

describe('OrderDocumentsService.generate', () => {
  it('leve OrderDocumentAlreadyGeneratedError SANS appeler le gabarit ni rendre (verification AVANT tout rendu)', async () => {
    const templates = { findEligibleTemplateForGeneration: vi.fn(async () => null) };
    const customers = { findCustomerForDocument: vi.fn(async () => null) };
    const repository = {
      findByOrderId: vi.fn(async () => ({
        order_id: 'order-1',
        template_id: 'template-1',
        generated_at: '2026-09-10T10:00:00.000Z',
        generated_by: ACTOR,
        generated_by_label: 'a@example.com',
        byte_size: 100,
        sha256: 'a'.repeat(64),
        content_type: 'application/pdf' as const,
        page_count: 1,
        download_url: 'https://example.com/signed',
        download_url_expires_at: '2026-09-10T10:05:00.000Z',
      })),
      store: vi.fn(),
    };
    const service = new OrderDocumentsService({ templates, customers, repository });

    await expect(service.generate(TENANT, ACTOR, baseOrder())).rejects.toBeInstanceOf(
      OrderDocumentAlreadyGeneratedError,
    );
    expect(templates.findEligibleTemplateForGeneration).not.toHaveBeenCalled();
    expect(repository.store).not.toHaveBeenCalled();
  });

  it('leve OrderDocumentTemplateMissingError quand AUCUN gabarit order n est eligible (AUCUN repli sur quote)', async () => {
    const templates = { findEligibleTemplateForGeneration: vi.fn(async () => null) };
    const customers = { findCustomerForDocument: vi.fn(async () => null) };
    const repository = { findByOrderId: vi.fn(async () => null), store: vi.fn() };
    const service = new OrderDocumentsService({ templates, customers, repository });

    await expect(service.generate(TENANT, ACTOR, baseOrder())).rejects.toBeInstanceOf(
      OrderDocumentTemplateMissingError,
    );
    expect(templates.findEligibleTemplateForGeneration).toHaveBeenCalledWith(TENANT, 'order');
    expect(repository.store).not.toHaveBeenCalled();
  });

  it('rend PUIS PERSISTE quand un gabarit order est eligible', async () => {
    const backgroundBytes = await buildBackground();
    const templates = {
      findEligibleTemplateForGeneration: vi.fn(async () => ({
        templateId: 'template-1',
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
      })),
    };
    const customers = { findCustomerForDocument: vi.fn(async () => emptyCustomer()) };
    const stored = {
      order_id: 'order-1',
      template_id: 'template-1',
      generated_at: '2026-09-10T10:00:00.000Z',
      generated_by: ACTOR,
      generated_by_label: 'a@example.com',
      byte_size: 100,
      sha256: 'a'.repeat(64),
      content_type: 'application/pdf' as const,
      page_count: 1,
      download_url: 'https://example.com/signed',
      download_url_expires_at: '2026-09-10T10:05:00.000Z',
    };
    const repository = {
      findByOrderId: vi.fn(async () => null),
      store: vi.fn(async () => stored),
    };
    const service = new OrderDocumentsService({ templates, customers, repository });

    const result = await service.generate(TENANT, ACTOR, baseOrder());

    expect(result).toEqual(stored);
    expect(repository.store).toHaveBeenCalledTimes(1);
    const storeArgs = repository.store.mock.calls[0]!;
    expect(storeArgs[0]).toBe(TENANT);
    expect(storeArgs[1]).toBe(ACTOR);
    expect(storeArgs[2]).toMatchObject({ orderId: 'order-1', templateId: 'template-1', pageCount: 1 });
  });

  it('leve OrderDocumentGenerationFailedError quand le fond est illisible (500, aucun repli silencieux)', async () => {
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
    const repository = { findByOrderId: vi.fn(async () => null), store: vi.fn() };
    const service = new OrderDocumentsService({ templates, customers, repository });

    await expect(service.generate(TENANT, ACTOR, baseOrder())).rejects.toBeInstanceOf(
      OrderDocumentGenerationFailedError,
    );
    expect(repository.store).not.toHaveBeenCalled();
  });

  it('imprime order.quote_number / order.customer_reference / order.expected_delivery_date quand fournis (regle "valeur absente = rien imprime" testee via le resolveur, pas ici)', async () => {
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
    const customers = { findCustomerForDocument: vi.fn(async () => emptyCustomer()) };
    const repository = {
      findByOrderId: vi.fn(async () => null),
      store: vi.fn(async (_t: unknown, _a: unknown, params: any) => ({
        order_id: 'order-1',
        template_id: params.templateId,
        generated_at: params.generatedAt,
        generated_by: ACTOR,
        generated_by_label: 'a@example.com',
        byte_size: params.bytes.length,
        sha256: 'a'.repeat(64),
        content_type: 'application/pdf' as const,
        page_count: params.pageCount,
        download_url: 'https://example.com/signed',
        download_url_expires_at: '2026-09-10T10:05:00.000Z',
      })),
    };
    const service = new OrderDocumentsService({ templates, customers, repository });

    const order = {
      ...baseOrder(),
      customerReference: 'PO-77451',
      expectedDeliveryDate: '2026-10-01',
    };
    await expect(service.generate(TENANT, ACTOR, order)).resolves.toMatchObject({ template_id: 'template-1' });
  });
});

describe('OrderDocumentsService.getForOrder', () => {
  it('leve OrderDocumentNotFoundError si la commande n a pas de document (404 order.document_not_generated, cas NOMINAL)', async () => {
    const repository = { findByOrderId: vi.fn(async () => null), store: vi.fn() };
    const service = new OrderDocumentsService({
      templates: { findEligibleTemplateForGeneration: vi.fn() },
      customers: { findCustomerForDocument: vi.fn() },
      repository,
    });

    await expect(service.getForOrder(TENANT, 'order-1')).rejects.toBeInstanceOf(OrderDocumentNotFoundError);
  });
});
