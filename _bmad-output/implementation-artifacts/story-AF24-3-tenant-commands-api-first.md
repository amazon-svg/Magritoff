---
id: AF24.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF24.2]
---
# AF24.3 — Sortir les commandes tenant du contexte React

## Résultat livré

- création d’un espace racine via `POST /api/v1/tenants` ;
- acceptation d’une invitation via
  `POST /api/v1/session/invitations/accept` ;
- contrats Zod, client HTTP, service applicatif et repository fournisseur
  regroupés dans le module Session ;
- conservation de l’enrichissement SIREN et de l’activation initiale des gammes
  en best-effort après la création ;
- erreur typée lorsque l’invitation appartient à un autre email, sans analyse
  d’un message PostgreSQL dans l’interface ;
- `TenantContext` limité à l’état et à l’orchestration UI ;
- suppression de `legacy-tenant-commands.ts`.

## Compatibilité des runtimes

Le client `/api/v1` reste utilisé en runtime Edge, donc avec Supabase local ou
distant selon la configuration serveur. Le client DEV transitoire implémente
le même contrat pour le mode local sans Edge ; il sera retiré lors de la
migration complète du bootstrap/authentification.

## Validation

- tests de contrat Session et tests d’architecture passants ;
- suite Vitest complète passante ;
- typecheck modulaire et build de production passants.
