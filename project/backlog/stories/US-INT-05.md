---
id: US-INT-05
title: Extraction données ERP (Cadratin / Kojilog)
epic: EPIC-E5
feature: FEAT-E5-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c811a8d5adca4abce54bc
  url: https://app.notion.com/375d0131973c811a8d5adca4abce54bc
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P2"
  originalEffort: ""
  originalAssignee: "Xavier"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-INT-05.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-INT-05.md
---

# US-INT-05 — Extraction données ERP (Cadratin / Kojilog)

> Récupère, sous forme d'export tabulaire, les données d'un outil de gestion d'imprimerie existant, pour disposer d'un jeu de données exploitable sans brancher les deux systèmes l'un sur l'autre.

## Valeur métier

Avant de connecter quoi que ce soit, il faut savoir ce que contient l'outil en place : quelles références, quelle qualité, quelles lacunes. Un export tabulaire configurable répond à cette question pour un coût proche de zéro, là où une synchronisation demande un projet. C'est aussi la voie la moins risquée du point de vue de l'imprimeur : rien n'est écrit dans son système, rien n'est modifié, rien ne peut casser sa production. La source tranche d'ailleurs explicitement dans ce sens — extraction à sens unique plutôt que synchronisation bidirectionnelle — et c'est un arbitrage de prudence autant que de coût.

## Besoin utilisateur

**En tant que** responsable de l'intégration d'un imprimeur, **je veux** extraire les données de son outil de gestion sous forme de fichier tabulaire configurable, **afin de** disposer d'un jeu de données normalisé sans brancher les deux systèmes l'un sur l'autre.

_La source Notion formulait une description, pas un besoin utilisateur ; celui-ci la reformule sans y ajouter d'exigence et reste à confirmer en revue produit._

## Comportement attendu

1. Les données sont récupérées depuis l'outil de gestion par un export tabulaire, dont le contenu et le format sont configurables.
2. L'extraction va dans un seul sens : rien n'est écrit en retour dans l'outil de gestion.
3. Les données extraites sont normalisées, c'est-à-dire ramenées à une forme commune, indépendante de l'outil d'origine.
4. Le résultat est un jeu de données exploitable tel quel.

## Expérience utilisateur

- L'utilisateur est un intégrateur, pas un imprimeur : son attente est de savoir **ce qui a été extrait et ce qui ne l'a pas été**. Un export silencieux dont on découvre les trous trois semaines plus tard est un export raté.
- La normalisation doit être traçable : pour chaque donnée normalisée, on doit pouvoir remonter à sa valeur d'origine. Sans cela, un écart constaté plus tard n'est pas diagnosticable.
- **La source est muette** sur tout cela : elle ne décrit ni écran, ni destinataire, ni compte rendu d'extraction.

## Règles métier

- `RM-01` — La récupération se fait par export tabulaire configurable depuis l'outil de gestion, pour les deux outils nommés par la source : Cadratin et Kojilog.
- `RM-02` — L'extraction est **unidirectionnelle** : aucune écriture en retour dans l'outil de gestion. C'est un arbitrage explicite de la source contre la synchronisation bidirectionnelle.
- `RM-03` — Les données extraites sont normalisées sous une forme commune, indépendante de l'outil d'origine.
- `RM-04` — Le livrable est un jeu de données, pas un raccordement permanent.

## Critères d'acceptation

**La source Notion ne portait qu'une phrase d'exigence** — « jeu de données extrait et normalisé ». Les critères ci-dessous la reformulent en termes observables ; ils n'ajoutent aucune exigence et restent à confirmer en revue produit.

