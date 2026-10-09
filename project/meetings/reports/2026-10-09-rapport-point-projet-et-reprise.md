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

## Suite du 9 octobre — recette navigateur boutique

Mandat : « continue » dans le chat, après le point projet. Branche de suite :
`codex/recette-boutique`, issue du commit `6f21cdc8` qui conserve le lot de
catégories. La copie principale reste sur `main` avec son `.gitignore`
préexistant ; aucun push, déploiement ou fusion.

La boutique UX locale a été observée dans Chromium : catalogue de 82 produits,
recherche de Flyer A5 et accès à sa configuration. Les appels de prix et IA
sont interceptés pour la suite du parcours : cette observation ne constitue
pas un chiffrage fournisseur réel.

Deux défauts de recherche sont corrigés dans `catalog` : champ catalogue sans
nom accessible et identifiant de menu partagé par les headers mobile/desktop.
Le champ est nommé « Rechercher dans le catalogue » ; chaque instance du
header crée son identifiant avec `useId`. Aucun contrat API, droit, prix ou
modèle de données n'est modifié, aucune dérogation R5 n'est introduite.

La nouvelle recette `tests/e2e/storefront-purchase-flow.spec.ts` passe : trois
tests Chromium, dont les deux largeurs 390/1280 pixels. Le parcours vérifie
la recherche clavier, la configuration, le panier, la séparation de session
boutique et la confirmation. Il contrôle un pack de 500 exemplaires à
125,00 € HT, transporté en décimal `125.00`, avec une clé d'idempotence.
Le bouton de commande est désactivé avant connexion. L'éditorial IA absent
est simulé pour vérifier le repli déterministe.

Les API et la persistance sont simulées et les appels inattendus font échouer
la recette d'achat. Aucun compte, email ou commande réelle n'est créé. La
création PostgreSQL et la consultation de cette nouvelle commande dans la
fiche commune restent à vérifier séparément ; les intégrations fournisseur
réelles ne sont pas revendiquées.

Le workflow navigateur inclut désormais ces trois tests, avec archivage des
captures ; son exécution GitHub n'est pas revendiquée. Le typage modulaire et
le build passent. La suite de régression compte 3 142 tests réussis et
165 ignorés ; les dix tests de pilotage passent après actualisation du
rapport. La documentation de reproduction est dans
`docs/testing/storefront-browser.md` et les logs locaux dans
`/tmp/magrit-shop-*.log`. Le rapport et le dashboard sont actualisés.


## Suite — produits à coût unitaire fixe

Demande explicite de Xavier : distinguer les produits à prix fixe des produits
configurables et valider création back-office, mise à disposition en boutique,
affichage avec marge, panier et commande. Clarification reçue : « Coût HT,
marge appliquée par Magrit ». Le raccordement variable à HopeStudio annoncé
pour cet après-midi reste distinct. La story E4.FIXED-PRICE est créée en brouillon,
avec livraison implemented et preuve dans son document d'implémentation.

Branche de suite `codex/produits-prix-fixe`. Création manuelle, calcul commun
catalogue/commande par PricingEngine, unités et ajout direct sans configuration.
Le tiroir panier est corrigé pour que nom et quantité restent lisibles. Aucun
nouveau contrat HTTP ; migration interne 0095 nécessaire. Aucune dérogation R5.

Recette réelle isolée réussie : dix tests PostgreSQL, puis un test Chromium
créant et publiant une fiche, commandant trois unités et relisant la commande
persistée depuis le back-office. Coût 100 € HT, vente 125 € HT avec marge de
25 %, total 375 € HT / 450 € TTC. Aucun appel de chiffrage fournisseur.
La régression générale passe : 3 143 tests réussis, 175 ignorés ; typage
modulaire et build passent. La suite PostgreSQL générale reste limitée par un test S3 de lecture après
suppression (168/169 réussis au second passage), indépendant de ce parcours.

La copie principale et les données métier existantes restent préservées ;
aucun push, fusion ou déploiement. La recette reproductible est documentée dans
`docs/testing/fixed-price-purchase.md`. Revue indépendante et approbation humaine
restent à réaliser.

## Accès au test manuel dans le dossier habituel

À la demande explicite de Xavier, les copies Git séparées ne sont plus utilisées
pour cette suite de travail. La branche `codex/produits-prix-fixe` est transférée
dans `/Users/xpech/dev/Magritoff` et rebasée sur le dernier `main`, qui conserve
le commit utilisateur `448d5f6c` de `.gitignore`. La copie temporaire est retirée.
Le code et le serveur de développement utilisent désormais le même dossier.

La migration 0095 est appliquée à la seule base locale de développement
`127.0.0.1:55432/magrit` ; aucune donnée produit ou commande n'est modifiée.
L'interface est accessible sur `http://localhost:5176`, avec son API sur 8787.
La réponse Vite du détail de bibliothèque contient le nouveau formulaire et
le healthcheck de l'API répond 200. Aucun push ni fusion dans `main`.

## Entrée unique pour les règles de prix

Demande de Xavier : supprimer « Prix & marges » après constat de deux entrées
concurrentes. L'entrée du module commercial est retirée de la navigation ;
« Règles de prix » reste visible. Les données et la route historique ne sont
pas supprimées. Aucun changement API ni dérogation R5. Vérification : 23 tests
du registre des contributions réussis et typage modulaire valide.
