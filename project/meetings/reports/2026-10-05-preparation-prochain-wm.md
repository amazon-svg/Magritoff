---
id: REPORT-2026-10-05-PREPARATION-WM
title: Ordre du jour proposé pour le prochain WM
date: 2026-10-05
status: draft
source: REPORT-2026-10-05-REPRISE-PROJET
---

# Ordre du jour proposé pour le prochain WM

Objectif : arrêter les règles qui conditionnent les prochains développements, choisir le lot à engager et organiser son approbation. La proposition porte sur le modèle de droits utilisateurs et la fiche des commandes boutique, en tenant compte de l’intégration HopeStudio déjà présente.

Préparation du 5 octobre 2026. Date de réunion à fixer ; durée proposée : 75 minutes. Participants proposés : Arnaud Mazon et Xavier Péchoultres, avec les intervenants nécessaires à l’analyse d’impact. Ce document est un ordre du jour en brouillon, pas un compte rendu, une invitation envoyée ou une décision prise.

## Documents à lire avant la réunion

- [Synthèse de reprise](2026-10-05-synthese-reprise-projet.md) : état du mandat, capacités présentes et prochain lot proposé.
- [Proposition de décision UM](../../decisions/product/PD-2026-10-05-UM-droits-utilisateurs.md) : cible, écarts portables et questions à trancher.
- [E4.4a](../../backlog/stories/E4.4a.md) : fiche de consultation et modification des commandes, rapprochée d’E4.4 et d’E10.16.
- [US-CONV-02](../../backlog/stories/US-CONV-02.md) : cadrage corrigé de HopeStudio et limites des preuves actuelles.

La [note du 4 octobre](2026-10-04-note-a-xavier-pechoultres.md) reste une source de constats historiques ; son interprétation de l’intégration Studio doit être lue avec l’actualisation du 5 octobre.

## Sources retrouvées après la préparation initiale

Les [comptes rendus ajoutés et leur relecture](2026-10-05-relecture-comptes-rendus-ajoutes.md) apportent trois repères : le RP du 28 août décide la séparation des populations et une fiche commande complète ; le WM du 21 septembre confie à Xavier la supervision des intégrations Git. Le WM doit examiner la conformité et les modalités restantes, sans rouvrir ces principes. La répartition des approbations produit non structurantes reste à préciser.

## Déroulement et résultats attendus

| Durée | Sujet | Décision ou résultat attendu |
|---|---|---|
| 5 min | État de la reprise | Partager ce qui est vérifié localement, ce qui est seulement documenté et ce qui reste à recetter ou publier. |
| 10 min | Responsables et approbations | Confirmer les approbateurs produit et technique, le relecteur des développements et le circuit de validation dans GitHub. |
| 15 min | Modèle de droits utilisateurs | Formaliser la décision UM déjà prise et examiner le traitement des anciens accès ; attribuer l’analyse des écarts techniques. |
| 20 min | Fiche des commandes boutique | Valider le besoin, les champs/actions modifiables, le découpage et les critères du prochain lot. |
| 10 min | PIM et sources des boutiques | Clarifier ce que le référentiel global impose et ce que chaque tenant ou boutique choisit ; attribuer les points restant ouverts. |
| 10 min | HopeStudio et backlog | Définir le besoin restant et le rapprochement des stories avec l’intégration existante, avant toute nouvelle estimation. |
| 5 min | Plan d’action | Retenir le lot, les responsables, les échéances et les décisions différées. |

## Responsables et circuit d’approbation

Répartition à formaliser : Arnaud Mazon est proposé pour la validation produit ; Xavier Péchoultres pour la validation technique et, selon sa demande du 5 octobre, les points produit non structurants. Préciser cette frontière sans lui réserver uniquement les décisions techniques. Désigner également la personne chargée de préparer chaque dossier et un relecteur distinct pour l’implémentation. Les rôles confirmés seront enregistrés dans `project/governance/roles.md`.

Confirmer le circuit proposé : PR documentaire dédiée à UM, revue explicite des règles et des écarts, puis propagation de la décision dans les sept stories concernées. Une fusion seule ne vaut pas approbation produit. Si l’accord est donné pendant le WM, consigner son auteur, sa date et son périmètre dans le compte rendu, puis faire confirmer sa restitution dans la PR. Les documents approuvés référencent cette preuve ; une question encore ouverte conserve son statut.

## Cible UM à discuter

1. Reprendre la séparation des utilisateurs internes Magrit et des clients boutique confirmée par le RP du 28 août, en complément de la trace UM validée du 14 août. Examiner sa conformité et les sources des détails de droits.
2. Reprendre les options Boutiques et Commandes de la décision historique pour les membres internes, avec administration réservée aux administrateurs. Préciser que « admin unique » ne signifie pas une seule personne administratrice par tenant.
3. Décider du traitement de `shop_only` et des anciens champs de droits encore éditables : création fermée, maintien éventuel en lecture, migration ou autre règle explicite.
4. Attribuer l’analyse des garanties à porter dans les services et en base. La règle produit doit précéder le choix du correctif technique.

Sortie attendue : décision UM historique formalisée et toute évolution nouvelle distinguée, questions techniques restantes attribuées, puis finalisation d’E9.1, E9.2, E9.3, E9.9, E9.10, E9.13 et E10.11. Aucun passage automatique à `ready` si leurs critères restent contradictoires.

## Périmètre de la fiche commande

