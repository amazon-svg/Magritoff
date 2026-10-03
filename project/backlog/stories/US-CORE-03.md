---
id: US-CORE-03
title: CI/CD GitHub Actions & traçabilité des agent runs
epic: EPIC-E7
feature: FEAT-E7-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c8106b12dea8e890862af
  url: https://app.notion.com/375d0131973c8106b12dea8e890862af
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P1"
  originalEffort: ""
  originalAssignee: "Laurent"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-CORE-03.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-CORE-03.md
---

# US-CORE-03 — CI/CD GitHub Actions & traçabilité des agent runs

> Impose qu'aucune modification n'entre dans la branche de référence sans que la chaîne de vérification soit passée au vert, et que chaque travail confié à un agent laisse dans l'historique la demande et le rapport qui l'ont encadré.

**Intention conservée, état partiel.** Le changement d'architecture du 2 octobre 2026 n'invalide pas cette story — elle porte sur la méthode de travail, pas sur le socle technique. Elle est en revanche **partiellement réalisée**, dans des proportions qu'il faut constater avant de la planifier : quatre chaînes d'intégration continue existent, mais **aucune n'exécute la suite de tests unitaires sur une demande de fusion vers `main`**, ce qui est précisément ce que la source demande en premier.

## Valeur métier

Deux risques distincts, qu'une même discipline couvre. Le premier est la régression silencieuse : sans barrière automatique, une anomalie entre dans la branche de référence et c'est la recette manuelle, plusieurs jours plus tard, qui la découvre — au prix d'une enquête. Le second est propre à un projet où une grande partie du code est produite par des agents : sans trace de la demande et du rapport, on hérite de code dont personne ne sait ce qu'il devait faire, ni ce que son auteur a dit avoir vérifié. La traçabilité n'est pas une formalité : c'est ce qui rend le code relisible six mois plus tard.

## Besoin utilisateur

**En tant qu'**équipe de développement, **je veux** qu'une chaîne de vérification automatique conditionne toute fusion et que chaque travail confié à un agent laisse sa demande et son rapport dans l'historique, **afin de** ne pas intégrer de régression et de pouvoir reconstituer après coup ce qui a été demandé et ce qui a été vérifié.

## Comportement attendu

1. Toute demande de fusion vers la branche de référence déclenche la chaîne de vérification.
2. La fusion est impossible tant que la chaîne n'est pas au vert.
3. La chaîne s'exécute aussi sur les publications dans la branche de référence, pour détecter une dérive introduite autrement.
4. Chaque travail confié à un agent laisse dans l'historique la demande initiale et le rapport rendu.
5. L'avancement est séquentiel : une unité de travail n'est pas engagée tant que la précédente n'est pas au vert.

## Expérience utilisateur

Story sans surface utilisateur produit. Son public est l'équipe, et son critère de réussite est le délai de retour : une chaîne qui met trente minutes à répondre est contournée, quelle que soit la règle écrite. Second critère : un échec doit désigner ce qui a échoué sans qu'il faille lire un journal complet.

## Règles métier

- `RM-01` — Aucune fusion vers la branche de référence sans chaîne de vérification au vert. La règle est appliquée par l'outil, pas par la consigne.
- `RM-02` — La chaîne couvre au minimum : contrôle de types, tests unitaires, tests de contrat, règles d'architecture et validation des documents de gouvernance.
- `RM-03` — Chaque travail confié à un agent laisse dans l'historique Git la demande initiale et le rapport rendu.
- `RM-04` — Une unité de travail n'est engagée que lorsque la précédente est au vert.
- `RM-05` — Une chaîne consultative, qui ne bloque pas, est identifiée comme telle et ne compte pas pour `RM-01`.

## Critères d'acceptation

_La source ne porte pas de critères formels : elle énonce deux exigences — « pipeline vert obligatoire avant merge » et « chaque agent run tracé dans Git ». Les critères ci-dessous les déclinent sans rien ajouter d'autre que l'observabilité ; ils restent à valider en revue produit._

- `AC-01` — Étant donné une demande de fusion vers `main`, quand elle est ouverte, alors la chaîne de vérification s'exécute automatiquement.
- `AC-02` — Étant donné une chaîne en échec, quand on tente de fusionner, alors la fusion est refusée par l'outil.
- `AC-03` — Étant donné une modification introduisant une régression couverte par les tests unitaires, quand la demande de fusion est ouverte, alors la chaîne échoue. **Non tenu aujourd'hui** : aucune chaîne n'exécute `pnpm test` sur une demande de fusion vers `main`.
- `AC-04` — Étant donné un travail confié à un agent, quand il est intégré, alors l'historique porte la demande initiale et le rapport rendu, rattachables à la modification.
- `AC-05` — Étant donné une chaîne consultative, quand elle échoue, alors la fusion reste possible et son caractère consultatif est explicite.
- `AC-06` — Étant donné une chaîne de vérification, quand elle s'exécute, alors son délai de retour reste compatible avec un usage à chaque demande de fusion (**seuil non fixé par la source**).

