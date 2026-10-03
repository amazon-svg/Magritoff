---
id: E_CART.persist-localstorage
title: E_CART.persist-localstorage — Persistance CartContext localStorage par shop_slug
epic: EPIC-E4
feature: FEAT-E4-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c81438b10d5db1db7a079
  url: https://app.notion.com/35dd0131973c81438b10d5db1db7a079
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P2"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:02:50Z"
  lastEditedAt: "2026-05-11T09:02:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_CART.persist-localstorage.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_CART.persist-localstorage.md
---

# E_CART.persist-localstorage — Le panier de la boutique est perdu au rechargement

> Conserve le panier d'un acheteur quand il rafraîchit la page ou revient plus tard, pour qu'il n'ait pas à le reconstruire.

## Valeur métier

Reconstituer un panier de produits configurés, c'est refaire les choix de format, de support et de quantité un par un. Un acheteur qui perd son panier ne recommence pas : il reporte, ou il appelle. Le panier perdu est le point où l'achat s'arrête, et il s'arrête d'autant plus facilement que la boutique est un outil qu'on utilise entre deux autres tâches.

## Défaut constaté

Campagne de tests du 11/05/2026, observation relevée sur un cas par ailleurs satisfait. Depuis la vue Catalogue, avec trois articles au panier, un rafraîchissement de la page vidait le panier : l'indicateur repassait à zéro article.

L'asymétrie était visible dans le même écran : l'état des filtres par gammes, lui, **était** conservé d'un rafraîchissement à l'autre. L'acheteur retrouvait donc ses filtres mais pas ses produits.

Ce que cela coûtait : toute interruption — rafraîchissement, fermeture d'onglet, session expirée — ramène l'acheteur au début de sa saisie.

## Besoin utilisateur

**En tant qu'**acheteur de la boutique, **je veux** que mon panier soit conservé quand je rafraîchis la page ou que je ferme puis rouvre l'onglet, **afin de** reprendre ma session d'achat sans tout reconstruire.

## Comportement attendu

1. Le contenu du panier est conservé localement au fur et à mesure de ses modifications.
2. Au retour sur la boutique, le panier est restitué tel qu'il était : lignes, quantités, configurations.
3. Le panier d'une boutique est indépendant de celui d'une autre boutique.
4. Un panier conservé au-delà d'une certaine durée est purgé.
5. Vider le panier efface immédiatement ce qui en était conservé.

## Expérience utilisateur

- La restitution est silencieuse : l'acheteur retrouve son panier, il n'a rien à confirmer.
- L'indicateur du panier affiche le bon nombre d'articles dès le chargement, sans transition par zéro.
- La purge d'un panier trop ancien ne doit pas se traduire par une disparition inexpliquée : l'acheteur doit comprendre pourquoi son panier est vide.
- **La source est muette** sur ce que lit l'acheteur quand son panier a été purgé, et sur la restitution de l'indicateur par un lecteur d'écran.

## Règles métier

- `RM-01` — Le contenu du panier est conservé localement au navigateur et restitué au retour de l'acheteur.
- `RM-02` — La conservation est cloisonnée par boutique : deux boutiques ont deux paniers indépendants.
- `RM-03` — Un panier conservé expire au-delà d'une durée à arbitrer. La source recommande 24 heures, et écarte 7 jours au motif qu'un prix fournisseur vieilli n'est plus fiable.
- `RM-04` — Vider le panier efface immédiatement ce qui en était conservé.
- `RM-05` — L'indisponibilité du stockage local — navigation privée, stockage saturé, stockage désactivé — ne doit pas empêcher la boutique de fonctionner.
- `RM-06` — Un panier restitué reste soumis au contrôle du prix côté serveur au moment de la commande : la conservation n'y fait pas exception.

## Critères d'acceptation

- `AC-01` — Étant donné une boutique avec trois articles au panier, quand l'acheteur rafraîchit la page, alors l'indicateur annonce trois articles et le tiroir contient ces trois articles, avec leurs quantités et leurs configurations.
- `AC-02` — Étant donné deux articles au panier d'une première boutique, quand l'acheteur ouvre une seconde boutique, alors le panier de la seconde est indépendant de celui de la première.
- `AC-03` — Étant donné un panier conservé au-delà de la durée retenue, quand l'acheteur revient sur la boutique, alors le panier est vide.
- `AC-04` — Étant donné un panier non vide, quand l'acheteur le vide, alors ce qui en était conservé est effacé immédiatement et un rafraîchissement ne le restitue pas.
- `AC-05` — Étant donné un navigateur dont le stockage local est indisponible, quand l'acheteur utilise la boutique, alors elle fonctionne normalement, sans erreur visible, simplement sans conservation.
- `AC-06` — Étant donné un panier restitué, quand l'acheteur passe commande et qu'un prix de catalogue a changé entre-temps, alors la commande est refusée et il lit qu'il doit recharger (application de `RM-06`).
- `AC-07` — Étant donné ces ajouts, quand on rejoue le filtrage par pilules, la fiche produit, le configurateur et le tiroir panier, alors leurs comportements sont inchangés.

