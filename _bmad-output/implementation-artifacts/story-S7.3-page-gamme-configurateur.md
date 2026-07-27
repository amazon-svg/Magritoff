# Story S7.3 — Page gamme `/g/:gamme` : GammeConfigurator + StickyPriceBar (Epic 7, Sprint V2-A)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **Spec UX** : § Expérience déterminante — Page gamme-configurateur (wireframe
> complet) · **ADR** : §4.19-1 (route) · consomme le hook S7.2.

## Contexte

L'expérience déterminante du gabarit v2 : « j'atterris sur une gamme, je vois
un prix en < 3 s, je le façonne en temps réel, j'ajoute au panier ». Rendu PAGE
du moteur S7.2 (`useProductConfigurator`, `liveRecalc: true`).

## Décisions d'implémentation

1. **Vue `gamme`** ajoutée à `PortalView` + `parsePortalPath` (`g/:gamme` n'est
   plus redirigé). Nouveau dossier `src/app/components/shop/gamme/`.
2. **Produit représentatif** : la page configure le 1er produit actif de la
   gamme (sélection `selectGammeProducts` — gamme explicite ADR-4.17, y compris
   descendants pour une page famille). Le calcul par défaut se lance au mount
   (config du produit = défauts S2.33), prix < 3 s.
3. **GammeConfigurator** : chips Top formats (A6/A5/A4/A3), selects
   format/papier/impression/finitions/dorure (mêmes constantes que l'overlay),
   paliers quantité cliquables (`QUANTITIES`) + saisie libre.
4. **StickyPriceBar** : prix HT/TTC + badge source (`priceBadgeForPhase` :
   Clariprint / ⚠️ Prix marché / Prix sur demande) + CTA « Ajouter au panier »
   (→ drawer via `cartOpenRequest`) ; sticky colonne droite desktop, barre
   basse mobile. `aria-live=polite`.
5. **Filet Magrit** : « Une question sur ce produit ? » → vue catalogue (zone
   de recherche Magrit). Pré-contextualisation fine du chat = raffinement
   Phase 2+ (tracé), pas de nouveau composant hors backlog.
6. **Gamme sans produit actif** : page rendue quand même — état vide avec nom
   de gamme + CTA Magrit (jamais 404). L'éditorial PIM arrive en S7.4.
7. **Méga-menu visible** sur la vue gamme (navigation accessible partout).

## Acceptance Criteria

- **AC1** : `/shop/:slug/g/<gamme>` rend la page (H1 gamme, breadcrumb minimal,
  visuel 40 / configurateur 60 desktop, pile mobile) ; prix par défaut calculé
  au mount sans interaction.
- **AC2** : tout changement d'option relance le calcul (skeleton local sur le
  prix, jamais la page) ; chips Top formats et paliers quantité pré-remplissent.
- **AC3** : le prix porte TOUJOURS sa source (badge) ; sans source →
  « Prix sur demande » + CTA Magrit ; ajout bloqué uniquement si
  missing_required_product.
- **AC4** : « Ajouter au panier » ajoute la config courante au panier, ouvre le
  drawer, on reste sur la page.
- **AC5** : gamme inconnue ou vide → page avec état vide + CTA (pas de 404) ;
  helpers purs testés ; 0 régression.

## Fichiers

- `src/app/components/shop/gamme/gammePage.helpers.ts` + tests
- `src/app/components/shop/gamme/GammeConfigurator.tsx`
- `src/app/components/shop/gamme/StickyPriceBar.tsx`
- `src/app/components/shop/gamme/GammePage.tsx`
- `shopPortalRoutes.ts` / `types.ts` / `PublicShop.tsx` / `ShopLayout.tsx` /
  `testIds.ts` / `a11y-scan.sh`

## TF Notion (copy-paste)

**TF-S7.3 — Page gamme : prix immédiat et configuration en temps réel**
- **Parcours** : P09 · **Persona** : Acheteur B2B · **Type** : IA Chrome
- **Précondition** : boutique avec produits (ERAM), gamme `flyer` peuplée
- **Étapes** : (1) Ouvrir `/shop/<slug>/g/flyer` → H1 « Flyers », un prix
  s'affiche sans interaction (< 3 s, badge source visible). (2) Cliquer le chip
  « A4 » → le prix se recalcule (skeleton local). (3) Cliquer le palier « 1000 »
  → recalcul. (4) « Ajouter au panier » → le drawer panier s'ouvre, la page
  reste affichée. (5) Ouvrir `/shop/<slug>/g/gamme-inexistante` → état vide +
  bouton « Demander à Magrit », pas de 404.
- **Hints DOM** : `shop-gamme-page`, `shop-gamme-top-format-chip`,
  `shop-gamme-quantity-tier`, `shop-gamme-sticky-price`,
  `shop-gamme-price-source-badge`, `shop-gamme-sticky-add-btn`,
  `shop-gamme-empty-state`.
