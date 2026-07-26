# Story S7.2 — Hook `useProductConfigurator` (Epic 7, Sprint V2-A)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **Garde-fou n°1 de l'itération** (spec UX § Component Strategy) : le moteur de
> configuration/prix est UNIQUE — overlay et page gamme (S7.3) le consomment.
> Aucune duplication de logique prix.

## Contexte

`ProductOverlay.tsx` embarque le moteur : state `ConfigOptions` +
`extractInitialOptions` + `buildClariprintPayload` + `computePrice` (debounce
300 ms, timeout 10 s, AbortController) + machine `Phase`
(idle/loading/ready/error) + cascade prix marché sur erreur + `handleAdd`.
S7.3 (page gamme) a besoin du même moteur en rendu page.

## Décisions d'implémentation

1. **`src/app/hooks/useProductConfigurator.ts`** : hook + helpers PURS exportés
   (`computeSuccessPhase`, `computeErrorPhase`, `resolveFinalPriceHT`,
   `buildConfiguredProduct`, `isAddDisabled`) — testables sans DOM ni mock
   réseau (convention useOrderRoles).
2. API : `{ options, setOptions, patchOptions, phase, retry, confirm }` —
   `confirm()` retourne le `ShopProduct` configuré (prix final + clariprintData)
   sans fermer quoi que ce soit (la fermeture reste au composant).
3. `opts.liveRecalc` : défaut `ENABLE_OVERLAY_LIVE_RECALC` (iso-overlay) ; la
   page gamme S7.3 passera `true` (recalc à chaque option, exigence UX < 1,5 s).
4. `ProductOverlay` re-branché sur le hook, **iso-fonctionnel** : mêmes testIds,
   mêmes états visuels, même semantics de debounce/abort/retry.

## Acceptance Criteria

- **AC1** : ProductOverlay rend exactement les mêmes états qu'avant (idle →
  loading → ready | error, fallback prix marché, retry réseau, add disabled sur
  missing_required_product). 0 régression vitest.
- **AC2** : plus AUCUNE logique de calcul de prix dans ProductOverlay.tsx (que
  du rendu) ; le hook est le seul propriétaire de la machine Phase.
- **AC3** : helpers purs couverts par tests unitaires (succès, 3 familles
  d'erreurs, cascade prix final, add disabled).

## Fichiers

- `src/app/hooks/useProductConfigurator.ts` (nouveau)
- `src/app/components/shop/ProductOverlay.tsx` (refonte consommation)
- `tests/hooks/useProductConfigurator.test.ts` (nouveau)

## TF Notion (copy-paste)

**TF-S7.2 — Configurateur overlay iso-fonctionnel post-extraction**
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **Étapes** : (1) Catalogue boutique → « Configurer et ajouter » sur un produit.
  (2) Changer la quantité → le prix se recalcule (indicateur « Recalcul... »).
  (3) Couper le réseau (devtools offline) → changer une option → banner
  « Erreur réseau — Prix marché estimé » + bouton Réessayer + badge ESTIMATION.
  (4) « Ajouter au panier » → la ligne panier porte le prix affiché.
- **Hints DOM** : `shop-product-overlay`, `shop-overlay-price-display`,
  `shop-overlay-error-banner`, `shop-overlay-retry-btn`, `shop-overlay-add-btn`.
