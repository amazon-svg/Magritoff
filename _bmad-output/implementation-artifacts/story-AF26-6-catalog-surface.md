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
`workspace`. Le catalogue public reste pour l'instant hébergé par la
contribution storefront de `shops` ; sa séparation fonctionnelle fera l'objet
d'une tranche dédiée afin de ne pas inventer une seconde route publique.
