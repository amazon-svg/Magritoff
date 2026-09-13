/**
 * Renderer XLSX (story E10.18d) — tests UNITAIRES du point de conversion
 * UNIQUE `string -> number` (contrat §8.24 point 5 regle 1, point 6
 * exigence 6). Le test DE FICHIER DE REFERENCE (dezippage reel) vit dans
 * `xlsx-renderer.reference.test.ts` ; ce fichier-ci ne touche a AUCUN octet
 * produit, seulement a la fonction pure.
 */
import { describe, expect, it } from 'vitest';
import { toSpreadsheetNumber } from '@/modules/order-exports/application/renderers/xlsx-renderer';

describe('toSpreadsheetNumber — point de conversion UNIQUE string -> number', () => {
  it('convertit un decimal simple', () => {
    expect(toSpreadsheetNumber('1234.50')).toBe(1234.5);
    expect(toSpreadsheetNumber('0.00')).toBe(0);
  });

  it('convertit un entier sans point decimal', () => {
    expect(toSpreadsheetNumber('218')).toBe(218);
  });

  it('preserve un negatif (global_discount, discount_rate peuvent l etre)', () => {
    expect(toSpreadsheetNumber('-5.00')).toBe(-5);
    expect(toSpreadsheetNumber('-0.0909')).toBeCloseTo(-0.0909, 10);
  });

  it('ne remultiplie ni n arrondit une valeur a quatre decimales ("PU HT indicatif")', () => {
    expect(toSpreadsheetNumber('333.3333')).toBeCloseTo(333.3333, 10);
    expect(toSpreadsheetNumber('0.0900')).toBe(0.09);
  });

  it('accepte une grande valeur numeric(12,2)', () => {
    expect(toSpreadsheetNumber('9999999999.99')).toBeCloseTo(9999999999.99, 2);
  });

  it('refuse une chaine qui n est pas un decimal STRICT', () => {
    for (const invalid of ['1,234.50', 'abc', '1e10', 'NaN', 'Infinity', '', '12.', '.5', '1.2.3', ' 5.00', '5.00 ']) {
      expect(() => toSpreadsheetNumber(invalid), `attendu un throw pour ${JSON.stringify(invalid)}`).toThrow(TypeError);
    }
  });

  it('refuse un resultat NON FINI (chaine de chiffres valide mais hors plage representable)', () => {
    const tooLarge = '9'.repeat(400);
    expect(() => toSpreadsheetNumber(tooLarge)).toThrow(TypeError);
  });
});
