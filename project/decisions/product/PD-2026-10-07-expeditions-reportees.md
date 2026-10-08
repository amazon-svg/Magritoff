---
id: PD-2026-10-07-EXPEDITIONS-REPORTEES
title: La gestion des expéditions est reportée aux futures fonctions MIS
date: 2026-10-07
documentStatus: approved
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E10.24.md
  - project/decisions/open-questions.md
---

# La gestion des expéditions est reportée aux futures fonctions MIS

## Contexte

`E10.24` prévoit d'enregistrer des expéditions et des numéros de suivi sur une
commande, et `OQ-EXPEDITIONS-PARTIELLES` demandait s'il fallait rattacher les
colis aux lignes et quantités expédiées. Xavier Péchoultres a rappelé que, en
imprimerie, une commande est souvent expédiée en plusieurs fois et que le client
doit savoir ce qui lui a été envoyé.

## Décision

Arbitrage rendu par Arnaud Mazon au WM du 7 octobre 2026, accepté par Xavier
Péchoultres.

- **Magrit s'arrête à la commande.** L'imprimeur reprend la commande dans son
  logiciel de gestion de production (MIS), qui gère les expéditions et émet les
  bons de transport.
- **La gestion des expéditions est placée dans le bac à sable** et rattachée aux
  fonctions MIS envisagées pour des versions ultérieures. Elle n'est pas
  requise à ce stade.

Motif : gérer dans Magrit la composition de chaque expédition ferait saisir
deux fois la même information, une fois dans Magrit, une fois dans le MIS au
moment du bon de transport.

## Conséquences

- `E10.24` n'est pas planifiée. Elle est conservée dans le backlog avec sa
  condition de reprise.
- `OQ-EXPEDITIONS-PARTIELLES` est différée avec elle.

## Condition de reprise

Lancement d'un chantier de fonctions MIS dans Magrit, ou besoin client établi
de suivi d'expédition que le MIS de l'imprimeur ne peut pas couvrir. La piste
évoquée en séance — se connecter au transporteur à partir du bon de transport
émis par le MIS — sera examinée à ce moment-là.
