---
story_id: S2.4b
epic: 2 — Boutique B2B Premium Experience (correctif scope persona primaire)
title: ProductOverlay côté atelier — remplace onglet Éditer dans ProductCard atelier
status: ready-for-dev
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: S
prd_ref: _bmad-output/planning-artifacts/prd.md (FR15 + persona primaire imprimeur Pro)
predecessors: [S2.4 ProductOverlay livré côté boutique]
successors: []
---

# Story S2.4b — ProductOverlay côté atelier (remplace onglet Éditer)

## Contexte

Correctif scope S2.4. Le `ProductOverlay` a été livré uniquement côté `ShopProductCard` boutique. Le persona primaire (project-context.md §1) est l'imprimeur Pro deviseur qui utilise `ProductCard.tsx` atelier. **Décision Arnaud 2026-05-10** : *"remplacer l'onglet Éditer par un déclencheur d'overlay"*.

Mémoire BMAD créée : [feedback_persona_primaire_imprimeur](~/.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/feedback_persona_primaire_imprimeur.md) pour ne pas reproduire l'erreur de cadrage.

## Story

**As an** imprimeur Pro deviseur sur l'atelier Magrit,
**I want** ouvrir le même panneau de configuration produit que côté boutique en cliquant sur "Éditer" dans la ProductCard,
**So that** j'ai le même outil de configuration Clariprint riche et performant que celui de mes clients acheteurs.

## Acceptance Criteria

### AC1 — Onglet "Éditer" déclenche l'overlay (au lieu d'afficher inline)

**Given** un imprimeur sur l'atelier (`/t/<slug>` chat ou ConfiguratorPage) avec une `ProductCard` (atelier) rendue
**When** il clique le bouton "Éditer" (5e onglet, key=`form`)
**Then** le `ProductOverlay` (Sheet shadcn side=right 420px) s'ouvre au lieu d'afficher l'ancien form inline
**And** les options Clariprint sont pré-remplies depuis `product.config.clariprintData`
**And** le recalcul prix Clariprint fonctionne identiquement à la boutique (debounce 300ms, timeout 10s, ClariprintError graceful)
**And** au clic "Ajouter au panier" (rebadge "Mettre à jour") l'overlay appelle `onProductUpdate(productConfigured)` (callback existant atelier) au lieu de `onAddToCart`

### AC2 — `ProductOverlay` rendu agnostique au contexte (atelier vs boutique)

**Given** le composant `ProductOverlay`
**When** il est appelé depuis l'atelier (sans `Shop` réel disponible)
**Then** la prop `shop` devient optionnelle : `shop?: Shop`
**And** si `shop` absent → fallback sur defaults sains (primaryColor brand Magrit, tenant_id depuis `useTenant()`, shop_id sentinelle `'atelier'` pour le mockup engine)
**And** la prop `onAddToCart` est renommée en `onConfirm: (productConfigured, qty: number) => void` (sémantique générique : "valider la configuration")
**And** la prop `confirmLabel?: string` permet de personnaliser le bouton ("Ajouter au panier" boutique / "Mettre à jour le devis" atelier)

**Given** le composant côté boutique (`PortalCatalog` consumer)
**When** la migration AC2 a lieu
**Then** **aucune régression boutique** : les 24 tests vitest helpers + le smoke S2.4 boutique restent verts

### AC3 — Wiring `ProductCard.tsx` atelier

**Given** [src/app/components/ProductCard.tsx](src/app/components/ProductCard.tsx) avec ses 5 onglets actuels
**When** la migration a lieu
**Then** l'onglet "Éditer" devient un **déclencheur** (state `overlayOpen` au lieu de `activeTab='form'`)
**And** le markup de l'ancien form inline est conservé tel quel **pour le moment** (sera supprimé sprint refacto en attente — réduction risque démo 2026-05-23)
**And** quand l'overlay se ferme avec confirmation, `onProductUpdate(productConfigured)` est appelé (cohérent avec le pattern existant)

### AC4 — testIds + a11y

