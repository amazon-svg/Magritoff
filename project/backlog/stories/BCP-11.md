---
id: BCP-11
title: BCP-11 — La règle du paquet ramenée à un domicile unique
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: implemented
owner: unassigned
source:
  system: notion
  pageId: 3e1d0131973c812e90b3f158866f2923
  url: https://app.notion.com/3e1d0131973c812e90b3f158866f2923
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P1"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: "22"
  originalSources: ""
  createdAt: "2026-09-20 07:39:50Z"
  lastEditedAt: "2026-09-20T07:39:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/BCP-11.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-BCP-11.md
---

# BCP-11 — La règle du paquet ramenée à un domicile unique

## Provenance

Importée de Notion le 2026-10-03 depuis la base « 📋 Backlog Magrit — Sprint Board » ([page d'origine](https://app.notion.com/3e1d0131973c812e90b3f158866f2923)). Le statut Notion `Terminé` est conservé comme provenance seule : il ne détermine pas `deliveryStatus`, établi plus bas à partir du dépôt. Le corps est repris de l'export sans reformulation.

## Besoin utilisateur

_Non formulé dans la source Notion._

## Le défaut

Le prix d'un produit vendu au paquet était multiplié par la quantité de paquets **et** par le nombre d'exemplaires. Un paquet à 35 € pour 500 exemplaires ressortait à **17 500 €** dans le panier.

## Ce qui a été fait

La règle du paquet a un **domicile unique** : `cartLine.ts`. Les types sont marqués (`CopyCount` / `PackCount`) pour qu'une quantité d'exemplaires ne puisse plus être passée là où on attend un nombre de paquets. Le nombre de paquets devient **obligatoire** — plus de valeur par défaut silencieuse.
Un garde d'architecture, écrit sur l'**arbre syntaxique** TypeScript et non sur le texte, interdit toute construction de ligne de panier hors de ce constructeur.

## Revue

Trois rounds. Round 1 : régression du renouvellement (2 paquets devenaient 1), une assertion morte, un écran non couvert. Round 2 : le garde textuel était contournable en **8 caractères**. Round 3 : approuvé après passage à l'analyse syntaxique, puis trois durcissements du coordinateur.

## Limites écrites

Une erreur de **valeur** reste possible — `copies(1)` au lieu de `copies(500)` compile. Une ligne assemblée en plusieurs instructions échappe au garde. Le panier de l'atelier est un second panier indépendant, hors périmètre.

## Donnée liée

Le produit « Affiches A1 offset », dont le prix de 17 500 € résultait de cette multiplication, a été **supprimé** sur décision d'Arnaud après vérification qu'aucune commande, aucun devis et aucune surcharge ne le référençait.

## Critères d'acceptation

_Aucun critère d'acceptation explicite dans la source Notion au 2026-10-03. À écrire lors de la revue produit — rien n'a été déduit du code._

## Vérification

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: implemented` — 6 fichiers de code · 4 fichiers de test · 9 commits git · 1 story document BMAD sans signal d'implémentation.

Story documents BMAD (historique d'implémentation, non recopié) :

- `_bmad-output/implementation-artifacts/story-BCP-11.md`

Fichiers de code :

- `src/modules/catalog/ui/storefront/PortalCatalog.tsx`
- `src/modules/catalog/ui/storefront/PortalHome.tsx`
- `src/modules/catalog/ui/storefront/ShopProductCard.tsx`
- `src/modules/catalog/ui/storefront/ShopProductCard.typecheck.ts`
- `src/modules/catalog/ui/storefront/gamme/GammePage.tsx`
- `src/modules/orders/ui/storefront/cartLine.ts`

Fichiers de test :

- `tests/architecture/cart-line-single-constructor.test.ts`
- `tests/components/shop/PublicShop.productConfigurationAlignment.test.ts`
- `tests/components/shop/portal/cartLine.test.ts`
- `tests/components/shop/portal/orderRenewal.helpers.test.ts`

Commits : `fb1b408f`, `1669ef62`, `4ead9e3f`, `c171a75f`, `4ceffc96`

## Questions ouvertes

- Relecture produit requise : contenu importé, non approuvé.
- Critères d'acceptation absents de la source.
- Rattachement à une fonctionnalité produit à arbitrer.
