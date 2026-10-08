---
id: REPORT-2026-10-07-POINT-PROJET-ORDRE-DU-JOUR
title: Point projet et ordre du jour proposé pour le prochain WM
date: 2026-10-07
status: draft
source: REPORT-2026-10-05-PREPARATION-WM
---

# Point projet et ordre du jour proposé pour le prochain WM

Ce document actualise l'[ordre du jour préparé le 5 octobre](2026-10-05-preparation-prochain-wm.md).
Il ne constitue ni un compte rendu ni une décision. La date, les participants
et les décisions proposées doivent être confirmés. Durée recommandée : **90
minutes**, afin de traiter les arbitrages sans rouvrir les chantiers déjà
livrés.

## Objectif de la réunion

1. constater les capacités désormais livrées et fermer les sujets devenus
   caducs ;
2. rendre les arbitrages qui débloquent les prochaines stories autonomes ;
3. attribuer les dossiers qui exigent une expertise produit, fiscale ou
   métier ;
4. retenir un ordre d'exécution après la réunion, avec un responsable et une
   échéance pour chaque suite.

## État au 7 octobre 2026

L'état ci-dessous est calculé depuis les sources Git au commit `8b1ce6ab` :

- 18 epics, 25 fonctionnalités et 207 stories ;
- 11 stories `verified`, 50 `implemented`, 7 `in-progress` et 139
  `not-started` ;
- 3 spécifications `approved`, 3 `contradictory` et 201 `draft` ;
- 20 questions ouvertes ;
- 17 documents de réunion ou rapports encore à traiter : 7 en revue et 10 en
  brouillon.

Depuis le point du 5 octobre, les lots fusionnés depuis la PR `#31` ont
notamment livré :

- une liste, une fiche et un stockage communs pour toutes les commandes ;
- la consultation et l'édition encadrée de la référence client et des notes ;
- les fichiers, liens de dépôt et exports sur la fiche commune ;
- un panneau d'exports repliable et la suppression des exports terminés ou en
  échec ;
- un statut visible commun, son historique, la validation unitaire et en lot,
  et les gardes entre statut administratif et étape de production ;
- la correction de plusieurs défauts boutique : accessibilité des filtres et
  du panier, réintégration de produits, avertissements de prix marché et thème
  sombre par défaut ;
- une discipline Git qui régénère le dashboard après rebase et refuse un push
  lorsque le résultat n'est pas commité.

La fiche commande, la double liste, le statut et les exports ne sont donc plus
des arbitrages du prochain WM. Une recette ciblée peut relever des défauts,
mais elle ne doit pas rouvrir le modèle commun sans nouvel élément métier.

## Préparation attendue

- **Arnaud Mazon** : position produit sur le prix de renouvellement, le droit
  d'acquitter un prix non vérifié et le bouton « Personnaliser ».
- **Xavier Péchoultres** : proposition de vocabulaire PIM et avis sur le
  contexte tarifaire des lignes libres ; identification de l'administrateur
  GitHub pouvant rendre le contrôle de rebase obligatoire.
- **Responsable fiscal/comptable à nommer** : capacité à prendre en charge les
  règles de TVA par ligne, de remise et d'arrondi.
- **Responsable commandes/logistique à nommer** : besoin réel de livraison
  partielle et visibilité du suivi pour le client.

Documents à lire avant la séance :

- [questions ouvertes](../../decisions/open-questions.md) ;
- [droits utilisateurs](../../decisions/product/PD-2026-10-05-UM-droits-utilisateurs.md) ;
- [E10.22 — lignes libres et marges](../../backlog/stories/E10.22.md) ;
- [E10.23 — TVA par ligne](../../backlog/stories/E10.23.md) ;
- [E10.24 — expéditions et suivi](../../backlog/stories/E10.24.md) ;
- [décision sur le statut visible des commandes](../../decisions/product/PD-2026-10-06-commandes-statut-unique.md).

## Ordre du jour proposé