**Given** l'overlay ouvert depuis l'atelier
**When** Claude in Chrome inspecte le DOM
**Then** les 15 testids `shop-overlay-*` (S2.4) restent valides — le composant est le même, juste un autre consumer
**And** un nouveau testid `product-card-edit-btn` (atelier) déclenche l'overlay (renommer l'aria-label "Éditer" → "Configurer le produit (overlay)")

## Tasks

- [ ] **Task 1 — Adapter `ProductOverlay` props** (AC2)
  - Rendre `shop` optionnel, ajouter fallback dans le composant
  - Renommer `onAddToCart` → `onConfirm` (breaking change, mais 1 seul call site actuel `PortalCatalog`)
  - Ajouter `confirmLabel?: string` (default "Ajouter au panier")
  - Côté `tenantNamespace` : si `shop?.tenant_id ?? shop?.id` absent → utiliser `useTenant().currentTenant?.id ?? 'atelier'` ou fallback string `'atelier'`
  - Côté `primaryColor` : si `shop?.theme?.primaryColor` absent → fallback `'#1e3a8a'` (brand Magrit par défaut)

- [ ] **Task 2 — Migrer `PortalCatalog`** (AC2)
  - Remplacer `onAddToCart` par `onConfirm` dans le call site
  - Pas de changement comportemental

- [ ] **Task 3 — Wirer `ProductCard.tsx` atelier** (AC1, AC3, AC4)
  - State `const [overlayOpen, setOverlayOpen] = useState(false)`
  - Bouton "Éditer" : `onClick={() => setOverlayOpen(true)}` (au lieu de `toggleTab('form')`)
  - Render `<ProductOverlay product={mappedAsShopProduct} onClose={() => setOverlayOpen(false)} onConfirm={(updated) => { onProductUpdate?.(updated); setOverlayOpen(false); }} confirmLabel="Mettre à jour" />`
  - Mapping `product` (atelier, type permissif) → ShopProduct minimal nécessaire à overlay (id, name, config, price_ht). Helper `mapAtelierProductToShopProduct(product)` dans `ProductCard.tsx` ou `ProductOverlay.helpers.ts`
  - **Conserver l'ancien form inline** (AC3) — désactivé visuellement (l'onglet `form` ne peut plus être ouvert via clic, juste l'overlay)

- [ ] **Task 4 — testId atelier** (AC4)
  - `productCardEditBtn: 'product-card-edit-btn'` ajouté dans `testIds.ts` scope `shop` (ou nouveau scope `atelier` si plus propre — décider)

- [ ] **Task 5 — Validation full**
  - vitest 152/152 toujours verts (les 24 tests `ProductOverlay.helpers` ne dépendent pas de `shop`)
  - Vite build OK
  - Smoke visuel atelier : ouvrir l'overlay, changer une option, recalcul prix, valider, vérifier que `onProductUpdate` est appelé sur la card atelier (le prix se met à jour dans la grille chat)
  - Smoke boutique : non-régression S2.4 (overlay boutique inchangé fonctionnellement)

## Dev Notes

### Files NEW

- (aucun — tout en UPDATE)

### Files UPDATE

- `src/app/components/shop/ProductOverlay.tsx` — props `shop` optionnel, `onConfirm` (rename), `confirmLabel`, fallbacks
- `src/app/components/shop/portal/PortalCatalog.tsx` — `onAddToCart` → `onConfirm`
- `src/app/components/ProductCard.tsx` — state `overlayOpen` + déclencheur Éditer + render overlay
- `src/app/lib/testIds.ts` — `productCardEditBtn`

### Mapping atelier product → ShopProduct minimal

```typescript
// dans ProductCard.tsx ou ProductOverlay.helpers.ts
function mapAtelierToShopProduct(product: any): ShopProduct {
  return {
    id: product.id ?? `atelier-${Date.now()}`,
    shop_id: 'atelier',
    product_id: null,
    name: product.name ?? 'Produit',
    category: product.clariprintData?.kind ?? 'Atelier',
    description: product.description ?? '',
    price_ht: product.price ?? 0,
    image_url: '',
    config: { clariprintData: product.clariprintData ?? product },
    display_order: 0,
  } as ShopProduct;
}
```
