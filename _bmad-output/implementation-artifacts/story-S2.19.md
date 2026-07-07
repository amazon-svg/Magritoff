# Story S2.19 — Fil d'Ariane + filtres à facettes légers

> **Epic 2 — Sprint E3 Navigation.** FR-ECOM-09. **Branche :** `beta/v5`.
> **Statut :** en cours (Amelia Dev). Baseline : 674 vitest verts.

## Contexte / cohérence

Suite ADR-4.17 : la **catégorie (famille) = gamme explicite** ; le **format redevient un FILTRE** (facette), plus une catégorie. Le filtrage par **famille** est déjà géré en amont (pilules + méga-menu → `expandedGammes` dans `PublicShop` → `products` déjà filtrés passés à `PortalCatalog`). S2.19 ajoute donc, DANS le catalogue :
- le **fil d'Ariane**,
- les **facettes légères Format + Prix** (dérivées données),
- l'**état vide** avec reset + pont Magrit.

Les anciens « chips » filtres basés sur `product.category` brut (kind Clariprint « leaflet ») sont remplacés par ces facettes utiles.

## Acceptance Criteria

**AC1 — Fil d'Ariane**
Given la grille catalogue
When elle rend
Then un fil d'Ariane `Accueil > Catalogue [> Famille]` cliquable est affiché ; « Accueil » ramène à la home, la famille (si une seule gamme active) est affichée.

**AC2 — Facettes légères (data-driven, pas de variantes techniques fines)**
Given des produits
When le catalogue rend
Then un panneau de filtres légers **Format** (A5, A4, A2…) et **Prix** (tranches) généré depuis les données est disponible ; PAS de variantes techniques fines (papier/finition — la card est configurable, décision archi 1).
> Usage/intention + délai : **non inclus** (aucune donnée fiable en base — DoD #4 audit-first). Tracés pour quand la donnée existera.

**AC3 — État vide**
Given une combinaison de filtres sans résultat
When elle est appliquée
Then un état vide clair propose **Réinitialiser les filtres** ou **Demander à Magrit** (pont S2.21 : bascule sur la recherche IA).

## Conception

### Helper pur `src/app/utils/catalogFacets.ts` (+ tests)
- `deriveFormatFacets(products)` → `[{key,label,count}]` (extrait A-size ou W×H depuis `config.format`, sinon « Autre »).
- `derivePriceFacets(products)` → tranches fixes (`< 100 €`, `100–500 €`, `> 500 €`) avec compteurs, masque les tranches vides.
- `applyFacets(products, {formats:Set, price:key|null})` → filtrage composable, non mutant.

### UI `PortalCatalog`
- Breadcrumb (via `buildShopTaxonomy` : si 1 seule famille dans les produits, l'afficher).
- Panneau facettes Format + Prix (remplace les chips category).
- Empty state (reset + « Demander à Magrit »).

### testids
- `shop.catalogBreadcrumb`, `shop.catalogFacetFormat`, `shop.catalogFacetPrice`, `shop.catalogEmpty`, `shop.catalogEmptyAskMagrit`, `shop.catalogResetFacets`

## DoD
- [ ] Story doc · helpers purs + tests · testids · microcopy FR · build vert · TF Notion · confirmation push.
