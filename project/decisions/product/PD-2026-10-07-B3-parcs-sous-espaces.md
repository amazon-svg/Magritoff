---
id: PD-2026-10-07-B3-PARC
title: Parcs machines créés dans le tenant, rattachés aux sous-espaces
date: 2026-10-07
documentStatus: approved
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/decisions/open-questions.md
  - project/backlog/stories/T01.1.md
  - project/backlog/stories/T01.2.md
  - project/backlog/stories/T01.3.md
  - project/backlog/stories/T01.4.md
  - project/backlog/stories/T01.5.md
  - project/backlog/stories/T01.6.md
  - project/backlog/stories/T02.1.md
  - project/backlog/stories/T02.2.md
  - project/backlog/stories/T02.3.md
  - project/backlog/stories/T02.4.md
  - project/backlog/stories/T02.5.md
  - project/backlog/stories/T02.6.md
  - project/backlog/stories/E9.3.md
  - project/backlog/stories/E9.10.md
  - project/backlog/stories/T06.1.md
  - project/backlog/stories/T06.3.md
---

# Parcs machines créés dans le tenant, rattachés aux sous-espaces

## Contexte

`OQ-B3-PARC` demandait comment un sous-espace est rattaché à un parc machines
et quels droits le groupe exerce sur ses filiales. Elle bloquait les stories
des epics T-01, T-02, E9 et T-06. Le modèle d'entités est posé par
`PD-2026-10-01-B3` (le sous-espace représente la filiale) et
`PD-2026-10-04-B3-FRANCHISE` (la tête de réseau est un tenant, chaque franchisé
un sous-espace).

Exemple pris en séance : un tenant de groupe dont les filiales sont des
sous-espaces ; la tête de groupe paie l'abonnement, les compétences de
fabrication sont dans les filiales.

## Décision

Arbitrage rendu par Arnaud Mazon et Xavier Péchoultres au WM du 7 octobre 2026.

1. **Un parc machines est créé au niveau du tenant.** L'administrateur du
   tenant l'associe à un ou plusieurs sous-espaces.
2. **Un sous-espace peut créer ses propres parcs et les administrer.**
3. **Le groupe dispose de tous les droits d'administration sur ses filiales**,
   parcs compris.
4. **Une filiale ne modifie que ses propres parcs.** Un parc rattaché à un
   sous-espace sans lui appartenir ne lui est pas ouvert en modification de ses
   paramètres.

## Conséquences

- `OQ-B3-PARC` est fermée sur le rattachement et les droits d'administration.
- La contradiction relevée dans `T02.4` est levée : l'administrateur du tenant
  conserve ses droits sur les sous-espaces, et l'isolation s'applique entre
  filiales.
- `PD-2026-10-01-B3` reste applicable entre unités distinctes (sous-traitance par
  jeton).

## Questions restantes

- **Administrer un parc et calculer sur un parc sont deux droits distincts**
  (Xavier Péchoultres). Sur quels parcs un sous-espace peut-il calculer, par
  exemple ceux d'une autre filiale du groupe ? Suivi sous
  `OQ-B3-PARC-CALCUL`.
- **Navigation de l'administrateur** : l'interface actuelle place l'utilisateur
  dans un sous-espace dès qu'il en existe un, sans retour à l'espace principal.
  Il reste à vérifier ce que permet l'interface. Suivi sous
  `OQ-B3-NAVIGATION`.
