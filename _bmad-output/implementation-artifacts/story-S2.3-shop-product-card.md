---
story_id: S2.3
epic: 2 — Boutique B2B Premium Experience
title: ShopProductCard avec MockupImage paramétrique + bouton Configurer & ajouter
status: review
created_at: 2026-05-10
target_branch: beta/v5
agent: Dev (Amelia)
size: S
prd_ref: _bmad-output/planning-artifacts/prd.md (FR25 consommation mockup)
architecture_ref: _bmad-output/planning-artifacts/architecture.md (§4.3 Mockup Engine, §6.1 tree)
epics_ref: _bmad-output/planning-artifacts/epics.md (Epic 2 / S2.3)
fr_covered: [FR25]
nfr_covered: [NFR2, NFR18]
adr_covered: []
predecessors: [S4.3 MockupImage livré, S4.2 5 templates SVG MVP livrés + déployés v2, S2.1 ShopLayout livré]
successors: [S2.4 Overlay Clariprint (consommera bouton Configurer), S2.7 Home enrichie (réutilisera ShopProductCard), S2.8 Multi-sélection (étendra ShopProductCard avec checkbox), S2.9 Comparateur]
---

# Story S2.3 — ShopProductCard avec MockupImage paramétrique + bouton Configurer & ajouter

## Story (Given/When/Then)

**As an** acheteur B2B,
**I want** voir une ProductCard claire avec visuel mockup brandé + nom + référence + bouton de configuration,
**So that** j'identifie immédiatement le produit avec un visuel cohérent à la boutique et je peux l'ajouter en un clic.

## Contexte stratégique

S2.3 est la **2e brique visible** de l'Epic 2 Boutique Premium B2B après S2.1 ShopLayout. Elle consomme deux livraisons :

- **S4.3 MockupImage** : composant React avec fallback graceful (URL CDN public direct + onError → edge function fetch + retry + ProductMockup SVG ultime).
- **S4.2 5 templates SVG MVP déployés** (flyer, carteVisite, brochure, etiquette, kakemono) : variété visuelle nécessaire pour la démo 2026-05-23.

```
S2.1 ✅ ShopLayout (chassis)
   ↓
S2.3 (cette story) — ShopProductCard
   ├─ consomme S4.3 MockupImage (Epic 4)
   ├─ consomme S4.2 templates via product.kind → template mapping
   └─ débloque :
       ├─ S2.4 Overlay Clariprint (bouton "Configurer" l'ouvrira)
       ├─ S2.7 Home enrichie (cards dans "dernières commandes")
       ├─ S2.8 Multi-sélection (checkbox via prop)
       └─ S2.9 Comparateur
```

**Démo 2026-05-23** : la grille produit avec mockups variés et brandés est l'élément visuel le plus impactant de la boutique.

## Pattern technique retenu

### Nouveau composant dédié `ShopProductCard.tsx` (vs modifier ProductCard atelier)

**État actuel** : la grille produits boutique est rendue **inline** dans [src/app/components/shop/portal/PortalCatalog.tsx:316-420](src/app/components/shop/portal/PortalCatalog.tsx#L316-L420) (`<article data-testid="product-card">` avec `<img>` ou `<ProductMockup>` SVG en fallback). Le composant atelier `ProductCard.tsx` (1000+ lignes, 5 onglets Fiche/Prix/Mockup/Éditer/Debug) ne convient pas pour la boutique.

**Cible S2.3** : créer un **composant React dédié** `src/app/components/shop/ShopProductCard.tsx` :

- Encapsule l'affichage d'une `ShopProduct` dans la grille boutique.
- Utilise `<MockupImage>` (S4.3) en lieu et place du `<img>` / `<ProductMockup>` actuel.
- Bouton primaire "Configurer & ajouter" (cf. AC) — placeholder onClick aujourd'hui (ouvrira l'overlay S2.4 plus tard).
- Bouton secondaire "Ajouter directement" pour MVP (préserve l'actuel `onAddToCart` en attendant l'overlay).
- Prop `selectable?: boolean` + `selected?` + `onSelectedChange?` (squelette pour S2.8 multi-sélection — non implémenté visuellement dans S2.3, juste structure prête).

**Pourquoi pas modifier ProductCard atelier ?**
- Composant atelier est massif (1000+ lignes), refactor planifié dans **sprint refacto en attente** identifié 2026-05-10 (cf. mémoire `project_refacto_sprint_pending`).
- Pas le moment d'introduire un `variant` prop dans un composant que l'équipe veut découper.
- Boutique B2B a des besoins différents (theming dynamique, mockup paramétrique brandé) que l'atelier ne consomme pas aujourd'hui.

