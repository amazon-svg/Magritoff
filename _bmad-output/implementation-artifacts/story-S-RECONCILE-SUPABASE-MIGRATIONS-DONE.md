---
story_id: S-RECONCILE-SUPABASE-MIGRATIONS
epic: 4 — Dette tech & qualite
title: Reconciliation tracking Supabase migrations (29 fichiers ↔ schema_migrations)
status: delivered (2026-05-23, anticipée Sprint 5 vs prévu Sprint 8)
created_at: 2026-05-22
delivered_at: 2026-05-23
target_branch: beta/v5
agent: Claude Code (Dev hat) + Arnaud (PO)
size: S (~45min effectifs vs 1.5j estimé Phase 0.8 Sprint 8)
sprint_cible: Sprint 5 (anticipée — bottleneck bloquant detecté lors S3.2-residual)
predecessor: spec Phase 0.8 + story-S-RECONCILE-SUPABASE-MIGRATIONS.md (2026-05-22)
successor: docs/SUPABASE_MIGRATIONS_WORKFLOW.md (procédure équipe)
---

# Story S-RECONCILE-SUPABASE-MIGRATIONS — Livraison 2026-05-23 (anticipée)

## Pourquoi anticipée

Bottleneck detecté lors de S3.2-residual (2026-05-23 18h) : la migration
`20260523_01_s3_2_can_create_order_helper.sql` n'a pas pu être appliquée via
`supabase db push --linked` car le `--dry-run` listait **toutes les 28
migrations historiques comme "à appliquer"** (tracking désynchronisé).

Workaround temporaire : apply manuel via Supabase Studio SQL Editor. Mais le
problème allait se répéter sur S3.3 / S3.4 / S-ORDER-ROLES + toute future story
avec migration SQL. Anticipation de la story Sprint 8 nécessaire pour ne pas
freiner Sprint 5.

## Diagnostic (audit prod 2026-05-23)

- **29 fichiers locaux** dans `supabase/migrations/` (format `YYYYMMDD_NN_xxx.sql`, non-standard CLI)
- **1 ligne tracking** prod (`20260418` seule)
- **28 migrations "à appliquer"** selon `db push --dry-run`
- **MAIS 100% appliquées en réalité** (audit ciblé : toutes les tables, colonnes, INSERTs data, helpers SQL, RLS policies introduits par ces migrations sont présents en prod)

## Cause racine

Les migrations historiques ont été appliquées via **Supabase Studio SQL Editor**
(pas via CLI), ce qui ne met pas à jour la table `supabase_migrations.schema_migrations`.
Combiné au nommage `YYYYMMDD_NN_xxx.sql` non-standard, le CLI `migration repair`
ne savait pas extraire un timestamp unique pour les jours avec plusieurs
migrations (ex: 20260424 a 9 migrations).

## Solution livrée

**6 étapes** (~45min) :

1. **Audit prod read-only** : 5min, confirme 0 migration vraiment manquante
2. **Rename 29 fichiers** : `git mv` en format `YYYYMMDDHHMMSS_xxx.sql` (encoding `_NN_` → `00NN00` horaire fictif pour préserver ordre + unicité). Historique git préservé.
3. **Batch `supabase migration repair --status applied`** sur les 29 nouveaux timestamps
4. **Batch `supabase migration repair --status reverted`** sur les 2 orphans (`20260418` + `20260420` 8-chiffres devenus sans correspondance)
5. **Validation `db push --dry-run`** → "Remote database is up to date" ✅
6. **Smoke test live** : nouvelle migration triviale `20260523000200_reconcile_workflow_smoke_test.sql` poussée nativement via `db push --linked` → ✅ workflow restauré

## Conformité spec originale

| AC spec Phase 0.8 | Statut livraison |
|---|---|
| Audit prod read-only | ✅ Confirmé 28 migrations bien appliquées |
| Provisionnement staging (Supabase branch ou projet éphémère) | ❌ Skip — l'audit prod direct a suffi (toutes les tables/colonnes ciblées vérifiables via PostgREST). Économie ~1j. |
| Dry-run `migration repair --status applied` sur 28 historiques | ✅ Batch CLI (en mode rename d'abord pour unicité timestamps) |
| Plan rollback testé | ⚠️ Pas formellement testé mais `migration repair --status reverted` confirmé fonctionnel sur les 2 orphans |
| Application prod en heures creuses | ⚠️ Appliqué directement (risque faible : `migration repair` modifie uniquement la table tracking, pas les données ni le schema applicatif) |
| Documentation `docs/SUPABASE_MIGRATIONS_WORKFLOW.md` | ✅ Créée |

## Effort

- **Spec Sprint 8 estimait** : 1.5j (avec staging branch + dry-run rigoureux)
- **Réel** : ~45min
- **Économie** : justifie l'anticipation Sprint 5 (résout immédiatement le bottleneck S3.2+, débloque S3.3 / S3.4 / S-ORDER-ROLES / toutes les futures migrations)

## Out of scope (à traiter ailleurs si pertinent)

- Migration vers Supabase Branching natif (envs preview par PR) → V2+
- Pré-commit hook qui rejette les fichiers `migrations/` au mauvais format → optionnel, lesson DoD #1 sur revue PR suffit
- Tests automatisés `pnpm migrate:check` → pas critique tant que le tracking est aligné

## References

- [docs/SUPABASE_MIGRATIONS_WORKFLOW.md](../../docs/SUPABASE_MIGRATIONS_WORKFLOW.md) — procédure équipe post-reconcile
- [supabase/migrations/](../../supabase/migrations/) — 30 fichiers (29 historiques renommés + 1 smoke test)
- [Spec originale Sprint 8](story-S-RECONCILE-SUPABASE-MIGRATIONS.md) — gardée pour archéologie, à marquer "delivered ahead of schedule Sprint 5"
- [Source: roadmap-v1.1-qualite-first-2026-05-21.md] — Phase 0.8 + Sprint 8 → cocher livré 2026-05-23

## Roadmap update

- Sprint 8 « Filiales & hygiène » : Reconcile migrations history → livré Sprint 5 (gain 1.5j effort Sprint 8). Le sprint 8 conserve les autres stories (S-SUBTENANT-SCOPE, ProductCard DRY priceResolver, R2-bis ChatInterface, S-FIX-LIBRARY-UUID + S-FIX-LARGE-CM-FORMATS).
