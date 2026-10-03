---
id: BCP-5
title: BCP-5 — Libellés de statut des commandes unifiés
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: implemented
owner: unassigned
source:
  system: notion
  pageId: 3ddd0131973c814eb8c7cfd3fef80635
  url: https://app.notion.com/3ddd0131973c814eb8c7cfd3fef80635
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
  archive: _archives-notion/2026-10-03/pages/BCP-5.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-5.md
---

# BCP-5 — Libellés de statut des commandes unifiés

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3ddd0131973c814eb8c7cfd3fef80635)). Le statut Notion `Terminé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

Chantier boutique, lot 5. Un seul libellé pour un seul état : une commande passée par un acheteur s'affiche « En attente de validation », dans la boutique comme dans l'atelier. Le mot « Brouillon » ne désigne plus qu'un devis.
**Livré** : table unique des statuts, badges, filtres, dialogues de validation et d'annulation, écran de remerciement, historique, bandeau de reprise.
**Relecture adversariale** : approuvée au round 2.
**Contrôle navigateur du 16/09** : conforme. Aucun « Brouillon » résiduel côté commandes.
Détail : `SPRINT_HANDOFF.md` et `_bmad-output/implementation-artifacts/story-BCP-5.md`.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: implemented` — 6 fichiers de code · 6 fichiers de test · 10 commits git · 1 story document BMAD avec signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-5.md`

Fichiers de code :

- `src/modules/orders/ui/helpers/orderStatus.ts`
- `src/modules/orders/ui/hooks/useDashboardOrderManagement.ts`
- `src/modules/orders/ui/hooks/useStorefrontOrderList.ts`
- `src/modules/orders/ui/storefront/PortalCart.tsx`
- `src/modules/orders/ui/storefront/PortalOrders.helpers.ts`
- `src/modules/orders/ui/storefront/PortalThankYou.tsx`

Fichiers de test :

- `tests/architecture/order-status-single-source.test.ts`
- `tests/components/shop/portal/OrderHistoryTable.text.test.ts`
- `tests/components/shop/portal/PortalCart.text.test.ts`
- `tests/components/shop/portal/PortalOrderEditor.text.test.ts`
- `tests/components/shop/portal/PortalThankYou.test.ts`
- `tests/components/shop/portal/ValidateOrderConfirmDialog.text.test.ts`

Commits : `baac0a30`, `1218e74d`, `0d74bf86`, `e825562d`, `952783a7`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
