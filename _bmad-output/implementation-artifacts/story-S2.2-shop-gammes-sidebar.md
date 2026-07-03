---
story_id: S2.2
epic: 2 — Boutique B2B Premium Experience
title: Catalogue par gammes dépliables et persistantes (sidebar gauche ShopLayout)
status: review
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: S
prd_ref: _bmad-output/planning-artifacts/prd.md (FR32)
architecture_ref: _bmad-output/planning-artifacts/architecture.md (§6.1 tree, §5.1 conventions)
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 2 / S2.2)
fr_covered: [FR32]
nfr_covered: []
adr_covered: []
predecessors: [S2.1 ShopLayout 3-col livré (sidebar gauche slot leftSidebar prêt), S2.3 ShopProductCard livré]
successors: [S2.4 Overlay Clariprint, S2.7 Home enrichie, S2.8 Multi-sélection]
---

# Story S2.2 — Catalogue par gammes dépliables et persistantes

## Story (Given/When/Then)

**As an** acheteur B2B,
**I want** déplier les gammes de produits que je veux explorer et que ma sélection persiste entre interactions,
**So that** je peux comparer plusieurs gammes sans perdre ma navigation à chaque clic.

## Contexte stratégique

S2.2 transforme la **sidebar gauche placeholder** du `ShopLayout` (S2.1) en navigation gammes interactive et persistante. C'est la 3e brique visible de l'Epic 2 Boutique Premium B2B après S2.1 (chassis) + S2.3 (cards).

Modèle de données déjà en place :
- **PIM global Magrit** : 22 gammes structurées (carterie / flyer / affiche / dépliant / brochure...) avec hiérarchie via `parent_slug`. Source : `usePIM().gammes`.
- **Souscriptions tenant** : table `tenant_gamme_subscriptions(tenant_id, gamme_slug, active)`. Le tenant choisit lesquelles exposer (E9.6 livré).
- **Matching produit→gamme** : helper [resolveGamme(config, gammes)](src/app/utils/productEnrichment.ts) déjà fonctionnel.

```
S2.1 ✅ ShopLayout (chassis 3-col + slot leftSidebar)
   ↓
S2.2 (cette story) — ShopGammesSidebar dans le slot leftSidebar
   ├─ consomme tenant_gamme_subscriptions (table existante E9.6)
   ├─ consomme resolveGamme() existant
   ├─ persiste l'état déplié en localStorage
   └─ filtre additif les produits affichés dans la grille (PortalCatalog/PortalHome)
```

**Démo 2026-05-23** : la sidebar dépliable rend le portail navigable par marques de produits, signe de maturité B2B.

## Pattern technique retenu

### Composant `ShopGammesSidebar.tsx`

Rendu dans le slot `leftSidebar` du `ShopLayout` (S2.1 prévu pour ça). Affiche l'arborescence des gammes souscrites par le tenant qui possède la shop, avec :

- **Hiérarchie parent/enfant** : gammes racines (`parent_slug === null`) avec leurs sous-gammes en chevron `▶` / `▼`.
- **Compteur produits par gamme** : `{ slug → count }` calculé via `resolveGamme(product.config, gammes)`.
- **Click chevron** : toggle expansion + ajoute/retire la gamme au filtre actif (1 action = 1 état déplié, AC4).
- **État déplié multi-gammes (additif)** : `Set<string>` de gamme_slugs. Sauvegarde localStorage par shop (clé `magrit_shop_expanded_gammes__{shop.slug}`).
- **Hydratation au mount** : `useEffect` lit localStorage et restaure le `Set`. Survit à F5 + close/reopen tab.

### Filtre additif côté `PublicShop`

L'état `expandedGammes: Set<string>` vit dans `PublicShop` (state global du portail). Il est :
- Passé à `<ShopGammesSidebar>` (rendu dans `leftSidebar` slot via prop `gammesNav`)
- Utilisé pour calculer `filteredProducts` (sous-ensemble) avant de passer aux vues `PortalHome` / `PortalCatalog` / etc.

