---
id: US-AO-05
title: App « Gestion AO » standalone
epic: EPIC-T08
feature: FEAT-T08-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c8141a77bdc585c3646e1
  url: https://app.notion.com/375d0131973c8141a77bdc585c3646e1
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P1"
  originalEffort: ""
  originalAssignee: "Xavier"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-AO-05.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-AO-05.md
---

# US-AO-05 — App « Gestion AO » standalone

> Fait du module AO une application détachable du cœur de Magrit, installable seule — y compris chez un client comme le Groupe ICI.

## Valeur métier

Un client qui veut traiter ses appels d'offres n'a pas forcément besoin du reste de Magrit, et n'a pas forcément le droit de voir ses données partir ailleurs. Une application AO autonome ouvre deux portes : vendre le module seul à des acteurs qui ne sont pas des imprimeurs, et le déployer chez un client qui exige que la donnée reste chez lui — la source cite explicitement ICI. En contrepartie, l'autonomie se paie : un module qui ne dépend pas du cœur ne profite pas non plus de ses comptes, de ses droits ni de son catalogue.

C'est une exigence d'architecture avant d'être une fonctionnalité. **La source est muette** sur ce que le module conserve du cœur quand il est déployé seul.

## Besoin utilisateur

_Non formulé dans la source Notion._ La source ne dit pas qui demande cette autonomie : le client qui héberge, l'équipe qui vend, ou l'équipe qui développe. Les trois n'attendent pas la même chose.

## Comportement attendu

1. Le module AO est isolable du cœur de Magrit.
2. Il est déployable de façon autonome, y compris dans l'environnement d'un client (cas cité : ICI).
3. Il est activable indépendamment, sans couplage au cœur.

**La source est muette** sur tout le reste : authentification et comptes dans le mode autonome, accès au catalogue et au moteur de chiffrage, mises à jour, reprise des données si le client rebascule vers la version hébergée.

## Expérience utilisateur

- Rien n'est spécifié, et c'est le point à soulever : une application autonome a besoin de sa propre porte d'entrée — connexion, création de compte, premier écran — alors que l'énoncé ne la traite que comme un module détaché.
- L'utilisateur d'un déploiement client doit savoir ce dont il dispose et ce dont il ne dispose pas. Une application amputée du chiffrage ou du catalogue, sans que ce soit dit, est perçue comme une application défaillante.

## Règles métier

- `RM-01` — Le module AO est activable indépendamment du cœur de Magrit.
- `RM-02` — Son activation ne suppose aucun couplage au cœur.
- `RM-03` — Il est déployable dans l'environnement d'un client.

Ces trois règles sont la reformulation de l'unique critère de la source. Aucune autre règle n'est posée ici : il n'y a pas de matière.

## Critères d'acceptation

- `AC-01` — Étant donné un environnement où seul le module AO est installé, quand on l'active, alors il fonctionne sans que le cœur de Magrit soit présent (**la source n'énumère pas les fonctions qui doivent rester disponibles dans ce mode : le critère n'est pas vérifiable en l'état**).
- `AC-02` — Étant donné le module AO déployé chez un client, quand il est utilisé, alors aucune dépendance d'exécution vers le cœur n'est requise (**la source ne dit pas si une dépendance réseau vers un service de chiffrage est admise, ce qui change tout**).

Ces deux critères reprennent la seule exigence de la source — « module activable indépendamment, sans couplage au cœur ». Ils ne sont pas observables tant que le périmètre fonctionnel du mode autonome n'est pas défini. **Aucun critère supplémentaire n'a été inventé.**

## Cas limites

- **Chiffrage.** Le prix vient de Clariprint et du cœur (`T08.N12`, « chiffrage en masse via Magrit Core »). Une application AO sans cœur chiffre-t-elle encore, et comment ?
- **Comptes et droits.** Le cœur administre les tenants, les utilisateurs et les droits (`US-CORE-01`). Le mode autonome les réimplémente-t-il, ou s'y connecte-t-il ?
- **Déploiement chez le client.** La source cite ICI sans préciser s'il s'agit d'un hébergement dédié, d'une installation sur l'infrastructure du client, ou d'un espace isolé dans la plateforme — trois projets très différents.
- **Mises à jour et support** d'une instance installée chez un tiers : non traités.
- **Divergence.** Deux chemins de déploiement, c'est deux fois les tests et un risque permanent d'écart entre les versions.

## Hors périmètre

- Les fonctionnalités du module AO elles-mêmes (`T08.A1` à `T08.A5`, `T08.WM1`, `T08.WM3`, `T08.N1` à `T08.N14`).
- La commercialisation du module en option, qui est un autre moyen d'atteindre un but voisin (`T08.WM4`).
- La construction du socle de plateforme et de la frontière cœur / applications (`US-CORE-01`).

## Dépendances et décisions

- Aucune dépendance déclarée par la source ; le frontmatter reste vide.
- **Recouvrement à signaler.** `US-CORE-01` (socle Magrit Core, architecture « conteneur d'applications ») pose déjà comme critère qu'« une application se greffe sans refonte du noyau » et que la « frontière core ↔ apps » soit documentée. `US-AO-05` est l'application de ce principe au module AO. Si `US-CORE-01` est traitée, `US-AO-05` perd l'essentiel de sa substance et se réduit à une vérification.
- **Recouvrement à signaler.** `T08.WM4` vise aussi à détacher le module AO, mais commercialement (option activable par palier et par compte). Les deux stories doivent être arbitrées ensemble : un interrupteur commercial ne produit pas une application autonome, et une application autonome ne se vend pas toute seule.
- **Ce sujet relève d'une décision d'architecture, pas d'une story.** Tant qu'aucun fichier de `project/decisions/architecture/` ne définit la frontière entre le cœur et les applications ni le mode de déploiement chez un client, cette story ne peut pas être rendue développable. Les décisions du 1er octobre 2026 ne traitent pas ce point.
- Rien dans le dépôt : aucun module AO, et aucune frontière cœur / applications documentée. L'application est aujourd'hui un dépôt unique.
- Référence de provenance conservée : WM#030626, réf. 00:08:52. La source note elle-même « recoupe l'Epic T-08 ».

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-AO-05.md`

## Questions ouvertes

- Que signifie « sans couplage au cœur » : aucun code partagé, aucun appel réseau, ou simplement aucun déploiement conjoint ?
- En mode autonome, que fait l'application pour le chiffrage, le catalogue, les comptes et les droits ?
- « Déployable côté client » : hébergement dédié, installation sur l'infrastructure du client, ou espace isolé dans la plateforme ?
- Qui assure les mises à jour et le support d'une instance installée chez un tiers ?
- Cette story subsiste-t-elle si `US-CORE-01` livre la frontière cœur / applications, ou s'y dissout-elle ?
- Doit-elle devenir une décision d'architecture plutôt qu'une story de backlog ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-T08-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
