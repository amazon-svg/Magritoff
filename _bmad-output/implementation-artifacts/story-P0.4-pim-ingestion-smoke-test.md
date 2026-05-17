---
story_id: P0.4
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: Smoke test ingestion PIM end-to-end (commande → candidate → produit en boutique)
status: livrée
delivered_at: 2026-05-17
target_branch: beta/v5
agent: Dev (Claude Code) + Arnaud (exécution manuelle Dashboard SQL + UI)
size: XS prévu → XL effectif (a déclenché 4 stories de fix collatérales P0.6/P0.7/P0.8/P0.9)
depends_on: P0.2 (gammes étendues), P0.3 (wizard adapt), P0.6 (redeploy pim-ingest), P0.7 (toMm partial), P0.8 (parité resolveGamme), P0.9 (convention cm/mm robuste)
unblocks: Phase 1 (bascule orders peut s'appuyer sur pipeline PIM 100% validé)
final_result: "5/5 mappings corrects (v4 du 17/05 16:05) — kakemono→roll_up_80x200, etiquette→etiquette, banderole→banderole, depliant→depliant_plie_dl, carte_visite→carte_visite_standard"
---

# Story P0.4 — Smoke test ingestion PIM E2E

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** valider que le pipeline d'ingestion PIM tourne end-to-end après l'extension des gammes (P0.2)
**So that** les nouvelles commandes (notamment celles passées sur les nouvelles gammes kakémono/étiquette/banderole) génèrent bien des candidats puis des `product_definitions` enrichis par Claude Haiku, sans découvrir un bug pré-existant pendant la démo client du 23/05.

## Contexte

Le pipeline PIM est complexe (audit 17/05) :
1. `submitCart()` (boutique) ou `enqueue_pim_candidate_on_order` (trigger) → INSERT dans `pim_candidates` avec `status='pending'`
2. Admin tenant ou superadmin lance `DashboardAdminPIM` → bouton "Lancer l'ingestion"
3. Edge function `pim-ingest` (Sonnet 4.5 actif) :
   - `isRichEnough()` valide la richesse de la config
   - `resolveGamme()` matche les `matching_rules` sur la config produit
   - Si match : `enrichWithClaude()` génère JSON SEO/marketing
   - INSERT `product_definitions` + UPDATE `pim_candidates` status='merged' avec `merged_into=<def_id>`

**Pas de smoke test régulier en place** : on découvrirait un bug seulement en prod. Avec P0.2 qui étend les gammes, un risque : si les nouveaux `matching_rules` (kakemono min_dim 1500, banderole min_dim 1000-1500, etc.) ne sont pas correctement structurés en JSONB, `resolveGamme()` rejette → candidat reste pending indéfiniment.

## Acceptance Criteria

**AC1 — Smoke test scénario "kakémono"** ✅
1. Créer un produit de test dans la boutique B5 (ou simuler via INSERT direct dans `shop_orders`) avec config Clariprint :
   - `kind: "leaflet"`, `width: "80"` (cm), `height: "200"` (cm), `quantity: 1`
2. Vérifier qu'une ligne apparait dans `pim_candidates` avec `status='pending'` (via SQL Editor)
3. Lancer `pim-ingest` via `DashboardAdminPIM` (ou appel direct edge function avec PAT)
4. Vérifier que la ligne passe à `status='merged'` avec `merged_into` non-null
5. Vérifier que `product_definitions` contient une nouvelle entrée avec `gamme_slug='kakemono'` ou `'roll_up_80x200'` (selon précision du match)

**AC2 — Smoke test scénario "étiquette"** ✅
- Même protocole avec config : `kind: "leaflet"`, `width: "5"`, `height: "5"` (= 50×50mm)
- Attendu : matching `gamme_slug='etiquette'`

**AC3 — Smoke test scénario "banderole"** ✅
- Config : `kind: "leaflet"`, `width: "120"`, `height: "30"` (= 1200×300mm)
- Attendu : matching `gamme_slug='banderole'`

**AC4 — Smoke test scénario "dépliant plié DL"** ✅
- Config : `kind: "folded"`, `width: "21"`, `height: "10"` (= 210×100mm)
- Attendu : matching `gamme_slug='depliant_plie_dl'`

**AC5 — Smoke test régression "carte de visite standard"** ✅
- Config : `kind: "leaflet"`, `width: "8.5"`, `height: "5.5"` (= 85×55mm)
- Attendu : matching `gamme_slug='carte_visite_standard'` (gamme existante, pas de régression)

**AC6 — Documentation des résultats** ✅
- Compléter ce story doc en fin d'exécution avec les `def_id` réellement créés en prod pour chaque scénario.

## Procédure d'exécution (Arnaud + Claude Code)

### Étape 1 — Préparer les configs de test (Claude Code)

Préparer un fichier `tests/manual/p0.4-pim-smoke-configs.sql` (non commité, scratch) avec 5 INSERT dans `shop_orders` (cohort legacy avant bascule Phase 1) ou directement dans `pim_candidates` :

```sql
-- Scenario kakemono
insert into public.pim_candidates (source_tenant_id, raw_config, status)
values (
  '<tenant_id_imprimerie_ipa>',
  '{"kind":"leaflet","width":"80","height":"200","quantity":1,"reference":"Kakémono test","papers":{"custom":{"quality":"PVC","weight":"500"}}}'::jsonb,
  'pending'
);
-- ... 4 autres scénarios similaires
```

### Étape 2 — Appliquer + lancer ingestion (Arnaud)

1. Connecter Dashboard Supabase B5 (`ightkxebexuzfjdbpsdg`)
2. Exécuter le SQL préparé étape 1
3. Vérifier compteur `pim_candidates` pending = 5
4. Lancer `pim-ingest` via Dashboard `/t/imprimerie-ipa/dashboard/admin/pim` (superadmin only)
5. Observer compteur passer à 0 (ou bloqués si erreurs)

### Étape 3 — Vérifier résultats (Arnaud + Claude Code)

```sql
-- Vérification mapping
select
  c.raw_config->>'reference' as ref_input,
  c.status,
  c.merged_into,
  d.gamme_slug as gamme_resolved,
  d.name as def_name
from public.pim_candidates c
left join public.product_definitions d on d.id = c.merged_into
where c.created_at > now() - interval '10 minutes'
order by c.created_at desc;
```

Attendu :
| ref_input | status | gamme_resolved |
|---|---|---|
| Kakémono test | merged | kakemono OR roll_up_80x200 |
| Étiquette test | merged | etiquette |
| Banderole test | merged | banderole |
| Dépliant DL test | merged | depliant_plie_dl |
| Carte visite test | merged | carte_visite_standard |

### Étape 4 — Cleanup (optionnel)

Si on veut nettoyer après smoke test :
```sql
delete from public.pim_candidates where raw_config->>'reference' like '%test%';
-- ne PAS delete les product_definitions générées : utiles pour réutilisation
```

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| `pim-ingest` échoue silencieusement (anomalie LLM ou matching_rules invalide) | Logs Supabase Edge Functions à inspecter ; fallback : SQL direct sur tables pour identifier l'étape qui bloque |
| Tarif Anthropic dépassé / billing error | Smoke test sur 5 configs = ~5 appels Haiku ≈ 0,05€. Risque négligeable. |
| Test pollue la prod (pim_candidates + product_definitions test resteront) | AC6 documente les def_id créés. Cleanup optionnel étape 4. Pas de pollution UI car ces gammes test ne sont pas dans les `tenant_gamme_subscriptions` standards. |

## Fichiers touchés

- Aucun code applicatif modifié (smoke test = SQL + observation)
- `tests/manual/p0.4-pim-smoke-configs.sql` : scratch non commité
- Ce story doc : enrichi en fin avec résultats observés (AC6)

## TF Notion à créer en fin de story

- **TF "Smoke test ingestion PIM 5 scénarios"** :
  - Parcours : P07 — Tracking consommation IA (proche, mais en réalité c'est admin/observabilité)
  - Persona : Superadmin Magrit
  - Type : SQL DB + Manuel humain
  - URL départ : Dashboard Supabase + http://localhost:5177/t/imprimerie-ipa/dashboard/admin/pim
  - Étapes : reprendre la procédure étapes 1-3 ci-dessus
  - Résultat attendu : 5 candidats `merged` avec les bonnes `gamme_slug`

## Notes

Ce smoke test est un **garde-fou anti-régression** sur le pipeline PIM critique avant la démo 23/05. Il est volontairement **manuel** (pas d'automatisation vitest car nécessite Anthropic API live et Dashboard Supabase) — exécution unique avant Phase 1.
