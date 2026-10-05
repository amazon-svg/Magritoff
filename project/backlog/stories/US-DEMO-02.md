---
id: US-DEMO-02
title: Gestion de la latence (~30 s) en démo
epic: EPIC-E3
feature: FEAT-E3-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c81588781c486c1adc909
  url: https://app.notion.com/375d0131973c81588781c486c1adc909
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
  archive: _archives-notion/2026-10-03/pages/US-DEMO-02.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-DEMO-02.md
---

# US-DEMO-02 — Gestion de la latence (~30 s) en démo

> Fait en sorte qu'une démonstration reste convaincante alors que l'interprétation d'une demande prend une trentaine de secondes, au lieu de s'arrêter sur un écran qui ne bouge pas.

## Valeur métier

En démonstration, trente secondes de silence ne se rattrapent pas. L'interlocuteur n'y voit pas une latence technique : il y voit un produit qui ne marche pas, et la suite de la présentation se joue contre cette impression. La latence ne sera pas supprimée d'ici là — elle vient de l'interprétation de la demande, hors du contrôle de Magrit. Ce qui peut l'être, c'est ce que l'écran montre pendant ce temps et la façon dont le scénario occupe ces secondes. C'est l'objet de cette story : elle ne corrige pas une performance, elle protège une première impression.

## Besoin utilisateur

**En tant que** présentateur d'une démonstration Magrit, **je veux** que l'attente d'environ 30 secondes soit occupée et comprise, **afin de** dérouler mon scénario sans que l'interlocuteur conclue à une panne.

_La source Notion formulait une description, pas un besoin utilisateur ; celui-ci la reformule sans y ajouter d'exigence et reste à confirmer en revue produit._

## Comportement attendu

1. Une demande est envoyée pendant la démonstration. Son interprétation prend environ 30 secondes.
2. Un indicateur d'attente est visible pendant toute cette durée : à aucun moment l'écran ne paraît inerte.
3. Le scénario de démonstration se déroule sans rupture : la latence est prévue dans son enchaînement, elle ne l'interrompt pas.

## Expérience utilisateur

- **Trois points mesurables, et ils sont le cœur de la story.** Le retour visuel doit apparaître en moins d'une seconde après l'envoi. Pendant l'attente, quelque chose doit **changer** à l'écran — une animation en boucle ne dit pas la différence entre « ça travaille » et « c'est figé ». Et si la demande échoue au bout de trente secondes, le présentateur doit disposer d'une sortie qui ne soit pas « je recharge la page ».
- L'interlocuteur d'une démonstration ne lit pas un message technique : il lit un produit. Le texte affiché pendant l'attente doit dire ce qui se passe en termes métier.
- Le présentateur doit savoir à l'avance combien de temps l'attente va durer, pour pouvoir parler pendant ce temps. Un indicateur qui ne donne aucun ordre de grandeur ne l'aide pas.
- **La source est muette** sur le contenu de l'indicateur, sur l'existence d'un ordre de grandeur annoncé, et sur ce qui est prévu en cas d'échec pendant la démonstration.

## Règles métier

- `RM-01` — Une latence d'environ 30 secondes sur l'interprétation d'une demande est tenue pour acquise et intégrée au scénario de démonstration. Elle n'est pas traitée comme un incident.
- `RM-02` — Un indicateur d'attente est visible pendant toute la durée de l'interprétation.
- `RM-03` — Le scénario de démonstration reste fluide malgré cette latence : aucune séquence ne suppose une réponse immédiate.

## Critères d'acceptation

- `AC-01` — Étant donné une demande envoyée pendant la démonstration, quand elle part, alors un retour visuel apparaît en moins d'une seconde.
- `AC-02` — Étant donné une interprétation en cours d'environ 30 secondes, quand on observe l'écran à deux instants séparés de plusieurs secondes, alors l'état affiché a évolué : l'indicateur ne se contente pas de tourner.
- `AC-03` — Étant donné le scénario de démonstration joué de bout en bout, quand on le chronomètre, alors aucune de ses séquences ne suppose une réponse en moins de 30 secondes.
- `AC-04` — Étant donné une interprétation qui échoue ou dépasse la durée prévue, quand l'échec survient, alors le présentateur dispose d'une sortie prévue par le scénario, sans rechargement de page (**la source ne dit pas laquelle**).

