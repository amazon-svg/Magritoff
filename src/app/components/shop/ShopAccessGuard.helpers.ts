/** Décision d'accès pure à une boutique, avant tout chargement de catalogue. */

export type ShopAccess =
  | "public"
  | "allowed"
  | "authentication_required"
  | "forbidden";

export interface ShopAccessInput {
  isAuthenticated: boolean;
  accessMode: "invite_only" | "self_signup";
  accessScope: "magrit_full" | "shop_only" | null;
  allowedShopIds: string[];
  shopId: string;
  isSuperAdmin?: boolean;
}

/**
 * Une boutique self_signup est consultable publiquement. Une boutique sur
 * invitation exige au contraire une authentification ET une membership du
 * tenant propriétaire autorisant cette boutique.
 */
export function resolveShopAccess(input: ShopAccessInput): ShopAccess {
  if (input.accessMode === "self_signup") {
    return input.isAuthenticated ? "allowed" : "public";
  }
  if (!input.isAuthenticated) return "authentication_required";
  if (input.isSuperAdmin) return "allowed";
  if (input.accessScope === "magrit_full") return "allowed";
  if (input.accessScope === "shop_only") {
    return input.allowedShopIds.includes(input.shopId) ? "allowed" : "forbidden";
  }
  return "forbidden";
}

export interface MembershipScope {
  tenantId: string;
  accessScope: "magrit_full" | "shop_only";
  allowedShopIds: string[];
}

export interface ShopAccessFromMembershipsInput {
  isAuthenticated: boolean;
  accessMode: "invite_only" | "self_signup";
  isSuperAdmin?: boolean;
  memberships: MembershipScope[];
  shopId: string;
  shopTenantId: string | null;
}

/** Ne considère que la membership du tenant propriétaire de la boutique. */
export function resolveShopAccessFromMemberships(
  input: ShopAccessFromMembershipsInput,
): ShopAccess {
  const membership = input.shopTenantId
    ? input.memberships.find((item) => item.tenantId === input.shopTenantId)
    : undefined;

  return resolveShopAccess({
    isAuthenticated: input.isAuthenticated,
    accessMode: input.accessMode,
    accessScope: membership?.accessScope ?? null,
    allowedShopIds: membership?.allowedShopIds ?? [],
    shopId: input.shopId,
    isSuperAdmin: input.isSuperAdmin,
  });
}