| Durée | Sujet | Résultat attendu |
|---:|---|---|
| 10 min | Point d'avancement | Confirmer les lots commandes et boutique livrés ; relever uniquement les défauts de recette encore reproductibles. |
| 10 min | Gouvernance et intégration Git | Nommer les approbateurs produit et technique hors HopeStudio ; attribuer l'activation administrative du contrôle « Branche à jour avec main ». |
| 20 min | Marges des lignes libres | Trancher la catégorie facultative ou obligatoire, le cas « hors catalogue », le comportement sans marge et le recalcul après changement de catégorie (`E10.22`). |
| 20 min | TVA par ligne | Décider le périmètre du premier lot et attribuer les règles fiscales : source de qualification, remises, arrondis, correction et profil électronique cible (`E10.23`). |
| 10 min | Expéditions et suivi | Trancher le rattachement aux lignes/quantités, l'effet sur l'étape de production et la visibilité client (`E10.24`). |
| 10 min | Décisions courtes boutique | Confirmer le prix du jour au renouvellement, le droit d'acquitter un prix non vérifié et le retrait ou l'état désactivé de « Personnaliser ». |
| 5 min | Blocages structurants | Prioriser les dossiers droits utilisateurs et sous-espace ↔ parc ; fixer leur responsable et leur séance de travail. |
| 5 min | Plan d'action | Choisir le prochain lot, ses responsables, les échéances et les artefacts à mettre à jour. |

## Arbitrages à rendre en séance

### A1 — Contexte tarifaire d'une ligne libre (`E10.22`)

Décider ensemble :

1. catégorie de produits obligatoire, facultative avec avertissement, ou choix
   explicite « hors catalogue » ;
2. sans règle de marge : autoriser 0 %, exiger une saisie explicite, ou bloquer
   l'envoi du devis ;
3. après changement de catégorie : recalcul automatique ou confirmation avant
   d'écraser le prix courant.

Proposition à débattre : catégorie facultative avec un choix explicite « hors
catalogue » ; aucun envoi silencieux à 0 % ; confirmation avant tout recalcul
qui remplace un prix saisi manuellement. Cette option conserve les cas hors
catalogue tout en rendant l'absence de marge visible.

### A2 — TVA par ligne et facturation électronique (`E10.23`)

Le besoin de TVA par ligne est établi, mais son développement ne doit pas
commencer sans responsable fiscal. La réunion doit décider :

- si le premier lot rend le modèle et les documents prêts, sans encore émettre
  de facture électronique ;
- quelle donnée qualifie la TVA d'une ligne et qui peut la corriger ;
- comment une remise globale se répartit entre plusieurs taux ;
- à quel niveau la TVA est arrondie ;
- quel profil sert de première preuve : UBL, CII ou Factur-X.

Si l'expertise nécessaire n'est pas présente, la bonne sortie de séance est
une attribution et une date de cadrage, pas une règle fiscale improvisée.

### A3 — Expéditions partielles et suivi (`E10.24`)

Décider si le premier lot représente :

- plusieurs suivis attachés seulement à la commande ; ou
- des expéditions rattachées aux lignes et quantités réellement expédiées.

Le second modèle est nécessaire pour expliquer une livraison partielle ; le
premier est plus rapide mais ne sait pas dire ce qui se trouve dans chaque
colis. Il faut aussi décider si l'ajout d'un suivi propose une nouvelle étape
de production ou reste totalement indépendant, et si le suivi apparaît dans le
portail client dès ce premier lot.

### A4 — Trois décisions courtes à fermer

| Question | État actuel | Décision attendue |
|---|---|---|
| `OQ-RENOUVELLEMENT-PRIX` | Le prix du jour est recalculé et un avertissement apparaît au panier. | Confirmer ce comportement ou exiger la reprise du prix payé. |
| `OQ-Q19-ACQUITTER` | Toute personne pouvant valider peut aussi acquitter un prix non vérifié. | Confirmer cette équivalence ou nommer une capacité plus étroite. |
| `OQ-Q16-PERSONNALISER` | Le bouton est actif mais ne réalise aucune action utile. | Le retirer jusqu'à disponibilité, ou le désactiver avec une explication visible. |

