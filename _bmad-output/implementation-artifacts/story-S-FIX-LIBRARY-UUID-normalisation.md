---
story_id: S-FIX-LIBRARY-UUID
epic: 0 — Foundations / Dette technique
title: Normaliser product_library.id en UUID strict (suite contournement P0.11)
status: spec-ready (post Phase 0.10 cadrage qualité, 2026-05-22)
created_at: 2026-05-22
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 8)
size: S (0.5j)
prd_ref: _bmad-output/planning-artifacts/architecture.md (§4.x cohérence DB)
predecessors: [P0.11 tenant_order_items.product_id nullable livré 2026-05-18]
successors: []
sprint_cible: Sprint 8 (roadmap qualité-first, dette technique)
context_origin: SPRINT_HANDOFF.md §12 "Hors scope Sprint 4 — Stories futures tracées"
---

# Story S-FIX-LIBRARY-UUID — Normalisation product_library.id en UUID

## Contexte

Le 2026-05-18, en Phase 1 Sprint 4 (bascule `tenant_order_items`), le pre-flight check 2 de S-MIGRATION-ORDERS a découvert que `tenant_order_items.product_id` était `NOT NULL`, ce qui bloquait l'insert de items library legacy dont `product_id` est un id texte (pas UUID). Fix appliqué : P0.11 ([20260518_02_tenant_order_items_product_id_nullable.sql](../../supabase/migrations/20260518_02_tenant_order_items_product_id_nullable.sql)) qui rend `product_id` nullable.

Le commentaire de la migration P0.11 dit explicitement :
> *"normaliser product_library en UUID strict V2+"*

C'est cette normalisation qui fait l'objet de cette story. Hors scope Sprint 4 cible démo, plié dans la roadmap qualité-first Sprint 8 (dette technique).

## Problème actuel

