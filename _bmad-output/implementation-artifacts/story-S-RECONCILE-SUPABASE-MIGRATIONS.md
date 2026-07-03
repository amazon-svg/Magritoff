---
story_id: S-RECONCILE-SUPABASE-MIGRATIONS
epic: 0 — Foundations / Dette technique
title: Reconcile Supabase migrations history — repair + dry-run staging + rollback plan
status: spec-ready (post Phase 0.8 cadrage qualité, 2026-05-22)
created_at: 2026-05-22
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 8)
size: M (1.5j)
prd_ref: _bmad-output/planning-artifacts/architecture.md (santé tooling)
predecessors: [tous les sprints jusqu'à 2026-05-18 ont appliqué les migrations manuellement via Dashboard SQL Editor]
successors: []
sprint_cible: Sprint 8 (roadmap qualité-first, dette technique)
context_origin: retrospective-sprint3-partial.md L88-93 + retrospective-sprint4-2026-05-20.md
risk_level: élevé (touche `supabase_migrations.schema_migrations` — table de contrôle Supabase)
---

# Story S-RECONCILE-SUPABASE-MIGRATIONS — Mode opératoire de reconcile

## Contexte

Depuis le démarrage du projet (avril 2026), les migrations SQL Magrit ont été appliquées **manuellement** via Dashboard Supabase SQL Editor sur le projet `ightkxebexuzfjdbpsdg`. Conséquence : la table de contrôle `supabase_migrations.schema_migrations` est **désynchronisée** — elle ne référence pas la plupart des fichiers `supabase/migrations/*.sql` existants. Du coup `supabase db push --linked` échoue systématiquement.

**Évidence** : 28 fichiers `supabase/migrations/*.sql` existent dans le repo (du `20260418_library_client.sql` au `20260518_02_tenant_order_items_product_id_nullable.sql`), mais `supabase_migrations.schema_migrations` n'en répertorie qu'une fraction (à confirmer par audit AC1).

**Workaround actuel** : continuer à appliquer chaque nouvelle migration via Dashboard SQL Editor + ne jamais utiliser `supabase db push`. Tracé en rétro Sprint 3 (10/05) puis Sprint 4 (20/05) sans avoir été résolu.

**Conséquences du non-fix** : (a) impossibilité d'utiliser le tooling CLI standard, (b) risque de divergence schéma local vs prod si quelqu'un crée une migration sans l'appliquer manuellement, (c) onboarding devs futurs douloureux, (d) impossible d'ouvrir une branche Supabase de staging propre.

## Story (user story)

**As a** plateforme Magrit B2B + équipe RPP qui rejoindra le projet,
**I want** que `supabase_migrations.schema_migrations` soit aligné avec les fichiers `supabase/migrations/*.sql` du repo, et que `supabase db push --linked` fonctionne sans intervention manuelle,
**So that** (a) les futures migrations passent par le pipeline CLI standard, (b) une branche Supabase staging peut être créée et utilisée pour les dry-runs (cf. S-FIX-LIBRARY-UUID, S-LLM-WRAPPER-ROBUSTNESS, etc.), (c) la santé du tooling est restaurée.

## Acceptance Criteria

### AC1 — Audit pré-Reconcile sur prod (read-only)

**Given** un audit SQL Supabase Studio sur le projet `ightkxebexuzfjdbpsdg`
**When** la query est exécutée
**Then** un rapport est produit `_bmad-output/implementation-artifacts/audit-supabase-migrations-2026-XX-XX.md` contenant :

```sql
-- Query 1 : état actuel
SELECT version, statements, name, executed_at
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Query 2 : compteur
SELECT COUNT(*) AS rows_in_table FROM supabase_migrations.schema_migrations;
```

**And** le rapport tabule pour chaque fichier `supabase/migrations/*.sql` du repo : (a) version extraite du nom de fichier (préfixe `20260...`), (b) présence dans `schema_migrations` (oui/non), (c) action recommandée (`repair` si fichier appliqué mais absent de la table, `apply` si fichier non-appliqué — cas rare, `skip` si déjà aligné).

**And** un test SQL non-destructif vérifie l'idempotence des migrations historiques (chaque `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, etc. doit être présent pour qu'un re-run ne casse rien — ce qui rendrait le `repair --status applied` safe).

