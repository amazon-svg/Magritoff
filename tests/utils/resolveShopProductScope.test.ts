/**
 * Tests S2.32 — resolveShopProductScope (helper pur).
 * Perimetre produit d'une boutique : voie bibliotheque + voie mode PIM.
 */

import { describe, it, expect } from "vitest";
import { resolveShopProductScope } from "../../src/app/utils/resolveShopProductScope";

const P = (
  id: string,
  library_id: string | null,
  gamme_slug: string | null,
  active: boolean | null = true,
) => ({ id, library_id, gamme_slug, active });

const baseConfig = {
  libraryIds: [] as string[],
  pimCatalogMode: false,
  pimGammeSlugs: [] as string[],
  excludedIds: [] as string[],
};

describe("resolveShopProductScope — S2.32", () => {
  it("voie bibliotheque seule : expose les produits des libraries cochees", () => {
    const products = [
      P("a", "lib-1", "cartes"),
      P("b", "lib-2", "flyers"),
      P("c", "lib-3", "brochures"),
    ];
    const out = resolveShopProductScope(products, { ...baseConfig, libraryIds: ["lib-1", "lib-3"] });
    expect(out.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("mode PIM seul : expose les produits dont la gamme est cochee", () => {
    const products = [
      P("a", "lib-1", "cartes"),
      P("b", "lib-2", "flyers"),
      P("c", "lib-9", "cartes"),
    ];
    const out = resolveShopProductScope(products, {
      ...baseConfig,
      pimCatalogMode: true,
      pimGammeSlugs: ["cartes"],
    });
    expect(out.map((p) => p.id).sort()).toEqual(["a", "c"]);
  });

  it("PIM + bibliotheques : union, deduplication par id", () => {
    const products = [
      P("a", "lib-1", "cartes"), // via library ET via pim
      P("a", "lib-1", "cartes"), // doublon (concat de 2 requetes)
      P("b", "lib-2", "flyers"), // via pim seulement
      P("c", "lib-1", "brochures"), // via library seulement
    ];
    const out = resolveShopProductScope(products, {
      ...baseConfig,
      libraryIds: ["lib-1"],
      pimCatalogMode: true,
      pimGammeSlugs: ["cartes", "flyers"],
    });
    expect(out.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("mode PIM avec sous-ensemble de gammes : n'expose que les gammes cochees", () => {
    const products = [
      P("a", "lib-1", "cartes"),
      P("b", "lib-1", "flyers"),
      P("c", "lib-1", "brochures"),
    ];
    const out = resolveShopProductScope(products, {
      ...baseConfig,
      pimCatalogMode: true,
      pimGammeSlugs: ["flyers"],
    });
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  it("exclusion : un id exclu n'est jamais expose (meme si il matche)", () => {
    const products = [P("a", "lib-1", "cartes"), P("b", "lib-1", "cartes")];
    const out = resolveShopProductScope(products, {
      ...baseConfig,
      libraryIds: ["lib-1"],
      excludedIds: ["a"],
    });
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  it("mode PIM ON + pim_gamme_slugs vide : rien expose (pas de fallback)", () => {
    const products = [P("a", "lib-1", "cartes"), P("b", "lib-2", "flyers")];
    const out = resolveShopProductScope(products, {
      ...baseConfig,
      pimCatalogMode: true,
      pimGammeSlugs: [],
    });
    expect(out).toEqual([]);
  });

  it("produit inactif : jamais expose", () => {
    const products = [P("a", "lib-1", "cartes", false), P("b", "lib-1", "cartes", true)];
    const out = resolveShopProductScope(products, { ...baseConfig, libraryIds: ["lib-1"] });
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  it("produit sans gamme_slug : n'est pas expose via la voie PIM", () => {
    const products = [P("a", "lib-1", null), P("b", "lib-1", "cartes")];
    const out = resolveShopProductScope(products, {
      ...baseConfig,
      pimCatalogMode: true,
      pimGammeSlugs: ["cartes"],
    });
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });
});
