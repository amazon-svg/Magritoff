# Supabase Migrations — Workflow Magrit

> Document de référence post **S-RECONCILE-SUPABASE-MIGRATIONS** (2026-05-23, Sprint 5).
> Avant cette réconciliation, le tracking `supabase_migrations.schema_migrations` était
> désynchronisé (1 migration trackée / 29 fichiers locaux), forçant l'application manuelle
> de tout SQL via Studio SQL Editor. Workflow CLI natif restauré le 2026-05-23.

## TL;DR

```bash
# Créer une nouvelle migration (template auto-généré YYYYMMDDHHMMSS_xxx.sql)
supabase migration new <description_kebab_case>

# Éditer le fichier généré dans supabase/migrations/

# Appliquer en prod (push CLI natif)
export SUPABASE_ACCESS_TOKEN=$(security find-generic-password -a "$USER" -s "supabase-pat-magrit" -w)
supabase db push --linked

# Vérifier l'état du tracking
supabase migration list --linked
# Local et Remote doivent être identiques sur toutes les lignes
```

## Convention de nommage (obligatoire)

**Format Supabase CLI standard** : `YYYYMMDDHHMMSS_<description_kebab_case>.sql`

- 14 chiffres horodatage UTC en préfixe (`YYYYMMDDHHMMSS`)
- Séparateur `_`
- Description en kebab_case (snake OK aussi)
- Extension `.sql`

Exemple : `20260523000200_reconcile_workflow_smoke_test.sql`

**À ne plus utiliser** (legacy, source du bottleneck initial) :
- `YYYYMMDD_NN_xxx.sql` (8 chiffres + numéro à 2 chiffres)
- `YYYYMMDD_xxx.sql` (8 chiffres seulement)

Le CLI `supabase migration new` génère le format standard automatiquement → **utiliser cette commande, ne pas créer de fichier à la main avec un mauvais format**.

## Prérequis session

1. **PAT Supabase** dans Keychain macOS :
   ```bash
   # Setup une fois
   security add-generic-password -a "$USER" -s "supabase-pat-magrit" -w
   # (colle la PAT au prompt)

   # À chaque session shell
   export SUPABASE_ACCESS_TOKEN=$(security find-generic-password -a "$USER" -s "supabase-pat-magrit" -w)
   ```

2. **Projet linké** : `supabase projects list` doit montrer `LINKED ●` sur `ightkxebexuzfjdbpsdg` (Magrit B4/B5). Si pas linké : `supabase link --project-ref ightkxebexuzfjdbpsdg`.

## Workflow normal (nouvelle migration)

### 1. Créer le fichier

```bash
supabase migration new <description>
# Génère supabase/migrations/YYYYMMDDHHMMSS_<description>.sql vide
```

### 2. Éditer le SQL

Respecter ces patterns Magrit (cf. fichiers existants pour modèles) :
- `create or replace function ... language sql security definer set search_path = public`
- `grant execute on function ... to authenticated`
- `drop policy if exists <name> on <table>;` puis `create policy ...`
- `notify pgrst, 'reload schema';` à la fin si le schema change (force PostgREST refresh)
- Header commentaire explicatif (contexte, story, rationale)

### 3. Dry-run + push

```bash
# Vérifier ce qui va être appliqué (no-op safe)
supabase db push --linked --dry-run

# Si OK → push réel
supabase db push --linked
```

### 4. Vérification post-push

