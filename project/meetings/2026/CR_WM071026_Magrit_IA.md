---
id: MEET-2026-10-07-WM
title: WM Magrit du 7 octobre 2026 — avancement, analyse GelatoConnect et arbitrages du backlog
date: 2026-10-07
type: weekly
status: draft
propagationStatus: partial
participants:
  - Arnaud Mazon
  - Xavier Péchoultres
absents: []
source: CR_WM071026_Magrit_IA
affectedArtifacts:
  - project/decisions/product/
  - project/decisions/open-questions.md
  - project/governance/roles.md
  - project/backlog/stories/
  - project/prd/product-scope.md
---

> Version Git du compte rendu CR_WM071026_Magrit_IA (Google Doc, dossier Weekly Meeting Magrit). Les décisions qu'il motive sont enregistrées dans `project/decisions/product/PD-2026-10-07-*` ; elles ne sont opposables qu'une fois approuvées.

MAGRIT IA
AGE DÉVELOPPEMENT

Compte rendu de session de travail — Point d'avancement, analyse GelatoConnect et arbitrages du backlog

Arnaud Mazon (AGE Développement) · Xavier Péchoultres (Expert Solutions)

*Réunion du mercredi 7 octobre 2026*

| CONFIDENTIEL — USAGE INTERNE Diffusion : équipe projet Magrit — AGE Développement · Expert Solutions · Clariprint. Ce compte rendu fait foi pour les décisions de la séance ; elles ne deviennent applicables qu'une fois reportées et approuvées dans le dépôt Git. |
| :---- |

# Synthèse exécutive

La séance du 7 octobre devait fermer les arbitrages qui bloquaient la suite du backlog Magrit. C'est fait pour l'essentiel : les lignes libres de devis, la TVA par ligne, les expéditions, le panier, la notion de prix non vérifié, la terminologie du référentiel produit, les parcs machines des sous-espaces et le droit d'approbation de Xavier Péchoultres sont tranchés. La première partie de la réunion a été consacrée à la démonstration de GelatoConnect Estimator, regardé comme source d'inspiration pour l'ergonomie, pas comme modèle de calcul. Les décisions sont reportées dans le dépôt Git, qui fait foi.

**Trois conclusions opérationnelles à retenir**

- **Magrit s'arrête à la commande.** Les expéditions et le suivi de colis relèvent du logiciel de gestion de production de l'imprimeur ; le sujet est reporté aux futures fonctions MIS. Le chantier de la semaine est la boutique, alimentée par le référentiel produit.
- **Le devis et la facture prennent forme.** Une ligne se crée par saisie assistée sur le catalogue, sinon en article libre sans catégorie ; la TVA est portée par chaque ligne, avec un taux tiré du pays du client et figé à la commande. La règle fiscale reste à compléter pour les ventes entre entreprises européennes et à l'export.
- **La gouvernance est débloquée.** Xavier Péchoultres peut approuver tout ce qui peut l'être dans le produit, et le parc machines a un modèle de droits. L'administration du dépôt par Xavier suppose de le transférer dans une organisation GitHub.

Prochaine échéance : démonstration complète de la chaîne commande et boutique dans la semaine du lundi 12 octobre 2026.

# 1. Cadre de la réunion

| Élément | Détail |
|---|---|
| Parties | Arnaud Mazon (AGE Développement) · Xavier Péchoultres (Expert Solutions) |
| Date et durée | Mercredi 7 octobre 2026, 14 h 28 – 16 h 05 environ (1 h 36) |
| Format | Visioconférence Google Meet, partage d'écran |
| Objet | Point d'avancement, analyse concurrentielle GelatoConnect, arbitrages de l'ordre du jour du 7 octobre |
| Ordre du jour | Point projet et ordre du jour proposé pour le prochain WM — demande de fusion n° 42 du dépôt Magrit |
| Source | Notes et transcription automatiques Gemini de la séance |
| Report dans le dépôt | Branche `docs/wm-071026-arbitrages` : compte rendu, décisions `PD-2026-10-07-*`, questions ouvertes, stories |
| Rédacteur | Claude, pour Arnaud Mazon |
| Convention | Les citations sont rétablies en langue écrite, sans altération du propos. Les assertions techniques ont été vérifiées ; les écarts significatifs sont signalés en encadré « Précision technique » |

