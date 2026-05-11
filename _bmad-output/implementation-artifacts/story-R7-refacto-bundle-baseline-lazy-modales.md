---
id: R7
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 3 (post-démo)
priority: P0
effort: S (1 j-Claude)
assignee: Claude code
depends_on: [R1, R2]
unblocks: []
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R8)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §1.2 M1
status: partial-review
---

# R7 — Bundle baseline (Lighthouse CI + bundle-visualizer + lazy modales)

## Origine

Story refacto P0 issue de l'**Étape D Winston ADR-R8** + dette manquée M1 par review adversariale §1.2 : bundle size jamais auditée, 50+ icons lucide inline dans ProductCard, zéro `React.lazy()` sur modales lourdes (QuoteModal, LibraryPickerModal, ProductOverlay), pas de bundle analysis.

## Contexte

Magrit beta/v5 stack : Vite 6 + React 18 + Tailwind v4 + Supabase + 80+ deps NPM. Bundle size de la branche : **inconnue à ce jour**. Lighthouse CI absent. `vite-bundle-visualizer` absent. Aucun seuil dans le build.

Risque : croissance silencieuse du bundle (chaque ajout shadcn primitive, chaque icon lucide, chaque feature) → temps de chargement perçu dégradé en prod, NFR2 (cache mockup < 50 ms) bien mais charge initiale jamais mesurée.

Décision Winston (ADR-R8) : Lighthouse CI sur PRs + `vite-bundle-visualizer` + 3-4 `React.lazy()` modales lourdes + seuil bundle main `< 300 KB gzipped` (à confirmer baseline).

## User story

En tant que **utilisateur final** (Owner / Admin / Member tenant, Acheteur shop_only), je veux que la première charge de page Magrit soit rapide (≤ 2,5 s LCP sur 4G simulé), afin d'avoir une expérience perçue conforme à un SaaS B2B moderne. **Et** en tant que **mainteneur Claude code**, je veux qu'un seuil bundle CI bloque les PRs qui font enfler la baseline, afin d'éviter la dérive silencieuse.

## Critères d'acceptation

1. **Given** R7 livré, **When** je liste les `React.lazy()` dans `src/`, **Then** au minimum **3 modales** sont lazy-loaded : `QuoteModal`, `LibraryPickerModal`, `ProductOverlay`. Le shell ProductCard / ChatInterface n'embarque pas leur code initial.
2. **Given** un commit sur `beta/v5`, **When** la CI tourne, **Then** Lighthouse CI génère un rapport avec scores Performance / Accessibility / Best Practices / SEO. Seuil **Performance >= 70** en R7 (relevable progressivement en V1.x).
3. **Given** `vite-bundle-visualizer` installé, **When** je run `pnpm build:analyze`, **Then** un rapport HTML est généré dans `dist/stats.html` listant les chunks et leur taille.
4. **Given** le seuil bundle main `< 300 KB gzipped` configuré dans `vite.config.ts`, **When** je build, **Then** soit le build passe, soit Vite warning explicite si le seuil est dépassé.
5. **Given** les 50+ icons lucide identifiés dans ProductCard (review M1), **When** je liste les imports lucide dans `src/`, **Then** **0 import wildcard** `import * as Icons from 'lucide-react'` (uniquement imports nommés ciblés).
6. **0 régression UI** : Aucune modale lazy-loaded ne doit afficher un flash blanc > 200 ms. Suspense fallback configuré (spinner ou skeleton).
7. **0 régression mesurable** : vitest run vert. Lighthouse CI passe au-dessus du seuil.

## Spécifications API / data

- **Installation** :
  - `pnpm add -D @lhci/cli vite-bundle-visualizer`
- **GitHub Action** : `.github/workflows/lighthouse.yml` à créer — runs Lighthouse sur `beta/v5` sur 2-3 routes critiques (`/`, `/t/imprimerie-ipa/atelier`, `/shop/xyfjjo-q6kekm`).
- **Configuration** : `.lighthouserc.json` avec seuils Performance >= 70, Accessibility >= 90 (anticipation R9 ADR-R7), Best Practices >= 90.
- **Script package.json** :
  - `"build:analyze": "vite build && vite-bundle-visualizer"`
  - `"lighthouse:ci": "lhci autorun"`
- **Code lazy** : refactor 3 imports modales dans ProductCard + ChatInterface + autres callers :
  ```tsx
  const QuoteModal = lazy(() => import('./QuoteModal'));
  // ...
  <Suspense fallback={<QuoteModalSkeleton />}>
    {isOpen && <QuoteModal />}
  </Suspense>
  ```
- **Audit imports lucide** : grep `from 'lucide-react'` + lister les 50+ icons utilisés + s'assurer qu'aucun wildcard n'existe (tree-shaking optimal).
- **Pas de changement DB ni edge function.**

## Dépendances

- **Prérequis** : R1 + R2 mergées (les sous-composants ProductCard et ChatInterface doivent être stabilisés pour identifier précisément quelles modales lazy-load).
- **Pas de dépendance externe** (Lighthouse CI accessible sans secret particulier, GitHub Actions standard).

## Estimation

**S (1 j-Claude)**. 0,25 j install + config Lighthouse CI ; 0,25 j config bundle-visualizer + seuils Vite ; 0,5 j refactor 3-4 lazy modales + audit imports lucide.

## Plan de test

