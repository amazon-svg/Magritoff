---
id: PD-2026-10-05-COMMANDES-UNIQUE
title: "Commande : un objet métier et un parcours back-office uniques"
date: 2026-10-05
documentStatus: approved
decisionStatus: adopted
source: user-request
owners:
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - docs/api/CONVENTIONS.md
  - project/backlog/stories/E4.2.md
  - project/backlog/stories/E4.4.md
  - project/backlog/stories/E4.4a.md
  - project/backlog/stories/E4.4b.md
  - project/backlog/stories/E10.12.md
  - project/backlog/stories/E10.16.md
  - project/backlog/stories/E10.18.md
---

# Commande : un objet métier et un parcours back-office uniques

## Contexte

Le WM du 1er septembre 2026 a séparé deux **workflows de création** : validation d'un panier boutique et conversion d'un devis. Les stories E4.2 et E10.12 précisent déjà que ces workflows convergent sur le même objet Commande. L'implémentation a pourtant introduit deux stockages, deux API, deux listes, deux adresses de fiche et deux entrées de menu, « Commandes » et « Commandes atelier ». Pendant la recette d'Atelier Lumière du 5 octobre, cette traduction technique a été interprétée à tort comme deux objets métier.

Xavier Péchoultres confirme que cette séparation visible n'est pas acceptable : l'origine d'une commande ne change pas sa nature.

## Décision

- Il existe un seul objet métier **Commande** dans Magrit.
- Une commande porte une origine (`boutique` ou `devis`) et les références propres à cette origine. L'origine est une donnée, pas une frontière de navigation.
- Les workflows de création restent distincts. Les règles de validation d'un panier et de conversion d'un devis ne sont pas fusionnées.
- Le back-office expose une seule entrée « Commandes », une seule liste et une fiche canonique sous `/t/:tenantSlug/dashboard/orders/:orderId`.
- La fiche rend les informations communes puis les informations et actions disponibles pour l'origine concernée. Une absence normale, par exemple l'absence de devis pour une commande boutique, est affichée comme telle.
- Les montants déjà engagés restent figés. Cette décision n'autorise aucune réécriture de prix.

## Conséquences techniques

Les tables historiques `tenant_orders` et `commercial_orders` et leurs contrats d'écriture ne peuvent pas être fusionnés sans migration : la seconde impose actuellement un client CRM, un devis source et une décomposition tarifaire que la première ne possède pas toujours. Le correctif met donc en place un modèle de lecture back-office commun et conserve temporairement les deux adaptateurs de persistance.

Cette étape transitoire est une dette de migration explicite. Le vocabulaire du code peut conserver `commercial-orders` pour les opérations issues d'un devis, mais l'interface ne doit plus le présenter comme un second type de commande. Les anciennes adresses `commercial-orders` restent des alias de compatibilité et ne constituent plus les adresses de référence.

## Vérifications attendues

- Une commande créée dans Atelier Lumière et une commande issue d'un devis apparaissent dans la même page `/dashboard/orders`.
- Chacune s'ouvre sous `/dashboard/orders/:orderId` depuis cette liste.
- L'ancienne adresse d'une fiche commerciale ouvre la même fiche et l'ancienne liste redirige vers la liste unique.
- La sidebar ne présente qu'une entrée « Commandes ».
- Les contrôles de droits et les transitions propres à chaque workflow restent appliqués côté serveur.

## Suite technique

[E4.4b](../../backlog/stories/E4.4b.md) prépare la convergence physique du stockage et du contrat d'API. Elle traite les commandes boutique sans client CRM lié, les commandes sans devis, la numérotation, les lignes tarifaires de formes différentes, les historiques et les documents, avec une migration de données contrôlée. Ce chantier ne bloque pas la lecture back-office unifiée.
