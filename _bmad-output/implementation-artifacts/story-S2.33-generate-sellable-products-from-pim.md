# Story S2.33 — Générer les produits vendables depuis le PIM (pont PIM → product_library)

> **Epic** : Epic 2 — Boutique B2B Premium (extension catalogue)
> **Statut** : implémenté (front-only) — 2026-07-24

## Implémentation livrée (2026-07-24)

- **Helper pur** `src/app/utils/buildPimGeneratedProducts.ts` : `gamme →
  product_library` (price_ht 0, marqueur `config.source='pim-generated'`,
  `clariprintData.kind` + dims depuis `matching_rules`). 6 tests vitest.
- **LibraryContext** : `generateFromPim(gammes)` (idempotent : delete des
  `pim-generated` puis reinsert) + `clearPimGenerated()`.
- **DashboardLibrary** : panneau « Catalogue depuis le PIM » → boutons
  Générer/Régénérer + Nettoyer (confirmation), compteur de produits générés.
- **ShopProductCard** : « Configurez pour le prix » pour les produits générés
  (prix à la config via overlay Clariprint, A1).
- Build OK, suite complète **737 tests verts**.

### Smoke à jouer (Arnaud)

1. Dashboard → Bibliothèque → « Générer le catalogue » → confirme (81 produits).
2. Vérifier le compteur + les produits dans la liste.
3. Boutique en mode PIM (S2.32) → « Tout sélectionner » les gammes → Enregistrer.
4. `/shop/<slug>` : les produits apparaissent, carte « Configurez pour le prix »
   → clic Configurer → overlay Clariprint calcule le prix live.


> **Branche** : `beta/v5`
> **Date création** : 2026-07-24
> **Auteur** : John (PM) / investigation Claude Code
> **Dépend de** : S2.32 (mode PIM catalogue), pipeline PIM (`pim-ingest`/`pim-generate`)

## Story

En tant qu'**admin tenant (imprimeur) qui a alimenté son PIM avec un catalogue (ex : Exaprint, 81 gammes + 82 définitions)**,
je veux **générer en un clic des produits vendables à partir de ces gammes PIM**,
afin que **mes boutiques puissent réellement vendre tout ce catalogue** (aujourd'hui le PIM n'est que taxonomie + contenu SEO, il ne crée aucun produit vendable).

## Contexte / problème (investigation 2026-07-24)

État prod constaté :
- `product_gammes` = **81 gammes** (taxonomie Exaprint ingérée)
- `product_definitions` = **82 fiches** (contenu SEO/marketing par gamme, avec `{{variables}}`)
- `product_library` = **33 produits vendables au total**, dont **2** pour le tenant d'Arnaud

**Cause racine** : dans Magrit, le PIM est une **couche taxonomie + contenu**, pas un
stock de produits vendables. `pim-ingest` remplit `product_gammes` ; `pim-generate`
génère des `product_definitions` (SEO via Claude). **Aucun mécanisme ne crée de
`product_library`** — les produits vendables se créent par tenant (devis Magrit →
« ajouter à la bibliothèque »). D'où 2 produits seulement, et une boutique quasi
vide même en « mode PIM catalogue complet » (S2.32, qui expose `product_library`).

S2.33 crée le **pont manquant** : matérialiser des produits vendables depuis le PIM.

## Design proposé

**Action tenant-level** « Générer le catalogue depuis le PIM » (bouton dans
`DashboardLibrary` ou `DashboardAdminPIM`). Pour chaque gamme du PIM, crée (upsert
idempotent) un `product_library` pour le tenant :

| Champ | Source |
|---|---|
| `name` | `product_gammes.name` (ex : « Carte de visite horizontale ») |
| `gamme_slug` | `product_gammes.slug` (ADR-4.17 autoritaire) |
| `category` | gamme / kind |
| `description` | dérivée de la `product_definition` (template résolu avec valeurs par défaut, ou description courte) |
| `config` | **config par défaut** dérivée de `gamme.matching_rules` (kind, format/quantité par défaut) — compatible overlay Clariprint |
| `price_ht` | **selon décision prix (cf. ci-dessous)** |
| `image_url` | `''` (fallback mockup SVG existant) |
| `library_id` | librairie auto « Catalogue PIM » du tenant, ou `NULL` |
| `active` | `true` |
| marqueur | `config.source = 'pim-generated'` (idempotence + non-écrasement des produits manuels) |

Ensuite les boutiques en **mode PIM** (S2.32) exposent automatiquement ces produits.
L'acheteur reconfigure via l'overlay Clariprint existant (`ProductOverlay`).

### Idempotence

Upsert par `(tenant_id, gamme_slug, config.source='pim-generated')` : re-générer ne
duplique pas, met à jour name/description/config, **ne touche pas** aux produits
créés manuellement.

