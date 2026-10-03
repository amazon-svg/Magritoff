---
id: BCP-5/6-fix
title: Correctif post-recette — conflits de commande et fiche produit
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: contradictory
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 3ddd0131973c81bf8d29d0e6f7a9890e
  url: https://app.notion.com/3ddd0131973c81bf8d29d0e6f7a9890e
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P1"
  originalEffort: "M"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: ""
  originalSources: ""
  createdAt: "2026-09-16 06:01:58Z"
  lastEditedAt: "2026-09-16T06:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/BCP-5_6-fix.md
decisions: []
dependencies:
  - BCP-5
  - BCP-6
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-5_6-fix.md
---

# Correctif post-recette — conflits de commande et fiche produit

> Remplace le texte technique affiché à l'acheteur quand deux écrans agissent sur la même commande en même temps, et rétablit la mise en page du sous-titre de la fiche produit.

## Valeur métier

Quand l'atelier valide une commande à la seconde où l'acheteur l'annule, l'un des deux reçoit un refus. Ce refus est normal ; ce qui ne l'est pas, c'est qu'il s'affiche sous forme de code technique avec un identifiant interne. L'acheteur ne comprend rien, croit à une panne, et appelle. Pire : si la liste ne se recharge pas après le refus, il continue d'agir sur un état périmé et déclenche le même conflit en boucle. Le défaut de mise en page du sous-titre, lui, coûte simplement une fiche produit qui a l'air bâclée au moment de configurer.

## Défaut constaté

1. **Conflit entre deux écrans.** Si l'atelier valide une commande pendant que l'acheteur l'annule, un texte technique brut s'affichait, identifiant interne compris. Et la liste n'était rechargée qu'après un succès, pas après un échec : l'écran restait sur un état que le serveur avait déjà dépassé.
2. **Mise en page de la fiche produit.** Le sous-titre du configurateur avait perdu sa hauteur de ligne en devenant une description de panneau latéral lors du lot BCP-6.

## Besoin utilisateur

**En tant qu'**acheteur de boutique comme membre de l'atelier, **je veux** comprendre pourquoi mon action a été refusée et voir aussitôt l'état réel de la commande, **afin de** ne pas répéter une action devenue impossible.

## Comportement attendu

1. Le message affiché après un refus est choisi d'après le **code d'erreur métier** renvoyé par le serveur, et non d'après le texte de ce refus.
2. Aucun identifiant technique, aucun code et aucun libellé interne n'apparaît à l'écran, quelle que soit l'erreur — y compris les refus pour commande introuvable et pour droits insuffisants.
3. Un code de refus inattendu n'est jamais requalifié en conflit d'état : il produit un message générique, pas un message faux.
4. La liste des commandes est rechargée après un échec comme après un succès, une seule fois.
5. Aucun message de succès n'est affiché quand l'action a échoué.
6. Le sous-titre de la fiche produit retrouve la hauteur de ligne qu'il avait avant le lot BCP-6.

## Expérience utilisateur

- Le message dit ce qui s'est passé et ce qu'il faut faire : la commande a changé d'état ailleurs, rechargez.
- L'écran se remet à jour tout seul après le refus : l'utilisateur n'a pas à deviner qu'il doit recharger.
- La correction de mise en page est invisible en tant que telle : elle rétablit simplement l'alignement attendu, sans toucher au composant partagé qu'utilisent le panier et les autres fenêtres.
- **La source est muette** sur les textes exacts des messages et sur le fait de rendre l'action réessayable d'un clic après le rechargement.

## Règles métier

- `RM-01` — La classification d'un refus se fait sur le code d'erreur métier porté par la réponse, jamais sur le texte du refus.
- `RM-02` — Quand un code est présent, il tranche seul : aucun repli sur le texte n'est admis, pour qu'un refus d'une autre nature ne soit pas requalifié en conflit d'état.
- `RM-03` — Aucun contenu technique (identifiant, code, libellé interne) n'atteint l'écran d'un utilisateur.
- `RM-04` — Après une action refusée, la liste est rechargée exactement une fois.
- `RM-05` — Un échec ne produit jamais de message de succès.
- `RM-06` — La classification est écrite à un seul endroit, partagée par les parcours d'annulation et de validation.

## Critères d'acceptation

