/**
 * Tests vitest pour les helpers ProductOverlay (Story S2.4, Epic 2).
 */

import { describe, it, expect } from "vitest";
import {
  extractInitialOptions,
  buildClariprintPayload,
  parseFormatToWidthHeight,
  formatEuro,
} from "../../../src/app/components/shop/ProductOverlay.helpers";
import type { ShopProduct } from "../../../src/app/contexts/ShopsContext";

function makeProduct(config: Record<string, unknown>): ShopProduct {
  return {
    id: "p-test",
    shop_id: "s-test",
    product_id: null,
    name: "Test",
    category: "",
    description: "",
    price_ht: 0,
    image_url: "",
    config,
    display_order: 0,
    created_at: undefined,
  } as ShopProduct;
}

describe("parseFormatToWidthHeight", () => {
  it("'A5' -> {148, 210}", () => {
    expect(parseFormatToWidthHeight("A5")).toEqual({ width: 148, height: 210 });
  });

  it("'85x55' -> {85, 55}", () => {
    expect(parseFormatToWidthHeight("85x55")).toEqual({ width: 85, height: 55 });
  });

  it("'Custom' -> null (signal pour caller customWidth/customHeight)", () => {
    expect(parseFormatToWidthHeight("Custom")).toBeNull();
  });

  it("format inconnu -> null", () => {
    expect(parseFormatToWidthHeight("zorg")).toBeNull();
  });

  it("undefined / null -> null", () => {
    expect(parseFormatToWidthHeight(undefined)).toBeNull();
    expect(parseFormatToWidthHeight(null)).toBeNull();
  });
});

describe("extractInitialOptions", () => {
  it("config complet via clariprintData", () => {
    const opts = extractInitialOptions(
      makeProduct({
        clariprintData: {
          quantity: 1000,
          format: "A4",
          papers: ["170g"],
          finishing_front: "mat",
          finishing_back: "mat",
          back_colors: 4,
          dorure: "or",
        },
      }),
    );
    expect(opts.quantity).toBe(1000);
    expect(opts.format).toBe("A4");
    expect(opts.paper).toBe("170g");
    expect(opts.finishingFront).toBe("mat");
    expect(opts.finishingVerso).toBe("mat");
    expect(opts.printing).toBe("recto-verso");
    expect(opts.dorure).toBe("or");
  });

  it("config a plat (pas de nesting clariprintData)", () => {
    const opts = extractInitialOptions(
      makeProduct({
        quantity: 250,
        format: "85x55",
        paper: "300g",
        printing: "recto",
      }),
    );
    expect(opts.quantity).toBe(250);
    expect(opts.format).toBe("85x55");
    expect(opts.paper).toBe("300g");
    expect(opts.printing).toBe("recto");
  });

  it("quantity en string -> parsing safe", () => {
    const opts = extractInitialOptions(
      makeProduct({ clariprintData: { quantity: "750" } }),
    );
    expect(opts.quantity).toBe(750);
  });

  it("config absent -> defauts safe (A5/135g/recto)", () => {
    const opts = extractInitialOptions(makeProduct({}));
    expect(opts.quantity).toBe(500);
    expect(opts.format).toBe("A5");
    expect(opts.paper).toBe("135g");
    expect(opts.finishingFront).toBe("aucun");
    expect(opts.printing).toBe("recto");
    expect(opts.dorure).toBe("aucune");
  });

  it("dimensions width/height (pas de format string) -> format synthetique 'WxH'", () => {
    const opts = extractInitialOptions(
      makeProduct({ clariprintData: { width: 100, height: 100 } }),
    );
    expect(opts.format).toBe("100x100");
  });

  it("back_colors=0 -> recto, back_colors>0 -> recto-verso", () => {
    expect(
      extractInitialOptions(makeProduct({ clariprintData: { back_colors: 0 } }))
        .printing,
    ).toBe("recto");
    expect(
      extractInitialOptions(makeProduct({ clariprintData: { back_colors: 4 } }))
        .printing,
    ).toBe("recto-verso");
  });
});

