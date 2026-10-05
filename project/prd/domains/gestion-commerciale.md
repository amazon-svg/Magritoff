---
id: DOMAIN-COMMERCIAL
title: Gestion commerciale
documentStatus: draft
owner: unassigned
source: docs/spec/backlog.md
supersedes: []
decisions:
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