```bash
# Tracking aligned (Local = Remote sur toutes les lignes)
supabase migration list --linked

# Si schema PostgREST modifié, vérifier le rechargement
curl -s -X POST 'https://ightkxebexuzfjdbpsdg.supabase.co/rest/v1/<table>?select=<new_col>&limit=1' \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### 5. Commit

Le fichier `supabase/migrations/YYYYMMDDHHMMSS_*.sql` est versionné. Commit avec la story qui l'introduit (pas dans un commit "infra" isolé sauf cas reconcile).

## Workflow alternatif : SQL Editor Studio (cas exceptionnels)

À utiliser **uniquement** si :
- La PAT est indisponible (timeout, révoquée)
- Une migration trop sensible nécessite un Run interactif avec preview Studio

**Procédure** :
1. Ouvrir https://supabase.com/dashboard/project/ightkxebexuzfjdbpsdg/sql/new
2. Coller le SQL depuis le fichier `supabase/migrations/*.sql`
3. Run
4. **IMPORTANT** : marquer manuellement la migration comme appliquée pour ne pas casser le tracking :
   ```bash
   supabase migration repair --status applied <YYYYMMDDHHMMSS> --linked
   ```
5. Vérifier `supabase migration list --linked` : Local et Remote doivent matcher.

Si on oublie l'étape 4, le tracking se désaligne et `db push` redeviendra non utilisable jusqu'à un nouveau `migration repair` ciblé.

## Annexe : récapitulatif réconciliation 2026-05-23

**Problème initial** :
- Tracking prod : 1 migration connue (`20260418`)
- Local : 29 fichiers `YYYYMMDD_NN_xxx.sql` (format non-standard CLI)
- Conséquence : `db push --dry-run` listait 28 migrations comme "à appliquer" alors qu'elles l'étaient toutes via SQL Editor
- Tout nouveau SQL devait passer par Studio SQL Editor manuellement

**Cause racine** :
- Migrations historiques appliquées via Studio (sans CLI), ce qui n'alimente pas la table tracking
- Format `YYYYMMDD_NN_xxx.sql` non parsable comme version par `migration repair` (1 timestamp 8-chiffres → ambiguïté quand plusieurs migrations le même jour)

**Solution appliquée** :
1. Audit prod read-only : confirmation que toutes les 28 migrations sont bien appliquées en prod (tables, colonnes, INSERTs data, helpers SQL, RLS policies tous présents)
2. `git mv` des 29 fichiers en format `YYYYMMDDHHMMSS_xxx.sql` (encoding du `_NN_` en `00NN00` horaire fictif pour préserver l'ordre + l'unicité). Historique git préservé via `git mv`.
3. `supabase migration repair --status applied <ts1> <ts2> ... --linked` batch sur les 29 nouveaux timestamps
4. `supabase migration repair --status reverted 20260418 20260420 --linked` cleanup des 2 orphans (anciennes lignes 8-chiffres devenues sans correspondance fichier)
5. Validation `supabase db push --linked --dry-run` → "Remote database is up to date"
6. Smoke test : nouvelle migration triviale `20260523000200_reconcile_workflow_smoke_test.sql` poussée nativement via `supabase db push --linked` → ✅ workflow restauré

**Mapping legacy → nouveau format** (pour archéologie git) :
- `20260418_library_client.sql` → `20260418000001_library_client.sql`
- `20260418_shop_module.sql` → `20260418000002_shop_module.sql`
- `20260418_user_data.sql` → `20260418000003_user_data.sql`
- `20260420_libraries.sql` → `20260420000001_libraries.sql`
- `20260420_pim.sql` → `20260420000002_pim.sql`
- `20260422_quote_templates.sql` → `20260422000001_quote_templates.sql`
- `20260424_01_*` → `20260424000100_*` (NN=01 → HHMM=0100)
- `20260424_02_*` → `20260424000200_*` (NN=02 → HHMM=0200)
- … etc pour `_NN_` → `00NN00`
- `20260523_01_s3_2_can_create_order_helper.sql` → `20260523000100_s3_2_can_create_order_helper.sql`

**Effort réel** : ~45min (vs 1.5j estimé Phase 0.8 Sprint 8). Économie due à l'audit prod qui a confirmé "0 migration vraiment manquante" et à la solution rename + batch repair en CLI pur (pas besoin de provisionner staging Supabase branch).

## Risques résiduels et mitigations

| Risque | Mitigation |
|---|---|
| Nouvelle migration créée à la main avec ancien format `YYYYMMDD_NN_*.sql` | Toujours utiliser `supabase migration new <name>` qui génère le bon format |
| Application via SQL Editor sans `migration repair` derrière | Documenté section "Workflow alternatif" ci-dessus, à éviter sauf cas exceptionnel |
| Push d'une migration cassée en prod sans dry-run préalable | Toujours `--dry-run` avant `db push` réel sur prod |
| Désync future si on travaille à plusieurs sans coordination | Vérifier `supabase migration list --linked` avant chaque push pour détecter |

## Référence Supabase officielle

- Migration files : https://supabase.com/docs/guides/cli/local-development#database-migrations
- Migration repair : https://supabase.com/docs/reference/cli/supabase-migration-repair
- Schema migrations table : `supabase_migrations.schema_migrations` (interne, ne pas modifier à la main sauf cas reconcile)