## Cas limites

- **Le défaut est toujours réel, mais la cible désignée par la source ne l'est plus.** La source visait le porteur de panier de l'époque. Depuis la refonte de la boutique, ce porteur sert l'atelier et non la boutique : le panier de la boutique est un état local de la page `/shop/:slug`. Aucun des deux n'est conservé. Il faut donc d'abord désigner **quel panier** cette story conserve.
- **Deux paniers, deux portées.** Si la conservation est posée sur le panier de la boutique, elle est cloisonnée par boutique, comme le demande `RM-02`. Si elle est posée sur le panier de l'atelier, la notion de boutique ne s'applique pas. La story ne peut pas couvrir les deux sans se contredire.
- **Conservation locale ou conservation par compte ?** `E4.1` demande un « panier persistent par utilisateur ». Une conservation locale au navigateur ne tient pas cette promesse : elle ne suit ni le changement de poste, ni le changement de navigateur. Les deux stories décrivent deux niveaux de garantie différents, et rien ne dit laquelle fait foi.
- **Un prix conservé est un prix vieilli.** C'est le motif pour lequel la source recommande une expiration courte. Le contrôle du prix à la commande limite le risque mais ne supprime pas la déception : l'acheteur a vu un montant, il en paiera un autre.
- **Un produit retiré du catalogue** pendant la vie du panier conservé : la source est muette.
- **Partage d'un poste.** Un panier conservé localement est visible par la personne suivante sur le même navigateur. La source ne traite pas ce cas.
- **Le typage du porteur de panier n'est pas repris ici.** La source écarte explicitement cette remise en ordre du périmètre, et ce choix est conservé.

## Hors périmètre

- La remise en ordre du typage du porteur de panier.
- La conservation côté serveur rattachée au compte de l'acheteur, qui relève de `E4.1`.
- La conservation de l'état des filtres, déjà en place.
- Le contrôle du prix à la commande (`Q17-a`).

## Dépendances et décisions

- **Décision B7 — panier : en attente.** L'atelier d'arbitrage du 01/10/2026 a renvoyé la revue du panier à la nouvelle version (`OQ-PROD-B6-B7`). Cette story porte directement sur le panier : elle ne doit pas être planifiée avant l'arbitrage, qui peut en changer l'objet même.
- `E4.1` — création et gestion de panier : décrit une persistance par utilisateur, d'un niveau de garantie supérieur à celui d'une conservation locale. L'articulation entre les deux reste à trancher.
- `Q17-a` — le prix d'une commande boutique est contrôlé côté serveur : fonde `RM-06` et `AC-06`.
- La source note qu'une décision produit est requise sur la durée d'expiration : 24 heures ou 7 jours, avec une recommandation pour 24 heures.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : cette story n'a aucune composante serveur, et les éléments de mise en œuvre hérités de l'import ont été retirés.
- La source rattachait la vérification à un cas de test existant et à un cas nouveau, tenus dans Notion. Notion est sorti du jeu le 03/10/2026 : l'emplacement où ces cas vivent reste à désigner.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_CART.persist-localstorage.md`

## Questions ouvertes

- B7 est en attente : l'arbitrage sur le panier peut rendre cette story sans objet ou en changer la cible. Qui le porte et pour quand ?
- Quel panier cette story conserve-t-elle : celui de la boutique, celui de l'atelier, ou les deux sous deux règles distinctes ?
- Conservation locale au navigateur ou conservation par compte ? `E4.1` promet la seconde, cette story décrit la première.
- Quelle durée d'expiration : 24 heures, comme le recommande la source, ou une autre valeur ?
- Que lit l'acheteur quand son panier a été purgé par expiration ? Rien, ou un message ?
- Un produit retiré du catalogue pendant la vie du panier conservé doit-il disparaître, rester inopérant, ou déclencher un avertissement ?
- Un panier conservé localement est visible par la personne suivante sur le même poste. Est-ce acceptable pour une boutique professionnelle ?
- Où se rejouent désormais les cas de test fonctionnels, Notion étant sorti du jeu ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E4-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
