---
id: AF7
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF6]
---

# AF7 — Sortie Supabase du périmètre Orders

## Résultat

- aucun import Supabase ne subsiste dans les composants et hooks Orders ;
- aucun nom de table Orders ne subsiste dans les appels exécutables de `src/app` ;
- création, édition, transitions, listes, audit, détails et rôles passent par `/api/v1` ;
- la baseline globale est ramenée à 35 fichiers importeurs et 150 références directes ;
- les surfaces acheteur, portail et dashboard partagent les mêmes contrats.

## Smokes locaux

- création checkout atomique + rejeu idempotent : réussis ;
- édition brouillon + recalcul total + rejeu : réussis ;
- refus d édition hors brouillon : 409 attendu ;
- transition owner et affichage de l action suivante : réussis ;
- écran d édition portail : quantité 3 → 4, total HT 180 → 240 EUR ;
- détail confirmation et capacités Orders : 200.

## Validation finale

- suite complète : 806 tests réussis, 87 ignorés ;
- typecheck modulaire : réussi ;
- build de production : réussi ;
- garde-fou API-first : réussi avec baseline réduite.
