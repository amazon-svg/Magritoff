/**
 * Tests vitest pour les helpers ShopLayout (Story S2.1, Epic 2).
 *
 * Tests purs : pas de rendering React (cf. ADR repo, cf. tests/components/mockup/).
 */

import { describe, it, expect } from "vitest";
import {
  resolveShopTheme,
  resolveShopBrandStyle,
  shouldShowCartBadge,
  shouldRenderHeroBanner,
  resolveHeroTagline,
  shouldRenderBrandBanner,
  resolveBrandBannerBackground,
} from "../../../src/app/components/shop/ShopLayout.helpers";

describe("resolveShopTheme — AC2 S2.1 dark par defaut", () => {
  it("dark par defaut quand mode est 'dark'", () => {
    const res = resolveShopTheme({ theme: { mode: "dark" } as any });
    expect(res.dataTheme).toBe("dark");
    expect(res.isDark).toBe(true);
  });

  it("dark par defaut quand mode est undefined (theme partial)", () => {
    const res = resolveShopTheme({ theme: {} as any });
    expect(res.dataTheme).toBe("dark");
    expect(res.isDark).toBe(true);
  });

  it("dark par defaut quand shop est null (loading state)", () => {
    const res = resolveShopTheme(null);
    expect(res.dataTheme).toBe("dark");
    expect(res.isDark).toBe(true);
  });

  it("dark par defaut quand shop est undefined", () => {
    const res = resolveShopTheme(undefined);
    expect(res.dataTheme).toBe("dark");
    expect(res.isDark).toBe(true);
  });

  it("light uniquement quand mode='light' explicite (retro-compat)", () => {
    const res = resolveShopTheme({ theme: { mode: "light" } as any });
    expect(res.dataTheme).toBeUndefined();
    expect(res.isDark).toBe(false);
  });

  it("dark par defaut sur valeur inattendue (fallback safe)", () => {
    const res = resolveShopTheme({ theme: { mode: "auto" as any } });
    expect(res.dataTheme).toBe("dark");
    expect(res.isDark).toBe(true);
  });
});

describe("resolveShopBrandStyle — AC1 S2.1 theming dynamique", () => {
  it("expose --shop-primary et --shop-accent quand definis", () => {
    const style = resolveShopBrandStyle({
      theme: { primaryColor: "#FF6B35", accentColor: "#1E3A8A", mode: "dark" } as any,
    });
    expect(style["--shop-primary"]).toBe("#FF6B35");
    expect(style["--shop-accent"]).toBe("#1E3A8A");
  });

  it("retourne objet vide si shop est null", () => {
    expect(resolveShopBrandStyle(null)).toEqual({});
  });

  it("retourne objet vide si theme manquant", () => {
    expect(resolveShopBrandStyle({} as any)).toEqual({});
  });

  it("omet --shop-primary si primaryColor falsy", () => {
    const style = resolveShopBrandStyle({
      theme: { primaryColor: "", accentColor: "#000", mode: "dark" } as any,
    });
    expect(style["--shop-primary"]).toBeUndefined();
    expect(style["--shop-accent"]).toBe("#000");
  });

  // ─── A4.2 — Palette élargie (secondaire / texte / fond) ───────────────
  it("A4.2 expose --shop-secondary / --shop-text / --shop-bg quand définis", () => {
    const style = resolveShopBrandStyle({
      theme: {
        primaryColor: "#000",
        accentColor: "#fff",
        mode: "dark",
        secondaryColor: "#6b7280",
        textColor: "#0f172a",
        bgColor: "#fafafa",
      } as any,
    });
    expect(style["--shop-secondary"]).toBe("#6b7280");
    expect(style["--shop-text"]).toBe("#0f172a");
    expect(style["--shop-bg"]).toBe("#fafafa");
  });

  it("A4.2 omet les nouvelles vars si champs absents (back-compat JSONB)", () => {
    const style = resolveShopBrandStyle({
      theme: { primaryColor: "#000", accentColor: "#fff", mode: "dark" } as any,
    });
    expect(style["--shop-secondary"]).toBeUndefined();
    expect(style["--shop-text"]).toBeUndefined();
    expect(style["--shop-bg"]).toBeUndefined();
  });

  it("A4.2 expose --shop-font-heading et --shop-font-body même sans fontPairing (fallback system)", () => {
    const style = resolveShopBrandStyle({
      theme: { primaryColor: "#000", accentColor: "#fff", mode: "dark" } as any,
    });
    expect(style["--shop-font-heading"]).toContain("system-ui");
    expect(style["--shop-font-body"]).toContain("system-ui");
  });

  it("A4.2 utilise le pairing demandé quand fontPairing reconnu", () => {
    const style = resolveShopBrandStyle({
      theme: {
        primaryColor: "#000",
        accentColor: "#fff",
        mode: "dark",
        fontPairing: "luxury",
      } as any,
    });
    expect(style["--shop-font-heading"]).toContain("Playfair Display");
    expect(style["--shop-font-body"]).toContain("Lato");
  });

  it("A4.2 fallback system si pairing inconnu", () => {
    const style = resolveShopBrandStyle({
      theme: {
        primaryColor: "#000",
        accentColor: "#fff",
        mode: "dark",
        fontPairing: "ghost-pairing-deprecated",
      } as any,
    });
    expect(style["--shop-font-heading"]).toContain("system-ui");
  });
});

