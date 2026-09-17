---
id: AF26.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.1]
---
# AF26.2 — Déclarer les sorties multi-surfaces du module Shops

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- storefront : contribution hôte pour la boutique publique et son catalogue ;
- workspace : liste et éditeur de boutique montés comme routes lazy ;
- backoffice : contribution de gouvernance des boutiques et actifs de marque ;
- navigation workspace « Boutiques » alimentée par le registre ;
- suppression des déclarations `DashboardShops` et `DashboardShopEditor` de
  `routes.tsx`.

Le module déclare séparément `shops.manage` et `shops.govern` afin que le futur
backoffice ne réutilise pas implicitement les droits du workspace tenant.
