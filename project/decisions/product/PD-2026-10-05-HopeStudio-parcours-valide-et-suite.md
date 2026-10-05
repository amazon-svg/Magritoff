---
id: PD-2026-10-05-HOPESTUDIO
title: "HopeStudio : parcours chat vers devis validé côté Magrit et travaux restants"
date: 2026-10-05
documentStatus: approved
decisionStatus: adopted
source: user-request
owners:
  - Xavier Péchoultres
supersedes: []
affectedArtifacts:
  - project/backlog/stories/US-CONV-02.md
  - project/backlog/stories/E1.WM1.md
  - project/backlog/stories/E1.WM2.md
  - project/backlog/stories/E1.WM3.md
  - project/backlog/stories/E10.6.md
  - project/backlog/stories/E10.21.md
---

# HopeStudio : validation Magrit et suite

## Accord humain et périmètre

Le 5 octobre 2026, dans le chat de reprise du projet, Xavier Péchoultres, autorité d’arbitrage HopeStudio et E1.WM*, confirme que le parcours chat vers devis est livré et validé du point de vue Magrit. Cette décision restitue son accord sur ce périmètre ; les propositions de travaux suivants restent à cadrer.

Le module Magrit fournit ses API et callbacks à HopeStudio lors de sa configuration ; HopeStudio les appelle. Les appels de traitement sont orchestrés par sa bibliothèque JavaScript. Magrit assure les accès, le relais et l’intégration des résultats.

Xavier confirme deux capacités validées :

- reprise d’un chat provenant d’un projet ;
- création d’une ligne de projet comprenant le prix, le descriptif technique et tous les documents attachés.

Le parcours chat vers devis côté Magrit est considéré bouclé. Il ne faut plus proposer de reconstruire cette intégration ni imposer une nouvelle recette fournisseur comme préalable à sa reconnaissance. La validation humaine complète les preuves locales ; elle ne transforme pas les fixtures simulées en tests fournisseur réels et ne précise pas une version de production.

## Conséquences sur le backlog

US-CONV-02 et E1.WM2 disposent d’une implémentation et de cette acceptation humaine pour le parcours décrit ci-dessus ; leur ancien `not-started` est corrigé en `implemented`. Leurs critères historiques plus larges restent à réconcilier : une validation du parcours ne prouve pas tous les critères relatifs au POC, aux patrons et à la vue 3D. Aucun statut `verified` ou `released` global n’est déduit sans la revue et les preuves correspondantes.

E1.WM1 conserve la responsabilité documentaire de la frontière, dont le principe est confirmé ici. E1.WM3 ne devient pas un chantier automatique de refactoring : seuls des écarts identifiés et arbitrés par Xavier peuvent justifier du travail. Les autres usages Clariprint ne sont pas supprimés au titre de la clôture du parcours.

## Travaux restants indiqués par Xavier

| Sujet | Résultat à préparer | Rattachement et prochaine étape |
|---|---|---|
| Formulaire produit PIM enrichi par HopeStudio | Articuler les données PIM, la configuration du produit et les données fournies par HopeStudio. | Rapprocher E1.2, Q20 et la recherche unifiée B1 avant de définir le périmètre ; ne pas supposer ces stories suffisantes. |
| Chat actif dans les boutiques | Rendre le parcours disponible dans le contexte boutique avec ses utilisateurs, catalogue et destination des résultats. | Rapprocher le catalogue et configurateur E4.1/E4.2 ; définir le comportement attendu et les accès avant une story dédiée si nécessaire. |
| Marges sur les tarifs HopeStudio | Vérifier la transformation du coût de production en prix de vente et les règles appliquées, notamment par gamme et client. | E10.6/E10.21 et le service de devis ; diagnostic ciblé avant correctif. |

## Premier relevé de la chaîne de prix

Lecture du code au commit `c584404e`, sans exécution métier supplémentaire :

- `ProjectsService.importHopeStudioBasketItem` conserve le prix sélectionné dans `amounts.clariprint_price_ht`, avec la configuration et les fichiers. Il n’applique pas de marge à cet import.
- `CommercialQuotesService.resolveAddLineInput` reprend ce montant comme `productionPrice` lorsqu’une ligne de devis provient d’un élément de projet.
- `CommercialQuotesService.priceLine` appelle la résolution des règles avec le client, puis `PricingEngine`, et enregistre distinctement coût de production, prix public, prix client et marge appliquée.
- Ce même appel transmet `productRangeId: null` et `defaultMarginRate: null`. Le rattachement de la carte à sa gamme et l’application des règles ou marges standard de gamme ne sont donc pas démontrés par ce chemin. Les règles client ou globales peuvent s’appliquer : il serait incorrect de conclure que toutes les marges sont ignorées.

La vérification doit suivre un montant connu de l’import au devis, avec règle globale, règle client, règle de gamme et absence de règle ; contrôler l’absence de double application et la quantité du chiffrage. Pour la boutique, vérifier séparément le prix affiché puis transmis au panier et à la commande. Le prix de production ne doit pas être assimilé implicitement au prix de vente.

Ce relevé constitue une analyse d’impact, pas une nouvelle règle de marge ni un correctif livré. La validation chat vers devis est conservée ; la vérification tarifaire constitue un sujet distinct demandé par Xavier.
