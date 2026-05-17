---
story_id: P0.7
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: Fix conversion cm→mm dans pim-ingest resolveGamme (parité avec front)
status: livrée partiel (toMm seuil 50 porté, 2/5 mappings OK)
delivered_at: 2026-05-17
deployment: pim-ingest v8 (2026-05-17 15:27)
follow_up: P0.8 (parité resolveGamme), P0.9 (convention cm/mm robuste qui obsolète le seuil 50)
final_result: "fix partiel — l'heuristique seuil <50 ne convertit pas les grands formats cm (kakemono 80×200, banderole 120×30). Solution définitive en P0.9 (convention typage string=cm/number=mm)"
target_branch: beta/v5
agent: Dev (Claude Code)
size: XS (~30min — port d'une fonction existante)
depends_on: P0.6 (redeploy pim-ingest livré, sinon impossible de tester le fix)
unblocks: P0.4 (smoke test ingestion E2E correct) + futur sprint
discovered_in: P0.4 smoke test du 2026-05-17 — 4/5 mauvais mappings dont 1 régression critique
---

# Story P0.7 — Fix conversion cm→mm dans pim-ingest

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** que la fonction `resolveGamme()` côté backend `pim-ingest` convertisse les dimensions cm reçues du LLM Clariprint en mm avant de comparer aux `matching_rules` (qui sont en mm)
**So that** les produits soient correctement matchés à leur gamme métier (kakémono, carte de visite, etc.) lors de l'ingestion PIM, sans régression sur les produits existants déjà correctement rendus côté front.

## Contexte

Le smoke test P0.4 du 2026-05-17 (post-fix P0.6 redéploiement pim-ingest) a révélé **4 mauvais mappings sur 5** :

| ref_input | dims raw (cm) | dims interprété (mm) | gamme résolue | gamme attendue |
|---|---|---|---|---|
| Kakemono 80×200 | "80"×"200" | 80×200 | `flyer` | `kakemono` ❌ |
| Étiquette 5×5 | "5"×"5" | 5×5 | `etiquette` | `etiquette` ✅ |
| Banderole 120×30 | "120"×"30" | 120×30 | `flyer` | `banderole` ❌ |
| Dépliant DL 21×10 | "21"×"10" | 21×10 | `depliant` | `depliant_plie_dl` ❌ |
| **Carte visite 8.5×5.5** | "8.5"×"5.5" | 8.5×5.5 | **`etiquette`** | **`carte_visite_standard`** ❌ **RÉGRESSION** |

Cause racine identifiée dans [pim-ingest/index.ts:178-179](supabase/functions/pim-ingest/index.ts#L178-L179) :
```typescript
const w = Number(n.width);
const h = Number(n.height);
```

**Aucune conversion cm→mm**. Or :
- Le LLM Clariprint envoie les dimensions en **strings CM** (convention vue dans demoConfigs et logs Arnaud 17/05 : `width: "8.5", height: "5.5"` pour cartes de visite)
- Les `matching_rules` PIM sont en **mm** (cf. seed `20260420_pim.sql` : `size_near width:85 height:55 tol:3`)
- → Mismatch d'unité → faux match

**Le frontend `productEnrichment.ts:165-170` a déjà le fix `toMm`** (commentaire commit `S-FIX-UNITS-13/05`) :
```typescript
const toMm = (v: number): number => {
  if (isNaN(v) || v <= 0) return v;
  return v < 50 ? v * 10 : v;
};
```

Seuil 50 : tout produit imprimable est ≥ 50mm (la plus petite carte de visite = 55mm). Si valeur < 50, c'est forcément du cm → ×10.

Ce fix n'a **pas été porté** côté backend `pim-ingest`. Conséquence : la PIM ingestion en prod bookmark systématiquement les produits sur la mauvaise gamme depuis le S-FIX-DATA-1 du 10/05 (qui a backfillé via pim-generate sans matching, donc bug non détecté avant).

## Acceptance Criteria

**AC1** — Fonction `toMm(v: number): number` ajoutée dans `supabase/functions/pim-ingest/index.ts` avec exactement la même logique que la version frontend (`v < 50 ? v * 10 : v`, NaN/≤0 → return v inchangé).

**AC2** — `resolveGamme()` appelle `toMm()` sur `Number(n.width)` et `Number(n.height)` avant de calculer `maxDim` et de comparer aux `matching_rules`.

**AC3** — Commentaire JSDoc explicite référence le fix S-FIX-UNITS-13/05 du frontend pour traçabilité.

**AC4** — Pas d'autre fonction modifiée (ni `normalizeRaw`, ni `enrichWithClaude`, ni le pipeline ingestion). Fix isolé sur 1 endroit.

**AC5** — Edge function `pim-ingest` redéployée sur Supabase B5 (version passe de v7 actuelle à v8+).

**AC6** — Cleanup des 5 entrées polluées du smoke test P0.4 :
- Delete les 5 `product_definitions` créées avec mauvais gamme_slug (merged_into pointant)
- Delete les 5 `pim_candidates` test (filtre `raw_config->>'_test_p0_4' = 'true'`)

**AC7** — Re-INSERT des 5 mêmes configs de test (via SQL CLI)

**AC8** — Re-lancement de l'ingestion par Arnaud via DashboardAdminPIM

**AC9** — Vérification SQL : les 5 candidates passent à `merged` avec les bonnes `gamme_slug` :
| ref_input | gamme_slug attendue |
|---|---|
| Kakemono 80×200 (cm→800×2000mm) | `kakemono` (min_dim≥1500) |
| Étiquette 5×5 (cm→50×50mm) | `etiquette` (max_dim≤100) |
| Banderole 120×30 (cm→1200×300mm) | `banderole` (1000-1500mm) |
| Dépliant DL 21×10 (cm→210×100mm) | `depliant_plie_dl` (size_near 210×100 tol 5) |
| Carte visite 8.5×5.5 (cm→85×55mm) | `carte_visite_standard` (size_near 85×55 tol 3) |

**AC10** — Aucun changement code côté front (le front a déjà le fix). Pas de régression sur les rendus boutique existants.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Seuil heuristique | `< 50` (mm) | Cohérent avec le front `productEnrichment.ts:167`. Carte de visite = 55mm = juste au-dessus → pas convertie à tort. |
| Position du fix | Dans `resolveGamme()` directement (pas dans `normalizeRaw`) | Garde `normalizeRaw` neutre (juste fusion top-level/clariprintData). Le fix d'unité est spécifique au matching. |
| Application aussi sur `enrichWithClaude` ? | Non | `enrichWithClaude` envoie le raw_config tel quel au LLM Claude Haiku qui comprend cm naturellement. Pas de matching numérique côté LLM. |
| Application sur `canonicalKey` (déduplication) ? | À vérifier | `canonicalKey` utilise `String(n.width)` ligne 248 — donc compare des strings. Si "80" et "8.0" différents même produit, dédoublonnement raté. **Hors scope P0.7** (créer story future si découvert). |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Produits prod existants qui auraient des dimensions déjà en mm (admin manuel) seraient correctement non convertis | Heuristique `< 50` : tout produit imprimable ≥ 50mm en mm. Si admin a saisi 85mm pour carte de visite, reste 85 (pas convertie). Si saisi 8.5mm (erreur), conversion devient 85mm (corrige l'erreur). Comportement défensif. |
| Banderole sur seuil pile à 50 (`50` cm = `500` mm vs `50` mm rester `50`) | Cas marginal pour banderole 50cm. Comportement déterministe (50 reste 50 = mm). |
| Régression sur produits historiques déjà ingérés | Pas de régression rétroactive : les `product_definitions` existantes ne sont pas re-évaluées. Seules les nouvelles ingestions appliquent le fix. |
| Désynchronisation frontend/backend si seuils différents | AC1 garantit seuil identique 50. Surveiller dans futurs sprints. |

## Fichiers touchés

- `supabase/functions/pim-ingest/index.ts` : +5 à 10 lignes (fonction `toMm` + appel dans `resolveGamme`)
- Aucun autre fichier source (front intact, autres edge functions intactes)

## Procédure d'exécution

### Étape 1 — Cleanup des 5 entrées polluées (Claude Code via CLI)
```sql
-- Delete les product_definitions polluées par P0.4 v1 (post P0.6 redeploy)
delete from public.product_definitions
where id in (
  select merged_into from public.pim_candidates
  where raw_config->>'_test_p0_4' = 'true' and merged_into is not null
);
-- Delete les pim_candidates test
delete from public.pim_candidates where raw_config->>'_test_p0_4' = 'true';
```

### Étape 2 — Fix code pim-ingest (Claude Code)
Édition de `pim-ingest/index.ts` :
- Ajout `toMm()` (port front)
- Appel `toMm()` dans `resolveGamme()` ligne 178-179

### Étape 3 — Redeploy edge function (Claude Code via CLI)
```bash
supabase functions deploy pim-ingest --project-ref ightkxebexuzfjdbpsdg
```
Vérification : v8+ active après déploiement.

### Étape 4 — Re-INSERT 5 candidates (Claude Code via CLI)
Reprise du même SQL que P0.4 étape 1 (mêmes 5 configs marker `_test_p0_4`).

### Étape 5 — Re-lancement ingestion (Arnaud via UI)
`/t/imprimerie-ipa/dashboard/admin/pim` → "Lancer l'ingestion" → attente ~2-3min.

### Étape 6 — Vérification SQL (Claude Code)
Reprise de la query P0.4 step 3 vérifiant `status='merged'` + `gamme_resolved` cohérent (AC9).

### Étape 7 — Cleanup final (optionnel)
Une fois validation OK, delete les 5 product_definitions + 5 candidates de test (cf. étape 1).

## Tests / Vérifications

1. **Lecture code review** : la fonction `toMm` est bit-identique au frontend
2. **Smoke test** : 5/5 candidates avec bonne `gamme_slug` (AC9)
3. **Pas de régression** : aucun test vitest existant ne casse (vitest ne couvre pas pim-ingest car Deno, mais cohérence assurée par revue manuelle)

## TF Notion à créer en fin de story

- **TF "pim-ingest matching cm→mm port front fix S-FIX-UNITS"** :
  - Parcours : P07 — Tracking consommation IA
  - Persona : Superadmin Magrit
  - Type : SQL DB + Manuel humain
  - URL départ : Dashboard Supabase Functions + DashboardAdminPIM
  - Étapes : reprendre étapes 1-6 ci-dessus
  - Résultat attendu : 5 candidates `merged` avec gammes correctes
  - Cas régression : 1 produit carte_visite 85×55mm en cm (`"8.5","5.5"`) doit résoudre `carte_visite_standard`, pas `etiquette`

## Notes

Story découverte par la rigueur méthode BMAD (smoke test P0.4 formel). Même cause racine que le hotfix 17/05 côté front (`isLikelyCm` dans `extractClariprintConfigFromAtelierProduct`), même nature de fix. Mais seuils différents :
- Front `resolveGamme`: < 50 (hotfix 13/05 S-FIX-UNITS)
- Front `extractClariprintConfigFromAtelierProduct`: < 100 (hotfix 17/05)
- Backend `pim-ingest` : sera < 50 (parité front `resolveGamme`)

Cette divergence de seuil entre les 2 helpers front mérite une story de cleanup ultérieure (`S-CLEANUP-CM-MM-HEURISTIC`) mais hors scope P0.7.
