---
id: US-METH-01
title: Documentation & sprints centralisés dans Git
epic: EPIC-E9
feature: FEAT-E9-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c8180af4ce93a287e0b6e
  url: https://app.notion.com/375d0131973c8180af4ce93a287e0b6e
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P2"
  originalEffort: ""
  originalAssignee: "Laurent"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-METH-01.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-METH-01.md
---

# US-METH-01 — Documentation & sprints centralisés dans Git

> Rassemble la documentation de développement, le backlog et les sprints dans le dépôt, pour qu'on trouve la version qui fait foi au même endroit que le code qu'elle décrit.

> ✅ **Réalisée pour l'essentiel le 3 octobre 2026.** La migration du backlog depuis Notion et la mise en place de `project/` répondent à la demande ; l'historisation des exécutions d'agents, elle, n'est pas faite, et la clause de complémentarité avec Notion est devenue fausse. Le classement de la story est à trancher — voir « Questions ouvertes ».

## Valeur métier

Quand la documentation vit ailleurs que le code, elle vieillit sans que personne ne le voie : une story décrit un comportement que le dépôt a cessé d'avoir depuis trois mois, et on ne s'en aperçoit qu'en la relisant. Tenir les deux ensemble rend l'écart visible au moment où il se crée, soumet la documentation aux mêmes revues que le code, et permet de dire ce qui faisait foi à une date donnée. Pour une équipe qui travaille avec des agents, c'est aussi la seule façon de leur donner un contexte vérifiable plutôt qu'une mémoire approximative.

## Besoin utilisateur

**En tant qu'**équipe de développement, **nous voulons** centraliser dans le dépôt la documentation de développement, le backlog, les epics, les stories et les revues de sprint, et historiser les exécutions d'agents, **afin que** l'information soit consultable depuis Git.

