# Story S2.13 — Puces attributs PIM scan sur ProductCard

**Epic** : 2 (extension e-commerce) · **FR** : FR-ECOM-03 · **Sprint** : E1 · **Effort** : S
**Branche** : `beta/v5` · **Statut** : ✅ livrée (build + tests verts, non commité)

## Objectif
Afficher jusqu'à 3 puces d'attributs clés normalisés par famille (ex Flyer : format / grammage / finition) sur la card, comparables entre produits d'une même famille (UX §1). Data-driven : seules les puces renseignées s'affichent.

## Réutilisation (zéro duplication)
Les valeurs sont extraites via `resolveTemplate('{{key}}', config)` de `productEnrichment.ts` — **les mêmes resolvers** (`format`, `grammage`, `papier`, `finition`, `quantite`, `pages`) que l'enrichissement produit. Aucune logique d'extraction dupliquée. La famille vient de `resolveMockupTemplate` (S2.11).

## Tâches (TDD)
1. [x] Helper pur `src/app/utils/productAttributeChips.ts` : `resolveProductChips(product, max=3)` + `CHIP_SPECS` par famille. Tests `tests/utils/productAttributeChips.test.ts` — 4/4.
2. [x] testId `productCardAttrChip` dans `testIds.ts`.
3. [x] Câblage `ShopProductCard.tsx` : `<ul>` de puces entre description et prix, `title`=label (a11y), `data-attr`.
4. [x] build + test **646/646** verts.
5. [ ] TF Notion TF-S2.13.

## Fichiers touchés
- `src/app/utils/productAttributeChips.ts` (nouveau)
- `tests/utils/productAttributeChips.test.ts` (nouveau, 4/4)
- `src/app/lib/testIds.ts` (+`productCardAttrChip`)
- `src/app/components/shop/ShopProductCard.tsx` (rendu puces)

## Bug corrigé en cours de route
`resolveTemplate` avec `config` undefined crashait (resolver `format` déréférence `c.dimensions`) → défaut `config ?? {}` dans `resolveProductChips`.

## Décisions
- 3 puces max, ordre = priorité d'affichage par famille (`CHIP_SPECS`).
- Puce = valeur seule (unité incluse) + `title`=label pour l'a11y (UX §1 : scan visuel).
