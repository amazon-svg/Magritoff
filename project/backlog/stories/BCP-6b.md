---
id: BCP-6b
title: BCP-6b — Fin de la boucle d'appels session et catalogue
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: implemented
owner: unassigned
source:
  system: notion
  pageId: 3ddd0131973c8192adedd3721eb8562b
  url: https://app.notion.com/3ddd0131973c8192adedd3721eb8562b
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P0"
  originalEffort: "L"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: ""
  originalSources: ""
  createdAt: "2026-09-16 06:01:58Z"
  lastEditedAt: "2026-09-16T06:01:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/BCP-6b.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-6b.md
---

# BCP-6b — Fin de la boucle d'appels session et catalogue

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3ddd0131973c8192adedd3721eb8562b)). Le statut Notion `Terminé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

Chantier boutique. Une page de boutique laissée ouverte déclenchait deux appels toutes les cinq secondes, dont le rechargement complet du catalogue. Mesuré en navigateur, non détecté par les tests.
**Livré** :
- plus aucun appel périodique : la boutique ne réagit qu'à un retour sur l'onglet, avec des délais ;
- une session expirée ramène l'écran de connexion au lieu de laisser l'en-tête afficher « connecté » indéfiniment ;
- garde contre l'emballement : une seule revalidation à la fois.
**Relecture adversariale** : deux rejets avant approbation. Le premier parce que la session expirée n'était pas traitée ; le second parce que la garde n'était prouvée par aucun test — un test qui « échouait » en saturant le processeur a été refusé comme preuve.
**Contrôle navigateur du 16/09** : zéro appel au repos sur deux minutes et demie, une seule revalidation quand la session expire, reproduit deux fois.
**Reste ouvert, non bloquant** : à la reconnexion, la liste des commandes est demandée quatre fois dont une annulée.
Détail : `story-BCP-6b.md`.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: implemented` — 3 fichiers de code · 6 fichiers de test · 12 commits git · 1 story document BMAD avec signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-6b.md`

Fichiers de code :

- `src/modules/shop-customers/ui/hooks/useStorefrontSession.ts`
- `src/modules/shops/ui/hooks/usePublicShopCatalog.ts`
- `src/platform/api/fetch-api-client.ts`

Fichiers de test :

- `tests/architecture/storefront-catalog-access.test.ts`
- `tests/architecture/storefront-refresh-scheduling.test.ts`
- `tests/components/shop/StorefrontDelegationBanner.test.ts`
- `tests/hooks/usePublicShopCatalog.test.ts`
- `tests/hooks/useStorefrontSession.test.ts`
- `tests/platform/api/fetch-api-client.test.ts`

Commits : `8cb3ebf8`, `0e54e804`, `c165e751`, `ebee4eb1`, `6731d1fb`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
