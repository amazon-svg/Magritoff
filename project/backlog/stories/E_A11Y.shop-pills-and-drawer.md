---
id: E_A11Y.shop-pills-and-drawer
title: E_A11Y.shop-pills-and-drawer — aria-pressed pill-all + aria-modal drawer
epic: EPIC-E4
feature: FEAT-E4-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c81bcabc7f86cba835416
  url: https://app.notion.com/35dd0131973c81bcabc7f86cba835416
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P1"
  originalEffort: "XS"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:02:50Z"
  lastEditedAt: "2026-05-11T09:02:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_A11Y.shop-pills-and-drawer.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_A11Y.shop-pills-and-drawer.md
---

# E_A11Y.shop-pills-and-drawer — Le filtre « Tout » et le tiroir panier ne s'annoncent pas correctement

> Rend le filtre « Tout » et le tiroir panier intelligibles à un acheteur qui navigue au lecteur d'écran.

## Valeur métier

Un acheteur qui utilise un lecteur d'écran filtre à l'aveugle : rien ne lui dit si « Tout » est actif ou non, et rien ne lui signale qu'il vient d'entrer dans un panneau modal. Il ne se trompe pas de produit, il perd du temps et finit par appeler. Pour une boutique professionnelle, dont les acheteurs sont des salariés qui commandent dans le cadre de leur travail, l'accessibilité conditionne aussi le référencement de l'outil chez des donneurs d'ordre publics ou de grande taille.

## Défaut constaté

Campagne de tests du 11/05/2026, deux réserves d'accessibilité relevées sur des cas par ailleurs satisfaits.

**Filtre « Tout ».** La pilule « Tout » ne portait aucune indication d'état actif ou inactif, dans aucune de ses situations. Le motif de groupe de bascules attendu veut que cette pilule s'annonce active quand aucune gamme n'est sélectionnée.

**Tiroir panier.** Le tiroir n'annonçait pas sa modalité, bien qu'il se déclare comme boîte de dialogue. Les lecteurs d'écran ne signalaient donc pas à l'acheteur qu'il venait d'entrer dans un panneau qui capture son attention.

Ce que cela coûtait : un acheteur au lecteur d'écran ne sait pas quel filtre est actif, et ne sait pas qu'il est entré dans le panier — deux pertes de repère sur le chemin d'achat le plus court.

## Besoin utilisateur

**En tant qu'**acheteur utilisateur d'un lecteur d'écran, **je veux** que le filtre « Tout » indique son état et que le tiroir panier signale sa modalité, **afin de** naviguer la boutique avec une assistance conforme au niveau AA.

## Comportement attendu

1. La pilule « Tout » annonce son état : active quand aucune gamme n'est sélectionnée, inactive dès qu'une gamme l'est.
2. Le tiroir panier s'annonce comme une boîte de dialogue modale à son ouverture.
3. Ces ajouts ne changent rien au comportement du filtrage ni à celui du tiroir.

## Expérience utilisateur

- Un acheteur qui n'utilise pas de lecteur d'écran ne doit rien voir changer : l'état est déjà signalé visuellement, il s'agit de le rendre lisible par l'assistance.
- À l'ouverture du tiroir, le lecteur d'écran annonce qu'il s'agit d'un panneau, et le focus se place dedans.
- À la fermeture, le focus revient à l'endroit d'où le tiroir a été ouvert.
- **La source est muette** sur le libellé annoncé pour le tiroir et sur le retour du focus à la fermeture.

## Règles métier

- `RM-01` — La pilule « Tout » expose un état de bascule : active quand aucune gamme n'est sélectionnée, inactive sinon.
- `RM-02` — Son état suit exactement l'état visuel : les deux ne peuvent pas diverger.
- `RM-03` — Le tiroir panier est annoncé comme une boîte de dialogue modale.
- `RM-04` — Aucun comportement fonctionnel du filtrage ni du tiroir n'est modifié par ces ajouts.
- `RM-05` — Une vérification automatisée d'accessibilité ne relève aucune violation sur l'état de bascule ni sur la modalité.

## Critères d'acceptation

