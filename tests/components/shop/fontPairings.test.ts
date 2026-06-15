/**
 * Tests A4.2 — Résolution pairings de fonts curated (fontPairings.ts).
 *
 * Helpers purs (cf. pattern repo ShopLayout.helpers.test.ts).
 */

import { describe, it, expect } from "vitest";
import {
  FONT_PAIRINGS,
  DEFAULT_FONT_PAIRING,
  resolveFontPairing,
} from "../../../src/app/components/shop/fontPairings";

describe("FONT_PAIRINGS — A4.2 catalog curated", () => {
  it("contient exactement 5 pairings (system + 4 Google Fonts)", () => {
    expect(FONT_PAIRINGS).toHaveLength(5);
  });

  it("le pairing 'system' est en première position (défaut UI)", () => {
    expect(FONT_PAIRINGS[0].key).toBe("system");
  });

  it("toutes les clés sont uniques", () => {
    const keys = FONT_PAIRINGS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("tous les labels sont en français (brand voice)", () => {
    // Heuristique simple : aucun label ne doit commencer par un mot anglais courant
    const englishStarts = ["Modern", "Default", "Editorial", "Luxury", "Technical"];
    FONT_PAIRINGS.forEach((p) => {
      englishStarts.forEach((en) => {
        expect(p.label.startsWith(en + " ")).toBe(false);
        expect(p.label === en).toBe(false);
      });
    });
  });

  it("chaque pairing fournit heading et body non vides", () => {
    FONT_PAIRINGS.forEach((p) => {
      expect(p.heading.trim().length).toBeGreaterThan(0);
      expect(p.body.trim().length).toBeGreaterThan(0);
    });
  });
});

describe("resolveFontPairing — A4.2 fallback robuste", () => {
  it("retourne le pairing demandé quand la clé est valide", () => {
    expect(resolveFontPairing("modern").key).toBe("modern");
    expect(resolveFontPairing("luxury").key).toBe("luxury");
    expect(resolveFontPairing("technical").key).toBe("technical");
  });

  it("retourne DEFAULT_FONT_PAIRING quand la clé est null", () => {
    expect(resolveFontPairing(null)).toBe(DEFAULT_FONT_PAIRING);
  });

  it("retourne DEFAULT_FONT_PAIRING quand la clé est undefined", () => {
    expect(resolveFontPairing(undefined)).toBe(DEFAULT_FONT_PAIRING);
  });

  it("retourne DEFAULT_FONT_PAIRING quand la clé est chaîne vide", () => {
    expect(resolveFontPairing("")).toBe(DEFAULT_FONT_PAIRING);
  });

  it("retourne DEFAULT_FONT_PAIRING quand la clé n'existe pas (pairing déprécié)", () => {
    expect(resolveFontPairing("retro-vintage-deprecated").key).toBe("system");
  });

  it("DEFAULT_FONT_PAIRING utilise system-ui (pas de fetch Google Fonts requis)", () => {
    expect(DEFAULT_FONT_PAIRING.key).toBe("system");
    expect(DEFAULT_FONT_PAIRING.heading).toContain("system-ui");
    expect(DEFAULT_FONT_PAIRING.body).toContain("system-ui");
  });
});
