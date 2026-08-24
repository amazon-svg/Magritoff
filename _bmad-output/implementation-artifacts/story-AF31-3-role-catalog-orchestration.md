---
id: AF31.3
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.2]
---

# AF31.3 — Isoler le catalogue des rôles Magrit

## Intention

La page Workflow & rôles et sa modale de création/édition appelaient directement
le client Roles pour charger, enregistrer, réordonner et archiver les rôles.
Ce lot ne modifie ni les règles fonctionnelles, ni les assignations utilisateurs.

## Résultat

- `useRoleCatalogManagement` porte lecture et mutations du catalogue ;
- les modèles API sont adaptés hors de la page ;
- les réponses tardives sont ignorées après changement d’espace ;
- `RoleEditorDialog` reçoit une intention `onSave` et ne connaît plus Roles ;
- les erreurs serveur restent visibles dans la page ou dans la modale ;
- la matrice d’assignation et la conversion legacy restent hors de ce lot.

## Validation

- tests des transformations et garde-fou API-first ;
- 174 fichiers et 1 251 tests passés ;
- typecheck modulaire et build de production passés.