**Règle filtre** : si `expandedGammes.size === 0` → tous les produits visibles (default). Si ≥ 1 → union des produits dont `resolveGamme(p.config, gammes).slug` est dans `expandedGammes`. Comportement additif intuitif (déplier 2 gammes = voir leurs produits combinés).

### Performance ≥ 50 produits

L'AC2 demande "fluide pas de lag scroll". Stratégie :
- Memoiser `groupedByGamme: Map<slug, ShopProduct[]>` via `useMemo([products, gammes])` — pas de recalcul inutile.
- Memoiser `filteredProducts` via `useMemo([products, expandedGammes, gammeMap])`.
- Pas de virtualisation MVP (50 produits ne nécessitent pas de virtual list — Tailwind grid + browser scroll suffisent).

### Helpers logiques purs (pattern repo)

Suivre le pattern `*.helpers.ts` + tests vitest sans rendering React (aligné avec ShopLayout S2.1, ShopProductCard S2.3) :

- `groupProductsByGamme(products, gammes): Map<slug, ShopProduct[]>`
- `loadExpandedGammes(shopSlug): Set<string>` lit localStorage, parse JSON array, return Set
- `saveExpandedGammes(shopSlug, expanded): void` serialize Set → JSON array → localStorage
- `filterProductsByExpandedGammes(products, gammeMap, expandedSlugs): ShopProduct[]`
- `buildGammeTree(gammes): Map<rootSlug, Gamme[]>` regroupe par parent_slug pour rendu hiérarchique

### Souscription gammes du tenant qui possède la shop

`shop.tenant_id` n'est pas exposé sur le type `Shop` public (RLS). Plusieurs options :
- a) Modifier le SELECT initial dans [PublicShop.tsx:103](src/app/components/shop/PublicShop.tsx#L103) pour inclure `tenant_id` (la query ne lit PAS les colonnes RLS-restrictées d'autres tables).
- b) Charger toutes les gammes PIM disponibles côté shop publique sans filtre tenant (compromis : on affiche les 22 gammes PIM, pas seulement les souscrites du tenant).
- c) Ajouter un endpoint public `GET /shop/:slug/gammes` qui retourne les gammes souscrites.

