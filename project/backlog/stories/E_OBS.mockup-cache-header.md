---
id: E_OBS.mockup-cache-header
title: E_OBS.mockup-cache-header — X-Mockup-Cache CORS-expose ou tracing
epic: EPIC-E7
feature: FEAT-E7-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c81bab635cb10028825be
  url: https://app.notion.com/35dd0131973c81bab635cb10028825be
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P2"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:07:36Z"
  lastEditedAt: "2026-05-11T09:07:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_OBS.mockup-cache-header.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_OBS.mockup-cache-header.md
---

# E_OBS.mockup-cache-header — X-Mockup-Cache CORS-expose ou tracing

> Visait à rendre visible depuis le navigateur l'en-tête indiquant si une prévisualisation produit sortait du cache, pour mesurer le taux de réutilisation sans passer par un outil en ligne de commande.

**Story très probablement caduque — à passer en `deprecated`, avec un reste à vérifier.** Le défaut observé le 11 mai 2026 était l'un ou l'autre de deux cas : soit la fonction Edge n'émettait pas l'en-tête, soit elle ne l'exposait pas à la lecture inter-origine. Le générateur de prévisualisations a depuis été réécrit, et les deux causes ont disparu avec lui.

- **La fonction Edge visée n'existe plus.** Le périmètre déclaré par la source est `supabase/functions/mockup-generator/index.ts`. `ADR-2026-10-01-C1` supprime les fonctions Edge et **il n'existe plus de dossier `supabase/` dans le dépôt**.
- **L'en-tête est désormais émis.** `src/server/api/mockup-routes.ts` le pose sur les deux issues du rendu : `X-Mockup-Cache: HIT` sur la redirection vers l'objet déjà stocké, et `MISS` ou `MISS-NO-CACHE` sur le rendu effectif selon que le dépôt dans le stockage objet a réussi ou non.
- **Le volet « exposition inter-origine » est sans objet.** Le service applicatif n'émet aucun en-tête `Access-Control-*` et n'en a pas besoin : l'interface appelle `/api/v1` en même origine, par le relais de développement déclaré dans `vite.config.ts`. Il n'y a plus de barrière inter-origine à lever.
- **Le comportement est couvert par un test automatisé.** `tests/integration/postgres-mockup-routes.test.ts` vérifie `MISS` au premier rendu puis `HIT` au second — c'est-à-dire exactement l'enchaînement demandé par le troisième critère de la source.

**Ce qui n'est pas vérifié.** Deux points subsistent, trop minces pour justifier une story à eux seuls mais à ne pas perdre : la quatrième valeur annoncée, `FALLBACK`, **n'est émise nulle part** dans le code actuel ; et la route de service de l'objet déjà stocké ne pose aucun en-tête de cache, si bien qu'un `HIT` suivi de sa redirection se termine sur une réponse muette.

## Valeur métier

Historique, et modeste — la source la classait elle-même en priorité basse et « pas bloquant démo ». La valeur recherchée était de pouvoir mesurer le taux de réutilisation du cache de prévisualisations sans outil séparé, au service d'un objectif de temps de réponse. Cette mesure relève désormais de la supervision générale (`E7.3`), pas d'un correctif ponctuel sur un en-tête.

## Besoin utilisateur

**En tant qu'**exploitant, **je voulais** lire l'en-tête de cache des prévisualisations depuis le navigateur, **afin de** mesurer le rapport entre réutilisations et rendus sans canal de diagnostic séparé. Le besoin est satisfait par la réécriture, à la réserve près des deux points non vérifiés ci-dessus.

## Comportement attendu

Pour mémoire, le comportement aujourd'hui en place :

1. Une demande de rendu dont l'objet existe déjà en stockage répond par une redirection portant `X-Mockup-Cache: HIT`.
2. Une demande dont l'objet n'existe pas déclenche le rendu et répond avec l'image, portant `MISS` si l'objet a pu être déposé, `MISS-NO-CACHE` sinon.
3. La route servant l'objet stocké renvoie l'image avec son type et sa directive de cache, **sans en-tête de cache applicatif**.
4. Aucune valeur `FALLBACK` n'est produite.

## Expérience utilisateur

Story sans surface utilisateur : l'en-tête n'est lu que par l'exploitation et les outils de diagnostic. Rien de visible ne change pour l'utilisateur d'une boutique ou de l'atelier.

## Règles métier

- `RM-01` — *(satisfaite)* Toute réponse de rendu de prévisualisation indique si elle provient du cache.
- `RM-02` — *(satisfaite)* L'indication est lisible par le client qui a émis la demande, sans canal de diagnostic séparé.
- `RM-03` — *(non vérifiée)* L'ensemble des valeurs annoncées est effectivement produit, ou la liste annoncée est corrigée. `FALLBACK` n'est émis nulle part.
- `RM-04` — *(non tenue)* La route servant un objet déjà stocké indique elle aussi l'origine de la réponse.

