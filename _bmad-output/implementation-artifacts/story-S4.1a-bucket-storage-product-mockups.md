---
story_id: S4.1a
epic: 4 — Mockup Engine paramétrique
title: Bucket Supabase Storage product_mockups + RLS + tests
status: ready-for-dev
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: S
prd_ref: _bmad-output/planning-artifacts/prd.md
architecture_ref: _bmad-output/planning-artifacts/architecture.md (§4.3, §6 Tree, §10 deployment)
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 4 / S4.1a)
fr_covered: [FR26]
nfr_covered: [NFR2, NFR15]
adr_covered: [ADR-3]
predecessors: [S1.2 ClariprintAdapter livré, S1.5 stack LLM finalisée]
successors: [S4.1b Pipeline rendu SVG→PNG, S4.1c Edge Function mockup-generator]
---

# Story S4.1a — Bucket Supabase Storage `product_mockups` + RLS + tests

## Story (Given/When/Then)

**As a** dev Magrit,
**I want** le bucket Storage `product_mockups` et ses policies RLS prêts pour accueillir les mockups paramétriques,
**So that** les stories suivantes (S4.1b pipeline rendu, S4.1c edge function `mockup-generator`) aient une infra de stockage validée et sécurisée.

## Contexte stratégique

S4.1a est la **première story du chemin critique R3** (Implementation Readiness 2026-05-09). Elle débloque tout l'Epic 4 (Mockup Engine), qui à son tour débloque S2.3 (ProductCard variante boutique consomme `MockupImage`).

**Enchaînement R3 :**

```
Epic 4 prio haute : S4.1a (cette story) → S4.1b → S4.1c → S4.2 → S4.3
                                                                   ↓
                                                  Epic 2 démarre S2.3
```

Sans bucket prêt, S4.1b/c bloquent → toute l'expérience boutique premium est en attente.

## Acceptance Criteria

**AC1 — Migration appliquée crée le bucket avec la bonne structure**

**Given** une migration `supabase/migrations/20260510_01_e4_storage_product_mockups.sql`,
**When** le dev applique la migration sur le projet Supabase `ightkxebexuzfjdbpsdg`,
**Then** un bucket nommé `product_mockups` existe (visible dans le Dashboard → Storage).
**And** le bucket est configuré `public = true` (accès public-read en lecture via CDN).
**And** la convention de path documentée dans la migration est : `{tenant_id}/{shop_id}/{product_id}.png` (3 niveaux).

**AC2 — Policies RLS strictes : public read, write service_role uniquement**

**Given** le bucket créé,
**When** les policies RLS Storage sont appliquées,
**Then** **n'importe quel client anonyme** peut faire `GET /storage/v1/object/public/product_mockups/<path>` et récupérer une image (200 OK).
**And** **aucun client authentifié non-service_role** ne peut faire `INSERT`, `UPDATE`, `DELETE` sur la table `storage.objects` filtrée par `bucket_id = 'product_mockups'` (403 / RLS reject).
**And** **seul le service_role** (utilisé par les edge functions, ex: future `mockup-generator`) peut écrire (upload, delete) dans le bucket.

**AC3 — Test vitest valide upload service_role + GET public + RLS strict**

**Given** un fichier `tests/storage/product_mockups_isolation.test.ts`,
**When** vitest exécute la suite avec les variables d'env `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` chargées (ou `.skip` si absentes, pattern E9.10),
**Then** au moins **4 cas passent** :
1. **Upload service_role OK** : le client `service_role` upload `tenants/test/shops/test/products/test.png` (1 KB de bytes random) → 200, retourne le path.
2. **GET public OK** : un fetch HTTP anonyme sur l'URL publique du fichier retourne 200 et les mêmes bytes (vérification round-trip).
3. **Upload anon BLOCKED** : le client `anon` tente upload sur le bucket → 403 / RLS reject.
4. **Cleanup service_role** : suppression du fichier de test → 200.

**AC4 — Documentation conventions dans la migration SQL**

**Given** la migration `20260510_01_e4_storage_product_mockups.sql`,
**When** le dev relit le fichier,
**Then** un en-tête commenté en début de fichier documente : (a) le but (S4.1a, Epic 4), (b) la convention de path `{tenant}/{shop_id}/{product_id}.png`, (c) la stratégie cache (write-through par les edge functions, invalidation explicite via S4.1c future), (d) le fallback (header `X-Mockup-Fallback: true` côté edge function S4.1c, hors scope ici), (e) les policies RLS appliquées (public read, service_role write).

