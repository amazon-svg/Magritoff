---
id: UM4.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM3.1]
---
# UM4.1 — Garantir un compte boutique pour l’utilisateur Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-153](https://app.notion.com/3c6d0131973c81f8a01dc2e0fc0574b1) | P12 — Délégation « Se connecter à la boutique » : compte miroir, bandeau permanent, commande tracée, sortie sans perdre la session Magrit | À jouer | P0 — Critique | P12 — Comptes clients boutique | B5 | UM4-1, UM5-1..3, UM6-8, invariants 5-6 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
