---
id: PD-2026-10-07-PIM-CATEGORIE
title: « Catégorie de produits » remplace « gamme » pour le classement du référentiel
date: 2026-10-07
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/decisions/open-questions.md
  - project/backlog/stories/E1.WM1.md
  - project/backlog/stories/E10.21.md
  - project/backlog/stories/E10.6.md
  - project/backlog/stories/E10.7.md
  - project/backlog/stories/E10.8.md
  - project/backlog/stories/E10.9.md
  - project/backlog/stories/E2.fix-TF55.md
  - project/backlog/stories/E8.1.md
  - project/backlog/stories/E9.13.md
  - project/backlog/stories/E9.6.md
  - project/backlog/stories/E_A11Y.shop-pills-and-drawer.md
  - project/backlog/stories/E_CART.persist-localstorage.md
  - project/backlog/stories/T02.2.md
  - project/backlog/stories/T02.3.md
  - project/prd/product-scope.md
---

# « Catégorie de produits » remplace « gamme » pour le classement du référentiel

## Contexte

Le référentiel produit (PIM) classe les produits en « gammes ». En imprimerie,
« gamme » désigne systématiquement la gamme de fabrication. Xavier Péchoultres
signale une confusion permanente, y compris à prévoir chez les clients
(`OQ-PIM-TERMINOLOGIE`).

## Décision

Arbitrage rendu par Arnaud Mazon et Xavier Péchoultres au WM du 7 octobre 2026.

- **Le classement des produits s'appelle « catégorie de produits ».**
- **L'expression « gamme de produits » est bannie.**
- **« Gamme » est réservé à la gamme de fabrication** : opérations et moyens de
  réalisation d'un produit.

## Conséquences

- `OQ-PIM-TERMINOLOGIE` est fermée.
- Les stories et le PRD emploient « catégorie » pour le classement des produits.
  Les comptes rendus et rapports déposés restent inchangés.
- Le renommage visible des écrans est à faire dans le code.
- Les identifiants techniques historiques (`product_gammes`, `productRangeId`,
  `TenantGammesPage` et routes associées) ne sont pas renommés par cette
  décision ; leur inventaire et un éventuel renommage relèvent d'une story
  technique séparée. Les citations de code dans les stories gardent le nom
  technique.
