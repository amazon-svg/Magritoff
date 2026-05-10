---
story_id: S1.3 (E-NEW-LLM-01)
epic: 1 — Stack Foundations
title: Migration GPT-4o → Haiku 4.5 + bump Sonnet 4.5 (partiel 2/4)
status: livrée partiellement
delivered_at: 2026-05-09
target_branch: beta/v5
agent: Dev (rétrofit document 2026-05-10)
size: M (initial L)
commits: [555574a, df47dc3]
---

# Story S1.3 — Migration LLM (partiel 2/4 endpoints)

## Story

**As a** product owner Magrit
**I want** toute "génération rapide" Magrit (PIM, descriptifs, mockup artwork) bascule sur Claude Haiku 4.5 via le wrapper `AnthropicClient`
**So that** la qualité des prompts (validation JSON stricte) s'améliore, le coût ÷ 2.5, la latence baisse de 30 %, et la stack devient mono-vendor Anthropic.

## Contexte — recadrage post-audit

**Découverte 2026-05-09 :** l'audit confirme **aucune utilisation OpenAI** dans le code existant. Tous les endpoints utilisent déjà l'API Anthropic via `fetch` direct.

**Conséquence :** S1.3 simplifié de **« migration LLM »** vers **« refactor wrapper sur 4 endpoints »** + bump Sonnet 4 → 4.5 (qui était encore en place sur le `claude-proxy` principal).

## AC livrés (partiel)

### Endpoints refactorés (2/4)

**AC1** ✅ `pim-generate/index.ts` utilise `anthropicComplete()` du wrapper (commit `555574a`)
**AC2** ✅ `pim-ingest/index.ts` utilise `anthropicComplete()` du wrapper (commit `df47dc3`)

### Bump modèle

**AC3** ✅ `make-server-e3db71a4/index.ts` upgrade `claude-sonnet-4-20250514` → `claude-sonnet-4-5-20250929` (commit `df47dc3`)

### Endpoints restants (NOT YET refactored)

⏳ `claude-proxy/index.ts` — endpoint complexe avec logique demo fallback (`generateMultipleConfigs`, mode démo si crédits absents). Refactor délicat, reporté sprint ultérieur.
⏳ `make-server-e3db71a4/claude-proxy` + `claude-proxy-stream` — gros endpoints streaming. Reportés.

### Bénéfices acquis

- Wrapper `AnthropicClient` validé en prod sur 2 endpoints
- Tracking `llm_usage_events` automatique (NFR23) pour PIM
- Limite 25 paramètres anti-hallucination appliquée (FR43)
- Validation JSON Zod automatique disponible (non encore exploitée par PIM, à activer dans une PR follow-up)

## Décisions

| Décision | Justification |
|---|---|
| **Ne pas refactorer claude-proxy maintenant** | Logique demo fallback (~50 lignes) + flux SSE streaming trop sensibles pour un refactor en parallèle d'autres stories. Refactor à isoler dans son propre commit avec tests dédiés. |
| **Sonnet 4.5 au lieu de Sonnet 4** | Sonnet 4.5 (`claude-sonnet-4-5-20250929`) stable, améliorations qualité raisonnement + JSON conformité (cohérent avec FR42 story 1.3 P0). |

## Fichiers touchés

| Fichier | Modif | Commit |
|---|---|---|
| `supabase/functions/pim-generate/index.ts` | -34 / +30 lignes | `555574a` |
| `supabase/functions/pim-ingest/index.ts` | -25 / +17 lignes | `df47dc3` |
| `supabase/functions/make-server-e3db71a4/index.ts` | 1 ligne (model upgrade) | `df47dc3` |

## Edge functions redéployées 2026-05-09

✅ `pim-generate`, `pim-ingest`, `make-server-e3db71a4` sur `ightkxebexuzfjdbpsdg`. Sonnet 4.5 actif. Wrapper actif PIM.

## Métrique cible (à mesurer 30j post-livraison)

- **NFR4** : -30 % latence p50 LLM Haiku vs baseline GPT-4o
- **NFR5** : -50 % retries observés en prod (mesuré via `llm_usage_events`)

## Reste à faire (story S1.3-suite à créer)

- [x] Refactor `claude-proxy/index.ts` (logique demo fallback préservée) — **livré dans S1.5** (cf. [story-S1.5-refactor-llm-finalisation.md](story-S1.5-refactor-llm-finalisation.md), 2026-05-10)
- [x] Refactor `make-server-e3db71a4/claude-proxy` + `claude-proxy-stream` (streaming SSE préservé) — **livré dans S1.5**
- [x] Suppression dépendance `openai` du `package.json` (si présente — à vérifier) — **vérifié dans S1.5** : aucune dépendance, aucune référence GPT, déjà clean de facto
- [ ] Mesure réelle NFR4 + NFR5 à J+30 — toujours à mesurer après déploiement S1.5

## Suite

S1.5 finalise tout le périmètre code restant. Story partielle S1.3 close du point de vue scope code.

## Commits

- `555574a` : `refactor(v5): pim-generate utilise wrapper AnthropicClient (S1.3 partial 1/4)`
- `df47dc3` : `refactor(v5): pim-ingest utilise wrapper + bump Sonnet 4 vers 4.5 (S1.3 partial 2/4)`

## Statut

🟡 **Livrée partiellement** (2/4 endpoints + Sonnet bump). Sprint ultérieur pour finaliser claude-proxy.
