---
id: AF6
epic: EPIC-8-API-FIRST
priority: P0
status: in-progress
branch: refactor/api-first-foundation
depends_on: [AF5]
---

# AF6 — Adaptateurs UI Orders multi-surfaces

## Objectif

Faire consommer le même client API Orders au checkout, au portail client et au back-office sans modifier les parcours ni les testIds.

## Avancement AF6.1 — confirmation checkout

- `PortalThankYou` charge le détail de la commande via `OrdersApiClient` ;
- le contrat de détail expose désormais `createdAt` avec les lignes et totaux ;
- la surface confirmation n importe plus Supabase et conserve son rendu existant ;
- baseline abaissée à 36 fichiers importeurs et 152 références directes.

## Validation

- détail local : 200, date PostgreSQL avec offset, total 240 EUR et une ligne ;
- suite complète : 805 tests réussis, 87 ignorés ;
- typecheck modulaire et build de production : réussis.

## Reste AF6

- unifier les capacités et rôles Orders derrière l API ;
- retirer le dernier accès table Orders du hook `useOrderRoles` ;
- exécuter les smokes multi-surfaces avant AF7.
