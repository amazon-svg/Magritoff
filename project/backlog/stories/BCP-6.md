---
id: BCP-6
title: BCP-6 — Console propre sur la boutique
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: implemented
owner: unassigned
source:
  system: notion
  pageId: 3ddd0131973c81a0a4ede72e0b1cceb0
  url: https://app.notion.com/3ddd0131973c81a0a4ede72e0b1cceb0
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P2"
  originalEffort: "M"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: ""
  originalSources: ""
  createdAt: "2026-09-16 06:01:58Z"
  lastEditedAt: "2026-09-16T06:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/BCP-6.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-6.md
  - _bmad-output/implementation-artifacts/story-BCP-6b.md
---

# BCP-6 — Console propre sur la boutique

> Supprime les avertissements que la boutique émettait à chaque rendu et donne une description accessible aux fenêtres et tiroirs, pour que la console redevienne un instrument de détection.

## Valeur métier

Une console saturée d'avertissements permanents ne sert plus à rien : le vrai défaut, le jour où il apparaît, se noie dans le bruit et personne ne le voit. C'est exactement ce qui s'est produit sur la boucle d'appels de `BCP-6b`, mesurée en navigateur et invisible pour les tests. Le second volet, les descriptions manquantes sur les fenêtres et les tiroirs, n'est pas cosmétique : sans elles, un acheteur au lecteur d'écran entend une fenêtre s'ouvrir sans savoir ce qu'elle contient.

## Défaut constaté

La boutique émettait des avertissements à chaque rendu, sur deux familles :

1. Dix primitives d'interface ne transmettaient pas correctement la référence que le composant parent leur passait.
2. Les fenêtres et les tiroirs étaient ouverts sans description accessible.

## Besoin utilisateur

**En tant que** développeur de l'équipe **et** acheteur utilisant un lecteur d'écran, **je veux** une boutique qui n'émette aucun avertissement et dont chaque fenêtre s'annonce, **afin de** voir les vrais défauts et de comprendre ce qui vient de s'ouvrir.

## Comportement attendu

1. Le parcours d'un acheteur sur la boutique n'émet plus d'avertissement attribuable à ces deux familles.
2. Les primitives d'interface concernées transmettent la référence reçue.
3. Toute fenêtre et tout tiroir de la boutique portent une description accessible, annoncée à l'ouverture.
4. Une vérification automatique empêche de réintroduire une fenêtre sans description.
5. Les avertissements résiduels, mineurs et antérieurs à ce lot, restent hors de ce périmètre et sont assumés comme tels.

## Expérience utilisateur

- Pour l'acheteur voyant, rien ne change à l'écran : c'est la condition de recette du lot.
- Pour l'acheteur au lecteur d'écran, l'ouverture d'une fenêtre ou d'un tiroir est suivie d'une description de son objet, et non d'un silence.
- **La source est muette** sur le texte de chaque description : seul le fait qu'elle existe est exigé.
- Effet de bord assumé : le passage de la fiche produit à une description de panneau latéral a modifié la hauteur de ligne de son sous-titre. Ce défaut est traité par `BCP-5/6-fix`.

## Règles métier

- `RM-01` — Un parcours d'acheteur sur la boutique n'émet aucun avertissement de console attribuable aux deux familles traitées.
- `RM-02` — Une primitive d'interface de la boutique transmet la référence que son parent lui passe.
- `RM-03` — Une fenêtre ou un tiroir de la boutique porte une description accessible ; une fenêtre sans description est un défaut.
- `RM-04` — Cette règle est tenue par une vérification automatique, pas par la relecture.
- `RM-05` — Un correctif d'accessibilité ne modifie pas ce que voit l'acheteur voyant.

## Critères d'acceptation

- `AC-01` — Étant donné un parcours d'acheteur sur la boutique (accueil, catalogue, fiche produit, panier, historique), quand on observe la console du navigateur, alors aucun avertissement des deux familles traitées n'apparaît.
- `AC-02` — Étant donné une fenêtre ou un tiroir de la boutique, quand il s'ouvre avec un lecteur d'écran actif, alors une description de son objet est annoncée.
- `AC-03` — Étant donné une nouvelle fenêtre ajoutée à la boutique sans description, quand la vérification automatique s'exécute, alors elle échoue.
- `AC-04` — Étant donné les écrans touchés, quand on les compare à l'état antérieur, alors le rendu visible est inchangé — à l'exception du sous-titre de la fiche produit, dont la régression relève de `BCP-5/6-fix`.

## Cas limites

- **Avertissements résiduels.** Le contrôle navigateur du 16/09 relève des signalements mineurs et antérieurs, sans rapport avec ce lot. La source ne les énumère pas et ne dit pas s'ils doivent être traités : ils ne sont ni corrigés, ni inventoriés ici.
- **Portée de la garde.** La vérification couvre la boutique. La source ne dit pas si l'atelier est soumis à la même exigence.
- **Garde textuelle.** `tests/architecture/storefront-dialog-description.test.ts` et son module de garde lisent le texte du code source. Cette famille de vérification attrape la régression accidentelle, pas un contournement délibéré (voir `FIX-GARDE`).
- **Une description vide ou générique** satisferait la lettre de la règle sans en servir l'intention. La source ne pose aucune exigence de qualité sur le texte.

## Hors périmètre

- Les avertissements de l'atelier.
- Les signalements mineurs antérieurs à ce lot.
- Les appels périodiques de la boutique, traités par `BCP-6b`.
- La hauteur de ligne du sous-titre de la fiche produit, traitée par `BCP-5/6-fix`.

## Dépendances et décisions

- `BCP-5/6-fix` — corrige la régression de mise en page introduite par ce lot sur la fiche produit.
- Le dépôt ne dispose d'aucune bibliothèque de test de rendu, ce qui contraint les gardes à lire le texte du code source. Ce point est porté à l'arbitrage dans `Q-ARBITRAGES`.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: implemented` — 1 fichier de code · 4 fichiers de test · 11 commits git · 2 story documents BMAD avec signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-6.md`
- `_bmad-output/implementation-artifacts/story-BCP-6b.md`

Fichiers de code :

- `src/modules/catalog/ui/storefront/ProductOverlay.helpers.ts`

Fichiers de test :

- `tests/architecture/radix-ref-forwarding.test.ts`
- `tests/architecture/storefront-dialog-description-guard.ts`
- `tests/architecture/storefront-dialog-description.test.ts`
- `tests/components/shop/ProductOverlay.sheetDescriptionStyle.test.ts`

Commits : `baac0a30`, `5eef05a8`, `1218e74d`, `6bb6870f`, `8d4348ee`

## Questions ouvertes

- Les avertissements résiduels mineurs doivent-ils être inventoriés et traités, ou acceptés durablement ? Sans inventaire, « console propre » n'est pas vérifiable dans la durée.
- L'exigence « zéro avertissement » s'étend-elle à l'atelier, ou reste-t-elle propre à la boutique ?
- Quelle exigence de qualité s'applique au texte d'une description de fenêtre, au-delà de sa simple présence ?
- Le seul fichier de code relevé par le balayage concerne la régression du sous-titre ; les corrections de primitives ne sont rattachées à aucun fichier. Quel est le périmètre réel livré ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
