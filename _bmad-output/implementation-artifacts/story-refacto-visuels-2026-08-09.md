# Story — REFACTO-VISUELS (2026-08-09)

> **Statut** : livré, non poussé · **Branche de session** : `migration_owk`
> **Arbitrage** : Arnaud, 2026-08-09 — 3 demandes en une session.

---

## Résumé exécutif

Arnaud constate que **le visuel d'une brochure est un flyer et celui d'un
calendrier une affiche**, et demande la suppression de deux entrées du menu
Catalogue devenues sans objet.

Diagnostic : le catalogue PIM compte **16 familles racines** depuis l'import
Exaprint (2026-07-10), la taxonomie des visuels en comptait **7**. Les familles
non couvertes recevaient **silencieusement** le visuel « flyer », par une
inférence de mots-clés sur le **nom** du produit. **9 familles racines sur 16
affichaient un visuel faux ou par défaut.**

Trois chantiers livrés. Le troisième renverse le principe : **le visuel est une
propriété de la gamme dans le PIM**, hérité le long de l'arbre des gammes, et
l'absence de visuel est assumée plutôt que masquée par un emprunt.

**Recette** : build ✅ · vitest **847/847** ✅.

---

## Chantier 1 — suppression de « Visuels Magrit »

**Ce qui a motivé la suppression.** `DashboardAdminMockups` était une galerie en
**lecture seule** (aucune action possible), réservée `magrit-root`, qui
prévisualisait les 7 templates du **moteur SVG**. Or ce moteur ne servait plus
les visuels réellement affichés depuis P18 v2 (2026-06-24) : la page documentait
un état périmé.

| Élément | Action |
|---|---|
| `src/app/components/dashboard/DashboardAdminMockups.tsx` | supprimé |
| Route `admin/mockups` | → `Navigate` vers `admin/pim` (URLs en favori préservées) |
| Entrée de nav « Visuels Magrit » | supprimée |
| `ShopCustomMockups` (upload par boutique) | **conservé** — fonction distincte et opérante |

## Chantier 2 — suppression de « Gammes actives »

**Ce qui a motivé la suppression.** `tenant_gamme_subscriptions` ne décidait
**pas** des produits vendus — ça, c'est `shops.library_ids` +
`pim_catalog_mode` + `pim_gamme_slugs`. Elle ne filtrait que le **menu** de la
boutique, en doublon avec la sélection de gammes par boutique. Deux niveaux de
filtre, deux vérités : le menu pouvait promettre une gamme vide, ou taire une
gamme vendue.

La chaîne retenue est celle énoncée par Arnaud : **PIM → bibliothèque → boutique.**