- `AC-01` — Étant donné une commande que l'atelier valide pendant que l'acheteur l'annule, quand l'acheteur reçoit le refus, alors le message est en langage courant et ne contient ni identifiant ni code.
- `AC-02` — Étant donné le sens inverse (l'acheteur annule pendant que l'atelier valide), quand l'atelier reçoit le refus, alors le comportement est le même : message lisible, aucun contenu technique.
- `AC-03` — Étant donné un refus pour commande introuvable, puis un refus pour droits insuffisants, quand chacun s'affiche, alors aucun des deux ne laisse apparaître de texte technique.
- `AC-04` — Étant donné un refus dont le code n'est pas un conflit d'état mais dont le texte y ressemble, quand le message est choisi, alors il n'est pas présenté comme un conflit d'état.
- `AC-05` — Étant donné une action refusée, quand l'écran se remet à jour, alors la liste est rechargée une seule fois et aucun message de succès n'est affiché.
- `AC-06` — Étant donné la fiche produit ouverte, quand on compare son sous-titre à l'état antérieur au lot BCP-6, alors la hauteur de ligne est identique et le composant partagé n'a pas été modifié.

## Cas limites

- **Repli sur le texte quand aucun code n'est fourni.** Le dépôt applique `RM-01` et `RM-02` en préférant le code, mais retombe sur une reconnaissance par le texte lorsque la réponse ne porte **aucun** code (`src/modules/orders/ui/storefront/orderTransitionErrors.helpers.ts`). Le comportement est donc « code d'abord », pas « code seulement ». La source écrit « et non d'après son texte » sans réserve : l'écart doit être arbitré, pas laissé implicite.
- **Un refus pour lequel aucun message n'est prévu** : le dépôt retombe sur un message générique préfixé du texte de l'erreur. Ce texte vient du serveur et peut être technique — la règle `RM-03` n'est donc tenue que pour les codes classés.
- **Session expirée pendant l'action** : traitée à part du conflit, avec une invitation à se reconnecter.
- **État affiché périmé.** Après le rechargement, l'action peut être devenue impossible pour une autre raison. La source ne dit pas si l'écran doit alors le signaler autrement.

## Hors périmètre

- Empêcher le conflit lui-même : deux écrans peuvent légitimement agir en même temps, ce lot traite ce que l'utilisateur en voit.
- Le composant partagé de panneau latéral, volontairement non modifié.
- Les refus liés au prix, traités par `Q17-a` et `Q17-c`.

## Dépendances et décisions

- `BCP-5` — les messages de conflit reprennent le libellé de la table unique des statuts plutôt que de le recopier (dépendance déclarée en frontmatter).
- `BCP-6` — le défaut de hauteur de ligne du sous-titre est né du passage de la fiche produit à une description de panneau latéral, livré par ce lot (dépendance déclarée en frontmatter).
- **Écart story / dépôt, à trancher.** Le frontmatter porte `deliveryStatus: not-started` et `specStatus: contradictory`, et la section de preuves ci-dessous ne relève aucun fichier. La relecture du dépôt contredit ce balayage : les deux correctifs décrits ici **existent** et sont nommément attribués à « Fix BCP-5/BCP-6 » dans le code — `src/modules/orders/ui/storefront/orderTransitionErrors.helpers.ts` (classification partagée par code), `src/modules/orders/ui/storefront/orderValidation.helpers.ts`, `src/modules/orders/ui/storefront/orderCancellation.helpers.ts`, et `PRODUCT_OVERLAY_SUBTITLE_CLASSNAME` dans `src/modules/catalog/ui/storefront/ProductOverlay.helpers.ts`. Le balayage de migration a probablement rattaché ces fichiers à `BCP-5` et `BCP-6`. La contradiction porte donc sur l'**attribution**, pas sur l'existence du correctif.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-5_6-fix.md`

## Questions ouvertes

- Le `deliveryStatus` doit-il passer à `implemented` au vu des fichiers relevés ci-dessus, ou ce correctif doit-il être considéré comme absorbé par `BCP-5` et `BCP-6` et cette fiche retirée du backlog ?
- Le repli sur le texte en l'absence de code est-il accepté, ou la règle « jamais par le texte » doit-elle être tenue sans exception, quitte à afficher un message générique ?
- Quels sont les textes exacts attendus pour chaque famille de refus ? Le dépôt en porte, aucun n'a été validé en revue produit.
- Après un refus, l'action doit-elle être proposée à nouveau d'un clic, ou l'utilisateur doit-il la relancer lui-même ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
