---
id: ADR-2026-10-06-COMMANDES-LECTURE
title: Lecture commune des commandes — pagination, détail et export
date: 2026-10-06
documentStatus: approved
decisionStatus: adopted
source: user-request
owners: []
supersedes: []
affectedArtifacts:
  - openapi/magrit-core.v1.yaml
  - project/backlog/stories/E4.4b.md
  - src/modules/orders/
  - src/adapters/postgres/orders-repository.ts
  - infra/postgres/migrations/0087_unified_order_exports.sql
  - infra/postgres/migrations/0088_service_order_reads.sql
  - infra/postgres/migrations/0089_unified_order_quote_filter.sql
  - src/modules/order-exports/
---

# Lecture commune des commandes — pagination, détail et export

## Contexte

La décision produit PD-2026-10-05-COMMANDES-UNIQUE reconnaît un objet Commande
unique. Son stockage est déjà commun. Le dashboard charge encore deux API et
les clients des commandes devis séparément, limite les commandes boutique à
100 résultats et applique les filtres côté navigateur. Xavier demande le
6 octobre de poursuivre la liste unique, les filtres et la pagination.

## Choix adopté

`GET /api/v1/order-summaries` expose les deux origines via la façade commerciale,
avec son enveloppe et sa résolution tenant. Les utilisateurs Magrit y accèdent
selon leurs droits ; les clés de service doivent porter `orders:read` et leur
transaction PostgreSQL est explicitement marquée puis bornée au tenant.
Le chemin `/orders` appartient à la façade historique pour la création : le
routeur interdit volontairement de partager un chemin entre façades. Une
projection de lecture additive préserve ce contrat sans changer le routeur.
Les relations client, devis et boutique sont facultatives dans le DTO. Les noms sont
joints dans la requête PostgreSQL ; aucun appel client par commande n'est requis.

Les filtres précèdent la limite SQL. La pagination ordonne date décroissante puis
UUID décroissant ; elle lit une ligne supplémentaire pour décider de la suite.
La position de curseur conserve les microsecondes PostgreSQL, indépendamment de
la date sérialisée pour l'affichage. Les dates civiles inclusives sont converties
dans Europe/Paris par les fonctions partagées du noyau. La borne SQL supérieure
est le minuit suivant exclusif : aucune microseconde du dernier jour n'est omise.

Le dashboard présente des pages de 50 commandes. Il désactive le filtrage et le
tri locaux du tableau partagé ; le portail conserve son comportement actuel.
Une nouvelle sélection ou un changement de tenant remet la pagination à la
première page. Les réponses tardives sont ignorées.

Le détail utilise `GET /api/v1/order-summaries/{orderId}` : un en-tête commun
porte les références facultatives, dates, état, devise et montants, et un bloc
`detail` discriminé par `origin` conserve la projection complète du workflow.
Les lecteurs PostgreSQL historiques sont réutilisés dans la transaction portant
le tenant et l'utilisateur. Une commande absente de ce tenant rend un 404 unique.
La fiche canonique et ses rafraîchissements ne sondent plus deux API pour résoudre
l'origine ; les ressources annexes et les écritures gardent leurs contrats.

La sélection commune utilise `GET/POST /api/v1/order-exports` et
`GET /api/v1/order-exports/{exportId}`, avec le service et le worker existants.
La migration 0087 garde les anciennes demandes en version de mise en page 1 et
ajoute la version 2, couvrant les deux origines et tous les filtres de la grille.
Les fichiers CSV/XLSX ajoutent Origine puis Boutique en fin de fichier ; les
champs propres au devis restent vides lorsqu'ils sont absents. Les filtres
enregistrés sont ceux appliqués, indépendamment de la page ou du formulaire
en cours de saisie. L'ordre d'export est stable, par date puis UUID croissants.
La borne de période est identique à celle de la grille.

Les trois routes gardent `can_export_orders`, l'idempotence et le plafond de
trois demandes en attente par utilisateur. Le registre reste commun au tenant,
le téléchargement signé réservé au demandeur ; la limite de génération
existante de 2 500 lignes est conservée. Les clés de service restent exclues.

Les anciennes opérations de liste, détail et export sont marquées dépréciées
dans OpenAPI. Leurs réponses réussies publient `Deprecation` au 6 octobre 2026
et un lien `successor-version` vers la ressource commune. Aucun en-tête
`Sunset` n'est envoyé avant inventaire et migration des consommateurs. Les
sous-ressources sans remplaçant commun ne sont pas concernées. La politique et
les conditions de retrait sont détaillées dans
`docs/api/COMMANDES_COMPATIBILITE.md`.

## Conséquences

Aucun stockage ni montant engagé n'est modifié. Les routes de compatibilité et
exports existants restent disponibles. Le prix TTC des devis provient de sa
copie figée ; celui des commandes boutique suit la projection existante liée
au régime TVA du tenant. Cette lecture n'ajoute aucun droit de mutation.

Les clés de service disposent de la lecture commune avec `orders:read`, sans
accès aux exports. La fenêtre de retrait des anciennes routes reste une décision
opérationnelle distincte : aucune échéance n'est publiée sans inventaire des
consommateurs. E4.4b est vérifiée avec cette politique de compatibilité active.

## Vérifications attendues

Tests de contrat et de transport, pagination PostgreSQL à dates égales et à
microsecondes distinctes, conservation des montants devis, relations facultatives,
filtres avant limite et isolation tenant. La reprise réelle est testée en
créant un agrégat historique avant `0086`, puis en vérifiant ses données et
dépendances après migration. Recette Chromium effectuée pour liste et détail.
Les quatre combinaisons CSV/XLSX et commande/ligne sont vérifiées avec le
worker et le stockage réels en tests isolés. La recette Chromium télécharge
un CSV et vérifie que les filtres non appliqués ne changent pas la sélection.