## Cas limites

- **État constaté des chaînes.** Quatre fichiers dans `.github/workflows/` :
  - `architecture.yml` — déclenché sur demande de fusion vers `main` et sur publication dans `main`. Exécute `pnpm typecheck`, `pnpm test:architecture`, `pnpm gen:api:check`, `pnpm test:contract`, un sous-ensemble ciblé de tests, puis un second travail qui lève les conteneurs via `compose.dev.yml`, applique `pnpm db:migrate` et exécute les tests d'intégration PostgreSQL. C'est la chaîne la plus complète.
  - `project-governance.yml` — déclenché sur demande de fusion vers `main`, uniquement si certains chemins sont touchés. Exécute `pnpm project:validate` et `pnpm specs:validate`.
  - `quality-audit.yml` — nommé `quality-audit-advisory` : consultatif par construction.
  - `a11y.yml` — déclenché sur `beta/v5`, **pas sur `main`**. Son déclencheur est resté sur une branche d'intégration antérieure.
- **Le trou principal.** `pnpm test`, la suite unitaire complète, n'est exécutée par aucune chaîne. Seuls des sous-ensembles le sont (`test:architecture`, `test:contract`, un répertoire ciblé). Une régression hors de ces périmètres passe.
- **L'obligation de vert n'est pas vérifiable depuis le dépôt.** `RM-01` suppose une protection de branche configurée du côté de la forge, qui ne se lit pas dans les fichiers versionnés. Ce qui est versionné décrit ce qui s'exécute, pas ce qui bloque.
- **La traçabilité des travaux d'agents existe, sous une autre forme que « dans Git ».** Le dépôt impose un document par story livrée dans `_bmad-output/implementation-artifacts/` (`CLAUDE.md`, « Règle Dev »), et `scripts/audit-governance-artifacts.mjs` inventorie ces artefacts. Ces documents sont versionnés, donc bien dans Git. Ce qui manque, c'est le lien systématique entre une modification et le document qui l'a commandée.
- **La séquentialité ne s'automatise pas.** « Story N+1 non démarrée tant que N n'est pas au propre » est une règle de conduite, pas un contrôle. Elle peut s'inscrire dans la définition de terminé, pas dans une chaîne d'intégration.
- **Un dispositif local existe aussi.** `scripts/install-git-hooks.sh` installe un hook `post-checkout` géré par le dépôt. Il n'intervient pas dans la vérification avant fusion.

## Hors périmètre

- Le déploiement automatisé : la source parle de tests à chaque publication, pas de livraison continue. Rien ne décrit d'environnement cible.
- La supervision de la production (`E7.3`).
- Le jeu de données de recette (`E7.8`) et l'instrumentation de l'interface (`E7.7`).
- Le choix de la forge d'intégration continue, déjà acté de fait par l'existence des chaînes.

## Dépendances et décisions

- `ADR-2026-10-01-C2` — le socle local en conteneurs est déjà employé par la chaîne `architecture.yml`, qui lève PostgreSQL et le stockage objet avant d'exécuter les tests d'intégration. Les tests d'intégration sont donc exécutables en chaîne, ce qui n'allait pas de soi.
- `ADR-2026-10-01-C4` — le contrôle du contrat d'API (`gen:api:check`, `test:contract`) est déjà dans la chaîne ; c'est la garantie que le contrat et le code ne divergent pas.
- `docs/CONVENTION_GIT.md` — définit le rôle des branches. Le déclencheur de `a11y.yml` sur `beta/v5` doit être confronté à cette convention.
- `project/governance/definition-of-done.md` — destinataire naturel des règles `RM-03` et `RM-04`, qui relèvent de la conduite plus que de l'outil.
- Aucune dépendance de story n'est citée par la source ; le frontmatter n'est pas modifié.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-CORE-03.md`

## Questions ouvertes

- Le statut `not-started` est-il juste ? Quatre chaînes existent et couvrent déjà une bonne part de `RM-02`. La story est partiellement réalisée ; faut-il la redécouper entre ce qui est acquis et ce qui manque ?
- **La suite unitaire complète doit-elle être exécutée sur demande de fusion vers `main` ?** C'est le principal écart constaté. Si oui, à quel coût de durée ?
- La protection de branche est-elle effectivement configurée sur la forge ? Elle ne se lit pas dans le dépôt, et sans elle `RM-01` n'est qu'une intention.
- `a11y.yml` se déclenche sur `beta/v5` et non sur `main`. Déclencheur à corriger, ou chaîne à retirer ?
- Que recouvre exactement « tracer un agent run dans Git » : le document de story déjà imposé, une mention dans le message de validation, un fichier par exécution ? La source ne le dit pas.
- La règle de séquentialité relève-t-elle de la définition de terminé plutôt que de cette story ?
- Quel délai de retour maximal accepte-t-on pour la chaîne ? Au-delà, elle sera contournée.
- Critères d'acceptation absents de la source ; ceux proposés ici sont à valider.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E7-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