describe("buildClariprintPayload", () => {
  const baseOptions = {
    quantity: 500,
    format: "A5" as const,
    paper: "135g" as const,
    finishingFront: "aucun" as const,
    finishingVerso: "aucun" as const,
    printing: "recto" as const,
    dorure: "aucune" as const,
  };

  it("options standards -> payload Clariprint coherent", () => {
    const payload = buildClariprintPayload(baseOptions, { kind: "flyer" });
    expect(payload.kind).toBe("flyer");
    expect(payload.quantity).toBe(500);
    expect(payload.width).toBe(148);
    expect(payload.height).toBe(210);
    expect(payload.papers).toEqual(["135g"]);
    expect(payload.front_colors).toBe(4);
    expect(payload.back_colors).toBe(0);
    expect(payload.finishing_front).toBeUndefined(); // omis car "aucun"
    expect(payload.dorure).toBeUndefined(); // omis car "aucune"
  });

  it("format Custom -> width/height depuis customWidth/customHeight", () => {
    const payload = buildClariprintPayload(
      { ...baseOptions, format: "Custom", customWidth: 70, customHeight: 70 },
      { kind: "etiquette" },
    );
    expect(payload.width).toBe(70);
    expect(payload.height).toBe(70);
    expect(payload.kind).toBe("etiquette");
  });

  it("recto-verso -> back_colors=4 et finishing_back present si != aucun", () => {
    const payload = buildClariprintPayload(
      {
        ...baseOptions,
        printing: "recto-verso",
        finishingFront: "mat",
        finishingVerso: "brillant",
      },
      { kind: "carte_visite" },
    );
    expect(payload.back_colors).toBe(4);
    expect(payload.finishing_front).toBe("mat");
    expect(payload.finishing_back).toBe("brillant");
  });

  it("dorure 'or' -> incluse, 'aucune' -> omise", () => {
    const withDorure = buildClariprintPayload(
      { ...baseOptions, dorure: "or" },
      { kind: "flyer" },
    );
    expect(withDorure.dorure).toBe("or");

    const noDorure = buildClariprintPayload(
      { ...baseOptions, dorure: "aucune" },
      { kind: "flyer" },
    );
    expect(noDorure.dorure).toBeUndefined();
  });

  it("preserve baseConfig.kind via clariprintData nesting", () => {
    const payload = buildClariprintPayload(baseOptions, {
      clariprintData: { kind: "brochure", folds: 1 },
    });
    expect(payload.kind).toBe("brochure");
    expect(payload.folds).toBe(1); // preserve folds du baseConfig
  });

  it("baseConfig null -> kind default 'flyer'", () => {
    const payload = buildClariprintPayload(baseOptions, null);
    expect(payload.kind).toBe("flyer");
  });

  it("recto seul -> finishing_back ignore meme si fourni", () => {
    const payload = buildClariprintPayload(
      { ...baseOptions, printing: "recto", finishingVerso: "mat" },
      { kind: "flyer" },
    );
    expect(payload.finishing_back).toBeUndefined();
  });
});

describe("formatEuro", () => {
  it("entier -> '500,00 EUR' format FR", () => {
    const formatted = formatEuro(500);
    // Le caractere espace insecable peut varier selon la version Intl
    expect(formatted).toMatch(/500,00\s*€/);
  });

  it("decimal -> 2 decimales", () => {
    expect(formatEuro(123.456)).toMatch(/123,46\s*€/);
  });

  it("0 -> '0,00 EUR'", () => {
    expect(formatEuro(0)).toMatch(/0,00\s*€/);
  });

  it("null / undefined -> '—'", () => {
    expect(formatEuro(null)).toBe("—");
    expect(formatEuro(undefined)).toBe("—");
  });

  it("NaN / Infinity -> '—'", () => {
    expect(formatEuro(NaN)).toBe("—");
    expect(formatEuro(Infinity)).toBe("—");
  });

  it("locale en-US -> format different", () => {
    const formatted = formatEuro(1234.56, "en-US");
    // En-US format : "€1,234.56"
    expect(formatted).toContain("1,234.56");
  });
});
