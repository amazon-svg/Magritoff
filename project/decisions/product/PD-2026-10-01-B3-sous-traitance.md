---
id: PD-2026-10-01-B3
title: Modèle de sous-traitance
date: 2026-10-01
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-01-ATELIER
owners: []
supersedes: []
affectedArtifacts:
  - project/backlog/
---

# Modèle de sous-traitance

## Décision

Le sous-espace représente la filiale d'un groupe au sein d'un tenant. Le tenant est l'unité de facturation et de fonctionnement. La sous-traitance relie deux unités, qu'elles appartiennent ou non au même groupe.

Les données d'un parc machines restent chez l'entité exploitante et seuls ses utilisateurs peuvent les modifier. Un tiers n'y accède pour calcul que sur autorisation par jeton.

Le modèle fonctionnel comprend :

- une clé masquée ;
- les parcs autorisés ;
- les règles de prix applicables ;
- une date de révocation ;
- l'option de papier fourni par le sous-traitant ;
- une invitation par courriel avec acceptation par le propriétaire du parc ;
- un écran de gestion des accès externes et jetons ;
- les rubriques « Mon parc » et « Mes sous-traitants ».

## Question non couverte

Le rattachement d'un sous-espace à un parc machines et les droits hiérarchiques du groupe restent ouverts sous l'identifiant OQ-B3-PARC.
