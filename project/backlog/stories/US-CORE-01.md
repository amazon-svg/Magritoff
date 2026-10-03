---
id: US-CORE-01
title: Socle Magrit Core (plateforme de service)
epic: EPIC-E9
feature: FEAT-E9-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c81a8a8caebcc8d85c450
  url: https://app.notion.com/375d0131973c81a8a8caebcc8d85c450
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
  archive: _archives-notion/2026-10-03/pages/US-CORE-01.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-CORE-01.md
---

# US-CORE-01 — Socle Magrit Core (plateforme de service)

> Pose Magrit comme un socle sur lequel des applications se greffent, pour qu'une nouvelle application ne demande pas de rouvrir le cœur du produit.

## Valeur métier

Magrit ne se résume plus à un configurateur : s'y ajoutent une gestion commerciale, un catalogue produit, un gestionnaire de médias, des briques de production. Si chacune se construit en modifiant le cœur, chaque ajout ralentit le suivant et chaque équipe attend les autres. Un socle qui porte une fois pour toutes les espaces, les utilisateurs, les droits et les données partagées permet d'ouvrir plusieurs chantiers en parallèle sans qu'ils se gênent — et de faire entrer un partenaire sur une application sans lui ouvrir le reste.

## Besoin utilisateur

**En tant qu'**équipe produit et technique, **nous voulons** un socle de plateforme portant l'administration des espaces, des utilisateurs et des droits, un mécanisme d'événements, les données partagées entre applications et un moyen d'installer une application, **afin qu'**une nouvelle application se greffe sans refonte du noyau.

