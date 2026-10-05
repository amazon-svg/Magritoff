# Epics

Une epic décrit un résultat produit cohérent et référence ses fonctionnalités. Utiliser [`_template.md`](_template.md).

## Epics actifs

| Epic | Domaine | État documentaire | État du chantier |
|---|---|---|---|
| [EPIC-E10](EPIC-E10-gestion-commerciale.md) | Gestion commerciale | `draft` | actif, état de livraison à rapprocher |

## Correspondance des epics BMAD historiques

Ce registre empêche la recréation automatique d'anciens chantiers comme backlog actif.

| Epic historique | Constat de l'export du 04/09/2026 | Traitement |
|---|---|---|
| Epic 0 — Démo Readiness | terminé ou résiduel dispersé | historique ; correctifs résiduels à requalifier séparément |
| Epic 1 — Stack Foundations | livré | historique technique |
| Epic 2 — Boutique B2B socle | absorbé par les évolutions ultérieures | ne pas recréer |
| Epic 3 — Commandes | majoritairement livré | couvert par les domaines Boutique et Gestion commerciale |
| Epic 4 — Mockup Engine | statuts historiques non fiables, implémentation reconstruite | audit technique avant éventuelle nouvelle epic |
| Epic 5 — Connecteurs design | jamais démarré | candidat, revue produit requise |
| Epic 6 — Quotas et tiers | jamais démarré | candidat, revue produit requise |
| Epic 7 — Boutique v2 | clos 14/14 | historique de livraison |
| Epic 8 — Refactorisation API-first | clos au 20/08/2026 | historique technique |
| Epic E10 — Gestion commerciale | explicitement actif | migré sous `EPIC-E10` |

Sources : `_bmad-output/planning-artifacts/epics.md`, `docs/spec/backlog.md` et `SPRINT_HANDOFF.md`. Les statuts de livraison devront être recalculés à partir du code et des tests lors de la migration des stories.
