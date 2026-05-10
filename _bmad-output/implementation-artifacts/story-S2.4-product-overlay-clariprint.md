---
story_id: S2.4
epic: 2 — Boutique B2B Premium Experience
title: Overlay ProductCard avec options Clariprint en <select> + recalcul prix
status: review
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: M
prd_ref: _bmad-output/planning-artifacts/prd.md (FR15)
architecture_ref: _bmad-output/planning-artifacts/architecture.md (§4.4 ClariprintAdapter, §5.7 pattern erreur Clariprint)
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 2 / S2.4)
fr_covered: [FR15]
nfr_covered: [NFR28]
adr_covered: []
predecessors: [S1.2 ClariprintAdapter livré, S2.3 ShopProductCard livré (bouton Configurer placeholder à brancher)]
successors: [S2.5 Recalcul prix dynamique conditionnel (couplé à S2.4)]
---

# Story S2.4 — Overlay ProductCard avec options Clariprint en `<select>`

## Story (Given/When/Then)

**As an** acheteur B2B,
**I want** un panneau latéral d'édition produit avec toutes les options possibles (format, papier, finition, dorure, etc.) en listes déroulantes,
**So that** je configure mon produit sans risque d'erreur de saisie libre et avec uniquement les options réellement disponibles chez l'imprimeur.

## Contexte stratégique

