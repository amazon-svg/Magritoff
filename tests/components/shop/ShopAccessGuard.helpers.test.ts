import { describe, expect, it } from "vitest";
import { resolveShopAccess } from "../../../src/app/components/shop/ShopAccessGuard.helpers";

describe("resolveShopAccess", () => {
  it("demande une session storefront pour une boutique sur invitation", () => {
    expect(resolveShopAccess({
      accessMode: "invite_only",
      shopId: "shop-A",
      storefrontShopId: null,
    })).toBe("authentication_required");
  });

  it("autorise uniquement la session de la boutique exacte", () => {
    expect(resolveShopAccess({
      accessMode: "invite_only",
      shopId: "shop-A",
      storefrontShopId: "shop-A",
    })).toBe("allowed");
    expect(resolveShopAccess({
      accessMode: "invite_only",
      shopId: "shop-A",
      storefrontShopId: "shop-B",
    })).toBe("authentication_required");
  });

  it("laisse le catalogue self_signup public sans confondre les boutiques", () => {
    expect(resolveShopAccess({
      accessMode: "self_signup",
      shopId: "shop-A",
      storefrontShopId: null,
    })).toBe("public");
    expect(resolveShopAccess({
      accessMode: "self_signup",
      shopId: "shop-A",
      storefrontShopId: "shop-B",
    })).toBe("public");
    expect(resolveShopAccess({
      accessMode: "self_signup",
      shopId: "shop-A",
      storefrontShopId: "shop-A",
    })).toBe("allowed");
  });
});
