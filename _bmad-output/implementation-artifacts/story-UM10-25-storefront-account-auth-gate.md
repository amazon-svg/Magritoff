---
id: UM10.25
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.24]
---
# UM10.25 — Garder le hub compte par la session boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-155](https://app.notion.com/3c6d0131973c8197945cc66c8042cbec) | P12 — Frontière des sessions : un cookie boutique n ouvre pas le workspace, un JWT Magrit n ouvre pas le portail client | En cours | P0 — Critique | P12 — Comptes clients boutique | B5 | ADR-IDENTITY-01, UM8-4, UM10-25, invariants 4-5-7 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Sur une boutique ouverte à l'inscription, un visiteur anonyme pouvait ouvrir
« Compte » et voir un état « Aucune commande ». Cette présentation laissait
croire qu'une session existait alors que le BFF n'avait résolu aucun compte
boutique.

## Résultat

- le hub vérifie la session du couple compte/boutique avant d'afficher sa
  navigation ;
- sans session, il présente le formulaire boutique commun de connexion,
  création ou récupération ;
- l'inscription reste proposée uniquement pour une boutique `self_signup` ;
- la session créée est remontée à `PublicShop` sans Auth Magrit ;
- commandes, devis et profil ne sont rendus qu'après authentification.

## Validation

- parcours anonyme vérifié dans le navigateur sur Supabase local ;
- garde-fou sur le formulaire et la remontée de session ;
- typecheck, suite Vitest complète et build de production.
