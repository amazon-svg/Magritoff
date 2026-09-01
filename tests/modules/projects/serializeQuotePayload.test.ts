/**
 * serializeQuotePayloadMoney — normalisation des montants avant persistance
 * dans `project_items.quote_payload` (E10.1, C3 qa-review).
 */
import { describe, expect, it } from 'vitest';
import {
  serializeQuotePayloadMoney,
  toMoneyString,
} from '@/modules/projects/ui/helpers/serializeQuotePayload';

describe('toMoneyString', () => {
  it('serialise un flottant fini en chaine decimale a deux decimales', () => {
    expect(toMoneyString(89.9)).toBe('89.90');
    expect(toMoneyString(0)).toBe('0.00');
    expect(toMoneyString(1234)).toBe('1234.00');
  });

  it('laisse une chaine Money deja valide inchangee', () => {
    expect(toMoneyString('1234.50')).toBe('1234.50');
  });

  it('rend null pour une valeur ni flottant fini ni chaine Money valide', () => {
    expect(toMoneyString('abc')).toBeNull();
    expect(toMoneyString(Number.NaN)).toBeNull();
    expect(toMoneyString(undefined)).toBeNull();
    expect(toMoneyString(null)).toBeNull();
  });
});

describe('serializeQuotePayloadMoney', () => {
  it('serialise price et clariprintQuote.priceHT en chaine decimale', () => {
    const product = {
      id: 'p1',
      name: 'Flyer A5',
      price: 89.9,
      clariprintQuote: { success: true, priceHT: 76.4 },
    };
    const result = serializeQuotePayloadMoney(product);
    expect(result['price']).toBe('89.90');
    expect((result['clariprintQuote'] as Record<string, unknown>)['priceHT']).toBe('76.40');
  });

  it('serialise les couts Clariprint imbriques', () => {
    const product = {
      name: 'Brochure',
      clariprintQuote: {
        success: true,
        costs: { paper: 10, print: 20.5, makeready: 5, packaging: 2, delivery: 8.25, total: 45.75 },
      },
    };
    const result = serializeQuotePayloadMoney(product);
    const costs = (result['clariprintQuote'] as Record<string, unknown>)['costs'] as Record<
      string,
      unknown
    >;
    expect(costs).toEqual({
      paper: '10.00',
      print: '20.50',
      makeready: '5.00',
      packaging: '2.00',
      delivery: '8.25',
      total: '45.75',
    });
  });

  it('ne modifie pas les champs non monetaires, ni l objet source', () => {
    const product = { name: 'Carte de visite', quantity: 500, format: 'A5', price: 12.3 };
    const result = serializeQuotePayloadMoney(product);
    expect(result['name']).toBe('Carte de visite');
    expect(result['quantity']).toBe(500);
    expect(result['format']).toBe('A5');
    expect(product.price).toBe(12.3); // objet source jamais mute
  });

  it('ne casse pas sur un produit sans price ni clariprintQuote', () => {
    const product = { name: 'Sans prix' };
    expect(serializeQuotePayloadMoney(product)).toEqual({ name: 'Sans prix' });
  });
});
