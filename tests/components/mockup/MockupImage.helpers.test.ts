/**
 * Tests vitest pour les helpers d'URL du composant MockupImage (Story S4.3).
 *
 * Tests purs : pas de rendering React, pas d'import alias /utils.
 * Les helpers sont injectes avec un projectId fictif (pour ne pas dependre
 * de l'env Vite a l'execution vitest).
 */

import { describe, it, expect } from "vitest";
import {
  buildPublicMockupUrl,
  buildEdgeFunctionUrl,
  buildCacheBuster,
  type MockupSpecs,
} from "../../../src/app/components/mockup/MockupImage.helpers";

const TEST_PROJECT_ID = "test-project-abc";

describe("buildPublicMockupUrl", () => {
  it("construit l'URL publique CDN avec le path correct (cache version _v2)", () => {
    const url = buildPublicMockupUrl(TEST_PROJECT_ID, {
      tenantId: "tenant-1",
      shopId: "shop-1",
      productId: "product-1",
    });
    // P3-VISUELS (2026-06-15) : suffixe _v2 bump pour invalider le cache PNG
    // post-refonte des templates SVG Magrit-brandés.
    expect(url).toBe(
      `https://${TEST_PROJECT_ID}.supabase.co/storage/v1/object/public/product_mockups/tenant-1/shop-1/product-1_v2.png`,
    );
  });

  it("ne fait pas d'encoding URL des params (ils sont attendus deja safes)", () => {
    // Si l'amont passe des chars dangereux, c'est son probleme — ces helpers
    // attendent des UUID/slugs safes. On verifie juste qu'il n'y a pas de
    // double-encoding inattendu.
    const url = buildPublicMockupUrl(TEST_PROJECT_ID, {
      tenantId: "abc-123",
      shopId: "xyz-456",
      productId: "p-789",
    });
    expect(url).toContain("/abc-123/xyz-456/p-789_v2.png");
  });
});

describe("buildEdgeFunctionUrl", () => {
  it("inclut tous les query params encodes correctement", () => {
    const specs: MockupSpecs = {
      tenantId: "tenant-1",
      shopId: "shop-1",
      productId: "product-1",
      width: 148,
      height: 210,
      productName: "Flyer A5",
      primaryColor: "#FF6B35",
    };
    const url = buildEdgeFunctionUrl(TEST_PROJECT_ID, specs);
    expect(url).toContain(
      `https://${TEST_PROJECT_ID}.supabase.co/functions/v1/mockup-generator?`,
    );
    // primaryColor doit etre encode (#FF6B35 -> %23FF6B35)
    expect(url).toContain("primaryColor=%23FF6B35");
    // productName avec espace doit etre encode
    expect(url).toContain("productName=Flyer+A5");
    expect(url).toContain("tenant=tenant-1");
    expect(url).toContain("shop=shop-1");
    expect(url).toContain("product=product-1");
    expect(url).toContain("width=148");
    expect(url).toContain("height=210");
  });

  it("encode correctement les caracteres speciaux dans productName", () => {
    const specs: MockupSpecs = {
      tenantId: "t",
      shopId: "s",
      productId: "p",
      width: 100,
      height: 100,
      productName: "Carte été \"premium\"",
      primaryColor: "#000000",
    };
    const url = buildEdgeFunctionUrl(TEST_PROJECT_ID, specs);
    // L'encoding URLSearchParams gere correctement ces chars
    expect(url).toContain("productName=Carte+%C3%A9t%C3%A9+%22premium%22");
  });

  it("ajoute template au query si fourni (S4.2)", () => {
    const specs: MockupSpecs = {
      tenantId: "t",
      shopId: "s",
      productId: "p",
      width: 85,
      height: 55,
      productName: "Carte Pro",
      primaryColor: "#FF6B35",
      template: "carteVisite",
    };
    const url = buildEdgeFunctionUrl(TEST_PROJECT_ID, specs);
    expect(url).toContain("template=carteVisite");
  });

  it("omet template si absent (retro-compat S4.3)", () => {
    const specs: MockupSpecs = {
      tenantId: "t",
      shopId: "s",
      productId: "p",
      width: 148,
      height: 210,
      productName: "Flyer",
      primaryColor: "#000000",
    };
    const url = buildEdgeFunctionUrl(TEST_PROJECT_ID, specs);
    expect(url).not.toContain("template=");
  });

  it("omet template si string vide (defensif)", () => {
    const specs: MockupSpecs = {
      tenantId: "t",
      shopId: "s",
      productId: "p",
      width: 148,
      height: 210,
      productName: "Flyer",
      primaryColor: "#000000",
      template: "   ",
    };
    const url = buildEdgeFunctionUrl(TEST_PROJECT_ID, specs);
    expect(url).not.toContain("template=");
  });
});

describe("buildCacheBuster", () => {
  it("retourne une string non-vide", () => {
    const buster = buildCacheBuster();
    expect(buster).toBeTruthy();
    expect(typeof buster).toBe("string");
    expect(buster.length).toBeGreaterThan(0);
  });

  it("change entre deux appels (sauf si meme ms exact)", () => {
    // Note : Date.now() retourne le meme ms si appels < 1ms apart.
    // Pour rendre le test deterministique, on attend un peu.
    const a = buildCacheBuster();
    // Boucle busy-wait courte pour garantir un ms different
    const start = Date.now();
    while (Date.now() === start) {
      /* spin */
    }
    const b = buildCacheBuster();
    expect(a).not.toBe(b);
  });

  it("est court (< 16 chars)", () => {
    // Date.now().toString(36) fait typiquement 8 chars en 2026
    const buster = buildCacheBuster();
    expect(buster.length).toBeLessThan(16);
  });
});
