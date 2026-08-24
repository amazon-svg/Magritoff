---
id: UM10.4
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM8.4, UM10.2]
---
# UM10.4 — Isoler l’état transactionnel par boutique

## Problème

React peut conserver la même instance de `PublicShop` lors d’une navigation de
`/shop/a` vers `/shop/b`. Le panier, la dernière confirmation, les avertissements
de renouvellement et les filtres pouvaient donc survivre au changement de slug.
Pendant le premier rendu, la marque A pouvait également être brièvement peinte
sous l’URL de B avant le déclenchement de l’effect de chargement.

## Résultat

- panier, dernière commande confirmée, avertissements, filtres temporaires,
  signal du drawer et clé d’idempotence sont réinitialisés à la frontière slug ;
- le rendu reste sur le loader tant que la boutique chargée ne correspond pas
  exactement au slug courant ;
- une commande ou un panier de A ne peut plus être présenté ni soumis dans B.

## Validation

- garde-fou d’architecture dédié aux resets et au garde avant peinture ;
- tests storefront ciblés et typecheck modulaire.