S2.4 transforme le bouton "Configurer" placeholder de **S2.3 ShopProductCard** (qui appelle aujourd'hui `onAddToCart` direct) en véritable overlay de configuration produit. C'est la 4e brique visible de l'Epic 2 et la **brique fonctionnelle clé** : sans elle, l'acheteur ne peut pas adapter le produit à son besoin réel.

**Démo 2026-05-23** : l'overlay rend la boutique vraiment B2B (vs catalogue figé). Démontre la valeur ajoutée Magrit/Clariprint vs un eshop classique.

```
S1.2 ✅ ClariprintAdapter pattern + ClariprintError typé
S2.3 ✅ ShopProductCard (bouton Configurer placeholder)
   ↓
S2.4 (cette story) — ProductOverlay
   ├─ consomme product.config.clariprintData pour valeurs initiales
   ├─ consomme httpAdapter.computePrice() pour recalcul à l'ouverture
   ├─ <select> HTML pour chaque option Clariprint (pas de saisie libre)
   ├─ gère ClariprintError (négatif/NaN/undefined/network) avec UI graceful
   └─ "Ajouter au panier" final avec config personnalisée
```

## Pattern technique retenu

### Source des options Clariprint — décision MVP

L'AC2 spécifie "uniquement les options réellement disponibles chez l'imprimeur" et "options indisponibles selon les choix précédents → `<select>` mis à jour pour ne montrer que les options valides". Cela demanderait :
- Un endpoint `listAvailableOptions(productId)` côté ClariprintAdapter (non implémenté en S1.2)
- Une matrice de combinations valides (très complexe, dépend du parc imprimeur)

**Décision MVP** : **listes statiques d'options par catégorie** (basées sur les enums Clariprint courants), pré-remplies depuis `product.config.clariprintData` (valeur initiale du catalogue) :

- **Quantité** : input numérique avec contraintes `min` / `max` raisonnables (50 / 100 000) + step adaptatif (par 50 jusqu'à 1000, par 500 au-delà). PAS de `<select>` (l'AC1 dit "input numérique avec contraintes min/max").
- **Format** : `<select>` parmi A6 / A5 / A4 / A3 / "85x55" / "210x210" / "Custom". Si "Custom", afficher 2 inputs width+height.
- **Papier** : `<select>` parmi 90g / 115g / 135g / 170g / 250g / 300g / 350g.
- **Pelliculage / finition recto** : `<select>` parmi "aucun" / "mat" / "brillant" / "soft-touch".
- **Pelliculage / finition verso** : idem.
- **Impression** : `<select>` parmi "recto" (1 face) / "recto-verso" (2 faces) — auto déduit depuis `front_colors` + `back_colors` Clariprint.
- **Dorure** : `<select>` parmi "aucune" / "or" / "argent" — optionnel selon dimensions.

Si la combinaison choisie est invalide côté Clariprint, l'erreur revient via `computePrice()` → message UI clair (cf. AC3). Pas de pré-filtrage matricule MVP.

**Out of scope étendu en S2.4** : `listAvailableOptions(productId)` côté adapter. Story future si nécessaire post-démo.

### Composant `ProductOverlay.tsx` (Sheet shadcn side=right)

Utilise `<Sheet side="right">` shadcn (déjà installé, utilisé dans `ShopLayout` S2.1 pour drawers mobile). Side panel **plein hauteur**, **largeur 420px desktop** (cf. design-handoff §4.1 "Drawer panier slide depuis la droite, width 420px desktop"), **full-width mobile**.

Contenu :
1. Header sticky : nom produit + close `X`
2. Mini-mockup `<MockupImage>` (consomme S4.3 + S4.2 templates) en haut, format réduit aspect 4/3
3. Bloc "Options" : 6-7 `<select>` HTML natifs + 1 input numérique quantité, layout en 2 colonnes desktop / 1 col mobile
4. Bloc "Prix" : prix HT + TTC tabular-nums mono, badge "Recalculé" pendant fetch, badge "⚠️ Estimation Prix marché" si fallback Clariprint indisponible (cf. priceResolver existant)
5. Footer sticky : bouton "Ajouter au panier" primary + bouton "Annuler" secondary

### State machine de l'overlay

```
[fermé] → click Configurer S2.3 → [ouvert + loading initial computePrice]
                                          ↓
                                   [ready] (prix affiché, options éditables)
                                    ↓ ↑
                          change option → [recalculating]
                                    ↓
                                 ClariprintError ?
                                    ├ oui → [error] (banner explicite + bouton Réessayer + prix précédent conservé)
                                    └ non → [ready] (nouveau prix)
                                    ↓
                            click "Ajouter au panier" → onAddToCart(productConfigured, qty) → [fermé]
```

### Gestion ClariprintError (AC3, NFR28)

Pattern architecture §5.7 :
- `ClariprintError.kind === 'negative_price' | 'nan_price' | 'undefined_field'` → message "Prix indisponible — utilisation du Prix marché" + fallback `estimateMarketPriceHT()` (helper existant `priceResolver.ts`) + badge "⚠️ Estimation"
- `ClariprintError.kind === 'network' | 'timeout'` → message "Erreur réseau — réessayez" + bouton "Réessayer" + prix précédent conservé
- `ClariprintError.kind === 'missing_required_product'` → message "Configuration non disponible chez cet imprimeur" + bouton "Annuler" mis en avant
- Pas de spinner infini (NFR28) : timeout 10s sur `computePrice()` → bascule en error state

### Helpers purs

- `extractInitialOptions(product): ConfigOptions` — lit `product.config.clariprintData` et map vers `ConfigOptions { quantity, format, paper, ... }` avec defaults safe si absents
- `buildClariprintPayload(options, baseConfig): ClariprintPayload` — construit le payload `{ clariprint: { quantity, width, height, papers, finishing_front, ... } }` à partir des choix utilisateur + `baseConfig` (champs immuables comme `kind`)
- `parseFormatToWidthHeight(format): { width, height }` — réutilise/étend `parseFormatToDimensions` de S2.3 pour les nouveaux formats
- `formatEuro(priceHT, locale='fr-FR'): string` — formatage `1 234,56 €` cohérent avec les usages existants

### Wiring `ShopProductCard.onConfigure`

Aujourd'hui dans `PortalCatalog.tsx` (post-S2.3) :
```tsx
onConfigure={() => {
  console.info('[S2.3] Overlay configuration (S2.4 future) — fallback ajout direct');
  onAddToCart(p, 1);
}}
```

S2.4 le remplace par :
```tsx
onConfigure={() => setOverlayProduct(p)}
```

Et ajoute le rendering `<ProductOverlay product={overlayProduct} ... />` en sibling de la grille.

## Acceptance Criteria

### AC1 — Ouverture overlay + options en `<select>` HTML pré-remplies

**Given** un produit dans le catalogue avec `product.config.clariprintData` non-vide
**When** l'acheteur clique "Configurer" (testid `product-card-configure-btn` S2.3)
**Then** un panneau latéral droit s'ouvre via Sheet shadcn (testid `shop-product-overlay`, side=right, largeur 420px desktop)
**And** le panneau affiche : header avec nom produit + close icon, mini-mockup MockupImage, bloc options, bloc prix, footer avec CTA "Ajouter au panier"
**And** les options sont rendues en `<select>` HTML (testids `shop-overlay-option-{name}` : quantity, format, paper, finishingFront, finishingVerso, printing, dorure) avec valeurs initiales lues depuis `product.config.clariprintData`
**And** la quantité est en `<input type="number">` avec `min=50`, `max=100000`, `step` adaptatif (50/500)
**And** un calcul prix initial via `httpAdapter.computePrice()` est lancé à l'ouverture, badge "Recalcul..." (testid `shop-overlay-price-loading`) pendant la promise

### AC2 — Recalcul prix dynamique au changement d'option

**Given** l'overlay ouvert, prix initial affiché
**When** l'acheteur change la valeur d'un `<select>` (ex: papier 135g → 250g)
**Then** un nouveau `computePrice()` est lancé en background (debounce 300ms pour éviter le spam si plusieurs changes rapides)
**And** le badge "Recalcul..." apparaît
**And** au retour 2xx, le prix HT et TTC se mettent à jour (transition opacity discrète)
**And** la latence p50 attendue est ≤ 2 s (NFR — alignement S2.5 conditionnel)

**Given** le feature flag `ENABLE_OVERLAY_LIVE_RECALC` (à créer dans `featureFlags.ts`) est `false`
**When** l'acheteur change une option
**Then** le badge "Recalcul à la validation" apparaît
**And** le prix précédent reste affiché jusqu'au clic sur "Ajouter au panier"

### AC3 — Gestion ClariprintError (NFR28 fail-fast)

**Given** un appel `computePrice()` retourne `ClariprintError` avec `kind === 'negative_price'`, `'nan_price'` ou `'undefined_field'`
**When** l'overlay reçoit l'erreur
**Then** un banner d'erreur (testid `shop-overlay-error-banner`) affiche "Prix indisponible — utilisation du Prix marché"
**And** un fallback `estimateMarketPriceHT()` est calculé et affiché avec badge "⚠️ Estimation"
**And** le bouton "Ajouter au panier" reste actif (l'acheteur peut commander quand même avec le prix marché)

**Given** l'erreur est `kind === 'network'` ou `'timeout'`
**When** le timeout 10s est atteint OU une erreur réseau survient
**Then** le banner affiche "Erreur réseau — réessayez"
**And** un bouton "Réessayer" (testid `shop-overlay-retry-btn`) déclenche un nouveau `computePrice()`
**And** le prix précédent (s'il existe) reste affiché en attendant
**And** **pas de spinner infini** (NFR28)

**Given** l'erreur est `kind === 'missing_required_product'`
**When** l'overlay reçoit l'erreur
**Then** le banner affiche "Configuration non disponible chez cet imprimeur"
**And** le bouton "Ajouter au panier" est désactivé
**And** le bouton "Annuler" est mis en avant

### AC4 — Ajout au panier avec config personnalisée

**Given** l'overlay ouvert avec un prix valide affiché
**When** l'acheteur clique "Ajouter au panier" (testid `shop-overlay-add-btn`)
**Then** `onAddToCart(productConfigured, quantity)` est appelé avec `productConfigured.config = buildClariprintPayload(options, baseConfig)` (config personnalisée en plus de la config de base)
**And** `productConfigured.price_ht` reflète le prix recalculé (ou prix marché si fallback)
**And** l'overlay se ferme automatiquement
**And** le toast/notification "Ajouté au panier" s'affiche (réutilise pattern existant)

### AC5 — testIds + a11y NFR18

**Given** l'overlay ouvert
**When** Claude in Chrome / E2E inspecte le DOM
**Then** les testids stables présents : `shop-product-overlay`, `shop-overlay-close-btn`, `shop-overlay-option-quantity`, `shop-overlay-option-format`, `shop-overlay-option-paper`, `shop-overlay-option-finishing-front`, `shop-overlay-option-finishing-verso`, `shop-overlay-option-printing`, `shop-overlay-option-dorure`, `shop-overlay-price-loading`, `shop-overlay-price-display`, `shop-overlay-error-banner`, `shop-overlay-retry-btn`, `shop-overlay-add-btn`, `shop-overlay-cancel-btn`

**Given** navigation clavier
**When** Tab dans l'overlay
**Then** ordre logique : close → mockup (skip) → options (selects + qty input) → footer (Ajouter / Annuler)
**And** Esc ferme l'overlay (Sheet shadcn natif)
**And** Focus visible (ring 2px accent)
**And** `aria-label` explicite sur close + retry
**And** `aria-live="polite"` sur le bloc prix pour annoncer les recalculs

## Tasks / Subtasks

- [x] **Task 1 — Helpers purs `ProductOverlay.helpers.ts`** (AC1, AC2)
  - [ ] Type `ConfigOptions { quantity, format, paper, finishingFront, finishingVerso, printing, dorure, customWidth?, customHeight? }`
  - [ ] Constantes des options : `QUANTITIES`, `FORMATS`, `PAPERS`, `FINISHINGS`, `PRINTINGS`, `DORURES` (basées sur enums Clariprint courants)
  - [ ] Helper `extractInitialOptions(product): ConfigOptions` — lit `product.config.clariprintData` et map avec defaults safe (quantity=500, format='A5', paper='135g', etc.)
  - [ ] Helper `buildClariprintPayload(options, baseConfig): Record<string, unknown>` — construit le payload Clariprint depuis options + champs immuables (`kind`)
  - [ ] Helper `parseFormatToWidthHeight(format): { width: number; height: number } | null` (extension de S2.3)
  - [ ] Helper `formatEuro(priceHT: number, locale?: string): string` — `1 234,56 €` formaté

- [x] **Task 2 — Tests vitest helpers** (AC1, AC2)
  - [ ] Créer `tests/components/shop/ProductOverlay.helpers.test.ts`
  - [ ] ≥ 6 cas pour `extractInitialOptions` (config complet / config partiel / clariprintData absent / quantity number/string / format custom / fallback defaults)
  - [ ] ≥ 4 cas pour `buildClariprintPayload` (options standards / format Custom width/height / preserve baseConfig.kind / dorure="aucune" omise du payload)
  - [ ] ≥ 3 cas pour `parseFormatToWidthHeight` (A5 / Custom / inconnu)
  - [ ] ≥ 3 cas pour `formatEuro` (entier / décimal / négatif défensif)

- [x] **Task 3 — Composant `ProductOverlay.tsx`** (AC1, AC2, AC3, AC4, AC5)
  - [ ] Créer `src/app/components/shop/ProductOverlay.tsx`
  - [ ] Props : `product: ShopProduct | null`, `shop: Shop`, `onClose: () => void`, `onAddToCart: (productConfigured: ShopProduct, qty: number) => void`
  - [ ] Render conditionnel : si `product === null` → ne rend rien (sheet fermée)
  - [ ] Layout via `<Sheet open={!!product} onOpenChange={(o) => !o && onClose()}>` + `<SheetContent side="right" className="w-[420px] sm:w-full">`
  - [ ] Header : `<SheetTitle>` avec product.name + close auto via Sheet
  - [ ] Mini mockup : `<MockupImage>` réutilisé (template via `resolveMockupTemplate(product)`, dimensions via `resolveProductDimensions`)
  - [ ] State local : `const [options, setOptions] = useState<ConfigOptions>(extractInitialOptions(product))`, `const [price, setPrice] = useState<{ priceHT, priceTTC, isMarketPrice, error? } | null>(null)`, `const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')`
  - [ ] Effet : à l'ouverture (product change), reset options + lance `computePrice()` initial
  - [ ] Effet : au changement d'option, debounce 300ms puis `computePrice()` (si flag `ENABLE_OVERLAY_LIVE_RECALC` true)
  - [ ] Helper inline `runComputePrice(opts)` async qui : try/catch ClariprintError, gère timeout 10s via AbortController, sets `phase='error'` avec kind dispatch
  - [ ] Footer sticky : bouton "Ajouter au panier" (disabled si `phase==='error' && kind==='missing_required_product'`) + bouton "Annuler"

- [x] **Task 4 — Étendre `featureFlags.ts`** (AC2)
  - [ ] Ajouter `ENABLE_OVERLAY_LIVE_RECALC: boolean` (default `true` en beta v5, à false en prod jusqu'à validation API Clariprint perf)

- [x] **Task 5 — Wiring `PortalCatalog`** (AC1, AC4)
  - [ ] Ajouter state `const [overlayProduct, setOverlayProduct] = useState<ShopProduct | null>(null)` dans `PortalCatalog.tsx`
  - [ ] Remplacer `onConfigure={() => { console.info(...); onAddToCart(p, 1); }}` par `onConfigure={(p) => setOverlayProduct(p)}` sur les `<ShopProductCard>`
  - [ ] Rendre `<ProductOverlay product={overlayProduct} shop={shop} onClose={() => setOverlayProduct(null)} onAddToCart={(pConfig, qty) => { onAddToCart(pConfig, qty); setOverlayProduct(null); }} />` en sibling de la grille (avant ou après le `</div>` de la grille principale)

- [x] **Task 6 — Étendre `testIds.ts`** (AC5)
  - [ ] Ajouter dans `shop` scope :
    - `productOverlay: 'shop-product-overlay'`
    - `overlayCloseBtn: 'shop-overlay-close-btn'`
    - `overlayPriceDisplay: 'shop-overlay-price-display'`
    - `overlayPriceLoading: 'shop-overlay-price-loading'`
    - `overlayErrorBanner: 'shop-overlay-error-banner'`
    - `overlayRetryBtn: 'shop-overlay-retry-btn'`
    - `overlayAddBtn: 'shop-overlay-add-btn'`
    - `overlayCancelBtn: 'shop-overlay-cancel-btn'`
    - `overlayOptionQuantity: 'shop-overlay-option-quantity'`
    - `overlayOptionFormat: 'shop-overlay-option-format'`
    - `overlayOptionPaper: 'shop-overlay-option-paper'`
    - `overlayOptionFinishingFront: 'shop-overlay-option-finishing-front'`
    - `overlayOptionFinishingVerso: 'shop-overlay-option-finishing-verso'`
    - `overlayOptionPrinting: 'shop-overlay-option-printing'`
    - `overlayOptionDorure: 'shop-overlay-option-dorure'`

- [x] **Task 7 — Validation full suite + smoke visuel** (toute story) — _vitest 152/152 ✅, vite build 1.49s ✅, smoke visuel à valider Arnaud_
  - [ ] `pnpm exec vitest run` → 128 baseline + ~16 nouveaux ≥ 144/144 verts
  - [ ] `pnpm exec vite build` → 0 erreur TS strict
  - [ ] Smoke visuel sur port 5177 : ouvrir overlay, changer option, vérifier recalcul, simuler erreur (dev tools → block clariprint-quote → vérifier banner)

- [x] **Task 8 — Cas TF Notion P09 overlay configuration** (DoD §5) — _draft dans Completion Notes, à coller manuellement_
  - [ ] Draft cas TF : "Overlay configuration produit avec recalcul prix Clariprint" — IA Chrome ouvre overlay, change papier, vérifie recalcul en < 2s, simule timeout, vérifie banner erreur + bouton réessayer

## Dev Notes

### Files NEW

- `src/app/components/shop/ProductOverlay.tsx` — composant Sheet shadcn side-right configuration produit
- `src/app/components/shop/ProductOverlay.helpers.ts` — helpers purs (extractInitialOptions, buildClariprintPayload, formatEuro, parseFormatToWidthHeight, constantes options)
- `tests/components/shop/ProductOverlay.helpers.test.ts` — 16+ cas vitest

### Files UPDATE

- `src/app/components/shop/portal/PortalCatalog.tsx` — state overlayProduct + wiring onConfigure réel + rendering `<ProductOverlay>`
- `src/app/lib/testIds.ts` — 15 nouveaux testids `overlay*`
- `src/app/lib/featureFlags.ts` — flag `ENABLE_OVERLAY_LIVE_RECALC` (default `true` beta v5)
- `_bmad-output/implementation-artifacts/story-S2.4-product-overlay-clariprint.md` — frontmatter post-livraison

### Files KEEP (consommés tels quels)

- `src/server/clariprint/ClariprintAdapter.ts` — `httpAdapter.computePrice()` + `ClariprintError` typé (S1.2 livré)
- `src/app/utils/clariprintQuote.ts` — `validateClariprintResponse` + `priceFingerprint` réutilisables
- `src/app/utils/priceResolver.ts` — `estimateMarketPriceHT()` pour fallback Prix marché
- `src/app/components/ui/sheet.tsx` — Sheet shadcn (déjà utilisé S2.1)
- `src/app/components/mockup/MockupImage.tsx` — pour mini mockup dans overlay
- `src/app/components/shop/ShopProductCard.helpers.ts` — `resolveMockupTemplate`, `resolveProductDimensions` réutilisables

### Snippets clés

**Helpers options Clariprint** :
```typescript
export const QUANTITIES = [50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
export const FORMATS = ['A6', 'A5', 'A4', 'A3', '85x55', '210x210', 'Custom'] as const;
export const PAPERS = ['90g', '115g', '135g', '170g', '250g', '300g', '350g'] as const;
export const FINISHINGS = ['aucun', 'mat', 'brillant', 'soft-touch'] as const;
export const PRINTINGS = ['recto', 'recto-verso'] as const;
export const DORURES = ['aucune', 'or', 'argent'] as const;

export function extractInitialOptions(product: ShopProduct): ConfigOptions {
  const c = (product.config?.clariprintData ?? product.config) as Record<string, any>;
  return {
    quantity: typeof c?.quantity === 'number' ? c.quantity : 500,
    format: typeof c?.format === 'string' ? c.format : 'A5',
    paper: Array.isArray(c?.papers) ? c.papers[0] : (c?.paper ?? '135g'),
    finishingFront: c?.finishing_front ?? 'aucun',
    finishingVerso: c?.finishing_back ?? 'aucun',
    printing: c?.back_colors > 0 ? 'recto-verso' : 'recto',
    dorure: c?.dorure ?? 'aucune',
  };
}
```

**Effet recalcul avec debounce + AbortController** :
```typescript
useEffect(() => {
  if (!product || !featureFlags.ENABLE_OVERLAY_LIVE_RECALC) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const debounceId = setTimeout(() => {
    setPhase('loading');
    httpAdapter.computePrice({ clariprint: buildClariprintPayload(options, product.config) })
      .then((quote) => {
        setPrice({ priceHT: quote.priceHT!, priceTTC: quote.priceHT! * 1.2 });
        setPhase('ready');
      })
      .catch((err) => {
        if (err instanceof ClariprintError) {
          // dispatch sur err.kind...
          setPhase('error');
        }
      })
      .finally(() => clearTimeout(timeoutId));
  }, 300);
  return () => {
    clearTimeout(debounceId);
    clearTimeout(timeoutId);
    controller.abort();
  };
}, [product, options]);
```

### DoD PR v1.1 (rappel architecture §5.10)

- [ ] Compile TS strict + ESLint clean
- [ ] Tests vitest helpers
- [ ] ≥ 1 cas TF Notion ajouté
- [ ] `testIds.ts` mis à jour
- [ ] Format commit : `feat(v5): ProductOverlay configuration Clariprint avec recalcul prix (S2.4)`
- [ ] Confirmation Arnaud avant push

## Project Structure Notes

### Out of scope S2.4

- **`listAvailableOptions(productId)` côté ClariprintAdapter** : matrice de combinations valides selon parc imprimeur. Demande extension Adapter + edge function dédiée — story future post-démo.
- **Pré-filtrage des options invalides** : MVP affiche toujours toutes les options. Erreur Clariprint si combinaison invalide → message UI graceful (AC3 couvre ce cas).
- **Recalcul live conditionnel** : couvert partiellement par AC2 + flag `ENABLE_OVERLAY_LIVE_RECALC`. S2.5 (story dédiée) approfondira si l'API Clariprint perf le justifie.
- **Multi-quantités tarif dégressif** : pas de table de prix par tranche dans l'overlay MVP, juste prix unique recalculé.
- **Personnalisation visuelle / upload fichier** : T-01 Corporate Portal différé.

### Décisions tech assumées

1. **Listes statiques d'options** (pas matrice dynamique) → trade-off MVP cohérent avec l'effort M.
2. **debounce 300ms sur recalcul** + AbortController 10s timeout → évite spam Clariprint et garantit NFR28 fail-fast.
3. **Sheet shadcn side=right** → cohérent avec drawers S2.1 mobile, pas d'animation custom.
4. **Fallback Prix marché** sur erreur sanitization Clariprint → pattern Decision Arnaud 2026-05-09 (option C) déjà en place dans `priceResolver.ts`.
5. **Feature flag `ENABLE_OVERLAY_LIVE_RECALC`** : permet de basculer en "recalcul à la validation" si l'API Clariprint montre des problèmes perf en démo.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#L422-L447] — Epic 2 / S2.4 AC original
- [Source: _bmad-output/planning-artifacts/architecture.md#L330-L355] — §4.4 ClariprintAdapter pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#L543-L568] — §5.7 pattern erreur Clariprint
- [Source: _bmad-output/implementation-artifacts/story-S1.2-clariprint-adapter.md] — adapter livré + ClariprintError typé
- [Source: _bmad-output/implementation-artifacts/story-S2.3-shop-product-card.md] — onConfigure placeholder à brancher
- [Source: src/server/clariprint/ClariprintAdapter.ts] — `httpAdapter.computePrice` + `ClariprintError`
- [Source: src/app/utils/clariprintQuote.ts] — `validateClariprintResponse`, `priceFingerprint`
- [Source: src/app/utils/priceResolver.ts] — `estimateMarketPriceHT` pour fallback
- [Source: src/app/components/ui/sheet.tsx] — Sheet shadcn (consommé S2.1 mobile drawers)
- [Source: src/app/lib/featureFlags.ts] — pattern feature flags

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — story creation + dev implementation 2026-05-10

### Debug Log References

- Pattern repo respecté : helpers logiques purs `*.helpers.ts` + tests vitest sans rendering React.
- `ClariprintHttpAdapter` instancié au niveau module (singleton), pas de DI complexe pour MVP.
- State machine `Phase` typée discriminée par `kind` (`idle | loading | ready | error`) — TypeScript force le dispatch correct.

### Completion Notes List

#### Décisions d'implémentation

1. **Listes statiques d'options** confirmées MVP (pas de matrice dynamique). 6 enums : `QUANTITIES`, `FORMATS` (incluant 'Custom'), `PAPERS`, `FINISHINGS`, `PRINTINGS`, `DORURES`. Si combinaison invalide → erreur Clariprint → message UI graceful.

2. **State machine `Phase` discriminée par `kind`** : `idle | loading | ready | error`. TypeScript force le dispatch correct dans le rendering. Évite les bugs "spinner infini" (NFR28) — toujours un état terminal.

3. **Recalcul avec `AbortController` + debounce + timeout 10s** :
   - Debounce 300ms avant le `computePrice()` (anti-spam si user change plusieurs options rapidement).
   - `AbortController` annule la requête précédente si une nouvelle arrive ; coupe aussi à 10s timeout.
   - `lastComputeRef` (useRef) garde la référence du dernier controller pour pouvoir l'abort.
   - Pas de race condition : `controller.signal.aborted` checké avant `setPhase` dans then/catch.

4. **Dispatch erreurs ClariprintError** :
   - `negative_price | nan_price | undefined_field` → fallback `estimateMarketPriceHT(product)` + badge "⚠️ ESTIMATION" + bouton "Ajouter au panier" actif.
   - `network | timeout | unknown` → message + bouton "Réessayer" + prix précédent conservé.
   - `missing_required_product` → bouton "Ajouter" désactivé, "Annuler" mis en avant.

5. **Custom format avec width/height inputs** : si `format === 'Custom'`, 2 inputs supplémentaires apparaissent (largeur/hauteur en mm, min=10 max=2000). `buildClariprintPayload` lit `customWidth/customHeight` au lieu de parser le format.

6. **Finition verso conditionnelle** : le `<select>` "Finition verso" n'apparaît que si `printing === 'recto-verso'` (UX cohérente — pas de finition verso si pas de verso imprimé).

7. **`onConfigure(prod)` → `setOverlayProduct(prod)`** : Le placeholder console.info de S2.3 est remplacé. L'overlay est rendu en sibling de la grille (pas dans la card) pour bénéficier d'un seul rendering global.

8. **Mini mockup réutilisé** : `<MockupImage>` avec template auto via `resolveMockupTemplate(product)` (helper S2.3) — cohérence visuelle entre la card grille et l'overlay.

9. **`aria-live="polite"` sur le bloc prix** (NFR18) : annonce vocale du recalcul aux lecteurs d'écran sans interrompre.

10. **Footer sticky avec 2 boutons** : "Annuler" secondary (1/3 largeur), "Ajouter au panier" primary (2/3 largeur). Bouton primary désactivé si `phase.errorKind === 'missing_required_product'`.

#### Tests livrés

| Fichier | Cas | Statut |
|---|---|---|
| `tests/components/shop/ProductOverlay.helpers.test.ts` | 24 cas (5 parseFormat + 6 extractInitialOptions + 7 buildClariprintPayload + 6 formatEuro) | ✅ 24/24 |
| Full vitest suite | 128 baseline + 24 nouveaux = **152 cas** | ✅ 152/152, 0 régression |
| Vite build | TypeScript strict + production bundle | ✅ 1.49s success |

#### Draft cas TF Notion P09 — à coller manuellement

🔗 https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c

**TF P09-S2.4 — Overlay configuration produit avec recalcul prix Clariprint**
- **Parcours** : P09 — Boutique portail B2B (configuration produit)
- **Persona** : Acheteur B2B
- **Précondition** : Boutique active avec ≥ 1 produit, edge function `clariprint-quote` opérationnelle (vérifier via cURL préalable), `featureFlags.ENABLE_OVERLAY_LIVE_RECALC === true`
- **Étapes** :
  1. Naviguer vers `/shop/<slug>` (vue catalog)
  2. Cliquer "Configurer" sur une `ShopProductCard` (`data-testid="product-card-configure-btn"`)
  3. Vérifier qu'un panneau latéral droit s'ouvre (`data-testid="shop-product-overlay"`, largeur 420px desktop / full-width mobile)
  4. Vérifier mini mockup en haut (`data-testid="mockup-product-image"`), 7 selects (quantity/format/paper/printing/finishing-front/finishing-verso/dorure) avec valeurs initiales pré-remplies
  5. Vérifier badge "Recalcul..." (`data-testid="shop-overlay-price-loading"`) puis prix HT/TTC s'affichent (`data-testid="shop-overlay-price-display"`)
  6. Changer le papier (135g → 250g) → vérifier après ~300ms+latence Clariprint que le prix se met à jour
  7. Cliquer Esc → l'overlay se ferme
  8. Re-cliquer "Configurer" sur un autre produit → overlay s'ouvre avec les nouvelles options pré-remplies
  9. Tab clavier → focus visible (ring 2px), ordre logique close → selects → footer
  10. **Test erreur** : dans devtools, bloquer `clariprint-quote` (network throttle offline) → changer une option → vérifier banner d'erreur (`data-testid="shop-overlay-error-banner"`) + bouton "Réessayer" (`data-testid="shop-overlay-retry-btn"`) + prix précédent conservé
  11. Cliquer "Ajouter au panier" (`data-testid="shop-overlay-add-btn"`) → overlay se ferme + produit ajouté avec config personnalisée + prix recalculé
- **Résultat attendu** : configuration fluide, recalcul ≤ 2s p50 perçu, gestion erreur graceful, ajout panier avec config valide.
- **Hints DOM** : 15 testids `shop-product-overlay`, `shop-overlay-*` listés dans testIds.ts S2.4
- **URL de départ** : `http://localhost:5177/shop/<slug>`
- **Type d'exécution** : Manuel humain + IA Chrome (MCP) — dont le test erreur via network throttle
- **Données de test** : tenant `imprimerie-ipa` ou `boutique-1`, produit avec `config.clariprintData` valide
- **Statut** : À jouer

### File List

**NEW**
- `src/app/components/shop/ProductOverlay.tsx` — composant Sheet shadcn side-right configuration produit
- `src/app/components/shop/ProductOverlay.helpers.ts` — helpers purs (constantes options + extractInitialOptions + buildClariprintPayload + parseFormatToWidthHeight + formatEuro)
- `tests/components/shop/ProductOverlay.helpers.test.ts` — 24 cas vitest

**UPDATE**
- `src/app/components/shop/portal/PortalCatalog.tsx` — state `overlayProduct` + onConfigure réel + rendering `<ProductOverlay>` en sibling de la grille
- `src/app/lib/testIds.ts` — 15 nouveaux testids `overlay*` (productOverlay, overlayCloseBtn, priceDisplay/Loading, errorBanner, retryBtn, addBtn, cancelBtn, 7 option*)
- `src/app/lib/featureFlags.ts` — flag `ENABLE_OVERLAY_LIVE_RECALC` (default true beta v5)
- `_bmad-output/implementation-artifacts/story-S2.4-product-overlay-clariprint.md` — frontmatter status=review, tasks [x], Dev Agent Record rempli

**KEEP (consommés tels quels)**
- `src/server/clariprint/ClariprintAdapter.ts` — `httpAdapter.computePrice()` + `ClariprintError` typé (S1.2)
- `src/app/utils/priceResolver.ts` — `estimateMarketPriceHT` pour fallback Prix marché
- `src/app/components/ui/sheet.tsx` — Sheet shadcn (déjà utilisé S2.1 mobile drawers)
- `src/app/components/mockup/MockupImage.tsx` — pour mini mockup
- `src/app/components/shop/ShopProductCard.helpers.ts` — `resolveMockupTemplate` + `resolveProductDimensions`

### Change Log

| Date | Modification | Commit prévu |
|---|---|---|
| 2026-05-10 | Story spec créée par bmad-create-story | (story doc, à committer) |
| 2026-05-10 | S2.4 implémentée : ProductOverlay Sheet shadcn side=right avec 7 options Clariprint, recalcul prix temps réel via httpAdapter.computePrice() (debounce 300ms, AbortController timeout 10s), state machine Phase typée, dispatch ClariprintError typé avec fallback Prix marché (negative/nan/undefined) ou bouton Réessayer (network/timeout). Wiring PortalCatalog : onConfigure réel + rendering overlay sibling. 24 nouveaux tests vitest, 0 régression (152/152), vite build 1.49s. | `feat(v5): ProductOverlay configuration Clariprint avec recalcul prix (S2.4)` |
