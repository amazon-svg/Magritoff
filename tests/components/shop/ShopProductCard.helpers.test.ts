/**
 * Tests vitest pour les helpers ShopProductCard (Story S2.3, Epic 2).
 */

import { describe, it, expect } from "vitest";
import {
  resolveMockupTemplate,
  resolveProductDimensions,
  parseFormatToDimensions,
} from "../../../src/app/components/shop/ShopProductCard.helpers";
import type { ShopProduct } from "../../../src/app/contexts/ShopsContext";

function makeProduct(config: Record<string, unknown>): ShopProduct {
  return {
    id: "p-test",
    shop_id: "s-test",
    product_id: null,
    name: "Produit Test",
    category: "Test",
    description: "",
    price_ht: 100,
    image_url: "",
    config,
    display_order: 0,
    created_at: undefined,
  } as ShopProduct;
}

describe("resolveMockupTemplate — mapping product.kind → template", () => {
  it("kind='flyer' → flyer", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "flyer" }))).toBe("flyer");
  });

  it("kind='carte_visite' → carteVisite", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "carte_visite" }))).toBe(
      "carteVisite",
    );
  });

  it("kind='card' (alias) → carteVisite", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "card" }))).toBe("carteVisite");
  });

  it("kind='visite' (alias) → carteVisite", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "visite" }))).toBe("carteVisite");
  });

  it("kind='brochure' → brochure", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "brochure" }))).toBe("brochure");
  });

  it("kind='depliant' (alias) → brochure", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "depliant" }))).toBe("brochure");
  });

  it("kind='etiquette' → etiquette", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "etiquette" }))).toBe(
      "etiquette",
    );
  });

  it("kind='sticker' (alias) → etiquette", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "sticker" }))).toBe("etiquette");
  });

  it("kind='kakemono' → kakemono", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "kakemono" }))).toBe("kakemono");
  });

  it("kind='roll-up' (alias avec tiret) → kakemono", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "roll-up" }))).toBe("kakemono");
  });

  it("kind='affiche' (alias flyer) → flyer", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "affiche" }))).toBe("flyer");
  });

  it("kind UPPERCASE → normalise lowercase", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "BROCHURE" }))).toBe("brochure");
  });

  it("kind avec espaces → trim", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "  flyer  " }))).toBe("flyer");
  });

  it("kind=undefined → fallback flyer", () => {
    expect(resolveMockupTemplate(makeProduct({}))).toBe("flyer");
  });

  it("kind='unknown_xyz' → fallback flyer", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: "unknown_xyz" }))).toBe("flyer");
  });

  it("kind non-string (defensif) → fallback flyer", () => {
    expect(resolveMockupTemplate(makeProduct({ kind: 42 as any }))).toBe("flyer");
  });

  // P13 (2026-06-16) — Path atelier : kind dans clariprintData (chat IA enriched)
  it("atelier path : clariprintData.kind → template (carte_visite)", () => {
    const atelierProduct = { clariprintData: { kind: "carte_visite" } };
    expect(resolveMockupTemplate(atelierProduct as any)).toBe("carteVisite");
  });

  it("atelier path : clariprintData.kind='brochure' → brochure", () => {
    expect(resolveMockupTemplate({ clariprintData: { kind: "brochure" } } as any)).toBe(
      "brochure",
    );
  });

  it("atelier path : clariprintData.kind='kakemono' → kakemono", () => {
    expect(resolveMockupTemplate({ clariprintData: { kind: "kakemono" } } as any)).toBe(
      "kakemono",
    );
  });

  it("priorité config.kind sur clariprintData.kind quand les 2 présents", () => {
    // config.kind doit primer (path boutique B2B explicite)
    const p = { config: { kind: "flyer" }, clariprintData: { kind: "brochure" } };
    expect(resolveMockupTemplate(p as any)).toBe("flyer");
  });

  it("atelier path : aucun kind nulle part → fallback flyer", () => {
    expect(resolveMockupTemplate({ clariprintData: {} } as any)).toBe("flyer");
    expect(resolveMockupTemplate({} as any)).toBe("flyer");
  });

  // P14 (2026-06-16) — Inférence depuis name + category quand kind=null
  // (cas Manitou : tous les products library ont config.kind=null en DB)
  describe("inférence name/category quand kind absent (P14)", () => {
    it("name='Cartes de visite' (kind null) → carteVisite", () => {
      expect(
        resolveMockupTemplate({ config: { kind: null }, name: "Cartes de visite" } as any),
      ).toBe("carteVisite");
    });

    it("name='Carte commerciale Premium' → carteVisite", () => {
      expect(
        resolveMockupTemplate({ config: {}, name: "Carte commerciale Premium 350g" } as any),
      ).toBe("carteVisite");
    });

    it("name='Brochure 16 pages' → brochure", () => {
      expect(
        resolveMockupTemplate({ name: "Brochure 16 pages" } as any),
      ).toBe("brochure");
    });

    it("name='Catalogue produit' → brochure", () => {
      expect(resolveMockupTemplate({ name: "Catalogue produit" } as any)).toBe("brochure");
    });

    it("name='Packaging ultra-premium' (cas Manitou) → brochure", () => {
      expect(
        resolveMockupTemplate({ name: "Packaging ultra-premium - Finitions combinées" } as any),
      ).toBe("brochure");
    });

    it("name='Étiquettes adhésives' → etiquette", () => {
      expect(resolveMockupTemplate({ name: "Étiquettes adhésives produit" } as any)).toBe(
        "etiquette",
      );
    });

    it("name='Roll-up standard 80×200' → kakemono", () => {
      expect(resolveMockupTemplate({ name: "Roll-up standard 80×200" } as any)).toBe(
        "kakemono",
      );
    });

    it("name='Banderole extérieure' → kakemono", () => {
      expect(resolveMockupTemplate({ name: "Banderole extérieure 400×100" } as any)).toBe(
        "kakemono",
      );
    });

    it("name='Flyer A5 promo' → flyer", () => {
      expect(resolveMockupTemplate({ name: "Flyer A5 promo" } as any)).toBe("flyer");
    });

    it("name vide et category vide → flyer (safe default)", () => {
      expect(resolveMockupTemplate({ name: "", category: "" } as any)).toBe("flyer");
    });

    it("category 'Cartes' suffit même si name générique", () => {
      expect(
        resolveMockupTemplate({ name: "Produit 001", category: "Cartes de visite" } as any),
      ).toBe("carteVisite");
    });
  });
});

