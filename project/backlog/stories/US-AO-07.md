---
id: US-AO-07
title: Fiabilisation de l'ingestion des fichiers AO
epic: EPIC-T08
feature: FEAT-T08-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c81ed8539f91aa573f0f7
  url: https://app.notion.com/375d0131973c81ed8539f91aa573f0f7
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P0"
  originalEffort: ""
  originalAssignee: "Xavier"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-AO-07.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-AO-07.md
---

# US-AO-07 — Fiabilisation de l'ingestion des fichiers AO

> Garantit qu'un fichier d'appel d'offres est lu en entier : toute ligne absente du traitement est détectée et signalée, au lieu de disparaître en silence.

## Valeur métier

La source cite un incident précis : **55 produits traités sur 250**. Une troncature silencieuse est le pire défaut possible pour ce module — l'utilisateur obtient un résultat plausible, le transmet, et découvre l'écart chez son client. Il ne perd pas du temps, il perd sa crédibilité, et il cesse d'utiliser l'outil. Tant que l'exhaustivité n'est pas garantie et vérifiable, aucune autre fonctionnalité de la chaîne AO n'est utilisable en production : elles s'appuieraient toutes sur une donnée dont on ne sait pas si elle est complète.

Le détecter, c'est bien ; le **signaler** est l'exigence réelle. Un traitement incomplet mais annoncé reste exploitable ; un traitement incomplet et muet ne l'est pas.

## Besoin utilisateur

_Non formulé dans la source Notion._ Le besoin se lit en creux : celui qui soumet un fichier doit pouvoir faire confiance au résultat sans le recompter à la main.

## Comportement attendu

1. Le fichier source est lu en mode binaire, de façon à éviter la troncature constatée (55 produits lus au lieu de 250).
2. Un contrôle d'exhaustivité vérifie que toute la donnée du fichier a été prise en compte.
3. Tout écart entre ce que contient le fichier et ce qui a été traité est détecté et signalé.
4. Les colonnes du fichier font l'objet d'une description textuelle.
5. La reproductibilité du traitement est prise en charge.

**La source est muette** sur ce que recouvrent les deux derniers points. « Description textuelle des colonnes » peut désigner une aide à la compréhension pour l'utilisateur ou une entrée du mapping sémantique ; « traitement de la reproductibilité » n'est pas défini du tout.

## Expérience utilisateur

- Le signalement doit être impossible à manquer et formulé en langage d'utilisateur : « 250 lignes détectées, 55 traitées, 195 non traitées » se comprend ; un message technique ne se comprend pas.
- L'utilisateur doit pouvoir voir **lesquelles** des lignes manquent, pas seulement combien : c'est ce qui lui permet de décider s'il peut livrer malgré tout.
- Le contrôle doit s'exécuter avant que l'utilisateur ne s'engage : découvrir l'écart après avoir envoyé la réponse ne sert à rien.
- Un fichier incomplet doit pouvoir être resoumis sans tout recommencer.
- **La source est muette** sur l'écran, sur le moment du contrôle et sur la possibilité de poursuivre malgré un écart constaté.

## Règles métier

- `RM-01` — 100 % des lignes du fichier source sont traitées.
- `RM-02` — Tout écart entre le contenu du fichier et ce qui a été traité est détecté et signalé à l'utilisateur. Un écart non signalé est un défaut, au même titre qu'un écart non détecté.
- `RM-03` — La lecture du fichier s'effectue en binaire afin de prévenir la troncature observée.
- `RM-04` — Les colonnes du fichier reçoivent une description textuelle.

## Critères d'acceptation

- `AC-01` — Étant donné le fichier à l'origine de l'incident cité par la source (250 produits), quand il est ingéré, alors 250 lignes sont traitées et aucune n'est perdue.
- `AC-02` — Étant donné un fichier dont une partie ne peut pas être traitée, quand l'ingestion s'achève, alors l'utilisateur est informé du nombre de lignes attendues, du nombre de lignes traitées et de l'écart.
- `AC-03` — Étant donné un écart détecté, quand l'utilisateur consulte le signalement, alors il peut identifier les lignes non traitées (**la source exige la détection et le signalement, pas l'identification ligne à ligne : exigence posée ici au titre de l'exploitabilité, à confirmer**).
- `AC-04` — Étant donné un même fichier ingéré deux fois, quand on compare les deux résultats, alors le nombre de lignes détectées et traitées est identique (**la source cite le « traitement de la reproductibilité » sans le définir ; ce critère en retient la lecture minimale**).
- `AC-05` — Étant donné un fichier ingéré, quand l'utilisateur consulte la structure détectée, alors chaque colonne porte une description textuelle (**la finalité de cette description n'est pas précisée par la source**).

