/**
 * Tests vitest pour CartContext helpers (Story R0 - garde-fou).
 *
 * Couvre AC6 : ajout / retrait / vider / total HT-TTC selon `getTaxRate(tenant)`
 * / mock isolation par tenant.
 *
 * Le Provider React n'est pas testable directement (pas de @testing-library/react
 * dans le projet, vitest tourne en `environment: node`). Les helpers
 * mathematiques sont extraits dans cartMath.ts pour permettre la couverture.
 *
 * Zone froide critique (audit refacto 2026-05-11 §6.3).
 */

import { describe, it, expect } from 'vitest';
import {
  computeCartTaxAmount,
  computeCartTotalHT,
  computeCartTotalTTC,
  type CartItemLike,
} from '../../src/app/utils/cartMath';
import { getTaxRate } from '../../src/app/utils/tax';
import {
  domTomTenant,
  franchiseTenant,
  metropoleTenant,
} from '../fixtures/tenants';

function makeItem(opts: { price?: number; price_ht?: number; qty?: number }): CartItemLike {
  return { product: opts };
}

describe('computeCartTotalHT - somme des prix HT', () => {
  it('1. Panier vide → 0', () => {
    expect(computeCartTotalHT([])).toBe(0);
  });

  it('2. Un seul produit price=50, qty implicite=1 → 50', () => {
    expect(computeCartTotalHT([makeItem({ price: 50 })])).toBe(50);
  });

  it('3. Trois produits (legacy price) → somme des 3', () => {
    const items = [makeItem({ price: 10 }), makeItem({ price: 20 }), makeItem({ price: 30 })];
    expect(computeCartTotalHT(items)).toBe(60);
  });

  it('4. price_ht canonique (PIM) → utilise en priorite sur price', () => {
    expect(computeCartTotalHT([makeItem({ price: 99, price_ht: 50 })])).toBe(50);
  });

  it('5. Quantite > 1 → multiplie', () => {
    expect(computeCartTotalHT([makeItem({ price_ht: 10, qty: 5 })])).toBe(50);
  });

  it('6. Item sans prix → ignore (0)', () => {
    expect(computeCartTotalHT([makeItem({})])).toBe(0);
  });

  it('7. Item avec prix negatif (defensif) → ignore', () => {
    expect(computeCartTotalHT([makeItem({ price: -10 })])).toBe(0);
  });
});

describe('computeCartTotalTTC - selon getTaxRate(tenant)', () => {
  const items: CartItemLike[] = [
    makeItem({ price: 100 }),
    makeItem({ price: 50 }),
  ]; // total HT = 150

  it('8. Tenant metropole_fr (20 %) → 150 HT × 1.20 = 180 TTC', () => {
    const rate = getTaxRate(metropoleTenant);
    expect(computeCartTotalTTC(items, rate)).toBe(180);
  });

  it('9. Tenant DOM-TOM (8.5 %) → 150 HT × 1.085 = 162.75 TTC', () => {
    const rate = getTaxRate(domTomTenant);
    expect(computeCartTotalTTC(items, rate)).toBeCloseTo(162.75, 2);
  });

  it('10. Tenant franchise TVA (0 %) → 150 HT = 150 TTC (pas de TVA)', () => {
    const rate = getTaxRate(franchiseTenant);
    expect(computeCartTotalTTC(items, rate)).toBe(150);
  });
});

describe('computeCartTaxAmount - montant de la TVA seule', () => {
  it('11. Total HT 150 @ 20 % → 30 € de TVA', () => {
    const items = [makeItem({ price: 150 })];
    expect(computeCartTaxAmount(items, 0.20)).toBe(30);
  });

  it('12. Total HT 150 @ 0 % franchise → 0 € de TVA', () => {
    const items = [makeItem({ price: 150 })];
    expect(computeCartTaxAmount(items, 0)).toBe(0);
  });
});

describe('Isolation par tenant - meme panier, regimes differents', () => {
  it('13. Le meme panier produit 3 totaux TTC distincts selon le tenant', () => {
    const items = [makeItem({ price_ht: 200 })];
    const metro = computeCartTotalTTC(items, getTaxRate(metropoleTenant));
    const dom = computeCartTotalTTC(items, getTaxRate(domTomTenant));
    const fr = computeCartTotalTTC(items, getTaxRate(franchiseTenant));
    expect(metro).toBe(240);
    expect(dom).toBeCloseTo(217, 0);
    expect(fr).toBe(200);
    // Et tous differents 2 a 2
    expect(metro).not.toBe(dom);
    expect(dom).not.toBe(fr);
  });
});