### AC2 — Création environnement staging Supabase pour dry-run

**Given** Supabase permet de créer une **branche de staging** depuis un projet prod (feature beta 2025+, à confirmer dispo sur le compte Magrit)
**When** une branche staging est créée
**Then** :
- Soit via UI Supabase Dashboard "Branches" → "Create staging branch from `ightkxebexuzfjdbpsdg`"
- Soit (fallback) en créant un nouveau projet Supabase éphémère `magrit-staging-2026-05-XX` puis en y restaurant un dump prod via `pg_dump` (lourdier mais portable)

**And** la branche staging est documentée dans le rapport audit (URL Studio, slug projet)

**And** ⚠️ **important** : aucune migration n'est exécutée en prod **avant** validation complète sur staging

### AC3 — Dry-run reconcile sur staging

**Given** l'environnement staging répliqué et la liste `repair` du rapport AC1
**When** on exécute le reconcile sur staging
**Then** la séquence suivante est jouée :

```bash
# Depuis racine repo Magrit, avec PAT Supabase valide
export SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/staging-pat.txt)
export STAGING_REF=<slug_branche_staging>

# Étape 1 : linker le repo à la branche staging temporairement
supabase link --project-ref $STAGING_REF

# Étape 2 : marquer chaque migration historique comme "applied"
# (script généré depuis le rapport audit AC1)
for version in 20260418_library_client 20260418_shop_module 20260418_user_data \
               20260420_libraries 20260420_pim 20260422_quote_templates \
               20260424_01_tenants_core 20260424_02_tenant_id_on_data \
               20260424_03_pim_subscriptions_and_ingestion 20260424_04_rls_tenant_scoped \
               20260424_05_bootstrap_magrit_root 20260424_06_shops_library_ids \
               20260424_07_pim_image_url_columns 20260424_08_pim_ingestion_shop_orders \
               20260424_09_shops_excluded_products 20260505_01_e9_users_management \
               20260505_02_e9_user_permissions 20260505_03_e9_tenant_rename \
               20260505_04_e6_siren_email_pro 20260506_01_e7_llm_usage_tracking \
               20260509_01_e1_orders_v1_1 20260510_01_e4_storage_product_mockups \
               20260511_01_shop_orders_select_buyer 20260511_02_R0_tenant_tax_regime \
               20260511_03_shop_order_trigger_uuid_defensive 20260517_01_pim_gammes_extension \
               20260518_01_pim_candidates_on_tenant_order_items \
               20260518_02_tenant_order_items_product_id_nullable; do
  echo ">>> repairing $version"
  supabase migration repair --status applied "$version"
done

# Étape 3 : valider que `supabase db push` retourne "Remote database is up to date."
supabase db push --linked

# Étape 4 : créer une migration test no-op pour valider end-to-end
echo "-- test reconcile no-op" > supabase/migrations/20260{XXX}_reconcile_test_noop.sql
echo "DO \$\$ BEGIN RAISE NOTICE 'reconcile test ok'; END \$\$;" >> supabase/migrations/20260{XXX}_reconcile_test_noop.sql
supabase db push --linked
# Doit retourner "Applying migration 20260{XXX}_reconcile_test_noop.sql..."

# Étape 5 : cleanup test
rm supabase/migrations/20260{XXX}_reconcile_test_noop.sql
supabase migration repair --status reverted "20260{XXX}_reconcile_test_noop"
```

**And** chaque sortie de chaque commande est captée et archivée dans le rapport audit (annexe "dry-run staging log").

**And** si une commande échoue, **arrêt immédiat** + investigation + le reconcile n'est PAS appliqué en prod tant que le dry-run n'est pas réussi end-to-end.

