---
id: R8
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 3 (post-démo)
priority: P0
effort: M (2-3 j-Claude)
assignee: Claude code
depends_on: [R0, R5]
unblocks: []
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R5)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §1.2 M2
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md §6.3 zones froides
status: pending
---

# R8 — Testabilité Supabase mock layer étendu + coverage zones froides

## Origine

Story refacto P0 issue de l'**Étape D Winston ADR-R5** + dette M2 manquée par review adversariale §1.2 : 0 mocking/injection sur les 14 callers `from()` + 8 callers `fetch('/functions/v1/...')`. Logique métier business (submitCart, library ops, devis, invitations) non testable en isolation.

## Contexte

Audit §6 : vitest 162/162 verts mais **coverage non mesurée**. Zones froides §6.3 :
- `priceResolver.ts` (couvert par R0)
- `ClariprintAdapter.ts` (couvert par R0)
- `CartContext.tsx` (couvert par R0)
- Tous les autres contexts (10 contexts métier — AuthContext, ShopsContext, LibraryContext, PIMContext, ConversationContext, ClientsContext, QuoteTemplatesContext, PreferencesContext, TenantContext) — 0 test
- `ChatInterface` 1066 L et `ProductCard` 1281 L sans harness — R1 + R2 livrent des tests par sous-composant mais pas de coverage globale.

Décision Winston (ADR-R5) : factory `createSupabaseMock()` (pas MSW — boring technology), généralisée pour les patterns `from()` (R4 typé) + `functions.invoke()` (R5 unifié). Cible coverage **70 %** sur zones froides + chemins critiques.

## User story

En tant que **développeur Claude code futur** travaillant sur Magrit V1+ et V2, je veux disposer d'une factory `createSupabaseMock()` simple + tests cibles couvrant 70 % des zones froides critiques, afin de pouvoir refactorer / ajouter des features sans peur de régression silencieuse et de mesurer objectivement la qualité du code.

## Critères d'acceptation

1. **Given** R8 livré, **When** je liste `tests/_helpers/`, **Then** `createSupabaseMock.ts` existe avec une API simple : `const supabase = createSupabaseMock({ tables: {...}, rpcs: {...}, functions: {...} })`. Permet de stubber les retours de `from().select()`, `from().insert()`, `functions.invoke()`, `rpc()`.
2. **Given** la factory, **When** je run `vitest`, **Then** au minimum **5 nouveaux modules** ont une couverture >= 70 % (mesurée via `c8` ou `@vitest/coverage-v8`) :
   - `priceResolver` (déjà R0)
   - `ClariprintAdapter` (déjà R0)
   - `CartContext` (déjà R0)
   - `useClariprintProduct` (extrait R1) — **nouveau R8**
   - `useChatConversation` (extrait R2) — **nouveau R8**
   - `AuthContext` — **nouveau R8**
   - `ShopsContext` — **nouveau R8**
3. **Given** `@vitest/coverage-v8` configuré, **When** je run `pnpm test:coverage`, **Then** un rapport HTML est généré dans `coverage/` avec breakdown par fichier.
4. **Given** un seuil minimum dans `vitest.config.ts`, **When** je run la CI, **Then** la coverage globale est >= 50 % (seuil progressif, relevé en V1.x post-R8).
5. **Given** un test typique consommateur de mock, **When** je l'écris, **Then** la syntaxe reste lisible (< 20 L de boilerplate par test). Pas de framework lourd type MSW.
6. **0 régression** : vitest run vert. Build Vite OK. Pas de slowdown notable des tests (< +20 % temps total).

## Spécifications API / data

- **Factory** : [tests/_helpers/createSupabaseMock.ts](tests/_helpers/createSupabaseMock.ts) — pattern minimaliste :
  ```ts
  export function createSupabaseMock(stubs: {
    tables?: Record<string, { select?: any[]; insert?: any; update?: any; delete?: any }>;
    rpcs?: Record<string, (params: any) => any>;
    functions?: Record<string, (body: any) => { data: any; error?: any }>;
  }): SupabaseClient {
    // Implementation: Proxy or hand-rolled object replicating SupabaseClient surface utilisée.
  }
  ```
- **Configuration coverage** : ajouter à `vitest.config.ts` :
  ```ts
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['tests/**', '**/*.d.ts', 'src/types/database.types.ts'],
      thresholds: { lines: 50, functions: 50, branches: 40, statements: 50 },
    },
  }
  ```
- **Tests cibles à écrire** : ~25 nouveaux cas répartis sur les 5 modules (4-6 cas par module).
- **Pas de changement code production** (sauf si la factorisation pour testabilité révèle un besoin de DI léger).

## Dépendances

- **Prérequis** : R0 mergé (tests garde-fous priceResolver / ClariprintAdapter / CartContext = seeds qui inspirent la factory) + R5 mergé (pattern `functions.invoke()` unique à mocker).
- **Pas de dépendance externe.**

## Estimation

**M (2-3 j-Claude)**. 0,5 j création factory + tests sur la factory elle-même ; 1 j tests cibles AuthContext + ShopsContext + useClariprintProduct + useChatConversation ; 0,5 j config coverage + seuils ; 0,5 j ajustement seuils selon baseline réelle.

## Plan de test

- **vitest** : 25+ nouveaux cas + meta-test de la factory.
- **Coverage report** : `pnpm test:coverage` doit produire un rapport HTML lisible.
- **TF nouveau à créer** : *"Coverage R0 + R8 zones froides >= 70 %"*, parcours P00, persona Superadmin Magrit, P2 (qualité), type Manuel (lire le rapport coverage).
- **Smoke** : Arnaud ouvre `coverage/index.html` et valide visuellement les % par module.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- Factory `createSupabaseMock()` livrée + documentée dans `tests/README.md`.
- `@vitest/coverage-v8` installé + config.
- 5 modules cibles >= 70 % coverage.
- Coverage globale >= 50 %.
- vitest run vert avec 25+ nouveaux cas.
- TF nouveau créé et joué OK.
- Update `architecture.md` §X.X avec ADR-R5 tranchée + seuils coverage documentés.
- `SPRINT_HANDOFF.md` mis à jour avec la baseline coverage par module.
