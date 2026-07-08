# Story S2.21 — Recherche produits + autocomplétion + fallback Magrit

- **Epic** : Epic 2 — Extension boutique e-commerce standard
- **Sprint** : E3 Navigation
- **FR couverts** : FR-ECOM-11
- **ADR liés** : §4.15 (fallback Magrit), §4.17 (gamme = catégorie explicite)
- **Auteur** : Amelia (Dev) — 2026-07-08
- **Statut** : livrée (en attente confirmation push)

## Contexte

La barre de recherche conversationnelle du catalogue (`PortalCatalog`) existe déjà
(S-CONSO-4) : saisie libre → `askMagrit()` (claude-proxy) avec fallback automatique
sur filtre texte local. S2.19 a ajouté le pont « Demander à Magrit » dans l'état vide.

**Le delta S2.21 = l'autocomplétion instantanée** : dès 2 caractères, un menu de
suggestions (produits + familles) s'affiche sous la barre. Un clic mène directement
au produit ou à la famille (catégorie). Si rien ne matche → une entrée
« Demander à Magrit » dans le menu, qui déclenche le chat IA pré-rempli avec la requête.

On NE refait PAS : `askMagrit`, `filterProductsByTextQuery`, `buildShopTaxonomy`,
`selectGammes` (navigation famille du méga-menu), `onSelectProduct`.

## Acceptance Criteria

- **AC1** — Given l'acheteur tape ≥ 2 caractères dans la barre, When il saisit,
  Then des suggestions instantanées (produits + familles) apparaissent sous la barre.
- **AC2** — Given une suggestion produit, When clic, Then la fiche produit s'ouvre
  (`onSelectProduct`). Given une suggestion famille, When clic, Then le catalogue
  filtre sur cette famille (réutilise `selectGammes` du méga-menu).
- **AC3** — Given aucune correspondance (≥ 2 car.), When le menu s'affiche, Then une
  entrée « Demander à Magrit » propose d'ouvrir la recherche IA pré-remplie avec la requête.
- **AC4** — Given le menu ouvert, When l'acheteur presse Échap ou clique ailleurs,
  Then le menu se ferme (a11y clavier + `aria-*`).

## Décisions de conception

1. **Index de recherche = catalogue complet** (pas seulement la vue filtrée). Une
   recherche « flyers » depuis la vue « Affiches » doit trouver les flyers → le
   catalogue reçoit `searchIndex` (liste complète) en plus de `products` (grille filtrée).
   Fallback sur `products` si `searchIndex` absent (rétro-compat).
2. **Familles d'abord, puis produits** (une famille couvre plus large). Caps :
   3 familles + 5 produits.
3. **Matching accent-insensible** (`normalizeSearchText`) sur name + description +
   gamme, plus robuste que le substring brut de `filterProductsByTextQuery`.
4. **Navigation famille** : nouvelle prop optionnelle `onSelectFamily(gammeSlugs)`
   câblée à `selectGammes` dans `PublicShop`. Absente → la suggestion famille se
   comporte comme un filtre texte (dégradé gracieux).
5. **Fallback Magrit** : l'entrée « Demander à Magrit » du menu appelle `askMagrit()`
   (existant) avec la requête déjà dans `query`.

## Implémentation

- `src/app/utils/catalogSearch.ts` (NEW) — helpers purs :
  - `normalizeSearchText(s)` — minuscule + suppression diacritiques.
  - `buildSearchSuggestions(query, products, gammes, opts)` — retourne
    `SearchSuggestion[]` (familles puis produits), `[]` si query < 2 car.
  - `hasNoMatch(query, suggestions)` — true si ≥ 2 car. et 0 suggestion.
- `src/app/components/shop/portal/PortalCatalog.tsx` — menu autocomplétion sous la
  barre (produits + familles + entrée fallback), navigation clavier (Échap), fermeture
  au blur, `aria-expanded`/`aria-controls`/`role="listbox"`. Nouvelle prop
  `searchIndex` + `onSelectFamily`.
- `src/app/components/shop/PublicShop.tsx` — passe `searchIndex={products}` (complet)
  et `onSelectFamily={selectGammes}`.
- `src/app/lib/testIds.ts` — `catalogSearchMenu`, `catalogSearchOption`,
  `catalogSearchAskMagrit`.

## Tests

- `tests/utils/catalogSearch.test.ts` — normalize, seuil 2 car., familles+produits,
  caps, accent-insensible, `hasNoMatch`.
- Baseline : 689 verts avant, cible 0 régression.

## TF Notion

`_bmad-output/implementation-artifacts/TF-NOTION-S2.21.md` (3 cas P09).

## DoD

- [x] Story doc
- [x] Helpers purs + tests vitest verts
- [x] TF Notion copy-paste
- [x] testIds déclarés (pas d'invention)
- [x] Microcopy FR sans anglicisme
- [ ] Confirmation Arnaud avant push