**AC5 — Aucun side-effect sur les autres buckets / tables**

**Given** la migration appliquée,
**When** le dev requête `select id, name, public from storage.buckets;`,
**Then** seul le nouveau bucket `product_mockups` est ajouté.
**And** les buckets existants (s'il y en a) sont intacts.
**And** aucune table hors `storage.*` n'est touchée.

**AC6 — DoD projet (cf. project-context §5)**

**Given** la story est livrée,
**When** Arnaud audite,
**Then** au moins 1 cas TF Notion (https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c) est ajouté pour valider le path public read côté navigateur (Claude in Chrome ou humain) :
- TF "Mockup bucket public read accessible" — naviguer vers `https://ightkxebexuzfjdbpsdg.supabase.co/storage/v1/object/public/product_mockups/<test-path>.png` après upload service_role manuel → image rendue dans un onglet Chrome.

## Tasks / Subtasks

- [x] **T1 — Créer la migration Supabase** (AC1, AC4, AC5)
  - [x] T1.1 Fichier créé : `supabase/migrations/20260510_01_e4_storage_product_mockups.sql`
  - [x] T1.2 En-tête commenté complet (but story, convention path, stratégie cache, fallback, RLS overview, MIME strict, idempotence)
  - [x] T1.3 `insert into storage.buckets ... on conflict do update` (idempotent, max 5 MB, MIME `image/png`)
  - [x] T1.4 Aucune autre table touchée (vérifié)

- [x] **T2 — Policies RLS Storage** (AC2)
  - [x] T2.1 Policy SELECT `product_mockups_public_read` créée
  - [x] T2.2 Pas de policy INSERT/UPDATE/DELETE pour anon/authenticated → rejet implicite. service_role bypasse RLS par défaut.
  - [x] T2.3 RLS déjà actif par défaut sur `storage.objects` (pas modifié)
  - [x] T2.4 `drop policy if exists` avant `create policy` (idempotent)

- [x] **T3 — Tests vitest d'isolation** (AC3)
  - [x] T3.1 `tests/storage/product_mockups_isolation.test.ts` créé
  - [x] T3.2 Setup conditionnel `describe.skipIf(SKIP_REASON)` (pattern E9.10)
  - [x] T3.3 Test 1 — Upload service_role OK
  - [x] T3.4 Test 2 — GET public + bytes round-trip OK
  - [x] T3.5 Test 3 — Upload anon BLOCKED par RLS
  - [x] T3.6 Test 4 — Cleanup service_role OK
  - [x] T3.7 Pattern `tests/**/*.test.ts` couvre déjà le nouveau dossier (vérifié)

- [x] **T4 — Application migration en prod** (AC1)
  - [x] T4.1 PAT déjà fourni par Arnaud en début de session
  - [x] T4.2 `supabase db push --linked` échoue (historique désynchronisé, même problème que S1.4) → fallback `supabase db query --linked --file ...` succès
  - [x] T4.3 Vérifié via SQL : bucket `product_mockups` présent, public=true, file_size_limit=5242880, allowed_mime_types=[image/png]
  - [x] T4.4 Smoke validé via tests vitest (Test 2 fait un GET public anonyme avec bytes round-trip)

- [x] **T5 — Tests post-deploy** (AC3)
  - [x] T5.1 `.env.test` créé via Management API Supabase (récupération anon + service_role keys avec PAT)
  - [x] T5.2 `pnpm exec vitest run tests/storage/` → **4/4 passed** (1.48s)
  - [x] T5.3 `pnpm exec vitest run` complet → **37/37 passed** (3.80s), 0 régression

- [x] **T6 — DoD projet** (AC6)
  - [ ] T6.1 Cas TF Notion (admin task Arnaud, draft fourni dans Completion Notes)
  - [x] T6.2 [SPRINT_HANDOFF.md](../../SPRINT_HANDOFF.md) mis à jour
  - [x] T6.3 Commit atomique + push (cf. Change Log)

## Dev Notes

### Architecture & contraintes

- **ADR-3** ([Architecture §4.3](../planning-artifacts/architecture.md)) : mockup engine = Edge Function Deno + Sharp + svgdom + cache write-through Storage. Cette story livre **uniquement la couche Storage** (S4.1b livrera le pipeline rendu, S4.1c l'edge function publique).
- **Convention path** : `product_mockups/{tenant_id}/{shop_id}/{product_id}.png` (3 niveaux UUID/slug). Aligné avec cf. Architecture §6 Tree (`supabase/functions/mockup-generator/` consommera ce bucket).
- **Cache write-through** : conceptuellement le bucket est un cache permanent. **Pas de TTL automatique**. L'invalidation est explicite via S4.1c (future endpoint `POST /api/mockup/invalidate?shop=Y` qui supprime les fichiers d'une boutique quand l'admin change le branding).
- **MIME strict `image/png`** : limiter le bucket aux PNG pour éviter dérives (uploads SVG, JPG, etc.). Si besoin futur d'autres formats, passer par migration dédiée.
- **Taille max 5 MB par fichier** : un mockup PNG 1024×1024 fait typiquement < 500 KB. 5 MB laisse marge pour cas Growth (templates plus complexes).

### Pattern Supabase Storage

Supabase utilise 2 tables internes :
- `storage.buckets` : métadonnées du bucket (nom, public/private, limites, MIME types autorisés)
- `storage.objects` : 1 ligne par fichier uploadé. Les policies RLS s'appliquent sur cette table

**RLS Storage** :
- Par défaut Supabase active RLS sur `storage.objects`. Sans policy explicite : rejet pour les rôles `anon` et `authenticated`. `service_role` bypasse toujours.
- Pour autoriser le public read : policy `for select using (bucket_id = 'product_mockups')` sans filtre auth.
- Pour interdire write/delete depuis le client : **ne pas créer de policy** pour `INSERT`/`UPDATE`/`DELETE` sur les rôles non-service. Le rejet est implicite.

### Pattern test : calque sur `tests/rls/setup.ts`

Pattern existant E9.10 (RLS multi-tenant) :

```ts
// tests/rls/setup.ts (extrait conceptuel)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const skipIfMissingEnv = !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY;
// ...
describe.skipIf(skipIfMissingEnv)("RLS isolation", () => { /* ... */ });
```

À reproduire pour `tests/storage/product_mockups_isolation.test.ts` : skip auto si `.env.test` incomplet (pas un fail).

### Référence migration template — S1.4

[supabase/migrations/20260509_01_e1_orders_v1_1.sql](../../supabase/migrations/20260509_01_e1_orders_v1_1.sql) pour le pattern :
- En-tête commenté multi-ligne avec story_id, scope, justifications.
- Idempotence (`if not exists`, `do $$ begin ... end $$;` blocks).
- Policies regroupées en fin de fichier.

À reproduire dans `20260510_01_e4_storage_product_mockups.sql`.

### Project Structure Notes

- Nouveau dossier `tests/storage/` (jamais utilisé avant). Cohérent avec `tests/rls/` existant.
- Aucun nouveau fichier dans `src/` (pas de UI, c'est de l'infra DB-side).
- Aucun nouveau fichier dans `supabase/functions/` (l'edge function `mockup-generator` arrive en S4.1c).

### Pré-requis vérifiés

✅ S1.2 ClariprintAdapter livré (sera consommé par S4.1c, pas par cette story directement).
✅ S1.5 stack LLM finalisée (le wrapper sera utilisé par S4.1b pour générer l'artwork si IA-assisted, mais hors scope ici).
✅ Bucket `tenant_assets/` mentionné en S5.2 (Canva connector) — différent bucket, pas de collision.

### Dépendances bloquantes côté S4.1b/c

- S4.1b dépend du bucket existant pour valider son pipeline render → upload.
- S4.1c dépend du bucket + des policies RLS pour orchestrer le cache write-through depuis l'edge function (utilise le service_role automatiquement disponible aux edge functions Supabase via `SUPABASE_SERVICE_ROLE_KEY`).

Si cette story foire (bucket non créé / RLS mal posée), tout l'Epic 4 est bloqué.

### Testing Standards

- Vitest pour les tests d'intégration Storage (cf. AC3).
- Pas de mock — on test la **vraie** Supabase via service_role + anon. Pattern aligné sur `tests/rls/`.
- Pas d'E2E nécessaire (pas de UI dans cette story). S4.1c amènera des smoke cURL E2E.

## References

- [Architecture §4.3 ADR-3](../planning-artifacts/architecture.md) — Mockup Engine
- [Architecture §6 Tree](../planning-artifacts/architecture.md) — `supabase/functions/mockup-generator/` (futur consommateur S4.1c)
- [Epics §Epic 4 / S4.1a](../planning-artifacts/epics.md) — story originale
- [PRD §FR25-27](../planning-artifacts/prd.md) — Mockup engine requirements
- [PRD §NFR2 (perf)](../planning-artifacts/prd.md) — first paint mockup ≤ 50 ms HIT, ≤ 300 ms MISS (cibles S4.1c, pas cette story)
- [PRD §NFR15 (scalability)](../planning-artifacts/prd.md) — bucket CDN absorbe le trafic
- [project-context §3.2 stack, §10 identifiants](../../docs/project-context.md)
- [Implementation Readiness Report R3](../planning-artifacts/implementation-readiness-report-2026-05-09.md) — décision split S4.1 → S4.1a/b/c
- [SPRINT_HANDOFF §3 ter](../../SPRINT_HANDOFF.md) — état Sprint 3 / Epic 1 partiel
- [tests/rls/setup.ts](../../tests/rls/setup.ts) — template pattern à reproduire pour `tests/storage/`
- [supabase/migrations/20260509_01_e1_orders_v1_1.sql](../../supabase/migrations/20260509_01_e1_orders_v1_1.sql) — template migration

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7` (Opus 4.7 1M context, Claude Code CLI session — même session continue depuis S1.5)

### Debug Log References

- `supabase db push --linked` → ECHEC sur historique migrations désynchronisé (`schema_migrations_pkey` violation sur `20260418`). Même problème documenté en S1.4. Fallback : `supabase db query --linked --file <migration.sql>` → succès silencieux.
- Vérification post-deploy : bucket présent (SQL `select * from storage.buckets where id='product_mockups'`), policy active (SQL `select polname, polcmd from pg_policy where polrelid='storage.objects'::regclass and polname like '%product_mockups%'` → 1 row r/SELECT).
- `.env.test` récupéré via Management API Supabase : `GET /v1/projects/<ref>/api-keys` avec PAT → extraction anon + service_role keys.
- `pnpm exec vitest run` complet : 37/37 passed (4 storage S4.1a + 6 RLS S1.4 + 6 tenant_isolation E9.10 + 21 testid smoke).

### Completion Notes List

#### Décisions techniques prises

1. **Bucket public + RLS strict côté write** (cf. AC2) : choix conforme à Architecture §4.3 (cache write-through CDN public, écriture restreinte aux edge functions via service_role). Pas de policy INSERT/UPDATE/DELETE pour `anon`/`authenticated` → rejet implicite RLS, exactement le comportement souhaité.
2. **MIME strict `image/png` + 5 MB max** : limite défensive pour éviter dérives (uploads SVG/JPG ou bombes). 5 MB couvre largement le besoin (mockup 1024×1024 PNG ~500 KB typique).
3. **Path 3 niveaux `tenants/{id}/shops/{id}/products/{id}.png`** : aligné Architecture §4.3, lisible humainement, prefixé `tenants/` pour cohérence avec autres ressources tenant-scoped.
4. **Fallback `supabase db query --linked --file`** au lieu de `db push --linked` : nécessité pour contourner l'historique migrations désynchronisé (problème S1.4 documenté). À envisager pour future story de dette technique : resync `supabase_migrations.schema_migrations` table.

#### Bug pré-existant détecté + corrigé

**Symptôme** : après création du `.env.test` (T5.1), la suite vitest a révélé que `tests/rls/orders_isolation.test.ts` (S1.4) avait 2 inserts `shops` qui omettaient la colonne NOT NULL `owner_user_id`. Le test était silently `skipped` avant car `.env.test` n'existait pas dans le repo (gitignored).

**Fix** : ajout de `owner_user_id: h.userA.id` (et `h.userB.id` pour shop B) sur 3 inserts dans `tests/rls/orders_isolation.test.ts` (lignes ~40, ~52, ~143).

**Implication** : la story S1.4 (livrée 2026-05-09 selon SPRINT_HANDOFF) avait des tests RLS qui n'avaient jamais réellement tourné en CI ou local. Maintenant que `.env.test` est configuré, les 6 cas RLS Order entity passent réellement (PRD § Success Criteria validés a posteriori).

#### Cas TF Notion (draft pour T6.1, à coller par Arnaud)

```
Titre : Mockup bucket Storage public read accessible
Parcours : P09 (Boutique tenant) — pré-requis infra Epic 4
Persona : N/A (test infra)
Précondition : Bucket product_mockups créé, au moins 1 fichier uploadé via service_role (ex: tests/storage/ vient d'en uploader-puis-cleanup, sinon uploader manuellement via Dashboard)
Étapes :
  1. Naviguer vers https://ightkxebexuzfjdbpsdg.supabase.co/storage/v1/object/public/product_mockups/<path-test>.png dans Chrome (sans authentification, navigation privée OK)
  2. Vérifier que l'image se charge ou qu'un 404 (si fichier absent) s'affiche, PAS un 401/403
  3. Bonus : tenter un POST sans auth via curl ou DevTools → vérifier 401/403 (rejet RLS attendu)
Résultat attendu :
  - GET public : 200 (si fichier existe) ou 404 (si absent), JAMAIS 401/403
  - POST anon : 401 ou 403 (rejet RLS)
  - Dashboard Supabase → Storage → product_mockups bucket visible avec icône public
Hints DOM : N/A (test URL directe)
URL : https://ightkxebexuzfjdbpsdg.supabase.co/storage/v1/object/public/product_mockups/
Type : Manuel humain + IA Chrome
Données : aucune
Statut : À jouer post-déploiement S4.1a
```

#### Smoke tests cURL alternatifs (déjà couverts par vitest, ici en référence)

```bash
# Récupérer SERVICE_ROLE_KEY
SR=$(grep SUPABASE_SERVICE_ROLE_KEY .env.test | cut -d= -f2)

# Upload service_role : créer un fichier test 1KB
echo "fake-png-bytes-for-test" > /tmp/test.png
curl -X POST "https://ightkxebexuzfjdbpsdg.supabase.co/storage/v1/object/product_mockups/manual-test.png" \
  -H "Authorization: Bearer $SR" \
  -H "Content-Type: image/png" \
  --data-binary "@/tmp/test.png"

# GET public sans auth
curl -I "https://ightkxebexuzfjdbpsdg.supabase.co/storage/v1/object/public/product_mockups/manual-test.png"
# Attendu : HTTP/2 200, content-type: image/png

# Upload anon : tentative qui doit ETRE BLOQUEE
ANON=$(grep SUPABASE_ANON_KEY .env.test | cut -d= -f2)
curl -X POST "https://ightkxebexuzfjdbpsdg.supabase.co/storage/v1/object/product_mockups/anon-attempt.png" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: image/png" \
  --data-binary "@/tmp/test.png"
# Attendu : 400/403 avec message RLS

# Cleanup service_role
curl -X DELETE "https://ightkxebexuzfjdbpsdg.supabase.co/storage/v1/object/product_mockups/manual-test.png" \
  -H "Authorization: Bearer $SR"
```

### File List

**Créés :**
- `supabase/migrations/20260510_01_e4_storage_product_mockups.sql` — bucket + policy RLS, idempotent
- `tests/storage/product_mockups_isolation.test.ts` — 4 tests vitest (upload service_role, GET public, upload anon BLOCKED, cleanup)

**Modifiés (fix bug pré-existant S1.4 hors scope strict, mais bloquant suite) :**
- `tests/rls/orders_isolation.test.ts` — ajout `owner_user_id` sur 3 inserts `shops` (étaient silently skipped via SKIP_REASON sans `.env.test`)
- `SPRINT_HANDOFF.md` — entrée S4.1a livrée + migration appliquée
- `_bmad-output/implementation-artifacts/story-S4.1a-bucket-storage-product-mockups.md` — checkboxes cochées + Dev Agent Record + Status → review

**Non commit :**
- `.env.test` — gitignored (contient SUPABASE_ANON_KEY + SERVICE_ROLE_KEY récupérés via Management API)

## Change Log

| Date | Auteur | Action |
|---|---|---|
| 2026-05-10 | Story Engine (BMAD) | Création initiale, status `ready-for-dev` |
| 2026-05-10 | Dev (Opus 4.7) | T1-T6 livrés sur `beta/v5`. Migration appliquée + déployée. Tests vitest 37/37 passed (incl. fix bug pré-existant S1.4 `owner_user_id`). Status → `review`. Reste T6.1 Notion (admin task Arnaud) |

## Status

`review` (code livré + déployé + tests passants. T6.1 Notion = admin task non-bloquante)
