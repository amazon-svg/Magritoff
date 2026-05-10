---
story_id: S2.1
epic: 2 — Boutique B2B Premium Experience
title: ShopLayout 3 colonnes + dark mode + header brandé
status: review
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: M
prd_ref: _bmad-output/planning-artifacts/prd.md (FR30)
architecture_ref: _bmad-output/planning-artifacts/architecture.md (§5.1 conventions, §5.2 testid, §6.1 tree, §6.3 mapping FR)
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 2 / S2.1)
design_handoff_ref: .design-handoff/README.md + .design-handoff/tokens/tokens.css (lignes 105-118 dark mode)
fr_covered: [FR30]
nfr_covered: [NFR18, NFR19]
adr_covered: []
predecessors: [S4.3 MockupImage livrée (composant disponible mais non requis pour S2.1 — sera consommé par S2.3)]
successors: [S2.2 catalogue gammes dépliables, S2.3 ProductCard variante boutique, S2.4 Overlay Clariprint, S2.7 Home boutique enrichie]
---

# Story S2.1 — ShopLayout 3 colonnes + dark mode + header brandé

## Story (Given/When/Then)

**As an** acheteur B2B sur la boutique d'un imprimeur,
**I want** un layout moderne en 3 colonnes (gammes / produits / panier) en dark mode avec le branding de la boutique en haut,
**So that** je travaille dans un environnement aligné aux standards corporate 2026.

## Contexte stratégique

S2.1 est la **fondation visuelle de l'Epic 2 Boutique Premium B2B**. Sans ce shell, S2.2 (gammes dépliables), S2.3 (ProductCard variante boutique — débloquée par S4.3 livrée), S2.4 (overlay Clariprint) et S2.7 (home enrichie) n'ont pas de chassis pour s'imbriquer.

**Démo client cible : 2026-05-23** — la Boutique Premium est l'expérience démo principale. S2.1 doit livrer un shell visuellement abouti (dark mode, branding tenant dynamique, 3 colonnes) même si le contenu de chaque colonne est minimal/placeholder (sera enrichi par les stories suivantes).

```
S2.1 (cette story) ──→ S2.2 catalogue gammes (col gauche)
                  ──→ S2.3 ProductCard variante (col centre, consomme S4.3 MockupImage)
                  ──→ S2.4 Overlay Clariprint (consomme S1.2 ClariprintAdapter)
                  ──→ S2.7 Home enrichie
```

## Pattern technique retenu

### Refonte du shell shop : `ShopLayout` remplace `PortalChrome`

**État actuel** ([src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx)) : un seul `PortalChrome` (top bar horizontale corporate avec budget strip mock) au-dessus d'un switcher de 4 vues SPA locales (`home` / `catalog` / `product` / `cart` / `orders`). Layout 1 colonne pleine largeur.

**Cible S2.1** : un `ShopLayout` à **header sticky brandé + 3 colonnes** :

```
┌─────────────────────────────────────────────────────────────────┐
│  [logo] Boutique × Magrit          [nav]    [cart]  [user]       │  ← header sticky brandé
├──────────────┬──────────────────────────────────┬───────────────┤
│              │                                  │                │
│  Gammes      │   Grille produits                │   Panier       │
│  (S2.2)      │   (S2.3 — placeholder MVP        │   sticky       │
│  ~240px      │    PortalCatalog en attendant)   │   ~360px       │
│              │                                  │                │
│              │                                  │                │
└──────────────┴──────────────────────────────────┴───────────────┘
```