describe("shouldShowCartBadge — AC1 S2.1 badge cart", () => {
  it("affiche badge quand count > 0", () => {
    expect(shouldShowCartBadge(1)).toBe(true);
    expect(shouldShowCartBadge(42)).toBe(true);
  });

  it("masque badge quand count === 0", () => {
    expect(shouldShowCartBadge(0)).toBe(false);
  });

  it("masque badge quand count nullish", () => {
    expect(shouldShowCartBadge(null)).toBe(false);
    expect(shouldShowCartBadge(undefined)).toBe(false);
  });

  it("masque badge si count negatif (defensif)", () => {
    expect(shouldShowCartBadge(-1)).toBe(false);
  });
});

describe("shouldRenderHeroBanner — A4.1 bannière hero", () => {
  it("true quand hero_image_url est une URL non vide", () => {
    expect(shouldRenderHeroBanner({ hero_image_url: "https://cdn.example.com/hero.jpg" })).toBe(true);
  });

  it("false quand hero_image_url est null", () => {
    expect(shouldRenderHeroBanner({ hero_image_url: null })).toBe(false);
  });

  it("false quand hero_image_url est undefined", () => {
    expect(shouldRenderHeroBanner({ hero_image_url: undefined })).toBe(false);
  });

  it("false quand hero_image_url est chaîne vide", () => {
    expect(shouldRenderHeroBanner({ hero_image_url: "" })).toBe(false);
  });

  it("false quand hero_image_url est uniquement des espaces (trim)", () => {
    expect(shouldRenderHeroBanner({ hero_image_url: "   " })).toBe(false);
  });

  it("false quand shop est null ou undefined (loading state)", () => {
    expect(shouldRenderHeroBanner(null)).toBe(false);
    expect(shouldRenderHeroBanner(undefined)).toBe(false);
  });
});

describe("resolveHeroTagline — A4.1 tagline overlay", () => {
  it("retourne le tagline trim quand présent", () => {
    expect(resolveHeroTagline({ tagline: "  Vos imprimés en 48h  " })).toBe("Vos imprimés en 48h");
  });

  it("retourne null quand tagline est null", () => {
    expect(resolveHeroTagline({ tagline: null })).toBe(null);
  });

  it("retourne null quand tagline est undefined", () => {
    expect(resolveHeroTagline({ tagline: undefined })).toBe(null);
  });

  it("retourne null quand tagline est chaîne vide ou whitespace", () => {
    expect(resolveHeroTagline({ tagline: "" })).toBe(null);
    expect(resolveHeroTagline({ tagline: "   " })).toBe(null);
  });

  it("tronque à 120 caractères défensivement (cap UI déjà appliqué normalement)", () => {
    const long = "a".repeat(150);
    const out = resolveHeroTagline({ tagline: long });
    expect(out).not.toBeNull();
    expect(out!.length).toBe(120);
  });

  it("retourne null quand shop est null ou undefined", () => {
    expect(resolveHeroTagline(null)).toBe(null);
    expect(resolveHeroTagline(undefined)).toBe(null);
  });
});

// ─── Bandeau de marque (refonte 2026-07-08) ──────────────────────────────────
describe("shouldRenderBrandBanner — affichage dès qu'une identité existe", () => {
  it("true avec un logo seul (sans image ni tagline)", () => {
    expect(
      shouldRenderBrandBanner({ logo_url: "https://cdn/logo.png", hero_image_url: null, tagline: null }),
    ).toBe(true);
  });

  it("true avec une image de fond seule", () => {
    expect(
      shouldRenderBrandBanner({ logo_url: "", hero_image_url: "https://cdn/hero.jpg", tagline: null }),
    ).toBe(true);
  });

  it("true avec une accroche seule (le nom fait office d'identité)", () => {
    expect(shouldRenderBrandBanner({ logo_url: "", hero_image_url: null, tagline: "En 48h" })).toBe(true);
  });

  it("false quand tout est vide / whitespace", () => {
    expect(shouldRenderBrandBanner({ logo_url: "   ", hero_image_url: "", tagline: "  " })).toBe(false);
  });

  it("false quand shop null/undefined", () => {
    expect(shouldRenderBrandBanner(null)).toBe(false);
    expect(shouldRenderBrandBanner(undefined)).toBe(false);
  });
});

describe("resolveBrandBannerBackground — image vs dégradé de marque", () => {
  it("utilise l'image de fond en cover/center quand fournie", () => {
    const bg = resolveBrandBannerBackground({ hero_image_url: "https://cdn/hero.jpg" });
    expect(bg.hasImage).toBe(true);
    expect(bg.style.backgroundImage).toBe("url(https://cdn/hero.jpg)");
    expect(bg.style.backgroundSize).toBe("cover");
    expect(bg.style.backgroundPosition).toBe("center");
  });

  it("repli sur le dégradé --shop-primary quand pas d'image", () => {
    const bg = resolveBrandBannerBackground({ hero_image_url: null });
    expect(bg.hasImage).toBe(false);
    expect(bg.style.backgroundImage).toContain("var(--shop-primary");
    expect(bg.style.backgroundImage).toContain("linear-gradient");
  });

  it("dégradé de marque quand URL vide / whitespace (pas d'image cassée)", () => {
    expect(resolveBrandBannerBackground({ hero_image_url: "   " }).hasImage).toBe(false);
    expect(resolveBrandBannerBackground(null).hasImage).toBe(false);
  });
});
