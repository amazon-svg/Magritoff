---
id: EPIC-E10
title: Gestion commerciale
specStatus: draft
deliveryStatus: in-progress
lifecycleStatus: active
owner: unassigned
source:
  - docs/spec/backlog.md
  - SPRINT_HANDOFF.md
  - docs/api/CONVENTIONS.md
  - openapi/magrit-core.v1.yaml
features:
  - FEAT-E10-PROJECTS
  - FEAT-E10-CUSTOMERS
  - FEAT-E10-QUOTES
  - FEAT-E10-PRICING
  - FEAT-E10-ORDERS
  - FEAT-E10-EXPORTS
decisions:
  - PD-2026-10-01-B5
---

# Gestion commerciale

## Résultat attendu

Permettre à une équipe commerciale de gérer ses clients, projets, devis, règles de prix et commandes dans un ensemble cohérent, API-first et traçable.

## Périmètre

- clients et interlocuteurs ;
- projets commerciaux facultatifs ;
- création et édition de devis ;
- lignes de devis, marges et remises ;
- règles de prix et arbitrage ;
- conversion d'un devis en commande ;
- consultation et documents de commande ;
- exports comptables fondés sur les valeurs figées.

## Hors périmètre

- recalcul d'un prix lors d'un export ;
- comptabilité générale ;
- facturation réglementaire complète ;
- décomposition Clariprint par poste tant que E10.8 reste gelée.

## État de migration

L'export historique indique que plusieurs lots E10 sont livrés et que d'autres restent gelés, non spécifiés ou non commencés. Ces statuts sont des indices, pas une nouvelle preuve.

| Groupe | Identifiants historiques | État à la migration |
|---|---|---|
| Socle, projets et clients | E10.0 à E10.5 | annoncé livré ; preuve à relier |
| Prix et édition de devis | E10.6, E10.7, E10.9, E10.21 | annoncé livré ; dette et caractère provisoire à conserver |
| Commandes et documents | E10.12, E10.16, E10.19 | état mixte ; conversion à vérifier séparément |
| Décomposition du calcul | E10.8 | gelée |
| Remises et permission dédiée | E10.10, E10.11 | backlog historique à spécifier |
| Exports comptables | E10.18 | cadré historiquement ; état actuel à vérifier |

## Conditions de réussite

- chaque capacité active possède une story Git et une preuve ;
- les contrats API et les critères d'acceptation restent alignés ;
- les valeurs commerciales validées sont historisées ;
- les transitions et opérations sensibles sont auditables ;
- les anciennes stories contradictoires sont marquées ou remplacées explicitement.

## Questions ouvertes

- identification de la story portant le câblage réel du `PricingEngine` ;
- statut actuel des lots annoncés livrés après l'export du 4 septembre ;
- périmètre exact des remises au-delà de la ligne ;
- articulation avec les entités juridiques de facturation.
