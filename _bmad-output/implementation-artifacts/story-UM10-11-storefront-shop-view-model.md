---
id: UM10.11
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.7]
---
# UM10.11 — Sortir le modèle boutique du contexte workspace

## Problème

Les composants storefront n’utilisaient plus les données de `ShopsContext`,
mais une vingtaine de fichiers importaient encore `Shop`, `ShopTheme` et
`ShopProduct` depuis ce contexte React. Le storefront restait donc couplé à une
abstraction de la surface workspace au niveau du modèle TypeScript.

## Résultat

- les modèles de lecture historiques sont hébergés et exportés par le module
  `shops` ;
- le storefront importe directement ces modèles depuis le module ;
- `ShopsContext` les consomme et les réexporte temporairement pour préserver les
  autres écrans pendant leur migration ;
- aucune composante sous `components/shop` ne dépend plus de `ShopsContext`.

## Validation

- garde-fou récursif sur les imports du storefront ;
- typecheck modulaire, suite Vitest et build de production.
