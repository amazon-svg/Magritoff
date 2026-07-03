---
title: Plan refacto Magrit beta/v5 — Étape D Winston Architect
date: 2026-05-11
author: Winston (Architect) — Magrit
inputs:
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md
  - _bmad-output/planning-artifacts/architecture.md (15 ADR existants)
  - _bmad-output/planning-artifacts/prd.md
  - docs/project-context.md
  - SPRINT_HANDOFF.md (HEAD 5a2e848, v0.5.3-beta.5)
  - mémoires BMAD feedback_* (4 règles dures Arnaud)
target_branch: beta/v5
execution_window: post-démo (>= 2026-05-23)
---

# Plan refacto Magrit — Étape D Winston Architect

> **Mission.** Convertir les 8 priorités P0 confirmées en review adversariale (A→H) en 8 ADR formalisés (ADR-R1 à ADR-R8), un graphe de stories R0-R8 séquencé, une matrice impact/effort révisée, un registre de risques + atténuations, et une synthèse claire de ce qu'Arnaud doit trancher.
>
> **Posture Winston.** Trancher quand la décision est technique. Ne pas trancher quand elle est métier / scope / budget — la signaler comme telle avec une recommandation chiffrée. Respect strict de l'architecture v1.1 existante : ce plan **étend** les 15 ADR existants, il n'en révoque aucun.

---

## 1. Section exécutive (TL;DR Arnaud)

| # | À retenir |
|---|---|
| 1 | **8 ADR produits.** 6 tranchés par Winston, 2 à arbitrer par Arnaud (ADR-R1 tenant_orders V1 ou V1.1, ADR-R7 portée a11y+i18n). |
| 2 | **9 stories R0→R8 séquencées en 3 sprints post-démo** (≈ 27 jours-Claude au total). R0 = spikes garde-fous obligatoire avant tout refacto. |
| 3 | **Reclassements adoptés** : F (ClariprintAdapter) P0, G (PIM Fiche) P0 satellite A, H (TVA configurable) P0 spike conformité fiscale. |
| 4 | **Anti-pattern bloqué** : aucune création d'onglet/composant hors backlog. Tout refacto enrichit l'existant (règle dure Arnaud). |
| 5 | **Garde-fou tests obligatoire en R0** : `priceResolver`, `ClariprintAdapter`, `CartContext` doivent gagner un harness vitest **avant** toute décomposition d'un gros composant. Sinon = risque régression silencieuse maximal. |
| 6 | **Décision tenant_orders à prendre en démo-debrief** : sans ADR-R1 tranchée, R6 est non-actionnable et bloque toute valeur de S1.4 livrée morte-née. |

---

## 2. ADR formalisés (ADR-R1 à ADR-R8)

> Convention : Statut = « Décidé Winston » (Winston a tranché en autonomie technique) OU « À arbitrer Arnaud » (décision binaire métier/budget/scope V1 vs V1.1, hors mandat Architect). Code ADR aligné avec la review adversariale §4.2.

---

### ADR-R1 — Périmètre `tenant_orders` : V1 blocker ou V1.1 deferred ?

**Contexte.**
S1.4 a livré 3 tables (`tenant_orders` / `tenant_order_items` / `tenant_order_status_events`) + RLS + tests vitest + RPC (migration `20260509_01_e1_orders_v1_1.sql`). Mais **aucun front ne consomme** : `PublicShop.tsx:272` continue à insérer dans `shop_orders` legacy. Architecture.md §6.3 demande 5 composants UI + 1 hook + 1 edge function pour Order entity complète. Coût restant ≈ L (8-12 j).

**Décision recommandée.**
**Option B — V1.1 deferred** : conserver `shop_orders` comme source primaire pendant le sprint refacto post-démo. Brancher front sur `tenant_orders` dans un sprint V1.1 dédié post-refacto, une fois R1+R2+R4+R5 stabilisés. Ne **pas** révoquer la migration livrée — schéma prêt, RLS testée.

**Alternatives considérées.**
- **Option A — V1 blocker** : développer les 5 composants UI dans la fenêtre refacto (L, 8-12 j). Capture l'investissement S1.4 mais retarde le ROI des refactos structurels A/B/D/E qui débloquent toutes les stories futures.
- **Option C — revert migration** : refusé, sacrifie un investissement déjà payé (RLS + tests + RPC) et oblige à re-créer en V2.

