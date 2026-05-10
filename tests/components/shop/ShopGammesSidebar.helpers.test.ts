/**
 * Tests vitest pour les helpers ShopGammesSidebar (Story S2.2, Epic 2).
 */

import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  groupProductsByGamme,
  buildGammeTree,
  loadExpandedGammes,
  saveExpandedGammes,
  filterProductsByExpandedGammes,
  NO_GAMME_KEY,
  EXPANDED_GAMMES_KEY_PREFIX,
} from "../../../src/app/components/shop/ShopGammesSidebar.helpers";
import type { ShopProduct } from "../../../src/app/contexts/ShopsContext";
import type { Gamme } from "../../../src/app/utils/productEnrichment";

function makeGamme(partial: Partial<Gamme> & { slug: string }): Gamme {
  return {
    id: partial.slug,
    slug: partial.slug,
    name: partial.name ?? partial.slug,
    parent_slug: partial.parent_slug ?? null,
    matching_rules: partial.matching_rules ?? {},
    display_order: partial.display_order ?? 0,
    image_url: null,
  };
}

function makeProduct(id: string, config: Record<string, unknown>): ShopProduct {
  return {
    id,
    shop_id: "s",
    product_id: null,
    name: id,
    category: "",
    description: "",
    price_ht: 0,
    image_url: "",
    config,
    display_order: 0,
    created_at: undefined,
  } as ShopProduct;
}

const FLYER_GAMME = makeGamme({
  slug: "flyer",
  name: "Flyers",
  matching_rules: { kind: "flyer" },
  display_order: 1,
});
const CARTE_GAMME = makeGamme({
  slug: "carte-visite",
  name: "Cartes de visite",
  matching_rules: { kind: "carte_visite" },
  display_order: 2,
});
const BROCHURE_GAMME = makeGamme({
  slug: "brochure",
  name: "Brochures",
  matching_rules: { kind: "brochure" },
  display_order: 3,
});

describe("groupProductsByGamme", () => {
  it("groupe 3 produits dans 3 gammes distinctes via resolveGamme", () => {
    const products = [
      makeProduct("p1", { kind: "flyer" }),
      makeProduct("p2", { kind: "carte_visite" }),
      makeProduct("p3", { kind: "brochure" }),
    ];
    const gammes = [FLYER_GAMME, CARTE_GAMME, BROCHURE_GAMME];
    const map = groupProductsByGamme(products, gammes);
    expect(map.get("flyer")?.map((p) => p.id)).toEqual(["p1"]);
    expect(map.get("carte-visite")?.map((p) => p.id)).toEqual(["p2"]);
    expect(map.get("brochure")?.map((p) => p.id)).toEqual(["p3"]);
  });

  it("place les produits non-matchant sous NO_GAMME_KEY", () => {
    const products = [
      makeProduct("p1", { kind: "flyer" }),
      makeProduct("p2", { kind: "tshirt_unknown" }),
    ];
    const map = groupProductsByGamme(products, [FLYER_GAMME]);
    expect(map.get("flyer")?.length).toBe(1);
    expect(map.get(NO_GAMME_KEY)?.length).toBe(1);
    expect(map.get(NO_GAMME_KEY)?.[0].id).toBe("p2");
  });

  it("plusieurs produits dans une meme gamme", () => {
    const products = Array.from({ length: 5 }, (_, i) =>
      makeProduct(`p${i}`, { kind: "flyer" }),
    );
    const map = groupProductsByGamme(products, [FLYER_GAMME]);
    expect(map.get("flyer")?.length).toBe(5);
  });

  it("liste produits vide -> map vide", () => {
    const map = groupProductsByGamme([], [FLYER_GAMME]);
    expect(map.size).toBe(0);
  });
});

describe("buildGammeTree", () => {
  it("racines + 1 niveau d enfants", () => {
    const carterie = makeGamme({ slug: "carterie", display_order: 1 });
    const carteVisite = makeGamme({
      slug: "carte-visite",
      parent_slug: "carterie",
      display_order: 1,
    });
    const carteCorrespondance = makeGamme({
      slug: "carte-correspondance",
      parent_slug: "carterie",
      display_order: 2,
    });
    const flyer = makeGamme({ slug: "flyer", display_order: 2 });
    const tree = buildGammeTree([carteCorrespondance, flyer, carterie, carteVisite]);
    expect(tree.roots.map((g) => g.slug)).toEqual(["carterie", "flyer"]);
    const carterieChildren = tree.childrenByParent.get("carterie") ?? [];
    expect(carterieChildren.map((g) => g.slug)).toEqual([
      "carte-visite",
      "carte-correspondance",
    ]);
  });

  it("racines seulement (pas d enfants)", () => {
    const tree = buildGammeTree([FLYER_GAMME, CARTE_GAMME, BROCHURE_GAMME]);
    expect(tree.roots).toHaveLength(3);
    expect(tree.childrenByParent.size).toBe(0);
  });

  it("orphelin (parent_slug pointant vers slug inexistant) -> promu racine", () => {
    const orphelin = makeGamme({
      slug: "orphan",
      parent_slug: "nope",
      display_order: 5,
    });
    const tree = buildGammeTree([FLYER_GAMME, orphelin]);
    expect(tree.roots.map((g) => g.slug)).toEqual(["flyer", "orphan"]);
    expect(tree.childrenByParent.size).toBe(0);
  });
});

