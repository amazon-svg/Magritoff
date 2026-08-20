---
id: AF31.2
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.1]
---

# AF31.2 — Isoler l’orchestration de la gestion commerciale

## Intention

`DashboardCommercial`, ses lignes de groupes et sa modale de création de règle
recevaient ou appelaient directement `CommercialApiClient`. La surface doit
rester responsable de la présentation des règles, groupes et formulaires, sans
connaître le transport du module.

## Résultat

- `useCommercialManagement` porte l’overview et toutes les commandes ;
- les réponses tardives sont neutralisées après changement d’espace ;
- l’activation optimiste d’une règle se resynchronise en cas d’échec ;
- les sous-composants reçoivent des intentions métier plutôt qu’un client API ;
- les erreurs réseau deviennent visibles dans la page ;
- le module utilisateurs/invitations reste volontairement hors de ce lot.

## Validation

- test du contrat d’erreur et garde-fou API-first ;
- 173 fichiers et 1 248 tests passés ;
- typecheck modulaire et build de production passés.