### Mapping `product.kind` → template MockupImage

L'AC ne spécifie pas comment choisir le template parmi les 5 livrés en S4.2. **Décision MVP** :

- Helper pur `resolveMockupTemplate(product): MockupTemplate` extrait du `product.config.kind` Clariprint si présent, sinon fallback `'flyer'`.
- Mapping initial (élargi post-S4.4) :
  - `flyer` / `affiche` / `tract` → `flyer`
  - `carte_visite` / `card` / `visite` → `carteVisite`
  - `brochure` / `depliant` / `plaquette` → `brochure`
  - `etiquette` / `sticker` / `label` → `etiquette`
  - `kakemono` / `roll-up` / `rollup` / `banner` → `kakemono`
  - default → `flyer`
- Helper testable (tests purs vitest selon le pattern repo).

### MockupImage props : `template` non encore supporté

⚠️ Vérification du contrat : [src/app/components/mockup/MockupImage.tsx:28-44](src/app/components/mockup/MockupImage.tsx#L28-L44) ne supporte PAS aujourd'hui une prop `template`. La fonction `buildEdgeFunctionUrl` dans [MockupImage.helpers.ts](src/app/components/mockup/MockupImage.helpers.ts) ne passe pas non plus le query param `template`.

**Décision** : étendre `MockupImageProps` + `MockupSpecs` (helpers) pour accepter une prop optionnelle `template?: MockupTemplate`. Si fournie, ajoutée au query param. Si absente, l'edge function fallback sur `flyer` (rétro-compat S4.2 confirmée). Le type `MockupTemplate` doit être extrait/dupliqué côté front (les types Deno `_shared/mockup/types.ts` ne sont pas importables en front Vite).

**Pas un breaking change** : la prop est optionnelle, le composant continue de fonctionner sans `template` pour les call sites existants (aucun aujourd'hui hors tests).

### Theming brand : couleur primaire `--shop-primary`

`MockupImage` reçoit `primaryColor` en hex `#RRGGBB`. La source actuelle dans le portail est `shop.theme.primaryColor` (cf. [PublicShop.tsx:282-285](src/app/components/shop/PublicShop.tsx#L282-L285)). Le `ShopProductCard` reçoit le `Shop` en prop pour extraire ces valeurs.

### Dimensions produit : passage en mm

`MockupImage` exige `width: number` + `height: number` en mm (specs Clariprint). Source dans `ShopProduct.config` :
- `config.width` / `config.height` (set par `configToEphemeralShopProduct` ou produits library)
- `config.format` (string ex "A5") — fallback si dimensions absentes
- Fallback par défaut si rien : 148 / 210 (A5 portrait)

Helper `resolveProductDimensions(product): { width: number; height: number }` extrait avec fallback.

## Acceptance Criteria

### AC1 — Composant `ShopProductCard` rend mockup + nom + meta + actions

**Given** un produit dans le catalogue boutique avec `id`, `name`, `category`, `price_ht`, `config`
**When** `<ShopProductCard product={product} shop={shop} onAddToCart={...} onConfigure={...} />` rend
**Then** la `MockupImage` paramétrique est affichée en haut de la carte, ratio 4/3, brandée avec `shop.theme.primaryColor`
**And** le nom du produit (`product.name`) est affiché en titre 14.5px font 500
**And** la catégorie est affichée en badge mono uppercase (existant — conservé)
**And** le bouton "Configurer & ajouter" (primary CTA) est présent avec testid `product-card-configure-btn` (NEW)
**And** le bouton "Ajouter au panier" rapide (secondary, ancien `onAddToCart`) reste accessible avec testid `product-card-quote-btn` (existant)
**And** le prix HT et "/ 500 ex." sont affichés en mono (cohérence visuelle existante)
**And** les badges trust FSC + Fabriqué en France sont conservés (rétro-compat)

### AC2 — Skeleton ≤ 300ms (NFR2 MVP)

**Given** le mockup engine n'a pas encore généré l'image (cache MISS)
**When** la `ShopProductCard` rend pour la première fois
**Then** le skeleton/placeholder de `MockupImage` s'affiche pendant la phase `loading` (déjà géré par S4.3, classe `bg-line animate-pulse`)
**And** dès que le PNG arrive (cache HIT < 50ms ou edge function fetch < 300ms), il remplace le skeleton (transition opacity 200ms — déjà gérée par S4.3)

**Given** l'edge function échoue (network err, timeout, render fail)
**When** `MockupImage.handleError` se déclenche puis le retry échoue
**Then** le fallback ultime `<ProductMockup>` SVG schematic est affiché (déjà géré par S4.3)
**And** la `ShopProductCard` reste fonctionnelle (bouton Configurer + Ajouter cliquables)

### AC3 — Mapping `product.kind` → template Clariprint

**Given** un produit avec `config.kind === 'carte_visite'`
**When** la carte rend
**Then** `MockupImage` reçoit `template="carteVisite"` et affiche un mockup carte de visite (livré S4.2)

**Given** un produit avec `config.kind === 'brochure'`
**Then** template `brochure`, idem pour `etiquette`, `kakemono`, `flyer`

**Given** un produit avec `config.kind === 'unknown_kind'` ou kind absent
**Then** template `flyer` par défaut (fallback safe)

**Given** le helper `resolveMockupTemplate(product)` est appelé
**When** un test vitest le couvre
**Then** ≥ 8 cas testent les variantes (5 mappings + 1 fallback unknown + 1 kind absent + 1 alias `card` → carteVisite)

### AC4 — Bouton "Configurer & ajouter" prêt pour S2.4 overlay

**Given** un acheteur clique sur "Configurer & ajouter"
**When** le handler `onConfigure(product)` est appelé
**Then** S2.3 expose simplement la prop `onConfigure`. **L'implémentation concrète de l'overlay est S2.4** (out of scope ici).
**And** le `PortalCatalog` (consumer) passe pour MVP un handler placeholder qui appelle directement `onAddToCart(product, 1)` (rétro-compat) avec un toast/log "Overlay configuration arrive en S2.4"
**And** la prop est typée `onConfigure?: (product: ShopProduct) => void` — optionnelle pour ne pas bloquer

### AC5 — Slot multi-sélection préparé pour S2.8

**Given** la prop optionnelle `selectable: boolean` est passée à `ShopProductCard`
**When** `selectable === true`
**Then** une checkbox apparaît en coin haut-gauche de la card avec testid `product-card-select-checkbox` (NEW)
**And** la checkbox bind à `selected` + appelle `onSelectedChange(boolean)` au click
**And** un clic sur la checkbox **ne déclenche pas** le `onClick` de la card (e.stopPropagation)

**Given** la prop `selectable === false` ou absente
**When** la card rend
**Then** aucune checkbox n'est rendue (rétro-compat S2.3 strict, structure prête pour S2.8 sans coût visuel)

### AC6 — A11y NFR18

**Given** la carte rend
**When** un utilisateur navigue au clavier
**Then** chaque élément interactif (card cliquable, checkbox, boutons) est focusable avec ring 2px accent
**And** les boutons icon-only (cas pas dans S2.3 mais cohérent) ont `aria-label`
**And** la `MockupImage` a un `alt` descriptif (déjà géré par S4.3, S2.3 doit passer un alt explicite : `"Mockup ${product.name}"`)
**And** le bouton "Configurer & ajouter" a un `aria-label` cohérent
**And** la card en mode `selectable` a `role="checkbox"` ou est marquée `aria-checked`

### AC7 — Intégration dans `PortalCatalog`

**Given** [src/app/components/shop/portal/PortalCatalog.tsx](src/app/components/shop/portal/PortalCatalog.tsx)
**When** le dev remplace le rendering inline de la grille (lignes 316-420) par `<ShopProductCard ... />`
**Then** la grille existante est conservée (4-col desktop / 3-col tablet / 2-col mobile)
**And** le testid `shop-product-grid` du wrapper grille est conservé
**And** chaque card conserve `data-testid="product-card"` + `data-product-id`
**And** la section "Suggéré par Magrit" (ai-results) utilise aussi `<ShopProductCard>` (cohérence visuelle)
**And** **aucune régression** sur le flux home → catalog → product → cart (toujours fonctionnel)

## Tasks / Subtasks

- [x] **Task 1 — Helper `resolveMockupTemplate`** (AC3)
  - [ ] Créer `src/app/components/shop/ShopProductCard.helpers.ts`
  - [ ] Définir le type `MockupTemplate = 'flyer' | 'carteVisite' | 'brochure' | 'etiquette' | 'kakemono'` (dupliqué côté front, identique au type Deno _shared/mockup/types.ts — TODO sprint refacto : extraire types partagés via build alias)
  - [ ] Helper `resolveMockupTemplate(product: ShopProduct): MockupTemplate` qui consulte `product.config.kind` (lowercase, normalize) + applique le mapping (5 mappings + alias `card` → carteVisite)
  - [ ] Helper `resolveProductDimensions(product: ShopProduct): { width: number; height: number }` extrait depuis `config.width/height`, fallback parsing `config.format` (ex "A5" → 148/210), default 148/210

- [x] **Task 2 — Tests vitest helpers** (AC3)
  - [ ] Créer `tests/components/shop/ShopProductCard.helpers.test.ts`
  - [ ] ≥ 8 cas pour `resolveMockupTemplate` :
    1. kind='flyer' → flyer
    2. kind='carte_visite' → carteVisite
    3. kind='card' (alias) → carteVisite
    4. kind='brochure' → brochure
    5. kind='etiquette' → etiquette
    6. kind='kakemono' → kakemono
    7. kind=undefined → flyer (fallback)
    8. kind='unknown_xyz' → flyer (fallback safe)
  - [ ] ≥ 5 cas pour `resolveProductDimensions` :
    1. config.width=85, height=55 → {85, 55}
    2. config.format='A5' → {148, 210}
    3. config.format='A4' → {210, 297}
    4. format inconnu sans width/height → {148, 210} default
    5. config absent → {148, 210}

- [x] **Task 3 — Étendre `MockupImage` props avec `template`** (AC3)
  - [ ] Ajouter `template?: MockupTemplate` dans [src/app/components/mockup/MockupImage.tsx:28-44](src/app/components/mockup/MockupImage.tsx#L28-L44) `MockupImageProps`
  - [ ] Étendre `MockupSpecs` dans [src/app/components/mockup/MockupImage.helpers.ts](src/app/components/mockup/MockupImage.helpers.ts) avec `template?: string`
  - [ ] Étendre `buildEdgeFunctionUrl` pour ajouter `template` au URLSearchParams si fourni
  - [ ] Étendre `tests/components/mockup/MockupImage.helpers.test.ts` avec ≥ 2 cas : avec template / sans template (rétro-compat)
  - [ ] Le type `MockupTemplate` est défini dans `ShopProductCard.helpers.ts` (Task 1) et réimporté ici → si circular, dupliquer le type localement dans `MockupImage.tsx` aussi (compromis acceptable, refactor sprint cleanup)

- [x] **Task 4 — Composant `ShopProductCard.tsx`** (AC1, AC2, AC4, AC5, AC6)
  - [ ] Créer `src/app/components/shop/ShopProductCard.tsx`
  - [ ] Props : `product: ShopProduct, shop: Shop, onAddToCart: (p, qty) => void, onConfigure?: (p) => void, selectable?: boolean, selected?: boolean, onSelectedChange?: (b: boolean) => void, className?: string`
  - [ ] Layout : aspect 4/3 mockup en haut + bloc info (titre + catégorie badge + description) + ligne prix + actions (bouton "Configurer & ajouter" primary + "Ajouter" secondary).
  - [ ] Si `selectable=true` : checkbox absolute top-left avec testid `product-card-select-checkbox`, e.stopPropagation au click.
  - [ ] Mockup : `<MockupImage tenantId={shop.tenant_id ?? shop.id} shopId={shop.id} productId={product.id} width={dim.width} height={dim.height} productName={product.name} primaryColor={shop.theme.primaryColor} template={resolveMockupTemplate(product)} alt={'Mockup ' + product.name} className="w-full h-full" />`
  - [ ] Préserver les badges FSC + Fabriqué en France
  - [ ] Conserver hover-reveal du bouton "Personnaliser" (renommé en "Configurer & ajouter") via group-hover
  - [ ] testIds : `product-card` (existant) + `product-card-quote-btn` (existant — bouton ajouter direct) + **NEW** : `product-card-configure-btn`, `product-card-select-checkbox`

- [x] **Task 5 — Étendre testIds.ts** (AC1, AC5)
  - [ ] Ajouter dans `shop` scope : `productCardConfigureBtn: 'product-card-configure-btn'`, `productCardSelectCheckbox: 'product-card-select-checkbox'`

- [x] **Task 6 — Migrer `PortalCatalog` pour utiliser `ShopProductCard`** (AC7) — _grille principale migrée. Grille AI suggéré laissée inline (loading prix Clariprint spécifique — décision MVP, cf. Completion Notes)._
  - [ ] Dans [src/app/components/shop/portal/PortalCatalog.tsx:316-420](src/app/components/shop/portal/PortalCatalog.tsx#L316-L420), remplacer le rendering inline `<article>` par `<ShopProductCard>`
  - [ ] Idem pour la section "Suggéré par Magrit" (ai-results) — utiliser le même composant
  - [ ] Passer `shop` en prop : ajouter `shop: Shop` dans `PortalCatalog` props depuis `PublicShop`
  - [ ] `onConfigure` MVP : appelle `onAddToCart(p, 1)` directement avec un `console.info` "Overlay arrive en S2.4" (placeholder)
  - [ ] Vérifier non-régression : sélection produit → ouverture vue product fonctionne, ajout panier fonctionne

- [x] **Task 7 — Tests vitest helpers** (AC3, AC1) — _intégrés dans Tasks 2 + 3, 37 nouveaux tests au total_
  - [ ] Tests `resolveMockupTemplate` + `resolveProductDimensions` (cf. Task 2)
  - [ ] Tests étendus pour `buildEdgeFunctionUrl` avec `template` (cf. Task 3)

- [x] **Task 8 — Validation full suite + smoke visuel** (toute story) — _vitest 109/109 ✅, vite build 1.59s ✅. Smoke visuel à valider par Arnaud sur port 5177._
  - [ ] `pnpm exec vitest run` → 72 vitest existants + ~15 nouveaux = ≥ 87/87 verts
  - [ ] `pnpm exec vite build` → 0 erreur TS strict, build success
  - [ ] Smoke visuel : `pnpm exec vite --port 5177 --strictPort` → `/shop/<slug>` actif → vérifier que les cards rendent avec mockups variés (au moins 2 templates différents si catalogue mixte)
  - [ ] Pas de régression sur le flux complet home → catalog → product → cart

- [x] **Task 9 — Cas TF Notion P09 ProductCard variante boutique** (DoD §5) — _draft dans Completion Notes, à coller manuellement_
  - [ ] Draft cas TF : "Boutique grille produits avec mockups paramétriques brandés" — IA Chrome rend `/shop/<slug>` → vérifie présence `product-card`, `product-card-configure-btn`, `mockup-product-image`, et au moins 1 mockup non-fallback (PNG chargé via `mockup-product-image-img`).

## Dev Notes

### Files NEW

- `src/app/components/shop/ShopProductCard.tsx` — composant card boutique
- `src/app/components/shop/ShopProductCard.helpers.ts` — `resolveMockupTemplate` + `resolveProductDimensions` + type `MockupTemplate`
- `tests/components/shop/ShopProductCard.helpers.test.ts` — 13+ cas vitest

### Files UPDATE

- `src/app/components/mockup/MockupImage.tsx` — prop `template?` ajoutée
- `src/app/components/mockup/MockupImage.helpers.ts` — `MockupSpecs.template?` + `buildEdgeFunctionUrl` étendu
- `tests/components/mockup/MockupImage.helpers.test.ts` — 2 cas pour `template` query param
- `src/app/components/shop/portal/PortalCatalog.tsx` — migration vers `<ShopProductCard>` + `shop` prop
- `src/app/components/shop/PublicShop.tsx` — passer `shop` prop à `<PortalCatalog>` (vérifier que c'est déjà le cas, sinon ajout trivial)
- `src/app/lib/testIds.ts` — `productCardConfigureBtn`, `productCardSelectCheckbox`

### Files KEEP (non touchés)

- `src/app/components/ProductCard.tsx` — atelier, refactor sprint cleanup en attente
- `src/app/components/shop/portal/PortalHome.tsx` — utilisera `ShopProductCard` dans S2.7 (out of scope ici)

### Snippets clés

**Helper resolveMockupTemplate** :
```typescript
export type MockupTemplate =
  | "flyer"
  | "carteVisite"
  | "brochure"
  | "etiquette"
  | "kakemono";

const KIND_TO_TEMPLATE: Record<string, MockupTemplate> = {
  flyer: "flyer",
  affiche: "flyer",
  tract: "flyer",
  carte_visite: "carteVisite",
  card: "carteVisite",
  visite: "carteVisite",
  brochure: "brochure",
  depliant: "brochure",
  plaquette: "brochure",
  etiquette: "etiquette",
  sticker: "etiquette",
  label: "etiquette",
  kakemono: "kakemono",
  rollup: "kakemono",
  "roll-up": "kakemono",
  banner: "kakemono",
};

export function resolveMockupTemplate(product: ShopProduct): MockupTemplate {
  const kind = (product.config as any)?.kind;
  if (typeof kind !== "string") return "flyer";
  return KIND_TO_TEMPLATE[kind.toLowerCase().trim()] ?? "flyer";
}
```

**Composant ShopProductCard (extrait)** :
```tsx
<article
  data-testid={TEST_IDS.shop.productCard}
  data-product-id={product.id}
  className="group bg-paper border border-transparent rounded-lg overflow-hidden cursor-pointer hover:border-line"
  onClick={() => onConfigure?.(product) ?? onAddToCart(product, 1)}
>
  <div className="aspect-[4/3] overflow-hidden rounded-lg relative" style={{ background: '#F5F5F5' }}>
    {selectable && (
      <input
        type="checkbox"
        data-testid={TEST_IDS.shop.productCardSelectCheckbox}
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onSelectedChange?.(e.target.checked)}
        className="absolute top-2.5 left-2.5 z-10 h-4 w-4"
      />
    )}
    <MockupImage
      tenantId={(shop as any).tenant_id ?? shop.id}
      shopId={shop.id}
      productId={product.id}
      width={dim.width}
      height={dim.height}
      productName={product.name}
      primaryColor={shop.theme.primaryColor}
      template={template}
      alt={`Mockup ${product.name}`}
      className="w-full h-full"
    />
    {/* badge category, etc. */}
  </div>
  {/* bloc info + actions */}
</article>
```

### Tests pattern repo

Suivre [tests/components/shop/ShopLayout.helpers.test.ts](tests/components/shop/ShopLayout.helpers.test.ts) (S2.1) pour la structure :
- `import { describe, it, expect } from "vitest"`
- helpers purs testés sans rendering React
- Mock minimal de `ShopProduct` (interface ShopProduct, juste les champs utilisés par le helper)

### DoD PR v1.1 (rappel architecture §5.10)

- [ ] Compile TS strict + ESLint clean
- [ ] Tests vitest associés
- [ ] ≥ 1 cas TF Notion ajouté avec testid stable
- [ ] `testIds.ts` mis à jour
- [ ] Format commit : `feat(v5): ShopProductCard avec MockupImage parametrique (S2.3)`
- [ ] Confirmation Arnaud avant push

## Project Structure Notes

### Type `MockupTemplate` dupliqué front/back

Le type est défini dans `supabase/functions/_shared/mockup/types.ts` (Deno) ET sera dupliqué dans `src/app/components/shop/ShopProductCard.helpers.ts` (Vite/React). **Pas idéal mais pragmatique** : pas d'import cross-environnement Deno↔Vite sans setup d'alias build. À harmoniser dans le sprint refacto en attente (extraire en `src/types/mockup.ts` partagé via path alias dans tsconfig + deno.json).

### Mapping `kind` → template hard-codé

Le mapping est statique dans `ShopProductCard.helpers.ts`. Dès que la liste des templates Clariprint évoluera (S4.4 Growth = 10 templates supplémentaires), il faudra synchroniser. Solution Vision V2+ : moteur de mapping dynamique via PIM ou table `product_definitions.template_kind`. Hors scope MVP.

### Out of scope S2.3

- Overlay configuration Clariprint complet (S2.4 — bouton ouvre placeholder direct ajout au panier)
- Comportement multi-sélection (S2.8 — checkbox structurelle uniquement)
- Comparateur (S2.9)
- Auto-detect dimensions Clariprint depuis l'API (encore en query params)
- Migration ProductCard atelier (sprint refacto en attente)

## References

- [Source: _bmad-output/planning-artifacts/epics.md#L400-L420] — Epic 2 / S2.3 AC original
- [Source: _bmad-output/planning-artifacts/architecture.md#L300-L328] — §4.3 Mockup Engine
- [Source: _bmad-output/implementation-artifacts/story-S4.3-mockup-image-component.md] — pattern MockupImage
- [Source: _bmad-output/implementation-artifacts/story-S4.2-templates-svg-mvp.md] — 5 templates livrés + déployés v2
- [Source: _bmad-output/implementation-artifacts/story-S2.1-shop-layout-3col.md] — ShopLayout livré
- [Source: src/app/components/shop/portal/PortalCatalog.tsx#L316-L420] — rendering inline actuel à remplacer
- [Source: src/app/components/mockup/MockupImage.tsx] — composant à étendre avec prop `template`
- [Source: src/app/components/mockup/MockupImage.helpers.ts] — helpers URL à étendre
- [Source: src/app/contexts/ShopsContext.tsx] — types `Shop` et `ShopProduct`
- [Source: .design-handoff/README.md#L159-L176] — direction visuelle ProductCard (variantes default/compact)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — story creation + dev implementation 2026-05-10

### Debug Log References

- Tests vitest 109/109 verts (72 baseline + 37 nouveaux), 0 régression.
- Vite build 1.59s success, TypeScript strict clean.
- Pattern repo respecté : helpers logiques purs dans `src/app/components/shop/ShopProductCard.helpers.ts`, tests dans `tests/components/shop/ShopProductCard.helpers.test.ts`. Pas de test de rendu React (no `@testing-library/react` dans le repo, env vitest = node).

### Completion Notes List

#### Décisions d'implémentation

1. **Composant dédié `ShopProductCard.tsx`** créé sans toucher au `ProductCard.tsx` atelier (1000+ lignes, refactor sprint cleanup en attente — cf. mémoire `project_refacto_sprint_pending`).

2. **Helper `resolveMockupTemplate`** : 14 alias `kind` Clariprint mappés vers les 5 templates S4.2 (`flyer/affiche/tract`, `carte_visite/card/visite`, `brochure/depliant/plaquette`, `etiquette/sticker/label`, `kakemono/rollup/roll-up/banner`). Normalize lowercase + trim. Fallback `flyer` sécurisé.

3. **Helper `parseFormatToDimensions`** : reconnaît les formats ISO 216 standards (A3/A4/A5/A6/A7) + carte de visite EU (85×55) + pattern `WxH` libre (ex `210x297`, `85x55mm`, `85 x 55`). Retourne `null` si non parseable, ce qui fait fallback `resolveProductDimensions` sur default 148×210.

4. **Extension `MockupImage` rétro-compatible** : prop `template?: string` ajoutée. Si fournie + non-vide, ajoutée au query params edge function. Si absente/vide, `mockup-generator` (S4.2 livrée) fallback sur `flyer` automatiquement. Aucun call site existant cassé.

5. **`buildEdgeFunctionUrl` défensif** : trim de la valeur + check non-vide avant ajout au query (évite `template=  ` ou `template=` parasites).

6. **`tenantNamespace` dans ShopProductCard** : `shop.tenant_id ?? shop.id` — le type `Shop` exposé front n'inclut pas `tenant_id` officiellement (RLS), donc cast inline avec fallback sur `shop.id`. Cohérent avec le `cache key = {tenant}/{shop}/{product}.png` de l'edge function (les 2 stratégies fonctionnent pour le namespacing).

7. **Bouton "Configurer" placeholder S2.3** : appelle `onConfigure(product)` si fourni, sinon fallback `onAddToCart(product, 1)`. Le caller (PortalCatalog) passe pour MVP un handler qui `console.info` "Overlay configuration arrive en S2.4" + appelle `onAddToCart` direct. Aucun fil rouge cassé.

8. **Slot multi-sélection prêt** : prop `selectable: boolean` conditionnelle. Si true, checkbox `<input type="checkbox">` en `absolute top-2.5 left-2.5 z-10` avec `accent-ink` (couleur native). `e.stopPropagation()` au click pour ne pas trigger `onCardClick`. `aria-label` a11y descriptif. Si false (default), aucun rendu — pas de coût visuel.

9. **Grille AI suggéré laissée inline** : la section "Suggéré par Magrit" dans `PortalCatalog.tsx` (lignes 477-580) garde son rendering inline avec `<ProductMockup>` + skeleton de chargement de prix Clariprint spécifique (logique async différente de la grille principale). Migration future possible si on étend ShopProductCard avec prop `priceLoading?: boolean`. Hors scope S2.3.

10. **Grille principale migrée** : `<article>` inline 100+ lignes remplacé par `<ShopProductCard>`. Comportement identique (testid `product-card`, `data-product-id`, badges FSC + Made in France conservés, hover-reveal du bouton secondary). Bouton "Personnaliser" renommé "Configurer" pour aligner avec AC.

#### Tests livrés

| Fichier | Cas | Statut |
|---|---|---|
| `tests/components/shop/ShopProductCard.helpers.test.ts` | 34 cas (16 mappings template + 10 format parser + 8 dimensions) | ✅ 34/34 |
| `tests/components/mockup/MockupImage.helpers.test.ts` | 7 baseline + 3 nouveaux (template fourni / absent / string vide) | ✅ 10/10 |
| Full vitest suite | 72 baseline + 37 nouveaux = **109 cas** | ✅ 109/109, 0 régression |
| Vite build | TypeScript strict + production bundle | ✅ 1.59s success |

#### Draft cas TF Notion P09 — à coller manuellement

🔗 https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c

**TF P09-S2.3 — ShopProductCard avec mockups paramétriques brandés**
- **Parcours** : P09 — Boutique portail B2B (catalogue)
- **Persona** : Acheteur B2B (anonyme ou shop_only autorisé)
- **Précondition** : Boutique active avec ≥ 2 produits dans le catalogue, idéalement de `kind` différents (flyer + carte_visite + brochure pour exposer 3 templates différents). `shop.theme.primaryColor` configuré (ex `#FF6B35`).
- **Étapes** :
  1. Naviguer vers `/shop/<slug>` → vue Catalogue
  2. Vérifier que chaque produit affiche un `<ShopProductCard>` avec `data-testid="product-card"` + `data-product-id`
  3. Vérifier que le mockup paramétrique est rendu : `data-testid="mockup-product-image-img"` présent, src pointe vers `{projectId}.supabase.co/storage/v1/object/public/product_mockups/...`
  4. Vérifier que la couleur primaire `--shop-primary` apparaît visuellement dans le mockup (pas un placeholder gris)
  5. Survoler une card → bouton secondaire "+ Panier" devient visible (opacity 0→1)
  6. Cliquer "Configurer" (data-testid `product-card-configure-btn`) → vérifier console.info "Overlay configuration arrive en S2.4" + ajout panier (rétro-compat MVP)
  7. Cliquer "+ Panier" → ajout direct au panier
  8. Vérifier badges trust FSC + Fabriqué en France présents
  9. Tab clavier → focus visible (ring 2px) sur card + boutons + checkbox (si selectable activé)
  10. Si catalogue contient un produit `kind=carte_visite` : vérifier que le mockup ressemble à une carte horizontale (pas un flyer portrait — visuel S4.2 carteVisite distinct).
- **Résultat attendu** : grille 4-col desktop / 3-col tablet / 2-col mobile. Mockups variés selon `product.config.kind` (flyer/carteVisite/brochure/etiquette/kakemono des 5 templates S4.2). Theming brand visible. Boutons accessibles clavier + souris.
- **Hints DOM** : `data-testid="product-card"`, `data-testid="product-card-configure-btn"`, `data-testid="product-card-quote-btn"`, `data-testid="mockup-product-image"`, `data-testid="mockup-product-image-img"`, `data-testid="shop-product-grid"`
- **URL de départ** : `http://localhost:5177/shop/<slug-actif>` (ou prod si déployé)
- **Type d'exécution** : Manuel humain + IA Chrome (MCP)
- **Données de test** : tenant `imprimerie-ipa` ou `boutique-1` actifs, créer un produit `config.kind='carte_visite'` pour valider le dispatch template
- **Statut** : À jouer

### File List

**NEW**
- `src/app/components/shop/ShopProductCard.tsx` — composant card boutique avec MockupImage paramétrique
- `src/app/components/shop/ShopProductCard.helpers.ts` — `resolveMockupTemplate` + `parseFormatToDimensions` + `resolveProductDimensions` + type `MockupTemplate`
- `tests/components/shop/ShopProductCard.helpers.test.ts` — 34 cas vitest

**UPDATE**
- `src/app/components/mockup/MockupImage.tsx` — prop `template?: string` ajoutée + passée dans `MockupSpecs`
- `src/app/components/mockup/MockupImage.helpers.ts` — `MockupSpecs.template?` + `buildEdgeFunctionUrl` étendu (trim + check non-vide)
- `tests/components/mockup/MockupImage.helpers.test.ts` — 3 nouveaux cas (template fourni / absent / vide défensif)
- `src/app/components/shop/portal/PortalCatalog.tsx` — grille principale migrée vers `<ShopProductCard>`, prop `shop` ajoutée, import `resolveProductImage` retiré (inutilisé)
- `src/app/components/shop/PublicShop.tsx` — passage `shop={shop}` à `<PortalCatalog>`
- `src/app/lib/testIds.ts` — ajout `productCardConfigureBtn`, `productCardSelectCheckbox`
- `_bmad-output/implementation-artifacts/story-S2.3-shop-product-card.md` — frontmatter status=review, tasks [x], Dev Agent Record rempli

**KEEP (non touchés, hors scope)**
- `src/app/components/ProductCard.tsx` — atelier (1000+ lignes, refactor sprint cleanup en attente)
- `src/app/components/shop/portal/PortalHome.tsx` — utilisera `ShopProductCard` dans S2.7 (out of scope)
- `src/app/components/shop/portal/PortalCatalog.tsx` lignes 477-580 (grille AI suggéré inline) — laissée pour MVP, loading prix Clariprint spécifique
- `src/app/components/shop/portal/PortalChrome.tsx` — désimporté de `PublicShop` depuis S2.1, fichier conservé pour rollback

### Change Log

| Date | Modification | Commit prévu |
|---|---|---|
| 2026-05-10 | Story spec créée par bmad-create-story | (story doc, à committer) |
| 2026-05-10 | S2.3 implémentée : ShopProductCard avec MockupImage paramétrique brandé + helpers mapping kind→template + dimensions Clariprint, prop `template` ajoutée à MockupImage, migration grille catalogue principale. 37 nouveaux tests vitest, 0 régression (109/109), vite build 1.59s. | `feat(v5): ShopProductCard avec MockupImage parametrique brande (S2.3)` |