Proposition : retenir E4.4a comme prochain lot fonctionnel, avec consultation complète puis édition encadrée. La commande passée dans Atelier Lumière sert de cas de recette. La fiche commerciale existante ne prouve pas la couverture de cette origine boutique.

Une première matrice et l’analyse d’impact sont consignées dans E4.4a. Relire en séance la matrice **champ ou action × état de commande × droit requis × effet sur le prix**. Examiner au minimum :

- validation, annulation et étapes de production ;
- notes et références ;
- coordonnées et livraison ;
- lignes, quantité et configuration ;
- montants et mécanisme de correction après engagement.

Pour chaque élément, décider « consultable », « modifiable sous conditions » ou « hors du lot », puis décrire les conditions. Le gel des montants des commandes issues de devis reste la règle existante tant qu’aucune décision explicite ne le remplace.

Sortie attendue : périmètre produit utilisable pour l’analyse d’impact et l’approbation. La fusion des deux listes « Commandes » et « Commandes atelier » peut être différée ; elle n’empêche pas d’ouvrir une fiche depuis la liste boutique actuelle. L’estimation et la sélection dans un sprint suivent l’analyse d’impact, pas le seul accord sur un intitulé.

## Politique PIM et bibliothèques

Le JSON conserve 81 gammes globales et le seed les synchronise. Il ne constitue pas une bibliothèque de produits tarifés. La sélection faite dans Atelier Lumière est locale et n’a pas décidé d’une hiérarchie obligatoire pour toutes les boutiques.

Décider ou attribuer explicitement : statut du référentiel global (référence commune ou structure obligatoire), possibilités d’extension par tenant, activation des gammes, sélection des sources catalogue par boutique et comportement attendu après mise à jour du JSON. Distinguer mise à jour du référentiel et publication de produits dans une boutique.

Sortie attendue : règle produit ou questions attribuées, sans imposer implicitement les 81 gammes à tous les utilisateurs. Les compléments de catalogue ne bloquent pas la fiche de la commande déjà créée.

## HopeStudio et priorité des stories

Xavier porte le pilotage et la validation produit et technique de HopeStudio, ainsi que l’arbitrage d’E1.WM1/E1.WM2/E1.WM3, selon ses précisions du 5 octobre consignées dans les rôles. Les questions propres à ce périmètre lui sont soumises directement ; le WM traite les engagements et impacts communs à Magrit.

Le [parcours chat vers devis est accepté par Xavier côté Magrit](../../decisions/product/PD-2026-10-05-HopeStudio-parcours-valide-et-suite.md). Le module configure les API et callbacks appelés par HopeStudio ; la reprise de chat projet et l’import des lignes avec prix, descriptif technique et documents sont validés. Ce parcours ne constitue plus un lot à engager.

Préparer les suites indiquées par Xavier :

- formulaire produit provenant du PIM et enrichi de données HopeStudio ;
- chat actif en boutique, avec son contexte et sa destination métier ;
- vérification des marges : coûts de production reçus, règles appliquées, gamme, prix client et absence de double application.

Sortie attendue : cadrage des suites et attribution des vérifications. La chaîne du devis applique déjà un moteur de prix ; son appel sans gamme constitue un point à vérifier, pas une preuve que toutes les marges manquent. Les autres critères historiques E1.WM* sont rapprochés du périmètre accepté sous l’arbitrage de Xavier, sans recréer l’intégration.

## Points préparés pour une validation de Xavier

Proposition à confirmer, sans nouvel arbitrage de droits ou de prix :

1. Livrer d’abord la consultation complète d’une commande boutique depuis sa liste actuelle, avec une adresse permettant son rechargement.
2. Conserver l’organisation actuelle des listes pendant ce lot ; traiter leur éventuelle fusion séparément.
3. Cadrer ensuite l’édition : réutiliser les transitions existantes, sans ouvrir implicitement aux gestionnaires la modification des lignes, quantités, configurations ou montants.

Cette validation porte sur la proposition de découpage ; elle ne vaut pas nomination générale des approbateurs, approbation de nouvelles règles métier ou autorisation de publication Git. La date, l’auteur et le périmètre de la réponse seront enregistrés après son obtention.

## Revue des commits et clôture

La branche de reprise contient les changements PIM, tests/CI et documents de cadrage, sans publication effectuée dans cette session. Désigner leur relecteur et décider du découpage des PR et de leur publication. Cette revue technique reste distincte de l’approbation des règles produit.

Avant la fin du WM, renseigner une ligne par décision ou action : **résultat, auteur de l’accord, responsable de la suite, échéance, artefacts à mettre à jour**. Pour un sujet différé, noter son motif et la date ou condition de reprise. Les autres questions du [registre](../../decisions/open-questions.md), notamment les parcs de franchises et les workers, sont à planifier séparément si elles ne conditionnent pas le lot retenu.

Après le WM : déposer le compte rendu daté, mettre à jour les décisions et stories concernées, puis leur suivi. Les validations effectives seules permettent les changements de statut. Aucun sprint, approbateur ou arbitrage n’est adopté par cet ordre du jour.

Préparation documentaire uniquement : aucun module applicatif, contrat API ou droit modifié ; aucune dérogation R5. Structure et suivi vérifiés avec `pnpm project:refresh`, `pnpm project:validate` et `git diff --check`. Aucun test métier ni appel fournisseur nécessaire à cette préparation.
