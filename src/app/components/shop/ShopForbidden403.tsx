/**
 * ShopForbidden403 — ecran d'acces refuse pour une boutique (Story S2.1, AC3).
 *
 * Affiche quand resolveShopAccess() retourne 'forbidden' :
 * user authentifie shop_only avec une shop hors de allowedShopIds.
 *
 * Pas de fuite : ne render PAS le ShopLayout / produits / branding tenant.
 * Lien retour vers /tenants pour permettre a l'user de basculer sur un
 * tenant ou une boutique a laquelle il a acces.
 */

import { Link } from "react-router";
import { TEST_IDS } from "../../lib/testIds";

export function ShopForbidden403() {
  return (
    <div
      data-testid={TEST_IDS.shop.forbidden403}
      className="min-h-screen grid place-items-center bg-bg px-6"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <div className="text-center max-w-md">
        <div
          className="font-mono uppercase text-ink-mute-2 mb-2.5"
          style={{ fontSize: "11px", letterSpacing: "0.08em", fontWeight: 500 }}
        >
          Accès refusé · 403
        </div>
        <h1
          className="text-ink m-0 mb-3"
          style={{ fontSize: "32px", fontWeight: 300, letterSpacing: "-0.025em" }}
        >
          Cette boutique ne fait pas partie de votre périmètre
        </h1>
        <p
          className="text-ink-muted m-0 mb-6"
          style={{ fontSize: "14.5px", fontWeight: 400, lineHeight: 1.55 }}
        >
          Votre compte est limité à un sous-ensemble de boutiques. Contactez
          votre administrateur pour étendre votre accès, ou retournez à la
          liste de vos espaces.
        </p>
        <Link
          to="/tenants"
          className="inline-block px-4 py-2 rounded-md bg-ink text-paper hover:bg-ink-2"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          Retour à mes espaces
        </Link>
      </div>
    </div>
  );
}
