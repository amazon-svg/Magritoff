/** Décision d'accès pure à une boutique, avant tout chargement de catalogue. */

export type ShopAccess =
  | "public"
  | "allowed"
  | "authentication_required";

export interface ShopAccessInput {
  accessMode: "invite_only" | "self_signup";
  shopId: string;
  storefrontShopId?: string | null;
}

/**
 * Une boutique self_signup est consultable publiquement. Une boutique sur
 * invitation exige une session storefront de cette boutique exacte.
 *
 * L'identité Magrit n'entre volontairement pas dans cette décision : un
 * collaborateur passe par la délégation explicite « Se connecter à la
 * boutique », qui émet elle aussi une session storefront bornée.
 */
export function resolveShopAccess(input: ShopAccessInput): ShopAccess {
  const hasStorefrontAccess = input.storefrontShopId === input.shopId;
  if (input.accessMode === "self_signup") {
    return hasStorefrontAccess ? "allowed" : "public";
  }
  return hasStorefrontAccess ? "allowed" : "authentication_required";
}
