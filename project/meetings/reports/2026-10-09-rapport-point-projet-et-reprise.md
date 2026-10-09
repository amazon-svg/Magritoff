---
id: REPORT-2026-10-09-POINT-PROJET-REPRISE
title: Point projet et reprise après les arbitrages des 7 et 8 octobre
date: 2026-10-09
status: draft
source: Demande de Xavier dans le chat du 9 octobre 2026 — faire un point projet et continuer si possible
---

# Point projet et reprise — 9 octobre 2026

## État constaté

Référence examinée : `279d79c3`, sur `main`. Après actualisation des références
Git, `origin/main` est à `08a1acdf` : la copie locale possède un commit
supplémentaire, qui fait démarrer la stack complète avec `pnpm dev`.
Ce constat décrit le dépôt et les contrôles locaux, sans preuve de déploiement.

Le backlog contient 18 epics, 25 fonctionnalités et 207 stories : 11
`verified`, 50 `implemented`, 7 `in-progress` et 139 `not-started`. Les statuts
de spécification sont 3 `approved`, 3 `contradictory` et 201 `draft`.
Ces statuts documentaires ne constituent pas une mesure de couverture du code :
E4.2 décrit notamment des capacités présentes alors que son statut reste
`not-started`. Une réconciliation sur preuves reste nécessaire.

Les décisions des 7 et 8 octobre sont intégrées au dépôt et approuvées.
Le lot commandes possède une liste et une fiche communes, un statut visible,
des fichiers et des exports. Le parcours Magrit/HopeStudio est enregistré
comme implémenté dans US-CONV-02 ; les suites formulaire, boutique et marges
sont distinguées dans les questions ouvertes. Les expéditions sont reportées
au futur périmètre MIS. Le vocabulaire PIM est désormais « catégorie de
produits », et la modification d'un produit HopeStudio doit déclencher son
recalcul.

## Priorités pour la démonstration

Le WM du 7 octobre prévoit une bascule vers la boutique le 9 octobre et une
démonstration complète commande/boutique durant la semaine du 12 octobre.
Cette demande ne fixe pas de nouveau périmètre fonctionnel.

1. Préparer une recette boutique reproductible : recherche, configuration,
   prix, panier, commande et consultation dans la fiche commune ; relever les
   écarts avant d'ajouter de nouvelles capacités.
2. Cadrer les cartes et le formulaire HopeStudio à partir de l'intégration
   existante, avec leurs données PIM et la destination des résultats du chat
   (`OQ-HS-PIM-FORM`, `OQ-HS-SHOP-CHAT`, `OQ-HS-MARGINS`).
3. Vérifier les droits hérités et la navigation espace/sous-espace
   (`OQ-UM-PORTABLE`, `OQ-B3-NAVIGATION`).
4. Réconcilier progressivement les statuts des stories avec les preuves
   actuelles, sans transformer un test technique en approbation produit.

Les dossiers encore ouverts restent consignés dans le registre canonique :
TVA par ligne (`OQ-TVA-LIGNE`), accès de calcul aux parcs/fournisseurs
(`OQ-B3-PARC-CALCUL`) et transfert du dépôt pour l'administration GitHub.
La fiscalité et les accès externes ne sont pas développés dans ce lot.

## Suite réalisée : vocabulaire visible des catégories

Application de la décision approuvée `PD-2026-10-07-PIM-CATEGORIE` : correction
des titres, aides, filtres, états vides, libellés de recherche et noms
accessibles dans les écrans PIM, boutique, règles de prix, bibliothèques et
espaces. La navigation affiche « Catégories actives ». Les sous-catégories
existantes conservent leur hiérarchie.

Les identifiants techniques, routes, contrats API, données et règles de calcul
conservent leur forme actuelle, comme prévu par la décision. Les messages des
services et le vocabulaire des prompts ne sont pas couverts par ce lot
strictement visible. Le test existant du registre des contributions attend
maintenant le libellé approuvé. Aucun statut produit n'est modifié par l'agent.

Travail isolé sur `codex/point-projet-categories`, dans
`/private/tmp/magrit-point-20261009`. La modification préexistante de
`.gitignore` dans la copie principale est conservée. Aucun push ni fusion.

## Vérifications et limites

- Typage modulaire et build : réussis avant et après les changements.
- Validation projet : réussie ; les 207 stories sont structurellement valides.
- Validation des spécifications auditables : réussie avec **zéro spécification
  importée** ; elle ne prouve donc aucune conformité fonctionnelle.
- Suite avant changement : 3 137 tests réussis, 165 ignorés, cinq échecs HTTP
  causés par `listen EPERM` dans le bac à sable.
- Suite après changement avec sockets locaux autorisés : les cinq tests HTTP
  passent. L'ancienne assertion « Gammes actives » a été actualisée et son
  fichier de 23 tests a été rejoué avec succès.
- Suite finale : **320 fichiers réussis, 53 ignorés ; 3 142 tests réussis,
  165 ignorés**. Les tests du pilotage et du dashboard sont inclus. Le
  dashboard recense 14 questions ouvertes.
- La suite finale et les contrôles du dashboard sont consignés dans les logs
  locaux `/tmp/magrit-point-20261009-*.log` ; ces fichiers temporaires ne sont
  pas des preuves archivées en CI.

Les intégrations PostgreSQL, S3 et fournisseur ignorées par la suite standard
ne sont pas présentées comme validées. Aucune recette visuelle navigateur,
recette fournisseur réelle ou certification d'accessibilité n'est revendiquée.

## Rapport de sortie R8

Modules touchés : `catalog`, `commercial`, `pricing`, `libraries`, `shops`,
`tenants` (présentation uniquement), ainsi que le test du registre des surfaces
et ce rapport de pilotage. API créée ou modifiée : aucune. Dérogation R5 :
aucune. Le registre des rapports et le dashboard sont régénérés pour rendre ce
point consultable dans le pilotage du projet. La relecture distincte et
l'approbation de la livraison restent à réaliser avant fusion.
