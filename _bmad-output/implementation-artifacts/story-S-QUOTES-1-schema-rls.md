---
story_id: S-QUOTES-1
epic: Bibliothèque de devis éditables (v1.1)
title: Schema quote_lines + évolution quotes + RLS override admin + tests
status: livrée (code) — migration à appliquer par Arnaud (PAT requis)
delivered_at: 2026-07-02
target_branch: beta/v5
agent: Dev (Claude Code)
size: M
commits: []
---

# Story S-QUOTES-1 — Schema & RLS devis éditables

## Story

**As a** dev Magrit
**I want** le schéma multi-lignes des devis (`quote_lines` + évolution `quotes`) appliqué en migration avec RLS override admin et tests d'isolation
**So that** les stories aval (éditeur, bibliothèque, création depuis panier) s'appuient sur des fondations DB sécurisées supportant l'édition, les marges et la visibilité admin.

## AC

- **AC1** ✅ Migration `supabase/migrations/20260702000100_s_quotes_editable_library.sql` créée (idempotente).
- **AC2** ✅ `quotes` évoluée : colonnes `client_name` (text) + `updated_at` (timestamptz, trigger).
- **AC3** ✅ Statut `text` + CHECK rétro-compatible `('draft','sent','won','lost','pending','validated','rejected')` — pas de type Postgres (préserve legacy + KPIs).
- **AC4** ✅ Table `quote_lines` (quote_id FK cascade, product_name, product_config, quantity>0, unit_cost_ht, unit_price_ht, margin_pct, line_total_ht, position) + index `(quote_id, position)`.
- **AC5** ✅ Migration data compat : chaque devis existant → 1 `quote_line` (idempotent `where not exists`).
- **AC6** ✅ RLS `quotes` : SELECT tenant-scoped, INSERT auteur, UPDATE/DELETE auteur **OU** admin/owner tenant **OU** superadmin (calque `tenant_orders`). Nuance : l'auteur édite/supprime quel que soit le statut.
- **AC7** ✅ RLS `quote_lines` : héritent de l'accès au quote parent (SELECT + FOR ALL via `exists(... quotes q ...)`).
- **AC8** ✅ Trigger `set_quote_updated_at` sur `quotes`.
- **AC9** ✅ Tests vitest `tests/rls/quotes_lines_isolation.test.ts` — 6 cas (cross-tenant SELECT/INSERT, insert propre + ligne, quote_lines cross-tenant, override owner, blocage cross-tenant edit).
- **AC10** ✅ Types `src/types/database.types.ts` mis à jour manuellement (`quote_lines` + colonnes) pour débloquer le dev. **À régénérer** via Supabase gen types au déploiement (PAT requis).

## Décisions

- **user_id** réutilisé comme propriétaire (pas de `created_by` redondant).
- **Statuts** : mapping d'affichage 3 valeurs côté UI (en cours = draft/sent/pending · validé = validated/won · rejeté = rejected/lost).
- **Client** : `client_name` texte simple (la table `clients` a été droppée au Sprint 10, non réintroduite ; FK orpheline `client_id` non touchée).

## Points d'attention / suite

- ⚠️ **Migration non appliquée en prod** : nécessite le PAT Supabase (demander à Arnaud) puis `supabase gen types` pour régénérer proprement `database.types.ts`.
- Les N devis dupliqués historiques (paniers imprimés avant) restent éclatés (1 ligne chacun) — pas de refusion rétroactive.
- Gate avant S-QUOTES-2 : migration appliquée + tests RLS verts (`pnpm test tests/rls/quotes_lines_isolation.test.ts`).

## Fichiers

- `supabase/migrations/20260702000100_s_quotes_editable_library.sql` (nouveau)
- `tests/rls/quotes_lines_isolation.test.ts` (nouveau)
- `src/types/database.types.ts` (modifié — quote_lines + client_name + updated_at)
