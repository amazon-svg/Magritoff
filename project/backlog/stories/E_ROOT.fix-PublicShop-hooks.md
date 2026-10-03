---
id: E_ROOT.fix-PublicShop-hooks
title: E_ROOT.fix-PublicShop-hooks — Vérifier régression Rules of Hooks dans PublicShop (post S-FIX-5)
epic: EPIC-E4
feature: FEAT-E4-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c8106818ecd8d900138cb
  url: https://app.notion.com/35dd0131973c8106818ecd8d900138cb
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P0"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:01:45Z"
  lastEditedAt: "2026-05-11T09:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_ROOT.fix-PublicShop-hooks.md
decisions: []
dependencies:
  - E_OVERLAY.fix-TF59
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_ROOT.fix-PublicShop-hooks.md
---

# E_ROOT.fix-PublicShop-hooks — Vérifier que la cascade d'erreurs React de la boutique est bien éteinte

> Établit que la page boutique se charge sans cascade d'erreurs React, pour que la configuration d'un produit ne reparte pas d'un état corrompu.

## Valeur métier

Quand la page boutique se remonte toute seule à cause d'une erreur, l'acheteur perd ce qu'il était en train de faire : la fenêtre de configuration repart d'un état vide et la première demande de chiffrage n'est jamais envoyée. L'acheteur voit un produit sans prix, ou un configurateur qui ne répond pas. Ce que cela coûtait : la fonction centrale de la boutique — configurer un produit et obtenir son prix — échouait de façon intermittente, donc difficile à reproduire et à expliquer.

## Défaut constaté

Campagne de tests du 11/05/2026. La console portait 155 erreurs React, dont « plus de hooks rendus que lors du rendu précédent » et un avertissement sur le changement d'ordre des hooks appelés par la page boutique. La trace désignait un calcul mémorisé placé après une sortie anticipée du composant.

La conséquence en chaîne : la limite d'erreur du routeur se déclenchait, la page se remontait, l'état d'initialisation de la fenêtre de configuration se corrompait, et la **première** demande de chiffrage n'était jamais envoyée. Le rechargement à chaud du serveur de développement échouait également sur deux fichiers, dont le même composant de page boutique.

La story a été écrite avec l'hypothèse que le correctif livré le 11/05/2026 avait déjà traité la cause : le calcul mémorisé y était remonté avant les sorties anticipées. Son objet est donc la **vérification**, pas la correction — et la vérification devait précéder tout autre correctif sur la fenêtre de configuration.

## Besoin utilisateur

**En tant qu'**acheteur de la boutique, **je veux** que la page se charge sans erreur en cascade, **afin de** configurer mes produits sans que l'écran ne se réinitialise.

## Comportement attendu

1. Une session d'utilisation normale de la boutique ne produit aucune erreur d'ordre des hooks.
2. La page boutique n'est pas remontée lorsque l'acheteur filtre ou change de vue.
3. Tous les appels de hooks du composant de page boutique précèdent sa première sortie anticipée.
4. Le même contrôle est mené sur le composant jumeau signalé par la campagne.
5. Le rechargement à chaud en développement aboutit sur ces fichiers.

## Expérience utilisateur

- L'acheteur ne doit pas voir l'écran se réinitialiser pendant qu'il travaille.
- Un produit ouvert en configuration affiche son prix dès la première demande, sans qu'il ait à fermer et rouvrir.
- **La source est muette** sur ce que doit lire l'acheteur si une erreur survient malgré tout.

## Règles métier

- `RM-01` — Tous les appels de hooks d'un composant précèdent ses sorties anticipées : l'ordre des hooks ne varie pas d'un rendu à l'autre.
- `RM-02` — Une session d'utilisation normale de la boutique ne produit aucune erreur d'ordre des hooks.
- `RM-03` — Le filtrage et le changement de vue ne remontent pas la page boutique.
- `RM-04` — La première demande de chiffrage d'un produit ouvert en configuration part effectivement.
- `RM-05` — La suite de tests automatisés et la construction du projet restent au vert.

## Critères d'acceptation

