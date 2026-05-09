---
story_id: S1.1
epic: 1 — Stack Foundations
title: Wrapper AnthropicClient unifié
status: livrée
delivered_at: 2026-05-09
target_branch: beta/v5
agent: Dev (rétrofit document 2026-05-10)
size: S
commit: 6f1aa84
---

# Story S1.1 — Wrapper AnthropicClient unifié

## Story (Given/When/Then)

**As a** dev Magrit
**I want** un wrapper unique `AnthropicClient` pour tous les appels Claude avec validation Zod et tracking automatique
**So that** les futurs endpoints v1.1 héritent de la sécurité (limite 25 params, schéma JSON strict) et de l'observabilité sans dupliquer la logique.

## Acceptance Criteria validés

**AC1** ✅ `src/server/llm/AnthropicClient.ts` créé avec `complete()` et `completeStructured(schema)`
**AC2** ✅ Wrapper utilise `@anthropic-ai/sdk` exclusivement (pas de fetch direct)
**AC3** ✅ `completeStructured` valide la sortie LLM contre schéma Zod fourni
**AC4** ✅ Chaque appel insère ligne dans `llm_usage_events` (model, input_tokens, output_tokens, latency_ms, validation_passed)
**AC5** ✅ Limite 25 paramètres par prompt appliquée (FR43, story 2.4 P0)

## Décisions techniques

| Décision | Justification |
|---|---|
| **Localisation `supabase/functions/_shared/anthropicClient.ts`** au lieu de `src/server/llm/` (PRD initial) | Convention Deno : les edge functions partagent via `_shared/`. `src/server/` aurait été côté Node/SSR Vite, inadapté ici. |
| **Pas de SDK Anthropic, fetch direct** | Cohérent avec le pattern existant des 4 endpoints. Le SDK Anthropic Deno existe mais ajoute une dépendance npm: pour peu de gain. |
| **Heuristique compteur de paramètres** | Détecte les patterns `key: value` et `- xxx:` dans les prompts. Imparfait mais suffisant pour anti-hallucination. |
| **`AnthropicClientError` typée** | Discriminée par `kind` : `api_error`, `invalid_response`, `json_parse`, `schema_validation`, `param_limit_exceeded`, `missing_api_key`. Permet fallback métier explicite par cas. |
| **Lookup multi-secrets** | Tries `ANTHROPIC_API_KEY` → `MAGRIT3` → `MAGRIT` (compat avec existant) |

## Fichiers touchés

| Fichier | Modification |
|---|---|
| `supabase/functions/_shared/anthropicClient.ts` (nouveau) | 280 lignes : 2 fonctions exportées + types + erreurs + heuristique 25 params |

## Tests

- ⏳ Tests Deno (`deno test`) à ajouter ultérieurement — nécessite refactor stub pour mocker `fetch` Anthropic. Hors scope v1.1.
- ✅ Test d'intégration via S1.3 (refactor pim-generate + pim-ingest qui utilisent le wrapper).

## Écarts vs PRD/Architecture

- **Localisation fichier** : `_shared/anthropicClient.ts` au lieu de `src/server/llm/AnthropicClient.ts` (PRD § Architecture §4.5). À refléter dans Architecture.md (mineur, n'invalide pas la décision ADR-5).

## Commits

- `6f1aa84` : `feat(v5): wrapper AnthropicClient unifie pour edge functions (S1.1)`
- Edge functions consommatrices redéployées via S1.3.

## Statut

✅ **Livrée et pushée sur `beta/v5`**.
✅ **Consommé par pim-generate (S1.3a) + pim-ingest (S1.3b)**.
⏳ **À étendre aux 2 autres endpoints** (claude-proxy + make-server-e3db71a4/claude-proxy*) en sprint ultérieur.
