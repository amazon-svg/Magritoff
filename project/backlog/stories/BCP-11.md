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

> Corrige le prix d'un produit vendu au paquet, qui était multiplié deux fois dans le panier, et rend la confusion impossible à reproduire.

## Valeur métier

Un paquet à 35 € pour 500 exemplaires ressortait à **17 500 €** dans le panier. Un acheteur qui voit ce montant n'achète pas : il ferme l'onglet, et il ne revient pas. Pour l'imprimeur, c'est une vente perdue sans aucun signal — aucune réclamation, aucune trace, juste un panier abandonné. Le défaut n'était pas un arrondi : c'était un facteur 500.

## Défaut constaté

Le prix d'un produit vendu au paquet était multiplié par la **quantité de paquets** *et* par le **nombre d'exemplaires**. Les deux grandeurs étaient portées par le même type numérique : rien n'empêchait de passer l'une là où l'autre était attendue, et la valeur par défaut silencieuse du nombre de paquets masquait l'erreur au lieu de la révéler.

## Besoin utilisateur

**En tant qu'**acheteur ajoutant au panier un produit vendu au paquet, **je veux** voir le prix réel de ce que je commande, **afin de** pouvoir décider.

## Comportement attendu

1. Le prix d'une ligne de panier portant un produit vendu au paquet est fonction du **nombre de paquets**, jamais du nombre d'exemplaires qu'ils contiennent.
2. Le nombre de paquets est **obligatoire** à la construction d'une ligne : aucune valeur par défaut n'est appliquée en silence.
3. La règle vit à un seul endroit : toute ligne de panier est construite par le même constructeur.
4. Une quantité d'exemplaires et un nombre de paquets ne sont plus interchangeables : les confondre est détecté avant l'exécution.
5. Le renouvellement d'une commande conserve le nombre de paquets d'origine.

## Expérience utilisateur

- Le panier affiche un montant cohérent avec ce que l'acheteur a demandé ; c'est la seule chose qu'il doit constater.
- Le nombre d'exemplaires et le nombre de paquets sont deux informations distinctes à l'écran, et l'acheteur comprend laquelle détermine le prix.
- **La source est muette** sur la façon dont les deux grandeurs sont présentées et distinguées dans l'interface.

## Règles métier

- `RM-01` — Le prix d'une ligne de panier au paquet se calcule sur le nombre de paquets, jamais sur le nombre d'exemplaires.
- `RM-02` — Le nombre de paquets est une donnée obligatoire de toute ligne de panier ; aucune valeur par défaut implicite n'est admise.
- `RM-03` — Une quantité d'exemplaires et un nombre de paquets sont deux grandeurs distinctes, non interchangeables.
- `RM-04` — Toute ligne de panier est construite par un constructeur unique ; aucune construction de ligne n'existe ailleurs.
- `RM-05` — Cette unicité est tenue par une vérification automatique opérant sur la **structure** du code, et non sur son texte.
- `RM-06` — Le renouvellement d'une commande restitue le nombre de paquets d'origine, sans le ramener à un.

## Critères d'acceptation

- `AC-01` — Étant donné un produit vendu par paquets à 35 € le paquet de 500 exemplaires, quand l'acheteur en met un paquet au panier, alors la ligne affiche 35 €.
- `AC-02` — Étant donné le même produit, quand l'acheteur en met deux paquets au panier, alors la ligne affiche 70 € et non un multiple du nombre d'exemplaires.
- `AC-03` — Étant donné une commande renouvelée portant deux paquets, quand le panier est reconstruit, alors il porte deux paquets.
- `AC-04` — Étant donné une tentative de construire une ligne de panier sans nombre de paquets, quand le code est compilé, alors la compilation échoue.
- `AC-05` — Étant donné une tentative de passer une quantité d'exemplaires là où un nombre de paquets est attendu, quand le code est compilé, alors la compilation échoue.
- `AC-06` — Étant donné une ligne de panier construite ailleurs que par le constructeur unique, quand la vérification automatique s'exécute, alors elle échoue.

## Cas limites

- **Erreur de valeur, non couverte.** Le marquage des types empêche de confondre les deux grandeurs, pas de fournir une mauvaise valeur : construire une quantité d'un exemplaire au lieu de cinq cents reste possible et compile. Limite écrite et assumée.
- **Ligne assemblée en plusieurs instructions.** La vérification d'unicité reconnaît une construction écrite d'un seul tenant ; une ligne assemblée morceau par morceau lui échappe. Limite écrite et assumée.
- **Panier de l'atelier.** C'est un second panier, indépendant, hors périmètre de ce lot. La règle du paquet n'y est donc pas tenue par le même domicile.
- **Donnée corrigée en parallèle.** Le produit « Affiches A1 offset », dont le prix de 17 500 € résultait de cette multiplication, a été **supprimé** sur décision d'Arnaud, après vérification qu'aucune commande, aucun devis et aucune surcharge ne le référençait. La suppression est un geste de données, pas une conséquence du correctif.
- **Produits déjà commandés au mauvais prix** : la source ne dit pas s'il en existe, ni ce qu'il advient d'une commande passée avant le correctif.

## Hors périmètre

- Le panier de l'atelier.
- Le recalcul serveur du prix d'une commande, traité par `Q17-a`.
- La condition d'ajout direct au panier, traitée par `Q14-a`.
- La présentation à l'écran du couple exemplaires / paquets.

## Dépendances et décisions

- Arbitrage d'Arnaud : suppression du produit « Affiches A1 offset » après vérification qu'il n'était référencé nulle part.
- La vérification d'unicité a d'abord été écrite sur le **texte** du code et s'est révélée contournable en huit caractères ; elle a été réécrite sur la **structure** du code. C'est la même famille de défaut que celle traitée par `FIX-GARDE`, et l'argument central de l'arbitrage d'outillage porté dans `Q-ARBITRAGES`.

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

- Le panier de l'atelier doit-il rejoindre le même domicile de règle, ou reste-t-il un système distinct ? Tant qu'il est distinct, le même défaut peut y vivre.
- Des commandes ont-elles été passées au prix multiplié avant le correctif, et faut-il les traiter ?
- Comment l'interface doit-elle présenter la distinction entre nombre d'exemplaires et nombre de paquets, pour que l'acheteur sache laquelle détermine le prix ?
- Une erreur de valeur reste possible : faut-il une vérification de cohérence au moment de l'ajout au panier, ou l'accepte-t-on ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