- `AC-01` — Étant donné une session de 3 à 5 minutes sur une boutique active, quand on relève la console, alors elle ne contient aucune erreur d'ordre des hooks ni aucun avertissement de changement d'ordre des hooks.
- `AC-02` — Étant donné cette même session, quand l'acheteur active deux filtres puis change de vue, alors la page boutique n'est pas remontée.
- `AC-03` — Étant donné le composant de page boutique, quand on relève la position de chacun de ses appels de hooks par rapport à sa première sortie anticipée, alors tous la précèdent.
- `AC-04` — Étant donné le composant jumeau signalé par la campagne, quand on mène le même relevé, alors soit aucune violation n'est constatée, soit elle est corrigée selon le même principe.
- `AC-05` — Étant donné un produit ouvert en configuration pour la première fois de la session, quand la fenêtre s'ouvre, alors la demande de chiffrage est envoyée.
- `AC-06` — Étant donné ces vérifications, quand on exécute la suite de tests et la construction du projet, alors les deux aboutissent.
- `AC-07` — Étant donné le serveur de développement, quand on enregistre une modification sur les fichiers concernés, alors le rechargement à chaud aboutit sans échec.

## Cas limites

- **La cause racine est éteinte dans le dépôt.** Le composant de page boutique tel qu'il existe aujourd'hui déclare la totalité de ses hooks — états, effets, calculs mémorisés, hooks applicatifs — **avant** sa première sortie anticipée, et un commentaire y signale explicitement qu'un calcul mémorisé doit rester à cet endroit. `AC-03` est donc satisfait par lecture. Cette story est **caduque comme travail de correction** ; ce qu'il reste est une vérification à l'usage (`AC-01`, `AC-02`, `AC-05`, `AC-07`) et une exigence de non-régression.
- **Le composant jumeau n'existe plus sous la forme visée.** Seule une partie auxiliaire du composant signalé subsiste dans le dépôt, sans hooks. `AC-04` est sans objet en l'état et doit être reformulé ou retiré.
- **Aucun garde-fou automatique n'empêche la récidive.** La source fermait son périmètre sur un contrôle de style vérifiant la règle des hooks. **Aucune configuration de ce contrôle n'existe dans le dépôt**, et l'outil ne figure pas dans les dépendances du projet. `RM-01` ne repose donc que sur la vigilance humaine et sur le commentaire laissé dans le code.
- **La vérification porte sur un comportement intermittent.** Une session sans erreur ne prouve pas l'absence du défaut. La durée de 3 à 5 minutes vient de la source ; elle n'est pas justifiée et ne constitue pas une preuve forte.
- **Une recette navigateur ne se joue pas pendant qu'un agent modifie le dépôt** : le serveur de développement recharge tous les onglets et fausse l'observation.

## Hors périmètre

- Le comportement fonctionnel de la fenêtre de configuration (`E_OVERLAY.fix-TF59`).
- Le mode sombre de la boutique (`E2.fix-TF55`).
- Les réserves d'accessibilité de la boutique (`E_A11Y.shop-pills-and-drawer`).
- La remise en ordre générale du composant de page boutique.

## Dépendances et décisions

- `E_OVERLAY.fix-TF59` — dépendance déclarée en frontmatter. Le sens de la relation posé par la source est l'inverse de ce que le mot suggère : cette story est le **prérequis** de `E_OVERLAY.fix-TF59`, et si la vérification aboutit, `E_OVERLAY.fix-TF59` est résolue de fait. La relation a été conservée telle qu'elle est déclarée ; son sens reste à vérifier à la revue.
- `E2.fix-TF55` déclare cette story en dépendance, alors que sa propre source écrit qu'il n'y a aucun prérequis bloquant entre les deux. Contradiction signalée dans `E2.fix-TF55`, non résolue ici.
- `ADR-2026-10-01-C6` — le retrait du kit d'interface est reporté : le socle d'interface sur lequel porte cette vérification n'est pas remis en cause à court terme.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : cette story n'a aucune composante serveur, et les éléments de mise en œuvre hérités de l'import ont été retirés.
- La source rattachait la vérification à un cas de test existant et à un cas nouveau, tenus dans Notion. Notion est sorti du jeu le 03/10/2026 : l'emplacement où ces cas vivent reste à désigner.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_ROOT.fix-PublicShop-hooks.md`

## Questions ouvertes

- La cause racine étant éteinte dans le dépôt, cette story doit-elle être close, ou conservée comme vérification à jouer une fois sur la nouvelle version ?
- `AC-04` vise un composant jumeau qui n'existe plus sous cette forme : le critère est-il retiré, ou reporté sur un autre composant ?
- Faut-il installer un contrôle de style vérifiant la règle des hooks, aujourd'hui absent du dépôt ? Sans lui, rien n'empêche la récidive.
- Une session de 3 à 5 minutes suffit-elle à conclure sur un défaut intermittent, et selon quel protocole d'observation ?
- Le sens de la relation avec `E_OVERLAY.fix-TF59` est-il bien celui que décrit la source, c'est-à-dire cette story en prérequis ?
- Où se rejouent désormais les cas de test fonctionnels, Notion étant sorti du jeu ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E4-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
