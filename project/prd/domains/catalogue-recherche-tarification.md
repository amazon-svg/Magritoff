---
id: DOMAIN-CATALOGUE-PRICING
title: Catalogue, recherche et tarification
documentStatus: draft
owner: unassigned
source: MEET-2026-10-01-ATELIER
supersedes: []
decisions:
  - PD-2026-10-01-B1
  - PD-2026-10-01-B4
---

# Catalogue, recherche et tarification

## Finalité

Transformer une demande utilisateur en produit identifiable et calculable, puis présenter un résultat commercial dont la provenance reste compréhensible.

## Principes consolidés

- une seule entrée combine recherche et prompt ;
- la carte produit indique l'origine de ses données ;
- le PIM fournit des suggestions rapides ;
- la base standard Clariprint apporte le produit métier de référence ;
- les demandes ouvertes peuvent engager une conversation avec un LLM ;
- le prix marché reste un concept produit, dont l'intégration d'interface doit être précisée.

## Questions ouvertes

- verrouillage ou modification libre des champs produit : `OQ-B2` ;
- comportement détaillé de routage entre PIM, Clariprint, RAG et LLM ;
- emplacement du prix marché dans l'interface ;
- articulation entre prix calculé, prix négocié et prix de repli.