- `AC-01` — Étant donné un outil de gestion parmi les deux nommés, quand l'extraction est jouée, alors un fichier tabulaire est produit, dont le contenu correspond à la configuration demandée.
- `AC-02` — Étant donné une extraction jouée, quand on inspecte l'outil de gestion, alors rien n'y a été écrit ni modifié.
- `AC-03` — Étant donné les données extraites de deux outils différents, quand elles sont normalisées, alors elles présentent la même forme et les mêmes désignations.
- `AC-04` — Étant donné un jeu de données normalisé, quand on y cherche une valeur, alors on peut remonter à la valeur d'origine dont elle est issue (**la source est muette : traçabilité à confirmer**).
- `AC-05` — Étant donné une extraction incomplète ou en échec, quand elle se termine, alors ce qui n'a pas été extrait est connu et nommé (**la source est muette : comportement à arbitrer**).

## Cas limites

- **La source place cette story hors de Magrit.** Elle porte la mention « projet hors Magrit (AGE Services) ». Une story rangée dans le backlog Magrit, rattachée à l'epic `EPIC-E5`, dont la source dit qu'elle ne relève pas de Magrit, est une incohérence de classement qui doit être tranchée avant toute planification : soit le périmètre a changé et la mention est caduque, soit la story n'a pas sa place ici.
- **Rien n'existe dans le dépôt sur ces deux outils.** Aucune mention de Cadratin ou de Kojilog en dehors de notes de positionnement commercial et de l'historique de migration de cette story. Aucun format d'export, aucun modèle de données cible, aucun script.
- **`RM-02` contredit `E5.2`, et c'est peut-être voulu.** `E5.2` décrit une synchronisation dont le sens est configurable, dans les deux directions. Cette story tranche en faveur d'une extraction à sens unique. Les deux peuvent coexister — une extraction ponctuelle de reprise n'est pas une synchronisation permanente — mais l'articulation n'est écrite nulle part.
- **« Normalisé » n'est pas défini.** Normalisé vers quoi ? Le modèle de données de Magrit, ou un format intermédiaire ? Sans modèle cible, `AC-03` n'est pas vérifiable.
- **Données personnelles et données commerciales.** Un export d'outil de gestion contient l'identité des clients de l'imprimeur, ses prix de vente et ses volumes. La source n'en dit rien : ni ce qui est extrait, ni où le fichier est déposé, ni qui y a accès, ni combien de temps il est conservé.
- **Export manuel ou automatisé.** La source parle d'un export « configurable » sans dire qui le configure ni qui le déclenche — l'imprimeur depuis son outil, ou Magrit à distance. Les deux n'ont ni le même coût, ni le même risque.

## Hors périmètre

- Le raccordement permanent à un outil de gestion et la synchronisation continue (`E5.2`).
- L'API de publication et son socle (`E5.1`).
- L'exploitation du jeu de données une fois extrait : chargement, rapprochement, reprise dans Magrit.
- La qualification de la qualité des données extraites.

## Dépendances et décisions

- La source ne déclare aucune dépendance. Le recoupement relevé avec `E5.2` n'est pas reporté en frontmatter : la source ne le formule pas.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : les éléments de mise en œuvre serveur hérités de l'import sont périmés et ont été retirés.
- Origine : séance de travail du 03/06/2026. La source mentionne un rattachement à AGE Services plutôt qu'à Magrit.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-INT-05.md`

## Questions ouvertes

- **Cette story relève-t-elle de Magrit ?** Sa source dit le contraire. Tant que ce n'est pas tranché, elle ne doit ni être planifiée, ni être comptée dans la charge de l'epic.
- Si elle est conservée : normalisé vers quel modèle de données cible ?
- Qui déclenche l'extraction, et depuis où : l'imprimeur dans son outil, ou Magrit à distance ?
- Quelles données sont dans le périmètre, sachant qu'un export d'outil de gestion contient l'identité des clients de l'imprimeur et ses prix de vente ? Où le fichier est-il déposé, qui y accède, combien de temps est-il conservé ?
- Y a-t-il un imprimeur réel et un jeu de données réel derrière cette story ? Sans eux, un format d'export se spécifie à l'aveugle.
- Comment cette extraction s'articule-t-elle avec la synchronisation décrite par `E5.2`, qui tranche dans l'autre sens ?
- Critères d'acceptation quasi absents de la source : ceux qui précèdent reformulent sa seule phrase d'exigence et restent à valider.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E5-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