_Source : réunion de travail du 3 juin 2026 (WM#030626, repère 00:14:19)._

## Comportement attendu

1. La documentation de développement vit dans le dépôt.
2. Le backlog, les epics et les stories vivent dans le dépôt.
3. Les revues de sprint vivent dans le dépôt.
4. Les exécutions d'agents sont historisées.
5. L'ensemble est consultable depuis Git, sans outil tiers.
6. La source ajoute que ce périmètre est « complémentaire de la base documentaire globale Notion ». **Cette clause est caduque** — voir « Cas limites ».

## Expérience utilisateur

- L'« utilisateur » est un membre de l'équipe, humain ou agent, qui cherche ce qui fait foi : il doit le trouver dans le dépôt, sans se demander si une version plus récente existe ailleurs.
- Un lecteur doit pouvoir remonter à ce qui faisait foi à une date donnée, et voir qui a changé quoi.
- Un agent doit pouvoir lire le contexte du projet sans accès à un service externe.
- **La source est muette** sur le format, sur la structure des dossiers et sur ce qu'il advient de l'information déjà saisie ailleurs.

## Règles métier

- `RM-01` — La documentation de développement, le backlog, les epics, les stories et les revues de sprint sont tenus dans le dépôt.
- `RM-02` — Ce qui fait foi est identifiable sans ambiguïté, et une contradiction entre deux sources est tranchée par une règle écrite.
- `RM-03` — Toute évolution d'un artefact est tracée comme une modification de code : auteur, date, revue.
- `RM-04` — Aucune information de projet ne fait autorité en dehors du dépôt.
- `RM-05` — Les exécutions d'agents sont historisées de façon consultable.

## Critères d'acceptation

_La section « Critères d'acceptation » de la source importée indique qu'aucun critère explicite n'a été trouvé. La description en énonce un, repris en `AC-01`. Les suivants déclinent les éléments nommés par la description elle-même ; rien n'a été ajouté au périmètre._

- `AC-01` — Étant donné un membre de l'équipe cherchant une information de projet, quand il l'ouvre depuis le dépôt, alors il la trouve sans recourir à un outil externe. **Satisfait** : `project/` porte le backlog, les décisions, la gouvernance, les comptes rendus et le périmètre produit.
- `AC-02` — Étant donné une story, quand on cherche sa version faisant foi, alors elle est dans le dépôt, versionnée. **Satisfait** : 205 stories importées le 2026-10-03 dans `project/backlog/stories/`.
- `AC-03` — Étant donné deux affirmations contradictoires, quand on cherche laquelle l'emporte, alors une règle écrite le dit. **Satisfait** : `project/governance/source-of-truth.md`.
- `AC-04` — Étant donné un sprint terminé, quand on cherche sa revue, alors elle est dans le dépôt. **Non satisfait** : `project/sprints/` ne contient aujourd'hui qu'un gabarit et un fichier de présentation, aucun sprint.
- `AC-05` — Étant donné une exécution d'agent, quand on cherche sa trace, alors elle est consultable depuis le dépôt. **Non satisfait** : aucun mécanisme d'historisation des exécutions d'agents n'a été relevé.

## Cas limites

- **La clause de complémentarité avec Notion est devenue fausse.** La source de juin 2026 pose le dépôt comme complément d'une base documentaire tenue dans Notion. `project/governance/source-of-truth.md` dit l'inverse depuis le 3 octobre 2026 : « Git est l'unique source officielle du projet. (…) Notion est sorti du jeu et ne sert plus qu'à l'archive de provenance, conservée hors dépôt. » La décision postérieure l'emporte ; la clause de la story est périmée.
- **La migration est documentée et chiffrée** : `project/meetings/reports/2026-10-03-rapport-migration-notion.md` recense 205 stories, 17 epics et 18 regroupements de fonctionnalités créés, avec la méthode d'établissement des statuts et l'empreinte de l'archive d'origine.
- **Ce qui reste à faire tient en deux points** : les revues de sprint et l'historisation des exécutions d'agents. Ni l'un ni l'autre n'est bloqué par la migration ; ils n'ont simplement pas été faits.
- **La notion de « revue de sprint » n'est pas définie** : compte rendu de fin de sprint, rétrospective, état d'avancement ? Les trois existent dans les pratiques du projet, sous des formes différentes.
- **« Historiser les agent runs » n'est pas défini non plus** : s'agit-il des instructions données, des modifications produites, des décisions prises, ou de tout ? La réponse change complètement l'effort — et pose une question de confidentialité que la source n'aborde pas.
- **Un corpus antérieur coexiste** : `_bmad-output/` porte des artefacts de planification et d'implémentation antérieurs à `project/`. La règle de départage est écrite pour les stories (`project/backlog/stories/` remplace les sections fonctionnelles de `_bmad-output/`), pas pour le reste.

## Hors périmètre

- Le socle de plateforme (`US-CORE-01`) et le découpage en dépôts (`US-CORE-02`).
- La base documentaire d'entreprise, hors périmètre de développement.
- Le choix de l'outil de suivi des tâches au jour le jour.
- Les cahiers de tests fonctionnels, dont la reprise n'est pas traitée par cette story.

## Dépendances et décisions

- Aucune dépendance déclarée, aucune relevée.
- `project/governance/source-of-truth.md` — pose Git comme unique source officielle et acte la sortie de Notion au 3 octobre 2026. C'est la décision qui réalise l'essentiel de cette story et qui en périme la dernière clause.
- `project/meetings/reports/2026-10-03-rapport-migration-notion.md` — rend compte de la migration, de ses volumes et de sa méthode.
- `project/governance/workflow.md`, `definition-of-ready.md`, `definition-of-done.md` — formalisent le circuit documentaire que la story appelait sans le décrire.
- La réunion source (WM du 3 juin 2026) n'a pas de compte rendu dans `project/meetings` : l'intention complète n'est pas vérifiable dans le dépôt.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-METH-01.md`

## Questions ouvertes

- **Question principale : comment classer cette story ?** Trois de ses cinq critères sont satisfaits par la migration du 3 octobre 2026 et la mise en place de `project/`. Trois options : la clôturer et ouvrir une story pour le reste ; la conserver en la réduisant aux revues de sprint et à l'historisation des agents ; la marquer `superseded` par la gouvernance mise en place. Le choix appartient à l'autorité produit.
- Son `deliveryStatus: not-started` est contredit par l'état du dépôt. Il a été établi par balayage automatique d'identifiant, qui ne pouvait pas reconnaître une story réalisée par un travail portant un autre nom.
- Qu'appelle-t-on une « revue de sprint », et qui la rédige ? `project/sprints/` attend son premier contenu.
- Qu'historise-t-on d'une exécution d'agent : les instructions, les modifications, les décisions ? Et qu'en fait-on des informations sensibles qui y figureraient ?
- Quelle règle départage `project/` et `_bmad-output/` au-delà des stories ?
- Les cahiers de tests fonctionnels, restés hors du dépôt, relèvent-ils de cette story ou d'une autre ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E9-UNCLASSIFIED` est un regroupement de migration). Le rattachement à l'epic « Multi-tenant & gouvernance » est discutable : cette story relève de la méthode de travail.
- Relecture produit requise : contenu issu d'un import, non approuvé.
