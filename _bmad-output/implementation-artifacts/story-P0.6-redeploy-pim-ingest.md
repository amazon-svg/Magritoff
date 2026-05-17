---
story_id: P0.6
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: Redéploiement edge function pim-ingest (fix Magrit3 case-sensitive S1.5)
status: livrée
delivered_at: 2026-05-17
deployment: pim-ingest v6 (2026-05-09) → v7 (2026-05-17 15:05)
final_result: "redeploy effectif, plus d'erreur 'API key ?' sur les appels Claude Haiku, mais a révélé un bug additionnel de matching cm/mm (story P0.7)"
target_branch: beta/v5
agent: Dev (Claude Code) + Arnaud (validation déploiement prod)
size: XS (~10min)
depends_on: rien (fix collatéral pré-existant découvert par P0.4)
unblocks: P0.4 (smoke test ingestion PIM E2E) + toute future ingestion PIM (commandes acheteur, sprint 4 Phase 1/2/3)
discovered_in: P0.4 smoke test du 2026-05-17 (5 candidates rejetés "Enrichissement Claude echoue, API key ?")
---

# Story P0.6 — Redéploiement pim-ingest

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** redéployer l'edge function `pim-ingest` avec le code actuel du repo (qui inclut le fix Magrit3 case-sensitive S1.5 du 10/05)
**So that** l'enrichissement Claude Haiku fonctionne en prod sur le pipeline d'ingestion PIM, débloquant le smoke test P0.4 et toute commande future qui alimente le PIM (Phase 1 bascule orders, Phase 3 commandes lifecycle).

## Contexte

Le smoke test P0.4 (2026-05-17) a inséré 5 candidats de test dans `pim_candidates` (kakémono, étiquette, banderole, dépliant DL, carte de visite régression). Lancement manuel de l'ingestion via `DashboardAdminPIM` superadmin par Arnaud : **5/5 rejetés** avec le message `"Enrichissement Claude echoue (API key ?)"`.

Diagnostic immédiat :
- Le secret `Magrit3` est bien présent dans Supabase B5 (vérifié via `supabase secrets list`).
- Le code local `supabase/functions/_shared/anthropicClient.ts` (ligne 53-56) cherche `ANTHROPIC_API_KEY ?? Magrit3 ?? MAGRIT3 ?? MAGRIT` (lookup multi-casing depuis le fix S1.5 du 10/05, commit `df47dc3`).
- Le code local `supabase/functions/pim-ingest/index.ts` ligne 336 utilise bien `anthropicComplete()` (wrapper unifié).
- → Le bug N'EST PAS dans le code local.

**Diagnostic version déployée** (via `supabase functions list --project-ref ightkxebexuzfjdbpsdg`) :

| Function | Version | Last update |
|---|---|---|
| `make-server-e3db71a4` | v13 | 2026-05-10 14:32 (post S1.5 fix) ✅ |
| `claude-proxy` | v9 | 2026-05-10 14:32 (post S1.5 fix) ✅ |
| `pim-generate` | v7 | 2026-05-10 21:30 (post S1.5 fix) ✅ |
| **`pim-ingest`** | **v6** | **2026-05-09 13:14 (PRE-S1.5 fix)** ❌ |

→ `pim-ingest` n'a **pas été redéployée** après le fix Magrit3 case-sensitive S1.5 du 10/05. La version v6 cherchait probablement `MAGRIT3` uppercase au lieu de `Magrit3` mixed-case → `Deno.env.get` retournait undefined → wrapper levait `AnthropicClientError(kind="missing_api_key")` → `enrichWithClaude` retournait null → candidat rejeté.

Cohérent avec le SPRINT_HANDOFF section 3 ter qui mentionne `redeploy claude-proxy v8 + make-server-e3db71a4 v12 (S1.5 + fix Magrit3 case-sensitive)` mais sans mentionner pim-ingest.

## Acceptance Criteria

**AC1** — Edge function `pim-ingest` redéployée sur le projet Supabase B5 (`ightkxebexuzfjdbpsdg`) via `supabase functions deploy pim-ingest --project-ref ightkxebexuzfjdbpsdg`.

**AC2** — Version observée passe de **v6** à **v7+** après déploiement.

