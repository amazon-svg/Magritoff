---
id: R1
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 1 (post-démo)
priority: P0
effort: L (4 j-Claude)
assignee: Claude code
depends_on: [R0]
unblocks: [R4, R7]
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R4)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §1.3 E1 + §2.2
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md §3.1 + §8.1 A
  - mémoires : feedback_persona_primaire_imprimeur.md + feedback_pim_marketing_card.md + feedback_no_invent_hors_backlog.md
status: pending
---

# R1 — ProductCard décomposition 5 onglets + PIM Fiche enrichissement (priorité G satellite)

## Origine

Story refacto issue de l'**Étape D Winston** combinant 2 priorités P0 post-review adversariale : **A** (ProductCard atelier 1281 L décomposition) et **G** (PIM enrichissement Fiche atelier — règle dure Arnaud signalée 2×).

## Contexte

`ProductCard.tsx` 1281 lignes — composant le plus volumineux du repo. 9+ concerns mélangés, 13 useState, 5 contexts, 5 onglets (Fiche / Prix / 3D / Éditer / Debug). Densité conditionnelle 25 %. Edge case identifié E1 : `localProduct = useState(product)` clone le prop sans `useEffect` de sync → désynchro silencieuse si parent change.

**PIM marketing enrichissement** (G satellite) : 9 champs PIM (`h1`, `seo_title`, `seo_description`, `keywords`, `schema_org_type`, `quality_score`, `validated_by`, `usage_examples`, `faq`) doivent être rendus dans l'**onglet Fiche existant** (PAS dans nouvel onglet — règle dure Arnaud). La section `ProductPimSeoSection` créée en S-FIX-1b couvre déjà partiellement.

Persona primaire = imprimeur Pro atelier (mémoire `feedback_persona_primaire_imprimeur.md`).

## User story

En tant que **Owner tenant / Admin tenant** imprimeur Pro atelier, je veux que la fiche produit `ProductCard` soit décomposée en sous-composants par onglet (chacun testable indépendamment) **et** que l'onglet « Fiche » expose les 9 champs PIM marketing/SEO/GEO, afin de pouvoir maintenir la fiche produit sans dette monolithique et d'exposer les données nécessaires aux pure players W2P (persona tertiaire) sans nouveau onglet.

## Critères d'acceptation

1. **Given** la décomposition R1 livrée, **When** je liste les fichiers, **Then** la structure est : `ProductCard.tsx` (shell ≤ 300 L) + `ProductCardFiche.tsx` + `ProductCardPrix.tsx` + `ProductCard3D.tsx` + `ProductCardEditer.tsx` + `ProductCardDebug.tsx` + hooks extraits (`useClariprintProduct`, `useProductLibrary`).
2. **Given** la décomposition, **When** je grep `useState` dans le shell `ProductCard.tsx`, **Then** ≤ 5 useState (au lieu de 13). Les useState restants sont déplacés dans les sous-composants ou hooks dédiés.
3. **Given** l'onglet Fiche, **When** je rends un produit avec `definition` PIM enrichie, **Then** **les 9 champs PIM sont visibles** : `h1_template`, `seo_title`, `seo_description`, `keywords` (liste de chips), `schema_org_type` (badge), `quality_score` (score visuel), `validated_by` (badge `pending` / `human` / `llm`), `usage_examples` (liste 3+), `faq` (accordéon 4+).
4. **Given** un produit sans `definition` PIM (legacy), **When** l'onglet Fiche est rendu, **Then** les 9 champs PIM sont absents (pas de placeholder ni d'erreur) mais le reste de Fiche fonctionne (image + dimensions + grammage + bouton Copier JSON).
5. **Given** le bouton « Copier JSON » dans l'onglet Fiche (acquis S-FIX-1b), **When** je clique, **Then** le clipboard reçoit un JSON pretty-printed avec les sections `marketing`, `seo`, `structured_data`, `metadata`.
6. **Given** le bug E1 (state clone sans cleanup), **When** le parent ProductCard re-render avec un `product` différent, **Then** **un `useEffect` synchronise `localProduct ← product`** automatiquement (test unitaire couvrant le cas).
7. **Given** les 5 onglets initiaux **inchangés dans leur intitulé**, **When** je grep `data-testid="product-card-tab-` dans `testIds.ts`, **Then** je trouve `sheet`, `price`, `3d`, `edit`, `debug` (5 entrées strictes — règle dure : pas de nouvel onglet).
8. **0 régression mesurable** : `vitest run` >= 181/181 (R0 + nouveaux tests onglets-by-onglet). TF-60 (overlay atelier via Éditer) reste OK. TF-61 (Fiche PIM SEO + Copier JSON) reste OK.
9. **Garde-fou tests R0** : les tests `priceResolver`, `ClariprintAdapter`, `CartContext` (R0) restent verts pendant la décomposition.

