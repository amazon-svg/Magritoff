---
id: AF28.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.7]
---
# AF28.1 — Composer les routes Catalog du storefront

## Résultat livré

- Catalog déclare une feature de consultation storefront et sa capability ;
- les routes existantes de liste, gamme et produit appartiennent désormais au
  module Catalog ;
- Shops reste propriétaire de la racine `/shop/:slug` et de l'identité de la
  boutique ;
- `portalRuntimePaths` résout les trois chemins depuis les contributions ;
- `parsePortalPath` reconnaît les patterns déclarés et leurs paramètres ;
- `portalPathForView` génère les URLs à partir de ces mêmes patterns ;
- les replis historiques (produit/gamme incomplet vers catalogue) restent
  inchangés ;
- les tests couvrent registre, résolution runtime et round-trip URL/vue.

## Frontière obtenue

Le host `PublicShop` continue de rendre les vues React, mais ne possède plus le
vocabulaire d'URL du catalogue. Une évolution du préfixe produit ou gamme se
fait dans la contribution Catalog sans modifier le routeur du portail.
