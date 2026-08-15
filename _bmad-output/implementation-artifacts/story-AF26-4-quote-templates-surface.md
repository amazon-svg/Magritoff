---
id: AF26.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.3]
---
# AF26.4 — Déclarer la sortie workspace de QuoteTemplates

## Résultat livré

- manifeste propre au module QuoteTemplates ;
- feature et capability de gestion des gabarits du tenant ;
- route lazy et navigation « Gabarits de devis » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

Le module est volontairement limité à `workspace`. Les gabarits intégrés sont
consommés par les autres surfaces, mais leur gestion n’est pas une contribution
storefront, portail client ou backoffice dans le modèle fonctionnel actuel.
