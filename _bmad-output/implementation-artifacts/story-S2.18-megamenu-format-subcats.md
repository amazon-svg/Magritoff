# Story S2.18-fix — Méga-menu : sous-catégories dérivées par format

**Sprint** : E3 Navigation (Epic 2 e-commerce) — correctif post-clôture
**Date** : 2026-07-08
**Déclencheur** : retour Arnaud « le bigmenu n'est toujours pas actif via les boutons de catégories ».

## Problème

Le méga-menu (`ShopMegaMenu`) affiche la barre de familles, mais son **panneau déroulant**
ne se déployait jamais. Deux causes cumulées :

1. Le panneau est conditionné à `fam.subcategories.length > 0` ([ShopMegaMenu.tsx:112](../../src/app/components/shop/ShopMegaMenu.tsx#L112)).
2. `buildShopTaxonomy` filtre toute sous-catégorie à compteur 0. Or le catalogue est
   **seedé au niveau racine** (migration S-CAT-3, décision Arnaud 2026-07-07 : `gamme_slug`
   = famille, sans format). Aucune gamme enfant n'est donc peuplée → 0 sous-catégorie →
   panneau mort.

Re-seeder les produits sur les gammes enfants **contredirait** la décision S-CAT-3 / ADR-4.17.

## Décision (Arnaud, AskUserQuestion 2026-07-08)

**« Peupler les sous-catégories »** — clic famille = filtre inchangé. Sous-catégories rendues
réelles **sans toucher la donnée** : dérivées par **format** à l'affichage.

## Implémentation

Conforme ADR-4.17 : la **gamme racine reste la famille autoritaire** ; le **format ne fait que
raffiner** en sous-catégorie (jamais déterminant de famille).

| Fichier | Changement |
|---|---|
| `shopTaxonomy.ts` | Nouveau `deriveFormatSubcats()`. Repli dans `buildFamily` : si aucune gamme enfant peuplée, dérive les sous-cat depuis les formats distincts des produits (`resolveFormatLabel`, même source que la facette S2.19). Chaque nœud porte `formatKey` + `gammeSlugs = [racine]`. Alignement PIM : reprend libellé/slug/image de la gamme enfant quand le format correspond (« A3 » → « Affiche A3 »). Bucket « Autre » (format inconnu) jamais exposé. Champ `formatKey?` ajouté à `TaxonomyNode`. |
| `ShopMegaMenu.tsx` | `onSelectSubcategory(gammeSlugs, formatKey?)` — passe `sub.formatKey`. |
| `ShopLayout.tsx` | Prop `onSelectSubcategory` threade `formatKey`. |
| `PublicShop.tsx` | État `pendingFormat` + handler `selectSubcategory` (famille + format). `selectGammes` (famille) réinitialise le format. `initialFormat` passé à `PortalCatalog`. |
| `PortalCatalog.tsx` | Props `initialFormat` + `onSelectSubcategory`. `useEffect` présélectionne la facette Format (S2.19) à chaque changement de `initialFormat` ; `null` (famille) réinitialise. Landing → présélection format aussi. |
| `PortalCategoryLanding.tsx` | `onSelectSubcategory(gammeSlugs, formatKey?)`. |

### Comportement résultant
- **Desktop** : survol d'un bouton de catégorie → panneau déployé avec les formats réels
  (ex. Affiches → A3 / A2 / A1). Clic sous-cat → catalogue filtré famille + facette Format présélectionnée.
- **Clic famille** : filtre famille (inchangé), format réinitialisé.
- Famille sans format reconnu → panneau fermé (rien à détailler), jamais de sous-cat creuse.

## Tests
- `tests/utils/shopTaxonomy.test.ts` : +5 cas (dérivation format, `formatKey`, `gammeSlugs`
  niveau famille, alignement PIM, exclusion « Autre », chemin gamme réelle non écrasé).
- Suite complète : **714 vitest verts** (709 → 714). Build Vite vert.

## Vérif live — OK (2026-07-08, boutique ERAM, session Arnaud, 30 produits)
- Méga-menu « Affiches 6 » → panneau **Affiche A2 · 4 / A1 · 1 / A3 · 1** (compteurs réels,
  libellés alignés PIM).
- Clic « Affiche A2 » → bascule catalogue, famille **Affiches** filtrée (fil d'Ariane), facette
  **Format A2 présélectionnée** (`aria-pressed`), **4 résultats** (les 4 affiches A2).
- Landing éditorialisée « Affiches A1, A2, A3 » cohérente.

## Reste / notes
- Sous-catégorie dérivée = format issu de `config.format`. Si un format est absent sur des
  produits, ils ne comptent dans aucune sous-cat (mais restent dans la famille).