- `AC-01` — Étant donné une boutique ouverte sans filtre sélectionné, quand on examine la pilule « Tout », alors elle s'annonce comme active.
- `AC-02` — Étant donné une ou deux gammes sélectionnées, quand on examine la pilule « Tout », alors elle s'annonce comme inactive.
- `AC-03` — Étant donné l'ouverture du tiroir panier, quand un lecteur d'écran le rencontre, alors il l'annonce comme une boîte de dialogue modale (**la forme technique exacte est à trancher : voir « Cas limites »**).
- `AC-04` — Étant donné une vérification automatisée d'accessibilité sur la page boutique, quand elle s'exécute, alors elle ne relève aucune violation portant sur l'état de bascule ni sur la modalité.
- `AC-05` — Étant donné ces ajouts, quand on rejoue le filtrage additif par pilules avec sa persistance, puis l'ouverture du tiroir et sa fermeture par la touche d'échappement, alors les comportements sont inchangés.
- `AC-06` — Étant donné le tiroir ouvert puis fermé, quand on observe le focus, alors il entre dans le tiroir à l'ouverture et revient à l'élément d'origine à la fermeture.

## Cas limites

- **Les deux moitiés du défaut n'ont pas le même état.** Les pilules de gammes **individuelles** exposent aujourd'hui leur état de bascule ; la pilule « **Tout** » ne l'expose toujours pas. `RM-01`, `AC-01` et `AC-02` restent entiers.
- **La modalité du tiroir est traitée autrement que ne le demandait la source.** Le tiroir repose désormais sur le composant de panneau latéral de la bibliothèque d'interface, lui-même bâti sur la primitive de boîte de dialogue. Cette primitive pose bien le rôle de boîte de dialogue, mais **n'émet volontairement pas** l'attribut de modalité : elle masque à la place tout le reste de la page aux technologies d'assistance, ce que son code documente comme l'équivalent mieux pris en charge. Exiger littéralement l'attribut de la source reviendrait à contredire la bibliothèque. L'exigence conservée est donc le **résultat** — le tiroir est annoncé comme modal — et non le moyen. Le point reste à trancher.
- **Un contrôle automatisé d'accessibilité peut valider les deux approches.** `AC-04` ne suffit donc pas à départager la forme technique : une vérification au lecteur d'écran réel est nécessaire.
- **Le filtrage par pilules n'est plus le seul chemin.** La boutique propose aussi une barre latérale de gammes et un menu étendu, qui ont leurs propres états de bascule. La cohérence entre ces chemins n'est pas couverte par cette story.

## Hors périmètre

- Le comportement fonctionnel du filtrage et du tiroir panier.
- L'accessibilité des autres chemins de navigation par gammes.
- Le mode sombre de la boutique (`E2.fix-TF55`).
- La confirmation de commande et ses propriétés de modalité (`E_DEVTOOLS.passer-commande-modal`).

## Dépendances et décisions

- La source indique « aucun prérequis bloquant ». Aucune dépendance n'est déclarée en frontmatter, et rien dans la source n'en justifie l'ajout.
- `ADR-2026-10-01-C6` — le retrait du kit d'interface est reporté : la primitive de boîte de dialogue sur laquelle repose le tiroir reste en place à court terme. Le choix technique de modalité à trancher ne sera donc pas invalidé par un changement de kit dans l'immédiat.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : cette story n'a aucune composante serveur, et les éléments de mise en œuvre hérités de l'import ont été retirés.
- La source rattachait la levée des réserves au rejeu de deux cas de test tenus dans Notion. Notion est sorti du jeu le 03/10/2026 : l'emplacement où ces cas sont rejoués reste à désigner.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_A11Y.shop-pills-and-drawer.md`

## Questions ouvertes

- La modalité du tiroir doit-elle être exigée sous la forme littérale demandée par la source, ou sous la forme retenue par la bibliothèque d'interface, qui masque le reste de la page ? La question doit être tranchée avant de pouvoir vérifier `AC-03`.
- Quel niveau d'accessibilité est visé pour la boutique, sur quel référentiel, et qui le contrôle ?
- La vérification se fait-elle par outil automatisé seul, ou par un passage au lecteur d'écran réel ?
- Les autres chemins de navigation par gammes — barre latérale, menu étendu — relèvent-ils de la même exigence, et dans quelle story ?
- Où se rejouent désormais les cas de test fonctionnels, Notion étant sorti du jeu ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E4-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
