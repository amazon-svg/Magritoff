---
id: US-CORE-02
title: Dépôts séparés (1 core + 1 par app)
epic: EPIC-E9
feature: FEAT-E9-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c8137890bd4cfb18fefc1
  url: https://app.notion.com/375d0131973c8137890bd4cfb18fefc1
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
  archive: _archives-notion/2026-10-03/pages/US-CORE-02.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-CORE-02.md
---

# US-CORE-02 — Dépôts séparés (1 core + 1 par app)

> Sépare le code du socle de celui de chaque application, pour que plusieurs équipes travaillent en parallèle sans s'attendre ni se marcher dessus.

## Valeur métier

Quand tout vit dans un seul dépôt, chaque équipe hérite du contexte des autres : des revues qui ne la concernent pas, des conflits sur des fichiers qu'elle n'a pas touchés, et une responsabilité diluée sur ce qui casse. Séparer les dépôts donne à chaque équipe un périmètre qu'elle tient réellement, et rend possible de confier une application à un partenaire sans lui ouvrir le reste du produit. C'est le corollaire d'organisation du socle décrit par `US-CORE-01` : sans frontière de code, la frontière d'architecture ne tient pas longtemps.

## Besoin utilisateur

**En tant qu'**équipe technique, **nous voulons** un dépôt pour le socle Magrit et un dépôt par application — discussion, catalogue produit, gestion des médias, briques de back-office fournisseur — **afin de** paralléliser les chantiers et de responsabiliser chaque équipe.

_Source : réunion de travail du 3 juin 2026 (WM#030626, repère 00:13:02)._

## Comportement attendu

_La source énonce une cible d'organisation, pas un comportement de produit. Les points ci-dessous sont repris d'elle, sans ajout._

1. Le socle vit dans son propre dépôt, au contexte délimité.
2. Chaque application vit dans un dépôt distinct.
3. Les applications citées par la source sont : la discussion, le catalogue produit, la gestion des médias, et les briques de back-office fournisseur.
4. Livrer une application ne demande aucune modification du socle.
5. Plusieurs chantiers avancent en parallèle sans s'attendre.

## Expérience utilisateur

- L'« utilisateur » est une équipe de développement : son expérience se mesure au fait de pouvoir livrer sans dépendre du calendrier d'une autre équipe.
- Pour l'utilisateur final, le découpage doit être invisible : le produit reste un seul produit.
- **La source est muette** sur tout : rien n'est dit du partage de code commun entre dépôts, de l'assemblage du produit livré, ni de la façon dont une modification traversant plusieurs dépôts est revue.

## Règles métier

- `RM-01` — Le socle et chaque application ont des dépôts distincts.
- `RM-02` — Livrer une application ne demande aucune modification du dépôt du socle.
- `RM-03` — Chaque dépôt a une équipe responsable identifiée.
- `RM-04` — Le découpage n'altère pas ce que voit l'utilisateur final : le produit reste unique et cohérent.

## Critères d'acceptation

_La section « Critères d'acceptation » de la source importée indique qu'aucun critère explicite n'a été trouvé. C'est inexact : la description en énonce deux, repris ci-dessous. Aucun des deux n'est observable en l'état._

- `AC-01` — Étant donné plusieurs chantiers menés en même temps, quand on les observe, alors ils avancent en parallèle. **Non vérifiable en l'état** : « parallélisation effective » n'est pas une propriété qu'on constate sur un produit ; il faut une mesure, ou renoncer à en faire un critère.
- `AC-02` — Étant donné la livraison d'une application, quand on examine ce qui a été modifié, alors le dépôt du socle ne l'a pas été. **Vérifiable**, à condition que le découpage existe et qu'une application témoin soit nommée.

## Cas limites

- **Le dépôt est unique aujourd'hui.** `pnpm-workspace.yaml` ne déclare qu'un seul paquet (`.`) : il n'y a ni dépôts séparés, ni découpage interne en paquets. Le découpage actuel est celui des modules (`src/modules/`, 39 modules), à l'intérieur d'un seul dépôt et d'un seul paquet.
- **Le coût du découpage n'est pas évalué.** Séparer les dépôts crée trois problèmes que la source ne mentionne pas : le partage du code commun, l'assemblage du produit livré, et la revue d'une modification qui traverse plusieurs dépôts. Aucun n'est traité.
- **Une étape intermédiaire existe et n'est pas envisagée** : un découpage en paquets à l'intérieur d'un même dépôt donne une part de la frontière recherchée sans le coût de la séparation. La source ne l'évoque pas ; l'arbitrage mérite d'être posé.
- **Les applications citées ne correspondent pas aux modules actuels.** « Discussion », « catalogue produit », « gestion des médias », « briques de back-office fournisseur » ne se superposent pas au découpage en place. Le périmètre de chaque dépôt est donc à définir, pas à déduire.
- **Il n'y a pas d'équipe par application aujourd'hui.** La responsabilisation visée suppose une organisation qui n'existe pas : c'est une décision de gouvernance autant que de technique.
- **Une copie de travail dédoublée a déjà produit un faux diagnostic** dans ce projet (`CLAUDE.md`). Multiplier les dépôts multiplie ce risque : rien dans la source ne prévoit comment on sait, à un instant donné, quelles versions vont ensemble.

## Hors périmètre

- Le contenu du socle lui-même (`US-CORE-01`).
- Les fonctionnalités des applications.
- La centralisation de la documentation et des sprints (`US-METH-01`).
- Le choix de l'hébergement et du déploiement.

## Dépendances et décisions

- Aucune dépendance déclarée en frontmatter.
- `US-CORE-01` — la frontière entre socle et applications doit être définie avant d'être matérialisée par des dépôts. Non reportée en frontmatter : la source ne la formule pas comme un prérequis, mais l'ordre logique est clair.
- `docs/CONVENTION_GIT.md` — la convention de branches en vigueur décrit un dépôt unique partagé avec le partenaire technique. Un découpage en plusieurs dépôts la rendrait caduque.
- `ADR-2026-10-01-C4` — le contrat d'API unique est ce qui permettrait à des dépôts séparés de rester cohérents. C'est la pièce centrale du découpage.
- La réunion source (WM du 3 juin 2026) n'a pas de compte rendu dans `project/meetings` : l'intention complète n'est pas vérifiable dans le dépôt.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-CORE-02.md`

## Questions ouvertes

- Cette story est-elle une story, ou une décision d'architecture et d'organisation ? Elle ne produit aucun comportement observable pour un utilisateur.
- Le découpage est-il toujours voulu, quatre mois après la réunion qui l'a formulé et après un changement complet de socle technique ?
- Un découpage en paquets dans un dépôt unique suffirait-il, pour une fraction du coût ?
- Quelles applications exactement, et quel périmètre pour chacune ? La liste de la source ne se superpose pas au découpage en modules actuel.
- Quelle équipe est responsable de quoi ? Sans cela, la responsabilisation visée n'a pas de titulaire.
- Comment le code commun est-il partagé, et comment le produit livré est-il assemblé à partir de plusieurs dépôts ?
- Comment sait-on, à un instant donné, quelles versions de quels dépôts vont ensemble ?
- Comment une modification traversant plusieurs dépôts est-elle revue et livrée en une fois ?
- Quelle conséquence sur la convention de branches partagée avec le partenaire technique ?
- Critères d'acceptation à réécrire : le premier n'est pas observable.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E9-UNCLASSIFIED` est un regroupement de migration). Le rattachement à l'epic « Multi-tenant & gouvernance » est discutable : cette story relève de l'organisation du code.
- Relecture produit requise : contenu issu d'un import, non approuvé.