_Source : réunion de travail du 3 juin 2026 (WM#030626, repère 00:11:48), architecture dite « conteneur d'applications »._

## Comportement attendu

_La source décrit un socle par la liste de ce qu'il porte, sans décrire de comportement observable. Les points ci-dessous sont repris d'elle, sans ajout._

1. Le socle porte l'administration des espaces.
2. Le socle porte l'administration des utilisateurs et de leurs droits.
3. Le socle porte un mécanisme d'événements entre applications.
4. Le socle porte les données partagées entre applications.
5. Le socle porte un moyen d'installer une application.
6. La frontière entre le socle et les applications est documentée.

## Expérience utilisateur

- L'« utilisateur » de cette story est une équipe qui livre une application : son expérience se mesure à ce qu'elle n'a **pas** à faire — pas de modification du cœur, pas de coordination avec les autres équipes pour livrer.
- Pour l'utilisateur final, la greffe d'une application doit être invisible : même entrée, même identité, mêmes droits.
- **La source est muette** sur toute interface : rien n'est décidé sur l'écran d'installation d'une application, sur la visibilité des applications installées, ni sur ce que voit un utilisateur dont l'espace n'a pas souscrit à une application.

## Règles métier

- `RM-01` — Livrer une application ne demande aucune modification du socle.
- `RM-02` — La frontière entre le socle et les applications est écrite et consultable.
- `RM-03` — L'administration des espaces, des utilisateurs et des droits appartient au socle, jamais à une application.
- `RM-04` — Une application ne lit ni n'écrit les données d'un espace auquel l'utilisateur n'a pas accès : l'invariant d'étanchéité est porté par le socle et s'applique à toute application greffée.
- `RM-05` — Les données partagées entre applications ont un propriétaire unique : le socle.

## Critères d'acceptation

_La section « Critères d'acceptation » de la source importée indique qu'aucun critère explicite n'a été trouvé. C'est inexact : la description de la source en énonce deux, repris ci-dessous. Ni l'un ni l'autre n'est observable en l'état — ils sont conservés tels que la source les formule, assortis de ce qui manque pour les rendre vérifiables._

- `AC-01` — Étant donné une nouvelle application, quand elle est livrée, alors aucune modification du socle n'a été nécessaire. **Non vérifiable en l'état** : il faut nommer l'application témoin et définir ce qui compte comme « modification du socle ».
- `AC-02` — Étant donné la documentation du projet, quand on y cherche la frontière entre le socle et les applications, alors elle y figure. **Non vérifiable en l'état** : il faut dire quel document porte cette frontière et ce qu'il doit contenir au minimum.

## Cas limites

- **Une partie de l'intention est déjà en place, sous une autre forme.** Le dépôt porte un registre de modules et de surfaces : chaque module déclare son manifeste et ses contributions, et un registre central les assemble (`src/surfaces/application-registry.ts`, `src/surfaces/registry`, `src/modules/*/manifest.ts`, `src/modules/*/surface-contributions.ts`), pour 39 modules et quatre surfaces — espace de travail, back-office, boutique, portail client. C'est un mécanisme de greffe, à l'intérieur d'une même application. Ce n'est pas le « conteneur d'applications » décrit par la source, mais la frontière existe déjà en partie, et toute réécriture doit partir de là.
- **Le mécanisme d'événements demandé n'est pas celui qui existe.** Le dépôt porte une file d'événements transactionnelle destinée aux traitements différés (`infra/postgres/migrations/0016_outbox_events.sql`). Ce n'est pas un bus d'événements entre applications. Les deux ne doivent pas être confondus.
- **Aucun moyen d'installer une application n'a été relevé** : les modules sont déclarés à la construction, pas installés à l'exécution.
- **« Frontière documentée » n'a pas de destinataire désigné** : s'agit-il d'un document d'architecture, d'un contrat technique vérifié automatiquement, ou des deux ?
- **La story n'a pas de périmètre borné.** Telle qu'elle est écrite, elle recouvre l'administration des espaces, celle des utilisateurs, les droits, les événements, les données partagées et l'installation — c'est-à-dire plusieurs chantiers. Elle ne peut pas être planifiée comme une story.

## Hors périmètre

- Le découpage du code en plusieurs dépôts (`US-CORE-02`).
- Les applications elles-mêmes et leurs fonctionnalités.
- La centralisation de la documentation et des sprints (`US-METH-01`).
- Le modèle de droits lui-même, porté par les stories de l'epic.

## Dépendances et décisions

- Aucune dépendance déclarée, aucune relevée dans la source.
- `US-CORE-02` traite du corollaire d'organisation du code ; les deux ont été formulées dans la même réunion.
- `ADR-2026-10-01-C4` — les échanges applicatifs reposent sur un contrat d'API unique. C'est un élément de la frontière que cette story demande de documenter.
- `ADR-2026-10-01-C1`, `ADR-2026-10-01-C2`, `ADR-2026-10-01-C5` — l'architecture a changé de socle technique depuis la formulation de cette story en juin 2026 : toute réécriture doit partir de l'état actuel, pas de celui de l'époque.
- La réunion source (WM du 3 juin 2026) n'a pas de compte rendu dans `project/meetings` : la seule trace est le renvoi à un repère temporel d'enregistrement. L'intention complète n'est pas vérifiable dans le dépôt.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-CORE-01.md`

## Questions ouvertes

- Cette story est-elle une story, ou une intention d'architecture ? En l'état elle recouvre plusieurs chantiers et ne peut pas être planifiée. Faut-il la convertir en décision d'architecture, puis en tirer des stories bornées ?
- Le registre de modules et de surfaces déjà en place est-il la réponse, un point de départ, ou une impasse au regard de l'intention « conteneur d'applications » ?
- Qu'appelle-t-on une « application » : un module du dépôt actuel, un produit vendu séparément, un composant déployé à part ?
- Le mécanisme d'événements demandé est-il un bus entre applications, ou la file transactionnelle existante suffit-elle ?
- Quelles sont les « données partagées inter-apps », nommément ?
- L'installation d'une application se fait-elle à l'exécution, pour un espace donné, ou à la construction du produit ?
- Quel document porte la frontière socle / applications, et que doit-il contenir pour que `AC-02` soit vérifiable ?
- La réunion source du 3 juin 2026 n'a pas de compte rendu dans le dépôt. Peut-il y être versé ?
- Critères d'acceptation à réécrire : les deux de la source ne sont pas observables.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E9-UNCLASSIFIED` est un regroupement de migration). Le rattachement à l'epic « Multi-tenant & gouvernance » est lui-même discutable : cette story relève de l'architecture de la plateforme.
- Relecture produit requise : contenu issu d'un import, non approuvé.
