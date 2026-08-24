# Règles d'architecture — projet Magrit / Clariprint Data

> **Statut : opposable à tout développement. Chargé à chaque session** (référencé par `CLAUDE.md`).
> Source : session de travail **RP#070826** (Expert Solutions × AGE Dvt., 07/08/2026), Annexe A du CR.
> En attente de validation formelle par Xavier Péchoultres — applicable dès maintenant côté AGE Dvt.

## R1 — API-first (bloquant)

Le front (React / TypeScript) ne communique JAMAIS directement avec la base de données. Toute interaction passe par une couche serveur exposant un contrat d'API explicite et documenté.

- Interdit : requêtes construites côté navigateur, appels directs au stockage, points d'entrée serveur non contractualisés.
- Requis : un contrat d'API par domaine fonctionnel, documenté (OpenAPI ou équivalent), avec typage des entrées et sorties.
- Avant d'écrire un écran, écrire et documenter l'API qui l'alimente.

## R2 — Modularité (bloquant)

Toute fonctionnalité nouvelle est développée comme un module autonome.

- Un module = un périmètre fonctionnel, ses routes, son modèle, ses tests.
- Interdit : disperser du code dans plusieurs zones de l'application pour faire fonctionner une fonctionnalité.
- Interdit : dépendance directe d'un module à l'implémentation interne d'un autre module — le passage se fait par l'API ou par le noyau.
- Motif explicite : au-delà de la maintenabilité, la modularité conditionne la capacité d'un agent à travailler sur le code sans saturer sa fenêtre de contexte.

### R2.1 — Propriété de l’UX métier

- Toute page, tout composant métier, hook de contrôleur ou contexte de présentation appartient à `src/modules/<module>/ui`.
- `src/app` ne contient que le bootstrap, les layouts globaux, les boundaries et la composition des surfaces.
- Les primitives visuelles sans vocabulaire métier appartiennent à `src/shared/ui` et ne dépendent ni de `app`, ni d’un module, ni d’un fournisseur.
- Une UI de module ne dépend jamais de `src/app`, `src/adapters`, Supabase ou d’un autre fournisseur concret.
- Les dépendances inter-modules passent uniquement par une entrée publique du module cible (`modules/<id>`, `modules/<id>/ui` ou une entrée UI catégorisée possédant son `index.ts`). Un leaf explicitement réexporté par `ui/index.ts` peut être ciblé directement lorsqu’un barrel créerait un cycle de chunks ; le test d’architecture vérifie cette publication explicite.
- Les pages déclarées par une contribution de surface sont résolues en lazy depuis l’entrée UI publique du module propriétaire.
- Les runtimes React workspace et storefront restent distincts ; le storefront ne reçoit jamais l’identité ni les clients du workspace.

Ces règles sont bloquées en CI par les tests d’architecture MUX. La baseline de
fichiers métier autorisés sous `src/app/components` est fixée à zéro.

## R3 — Vocabulaire MCP (différé, à ne pas anticiper)

Chaque module exposera un vocabulaire MCP dérivé de son API.

- N'est PAS à implémenter tant que R1 et R2 ne sont pas satisfaites.
- Concevoir les API en gardant cette cible : nommage explicite orienté ressource et action (get / list / create sur des entités métier nommées).

## R4 — Noyau minimal

Les services essentiels (authentification, configuration, accès aux données) vivent dans un noyau léger. Les écrans qui les exposent sont des modules.

- Le noyau reste compatible avec le noyau Magrit existant.
- Aucune logique métier dans le noyau.

## R5 — Souplesse sur l'existant (dérogation encadrée)

Sur du code déjà écrit, ne pas casser le fonctionnement actuel.

- Migration progressive vers R1/R2, au fil des interventions.
- Toute dérogation est explicitée en commentaire et remontée dans le rapport de fin de tâche, avec le chemin de mise en conformité.
- Aucune dérogation n'est admise sur du code nouveau.

## R6 — Workflow Git (bloquant)

- Une branche par fonctionnalité ou évolution. Jamais de développement direct sur le tronc commun.
- Les versions se matérialisent par des tags, pas par des branches.
- Avant tout changement de branche : environnement local propre, aucune modification non commitée.
- Nommage de branche explicite sur le périmètre fonctionnel.

## R7 — Design

- Framework : Tailwind.
- Les composants d'affichage sont mutualisés dans des templates réutilisables. Interdit de réécrire une mise en page d'écran en écran.
- La charte graphique de référence est celle définie au niveau projet (`.design-handoff/` — Magrit v2, tokens `ink`/`paper`/`line`/`brand`) ; ne pas introduire de style ad hoc.

## R8 — Sortie de tâche

À la fin de toute tâche, produire un rapport court indiquant :

1. les modules touchés ;
2. les API créées ou modifiées, avec leur contrat ;
3. les dérogations R5 utilisées et leur chemin de mise en conformité ;
4. les tests exécutés et leur résultat.
