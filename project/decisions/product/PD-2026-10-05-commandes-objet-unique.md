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

La migration `0086_orders_unification.sql` conserve `tenant_orders` et `tenant_order_items` comme tables canoniques. Elle y ajoute une origine (`storefront` ou `quote`) et les extensions facultatives propres aux devis, reprend les données sans recalculer les montants, repointe les documents, fichiers, étapes, notifications et exports, puis supprime `commercial_orders` et `commercial_order_lines`.

Le vocabulaire et les routes `commercial-orders` peuvent subsister comme projections de compatibilité du workflow devis. Ils n'ont plus de stockage propre et l'interface ne doit pas les présenter comme un second type de commande. La prochaine étape d'E4.4b consiste à remplacer ces deux projections API par un contrat de lecture commun paginé.

## Vérifications attendues

- Une commande créée dans Atelier Lumière et une commande issue d'un devis apparaissent dans la même page `/dashboard/orders`.
- Chacune s'ouvre sous `/dashboard/orders/:orderId` depuis cette liste.
- L'ancienne adresse d'une fiche commerciale ouvre la même fiche et l'ancienne liste redirige vers la liste unique.
- La sidebar ne présente qu'une entrée « Commandes ».
- Les contrôles de droits et les transitions propres à chaque workflow restent appliqués côté serveur.

## Suite technique

[E4.4b](../../backlog/stories/E4.4b.md) suit la convergence. Le stockage et la reprise des dépendances sont réalisés ; le contrat API commun, la pagination globale, les filtres et l'export commun restent à livrer.
