---
id: PRD-PRINCIPLES
title: Principes produit Magrit
documentStatus: draft
owner: unassigned
source: _bmad-output/planning-artifacts/prd.md
sourceDate: 2026-05-09
consolidatedAt: 2026-10-02
supersedes: []
---

# Principes produit Magrit

## Simplicité métier

L'utilisateur exprime un besoin avec son vocabulaire. Magrit structure la demande, limite la ressaisie et ne lui impose pas la complexité interne de Clariprint.

## Calcul explicable

L'origine d'un produit, d'un prix ou d'un calcul reste identifiable. Une valeur calculée, une valeur de catalogue et une suggestion générée ne sont pas présentées comme équivalentes.

## Une recherche, plusieurs sources

La recherche et le prompt partagent un point d'entrée. Le système peut interroger le PIM, la base métier Clariprint ou un LLM, tout en conservant la provenance du résultat.

## Configuration plutôt que duplication

Les boutiques, produits et parcours partagent un socle commun. Les différences entre offres sont portées par des capacités et règles explicites, pas par des variantes de code sans traçabilité.

## Maîtrise des données

Chaque entité maîtrise ses clients, prix, parcs machines et accès. Le partage entre espaces ou entreprises nécessite une autorisation explicite, limitée et révocable.

## Continuité commerciale

Les objets métier structurants — client, projet, devis, commande — conservent leurs références et leurs données historiques. Une modification de configuration ne réécrit pas silencieusement les documents déjà émis.

## IA assistante, pas autorité

Un agent ou un LLM peut rechercher, structurer, rédiger et proposer. Il ne valide pas seul une règle produit, un prix, une décision ou une conformité.

## Preuve avant statut

Une fonctionnalité n'est pas considérée comme vérifiée parce qu'un document l'annonce. Le statut de livraison dépend du code, des tests exécutés et des preuves référencées.
