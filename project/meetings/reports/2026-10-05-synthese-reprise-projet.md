---
id: REPORT-2026-10-05-REPRISE-PROJET
title: Synthèse de reprise du projet et proposition du prochain lot
date: 2026-10-05
status: draft
source: user-request
---

# Synthèse de reprise du projet et proposition du prochain lot

Pour Xavier Péchoultres. Cette synthèse reprend le mandat en quatre étapes : vérifier le socle, sécuriser les développements, clarifier les droits, puis choisir un lot fonctionnel. Elle distingue l’existant, les résultats locaux et le travail restant. La proposition est de prendre la fiche des commandes boutique comme prochain lot, et de réconcilier les stories HopeStudio avec l’intégration déjà présente avant de planifier un nouveau développement sur ce sujet.

Référence de travail : branche locale `codex/diagnostic-reprise`, commit `8a3e1898`. Les cinq commits de reprise sont enregistrés localement ; aucun push, fusion ou déploiement n’a été effectué dans cette session. Ce document reste un brouillon de proposition, pas une décision adoptée ni un sprint engagé.

## État du mandat initial

| Étape | Résultat établi | Ce qui reste |
|---|---|---|
| Vérifier le socle | Stack PostgreSQL/S3/API/Vite opérationnelle ; tests, typage modulaire et build réussis. Xavier confirme une commande boutique visible au back-office. | Recette utilisateur complète incluant devis, commande et traitement dans le back-office. Les tests de repositories ne remplacent pas cette recette. |
| Sécuriser les développements | Suite Vitest complète ajoutée à la CI ; tests PostgreSQL isolés ; contrôles navigateur transférés sur le runtime portable et `main`. Commandes vérifiées localement. | Revue des changements, autorisation de publication, exécution effective de GitHub Actions puis intégration. |
| Clarifier les droits | Proposition `PD-2026-10-05-UM` et cadrage des sept stories ; divergences de la stack portable explicitées. | Décider la cible et les règles legacy, puis corriger les écarts retenus. Aucun droit réel n’a été changé. |
| Livrer un lot fonctionnel | Besoin de fiche commande enregistré dans E4.4a ; lecture de US-CONV-02 corrigée. | Choisir et approuver le périmètre du lot, analyser les impacts, puis développer et faire une revue distincte. Aucune nouvelle fiche n’a été livrée. |

## Capacités disponibles et limites constatées

| Sujet | Disponible ou constaté | Manque réel ou limite de preuve |
|---|---|---|
| Catalogue PIM | Référentiel de 81 gammes stocké en JSON ; synchronisation initiale et mises à jour par slug. Dans Atelier Lumière, sélection locale des gammes et 81 produits affichés en boutique. | Le seed synchronise les gammes globales, pas des produits de bibliothèques tarifés. L’activation locale ne décide pas de la hiérarchie imposée aux autres tenants ou boutiques. |
| Commandes boutique | Création et présence en liste confirmées par Xavier ; actions de validation, annulation et production présentes dans le module. | La liste ne fournit pas la fiche complète et l’édition demandées pendant la recette. Un détail dépliable partiel ne satisfait pas ce besoin. |
| Commandes commerciales | E10.12 porte la conversion de devis ; E10.16 porte une fiche existante sur `commercial-orders/:orderId`. | Cette fiche ne prouve pas la couverture des commandes boutique. Réutiliser sa présentation exige de vérifier les données et règles de chaque origine. |
| HopeStudio | Runtime JavaScript, sessions par projet, relais authentifié et callbacks d’import de cartes/fichiers présents. La recette navigateur avec réponses simulées vérifie la sélection d’une offre et l’appel d’import avec le bon prix. | Aucun chiffrage fournisseur réel validé dans cette recette. Son stockage projet est également simulé. Les tests locaux ne suffisent pas à déclarer US-CONV-02 terminée. |
| Droits | Séparation des populations et options Boutiques/Commandes présentes ; contrôles applicatifs existants. | Des chemins d’édition legacy et des différences de garanties en base restent ouverts. Leur présence ne prouve pas à elle seule une exploitation possible. |

Les preuves techniques et leurs limites sont détaillées dans [le diagnostic](../../../docs/governance-audit/diagnostic-reprise-2026-10-05.md). « Disponible dans le code » et « testé localement » ne signifient pas « livré en production ».

## Lecture du statut du projet

Le backlog contient 202 stories : 47 `implemented`, 2 `verified`, 8 `in-progress` et 145 `not-started`. Côté spécification, 197 sont `draft` et 5 `contradictory` ; aucune n’est `approved`. Ces chiffres viennent des métadonnées Git, pas d’un audit fonctionnel exhaustif exécuté aujourd’hui. Ils ne permettent pas de calculer un pourcentage d’avancement fiable.

Les approbateurs restent à nommer dans `project/governance/roles.md`. Le dossier `project/sprints` ne contient encore que son README et son modèle : aucun sprint n’y sélectionne les prochains travaux. Le statut historique d’une story ne remplace ni sa relecture ni la recette de son parcours actuel.

## Réévaluation de HopeStudio