# 2. Point d'avancement

## 2.1 Commandes : un flux unique jusqu'au pilotage

Xavier Péchoultres a concentré la semaine sur la chaîne de commande, pour permettre une démonstration complète de Clariprint Studio jusqu'au pilotage des commandes. Le code avait produit deux structures de données distinctes, l'une pour les commandes boutique, l'autre pour les commandes issues de devis. Un refactoring les a fusionnées en un flux unique : le double écran disparaît et l'export fonctionne désormais sur la table commune.

- **Statut.** Les données conservent un cycle administratif interne — brouillon, validée, finalisée, annulée — que Xavier considère comme structurel. L'utilisateur ne voit qu'un statut, celui du flux de production (décision du 6 octobre sur le statut visible unique).
- **Devis.** La partie devis a été peu travaillée : le passage du devis à la commande est allé vite.

## 2.2 Sortie de Supabase et pilotage du projet

La migration consécutive à la suppression de Supabase est finalisée ; des éléments mal transférés sont encore nettoyés au fil de l'eau. Xavier a renoncé à synchroniser le dépôt avec GitHub Projects, trop coûteux en jetons et en autorisations. Un tableau de bord HTML est régénéré automatiquement à chaque demande de fusion, sans intelligence artificielle : il lit les métadonnées des stories.

- **Mode d'emploi.** Les points à arbitrer portent un identifiant. Il suffit de les citer en réunion avec leur réponse pour que la propagation suive.
- **Lecture.** Arnaud Mazon demande que les points projet soient consultables dans l'interface de pilotage, avec une présentation adaptée à la lecture et au travail. Un agent capable d'interroger le backlog (« les stories qui concernent le parc machines ») sera envisagé à l'usage.
- **Volume.** Le tableau de bord recense une centaine de chantiers. Xavier propose de distinguer ce qui relève d'une bêta avancée et ce qui relève des améliorations ultérieures.

# 3. Analyse concurrentielle — GelatoConnect Estimator

## 3.1 Ce que montre la démonstration

Arnaud Mazon a présenté le compte d'essai GelatoConnect Estimator ouvert le 6 octobre, en appui de sa note d'analyse concurrentielle (Magrit_Analyse_Concurrentielle_GelatoConnect_06oct2026, Drive). Gelato, éditeur norvégien d'impression à la demande, revendique plus de 250 partenaires d'impression dans 32 pays selon son communiqué de lancement. Sa suite GelatoConnect outille l'imprimeur : gestion de production, vente, et un estimateur accessible depuis le site marchand de l'imprimeur par connecteur — une architecture proche de celle définie pour Magrit.

- **Parc machines.** Le paramétrage part de types de machines pré-renseignés (presses numériques, offset, plieuses, massicots) avec coûts, vitesses, substrats et marges proposés par défaut. Un assistant d'intelligence artificielle aide à créer une machine à partir de ses caractéristiques.
- **Produits et prix.** L'offre est découpée en catégories de produits, avec des règles par catégorie et des étapes conditionnelles. Le prix s'affiche instantanément, avec plusieurs propositions selon les machines du parc.
- **Limite observée.** Interrogé sur un besoin exprimé en usage — équiper trois salons de coiffure — l'assistant ne sait pas répondre : il ne raisonne que sur les catégories qu'il connaît. Sur ce point, l'approche de Magrit a une avance nette.

## 3.2 Lecture de Xavier Péchoultres

