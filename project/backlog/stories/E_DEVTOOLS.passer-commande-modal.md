---
id: E_DEVTOOLS.passer-commande-modal
title: E_DEVTOOLS.passer-commande-modal — Remplacer confirm() native par AlertDialog shadcn
epic: EPIC-E4
feature: FEAT-E4-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 35dd0131973c81efab27d17bf7799745
  url: https://app.notion.com/35dd0131973c81efab27d17bf7799745
  originalStatus: "Pas commencé"
  originalSprint: "Sprint 4"
  originalPriority: "P1"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: "Toutes"
  originalOrder: ""
  originalSources: "Cas de test KO"
  createdAt: "2026-05-11 09:08:40Z"
  lastEditedAt: "2026-05-11T09:08:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/E_DEVTOOLS.passer-commande-modal.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-E_DEVTOOLS.passer-commande-modal.md
---

# E_DEVTOOLS.passer-commande-modal — Les confirmations de la boutique sont des boîtes natives du navigateur

> Remplace les boîtes de dialogue natives du navigateur par des confirmations intégrées à la boutique, pour que le parcours soit cohérent et vérifiable automatiquement.

## Valeur métier

Une boîte native n'est pas à la charte, ne dit pas ce qu'on s'apprête à engager, et sort l'acheteur de la boutique le temps d'un clic. Surtout, elle bloque la page : aucun outil de recette automatisée ne peut la franchir. Ce que cela coûtait : le chemin d'achat le plus important de la boutique — passer commande — ne pouvait pas être vérifié de bout en bout autrement qu'à la main, et c'est précisément celui qu'il faut vérifier à chaque livraison.

## Défaut constaté

Campagne de tests du 11/05/2026, cas partiellement satisfait. Le parcours « Passer commande » depuis le tiroir panier figeait le moteur de rendu pendant 45 secondes, puis la navigation expirait. L'état vide du panier, lui, fonctionnait.

Cause retenue : une boîte de dialogue native du navigateur, appelée au moment de confirmer la commande. Une boîte native bloque la boucle d'événements de la page et n'est pas franchissable par un outil de pilotage du navigateur — elle attend une intervention humaine.

Conséquence directe : impossible de jouer en automatisation la création d'une commande, donc impossible de vérifier automatiquement que les commandes de la boutique se créent bien de bout en bout.

## Besoin utilisateur

**En tant qu'**acheteur de la boutique — humain comme outil de recette automatisée — **je veux** que la confirmation de commande soit une confirmation intégrée à la page, ouverte et fermée par des clics ordinaires, **afin de** pouvoir valider ma commande dans un parcours cohérent et vérifiable.

## Comportement attendu

1. La confirmation d'un geste engageant est rendue dans la page, pas par le navigateur.
2. Elle annonce ce qui est engagé : la nature du geste et, pour une commande, le nombre d'articles et le montant.
3. Elle offre deux issues explicites : annuler et confirmer.
4. Annuler ferme la confirmation sans qu'aucune commande ne soit créée.
5. Confirmer crée la commande, ferme la confirmation, informe du succès et conduit l'acheteur à la suite.
6. Le même traitement s'applique aux autres gestes de la boutique qui passent aujourd'hui par une boîte native : messages d'erreur et confirmations de remplacement du panier.

## Expérience utilisateur

- La confirmation reprend l'apparence de la boutique : même typographie, mêmes boutons, même tonalité.
- L'acheteur lit ce qu'il engage avant de confirmer, pas après.
- Les messages d'erreur sont rendus là où l'acheteur regarde, au contact de l'action qui a échoué, plutôt que dans une fenêtre qui recouvre tout.
- La confirmation est atteignable et franchissable au clavier, et le focus y entre à l'ouverture.
- **La source est muette** sur le retour du focus après fermeture et sur le libellé annoncé par un lecteur d'écran.

## Règles métier

- `RM-01` — Aucun geste de la boutique ne recourt à une boîte de dialogue native du navigateur.
- `RM-02` — Une confirmation engageante énonce la nature du geste et son enjeu chiffré quand il y en a un.
- `RM-03` — Annuler une confirmation ne produit aucun effet : aucune commande n'est créée, aucun panier n'est remplacé.
- `RM-04` — Confirmer produit l'effet annoncé, informe du résultat et conduit à l'étape suivante.
- `RM-05` — Une confirmation est modale, navigable au clavier, et le focus y entre à l'ouverture.
- `RM-06` — Les messages d'erreur sont rendus dans la page, au contact de l'action concernée.
- `RM-07` — Le parcours de commande doit pouvoir être joué de bout en bout par un outil de recette automatisée, sans intervention humaine.

## Critères d'acceptation

