---
id: PD-2026-10-01-B1
title: Recherche unifiée
date: 2026-10-01
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-01-ATELIER
owners: []
supersedes: []
affectedArtifacts:
  - project/backlog/
---

# Recherche unifiée

## Décision

Magrit présente une seule barre combinant recherche et prompt. L'origine des données devient une métadonnée de la carte produit.

La première mise en œuvre doit :

- chercher rapidement des suggestions par recherche vectorielle dans le PIM et les afficher dans l'interface de discussion ;
- chercher en parallèle le produit métier le plus proche dans la base standard Clariprint ;
- orienter les requêtes commerciales ouvertes vers un LLM généraliste pour ouvrir une discussion.

## Limites et suites

Les comportements précis entre requête, PIM, LLM, RAG et Clariprint restent à éprouver. La création ou la révision des stories attend la migration du backlog afin d'identifier les artefacts antérieurs concernés.

## Vérification

Les critères d'acceptation et tests seront définis dans les stories propagées. Cette décision ne prouve pas que le comportement est livré.
