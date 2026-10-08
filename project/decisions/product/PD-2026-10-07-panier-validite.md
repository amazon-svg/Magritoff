---
id: PD-2026-10-07-PANIER-VALIDITE
title: Le panier boutique est garanti pendant la durée de validité des devis
date: 2026-10-07
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E_CART.persist-localstorage.md
  - project/decisions/open-questions.md
---

# Le panier boutique est garanti pendant la durée de validité des devis

## Contexte

Le prix d'un produit est dynamique. `OQ-RENOUVELLEMENT-PRIX` demandait si
« Commander à nouveau » rejoue le prix payé ou le prix du jour. En séance, la
question a été élargie au panier resté ouvert plusieurs semaines, pendant
lesquelles les tarifs peuvent augmenter.

## Décision

Arbitrage rendu par Arnaud Mazon et Xavier Péchoultres au WM du 7 octobre 2026.

- Placer un produit dans le panier engage l'imprimeur sur ce prix pour une
  durée limitée.
- **Le panier est persistant pendant le nombre de jours de validité des devis**
  paramétré par l'espace (30 jours dans l'exemple retenu).
- **Au terme de cette durée, le panier expire.**

## Conséquences

- `OQ-RENOUVELLEMENT-PRIX` est fermée. Le comportement en service — prix du jour
  recalculé avec avertissement au panier — n'est pas remis en cause.
- La persistance du panier (`E_CART.persist-localstorage`) doit porter la date
  de mise au panier et appliquer cette expiration.

## Questions restantes

- `OQ-Q24-RETROFIT-VALIDITE` : valeur appliquée aux espaces existants et cas d'un
  devis sans date de fin. Elle conditionne désormais aussi l'expiration du
  panier.
