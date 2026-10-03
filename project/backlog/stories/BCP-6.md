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

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3ddd0131973c81a0a4ede72e0b1cceb0)). Le statut Notion `Terminé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

Chantier boutique, lot 6. Suppression des avertissements de la console du navigateur sur la boutique : passage de références sur dix primitives d'interface, et description accessible manquante sur les fenêtres et tiroirs.
**Livré** : correction des composants, plus une garde automatique qui empêche de réintroduire une fenêtre sans description.
**Relecture adversariale** : approuvée au round 3, après réécriture de la garde.
**Contrôle navigateur du 16/09** : console propre. Seuls subsistent des signalements mineurs et antérieurs, sans rapport avec ce lot.
Détail : `story-BCP-6.md`.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

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

- Relecture produit requise : contenu importé, non approuvé.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
