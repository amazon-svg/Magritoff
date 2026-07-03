/**
 * S-QUOTES-2 — Tests unitaires quoteMath (synchro prix <-> marge, cout 0).
 */

import { describe, expect, it } from 'vitest';
import {
  isMarginEditable,
  lineTotal,
  marginFromPrice,
  priceFromMargin,
  round2,
  sumLinesHT,
} from '../../src/app/utils/quoteMath';

describe('quoteMath — round2', () => {
  it('arrondit a 2 decimales', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(80.126)).toBe(80.13);
  });
});

describe('quoteMath — priceFromMargin (markup sur cout)', () => {
  it('applique la marge au cout', () => {
    expect(priceFromMargin(100, 30)).toBe(130);
    expect(priceFromMargin(80, 25)).toBe(100);
    expect(priceFromMargin(0.1, 60)).toBe(0.16);
  });
  it('marge 0 -> prix = cout', () => {
    expect(priceFromMargin(50, 0)).toBe(50);
  });
  it('valeurs non finies -> 0', () => {
    expect(priceFromMargin(NaN, 30)).toBe(0);
    expect(priceFromMargin(100, NaN)).toBe(100);
  });
});

describe('quoteMath — marginFromPrice', () => {
  it('calcule la marge depuis cout + prix', () => {
    expect(marginFromPrice(100, 130)).toBe(30);
    expect(marginFromPrice(80, 100)).toBe(25);
  });
  it('cout 0 -> marge 0 (non calculable)', () => {
    expect(marginFromPrice(0, 120)).toBe(0);
    expect(marginFromPrice(-5, 120)).toBe(0);
  });
  it('reciprocite avec priceFromMargin', () => {
    const cost = 42;
    const price = priceFromMargin(cost, 33);
    expect(marginFromPrice(cost, price)).toBeCloseTo(33, 1);
  });
});

describe('quoteMath — lineTotal', () => {
  it('quantite * prix unitaire', () => {
    expect(lineTotal(500, 0.16)).toBe(80);
    expect(lineTotal(3, 12.5)).toBe(37.5);
  });
  it('quantite invalide -> 0', () => {
    expect(lineTotal(0, 10)).toBe(0);
    expect(lineTotal(-2, 10)).toBe(0);
  });
});

describe('quoteMath — isMarginEditable', () => {
  it('cout > 0 -> editable', () => {
    expect(isMarginEditable(0.01)).toBe(true);
  });
  it('cout <= 0 -> non editable', () => {
    expect(isMarginEditable(0)).toBe(false);
    expect(isMarginEditable(-1)).toBe(false);
  });
});

describe('quoteMath — sumLinesHT', () => {
  it('somme les totaux de lignes', () => {
    expect(sumLinesHT([{ line_total_ht: 80 }, { line_total_ht: 37.5 }])).toBe(117.5);
  });
  it('ignore les valeurs non finies', () => {
    expect(sumLinesHT([{ line_total_ht: 10 }, { line_total_ht: NaN as any }])).toBe(10);
  });
});