**AC3** — Re-lancement de l'ingestion sur les 5 candidates P0.4 encore `status='pending'` (les rejets précédents les avaient laissés en pending — à vérifier).

**AC4** — Les 5 candidates passent à `status='merged'` avec :
- `kakémono` → `gamme_slug` = `kakemono` OR `roll_up_80x200`
- `étiquette` → `gamme_slug` = `etiquette`
- `banderole` → `gamme_slug` = `banderole`
- `dépliant DL` → `gamme_slug` = `depliant_plie_dl`
- `carte visite` → `gamme_slug` = `carte_visite_standard` (régression)

**AC5** — `product_definitions` créées (5 nouvelles entrées, dont les SEO/marketing JSON enrichis par Claude Haiku, validables).

**AC6** — Aucune régression sur les autres edge functions (make-server-e3db71a4 v13, claude-proxy v9, pim-generate v7 restent intactes — pas redéployées dans cette story).

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Code à déployer | Code actuel du repo `supabase/functions/pim-ingest/index.ts` | Inclut wrapper anthropicClient unifié + lookup Magrit3 mixed-case |
| Procédure | `supabase functions deploy pim-ingest --project-ref ightkxebexuzfjdbpsdg` avec PAT temporaire | Procédure standard, cf. CLAUDE.md |
| Rollback | Non requis | La v7 est strictement supérieure (les autres v8/v9/v13 ont déjà appliqué le fix sans problème) |
| Test post-déploiement | Reprise smoke test P0.4 (candidates pending) | Validation end-to-end qu'on évite un autre bug latent |

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Le bug n'est pas le Magrit3 case-sensitive mais autre chose | Si redéploiement ne résout pas, inspecter logs Edge Functions Supabase via Dashboard. Mais probabilité faible vu l'évidence du diagnostic. |
| Le redéploiement casse autre chose | Le code local a été tourné en local sur d'autres dev/tests. Les autres edge functions (pim-generate) ont été redéployées avec le même fix sans problème. Risque minime. |
| Coût supplémentaire LLM si on relance les 5 candidates | ~0,05€ (déjà budgeté dans P0.4) |

## Fichiers touchés

- Aucun fichier source modifié (le code est OK, seul le déploiement prod doit être actualisé).
- Mise à jour SPRINT_HANDOFF section 11 (pour mentionner ce redéploiement) — optionnel.

## Tests / Vérifications

1. **Avant déploiement** : `supabase functions list` → confirme `pim-ingest v6 du 2026-05-09`
2. **Déploiement** : `supabase functions deploy pim-ingest --project-ref ightkxebexuzfjdbpsdg` → output OK
3. **Après déploiement** : `supabase functions list` → confirme `pim-ingest v7+ du 2026-05-17`
4. **Re-lancement ingestion** : Arnaud clique "Lancer l'ingestion" dans DashboardAdminPIM
5. **Vérif SQL** : `select status, gamme_slug from pim_candidates where raw_config->>'_test_p0_4'='true'` → 5 lignes merged avec bonne gamme_slug
6. **Vérif fiches** : `select count(*) from product_definitions where gamme_slug in ('kakemono','etiquette','banderole','depliant_plie_dl','carte_visite_standard') and created_at > now() - interval '15 minutes'` → 5 (ou plus si carte_visite_standard avait déjà des entries)

## TF Notion à créer en fin de story

- **TF "Redéploiement pim-ingest fix Magrit3 case-sensitive"** :
  - Parcours : P07 — Tracking consommation IA (proche)
  - Persona : Superadmin Magrit
  - Type : SQL DB + Manuel humain
  - URL départ : Dashboard Supabase Functions
  - Étapes : reprendre la procédure 1-5 ci-dessus
  - Résultat attendu : pim-ingest v7+, ingestion E2E réussie

## Notes

Bug pré-existant découvert grâce au respect strict de la méthode BMAD (smoke test P0.4 formel) — sans cette discipline, le bug serait resté latent en prod et aurait probablement bloqué la démo 23/05 (toute commande post-bascule Phase 1 aurait alimenté `pim_candidates` qui resteraient indéfiniment en pending sans enrichissement Claude).

Cette story est un excellent argument pour la méthode BMAD respectée à la lettre. Documentation à mentionner dans la retro Sprint 4.
