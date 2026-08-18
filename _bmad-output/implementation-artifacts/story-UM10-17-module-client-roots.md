---
id: UM10.17
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.15, UM10.16]
---
# UM10.17 — Séparer les composition roots HTTP

## Problème

Les hooks storefront utilisaient les bons transports, mais leurs clients
étaient encore construits dans le même contexte React que les clients Magrit.
Une future importation erronée pouvait donc réintroduire un client workspace
dans une surface boutique sans franchir de frontière de module visible.

## Résultat

- `ModuleClientsContext` ne compose plus que les clients workspace ;
- `StorefrontModuleClientsContext` compose séparément identity, shops, orders
  et diagnostics avec `anonymousClient` ;
- le provider storefront est explicite dans la racine applicative ;
- tous les composants boutique importent leurs hooks depuis ce module dédié ;
- aucun client utilisant `apiRuntime.client` n’est exposé par le registre
  storefront.

## Validation

- garde-fous d’architecture sur les deux composition roots ;
- vérification que le registre storefront ne contient aucun client workspace ;
- typecheck, suite Vitest complète et build de production.
