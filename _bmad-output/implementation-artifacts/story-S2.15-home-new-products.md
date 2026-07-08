# Story S2.15 — Bloc « Nouveautés » sur la home boutique

**Epic** : 2 (extension e-commerce) · **FR** : FR-ECOM-05 · **Sprint** : E2 · **Effort** : S
**Branche** : `beta/v5` · **Statut** : ✅ livrée (build + tests verts, non commité)

## Objectif
Afficher sur la home les N derniers produits intégrés à la boutique, triés par date d ajout desc, avec badge Nouveau — pour donner une raison de revenir (UX §4). Se replie si aucun produit (data-driven).

## Réutilisation
- Tri = `resolveNewProducts(products, 4)` (nouveau helper pur) sur `created_at`.
- Rendu = **ShopProductCard enrichie** (S2.11-13) → repère famille + badge Nouveau (S2.12) + puces PIM gratis, cohérence totale avec le catalogue. Zéro nouveau composant de card.

## Tâches (TDD)
1. [x] Helper `src/app/utils/shopHomeSections.ts` : `resolveNewProducts` (tri created_at desc, sans-date en fin, cap). Tests `tests/utils/shopHomeSections.test.ts` — 4/4.
2. [x] testId `homeNewProducts` (`shop-home-new-products`).
3. [x] Câblage `PortalHome.tsx` : section « Nouveautés » (grille 4 cards) entre raccourcis et commandes récentes, repli si vide.
4. [x] build + test **650/650** verts.
5. [ ] TF Notion TF-S2.15.

## Fichiers touchés
- `src/app/utils/shopHomeSections.ts` (nouveau)
- `tests/utils/shopHomeSections.test.ts` (nouveau, 4/4)
- `src/app/lib/testIds.ts` (+`homeNewProducts`)
- `src/app/components/shop/portal/PortalHome.tsx` (section Nouveautés)

## Note
La home reste par ailleurs partiellement mockée (« Commandes récentes » = `products.slice(0,3)` + #CMD factices, hérité pré-session). Le branchement commandes réelles + devis (S2.16) et best-sellers secteur (S2.17) sont les stories suivantes du Sprint E2.
