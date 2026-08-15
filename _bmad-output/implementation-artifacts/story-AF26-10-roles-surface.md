---
id: AF26.10
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.9]
---
# AF26.10 — Déclarer la sortie workspace de Roles

## Résultat livré

- manifeste du module Roles, adossé au service API existant ;
- feature et capability d'administration du workflow de commande ;
- route lazy et navigation « Workflow & rôles » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

Le module est limité au `workspace`. La capability déclarative documente le
contrat de composition ; la garde historique `can_manage_roles` reste appliquée
par l'écran et la navigation pendant la migration progressive des autorisations.
