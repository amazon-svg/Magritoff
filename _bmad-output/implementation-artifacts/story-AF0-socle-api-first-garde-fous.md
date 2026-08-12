---
id: AF0
epic: EPIC-8-API-FIRST
sprint: AF-A
priority: P0
effort: M
status: review
branch: refactor/api-first-foundation
depends_on: []
unblocks: [AF1, AF2, AF3]
---

# AF0 — Socle API-first et garde-fous

## User story

En tant qu'équipe Magrit, nous voulons un noyau minimal compilé strictement et des tests de frontières bloquants afin que la migration brownfield puisse avancer sans introduire de nouvelles dépendances Supabase dans le navigateur.

## Critères d'acceptation

1. **Given** la dette existante, **when** un fichier UI supplémentaire importe Supabase, **then** `pnpm test:architecture` échoue.
2. **Given** un fichier déjà en baseline, **when** son nombre de références ou d'URL Edge directes augmente, **then** le test échoue.
3. **Given** un nouveau module, **when** son `domain`, `application`, `api` ou `ui` connaît Supabase, **then** le test échoue.
4. **Given** le kernel, **when** il est compilé, **then** TypeScript strict, `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` sont actifs.
5. **Given** le kernel, **when** ses imports sont inspectés, **then** il ne dépend ni de React, ni d'un fournisseur, ni d'un module métier.
6. **Given** une pull request vers `main`, **when** la CI architecture s'exécute, **then** le typecheck modulaire et les tests de frontières sont bloquants.
7. Le comportement utilisateur, le schéma SQL et les API de production restent inchangés.

## Tasks

- [x] Formaliser ADR §4.21 et Epic 8.
- [x] Créer le kernel minimal : identifiants, erreurs, résultats, acteur, horloge, événements et pagination.
- [x] Ajouter les configurations TypeScript stricte et modulaire.
- [x] Mesurer et versionner la baseline Supabase du front.
- [x] Ajouter les tests de frontières kernel/modules/brownfield.
- [x] Ajouter le workflow CI architecture.
- [ ] Publier le TF AF0 dans le cahier de tests Notion (connecteur non disponible dans cette session).

## Contrats et API

Aucune API runtime créée. Les seuls contrats publiés sont internes au kernel : `Id`, `ActorContext`, `AppError`, `Result`, `Clock`, `DomainEvent`, `Page`.

## Dérogations R5

La dette existante reste temporairement autorisée par une baseline figée. Cette dérogation ne permet aucune nouvelle dépendance et doit décroître à chaque story de migration. Chemin de conformité : AF2 puis AF4-AF7, suivis des vagues par domaine.

## Plan de test

- `pnpm typecheck`
- `pnpm test:architecture`
- `pnpm vitest run tests/kernel/kernel.test.ts`
- `pnpm build`

## Dev Agent Record

### Notes d'implémentation

- Aucun changement de route, provider ou appel réseau dans AF0.
- Le kernel ne contient volontairement ni rôle, ni plan, ni statut de commande, ni type Supabase.
- La baseline est mesurée sur `main@eea7f56` et documente une dette, pas une permission architecturale.
- La baseline est synchronisée exactement : une baisse non reportée échoue également, afin d obliger chaque story à matérialiser la réduction de dette.

### Résultats de validation

- `pnpm typecheck` : vert.
- `pnpm test:architecture` : 3/3 verts.
- `pnpm test` : 757 verts, 87 ignorés selon les préconditions existantes.
- `pnpm build` : vert ; avertissement de chunk principal supérieur à 600 kB inchangé et hors périmètre AF0.
- `pnpm install --frozen-lockfile` : vert après restauration des dépendances.

### TF associé

Voir `TF-NOTION-AF0-architecture-boundaries.md`.
