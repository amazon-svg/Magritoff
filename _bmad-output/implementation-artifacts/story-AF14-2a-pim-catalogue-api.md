---
id: AF14.2a
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF14.1]
---

# AF14.2a — Isoler les lectures et commandes du PIM global

## Résultat livré

- contrats indépendants pour les gammes et définitions PIM ;
- lecture agrégée du catalogue PIM via `/api/v1/catalog/pim` ;
- commandes d’upsert et suppression des gammes et définitions ;
- mapping explicite entre contrats camelCase et stockage snake_case ;
- migration complète de `PIMContext` vers `CatalogApiClient` ;
- contrôle administrateur effectué côté serveur avant toute écriture.

## Invariants

- une lecture PIM requiert une session utilisateur ;
- les écritures exigent super-admin ou `user_preferences.is_admin` ;
- le slug d’une gamme est imposé par la route ;
- les identifiants de définitions sont validés avant l’adaptateur ;
- aucun type PostgreSQL n’est exposé dans les contrats.

## Mesures

- `PIMContext` : **6 → 0** références Supabase ;
- baseline globale : **81 → 75** références ;
- fichiers UI important Supabase : **24 → 23**.

## Hors périmètre immédiat

Les commandes d’automatisation `pim-generate` et `pim-ingest`, ainsi que le
compteur de candidats, restent dans `DashboardAdminPIM`. Elles constituent le
sous-lot AF14.2b afin de séparer le CRUD catalogue du pipeline IA.

## Validation UX attendue

Vérifier le chargement des gammes dans l’onboarding, l’éditeur de boutique et
le dashboard PIM. Modifier l’image d’une gamme, créer puis éditer une définition
et la supprimer. Un compte non administrateur ne doit pas pouvoir forger ces
commandes.