describe("loadExpandedGammes / saveExpandedGammes", () => {
  // Mock localStorage in-memory pour vitest env=node (pas de jsdom configure).
  // Le store est partage entre tests via beforeEach qui le reset proprement.
  let mockStore: Map<string, string>;

  beforeEach(() => {
    mockStore = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => mockStore.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mockStore.set(k, v);
        },
        removeItem: (k: string) => {
          mockStore.delete(k);
        },
        clear: () => {
          mockStore.clear();
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("round-trip save -> load preserve l ensemble", () => {
    saveExpandedGammes("shop-A", new Set(["flyer", "brochure"]));
    const loaded = loadExpandedGammes("shop-A");
    expect(loaded.has("flyer")).toBe(true);
    expect(loaded.has("brochure")).toBe(true);
    expect(loaded.size).toBe(2);
  });

  it("namespace par shop : 2 shops differents -> 2 stores independants", () => {
    saveExpandedGammes("shop-A", new Set(["flyer"]));
    saveExpandedGammes("shop-B", new Set(["brochure"]));
    expect(Array.from(loadExpandedGammes("shop-A"))).toEqual(["flyer"]);
    expect(Array.from(loadExpandedGammes("shop-B"))).toEqual(["brochure"]);
  });

  it("loadExpandedGammes JSON malformed -> Set vide (defensif)", () => {
    window.localStorage.setItem(
      EXPANDED_GAMMES_KEY_PREFIX + "shop-bad",
      "{not valid json",
    );
    expect(loadExpandedGammes("shop-bad").size).toBe(0);
  });

  it("loadExpandedGammes type non-array -> Set vide", () => {
    window.localStorage.setItem(
      EXPANDED_GAMMES_KEY_PREFIX + "shop-obj",
      JSON.stringify({ flyer: true }),
    );
    expect(loadExpandedGammes("shop-obj").size).toBe(0);
  });

  it("loadExpandedGammes filtre les non-string", () => {
    window.localStorage.setItem(
      EXPANDED_GAMMES_KEY_PREFIX + "shop-mixed",
      JSON.stringify(["flyer", 42, null, "brochure"]),
    );
    const loaded = loadExpandedGammes("shop-mixed");
    expect(loaded.has("flyer")).toBe(true);
    expect(loaded.has("brochure")).toBe(true);
    expect(loaded.size).toBe(2);
  });

  it("loadExpandedGammes shopSlug vide -> Set vide", () => {
    expect(loadExpandedGammes("").size).toBe(0);
  });

  it("saveExpandedGammes Set vide -> store vide array", () => {
    saveExpandedGammes("shop-empty", new Set());
    expect(loadExpandedGammes("shop-empty").size).toBe(0);
  });
});

describe("filterProductsByExpandedGammes", () => {
  const products = [
    makeProduct("p1", { kind: "flyer" }),
    makeProduct("p2", { kind: "carte_visite" }),
    makeProduct("p3", { kind: "brochure" }),
  ];
  const gammeMap = new Map<string, ShopProduct[]>([
    ["flyer", [products[0]]],
    ["carte-visite", [products[1]]],
    ["brochure", [products[2]]],
  ]);

  it("expandedSlugs vide -> tous les produits (default state)", () => {
    expect(filterProductsByExpandedGammes(products, gammeMap, new Set()).length).toBe(3);
  });

  it("1 gamme deplice -> seulement ses produits", () => {
    const filtered = filterProductsByExpandedGammes(
      products,
      gammeMap,
      new Set(["flyer"]),
    );
    expect(filtered.map((p) => p.id)).toEqual(["p1"]);
  });

  it("2 gammes deplices -> union additif", () => {
    const filtered = filterProductsByExpandedGammes(
      products,
      gammeMap,
      new Set(["flyer", "brochure"]),
    );
    expect(filtered.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("slug inconnu dans expandedSlugs -> safe ignore", () => {
    const filtered = filterProductsByExpandedGammes(
      products,
      gammeMap,
      new Set(["unknown-slug"]),
    );
    expect(filtered).toEqual([]);
  });

  it("preserve l ordre d origine des produits (display_order)", () => {
    const filtered = filterProductsByExpandedGammes(
      products,
      gammeMap,
      new Set(["flyer", "brochure", "carte-visite"]),
    );
    expect(filtered.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
});
