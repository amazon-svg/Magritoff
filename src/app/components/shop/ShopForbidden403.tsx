/**
 * ShopForbidden403 — ecran d'acces refuse pour une boutique (Story S2.1, AC3).
 *
 * Affiche avant tout contenu boutique quand une authentification est requise
 * ou quand le compte courant ne fait pas partie du périmètre invité.
 *
 * Pas de fuite : ne render PAS le ShopLayout / produits / branding tenant.
 * Lien retour vers /tenants pour permettre a l'user de basculer sur un
 * tenant ou une boutique a laquelle il a acces.
 */

import { useState } from "react";
import { Link } from "react-router";
import { TEST_IDS } from "../../lib/testIds";
import { ForgotPasswordModal } from "../auth/ForgotPasswordModal";
import { LoginModal } from "../auth/LoginModal";

interface Props {
  authenticationRequired?: boolean;
}

export function ShopForbidden403({ authenticationRequired = false }: Props) {
  const [modal, setModal] = useState<"login" | "forgot" | null>(null);

  return (
    <>
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
            {authenticationRequired ? "Boutique privée" : "Accès refusé · 403"}
          </div>
          <h1
            className="text-ink m-0 mb-3"
            style={{ fontSize: "32px", fontWeight: 300, letterSpacing: "-0.025em" }}
          >
            {authenticationRequired
              ? "Connectez-vous avec votre compte invité"
              : "Cette boutique ne fait pas partie de votre périmètre"}
          </h1>
          <p
            className="text-ink-muted m-0 mb-6"
            style={{ fontSize: "14.5px", fontWeight: 400, lineHeight: 1.55 }}
          >
            {authenticationRequired
              ? "Le catalogue est réservé aux personnes invitées par l’administrateur de la boutique."
              : "Votre compte n’a pas accès à cette boutique. Contactez son administrateur pour recevoir une invitation."}
          </p>
          {authenticationRequired ? (
            <button
              type="button"
              onClick={() => setModal("login")}
              className="inline-block px-4 py-2 rounded-md bg-ink text-paper hover:bg-ink-2"
              style={{ fontSize: "13px", fontWeight: 500 }}
            >
              Se connecter
            </button>
          ) : (
            <Link
              to="/tenants"
              className="inline-block px-4 py-2 rounded-md bg-ink text-paper hover:bg-ink-2"
              style={{ fontSize: "13px", fontWeight: 500 }}
            >
              Retour à mes espaces
            </Link>
          )}
        </div>
      </div>
      {modal === "login" && (
        <LoginModal
          onClose={() => setModal(null)}
          onSwitchToSignup={() => undefined}
          onSwitchToForgot={() => setModal("forgot")}
          allowSignup={false}
        />
      )}
      {modal === "forgot" && (
        <ForgotPasswordModal
          onClose={() => setModal(null)}
          onSwitchToLogin={() => setModal("login")}
        />
      )}
    </>
  );
}
