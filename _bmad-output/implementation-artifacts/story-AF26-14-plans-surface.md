---
id: AF26.14
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.13]
---
# AF26.14 — Déclarer la sortie workspace de Plans

## Résultat livré

- nouveau manifeste `plans` ;
- feature de consultation et sélection du plan fonctionnel courant ;
- route lazy et navigation « Plan & abonnement » fournies par le registre ;
- suppression de la dernière route écran workspace codée dans `routes.tsx`.

## Limite fonctionnelle explicite

La page actuelle modifie une préférence utilisateur via l'API de session. Elle
ne constitue pas encore un abonnement tenant, ne déclenche aucun paiement et
ne porte aucun cycle de facturation. Le registre décrit donc le sélecteur
existant sans lui attribuer une capability de billing inexistante. Un véritable
module Subscriptions devra remplacer ce mécanisme avant commercialisation.