## DÉCISION PRISE — A1 : prix à la configuration (Arnaud 2026-07-24)

`price_ht = 0`, la carte boutique affiche « **Configurez pour le prix** » (au lieu
de « 0 ») pour les produits `pim-generated` ; le prix réel vient de l'**overlay
Clariprint** quand l'acheteur choisit quantité/format. 0 appel Clariprint à la
génération.

### Audit prod 2026-07-24 (contrat technique)

- **`matching_rules`** par gamme = `{ kind: leaflet|folded|packaging, size_near:{width,height,tol} | size_range:{min_dim,max_dim} }`. → source des `kind` + dimensions par défaut.
- **`config` d'un produit réel** = objet riche : `id, kind, name, format, weight, material, printing{recto,verso}, quantity, finishRecto/Verso, clariprintData{kind,width,height,papers,quantity,deliveries,back_colors,front_colors,with_bleeds,finishing_*}`.
- **`ProductOverlay`** s'initialise via `extractInitialOptions(product)` — **fournit des défauts même avec `config:{}`** (appelé en fallback avec `{config:{}}`). → un produit généré n'a besoin QUE du minimum (kind + dimensions + gamme_slug + name) ; l'overlay complète et l'acheteur configure.
- **`ShopProductCard`** affiche `product.price_ht.toFixed(0)` → à conditionner pour `pim-generated` (afficher « Configurez pour le prix »).

### Ancienne section (options prix — pour archive)

C'est le point structurant. Les `product_definitions` sont des templates avec
`{{quantite}}`, `{{format}}`… → un produit généré n'a pas de prix « naturel ».

- **A1 — Prix à la configuration (recommandé MVP)** : `price_ht = 0`, la carte
  affiche « Configurez pour obtenir le prix » ; le **prix réel vient de l'overlay
  Clariprint** au moment où l'acheteur choisit quantité/format. Léger (0 appel
  Clariprint à la génération), aligné web-to-print, réutilise l'existant.
- **A2 — Prix indicatif « à partir de X€ »** : à la génération, appel **Clariprint
  (via ClariprintAdapter)** sur une config par défaut par gamme → stocke un prix
  indicatif. Boutique montre des prix immédiats, mais 81 appels Clariprint +
  gestion des gammes non tarifables + rafraîchissement.
- **A3 — Prix marché / manuel** : `prix_marche` si dispo sinon 0 ; l'admin ajuste
  après via l'éditeur (tarif négocié A4.5 déjà en place).

## Acceptance Criteria (esquisse — à finaliser après décision prix)

- **AC1** — Action « Générer le catalogue depuis le PIM » (bouton + confirmation),
  crée/upsert un `product_library` par gamme PIM pour le tenant courant.
- **AC2** — Idempotence : re-générer ne duplique pas, ne touche pas aux produits
  manuels (marqueur `config.source='pim-generated'`).
- **AC3** — `config` par défaut cohérente avec l'overlay Clariprint (l'acheteur peut
  reconfigurer et obtenir un prix live).
- **AC4** — Prix selon décision A1/A2/A3.
- **AC5** — Les produits générés apparaissent en boutique via le mode PIM (S2.32),
  regroupés par gamme, contenu SEO enrichi par `product_definitions`.
- **AC6** — Toute interaction Clariprint via `ClariprintAdapter` +
  `validateClariprintResponse()` (convention projet).
- **AC7** — Bouton « Nettoyer le catalogue PIM généré » (supprime les
  `pim-generated`, garde les manuels) — réversibilité.
- **AC8** — Tests : helper de mapping gamme→product_library (pur, vitest) ; DoD
  smoke E2E acheteur sur une boutique remplie via génération.

## Open questions (post-décision prix)

1. Emplacement du bouton : `DashboardLibrary` (tenant) vs `DashboardAdminPIM`.
2. Librairie dédiée « Catalogue PIM » vs `library_id = NULL`.
3. `config` par défaut : quelles valeurs (quantité/format) par kind de gamme ?
   → auditer `matching_rules` avant (heuristique = audit prod d'abord).
4. Locale/variations : 1 produit par gamme (82 def, variation_filter vide
   aujourd'hui) — OK pour MVP. Multi-variations = V2.

## Références

- [Source: investigation prod 2026-07-24 — product_gammes 81 / definitions 82 / library 33]
- [Source: story-S2.32-shop-pim-catalog-mode.md — mode PIM expose product_library]
- [Source: supabase/functions/pim-generate, pim-ingest — pipeline PIM = contenu, pas produits]
- [Source: docs/project-context.md — PIM shared catalog, ClariprintAdapter, resolvePrice]
