---
id: AF26.11
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.10]
---
# AF26.11 — Déclarer la sortie workspace de Conversations

## Résultat livré

- manifeste du module Conversations, adossé au service API existant ;
- feature et capability de consultation de l'historique tenant ;
- route lazy et navigation « Historique » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

Cette tranche expose uniquement l'historique dans le `workspace`. La surface de
conversation principale reste pour l'instant dans le configurateur tenant et
sera composée séparément lorsque cette surface applicative aura un contrat
explicite dans le registre.
