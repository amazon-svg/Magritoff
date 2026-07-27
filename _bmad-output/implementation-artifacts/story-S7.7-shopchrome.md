# Story S7.7 — ShopChrome : header e-commerce constant (Epic 7, Sprint V2-B)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **Spec UX** : Custom Component n°1 (ShopChrome) + décision D3 (recherche
> proéminente, panier avec MONTANT).

## Décisions d'implémentation

1. **`ReassuranceStrip`** (variant `header`) : bandeau fin en tête — 3 faits
   DÉRIVÉS des claims produits existants (S2.26 cards) : « Prix immédiat par
   Magrit », « Fabriqué en France », « Papiers FSC/PEFC ». Pas d'invention
   (avis/livraison sans donnée → absents) ; variant `fiche` harmonisé en S7.14.
2. **`ShopHeaderSearch`** : barre large au centre du header (placeholder
   « Que voulez-vous imprimer ? ») — réutilise `buildSearchSuggestions` S2.21
   (logique INCHANGÉE, repositionnée). Produit → `/p/:id` ; famille →
   `/g/:famille` ; aucun résultat → « Demander à Magrit » (vue catalogue).
   Mobile : rangée pleine largeur sous le header.
3. **Panier avec MONTANT** : le bouton header affiche `Panier · X,XX €`
   (`resolveCartLabel` pur) + compteur badge conservé.
4. **Nav univers → pages gammes** : clic FAMILLE du méga-menu → navigation
   `/g/:famille` (page gamme SEO-able) au lieu du filtre catalogue.
   `ShopMegaMenu.onSelectFamily` passe désormais `familyKey` (rétro-compat).
   Les sous-catégories par format gardent le comportement catalogue + facette.
5. Réassurance/recherche/panier constants sur toutes les vues boutique.

## Acceptance Criteria

- **AC1** : bandeau réassurance (3 faits) visible en tête sur toutes les vues.
- **AC2** : recherche header — saisir « fly » → suggestions produits +
  familles ; clic produit → fiche ; clic famille → page gamme ; requête sans
  résultat → option « Demander à Magrit ».
- **AC3** : le bouton panier affiche le montant HT dès qu'une ligne existe.
- **AC4** : clic famille méga-menu → `/g/:famille` (URL) ; sous-catégorie →
  catalogue filtré (inchangé).
- **AC5** : a11y — recherche au clavier (Entrée/Échap), aria sur suggestions ;
  0 régression.

## Fichiers

- `src/app/components/shop/ReassuranceStrip.tsx` (nouveau)
- `src/app/components/shop/ShopHeaderSearch.tsx` (nouveau)
- `src/app/components/shop/ShopLayout.tsx` + `.helpers.ts` (resolveCartLabel)
- `src/app/components/shop/ShopMegaMenu.tsx` (familyKey)
- `src/app/components/shop/PublicShop.tsx` (wiring)
- `src/app/lib/testIds.ts`

## TF Notion (copy-paste)

**TF-S7.7 — Header e-commerce : réassurance, recherche, panier montant**
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **Étapes** : (1) Ouvrir la boutique → bandeau réassurance 3 faits au-dessus
  du header. (2) Taper « fly » dans la recherche du header → suggestions ;
  cliquer la famille « Flyers » → URL `/g/flyer`. (3) Taper « zzzz » →
  « Demander à Magrit ». (4) Ajouter un produit au panier → le bouton header
  affiche « Panier · <montant> € ». (5) Méga-menu : clic « Affiches » → URL
  `/g/affiche`.
- **Hints DOM** : `shop-reassurance-strip`, `shop-header-search`,
  `shop-header-search-option`, `shop-header-cart-amount`, `shop-mega-menu-family`.
