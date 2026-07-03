/**
 * Tests vitest pour ShopAccessGuard.helpers (Story S2.1, AC3).
 */

import { describe, it, expect } from "vitest";
import {
  resolveShopAccess,
  resolveShopAccessFromMemberships,
  type ShopAccessInput,
} from "../../../src/app/components/shop/ShopAccessGuard.helpers";

const baseInput: ShopAccessInput = {
  isAuthenticated: false,
  accessScope: null,
  allowedShopIds: [],
  shopId: "shop-A",
};

describe("resolveShopAccess — AC3 S2.1 access control shop_only", () => {
  it("user anonyme -> public (portail reste accessible sans login)", () => {
    expect(resolveShopAccess({ ...baseInput, isAuthenticated: false })).toBe("public");
  });

  it("user authentifie magrit_full -> allowed", () => {
    expect(
      resolveShopAccess({
        ...baseInput,
        isAuthenticated: true,
        accessScope: "magrit_full",
      }),
    ).toBe("allowed");
  });

  it("user authentifie sans scope (non-membre tenant) -> allowed", () => {
    expect(
      resolveShopAccess({
        ...baseInput,
        isAuthenticated: true,
        accessScope: null,
      }),
    ).toBe("allowed");
  });

  it("user shop_only avec shopId dans allowedShopIds -> allowed", () => {
    expect(
      resolveShopAccess({
        ...baseInput,
        isAuthenticated: true,
        accessScope: "shop_only",
        allowedShopIds: ["shop-A", "shop-B"],
        shopId: "shop-A",
      }),
    ).toBe("allowed");
  });

  it("user shop_only avec shopId PAS dans allowedShopIds -> forbidden", () => {
    expect(
      resolveShopAccess({
        ...baseInput,
        isAuthenticated: true,
        accessScope: "shop_only",
        allowedShopIds: ["shop-B", "shop-C"],
        shopId: "shop-A",
      }),
    ).toBe("forbidden");
  });

  it("user shop_only avec liste vide -> forbidden", () => {
    expect(
      resolveShopAccess({
        ...baseInput,
        isAuthenticated: true,
        accessScope: "shop_only",
        allowedShopIds: [],
        shopId: "shop-A",
      }),
    ).toBe("forbidden");
  });

  it("superadmin shop_only restrictif -> allowed (bypass guards)", () => {
    expect(
      resolveShopAccess({
        ...baseInput,
        isAuthenticated: true,
        accessScope: "shop_only",
        allowedShopIds: ["shop-Z"],
        shopId: "shop-A",
        isSuperAdmin: true,
      }),
    ).toBe("allowed");
  });

  it("anonyme prime sur isSuperAdmin (cas impossible mais defensif)", () => {
    // Si isAuthenticated=false, on ne consulte meme pas isSuperAdmin.
    expect(
      resolveShopAccess({
        ...baseInput,
        isAuthenticated: false,
        isSuperAdmin: true,
      }),
    ).toBe("public");
  });
});

describe("resolveShopAccessFromMemberships — agregation multi-memberships", () => {
  it("anonyme -> public", () => {
    expect(
      resolveShopAccessFromMemberships({
        isAuthenticated: false,
        memberships: [],
        shopId: "shop-A",
      }),
    ).toBe("public");
  });

  it("superadmin -> allowed", () => {
    expect(
      resolveShopAccessFromMemberships({
        isAuthenticated: true,
        isSuperAdmin: true,
        memberships: [{ accessScope: "shop_only", allowedShopIds: [] }],
        shopId: "shop-A",
      }),
    ).toBe("allowed");
  });

  it("user authentifie sans tenant -> allowed (compromis retro-compat)", () => {
    expect(
      resolveShopAccessFromMemberships({
        isAuthenticated: true,
        memberships: [],
        shopId: "shop-A",
      }),
    ).toBe("allowed");
  });

  it("au moins une membership shop_only autorise -> allowed", () => {
    expect(
      resolveShopAccessFromMemberships({
        isAuthenticated: true,
        memberships: [
          { accessScope: "shop_only", allowedShopIds: ["shop-X"] },
          { accessScope: "shop_only", allowedShopIds: ["shop-A", "shop-B"] },
        ],
        shopId: "shop-A",
      }),
    ).toBe("allowed");
  });

  it("au moins une membership magrit_full -> allowed (meme si une autre shop_only refuse)", () => {
    expect(
      resolveShopAccessFromMemberships({
        isAuthenticated: true,
        memberships: [
          { accessScope: "shop_only", allowedShopIds: ["shop-X"] },
          { accessScope: "magrit_full", allowedShopIds: [] },
        ],
        shopId: "shop-A",
      }),
    ).toBe("allowed");
  });

  it("toutes shop_only sans shopId -> forbidden", () => {
    expect(
      resolveShopAccessFromMemberships({
        isAuthenticated: true,
        memberships: [
          { accessScope: "shop_only", allowedShopIds: ["shop-X"] },
          { accessScope: "shop_only", allowedShopIds: ["shop-Y", "shop-Z"] },
        ],
        shopId: "shop-A",
      }),
    ).toBe("forbidden");
  });
});
