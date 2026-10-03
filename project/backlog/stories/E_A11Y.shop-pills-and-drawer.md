---
id: E_A11Y.shop-pills-and-drawer
title: E_A11Y.shop-pills-and-drawer — aria-pressed pill-all + aria-modal drawer
epic: EPIC-E4
feature: FEAT-E4-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c81bcabc7f86cba835416
  url: https://app.notion.com/35dd0131973c81bcabc7f86cba835416
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P1"
  originalEffort: "XS"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:02:50Z"
  lastEditedAt: "2026-05-11T09:02:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_A11Y.shop-pills-and-drawer.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_A11Y.shop-pills-and-drawer.md
---

# E_A11Y.shop-pills-and-drawer — aria-pressed pill-all + aria-modal drawer

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/35dd0131973c81bcabc7f86cba835416)). Le statut Notion `Pas commencé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

_Non formulé dans la source Notion._

## Origine

Story issue de la **Campagne TF Sprint 3 du 11/05/2026** — réserves a11y P1 cumulables sur TF-57 ✅ et TF-63 ✅.
- Fiche TF source 1 : [TF-57 — Pilules gammes filtre additif](https://www.notion.so/35dd0131973c81f98bdbdc46d848b70d)
- Fiche TF source 2 : [TF-63 — Drawer panier slide-right](https://www.notion.so/35dd0131973c81e78d5cdaff5bf4e993)

## Contexte

Le pill `shop-gamme-pill-all` n'a aucun `aria-pressed` (ni `"true"` ni `"false"`) dans aucun état. Pattern toggle-group WCAG recommande `aria-pressed="true"` quand pill-all est actif (`selectedGammes.length === 0`).
Le composant `shop-cart-drawer` (Sheet shadcn) n'expose pas `aria-modal="true"` malgré `role="dialog"`. Les lecteurs d'écran ne signaleront pas la modalité du drawer.
Périmètre : [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx) (pill-all l. 351-359), [src/app/components/shop/portal/PortalCart.tsx](src/app/components/shop/portal/PortalCart.tsx) (Sheet shadcn).

## User story

En tant que **Acheteur shop_only** utilisateur de lecteur d'écran (NVDA, JAWS, VoiceOver), je veux que le filtre « Tout » indique son état actif/inactif et que le drawer signale sa modalité, afin de naviguer la boutique B2B avec une assistance WCAG niveau AA.

## Critères d'acceptation

1. **Given** je suis sur `/shop/<slug>` sans filtre sélectionné, **When** j'inspecte `shop-gamme-pill-all`, **Then** son `aria-pressed` est exactement **`"true"`**.
2. **Given** je clique sur 1-2 pills gammes, **When** j'inspecte `shop-gamme-pill-all`, **Then** son `aria-pressed` est exactement **`"false"`**.
3. **Given** je clique `shop-cart-icon`, **When** le drawer s'ouvre, **Then** `shop-cart-drawer` a **`role="dialog"`**** ET ****`aria-modal="true"`** simultanément.
4. **Given** un test axe ou pa11y, **When** je scan la page boutique, **Then** **0 violation WCAG** sur `aria-pressed` ou `aria-modal`.
5. **0 régression** comportementale : TF-57 filtre additif + localStorage OK, TF-63 drawer slide-right + Esc OK.
6. **Re-test TF-57 + TF-63** valident les nouveaux attributs aria.

## Spécifications API / data

- [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx) : ajouter `aria-pressed={selectedGammes.length === 0}` sur le composant pill-all.
- [src/app/components/shop/portal/PortalCart.tsx](src/app/components/shop/portal/PortalCart.tsx) : ajouter `aria-modal="true"` sur le Sheet via prop shadcn.
- Pas d'endpoint, pas de SQL, pas de featureFlag.
- Pas de nouveau testid.
- **Commit unique cumulable** : `feat(v5): a11y aria-pressed pill-all + aria-modal drawer`.

## Dépendances

- Aucun prérequis bloquant. À fenêtre résiduelle si capacité Sprint 4.

## Estimation

**XS (< 2 h)**. 2 modifs ponctuelles + scan axe + re-test 2 TF.

## Plan de test

- **TF existants à re-jouer** : [TF-57](https://www.notion.so/35dd0131973c81f98bdbdc46d848b70d) + [TF-63](https://www.notion.so/35dd0131973c81e78d5cdaff5bf4e993).
- **Smoke axe** : scan manuel via extension Chrome axe sur [localhost:5177/shop/xyfjjo-q6kekm](http://localhost:5177/shop/xyfjjo-q6kekm).
- **Test vitest** : assertion `aria-pressed` + `aria-modal` dans `ShopLayout.helpers.test.ts` ou test dédié.

## Définition de « terminé »

- Code mergé sur `beta/v5`.
- vitest 162/162 verts.
- Re-test TF-57 et TF-63 OK avec assertions aria validées.
- CR campagne suivante mentionnant la résolution.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_A11Y.shop-pills-and-drawer.md`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Rattachement à une fonctionnalité produit à arbitrer.