Pour Xavier, l'outil est un configurateur de prix : il calcule un prix par machine, à la manière des logiciels de gestion de production standard, sans optimisation combinatoire sur toute la chaîne de fabrication. Il en déduit que l'outil s'exposerait aux erreurs connues de ces logiciels — une méthode d'impression qui convient à la presse mais pas au façonnage — et doute de sa capacité à gérer plusieurs parcs ou des amalgames complexes. Ces points relèvent de son expertise métier et n'ont pas été éprouvés sur l'outil ; la note d'Arnaud constate pour sa part que le prix sort d'un modèle de coûts complet construit sur le parc.

> **Verbatim — Xavier Péchoultres**
> « Cela ressemble quand même à un configurateur de prix, pas vraiment à une optimisation de prix. »

Xavier reconnaît la qualité de l'interface et la proximité du paramétrage des parcs avec celui de Magrit, et rappelle que l'avance technologique ne suffit pas toujours face à un acteur commercialement installé.

> **Verbatim — Arnaud Mazon**
> « Je n'essaie pas de te le vendre. Je le vois comme une source d'inspiration intéressante sur un certain nombre de points, et je ne retiens que ces points-là. »

## 3.3 Suites

- **Lecture.** Xavier Péchoultres et Laurent Rebière liront la note d'analyse ; Arnaud Mazon leur transmet les identifiants du compte d'essai, ouvert jusqu'au mardi 20 octobre 2026.
- **Revue des idées.** Les idées de la note seront passées en revue à une prochaine séance ; Arnaud fera ensuite rédiger par un agent les stories correspondantes.
- **Données de parcs machines.** Arnaud relève la richesse des références machines de Gelato. Xavier estime que la base de Magrit est déjà considérable : les presses offset sont standard, avec des combinaisons d'options bien cernées, et les machines numériques se décrivent à partir des documentations des fabricants. Arnaud examinera les registres de données disponibles et reviendra si l'un d'eux apporte une matière exploitable.

# 4. Arbitrages sur le devis, la commande et la boutique

## 4.1 Lignes de devis libres

Décision `PD-2026-10-07-LIGNES-LIBRES`, story `E10.22`.

| Point | Décision | Statut |
|---|---|---|
| Création d'une ligne | Un seul geste, « ajouter une ligne » : la saisie du nom propose par autocomplétion les produits du catalogue | Acté |
| Produit du catalogue | La ligne reprend sa catégorie, son prix et ses informations | Acté |
| Article libre | Sans correspondance, la ligne est un article libre : aucune catégorie imposée | Acté |
| Marge d'un article libre | Marge du client hors catégorie, à défaut marge globale ; modifiable, y compris à 0 % | Acté |
| Changement de catégorie | Sans objet : une ligne ne change pas de catégorie | Acté |

Une imprimerie qui veut classer ses prestations peut créer un produit de catalogue « prestation de service » ; l'autocomplétion le retrouve. Les deux approches coexistent.

## 4.2 TVA par ligne

Décision `PD-2026-10-07-TVA-LIGNE`, story `E10.23`. Xavier Péchoultres rappelle que la facture électronique rattache la TVA à chaque ligne de facturation, et non au document : le modèle doit le prévoir dès maintenant.

| Point | Décision | Statut |
|---|---|---|
| Modèle | TVA portée par chaque ligne ; récapitulatif par taux en pied de document | Acté |
| Premier lot | Modèle et documents prêts, sans émission de facture électronique | Acté |
| Source du taux | Pays du client, à partir d'une table des taux par pays tenue à jour | Acté |
| Exception | Un produit à taux spécifique porte son propre taux | Acté |
| Sanctuarisation | Taux appliqué figé sur chaque ligne de commande et de facture | Acté |
| Remises, arrondis, correction, profil UBL / CII / Factur-X | Non traités | À traiter |

