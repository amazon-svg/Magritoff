# Story S7.1 — Routage boutique route-driven (Epic 7, Sprint V2-A)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **ADR de référence** : architecture.md §4.19-1 (préalable SEO : une URL par vue)
> **Spec UX** : ux-design-specification.md § Navigation Patterns (URL canoniques)

## Contexte

`/shop/:slug` est une route unique ; les vues (home/catalog/product/orders/thankYou)
sont un state interne `useState<PortalView>` de `PublicShop` (lesson 2026-06-10 :
states ≠ routes — deep-linking impossible, SEO impossible). Le gabarit v2 exige des
URL canoniques : `/shop/:slug` (home), `/g/:gamme` (S7.3), `/account/*` (S7.10).

## Décisions d'implémentation

1. **Catch-all** : `routes.tsx` passe `/shop/:slug` → `/shop/:slug/*`. `PublicShop`
   reste le contrôleur unique (état partagé panier/produits/shop conservé) ; la vue
   est **dérivée du splat** au lieu d'un state.
2. **Helper pur** `src/app/components/shop/portal/shopPortalRoutes.ts` :
   `parsePortalPath(splat)` → `{view, productId?}` + `portalPathForView(view, productId?)`
   + table de redirections legacy. Testable vitest sans DOM.
3. **Mapping** : `''`→home · `catalog`→catalog · `p/:productId`→product (lookup dans
   le catalogue chargé ; introuvable → catalog) · `orders`→orders (`?tab=` préservé,
   PortalOrders gère déjà le query param) · `thank-you`→thankYou (sans lastOrderId →
   Navigate catalog, remplace l'IIFE side-effect) · `account`/`account/*`→orders
   (placeholder S7.10) · inconnu→home.
4. `setView(v)` remplacé par `navigate()` ; `selectedProduct` devient dérivé
   (productId d'URL → find dans products). Back/forward navigateur fonctionnels.
5. a11y-scan : + `/shop/boutique-1/catalog`.

## Acceptance Criteria

- **AC1** : chaque vue du portail a une URL stable ; back/forward navigateur
  naviguent entre les vues ; reload sur une URL profonde re-rend la bonne vue.
- **AC2** : `/shop/:slug/orders?tab=to-validate` ouvre directement le bon tab
  (deep-linking emails — story de suivi S-ORDER-ROLES résolue).
- **AC3** : URL inconnue ou produit introuvable → repli gracieux (home / catalog),
  jamais d'écran blanc ni de 404 interne.
- **AC4** : `thank-you` sans commande → redirection catalog (pas de side-effect
  pendant le render).
- **AC5** : 0 régression vitest ; helpers routés couverts (round-trip parse/build,
  legacy, inconnus).

## Tests

- `src/app/components/shop/portal/shopPortalRoutes.test.ts` (nouveau).
- Suite vitest complète verte (baseline 723).
- Smoke navigateur : home → catalog → produit → orders (tab) → back.

## Fichiers touchés

- `src/app/routes.tsx` (catch-all)
- `src/app/components/shop/PublicShop.tsx` (view dérivée, navigate)
- `src/app/components/shop/portal/shopPortalRoutes.ts` (nouveau)
- `scripts/a11y-scan.sh` (+1 route)

## TF Notion (copy-paste, à coller dans la DB 🧪)

**TF-S7.1 — Navigation boutique par URL**
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **Précondition** : boutique active avec produits (ex. boutique-1)
- **Étapes** : (1) Ouvrir `/shop/<slug>/catalog` directement → le catalogue s'affiche.
  (2) Cliquer un produit → l'URL devient `/shop/<slug>/p/<id>`. (3) Bouton Précédent
  du navigateur → retour catalogue. (4) Ouvrir `/shop/<slug>/orders?tab=mine` →
  l'onglet « Mes commandes » est actif. (5) Ouvrir `/shop/<slug>/nimporte-quoi` →
  home boutique.
- **Résultat attendu** : chaque URL rend la vue correspondante, aucun écran blanc.
- **Hints DOM** : `data-testid="shop-*"` existants (layout), URL barre d'adresse.
