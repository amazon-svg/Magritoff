---
id: PD-2026-10-08-PARCS-ABONNEMENTS
title: Fournisseurs de prix et accès API de calcul par clé
date: 2026-10-08
documentStatus: approved
decisionStatus: adopted
source: Précision de Xavier Péchoultres dans le chat du dépôt le 08/10/2026
owners:
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/decisions/open-questions.md
  - project/backlog/stories/E1.1.md
  - project/backlog/stories/E10.4.md
  - project/backlog/stories/E9.10.md
  - project/backlog/stories/E9.3.md
  - project/backlog/stories/T01.1.md
  - project/backlog/stories/T01.2.md
  - project/backlog/stories/T01.3.md
  - project/backlog/stories/T01.4.md
  - project/backlog/stories/T01.5.md
  - project/backlog/stories/T01.6.md
  - project/backlog/stories/T02.1.md
  - project/backlog/stories/T02.2.md
  - project/backlog/stories/T02.3.md
  - project/backlog/stories/T02.4.md
  - project/backlog/stories/T02.5.md
  - project/backlog/stories/T02.6.md
  - project/backlog/stories/T06.1.md
  - project/backlog/stories/T06.3.md
---

# Fournisseurs de prix et accès API de calcul par clé

## Contexte

Cette décision complète `PD-2026-10-07-B3-PARC`, approuvée sur la création,
le rattachement et l'administration des parcs. L'identifiant
`PD-2026-10-08-PARCS-ABONNEMENTS` reste stable pour les références existantes.

Dans l'échange du 8 octobre 2026, Xavier précise d'abord les abonnements aux
parcs, puis propose de porter la relation au niveau d'un **fournisseur de prix**
et d'un accès API activable pour un **client Magrit**. La présente rédaction
reprend cette dernière orientation ; la notion exacte de client et les points
listés ci-dessous restent à préciser avec lui.

## Principes précisés le 8 octobre 2026

1. **Accès entre tenants** : les invitations et accès de calcul entre tenants
   différents sont indispensables. Ils couvrent aussi les relations entre
   sous-espaces.
2. **Calcul uniquement** : la clé permet de demander un calcul ; elle ne donne
   aucun accès à la consultation des paramètres des parcs ou des machines,
   ni à leur administration.
3. **Plusieurs parcs par espace** : une machine peut figurer dans plusieurs
   parcs d'un même espace sans devoir être dupliquée. Les droits
   d'administration restent ceux de `PD-2026-10-07-B3-PARC`.

## Orientation complémentaire — fournisseur de prix et API

Xavier propose de sortir la relation commerciale de la notion de parc :

1. **Côté fournisseur** : prévoir au niveau d'un client Magrit l'activation
   d'une API de calcul avec une clé et le choix d'un ou plusieurs parcs.
   Le périmètre sélectionnable inclut les parcs propres et ceux accessibles
   via des abonnements externes. Les conditions du relais de ces accès
   externes restent à préciser.
2. **Invitation** : le lien d'invitation sert à transmettre l'accès de calcul
   et sa clé. Il peut porter sur plusieurs parcs sélectionnés chez le
   fournisseur ; le destinataire configure un accès à ce fournisseur.
3. **Côté demandeur** : dans la configuration Clariprint de l'espace, permettre
   l'ajout des clés de calcul de fournisseurs de prix externes.
4. **Fournisseur local par défaut** : chaque espace dispose par défaut d'un
   fournisseur de prix local, auquel peuvent s'ajouter les fournisseurs externes.
5. **Demandes de calcul** : une demande est envoyée à chaque fournisseur de
   prix configuré, local compris. Le résultat doit rester identifiable par
   fournisseur ; la présentation ou la sélection finale reste à décider.
6. **Gestion des relations** : reprendre les deux vues demandées, désormais
   au niveau des accès de calcul : clients autorisés à calculer chez le
   fournisseur, et fournisseurs externes configurés dans l'espace demandeur.
   Les parcs constituent le périmètre de chaque accès.

## Points à préciser avec Xavier

- « Client Magrit » désigne-t-il la fiche client commerciale du fournisseur
  ou le tenant/espace demandeur ? Le rattachement de la clé dépend de ce choix.
- Le relais d'un fournisseur externe exige-t-il une autorisation explicite
  de redistribution, ou est-il inclus dans son abonnement ?
- Comment présenter ou sélectionner les résultats de plusieurs fournisseurs ?
- Qui émet et accepte l'invitation, et qui peut révoquer l'accès ? L'ancien
  modèle `PD-2026-10-01-B3` prévoyait une acceptation par le propriétaire du
  parc ; le sens du nouveau parcours doit être explicité.
- Protocole de clé : portée, destinataire, validité du lien, réutilisation,
  révocation et comportement quand un parc sélectionné est retiré.
- Orchestration : indisponibilité d'un fournisseur, résultats partiels,
  délais d'attente et prévention des boucles lorsque des fournisseurs
  relaient eux-mêmes d'autres fournisseurs.
- Règles de prix attachées au client et contenu retourné par l'API, sans
  divulgation des paramètres de production.

## Conséquences

`OQ-B3-PARC-CALCUL` reste partiellement tranchée. L'accès entre tenants et
l'absence de consultation des paramètres sont confirmés. L'orientation API
et fournisseurs de prix est consignée avec ses questions de cadrage.

La configuration du calcul, la gestion des clients et les stories de portails
référencent ce complément. Les critères et le contrat API devront intégrer
les précisions restantes avant développement. La rédaction est approuvée
par Xavier Péchoultres le 8 octobre 2026 ; les questions explicitement ouvertes
restent à trancher. Le statut de la décision du 7 octobre reste inchangé.