La table `public.product_library` ([20260420_libraries.sql](../../supabase/migrations/20260420_libraries.sql) + [20260424_02_tenant_id_on_data.sql:46](../../supabase/migrations/20260424_02_tenant_id_on_data.sql)) utilise une colonne `id` qui n'est PAS typée UUID strict :
- Type colonne : `text` (à confirmer par audit prod Task 1)
- Valeurs historiques : mélange de UUIDs valides (générés post-migration) + identifiants texte legacy (provenant d'imports CSV / pré-multi-tenant)

Conséquences :
- `tenant_order_items.product_id` ne peut pas être UUID NOT NULL avec FK strict vers `product_library.id` (cas P0.11)
- Les jointures `tenant_order_items → product_library` doivent être faites côté code via match texte au lieu de FK PostgreSQL (perte d'intégrité référentielle)
- Le trigger PIM `enqueue_pim_candidates_on_tenant_order_items` (P0.10) utilise une regex défensive UUID v4 pour filtrer les non-UUIDs avant enqueue — workaround qui contourne mais ne corrige pas

## Story (user story)

**As a** plateforme Magrit B2B,
**I want** que `product_library.id` soit normalisé en `uuid NOT NULL` strict, avec migration des valeurs legacy non-UUIDs vers de vrais UUIDs (+ mise à jour des références dans `tenant_order_items` et autres tables qui référencent),
**So that** (a) l'intégrité référentielle PostgreSQL est restaurée via FK strict, (b) le workaround `product_id nullable` peut être resserré (vers `NOT NULL` à nouveau), (c) le trigger PIM defensive regex peut être simplifié.

## Acceptance Criteria

### AC1 — Audit prod préalable (principe DoD #4)

**Given** la table `product_library` actuelle
**When** un audit SQL est exécuté avant migration
**Then** un rapport est produit avec :
- Type actuel de `product_library.id` (texte ? varchar ? uuid ?)
- Nombre total de rows
- Nombre de rows dont `id` est un UUID valide (regex v4)
- Nombre de rows dont `id` est legacy non-UUID
- Liste des tables référençant `product_library.id` (via grep migrations + `information_schema.referential_constraints`)
- Pour chaque table référençante : nombre de rows avec une référence non-UUID

**And** le rapport est sauvegardé dans `_bmad-output/implementation-artifacts/audit-product-library-uuid-2026-XX-XX.md` AVANT toute migration.

### AC2 — Migration `20260{XXX}_normalize_product_library_uuid.sql`

**Given** la migration est rédigée et testée sur staging
**When** elle est appliquée
**Then** :
1. Une colonne temporaire `product_library.id_new uuid` est ajoutée
2. Pour chaque row legacy non-UUID, un UUID v4 est généré et stocké dans `id_new` (mapping ancien `id` → nouveau UUID conservé dans table temporaire `product_library_id_migration` pour audit / rollback)
3. Pour chaque row UUID valide, `id_new` = `id::uuid` (cast direct)
4. Toutes les tables référençantes (audit AC1) sont UPDATE pour basculer leurs FK vers les nouveaux UUIDs via jointure sur `product_library_id_migration`
5. Drop des contraintes anciennes + drop `id` + rename `id_new → id` + ré-attache PK + recrée index
6. La table `product_library_id_migration` est conservée 1 sprint pour audit/rollback, puis archivée

**And** la migration est idempotente (rerun safe) et transactional (rollback total si une étape échoue).

### AC3 — Resserrer `tenant_order_items.product_id NOT NULL` (rollback P0.11)

**Given** AC2 a normalisé tous les UUIDs
**When** on resserre la contrainte
**Then** une migration de suivi `20260{XXX}_tenant_order_items_product_id_not_null.sql` :
- Vérifie qu'aucun row de `tenant_order_items` n'a `product_id = NULL` (audit pré-migration)
- Si tous OK : `ALTER COLUMN product_id SET NOT NULL`
- Ajoute FK `REFERENCES product_library(id) ON DELETE RESTRICT` (intégrité référentielle restaurée)
- Si rows NULL existent : la migration documente le scope minoritaire et propose 2 stratégies (soit cleanup manuel des rows orphelins, soit garder nullable et fermer la story ici en partial)

### AC4 — Simplifier le trigger PIM `enqueue_pim_candidates_on_tenant_order_items` (suite P0.10)

**Given** le trigger contient une regex défensive UUID v4 (héritée du contournement P0.10)
**When** AC2/AC3 sont livrés
**Then** la regex défensive est supprimée du trigger (commit séparé, mentionne explicitement le retrait)
**And** le trigger devient plus simple et plus rapide (pas de regex à chaque insert)

### AC5 — Tests vitest cohérence

**Given** un harness vitest sur les 3 tables (`product_library`, `tenant_order_items`, et tout référençant identifié AC1)
**When** les tests sont exécutés
**Then** au moins 5 cas vérifient :
- Insertion `tenant_order_items` avec `product_id` UUID valide : OK
- Insertion `tenant_order_items` avec `product_id` non-UUID : BLOQUÉ (cast fail au type uuid)
- Insertion `tenant_order_items` avec `product_id = NULL` : BLOQUÉ (NOT NULL)
- Suppression d'un `product_library` row référencé par tenant_order_items : BLOQUÉ (FK RESTRICT)
- Round-trip mapping legacy ID → nouveau UUID via `product_library_id_migration` cohérent

### AC6 — TF Notion

- "Insertion commande boutique avec produit library actuel — toujours OK post-normalisation" (Parcours P08, Persona Acheteur, Type SQL DB + UI)

## Out of scope

- ❌ Archivage de la table `product_library_id_migration` après 1 sprint → suivi opérationnel post-livraison, pas dans cette story
- ❌ Refactor du code front qui hardcode des IDs legacy product_library (le code doit utiliser les nouveaux UUIDs naturellement après migration data) → s'il en reste, fix opportuniste post-livraison
- ❌ Migration en V2+ vers nomenclature `library_items` (rename) → hors scope

## Tasks

- [ ] Task 1 — Audit prod SQL préalable + rapport `audit-product-library-uuid-*.md`
- [ ] Task 2 — Rédiger migration `normalize_product_library_uuid.sql` + dry-run staging
- [ ] Task 3 — Appliquer migration prod (avec backup pré-migration documenté)
- [ ] Task 4 — Rédiger + appliquer migration de suivi `tenant_order_items_product_id_not_null.sql`
- [ ] Task 5 — Simplifier trigger PIM (retrait regex défensive)
- [ ] Task 6 — Tests vitest cohérence (5+ cas)
- [ ] Task 7 — TF Notion AC6
- [ ] Task 8 — Mettre à jour `SPRINT_HANDOFF.md` section dette technique (signaler que la story est livrée + ce qu'on a fait au workaround P0.11)

## DoD spécifique

- [ ] Audit prod préalable obligatoire (principe #4)
- [ ] Story doc écrit AVANT démarrage (principe #9)
- [ ] Story atomique 0.5j (principe #7 ✅)
- [ ] TF Notion en parallèle (principe #8)
- [ ] Pas d'a11y / Sally requis (DB only)
- [ ] Smoke E2E acheteur AI post-migration confirme aucune régression sur insertion commande boutique (principe #3)
- [ ] Migration appliquée via dry-run staging d'abord, jamais directement prod

## References

- [Source: 20260420_libraries.sql] — création table product_library
- [Source: 20260424_02_tenant_id_on_data.sql:45-48] — ajout tenant_id sur product_library
- [Source: 20260518_02_tenant_order_items_product_id_nullable.sql] — workaround P0.11 + commentaire normalisation V2+
- [Source: SPRINT_HANDOFF.md §12 "Hors scope Sprint 4"] — story tracée
- [Source: project-context.md §5.2] — DoD qualité-first
- [Source: roadmap-v1.1-qualite-first-2026-05-21.md] — Sprint 8
