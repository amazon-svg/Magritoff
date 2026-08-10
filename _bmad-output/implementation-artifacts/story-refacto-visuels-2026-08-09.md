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
| `npx vitest run` | ✅ **826/826** (3 suites du moteur SVG supprimées avec lui) |
| Non-régression « un calendrier ne récupère jamais le visuel flyer » | ✅ couvert |
| Héritage sous-gamme → famille | ✅ couvert |
| Cycle `parent_slug` (donnée corrompue) | ✅ couvert |

---

## Chantier 4 — suppression du moteur SVG (2026-08-10)

Arbitrage Arnaud : l'orphelin signalé la veille est supprimé.

| Élément | Action |
|---|---|
| `supabase/functions/mockup-generator/` | supprimé (index + tests) |
| `supabase/functions/_shared/mockup/` | supprimé (renderer, types, 7 templates Deno + snapshots) |
| `src/app/components/mockup/MockupImage{,.helpers}` | supprimés |
| `src/app/components/mockup/ProductMultiView.tsx` | supprimé (habillage recto/verso de MockupImage) |
| Bucket `product_mockups` | vidé (286 objets) puis supprimé |
| `ShopCustomMockups` | l'aperçu « par défaut » montrait le rendu du moteur → état vide explicite |
| `tests/e2e/tf-chrome-suite.spec.ts` | cas T14+T9 « toggle Recto/Verso » retiré avec le composant |

**Conservés, à ne pas confondre** : `customMockup.helpers.ts`, la table
`shop_template_mockups` et le bucket `shop_product_mockups` (nom différent) —
les visuels téléversés par boutique, fonction vivante et prioritaire.

---

## Mise en production — 2026-08-10

### Le tracking des migrations avait redérivé

`supabase db push` refusait de pousser : **8 migrations locales n'étaient pas
tracées comme appliquées** alors qu'elles l'étaient réellement en prod (elles
avaient été passées via l'API Management, qui n'alimente pas
`supabase_migrations.schema_migrations`).

Vérifié **une par une contre la base** avant tout réalignement — marquer comme
appliquée une migration qui ne le serait pas aurait masqué un trou réel :

| Migration | Marqueur vérifié en prod |
|---|---|
| `20260702000100` | table `quote_lines` + colonne `quotes.client_name` |
| `20260707000100` | colonne `product_library.gamme_slug` |
| `20260707000150` | gamme `packaging` présente |
| `20260707000200` | 115 lignes `product_library` avec `gamme_slug` |
| `20260708000100` | colonnes `shop_products.origin` / `config_hash` + fonction `persist_shop_ai_product` |
| `20260710000100` | 81 gammes, `calendrier` présente |
| `20260710200` → `20260710000200` | 101 définitions |
| `20260726000100` | colonne `shops.access_mode` |

→ `supabase migration repair --status applied` sur ces 8. **Opération de suivi
uniquement, aucune donnée touchée.**

### Migration corrigée en séance — `storage.protect_delete()`

La première version de `20260810000100` supprimait le bucket en SQL. **Rejetée
par Supabase** :

```
ERROR 42501 — Direct deletion from storage tables is not allowed.
Use the Storage API instead.        (trigger storage.protect_delete())
```

Le garde-fou est légitime : supprimer la ligne d'un objet en SQL laisserait le
fichier orphelin dans le stockage objet, qui n'est pas transactionnel avec
Postgres. La migration ne garde donc que ce qui relève du schéma (policy RLS +
`drop table`) ; le bucket part par l'API Storage :

```bash
supabase storage rm -r ss:///product_mockups --linked --experimental --yes
```

⚠️ **À retenir pour toute future migration touchant le stockage** : jamais de
`delete from storage.objects` / `storage.buckets` en SQL.

### État final vérifié en prod

| Contrôle | Attendu | Constaté |
|---|---|---|
| `tenant_gamme_subscriptions` | supprimée | 0 ✅ |
| Bucket `product_mockups` | supprimé | 0 ✅ |
| Bucket `shop_product_mockups` | **intact** | 1 ✅ |
| Table `shop_template_mockups` | **intacte** | 1 ✅ |
| Gammes avec visuel | 6 | 6 ✅ |
| Familles racines | 16 | 16 ✅ |
| `client_price_rules` (GesCom) | créée | 1 ✅ |
| `supabase db push --dry-run` | à jour | « Remote database is up to date » ✅ |

**GesCom appliqué au passage** (arbitrage Arnaud en séance) : le CLI applique
les migrations en attente dans l'ordre, sans sélection possible.
`20260808000100_gescom_price_rules.sql` était en attente depuis le 08/08 (accès
trousseau manquant). Le module Gestion commerciale livré sur `beta/v5`
n'affiche plus son bandeau « migration manquante ».

## Reste à la main d'Arnaud

1. **Recette visuelle** du dashboard et d'une boutique sous auth.
2. **Faire produire les 10 visuels manquants** — brochure en priorité : famille
   vendue, aujourd'hui sans visuel.
3. **GO push** de la branche `feature/refacto-visuels-gamme-pim`.

## Dettes tracées

- `shop_template_mockups` est encore clé sur les **7 familles mockup** alors que
  le PIM en compte **16** — à migrer sur la gamme.
- Le tracking des migrations redérive dès qu'on applique du SQL hors CLI (API
  Management, SQL Editor). Le réflexe `migration repair` après coup est déjà
  documenté dans `docs/SUPABASE_MIGRATIONS_WORKFLOW.md` §« Workflow alternatif » ;
  il n'a pas été tenu entre juillet et août.