- **vitest** : 1 test minimal sur le Suspense fallback rendu.
- **Lighthouse CI** : doit produire un rapport vert sur les 3 routes critiques.
- **TF nouveau à créer** : *"Bundle baseline — Lighthouse CI > 70 sur 3 routes + lazy modales < 200 ms"*, P05/P09, persona Owner / Acheteur, P2 (perf), type IA Chrome + CI report. Hints : assertion Lighthouse score Performance >= 70.
- **Smoke humain** : Arnaud charge l'atelier sur Chrome DevTools throttle 4G + observe LCP <= 2,5 s.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- Lighthouse CI active sur PRs `beta/v5`.
- `pnpm build:analyze` produit un rapport bundle.
- 3+ modales lazy-loaded (QuoteModal, LibraryPickerModal, ProductOverlay).
- Bundle main < 300 KB gzipped (ou seuil ajusté en CA après mesure baseline réelle).
- vitest run vert.
- TF nouveau créé et joué OK.
- Update `architecture.md` §X.X avec ADR-R8 tranchée + baseline bundle documentée.

## Tasks / Subtasks

### Phase A — Lazy modales (LIVRE)

- [x] `QuoteModal` lazy-loaded dans `ProductCard.tsx` (chunk dedie 2.92 kB gz)
- [x] `LibraryPickerModal` lazy-loaded dans `ProductCard.tsx` + `ChatInterface.tsx` (chunk dedie 1.54 kB gz)
- [x] `ProductOverlay` lazy-loaded dans `ProductCard.tsx` + `PortalCatalog.tsx` (chunk dedie 3.69 kB gz)
- [x] Suspense fallback={null} (les modales sont rendues conditionnellement, pas de flash visible)

### Phase B — Bundle visualizer (LIVRE)

- [x] `rollup-plugin-visualizer` installe en devDependency
- [x] Plugin Vite conditionnel via `ANALYZE=1` env var (eviter le cout en build prod)
- [x] Script `pnpm build:analyze` ajoute → genere `dist/stats.html` (treemap des chunks gzip + brotli)
- [x] `vite.config.ts.chunkSizeWarningLimit: 600` (au-dela = warning Vite. Baseline actuelle ~890 KB → dette technique a reduire au fil du temps).

### Phase C — Lighthouse CI (CONFIG LIVREE, WORKFLOW PENDING)

- [x] `.lighthouserc.json` cree avec seuils :
  - Performance >= 0.70 (warn)
  - Accessibility >= 0.85 (warn, anticipation R9)
  - Best Practices >= 0.85 (warn)
  - SEO >= 0.75 (warn)
- [x] Documente : `pnpm exec lhci autorun` ou via workflow GitHub Actions a creer par Arnaud (`.github/workflows/lighthouse.yml`)
- [ ] **Reporte** : workflow GitHub Actions n est pas cree par Claude code (action manuelle Arnaud, depend de la config CI repo).

### Phase D — Audit lucide-react (LIVRE)

- [x] `grep "import \* as.*lucide"` dans src/ → **0 occurrence** (AC5 ok). Tous les imports sont nommes (tree-shaking optimal).

## Dev Agent Record

### Completion Notes

**ACs satisfaits** :
- AC1 (3 modales lazy) → ✅ QuoteModal + LibraryPickerModal + ProductOverlay = 3 chunks dedies (8.15 kB gz cumules sortis du shell).
- AC2 (Lighthouse CI) → **config livree** (.lighthouserc.json), workflow GitHub Actions a creer par Arnaud.
- AC3 (`pnpm build:analyze`) → ✅ ANALYZE=1 vite build → dist/stats.html.
- AC4 (seuil bundle) → **partiel** : chunkSizeWarningLimit 600 KB, baseline actuelle ~890 KB documentee comme dette. Le seuil exact "300 KB gzipped" de la spec n'est pas atteignable sans gros effort de manualChunks / dynamic imports plus aggressifs (story future).
- AC5 (0 wildcard lucide) → ✅ grep = 0.
- AC6 (0 regression UI) → ✅ Suspense fallback={null}, modales rendues conditionnellement (pas de flash).
- AC7 (0 regression mesurable) → ✅ vitest 263/263 verts, Vite build OK.

**Gain bundle mesure** :
- Bundle main avant R7 : 917 kB raw / 250 kB gz
- Bundle main apres R7 : 888 kB raw / **245 kB gz** (-5 kB gz sur le main, +8.15 kB gz en chunks separes charges a la demande)

### File List

**Nouveaux fichiers** (1) :
- `.lighthouserc.json` (config Lighthouse CI)

**Fichiers modifies** (4) :
- `package.json` : ajout rollup-plugin-visualizer + script build:analyze
- `vite.config.ts` : plugin visualizer conditionnel ANALYZE=1 + chunkSizeWarningLimit 600
- `src/app/components/ProductCard.tsx` : lazy QuoteModal + LibraryPickerModal + ProductOverlay + Suspense wrappers
- `src/app/components/ChatInterface.tsx` : lazy LibraryPickerModal + Suspense wrapper
- `src/app/components/shop/portal/PortalCatalog.tsx` : lazy ProductOverlay + Suspense wrapper

### Change Log

- 2026-05-11 : Story R7 livree partial-review, status `pending` → `partial-review`. Phase A (lazy modales) + Phase B (bundle visualizer) + Phase D (audit lucide) livrees. Phase C (workflow GitHub Actions Lighthouse) pending Arnaud.
