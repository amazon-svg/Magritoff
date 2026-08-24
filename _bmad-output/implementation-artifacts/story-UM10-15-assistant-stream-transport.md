---
id: UM10.15
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.8, UM10.12]
---
# UM10.15 — Séparer les transports IA Magrit et storefront

## Problème

Le chat Magrit et la recherche conversationnelle boutique utilisaient la même
instance de gateway SSE. Le storefront n’ajoutait pas de bearer en pratique,
mais le transport partagé acceptait encore un `accessToken`, ce qui rendait une
régression d’identité possible.

## Résultat

- le runtime expose deux instances assistant distinctes ;
- le hook de cycle de vie SSE exige le gateway choisi par la surface ;
- le chat Magrit injecte le gateway workspace autorisant son bearer ;
- le catalogue injecte le gateway storefront fondé sur le cookie HttpOnly ;
- ce gateway storefront rejette tout bearer avant l’appel réseau.

## Validation

- test adaptateur du mode cookie sans en-tête Authorization ;
- test fail-closed lorsqu’un bearer est fourni au transport storefront ;
- garde-fous d’architecture sur les injections des deux surfaces ;
- typecheck, suite Vitest complète et build de production.
