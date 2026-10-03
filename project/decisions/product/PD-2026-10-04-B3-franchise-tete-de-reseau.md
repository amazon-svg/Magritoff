---
id: PD-2026-10-04-B3-FRANCHISE
title: Modèle d'entités d'un réseau de franchise
date: 2026-10-04
documentStatus: draft
decisionStatus: adopted
source: Arbitrage Arnaud Mazon, 4 octobre 2026
owners: []
supersedes: []
affectedArtifacts:
  - project/backlog/epics/EPIC-T02.md
  - project/backlog/epics/EPIC-T01.md
  - project/decisions/open-questions.md
---

# Modèle d'entités d'un réseau de franchise

## Contexte

La décision `PD-2026-10-01-B3` a posé le vocabulaire : le **tenant** est l'unité de facturation et de fonctionnement, une entité juridique distincte ; le **sous-espace** représente la filiale d'un groupe au sein d'un même tenant ; la **sous-traitance** relie deux unités, avec ou sans lien capitalistique.

La passe de qualité du backlog du 3 octobre 2026 a relevé que l'epic `T-02 — Franchise Module` n'était pas planifiable sans trancher où se range un site de franchise. Les six stories de l'epic décrivent une hiérarchie « réseau → site → utilisateur » sans dire à quel objet du modèle chaque niveau correspond, et `T-01 — Corporate Portal` pose le même problème avec « espace corporate → département ».

Les deux lectures possibles avaient chacune une conséquence lourde : si un site est un tenant, la consolidation du réseau traverse des frontières de facturation ; si c'est un sous-espace, le réseau devient un tenant unique.

## Décision

**La tête de réseau est un tenant. Chaque franchisé est un sous-espace de ce tenant.**

## Conséquences

1. **Le réseau est l'unité de facturation.** Magrit facture la tête de réseau, pas chaque franchisé. Le modèle de monétisation du service devra dire si et comment le nombre de sous-espaces entre dans l'assiette.
2. **La consolidation ne traverse aucune frontière de facturation.** Le tableau de bord consolidé de `T02.1` et les rapports de `T02.6` agrègent des sous-espaces d'un même tenant : ils restent dans le périmètre d'isolation existant, sans mécanisme inter-tenants à construire.
3. **L'héritage du catalogue et des règles de prix (`T02.2`) est une propriété de la hiérarchie**, pas une relation à négocier entre deux entités. Le corridor de dérogation s'exprime donc du tenant vers ses sous-espaces.
4. **L'onboarding d'un site (`T02.3`) crée un sous-espace**, pas un tenant. Le mécanisme existant de création de sous-espace est le point de départ.
5. **Le routage inter-sites (`T02.5`) reste un cas de sous-traitance** au sens de `PD-2026-10-01-B3` : deux unités fonctionnelles, chacune maîtresse de ses données de parc, qui s'autorisent mutuellement par jeton. La décision présente ne le change pas.
6. **`T-01 — Corporate Portal` suit le même modèle** : l'espace corporate est un tenant, le département est un sous-espace.

## Ce que cette décision ne tranche pas

- **`OQ-B3-PARC`** reste ouverte : comment un sous-espace est rattaché à un parc machines, et quels droits le groupe exerce sur ses filiales. Elle continue de bloquer `T01.1`, `T01.2`, `T01.6`, `T02.1`, `T02.3`, `T02.4`, `T02.5`, `T02.6`, ainsi que `E9.3`, `E9.4`, `E9.6`, `E9.8`, `E9.10`, `T06.1` et `T06.3`.
- La **contradiction relevée dans `T02.4`** entre l'isolation opérationnelle attendue et l'accès en lecture-écriture que l'administrateur du parent conserve aujourd'hui sur ses sous-espaces. Elle relève de `OQ-B3-PARC`.
- Le cas d'un réseau dont les franchisés exigent une facturation séparée. Il sortirait du modèle retenu et appellerait un nouvel arbitrage.

## Propagation

Les stories concernées portent un renvoi vers cette décision. Leur réécriture au regard du modèle retenu n'est pas faite ici : elle appartient à la gestion du backlog.