> **Précision technique — TVA intracommunautaire**
> La règle « taux du pays du client » est exacte pour une vente à distance à un consommateur d'un autre État membre, au-delà de 10 000 € de ventes annuelles. Une vente à une entreprise d'un autre État membre est facturée sans TVA, l'acheteur l'autoliquidant dans son pays ; une vente hors Union européenne est une exportation exonérée. Les taux normaux cités en séance sont exacts pour la France (20 %), l'Allemagne (19 %), l'Espagne (21 %) et l'Italie (22 %) ; celui du Luxembourg est de 17 %. Source : portail Your Europe de la Commission européenne, consulté le 7 octobre 2026. Ces deux cas sont à qualifier avec un responsable fiscal avant le développement.

## 4.3 Expéditions et suivi de colis

Décision `PD-2026-10-07-EXPEDITIONS-REPORTEES`, story `E10.24`. Xavier Péchoultres souligne qu'une commande d'imprimerie part souvent en plusieurs expéditions et que le client doit savoir ce qui lui a été envoyé. Arnaud Mazon objecte que l'imprimeur reprend la commande dans son logiciel de gestion, qui émet les bons de transport : gérer la composition des colis dans Magrit ferait saisir deux fois la même information.

> **Verbatim — Arnaud Mazon**
> « Tant que nous ne sommes pas orientés MIS, l'expédition n'est pas notre sujet. Nous nous arrêtons à la commande : l'imprimeur la reprend dans son MIS et gère la suite. »

Le sujet est placé dans le bac à sable et rattaché aux fonctions MIS envisagées pour des versions ultérieures. La connexion au transporteur à partir du bon de transport sera examinée à ce moment-là.

## 4.4 Panier, prix non vérifié et bouton « Personnaliser »