## Cas limites

- **Combien de lignes le fichier contient-il réellement ?** Un contrôle d'exhaustivité suppose une référence. Dans un tableur avec des titres de catégorie, des sous-totaux et des lignes vides, le nombre de lignes « produit » est déjà une interprétation — c'est l'objet de `T08.N2`. Le contrôle ne peut donc pas être plus fiable que la détection de structure sur laquelle il s'appuie.
- **Plusieurs feuilles** : `T08.N1` cite le multi-feuilles. Une feuille entière ignorée est le cas de troncature le plus facile à manquer.
- **Lignes fusionnées ou héritées** (`T08.N3`) : une ligne reportée doit-elle compter comme traitée ?
- **Ligne lue mais non interprétable** : comptée comme traitée, ou comme écart ? La différence change le sens du chiffre affiché.
- **Fichier volumineux** : aucun plafond de taille ni de nombre de lignes n'est indiqué.
- **Poursuite malgré l'écart** : la source n'interdit pas de continuer, et n'oblige pas à s'arrêter.

## Hors périmètre

- La détection de structure elle-même (`T08.N2`) et la résolution des fusions (`T08.N3`).
- Le mapping sémantique des colonnes (`T08.N4`) et les normaliseurs (`T08.N5` à `T08.N8`).
- Le chiffrage (`T08.N12`) et la restitution (`T08.N13`).
- L'interface de revue humaine et les niveaux de confiance (`T08.N14`).
- L'enchaînement complet de la chaîne (`US-AO-06`).

## Dépendances et décisions

- Aucune dépendance déclarée par la source ; le frontmatter reste vide.
- **Recouvrement à signaler.** `T08.N1` (ingestion fidèle du fichier source : binaire, multi-feuilles, fusions) couvre la même étape et mentionne explicitement la lecture binaire. `US-AO-07` apporte en plus l'exigence d'exhaustivité chiffrée et le signalement d'écart, ainsi que l'incident 55/250 qui la justifie. **Fusionner les deux, ou traiter `US-AO-07` comme les critères de recette de `T08.N1`, est à arbitrer** ; développer les deux séparément conduira à deux lecteurs de fichiers.
- `US-AO-06` décrit la chaîne dont cette story garantit la première étape.
- Aucune décision du 1er octobre 2026 n'est rattachée à cette story.
- Rien dans le dépôt : aucune ingestion de fichier AO. Le dépôt manipule des fichiers tableur pour l'export de commandes (`src/modules/order-exports/`), ce qui est une production, pas une lecture.
- Référence de provenance conservée : WM#030626, réf. 01:00:09 / 01:01:55.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-AO-07.md`

## Questions ouvertes

- Qu'est-ce qui fait référence pour le compte de lignes attendues, sachant que ce compte dépend lui-même de la détection de structure (`T08.N2`) ?
- Une ligne lue mais non interprétable compte-t-elle comme traitée ou comme écart ?
- Le traitement s'arrête-t-il en cas d'écart, ou poursuit-il en signalant ?
- L'utilisateur doit-il voir les lignes manquantes une par une, ou le décompte suffit-il ?
- Que recouvre « description textuelle des colonnes » : une aide à l'utilisateur, une trace d'audit, ou une entrée du mapping sémantique de `T08.N4` ?
- Que recouvre « traitement de la reproductibilité » : même résultat pour un même fichier, ou profils de traitement rejouables d'un AO à l'autre ?
- Le fichier de l'incident 55/250 est-il disponible comme jeu de test de référence ? Sans lui, `AC-01` n'est pas vérifiable.
- Cette story est-elle autonome, ou est-elle la recette de `T08.N1` ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-T08-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
