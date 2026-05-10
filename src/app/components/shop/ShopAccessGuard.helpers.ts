/**
 * Helpers purs pour ShopAccessGuard (Story S2.1, Epic 2 — AC3).
 *
 * Logique : determiner si l'utilisateur courant peut acceder a la boutique
 * /shop/:slug. Trois cas :
 *   - Anonyme (pas authentifie) -> 'public' : portail B2B reste accessible
 *     sans login (retro-compat avec l'usage actuel).
 *   - Authentifie magrit_full -> 'allowed'.
 *   - Authentifie shop_only avec shopId NON dans allowedShopIds -> 'forbidden'.
 *   - Authentifie shop_only avec shopId DANS allowedShopIds -> 'allowed'.
 *
 * Pattern : helper pur testable sans React. Le composant React appelle ce
 * helper avec les data deja extraits du AuthContext + TenantContext.
 */

export type ShopAccess = "public" | "allowed" | "forbidden";

export interface ShopAccessInput {
  /** True si un user est authentifie. */
  isAuthenticated: boolean;
  /** Scope d'acces du user dans le tenant qui possede la shop ('magrit_full' | 'shop_only').
   *  Null si le user n'est pas membre du tenant (ou n'est pas authentifie). */
  accessScope: "magrit_full" | "shop_only" | null;
  /** Liste des shop ids accessibles si scope === 'shop_only'. */
  allowedShopIds: string[];
  /** Id de la shop demandee. */
  shopId: string;
  /** Bypass superadmin : si true, accede a toutes les shops independamment du scope. */
  isSuperAdmin?: boolean;
}

/**
 * Resout l'acces a une boutique pour un user donne.
 *
 * Regles AC3 S2.1 :
 *   1. Anonyme -> 'public'.
 *   2. Superadmin -> 'allowed' (bypass guards, pattern `isSuperAdmin` deja
 *      en place sur le tenant `magrit-root`).
 *   3. magrit_full (ou pas de scope car non-membre du tenant proprietaire de
 *      la shop) -> 'allowed' (l'utilisateur est authentifie et n'est pas
 *      restreint shop_only — la shop reste publique pour lui).
 *   4. shop_only AND shopId IN allowedShopIds -> 'allowed'.
 *   5. shop_only AND shopId NOT IN allowedShopIds -> 'forbidden'.
 */
export function resolveShopAccess(input: ShopAccessInput): ShopAccess {
  if (!input.isAuthenticated) return "public";
  if (input.isSuperAdmin) return "allowed";
  if (input.accessScope === "shop_only") {
    return input.allowedShopIds.includes(input.shopId) ? "allowed" : "forbidden";
  }
  // magrit_full ou null (non-membre) : on laisse passer puisque la shop
  // /shop/:slug est par definition une surface publique (cf. retro-compat).
  return "allowed";
}

/**
 * Variante agreggee : prend la liste des memberships du user authentifie
 * (depuis TenantContext.tenants) et calcule l'acces sur cette shop.
 *
 * Regle pratique : la route /shop/:slug n'est PAS scopee a un tenant precis
 * cote URL, donc on ne sait pas immediatement quelle membership consulter.
 * Strategie defensive :
 *   1. Anonyme -> 'public' (retro-compat).
 *   2. Superadmin -> 'allowed'.
 *   3. AU MOINS une membership shop_only inclut shopId -> 'allowed'.
 *   4. AU MOINS une membership magrit_full -> 'allowed' (acheteur libre).
 *   5. Sinon (toutes les memberships sont shop_only restrictives qui
 *      n'incluent pas shopId) -> 'forbidden'.
 *   6. Aucune membership (user authentifie sans tenant) -> 'allowed'
 *      (compromis : le user a un compte mais pas de tenant qui restreint
 *      cette shop ; on laisse passer).
 */
export interface MembershipScope {
  accessScope: "magrit_full" | "shop_only";
  allowedShopIds: string[];
}

export interface ShopAccessFromMembershipsInput {
  isAuthenticated: boolean;
  isSuperAdmin?: boolean;
  memberships: MembershipScope[];
  shopId: string;
}

export function resolveShopAccessFromMemberships(
  input: ShopAccessFromMembershipsInput,
): ShopAccess {
  if (!input.isAuthenticated) return "public";
  if (input.isSuperAdmin) return "allowed";
  if (input.memberships.length === 0) return "allowed";

  const explicitAllow = input.memberships.some(
    (m) =>
      m.accessScope === "shop_only" && m.allowedShopIds.includes(input.shopId),
  );
  if (explicitAllow) return "allowed";

  const hasFullAccess = input.memberships.some(
    (m) => m.accessScope === "magrit_full",
  );
  if (hasFullAccess) return "allowed";

  return "forbidden";
}