US-CONV-02 cesse d’être le candidat automatiquement retenu pour le prochain développement. C’est une recommandation de planification ; son statut n’est ni annulé ni passé à terminé.

La responsabilité des appels est désormais explicitée : la bibliothèque JavaScript HopeStudio orchestre ; Magrit relaie et importe. Créer une nouvelle API de génération Magrit ou des clés de service n’est pas un préalable de ce parcours. Les capacités d’intégration tierce d’E5.1/E5.2 restent des sujets distincts.

Avant toute nouvelle estimation, rapprocher US-CONV-02 et E1.WM1/E1.WM2/E1.WM3 des lots HSPQ déjà présents. Pour chaque exigence, consigner « couvert avec preuve », « présent à recetter » ou « manque confirmé ». Le statut `not-started` de ces stories ne permet pas d’en déduire que toute l’intégration est à reconstruire. Le sens fonctionnel de « hors couche conversationnelle » reste à préciser ; il ne supprime pas les sessions techniques du runtime.

## Lot fonctionnel recommandé

**Objectif proposé : depuis le back-office, ouvrir une commande boutique et disposer d’une fiche exploitable pour la traiter.** Le besoin est porté par [E4.4a](../../backlog/stories/E4.4a.md), en lien avec E4.4 et E10.16.

Deux étapes de livraison sont proposées au sein de ce cadrage. Elles ne constituent pas deux nouvelles stories approuvées.

1. **Consultation complète.** Ouvrir la commande depuis sa liste, afficher son identité, son origine, le client, les lignes et configurations enregistrées, quantités et totaux, état et historique disponible. Préserver l’isolation tenant et les règles de lecture. Critère de recette : la commande Atelier Lumière est ouvrable ; sa fiche correspond à la liste et reste consultable après rechargement, sans modifier ses données.
2. **Modification encadrée.** Exposer les actions et champs retenus dans une matrice d’édition. Réutiliser les transitions existantes lorsqu’elles répondent au besoin. Critère de recette : une modification autorisée est enregistrée, relue et tracée ; un refus ou un conflit ne produit pas de faux succès.

La consultation peut être cadrée sans attendre la refonte globale UM ni la fusion des deux menus. Pour l’édition, le besoin n’autorise pas implicitement la réécriture des prix, quantités ou configurations après engagement. Le gel des montants des commandes issues de devis reste applicable.

L’existant expose déjà des transitions, un audit et une édition de brouillon dans le module `orders`. Cette dernière porte sur des lignes et montants : son existence ne signifie pas qu’elle convient à une commande engagée. L’analyse d’impact doit identifier ce qui est réutilisable, les données manquantes et les éventuelles évolutions du contrat avant de dessiner ou coder une nouvelle fiche. Pas d’estimation en jours avant ce relevé.

## Décisions nécessaires et sujets séparés

| Point | Proposition à discuter | Effet sur le prochain lot |
|---|---|---|
| Choix du lot | Prendre E4.4a, avec consultation puis édition encadrée. | Conditionne la sélection du travail ; US-CONV-02 n’est plus retenue par défaut. |
| Champs et actions éditables | Établir la matrice champ/action × état × droit, à partir des règles existantes. Prix et modification des lignes exigent un traitement explicite. | Nécessaire avant de déclarer la partie édition prête. |
| Approbation et revue | Nommer les responsables produit, technique et de revue dans les artefacts prévus. | Permet de suivre le workflow d’approbation et de livraison sans attribuer ces rôles à l’agent. |
| Modèle UM | Relire la proposition de décision et traiter les écarts confirmés. | Chantier séparé ; une extension de droits dans la fiche doit toutefois respecter la cible retenue. |
| Deux listes de commandes | Examiner ultérieurement leur organisation ; rendre la fiche boutique accessible depuis sa liste actuelle. | Ne bloque pas la consultation d’une commande boutique. |
| Politique PIM | Clarifier taxonomie globale, activation par tenant et choix des sources catalogue boutique. | Ne bloque pas la fiche de la commande déjà créée. |
| Besoin restant HopeStudio | Réconcilier les stories avec l’existant et préciser le critère hors conversation. | Conditionne un éventuel futur lot HopeStudio, pas la fiche boutique. |

## Prochaine séquence de travail

Relire ce choix de lot et la matrice d’édition, compléter l’analyse d’impact d’E4.4a, puis faire approuver son périmètre et sélectionner le travail dans un sprint. L’implémentation viendra ensuite sur une branche fonctionnelle, avec revue distincte et recette de la commande boutique. Les changements de socle déjà commités peuvent faire l’objet d’une revue séparée ; leur publication reste à autoriser.

Le présent travail modifie uniquement la gestion de projet. Aucun module applicatif, contrat API, droit, statut d’approbation ou dérogation R5 n’est modifié. La vérification porte sur la structure des documents et le suivi du report ; aucun nouvel appel fournisseur ni test métier n’est lancé pour produire cette synthèse.

Validation documentaire : `pnpm project:refresh`, `pnpm project:validate` et `git diff --check` réussis ; les 10 tests de `pnpm test:project` passent. Le report est enregistré dans le suivi et le dashboard a été régénéré.
