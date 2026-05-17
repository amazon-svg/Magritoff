/**
 * Tests vitest pour les helpers ProductOverlay (Story S2.4, Epic 2).
 */

import { describe, it, expect } from "vitest";
import {
  extractInitialOptions,
  extractClariprintConfigFromAtelierProduct,
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

describe("extractClariprintConfigFromAtelierProduct (bug fix volet edition 2026-05-15)", () => {
  it("input null/undefined -> objet vide", () => {
    expect(extractClariprintConfigFromAtelierProduct(null)).toEqual({});
    expect(extractClariprintConfigFromAtelierProduct(undefined)).toEqual({});
  });

  it("produit atelier UI/LLM typique -> overlay lit les vraies valeurs (plus de DEFAULT_OPTIONS)", () => {
    // Cas reel : produit retourne par parseConfigsToProducts depuis le chat LLM
    const localProduct = {
      id: "p-1",
      name: "Cartes de visite",
      quantity: 500,
      format: "85x55",
      material: "Papier couche brillant",
      weight: 350,
      dimensions: { width: 85, height: 55 },
      printing: { recto: "Quadrichromie (CMJN)", verso: "Quadrichromie (CMJN)" },
      finishRecto: "Pelliculage mat",
      finishVerso: "Pelliculage mat",
      clariprintData: {
        kind: "leaflet",
        reference: "Cartes de visite",
        front_colors: ["4-color"],
      },
    };
    const cfg = extractClariprintConfigFromAtelierProduct(localProduct);
    // Verifie que ce qu'on extrait fait que l'overlay ne tombe PAS sur les defauts
    const opts = extractInitialOptions({ config: { clariprintData: cfg } } as unknown as ShopProduct);
    expect(opts.quantity).toBe(500);
    expect(opts.format).toBe("85x55");
    expect(opts.paper).toBe("350g");
    expect(opts.printing).toBe("recto-verso");
    expect(opts.finishingFront).toBe("mat");
    expect(opts.finishingVerso).toBe("mat");
  });

  it("printing.verso 'Sans impression' -> recto", () => {
    const cfg = extractClariprintConfigFromAtelierProduct({
      quantity: 100,
      format: "A5",
      printing: { recto: "Quadrichromie", verso: "Sans impression" },
    });
    expect(cfg.printing).toBe("recto");
    expect(cfg.back_colors).toBe(0);
  });

  it("clariprintData LLM brut (papers objet, width/height string CM) -> conversion mm", () => {
    // Format LLM brut tel que retourne par demoConfigs / Claude :
    // width/height sont des STRINGS en CENTIMETRES (convention LLM Clariprint).
    // "8.5" / "5.5" cm = 85 / 55 mm (carte de visite).
    const cfg = extractClariprintConfigFromAtelierProduct({
      quantity: 500,
      clariprintData: {
        kind: "leaflet",
        width: "8.5",
        height: "5.5",
        papers: { custom: { quality: "Couche brillant", weight: "350" } },
        finishing_front: "PELLIC_ACETATE_MAT",
        finishing_back: "PELLIC_ACETATE_MAT",
        back_colors: ["4-color"],
      },
    });
    expect(cfg.width).toBe(85);
    expect(cfg.height).toBe(55);
    expect(cfg.papers).toEqual(["350g"]);
    expect(cfg.finishing_front).toBe("mat");
    expect(cfg.finishing_back).toBe("mat");
    expect(cfg.printing).toBe("recto-verso");
    expect(cfg.kind).toBe("leaflet");
  });

  it("scenario reel user 2026-05-17 : Affiches A2 sans dimensions, clariprintData en cm", () => {
    // Reproduit EXACTEMENT le log console d'Arnaud : pas de field `dimensions`,
    // format verbose label, clariprintData.width/height en CM strings.
    const cfg = extractClariprintConfigFromAtelierProduct({
      name: "Affiches A2 brillantes recto",
      quantity: 250,
      format: "A2 (420 × 594 mm)",
      // dimensions: undefined  <- absent
      material: "Papier couché brillant",
      weight: 170,
      finishRecto: "Pelliculage brillant",
      printing: { recto: "Quadrichromie (CMJN)", verso: "Sans impression" },
      clariprintData: {
        kind: "poster",
        width: "42",
        height: "59.4",
        papers: { custom: { quality: "Couche brillant", weight: "170" } },
        finishing_front: "PELLIC_BRILL",
      },
    });
    // Apres fix v3 : le label "A2 (420 × 594 mm)" extrait -> "A2" -> FORMAT_DIMENSIONS.a2 = 420x594
    expect(cfg.format).toBe("A2");
    expect(cfg.width).toBe(420);
    expect(cfg.height).toBe(594);
    expect(cfg.papers).toEqual(["170g"]);
    expect(cfg.finishing_front).toBe("brillant");
    expect(cfg.printing).toBe("recto");
  });

  it("post-edit : raw Clariprint prime sur UI obsolete (papers array remplace material UI)", () => {
    // Apres edition via overlay, localProduct est merge avec updatedClariprint
    // (cf. ProductCard onConfirm). raw.papers ["170g"] doit primer sur weight UI (350).
    const cfg = extractClariprintConfigFromAtelierProduct({
      quantity: 1000,
      weight: 350, // ancien
      material: "Papier couche brillant",
      clariprintData: {
        kind: "flyer",
        papers: ["170g"], // post-edit, format array normalise
        finishing_front: "brillant",
        printing: "recto",
      },
    });
    expect(cfg.papers).toEqual(["170g"]);
    expect(cfg.finishing_front).toBe("brillant");
    expect(cfg.printing).toBe("recto");
    expect(cfg.back_colors).toBe(0);
  });

  it("regex grammage depuis material si weight absent", () => {
    const cfg = extractClariprintConfigFromAtelierProduct({
      material: "Papier couche brillant 250g",
    });
    expect(cfg.papers).toEqual(["250g"]);
  });

  it("finitions soft-touch / brillant reconnues", () => {
    expect(
      extractClariprintConfigFromAtelierProduct({ finishRecto: "Soft-touch" }).finishing_front,
    ).toBe("soft-touch");
    expect(
      extractClariprintConfigFromAtelierProduct({ finishRecto: "Pelliculage brillant" })
        .finishing_front,
    ).toBe("brillant");
    expect(
      extractClariprintConfigFromAtelierProduct({ finishRecto: "Sans finition" }).finishing_front,
    ).toBe("aucun");
    expect(
      extractClariprintConfigFromAtelierProduct({ finishRecto: "" }).finishing_front,
    ).toBe("aucun");
  });

  it("preserve kind / folds / pages / front_colors depuis raw clariprintData", () => {
    const cfg = extractClariprintConfigFromAtelierProduct({
      clariprintData: { kind: "brochure", folds: 2, pages: 16, front_colors: 4 },
    });
    expect(cfg.kind).toBe("brochure");
    expect(cfg.folds).toBe(2);
    expect(cfg.pages).toBe(16);
    expect(cfg.front_colors).toBe(4);
  });

  it("format UI inconnu + dimensions presentes -> matchStandardFormat depuis dims", () => {
    const cfg = extractClariprintConfigFromAtelierProduct({
      format: "85 × 55 mm (format standard)",
      dimensions: { width: 85, height: 55 },
    });
    // Format UI ne match pas parseFormatToWidthHeight (label verbose),
    // mais matchStandardFormat reconnait depuis dims -> "85x55"
    expect(cfg.width).toBe(85);
    expect(cfg.height).toBe(55);
    expect(cfg.format).toBe("85x55");
  });

  it("Affiches A2 (420x594) -> format 'A2' resolu depuis dimensions (bug user 2026-05-17)", () => {
    // Cas reel signale par Arnaud : "Affiches A2 brillantes" -> le format
    // s'affichait sur A6 (premier option du select) parce qu'A2 n'etait pas
    // dans FORMATS et que le helper synthestisait "420x594" non present
    // dans le select non plus.
    const cfg = extractClariprintConfigFromAtelierProduct({
      name: "Affiches A2 brillantes",
      quantity: 250,
      format: "A2 (420 × 594 mm)",
      dimensions: { width: 420, height: 594 },
      weight: 170,
      finishRecto: "Pelliculage brillant",
    });
    expect(cfg.format).toBe("A2");
    expect(cfg.width).toBe(420);
    expect(cfg.height).toBe(594);
    expect(cfg.papers).toEqual(["170g"]);
    expect(cfg.finishing_front).toBe("brillant");
  });

  it("matchStandardFormat tolere tolerance +-2mm + orientation paysage", () => {
    // A4 paysage : 297x210 doit etre reconnu comme "A4"
    const cfg1 = extractClariprintConfigFromAtelierProduct({
      dimensions: { width: 297, height: 210 },
    });
    expect(cfg1.format).toBe("A4");
    // Tolerance : 421x593 doit etre reconnu comme "A2"
    const cfg2 = extractClariprintConfigFromAtelierProduct({
      dimensions: { width: 421, height: 593 },
    });
    expect(cfg2.format).toBe("A2");
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
