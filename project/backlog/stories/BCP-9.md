---
id: BCP-9
title: BCP-9 — Libellé du bouton de compte acheteur
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: implemented
owner: unassigned
source:
  system: notion
  pageId: 3ddd0131973c81e097bce8addf7488ed
  url: https://app.notion.com/3ddd0131973c81e097bce8addf7488ed
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P2"
  originalEffort: "XS"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: ""
  originalSources: ""
  createdAt: "2026-09-16 06:01:58Z"
  lastEditedAt: "2026-09-16T06:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/BCP-9.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-9.md
---

# BCP-9 — Libellé du bouton de compte acheteur

> Remplace « Compte de acheteur », annoncé par les lecteurs d'écran sur le bouton de compte de la boutique, par une formulation correcte quel que soit le nom.

## Valeur métier

Le défaut ne coûtait pas une vente : il coûtait la crédibilité de la boutique auprès de l'acheteur qui l'entend plutôt qu'il ne la voit. « Compte de acheteur », puis « Compte de Aline », c'est une faute d'élision répétée à chaque écran — le signe d'une interface assemblée par concaténation, pas écrite. La correction est de l'ordre du soin, et le soin se remarque surtout quand il manque.

## Défaut constaté

Le libellé accessible du bouton de compte était construit sur le gabarit `Compte de <nom>`. Ce gabarit casse l'élision française devant toute voyelle : « Compte de acheteur », « Compte de Aline ». Le cas signalé en recette n'était donc qu'un exemple d'un défaut général.

## Besoin utilisateur

**En tant qu'**acheteur utilisant un lecteur d'écran, **je veux** que le bouton de compte s'annonce dans un français correct, **afin de** savoir de quel compte il s'agit sans buter sur la formulation.

## Comportement attendu

1. Le libellé accessible du bouton de compte n'emploie plus la préposition « de » suivie du nom : le défaut d'élision disparaît pour tous les noms, pas seulement pour celui qui a été signalé.
2. Visiteur identifié : le bouton s'annonce **« Mon compte (Nom Prénom) »**.
3. Visiteur non identifié : le bouton s'annonce **« Compte boutique »**.
4. Le nom lu est exclusivement le nom complet du client — jamais l'adresse électronique, jamais un identifiant technique.
5. **Le texte visible du bouton à l'écran est inchangé** : ce lot ne vise que le libellé annoncé aux technologies d'assistance.

## Expérience utilisateur

- Rien ne bouge visuellement : un acheteur voyant ne doit constater aucune différence.
- L'acheteur au lecteur d'écran entend une phrase correcte, qui l'identifie sans exposer son adresse.
- Une parenthèse vide ne doit jamais être annoncée : si aucun nom n'est disponible, le libellé se réduit à « Mon compte ».
- **La source est muette** sur ce troisième état. Le dépôt le traite par défense (`resolveAccountLabel` dans `src/modules/shops/ui/storefront/ShopLayout.helpers.ts`), mais aucune décision produit ne l'a posé.

## Règles métier

- `RM-01` — Le libellé accessible du bouton de compte n'utilise pas la construction « de + nom ».
- `RM-02` — Session présente et nom renseigné : « Mon compte (<nom complet>) ».
- `RM-03` — Aucune session : « Compte boutique ».
- `RM-04` — Seul le nom complet du client est lu ; l'adresse électronique et les identifiants techniques ne sont jamais exposés.
- `RM-05` — Le texte visible du bouton n'est pas modifié par cette règle et ne doit pas être dérivé du même calcul.

## Critères d'acceptation

- `AC-01` — Étant donné un acheteur identifié sous le nom « Aline Petit », quand un lecteur d'écran lit le bouton de compte, alors il annonce « Mon compte (Aline Petit) ».
- `AC-02` — Étant donné un visiteur non identifié, quand un lecteur d'écran lit le bouton de compte, alors il annonce « Compte boutique ».
- `AC-03` — Étant donné un acheteur dont le nom commence par une voyelle, quand le libellé est annoncé, alors aucune faute d'élision n'est produite.
- `AC-04` — Étant donné les deux états, quand on compare le rendu à l'écran avant et après le lot, alors le texte visible du bouton est identique.
- `AC-05` — Étant donné un acheteur identifié, quand le libellé est annoncé, alors il ne contient ni adresse électronique ni identifiant technique.

## Cas limites

- **Session présente, nom vide ou composé d'espaces.** Le dépôt replie sur « Mon compte » nu, pour ne jamais annoncer une parenthèse vide. Comportement **non décidé en produit** : il est défensif, le contrat exigeant par ailleurs un nom non vide.
- **Nom très long** : la source ne dit rien de la troncature ou de l'absence de troncature dans l'annonce.
- **Homonymes ou compte délégué** : la source ne dit pas si le nom annoncé doit distinguer le compte agissant du compte au nom duquel on agit.
- **Divergence visible / annoncé.** Le texte visible reste le nom complet seul, ou « Compte ». Le libellé annoncé dit autre chose. Cette divergence est **voulue et bornée**, mais elle signifie que deux formulations coexistent pour le même bouton.

## Hors périmètre

- Le texte visible du bouton de compte.
- Le contenu du menu de compte et les écrans qui s'ouvrent derrière.
- Les libellés accessibles des autres boutons de l'en-tête, dont le panier.
- Le même bouton côté atelier.

## Dépendances et décisions

- Cadrage boutique, `docs/api/CONVENTIONS.md` §8.25 point 5.5 : le périmètre visé est **une seule ligne**, celle qui porte le libellé accessible du bouton de compte. Resserrement demandé en revue, à conserver.

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: implemented` — 1 fichier de code · 2 fichiers de test · 11 commits git · 1 story document BMAD avec signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-9.md`

Fichiers de code :

- `src/modules/shops/ui/storefront/ShopLayout.helpers.ts`

Fichiers de test :

- `tests/architecture/storefront-account-identity.test.ts`
- `tests/components/shop/ShopLayout.helpers.test.ts`

Commits : `baac0a30`, `5eef05a8`, `1218e74d`, `6bb6870f`, `6b7dd56e`

## Questions ouvertes

- Que doit annoncer le bouton quand la session existe mais que le nom est vide ? Le dépôt replie sur « Mon compte » : est-ce la décision retenue ?
- Faut-il aligner le texte visible du bouton sur le libellé annoncé, ou la divergence est-elle assumée durablement ?
- Les autres boutons de l'en-tête présentent-ils le même défaut de construction, et doivent-ils être repris dans la foulée ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