describe("parseFormatToDimensions", () => {
  it("'A5' → {148, 210}", () => {
    expect(parseFormatToDimensions("A5")).toEqual({ width: 148, height: 210 });
  });

  it("'A4' → {210, 297}", () => {
    expect(parseFormatToDimensions("A4")).toEqual({ width: 210, height: 297 });
  });

  it("'a4' lowercase → {210, 297}", () => {
    expect(parseFormatToDimensions("a4")).toEqual({ width: 210, height: 297 });
  });

  it("'85x55' → {85, 55}", () => {
    expect(parseFormatToDimensions("85x55")).toEqual({ width: 85, height: 55 });
  });

  it("'210x297mm' → {210, 297}", () => {
    expect(parseFormatToDimensions("210x297mm")).toEqual({ width: 210, height: 297 });
  });

  it("format avec espaces '85 x 55' → {85, 55}", () => {
    expect(parseFormatToDimensions("85 x 55")).toEqual({ width: 85, height: 55 });
  });

  it("format inconnu '¶£' → null", () => {
    expect(parseFormatToDimensions("¶£")).toBeNull();
  });

  it("format vide → null", () => {
    expect(parseFormatToDimensions("")).toBeNull();
  });

  it("format undefined → null", () => {
    expect(parseFormatToDimensions(undefined)).toBeNull();
  });

  it("format null → null", () => {
    expect(parseFormatToDimensions(null)).toBeNull();
  });
});

describe("resolveProductDimensions", () => {
  it("config.width=85, height=55 → {85, 55}", () => {
    expect(resolveProductDimensions(makeProduct({ width: 85, height: 55 }))).toEqual({
      width: 85,
      height: 55,
    });
  });

  it("config.format='A5' (sans width/height) → {148, 210}", () => {
    expect(resolveProductDimensions(makeProduct({ format: "A5" }))).toEqual({
      width: 148,
      height: 210,
    });
  });

  it("config.format='A4' → {210, 297}", () => {
    expect(resolveProductDimensions(makeProduct({ format: "A4" }))).toEqual({
      width: 210,
      height: 297,
    });
  });

  it("config.format inconnu sans width/height → default A5", () => {
    expect(resolveProductDimensions(makeProduct({ format: "Inconnu" }))).toEqual({
      width: 148,
      height: 210,
    });
  });

  it("config absent (vide) → default A5", () => {
    expect(resolveProductDimensions(makeProduct({}))).toEqual({
      width: 148,
      height: 210,
    });
  });

  it("priorite : width/height numeriques > format", () => {
    expect(
      resolveProductDimensions(makeProduct({ width: 100, height: 100, format: "A4" })),
    ).toEqual({ width: 100, height: 100 });
  });

  it("width=0 (invalide) → fallback format ou default", () => {
    expect(
      resolveProductDimensions(makeProduct({ width: 0, height: 100, format: "A4" })),
    ).toEqual({ width: 210, height: 297 });
  });

  it("width negatif (defensif) → fallback default", () => {
    expect(resolveProductDimensions(makeProduct({ width: -1, height: -1 }))).toEqual({
      width: 148,
      height: 210,
    });
  });
});
