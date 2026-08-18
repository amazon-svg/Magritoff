---
id: UM10.19
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.17, UM10.18]
---
# UM10.19 — Rendre le runtime HTTP storefront autonome

## Problème

Les registres boutique étaient physiquement séparés, mais consommaient encore
`ApiRuntimeContext`. Ce runtime appelle `useAuth` pour construire le transport
workspace et imposait donc la présence de la session Magrit au-dessus des
providers storefront.

## Résultat

- nouveau `StorefrontApiRuntimeContext` sans dépendance à `AuthContext` ;
- son unique client utilise `fetch` same-origin et les cookies HttpOnly ;
- aucun token ni fournisseur d’identité Magrit n’est consulté ;
- les clients API et gateways storefront dépendent uniquement de ce runtime ;
- le runtime workspace conserve séparément son bearer transitoire.

## Validation

- garde-fou contre `useAuth` et `access_token` dans le runtime storefront ;
- garde-fous sur les deux racines de transport et de clients ;
- typecheck, suite Vitest complète et build de production.
