# Story S2.18 — Méga-menu 2 niveaux illustré

> **Epic 2 — Sprint E3 Navigation.** FR-ECOM-08. **Branche :** `beta/v5`.
> **Statut :** en cours (Amelia Dev). Baseline tests : 661 vitest verts.
> **Périmètre confirmé Arnaud 2026-07-07 :** 4 stories E3 complètes, alimentation démo-friendly quand la donnée POC manque.

## Contexte fondation (audit E3 2026-07-07)

- Taxonomie 2 niveaux déjà là : `Gamme.parent_slug` + `buildGammeTree()` (`ShopGammesSidebar.helpers.ts`).
- Identité famille (couleur/picto, 7 familles) : `resolveFamilyIdentity()` (S2.11) — **toujours** résolue (fallback flyer) → jamais de repère vide.
- Nav boutique = state interne `PortalView` (pas de sous-routes URL) dans `PublicShop`.
- **Catalogue POC mince** (~1 produit/boutique, audit 07-07) → méga-menu doit rester **non vide** même à faible donnée : d'où fondation basée sur `resolveFamilyIdentity` (garantie), enrichie par gammes en sous-catégories.

## User story

**As an** acheteur B2B,
**I want** un menu qui montre familles + sous-catégories avec un visuel,
**So that** je vois l'arborescence sans multiplier les clics.

## Acceptance Criteria

**AC1 — Arborescence auto-illustrée depuis les données**
Given un catalogue de produits (+ gammes PIM éventuelles)
When l'acheteur ouvre/survole une famille dans le méga-menu
Then un panneau affiche les sous-catégories (gammes) + une vignette vedette (mockup-signature du produit représentatif) + le repère famille (couleur/picto S2.11)
And le méga-menu s'auto-illustre depuis les données (aucune configuration boutique).

**AC2 — Repli / robustesse données minces**
Given un catalogue sans hiérarchie de gammes
When le méga-menu rend
Then chaque famille reste affichée (dérivée de `resolveFamilyIdentity`) avec son compteur, sans sous-catégories vides.

**AC3 — Accessibilité AA (DoD principe 10)**
Given navigation clavier + lecteur d'écran
When l'acheteur parcourt le méga-menu
Then focus visible, `aria-expanded`/`aria-controls`, fermeture `Escape`, la couleur ne porte jamais l'info seule (picto + libellé).

## Conception technique

### Helper pur (TDD) — `src/app/utils/shopTaxonomy.ts` (nouveau)

> **Correction majeure (2026-07-07, après test Chrome)** : la 1re version groupait par **famille mockup** (`resolveFamilyIdentity`, 7 familles) avec les gammes en sous-catégories → incohérent (« Affiches » ravalée sous « Flyers » car `affiche→flyer` côté mockup ; clic famille ne filtrait rien). **Refonte : la taxonomie est bâtie sur l'ARBRE DES GAMMES PIM** (`product_gammes.parent_slug`), source unique.

`buildShopTaxonomy(products, gammes)` → `TaxonomyFamily[]` :
- **Familles = gammes racines** (`parent_slug === null`) ; **sous-catégories = gammes enfants**. Ainsi « Affiches » est une famille à part entière (vérifié sur la vraie donnée : 8 familles racines).
- Groupage produits→gamme via `groupProductsByGamme` (**même logique que les pilules** → cohérence garantie).
- Chaque nœud porte `gammeSlugs` (famille = racine + enfants) → **filtrage réel** du catalogue via `expandedGammes`.
- `identity` (couleur/picto S2.11) = décoration seule, dérivée du produit vedette / nom de gamme.
- Repli démo-friendly : squelette des familles racines (compteurs 0) si aucun produit ne matche.
- Tri familles par `count` desc puis label ; sous-catégories idem.

### UI — méga-menu

Nouveau composant `ShopMegaMenu` (rendu dans `ShopLayout`, à côté/au-dessus des pilules gammes S-REWORK-1). Ouvre un panneau par famille au survol/clic (déclencheur bouton `aria-expanded`). Clic famille/sous-cat → `onView('catalog')` + filtre gamme actif (réutilise le filtrage gamme existant). Vignette = `ProductMockup`/`MockupImage` du `featured`.

### testIds (déclarés dans `testIds.ts`)
- `shop.megaMenu` = `shop-mega-menu`
- `shop.megaMenuFamily` = `shop-mega-menu-family`
- `shop.megaMenuPanel` = `shop-mega-menu-panel`
- `shop.megaMenuSubcat` = `shop-mega-menu-subcat`

