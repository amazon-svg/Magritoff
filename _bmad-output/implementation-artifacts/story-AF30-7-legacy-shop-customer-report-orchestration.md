---
id: AF30.7
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.6, UM7.1]
---
# AF30.7 — Isoler le rapport de migration des comptes boutique

## Intention

`LegacyShopCustomerMigrationSection` pilote directement le client
ShopCustomers et son cycle réseau. La vue doit uniquement afficher un rapport
déjà résolu.

## Critères d'acceptation

- chargement et invalidation au changement de tenant portés par un hook ;
- réponse tardive ignorée ;
- refus ou panne masqués comme auparavant afin de ne pas révéler l'audit ;
- synthèse pending/skipped/orders extraite et testée ;
- composant sans client API ;
- tests, typecheck modulaire et build verts.

## Résultat livré

- `useLegacyShopCustomerMigrationReport` porte la requête, l'annulation logique
  et le masquage fail-closed du rapport privé ;
- `summarizeLegacyMigration` centralise les compteurs pending, skipped et
  commandes rattachées dans une fonction pure testée ;
- `LegacyShopCustomerMigrationSection` ne connaît plus le client
  ShopCustomers ;
- le garde-fou API-first vérifie la nouvelle frontière.

## Validation

- 163 fichiers de tests passés ;
- 1 217 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
