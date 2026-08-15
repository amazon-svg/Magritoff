---
id: AF26.7
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.6]
---
# AF26.7 — Déclarer la sortie workspace de Commercial

## Résultat livré

- manifeste du module Commercial, adossé au service API existant ;
- feature et capability de gestion des groupes clients et règles de prix ;
- route lazy et navigation « Prix & marges » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

Le module reste limité au `workspace` : les règles commerciales influencent les
prix affichés ailleurs, mais leur administration n'est pas une surface autonome
du storefront, du portail client ou du backoffice actuel.
