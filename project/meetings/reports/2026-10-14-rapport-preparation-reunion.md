---
id: REPORT-2026-10-14-PREPARATION-REUNION
title: Préparation du WM Magrit du 14 octobre 2026
date: 2026-10-14
status: draft
source: Demande de Xavier dans le chat du 14 octobre 2026 ; confirmation de la décision de mise en préproduction sur VPS
---

# Réunion Magrit — mercredi 14 octobre 2026

Objectif : présenter les réalisations, prendre les arbitrages encore nécessaires et convenir du plan de travail pour la semaine du 19 au 23 octobre.

Ce document prépare la réunion : les propositions de priorités, de responsables et d'échéances restent à valider en séance. Le bilan repose sur les éléments versionnés dans le dépôt ; l'état de déploiement reste à confirmer.

## 1. Bilan de la semaine du 5 au 11 octobre

### Commandes et pilotage

- Unification des commandes boutique et des commandes issues de devis : stockage, liste, fiche de consultation et exports communs.
- Harmonisation du statut visible ; validation depuis la fiche et validation en lot.
- Consultation et modification des informations de suivi, accès au client et à la commande depuis la liste.
- Regroupement des exports et correction de la lecture des annexes des commandes boutique.

### Boutique et produits

- Recette navigateur du parcours recherche → configuration → panier → confirmation, sur mobile et ordinateur. Pour les produits configurables, les appels de prix et la persistance sont simulés dans cette recette ; le calcul fournisseur réel reste à vérifier.
- Produits à coût unitaire fixe : création en back-office, publication en boutique, application des marges, ajout direct au panier et commande persistée dans une base réelle isolée.
- Exemple vérifié : coût de 100 € HT, vente de 125 € HT avec la règle de marge testée à 25 %, trois unités pour un total de 375 € HT / 450 € TTC dans le scénario de recette.
- Adoption du vocabulaire « catégorie de produits » dans les écrans ; « gamme » reste réservé à la fabrication.

### Back-office et clients boutique

- Réorganisation de l'éditeur de boutique, clarification des actions et états, protection des saisies et amélioration de la navigation mobile.
- Regroupement des paramètres de publication et d'accès dans les informations générales.
- Suppression du doublon de navigation « Prix & marges » ; entrée « Règles de prix » conservée.
- Fiche client avec informations générales, chiffre d'affaires et commandes ; pagination des clients et commandes.
- Désactivation d'un client avec révocation des sessions, puis réactivation possible ; commandes conservées.

### Bons PDF, gabarits et pièces jointes

- Génération du bon PDF depuis une commande boutique et conservation du document produit.
- Messages explicites lorsque le gabarit nécessaire manque ou n'est pas configuré ; accès à sa configuration.
- Parcours de dépôt public et de téléchargement testé, avec contrôles de jeton, expiration, révocation et quota.
- Conservation des reçus de dépôt pendant la visite, y compris après erreur et reprise.
- Correction du placement des champs PDF à la souris et amélioration du guidage après placement.
- Réglage des champs et du tableau en millimètres ; bornes de déplacement et de saisie ajoutées le 10 octobre.

### Gouvernance et décisions

- Arbitrages des 7 et 8 octobre intégrés et approuvés dans le dépôt.
- Points projet et rapports consultables depuis le tableau de bord de pilotage.
- Les expéditions et le suivi de colis restent reportés au futur périmètre MIS.

### Complément du lundi 12 octobre

- Copie d'un positionnement PDF de base ou des placements d'un autre gabarit compatible, puis ajustement, aperçu et enregistrement explicites.
- Fusion du lot boutiques, produits à coût fixe, clients, annexes et PDF dans `main` le 12 octobre, via la PR n° 45.
- Contrôles finaux consignés : 3 168 tests réussis, 184 ignorés, 12 tests PostgreSQL/S3 et 22 parcours Chromium réussis ; typage, build et contrat OpenAPI vérifiés.

### Ce qui reste à valider en recette

- Démonstration complète avec calcul fournisseur réel pour les produits configurables.
- Configuration et génération du bon avec le gabarit métier réel **BC 2026**.
- Validation métier des fonctionnalités implémentées : les tests et la fusion ne valent pas approbation produit de chaque story.
- Déploiement du lot sur l'environnement de préproduction et vérification des migrations nécessaires.

## 2. Décision déjà validée : préproduction sur VPS

**La mise en préproduction sur un VPS est validée**, conformément à la confirmation de Xavier dans le chat du 14 octobre. Cette décision actualise, pour la préproduction, l'ancienne piste Clever Cloud mentionnée au WM du 7 octobre.

Le choix du VPS est acquis. Les éléments opérationnels à confirmer pendant la réunion sont :

- état de préparation du VPS et accès nécessaires ;
- responsable de la mise en place et du déploiement ;
- date de disponibilité et adresse d'accès pour la recette ;
- configuration des services, de la base, du stockage des fichiers et des intégrations ;
- migrations 0095, 0096 et 0097 à vérifier et appliquer sur la cible avant activation du lot concerné.

Aucune mise en service effective n'est attestée par les éléments consultés. La décision de préproduction ne fixe pas à elle seule l'hébergement de production.

## 3. Arbitrages à réaliser aujourd'hui