- **Validité du panier** (`PD-2026-10-07-PANIER-VALIDITE`). Mettre un produit au panier engage l'imprimeur sur un prix pour une durée limitée : le panier est persistant pendant le nombre de jours de validité des devis paramétré par l'espace (30 jours dans l'exemple retenu), puis il expire. Le prix du jour recalculé, déjà en service, n'est pas remis en cause.
- **Prix non vérifié** (`PD-2026-10-07-PRIX-NON-VERIFIE`). La notion n'aura plus d'objet dès que la boutique sera connectée au calcul Clariprint : chaque prix affiché sera calculé, donc valide. Le marquage et l'acquittement livrés restent en service jusque-là ; la question de la population autorisée à acquitter est sans objet.
- **Bouton « Personnaliser ».** Arnaud Mazon tient à l'ergonomie actuelle : sur un écran de plusieurs cartes produit, chaque carte offre une action qui ouvre le volet de ses options, recalcule le prix et laisse l'utilisateur dans la liste. Xavier Péchoultres indique que les cartes produit de Studio, une fois intégrées en boutique, porteront cette interaction. L'ergonomie finale est renvoyée à cette intégration, dans le périmètre de Xavier.

# 5. Gouvernance et dossiers structurants

## 5.1 Droit d'approbation et administration du dépôt

Décision `PD-2026-10-07-GOUVERNANCE`. L'outillage refusait à Xavier Péchoultres de passer au statut « approuvé » les fonctionnalités livrées. Arnaud Mazon décide que Xavier dispose de manière permanente du droit d'approuver tout ce qui peut l'être dans le produit, et que la règle est immuable. Il décide aussi de lui donner les droits d'administration du dépôt GitHub Magrit, au même titre que lui, pour qu'il puisse activer le contrôle obligatoire « branche à jour avec main ».

> **Précision technique — droits sur un dépôt GitHub personnel**
> La tentative faite en séance ne pouvait pas aboutir : le dépôt appartient à un compte personnel, qui n'a qu'un propriétaire. Un collaborateur y reçoit un accès en écriture, sans gestion des règles de protection de branche. GitHub recommande de transférer le dépôt dans une organisation pour attribuer un rôle d'administrateur. Source : documentation GitHub « Permission levels for a personal account repository », consultée le 7 octobre 2026.

## 5.2 Parcs machines et sous-espaces

Décision `PD-2026-10-07-B3-PARC`, qui ferme la question `OQ-B3-PARC` et débloque les stories des portails groupe et réseau. L'exemple travaillé est celui d'un groupe dont la tête paie l'abonnement et dont les compétences de fabrication sont dans les filiales.

| Point | Décision | Statut |
|---|---|---|
| Création | Un parc est créé dans le tenant et associé par son administrateur à un ou plusieurs sous-espaces | Acté |
| Sous-espace | Il peut créer ses propres parcs et les administrer | Acté |
| Groupe | Il dispose de tous les droits d'administration sur ses filiales | Acté |
| Filiale | Elle ne modifie que ses propres parcs, jamais ceux d'une autre filiale | Acté |
| Calcul | Sur quels parcs une filiale peut-elle calculer ? Droit distinct de l'administration | À traiter |
| Navigation | L'administrateur peut-il passer de l'espace principal à ses sous-espaces dans l'interface ? | À traiter |

## 5.3 Terminologie du référentiel produit

Décision `PD-2026-10-07-PIM-CATEGORIE`. Le classement des produits s'appelle désormais « catégorie de produits » ; l'expression « gamme de produits » est bannie et « gamme » est réservé à la gamme de fabrication. Les stories et le périmètre produit ont été mis à jour ; les identifiants techniques ne sont pas renommés par cette décision.

> **Verbatim — Xavier Péchoultres**
> « En imprimerie, la gamme, c'est systématiquement la gamme de fabrication. Cela crée une confusion permanente, et je crains qu'il en aille de même avec nos clients. »

## 5.4 Dossiers attribués ou différés

- **Droits utilisateurs hérités** (`OQ-UM-PORTABLE`). Xavier Péchoultres analyse le dossier : droits historiques, accès hérités, garanties côté services et base.
- **Différés de l'ordre du jour.** Chat boutique et chaîne de marge HopeStudio (séance distincte avec Xavier), choix d'une plateforme agréée de facturation électronique, synchronisation des transporteurs, modèle de monétisation et changement de palier, inventaire des workers, outillage de rendu des écrans. Ils restent au backlog.

# 6. Feuille de route technique et infrastructure

- **Référentiel produit.** Xavier Péchoultres et Laurent Rebière démarrent le jeudi 8 octobre la création des fiches produit, puis les options de configuration, à montrer à Arnaud Mazon pour validation, et la réintégration de la recherche.
- **Boutique.** Cible de Xavier : basculer sur la boutique le vendredi 9 octobre.
- **Marges.** Le gestionnaire de prix chargé de recalculer la marge n'a pas encore été vu en fonctionnement ; Xavier doit le solliciter.
- **Démonstration.** Une démonstration complète est visée dans la semaine du 12 octobre. Arnaud aligne d'ici là sa copie locale de l'application sur la branche principale.
- **Production.** Xavier installe une version de production sur Clever Cloud, en connectant directement le dépôt GitHub. Arnaud Mazon doit travailler la conception de l'infrastructure avec Manu.
- **Compte rendu.** Le compte rendu est déposé au format Markdown dans le dépôt, à côté des décisions qu'il motive.

# 7. Next steps

## 7.1 Engagements pris en séance

| Action | Responsable | Échéance | Statut |
|---|---|---|---|
| Transmettre les identifiants du compte d'essai GelatoConnect | Arnaud Mazon | avant le 20/10/2026 | À traiter |
| Lire la note d'analyse concurrentielle GelatoConnect | Xavier Péchoultres · Laurent Rebière | prochaine séance | À traiter |
| Programmer la revue des idées issues de l'analyse Gelato | Arnaud Mazon · Xavier Péchoultres | à fixer | À traiter |
| Créer les fiches produit et les options de configuration du référentiel | Xavier Péchoultres · Laurent Rebière | à partir du jeu. 08/10/2026 | En cours |
| Réintégrer la recherche | Xavier Péchoultres | avant bascule boutique | À traiter |
| Basculer le développement sur la boutique | Xavier Péchoultres | ven. 09/10/2026 | À traiter |
| Solliciter le gestionnaire de prix pour le recalcul des marges | Xavier Péchoultres | non fixée | À traiter |
| Démonstration complète commande et boutique | Xavier Péchoultres | semaine du 12/10/2026 | À traiter |
| Analyser les droits utilisateurs hérités (`OQ-UM-PORTABLE`) | Xavier Péchoultres | non fixée | À traiter |
| Approuver les fonctionnalités livrées | Xavier Péchoultres | permanent | Acté |
| Donner à Xavier les droits d'administration du dépôt — transfert dans une organisation GitHub | Arnaud Mazon | non fixée | À traiter |
| Installer une version de production sur Clever Cloud | Xavier Péchoultres | non fixée | À traiter |
| Concevoir l'infrastructure avec Manu | Arnaud Mazon | non fixée | À traiter |
| Examiner les registres de données de parcs machines | Arnaud Mazon | non fixée | À traiter |
| Aligner la copie locale de l'application sur la branche principale | Arnaud Mazon | avant la démonstration | À traiter |
| Rendre les points projet consultables dans l'interface de pilotage | Xavier Péchoultres | non fixée | À traiter |
| Déposer le compte rendu et propager les décisions dans le dépôt | Arnaud Mazon | 07/10/2026 | En cours |

## 7.2 Actions internes

- Approuver les décisions `PD-2026-10-07-*`, déposées au statut brouillon, et fusionner la branche `docs/wm-071026-arbitrages`, qui inclut l'ordre du jour de la demande de fusion n° 42.
- Nommer le responsable fiscal ou comptable qui qualifiera les ventes intracommunautaires et l'export, la répartition des remises et les arrondis (`OQ-TVA-LIGNE`).
- Trancher `OQ-B3-PARC-CALCUL` et vérifier `OQ-B3-NAVIGATION`.
- Renommer « gamme » en « catégorie » dans les écrans de l'application.

# 8. Lecture stratégique pour le pilotage

## Ce qui est acquis

- **Un flux de commande unique.** Boutique et devis partagent désormais la même commande, le même statut visible et le même export.
- **Un périmètre resserré.** Magrit s'arrête à la commande ; ce qui relève du MIS est écarté jusqu'à nouvel ordre.
- **Des droits lisibles.** Approbation, administration des parcs et rôle du groupe sur ses filiales sont arbitrés.
- **Un vocabulaire stabilisé.** Catégorie pour le classement, gamme pour la fabrication.

## Points de vigilance

- **Fiscalité.** La règle du pays du client ne couvre ni les ventes entre entreprises européennes ni l'export ; sans responsable fiscal nommé, `E10.23` n'est pas développable.
- **Volume du backlog.** Une centaine de chantiers : sans tri entre bêta avancée et améliorations, la démonstration de la semaine du 12 octobre risque de glisser.
- **Dépôt.** Tant que le dépôt reste sur un compte personnel, Xavier ne peut pas administrer les protections de branche.

## Décisions à prendre

- Transférer le dépôt dans une organisation GitHub.
- Désigner le responsable fiscal ou comptable.
- Fixer le périmètre de la bêta avancée face aux améliorations ultérieures.
- Arrêter les parcs sur lesquels une filiale peut calculer.

## Inscriptions dans les outils projet

- **Dépôt Git** : compte rendu `project/meetings/2026/CR_WM071026_Magrit_IA.md`, huit décisions `PD-2026-10-07-*`, registre des questions ouvertes, rôles, stories `E10.22`, `E10.23`, `E10.24`, `Q17-a`, `Q17-c`, stories des portails groupe et réseau, terminologie de quatorze stories et du périmètre produit.
- **Coffre AGE** : fiche de traçabilité de la réunion et pointeur dans l'état du sprint.
