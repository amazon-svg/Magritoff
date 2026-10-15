---
id: DOMAIN-COMMERCIAL
title: Gestion commerciale
documentStatus: draft
owner: unassigned
source: docs/spec/backlog.md
supersedes: []
decisions:
  - PD-2026-10-14-LOTS-LIVRAISON
  - PD-2026-10-01-B5
---

# Gestion commerciale

## Finalité

Porter la chaîne client, projet, devis et commande dans un modèle cohérent, traçable et utilisable par l'API comme par les interfaces.

## Concepts

- client et interlocuteur ;
- projet commercial facultatif ;
- devis et lignes de devis ;
- prix, marge, remise et règles applicables ;
- commande issue d'un devis ;
- documents et exports fondés sur des données figées.

## Principes

- un devis peut être créé directement, sans projet préalable ;
- un projet reste disponible comme conteneur de travail ;
- les lignes commerciales conservent les valeurs utilisées au moment de leur validation ;
- un export lit les données figées et ne recalcule pas les prix ;
- les transitions importantes sont auditables.

## Epic actif

`EPIC-E10` consolide le chantier Gestion commerciale. Ses éléments livrés et encore ouverts doivent être rapprochés du code et des tests lors de la migration des stories.


## Orientations du WM du 14 octobre — à approuver

Voir [PD-2026-10-14-LOTS-LIVRAISON](../../decisions/product/PD-2026-10-14-lots-livraison.md) : conserver l’unité économique d’un calcul Studio dans un groupe indivisible, une ligne par point de livraison ; qualifier la fiscalité par lot (E10.23/E10.25). Prévoir le devis HT sans livraison connue, puis sa révision liée et les destinations au plus tard à la commande (E10.26). Les règles fiscales détaillées et le verrou éventuel d’un pays unique restent ouverts. L’émission de facture et le suivi de transport ne sont pas ajoutés à ce lot.
