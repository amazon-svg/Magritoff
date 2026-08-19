---
id: AF30.10
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.9]
---
# AF30.10 — Isoler les souscriptions de gammes tenant

## Intention

`DashboardTenantGammes` pilote directement la lecture et les commandes Catalog.
La vue doit se limiter à la hiérarchie PIM, aux permissions et à l'expansion.

## Critères d'acceptation

- lecture et conversion en ensemble actif portées par un hook ;
- commandes unitaires et groupées portées par le hook ;
- résultats tardifs neutralisés après changement de tenant ;
- messages et comportement lecture seule conservés ;
- composant sans client Catalog ;
- garde-fou d'architecture, tests, typecheck modulaire et build verts.

## Résultat livré

- `useTenantGammeSubscriptions` porte lecture, conversion en ensemble actif et
  commandes Catalog unitaires ou groupées ;
- les résultats tardifs sont neutralisés après un changement de tenant ;
- la vue conserve uniquement la hiérarchie PIM, les permissions et l'expansion ;
- le garde-fou API-first interdit le retour du client Catalog dans l'écran.

## Validation

- 166 fichiers de tests passés ;
- 1 225 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