## Cas limites

- **La latence annoncée est confirmée par une mesure du dépôt.** Une demande large sur le catalogue a été mesurée à 30,9 secondes pour cinq configurations produites. L'ordre de grandeur de la source n'est donc pas une crainte : c'est le comportement nominal sur ce type de demande.
- **Un indicateur d'attente existe déjà, mais il ne satisfait pas `AC-02`.** L'écran de conversation affiche un repère d'activité pendant la génération, et compte les fragments reçus. Comme le serveur n'émet qu'un seul fragment, à la toute fin, ce compteur ne bouge jamais : l'état affiché est strictement constant pendant les trente secondes.
- **Le délai d'abandon du module tiers d'interprétation est de 50 secondes** côté serveur. Une demande à 30 secondes passe, mais la marge est faible : une demande un peu plus lourde que celle du scénario franchit le seuil et la démonstration tombe sur une erreur. Le scénario doit être calibré sur ce plafond, pas seulement sur la moyenne.
- **La story décrit une préparation de démonstration, pas une fonctionnalité produit.** Une part de son contenu — l'enchaînement des séquences, le propos du présentateur pendant l'attente — ne se livre pas dans le code et ne se vérifie pas par un test. Le périmètre logiciel se réduit à l'indicateur ; le reste est un livrable de scénario, qui n'a pas de destinataire identifié dans ce backlog.
- **Recoupement avec `E3.1`.** Ce que la story demande — un indicateur qui évolue pendant une attente longue — est exactement ce que `E3.1` doit produire sur toutes les surfaces. Si `E3.1` aboutit, cette story perd l'essentiel de son contenu logiciel.
- **Démonstration hors ligne ou sur réseau lent.** La source ne dit rien d'un repli — jeu de données préparé, réponse enregistrée — alors que c'est l'usage courant pour une démonstration.

## Hors périmètre

- La réduction de la latence elle-même : elle vient de l'interprétation côté module tiers et ne dépend pas de Magrit.
- L'affichage progressif du descriptif et du prix (`E3.1`), le canal de diffusion (`E3.2`), le déport du chiffrage en arrière-plan (`T06.WM2`).
- Le contenu fonctionnel du scénario de démonstration et les données qu'il utilise.
- Le pont de chiffrage utilisé en démonstration (`US-DEMO-01`).

## Dépendances et décisions

- La source ne déclare aucune dépendance et n'en est déclarée dans aucune autre story. Les recoupements relevés avec `E3.1` et `US-DEMO-01` ne sont pas reportés en frontmatter : la source ne les formule pas.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : les éléments de mise en œuvre serveur hérités de l'import sont périmés et ont été retirés.
- Origine : séance de travail du 03/06/2026, latence d'environ 30 secondes attribuée à l'interprétation côté module Studio.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-US-DEMO-02.md`

## Questions ouvertes

- Cette story reste-t-elle ouverte, ou son contenu logiciel est-il absorbé par `E3.1` ? En l'état, les deux demandent la même chose à la même surface.
- Quelle démonstration précisément, devant qui, et à quelle date ? Une story de préparation sans échéance ni destinataire ne se planifie pas.
- L'indicateur annonce-t-il un ordre de grandeur de l'attente, ou seulement son existence ? C'est ce qui permet au présentateur de parler pendant ce temps.
- Que fait le présentateur si la demande échoue pendant la démonstration ? La source ne prévoit aucune sortie.
- Prévoit-on un repli — jeu de données préparé, réponse enregistrée — pour une démonstration en conditions dégradées ?
- Le scénario est-il calibré sur la marge réelle, sachant que le module d'interprétation abandonne à 50 secondes ?
- Critères d'acceptation absents de la source : ceux qui précèdent reformulent sa seule phrase d'exigence et restent à valider.
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E3-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