## Spécifications API / data

- **Fichiers à créer** :
   - [src/app/components/product-card/ProductCardFiche.tsx](src/app/components/product-card/ProductCardFiche.tsx) — onglet Fiche enrichi 9 champs PIM
   - [src/app/components/product-card/ProductCardPrix.tsx](src/app/components/product-card/ProductCardPrix.tsx)
   - [src/app/components/product-card/ProductCard3D.tsx](src/app/components/product-card/ProductCard3D.tsx)
   - [src/app/components/product-card/ProductCardEditer.tsx](src/app/components/product-card/ProductCardEditer.tsx)
   - [src/app/components/product-card/ProductCardDebug.tsx](src/app/components/product-card/ProductCardDebug.tsx)
   - [src/app/hooks/useClariprintProduct.ts](src/app/hooks/useClariprintProduct.ts) — extraction logique data-fetching Clariprint avec AbortController (résout bug B5 audit review)
- **Fichier modifié** : [src/app/components/ProductCard.tsx](src/app/components/ProductCard.tsx) — shell réduit (≤ 300 L), conserve : tabs router, sync `localProduct ↔ product` via `useEffect`, distribution des props aux 5 sous-composants.
- **Helper** : `src/app/utils/productEnrichment.ts` reste pivot (22 imports — cf. audit §2.6).
- **testIds** : ajouter à [src/app/lib/testIds.ts](src/app/lib/testIds.ts) les testids des 9 champs PIM si pas encore (`product-card-fiche-h1`, `product-card-fiche-seo-title`, etc.). **NE PAS** coder en dur dans les composants.
- **Pas de modification du PIM backend** (déjà alimenté par S-FIX-DATA-1 backfill 22 product_definitions).

## Dépendances

- **Prérequis** : R0 mergé + vert (tests garde-fous priceResolver + ClariprintAdapter + CartContext).
- **Débloque** : R4 (types DB partagés peuvent dériver `ProductCard` props depuis `Tables<'product_definitions'>`).

## Estimation

**L (4 j-Claude)**. 1 j extraction `useClariprintProduct` + sync `localProduct` (résout E1 + B5) ; 1 j extraction ProductCardFiche + 9 champs PIM ; 0,5 j chacun pour Prix / 3D / Éditer / Debug = 2 j ; 0,25 j shell + routing tabs ; 0,75 j tests vitest par onglet.

## Plan de test

- **vitest** : 1 test par sous-composant onglet (5 tests) + 1 test `useClariprintProduct` + 1 test sync `localProduct ← product` (E1).
- **TF Notion à re-jouer** : [TF-60](https://www.notion.so/35dd0131973c816ca5bddd02cb6cf115) + [TF-61](https://www.notion.so/35dd0131973c81e7b3dbf5ae0827fa4c).
- **TF nouveau à créer** : *"ProductCard atelier — 9 champs PIM rendus dans onglet Fiche existant (PAS nouvel onglet)"*, P05, Owner tenant, P0, IA Chrome. Hints DOM : assertions sur les 9 testids PIM + assertion `0 onglet "Marketing"` dans le DOM.
- **Smoke visuel humain** : Arnaud valide sur port 5177 atelier `/t/imprimerie-ipa` un produit avec `definition` PIM enrichie.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- 5 sous-composants + 1 hook + shell réduit livrés.
- vitest run vert avec 7+ nouveaux cas.
- TF-60 + TF-61 re-joués OK.
- TF nouveau « 9 champs PIM dans Fiche » créé et joué OK.
- Smoke visuel Arnaud validé sur atelier.
- Update `architecture.md` §6.3 avec ADR-R4 décomposition tranchée.
- 0 occurrence onglet « Marketing » ou autre onglet non-spec dans le DOM (règle dure `feedback_no_invent_hors_backlog.md`).
