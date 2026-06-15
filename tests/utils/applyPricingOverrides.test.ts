/**
 * Tests A4.5 — applyPricingOverrides (helper pur).
 */

import { describe, it, expect } from "vitest";
import { applyPricingOverrides } from "../../src/app/utils/applyPricingOverrides";

describe("applyPricingOverrides — A4.5 tarif négocié per-shop", () => {
  const baseProducts = [
    { product_id: "lib-001", price_ht: 100, name: "Carte" },
    { product_id: "lib-002", price_ht: 250, name: "Flyer" },
    { product_id: "lib-003", price_ht: 500, name: "Brochure" },
  ];

  it("remplace price_ht par l'override quand match (par library_product_id)", () => {
    const out = applyPricingOverrides(baseProducts, [
      { library_product_id: "lib-001", price_ht_override: 85 },
    ]);
    expect(out[0].price_ht).toBe(85);
    expect(out[0].price_ht_override).toBe(85);
  });

  it("conserve price_ht catalogue + price_ht_override=null quand pas de match", () => {
    const out = applyPricingOverrides(baseProducts, [
      { library_product_id: "lib-999", price_ht_override: 1 },
    ]);
    expect(out[0].price_ht).toBe(100);
    expect(out[0].price_ht_override).toBe(null);
    expect(out[1].price_ht).toBe(250);
    expect(out[1].price_ht_override).toBe(null);
  });

  it("applique plusieurs overrides en une passe", () => {
    const out = applyPricingOverrides(baseProducts, [
      { library_product_id: "lib-001", price_ht_override: 85 },
      { library_product_id: "lib-003", price_ht_override: 420 },
    ]);
    expect(out[0].price_ht).toBe(85);
    expect(out[1].price_ht).toBe(250); // pas d'override
    expect(out[2].price_ht).toBe(420);
  });

  it("ignore les produits sans product_id (legacy shop_products)", () => {
    const products = [
      { product_id: null, price_ht: 99, name: "Legacy manual" },
      { product_id: "lib-001", price_ht: 100, name: "Library" },
    ];
    const out = applyPricingOverrides(products, [
      { library_product_id: "lib-001", price_ht_override: 85 },
    ]);
    expect(out[0].price_ht).toBe(99);
    expect(out[0].price_ht_override).toBe(null);
    expect(out[1].price_ht).toBe(85);
  });

  it("retourne tous null quand overrides vides", () => {
    const out = applyPricingOverrides(baseProducts, []);
    expect(out).toHaveLength(3);
    out.forEach((p, i) => {
      expect(p.price_ht).toBe(baseProducts[i].price_ht);
      expect(p.price_ht_override).toBe(null);
    });
  });

  it("ne mute pas les inputs (immutabilité)", () => {
    const products = [{ product_id: "lib-001", price_ht: 100 }];
    const overrides = [{ library_product_id: "lib-001", price_ht_override: 85 }];
    applyPricingOverrides(products, overrides);
    expect(products[0].price_ht).toBe(100);
    expect(overrides[0].price_ht_override).toBe(85);
  });

  it("ignore les overrides malformés (defensif)", () => {
    const out = applyPricingOverrides(baseProducts, [
      { library_product_id: "lib-001", price_ht_override: 85 },
      // @ts-expect-error test malformé
      { library_product_id: null, price_ht_override: 1 },
      // @ts-expect-error test malformé
      { library_product_id: "lib-002", price_ht_override: "abc" },
    ]);
    expect(out[0].price_ht).toBe(85);
    expect(out[1].price_ht).toBe(250); // override malformé ignoré
  });

  it("retourne [] sur products non array", () => {
    // @ts-expect-error test defensif
    expect(applyPricingOverrides(null, [])).toEqual([]);
    // @ts-expect-error test defensif
    expect(applyPricingOverrides(undefined, [])).toEqual([]);
  });

  it("traite overrides=null comme overrides vides", () => {
    // @ts-expect-error test defensif
    const out = applyPricingOverrides(baseProducts, null);
    expect(out).toHaveLength(3);
    out.forEach((p) => expect(p.price_ht_override).toBe(null));
  });
});
