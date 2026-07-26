# Story S7.8 — Home vitrine pour tous (Epic 7, Sprint V2-B)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **Spec UX** : § Implementation Approach (home : hero tenant → bandeau
> Reprendre → Top Produits 4 col → éditorial tenant → footer) + décision
> Arnaud « home = vitrine catalogue pour TOUS ».

## Contexte

La home actuelle (F1 portail) contient des données MOCK (« Bonjour Léa »,
« #CMD-2480 · livré il y a 1 j », promesse « livraison 72 h » non sourcée) et
cible le seul acheteur loggé. Le gabarit v2 en fait une vitrine pour tous les
visiteurs (SEO/nouveau client inclus).

## Décisions d'implémentation

1. **Refonte `PortalHome`** : intro sobre (titre + phrase descriptive du
   comportement réel — pas de claim inventé) → grille **Top Produits** =
   `GammeTile` (S7.6) par famille peuplée (taxonomie existante
   `buildShopTaxonomy` + planchers `computeGammeFloorPrices`), 2/3/4 col →
   **Nouveautés** (S2.15, conservée, données réelles) → **éditorial tenant**
   (`shop.description`, masqué si vide) → footer léger (nav + mention Magrit).
2. **Suppression des mocks** : « Léa », faux numéros de commande, promesse
   72 h, raccourci « Commande multi-sites » (pointait sur une vue cart
   inexistante). Le bloc reprise panier S2.16 est CONSERVÉ tel quel (remplacé
   proprement par ResumeBanner en S7.9).
3. Clic tuile → `/g/:famille` (page gamme S7.3).

## Acceptance Criteria

- **AC1** : visiteur anonyme voit la vitrine : tuiles familles avec « dès X € »
  badgé ou « Prix à la configuration », clic → page gamme.
- **AC2** : plus aucune donnée mock sur la home (grep Léa/CMD-24).
- **AC3** : Nouveautés conservée ; bloc panier S2.16 conservé (repli si vide) ;
  éditorial tenant seulement si `shop.description` non vide.
- **AC4** : responsive 2/3/4 colonnes ; 0 régression.

## Fichiers

- `src/app/components/shop/portal/PortalHome.tsx` (refonte)
- `src/app/components/shop/PublicShop.tsx` (props)
- `src/app/lib/testIds.ts` (homeGammeGrid, homeEditorial, homeFooter)

## TF Notion (copy-paste)

**TF-S7.8 — Home vitrine : tuiles gammes « dès X € »**
- **Parcours** : P09 · **Persona** : Visiteur non authentifié · **Type** : IA Chrome
- **Étapes** : (1) Ouvrir `/shop/<slug>` en anonyme → grille de tuiles
  familles avec mockup/picto, compteur produits et « dès X € HT » (badge ⚠️
  marché le cas échéant) ou « Prix à la configuration ». (2) Cliquer la tuile
  « Flyers » → `/g/flyer`. (3) Vérifier l'absence de « Bonjour Léa » et de
  numéros de commande fictifs. (4) Redimensionner 375/768/1280 → 2/3/4 col.
- **Hints DOM** : `shop-home-gamme-grid`, `shop-gamme-tile`,
  `shop-gamme-tile-floor-price`, `shop-home-editorial`, `shop-home-footer`.