**Conséquences.**
- `shop_orders` reste primaire 2-3 sprints. Pas de Order entity premium.
- Garde-fou `tests/rls/orders_isolation.test.ts` (S1.4 vert) conservé pour quand le front se branche.
- Dette `shop_orders ↔ tenant_orders` tracée comme technical debt assumée dans SPRINT_HANDOFF.md (NFR16 e-invoicing bloqué tant que V1.1 deferred non livré).

**Statut.** ✅ **Décidé Arnaud 2026-05-11** : **Option B — V1.1 deferred**. R6 OUT du sprint refacto, conservation `shop_orders` legacy, S1.4 reste investissement valide pour V1.1 dédié post-refacto.

---

### ADR-R2 — Stratégie typing cross-couche

**Contexte.**
Audit §7.2 : pas de `database.types.ts` côté front. Types DB ré-écrits manuellement dans 14 callers `from()` + 8 fetch direct edge. `CartContext.tsx:5` typé `product: any`. `ShopProduct` ne reflète pas `tenant_id` ajouté par migration `20260424_02_tenant_id_on_data.sql`. Tout changement schéma = 5-15 corrections front non détectées TS.

**Décision recommandée.**
`database.types.ts` généré via `supabase gen types typescript --project-id ightkxebexuzfjdbpsdg` + couche zod dérivée **sélective** pour les chemins critiques (Cart, Order, Clariprint payloads, PIM definitions). Script `pnpm db:types` committé. Type `Tables<'tenant_orders'>` consommé partout.

**Alternatives considérées.**
- **Zod backend-only** (types front manuels alignés) : perpétue la dérive identifiée audit §7. Refusé.
- **TypeORM / Prisma typing** : surenchère, viole boring technology (architecture.md §2.3). Refusé.

**Conséquences.**
- Coût initial ≈ 0,5 j. Récurrent : `pnpm db:types` post-migration (à documenter dans SPRINT_HANDOFF.md).
- Régressions silencieuses bloquées à la compilation TS.
- Tradeoff zod sélectif : on évite l'enflure schemas zod systématique. On valide où ça paye (NFR11 Clariprint, Cart, Order V1.1).

**Statut.** **Décidé Winston.** R4 implémente.

---

### ADR-R3 — Pattern d'accès Supabase unique