Ces décisions peuvent fermer trois questions sans lancer un grand chantier de
conception.

## Dossiers structurants à attribuer

### Droits et approbations

`OQ-GOV-ROLES` empêche toujours de passer les spécifications importées à
`approved`. La réunion doit confirmer l'autorité produit hors HopeStudio,
l'autorité technique et la frontière des points produit non structurants pris
en charge par Xavier.

`OQ-UM-PORTABLE` doit ensuite formaliser les droits historiques, le traitement
des accès hérités et les garanties côté services et base. Ce dossier conditionne
la finalisation de plusieurs stories utilisateurs ; il mérite une séance de
travail dédiée si les sources ne peuvent pas être relues pendant le WM.

### Sous-espace et parc machines

`OQ-B3-PARC` bloque au moins quinze stories. Il faut désigner un responsable et
une date pour répondre à deux questions distinctes :

1. un sous-espace possède-t-il son parc, hérite-t-il d'un parc ou référence-t-il
   un parc partagé ?
2. quels droits de lecture, d'administration et de consolidation le groupe
   exerce-t-il sur ses filiales ?

La réunion peut attribuer ce dossier sans tenter de redessiner en cinq minutes
le modèle des groupes, filiales et sous-traitants.

### Terminologie PIM

`OQ-PIM-TERMINOLOGIE` doit être tranchée avant `E10.22`. Proposition :
**catégorie de produits** pour le classement du référentiel et **gamme de
fabrication** pour les opérations et moyens industriels. Le choix visible ne
requiert pas de renommer immédiatement les identifiants techniques historiques.

## Suites qui ne nécessitent pas d'arbitrage supplémentaire

- poursuivre la vérification des anciennes stories dont le comportement est
  déjà présent et testé ;
- rejouer les recettes ciblées sur la fiche commande commune, les statuts, les
  exports et les prix marché ;
- mettre à jour les questions devenues caduques avec une preuve, sans créer de
  nouvelle règle métier ;
- faire activer par un administrateur GitHub le contrôle obligatoire
  `Branche à jour avec main`, déjà livré et vérifié par la PR `#41`.

## Sujets différés de cet ordre du jour

- suites HopeStudio : formulaire PIM, chat boutique et chaîne de marge ; elles
  demandent un travail spécifique de Xavier et une séance distincte ;
- choix d'une plateforme agréée de facturation électronique ;
- synchronisation automatique des transporteurs ;
- modèle de monétisation et changement de palier ;
- inventaire et consolidation des workers ;
- outillage général de rendu des composants.

Les différer signifie leur attribuer une condition de reprise, pas les retirer
du backlog.

## Sortie attendue et ordre proposé des suites

Chaque ligne décidée en séance doit consigner : **décision, décideur,
responsable de mise en œuvre, échéance et artefacts concernés**.

Ordre proposé après la réunion :

1. fermer immédiatement les trois décisions courtes de `A4` ;
2. propager le vocabulaire PIM et l'arbitrage de `E10.22`, puis développer les
   marges des lignes libres ;
3. développer `E10.24` lorsque le modèle d'expédition initial est choisi ;
4. cadrer puis développer `E10.23` avec le responsable fiscal désigné ;
5. traiter dans des ateliers séparés `OQ-UM-PORTABLE` et `OQ-B3-PARC` ;
6. reprendre les suites HopeStudio quand les travaux parallèles nécessaires
   sont disponibles.

Après le WM, déposer un compte rendu daté, mettre à jour le registre des
questions, créer ou amender les décisions correspondantes, puis propager leurs
références dans les stories. Une fusion documentaire ne vaut approbation que si
le décideur, la date et le périmètre de l'accord sont explicitement consignés.
