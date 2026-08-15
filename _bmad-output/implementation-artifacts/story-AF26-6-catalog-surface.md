---
id: AF26.6
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.5]
---
# AF26.6 — Déclarer la gestion workspace du Catalog

## Résultat livré

- manifeste du module Catalog, adossé aux contrats et services API existants ;
- features et capabilities distinctes pour les souscriptions de gammes et la
  gouvernance du PIM global ;
- routes lazy « Gammes actives » et « PIM — Produits » issues du registre ;
- navigation Catalogue alimentée par la contribution du module ;
- suppression des déclarations correspondantes dans `routes.tsx`.

Cette tranche décrit la sortie de gestion réellement disponible dans
`workspace`.

## Extension AF28.1

La séparation storefront est désormais effective : Catalog possède les routes
existantes `catalog`, `g/:gammeSlug` et `p/:productId`. Shops conserve la racine
de boutique `shop/:slug`. Aucune nouvelle URL n'a été inventée.