**Contexte.**
Audit §7 + §2 : 3 patterns mélangés — 14 callers `from()` direct (RLS only), 8 `fetch('/functions/v1/...')` URL hardcodée (pas d'auth header auto), 0 `supabase.functions.invoke()`. Race concrète `DashboardUsers.tsx:204` (insert tenant_invitations) + fetch séparé `send-invitation-email` = invitation DB sans email.

**Décision recommandée.**
Pattern dual unifié :
1. **Reads RLS-protected** → `from()` direct typé via `database.types.ts` (ADR-R2). Conservé.
2. **Writes / mutations / appels edge** → `supabase.functions.invoke('<name>', { body })` exclusivement. Auth header auto, gestion erreur unifiée, URL non hardcodée, testabilité (R8). Les 8 `fetch` direct migrent. Inserts critiques transactionnels (invitations, orders) extraits en edge functions.

**Alternatives considérées.**
- **Tout en `functions.invoke()` (y compris reads)** : refusé, overhead réseau injustifié.
- **Tout en `from()` direct** : refusé, race conditions multi-step impossibles à garantir client-side.
- **HTTP client custom (axios, openapi-fetch)** : refusé, boring technology.

**Conséquences.**
- Race invitations résolue via edge function `invite-member` transactionnelle.
- Aligne avec ClariprintAdapter §4.4 ("interaction critique = edge function").
- Mock `functions.invoke` simple via ADR-R5.

**Statut.** **Décidé Winston.** R5 implémente. Pré-requis ADR-R2.

---

### ADR-R4 — Décomposition gros composants (ProductCard, ChatInterface)

**Contexte.**
ProductCard.tsx 1281 lignes (5 onglets Fiche/Prix/3D/Éditer/Debug + 9 concerns). ChatInterface.tsx 1066 lignes (8+ concerns, SSE inline, dual source messages). 0 useCallback/useMemo/useEffect dans ProductCard. State duplication (`localProduct = useState(product)`). Impossible d'ajouter un onglet ou un mode sans risque régression.

**Décision recommandée.**
Stratégie **onglet-by-onglet** (extraction par responsabilité, pas compound components).

**ProductCard** (les 5 onglets **restent** — règle dure `feedback_no_invent_hors_backlog.md`) :
1. `ProductCard.tsx` devient un shell (props, tabs orchestration, state minimal).
2. Extraire les 5 onglets co-localisés : `ProductCardFicheTab.tsx` (intègre G PIM enrichissement), `ProductCardPrixTab.tsx`, `ProductCardMockupTab.tsx`, `ProductCardEditerTab.tsx` (purger form inline résiduel, déléguer à ProductOverlay), `ProductCardDebugTab.tsx`.
3. Extraire hook `useClariprintProduct(productId)` (AbortController inclus = bug B5).
4. Co-localiser `ProductCard.helpers.ts` testé (modèle `ProductOverlay.helpers.ts` 243 L test).

**ChatInterface** :
1. Extraire `readClaudeSseStream` dans `src/app/lib/sse.ts`.
2. Hook `useChatConversation()` qui **résout la dual source** : `conversation.messages` = source unique, state local supprimé (B6).
3. Shell ChatInterface = orchestrateur.
4. Troncage 25 messages dans le hook (E5).
5. Surfacer `billing_error` comme banner explicite (E4, fini le catch silencieux).

**Alternatives considérées.**
- **Compound Components** (`<ProductCard.Tabs>...`) : refusé, ProductCard a un seul caller atelier, pas de gain réutilisabilité, coût migration élevé.
- **React Query / SWR** : refusé, surenchère, viole boring technology.
- **Skip refacto** : refusé, règle dure `feedback_pim_marketing_card.md` impose enrichir Fiche avec 9 champs PIM dans 1281 L = risque maximal.

**Conséquences.**
- 5 nouveaux fichiers ProductCard*, 2 Chat*. ProductCard shell ≈ 250 L, ChatInterface ≈ 300 L.
- Harness `ProductCard.helpers.test.ts` + `ChatInterface.helpers.test.ts` obligatoires.
- 0 rupture API (props identiques). testIds migrent avec les sous-composants.

**Statut.** **Décidé Winston.** R1 et R2. Pré-requis : R0 (garde-fous + Spike B2 modal + Spike H TVA).

---

### ADR-R5 — Stratégie tests Supabase

**Contexte.**
Audit §6.3 + review M2 : 0 mocking sur les 14 + 8 callers Supabase. Logique métier (submitCart, library ops, devis) non testable en isolation. Zones froides critiques (`priceResolver`, `ClariprintAdapter`, `CartContext`) = précisément les chemins où une régression coûte le plus.

**Décision recommandée.**
Factory mock typée `createSupabaseMock()` dans `tests/helpers/supabaseMock.ts` (pas MSW). Client mock avec `.from(...).select/.insert/.update/.delete` chainables, `.functions.invoke()` et `.auth.getUser()` mockés. Typage via `database.types.ts` (ADR-R2). Pattern d'injection DI léger : composants/hooks acceptent un client optionnel, default = client global, test = injection mock. Conserver `tests/rls/setup.ts` existant pour intégration RLS réelle.

**Alternatives considérées.**
- **MSW HTTP interceptor** : refusé, surface PostgREST (50+ endpoints dynamiques) trop coûteuse à entretenir.
- **supabase-js mock npm package** : pas de mainstream stable au 2026-05. Refusé.
- **Tests intégration only (Supabase local)** : trop lent pour TDD composants. Complément seulement.

**Conséquences.**
- Coût initial ≈ 1 j. R0 écrit les garde-fous priceResolver/ClariprintAdapter/CartContext **avant** R1/R2.
- Limite assumée : RLS non testée via mock (gardé pour `tests/rls/`).

**Statut.** **Décidé Winston.** R0 (mock minimal) puis R8 (généralisation).

---

### ADR-R6 — TVA configurable (conformité fiscale DGFIP)

**Contexte.**
Bug review B1 : TVA 20% hardcodée 5+ fois (`ProductCard.tsx:786`, `QuoteModal.tsx:173`, `CartButton.tsx:112`, `PublicShop.tsx:257`, `CartContext.tsx:52`). Risque conformité DGFIP : DOM-TOM 5,5%, export 0%, auto-entrepreneur 0% impossibles à servir. `tenant.location` stocké en onboarding mais **jamais utilisé pour la TVA**. NFR16 e-invoicing PA/PPF bloqué.

**Décision recommandée.**
Migration `tenant.tax_regime` (enum `fr_metropole | fr_dom_tom | fr_autoentrepreneur | eu_export | world_export`, défaut `fr_metropole`) + helper centralisé `src/app/utils/tax.ts` exposant `getVatRate(regime)` et `computeVAT(ht, regime)`. Les 5 callers `* 1.20` / `* 0.20` migrent vers `computeVAT(ht, tenant.tax_regime)`. Sélecteur regime fiscal ajouté au TenantOnboarding wizard et écran settings.

**Alternatives considérées.**
- **TVA stockée par produit** : refusé. La TVA dépend du **vendeur** (tenant), pas du produit en B2B print standard. Exceptions = override V2+.
- **TVA en feature flag** : refusé. Conformité, pas feature.
- **Statu quo + ADR « v1 fr_metropole seulement »** : refusé. Risque DGFIP + bloque DOM-TOM dès le 1er client outre-mer.

**Conséquences.**
- Code : 1 migration, 1 helper, 5 callers migrés, 1 sélecteur UI.
- Tests : `tax.test.ts` unitaire (5 régimes × 3 valeurs HT).
- Bénéfice : conformité DGFIP + ouverture DOM-TOM/export + préparation NFR16.

**Statut.** **Décidé Winston.** R0 implémente comme spike (1 j).

---

### ADR-R7 — Roadmap a11y + i18n

**Contexte.**
Review M3 : i18n inexistant mais `locale='en'` stocké en DB (TF-65). Labels FR en dur partout. a11y non audité. PRD ne mentionne pas WCAG. Persona primaire imprimeur Pro **français** (démo 2026-05-23). Persona tertiaire W2P pure player peut demander EN à terme.

**Décision recommandée.**
i18n V2 confirmé (pas de lib intl en V1.x ; `locale='en'` reste placeholder DB documenté « out of scope V1 » dans architecture.md). a11y light V1.2 : script `pnpm audit:a11y` (axe-core via vitest-axe ou pa11y) scanne login + atelier + boutique en CI, seuil = pas de **critical**. Pas d'engagement WCAG AA formel.

**Alternatives considérées.**
- **i18n V1.2 (react-intl ou i18next)** : refusé sauf demande explicite Arnaud, coût M+, ROI nul sans client EN.
- **WCAG AA formel V1.2** : refusé, coûteux et prématuré (B2B hors marché public).
- **Statu quo a11y** : refusé, régression facile sans garde-fou CI.

**Conséquences.**
- 1 script CI, 0 lib runtime. `tests/a11y/` nouveau (3-5 pages).
- Roadmap explicite pour V2.

**Statut.** **À arbitrer Arnaud.** Recommandation Winston = i18n V2, a11y light V1.2 (0,5 j). Si client EN imminent, retraiter.

---

### ADR-R8 — Bundle size budget + lazy modales

**Contexte.**
Review M1 : bundle jamais audité. 50+ icons lucide inline dans ProductCard. Zéro `React.lazy()` sur modales lourdes (QuoteModal, LibraryPickerModal, ProductOverlay). Persona Pro = poste atelier (réseau ok) mais persona tertiaire W2P + acheteur B2B = potentiellement mobile/3G.

**Décision recommandée.**
Lighthouse CI (GitHub Action, 3 URLs : atelier, boutique publique, login ; seuils perf >= 80, a11y >= 90, best-practices >= 90) + vite-bundle-visualizer (script `pnpm analyze`) + lazy modales (QuoteModal / LibraryPickerModal / ProductOverlay en `React.lazy()` + `<Suspense>`, gain estimé 40-80 KB gzipped) + audit tree-shake lucide-react. Budget : main < 300 KB gzipped, vendor < 250 KB, initial total < 600 KB documenté dans `vite.config.ts`.

**Alternatives considérées.**
- **Next.js (SSR + code splitting auto)** : refusé absolument. Viole boring technology, refonte 2-4 sprints.
- **Vercel Speed Insights / Sentry perf** : payant et hors stack. Plus tard.
- **Statu quo** : refusé, bundle non audité = dette croissante silencieuse.

**Conséquences.**
- 1 GitHub Action, 3-4 React.lazy(), 1 audit lucide.
- Lighthouse CI bloque PRs sous seuil.
- Coût initial ≈ 1 j (setup + lazy).

**Statut.** **Décidé Winston.** R7 implémente.

---

## 3. Matrice impact / effort révisée (8 priorités P0)

> Échelles : Impact 1-5 (5 = critique métier/conformité), Effort XS/S/M/L/XL (XS ≈ 0,5 j, S ≈ 1 j, M ≈ 2-3 j, L ≈ 5 j, XL ≈ 8+ j), Risque régression 1-5 (5 = très probable), ROI = Impact / Effort (effort numérisé XS=1, S=2, M=4, L=8, XL=14).

| Code | Dette | Impact | Effort | Risque régr. | ROI score | Priorité finale |
|------|-------|:------:|:------:|:------------:|:---------:|:---------------:|
| **H** | TVA configurable (spike conformité DGFIP) | **5** | S | 2 | **2,50** | **R0 (spike)** |
| **F** | ClariprintAdapter enforcement (2 callers) | 4 | S | 1 | **2,00** | **R3** |
| **B** | ChatInterface décomp + B6/E4/E5 | **5** | L | 4 | **0,63** | **R2** |
| **A** | ProductCard atelier décomp + PIM (G) | **5** | L | **5** | **0,63** | **R1** |
| **D** | Types DB partagés (database.types.ts + zod sélectif) | 4 | M | 2 | **1,00** | **R4** |
| **E** | Pattern Supabase unique (functions.invoke + race fix) | 4 | M | 3 | **1,00** | **R5** |
| **C** | tenant_orders V1 ou V1.1 (ADR-R1) | 3-5 (selon scope) | XL si V1, 0 si V1.1 | 4 | **0,21 si V1 / N/A si V1.1** | **R6 conditionnel** |
| **G** | PIM enrichissement Fiche atelier (9 champs) | 4 | S | 2 | **2,00** | **R1 satellite (intégré)** |

**Lecture matrice.**

- **ROI top** : H (TVA), F (Clariprint), G (PIM Fiche). Tous en S effort, impact >= 4. À faire en premier (R0+R1+R3).
- **ROI moyen mais critiques** : A et B (gros composants, risque régression maximal). Doivent venir **après** R0 garde-fous tests.
- **D et E sont des fondations** : ROI 1,00 chacun. Leur valeur réelle est de **débloquer** R8 (testabilité) et la fluidité de tout sprint futur. À placer en sprint 2 après que R1+R2 aient validé le pattern.
- **C est binaire** : valeur conditionnée à la décision ADR-R1. En V1.1 deferred, sort de la matrice ; en V1 blocker, devient XL et écrase tout autre P0.

---

## 4. Séquencement stories R0 → R8 (graphe + 3 sprints)

### 4.1 Graphe de dépendances

```
                       ┌────────────────────────────────────┐
                       │ R0 — Spikes garde-fous (XS+S+M)   │
                       │ ├─ Spike H TVA (S)                 │
                       │ ├─ Spike B2 modal dupliquée (XS)   │
                       │ └─ Tests harness priceResolver +   │
                       │    ClariprintAdapter + CartContext │
                       │    (mock layer ADR-R5 minimal)     │
                       └─────┬──────────────────────────────┘
                             │  (bloque tout)
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
   ┌──────────────────┐ ┌───────────────┐ ┌──────────────────┐
   │ R1 — ProductCard │ │ R2 — ChatInt. │ │ R3 — Clariprint  │
   │ décomp + G PIM   │ │ décomp +      │ │ Adapter enforce  │
   │ Fiche (L)        │ │ B6/E4/E5 (L)  │ │ (S)              │
   └────────┬─────────┘ └───────┬───────┘ └─────────┬────────┘
            │                   │                   │
            └───────┬───────────┴───────────────────┘
                    ▼
       ┌────────────────────────────┐
       │ R4 — Types DB partagés     │
       │ (database.types.ts + zod   │
       │  sélectif Cart/Order/CP)   │
       │ (M)                        │
       └────────┬───────────────────┘
                │ (R5 a besoin des types)
                ▼
       ┌────────────────────────────┐
       │ R5 — Pattern Supabase      │
       │ (functions.invoke + fix    │
       │  race invitations) (M)     │
       └────────┬───────────────────┘
                │
                ▼
       ┌────────────────────────────────────────┐
       │ R7 — Bundle baseline + lazy modales    │
       │ (S)                                    │
       └────────┬───────────────────────────────┘
                │
                ▼
       ┌────────────────────────────┐
       │ R8 — Testabilité Supabase  │
       │ généralisée (mock layer    │
       │ étendu ADR-R5 + R0) (M)    │
       └────────────────────────────┘

       ┌────────────────────────────────────────┐
       │ R6 — Order entity V1 ou V1.1 (XL)      │
       │ ⚠️ CONDITIONNEL ADR-R1 ARNAUD          │
       │ Si V1 : insertion entre R2 et R4       │
       │ Si V1.1 deferred : OUT du sprint refacto│
       └────────────────────────────────────────┘
```

### 4.2 Découpe en 3 sprints post-démo

> Hypothèse base : ADR-R1 V1.1 deferred (R6 OUT). Durées en jours-Claude (1 j ≈ 4-6 h de pair-programming dirigé Claude code, hors review humaine).

**Sprint refacto 1 (≈ 7 j) — Fondations + garde-fous**

| Story | Effort | Description | Dépend de |
|-------|:------:|-------------|-----------|
| R0 | M (2 j) | Spike H TVA + spike B2 modal + 3 tests garde-fous (priceResolver, ClariprintAdapter, CartContext) | — |
| R3 | S (1 j) | ClariprintAdapter enforcement : `ProductCard.tsx:143` + `utils/clariprintQuote.ts:32` migrés vers l'adapter | R0 (test garde-fou) |
| R1 | L (4 j) | ProductCard décomposition 5 onglets + extraction `useClariprintProduct` + PIM enrichissement Fiche (G) avec 9 champs SEO/GEO **dans l'onglet Fiche existant** | R0 |

**Sprint refacto 2 (≈ 9 j) — Décomposition Chat + types + Supabase**

| Story | Effort | Description | Dépend de |
|-------|:------:|-------------|-----------|
| R2 | L (4 j) | ChatInterface décomposition + résolution dual source messages (B6) + billing banner explicite (E4) + troncage 25 msg (E5) + extraction `readClaudeSseStream` partagé | R0 |
| R4 | M (2 j) | Types DB partagés : `database.types.ts` généré + zod schemas Cart/Order/Clariprint + migration des 14 callers `from()` critiques | R1 (pattern validé) |
| R5 | M (3 j) | Pattern Supabase unique : 8 fetch direct → `functions.invoke()` + edge function `invite-member` transactionnelle (fix race B4) | R4 |

**Sprint refacto 3 (≈ 4-5 j) — Performance + testabilité + a11y light**

| Story | Effort | Description | Dépend de |
|-------|:------:|-------------|-----------|
| R7 | S (1 j) | Bundle baseline : Lighthouse CI + vite-bundle-visualizer + 3-4 React.lazy() modales | R1, R2 |
| R8 | M (2-3 j) | Testabilité Supabase mock layer étendu : factory `createSupabaseMock()` + tests cibles couverts 70 % (priceResolver, ClariprintAdapter, CartContext, useClariprintProduct, useChatConversation) | R0, R5 |
| R9 | XS (0,5 j) | a11y light : axe-core CI sur 3 pages critiques (atelier, boutique, login) — ADR-R7 décidée | R1 |

**Total avec V1.1 deferred** : ≈ 21-22 j-Claude répartis sur 3 sprints (≈ 1 sprint-semaine chacun avec QA humain intercalé).

**Si V1 blocker (R6 inséré)** : +8-12 j-Claude = ≈ 30-34 j total = **4 sprints au lieu de 3**. À arbitrer Arnaud (ADR-R1).

### 4.3 Stratégie de merge

- **1 story = 1 PR atomique** (convention existante Magrit).
- **Garde-fou non négociable** : vitest doit être vert avant merge. Régression bloque PR.
- **Tests R0 sont des "test seeds"** : ils sont écrits avant R1/R2 et **ne doivent pas régresser** au cours de la décomposition. C'est le contrat d'invariance qui sécurise la refacto.
- **Sequencing dans la branche `beta/v5`** : merger en série (pas de parallélisation R1+R2) pour éviter les conflits massifs sur `testIds.ts` et les contexts.

---

## 5. Risques + atténuations

| # | Risque | Probabilité | Sévérité | Atténuation |
|---|--------|:-----------:|:--------:|-------------|
| **R-1** | **Régression silencieuse** lors décomposition ProductCard (1281 L) ou ChatInterface (1066 L) sans harness tests préalable | **Élevée** | **Critique** | **R0 obligatoire avant R1/R2** : 3 tests garde-fous priceResolver/ClariprintAdapter/CartContext + extension testIds + smoke E2E Claude in Chrome sur parcours atelier+chat avant et après chaque PR. Bloc sur revue Notion cahier de tests TF-XX. |
| **R-2** | **Scope creep** pendant R1 (tentation d'inventer un onglet Marketing malgré la règle Arnaud `feedback_no_invent_hors_backlog.md`) | Moyenne (récidive 2026-05-10) | Élevée | Story spec R1 doit **explicitement** lister les 5 onglets ProductCard inchangés (Fiche/Prix/3D/Éditer/Debug) en « out of scope ». Validation Arnaud avant merge. PIM enrichissement **dans onglet Fiche existant uniquement**. |
| **R-3** | **Migration types DB R4** casse silencieusement des callers RLS qui marchaient (typage strict révèle des champs jamais utilisés mais en réalité requis) | Moyenne | Moyenne | Migration R4 en deux temps : (a) générer `database.types.ts` + faire passer `tsc --noEmit` sans erreurs (peut nécessiter quelques `as unknown as Tables<>` transitoires marqués `// TODO R4-cleanup`), (b) nettoyer transition dans une PR suivante. |
| **R-4** | **Décision ADR-R1 retardée** par Arnaud → R6 planifié mais non lancé → équipe attend → vélocité refacto chute | Moyenne | Moyenne | Démarrer Sprint refacto 1 (R0+R1+R3) **sans attendre** la décision ADR-R1. R0+R1+R3 sont indépendants de R6. La décision peut être prise pendant Sprint 1 sans impacter le planning. |
| **R-5** | **Bundle Lighthouse CI** fait échouer des PRs critiques pendant la phase de stabilisation v1.1 sur d'autres branches (B4 démo) | Faible | Moyenne | Activer Lighthouse CI **seulement sur `beta/v5`** en début, pas sur `beta/v4` (qui doit rester intouché pour la démo 2026-05-23). Seuils permissifs en R7 (perf >= 70) puis relevés progressivement. |
| **R-6** | **Spike H TVA** révèle un bug en prod déjà vendu (ex: facture B4 incorrecte sur DOM-TOM) | Faible (pas de client DOM-TOM signalé) | Élevée si confirmé | Audit en R0 : grep `* 1.20` + `* 0.20` + `vat`/`tva`/`tax` dans tout le code. Lister les anciennes factures émises en SQL et vérifier le scope régime fiscal. Si trouvé : hotfix prioritaire sur B4 avant la démo. |

---

## 6. Synthèse Arnaud — ce que tu dois trancher vs ce que Winston a tranché

### 6.1 Tableau récapitulatif

| ADR | Sujet | Statut Winston | Recommandation chiffrée si "à arbitrer" |
|-----|-------|----------------|------------------------------------------|
| ADR-R1 | tenant_orders V1 vs V1.1 | ✅ Décidé Arnaud (V1.1 deferred) | Arnaud valide recommandation Winston 2026-05-11. R6 OUT du sprint refacto. |
| ADR-R2 | Typing cross-couche | ✅ Décidé Winston | `database.types.ts` généré + zod sélectif Cart/Order/Clariprint |
| ADR-R3 | Pattern Supabase | ✅ Décidé Winston | Reads = `from()` direct typé, writes/edges = `functions.invoke()` exclusivement |
| ADR-R4 | Décomposition gros composants | ✅ Décidé Winston | Onglet-by-onglet pour ProductCard, hooks extracts pour ChatInterface |
| ADR-R5 | Tests Supabase | ✅ Décidé Winston | Factory `createSupabaseMock()` (pas MSW) |
| ADR-R6 | TVA configurable | ✅ Décidé Winston | `tenant.tax_regime` enum + `src/app/utils/tax.ts` (Spike R0, 1 j) |
| ADR-R7 | a11y + i18n roadmap | ✅ Décidé Arnaud (a11y light V1.2 + i18n V2) | Arnaud valide recommandation Winston 2026-05-11. R9 (axe-core CI) devient obligatoire dans sprint refacto 3. |
| ADR-R8 | Bundle size budget | ✅ Décidé Winston | Lighthouse CI + vite-bundle-visualizer + lazy modales (R7) |

### 6.2 Décisions binaires à acter (2 ADR Arnaud)

**Décision #1 — ADR-R1 (tenant_orders).** Choix A = V1 blocker (R6 XL, +1 sprint, capture l'investissement S1.4). Choix B = V1.1 deferred (R6 OUT, préserve vélocité, dette tracée). **Recommandation Winston : B.** Le refacto produit plus de valeur durable. V1.1 deferred reste un sprint 8-12 j cohérent à lancer après R1-R8.

**Décision #2 — ADR-R7 (a11y + i18n).** Choix A = statu quo. Choix B = a11y light V1.2 + i18n V2. Choix C = i18n V1.2 (anticipation EN), +M effort. **Recommandation Winston : B.** A laisse dette invisible, C n'a pas de driver client identifié.

### 6.3 Décisions techniques Winston (6 ADR, pas de re-validation sauf objection)

ADR-R2 types DB générés · ADR-R3 functions.invoke edges · ADR-R4 décomposition onglet-by-onglet · ADR-R5 factory mock Supabase · ADR-R6 tax_regime enum · ADR-R8 Lighthouse CI + lazy modales.

### 6.4 Questions annexes review §5

- **TVA conformité avant ou après refacto ?** Avant, intégré dans R0 (1 j Spike H). Pas mélanger avec sprint e-invoicing PA/PPF NFR16 (V1.1+).
- **PRD/architecture update pendant ou après refacto ?** Pendant : chaque story R0-R8 a une sous-tâche « update architecture.md §X » dans son DoD. PRD update = une passe en clôture Sprint 3.

---

## 7. Sortie pour Étape E (backlog stories refacto)

> Cette section est l'input direct pour `bmad-create-epics-and-stories`. Chaque story R0-R8 doit produire un story doc `_bmad-output/implementation-artifacts/story-R{N}.md` au moment de l'implémentation.

**EPIC-REFACTO-1 : Stabilisation refacto post-démo (3 sprints)**

| ID | Story title (short) | Effort | Sprint | Dépend de | DoD garde-fou |
|----|---------------------|:------:|:------:|-----------|----------------|
| R0 | Spikes garde-fous + TVA + modal | M | 1 | — | tests vitest verts sur priceResolver+ClariprintAdapter+CartContext + tax.test.ts |
| R1 | ProductCard décomp 5 onglets + PIM Fiche | L | 1 | R0 | 9 champs PIM rendus dans Fiche existante + ProductCard.helpers.test.ts vert |
| R3 | ClariprintAdapter enforcement | S | 1 | R0 | 0 fetch direct Clariprint restant dans `src/` |
| R2 | ChatInterface décomp + bugs B6/E4/E5 | L | 2 | R0 | dual source résolue + billing banner + troncage 25 msg + ChatInterface.helpers.test.ts vert |
| R4 | Types DB + zod sélectif | M | 2 | R1 | `tsc --noEmit` vert + `database.types.ts` committé |
| R5 | Pattern Supabase + race invitations | M | 2 | R4 | 0 fetch URL hardcodée restante + edge `invite-member` transactionnelle vitest verte |
| R7 | Bundle baseline + lazy modales | S | 3 | R1, R2 | Lighthouse CI passing + bundle main < 300 KB gzipped |
| R8 | Mock Supabase étendu + tests cibles | M | 3 | R0, R5 | coverage >= 70 % sur zones froides §6.3 audit |
| R9 | a11y light axe-core CI (optionnel) | XS | 3 | R1 | 0 critical axe-core sur 3 pages |

**Effort total V1.1 deferred (sans R6) : ≈ 21-22 j-Claude / 3 sprints.**
**Effort total V1 blocker (avec R6 XL) : ≈ 30-34 j-Claude / 4 sprints.**

---

## 8. Hors scope explicite du sprint refacto

Pour éviter le scope creep (mémoire `feedback_no_invent_hors_backlog.md`) :

- **Pas de migration React 19 / Tailwind v5 / Vite 7** (boring technology, architecture.md §2.3).
- **Pas de migration React Query / SWR** (ADR-R4 alternative refusée).
- **Pas de barrel exports** (`index.ts` regroupants — audit §2.4) — décision Winston : pas justifié par le coût/valeur à ce stade. À reconsidérer en V2 si croissance dossiers `components/`.
- **Pas de réorganisation `pages/` vs `components/`** (audit §2.3) — même argument. Cosmétique vs structurel.
- **Pas de remplacement `formatEuro` 3× dupliqué** (audit §9.3 cluster mineur) — sera ramassé naturellement pendant R4 (typage) ou R5 (Supabase pattern).
- **Pas de refacto `DashboardLibrary*` cluster A** (audit §9.4) — hors P0, à reconsidérer en V2.
- **Pas de migration `marguerite-*` testid → `magrit-*`** — opportuniste pendant R1/R2, pas une story dédiée.
- **Pas de `i18n` infra** (ADR-R7) — V2.
- **Pas de WCAG AA formel** (ADR-R7) — V2.

---

## 9. Métadonnées

- **Auteur** : Winston Architect (BMAD persona) via Claude code Sonnet 4.5.
- **Date production** : 2026-05-11.
- **Branche cible** : `beta/v5`.
- **Fenêtre exécution** : post-démo 2026-05-23.
- **Document produit en respect de** : architecture.md (15 ADR existants), prd.md (46 FR + 28 NFR), project-context.md (persona primaire imprimeur Pro + règles dures Arnaud), 4 mémoires BMAD feedback_*.
- **Next step** : Arnaud arbitre ADR-R1 + ADR-R7 → `bmad-create-epics-and-stories` produit le backlog R0-R8 sur `_bmad-output/implementation-artifacts/`.

---

*Fin du plan refacto Étape D.*
