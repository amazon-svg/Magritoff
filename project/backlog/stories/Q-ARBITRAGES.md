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

> **Ce document n'est pas une story et n'est pas une unité de travail.** C'est un relevé de cinq décisions nées des lots de la session des 19 et 20 septembre 2026. Rien ici ne se planifie, ne s'estime ni ne se livre : chaque entrée attend un mot d'Arnaud. **Aucune ne bloque ce qui est fusionné.**

## Ce que ce relevé contient

Cinq questions, chacune avec le comportement livré en l'état, la recommandation formulée au moment du lot, et le coût de l'indécision. Trois se ferment par un mot sans aucun code à changer ; une demande un choix de vitrine commerciale ; une est une décision d'outillage qui dépasse un lot.

## 1. Prix au renouvellement

**Question.** « Commander à nouveau » doit-il rejouer le **prix payé**, ou proposer le **prix du jour** ?

**Comportement livré.** Prix du jour, avec un avertissement dans le bandeau du panier (`Q20`).

**Recommandation.** Le garder. Un prix vieux de plusieurs semaines n'engage plus l'imprimeur, et le rejouer en silence crée une promesse que l'atelier n'a pas faite.

**Coût de l'indécision.** Faible : le comportement livré tient. Mais il est en service sans avoir été arbitré, donc personne ne peut s'y appuyer comme sur une règle.

**Porté par.** `Q20`.

## 2. Rétrofit des espaces existants (Q24)

**Question.** Les espaces déjà créés doivent-ils passer à 30 jours de validité de devis ?

**Comportement livré.** Non. Le déploiement ne pose qu'une valeur par défaut de colonne, aucune donnée n'est réécrite (`Q18`).

**Difficulté.** En base, rien ne distingue « personne n'a jamais décidé » de « on a décidé qu'il n'y aurait pas de validité ». Rétrofiter écrase les deux.

**Recommandation de l'architecte.** Ne pas rétrofiter.

**Sous-question.** Un espace sans date de fin est-il un cas légitime ? Si oui, il faut le distinguer en base. À noter : l'écran du menu Devis accepte aujourd'hui un champ vide, donc ce cas est **atteignable par l'interface** alors que sa légitimité n'est pas tranchée.

**À vérifier avant d'arbitrer.** `ADR-2026-10-01-C5` prévoit un schéma regroupé et assaini sans conservation des données historiques. Si les espaces concernés ne survivent pas à cette transition, la question est sans objet.

**Porté par.** `Q18`.

## 3. Acquitter ou valider (Q19)

**Question.** Acquitter un prix non vérifié doit-il être réservé à une population **plus étroite** que valider une commande ?

**Comportement livré.** Identique : qui peut valider peut acquitter (`Q17-c`).

**Recommandation.** Cohérent avec l'arbitrage sur la supervision par l'administrateur ou le commercial. Un mot suffit à fermer le sujet, aucun code à changer.

**Coût de l'indécision.** La question avait été écrite comme ouverte au moment du lot ; elle a été livrée fermée par défaut. C'est exactement le genre d'écart qui se découvre plus tard, quand quelqu'un acquitte sans qu'on l'ait voulu.

**Porté par.** `Q17-c`.

## 4. Bouton « Personnaliser » (Q16)

**Question.** Le retirer tant que l'outil de personnalisation n'est pas branché, ou le **griser avec un libellé** comme le bouton panier de `Q14-a` ?

**Comportement livré.** Le bouton est **actif sur toutes les cartes** de la boutique et n'écrit qu'un message en console : l'acheteur qui le touche n'obtient rien.

**Précision relevée dans le dépôt.** Le bouton porte une infobulle et un libellé accessible annonçant « à venir » (`src/modules/catalog/ui/storefront/ShopProductCard.tsx`). L'acheteur n'est donc pas totalement sans information — mais une infobulle **ne se lit pas au tactile**, et c'est précisément l'argument qui a conduit, pour le bouton panier, à écrire le motif en permanence sous les boutons. Le défaut est donc le même, et la réponse déjà connue.

**Nature de la décision.** Choix de vitrine commerciale : montrer une fonctionnalité à venir, ou ne montrer que ce qui marche.

## 5. Bibliothèque de test de rendu

**Question.** Le dépôt doit-il se doter d'une bibliothèque permettant d'observer ce qu'un écran affiche ?

**Constat, vérifié.** Il n'en a **aucune** : ni bibliothèque de rendu, ni environnement de document simulé dans `package.json`. Faute de pouvoir observer un écran, les vérifications lisent le **texte du code source** — et un simple commentaire les trompe.

**Ce que cela a coûté sur ce seul chantier.** **Quatre fois**, dont deux sur du code du coordinateur : tests verts, compilateur silencieux, **règle métier neutralisée**. Un de ces défauts était vivant dans la branche principale (`FIX-GARDE`). Les vérifications concernées protègent des règles arbitrées par Arnaud : la table unique des libellés de statut (`BCP-5`), l'unicité du constructeur de ligne de panier (`BCP-11`), la condition d'ajout au panier (`Q14-a`), l'affichage de l'écart de prix (`Q17-c`). Elles reposent toutes sur le même point unique : un défaut à cet endroit les fait tomber ensemble, en silence.

**Limite irréductible du procédé actuel.** Une vérification textuelle attrape la régression accidentelle, jamais l'évasion délibérée.

**Nature de la décision.** Outillage, au-delà d'un lot. C'est la seule entrée de ce relevé qui demande un investissement.

## Critères d'acceptation

_Sans objet. Ce document est un relevé de décisions en attente, pas une unité de travail : il n'a ni comportement attendu, ni critère observable. Chaque entrée se ferme par un arbitrage, pas par une livraison._

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — aucune preuve trouvée après balayage du dépôt.

## Questions ouvertes

- **Recommandation de forme : ce document ne doit pas rester dans le backlog.** Les cinq entrées ci-dessus sont des questions ouvertes, pas du travail. Elles relèvent de `project/decisions/open-questions.md`, dont c'est exactement l'objet, avec pour chacune un responsable et une échéance — deux informations qu'une fiche de backlog ne porte pas. Proposition : créer cinq entrées (`OQ-RENOUVELLEMENT-PRIX`, `OQ-Q24-RETROFIT-VALIDITE`, `OQ-Q19-ACQUITTER`, `OQ-Q16-PERSONNALISER`, `OQ-OUTILLAGE-RENDU`), chacune renvoyant à la story qui la porte, puis **retirer cette fiche du backlog**. Tant qu'elle y figure, elle gonfle le reste à faire d'un travail qui n'existe pas et masque le fait que trois de ces questions se ferment par un mot.
- Qui arbitre chaque entrée, et sous quel délai ? Les entrées 1 et 3 décrivent un comportement **déjà en service** : chaque jour sans arbitrage les installe davantage comme des faits accomplis.
- L'entrée 2 doit-elle être arbitrée avant ou après avoir vérifié ce que l'assainissement du schéma conserve ? Arbitrer d'abord peut revenir à trancher une question sans objet.
- L'entrée 5 chiffrée : quel est le coût d'introduction d'une bibliothèque de rendu, et combien de vérifications textuelles existantes pourraient être converties en vérifications de comportement ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration) — sans objet si la fiche est retirée.
- Relecture produit requise : contenu issu d'un import, non approuvé.
