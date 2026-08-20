---
id: UM8.4
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM5.3, UM8.1]
---
# UM8.4 — Supprimer l’accès storefront implicite des utilisateurs Magrit

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
