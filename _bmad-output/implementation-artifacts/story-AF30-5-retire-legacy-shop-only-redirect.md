---
id: AF30.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.4, UM8.1]
---
# AF30.5 — Retirer la redirection automatique `shop_only`

## Problème

Une ancienne membership `shop_only` déclenche encore une lecture Shops puis
une redirection vers `/shop/:slug`. Or cette identité Supabase Auth n'est plus
une identité storefront. Le compte boutique migré est `delegated_only`, sans
credential ni session client : l'écran atteint ne peut donc pas considérer
l'utilisateur comme connecté.

## Règles fonctionnelles

- une membership historique `shop_only` n'ouvre jamais une session boutique ;
- aucun catalogue privé n'est révélé par cette identité ;
- l'utilisateur voit un état de transition explicite l'invitant à contacter
  l'administrateur pour recevoir une activation boutique ;
- aucun appel Shops n'est nécessaire pour afficher cet état ;
- les superadministrateurs conservent leur capacité d'audit Magrit.

## Critères d'acceptation

- suppression de `ShopOnlyRedirect` et de sa résolution réseau ;
- remplacement par une vue de migration sans destination storefront ;
- garde-fou d'architecture interdisant le retour d'une route `/shop/` dans ce
  parcours ;
- documentation de transition mise à jour ;
- tests, typecheck modulaire et build verts.

## Résultat livré

- `ShopOnlyRedirect` et sa lecture du client Shops sont supprimés ;
- `LegacyShopOnlyAccessNotice` explique la nécessité d'une activation autonome
  et permet de fermer la session historique ;
- `TenantAwareLayout` ferme le storefront pour les memberships héritées tout
  en conservant l'exception d'audit superadministrateur ;
- le sélecteur d'espaces conduit les profils uniquement historiques vers cet
  état de transition, jamais vers `/shop/:slug` ;
- un `data-testid` stable et un garde-fou d'architecture couvrent la vue.

## Validation

- 161 fichiers de tests passés ;
- 1 211 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
