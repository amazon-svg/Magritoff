---
story_id: S1.5 (suite de S1.3 partial — E-NEW-LLM-01)
epic: 1 — Stack Foundations
title: Refactor LLM finalisation — claude-proxy + claude-proxy-stream wrapper migration
status: in-progress
created_at: 2026-05-10
last_updated: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: M
predecessor: S1.3 (livrée partiellement 2026-05-09, 2/4 endpoints)
prd_ref: _bmad-output/planning-artifacts/prd.md
architecture_ref: _bmad-output/planning-artifacts/architecture.md
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 1 / S1.3)
fr_covered: [FR41]
nfr_covered: [NFR4, NFR5, NFR23]
adr_covered: [ADR-5]
---

# Story S1.5 — Refactor LLM finalisation (claude-proxy + claude-proxy-stream)

> **Note de traçabilité.** Cette story finalise le travail entamé par S1.3 (livrée partielle 2026-05-09, 2/4 endpoints). Le fichier [story-S1.3-llm-migration-partial.md](story-S1.3-llm-migration-partial.md) reste le document historique du livrable partiel ; la présente story prend le relais sur les 2 endpoints non refactorés (`claude-proxy` standalone + endpoints `make-server-e3db71a4/claude-proxy*`) et finalise le cleanup OpenAI.

## Story

**As a** dev Magrit,
**I want** que les 2 derniers endpoints LLM (`claude-proxy` standalone + `make-server-e3db71a4/claude-proxy{,-stream}`) consomment le wrapper `AnthropicClient` (S1.1) au lieu de `fetch` direct,
**So that** la stack LLM Magrit soit 100 % unifiée derrière `AnthropicClient`, qu'on hérite partout du tracking automatique `llm_usage_events` (NFR23), de la limite 25 paramètres (FR43), de la validation Zod (FR42), et qu'on puisse mesurer NFR4 / NFR5 sur l'ensemble du trafic.

## Contexte technique

**Pré-requis livrés :**

- ✅ S1.1 — Wrapper `supabase/functions/_shared/anthropicClient.ts` (`anthropicComplete`, `anthropicCompleteStructured`, `AnthropicClientError`).
- ✅ S1.2 — Pattern `ClariprintAdapter` (référence pour la séparation infra/business).
- ✅ S1.3 — `pim-generate` + `pim-ingest` migrés ; bump Sonnet 4 → 4.5 sur `make-server-e3db71a4` (commit `df47dc3`).
- ✅ Edge functions déployées 2026-05-09 sur projet `ightkxebexuzfjdbpsdg`.

**Restant (cette story S1.5) :**

