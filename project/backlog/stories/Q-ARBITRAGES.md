---
id: Q-ARBITRAGES
title: Décisions en attente d'Arnaud — chantier boutique (session 19-20/09)
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 3e1d0131973c81f58bfffef4f7682248
  url: https://app.notion.com/3e1d0131973c81f58bfffef4f7682248
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P1"
  originalEffort: "XS"
  originalAssignee: "Arnaud"
  originalOffering: ""
  originalOrder: "29"
  originalSources: ""
  createdAt: "2026-09-20 07:41:30Z"
  lastEditedAt: "2026-09-20T07:41:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/Q-ARBITRAGES.md
decisions: []
dependencies: []
supersedes: []
implementationRecords: []
---

# Décisions en attente d'Arnaud — chantier boutique (session 19-20/09)

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3e1d0131973c81f58bfffef4f7682248)). Le statut Notion `Pas commencé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

Cinq décisions nées des lots de cette session. **Aucune ne bloque ce qui est fusionné.**

## 1. Prix au renouvellement

« Commander à nouveau » doit-il rejouer le **prix payé**, ou proposer le **prix du jour** ?
Comportement livré : prix du jour, avec un avertissement dans le bandeau. Recommandation : le garder — un prix vieux de plusieurs semaines n'engage plus l'imprimeur, et le rejouer en silence crée une promesse que l'atelier n'a pas faite.

## 2. Rétrofit des espaces existants (Q24)

Les espaces déjà créés doivent-ils passer à 30 jours de validité ?
Difficulté : en base, rien ne distingue « personne n'a jamais décidé » de « on a décidé qu'il n'y aurait pas de validité ». Rétrofiter écrase les deux. Recommandation de l'architecte : **ne pas rétrofiter**.
Sous-question : un espace sans date de fin est-il un cas légitime ? Si oui, il faut le distinguer en base.

## 3. Acquitter ou valider (Q19)

Acquitter un prix non vérifié doit-il être réservé à une population **plus étroite** que valider une commande ?
Livré : identique. Cohérent avec l'arbitrage sur la supervision par l'admin ou le commercial. Un mot suffit à fermer le sujet, aucun code à changer.

## 4. Bouton « Personnaliser » (Q16)

Il est actif sur **toutes** les cartes de la boutique et n'écrit qu'un message en console : l'acheteur qui le touche n'obtient rien, et rien ne lui dit pourquoi.
Le retirer tant que Canva n'est pas branché, ou le **griser avec un libellé** comme le bouton panier ? C'est un choix de vitrine commerciale.

## 5. Bibliothèque de test de rendu React

Ce dépôt n'en a **aucune**. Faute de pouvoir observer ce qu'un écran affiche, les gardes lisent le **texte du code source** — et un simple commentaire les trompe.
**Quatre fois dans ce chantier**, dont deux sur du code du coordinateur : à chaque fois, tests verts, compilateur silencieux, **règle métier neutralisée**. Un de ces défauts était vivant dans la branche principale.
C'est une décision d'outillage qui dépasse un lot.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — aucune preuve trouvée après balayage du dépôt.

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