## DoD
- [x] Story doc (ce fichier).
- [x] Helper pur `buildShopTaxonomy` + 7 tests vitest (668 verts, 0 régression sur 661).
- [x] testids déclarés (4).
- [x] a11y AA (`aria-haspopup`/`aria-expanded`/`aria-controls`, `role=region`, Escape, picto+libellé).
- [x] Microcopy FR (« Voir tout <famille> »).
- [x] Build vert (1.72s).
- [x] TF Notion (3 cas P09) — `TF-NOTION-S2.18.md`.
- [ ] Sally UX consult — non invoquée (réutilise tokens + repère S2.11 + pilules existantes). À valider.
- [ ] Commit `feat(v5):` — **en attente confirmation push** (batch fin de sprint E3).

## Fichiers
| Action | Fichier |
|---|---|
| Nouveau | `src/app/utils/shopTaxonomy.ts` (+ `tests/utils/shopTaxonomy.test.ts`) |
| Nouveau | `src/app/components/shop/ShopMegaMenu.tsx` |
| Modif | `ShopLayout.tsx` (props taxonomy + rendu), `PublicShop.tsx` (build + handlers), `testIds.ts` |

## Vérification Chrome (piloté, 2026-07-07)
Testé en pilotant Chrome (compte acheteur test, Boutique Manitou avec produits + ERAM anonyme) :
- Familles = 8 gammes racines réelles (Affiches séparée de Flyers). ✅
- Panneau famille → vraies sous-catégories (Flyers → « Flyer A5 », plus de « Affiches sous Flyers »). ✅
- Clic famille/sous-cat → catalogue filtré (pilule active, grille réduite). ✅
- A11y : `role=region` + `aria-label="Sous-catégories <famille>"`. ✅

**Observation hors périmètre** : un produit « Autocollants vitrine » (badge famille ÉTIQUETTES via S2.11) résout en gamme `flyer_a5` (matching_rules). C'est une divergence pré-existante `resolveGamme` vs `resolveFamilyIdentity`, **cohérente avec les pilules**, non introduite par S2.18. À traiter séparément si besoin (qualité données PIM / règles de matching).

## Cohérence nav — unification repère famille (décision Arnaud « les deux », 2026-07-07)

Les captures d'Arnaud montraient badge carte ≠ menu ≠ gamme (ex. « Affiches A2 brillantes » badgée FLYERS car `kind=flyer` en base + pas de famille mockup « Affiches »).

**Partie 1 (livrée)** — source de repère famille UNIFIÉE sur la gamme PIM :
- Nouveau `src/app/utils/shopFamilyIdentity.ts` : `resolveRootFamilyIdentity(slug,name)` (palette curatée 9 familles PIM, dont Affiches/Banderoles) + `resolveShopFamily(product, gammes)` (gamme racine résolue, repli mockup si hors gamme) + `rootGammeOf`.
- `shopTaxonomy.ts` (méga-menu) : identité famille = `resolveRootFamilyIdentity(root.slug, root.name)` (plus `resolveFamilyIdentity` du produit vedette). `TaxonomyFamily` porte désormais `tone` + `icon`.
- `ShopProductCard.tsx` (badge S2.11) : `resolveShopFamily(product, pimGammes)` au lieu de `resolveFamilyIdentity`. Le mockup IMAGE reste sur `resolveMockupTemplate` (7 familles).
- **Vérifié Chrome** (Boutique Manitou, 23 produits) : « Affiche A2 brillantes » → badge AFFICHES ; tous les badges cohérents avec menu + pilules.
- +6 tests (`shopFamilyIdentity.test.ts`), 674 vitest verts.

**Partie 2 (à faire, needs PAT Supabase)** — correctif DONNÉE PIM : `kind` faux / manquant fausse encore la CLASSIFICATION (ex. « Autocollants vitrine » → gamme flyer_a5 au lieu d'étiquette ; kakémonos/banderoles retombent en repli mockup). Migration/one-shot de correction `product_library.config.kind` à cadrer sur audit prod (kinds observés : affiches en `flyer`, autocollants en `null`).

## Note
Le méga-menu coexiste avec les pilules gammes (S-REWORK-1). Consolidation visuelle éventuelle = ressort S2.31 (admin/UX) ou passage Sally.