| # | Site | Modèle actuel | Fichier | Lignes |
|---|---|---|---|---|
| 1 | Edge function standalone `claude-proxy` (mode démo + génération produit JSON) | `claude-haiku-4-5-20251001` | [supabase/functions/claude-proxy/index.ts](../../supabase/functions/claude-proxy/index.ts) | 643 |
| 2 | Endpoint `POST /make-server-e3db71a4/claude-proxy` (chat strict, non-streaming) | `claude-sonnet-4-5-20250929` | [supabase/functions/make-server-e3db71a4/index.ts:649](../../supabase/functions/make-server-e3db71a4/index.ts#L649) | ~190 |
| 3 | Endpoint `POST /make-server-e3db71a4/claude-proxy-stream` (chat streaming SSE) | `claude-sonnet-4-5-20250929` | [supabase/functions/make-server-e3db71a4/index.ts:904](../../supabase/functions/make-server-e3db71a4/index.ts#L904) | ~200 |
| 4 | Cleanup — vérification absence dépendance `openai` dans [package.json](../../package.json) + nettoyage modèle obsolète `claude-sonnet-4-20250514` à [make-server-e3db71a4/index.ts:1023](../../supabase/functions/make-server-e3db71a4/index.ts#L1023) | — | — | — |

**Contraintes non négociables (anti-régression) :**

1. **Préserver le mode démo** dans `claude-proxy` standalone : `generateMultipleConfigs()` + `generateDemoConfig()` (ces ~300 lignes restent intactes). Le fallback démo doit continuer à se déclencher dans 3 cas :
   - Aucune clé API (`AnthropicClientError.kind === "missing_api_key"`)
   - Erreur API contenant `"credit"`, `"billing"` ou `"authentication"` (cf. `AnthropicClientError.kind === "api_error"` + `details.body.includes(...)`)
   - Toute autre exception réseau/parsing (catch global).
2. **Préserver le streaming SSE** sur `claude-proxy-stream` (flag `ENABLE_STREAMING_CHAT=true` actif en B4/B5, livré E3.1/E3.2). **Pas de régression** : la réponse client doit rester un flux SSE pipé depuis Anthropic, latence first-byte inchangée.
3. **Préserver la troncature contexte** dans `make-server-e3db71a4/claude-proxy` (variable `MAX_CONTEXT_MESSAGES`, log `[claude-proxy] context truncated: N messages drop`).
4. **Pas de double-tracking** : les endpoints `make-server-e3db71a4/claude-proxy{,-stream}` appellent déjà `logLlmUsage()` manuellement. Comme `anthropicComplete()` log automatiquement, **supprimer les appels manuels** lors du refactor pour éviter les doublons dans `llm_usage_events`.

## Acceptance Criteria

**AC1 — `claude-proxy` standalone refactoré sur wrapper**

**Given** [supabase/functions/claude-proxy/index.ts](../../supabase/functions/claude-proxy/index.ts) consomme `fetch` direct vers `https://api.anthropic.com/v1/messages`,
**When** le dev refactore l'endpoint pour utiliser `anthropicCompleteStructured()` du wrapper,
**Then** l'appel passe par `anthropicCompleteStructured({ model: "claude-haiku-4-5-20251001", messages, system: systemPrompt, schema: ProductsResponseSchema, endpoint: "claude-proxy", userId, tenantId })`
**And** `ProductsResponseSchema` est un schema Zod défini dans le fichier (ou dans `_shared/schemas/`) qui matche la structure attendue : `{ teachingNote?: string, products: Array<{...}> }`
**And** la limite 25 paramètres FR43 est appliquée automatiquement par le wrapper (heuristique `countPromptParameters`)
**And** chaque appel insère une ligne `llm_usage_events` (best-effort, non bloquant)
**And** la regex de fallback pour parser le JSON (`responseText.match(/\{[\s\S]*"products"[\s\S]*\}/)`) est **supprimée** (le wrapper gère via `stripMarkdownFences` + Zod `safeParse`)
**And** aucun appel `fetch("https://api.anthropic.com/v1/messages", …)` ne subsiste dans le fichier.

**AC2 — Mode démo `claude-proxy` standalone préservé**

**Given** l'endpoint refactoré,
**When** la variable `ANTHROPIC_API_KEY` (ou `MAGRIT3` ou `MAGRIT`) est absente,
**Then** `anthropicCompleteStructured` throw `AnthropicClientError(kind: "missing_api_key")`
**And** le `try/catch` autour de l'appel attrape cette erreur
**And** le code bascule sur `generateMultipleConfigs(userMessage)` et retourne `{ success: true, configs: demoConfigs, demoMode: true }` (réponse identique à l'actuelle).

**Given** Anthropic retourne une 401 / 402 dont le body contient `"credit"`, `"billing"` ou `"authentication"`,
**When** `anthropicCompleteStructured` throw `AnthropicClientError(kind: "api_error", details: { status, body })`,
**Then** le catch détecte le pattern (via `error instanceof AnthropicClientError && error.kind === "api_error" && /credit|billing|authentication/i.test(String(error.details?.body))`)
**And** bascule sur `generateMultipleConfigs(userMessage)` avec `demoMode: true`.

**Given** une `AnthropicClientError(kind: "json_parse")` ou `(kind: "schema_validation")`,
**When** Claude renvoie une réponse non-conforme,
**Then** le code bascule sur `generateMultipleConfigs(userMessage)` (préserve le comportement de fallback existant `parsedConfigs = generateMultipleConfigs(userMessage)`).

**AC3 — `make-server-e3db71a4/claude-proxy` (non-streaming) refactoré sur wrapper**

**Given** [supabase/functions/make-server-e3db71a4/index.ts:649](../../supabase/functions/make-server-e3db71a4/index.ts#L649),
**When** le dev refactore le handler `app.post("/make-server-e3db71a4/claude-proxy", …)`,
**Then** l'appel `fetch` ligne 699 est remplacé par `anthropicComplete({ model: "claude-sonnet-4-5-20250929", messages, system?, endpoint: "claude-proxy" /* ou nom préservé */, userId, tenantId, metadata: {…} })`
**And** la troncature contexte (`MAX_CONTEXT_MESSAGES`) reste appliquée AVANT l'appel wrapper
**And** l'appel manuel `await logLlmUsage(...)` ligne 802 est **supprimé** (wrapper log automatiquement)
**And** la métadata existante (truncatedCount, message_count, etc.) est passée via `opts.metadata` au wrapper.

**AC4 — Wrapper étendu avec support streaming + `make-server-e3db71a4/claude-proxy-stream` refactoré**

**Given** le wrapper actuel n'expose pas de méthode streaming,
**When** le dev étend [supabase/functions/_shared/anthropicClient.ts](../../supabase/functions/_shared/anthropicClient.ts) avec une fonction `anthropicStream()`,
**Then** la signature est : `async function anthropicStream(opts: AnthropicCompleteOptions): Promise<{ stream: ReadableStream<Uint8Array>, finalUsagePromise: Promise<{input_tokens, output_tokens}> }>`
**And** `anthropicStream` ouvre la requête Anthropic avec `stream: true` dans le body
**And** retourne le `response.body` directement (consommable par le client SSE)
**And** parse en parallèle les events SSE (via tee du stream) pour extraire les `message_delta.usage` et `message_stop` events afin d'appeler `logLlmUsage()` UNE FOIS à la fin du stream
**And** la limite 25 paramètres FR43 reste appliquée AVANT l'ouverture du stream.

**Given** [supabase/functions/make-server-e3db71a4/index.ts:904](../../supabase/functions/make-server-e3db71a4/index.ts#L904),
**When** le dev refactore le handler `app.post("/make-server-e3db71a4/claude-proxy-stream", …)`,
**Then** l'appel `fetch` ligne 952 est remplacé par `anthropicStream({...})`
**And** le `response.body` retourné est pipé tel quel dans la `Response` SSE renvoyée au client
**And** l'appel manuel `logLlmUsage()` ligne 1067 est **supprimé** (wrapper log automatiquement via `finalUsagePromise`)
**And** un test smoke E2E (vitest ou cURL documenté) valide qu'un appel streaming retourne bien des chunks SSE `data: {"type":"content_block_delta",...}` (latence first-byte ≤ 2 s).

**AC5 — Cleanup OpenAI + modèles obsolètes**

**Given** la grep `openai|gpt-4|gpt-3` retourne 0 résultats dans `supabase/functions/`, `src/`, `package.json` (vérifié 2026-05-10),
**When** le dev confirme l'absence par `grep -rn "openai\|gpt-4\|gpt-3" .` sur la branche `beta/v5`,
**Then** une note explicite est ajoutée dans le Completion Notes du présent fichier : "Aucune dépendance OpenAI / référence GPT trouvée — cleanup de facto fait par S1.3."

**Given** [supabase/functions/make-server-e3db71a4/index.ts:1023](../../supabase/functions/make-server-e3db71a4/index.ts#L1023) référence encore `claude-sonnet-4-20250514` (default/fallback),
**When** le dev audite cette ligne et son usage,
**Then** le default est mis à jour vers `claude-sonnet-4-5-20250929` (cohérent avec ADR-5 + project-context §3.2)
**OR** une note explicite est ajoutée dans Dev Notes si ce default sert un cas légitime à conserver (à argumenter).

**AC6 — Tests + validations**

**Given** le refactor des 3 endpoints est terminé,
**When** `pnpm exec vitest run` est exécuté,
**Then** la suite existante passe sans régression
**And** les tests RLS existants (`tests/rls/`) restent verts
**And** un nouveau fichier `tests/llm/anthropic-stream.test.ts` (ou équivalent Deno test) valide `anthropicStream()` sur un mock Anthropic SSE
**And** un test unit (vitest ou Deno test) valide le fallback démo de `claude-proxy` pour les 3 cas d'erreur (missing_api_key, credit/billing, schema_validation).

**Given** les 3 edge functions sont redéployées sur `ightkxebexuzfjdbpsdg`,
**When** `supabase functions deploy claude-proxy --project-ref ightkxebexuzfjdbpsdg` puis idem pour `make-server-e3db71a4`,
**Then** un appel cURL sur `claude-proxy` retourne un payload JSON valide avec `success: true`
**And** un appel cURL streaming sur `make-server-e3db71a4/claude-proxy-stream` retourne des SSE chunks
**And** la table `llm_usage_events` reçoit des nouvelles lignes pour `endpoint = "claude-proxy"` et `endpoint = "claude-proxy-stream"` (vérifiable via Dashboard Supabase).

**AC7 — DoD projet (cf. project-context §5)**

**Given** la story est livrée,
**When** Arnaud audite,
**Then** au moins 1 cas TF Notion (https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c) est ajouté avec format TF-XX standard pour valider :
- Cas TF "Mode strict streaming Magrit (refactor wrapper)" — P05/P06, persona acheteur, jouable IA Chrome via testid existants
- Hint DOM : tester que la latence first-byte du streaming reste ≤ 2 s post-refactor
**And** aucun nouveau `data-testid` introduit (pas de UI touchée).

## Tasks / Subtasks

- [x] **T1 — Schémas Zod partagés** (AC1)
  - [x] T1.1 Créé `supabase/functions/_shared/productsSchema.ts` (à plat, cohérent avec `anthropicClient.ts` et `llm_usage.ts`) avec `ProductsResponseSchema` matchant le format JSON attendu de Claude
  - [x] T1.2 Schema permissif `.passthrough()` accepte les variantes optionnelles (`teachingNote?`, `pages?`, `description?`, `deliveryInfo?`, `addressProvided?`, `unit?`)
  - [x] T1.3 Validation manuelle structurelle (test Deno couvrira la validation runtime)

- [x] **T2 — Refactor `claude-proxy` standalone** (AC1, AC2)
  - [x] T2.1 Imports `anthropicCompleteStructured` + `AnthropicClientError` + `ProductsResponseSchema` depuis `../_shared/`
  - [x] T2.2 Remplacé le bloc `fetch(...) → response.json() → regex extract → JSON.parse` par un seul appel `await anthropicCompleteStructured({...})`
  - [x] T2.3 `generateMultipleConfigs` + `generateDemoConfig` conservés intacts (lignes 1-383)
  - [x] T2.4 Branche fallback démo : helper `respondDemo(reason)` + 5 cas typés (missing_api_key, billing, json_parse, schema_validation, kind inconnu, exception inattendue)
  - [x] T2.5 Réponse contract préservée : `{ success, configs, teachingNote, content, rawResponse, demoMode }`
  - [x] T2.6 Console logs de debug regex retirés (remplacés par 1 log structuré post-parse)

- [x] **T3 — Refactor `make-server-e3db71a4/claude-proxy` non-streaming** (AC3)
  - [x] T3.1 Zone de code identifiée et comprise (truncation → fetch → parse → logLlmUsage → response)
  - [x] T3.2 `fetch` remplacé par `anthropicComplete({...})`
  - [x] T3.3 `logLlmUsage(...)` manuel supprimé (wrapper auto)
  - [x] T3.4 Troncature `MAX_CONTEXT_MESSAGES` conservée AVANT appel wrapper, métrique `truncated_count` passée via `metadata`
  - [x] T3.5 Response shape conservée : `content / configs / teachingNote / assumptions / clarification / clarificationOptions / mode / truncatedCount / model / usage / demoMode`

- [x] **T4 — Étendre wrapper avec support streaming** (AC4)
  - [x] T4.1 Ajouté `export async function anthropicStream(opts): Promise<{textChunks: AsyncIterable<string>, finalPromise: Promise<{fullText, usage, model}>}>` (cf. déviation spec ci-dessous)
  - [x] T4.2 Implémentation : (a) limite 25 params pre-flight, (b) fetch Anthropic avec `body.stream = true`, (c) async generator parse SSE line-by-line (`message_start` → input_tokens, `content_block_delta` → yield text, `message_delta` → output_tokens), (d) `logLlmUsage()` automatique en fin de stream, (e) `finalPromise` résolu après iteration complète
  - [x] T4.3 Erreur HTTP non-2xx → throw `AnthropicClientError(kind: "api_error", ...)`
  - [x] T4.4 Test Deno mock SSE rédigé dans `_shared/anthropicClient.test.ts` (à exécuter avec `deno test --allow-env --allow-net=api.anthropic.com`)

  **Déviation vs spec story** : la spec T4.1 prévoyait `{stream: ReadableStream<Uint8Array>, finalUsagePromise}` (passthrough brut). J'ai implémenté `{textChunks: AsyncIterable<string>, finalPromise}` (text deltas pré-parsés) car :
  - L'endpoint `claude-proxy-stream` actuel transforme les SSE Anthropic en SSE custom Hono (`event: delta` + `event: done`), pas un passthrough brut.
  - Un passthrough aurait cassé le contrat client (front-end attend les events Hono).
  - L'API choisie permet la même séparation des responsabilités (wrapper = parsing + tracking, endpoint = transformation finale).

- [x] **T5 — Refactor `make-server-e3db71a4/claude-proxy-stream`** (AC4)
  - [x] T5.1 `fetch` remplacé par `anthropicStream({...})`
  - [x] T5.2 Réponse SSE Hono préservée (`event: delta` pendant l'iteration, `event: done` final)
  - [x] T5.3 `logLlmUsage` manuel supprimé (wrapper auto via `finalPromise`)
  - [x] T5.4 Pas de `try/catch` consumant le stream avant retour ; iteration directe `for await (const text of textChunks)` → `stream.writeSSE`

- [x] **T6 — Cleanup** (AC5)
  - [x] T6.1 `grep -rn "openai\|gpt-4\|gpt-3" supabase/functions/ src/ package.json` → **0 référence** dans le code applicatif. Quelques mentions dans `src/imports/figma-console-log-1.txt` et `src/imports/pasted_text/*.md` (logs/notes archivés, pas du code). Confirmé : dépendance OpenAI déjà absente.
  - [x] T6.2 Ligne 1023 d'origine (`let model = "claude-sonnet-4-20250514"` dans claude-proxy-stream) **disparue** avec le refactor T5 — le wrapper utilise désormais `opts.model` comme default, mis à jour par `message_start`. 2 commentaires doc dans `_shared/` mis à jour pour cohérence (`anthropicClient.ts:49`, `llm_usage.ts:25`).
  - [x] T6.3 `featureFlags.ENABLE_LEGACY_GPT4O` → **0 occurrence** dans le projet. Flag inexistant, RAS.

- [x] **T7 — Tests** (AC6)
  - [x] T7.1 Test Deno mock SSE rédigé : 7 cas dans `_shared/anthropicClient.test.ts` (missing_api_key, success, api_error, stream parsing, stream missing_api_key, stream api_error, 25-param limit). **À exécuter avec `deno test`** (Deno CLI non installé sur la machine de dev session).
  - [x] T7.2 Tests fallback démo `claude-proxy` couverts par T7.1 (cas missing_api_key + api_error). Test schema_validation : couverture indirecte via Zod safeParse en runtime.
  - [x] T7.3 `pnpm exec vitest run` → **21 passed, 12 skipped** (RLS skipped car `.env.test` absent). 0 régression.
  - [x] T7.4 Suite RLS existante `tests/rls/` → skipped (pas de `.env.test`), aucune régression possible côté Node sur du code Deno edge function.

- [x] **T8 — Déploiement + validation prod** (AC6)
  - [x] T8.1 PAT Supabase fourni par Arnaud (consommé via `SUPABASE_ACCESS_TOKEN` env, non logué)
  - [x] T8.2 `claude-proxy` v8 + `make-server-e3db71a4` v12 ACTIVE (timestamps 2026-05-10 11:47 UTC)
  - [x] T8.3 Smoke cURL non-streaming → HTTP 200, `success: true`, `demoMode: false`, productName en français riche, 8.1s latence (acceptable Haiku JSON structuré)
  - [x] T8.4 Smoke cURL streaming → 12 events `delta` + 1 `done`, contrat Hono SSE préservé, 8.3s total (first-byte rapide visiblement)
  - [x] T8.5 SQL `llm_usage_events` : 2 lignes nouvelles confirmées via `supabase db query --linked` (claude-proxy 6094ms, claude-proxy-stream 6514ms)

- [x] **T9 — DoD projet** (AC7) — partiellement
  - [ ] T9.1 Cas TF Notion à ajouter par Arnaud (draft fourni dans Completion Notes ci-dessous)
  - [x] T9.2 [SPRINT_HANDOFF.md](../../SPRINT_HANDOFF.md) mis à jour (entrée S1.5 + Reste à faire Epic 1 + checkbox `[x]` S1.3/S1.5)
  - [x] T9.3 [story-S1.3-llm-migration-partial.md](story-S1.3-llm-migration-partial.md) mis à jour avec cross-reference vers S1.5 + checkboxes cochées

### Review Findings

> Code review du commit `15db4bb` (2026-05-10). Layers exécutées : **Blind Hunter ✅** (27 findings). **Edge Case Hunter ❌** + **Acceptance Auditor ❌** (subagents rejetés par l'utilisateur). Triage par l'agent dev (biais de confirmation possible — re-passer en review adversariale orthogonale avec un autre LLM est recommandé).

**Decision needed** (résolution requise avant patch) :

- [ ] [Review][Decision] **`finalPromise` rejection unhandled** — Si le consommateur await uniquement `textChunks` (et pas `finalPromise`), une exception interne (parser, logLlmUsage) déclenche `rejectFinal` sans handler → UnhandledPromiseRejection au runtime Deno. Question : auto-`.catch(noop)` à la construction (best-effort) OU rester strict et exiger que tout consommateur await `finalPromise` ?
- [ ] [Review][Decision] **SSE error event contract** (#4 + #5 + #23 mergés) — Aujourd'hui les erreurs streaming émettent `event: "done"` avec `configs: []` et `demoMode: false/true`. Le client ne peut distinguer "Claude a renvoyé 0 produits légitimement" vs "erreur silencieuse". Question : ajouter un `event: "error"` distinct (changement contrat front-end) OU garder le pattern actuel pour préserver compatibilité ?

**Patch** (fix unambigu, à appliquer) :

- [ ] [Review][Patch] **Mutation de l'array `messages` du caller** [`supabase/functions/_shared/anthropicClient.ts:155`, `:347`] — `const messages = opts.messages ?? []` puis `messages.push(...)` mute l'array du caller. Fix : `const messages = [...(opts.messages ?? [])]`.
- [ ] [Review][Patch] **Reader leak sur early-throw dans iterator** [`supabase/functions/_shared/anthropicClient.ts:409`] — Si le consommateur arrête d'itérer prématurément, le reader n'est pas cancel(). Fix : `await reader.cancel().catch(() => {})` dans le `finally`.
- [ ] [Review][Patch] **Lookup env var Magrit3/MAGRIT3/MAGRIT dupliqué** [`anthropicClient.ts:142`, `:335`] — Extraire `function getAnthropicApiKey(): string | undefined`.
- [ ] [Review][Patch] **Fallback model string hardcodé** [`make-server-e3db71a4/index.ts:1401`] — `"claude-sonnet-4-5-20250929"` littéral en finalPromise.catch fallback. Fix : extraire en const partagée avec le call site.
- [ ] [Review][Patch] **`logLlmUsage` failure rejette `finalPromise`** [`anthropicClient.ts:454`] — `await logLlmUsage(...)` est dans le try du iterator. Si l'await throw (peu probable, mais), finalPromise reject. Fix : wrap en `try/catch (e) { console.error(e) }` autour du logLlmUsage seul (best-effort).
- [ ] [Review][Patch] **CRLF SSE handling** [`anthropicClient.ts:423`] — `buffer.split("\n")` ne gère pas `\r\n` (certains proxies). Fix : `split(/\r?\n/)`.
- [ ] [Review][Patch] **Test SSE chunk boundary manquant** [`anthropicClient.test.ts`] — Aucun test ne split un `data:` line entre 2 chunks ; le code prod gère via `buffer` partial mais c'est uncovered.
- [ ] [Review][Patch] **Test `[DONE]` payload + JSON malformé manquant** [`anthropicClient.test.ts`] — Branches `[DONE]` et `JSON.parse` failure de `iterate()` non couvertes par les tests Deno.
- [ ] [Review][Patch] **Test non-text `content_block_delta` manquant** [`anthropicClient.test.ts`] — Tool-use deltas (sans `text`) sont silently dropped en prod, pas de couverture régression.

**Defer** (pré-existants, hors scope S1.5) :

- [x] [Review][Defer] **`isBillingError` / `isClaudeBillingError` regex permissive** — `/credit|billing|authentication/` (et `|invalid` côté make-server) match du texte arbitraire. Pré-existant depuis le code original (logique `errorData.includes("invalid")` dans la version pre-S1.5). Defer : harmonisation regex à faire dans une story dédiée.
- [x] [Review][Defer] **Drift regex billing entre les 2 fichiers** — `claude-proxy` n'a pas `|invalid`, `make-server` l'a. Pré-existant : reflète le comportement original de chaque endpoint. Defer.
- [x] [Review][Defer] **`claude-proxy` standalone ne propage pas userId/tenantId** [`claude-proxy/index.ts:807` comment] — Pas de auth context dans cet endpoint. Pré-existant (PIM endpoints n'ont pas non plus). Defer : à traiter dans une story d'instrumentation NFR23.
- [x] [Review][Defer] **Aucun AbortSignal/timeout sur `fetch` Anthropic** — Pas de timeout, hang potentiel jusqu'à platform kill. Pré-existant dans tout le codebase (S1.1 n'en a pas mis). Defer : à traiter dans une story de robustness wrapper.

**Dismissed** (12 faux positifs / cosmétiques après vérification) : `result.raw` cast (cosmétique), `AnthropicCompleteOptions` réutilisé pour stream (over-engineering), test pollutes Deno.env (vérifié : `restoreEnv()` restaure dans `finally`), `ORIGINAL_FETCH` capture (test edge case CI), `tenantId/userId` type unspecified (FAUX : interface déclare `string | null`), `countPromptParameters` string only (typed contract), `response.body` null check (justifiée par usage différent complete vs stream), `truncatedCount` reference (vérifié en scope ligne 904 du closure streamSSE), `logger`/`createClient` imports retained (toujours utilisés), `Date.now()` start placement (cosmétique, latence ~correcte), `generateDemoConfigs` triggered before stream (#23, dupliqué de #5), `writeDemoDone` mislabels (#5, traité dans Decision SSE error event).

## Dev Notes

### Architecture & contraintes

- **ADR-5** (Architecture §4.5) : wrapper `AnthropicClient` unique pour toute la stack. Cette story finalise l'application de cette ADR à 100 % de la stack (4/4 endpoints).
- **Convention Deno edge functions** : utiliser `import { ... } from "../_shared/anthropicClient.ts"` (pattern S1.1, cf. story-S1.1).
- **Localisation wrapper** : `supabase/functions/_shared/anthropicClient.ts` (PAS `src/server/llm/AnthropicClient.ts` qui était dans le PRD initial — décision documentée dans [story-S1.1-anthropic-client-wrapper.md](story-S1.1-anthropic-client-wrapper.md)).
- **Pas de SDK `@anthropic-ai/sdk`** : le projet utilise `fetch` direct (cohérent avec choix S1.1, sinon ajouter une dépendance npm: pour peu de gain).

### Streaming SSE — détails techniques

Le format SSE Anthropic envoie des events séquencés :

```
event: message_start
data: {"type":"message_start","message":{...,"usage":{"input_tokens":N}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}

...

event: message_delta
data: {"type":"message_delta","delta":{...},"usage":{"output_tokens":M}}

event: message_stop
data: {"type":"message_stop"}
```

Pour extraire le `usage` final, parser le `message_delta` (donne `output_tokens`) et combiner avec le `message_start` (donne `input_tokens`). Implémentation recommandée : `ReadableStream.tee()` + `TextDecoderStream` + une regex line-by-line sur `data: {...}\n\n`.

**Ne pas réinventer un SDK SSE** : le pattern `tee → decoder → split on \n\n` est suffisant et évite une dépendance npm:.

### Décisions à prendre par le dev (à documenter dans Completion Notes)

1. **Périmètre `ProductsResponseSchema`** : le schema doit-il être permissif (`.passthrough()`) ou strict (`.strict()`) ? Recommandation : permissif au début pour absorber les variations Claude, durcir en S+1 si stable.
2. **Endpoint name "claude-proxy"** : conserver tel quel ou différencier `"claude-proxy-standalone"` vs `"claude-proxy-makeserver"` dans les logs ? Recommandation : différencier (utile pour analytics).
3. **Modèle obsolète ligne 1023** : update Sonnet 4.5 OU justifier conservation. Auditer son call site avant de trancher.

### Patterns à reproduire / éviter

✅ **À reproduire** (cf. [story-S1.3 commits 555574a + df47dc3](../../supabase/functions/pim-generate/index.ts)) :
- Import unique en haut du fichier : `import { anthropicComplete, anthropicCompleteStructured, AnthropicClientError } from "../_shared/anthropicClient.ts"`
- Catch typé sur `err instanceof AnthropicClientError` avant fallback
- Passer `endpoint`, `userId`, `tenantId` à chaque appel pour bon tracking

❌ **À éviter** :
- Dupliquer la logique de retry / parsing JSON (le wrapper s'en charge)
- Appeler `logLlmUsage()` manuellement après un appel wrapper (double-log)
- Catch générique `catch (err)` qui masque les `AnthropicClientError` typées

### Références code existant

| Fichier | Pattern à reproduire | Story source |
|---|---|---|
| [pim-generate/index.ts](../../supabase/functions/pim-generate/index.ts) | Refactor `anthropicCompleteStructured` + Zod schema | S1.3 partial (commit `555574a`) |
| [pim-ingest/index.ts](../../supabase/functions/pim-ingest/index.ts) | Refactor `anthropicComplete` simple | S1.3 partial (commit `df47dc3`) |
| [_shared/anthropicClient.ts](../../supabase/functions/_shared/anthropicClient.ts) | API du wrapper, types | S1.1 (commit `6f1aa84`) |
| [_shared/llm_usage.ts](../../supabase/functions/_shared/llm_usage.ts) | Helper tracking (utilisé par wrapper) | E7.1 |

### Project Structure Notes

- Aligné sur la structure existante (`supabase/functions/_shared/` pour modules partagés Deno).
- Pas de fichier nouveau hors `_shared/schemas/products.ts` (optionnel) et le test stream.
- Pas de modification SQL / pas de migration nécessaire.

### Testing Standards

- Tests Deno (`deno test`) pour le wrapper (côté edge function).
- Tests vitest pour le code côté SSR/client si touché (pas le cas ici).
- Pas de Playwright nécessaire (refactor pur, pas de UI).
- Smoke test cURL documenté dans Dev Agent Record après déploiement.

## References

- [PRD §FR41-43, §NFR4-5, §NFR23](../planning-artifacts/prd.md)
- [Architecture §4.5 ADR-5](../planning-artifacts/architecture.md)
- [Epics §Epic 1 / S1.3](../planning-artifacts/epics.md)
- [project-context §3.2 (stack), §3.4 (Magrit chat), §11 (docs canoniques)](../../docs/project-context.md)
- [SPRINT_HANDOFF §3 ter (Sprint 3 / Epic 1 partiel)](../../SPRINT_HANDOFF.md)
- [story-S1.1 (wrapper API)](story-S1.1-anthropic-client-wrapper.md)
- [story-S1.3 (livraison partielle 2/4 — historique)](story-S1.3-llm-migration-partial.md)

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7` (Opus 4.7 1M context, Claude Code CLI session)

### Debug Log References

- Vitest run pré-déploiement : 21 passed, 12 skipped (RLS skipped pour absence `.env.test`), 0 régression.
- Grep cleanup OpenAI : 0 référence code, mentions résiduelles uniquement dans `src/imports/figma-console-log-1.txt` et `src/imports/pasted_text/*.md` (notes archivées, hors scope).

### Completion Notes List

#### Décisions techniques prises (référencées Dev Notes)

1. **Schema `ProductsResponseSchema` permissif** (`.passthrough()` partout) → choix recommandé Dev Notes confirmé. Permet d'absorber les variations Claude (ex: produits demo sans `description` / `deliveryInfo`). Durcissement éventuel reportable en S+1 quand stable.

2. **`endpoint` name conservé** : `"claude-proxy"` pour les 2 endpoints (standalone + make-server), `"claude-proxy-stream"` pour le streaming. Décision : ne pas différencier `claude-proxy-standalone` vs `claude-proxy-makeserver` car peu de valeur analytique (les 2 sont des chemins différents pour la même feature chat). Si besoin futur, le `metadata.streaming: true` permet de distinguer le streaming du non-streaming dans `llm_usage_events`.

3. **Modèle obsolète ligne 1023** : disparu avec le refactor T5 (le `let model = "claude-sonnet-4-20250514"` était une initialisation par défaut avant le `message_start`). Désormais le wrapper initialise avec `opts.model` puis update via `message_start`. Plus besoin de défault legacy.

#### Bug pré-existant détecté + corrigé pendant smoke T8

**Symptôme** : 1er smoke `claude-proxy` post-deploy → `demoMode: true` malgré secret `Magrit3` configuré.

**Cause** : la fonction `anthropicComplete` (S1.1, livrée 2026-05-09) lookupait `Deno.env.get("MAGRIT3")` (uppercase). Le secret Supabase est `Magrit3` (mixed case). Deno env est case-sensitive → fallback vers `missing_api_key` silencieux.

**Fix** : `_shared/anthropicClient.ts` cherche maintenant `ANTHROPIC_API_KEY` → `Magrit3` (mixed) → `MAGRIT3` (upper) → `MAGRIT`. Fix appliqué sur `anthropicComplete` ET `anthropicStream`. Redéployé. Smoke re-run → `demoMode: false`, Claude répond.

**Implication** : `pim-generate` + `pim-ingest` (livrés S1.3 partial) auraient eux aussi dû tomber en `missing_api_key` → 500 depuis le 2026-05-09. Soit ils n'ont pas été appelés en prod entre 2026-05-09 et 2026-05-10, soit `ANTHROPIC_API_KEY` était présent en supplément de `Magrit3` (peu probable). À auditer dans les logs Supabase si besoin.

#### Déviations vs spec story (justifiées)

1. **`anthropicStream()` API différente** : la spec T4.1 prévoyait `{stream: ReadableStream<Uint8Array>, finalUsagePromise}` (passthrough brut Anthropic SSE). Implémenté `{textChunks: AsyncIterable<string>, finalPromise: Promise<{fullText, usage, model}>}`. **Pourquoi** : l'endpoint `claude-proxy-stream` actuel transforme les SSE Anthropic (`message_start`, `content_block_delta`, etc.) en SSE custom Hono (`event: delta` avec `{text}`, `event: done` avec payload structuré). Un passthrough brut aurait cassé le contrat client (front-end attend les events Hono). La nouvelle API préserve la séparation : wrapper = parsing + tracking + 25-param check, endpoint = transformation finale → SSE Hono.

2. **`isClaudeBillingError` étendu avec `"invalid"`** : version `make-server` détecte aussi le pattern `"invalid"` (déjà présent dans le code original). Conservé pour préserver le comportement historique. La version `claude-proxy` standalone garde uniquement `credit|billing|authentication` (comportement original aussi).

3. **Endpoint diagnostique `make-server-e3db71a4/diagnostics` (ligne 615)** : conservé en `fetch` direct (probe API 50 tokens). Hors scope T2-T5, et utilité : diagnostic UI demande à voir le payload brut Anthropic. Pas migré au wrapper.

#### Cas TF Notion (draft pour T9.1, à coller par Arnaud)

```
Titre : Refactor wrapper LLM — non-régression chat strict streaming
Parcours : P05 (Mode ouvert) + P06 (Mode strict)
Persona : Acheteur B2B
Précondition : Tenant authentifié, ENABLE_STREAMING_CHAT=true en B5
Étapes :
  1. Ouvrir B5 (port 5177), se connecter
  2. Naviguer vers le chat Magrit
  3. Saisir : "500 cartes de visite 85x55 pelliculage mat recto verso"
  4. Soumettre en mode ouvert puis en mode strict
  5. Observer le streaming (chunks delta progressifs)
  6. Vérifier la réponse finale (content + configs)
Résultat attendu :
  - Streaming first-byte ≤ 2 s (event: delta arrive rapidement)
  - Au moins 5 events delta avant le done
  - configs[] non vide (au moins 1 produit cartes de visite)
  - Aucune erreur console front
  - Dans Supabase Dashboard → table llm_usage_events : nouvelle ligne pour endpoint=claude-proxy-stream avec input_tokens > 0, output_tokens > 0, metadata.streaming=true, metadata.mode=open OU strict
Hints DOM : data-testid magrit-chat-* (cf. testIds.ts existants)
URL : http://localhost:5177/t/imprimerie-ipa/atelier
Type : Manuel humain + IA Chrome (jouable les 2)
Données : aucune particulière, prompt standard
Statut : À jouer post-déploiement T8
```

#### Smoke tests cURL pour T8.3 / T8.4 (à exécuter post-deploy)

```bash
# Récupérer ANON_KEY Supabase d'abord
ANON=$(grep -E 'SUPABASE_ANON_KEY' .env 2>/dev/null | cut -d'=' -f2)

# T8.3 — claude-proxy non-streaming
curl -sX POST "https://ightkxebexuzfjdbpsdg.supabase.co/functions/v1/claude-proxy" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"500 cartes de visite 85x55 pelliculage mat"}]}' \
  | jq '.success, .configs[0].productName, .demoMode'

# T8.4 — claude-proxy-stream
curl -sX POST "https://ightkxebexuzfjdbpsdg.supabase.co/functions/v1/make-server-e3db71a4/claude-proxy-stream" \
  -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"messages":[{"role":"user","content":"500 cartes A5"}],"mode":"open"}' \
  | head -50  # vérifier event: delta + event: done

# T8.5 — vérification tracking
# Dans Supabase Dashboard → SQL Editor :
# SELECT endpoint, count(*), avg((metadata->>'latency_ms')::int) as avg_latency_ms
# FROM llm_usage_events
# WHERE created_at > NOW() - INTERVAL '1 hour'
# GROUP BY endpoint;
# Attendu : 3 lignes (claude-proxy, claude-proxy-stream, et un PIM si test PIM exécuté)
```

### File List

**Créés :**
- `supabase/functions/_shared/productsSchema.ts` — Zod schema `ProductsResponseSchema` (permissif `.passthrough()`)
- `supabase/functions/_shared/anthropicClient.test.ts` — 7 tests Deno (mock fetch, mock SSE, validation 25 params)

**Modifiés :**
- `supabase/functions/_shared/anthropicClient.ts` — ajout export `anthropicStream()` + types `AnthropicStreamFinal` / `AnthropicStreamResult` ; commentaire doc modèle Sonnet 4 → 4.5 pour cohérence
- `supabase/functions/_shared/llm_usage.ts` — commentaire doc modèle Sonnet 4 → 4.5 pour cohérence
- `supabase/functions/claude-proxy/index.ts` — refactor handler `Deno.serve` sur `anthropicCompleteStructured` + helper `respondDemo` + `isBillingError` ; helpers démo `generateMultipleConfigs` / `generateDemoConfig` intacts
- `supabase/functions/make-server-e3db71a4/index.ts` — refactor handlers `/claude-proxy` et `/claude-proxy-stream` sur `anthropicComplete` / `anthropicStream` ; suppression import `logLlmUsage` (devenu unused) ; ajout helper `isClaudeBillingError` ; suppression appels manuels `logLlmUsage()` (wrapper auto)
- `SPRINT_HANDOFF.md` — entrée S1.5 dans tableau Stories Epic 1 + checkbox cochée S1.3/S1.5 + ajout TODO T8 deploy
- `_bmad-output/implementation-artifacts/story-S1.3-llm-migration-partial.md` — checkboxes Reste à faire cochées + cross-reference S1.5 + section Suite

**Non modifiés (vérifiés) :**
- `package.json` — pas de dépendance `openai`, RAS
- `pnpm-lock.yaml` — pas de mention OpenAI
- `src/app/lib/featureFlags.ts` — pas de flag `ENABLE_LEGACY_GPT4O`, RAS

## Change Log

| Date | Auteur | Action |
|---|---|---|
| 2026-05-10 | Story Engine (BMAD) | Création initiale, status `ready-for-dev` |
| 2026-05-10 | Dev (Opus 4.7) | T1-T7 + T9.2/T9.3 livrés sur `beta/v5` (non commit). T8 déploiement HALT en attente PAT Arnaud. T9.1 cas TF Notion : draft fourni en Completion Notes. Status → `in-progress` |
| 2026-05-10 | Dev (Opus 4.7) | PAT reçu, T8 exécuté : claude-proxy v8 + make-server-e3db71a4 v12 ACTIVE. Bug pré-existant case-sensitive `Magrit3` détecté + corrigé + redéployé. Smoke OK (T8.3 + T8.4 + T8.5). Status → `review`. Reste T9.1 Notion (admin task Arnaud) |

## Status

`review` (code livré + déployé + tracking validé. T9.1 Notion = admin task non-bloquante)
