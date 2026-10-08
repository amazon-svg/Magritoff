---
id: PD-2026-10-07-LIGNES-LIBRES
title: Création d'une ligne de devis par saisie assistée, ligne libre sans catégorie
date: 2026-10-07
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-07-WM
owners:
  - Arnaud Mazon
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E10.22.md
  - project/decisions/open-questions.md
---

# Création d'une ligne de devis par saisie assistée, ligne libre sans catégorie

## Contexte

`E10.22` constate qu'une ligne ajoutée manuellement à un devis ne reçoit ni règle
de catégorie, ni marge publique standard. La question
`OQ-LIGNE-LIBRE-CATEGORIE` demandait si la catégorie de produits devait être
obligatoire, facultative ou remplacée par un choix « hors catalogue », ce qu'il
advient d'une ligne sans marge, et si un changement de catégorie recalcule le
prix.

## Décision

Arbitrage rendu par Arnaud Mazon et Xavier Péchoultres au WM du 7 octobre 2026.

1. **Un seul geste de création : « ajouter une ligne ».** L'opérateur saisit le
   nom du produit ; une autocomplétion propose au fil de la frappe les produits
   du catalogue correspondants.
2. **Produit du catalogue retenu** : la ligne reprend le produit avec sa
   catégorie de produits, son prix et ses informations.
3. **Aucune correspondance retenue** : la ligne est un **article libre**. Aucune
   catégorie n'est imposée ; la saisie est entièrement libre.
4. **Marge d'un article libre** : la marge définie pour le client hors
   catégorie s'applique (règle client, à défaut règle globale, selon les
   priorités de `E10.7`). L'opérateur peut la modifier, y compris la porter à
   0 %.
5. **Pas de changement de catégorie sur une ligne existante.** Un produit
   arrive avec sa catégorie ; un article libre n'en a pas. La question du
   recalcul après changement de catégorie est sans objet.
6. Le prix d'un article libre est calculé une fois l'article paramétré.

Une imprimerie qui veut classer ses prestations (par exemple « prestation de
service ») peut créer un produit de catalogue correspondant ; il est alors
retrouvé par l'autocomplétion. Les deux approches coexistent.

## Conséquences

- `E10.22` est réécrite sur ce comportement.
- `OQ-LIGNE-LIBRE-CATEGORIE` est fermée.
- Le vocabulaire visible est celui de `PD-2026-10-07-PIM-CATEGORIE`.

## Vérifications attendues

- Une saisie qui correspond à un produit du catalogue crée une ligne portant la
  catégorie, le prix et l'identifiant du produit.
- Une saisie sans correspondance crée un article libre sans catégorie, chiffré
  avec la marge client hors catégorie ou, à défaut, la marge globale.
- La marge d'un article libre est modifiable et accepte 0 %.

## Questions restantes

- L'avertissement non bloquant prévu par `E10.22` `AC-04` lorsqu'aucune marge
  ne s'applique n'a pas été discuté en séance ; il reste à confirmer à
  l'approbation de la story.
