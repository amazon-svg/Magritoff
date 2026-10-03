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

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3ddd0131973c81e097bce8addf7488ed)). Le statut Notion `Terminé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

Chantier boutique, lot 9. Le bouton de compte annonçait « Compte de acheteur ». Il dit désormais « Mon compte (Aline Petit) » pour un visiteur connecté, et « Compte boutique » sinon. Le texte affiché à l'écran reste inchangé.
**Relecture adversariale** : approuvée au round 2.
**Contrôle navigateur du 16/09** : conforme, dans les deux états.
Détail : `story-BCP-9.md`.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

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

- Relecture produit requise : contenu importé, non approuvé.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
