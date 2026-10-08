---
id: PD-2026-10-07-PRIX-NON-VERIFIE
title: La notion de prix non vérifié disparaît avec le prix calculé par Clariprint
date: 2026-10-07
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/backlog/stories/Q17-a.md
  - project/backlog/stories/Q17-c.md
  - project/decisions/open-questions.md
---

# La notion de prix non vérifié disparaît avec le prix calculé par Clariprint

## Contexte

`Q17-a` marque une commande boutique dont un prix n'a pas pu être vérifié, et
`Q17-c` permet d'acquitter ce marquage. `OQ-Q19-ACQUITTER` demandait si
l'acquittement devait être réservé à une population plus étroite que la
validation.

## Décision

Constat partagé par Arnaud Mazon et Xavier Péchoultres au WM du 7 octobre 2026.

- Selon la lecture partagée en séance, la notion de prix non vérifié hérite
  d'un fonctionnement où le prix affiché ne résultait pas d'un calcul.
- **Dès que la boutique sera connectée au calcul Clariprint, chaque prix
  affiché sera un prix calculé, donc valide** : la distinction entre prix
  vérifié et non vérifié n'aura plus d'objet.

## Conséquences

- `OQ-Q19-ACQUITTER` est sans objet et fermée.
- Le marquage et l'acquittement livrés par `Q17-a` et `Q17-c` restent en service
  tant que la boutique n'est pas connectée à Clariprint. Leur retrait est à
  planifier avec cette connexion.
- Le prix marché conservé par `PD-2026-10-01-B4` n'est pas concerné.
