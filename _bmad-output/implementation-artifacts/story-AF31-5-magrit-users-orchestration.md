---
id: AF31.5
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.4]
---

# AF31.5 — Isoler la gestion des utilisateurs Magrit

## Intention

La page Utilisateurs chargeait et transformait directement membres et invitations,
puis appelait les mutations de deux modules depuis ses gestionnaires UX. Ce lot
ne change ni la distinction Magrit/boutique, ni la modale de création d'invitation.

## Résultat

- `useMagritUsersManagement` charge membres et invitations en parallèle ;
- une panne d'une source ne masque pas les données disponibles de l'autre ;
- les réponses tardives sont ignorées après changement d'espace ;
- changement de rôle, retrait, renvoi et révocation sont orchestrés hors vue ;
- confirmations, alertes et lien manuel restent sous le contrôle de l'écran ;
- la modale de création et son renouvellement de session restent hors de ce lot.

## Validation

- tests unitaires des adaptateurs membre et invitation ;
- garde-fous API-first et séparation des identités ;
- 176 fichiers et 1 256 tests passés ;
- typecheck modulaire et build de production passés.
