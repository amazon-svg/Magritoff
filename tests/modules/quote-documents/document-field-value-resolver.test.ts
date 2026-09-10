import { describe, expect, it } from 'vitest';
import {
  resolveDocumentFieldValues,
  resolveDocumentLineFieldValues,
  resolveOrderDocumentFieldValues,
  summarizeProductConfig,
  type ResolvableCustomer,
  type ResolvableOrderHeader,
  type ResolvableQuoteHeader,
  type ResolvableTotals,
} from '@/modules/quote-documents/application/document-field-value-resolver';

const EMPTY_CUSTOMER: ResolvableCustomer = {
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

const HEADER: ResolvableQuoteHeader = {
  number: 'DEV-2026-00042',
  issuedAt: '2026-09-09T14:32:00.000Z',
  validUntil: '2026-10-09',
};

const TOTALS: ResolvableTotals = {
  linesSubtotal: '1234.50',
  globalDiscount: '-18.00',
  netTotal: '1216.50',
  vatRate: '0.2000',
  vatAmount: '243.30',
  totalInclTax: '1459.80',
};

describe('resolveDocumentFieldValues', () => {
  it('resout number/issued_at/valid_until, formates en francais', () => {
    const values = resolveDocumentFieldValues(HEADER, EMPTY_CUSTOMER, TOTALS);

    expect(values['quote.number']).toBe('DEV-2026-00042');
    expect(values['quote.issued_at']).toBe('09/09/2026');
    expect(values['quote.valid_until']).toBe('09/10/2026');
  });

  it("quote.customer_reference n est JAMAIS renseigne (ecart de donnees documente : aucune colonne source)", () => {
    const values = resolveDocumentFieldValues(HEADER, EMPTY_CUSTOMER, TOTALS);
    expect(values['quote.customer_reference']).toBeUndefined();
  });

  it('valid_until absent (null) ne produit AUCUNE cle (contrat : rien n est imprime)', () => {
    const values = resolveDocumentFieldValues({ ...HEADER, validUntil: null }, EMPTY_CUSTOMER, TOTALS);
    expect(values['quote.valid_until']).toBeUndefined();
  });

  it('totals.lines_subtotal/global_discount ABSENTS quand null (show_discounts=false, deja filtre par l appelant)', () => {
    const values = resolveDocumentFieldValues(HEADER, EMPTY_CUSTOMER, {
      ...TOTALS,
      linesSubtotal: null,
      globalDiscount: null,
    });

    expect(values['totals.lines_subtotal']).toBeUndefined();
    expect(values['totals.global_discount']).toBeUndefined();
    expect(values['totals.net_total']).toBe('1 216,50 €');
  });

  it('totals.net_total/vat_rate/vat_amount/total_incl_tax sont TOUJOURS presents (jamais masques)', () => {
    const values = resolveDocumentFieldValues(HEADER, EMPTY_CUSTOMER, TOTALS);
    expect(values['totals.vat_rate']).toBe('20 %');
    expect(values['totals.vat_amount']).toBe('243,30 €');
    expect(values['totals.total_incl_tax']).toBe('1 459,80 €');
  });

  it('customer.company_name absent pour un client individual (company_name null)', () => {
    const values = resolveDocumentFieldValues(HEADER, EMPTY_CUSTOMER, TOTALS);
    expect(values['customer.company_name']).toBeUndefined();
  });

  it('customer.billing_address_block compose les lignes non vides, jointes par des sauts de ligne', () => {
    const customer: ResolvableCustomer = {
      ...EMPTY_CUSTOMER,
      companyName: 'Établissements Dupont & Fils',
      billingLine1: '12 rue des Imprimeurs',
      billingLine2: null,
      billingPostalCode: '75011',
      billingCity: 'Paris',
      billingCountry: 'FR',
    };
    const values = resolveDocumentFieldValues(HEADER, customer, TOTALS);

    expect(values['customer.company_name']).toBe('Établissements Dupont & Fils');
    expect(values['customer.billing_address_block']).toBe('12 rue des Imprimeurs\n75011 Paris\nFR');
    expect(values['customer.billing_line2']).toBeUndefined();
  });

  it('aucune adresse renseignee -> billing_address_block absent (pas de bloc vide)', () => {
    const values = resolveDocumentFieldValues(HEADER, EMPTY_CUSTOMER, TOTALS);
    expect(values['customer.billing_address_block']).toBeUndefined();
  });
});

describe('resolveDocumentLineFieldValues', () => {
  it('resout position/label/quantity/price, toujours presents', () => {
    const values = resolveDocumentLineFieldValues({
      position: 1,
      label: 'Flyers A5',
      productConfig: {},
      quantity: 200,
      priceBeforeDiscount: null,
      discountRate: null,
      price: '120.00',
    });

    expect(values['line.position']).toBe('1');
    expect(values['line.label']).toBe('Flyers A5');
    expect(values['line.quantity']).toBe('200');
    expect(values['line.price']).toBe('120,00 €');
  });

  it('price_before_discount/discount_rate ABSENTS quand null (show_discounts=false)', () => {
    const values = resolveDocumentLineFieldValues({
      position: 1,
      label: 'Flyers A5',
      productConfig: {},
      quantity: 200,
      priceBeforeDiscount: null,
      discountRate: null,
      price: '120.00',
    });

    expect(values['line.price_before_discount']).toBeUndefined();
    expect(values['line.discount_rate']).toBeUndefined();
  });

  it('price_before_discount/discount_rate PRESENTS et formates quand fournis (show_discounts=true)', () => {
    const values = resolveDocumentLineFieldValues({
      position: 1,
      label: 'Flyers A5',
      productConfig: {},
      quantity: 200,
      priceBeforeDiscount: '130.00',
      discountRate: '0.0770',
      price: '120.00',
    });

    expect(values['line.price_before_discount']).toBe('130,00 €');
    expect(values['line.discount_rate']).toBe('7,7 %');
  });
});

describe('resolveOrderDocumentFieldValues (E10.19b)', () => {
  const ORDER_HEADER: ResolvableOrderHeader = {
    number: 'CDE-2026-00017',
    createdAt: '2026-09-10T09:00:00.000Z',
    quoteNumber: 'DEV-2026-00042',
    customerReference: null,
    expectedDeliveryDate: null,
  };

  it('resout order.number/order.created_at/order.quote_number, TOUJOURS presents', () => {
    const values = resolveOrderDocumentFieldValues(ORDER_HEADER, EMPTY_CUSTOMER, TOTALS);

    expect(values['order.number']).toBe('CDE-2026-00017');
    expect(values['order.created_at']).toBe('10/09/2026');
    expect(values['order.quote_number']).toBe('DEV-2026-00042');
  });

  it('aucun order.quote.*/order.status : ce catalogue n existe pas sur un gabarit order (verifie par absence de cle possible)', () => {
    const values = resolveOrderDocumentFieldValues(ORDER_HEADER, EMPTY_CUSTOMER, TOTALS);
    // Aucune cle 'quote.*' ne peut jamais apparaitre : ce resolveur ne les
    // ecrit jamais (contrat §8.20 §4 : "non — un seul champ order.quote_number
    // suffit a faire le lien").
    expect(Object.keys(values).some((key) => key.startsWith('quote.'))).toBe(false);
  });

  it('order.customer_reference ABSENT quand null (ecart de donnees documente : aucune source amont sur commercial_quotes)', () => {
    const values = resolveOrderDocumentFieldValues(ORDER_HEADER, EMPTY_CUSTOMER, TOTALS);
    expect(values['order.customer_reference']).toBeUndefined();
  });

  it('order.customer_reference PRESENT quand fourni', () => {
    const values = resolveOrderDocumentFieldValues(
      { ...ORDER_HEADER, customerReference: 'PO-77451' },
      EMPTY_CUSTOMER,
      TOTALS,
    );
    expect(values['order.customer_reference']).toBe('PO-77451');
  });

  it('order.expected_delivery_date ABSENT quand null (reserve (h), aucun ecrivain), PRESENT et formate quand fourni', () => {
    const absent = resolveOrderDocumentFieldValues(ORDER_HEADER, EMPTY_CUSTOMER, TOTALS);
    expect(absent['order.expected_delivery_date']).toBeUndefined();

    const present = resolveOrderDocumentFieldValues(
      { ...ORDER_HEADER, expectedDeliveryDate: '2026-10-01' },
      EMPTY_CUSTOMER,
      TOTALS,
    );
    expect(present['order.expected_delivery_date']).toBe('01/10/2026');
  });

  it('familles customer.*/totals.* IDENTIQUES au devis (meme comportement, meme formatage — factorisation partagee)', () => {
    const customer: ResolvableCustomer = {
      ...EMPTY_CUSTOMER,
      companyName: 'Établissements Dupont & Fils',
      billingLine1: '12 rue des Imprimeurs',
      billingPostalCode: '75011',
      billingCity: 'Paris',
      billingCountry: 'FR',
    };
    const orderValues = resolveOrderDocumentFieldValues(ORDER_HEADER, customer, TOTALS);
    const quoteValues = resolveDocumentFieldValues(HEADER, customer, TOTALS);

    expect(orderValues['customer.company_name']).toBe(quoteValues['customer.company_name']);
    expect(orderValues['customer.billing_address_block']).toBe(quoteValues['customer.billing_address_block']);
    expect(orderValues['totals.net_total']).toBe(quoteValues['totals.net_total']);
    expect(orderValues['totals.vat_rate']).toBe(quoteValues['totals.vat_rate']);
  });

  it('totals.lines_subtotal/global_discount ABSENTS quand null (show_discounts=false, deja filtre par l appelant)', () => {
    const values = resolveOrderDocumentFieldValues(ORDER_HEADER, EMPTY_CUSTOMER, {
      ...TOTALS,
      linesSubtotal: null,
      globalDiscount: null,
    });
    expect(values['totals.lines_subtotal']).toBeUndefined();
    expect(values['totals.global_discount']).toBeUndefined();
  });
});

describe('summarizeProductConfig (repli GENERIQUE, ecart de perimetre documente)', () => {
  it('rend null sur un objet vide (rien n est imprime)', () => {
    expect(summarizeProductConfig({})).toBeNull();
  });

  it('joint les champs primitifs du premier niveau', () => {
    expect(summarizeProductConfig({ format: 'A5', grammage: 135, recto_verso: true })).toBe(
      'format: A5 · grammage: 135 · recto_verso: true',
    );
  });

  it('ignore les champs non primitifs (objets/tableaux imbriques)', () => {
    expect(summarizeProductConfig({ format: 'A5', amounts: { price: '10.00' } })).toBe('format: A5');
  });
});
