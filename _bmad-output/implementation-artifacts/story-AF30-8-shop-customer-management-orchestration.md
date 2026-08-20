---
id: AF30.8
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.7, UM7.1]
---
# AF30.8 — Isoler la gestion des comptes clients boutique

## Intention

`ShopCustomerAccountsSection` pilote directement les lectures, créations,
activations et délégations ShopCustomers. La vue doit conserver uniquement les
interactions d'interface et consommer une orchestration métier explicite.

## Critères d'acceptation

- lecture et invalidation au changement de boutique portées par un hook ;
- réponses de liste et de mutation tardives ignorées après changement de boutique ;
- création, activation et délégation portées par le hook ;
- erreurs métier normalisées sans changer les messages existants ;
- ouverture de fenêtre et presse-papiers laissés à l'adaptateur navigateur ;
- composant sans client API ;
- garde-fou d'architecture, tests, typecheck modulaire et build verts.

## Résultat livré

- `useShopCustomerAccountManagement` porte liste, rafraîchissement, création,
  activation et délégation ShopCustomers ;
- les résultats tardifs de lecture ou mutation sont neutralisés après un
  changement de boutique ;
- la vue conserve les seuls effets strictement navigateur : fenêtre déléguée
  et presse-papiers ;
- le garde-fou API-first interdit le retour du client ShopCustomers dans le
  composant.

## Validation

- 164 fichiers de tests passés ;
- 1 220 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
