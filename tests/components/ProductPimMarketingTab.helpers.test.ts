/**
 * Tests vitest pour les helpers ProductPimMarketingTab (Story S-FIX-1).
 */

import { describe, it, expect } from "vitest";
import {
  buildPimJsonExport,
  hasUsefulPimContent,
} from "../../src/app/components/ProductPimMarketingTab.helpers";
import type { EnrichedProduct } from "../../src/app/utils/productEnrichment";

function makeEnriched(overrides: Partial<EnrichedProduct["resolved"]> = {}, definition?: any): EnrichedProduct {
  return {
    gamme: {
      id: "g1",
      slug: "flyer",
      name: "Flyers",
      parent_slug: null,
      matching_rules: {},
      display_order: 0,
      image_url: null,
    },
    definition: definition ?? null,
    resolved: {
      title: "Flyer A5",
      short_description: "",
      description: "",
      h1: "",
      seo_title: "",
      seo_description: "",
      usage_examples: [],
      faq: [],
      keywords: [],
      ...overrides,
    },
  };
}

describe("hasUsefulPimContent", () => {
  it("null -> false", () => {
    expect(hasUsefulPimContent(null)).toBe(false);
  });

  it("resolved tout vide -> false", () => {
    expect(hasUsefulPimContent(makeEnriched())).toBe(false);
  });

  it("short_description rempli -> true", () => {
    expect(
      hasUsefulPimContent(makeEnriched({ short_description: "Accroche" })),
    ).toBe(true);
  });

  it("au moins 1 keyword -> true", () => {
    expect(
      hasUsefulPimContent(makeEnriched({ keywords: ["flyer", "a5"] })),
    ).toBe(true);
  });

  it("usage_examples non-vide -> true", () => {
    expect(
      hasUsefulPimContent(
        makeEnriched({ usage_examples: [{ title: "T", description: "D" }] }),
      ),
    ).toBe(true);
  });
});

describe("buildPimJsonExport", () => {
  it("null -> JSON erreur explicite", () => {
    const json = buildPimJsonExport(null);
    expect(json).toContain("no PIM match");
    const parsed = JSON.parse(json);
    expect(parsed.error).toBeDefined();
  });

  it("enriched complet -> sections marketing + seo + metadata + structured_data", () => {
    const enriched = makeEnriched(
      {
        title: "Flyer A5",
        short_description: "Le flyer parfait",
        description: "<p>Description longue</p>",
        h1: "Flyer A5 - Impression haute qualite",
        seo_title: "Flyer A5 | Magrit",
        seo_description: "Achetez votre flyer A5",
        keywords: ["flyer", "a5", "imprimerie"],
        usage_examples: [{ title: "Soiree", description: "Promo evenement" }],
        faq: [{ question: "Quel papier ?", answer: "135g par defaut" }],
      },
      {
        id: "d1",
        gamme_slug: "flyer",
        variation_filter: {},
        locale: "fr",
        name: "Flyer A5 fr",
        keywords: null,
        title_template: null,
        short_description_template: null,
        description_template: null,
        h1_template: null,
        seo_title: null,
        seo_description: null,
        schema_org_type: "Product",
        usage_examples: [],
        faq: [],
        quality_score: 87,
        generated_by: "llm",
        validated_by: "human",
      },
    );
    const json = buildPimJsonExport(enriched);
    const parsed = JSON.parse(json);
    expect(parsed.gamme.slug).toBe("flyer");
    expect(parsed.marketing.title).toBe("Flyer A5");
    expect(parsed.marketing.short_description).toBe("Le flyer parfait");
    expect(parsed.marketing.usage_examples).toHaveLength(1);
    expect(parsed.marketing.faq).toHaveLength(1);
    expect(parsed.seo.h1).toBeDefined();
    expect(parsed.seo.keywords).toEqual(["flyer", "a5", "imprimerie"]);
    expect(parsed.structured_data.type).toBe("Product");
    expect(parsed.metadata.quality_score).toBe(87);
    expect(parsed.metadata.validated_by).toBe("human");
  });

  it("filtre les sections vides", () => {
    const enriched = makeEnriched({ title: "Flyer A5" });
    const json = buildPimJsonExport(enriched);
    const parsed = JSON.parse(json);
    expect(parsed.marketing.title).toBe("Flyer A5");
    // Pas de seo / structured_data / metadata car definition null
    expect(parsed.seo).toBeUndefined();
    expect(parsed.structured_data).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
  });

  it("output pretty 2-espaces (verifiable visuellement)", () => {
    const enriched = makeEnriched({ title: "T", short_description: "S" });
    const json = buildPimJsonExport(enriched);
    expect(json).toContain('\n  "gamme":');
    expect(json).toContain('\n    "slug":'); // 4 espaces = 2 niveaux d indentation
  });

  it("keywords vides ou usage_examples vides -> omis", () => {
    const enriched = makeEnriched({
      title: "T",
      keywords: [],
      usage_examples: [],
    });
    const json = buildPimJsonExport(enriched);
    const parsed = JSON.parse(json);
    expect(parsed.marketing?.keywords).toBeUndefined();
    expect(parsed.marketing?.usage_examples).toBeUndefined();
  });
});
