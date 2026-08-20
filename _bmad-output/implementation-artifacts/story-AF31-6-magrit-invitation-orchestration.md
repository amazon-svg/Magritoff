---
id: AF31.6
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.5]
---

# AF31.6 — Isoler la création d'invitation Magrit

## Intention

La modale d'invitation chargeait les rôles, renouvelait la session, reconstruisait
un client authentifié et envoyait la commande. Cette orchestration sensible ne
devait pas rester dans le composant de formulaire.

## Résultat

- `useMagritInvitationManagement` charge les options de rôles ;
- les réponses tardives sont ignorées après fermeture ou changement d'espace ;
- la session est renouvelée immédiatement avant la création ;
- une erreur dédiée distingue l'expiration de session des problèmes API ;
- la modale conserve validation, sélection, feedback email et lien manuel ;
- aucun composant dashboard ne dépend désormais directement des clients de modules.

## Validation

- test de l'erreur de session et garde-fous API-first ;
- 177 fichiers et 1 257 tests passés ;
- typecheck modulaire et build de production passés.
