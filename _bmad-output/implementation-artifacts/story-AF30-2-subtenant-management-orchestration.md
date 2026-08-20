---
id: AF30.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.1]
---
# AF30.2 — Isoler l'orchestration des sous-espaces

## Résultat livré

- `useSubTenantManagement` porte chargement, création, suppression et états
  réseau des sous-espaces ;
- `DashboardTenantSpaces` ne connaît plus le client Session et conserve la
  présentation, les droits et la confirmation destructive ;
- la normalisation du slug est centralisée et couverte par des tests ;
- le changement de tenant réinitialise le formulaire et invalide les lectures
  en vol ;
- une réponse tardive de création ou suppression ne peut pas modifier l'écran
  d'un autre tenant.

## Validation

- tests de normalisation et garde-fou API-first adaptés ;
- suite Vitest complète, typecheck et build de production.