| Point | Éléments disponibles | Décision attendue |
|---|---|---|
| Périmètre de la bêta avancée | Boutique, commandes, clients et documents ont progressé ; plusieurs suites restent ouvertes. | Fixer les fonctions indispensables, les critères de validation et les améliorations reportées. Proposition : prioriser la recette sur VPS et la fiabilité de la chaîne d'achat. |
| HopeStudio : formulaire et cartes produit | Le recalcul après modification est décidé. Les données PIM, leur priorité et l'interaction de personnalisation restent à préciser. | Définir les données du formulaire et le parcours de personnalisation qui conserve l'utilisateur dans la liste de produits. |
| HopeStudio : chat et marges | La destination des résultats du chat et le raccordement des marges jusqu'au devis ou à la boutique restent ouverts. | Choisir le premier parcours à livrer, sa destination (panier ou devis), le rattachement éventuel à une catégorie et le retour du prix margé. |
| Calcul sur plusieurs parcs/fournisseurs | Le calcul entre espaces sans consultation des paramètres est admis ; plusieurs parcs et des abonnements externes sont envisagés. | Préciser le choix des résultats, les droits de relais externe, l'activation/révocation des accès et l'orchestration des fournisseurs. |
| TVA par ligne | Le principe est décidé ; les règles détaillées, remises, arrondis, données de livraison Clariprint et référence UBL restent à qualifier. | Nommer le référent fiscal/comptable, fixer le premier lot et affecter le travail Clariprint sur les destinations et livraisons. |
| Administration GitHub | Le transfert du dépôt pour attribuer les droits d'administration a été prévu au dernier WM ; son achèvement n'est pas attesté ici. | Confirmer l'état, le responsable et l'échéance de cette action. |

Les droits utilisateurs et la navigation espace/sous-espaces nécessitent d'abord une vérification de l'existant : le modèle séparant utilisateurs internes et clients boutique est déjà décidé. Relever les écarts avant de proposer de nouveaux arbitrages.

## 4. Plan de travail proposé — du 19 au 23 octobre

Les responsables ci-dessous reprennent les engagements précédents ou constituent des propositions à confirmer en séance. Les dates sont des cibles proposées.

| Priorité | Travail concret | Livrable ou critère de fin | Responsable proposé | Cible proposée |
|---|---|---|---|---|
| 1 — Préproduction VPS | Préparer l'environnement, configurer les services et accès, déployer la version retenue et appliquer les migrations nécessaires. | Préproduction accessible ; API, base, stockage et intégrations vérifiés. | Xavier pour le déploiement ; appui infrastructure et répartition avec Arnaud/Manu à confirmer. | Début de semaine, avant la recette partagée. |
| 2 — Recette métier complète | Tester catalogue → prix → panier → commande → fiche commune → PDF → dépôt de fichiers sur le VPS ; inclure le calcul fournisseur réel, le parcours à coût fixe et BC 2026. | Résultats consignés, anomalies classées, fonctions présentées à l'approbation métier. | Xavier ; participants à la recette à confirmer. | Première recette avant le 21 octobre. |
| 3 — Corrections et validation bêta | Corriger les anomalies bloquantes de recette et rejouer les parcours concernés. | Version de préproduction prête pour les testeurs dans le périmètre validé. | Xavier. | 23 octobre. |
| 4 — Cadrage HopeStudio | Définir formulaire, cartes, destination du chat, catégorie et marges ; développer seulement le lot retenu selon la capacité disponible. | Un lot cohérent avec critères d'acceptation et priorité explicites. | Xavier, avec validation des règles commerciales par le responsable à désigner. | Cadrage au plus tard le 21 octobre. |
| 5 — Accès et sous-espaces | Vérifier séparation des populations, anciens chemins de droits, contrôles API/base et retour vers l'espace principal. | Liste des écarts, preuves de contrôle et corrections prioritaires. | Xavier. | 23 octobre. |
| 6 — Administration du dépôt | Confirmer le transfert et mettre en place les droits et protections convenus, si l'action reste ouverte. | Administration GitHub et règles de branche vérifiées. | Arnaud, avec Xavier. | Date à arrêter aujourd'hui. |
| 7 — GelatoConnect | Confirmer la transmission des accès, lire l'analyse et examiner les idées utiles avant la fin de l'essai. | Liste courte d'améliorations à prioriser dans le backlog. | Arnaud pour les accès ; Xavier et Laurent pour la lecture. | Au plus tard le 20 octobre, fin de l'essai annoncée au dernier WM. |

La recette sur VPS et les corrections bloquantes constituent la priorité proposée. Le cadrage fiscal et des parcs doit recevoir un responsable et une échéance en séance, avant engagement de leur développement.

## 5. Résultats attendus à la clôture de la réunion

- Périmètre de bêta et critères de recette confirmés.
- Responsable, date de disponibilité et participants à la recette de préproduction VPS identifiés.
- Premier lot HopeStudio défini.
- Référent fiscal/comptable et suites Clariprint affectés.
- Actions GitHub, droits et parcs datées selon leur priorité.
- Pour chaque action retenue : un responsable, un livrable et une échéance.

## Sources

- [Compte rendu du WM du 7 octobre](../2026/CR_WM071026_Magrit_IA.md).
- [Point projet et réalisations du 9 octobre](2026-10-09-rapport-point-projet-et-reprise.md).
- [Calage des gabarits du 10 octobre](2026-10-10-calage-gabarits-pdf.md).
- [Complément et contrôles finaux du 12 octobre](2026-10-12-modele-positionnement-pdf.md).
- [Questions ouvertes](../../decisions/open-questions.md).
- Historique Git local : fusion `f26d6f45` du 12 octobre 2026.
- Confirmation de Xavier dans ce chat : mise en préproduction sur un VPS déjà validée. Cette confirmation prévaut sur l'ancienne piste de préproduction.
