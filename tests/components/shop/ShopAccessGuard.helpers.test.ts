import { describe, expect, it } from "vitest";
import {
  resolveShopAccess,
  resolveShopAccessFromMemberships,
  type ShopAccessInput,
} from "../../../src/app/components/shop/ShopAccessGuard.helpers";

const inviteOnly: ShopAccessInput = {
  isAuthenticated: false,
  accessMode: "invite_only",
  accessScope: null,
  allowedShopIds: [],
  shopId: "shop-A",
};

describe("resolveShopAccess", () => {
  it("demande une connexion à l'anonyme sur une boutique sur invitation", () => {
    expect(resolveShopAccess(inviteOnly)).toBe("authentication_required");
  });

  it("refuse un compte sans membership sur une boutique sur invitation", () => {
    expect(resolveShopAccess({ ...inviteOnly, isAuthenticated: true })).toBe("forbidden");
  });

  it("autorise magrit_full et le shop_only explicitement invité", () => {
    expect(resolveShopAccess({
      ...inviteOnly,
      isAuthenticated: true,
      accessScope: "magrit_full",
    })).toBe("allowed");
    expect(resolveShopAccess({
      ...inviteOnly,
      isAuthenticated: true,
      accessScope: "shop_only",
      allowedShopIds: ["shop-A"],
    })).toBe("allowed");
  });

  it("refuse un shop_only qui n'inclut pas la boutique", () => {
    expect(resolveShopAccess({
      ...inviteOnly,
      isAuthenticated: true,
      accessScope: "shop_only",
      allowedShopIds: ["shop-B"],
    })).toBe("forbidden");
  });

  it("laisse une boutique self_signup publique et accepte un compte existant", () => {
    expect(resolveShopAccess({ ...inviteOnly, accessMode: "self_signup" })).toBe("public");
    expect(resolveShopAccess({
      ...inviteOnly,
      accessMode: "self_signup",
      isAuthenticated: true,
    })).toBe("allowed");
  });

  it("autorise un superadmin authentifié sur invite_only", () => {
    expect(resolveShopAccess({
      ...inviteOnly,
      isAuthenticated: true,
      isSuperAdmin: true,
    })).toBe("allowed");
  });

  it("autorise une session storefront limitée à cette boutique", () => {
    expect(resolveShopAccess({
      ...inviteOnly,
      hasStorefrontAccess: true,
    })).toBe("allowed");
  });
});

describe("resolveShopAccessFromMemberships", () => {
  const base = {
    isAuthenticated: true,
    accessMode: "invite_only" as const,
    shopId: "shop-A",
    shopTenantId: "tenant-A",
  };

  it("n'utilise pas une membership magrit_full d'un autre tenant", () => {
    expect(resolveShopAccessFromMemberships({
      ...base,
      memberships: [{
        tenantId: "tenant-B",
        accessScope: "magrit_full",
        allowedShopIds: [],
      }],
    })).toBe("forbidden");
  });

  it("utilise uniquement la membership du tenant propriétaire", () => {
    expect(resolveShopAccessFromMemberships({
      ...base,
      memberships: [
        { tenantId: "tenant-B", accessScope: "magrit_full", allowedShopIds: [] },
        { tenantId: "tenant-A", accessScope: "shop_only", allowedShopIds: ["shop-A"] },
      ],
    })).toBe("allowed");
  });

  it("refuse l'absence de membership sur invite_only", () => {
    expect(resolveShopAccessFromMemberships({ ...base, memberships: [] })).toBe("forbidden");
  });

  it("accepte uniquement la session storefront de la boutique demandée", () => {
    expect(resolveShopAccessFromMemberships({
      ...base, isAuthenticated: false, memberships: [], storefrontShopId: "shop-A",
    })).toBe("allowed");
    expect(resolveShopAccessFromMemberships({
      ...base, isAuthenticated: false, memberships: [], storefrontShopId: "shop-B",
    })).toBe("authentication_required");
  });
});