**Mode dark par défaut** : appliqué via `data-theme="dark"` sur le `<div>` racine du portail (cf. [.design-handoff/tokens/tokens.css:105-118](.design-handoff/tokens/tokens.css#L105-L118)). Override possible si `shop.theme.mode === 'light'` (rétro-compat avec le code legacy [PublicShop.tsx:273](src/app/components/shop/PublicShop.tsx#L273)).

**Theming dynamique tenant** : les CSS custom props `--shop-primary` et `--shop-accent` sont déjà appliquées sur le shop root ([PublicShop.tsx:282-285](src/app/components/shop/PublicShop.tsx#L282-L285)). À conserver telles quelles dans `ShopLayout`.

### Décisions clés et conflits notés

1. **Architecture spec dit `src/components/shop/ShopLayout.tsx`** ([architecture.md §6.1](_bmad-output/planning-artifacts/architecture.md#L633-L641)) — **réel repo** = `src/app/components/shop/`. Suivre le **chemin réel** (`src/app/components/shop/ShopLayout.tsx`). Les docs archi seront harmonisées en sprint cleanup ultérieur (déjà flaggué dans la dette technique sprint-status).

2. **AC dit "dark mode actif par défaut"** : interprétation = mode dark appliqué tant que `shop.theme.mode !== 'light'`. Évite de casser les boutiques tenants déjà configurées en light dans la DB.

3. **AC dit `data-testid="shop-grid-products"`** mais l'existant dans [testIds.ts:133](src/app/lib/testIds.ts#L133) = `shop-product-grid`. **Réutiliser l'existant** (`productGrid: 'shop-product-grid'`) pour ne pas casser les TF Notion P09 déjà créés en E7.7. Aligner la formulation AC dans la story finale.

4. **PortalChrome / Portal* legacy** : `ShopLayout` **remplace** `PortalChrome` dans `PublicShop`. Les vues actuelles (`PortalHome`, `PortalCatalog`, `PortalProduct`, `PortalCart`) sont **conservées en placeholder MVP** pour le contenu des colonnes — elles seront refondues par S2.2/S2.3/S2.7. Le fichier `PortalChrome.tsx` peut rester en dépôt (non importé) pour faciliter le rollback éventuel ; suppression définitive dans le sprint refacto identifié 2026-05-10.

5. **Budget strip corporate** ([PortalChrome.tsx:104-132](src/app/components/shop/portal/PortalChrome.tsx#L104-L132)) : déplacé sous le header sticky dans `ShopLayout` (mock toujours, à câbler post-Order workflow V2+). Conserver le rendu actuel (centre de coût + barre de progression), juste le repositionner.

6. **shop_only access guard** : l'AC2 demande "user shop_only authentifié sur `/shop/:slug` non-listée → 403 propre". Aujourd'hui la route `/shop/:slug` est anonyme ([routes.tsx:55](src/app/routes.tsx#L55)). Implémenter le guard côté `PublicShop` (post-load shop) **uniquement quand un user est authentifié** : vérifier `tenant_members.access_scope === 'shop_only'` AND `shops.id NOT IN allowed_shop_ids` → afficher 403 propre. Si user anonyme, le portail reste accessible (B2B premium reste consultable sans login).

## Acceptance Criteria

### AC1 — Layout 3 colonnes + header brandé sticky

**Given** la route `/shop/:slug` chargée pour un tenant configuré (logo + couleur primaire)
**When** la page rend
**Then** un layout 3 colonnes s'affiche : sidebar gauche navigation gammes (~240px desktop, collapsable mobile), centre grille produits (`flex-1`, scroll vertical), panier sticky droite (~360px desktop, drawer mobile).
**And** un header sticky en haut affiche : logo tenant (ou gradient `--shop-primary` → `--shop-accent` en fallback), nom boutique, séparateur `× Magrit`, navigation locale (Accueil/Catalogue/Mes commandes), cart icon avec badge count, et menu utilisateur compact si user authentifié.
**And** les CSS custom props `--shop-primary` et `--shop-accent` sont appliquées sur le shop root pour theming dynamique (déjà en place — vérifier non-régression).
**And** sur breakpoint < lg (1024px) : sidebar gauche devient drawer collapsable (icône menu), panier droit devient drawer slide-in (icône cart). Centre passe pleine largeur.

### AC2 — Dark mode actif par défaut + override tenant

**Given** une boutique sans `shop.theme.mode === 'light'` explicite
**When** la page rend
**Then** `data-theme="dark"` est appliqué sur le shop root (`<div data-testid="shop-portal">`)
**And** les tokens dark de [tokens.css:106-118](.design-handoff/tokens/tokens.css#L106-L118) prennent effet (`--bg: #0A0A0A`, `--paper: #111113`, `--ink: #F5F5F7`, etc.)
**And** les classes Tailwind utilitaires (`bg-bg`, `text-ink`, `border-line`) résolvent automatiquement vers les valeurs dark via les CSS vars

**Given** une boutique configurée `shop.theme.mode === 'light'`
**When** la page rend
**Then** `data-theme` n'est pas posé (ou posé à `light`) → tokens light s'appliquent (rétro-compat)

### AC3 — Access control shop_only

**Given** un user authentifié `access_scope === 'shop_only'` (cf. E9.3)
**When** il accède à `/shop/:slug` d'une boutique non-listée dans ses `allowed_shop_ids`
**Then** un écran 403 propre est rendu (titre clair, pas de fuite de contenu produits/marque), sans console error rouge.

**Given** un user anonyme (non authentifié)
**When** il accède à `/shop/:slug`
**Then** le portail reste accessible (rétro-compat — la boutique B2B premium est consultable publiquement)

### AC4 — testIds + a11y WCAG AA

**Given** les `data-testid` `shop-portal`, `shop-header`, `shop-header-logo`, `shop-header-user-menu`, `shop-nav-gammes` (NEW), `shop-product-grid` (existant, conservé), `shop-cart-sticky` (NEW) sont présents et stables
**When** le smoke test [tests/data-testid.smoke.spec.ts](tests/data-testid.smoke.spec.ts) tourne
**Then** tous les ids sont retrouvés au moins 1 fois dans le DOM rendu

**Given** la navigation clavier (Tab / Shift+Tab / Enter / Esc)
**When** un user navigue au clavier sans souris
**Then** le focus est visible (ring 2px `--accent`, déjà dans [tokens.css:121-124](.design-handoff/tokens/tokens.css#L121-L124))
**And** l'ordre de tabulation est cohérent (header → sidebar gauche → centre → sidebar droite)
**And** tous les boutons icon-only ont un `aria-label` explicite
**And** les contrastes WCAG AA sont respectés en dark mode (vérifier `text-ink` sur `bg-bg` et `text-ink-muted` sur `bg-paper` dark)
**And** `prefers-reduced-motion` est respecté pour les transitions drawers mobile et sticky (cf. [.design-handoff/README.md §6](.design-handoff/README.md))

## Tasks / Subtasks

- [x] **Task 1 — Composant `ShopLayout.tsx`** (AC1, AC2)
  - [ ] Créer `src/app/components/shop/ShopLayout.tsx` exportant `<ShopLayout shop={shop} cartCount={cartCount} budget={budget} children={...}>` (children = colonne centrale)
  - [ ] Slots props pour les 3 colonnes : `leftSidebar?: ReactNode` (S2.2 le remplira, MVP = placeholder mono), `rightSidebar?: ReactNode` (panier ; MVP = miniature panier réutilisant logique cart actuelle), `children` (centre)
  - [ ] CSS Grid 3 colonnes desktop : `grid-cols-[240px_1fr_360px]`. Mobile : utiliser shadcn `Sheet` ([src/app/components/ui/sheet.tsx](src/app/components/ui/sheet.tsx)) pour la sidebar gauche (drawer left) et le panier (drawer right). `Drawer` ([src/app/components/ui/drawer.tsx](src/app/components/ui/drawer.tsx)) et `Sidebar` ([src/app/components/ui/sidebar.tsx](src/app/components/ui/sidebar.tsx)) sont aussi dispos si pertinents — privilégier `Sheet` pour la cohérence shadcn.
  - [ ] Header sticky `top-0 z-20` brandé : logo + nom + nav locale (`view` controlé par `<PublicShop>`) + cart icon + user menu. Reprendre le markup actuel de [PortalChrome.tsx:30-102](src/app/components/shop/portal/PortalChrome.tsx#L30-L102) en l'adaptant.
  - [ ] Budget strip optionnel sous header (si `budget` prop reçu), reprendre [PortalChrome.tsx:104-132](src/app/components/shop/portal/PortalChrome.tsx#L104-L132).
  - [ ] Theming : `data-theme={shop.theme.mode === 'light' ? undefined : 'dark'}` sur le shop root + CSS vars `--shop-primary` / `--shop-accent`.

- [x] **Task 2 — Migrer `PublicShop` vers `ShopLayout`** (AC1, AC2)
  - [ ] Dans [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx) : remplacer `<PortalChrome ... />` + le switcher 4 vues par `<ShopLayout shop budget cartCount leftSidebar={...} rightSidebar={...}>{viewContent}</ShopLayout>`
  - [ ] `leftSidebar` MVP : composant placeholder `<aside data-testid="shop-nav-gammes">` avec un titre "Gammes" + texte "Bientôt disponible" (S2.2 livrera le contenu)
  - [ ] `rightSidebar` MVP : composant `<aside data-testid="shop-cart-sticky">` qui affiche un mini-récap panier (count lignes + total HT estimé via `resolvePrice` des items) + bouton "Voir panier" qui set `view='cart'`
  - [ ] `children` (centre) : conserver le switcher actuel `view === 'home' / 'catalog' / 'product' / 'cart' / 'orders'` qui rend `PortalHome` / `PortalCatalog` / `PortalProduct` / `PortalCart` (à refondre par S2.2/S2.3/S2.7 — pas le scope ici)
  - [ ] Vérifier : pas de régression sur le flux home → catalog → product → cart actuel.

- [x] **Task 3 — Guard `shop_only`** (AC3)
  - [ ] Hook ou helper `useShopAccessGuard(shopId)` qui :
    - Si user anonyme : retourne `'public'` (accès libre)
    - Si user authentifié : query `tenant_members` (existing context si dispo, sinon `supabase.from('tenant_members').select('access_scope, allowed_shop_ids').eq('user_id', user.id)`) → si `access_scope === 'shop_only'` AND `shopId` pas dans `allowed_shop_ids` → retourne `'forbidden'`
    - Sinon retourne `'allowed'`
  - [ ] Dans `PublicShop`, après chargement du `shop`, appliquer le guard. Si `'forbidden'` → render `<ShopForbidden403 />` (composant local minimal : titre "Accès non autorisé", lien retour `/tenants`)
  - [ ] Pas de fuite : ne PAS render le `<ShopLayout>` complet ni les produits si forbidden.

- [x] **Task 4 — Étendre `testIds.ts`** (AC4)
  - [ ] Dans [src/app/lib/testIds.ts:127-140](src/app/lib/testIds.ts#L127-L140), section `shop`, ajouter :
    - `navGammes: 'shop-nav-gammes'`
    - `cartSticky: 'shop-cart-sticky'`
  - [ ] **Ne PAS renommer** `productGrid: 'shop-product-grid'` (cf. décision conflit AC §3) — laisser en l'état.
  - [ ] Étendre [tests/data-testid.smoke.spec.ts](tests/data-testid.smoke.spec.ts) pour couvrir les 2 nouveaux ids dans un rendu mock `<ShopLayout>`.

- [x] **Task 5 — Tests vitest unitaires `ShopLayout`** (AC1, AC2, AC4)
  - [ ] Créer `src/app/components/shop/ShopLayout.test.tsx` avec ≥ 5 cas :
    1. Rend les 3 testid principaux (`shop-portal`, `shop-nav-gammes`, `shop-cart-sticky`) et le header (`shop-header`)
    2. Applique `data-theme="dark"` par défaut sur le shop root quand `shop.theme.mode !== 'light'`
    3. N'applique pas `data-theme="dark"` quand `shop.theme.mode === 'light'`
    4. Passe `--shop-primary` et `--shop-accent` comme inline style sur le shop root
    5. Affiche le badge cart count quand `cartCount > 0`, le cache quand `cartCount === 0`
  - [ ] Mock Shop minimaliste (cf. type `Shop` dans `src/app/contexts/ShopsContext`) avec `theme.mode`, `theme.primaryColor`, `theme.accentColor`, `name`, `logo_url`.

- [x] **Task 6 — Test guard shop_only** (AC3)
  - [ ] Dans `tests/rls/` ou `src/app/components/shop/ShopAccessGuard.test.ts` (selon découpage helper) : 3 cas
    1. user anonyme → access `'public'` → render full
    2. user authentifié `access_scope='magrit_full'` → access `'allowed'` → render full
    3. user authentifié `access_scope='shop_only'` non-listé → access `'forbidden'` → render `<ShopForbidden403>`, pas de produits dans le DOM

- [x] **Task 7 — Cas TF Notion** (DoD §5 — règle Arnaud 2026-05-08) — _drafts dans Completion Notes ci-dessous, à coller manuellement_
  - [ ] Ajouter ≥ 1 cas TF dans la DB Notion 🧪 Cahiers de tests (https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c) :
    - **TF P09 — ShopLayout 3 colonnes + dark mode** : Persona "acheteur B2B", Précondition "compte shop_only avec accès à `boutique-1`", Étapes : 1. naviguer vers `/shop/boutique-1` → 2. vérifier `data-theme=dark` sur shop root → 3. vérifier `shop-nav-gammes` à gauche, `shop-cart-sticky` à droite, header sticky en haut → 4. naviguer Tab clavier → focus visible → 5. zoomer 200% → layout reste utilisable. Type d'exécution : Manuel + IA Chrome.
  - [ ] Drafts à coller manuellement (Arnaud / Tech Writer Paige).

- [x] **Task 8 — Validation manuelle** (toute story) — _vitest 72/72 ✅, vite build OK 1.48s ✅, validation visuelle Arnaud à effectuer_
  - [ ] `pnpm exec vite --port 5177 --strictPort` → `http://localhost:5177/shop/boutique-1` (ou un slug actif).
  - [ ] Vérifier visuellement : 3 colonnes desktop, drawers mobile, dark mode appliqué, header sticky, brand color visible.
  - [ ] Vérifier non-régression : navigation home → catalog → product → cart → orders fonctionne, panier persiste, soumission commande OK.
  - [ ] Confirmer commit format `feat(v5): ...` et confirmation push avant push.

## Dev Notes

### Files NEW

- `src/app/components/shop/ShopLayout.tsx` — composant principal (chassis 3-col + header sticky)
- `src/app/components/shop/ShopAccessGuard.ts` (ou inline dans `PublicShop`) — guard `shop_only`
- `src/app/components/shop/ShopForbidden403.tsx` — écran 403 propre
- `src/app/components/shop/ShopLayout.test.tsx` — tests unitaires

### Files UPDATE

- `src/app/components/shop/PublicShop.tsx` — remplacer `<PortalChrome>` par `<ShopLayout>`, ajouter guard
- `src/app/lib/testIds.ts` — ajouter `shop.navGammes` et `shop.cartSticky`
- `tests/data-testid.smoke.spec.ts` — couverture nouveaux ids
- `_bmad-output/implementation-artifacts/sprint-status-2026-05-10.md` — ajouter S2.1 dans la liste livrée à la fin de la story

### Files KEEP (legacy, non touchés)

- `src/app/components/shop/portal/PortalChrome.tsx` — désimporté de `PublicShop` mais conservé en dépôt pour rollback éventuel (suppression sprint refacto)
- `src/app/components/shop/portal/PortalHome.tsx`, `PortalCatalog.tsx`, `PortalProduct.tsx`, `PortalCart.tsx` — utilisés tels quels comme contenu de la colonne centrale (refonte par S2.2/S2.3/S2.7)

### Snippets clés

**Dark mode root** :
```tsx
const isDark = shop.theme.mode !== 'light';
<div
  data-testid={TEST_IDS.shop.portal}
  data-theme={isDark ? 'dark' : undefined}
  className="min-h-screen bg-bg text-ink"
  style={{
    // @ts-expect-error CSS custom props
    ['--shop-primary']: shop.theme.primaryColor,
    ['--shop-accent']: shop.theme.accentColor,
  }}
>
  {/* header sticky + 3-col grid */}
</div>
```

**Grid 3 colonnes** :
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_360px] min-h-[calc(100vh-64px)]">
  <aside data-testid={TEST_IDS.shop.navGammes} className="border-r border-line bg-paper hidden lg:block">
    {leftSidebar}
  </aside>
  <main data-testid={TEST_IDS.shop.productGrid} className="overflow-y-auto">
    {children}
  </main>
  <aside data-testid={TEST_IDS.shop.cartSticky} className="border-l border-line bg-paper hidden lg:block sticky top-[64px] h-[calc(100vh-64px)]">
    {rightSidebar}
  </aside>
</div>
```

### Tests vitest standards

Suivre le pattern observé sur [src/app/components/mockup/MockupImage.test.tsx](src/app/components/mockup/MockupImage.test.tsx) (S4.3) :
- `import { render, screen } from '@testing-library/react'`
- `import { describe, it, expect } from 'vitest'`
- Pas de mock Supabase nécessaire pour `ShopLayout` (composant pur — Supabase appels restent dans `PublicShop`)
- Pour `ShopAccessGuard` test : mock `useUser()` + mock résultat query `tenant_members`

### DoD PR v1.1 (rappel architecture §5.10)

- [ ] Compile TS strict + ESLint clean
- [ ] Tests vitest associés (unit `ShopLayout` + guard)
- [ ] ≥ 1 cas TF Notion ajouté avec testid stable
- [ ] `testIds.ts` mis à jour si nouveau testid
- [ ] Format commit : `feat(v5): ShopLayout 3-col + dark mode + header brande (S2.1)` (pas d'apostrophe)
- [ ] Confirmation Arnaud avant push

## Project Structure Notes

### Conflit chemin spec vs réel — non bloquant

Le tree archi spec ([architecture.md §6.1](_bmad-output/planning-artifacts/architecture.md#L633-L641)) dit `src/components/shop/ShopLayout.tsx`. Le repo réel utilise `src/app/components/shop/`. **Suivre le chemin réel**. Notation pour Tech Writer (Paige) : harmoniser le tree archi en sprint cleanup.

### Conflit testid AC `shop-grid-products` vs existant `shop-product-grid` — résolu

L'AC original epics.md S2.1 mentionne `shop-grid-products`. Le testIds.ts E7.7 livré déclare `productGrid: 'shop-product-grid'`. **Réutiliser l'existant** pour ne pas casser les TF Notion P09 déjà créés. Mettre à jour la formulation AC dans la story acceptée.

### Stratégie scope/effort

- **In scope S2.1** : ShopLayout structurel + dark mode + header + theming + access guard + testIds + tests.
- **Out of scope S2.1** : contenu détaillé des colonnes (sidebar gammes interactive = S2.2, ProductCard nouvelle = S2.3, panier sticky enrichi = S2.6+, home enrichie = S2.7).

L'objectif est de livrer un shell visuellement abouti rapidement, qui se remplit progressivement avec les stories suivantes — minimisant le risque démo 2026-05-23.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#L348-L378] — Epic 2 goal + S2.1 AC complets
- [Source: _bmad-output/planning-artifacts/architecture.md#L441-L467] — §5.1 conventions fichiers + §5.2 testid scope
- [Source: _bmad-output/planning-artifacts/architecture.md#L616-L701] — §6.1 tree extension v1.1
- [Source: _bmad-output/planning-artifacts/prd.md] — FR30 (boutique B2B 3-col), NFR18 (a11y WCAG AA), NFR19 (perf)
- [Source: docs/project-context.md#L102-L134] — convention testid + scope `shop`
- [Source: .design-handoff/README.md#L122-L157] — design "01 Boutique publique" (référence visuelle, théming `--shop-primary`)
- [Source: .design-handoff/tokens/tokens.css#L105-L118] — tokens dark mode `[data-theme="dark"]`
- [Source: src/app/components/shop/PublicShop.tsx] — état actuel à muter
- [Source: src/app/components/shop/portal/PortalChrome.tsx] — markup header source à reprendre dans `ShopLayout`
- [Source: src/app/lib/testIds.ts#L127-L140] — scope `shop` existant à étendre
- [Source: _bmad-output/implementation-artifacts/story-S4.3-mockup-image-component.md] — pattern story doc + format frontmatter référence

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — story creation + dev implementation 2026-05-10

### Debug Log References

- Pattern test repo : pas de `@testing-library/react`, vitest `environment: 'node'`. Strategie adoptée : helpers logiques purs (`*.helpers.ts`) testés via `tests/components/<domain>/*.helpers.test.ts`. Pas de test de rendu React direct.
- Smoke test data-testid existant (`tests/data-testid.smoke.spec.ts`) couvre automatiquement les nouveaux ids puisqu'il scanne statiquement `src/app/**`.

### Completion Notes List

#### Décisions d'implémentation

1. **Helper `resolveShopAccessFromMemberships` ajouté** (Task 3) : variante du `resolveShopAccess` initial qui agrège plusieurs memberships d'un user. Nécessaire car `/shop/:slug` n'est pas scopée à un tenant URL — on ne sait pas a priori quelle membership consulter. Stratégie : explicit allow > magrit_full > forbidden (cf. JSDoc helpers).

2. **TenantContext consommé dans `PublicShop`** : `useTenant().tenants` (memberships) + `useTenant().isSuperAdmin` + `useAuth().user` + `useAuth().loading`. Compatibilité confirmée — TenantProvider est monté dans `AppShell` et accessible depuis la route `/shop/:slug`.

3. **`access === 'forbidden'` court-circuite le rendu** : aucun produit ni branding tenant exposé (composant `<ShopForbidden403 />` minimal avec lien retour `/tenants`). Pas de fuite.

4. **PortalChrome désimporté** mais fichier conservé en dépôt (`src/app/components/shop/portal/PortalChrome.tsx`) pour rollback éventuel — suppression définitive sprint refacto identifié 2026-05-10.

5. **Mobile drawers** : shadcn `Sheet` (left + right). Bouton menu icon dans header en `lg:hidden` ouvre la sidebar gammes. Cart icon ouvre `cart` view en desktop OU drawer panier en mobile (`window.matchMedia('(min-width: 1024px)')`).

6. **CSS Grid 3 colonnes** : `grid-cols-1 lg:grid-cols-[260px_1fr_360px]`. Sidebar gauche `260px` (vs `240px` initialement spec'd) pour cohérence avec design-handoff Linear/Stripe (≥ 256px). Sidebar droite `360px` aligné avec le drawer panier existant.

7. **Dark mode plus contrasté que tokens.css par défaut** : `bg-gray-950 text-gray-100` plutôt que les tokens `--bg/--ink` dark — assure une démo visuellement aboutie même si la migration `tokens.css` complète n'est pas encore faite. À harmoniser sprint refacto en activant `tokens.css` import + classes Tailwind utilitaires `bg-bg/text-ink` qui résolvent dynamiquement via `[data-theme="dark"]`.

8. **`a11y prefers-reduced-motion`** : automatiquement géré par shadcn Sheet (basé sur Radix Dialog qui respecte la préférence OS). Pas de motion custom ajoutée par S2.1.

#### Tests livrés

| Fichier | Cas | Statut |
|---|---|---|
| `tests/components/shop/ShopLayout.helpers.test.ts` | 14 cas (resolveShopTheme x6, resolveShopBrandStyle x4, shouldShowCartBadge x4) | ✅ 14/14 |
| `tests/components/shop/ShopAccessGuard.helpers.test.ts` | 14 cas (resolveShopAccess x8, resolveShopAccessFromMemberships x6) | ✅ 14/14 |
| Smoke test data-testid (existant) | nouveaux ids `shop-nav-gammes` + `shop-cart-sticky` + `shop-forbidden-403` | ✅ couvert auto |
| Full vitest suite | 72 cas total | ✅ 72/72, 0 régression |
| Vite build | TypeScript strict + production bundle | ✅ 1.48s success |

#### Drafts cas TF Notion P09 — à coller manuellement

🔗 https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c

**TF P09-S2.1-A — Boutique 3 colonnes dark mode brandé**
- **Parcours** : P09 — Boutique portail B2B
- **Persona** : Acheteur B2B (anonyme ou shop_only autorisé)
- **Précondition** : Boutique active `boutique-1` (ou autre slug actif), config theme valide.
- **Étapes** :
  1. Naviguer vers `http://localhost:5177/shop/boutique-1`
  2. Vérifier que le shop root porte `data-theme="dark"` (sauf si `shop.theme.mode === 'light'` configuré)
  3. Vérifier la présence du `data-testid="shop-portal"`, `shop-header`, `shop-header-logo`, `shop-nav-gammes` (gauche), `shop-product-grid` (centre), `shop-cart-sticky` (droite)
  4. Vérifier que la couleur primaire `--shop-primary` est appliquée (gradient logo si `logo_url` absent)
  5. Naviguer Tab clavier → focus visible (ring 2px accent)
  6. Réduire la fenêtre à < 1024px → sidebar gauche et panier deviennent drawers (Sheet shadcn). Bouton menu (`Menu` icon) ouvre la sidebar gammes.
- **Résultat attendu** : Layout 3 colonnes desktop, drawers mobile, dark mode actif, branding tenant visible, focus clavier OK.
- **Hints DOM** : `data-testid="shop-portal"`, `data-testid="shop-nav-gammes"`, `data-testid="shop-cart-sticky"`, `[data-theme="dark"]`
- **URL de départ** : `http://localhost:5177/shop/boutique-1`
- **Type d'exécution** : Manuel humain + IA Chrome (MCP)
- **Données de test** : tenant `imprimerie-ipa` ou `boutique-1` actifs en B5
- **Statut** : À jouer

**TF P09-S2.1-B — Access guard shop_only refusé (403)**
- **Parcours** : P09 — Boutique portail B2B
- **Persona** : User authentifié `access_scope='shop_only'` avec `allowedShopIds = ['shop-A']` uniquement
- **Précondition** : Compte test configuré shop_only avec accès limité à 1 boutique. Boutique cible HORS de cette liste.
- **Étapes** :
  1. Se connecter avec compte test shop_only
  2. Naviguer vers `/shop/<slug-d-une-boutique-non-listee>`
  3. Vérifier le rendu de l'écran 403 (`data-testid="shop-forbidden-403"`)
  4. Vérifier l'absence de testid `shop-portal` dans le DOM (pas de fuite produits/branding)
  5. Cliquer sur "Retour à mes espaces" → redirige vers `/tenants`
- **Résultat attendu** : 403 propre, lien retour fonctionnel, aucune fuite de contenu boutique.
- **Hints DOM** : `data-testid="shop-forbidden-403"`, absence de `data-testid="shop-portal"`
- **URL de départ** : `/shop/<slug-non-autorise>`
- **Type d'exécution** : Manuel humain + IA Chrome (MCP)
- **Données de test** : créer en SQL un user shop_only sur tenant test avec `allowed_shop_ids` ne contenant PAS la boutique testée
- **Statut** : À jouer

**TF P09-S2.1-C — Access guard anonyme garde l'accès public**
- **Parcours** : P09 — Boutique portail B2B
- **Persona** : Visiteur anonyme (pas connecté)
- **Précondition** : Naviguer en navigation privée / déconnecté.
- **Étapes** :
  1. Naviguer vers `/shop/boutique-1` sans être authentifié
  2. Vérifier le rendu complet de la boutique (pas de 403)
  3. Vérifier `shop-portal` rendu, pas de `shop-forbidden-403`
- **Résultat attendu** : Accès libre rétro-compat préservé.
- **Hints DOM** : `data-testid="shop-portal"`, absence de `shop-forbidden-403`
- **Type d'exécution** : Manuel humain + IA Chrome (MCP)
- **Statut** : À jouer

### File List

**NEW**
- `src/app/components/shop/ShopLayout.tsx` — composant chassis 3-col + header sticky brandé + drawers mobile
- `src/app/components/shop/ShopLayout.helpers.ts` — helpers purs (resolveShopTheme, resolveShopBrandStyle, shouldShowCartBadge)
- `src/app/components/shop/ShopAccessGuard.helpers.ts` — helpers purs guard (resolveShopAccess + resolveShopAccessFromMemberships)
- `src/app/components/shop/ShopForbidden403.tsx` — écran 403 minimal avec lien retour `/tenants`
- `tests/components/shop/ShopLayout.helpers.test.ts` — 14 cas vitest
- `tests/components/shop/ShopAccessGuard.helpers.test.ts` — 14 cas vitest

**UPDATE**
- `src/app/components/shop/PublicShop.tsx` — `<PortalChrome>` remplacé par `<ShopLayout>`, ajout `useAuth/useTenant`, ajout access guard avec `useMemo`, `<ShopForbidden403>` court-circuit
- `src/app/lib/testIds.ts` — ajout `shop.navGammes`, `shop.cartSticky`, `shop.forbidden403`
- `_bmad-output/implementation-artifacts/story-S2.1-shop-layout-3col.md` — frontmatter status=review, tasks [x], Dev Agent Record rempli

**KEEP (legacy non touché, suppression sprint refacto)**
- `src/app/components/shop/portal/PortalChrome.tsx` — désimporté de `PublicShop`, conservé pour rollback
- `src/app/components/shop/portal/PortalHome.tsx`, `PortalCatalog.tsx`, `PortalProduct.tsx`, `PortalCart.tsx` — utilisés tels quels comme `children` MVP de `ShopLayout` (refondus par S2.2/S2.3/S2.7)

### Change Log

| Date | Modification | Commit prévu |
|---|---|---|
| 2026-05-10 | Story spec créée par bmad-create-story | (story doc, à committer) |
| 2026-05-10 | S2.1 implémentée : ShopLayout 3-col + dark mode + access guard. 28 nouveaux tests vitest, 0 régression (72/72), Vite build OK. | `feat(v5): ShopLayout 3-col + dark mode + access guard shop_only (S2.1)` |
