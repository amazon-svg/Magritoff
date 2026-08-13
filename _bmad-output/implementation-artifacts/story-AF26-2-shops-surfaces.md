---
id: AF26.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.1]
---
# AF26.2 — Déclarer les sorties multi-surfaces du module Shops

## Résultat livré

- storefront : contribution hôte pour la boutique publique et son catalogue ;
- workspace : liste et éditeur de boutique montés comme routes lazy ;
- backoffice : contribution de gouvernance des boutiques et actifs de marque ;
- navigation workspace « Boutiques » alimentée par le registre ;
- suppression des déclarations `DashboardShops` et `DashboardShopEditor` de
  `routes.tsx`.

Le module déclare séparément `shops.manage` et `shops.govern` afin que le futur
backoffice ne réutilise pas implicitement les droits du workspace tenant.