## Critères d'acceptation

_Les critères de la source visent un point d'entrée `/functions/v1/mockup-generator`, un diagnostic comparant une requête en ligne de commande à une requête du navigateur, et la reprise d'un cas de test hébergé dans Notion. **Ce point d'entrée n'existe plus** et la question inter-origine est sans objet. Ces critères ne sont pas réécrits : la story est proposée au retrait._

Deux constats tiennent lieu de vérification de l'état actuel :

- `AC-01` — Étant donné une demande de rendu dont l'objet n'est pas en cache, quand la réponse arrive, alors elle porte `X-Mockup-Cache: MISS` ; étant donné la même demande rejouée, alors elle porte `HIT`. **Constaté et couvert** par `tests/integration/postgres-mockup-routes.test.ts`.
- `AC-02` — Étant donné la liste de valeurs annoncée par la source (`MISS`, `HIT`, `MISS-NO-CACHE`, `FALLBACK`), quand on l'éprouve contre le code, alors les trois premières sont produites et la quatrième ne l'est pas. **Écart constaté**, à trancher : implémenter la valeur ou corriger la liste.

## Cas limites

- **La redirection peut masquer l'en-tête.** Sur un `HIT`, la réponse utile pour l'exploitation est la redirection, pas la réponse finale. Un client qui suit automatiquement la redirection ne verra que la réponse de la route de service, qui ne porte aucun en-tête de cache. La mesure est donc possible en diagnostic, mais pas en observation passive du trafic.
- **`MISS-NO-CACHE` signale une panne silencieuse.** Cette valeur est émise quand le dépôt dans le stockage objet échoue : l'utilisateur reçoit bien son image, mais chaque demande suivante la recalculera. C'est une dégradation durable que rien n'alerte aujourd'hui — l'échec est seulement écrit dans la console du serveur. C'est le seul enjeu d'exploitation réel qui subsiste dans cette story.
- **Le cas d'origine n'est plus rejouable.** Le cas de recette visé par la source portait sur cinq modèles de prévisualisation, dans une base Notion qui n'est plus source de vérité.
- **La table d'événements de cache est hors périmètre.** La source l'exclut déjà. Si le besoin de mesurer le taux de réutilisation revient, il relève de la supervision (`E7.3`), pas d'une table dédiée.

## Hors périmètre

- La mesure du taux de réutilisation du cache dans la durée, qui relève de `E7.3`.
- L'objectif de temps de réponse sur une réutilisation, cité par la source sans être une exigence de cette story.
- Le rendu des prévisualisations lui-même et ses modèles.
- Toute table d'événements de cache, explicitement exclue par la source.

## Dépendances et décisions

- `ADR-2026-10-01-C1` — plus de fonctions Edge : le périmètre déclaré par la source n'existe plus, le code concerné est désormais `src/server/api/mockup-routes.ts`.
- `ADR-2026-10-01-C2` — le stockage objet local est un service compatible S3 en conteneur ; c'est son indisponibilité qui produit `MISS-NO-CACHE`.
- `ADR-2026-10-01-C4` — les routes de prévisualisation sont servies sous `/api/v1`, en même origine que l'interface.
- `E7.3` — supervision technique : destinataire naturel du besoin de mesure résiduel.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

Le dépôt porte en revanche une vérification automatisée du comportement visé : `tests/integration/postgres-mockup-routes.test.ts`.

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_OBS.mockup-cache-header.md`

## Questions ouvertes

- **Question principale : cette story passe-t-elle en `deprecated` ?** Son objet — un en-tête absent ou non exposé par une fonction Edge — a disparu avec la réécriture, et le comportement visé est couvert par un test. Le `specStatus` n'est pas modifié ici.
- La valeur `FALLBACK` doit-elle être implémentée, ou la liste annoncée corrigée à trois valeurs ? Laisser une valeur documentée mais jamais émise induit en erreur quiconque interprétera l'en-tête.
- Un échec de dépôt dans le stockage objet, aujourd'hui signalé par `MISS-NO-CACHE` et une ligne de console, mérite-t-il une alerte ? C'est une dégradation durable que personne ne verra. Si oui, cela relève de `E7.3`.
- La route servant un objet déjà stocké doit-elle elle aussi porter un en-tête de cache, pour que la mesure soit possible en observation passive ?
- Le besoin de mesurer le taux de réutilisation est-il explicitement versé dans `E7.3` avant le retrait de cette story ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E7-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
