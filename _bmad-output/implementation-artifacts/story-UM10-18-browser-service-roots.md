---
id: UM10.18
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.15, UM10.17]
---
# UM10.18 — Séparer les providers de gateways navigateur

## Problème

Après la séparation des clients API, `BrowserServicesContext` exposait encore
simultanément les gateways workspace et storefront. Les composants boutique
devaient donc importer un module contenant aussi les services Magrit.

## Résultat

- `BrowserServicesContext` ne contient plus que assistant, Clariprint et
  mockups workspace ;
- `StorefrontBrowserServicesContext` compose assistant et Clariprint boutique ;
- ce provider utilise exclusivement `anonymousClient` et le gateway assistant
  qui interdit les bearers Magrit ;
- les composants catalogue, gamme et produit importent uniquement ce module
  storefront ;
- les deux providers sont visibles dans la composition racine.

## Validation

- garde-fous d’architecture sur la composition Clariprint et assistant ;
- absence de `anonymousClient` dans le provider workspace ;
- typecheck, suite Vitest complète et build de production.