**Décision MVP** : option **(a)** — étendre le SELECT shop pour inclure `tenant_id`. Pas de fuite RLS (le tenant_id du shop public n'est pas un secret), simple et performant. À valider si la column `tenant_id` existe bien sur `shops` (cf. architecture §3.3 multi-tenancy : "Tables tenant-scoped : shops" → oui).

Si le SELECT actuel n'inclut pas tenant_id, on l'ajoute. Puis on charge `tenant_gamme_subscriptions` filtré par ce tenant_id en lecture publique (la RLS de cette table doit permettre lecture anon des `active=true`, à vérifier).

**Fallback safe** : si la query `tenant_gamme_subscriptions` retourne 0 rows ou error, on tombe sur option (b) en affichant les gammes PIM résolues depuis `products` (groupage par `resolveGamme(p.config)` puis on prend les unique slugs).

### Filtre actif visuellement signalé

UX : une gamme dépliée doit être visuellement distincte (bg accent ou checkmark à côté du chevron) pour que l'acheteur comprenne que c'est un filtre actif. Sinon on tombe dans la confusion "déplier ≠ cocher".

Décision : **chevron rotatif `▶ / ▼` + couleur primaire sur le label si déplié + petit badge mono "FILTRE" à côté quand ≥ 1 gamme déployée** (rappel UX que c'est un filtre).

## Acceptance Criteria

### AC1 — Sidebar arborescence avec gammes souscrites + compteurs

**Given** une shop active dont le tenant a souscrit ≥ 3 gammes (table `tenant_gamme_subscriptions`)
**And** ≥ 5 produits par gamme dans le catalogue (matching via `resolveGamme`)
**When** l'acheteur charge `/shop/<slug>` (vue catalog)
**Then** la sidebar gauche affiche les gammes racines (parent_slug=null) souscrites
**And** chaque gamme montre son nom + compteur produits `(N)` à droite (mono uppercase)
**And** les sous-gammes sont indentées sous leur parent quand le parent est déplié
**And** les gammes sans produits matchant sont masquées (compteur 0 = pas affiché — éviter UI vide)

**Given** un tenant sans souscriptions actives (cas dégradé)
**When** la sidebar charge
**Then** elle tombe sur le fallback "gammes inférées depuis les produits affichés" (groupage via `resolveGamme(p.config, allPimGammes)`)
**And** affiche les gammes uniques résolues depuis le catalogue produit

### AC2 — Click chevron déplie + filtre additif

**Given** la sidebar rendue avec gammes "cartes commerciales" et "brochures" présentes
**When** l'acheteur clique sur le chevron de "cartes commerciales"
**Then** la gamme s'affiche dépliée (chevron rotatif ▶→▼, couleur primaire sur le label)
**And** la grille produits ne montre QUE les produits matchant cette gamme

**When** l'acheteur clique ensuite sur le chevron de "brochures"
**Then** les deux gammes restent dépliées simultanément
**And** la grille produits montre l'**union** des produits des 2 gammes (filtre additif)

**When** l'acheteur reclique sur le chevron de "cartes commerciales"
**Then** seul "brochures" reste déplié, la grille montre uniquement ses produits

**When** l'acheteur reclique sur "brochures" (plus aucune gamme dépliée)
**Then** la grille montre **tous** les produits (default state)

**Given** ≥ 1 gamme dépliée
**When** la sidebar rend
**Then** un badge mono `N FILTRES` apparaît en haut de la sidebar pour rappeler le filtre actif

### AC3 — Persistance localStorage

**Given** un acheteur a déplié "cartes commerciales" et "brochures"
**When** il rafraîchit la page (F5) ou ferme/réouvre l'onglet
**Then** au reload, la sidebar restaure les 2 gammes en état déplié
**And** la grille filtre toujours sur l'union de ces 2 gammes
**And** la clé localStorage est `magrit_shop_expanded_gammes__{shop.slug}` (par shop, pas par tenant — un user multi-shop a un état par shop)

**Given** un autre user / autre browser sur la même shop
**Then** son state local est indépendant (localStorage = device-local, ce qui est attendu pour un MVP)

### AC4 — Persistance navigation interne

**Given** un acheteur a déplié "cartes commerciales"
**When** il navigue catalog → product (ouvre une fiche) puis revient catalog
**Then** "cartes commerciales" reste déplié
**And** le filtre additif reste actif sur la grille

**When** il fait une recherche dans le hero search (filtre query)
**Then** le filtre query s'applique en plus du filtre gammes (intersection)
**And** le filtre gammes n'est pas réinitialisé

### AC5 — Performance fluide ≥ 50 produits

**Given** un catalogue avec 50+ produits visibles simultanément
**When** la page rend (cold start) et l'acheteur scroll
**Then** pas de lag perceptible (60 FPS visuel sur scroll, < 100ms latence click chevron)
**And** les recalculs `groupedByGamme` et `filteredProducts` sont memoïsés via `useMemo` (pas de recalcul à chaque render)

### AC6 — testIds + a11y

**Given** la sidebar rend
**When** Claude in Chrome / E2E inspecte le DOM
**Then** les testids `shop-gammes-list` (NEW), `shop-gamme-row` (NEW collection avec `data-gamme-slug`), `shop-gamme-toggle-btn` (NEW), `shop-gammes-filter-badge` (NEW conditionnel) sont présents

**Given** navigation clavier
**When** Tab dans la sidebar
**Then** chaque chevron est focusable, ring 2px accent visible, Enter/Space toggle l'état
**And** ARIA `aria-expanded` reflète l'état déplié sur chaque button toggle
**And** ARIA `aria-label` "Déplier la gamme {name} ({count} produits)" sur chaque toggle

## Tasks / Subtasks

- [x] **Task 1 — Helpers purs** (AC1, AC2, AC3, AC5)
  - [ ] Créer `src/app/components/shop/ShopGammesSidebar.helpers.ts`
  - [ ] Helper `groupProductsByGamme(products, gammes): Map<slug, ShopProduct[]>` utilisant `resolveGamme()` existant
  - [ ] Helper `buildGammeTree(gammes): { roots: Gamme[], childrenByParent: Map<slug, Gamme[]> }` pour rendu hiérarchique
  - [ ] Helper `loadExpandedGammes(shopSlug): Set<string>` (lit localStorage, parse JSON array, defensive try/catch)
  - [ ] Helper `saveExpandedGammes(shopSlug, expanded: Set<string>): void` (sérialise Array.from(set), try/catch sur quota exceeded)
  - [ ] Helper `filterProductsByExpandedGammes(products, gammeMap, expandedSlugs): ShopProduct[]` (return all si expandedSlugs vide, sinon union des produits matchant)
  - [ ] Constante `EXPANDED_GAMMES_KEY_PREFIX = 'magrit_shop_expanded_gammes__'`

- [x] **Task 2 — Tests vitest helpers** (AC1, AC2, AC3, AC5)
  - [ ] Créer `tests/components/shop/ShopGammesSidebar.helpers.test.ts`
  - [ ] ≥ 4 cas pour `groupProductsByGamme` (happy path 3 gammes / produits sans gamme / cache memoïsation / 50 produits perf)
  - [ ] ≥ 3 cas pour `buildGammeTree` (hiérarchie 2 niveaux / racines seulement / orphelins parent_slug invalide)
  - [ ] ≥ 4 cas pour `loadExpandedGammes` / `saveExpandedGammes` (round-trip / localStorage absent en SSR / JSON malformed defensive / clé namespacée par shop)
  - [ ] ≥ 4 cas pour `filterProductsByExpandedGammes` (set vide → all / 1 gamme / 2 gammes union / set avec slug inconnu safe)

- [x] **Task 3 — Composant `ShopGammesSidebar.tsx`** (AC1, AC2, AC6)
  - [ ] Créer `src/app/components/shop/ShopGammesSidebar.tsx`
  - [ ] Props : `gammes: Gamme[]`, `products: ShopProduct[]`, `expandedSlugs: Set<string>`, `onToggleGamme: (slug: string) => void`, `className?: string`
  - [ ] Rendu : header "Gammes" mono uppercase + (si expandedSlugs.size > 0) badge `{N} FILTRES` (testid `shop-gammes-filter-badge`)
  - [ ] Liste des gammes racines (testid container `shop-gammes-list`) : chaque gamme = `<div data-testid="shop-gamme-row" data-gamme-slug={slug}>` avec button toggle (testid `shop-gamme-toggle-btn`)
  - [ ] Chevron rotatif + label + compteur mono `(N)` aligné droite
  - [ ] Sous-gammes indentées (pl-6) quand parent déplié (UI bonus, hors AC strict)
  - [ ] Boutons fully accessible : `aria-expanded`, `aria-label`, focus visible

- [x] **Task 4 — Intégrer dans `PublicShop`** (AC2, AC3, AC4)
  - [ ] Dans [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx), ajouter state `const [expandedGammes, setExpandedGammes] = useState<Set<string>>(new Set())`
  - [ ] `useEffect([slug])` au mount : `setExpandedGammes(loadExpandedGammes(slug ?? ''))`
  - [ ] `useEffect([expandedGammes, slug])` : `saveExpandedGammes(slug ?? '', expandedGammes)`
  - [ ] Handler `toggleGamme(slug)` : duplique le set, add/delete, setter
  - [ ] Calculer `filteredProducts` via `useMemo([products, gammeMap, expandedGammes])` puis le passer aux vues home/catalog/product
  - [ ] Calculer `gammeMap` via `useMemo([products, pimGammes])`
  - [ ] Passer `<ShopGammesSidebar gammes products expandedSlugs onToggleGamme />` au prop `leftSidebar` du `<ShopLayout>` (au lieu du placeholder default)
  - [ ] **CRITICAL** : passer `filteredProducts` (et non `products` brut) à `<PortalCatalog>` et `<PortalHome>` pour que la grille reflète le filtre

- [x] **Task 5 — Étendre `tenant_id` dans le SELECT shop** (AC1) — _déjà inclus dans `select('*')` actuel, lecture via cast_
  - [ ] Dans [PublicShop.tsx:103](src/app/components/shop/PublicShop.tsx#L103) `supabase.from('shops').select('*')` — vérifier que `tenant_id` est bien dans le retour (probablement OK avec `select('*')`)
  - [ ] Si pas le cas, ajouter explicitement `select('*, tenant_id')`. Type `Shop` dans `ShopsContext` n'expose pas officiellement `tenant_id` — accepter `(shop as Shop & { tenant_id?: string })` au site d'utilisation

- [x] **Task 6 — Charger les gammes souscrites du tenant** (AC1)
  - [ ] Dans `PublicShop`, après chargement du shop, fetch `tenant_gamme_subscriptions` :
    ```ts
    const { data: subs } = await supabase
      .from('tenant_gamme_subscriptions')
      .select('gamme_slug, active')
      .eq('tenant_id', shopData.tenant_id)
      .eq('active', true);
    const subscribedSlugs = new Set((subs ?? []).map(s => s.gamme_slug));
    setSubscribedGammes(subscribedSlugs);
    ```
  - [ ] Filtrer `pimGammes` par `subscribedSlugs` avant de les passer à `ShopGammesSidebar`
  - [ ] **Fallback** : si `subscribedSlugs.size === 0` (tenant pas configuré ou erreur RLS), passer toutes les gammes effectivement présentes dans les produits (via `gammeMap.keys()`)

- [x] **Task 7 — Étendre `testIds.ts`** (AC6)
  - [ ] Ajouter dans `shop` scope : `gammesList`, `gammeRow`, `gammeToggleBtn`, `gammesFilterBadge`

- [x] **Task 8 — Validation full suite + smoke visuel** (AC5) — _vitest 128/128 ✅, vite build 1.45s ✅, smoke visuel à valider Arnaud_
  - [ ] `pnpm exec vitest run` → 109 baseline + ~15 nouveaux ≥ 124/124 verts
  - [ ] `pnpm exec vite build` → 0 erreur TS strict, build success
  - [ ] Smoke visuel sur port 5177 : `/shop/<slug>` → vérifier sidebar gammes affichée, déplier 2 gammes, F5, état restauré
  - [ ] Pas de régression sur le flux home → catalog → product → cart

- [x] **Task 9 — Cas TF Notion P09 gammes dépliables** (DoD §5) — _draft dans Completion Notes, à coller manuellement_
  - [ ] Draft cas TF : "Boutique sidebar gammes dépliables persistantes" — IA Chrome déplie 2 gammes, vérifie filtre grille additif, F5 restauration

## Dev Notes

### Files NEW

- `src/app/components/shop/ShopGammesSidebar.tsx` — composant sidebar gammes
- `src/app/components/shop/ShopGammesSidebar.helpers.ts` — helpers purs (group, tree, localStorage, filter)
- `tests/components/shop/ShopGammesSidebar.helpers.test.ts` — 15+ cas vitest

### Files UPDATE

- `src/app/components/shop/PublicShop.tsx` — state expandedGammes + load/save effects + filteredProducts memoïsé + sidebar slot rempli + fetch tenant_gamme_subscriptions
- `src/app/lib/testIds.ts` — `gammesList`, `gammeRow`, `gammeToggleBtn`, `gammesFilterBadge`
- `_bmad-output/implementation-artifacts/story-S2.2-shop-gammes-sidebar.md` — frontmatter status post-livraison

### Files KEEP (non touchés)

- `src/app/components/shop/ShopLayout.tsx` — slot `leftSidebar` déjà prêt depuis S2.1
- `src/app/utils/productEnrichment.ts` — `resolveGamme` consommé tel quel

### Snippets clés

**Helper localStorage avec defensive try/catch** :
```typescript
const PREFIX = "magrit_shop_expanded_gammes__";

export function loadExpandedGammes(shopSlug: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(PREFIX + shopSlug);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s) => typeof s === "string"));
  } catch {
    return new Set();
  }
}

export function saveExpandedGammes(shopSlug: string, expanded: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + shopSlug, JSON.stringify(Array.from(expanded)));
  } catch {
    // QuotaExceededError ou storage disabled — silently degrade (l'etat session reste fonctionnel)
  }
}
```

**Filtre additif memoïsé dans `PublicShop`** :
```tsx
const gammeMap = useMemo(
  () => groupProductsByGamme(products, pimGammes),
  [products, pimGammes],
);

const filteredProducts = useMemo(
  () => filterProductsByExpandedGammes(products, gammeMap, expandedGammes),
  [products, gammeMap, expandedGammes],
);

// Puis : <PortalCatalog products={filteredProducts} ... />
```

**Sidebar rendu hierarchique** :
```tsx
<aside data-testid={TEST_IDS.shop.gammesList}>
  {expandedGammes.size > 0 && (
    <span data-testid={TEST_IDS.shop.gammesFilterBadge}>
      {expandedGammes.size} FILTRE{expandedGammes.size > 1 ? "S" : ""}
    </span>
  )}
  {visibleRoots.map((g) => {
    const isExpanded = expandedGammes.has(g.slug);
    const count = gammeMap.get(g.slug)?.length ?? 0;
    if (count === 0) return null;
    return (
      <div key={g.slug} data-testid={TEST_IDS.shop.gammeRow} data-gamme-slug={g.slug}>
        <button
          data-testid={TEST_IDS.shop.gammeToggleBtn}
          aria-expanded={isExpanded}
          aria-label={`Déplier la gamme ${g.name} (${count} produits)`}
          onClick={() => onToggleGamme(g.slug)}
        >
          {isExpanded ? <ChevronDown /> : <ChevronRight />} {g.name} ({count})
        </button>
      </div>
    );
  })}
</aside>
```

### DoD PR v1.1 (rappel architecture §5.10)

- [ ] Compile TS strict + ESLint clean
- [ ] Tests vitest associés (helpers purs)
- [ ] ≥ 1 cas TF Notion ajouté avec testid stable
- [ ] `testIds.ts` mis à jour
- [ ] Format commit : `feat(v5): catalogue gammes depliables persistantes (S2.2)`
- [ ] Confirmation Arnaud avant push

## Project Structure Notes

### Hypothèse RLS `tenant_gamme_subscriptions` lecture publique

Le SELECT côté `/shop/:slug` est anonyme (route publique). La RLS de `tenant_gamme_subscriptions` doit autoriser `SELECT` aux anon avec `active=true`. **À vérifier** dans la migration E9.6 ou lors du dev. Si RLS bloque, fallback Task 6 sur "gammes inférées depuis produits".

### Out of scope S2.2

- Drag & drop pour réordonner les gammes (futur)
- Recherche dans la sidebar gammes (futur si > 20 gammes affichées)
- Filtre par sous-gamme uniquement (toggle du parent inclut/exclut tous les enfants — comportement par défaut acceptable MVP)
- Animation expand/collapse Framer Motion (instant CSS via state suffit MVP)
- Hover preview produits dans la gamme

## References

- [Source: _bmad-output/planning-artifacts/epics.md#L379-L398] — Epic 2 / S2.2 AC original
- [Source: _bmad-output/planning-artifacts/architecture.md#L300-L328] — §4.3 Mockup Engine + §5.1 conventions
- [Source: _bmad-output/implementation-artifacts/story-S2.1-shop-layout-3col.md] — slot leftSidebar préparé
- [Source: _bmad-output/implementation-artifacts/story-S2.3-shop-product-card.md] — pattern helpers + tests
- [Source: src/app/utils/productEnrichment.ts] — `resolveGamme` + types `Gamme` / `MatchingRules`
- [Source: src/app/components/dashboard/DashboardTenantGammes.tsx] — pattern fetch `tenant_gamme_subscriptions`
- [Source: src/app/components/shop/ShopLayout.tsx#L49] — prop `leftSidebar` déjà accepté (placeholder default)
- [Source: src/app/contexts/ConversationContext.tsx#L125-L201] — pattern localStorage namespacé par tenant_id (à transposer en namespacé par shop_slug pour S2.2)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — story creation + dev implementation 2026-05-10

### Debug Log References

- 1er run vitest avec mock localStorage incomplet (`clear()` manquant) → 7 fails. Corrigé en utilisant un mock complet via `(globalThis as any).window.localStorage = { getItem, setItem, removeItem, clear }` injecté dans `beforeEach`. 19/19 verts au 2e run.
- Pattern repo respecté : helpers logiques purs `*.helpers.ts` + tests `tests/components/shop/*.helpers.test.ts`. Pas de test rendering React (env vitest = node, no `@testing-library/react`).

### Completion Notes List

#### Décisions d'implémentation

1. **Set explicite `NO_GAMME_KEY = '__no_gamme__'`** dans le helper `groupProductsByGamme` : les produits non-matchant à une gamme PIM sont placés sous cette clé sentinelle. La sidebar les masque (count > 0 only) — pas d'UI vide. Permet aussi d'identifier facilement les produits "orphelins" pour debug.

2. **`buildGammeTree` 2 niveaux** : racines (`parent_slug === null` OU `parent_slug` pointant vers un slug inexistant → promu en racine pour ne pas perdre l'orphelin). Pas de récursion N niveaux MVP — Magrit PIM a 2 niveaux max d'après `DashboardTenantGammes.tsx`. Si un jour 3+ niveaux nécessaires, étendre récursivement.

3. **localStorage namespace par shop slug** (pas par tenant) : un user multi-shop a un état indépendant par shop. Clé : `magrit_shop_expanded_gammes__{shop.slug}`. Cohérent avec le pattern `magrit_current_conversation__{tenant_id}` existant (ConversationContext) — le scope diffère mais le pattern de clé localStorage est aligné.

4. **`subscribedSlugs: Set<string> | null`** : `null` = pas de tenant_id sur shop OU lecture RLS bloquée → fallback "gammes inférées depuis les produits matches". Empty Set possible mais traité comme `null` côté `visibleGammes` (cf. snippet ci-dessous). Évite l'UI vide quand RLS bloque.

5. **Sous-gammes filtre indépendamment du parent** : cliquer sur une sous-gamme dans la sidebar ajoute uniquement cette sous-gamme au filtre actif, pas son parent. Comportement intuitif : l'acheteur peut cibler "carte-visite" sans afficher les autres "carterie".

6. **Composant ShopGammesSidebar reçoit `isDark`** explicitement (vs lire data-theme du DOM ou un context). Cohérent avec ShopLayout qui passe le même flag aux placeholders. Évite les couplages au runtime.

7. **`visibleRoots` filtré par count > 0** (somme directe + sous-gammes) : si un parent n'a aucun produit ni en direct ni dans ses enfants, il est masqué. Évite UI bruitée. AC1 spécifie ce comportement.

8. **`useMemo` partout** où c'est utile (gammeMap, filteredProducts, visibleGammes, gammeTree dans le composant) — cohérent avec NFR perf ≥ 50 produits AC5.

9. **Persistance auto-save sur chaque toggle** via `useEffect([slug, expandedGammes])` — pas de debounce nécessaire (toggles sont peu fréquents, opération localStorage rapide).

#### Tests livrés

| Fichier | Cas | Statut |
|---|---|---|
| `tests/components/shop/ShopGammesSidebar.helpers.test.ts` | 19 cas (4 group + 3 tree + 7 localStorage round-trip/defensive + 5 filter additif) | ✅ 19/19 |
| Full vitest suite | 109 baseline + 19 nouveaux = **128 cas** | ✅ 128/128, 0 régression |
| Vite build | TypeScript strict + production bundle | ✅ 1.45s success |

#### Draft cas TF Notion P09 — à coller manuellement

🔗 https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c

**TF P09-S2.2 — Sidebar gammes dépliables persistantes**
- **Parcours** : P09 — Boutique portail B2B (catalogue + sidebar gammes)
- **Persona** : Acheteur B2B (anonyme ou shop_only autorisé)
- **Précondition** :
  - Shop active avec ≥ 3 gammes souscrites côté tenant (table `tenant_gamme_subscriptions`).
  - ≥ 5 produits dans le catalogue mappant à au moins 2 gammes différentes (kind='flyer' + kind='carte_visite' + kind='brochure').
- **Étapes** :
  1. Naviguer vers `http://localhost:5177/shop/<slug>` (ou prod si déployé)
  2. Vue catalog → vérifier sidebar gauche `data-testid="shop-gammes-list"` rendue avec ≥ 1 `data-testid="shop-gamme-row"` + compteurs `(N)`
  3. Cliquer le chevron de "Cartes commerciales" (toggle expand) → la grille produits filtre sur cette gamme uniquement
  4. Cliquer le chevron de "Brochures" → les 2 gammes restent dépliées, grille = union des 2
  5. Vérifier badge `data-testid="shop-gammes-filter-badge"` présent et affiche "2 FILTRES"
  6. Naviguer catalog → product (clic sur une card) puis revenir catalog → sidebar et grille restent dans le même état (filtre + déplié préservé)
  7. F5 (refresh page) → état persisté (localStorage), 2 gammes toujours dépliées + grille filtrée
  8. Reclick chevron "Brochures" → seul "Cartes commerciales" reste, grille filtre sur 1 gamme, badge "1 FILTRE"
  9. Reclick chevron "Cartes commerciales" → toutes gammes refermées, grille montre tous les produits, badge masqué
  10. Tab clavier sur les chevrons → focus visible (ring 2px accent), Enter/Space toggle, `aria-expanded` cohérent
- **Résultat attendu** : navigation gammes fluide, filtre additif intuitif, persistance F5 + navigation interne, a11y clavier OK.
- **Hints DOM** : `data-testid="shop-gammes-list"`, `data-testid="shop-gamme-row"` (collection avec `data-gamme-slug={slug}`), `data-testid="shop-gamme-toggle-btn"`, `data-testid="shop-gammes-filter-badge"` (conditionnel), `localStorage.getItem('magrit_shop_expanded_gammes__<slug>')`
- **URL de départ** : `http://localhost:5177/shop/<slug-actif>` (port 5177 dev, prod si déployé)
- **Type d'exécution** : Manuel humain + IA Chrome (MCP)
- **Données de test** : tenant `imprimerie-ipa` ou `boutique-1` actifs avec ≥ 3 gammes souscrites en B5 (vérifier via DashboardTenantGammes)
- **Statut** : À jouer

### File List

**NEW**
- `src/app/components/shop/ShopGammesSidebar.tsx` — composant sidebar gammes hiérarchique
- `src/app/components/shop/ShopGammesSidebar.helpers.ts` — helpers purs (group/tree/localStorage/filter)
- `tests/components/shop/ShopGammesSidebar.helpers.test.ts` — 19 cas vitest

**UPDATE**
- `src/app/components/shop/PublicShop.tsx` — state `expandedGammes` + `subscribedSlugs` + 2 effets load/save localStorage + `useMemo` `gammeMap` / `filteredProducts` / `visibleGammes` + fetch `tenant_gamme_subscriptions` post-shop-load + `<ShopGammesSidebar>` câblé au prop `leftSidebar` du `<ShopLayout>` + `filteredProducts` passé aux vues home/catalog
- `src/app/lib/testIds.ts` — `gammesList`, `gammeRow`, `gammeToggleBtn`, `gammesFilterBadge`
- `_bmad-output/implementation-artifacts/story-S2.2-shop-gammes-sidebar.md` — frontmatter status=review, tasks [x], Dev Agent Record rempli

**KEEP (non touchés)**
- `src/app/components/shop/ShopLayout.tsx` — slot `leftSidebar` déjà prêt depuis S2.1, reçoit maintenant `<ShopGammesSidebar>` au lieu du placeholder default
- `src/app/utils/productEnrichment.ts` — `resolveGamme` consommé tel quel
- `src/app/components/dashboard/DashboardTenantGammes.tsx` — pattern source pour `tenant_gamme_subscriptions`

### Change Log

| Date | Modification | Commit prévu |
|---|---|---|
| 2026-05-10 | Story spec créée par bmad-create-story | (story doc, à committer) |
| 2026-05-10 | S2.2 implémentée : sidebar gammes hiérarchique avec compteurs + filtre additif + persistance localStorage par shop. Lecture publique `tenant_gamme_subscriptions` avec fallback gammes inférées. 19 nouveaux tests vitest, 0 régression (128/128), vite build 1.45s. | `feat(v5): catalogue gammes depliables persistantes (S2.2)` |