- `AC-01` — Étant donné un panier non vide et un acheteur identifié, quand il engage la commande, alors une confirmation rendue dans la page s'ouvre, annonçant le nombre d'articles et le montant, avec un bouton d'annulation et un bouton de confirmation.
- `AC-02` — Étant donné cette confirmation ouverte, quand l'acheteur annule, alors elle se ferme et aucune commande n'est créée.
- `AC-03` — Étant donné cette confirmation ouverte, quand l'acheteur confirme, alors la commande est créée, la confirmation se ferme, le succès est signalé et l'acheteur est conduit à la suite du parcours.
- `AC-04` — Étant donné un outil de recette automatisée, quand il joue ce parcours par des clics ordinaires, alors la page ne se fige à aucun moment et la liste des commandes se peuple.
- `AC-05` — Étant donné la confirmation ouverte, quand l'acheteur navigue au clavier, alors le focus est entré dans la confirmation et y reste tant qu'elle est ouverte.
- `AC-06` — Étant donné un renouvellement de commande demandé alors que le panier n'est pas vide, quand l'acheteur est averti que son panier va être remplacé, alors l'avertissement est rendu dans la page et non par le navigateur.
- `AC-07` — Étant donné une erreur survenant pendant la commande — session incompatible, configuration de boutique incomplète, prix changé, échec réseau — quand elle se produit, alors elle est rendue dans la page et non par une boîte native.
- `AC-08` — Étant donné le parcours modifié, quand on rejoue la suppression d'une ligne et le vidage du panier, alors leurs comportements sont inchangés.

## Cas limites

- **La moitié du défaut est corrigée, l'autre non.** La confirmation de commande ne passe plus par une boîte native : le parcours traverse désormais un écran de commande dédié qui porte le récapitulatif et le bouton de validation. La boutique dispose par ailleurs de confirmations intégrées pour valider, refuser et annuler une commande. En revanche, le dépôt conserve **une** confirmation native, sur le remplacement du panier lors d'un renouvellement, et **sept** messages d'erreur rendus par des boîtes natives dans le parcours boutique. `RM-01` n'est donc pas tenu.
- **Le périmètre désigné par la source n'existe plus sous cette forme.** La méthode de soumission du panier a été déplacée et le composant visé par la source a été réorganisé. La story doit être relue en termes de gestes, pas de fichiers.
- **Confirmation ou écran intercalaire ?** Le parcours livré confirme la commande par un écran dédié, pas par une confirmation superposée. La source demandait une confirmation superposée. Les deux répondent au défaut ; la source est antérieure à la refonte et ne peut pas trancher.
- **Erreur rendue en ligne plutôt qu'en fenêtre.** L'écran de commande livré retient explicitement le rendu en ligne des erreurs. `RM-06` va dans ce sens, mais les erreurs du cycle de commande ne l'appliquent pas encore.
- **« Vider le panier » ne confirme pas.** La source envisageait une confirmation native sur ce geste ; aucune n'a été trouvée. Faut-il en ajouter une, ou le geste est-il assez anodin pour s'en passer ?
- **Les boîtes natives de l'espace d'administration** ne sont pas dans le périmètre de cette story, qui porte sur la boutique. Elles posent le même problème.

## Hors périmètre

- Le contenu et la logique de la commande elle-même (`E4.2`).
- La migration des messages d'erreur de l'espace d'administration.
- Le comportement du panier et sa conservation (`E4.1`, `E_CART.persist-localstorage`).
- Les réserves d'accessibilité sur le tiroir panier et le filtre « Tout » (`E_A11Y.shop-pills-and-drawer`).

## Dépendances et décisions

- La source indique « aucun prérequis bloquant ». Aucune dépendance n'est déclarée en frontmatter, et rien dans la source n'en justifie l'ajout.
- **Décision B7 — panier : en attente** (`OQ-PROD-B6-B7`). Le geste visé part du panier : son arbitrage peut déplacer l'endroit où la confirmation se pose.
- `E4.2` — la validation de commande définit ce qui est engagé au moment de confirmer.
- `ADR-2026-10-01-C6` — le retrait du kit d'interface est reporté : les composants de confirmation déjà en place dans la boutique restent disponibles.
- `ADR-2026-10-01-C1` — l'architecture cible n'utilise plus de fonctions Edge : les éléments de mise en œuvre serveur hérités de l'import sont périmés et ont été retirés.
- La source rattachait la levée du défaut au rejeu d'un cas de test existant et à un cas nouveau, tenus dans Notion. Notion est sorti du jeu le 03/10/2026 : l'emplacement où ces cas vivent reste à désigner.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-E_DEVTOOLS.passer-commande-modal.md`

## Questions ouvertes

- La confirmation de commande doit-elle rester l'écran dédié livré, ou revenir à une confirmation superposée comme le demandait la source ?
- Les sept messages d'erreur encore rendus par des boîtes natives doivent-ils tous passer en rendu dans la page, et sous quelle forme : en ligne au contact de l'action, ou en notification ?
- Le remplacement du panier lors d'un renouvellement mérite-t-il une confirmation superposée, ou un rendu en ligne suffit-il ?
- Faut-il une confirmation avant de vider le panier ?
- Où revient le focus après fermeture d'une confirmation ?
- Les boîtes natives de l'espace d'administration relèvent-elles d'une story distincte, et laquelle ?
- Quel outil de recette automatisée fait référence pour `AC-04`, et où ce parcours est-il rejoué ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E4-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
