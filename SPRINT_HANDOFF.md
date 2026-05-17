# Magrit Beta 4 / Beta 5 — Handoff entre sessions Claude code

> Document de reprise pour démarrer une nouvelle session de Claude code sur le projet sans recharger tout l'historique. À tenir à jour à chaque fin de sprint.
>
> **Dernière mise à jour : 2026-05-17 — HEAD `5325c6c` (poussé sur origin/beta/v5) — Hotfix session 2 bugs critiques B5 home Magrit : (1) persistance conv au tab focus + (2) volet édition ProductCard atelier valeurs réelles. 290 tests vitest verts (+12 vs baseline 278). Détails : section 11 ci-dessous.**

## 11. Hotfix B5 — 2026-05-17 (session unique, 2 bugs critiques home Magrit)

**Contexte** : Arnaud signale 2 régressions en utilisation réelle sur `/t/imprimerie-ipa` :
1. Recherche home Magrit perdue au tab focus (déjà fixé en B4 commit `acb7352` — apparemment regressé sur B5)
2. Volet d'édition ProductCard affiche les valeurs par défaut au lieu des valeurs du produit

### Diagnostic & fix bug 1 — Persistance conv home au tab focus

**Racine** : bug pré-existant **`ReferenceError: Can't find variable: newMessages`** dans [ChatInterface.tsx:319](src/app/components/ChatInterface.tsx#L319). Le refacto **R2 Phase B** (11/05) avait renommé `newMessages → fullMessages` ligne 165 mais oublié le `finally` ligne 319. Crash à chaque envoi → `saveCurrentConversation` jamais appelé → `currentConversationId` reste null → clé `magrit_current_conversation__<tenantId>` jamais écrite → la home n'avait rien à restaurer au tab focus.

**Fix** (commit `86e2220`) :
- `newMessages` → `fullMessages` ligne 319
- `ConversationContext` : restauration synchrone depuis le cache localStorage AVANT le reset state (évite le flash visuel entre reset et fetchRemote async)
- `ConversationContext` : nouveau `hydratedRef` qui bloque l'effet sync `history → localStorage` tant que l'hydratation initiale n'est pas finie. Sans ça, le `useState([])` initial écrasait le cache avec `"[]"` AVANT que la restauration n'ait pu lire l'ancien contenu

### Diagnostic & fix bug 2 — Volet édition ProductCard atelier

**Racine** : depuis le refacto **R1** (11/05), le bouton "Éditer" ouvre `ProductOverlay` (S2.4b), mais `localProduct` côté atelier a un format **UI/LLM** (`material`, `finishRecto/Verso` camelCase, `dimensions.{w,h}` nested, `printing` objet, `format` verbose "A2 (420 × 594 mm)") incompatible avec le contrat **Clariprint** qu'attend `extractInitialOptions` (`papers[]`, `finishing_front` snake_case, `width/height` top-level mm, `printing` string, `back_colors` number). Conséquence : 5 selects sur 7 retombaient sur `DEFAULT_OPTIONS` (A5/135g/recto/aucun).

Découvertes additionnelles via logs DevTools :
- LLM Clariprint renvoie `clariprintData.width/height` en **string CM** (ex: "42" / "59.4" pour A2 = 420 × 594 mm)
- LLM renvoie codes finition Clariprint (`PELLIC_BRILL`, `PELLIC_ACETATE_MAT`)
- A2/A1/A0 manquaient dans `FORMATS` (limité à A6 → A3)

**Fix** (commit `5325c6c`) — nouveau helper pur `extractClariprintConfigFromAtelierProduct(localProduct)` dans [ProductOverlay.helpers.ts](src/app/components/shop/ProductOverlay.helpers.ts) :
- `extractStandardFormatLabel` : reconnaît `"A2 (420 × 594 mm)"` verbose, `"A4 paysage"`, `"85x55"` → label propre matchant FORMATS du select
- `matchStandardFormat` : retro-recherche format ISO depuis width/height (tolérance ±2mm + orientation portrait/paysage)
- `isLikelyCm` : conversion cm → mm sur les strings raw uniquement (heuristique < 100), pas sur les number ou dimensions UI (déjà mm)
- `normalizeFinishingLabel` : reconnaît codes LLM `PELLIC_BRILL` / `PELLIC_ACETATE_MAT` / `SOFT_TOUCH` en plus des libellés humains
- Ajout `A2`/`A1`/`A0` à `FORMATS` + `FORMAT_DIMENSIONS`

### Tests vitest

- Baseline avant session : 278 verts
- Après session : **290 verts** (+12 cas nouveaux dont scénario réel user 2026-05-17 reproduit exactement depuis logs DevTools)

### Cahiers de tests Notion (DoD)

2 TF ajoutés dans la DB Notion 🧪 Cahiers de tests fonctionnels Magrit (à jouer en local sur B5) :
- TF "Persistance conversation home Magrit au tab focus" — P05, P0 critique
- TF "Volet édition ProductCard atelier affiche les valeurs du produit (cas A2)" — P08, P1 importante

### À surveiller pour les sprints futurs

- **Audit refacto R1/R2** : les 2 bugs viennent de migrations textuelles incomplètes lors de R1 (ProductCard) et R2 (ChatInterface). Penser à un grep exhaustif sur les renommages variables/imports au prochain refacto important.
- **Logs sentinelles temporaires** retirés avant commit (`[Conversation FIX-v2]`, `[Overlay FIX-v2]`).

---

## 10. Sprint Refacto EPIC-REFACTO-1 — Bilan 2026-05-11 (session unique)

**Contexte** : Arnaud demande un sprint refacto suite à l'audit ✦ Étape A/B/C (audit + review adversariale + plan Winston) du 11/05 matin. 9 stories spec rédigées par Winston (R0→R9). Validation Arnaud "oublie la démo, enchaîne tout" → exécution séquentielle complète en 1 session.

### Stories livrées

| Story | Spec | Statut | HEAD | Tests Δ |
|---|---|---|---|---|
| **R0** TVA centralisée + 3 garde-fous vitest | M 2j | ✅ review | `0f8d2d4` | +65 |
| **R3** ClariprintAdapter enforcement (0 fetch direct) | S 1j | ✅ review | `d8157b0` | +3 |
| **R1** ProductCard décomposition (5/5 onglets extraits) | L 4j | ✅ review | `52f35ce` | +2 |
| **S-FIX-PANIER** 5 bugs critiques boutique (LEAFLET, prix×qty, UUID, catégories, boutons) | — | ✅ | `b2fbbc5` | — |
| **R2** ChatInterface hook useClaudeSseStream + fixes E4 (billing) + E5 (troncage) | L 4j | ⚠️ partial-review | `43c324e` | +14 |
| **R4** Types DB (`database.types.ts` 1604L) + zod sélectif (4 schemas) | M 2j | ✅ review | `b1b666e` | +17 |
| **R5** Pattern Supabase unique (6 callers fetch → `functions.invoke()`) | M 3j | ⚠️ partial-review | `270ba52` | — |
| **R7** Lazy modales + bundle visualizer + Lighthouse config | S 1j | ⚠️ partial-review | `e5016a2` | — |
| **R8** Factory `createSupabaseMock` + coverage v8 + seuils baseline | M 3j | ⚠️ partial-review | `3c26864` | +15 |
| **R9** axe-core CLI + scan local + workflow CI a11y | XS 0.5j | ✅ review | `ee82fa7` | — |

### Migrations SQL prod appliquées (Supabase B5)

- `20260511_02_R0_tenant_tax_regime.sql` — Enum `tax_regime_enum` + colonne `tenants.tax_regime` default `'metropole_fr'`. 9 tenants existants migrés.
- `20260511_03_shop_order_trigger_uuid_defensive.sql` — Trigger `enqueue_pim_candidates_on_shop_order` re-écrit avec regex UUID v4 défensive. Fix bug #4d S-FIX-PANIER.

### Tooling nouveau

| Commande | Description |
|---|---|
| `pnpm test:coverage` | vitest + rapport coverage v8 HTML dans `coverage/` |
| `pnpm build:analyze` | Vite build avec rollup-plugin-visualizer → `dist/stats.html` |
| `pnpm db:types` | Régénère `src/types/database.types.ts` via Supabase Management API |
| `pnpm a11y:scan` | Scan axe-core local des 3 routes critiques |
| `pnpm dev:b5` / `:bg` / `:stop` / `:status` | Lancement Vite port 5177 (déjà existant pré-refacto) |

### Fichiers de config livrés

- `.lighthouserc.json` (config Lighthouse CI, workflow yml à créer par Arnaud)
- `.github/workflows/a11y.yml` (CI axe-core, s'active au prochain push)
- `.axe-config.json` (rules WCAG 2.1 A + AA)
- `vitest.config.ts` (section `coverage` v8 + seuils baseline 7-3%)
- `vite.config.ts` (plugin visualizer conditionnel `ANALYZE=1`, `chunkSizeWarningLimit: 600`)

### Métriques

- **Bundle main** : 250 kB gz → **245 kB gz** + 3 chunks lazy (8.15 kB gz cumulés)
- **vitest** : 162 baseline → **278 cas verts** (+116 cas R0+R2+R4+R8)
- **0 occurrence `fetch.*clariprint`** dans `src/` (R3)
- **0 occurrence `import \* as` lucide-react** (R7 AC5)

### À faire opérationnel par Arnaud (cf. agenda 2026-05-12)

1. **CI GitHub** (1h matin) : ajouter secrets repo (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_PAT`), créer `.github/workflows/lighthouse.yml`, observer 1er run a11y.yml
2. **Smoke tests visuels** (1h) : valider les 5 fixes S-FIX-PANIER (LEAFLET, prix×qty, UUID, catégories, boutons persistants) + R0/R1/R2/R3/R7 sur localhost:5177
3. **Arbitrages produit** (30min) : trancher S-ORDER-ROLES, S-PIM-VISUELS, S-SUBTENANT-SCOPE + prioriser R5-bis vs R2-bis

### Stories follow-up tracées (post-refacto)

- **R2-bis** (S 2j) — Extraction 4 sous-composants UI ChatInterface (ChatMessageList / ChatInput / ChatHistoryPanel / ChatModeToggle). Découpage UI pur, 0 fix fonctionnel.
- **R5-bis** (S 1j) — Edge function `invite-member` transactionnelle qui résout la race condition B4 (insert `tenant_invitations` + email Resend dans la même transaction edge avec rollback).
- **R8-bis** (M 2j) — Tests AuthContext / ShopsContext / hooks React via la factory `createSupabaseMock`. Cible coverage 50% globale.

---



---

## 1. Contexte projet en 30 secondes

Magrit = copilote IA web-to-print B2B français. Stack Vite 6 + React 18 + TS + Tailwind v4 + Supabase. Modèles Claude : `claude-sonnet-4-5-20250929` pour le raisonnement (upgrade depuis Sonnet 4 le 2026-05-09) / `claude-haiku-4-5-20251001` pour génération rapide (PIM, descriptifs). Moteur de devis externe : Clariprint (Expert Solutions, partenariat AGE).

**5 Betas en parallèle** :
- B1 (`Magritoff/`, port 5173, branche `main`) — prod, ne pas toucher
- B2 (`Magritoff-v2/`, port 5174, branche `design/v2`) — refonte design
- B3 (`Magritoff-v3/`, port 5175, branche `beta/v3`) — multi-tenant, **projet Supabase mort** (`azbpnhnfnkdemfmwvyqc` n'existe plus)
- **B4 (`Magritoff-v4/`, port 5176, branche `beta/v4`)** — Sprint 1 + Sprint 2 livrés + hotfix S0.1 Fiche regression (2026-05-09). Cible démo client 2026-05-23.
- **B5 (`/Users/arnaudmazon/Documents/Claude/BMAD/Magrit`, port 5177, branche `beta/v5`)** — itération **e-shop v1.1**, sprint Epic 1 partiel livré 2026-05-09

## 2. Infrastructure B4

| Item | Valeur |
|---|---|
| Repo Git | https://github.com/amazon-svg/Magritoff |
| Branche active | `beta/v4` |
| Dossier local | `/Users/arnaudmazon/Documents/AGE/Projet formateur /Claude code/Magritoff-v4/` |
| Port dev | `5176` (lancement : `pnpm dev`) |
| Projet Supabase | `ightkxebexuzfjdbpsdg` (Magrit 4) |
| Dashboard Supabase | https://supabase.com/dashboard/project/ightkxebexuzfjdbpsdg |
| Secrets configurés | `Magrit3` (Anthropic), `CLARIPRINT_HOST/LOGIN/PASSWORD`, `SUPABASE_*` (auto) |
| Edge functions déployées | `make-server-e3db71a4`, `claude-proxy`, `pim-generate`, `pim-ingest` |
| Backlog Notion | https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd |

## 3. Stories livrées Sprint 1 (Claude code)

Toutes pushées sur `beta/v4`, edge function déployée, SQL appliqué.

| ID | Story | État |
|---|---|---|
| E9.1 | Renommer onglet Clients → Utilisateurs | ✅ |
| E9.2 | CRUD utilisateurs par admin d'espace + audit trail | ✅ |
| E9.3 | Droits granulaires (scope `magrit_full` / `shop_only` + permissions fines) | ✅ |
| E9.4 | Renommer un espace actif (admin + superadmin) + redirect 90j ancien slug | ✅ |
| E6.1 | Validation SIREN bouchonnée + email pro check (débrayés en beta) | ✅ |
| E7.1 | Tracking consommation tokens LLM (table `llm_usage_events` + RPC) | ✅ |
| E2.1 + E2.2 + E2.4 | Modes Marguerite (ouvert / strict avec chips cliquables / limite 25 contexte) | ✅ |

## 3 bis. Stories livrées Sprint 2 (Claude code, 2026-05-06)

| ID | Story | État | Notes |
|---|---|---|---|
| E9.5 | Email invitations via Resend + bouton « Renvoyer » | ✅ | Route edge `send-invitation-email`. `RESEND_API_KEY` configuré côté Supabase B4. **Mode test** : envoi limité à `amazon@ageservices.fr` tant qu'un domaine n'est pas vérifié sur Resend. Domaine prod à choisir + DNS Gandi à venir |
| E9.11 | Bouton « Réintégrer » sur exclusions boutique (one-way → two-way) | ✅ | Liste des exclusions cliquable dans l'éditeur boutique, `includeProduct()` déjà côté ShopsContext |
| E9.12 | Migration `claude-3-haiku` → `claude-haiku-4-5` sur B1/B2 | ✅ | Déployé sur projet partagé `jynxrpzwgzrrfuooputw` |
| E9.10 | Tests RLS automatisés vitest (6 cas) | ✅ | Harness `tests/rls/setup.ts` + `tenant_isolation.test.ts`. Skip auto si `.env.test` absent. Voir `tests/README.md` |
| E3.1 + E3.2 | Streaming Claude SSE | ✅ | Route séparée `claude-proxy-stream`. Flag `ENABLE_STREAMING_CHAT` **passé à `true`** (commit `fa44682`) après QA réussi |
| E7.7 | Instrumentation `data-testid` P00→P09 | ✅ | Mergé via PR #1 (commit `c344ce0`). `src/app/lib/testIds.ts` central + smoke test `tests/data-testid.smoke.spec.ts` (21 tests). Référence Notion : [🧬 Hints DOM par parcours](https://www.notion.so/358d0131973c810e93c2c5285099b8a4) |
| E9.6 | Wizard souscription gammes à création tenant | ✅ | TenantOnboarding refondu en 2 étapes (Identité + Gammes). createTenant accepte `gammeSlugs[]` qui déclenche un upsert bulk dans `tenant_gamme_subscriptions`. Bouton « Configurer plus tard » pour skip |

### Fixes post-Sprint 2 (sur `beta/v4` direct)

| Commit | Story | Notes |
|---|---|---|
| `7881bcb` | Superadmin Magrit bypasse les guards `canWrite`/`canManage` | Régression de E9.3 généralisée à 4 composants (DashboardUsers, DashboardLayout, DashboardTenantGammes, DashboardTenantSpaces). Détectée en testant E9.5 sur `a.mazon@me.com` membre simple sur `imprimerie-ipa` mais superadmin Magrit |
| `acb7352` | Persistance conversation Marguerite à travers tab focus | `onAuthStateChange` Supabase fire à chaque tab focus → ref `user` change → reset `messages/products`. Fix : nouvelle clé localStorage `magrit_current_conversation__<tenant_id>` + capture avant reset + restauration depuis l'historique. Survit aussi au F5 et close/reopen tab |

## 3 ter. Sprint 3 — Itération e-shop v1.1 (BMAD workflow, 2026-05-09)

**Workflow BMAD complet (3 500+ lignes) sur `beta/v5`** — PRD + Architecture + Epics & Stories + Implementation Readiness produits via les agents BMAD (John PM, Winston Architect). Voir [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/).

### Infrastructure B5

| Item | Valeur |
|---|---|
| Repo Git | https://github.com/amazon-svg/Magritoff (même repo que B4) |
| Branche active | `beta/v5` (forkée de `a32ac65` sur `beta/v4`) |
| Dossier local | `/Users/arnaudmazon/Documents/Claude/BMAD/Magrit/` |
| Port dev | `5177` (lancement : `pnpm exec vite --port 5177 --strictPort`) |
| Projet Supabase | `ightkxebexuzfjdbpsdg` (Magrit 4) — partagé avec B4, RLS isole |
| Edge functions déployées | 2026-05-09 : `make-server-e3db71a4` v?, `pim-generate`, `pim-ingest` (S1.3 partial). 2026-05-10 : redeploy `claude-proxy` v8 + `make-server-e3db71a4` v12 (S1.5 + fix `Magrit3` case-sensitive) |
| Modèle LLM | `claude-sonnet-4-5-20250929` (raisonnement) + `claude-haiku-4-5-20251001` (génération rapide) |

### Stories pré-sprint Epic 0 livrées

| Story | Commit | Description |
|---|---|---|
| **S0.1** Hotfix régression Fiche home Magrit | `f925eba` (sur `beta/v4`) | Fallback UI explicite + logging PIM context. Cible démo client 2026-05-23 |
| **S0.2** Investigation provenance des prix (E-NEW-CLARIPRINT-01) | `c929371` (sur `beta/v5`) | Audit complet → `docs/PRICE_SOURCES.md`. Identifié `PricingPanel.tsx:26` comme outlier "2e prix mystère". Pas d'hallucination LLM. Fixes appliqués |
| Fixes S0.2 (C1+C2+C3+E1) | `c929371` | (a) `validateClariprintResponse()` filtre prix négatifs/NaN/undefined. (b) endpoint `clariprint-quote` valide avant retour (-1,2 € bloqué côté serveur). (c) `PricingPanel` utilise `resolvePrice()` + badge « Estimation » sur fallback. (d) Helper unique `priceResolver.ts` |

### Stories Epic 1 — Stack Foundations (partiel, 2026-05-09)

| Story | Commit | Description |
|---|---|---|
| **S1.1** Wrapper `AnthropicClient` | `6f1aa84` | `supabase/functions/_shared/anthropicClient.ts` — `complete()` + `completeStructured(zodSchema)` + tracking auto `llm_usage_events` + limite 25 paramètres anti-hallucination + erreurs typées `AnthropicClientError` |
| **S1.2** `ClariprintAdapter` pattern | `632db88` | `src/server/clariprint/ClariprintAdapter.ts` — interface + `ClariprintHttpAdapter` (prod) + `ClariprintMockAdapter` (tests) + `ClariprintError` discriminée par `kind` |
| **S1.4** Order entity DB schema + RLS + tests vitest | `1a29481` + `9d70e58` (rename) | Migration `20260509_01_e1_orders_v1_1.sql` — 3 tables `tenant_orders` / `tenant_order_items` / `tenant_order_status_events` (préfixe `tenant_*` pour éviter collision avec legacy `public.orders`). RPC `update_tenant_order_status()` + trigger updated_at. RLS strict via helpers `current_user_can_access_shop` + `user_role_in_tenant`. 6 tests vitest dans `tests/rls/orders_isolation.test.ts` |
| **S1.3** partiel — refactor endpoints | `555574a` (pim-generate) + `df47dc3` (pim-ingest + Sonnet 4 → 4.5) | 2/4 endpoints utilisent maintenant le wrapper. `claude-proxy/index.ts` + `make-server-e3db71a4/claude-proxy*` finalisés en S1.5 |
| **S1.5** suite S1.3 — finalisation refactor LLM (2026-05-10, déployé) | (à committer) | (a) Schema Zod `_shared/productsSchema.ts`. (b) `claude-proxy/index.ts` standalone refactoré sur `anthropicCompleteStructured`. (c) Wrapper étendu : `anthropicStream()` avec parser SSE + tracking auto. (d) `make-server-e3db71a4/claude-proxy` + `claude-proxy-stream` refactorés sur wrapper, `logLlmUsage` manuel supprimé. (e) Tests Deno `_shared/anthropicClient.test.ts` (7 cas). (f) **Bug pré-existant S1.1 corrigé** : `Magrit3` case-sensitive (était `MAGRIT3` upper, secret réel mixed case → wrapper tombait silencieusement en `missing_api_key`). Bénéficie aussi à pim-generate/pim-ingest. (g) **Déviation spec assumée** : `anthropicStream` retourne `{textChunks: AsyncIterable<string>, finalPromise}` au lieu de `{stream: ReadableStream}` brut pour préserver contrat client SSE Hono. Déploiement validé : claude-proxy v8 + make-server-e3db71a4 v12 ACTIVE, smoke cURL OK, tracking `llm_usage_events` confirmé via SQL |

### Migration appliquée 2026-05-09

✅ `supabase/migrations/20260509_01_e1_orders_v1_1.sql` appliquée via Dashboard SQL Editor (Supabase CLI `db push` échouait sur historique migrations désynchronisé). Tables `tenant_orders`, `tenant_order_items`, `tenant_order_status_events` créées en prod avec RLS actif.

### Edge functions redéployées 2026-05-09

✅ `pim-generate`, `pim-ingest`, `make-server-e3db71a4` sur `ightkxebexuzfjdbpsdg`. Sonnet 4.5 actif, wrapper `_shared/anthropicClient.ts` actif sur les 2 endpoints PIM.

### Reste à faire pour Epic 1 complet

- [x] **S1.3 / S1.5** — Refactor `claude-proxy/index.ts` + `make-server-e3db71a4/claude-proxy` + `claude-proxy-stream` sur wrapper (S1.5 livré + déployé 2026-05-10).
- [ ] **R1** (Implementation Readiness) — Ajouter event analytics `first_action_after_landing` à S2.1 (instrument NFR1+NFR3).
- [ ] **R2** — Wireframes lo-fi des composants Epic 2.
- [ ] **S1.5 T9.1 (Notion TF)** — Ajouter cas TF "Refactor wrapper LLM — non-régression chat strict streaming" dans la DB Notion 🧪 Cahiers de tests (draft fourni dans story-S1.5 Completion Notes).

### Stories Epic 4 — Mockup Engine (chemin critique R3, démarré 2026-05-10)

| Story | Commit | Description |
|---|---|---|
| **S4.1a** Bucket Storage `product_mockups` + RLS + tests | `e9d4124` | Migration `20260510_01_e4_storage_product_mockups.sql` — bucket public-read avec MIME `image/png` strict + 5 MB max + policy RLS `product_mockups_public_read`. Tests vitest `tests/storage/product_mockups_isolation.test.ts` (4 cas : upload service_role, GET public round-trip, upload anon BLOCKED, cleanup). Migration appliquée via `supabase db query --linked --file` (fallback du `db push` à cause de l'historique désynchronisé, même problème S1.4). 37/37 vitest passed. **Bonus** : fix bug pré-existant S1.4 `owner_user_id` manquant dans `tests/rls/orders_isolation.test.ts` (les 6 cas RLS Order entity tournent désormais réellement avec `.env.test`). |
| **S4.1b** Pipeline rendu SVG → PNG + 1er template flyer | `1bc3071` | Module `supabase/functions/_shared/mockup/` (types + renderer + 1 template + 5 tests Deno). **Pivot technique majeur vs Architecture §4.3** : `sharp + svgdom` (Node native) abandonnés (incompat Deno Deploy). Pivot `npm:@resvg/resvg-wasm@2.6.2` (pure WASM, fonts Inter/Bitter/JetBrains incluses). Init WASM lazy via fetch unpkg. Snapshot SVG versionné. Tests Deno 5/5 (975ms). Perf render warm 183ms. |
| **S4.1c** Edge Function `mockup-generator` + cache write-through + invalidation | (à committer) | Edge function déployée sur `ightkxebexuzfjdbpsdg`. 2 endpoints : `GET ?tenant=X&shop=Y&product=Z&width=...&height=...&productName=...&primaryColor=...` (cache HEAD HIT 302 / MISS render+upload), `POST /invalidate?shop=Y` (admin tenant only via JWT + tenant_members role check). **Trade-off MVP** : specs en query params (pas de port ClariprintAdapter Deno, story future). Fallback `render_failed` → re-render gris minimal + log `llm_usage_events` endpoint=mockup-generator-fallback. 8 tests Deno passants. Smoke prod : MISS cold 2.5s, HIT warm 343-426ms (≤NFR2 50ms atteinte browser via CDN cache 24h). Vitest 37/37 (0 régression). |
| **S4.2** 5 templates SVG MVP (flyer, carte de visite, brochure, étiquette, kakémono) | (à venir) | Peut être fait en parallèle de S2.3, étend `mockup/templates/` |
| **S4.3** Composant React `MockupImage` avec fallback graceful | (à committer) | `src/app/components/mockup/MockupImage.tsx` (composant) + `MockupImage.helpers.ts` (helpers d'URL pure pour testabilité) + 7 tests vitest. Pattern : URL publique CDN direct sur `<img>` (cache HIT < 50ms NFR2), `onError` → fetch edge function S4.1c avec auth + cache buster pour retry, fallback ultime `<ProductMockup>` SVG schematic. Anti-loop via `useRef`. Skeleton `bg-line animate-pulse` Tailwind. testIds.ts étendu avec scope `mockup` (4 ids). Vite build OK 1.53s, vitest 44/44 (0 régression). |

**🎯 Epic 4 chemin critique R3 : 4/4 livrées (S4.1a + S4.1b + S4.1c + S4.3)** — S2.3 ProductCard variante boutique **DÉBLOQUÉ** pour démarrage Epic 2 (Boutique Premium B2B).

### Documents BMAD livrés (3 500+ lignes)

| Document | Lignes | Rôle |
|---|---|---|
| [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md) | 1 079 | PRD v1.1, 46 FR + 28 NFR |
| [`_bmad-output/planning-artifacts/architecture.md`](_bmad-output/planning-artifacts/architecture.md) | ~835 | Architecture v1.1, 15 ADR (note rename `tenant_*` §4.1) |
| [`_bmad-output/planning-artifacts/epics.md`](_bmad-output/planning-artifacts/epics.md) | ~1 075 | 7 epics, 32 stories sprint-ready |
| [`_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-09.md`](_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-09.md) | 294 | Rapport readiness GO + 7 warnings |
| [`docs/PRICE_SOURCES.md`](docs/PRICE_SOURCES.md) | ~200 | Livrable S0.2 audit prix |

### Prochaines étapes recommandées

1. **Tester en local** sur ports 5176 (B4 hotfix Fiche) et 5177 (B5 sanitization Clariprint + PricingPanel).
2. **Démarrer Epic 4 — Mockup Engine** en priorité (R3 Implementation Readiness : S4.1a/b/c → S4.2 → S4.3 doivent précéder S2.3 ProductCard).
3. **En parallèle Epic 4** : Epic 3 (Order entity user-facing) et Epic 6 (quotas/feature flags).
4. **Epic 2 (Boutique B2B premium)** une fois Epic 4 ≥ S4.3 livré.

## 4. Stories reportées (dépendent de Clariprint)

Décision Arnaud 2026-05-06 : ces stories nécessitent d'abord du travail Clariprint (paramétrage parc imprimeur, prix marché, observabilité Clariprint). On y revient après le bloc Clariprint.

| ID | Story | Pourquoi |
|---|---|---|
| E3.4 | UX simplifiée saisie données imprimeur Freemium | Recoupe E6.2 et T-06.1, à faire en bloc |
| E6.2 | Saisie simplifiée Pro | Couplée avec T-06.1 paramétrage parc |
| E7.3 | Monitoring usage / quotas / coûts (dashboard ops) | Sprint dédié observabilité |
| T-01..T-03 | Corporate Portal / Franchise / Sync eCommerce | Chantiers ≥ 1 sprint chacun |

## 5. Feature flags actifs en beta

Fichier : `src/app/lib/featureFlags.ts`

| Flag | Beta | Prod | Notes |
|---|---|---|---|
| `REQUIRE_PRO_EMAIL` | `false` | `true` | E6.1 |
| `REQUIRE_VERIFIED_SIREN` | `false` | `true` | E6.1 |
| `ENABLE_STREAMING_CHAT` | **`true`** | `true` | E3.1+E3.2 — passé à `true` 2026-05-06 après QA |

Le mock SIREN INSEE est dans `src/app/lib/sirenValidator.ts`. Le bloc `mockInseeLookup` à remplacer par un vrai `fetch` quand le compte INSEE Sirene V3 sera créé (commentaire en place dans le fichier).

## 6. Modèle de données B4 (multi-tenant)

Tables clés ajoutées en Sprint 1 (Sprint 2 = aucune migration DB) :
- `tenant_member_events` — audit trail des actions sur memberships
- `tenant_slug_history` — archivage des renames de slug (E9.4)
- `llm_usage_events` — tracking des appels Claude (E7.1)
- Colonnes ajoutées sur `tenant_members` : `access_scope`, `allowed_shop_ids`, `permissions` (E9.3)
- Colonnes ajoutées sur `tenant_invitations` : idem (E9.3)
- Colonnes ajoutées sur `tenants` : `siren`, `siren_data`, `verified`, `verified_at` (E6.1)

RPC publics ajoutés :
- `get_tenant_members_with_email(tenant_id)` — joint auth.users
- `current_user_can_access_shop(shop_id)` — helper RLS
- `get_user_llm_usage(user_id, period_start?, period_end?)`
- `get_tenant_llm_usage(tenant_id, period_start?, period_end?)`
- `resolve_tenant_slug(old_slug)` — pour redirect 90j

Bootstrap complet d'un nouveau projet : exécuter `Magritoff-v4/supabase/_bootstrap_b4.sql` (regroupe toutes les migrations).

## 7. Sprint 3 — Plan proposé

Périmètre Sprint 2 livré (E9.5, E9.10, E9.11, E9.12, E3.1+E3.2). À arbitrer début Sprint 3 :

### Multi-tenant & gouvernance (résiduel E9)
- **E9.6** Wizard souscription gammes à la création tenant

### Foundations Pro
- **E3.4** UX saisie imprimeur Freemium (recoupe E6.2 + T-06.1)
- **E6.2** Saisie simplifiée Pro
- **E7.3** Monitoring usage / quotas / coûts (dashboard ops)

### eCommerce + Corporate (gros chantiers, ≥ 1 sprint chacun)
- **T-01** Corporate Portal
- **T-02** Franchise Module
- **T-03** Sync eCommerce Shopify/Woo
- **T-06.1, T-06.2** Paramétrage parc machines + Prix marché Magrit

→ Sprint 3 recommandé : E9.6 + E6.2 + E7.3 (cohérent Foundations Pro), reporter T-01..T-03 à des sprints dédiés.

## 8. Workflow git Magrit

D'après les préférences du user :
- Commits atomiques (un commit = une story / un fix)
- **Confirmation avant push** systématique (sauf accord blanket sur le sprint)
- Heredoc git commit OK, mais éviter les apostrophes dans les messages (préférer `"d'autres"` → `"d autres"` ou paraphraser)
- Format messages : `feat|fix|chore(v4): description courte` puis paragraphe optionnel

## 9. Bugs / fragilités connus à surveiller

- **Onglet Boutiques masqué** pour le plan `freemium` — c'est le comportement legacy B3, à reconsidérer avec E9.8 (Billing Stripe). Workaround : `update user_preferences set plan='pro' where user_id=...`
- **Edge function** : nécessite redéploiement après chaque modif côté `supabase/functions/*`. Commande : `supabase functions deploy make-server-e3db71a4 --project-ref ightkxebexuzfjdbpsdg` (avec PAT temporaire)
- **Pas d'override superadmin** sur certains guards futurs — penser à toujours ajouter le check `isSuperAdmin` quand on bloque un user sur un scope (cf. E9.3 où le bug a été corrigé après coup)
- **E9.5 Resend** : pour activer l'envoi email, configurer `RESEND_API_KEY` (et optionnellement `MAGRIT_FROM_EMAIL`, ex `Magrit <noreply@magrit.fr>`) dans les secrets Supabase B4. Sans clé, le flux retombe automatiquement sur l'ancien `prompt()` avec lien manuel (no-op fonctionnel). Domaine `from` doit être vérifié sur Resend, sinon utiliser le `onboarding@resend.dev` par défaut (limite : envoi uniquement vers le compte Resend).
- **E9.12 / B1+B2 partagés** : Magritoff/ et Magritoff-v2/ partagent le projet Supabase `jynxrpzwgzrrfuooputw` — il suffit de déployer la fonction depuis l'un des deux pour mettre à jour les deux betas (la dernière `supabase functions deploy` gagne).
- **E3.1 Streaming** : la route `/claude-proxy-stream` parse le JSON Claude APRÈS le stream complet (pas de progressive parsing JSON pour l'instant). L'indicateur live se contente d'un compteur de chunks. Pour du progressive content rendering true (cards qui se construisent), il faudra un Sprint 3 dédié avec parsing JSON incrémental.

## 10. Identifiants & accès

- **User principal** : `a.mazon@me.com` (Arnaud)
  - Membre direct des tenants : `imprimerie-ipa`, `Boutique 1`
  - Superadmin Magrit : oui (membre `magrit-root` via `bootstrap_magrit_admin`)
- **PAT Supabase** : à régénérer à chaque session (l'ancien est révoqué). Procédure : https://supabase.com/dashboard/account/tokens

## 11. Pour démarrer la prochaine session

Première message à coller à Claude pour le briefer :

```
Je reprends le projet Magrit B4. Lis le handoff dans 
Magritoff-v4/SPRINT_HANDOFF.md pour avoir le contexte.

Aujourd'hui je veux travailler sur : [story / fonctionnalité]
```

Claude doit alors :
1. Lire ce fichier (`Read` tool)
2. Lire ses mémoires `project_magrit.md` et `reference_magrit_infra.md` (qui peuvent être à mettre à jour)
3. Vérifier l'état git du repo (`git status`, `git log --oneline -5`)
4. Demander un nouveau PAT Supabase si déploiement edge function nécessaire
