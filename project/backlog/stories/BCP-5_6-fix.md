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
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-5_6-fix.md
---

# Correctif post-recette — conflits de commande et fiche produit

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3ddd0131973c81bf8d29d0e6f7a9890e)). Le statut Notion `Terminé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

Deux défauts relevés lors de la recette du 15/09, corrigés et vérifiés.
1. **Conflit entre deux écrans.** Si l'atelier valide une commande pendant que l'acheteur l'annule, un texte technique brut s'affichait. Le message est désormais choisi d'après le code d'erreur renvoyé par le serveur, et non d'après son texte : plus aucun identifiant ni code visible, quelle que soit l'erreur. La liste se recharge après un échec comme après un succès.
2. **Mise en page de la fiche produit** : hauteur de ligne du sous-titre rétablie.
**Relecture adversariale** : approuvée au round 2, après un rejet portant sur les erreurs 403 et 404, sur l'absence de test du rechargement, et sur un refus de type « conflit » appliqué trop largement.
**Contrôle navigateur du 16/09** : les deux sens du conflit sont conformes, avec une seule relecture de la liste après le refus et aucun message de succès trompeur.
Détail : sections « Correctif post-recette » de `story-BCP-5.md` et `story-BCP-6.md`.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: not-started` — 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-5_6-fix.md`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- **Contradiction** : Notion déclare cette story « Terminé » alors que le balayage du dépôt ne trouve aucune preuve d'implémentation. Arbitrage attendu.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
