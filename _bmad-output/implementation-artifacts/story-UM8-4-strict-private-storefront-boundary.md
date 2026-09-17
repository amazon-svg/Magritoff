---
id: UM8.4
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM5.3, UM8.1]
---
# UM8.4 — Supprimer l’accès storefront implicite des utilisateurs Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-151](https://app.notion.com/3c6d0131973c8148a459e5fbe3aca0e7) | P12 — Boutique privée (invite_only) : aucun branding, aucun catalogue, pas de création libre, connexion seule | OK | P0 — Critique | P12 — Comptes clients boutique | B5 | UM8-4, UM9-1, SHOP_ACCESS_CONTROL invariants 1-2 et 9 |
| [TF-155](https://app.notion.com/3c6d0131973c8197945cc66c8042cbec) | P12 — Frontière des sessions : un cookie boutique n ouvre pas le workspace, un JWT Magrit n ouvre pas le portail client | En cours | P0 — Critique | P12 — Comptes clients boutique | B5 | ADR-IDENTITY-01, UM8-4, UM10-25, invariants 4-5-7 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- une boutique `invite_only` exige une session storefront dont le `shop_id`
  correspond exactement à la boutique ;
- la présence d’une session Magrit, d’une membership `magrit_full`, d’un ancien
  scope `shop_only` ou du statut super-admin n’entre plus dans la décision ;
- le BFF catalogue ne transmet plus `magritUserId` au module Shops et
  l’adaptateur ne consulte plus `current_user_can_access_shop` ;
- l’historique, le profil et la création de commande du portail ne lisent plus
  `AuthContext` ;
- la délégation reste le seul pont : elle crée une vraie session storefront
  limitée à la boutique et conserve l’acteur Magrit séparément pour l’audit ;
- une boutique `self_signup` conserve son catalogue public et exige une session
  storefront au moment de commander.

## Validation

- tests unitaires du garde pour boutique privée, publique et session d’une
  autre boutique ;
- test serveur prouvant qu’un acteur Magrit n’est pas transmis au catalogue ;
- garde-fous d’architecture interdisant `useAuth`, `useTenant` et le RPC legacy
  dans la surface storefront ;
- contrôle navigateur : catalogue privé absent avant connexion, catalogue
  `self_signup` toujours visible ;
- suite Vitest, typecheck modulaire et build Vite.
