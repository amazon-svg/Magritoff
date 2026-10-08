---
id: PD-2026-10-08-HOPESTUDIO-RECALCUL
title: Modification du produit et recalcul automatique par HopeStudio
date: 2026-10-08
documentStatus: approved
decisionStatus: adopted
source: Précision de Xavier Péchoultres dans le chat du dépôt le 08/10/2026
owners:
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/decisions/open-questions.md
  - project/prd/domains/catalogue-recherche-tarification.md
  - project/backlog/stories/E8.1.md
  - project/backlog/stories/E8.2.md
---

# Modification du produit et recalcul automatique par HopeStudio

## Contexte

`OQ-B2` demandait si les champs d'un produit administré étaient verrouillés
ou si leur modification devait déclencher un recalcul.

## Décision

Xavier Péchoultres précise le 8 octobre 2026 que HopeStudio gère ce comportement :
la modification du produit entraîne automatiquement un recalcul.

Rédaction approuvée par Xavier Péchoultres le 8 octobre 2026.

## Conséquences

- `OQ-B2` est tranchée sur la responsabilité et le comportement attendu.
- Les stories catalogue et le domaine de tarification reprennent cette règle.
- Cette précision du comportement ne constitue pas une preuve de livraison
  de l'intégration Magrit ; les statuts de livraison ne sont pas modifiés.