### AC4 — Plan rollback

**Given** un risque de casser la production
**When** le rollback est nécessaire (cas extrême)
**Then** le plan rollback est documenté et testé sur staging :

1. **Backup pré-reconcile** : avant toute commande `supabase migration repair` sur prod, exécuter `pg_dump` complet ou prendre un snapshot Supabase via Dashboard (Backups). Date + ID snapshot tracés.
2. **État cible rollback** : `supabase_migrations.schema_migrations` revient à son état pré-reconcile (potentiellement vide ou partiel comme aujourd'hui).
3. **Commandes rollback** :
   ```bash
   # Inverse de chaque repair appliqué
   for version in <liste_versions_appliquées>; do
     supabase migration repair --status reverted "$version"
   done

   # Si supabase_migrations entière est corrompue : restore from snapshot
   # via Dashboard Supabase → Backups → Restore <snapshot_id>
   ```
4. **Validation post-rollback** : query `SELECT COUNT(*) FROM supabase_migrations.schema_migrations` doit retourner le compte pré-reconcile.

**And** le plan rollback est testé une fois sur staging avant d'appliquer en prod (rollback simulé après reconcile staging réussi).

### AC5 — Application prod (uniquement après AC1-AC4 verts)

**Given** dry-run staging réussi (AC3) + rollback testé staging (AC4) + audit prod read-only (AC1) confirme alignement attendu
**When** on applique en prod
**Then** la séquence est jouée **en heures creuses** (recommandation : nuit Europe / weekend) :

```bash
# Backup prod immédiat
# Via Supabase Dashboard → Backups → Take backup (note ID + timestamp)

export SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/prod-pat.txt)
export PROD_REF=ightkxebexuzfjdbpsdg

# Linker prod
supabase link --project-ref $PROD_REF

# Run repairs (même boucle que staging AC3 étape 2)
# ... [identique]

# Validation finale
supabase db push --linked
# Doit retourner "Remote database is up to date."
```

**And** un commit git documenté est créé immédiatement après reconcile prod réussi :
- Message commit : `chore(v5): reconcile supabase_migrations.schema_migrations (S-RECONCILE-MIGRATIONS livrée Sprint 8)`
- Body : référence audit report + snapshot ID prod + heure exécution + résultat final

### AC6 — Documentation procédure pour futur

**Given** la dette est résolue, mais le processus doit être réutilisable pour onboarding devs ou re-création d'environnement
**When** la story est livrée
**Then** un document `docs/SUPABASE_MIGRATIONS_WORKFLOW.md` est créé contenant :
- Comment créer une nouvelle migration : `supabase migration new <name>`
- Comment l'appliquer en staging puis prod : `supabase db push --linked`
- Comment gérer un cas exceptionnel (rollback, repair manuel) : référence à cette story
- Mise à jour `docs/project-context.md` §10 (Identifiants & accès) avec un lien vers SUPABASE_MIGRATIONS_WORKFLOW.md
- Mise à jour `SPRINT_HANDOFF.md` pour retirer la mention "migrations désynchronisées" du bug-list

### AC7 — Sanity tests post-reconcile

**Given** la production est reconciliée
**When** on exécute les tests vitest existants
**Then** :
- `pnpm test:rls` (orders + product_mockups + pim) passe sans régression
- Smoke E2E parcours acheteur AI sur prod (login `/shop/boutique-1` → askMagrit → panier → submitCart → PortalThankYou) fonctionne sans erreur
- Aucune erreur dans les logs Supabase Edge Functions sur la 1h suivant le reconcile

**And** un TF Notion final couvre la séquence reconcile (mais marqué "exécuté une fois" — pas un test reproductible).

## Risques résiduels

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| `supabase migration repair --status applied` échoue parce que la migration tente de recréer un objet déjà existant SANS clause `IF NOT EXISTS` | Faible (vérifié AC1 idempotence) | Élevé | Si une migration n'est pas idempotente, NE PAS la marquer `applied` ; ouvrir une migration de réparation `20260XXX_fix_<nom>_idempotent.sql` AVANT le reconcile |
| Supabase branches staging non-disponibles sur le plan actuel | Moyenne (feature beta) | Moyen | Fallback projet staging temporaire + `pg_dump`/`pg_restore` |
| Backup pré-reconcile insuffisant pour restore complet (RPO élevé) | Faible | Élevé | Prendre un backup ad-hoc immédiat via Dashboard (pas seulement compter sur le PITR automatique) |
| Reconcile prod en heures pleines casse une session active utilisateur | Faible (heures creuses prévues) | Moyen | Programmer explicitement le créneau ; communication interne RPP |

## Tasks

- [ ] Task 1 — Audit prod read-only (AC1) + rapport `audit-supabase-migrations-2026-XX-XX.md`
- [ ] Task 2 — Vérifier que toutes les migrations historiques sont idempotentes (audit secondaire — risque #1 ci-dessus)
- [ ] Task 3 — Provisionner environnement staging (AC2)
- [ ] Task 4 — Dry-run reconcile staging (AC3) avec log complet
- [ ] Task 5 — Test rollback staging (AC4)
- [ ] Task 6 — Plan créneau prod + backup ad-hoc Dashboard
- [ ] Task 7 — Application prod (AC5) en heures creuses
- [ ] Task 8 — Sanity tests post-reconcile (AC7)
- [ ] Task 9 — Documentation `docs/SUPABASE_MIGRATIONS_WORKFLOW.md` (AC6)
- [ ] Task 10 — Mise à jour `SPRINT_HANDOFF.md` (retrait mention bug)
- [ ] Task 11 — TF Notion final

## DoD spécifique

- [ ] Audit prod préalable obligatoire (principe #4)
- [ ] Story doc écrit AVANT démarrage (principe #9, ce doc ✅)
- [ ] Story atomique 1.5j (principe #7 ✅, juste au-dessus du seuil mais cohérente)
- [ ] Dry-run staging OBLIGATOIRE avant prod — risque #1 mitigué uniquement par dry-run
- [ ] Plan rollback testé sur staging avant prod
- [ ] Smoke E2E acheteur AI post-reconcile (principe #3)
- [ ] Backup prod ad-hoc documenté (ID + timestamp) AVANT toute commande `repair` prod
- [ ] Pas d'a11y / Sally requis (story tooling/DB only)

## Cohérence cross-roadmap

Cette story débloque les **futures dry-runs** pour les stories techniques sensibles, notamment :
- **S-FIX-LIBRARY-UUID** (Sprint 8) — migration data legacy → UUIDs, nécessite dry-run staging absolument
- **S-FIX-LARGE-CM-FORMATS** (Sprint 8) — refacto helper, peu de risque mais coverage staging utile
- **S-ORDER-ROLES-1** (Sprint 6) — 5 nouvelles tables + RLS — déjà dry-runnable manuellement aujourd'hui via Dashboard, mais bien plus propre via CLI post-reconcile

**Recommandation séquençage Sprint 8** : faire S-RECONCILE-SUPABASE-MIGRATIONS **en premier** (jour 1-2), puis S-FIX-LIBRARY-UUID + S-FIX-LARGE-CM-FORMATS + ProductCard DRY + R2-bis + S-SUBTENANT-SCOPE peuvent enchaîner en bénéficiant du tooling restauré.

## References

- [Source: retrospective-sprint3-partial.md L88-93] — découverte initiale de la désynchronisation
- [Source: retrospective-sprint4-2026-05-20.md] — dette tracée non-résolue
- [Source: SPRINT_HANDOFF.md §9 + §3ter] — mention workaround Dashboard
- [Source: project-context.md §10] — workflow Supabase actuel
- [Source: docs Supabase CLI migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair) — référence officielle
- [Source: roadmap-v1.1-qualite-first-2026-05-21.md] — Sprint 8
