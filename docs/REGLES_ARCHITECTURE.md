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

## Contrôles mécaniques obligatoires

Les règles R1 à R4 ne reposent pas uniquement sur la revue humaine :

- `domain`, `application`, `api` et `ui` des nouveaux modules ne peuvent importer ni Supabase ni le client historique `utils/supabase` ;
- une UI dépend d'un port ou client API typé, injecté par une composition root de surface ;
- seuls les adaptateurs `infrastructure` et la composition serveur connaissent le fournisseur de données ;
- `pnpm test:architecture` vérifie ces frontières et doit être un contrôle CI requis ;
- les accès directs brownfield restent une dette R5 : ils ne constituent jamais un exemple autorisé pour du code nouveau.
