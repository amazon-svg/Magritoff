---
id: UM4.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM3.1]
---
# UM4.1 — Garantir un compte boutique pour l’utilisateur Magrit

- primitive SQL `api_ensure_self_shop_customer` atomique et idempotente ;
- identité dérivée exclusivement de `auth.uid()` et de `auth.users` ;
- aucun email ni nom fourni par le navigateur ;
- contrôle du tenant, de la boutique et de `can_impersonate_shop_customer` ;
- unicité conservée par `(shop_id, normalized_email)` ;
- réutilisation du compte existant, même s’il a déjà été activé comme client ;
- nouveau compte créé en `delegated_only`, sans credential ni mot de passe ;
- route et client partagés `POST .../customers/self` ;
- réponse distinguant création et réutilisation sans exposer d’identité Auth
  technique.

Cette story ne démarre aucune délégation. UM5 composera cette primitive avec la
création d’une session courte pour livrer l’action unique « Se connecter à la
boutique ».
