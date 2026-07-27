# Story S7.6 — Prix plancher « dès X € » + GammeTile (Epic 7, Sprint V2-B)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **ADR** : §4.18 ADR-GAMME-FLOOR-1 (calcul à la volée client-side, source
> héritée, jamais « 0 € », aucun appel Clariprint pour les tuiles).

## Décisions d'implémentation

1. **`src/app/utils/gammeFloorPrices.ts`** : `computeGammeFloorPrices(products,
   gammes)` PUR → `Map<slug, PriceResolution>` — min sur `resolvePrice()` des
   produits de chaque gamme résolue (ADR-4.17), **agrégé aussi au niveau
   famille racine** (la tuile home est une famille). Résolutions `zero`
   ignorées pour le min ; gamme sans prix > 0 → absente de la map (l'appelant
   affiche « Prix à la configuration »).
2. **`GammeTile`** (`src/app/components/shop/gamme/GammeTile.tsx`) : mockup
   (image gamme si dispo, sinon identité famille `resolveRootFamilyIdentity`
   picto + tonalité), nom, compteur produits, « dès X € HT » + badge source
   (mêmes règles Price Display que S7.3 : prix marché = ⚠️), état sans-prix =
   « Prix à la configuration », état skeleton. Clic → `/g/:slug`.
3. Consommée par la home vitrine S7.8 (cette story livre le composant + les
   helpers, branchés en S7.8).

## Acceptance Criteria

- **AC1** : min correct par gamme ET par famille racine (produits des
  sous-gammes inclus) ; résolutions `zero` jamais retenues.
- **AC2** : la source du min est conservée (prix marché ⚠️ vs cache) — jamais
  de « dès 0 € ».
- **AC3** : GammeTile rend les 4 états (défaut, hover, sans-prix, skeleton),
  cible tactile ≥ 44 px, alt/aria corrects.
- **AC4** : helpers testés ; 0 régression.

## Fichiers

- `src/app/utils/gammeFloorPrices.ts` + `tests/utils/gammeFloorPrices.test.ts`
- `src/app/components/shop/gamme/GammeTile.tsx`
- `src/app/lib/testIds.ts` (scope gammeTile)

## TF Notion (copy-paste) — joué avec TF-S7.8 (home vitrine)
