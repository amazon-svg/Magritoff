# Story S2.11 — Bandeau catégorie couleur-codé + pictogramme signature

**Epic** : 2 (extension e-commerce standard) · **FR** : FR-ECOM-01 · **Sprint** : E1 · **Effort** : S
**Branche** : `beta/v5` · **Statut** : en cours (2026-07-07)

## Objectif
Chaque ProductCard expose un repère visuel de famille (couleur + pictogramme + libellé) cohérent, pour identifier la catégorie en 1 seconde sans lire le titre.

## Contexte technique (réutilisation)
- Famille = `resolveMockupTemplate(product)` (source unique `src/app/utils/productMockupAssets.ts`, 7 familles : flyer, carteVisite, brochure, depliant, etiquette, kakemono, packaging). **NE PAS inventer de taxonomie.**
- Composant à enrichir : `src/app/components/shop/ShopProductCard.tsx` (S2.3). NE PAS recréer.
- Décisions Arnaud 2026-07-07 : **token-agnostic** + **repères sémantiques neutres** (couleur de famille CONSTANTE inter-tenant, pas thémée par la boutique).
- a11y (DoD #10) : jamais la couleur seule → couleur **+** picto **+** libellé + `aria-label`.

## AC (rappel epics.md)
- AC1 : liseré coloré + picto + libellé famille sur la card, cohérent grille/fiche/panier/historique (cette story = card ; propagation fiche/panier = suivi).
- AC2 : famille sans mapping → repère neutre par défaut (jamais de card cassée). _(N/A : `resolveMockupTemplate` garantit toujours une des 7 familles, fallback `flyer`. Le "neutre par défaut" est couvert par le fallback famille.)_

## Tâches (TDD)
1. [x] Helper pur `src/app/utils/productFamilyIdentity.ts` (`resolveFamilyIdentity` + `FAMILY_IDENTITY` + `FAMILY_ICON`). Tests `tests/utils/productFamilyIdentity.test.ts` — **7/7 vert**.
2. [x] testId `productCardCategoryBadge` (`product-card-category-badge`) dans `testIds.ts`.
3. [x] Câblage `ShopProductCard.tsx` : liseré `border-left` 3px (tonalité famille) + bandeau picto+libellé, `data-family`, `aria-label="Famille …"`, picto `aria-hidden`.
4. [x] `npm run build` vert · `npm run test` **631/631 vert** (0 régression).
5. [ ] TF Notion TF-S2.11 (DoD #8) — **à créer** (non fait dans cette session : requiert accès Notion).

## Fichiers touchés
- `src/app/utils/productFamilyIdentity.ts` (nouveau)
- `tests/utils/productFamilyIdentity.test.ts` (nouveau)
- `src/app/lib/testIds.ts` (+1 testId)
- `src/app/components/shop/ShopProductCard.tsx` (import + `family` useMemo + liseré + bandeau)

## Statut : ✅ code livré (non commité — confirmation push requise). Reste : TF Notion.

## Décisions
- Couleur famille = palette curatée constante (7 teintes muted distinguables), PAS `--shop-primary` (décision B : repères neutres inter-tenant).
- Icônes : `lucide-react` (déjà dép.).
- Helper pur (label+tone+template testables) ; icônes mappées à part (composants React).
