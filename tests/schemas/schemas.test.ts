/**
 * Tests vitest pour les 4 schemas zod selectifs (R4 - refacto 2026-05-11).
 *
 * Verifie le parsing nominal + le rejet des valeurs aberrantes (prix negatifs,
 * NaN, formats invalides) pour les 4 chemins critiques :
 *   - cartItem
 *   - clariprintQuote
 *   - productDefinition
 *   - shopOrderInsert
 */

import { describe, it, expect } from 'vitest';
import { cartItemSchema } from '../../src/schemas/cartItem.schema';
import { clariprintQuoteSchema } from '../../src/schemas/clariprintPayload.schema';
import { productDefinitionSchema } from '../../src/schemas/productDefinition.schema';
import {
  shopOrderInsertSchema,
  shopOrderItemSchema,
} from '../../src/schemas/shopOrder.schema';

describe('cartItemSchema - cart item zod', () => {
  it('1. Cart item valide avec qty=1 → parse OK', () => {
    const result = cartItemSchema.parse({
      id: 'cart_123',
      product: { id: 'p-1', name: 'Cartes', price_ht: 98 },
      qty: 1,
    });
    expect(result.qty).toBe(1);
    expect(result.product.price_ht).toBe(98);
  });

  it('2. qty omise → defaut 1', () => {
    const result = cartItemSchema.parse({
      id: 'cart_1',
      product: { id: 'p-1', name: 'Flyer' },
    });
    expect(result.qty).toBe(1);
  });

  it('3. qty=0 → rejet (positive obligatoire)', () => {
    expect(() =>
      cartItemSchema.parse({
        id: 'cart_1',
        product: { id: 'p-1', name: 'Flyer' },
        qty: 0,
      }),
    ).toThrow();
  });

  it('4. price_ht negatif → rejet', () => {
    expect(() =>
      cartItemSchema.parse({
        id: 'cart_1',
        product: { id: 'p-1', name: 'Flyer', price_ht: -10 },
        qty: 1,
      }),
    ).toThrow();
  });
});

describe('clariprintQuoteSchema - discriminated union success/error', () => {
  it('5. Reponse success valide → parse OK', () => {
    const result = clariprintQuoteSchema.parse({
      success: true,
      priceHT: 95.5,
      costs: { paper: 30, total: 95.5 },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.priceHT).toBe(95.5);
  });

  it('6. Prix negatif → rejet (anomalie Clariprint)', () => {
    expect(() =>
      clariprintQuoteSchema.parse({ success: true, priceHT: -1.2 }),
    ).toThrow();
  });

  it('7. NaN → rejet (anomalie Clariprint)', () => {
    expect(() =>
      clariprintQuoteSchema.parse({ success: true, priceHT: Number.NaN }),
    ).toThrow();
  });

  it('8. Reponse erreur → parse OK', () => {
    const result = clariprintQuoteSchema.parse({
      success: false,
      error: 'Credentials manquants',
      credentialsMissing: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('productDefinitionSchema - PIM zod', () => {
  it('9. Definition minimale (gamme_slug + variant_key) → parse OK', () => {
    const result = productDefinitionSchema.parse({
      gamme_slug: 'carte_visite_standard',
      variant_key: 'standard_500',
    });
    expect(result.gamme_slug).toBe('carte_visite_standard');
  });

  it('10. quality_score > 1 → rejet (entre 0 et 1)', () => {
    expect(() =>
      productDefinitionSchema.parse({
        gamme_slug: 'carte',
        variant_key: 'v1',
        quality_score: 1.5,
      }),
    ).toThrow();
  });

  it('11. validated_by enum hors valeur → rejet', () => {
    expect(() =>
      productDefinitionSchema.parse({
        gamme_slug: 'carte',
        variant_key: 'v1',
        validated_by: 'unknown' as any,
      }),
    ).toThrow();
  });

  it('12. usage_examples sans title → rejet', () => {
    expect(() =>
      productDefinitionSchema.parse({
        gamme_slug: 'carte',
        variant_key: 'v1',
        usage_examples: [{ description: 'pas de titre' } as any],
      }),
    ).toThrow();
  });
});

describe('shopOrderInsertSchema - submitCart payload', () => {
  const validUuid = '12345678-1234-1234-1234-123456789012';

  it('13. Insert valide avec product_id UUID → parse OK', () => {
    const result = shopOrderInsertSchema.parse({
      shop_id: validUuid,
      customer_name: 'Acheteur Eram',
      customer_email: 'acheteur@eram.fr',
      items: [
        {
          product_id: validUuid,
          name: 'Cartes',
          qty: 1,
          quantity_ex: 500,
          price_ht: 98,
        },
      ],
      total_ht: 98,
      total_ttc: 117.6,
    });
    expect(result.items.length).toBe(1);
  });

  it('14. Insert avec source_id "lib-..." → parse OK (sans product_id UUID)', () => {
    const result = shopOrderInsertSchema.parse({
      shop_id: validUuid,
      customer_name: 'Acheteur Eram',
      customer_email: 'acheteur@eram.fr',
      items: [
        {
          source_id: 'lib-477af866-558b-4201-879f-8c3fcd2db48c',
          name: 'Cartes library',
          qty: 1,
          price_ht: 98,
        },
      ],
      total_ht: 98,
      total_ttc: 117.6,
    });
    expect(result.items[0].source_id).toBeTruthy();
    expect(result.items[0].product_id).toBeUndefined();
  });

  it('15. product_id non-UUID → rejet', () => {
    expect(() =>
      shopOrderItemSchema.parse({
        product_id: 'lib-not-uuid',
        name: 'Test',
        qty: 1,
        price_ht: 10,
      }),
    ).toThrow();
  });

  it('16. items vide → rejet (panier ne peut pas etre vide)', () => {
    expect(() =>
      shopOrderInsertSchema.parse({
        shop_id: validUuid,
        customer_name: 'X',
        customer_email: 'x@x.fr',
        items: [],
        total_ht: 0,
        total_ttc: 0,
      }),
    ).toThrow();
  });

  it('17. customer_email invalide → rejet', () => {
    expect(() =>
      shopOrderInsertSchema.parse({
        shop_id: validUuid,
        customer_name: 'X',
        customer_email: 'pas-un-email',
        items: [{ name: 'Test', qty: 1, price_ht: 10 }],
        total_ht: 10,
        total_ttc: 12,
      }),
    ).toThrow();
  });
});