| Fichier | Changement |
|---|---|
| `DashboardTenantGammes.tsx` | supprimé ; `/dashboard/gammes` → `Navigate` vers le PIM |
| `PublicShop.tsx` | `subscribedSlugs` retiré — le menu dérive du catalogue réel de la boutique (une gamme apparaît ssi elle a au moins un produit) |
| `supabase/functions/shop-sitemap/index.ts` | lecture des souscriptions retirée ; gammes racines du PIM (chemin déjà emprunté par tout tenant n'ayant rien coché) |
| `TenantContext.tsx` | paramètre `gammeSlugs` de `createTenant` retiré |
| `TenantOnboarding.tsx` | **wizard ramené à une seule étape** — l'étape « Quelles gammes utilisez-vous ? » (E9.6) n'alimentait que cette table |

⚠️ **Table conservée en base.** Aucun `drop` sans arbitrage explicite. Migration
de suppression à écrire quand Arnaud tranche.

## Chantier 3 — le visuel est une propriété de la gamme

### Chaîne de résolution (`src/app/utils/productImages.ts`)

```
product.image_url
  → ProductDefinition.image_url      (variation PIM)
  → Gamme.image_url                  (gamme résolue)
  → Gamme.image_url des ANCÊTRES     (remontée parent_slug, garde anti-cycle)
  → null                             → repère de famille au rendu
```

En boutique, un mockup uploadé pour la boutique prime sur toute la chaîne.

### Invariants posés

1. **Le nom d'un produit n'influence jamais son visuel.** L'inférence par
   mots-clés (`resolveProductMockupAsset` + `TEMPLATE_TO_PRODUCT_IMAGE`) est
   retirée du chemin d'image.
2. **Pas de visuel plutôt qu'un visuel faux** — `ProductVisualPlaceholder`
   (pictogramme + tonalité de famille), jamais le visuel d'une autre famille.
3. **Un seul résolveur** pour carte boutique, carte atelier, overlay, tuile de
   gamme, méga-menu et admin PIM : ce que l'admin voit est ce que l'acheteur verra.
4. **La couverture est mesurée, pas supposée** — bandeau en tête du PIM.

### Fichiers

| Fichier | Changement |
|---|---|
| `utils/productImages.ts` | réécrit ; `resolveProductImage` retourne `string \| null` ; `resolveGammeImage` exporté (héritage + anti-cycle) |
| `utils/productMockupAssets.ts` | mapping famille → visuel retiré ; `resolveMockupTemplate` conservé (clé des mockups boutique + repli du repère de famille) |
| `components/shop/ProductVisualPlaceholder.tsx` | **nouveau** — repère de famille, `role="img"` + `aria-label` |
| `ShopProductCard` / `ProductCard` / `ProductOverlay` | gèrent le cas `null` ; `pimDefinitions` câblé (l'image de variation n'était pas lue en boutique) |
| `utils/shopTaxonomy.ts` | méga-menu passé sur `resolveGammeImage` (héritage) |
| `DashboardAdminPIM.tsx` | état **propre / hérité / manquant** par gamme + bandeau de couverture |
| `supabase/migrations/20260809000100_gamme_visuals.sql` | **nouveau** — seed 6 familles racines, idempotent |
| `public/visuels-produits/` | 6 JPG + README ; `src/assets/products/` supprimé |
| `tests/utils/gammeVisual.test.ts` | **nouveau**, 12 tests — remplace `productMockupSignatureFallback` |

### Pourquoi les assets passent dans `public/`

`product_gammes.image_url` est une donnée de **base**. Un asset importé depuis
`src/` reçoit une URL **hachée au build** : la valeur stockée serait invalide au
build suivant. `public/` est copié verbatim par Vite → URL stable.

### Couverture assumée : 6 familles racines sur 16

Couvertes : `carterie`, `flyer`, `depliant`, `etiquette`, `kakemono`, `packaging`.

**À produire (10)** : `brochure` (l'asset existant montrait un **dépliant plié**,
pas un livret relié — il a été **retiré** plutôt que reconduit), `affiche`,
`banderole`, `drapeau`, `panneau`, `adhesif`, `plv`, `papeterie`, `calendrier`,
`restauration`.

---

## Recette

| Contrôle | Résultat |
|---|---|
| `npm run build` | ✅ 1998 modules |
| `npx vitest run` | ✅ **847/847** (835 conservés + 12 nouveaux ; 2 obsolètes supprimés) |
| Non-régression « un calendrier ne récupère jamais le visuel flyer » | ✅ couvert |
| Héritage sous-gamme → famille | ✅ couvert |
| Cycle `parent_slug` (donnée corrompue) | ✅ couvert |

## Reste à la main d'Arnaud

1. **Jouer la migration** `20260809000100_gamme_visuals.sql` sur Supabase.
   Sans elle : aucune gamme n'a de visuel → toutes les cartes affichent le repère
   de famille. Dégradation visuelle, pas de casse.
2. **Recette visuelle** du dashboard et d'une boutique sous auth.
3. **Arbitrer la suppression** du moteur SVG (`mockup-generator`, 7 templates
   Deno, bucket `product_mockups/`) — orphelin.
4. **Arbitrer le `drop`** de `tenant_gamme_subscriptions`.
5. **Faire produire les 10 visuels manquants** (brochure en priorité : c'est une
   famille vendue, aujourd'hui sans visuel).

## Dettes tracées

- `shop_template_mockups` est encore clé sur les **7 familles mockup** alors que
  le PIM en compte **16** — à migrer sur la gamme.
- Le moteur SVG et son cache CDN tournent sans servir aucun visuel affiché.
