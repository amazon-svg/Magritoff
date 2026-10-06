---
id: PD-2026-10-06-COMMANDES-STATUT-UNIQUE
title: "Commande : un seul statut visible, cycle administratif interne"
date: 2026-10-06
documentStatus: approved
decisionStatus: adopted
source: user-request
owners:
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/backlog/stories/E4.4.md
  - project/backlog/stories/E4.4a.md
  - project/backlog/stories/E4.4b.md
  - project/backlog/stories/E4.4c.md
  - project/backlog/stories/E10.13.md
  - project/backlog/stories/E10.14.md
  - project/backlog/stories/E10.16.md
---

# Commande : un seul statut visible, cycle administratif interne

## Contexte

La grille commune expose actuellement un statut de commande et une étape de
production comme deux dimensions parallèles. Cette présentation ne correspond
pas à l'arbitrage du RP du 28 août 2026 : les étapes personnalisables y sont
appelées « statuts » dans l'interface et se changent dans une modale unique qui
porte aussi leur historique.

Le stockage conserve toutefois un état de cycle de vie nécessaire aux règles
administratives, notamment pour distinguer une commande non engagée, validée,
annulée ou clôturée. Cette donnée ne doit pas imposer un second workflow visible
à l'utilisateur.

## Décision

- L'utilisateur voit un seul **Statut** sur la liste et la fiche commande.
- Pour une commande active et validée, ce statut visible est son étape de
  production courante.
- Les états administratifs exceptionnels remplacent l'étape dans l'affichage :
  `draft` devient « Brouillon », `cancelled` devient « Annulée » et `closed`
  devient « Clôturée ». Une commande validée sans étape affiche « Validée ».
- Le cycle administratif cible est limité à `draft`, `validated`, `cancelled`
  et `closed`. Le terme `closed`/« Clôturée » est retenu afin de ne pas confondre
  la clôture administrative avec une étape opérationnelle terminée ou livrée.
- Les anciennes valeurs techniques (`in_production`, `shipped`, `delivered`,
  `invoiced`) restent compatibles jusqu'à une migration de données prouvant
  qu'aucune information n'est perdue. Elles ne constituent pas une seconde
  liste de statuts dans l'interface cible.
- Le bouton « Statut » ouvre la même modale depuis la liste et la fiche. Cette
  modale permet le changement d'étape et montre l'historique horodaté.
- Le traitement en lot se fait depuis la liste commune par sélection explicite
  de commandes. Il applique une étape de production commune et rend le résultat
  de chaque commande ; un refus n'est jamais masqué.
- L'éligibilité à la facturation est une capacité calculée côté serveur. Elle
  peut s'appuyer sur l'état administratif, mais elle ne doit pas être déduite
  uniquement dans le navigateur ni confondue avec l'état d'une facture.

## Conséquences

La page « Commandes » reste l'unique écran de pilotage. Aucun écran spécifique
de validation ou de production n'est ajouté. La colonne, le filtre et l'action
emploient tous le mot « Statut » et résolvent la valeur visible selon la règle
ci-dessus.

La simplification physique de la colonne `status` sera préparée séparément :
elle doit préserver les commandes historiques et reporter leur avancement dans
les étapes de production avant de retirer les anciennes valeurs.

