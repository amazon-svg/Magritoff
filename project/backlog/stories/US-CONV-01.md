---
id: US-CONV-01
title: Agent conversationnel dédié
epic: EPIC-E2
feature: FEAT-E2-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c8180884be584a754888c
  url: https://app.notion.com/375d0131973c8180884be584a754888c
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P0"
  originalEffort: ""
  originalAssignee: "Laurent"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-CONV-01.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-CONV-01.md
---

# US-CONV-01 — Agent conversationnel dédié

> Sépare la conduite du dialogue avec le client du traitement métier, pour que l'un puisse évoluer sans casser l'autre.

## Valeur métier

Tant que la compréhension du client et le calcul métier sont mêlés, chaque ajustement de ton ou de dialogue risque de déplacer un prix, et chaque évolution de la règle de chiffrage oblige à retoucher la conversation. Les séparer permet de faire progresser le dialogue vite et souvent, sans remettre en jeu la justesse des devis — là où une erreur se paie chez le client. C'est aussi ce qui rend le calcul métier testable indépendamment du modèle de langage.

## Besoin utilisateur

La source ne formule pas de besoin en « en tant que … je veux … afin de … ». Elle décrit une exigence d'architecture produit :

> Un agent conversationnel dédié gère les échanges avec le client (compréhension, dialogue), distinct du traitement métier.

*Source : WM#030626 — réf. 00:38:02.*

## Comportement attendu

La source tient en une phrase et un critère. Ce qui en découle sans extrapolation :

1. Un agent dédié conduit l'échange avec le client : comprendre la demande, dialoguer, reformuler.
2. Cet agent ne réalise pas lui-même le traitement métier ; il le sollicite et en restitue le résultat.

**La source ne décrit ni le parcours utilisateur, ni les écrans, ni le découpage des responsabilités entre l'agent et le traitement métier.** Rien de plus n'a été déduit.

## Expérience utilisateur

**Rien ne peut être établi sans arbitrage.** La source est une exigence d'architecture issue d'une réunion de travail ; elle ne décrit aucune expérience visible. Du point de vue de l'utilisateur, cette séparation doit en principe être invisible, mais la story ne dit pas ce qui change à l'écran — notamment ce qui se passe lorsque l'agent répond mais que le traitement métier échoue, ou l'inverse. À arbitrer avant implémentation.

## Règles métier

- `RM-01` — L'agent conversationnel conduit l'échange avec le client ; il ne réalise pas le calcul métier.

C'est la seule règle que porte la source. Aucune autre n'a été ajoutée.

## Critères d'acceptation

**Aucun critère observable ne figure dans la source Notion au 2026-10-03.** Elle n'en porte qu'un, énoncé comme une propriété d'architecture et non comme une observation :

- `AC-01` — (repris de la source, non observable en l'état) L'agent conduit la conversation sans traiter lui-même le calcul métier.

Rendre ce critère vérifiable suppose de trancher ce qu'on observe : la provenance de la valeur affichée, la possibilité de rejouer le calcul sans l'agent, ou l'absence de règle de prix dans l'agent. Ces trois lectures ne mènent pas au même travail. L'arbitrage est demandé en questions ouvertes ; rien n'a été déduit du code.

## Cas limites

La source est muette sur l'ensemble des cas limites. Les situations qui devront être tranchées, à titre de liste de travail et non d'exigences :

- échec du traitement métier alors que l'agent a déjà commencé à répondre ;
- indisponibilité de l'agent conversationnel alors que le traitement métier, lui, est disponible ;
- demande ne nécessitant aucun traitement métier (question générale, pédagogie produit) ;
- demande nécessitant plusieurs traitements métier pour une seule réponse.

## Hors périmètre

- Le comportement conversationnel visible : modes d'interprétation (`E2.1`, `E2.2`), clarification (`E2.3`), plafond de contexte (`E2.4`).
- Le contenu du traitement métier lui-même et les règles de prix.
- Le choix du fournisseur de modèle de langage.

## Dépendances et décisions

- La séparation visée existe déjà partiellement : l'interface de conversation passe par un port `AssistantGateway` (`src/modules/diagnostics/application/assistant-gateway.ts`, mise en œuvre navigateur `src/adapters/http/browser-assistant-gateway.ts`). L'ampleur de ce qui reste à faire dépend de l'interprétation retenue pour `AC-01`.
- Le contrat `openapi/magrit-core.v1.yaml` ne décrit aujourd'hui, pour l'assistant, que la liste, l'enregistrement et la suppression de conversations (`listConversations`, `saveConversation`, `deleteConversation`) et un point d'entrée éditorial de catégorie. **Aucune route d'échange conversationnel n'y figure.** Toute mise en œuvre passant par une route nouvelle suppose une évolution préalable du contrat.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge ; `ADR-2026-10-01-C2` fixe le socle local (PostgreSQL, stockage S3, Mailpit en conteneurs). Toute hypothèse d'hébergement héritée est périmée.
- `PD-2026-10-01-B1` (recherche unifiée) décrit l'orientation des requêtes commerciales ouvertes vers un modèle généraliste : cette décision recoupe directement le périmètre de l'agent conversationnel et doit être confrontée à cette story.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-CONV-01.md`

## Questions ouvertes

- Que signifie « distinct » : deux services déployables séparément, deux modules du même exécutable, ou simplement un port entre les deux ? La réponse change entièrement la charge.
- Comment observe-t-on `AC-01` : par la provenance de la valeur affichée, par la capacité à rejouer le calcul sans l'agent, ou par l'absence de règle de prix dans l'agent ?
- Cette story est-elle encore d'actualité au regard de `PD-2026-10-01-B1`, qui redéfinit l'orientation des requêtes entre PIM, modèle généraliste et Clariprint ?
- Que doit voir l'utilisateur quand l'un des deux côtés échoue et pas l'autre ?
- La source désigne Laurent comme porteur initial. Qui porte la story aujourd'hui, et qui est l'approbateur produit (`OQ-GOV-ROLES`) ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E2-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé. Critères d'acceptation absents de la source.
