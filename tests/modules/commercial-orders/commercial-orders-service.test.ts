/**
 * `CommercialOrdersService.generateDocument()` (E10.19b) — qa-review M1
 * (MAJEUR, corrige) : AUCUN test n exercait la branche `show_discounts ===
 * true` du filtre serveur (E10.19a decision D). Verifie ICI, en UNITAIRE,
 * les QUATRE ternaires qui construisent `OrderForDocumentGeneration`
 * (`commercial-orders-service.ts`, `generateDocument()`) — inverser l un
 * d eux romprait silencieusement la promesse "un client qui a demande que
 * les remises soient masquees ne les voit jamais", sans qu aucun test de
 * contrat existant (qui ne passe que par des devis `show_discounts=false`
 * par defaut) ne le detecte.
 *
 * Espionne `OrderDocumentsService.generate()` (jamais reimplemente : un
 * FAUX qui capture l argument `OrderForDocumentGeneration` recu, exactement
 * ce que `CommercialOrdersService` lui transmet) plutot que d inspecter un
 * PDF rendu — le rendu lui-meme est deja couvert par
 * `tests/modules/order-documents/order-documents-service.test.ts` et
 * `tests/modules/quote-documents/document-field-value-resolver.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
import type { TenantId, UserId } from '@/kernel';
import { OutboxPublisher, type OutboxEvent, type OutboxRepository } from '@/modules/_shared/application';
import { CommercialOrdersService } from '@/modules/commercial-orders/application/commercial-orders-service';
import type {
  CommercialOrdersRepository,
  OrderDataForDocumentGeneration,
} from '@/modules/commercial-orders/application/commercial-orders-repository';
import type { OrderDocumentsService } from '@/modules/order-documents/application/order-documents-service';

const TENANT = 'tenant-1' as TenantId;
const ACTOR = 'user-1' as UserId;
const ORDER_ID = 'order-1';

class NoopOutboxRepository implements OutboxRepository {
  async append(_events: readonly OutboxEvent[]): Promise<void> {
    // non exerce par generateDocument()/getDocument() : aucun evenement n est publie (contrat §8.20 §6, "Aucun").
  }
}

function orderDataFixture(
  showDiscounts: boolean,
  overrides: Partial<Pick<OrderDataForDocumentGeneration, 'customerReference' | 'expectedDeliveryDate'>> = {},
): OrderDataForDocumentGeneration {
  return {
    id: ORDER_ID,
    number: 'CDE-2026-00017',
    createdAt: '2026-09-10T09:00:00.000Z',
    customerId: 'customer-1',
    quoteNumber: 'DEV-2026-00042',
    customerReference: overrides.customerReference ?? null,
    expectedDeliveryDate: overrides.expectedDeliveryDate ?? null,
    showDiscounts,
    totals: {
      lines_subtotal: '150.00',
      global_discount: '-10.00',
      effective_discount_rate: '0.0667',
      net_total: '140.00',
      vat_rate: '0.2000',
      vat_regime: 'metropole_fr',
      vat_amount: '28.00',
      total_incl_tax: '168.00',
    },
    lines: [
      {
        position: 1,
        label: 'Flyers A5',
        productConfig: {},
        quantity: 200,
        customerPrice: '150.00',
        discountRate: '0.0667',
        salePrice: '140.00',
      },
    ],
  };
}

function buildService(
  showDiscounts: boolean,
  fixtureOverrides: Partial<Pick<OrderDataForDocumentGeneration, 'customerReference' | 'expectedDeliveryDate'>> = {},
) {
  const repository: CommercialOrdersRepository = {
    list: vi.fn(),
    findById: vi.fn(),
    findDetailById: vi.fn(),
    convertQuote: vi.fn(),
    listStepChanges: vi.fn(),
    changeProductionStep: vi.fn(),
    findForDocumentGeneration: vi.fn(async () => orderDataFixture(showDiscounts, fixtureOverrides)),
  } as unknown as CommercialOrdersRepository;

  const generate = vi.fn(async () => ({
    order_id: ORDER_ID,
    template_id: 'template-1',
    generated_at: '2026-09-10T10:00:00.000Z',
    generated_by: ACTOR,
    generated_by_label: 'commercial@example.test',
    byte_size: 100,
    sha256: 'a'.repeat(64),
    content_type: 'application/pdf' as const,
    page_count: 1,
    download_url: 'https://storage.test/signed',
    download_url_expires_at: '2026-09-10T10:05:00.000Z',
  }));
  const documents = { generate, getForOrder: vi.fn() } as unknown as OrderDocumentsService;

  const outbox = new OutboxPublisher({
    repository: new NoopOutboxRepository(),
    now: () => new Date('2026-09-10T10:00:00.000Z'),
    newEventId: () => 'event-1',
  });

  const service = new CommercialOrdersService({
    repository,
    outbox,
    quotes: {} as any,
    documents,
  });

  return { service, generate };
}

describe('CommercialOrdersService.generateDocument — filtre show_discounts (E10.19a decision D), qa-review M1', () => {
  it('show_discounts=true : priceBeforeDiscount/discountRate/linesSubtotal/globalDiscount TRANSMIS (remises visibles, contrat)', async () => {
    const { service, generate } = buildService(true);

    await service.generateDocument(TENANT, ACTOR, ORDER_ID);

    expect(generate).toHaveBeenCalledTimes(1);
    const [, , input] = generate.mock.calls[0]!;
    expect(input).toMatchObject({
      totals: {
        linesSubtotal: '150.00',
        globalDiscount: '-10.00',
        netTotal: '140.00',
        vatRate: '0.2000',
        vatAmount: '28.00',
        totalInclTax: '168.00',
      },
      lines: [
        {
          priceBeforeDiscount: '150.00',
          discountRate: '0.0667',
          price: '140.00',
        },
      ],
    });
  });

  it('show_discounts=false : priceBeforeDiscount/discountRate/linesSubtotal/globalDiscount ABSENTS (null), salePrice/netTotal INCHANGES (contrat, remises masquees)', async () => {
    const { service, generate } = buildService(false);

    await service.generateDocument(TENANT, ACTOR, ORDER_ID);

    expect(generate).toHaveBeenCalledTimes(1);
    const [, , input] = generate.mock.calls[0]!;
    expect(input).toMatchObject({
      totals: {
        linesSubtotal: null,
        globalDiscount: null,
        // TOUJOURS transmis, remises visibles ou non (contrat, meme
        // discipline que le devis) : ni masques, ni recalcules.
        netTotal: '140.00',
        vatRate: '0.2000',
        vatAmount: '28.00',
        totalInclTax: '168.00',
      },
      lines: [
        {
          priceBeforeDiscount: null,
          discountRate: null,
          // sale_price TOUJOURS imprime, remises visibles ou non.
          price: '140.00',
        },
      ],
    });
  });

  // qa-review m1 (mineur, corrige) — `setCustomerReferenceForTest()` du faux
  // `InMemoryCommercialOrdersRepository` (tests/contract) etait pose sans
  // AUCUN test qui l exerce. Preuve ICI, cote SERVICE (le resolveur
  // `resolveOrderDocumentFieldValues()` prouve deja qu il IMPRIME
  // correctement `order.customer_reference` quand fourni,
  // document-field-value-resolver.test.ts) : la valeur lue sur la commande
  // (colonne gelee, E10.19a) traverse `generateDocument()` SANS alteration,
  // quel que soit `show_discounts` — ce champ n a jamais ete filtre par
  // cette regle, contrairement aux quatre champs de remise.
  it('customer_reference/expected_delivery_date traversent generateDocument() SANS alteration (jamais filtres par show_discounts)', async () => {
    const { service, generate } = buildService(false, {
      customerReference: 'PO-77451',
      expectedDeliveryDate: '2026-10-01',
    });

    await service.generateDocument(TENANT, ACTOR, ORDER_ID);

    const [, , input] = generate.mock.calls[0]!;
    expect(input).toMatchObject({
      customerReference: 'PO-77451',
      expectedDeliveryDate: '2026-10-01',
    });
  });
});
