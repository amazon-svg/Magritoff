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
