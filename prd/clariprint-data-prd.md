# Clariprint Data

> PRD du module métier de description des moyens de production
>
> Version : 0.6
> Date : 2026-08-07
> Statut : draft enrichi à valider avec les experts métier
> Produit parent : Clariprint  
> Périmètre : fournisseurs, machines, matières, transports, sous-traitance et publications

**Source historique complémentaire :** [`../docs/clariprint-data-plan/prompt  - base44 - PrintMaster.txt`](../docs/clariprint-data-plan/prompt%20%20-%20base44%20-%20PrintMaster.txt), analysée dans [`11-analyse-source-printmaster.md`](../docs/clariprint-data-plan/11-analyse-source-printmaster.md). Cette source décrit une maquette et des corrections successives ; ses listes et choix d'interface ne deviennent contractuels qu'après consolidation.

**PRD historique autonome :** [`clariprint_data_prd_inital.md`](./clariprint_data_prd_inital.md), analysé dans [`13-analyse-prd-initial-printflow.md`](../docs/clariprint-data-plan/13-analyse-prd-initial-printflow.md). Il fournit des scénarios et un dictionnaire candidat, mais son architecture d'application séparée et son moteur de coûts embarqué ne font pas autorité pour le module Magrit.

## 1. Résumé

Clariprint est une application métier permettant de calculer des prix d'impression. Son fonctionnement global repose sur trois ensembles distincts :

1. une interface de description du besoin d'impression, prévue ultérieurement ;
2. un solveur de calcul et d'optimisation, extérieur au présent projet ;
3. une application de description des fournisseurs, de leurs ressources, de leurs aptitudes techniques et de leurs paramètres économiques.

Le présent projet concerne exclusivement le troisième ensemble, nommé **Clariprint Data** dans ce document.

Clariprint Data doit permettre à une entreprise de décrire de manière fiable, structurée, versionnée et exploitable les fournisseurs mobilisables pour fabriquer et livrer un produit imprimé. Un fournisseur n'est pas enfermé dans un type unique : il porte une ou plusieurs **capacités métier**, par exemple impression offset, impression numérique, impression PLV, façonnage, fourniture de papier ou transport.

Le fournisseur qui utilise Clariprint peut décrire ses propres machines, matières et grilles de transport, mais aussi référencer des capacités proposées par d'autres fournisseurs en sous-traitance. Une publication constitue son pool de données source complet. L'imprimeur déclare explicitement si les montants publiés représentent des coûts de production ou des tarifs commerciaux. Des profils clients et contrats d'accès versionnés permettent ensuite à Clariprint Data de produire, à la date d'une demande, un JSON complet dont les tarifs sont ajustés par les marges ou remises applicables. Le solveur Clariprint consomme ce JSON ajusté et reste responsable du calcul du scénario de production.

## 2. Problème à résoudre

Le calcul d'un prix d'impression dépend de données nombreuses et interdépendantes : fournisseurs disponibles, machines, formats acceptés, matières et prix papier, vitesses, temps de calage, gâche, opérations de finition, coûts horaires, prestations sous-traitées et grilles de transport.

Lorsque ces données sont dispersées dans des fichiers, connues seulement de quelques experts ou saisies sans contrôle de cohérence, le solveur travaille sur une représentation incomplète ou obsolète du parc. Les conséquences possibles sont :

- des solutions techniquement impossibles ;
- l'absence d'une solution pourtant réalisable ;
- des coûts de revient faux ou non explicables ;
- une dépendance forte à une personne experte ;
- une mise à jour risquée des paramètres de production ;
- l'impossibilité de savoir quelles données ont servi à un calcul passé.

Clariprint Data doit transformer cette connaissance industrielle et logistique en un réseau de fournisseurs gouverné, contrôlable et publiable.

## 3. Objectif produit

Permettre à un responsable industriel ou à un deviseur expert de maintenir une représentation fidèle de son écosystème de production : capacités propres, achats de matières, transports et sous-traitants autorisés. Il doit ensuite pouvoir publier un instantané JSON cohérent que le solveur Clariprint peut consommer sans ressaisie.

Le module réussit si :

- un utilisateur métier autorisé peut décrire le parc sans intervention d'un développeur ;
- les incohérences majeures sont détectées avant publication ;
- une modification n'altère jamais silencieusement les calculs fondés sur une version antérieure ;
- le solveur peut identifier sans ambiguïté l'organisation, la version et les objets exportés ;
- chaque valeur sensible possède une provenance et un historique compréhensibles ;
- un bac à sable peut être créé à partir d'une publication de production, modifié et testé sans influencer les calculs de production.

## 4. Principes produit

1. **Le métier reste maître de la donnée.** Le module guide et contrôle la saisie, mais un utilisateur autorisé valide les paramètres engageants.
2. **Une donnée publiée est immuable.** Toute correction donne lieu à une nouvelle version identifiable.
3. **Un fournisseur est défini par ses capacités.** « Imprimeur », « papetier » et « transporteur » ne sont pas trois modèles étanches ; une même entité peut cumuler plusieurs capacités.
4. **La technique et l'économie sont distinctes mais reliées.** Une aptitude détermine ce qui est réalisable ; un paramètre économique contribue à en déterminer le coût.
5. **L'absence de donnée est explicite.** Une valeur inconnue ne doit pas être remplacée silencieusement par zéro ou par une valeur arbitraire.
6. **Le solveur est un consommateur externe.** Clariprint Data résout le profil client, applique les ajustements tarifaires et génère le JSON complet ; le solveur choisit la solution de production et exécute le calcul à partir de ce JSON.
7. **Production et expérimentation sont isolées.** Seule une publication de production peut alimenter les calculs de production ; un bac à sable n'a aucun effet tant qu'il n'est pas validé et publié.
8. **Toute évolution est traçable.** L'auteur, la date, la raison et l'effet d'une modification doivent pouvoir être retrouvés.
9. **Le vocabulaire métier est partagé.** Les unités, catégories de machines, opérations et caractéristiques doivent provenir de référentiels contrôlés.
10. **La configuration publiée est indépendante de son écran d'édition.** Un environnement, une machine ou un barème conserve un contrat métier stable même si l'ergonomie React évolue.
11. **Le montant source reste intact.** Une marge ou remise client est une surcouche versionnée ; elle ne modifie jamais les coûts ou tarifs commerciaux définis par l'imprimeur dans son pool.

## 5. Périmètre

### 5.1 Dans le périmètre

- gestion des fournisseurs et, si retenu, de leurs établissements ou sites ;
- organisation en tenants, business units et environnements de données selon le modèle de gouvernance retenu ;
- attribution de plusieurs capacités métier à un même fournisseur ;
- inventaire des machines et fonctionnalités propres ou accessibles en sous-traitance ;
- catalogue de matières premières et tarifs associés ;
- grilles de transport ;
- contrats de sous-traitance entre fournisseurs, limités aux machines et familles de services explicitement autorisées ;
- description des caractéristiques et aptitudes techniques ;
- définition des compatibilités, limites et exclusions ;
- description des opérations réalisables et de leurs enchaînements autorisés ;
- paramétrage des temps, consommations, gâches et autres inducteurs de coût ;
- paramétrage de montants source explicitement qualifiés comme coûts de production ou tarifs commerciaux ;
- gestion de barèmes conditionnels par poste de travail et tests explicables de leur applicabilité ;
- référentiels BU de marques, fournisseurs matière, SKU et transporteurs lorsque ces données sont mutualisées ;
- gestion des calendriers ou disponibilités structurelles si elles influencent le calcul ;
- contrôles de complétude et de cohérence ;
- simulation de l'impact d'une modification, limitée à des contrôles de données et non à l'exécution du solveur ;
- cycle brouillon, validation, publication et archivage ;
- versionnement, dates d'effet et historique ;
- création de bacs à sable à partir d'une publication de production ;
- comparaison et promotion contrôlée d'un bac à sable vers un nouveau brouillon de publication ;
- import initial ou mise à jour en masse selon des formats contrôlés ;
- export d'un jeu de données vers le système solveur ;
- profils clients, contrats d'accès au pool, filtres de ressources, politiques datées de marge ou remise et modes d'accès ;
- génération à la demande d'un JSON complet aux tarifs ajustés ;
- journal d'audit, droits et séparation des organisations ;
- délégation temporaire et limitée de l'édition d'un environnement à un utilisateur autorisé.

### 5.2 Hors périmètre

- description du besoin d'impression par le client ou le commercial ;
- calcul du plan de production optimal ;
- calcul du prix final et comparaison des solutions ;
- ordonnancement temps réel de l'atelier ;
- pilotage des machines, collecte IoT ou supervision de production ;
- maintenance préventive ou curative des équipements ;
- gestion comptable, facturation ou paie ;
- PIM commercial et publication d'un catalogue de produits ;
- développement interne du solveur Clariprint ;
- gestion complète des projets et devis de test ; Clariprint Data ne fait que préparer les cas et présenter les résultats renvoyés par le solveur ou le système propriétaire.

### 5.3 Frontière avec le solveur

Clariprint Data est responsable de la validité structurelle du jeu de données exporté. Le solveur est responsable de son interprétation dans le cadre de son contrat, de la recherche de solutions et du calcul des résultats.

Une publication constitue la représentation de production directement envoyable au serveur de calcul. L'export porte sur la totalité du parc accessible : fournisseurs, capacités, machines, matières, transports, contrats de sous-traitance et paramètres associés.

Le contrat d'échange JSON devra préciser au minimum :

- l'identifiant de l'organisation et, le cas échéant, du site ;
- l'identifiant et la version du jeu de données ;
- la date de publication et la période d'effet ;
- la version du schéma d'échange ;
- la date de création, le créateur, la date de début et la date de fin de validité de la publication ;
- les unités et conventions d'arrondi ;
- les identifiants stables des objets métier ;
- les règles de représentation d'une valeur absente, illimitée ou non applicable ;
- le mode d'export, l'accusé de réception et la gestion des erreurs ;
- la politique de compatibilité entre versions du module et du solveur.

### 5.4 Frontière entre pool, profils clients, accès et moteur

Le modèle distingue :

1. le **pool de données source**, publication immuable des capacités, performances et montants définis par l'imprimeur, avec une nature de montant explicite `production_cost` ou `commercial_rate` ;
2. le **profil client**, qui représente un segment ou client auquel des conditions particulières peuvent s'appliquer ;
3. la **politique tarifaire du profil**, datée et versionnée, qui contient une marge ou remise globale et, si nécessaire, des règles spécifiques machine par machine ;
4. le **contrat d'accès**, qui relie un profil à un pool, définit les filtres de données et les modes d'accès autorisés ;
5. les **credentials locaux optionnels**, plusieurs par contrat, ou une association externe utilisant l'identifiant publié du profil ;
6. la **projection ajustée**, JSON complet généré par Clariprint Data après résolution du profil, de la date, du pool, des filtres et de la politique ;
7. le **solveur**, qui reçoit cette projection ajustée et calcule les solutions sans devoir réinterpréter la politique commerciale.

Un contrat peut posséder plusieurs clés API afin de permettre rotation, séparation par intégration et révocation sans interrompre les autres consommateurs. Il peut aussi publier un profil stable pour qu'un système d'accès externe associe ses propres identités ou credentials à ce profil. Les secrets en clair ne sont affichés qu'à leur création et ne sont jamais inclus dans une publication ou un résultat.

Chaque projection doit conserver au minimum l'identifiant et la version du contrat, du profil et de la politique, la publication source résolue, la date d'effet du calcul, le mode d'accès utilisé et l'empreinte du JSON généré. Si une clé locale est utilisée, seul son identifiant est conservé, jamais sa valeur secrète.

## 6. Utilisateurs et rôles

### Administrateur d'organisation

Il crée les sites, gère les utilisateurs, attribue les droits et contrôle les paramètres généraux de son organisation.

Selon le modèle multi-BU retenu, ce rôle se décline en administrateur de tenant et administrateur de BU. L'administrateur de tenant peut administrer toutes les BU ; l'administrateur de BU reste limité à son périmètre.

### Administrateurs spécialisés de BU

Une BU peut déléguer la gestion des environnements imprimeur, matière, transport ou projet à des administrateurs spécialisés. Ces spécialisations sont des ensembles de capabilities et non des identités ou types d'utilisateurs exclusifs.

### Responsable industriel

Il décrit le parc, les opérations, les limites techniques et les relations entre moyens de production. Il est responsable de la fidélité du modèle industriel.

### Contrôleur de gestion ou responsable financier

Il maintient ou valide les coûts horaires, coûts de calage, coûts matière, seuils et autres paramètres économiques autorisés. L'accès à ces informations peut être plus restreint que l'accès aux données techniques.

### Deviseur expert

Il consulte le référentiel, signale les incohérences et peut proposer des ajustements. Selon l'organisation, il peut aussi éditer ou valider certaines données.

### Validateur / publieur

Il contrôle un jeu de modifications et autorise sa publication vers le solveur. Ce rôle peut être cumulé avec celui de responsable industriel, mais la séparation des rôles doit être possible.

### Administrateur des profils et contrats d'accès

Il crée les profils clients et contrats d'accès, sélectionne les pools et ressources autorisés, définit les politiques datées de marge ou remise globales et par machine, et gère les modes d'accès. Il ne peut pas modifier les montants source sans droit financier distinct.

### Auditeur ou support Clariprint

Il consulte les versions, contrôles et journaux nécessaires au diagnostic, dans les limites contractuelles et avec des accès explicitement tracés.

### Administrateur délégué d'un fournisseur

Un utilisateur externe à l'équipe de la BU peut recevoir un accès limité à un environnement déterminé, pour une durée définie. Cet accès ne donne pas les droits d'administration de la BU, de publication ou de consultation financière sauf attribution explicite.

## 7. Modèle métier conceptuel

### 7.1 Fournisseur multi-capacités

Le concept central est le **fournisseur**. Les catégories historiques ne doivent pas devenir des types exclusifs : elles sont modélisées comme des capacités cumulables.

Capacités initialement identifiées :

- impression offset ;
- impression numérique ;
- impression PLV ;
- façonnage ;
- fourniture de papier ;
- transport.

Cette liste doit être extensible. Un imprimeur peut ainsi décrire ses propres tarifs papier ou ses propres prestations de transport sans créer artificiellement une autre entité. Inversement, un fournisseur spécialisé peut ne porter qu'une seule capacité.

### 7.2 Ressources proposées

Un fournisseur expose des ressources cohérentes avec ses capacités :

| Famille de ressources | Contenu principal |
|---|---|
| Machines et fonctionnalités | Presses, équipements de finition, postes de charge, opérations, limites, cadences, gâches et coûts |
| Matières premières | Papiers et autres consommables, caractéristiques, conditionnements, disponibilités et prix fournisseur |
| Grilles de transport | Services, zones, poids ou volumes, délais, suppléments, paliers et prix |

Les trois familles partagent les mêmes mécanismes transverses : propriétaire, identifiants stables, périodes de validité, tarifs, brouillons, contrôles, publication et audit. Elles conservent cependant leurs schémas métier propres ; une grille de transport ne doit pas être artificiellement modélisée comme une machine.

### 7.3 Contrat de sous-traitance

Lorsqu'un imprimeur choisit un sous-traitant, il crée un **contrat de sous-traitance**. Cet objet relie le fournisseur donneur d'ordre au fournisseur sous-traitant et définit simplement le périmètre accessible :

- la liste des machines autorisées ;
- l'autorisation d'utiliser ou non son offre papier ;
- l'autorisation d'utiliser ou non son offre de transport ;
- la date de début ;
- la date de fin.

Le contrat ne donne donc jamais accès implicitement à la totalité du sous-traitant. Une ressource sous-traitée conserve son fournisseur propriétaire et sa provenance. Elle apparaît dans le parc exporté du donneur d'ordre uniquement si elle est autorisée par un contrat valide à la date du calcul et incluse dans la publication.

La récursivité doit être maîtrisée : un sous-traitant ne peut pas réexporter automatiquement les propres sous-traitants d'un autre fournisseur. Toute délégation transitive éventuelle devra faire l'objet d'une règle métier explicite.

### 7.4 Environnements et publications

Le module distingue trois états de données :

| État | Usage | Effet sur la production |
|---|---|---|
| Brouillon | Modification en cours avant validation | Aucun |
| Bac à sable | Copie isolée d'une publication ou d'un brouillon pour expérimenter | Aucun |
| Publication | Instantané validé, complet et directement exportable au format JSON | Peut alimenter le solveur de production pendant sa période de validité |

Un bac à sable créé depuis la production doit conserver le lien vers sa publication source. Ses modifications peuvent être comparées à cette source. Elles ne deviennent productives qu'après un processus explicite de validation et de publication créant un nouvel instantané.

### 7.5 Inventaire des concepts

Le vocabulaire exact devra être aligné sur celui du solveur et des experts Clariprint.

| Concept | Rôle dans le module |
|---|---|
| Fournisseur | Entité économique proposant une ou plusieurs capacités |
| Capacité fournisseur | Qualification cumulable : offset, numérique, PLV, façonnage, papier, transport, etc. |
| Établissement / site | Lieu auquel des ressources et paramètres peuvent être rattachés |
| Centre ou poste de charge | Unité logique sur laquelle une opération peut être affectée |
| Équipement / machine | Moyen de production possédant des caractéristiques, performances et coûts |
| Matière première | Papier ou consommable achetable et utilisable sous certaines conditions |
| Grille de transport | Tarification structurée d'un service logistique selon des dimensions déterminées |
| Fonctionnalité / opération | Impression, découpe, pliage, façonnage, ennoblissement, conditionnement, etc. |
| Aptitude technique | Possibilité pour un moyen de réaliser une opération dans certaines limites |
| Contrat de sous-traitance | Autorisation datée d'utiliser une liste de machines et, éventuellement, les offres papier et transport d'un autre fournisseur |
| Domaine de validité | Ensemble de formats, matières, grammages, couleurs, quantités ou autres paramètres acceptés |
| Paramètre de performance | Cadence, temps fixe, temps variable, changement de série, rendement ou gâche |
| Paramètre économique | Valeur monétaire, seuil, minimum ou coefficient associé à un inducteur de coût |
| Nature des montants source | Qualification du pool : coût de production ou tarif commercial |
| Profil client | Client ou segment auquel sont rattachées des conditions tarifaires et des accès |
| Politique tarifaire | Ensemble versionné et daté de marges ou remises globales et spécifiques par machine |
| Contrat d'accès calcul | Lien entre profil, pool, filtres de données et modes d'accès du moteur |
| Projection ajustée | JSON complet généré à la demande avec les tarifs applicables au profil et à la date |
| Bac à sable | Branche isolée permettant d'expérimenter à partir de données existantes |
| Publication | Instantané JSON immuable, daté et directement consommable par le solveur |

### 7.6 Gouvernance tenant, BU et environnements

La source PrintMaster introduit une hiérarchie `tenant → business unit → environnement`. Une BU regroupe des administrateurs, référentiels et environnements dans un périmètre régional ou organisationnel.

Un **environnement de production** représente la configuration éditable et publiable d'un fournisseur ou site pour une capacité donnée. Les spécialisations candidates sont :

- `PrinterEnvironment` pour les moyens d'impression et de façonnage ;
- `PaperEnvironment` pour l'offre matière ;
- `TransportEnvironment` pour l'offre logistique ;
- `ProjectEnvironment` pour les projets de test, hors cœur du module Data.

Ces spécialisations ne remettent pas en cause le fournisseur multi-capacités. La décision de modéliser un environnement comme agrégat distinct, vue spécialisée ou périmètre de publication doit être prise avant le schéma SQL.

### 7.7 Barèmes de poste

Un poste ou une machine peut posséder plusieurs barèmes. Un barème associe :

- des conditions d'application sur prestation, support, formats, pages, postes, passes, quantité et surface ;
- des paramètres de performance tels que cadence et temps ;
- des coûts fixes, horaires, au millier ou à la surface ;
- des variations ou coefficients ;
- des règles de gâche.

La structure doit maintenir la distinction conceptuelle entre aptitude, performance et économie, même si le contrat solveur les sérialise dans un même objet. Un cas de test de barème doit expliquer les règles applicables et chaque composante du résultat attendu.

### 7.8 Référentiels mutualisés de BU

Une BU peut maintenir des référentiels partagés par plusieurs environnements :

- marques et types de supports avec compatibilités et certifications ;
- fournisseurs matière ;
- catalogue SKU et conditions tarifaires ;
- transporteurs et grilles de transport.

La dernière correction PrintMaster ne conserve pas une entité structurée « famille de support » : la marque porte un type de matière contrôlé et une famille textuelle modifiable. Ce choix reste à confirmer avant implémentation et ne doit pas produire un enum figé dans le code.

### 7.9 Profils clients et projections tarifaires

Un profil client ne copie pas le parc machine. Il référence un ou plusieurs contrats d'accès à des pools publiés et possède des politiques tarifaires effectives dans le temps.

Une politique peut contenir :

- un ajustement global ;
- des ajustements propres à certaines machines ;
- une marge, une majoration ou une remise dont la sémantique est explicitement typée ;
- une date de début et une date de fin ;
- une priorité déterministe si plusieurs règles pourraient s'appliquer.

La règle machine prévaut sur la règle globale seulement si cette priorité est validée et inscrite dans le contrat. Les périodes qui se chevauchent de manière ambiguë doivent empêcher la génération.

Le contrat d'accès associe le profil à un pool publié, à des filtres éventuels de machines ou ressources et à un ou plusieurs modes d'accès. Lors d'une demande, Clariprint Data résout la publication, sélectionne la politique applicable à la date demandée, transforme les montants source sans les modifier, puis génère un JSON complet et déterministe destiné au solveur.

## 8. Parcours utilisateurs prioritaires

### Parcours 1 — Décrire un fournisseur et ses capacités

Un administrateur crée le fournisseur et ses établissements, puis lui attribue une ou plusieurs capacités. Selon celles-ci, les utilisateurs ajoutent des machines, matières premières ou grilles de transport. Le système indique progressivement la complétude et empêche la publication tant que des erreurs bloquantes subsistent.

### Parcours 2 — Ajouter ou remplacer une machine

Le responsable industriel duplique éventuellement un équipement proche, modifie les valeurs propres à la nouvelle machine, définit sa date de mise en service et demande une validation. L'ancienne machine peut rester active jusqu'à la date d'effet de la nouvelle configuration.

### Parcours 3 — Mettre à jour un coût

Le responsable financier prépare une nouvelle valeur avec sa devise, son unité, sa date d'effet, sa source et un commentaire. La valeur précédente reste consultable. La publication produit une nouvelle version sans modifier les données historiques.

### Parcours 4 — Contractualiser un sous-traitant

Un imprimeur choisit un autre fournisseur comme sous-traitant et crée un contrat. Il sélectionne les machines autorisées, indique si les offres papier et transport sont utilisables, puis renseigne les dates de début et de fin. Seules les ressources couvertes par ce contrat pendant sa période de validité sont incluses dans le parc publié.

### Parcours 5 — Expérimenter dans un bac à sable

Un utilisateur crée un bac à sable à partir de la publication de production active. Il modifie une machine, un tarif papier, une grille de transport ou un contrat de sous-traitance. Il peut valider et exporter le JSON de test vers un environnement non productif sans affecter les calculs de production. Il compare ensuite le résultat à la source et peut proposer les changements pour publication.

### Parcours 6 — Diagnostiquer une impossibilité de calcul

À partir d'un identifiant de publication ou d'une erreur d'export, un utilisateur autorisé retrouve la version concernée, les contrôles effectués et les objets incomplets ou incompatibles. Il corrige dans un nouveau brouillon puis republie.

### Parcours 7 — Publier vers le solveur

Le publieur examine le résumé des changements, les avertissements et les erreurs. Après validation, le module fige la totalité du parc accessible dans un instantané JSON, renseigne son créateur et ses dates de validité, l'envoie ou le rend disponible selon le contrat, puis conserve le résultat technique de l'échange.

### Parcours 8 — Importer ou mettre à jour en masse

Un utilisateur charge un fichier conforme à un modèle. Le système prévisualise le mapping, les créations, modifications et rejets. Aucune donnée publiée n'est modifiée avant confirmation et validation du brouillon résultant.

### Parcours 9 — Créer un environnement imprimeur

Un administrateur de BU crée un environnement, renseigne le site, ses zones, sa devise, ses unités et certifications, puis sélectionne ou crée les machines, catalogues matière et grilles de transport nécessaires. Le résultat est un brouillon non productif tant qu'il n'a pas été contrôlé et publié.

### Parcours 10 — Définir et tester un barème

Un éditeur autorisé associe un barème à un poste, sélectionne une prestation réalisable et définit ses conditions, performances, coûts et gâches. Il saisit ensuite un cas représentatif ; le système liste les barèmes applicables et présente un résultat tabulaire explicable. Si le résultat provient du solveur, la version de son contrat et la publication testée sont conservées.

### Parcours 11 — Maintenir un référentiel matière de BU

Un administrateur matière qualifie fournisseurs et marques, importe ou met à jour les SKU, examine les créations automatiques proposées et corrige les références incomplètes. Les environnements imprimeur de la BU peuvent sélectionner une version déterminée de ce référentiel.

### Parcours 12 — Déléguer temporairement l'édition

Un administrateur autorisé invite un représentant du fournisseur à éditer un environnement précis jusqu'à une date donnée. L'utilisateur s'authentifie, ne voit que les fonctions accordées et ne peut accéder à l'administration de la BU ou publier sans capability explicite. La révocation prend effet immédiatement et reste auditée.

### Parcours 13 — Générer les données ajustées d'un profil client

L'imprimeur publie son pool en indiquant si les montants sont des coûts de production ou des tarifs commerciaux. Un administrateur crée un profil client, définit une politique globale et des exceptions par machine avec leurs périodes de validité, puis associe le profil à un contrat d'accès. À la réception d'une clé API locale ou d'un identifiant de profil transmis par un système autorisé, Clariprint Data résout la politique applicable et génère pour Clariprint Solveur un JSON complet aux tarifs ajustés. Le pool source demeure inchangé.

## 9. Exigences fonctionnelles

### 9.1 Fournisseurs, capacités et isolation

- **FR-ORG-001** Le système doit isoler strictement les données de chaque organisation.
- **FR-ORG-002** Un fournisseur peut gérer un ou plusieurs établissements ou sites si le mode multi-sites est activé.
- **FR-ORG-003** Chaque objet métier possède un identifiant stable, distinct de son libellé modifiable.
- **FR-ORG-004** Les unités, la devise et le fuseau horaire par défaut sont définis explicitement.
- **FR-ORG-005** Le système empêche ou signale les doublons probables dans un même périmètre.
- **FR-ORG-006** Un fournisseur peut cumuler plusieurs capacités métier sans duplication de son identité.
- **FR-ORG-007** La liste des capacités est extensible et chaque capacité active les familles de données et contrôles correspondants.
- **FR-ORG-008** Les capacités initiales couvrent au minimum l'offset, le numérique, la PLV, le façonnage, la fourniture de papier et le transport.
- **FR-ORG-009** Un fournisseur peut proposer ses propres tarifs de matière ou de transport même si son activité principale est l'impression.

### 9.2 Parc et moyens de production

- **FR-EQP-001** Un utilisateur autorisé peut créer, consulter, modifier, dupliquer, désactiver et archiver un moyen de production.
- **FR-EQP-002** Un moyen possède au minimum un type, un libellé, un statut, un site, une période de validité et les paramètres requis par son type.
- **FR-EQP-003** Les machines internes et capacités sous-traitées sont distinguées explicitement.
- **FR-EQP-004** La désactivation d'un moyen ne supprime ni son historique ni les publications qui le référencent.
- **FR-EQP-005** Les équipements peuvent être regroupés en postes ou centres de charge lorsque le modèle de calcul l'exige.
- **FR-EQP-006** Le système peut créer un équipement à partir d'un modèle ou d'un équipement existant, sans partager ensuite des valeurs de manière implicite.

### 9.3 Matières premières

- **FR-MAT-001** Un fournisseur autorisé peut créer, modifier, désactiver et versionner une matière première ou une gamme de matières.
- **FR-MAT-002** Une matière possède des caractéristiques structurées, des unités, un conditionnement, une période de validité et un fournisseur propriétaire.
- **FR-MAT-003** Un fournisseur peut définir ses propres prix d'achat ou de revente de matière, indépendamment de son activité principale.
- **FR-MAT-004** Un tarif matière peut dépendre de paliers, quantités, conditionnements ou autres dimensions prévues par le contrat solveur.
- **FR-MAT-005** La compatibilité entre une matière et une machine ou opération peut être définie et contrôlée.
- **FR-MAT-006** Une matière sous-traitée conserve sa référence et son fournisseur d'origine dans les publications du donneur d'ordre.

### 9.4 Grilles de transport

- **FR-TRN-001** Un fournisseur autorisé peut créer, modifier, désactiver et versionner une grille de transport.
- **FR-TRN-002** Une grille identifie le prestataire, le service, les zones, délais, unités de taxation, paliers, prix et suppléments applicables.
- **FR-TRN-003** Un imprimeur peut décrire ses propres tarifs de transport ou sélectionner ceux d'un transporteur tiers.
- **FR-TRN-004** Les zones, paliers de poids, volume ou quantité et périodes de validité ne doivent pas présenter de recouvrements ambigus.
- **FR-TRN-005** Une grille accessible par contrat conserve son fournisseur d'origine dans la publication du donneur d'ordre.
- **FR-TRN-006** Le modèle permet d'ajouter de nouveaux transporteurs et services sans modification du noyau fournisseur.

### 9.5 Contrats de sous-traitance

- **FR-SUB-001** Un imprimeur peut créer un contrat avec un autre fournisseur choisi comme sous-traitant.
- **FR-SUB-002** Un contrat possède au minimum un donneur d'ordre, un sous-traitant, une date de début et une date de fin.
- **FR-SUB-003** Le contrat contient la liste explicite des machines du sous-traitant autorisées pour le donneur d'ordre.
- **FR-SUB-004** Le contrat indique explicitement si l'offre papier du sous-traitant est accessible.
- **FR-SUB-005** Le contrat indique explicitement si l'offre de transport du sous-traitant est accessible.
- **FR-SUB-006** En dehors des machines listées et des deux autorisations papier et transport, aucune ressource du sous-traitant n'est rendue accessible implicitement.
- **FR-SUB-007** Un contrat n'est applicable que si la date du calcul est comprise dans sa période de validité.
- **FR-SUB-008** La désactivation d'une machine par son propriétaire signale tous les contrats qui l'autorisent avant leur prochaine publication.
- **FR-SUB-009** Le système détecte les boucles de sous-traitance et interdit toute inclusion transitive non explicitement autorisée.
- **FR-SUB-010** Une publication conserve le contrat applicable, la provenance et le propriétaire de chaque ressource sous-traitée.

### 9.6 Aptitudes et contraintes techniques

- **FR-TEC-001** Un utilisateur autorisé peut associer à un moyen une ou plusieurs opérations réalisables.
- **FR-TEC-002** Chaque aptitude peut définir des bornes, listes de valeurs, exclusions et conditions combinées.
- **FR-TEC-003** Les unités sont typées et converties selon des règles déterministes ; une dimension ne peut pas être comparée à un grammage ou à une durée.
- **FR-TEC-004** Le système distingue une valeur inconnue, non applicable, illimitée et égale à zéro.
- **FR-TEC-005** Une règle conditionnelle doit être exprimée dans un format contrôlé, testable et exportable, sans code libre exécuté côté client.
- **FR-TEC-006** Les compatibilités entre machines, matières, formats, opérations et finitions peuvent être définies sans dupliquer toute la fiche machine.
- **FR-TEC-007** Le système détecte les bornes inversées, ensembles vides, références manquantes et contradictions connues.
- **FR-TEC-008** Un avertissement peut être accepté avec justification ; une erreur bloquante interdit la publication.

### 9.7 Performance et consommation

- **FR-PRF-001** Le système permet de renseigner des temps fixes et variables dans des unités explicites.
- **FR-PRF-002** Une cadence ou consommation peut dépendre d'une plage de valeurs ou d'une condition technique.
- **FR-PRF-003** Les paramètres de calage, changement de série, nettoyage, gâche et rendement sont modélisables lorsqu'ils contribuent au calcul.
- **FR-PRF-004** Les courbes, paliers ou tables de valeurs doivent être contrôlés pour éviter les recouvrements ou ruptures involontaires.
- **FR-PRF-005** Toute valeur par défaut héritée d'un modèle reste identifiable comme telle.

### 9.8 Paramètres économiques

- **FR-ECO-001** Un utilisateur disposant du droit financier peut définir un coût et son unité d'œuvre, sa devise, sa période d'effet et sa provenance.
- **FR-ECO-002** Le système prend en charge les coûts fixes, variables, minimums de facturation et paliers nécessaires au contrat solveur.
- **FR-ECO-003** Les coûts internes, prix d'achat de sous-traitance et éventuelles règles commerciales sont des catégories distinctes.
- **FR-ECO-004** Une valeur financière arrivée à expiration ou sans date d'effet applicable est signalée avant publication.
- **FR-ECO-005** Les valeurs financières sensibles peuvent être masquées aux rôles exclusivement techniques.
- **FR-ECO-006** Toute modification financière conserve l'ancienne valeur, son auteur, sa source et sa période d'application.
- **FR-ECO-007** Les règles d'arrondi et de conversion monétaire sont explicites et communes à l'export.
- **FR-ECO-008** Une valeur manquante n'est jamais assimilée implicitement à un coût nul.
- **FR-ECO-009** Le modèle peut représenter main-d'œuvre horaire, frais généraux surfaciques et coût énergétique si ces inducteurs sont confirmés dans le contrat solveur.
- **FR-ECO-010** Le pool indique explicitement si ses montants source sont des coûts de production ou des tarifs commerciaux ; cette nature est conservée dans la publication.
- **FR-ECO-011** Une politique de profil transforme les montants uniquement lors de la génération d'une projection ajustée et ne modifie jamais les valeurs publiées dans le pool.

### 9.9 Bacs à sable, validation et publication

- **FR-PUB-001** Toute modification est réalisée dans un brouillon ou un jeu de changements non publié.
- **FR-PUB-002** Le système présente avant validation la liste des objets ajoutés, modifiés, désactivés et supprimés du brouillon.
- **FR-PUB-003** Un validateur peut accepter, rejeter ou demander une correction avec commentaire.
- **FR-PUB-004** Une publication est un instantané immuable possédant un numéro de version unique.
- **FR-PUB-005** Une publication future peut posséder une date d'effet postérieure à sa date de validation.
- **FR-PUB-006** Une seule publication est applicable pour un même périmètre et un même instant, sauf règle multi-version explicitement décidée.
- **FR-PUB-007** Le retrait d'une publication ne supprime pas son contenu et produit une trace d'audit.
- **FR-PUB-008** Le système permet de comparer deux versions au niveau des objets et des champs.
- **FR-PUB-009** Le retour à une configuration antérieure crée une nouvelle publication fondée sur cette version ; il ne réécrit pas l'historique.
- **FR-PUB-010** Un utilisateur autorisé peut créer un bac à sable à partir d'une publication de production ou d'un brouillon identifié.
- **FR-PUB-011** Un bac à sable conserve l'identifiant et la version de sa source, son créateur, sa date de création et son statut.
- **FR-PUB-012** Toute modification d'un bac à sable est isolée des données et calculs de production.
- **FR-PUB-013** Un bac à sable peut produire un JSON de test clairement identifié, destiné uniquement à un serveur ou contexte de calcul non productif.
- **FR-PUB-014** La promotion d'un bac à sable crée un brouillon de publication soumis aux contrôles et validations ordinaires ; elle ne modifie jamais directement la production.
- **FR-PUB-015** Une publication contient au minimum son identifiant, sa version, sa date de création, son créateur, son début de validité et sa fin de validité éventuelle.
- **FR-PUB-016** Le JSON d'une publication représente la totalité du parc accessible et est directement conforme au contrat du serveur de calcul.
- **FR-PUB-017** Le système distingue sans ambiguïté une publication de production d'un export de bac à sable.

### 9.10 Import et export

- **FR-IO-001** Le système valide tout fichier importé avant de créer ou modifier un brouillon.
- **FR-IO-002** L'utilisateur peut prévisualiser les lignes acceptées, transformées et rejetées avec le motif de chaque rejet.
- **FR-IO-003** Un import peut être relancé de manière idempotente sans créer de doublons lorsqu'il porte le même identifiant de traitement.
- **FR-IO-004** Tout export est conforme à une version identifiée du schéma d'échange.
- **FR-IO-005** L'export contient uniquement des données publiées, sauf fonction de test explicitement marquée et isolée.
- **FR-IO-006** Le module conserve l'empreinte, la date, la version, le destinataire et le statut de chaque export.
- **FR-IO-007** Une erreur d'export n'annule pas la publication ; elle produit un statut distinct et permet une relance contrôlée.
- **FR-IO-008** Une relance du même export conserve le même contenu ou crée une nouvelle occurrence traçable sans ambiguïté.
- **FR-IO-009** Aucun secret technique ou commentaire interne non prévu au contrat n'est inclus dans l'export.
- **FR-IO-010** Le JSON complet inclut les fournisseurs, leurs capacités, machines, matières, grilles de transport et contrats de sous-traitance applicables.
- **FR-IO-011** L'export est déterministe : une même publication et une même version de schéma produisent un contenu fonctionnellement identique.

### 9.11 Recherche, contrôle et audit

- **FR-AUD-001** Les utilisateurs peuvent rechercher et filtrer les moyens par site, type, statut, opération ou période d'effet.
- **FR-AUD-002** Un tableau de complétude présente les erreurs bloquantes, avertissements et données à réviser.
- **FR-AUD-003** Chaque modification conserve l'acteur, l'horodatage, l'ancienne valeur, la nouvelle valeur et, lorsque requis, un motif.
- **FR-AUD-004** Un auditeur peut retrouver le jeu de données correspondant à un identifiant de publication ou d'export.
- **FR-AUD-005** Les consultations et exports de valeurs financières sensibles sont journalisés selon la politique de sécurité retenue.

### 9.12 Business units et environnements

- **FR-ENV-001** Un tenant autorisé peut organiser ses données en une ou plusieurs BU isolées selon le modèle organisationnel retenu.
- **FR-ENV-002** Un administrateur de tenant peut administrer toutes ses BU ; un administrateur de BU ne peut agir qu'à l'intérieur des BU qui lui sont affectées.
- **FR-ENV-003** Une BU peut créer et maintenir des environnements imprimeur, matière et transport sans dupliquer l'identité d'un fournisseur multi-capacités.
- **FR-ENV-004** Un environnement possède un identifiant stable, un nom, un statut, une BU propriétaire, une devise, un système d'unités et une zone géographique.
- **FR-ENV-005** Un environnement imprimeur peut contenir l'identité et l'adresse du site, ses certifications, ses préférences, ses machines, barèmes, catalogues matière et grilles de transport.
- **FR-ENV-006** La désactivation d'un environnement interdit son utilisation dans une nouvelle publication sans supprimer ses versions historiques.
- **FR-ENV-007** Le dashboard permet de rechercher et filtrer les environnements par nom, type, statut et date de mise à jour.
- **FR-ENV-008** Le système distingue sans ambiguïté l'état du brouillon, l'état de validation, la publication active et l'état de livraison au solveur.
- **FR-ENV-009** Les certifications et agréments proviennent d'un référentiel versionné plutôt que d'une série de colonnes ou constantes non gouvernées.
- **FR-ENV-010** Les préférences générales susceptibles d'influencer le solveur sont typées, versionnées et incluses dans le snapshot publié.
- **FR-ENV-011** Une BU peut définir pays, devise et système d'unités par défaut ; toute valeur héritée par un environnement reste identifiable et peut être résolue dans la publication.

### 9.13 Barèmes de machine et tests unitaires

- **FR-SCH-001** Un poste peut contenir zéro, un ou plusieurs barèmes versionnés.
- **FR-SCH-002** Le type de prestation d'un barème est limité aux prestations déclarées réalisables sur le poste, avec une option générique seulement si le contrat solveur la supporte.
- **FR-SCH-003** Un barème peut définir des alternatives de support parmi les types acceptés par la machine.
- **FR-SCH-004** Les conditions peuvent porter sur grammage, épaisseur, dimensions d'entrée, dimensions finies, surface, pages, nombre de postes, passes et quantité.
- **FR-SCH-005** Les sorties économiques peuvent inclure coût fixe, coût au millier, coût horaire, coût surfacique, suppléments et variations en pourcentage selon le contrat solveur.
- **FR-SCH-006** Les paramètres de cadence, temps, consommation et gâche restent identifiables séparément des montants monétaires.
- **FR-SCH-007** Le système détecte les barèmes aux conditions contradictoires, plages inversées et recouvrements ambigus.
- **FR-SCH-008** Un utilisateur peut préparer plusieurs modifications de barème et les sauvegarder explicitement ; aucune saisie partielle ne devient productive par update live.
- **FR-SCH-009** Un test de poste accepte un jeu d'entrées contrôlé, liste les barèmes applicables et explique chaque rubrique du résultat.
- **FR-SCH-010** Les cas de test et résultats attendus sont versionnés avec le barème ou la publication qu'ils valident.
- **FR-SCH-011** Le calcul officiel d'un résultat de test est exécuté par le solveur ou un validateur contractuel ; l'interface Clariprint Data ne réimplémente pas silencieusement ses règles.
- **FR-SCH-012** Les barèmes peuvent être importés et exportés dans un format versionné avec prévisualisation et bilan de réconciliation.
- **FR-SCH-013** Lorsque plusieurs barèmes sont applicables, la sélection suit une règle déterministe validée — priorité explicite, spécificité ou refus — et ne dépend jamais de l'ordre accidentel des lignes en base.

### 9.14 Référentiels matière de BU

- **FR-REF-001** Une BU peut maintenir un référentiel de marques de support partagé par ses environnements.
- **FR-REF-002** Une marque possède un identifiant stable, un nom, un fournisseur éventuel, un type de matière contrôlé et une famille textuelle normalisée.
- **FR-REF-003** Une marque peut porter des qualifications de tenue au feu, certifications, procédés d'impression compatibles et labels environnementaux issus de référentiels gouvernés.
- **FR-REF-004** Une BU peut maintenir des fournisseurs matière avec leurs informations légales, coordonnées, devise et système d'unités.
- **FR-REF-005** Une BU peut maintenir un catalogue SKU dont la clé métier candidate est `fournisseur + SKU`, sous réserve de validation des règles de normalisation.
- **FR-REF-006** Un SKU distingue référencement, qualification technique, dimensions, conditionnement et conditions tarifaires.
- **FR-REF-007** Les minimums, unités de commande, unités de tarification, remises, bornes et variations sont structurés et validés.
- **FR-REF-008** Un import intégral et un import tarifaire utilisent des contrats distincts et versionnés.
- **FR-REF-009** La création automatique d'un fournisseur ou d'une marque inconnue produit un objet à qualifier et une trace explicite ; elle ne crée pas silencieusement une donnée publiée.
- **FR-REF-010** Une référence matière sélectionnée dans un environnement conserve la version du référentiel BU utilisée.

### 9.15 Référentiels transport de BU

- **FR-TBU-001** Une BU peut maintenir des transporteurs indépendants des prestations propres aux imprimeurs.
- **FR-TBU-002** Un transporteur possède des informations légales, coordonnées, devise et système d'unités.
- **FR-TBU-003** Une grille indique type de transport, délai, période, contraintes de poids et dimensions, tarification et suppléments.
- **FR-TBU-004** Une matrice tarifaire peut croiser zone d'enlèvement, zone de destination et tranche de poids.
- **FR-TBU-005** Les zones géographiques utilisent des identifiants contrôlés et ne dépendent pas de libellés libres.
- **FR-TBU-006** L'import/export tabulaire d'une grille est versionné, prévisualisé et réconcilié.
- **FR-TBU-007** Une grille sélectionnée dans un environnement conserve son transporteur et la version de référentiel BU utilisée.

### 9.16 Délégation d'accès

- **FR-DEL-001** Un administrateur autorisé peut déléguer l'accès à un environnement précis jusqu'à une date d'expiration.
- **FR-DEL-002** Une délégation possède un bénéficiaire, un environnement, une liste de capabilities, un créateur, une date de création, une expiration et un statut.
- **FR-DEL-003** Le bénéficiaire doit être authentifié par le module `identity` ; un lien de partage seul ne constitue pas une autorisation.
- **FR-DEL-004** Un code temporaire éventuel est à usage limité, stocké de manière sûre, protégé contre les tentatives répétées et jamais journalisé en clair.
- **FR-DEL-005** L'accès délégué n'inclut pas l'administration de la BU, les données financières ou la publication sauf capability explicite.
- **FR-DEL-006** La révocation ou l'expiration prend effet côté serveur et invalide les nouvelles actions.
- **FR-DEL-007** Création, utilisation sensible, expiration et révocation sont auditées.
- **FR-DEL-008** Le système peut exiger une authentification renforcée pour publication, modification financière ou création de grants externes selon la politique de sécurité retenue.

### 9.17 Intégration des tests projet

- **FR-TST-001** Clariprint Data peut préparer des cas produit destinés à valider un environnement ou une publication avec le solveur.
- **FR-TST-002** Un cas conserve ses entrées, la publication testée, la version de contrat solveur et son propriétaire.
- **FR-TST-003** Les coûts d'impression, façonnage, conditionnement, transport et matière affichés proviennent d'un résultat solveur identifié.
- **FR-TST-004** Un recalcul ne remplace pas silencieusement le résultat précédent ; les exécutions restent comparables.
- **FR-TST-005** La propriété fonctionnelle des projets et résultats de test doit être attribuée avant implémentation durable.

### 9.18 Profils clients, politiques tarifaires et accès calcul

- **FR-CAC-001** Un imprimeur peut créer, modifier, désactiver et archiver des profils clients tenant-scoped.
- **FR-CAC-002** Un profil client possède un identifiant stable publiable indépendamment de son libellé.
- **FR-CAC-003** Une politique tarifaire possède une version, une date de début, une date de fin éventuelle, un statut et une provenance.
- **FR-CAC-004** Une politique peut définir un ajustement global et des ajustements spécifiques pour une ou plusieurs machines.
- **FR-CAC-005** Chaque ajustement distingue explicitement marge sur coût, majoration, remise ou autre opération autorisée ; sa formule et sa base d'application sont déterministes.
- **FR-CAC-006** La priorité entre ajustement machine et ajustement global est explicite et testée ; aucun double ajustement ne se produit implicitement.
- **FR-CAC-007** Deux politiques applicables au même profil, à la même cible et au même instant ne peuvent pas se chevaucher de manière ambiguë.
- **FR-CAC-008** Un contrat d'accès relie un profil client à un pool ou à une règle de résolution de publication, avec des filtres optionnels de machines et ressources.
- **FR-CAC-009** Un contrat peut posséder plusieurs clés API actives, chacune avec identifiant, libellé, création, expiration éventuelle, dernière utilisation et statut de révocation.
- **FR-CAC-010** La valeur secrète d'une clé locale n'est affichée qu'à sa création, n'est stockée que sous une forme de vérification sûre et n'est jamais journalisée ou exportée.
- **FR-CAC-011** Une clé peut être créée, tournée et révoquée sans invalider les autres clés du contrat.
- **FR-CAC-012** Un profil peut être publié sans clé locale afin qu'un système d'accès externe configure ses propres modes d'authentification et transmette une référence de profil dans un contexte de confiance.
- **FR-CAC-013** Une simple référence de profil provenant d'un appel non authentifié n'autorise aucun accès au pool.
- **FR-CAC-014** Lors d'une demande, Clariprint Data résout contrat, profil, publication source, date d'effet, filtres et politique avant de générer la projection.
- **FR-CAC-015** La projection est un JSON complet et conforme au contrat solveur, contenant uniquement les ressources autorisées et leurs tarifs déjà ajustés.
- **FR-CAC-016** Le solveur n'a pas à appliquer de marge ou remise supplémentaire aux tarifs de la projection, sauf contrat distinct explicitement versionné.
- **FR-CAC-017** Une même publication, un même profil, une même politique, une même date d'effet et une même version de schéma produisent une projection fonctionnellement identique.
- **FR-CAC-018** La génération conserve publication source, contrat, profil, politique, date d'effet, mode d'accès, identifiant de credential éventuel et empreinte du JSON.
- **FR-CAC-019** Le résultat ne révèle pas les montants source non ajustés lorsque le contrat ne les autorise pas.
- **FR-CAC-020** Une clé expirée ou révoquée et un profil désactivé sont refusés avant toute génération de données.

## 10. Règles métier initiales

- **BR-001** Une machine archivée ne peut plus être modifiée ni incluse dans une nouvelle publication, mais reste visible dans l'historique.
- **BR-002** La suppression physique d'un objet déjà publié est interdite.
- **BR-003** Une date de fin d'effet ne peut pas précéder la date de début.
- **BR-004** Deux versions applicables d'une même valeur ne peuvent pas se chevaucher dans un même périmètre, sauf exception métier explicitement modélisée.
- **BR-005** Toute valeur possède une unité ; les valeurs sans dimension utilisent une unité explicite de type coefficient ou pourcentage.
- **BR-006** Une donnée financière ne peut être publiée que par un acteur disposant du droit correspondant, directement ou via un workflow de validation.
- **BR-007** Une erreur de cohérence bloquante interdit la publication ; un avertissement exige une acceptation explicite si la politique de l'organisation le prévoit.
- **BR-008** Une publication déjà consommée par le solveur ne peut pas être modifiée.
- **BR-009** Les identifiants exportés sont stables pendant toute la durée de vie de l'objet, même si son libellé change.
- **BR-010** Le statut de publication et le statut de livraison au solveur sont deux états distincts.
- **BR-011** Une valeur nulle, absente, illimitée ou non applicable possède une représentation non ambiguë.
- **BR-012** Les paramètres économiques utilisés par le solveur sont conservés avec une précision supérieure ou égale à celle affichée dans l'interface.
- **BR-013** Les qualifications offset, numérique, PLV, façonnage, papier et transport sont des capacités cumulables, non des types exclusifs de fournisseur.
- **BR-014** Une ressource appartient toujours à un fournisseur propriétaire unique, même lorsqu'elle est utilisée en sous-traitance par plusieurs donneurs d'ordre.
- **BR-015** Un contrat de sous-traitance n'autorise que les machines listées et les offres papier ou transport explicitement activées.
- **BR-016** Les ressources d'un sous-traitant de rang deux ne sont pas incluses automatiquement dans le parc du donneur d'ordre initial.
- **BR-017** Un bac à sable ne peut jamais devenir la source d'un calcul de production par simple changement de statut ; une nouvelle publication validée est obligatoire.
- **BR-018** Une publication arrivée à sa fin de validité ne peut plus être choisie pour un nouveau calcul de production.
- **BR-019** Le JSON d'une publication est figé et doit pouvoir être régénéré à l'identique à partir de l'instantané conservé.
- **BR-020** Une autorisation papier n'est valide que si le sous-traitant possède la capacité de fourniture de papier ; la même règle s'applique au transport.
- **BR-021** Une BU ne constitue pas automatiquement une frontière de sécurité distincte du tenant ; sa portée exacte doit être appliquée explicitement par les services et la RLS.
- **BR-022** Un environnement spécialisé ne duplique pas l'identité d'un fournisseur uniquement parce qu'il porte une autre capacité.
- **BR-023** Restaurer une publication crée un nouveau brouillon fondé sur son snapshot ; aucune restauration ne réécrit les données ou versions historiques.
- **BR-024** Une délégation expirée ou révoquée ne permet aucune nouvelle action, même si le bénéficiaire conserve l'URL initiale.
- **BR-025** Les listes machines, supports, prestations, certifications et zones sont des référentiels versionnés, pas des enums dispersés dans l'interface.
- **BR-026** Un résultat de test officiel indique le solveur, sa version contractuelle, la publication et les entrées utilisées.
- **BR-027** La création automatique issue d'un import produit un objet brouillon ou à qualifier ; elle ne publie jamais implicitement un fournisseur, une marque ou un SKU.
- **BR-028** Une référence à un catalogue BU conserve la version résolue afin qu'une publication soit reproductible après mise à jour du catalogue.
- **BR-029** Les rôles historiques `tenantAdmin`, `buAdmin`, `printerAdmin`, `paperAdmin` ou similaires sont des presets de capabilities et scopes ; ils ne deviennent pas des règles codées dans le kernel.
- **BR-030** La règle « premier barème trouvé » est interdite si elle dépend de l'ordre de stockage ; tout arbitrage entre barèmes applicables est explicite et testable.
- **BR-031** La nature `production_cost` ou `commercial_rate` des montants source est explicite et ne peut pas être déduite d'un libellé ou du profil client.
- **BR-032** Une politique client ne modifie jamais le pool ou sa publication ; elle produit uniquement une projection ajustée.
- **BR-033** Une règle spécifique à une machine et une règle globale ne se cumulent que si la politique le demande explicitement ; par défaut la règle spécifique remplace la règle globale pour sa cible.
- **BR-034** La politique applicable est résolue à la date d'effet demandée, pas à la seule date d'exécution technique.
- **BR-035** Une référence de profil n'est acceptée sans clé locale que depuis un mode d'accès externe authentifié et autorisé.
- **BR-036** Plusieurs clés peuvent authentifier le même contrat, mais chaque clé possède son propre cycle de vie et son propre identifiant d'audit.
- **BR-037** Une projection ajustée est immuable et identifiable par son empreinte une fois remise au solveur.
- **BR-038** Le solveur consomme les tarifs ajustés de la projection et ne recalcule pas la politique de profil.
- **BR-039** Le type d'ajustement détermine sa formule ; marge sur coût, majoration et remise ne sont jamais traitées comme des synonymes.

## 11. Exigences non fonctionnelles

### Sécurité et confidentialité

- isolation stricte des organisations au niveau de la base et des services ;
- contrôle des droits côté serveur pour toute lecture ou modification sensible ;
- chiffrement des échanges et des données sensibles selon leur classification ;
- absence de secret dans les journaux et fichiers exportés ;
- journalisation des actions d'administration, de validation et d'export ;
- capacité à restreindre séparément les données techniques et financières.
- expiration, révocation, limitation de tentatives et audit pour toute délégation ou authentification par code temporaire ;
- interdiction d'utiliser un secret partagé permanent ou un mot de passe de lien comme unique barrière d'autorisation.
- stockage non réversible des clés API locales, affichage du secret une seule fois, rotation et révocation indépendantes ;
- limitation de débit, détection des échecs répétés et audit par identifiant de clé ;
- authentification obligatoire du système externe autorisé à résoudre un profil sans clé locale.

### Intégrité et fiabilité

- transactions atomiques pour la publication d'un jeu de données ;
- validation par schéma à l'entrée, au stockage et à l'export ;
- export reproductible à partir d'une publication donnée ;
- sauvegarde et restauration testées ;
- identifiants stables et stratégie de migration de schéma documentée ;
- traitement idempotent des imports et exports rejouables.

### Performance cible initiale

Les seuils définitifs dépendront du volume réel des parcs. Pour le cadrage initial :

- affichage d'une liste filtrée courante en moins de 2 secondes au 95e percentile ;
- validation interactive d'une fiche en moins de 500 ms hors appel réseau externe ;
- génération d'un export standard en moins de 60 secondes pour un parc de référence à définir ;
- absence de blocage global de l'interface pendant un import ou export long.
- génération d'une projection ajustée dans un délai compatible avec l'appel synchrone du solveur, seuil à fixer sur le parc pilote ;
- cache éventuel indexé au minimum par publication, profil, politique, date d'effet, filtres et version de schéma afin d'éviter toute réutilisation entre clients.

### Utilisabilité et accessibilité

- interface utilisable par un expert métier sans connaissance du format d'export ;
- unités toujours visibles à proximité des valeurs ;
- aide contextuelle pour les termes et règles complexes ;
- erreurs formulées avec l'objet, le champ, la cause et une action corrective ;
- navigation clavier, contrastes et composants conformes à WCAG 2.1 AA sur les parcours principaux ;
- protection contre la perte d'un brouillon non enregistré.
- interface disponible au minimum en français et en anglais, avec fallback explicite et sans traduction des données métier saisies par l'utilisateur ;
- libellés, erreurs, attributs accessibles et unités localisables sans changer les valeurs canoniques exportées.

### Observabilité

- métriques sur les imports, validations, publications et exports ;
- corrélation par identifiants d'organisation, publication et export ;
- alertes sur les échecs répétés d'export ou les incompatibilités de schéma ;
- aucun contenu financier sensible dans la télémétrie non sécurisée.

## 12. Proposition de MVP

Le MVP doit prouver que Clariprint Data peut produire un référentiel fiable et consommable pour un parc réel, sans chercher à couvrir immédiatement toutes les familles de machines.

### Inclus dans le MVP

- une BU pilote et un environnement imprimeur, sans préjuger du modèle multi-BU définitif ;
- un fournisseur et un établissement, avec modèle extensible au multi-sites et multi-fournisseurs ;
- authentification et quatre droits : consulter, éditer technique, éditer financier, publier ;
- attribution de plusieurs capacités à un fournisseur ;
- référentiels d'unités, types de moyens et opérations ;
- création et gestion de machines internes ;
- catalogue initial de matières et tarifs papier ;
- grilles de transport fondées sur les dimensions retenues pour le pilote ;
- contrat de sous-traitance vers au moins un fournisseur, avec machines autorisées, autorisations papier et transport, date de début et date de fin ;
- aptitudes fondées sur des bornes et listes de valeurs ;
- temps fixes, cadences, gâches et coûts requis par un premier cas d'usage ;
- un ensemble minimal de barèmes pour un poste du flux pilote, avec cas de test et résultat explicable ;
- brouillon, contrôles bloquants, validation simple et publication immuable ;
- création d'un bac à sable depuis la publication active, modification isolée et comparaison ;
- comparaison entre brouillon et dernière publication ;
- export JSON complet et versionné vers un fichier ou endpoint défini avec l'équipe solveur ;
- historique des publications et statut des exports ;
- import tabulaire limité aux équipements et paramètres retenus pour le pilote ;
- import pilote d'un catalogue matière ou d'une grille de transport seulement si nécessaire au flux de référence ;
- qualification explicite du pool pilote comme coûts de production ou tarifs commerciaux ;
- un profil client avec politique globale, exception par machine et périodes de validité ;
- un contrat d'accès avec filtres, deux clés locales permettant de démontrer la rotation, et publication de la référence du profil pour un mode externe ;
- génération déterministe d'un JSON solveur complet aux tarifs ajustés ;
- tests de contrat sur un jeu de données de référence fourni par Clariprint.

### Reporté après le MVP

- workflows de validation configurables à plusieurs niveaux ;
- bibliothèque avancée de modèles de machines ;
- sous-traitance transitive ou chaînes de sous-traitants ;
- règles techniques complexes composées dans un éditeur visuel ;
- calendriers fins de capacité ou indisponibilités temps réel ;
- scénarios multi-sites avancés ;
- propagation automatique d'une modification de modèle ;
- analyses de qualité et suggestions automatiques fondées sur l'historique ;
- connecteurs ERP, MIS ou systèmes comptables ;
- hiérarchie multi-BU avancée et tous les types d'environnements spécialisés ;
- catalogue SKU BU complet si le flux pilote n'en dépend pas ;
- gestion générale des projets et devis de test ;
- partage anonyme ou par mot de passe ; la délégation durable doit utiliser l'identité et les capabilities plateforme.

## 13. Indicateurs de succès

Les cibles chiffrées doivent être établies après mesure du processus actuel. Les indicateurs proposés sont :

- temps médian nécessaire pour créer un parc initial exploitable ;
- temps médian nécessaire pour ajouter ou modifier une machine ;
- pourcentage de publications acceptées par le solveur au premier export ;
- nombre d'erreurs bloquantes détectées avant export ;
- proportion d'objets publiés dont tous les champs obligatoires ont une provenance ;
- délai moyen entre une évolution industrielle réelle et sa publication ;
- nombre d'incidents de calcul attribuables à une donnée de parc erronée ou obsolète ;
- taux d'utilisation du workflow brouillon-validation par rapport aux modifications hors processus ;
- capacité d'un support à retrouver en moins de cinq minutes la publication ayant alimenté un calcul donné ;
- proportion de projections dont publication, profil, politique et date d'effet sont entièrement traçables ;
- taux d'échec de résolution de profil ou credential ;
- absence d'incident de réutilisation d'une projection ou d'un cache entre profils clients.

## 14. Critères d'acceptation du MVP

Le MVP est acceptable lorsqu'un utilisateur pilote peut :

1. créer le parc de référence convenu sans intervention directe en base ;
2. représenter les aptitudes et paramètres nécessaires à au moins un flux d'impression complet retenu pour le pilote ;
3. obtenir une liste explicite des données manquantes ou incohérentes ;
4. faire valider puis publier une version immuable ;
5. exporter cette version dans le format attendu par le solveur ;
6. faire accepter l'export par un test de contrat ou un environnement solveur ;
7. modifier un coût avec une date d'effet sans altérer la version précédente ;
8. désactiver une machine tout en retrouvant les publications historiques qui l'utilisaient ;
9. comparer deux publications et identifier les changements techniques et financiers ;
10. démontrer qu'un utilisateur technique non financier ne peut ni lire ni modifier les coûts protégés ;
11. créer un fournisseur cumulant impression et vente de papier sans dupliquer son identité ;
12. créer un contrat autorisant une machine d'un sous-traitant et refusant ses offres papier et transport, sans importer ses autres ressources ;
13. modifier une donnée dans un bac à sable et démontrer que le JSON de production reste inchangé ;
14. produire un JSON complet comportant les métadonnées de publication et accepté par le serveur de calcul de test ;
15. créer un environnement imprimeur brouillon et retrouver sa BU, son site, ses unités et sa devise ;
16. définir un barème du flux pilote, identifier les conditions applicables et expliquer le résultat de son cas de test ;
17. restaurer une ancienne publication sous forme de nouveau brouillon sans modifier son snapshot ;
18. démontrer qu'une référence matière ou transport mutualisée conserve la version BU utilisée dans la publication ;
19. accorder puis révoquer un accès délégué limité à un environnement sans ouvrir l'administration de la BU ;
20. qualifier les montants du pool pilote comme coûts de production ou tarifs commerciaux ;
21. créer un profil client avec une politique globale et une exception par machine valides sur une période donnée ;
22. générer, utiliser, tourner et révoquer plusieurs clés indépendantes pour le même contrat ;
23. publier la référence du profil et la résoudre depuis un mode d'accès externe authentifié ;
24. demander les données à deux dates différentes et obtenir les politiques respectivement applicables ;
25. produire un JSON complet aux tarifs ajustés sans modifier ni exposer les montants source non autorisés ;
26. démontrer qu'une même entrée produit la même empreinte et qu'un autre profil produit une projection isolée.

## 15. Risques principaux

| Risque | Effet | Réponse proposée |
|---|---|---|
| Modèle trop générique | Saisie complexe et export difficile à interpréter | Commencer par des familles de moyens réellement utilisées dans le pilote |
| Modèle trop spécifique | Multiplication des champs et impossibilité d'étendre le parc | Séparer noyau commun, schémas par type et règles versionnées |
| Divergence avec le solveur | Données valides dans l'IHM mais inutilisables au calcul | Définir tôt le contrat et maintenir des tests de référence communs |
| Valeurs économiques mal gouvernées | Coûts ou prix faux, fuite d'informations sensibles | Droits dédiés, provenance, double validation optionnelle et audit |
| Confusion entre zéro et absence | Sous-évaluation silencieuse des coûts | Sémantique typée et validation bloquante |
| Modification rétroactive | Impossibilité d'expliquer un ancien calcul | Publications immuables et dates d'effet |
| Règles métier trop libres | Contradictions impossibles à tester | DSL ou structures déclaratives contrôlées, sans code utilisateur arbitraire |
| Import massif non maîtrisé | Corruption ou écrasement du référentiel | Prévisualisation, idempotence, brouillon et validation avant publication |
| Vocabulaire non partagé | Mauvaise saisie et mappings fragiles | Glossaire gouverné avec identifiants stables |
| Extension prématurée à l'ordonnancement | Dilution du produit et forte complexité | Maintenir la frontière : capacité structurelle, pas planning temps réel |
| Partage excessif d'un sous-traitant | Exposition de ressources ou tarifs non autorisés | Contrat explicite et export limité aux machines et offres autorisées |
| Boucle ou transitivité implicite | Parc incohérent ou ressources comptées plusieurs fois | Détection des cycles et absence de transitivité par défaut |
| Confusion bac à sable / production | Calculs réels fondés sur des données expérimentales | Environnements, identifiants et destinations d'export strictement séparés |
| Prompts de maquette traités comme contrat métier | Modèle incohérent, enums dupliqués et dette d'interface | Consolider les corrections, versionner les référentiels et tracer les décisions |
| Confusion fournisseur / environnement / BU | Duplication d'identité et frontières de sécurité ambiguës | Valider le modèle d'ownership avant le schéma SQL |
| Barèmes réimplémentant le solveur | Divergence de calcul entre test et production | Contrat partagé et exécution officielle par le solveur ou son validateur |
| Partage par lien insuffisamment protégé | Accès non autorisé à des données industrielles ou financières | Identité vérifiée, grant limité, expiration, révocation, rate limiting et audit |
| Référentiel BU modifié après publication | Publication impossible à reproduire | Référence versionnée ou snapshot des éléments effectivement utilisés |
| Sémantique marge/remise ambiguë | Tarif ajusté mathématiquement faux | Types d'ajustement distincts, formule versionnée et corpus de référence |
| Double application d'une règle globale et machine | Surfacturation ou remise excessive | Priorité explicite et trace des règles appliquées |
| Politique incorrecte à la date demandée | Prix client invalide | Intervalles non ambigus et résolution par date d'effet |
| Fuite ou réutilisation de clé API | Accès non autorisé au pool | Secret affiché une fois, hash, rotation, expiration, révocation et rate limiting |
| Cache partagé entre profils | Fuite tarifaire inter-client | Clé de cache complète et tests d'isolation des projections |
| Profil transmis sans authentification | Contournement des contrats d'accès | Résolution externe réservée aux systèmes authentifiés et autorisés |

## 16. Décisions à prendre avec les experts métier

### Priorité haute — nécessaires avant conception détaillée

1. Quel est le format actuel d'entrée du solveur et qui en maintient le contrat ?
2. Le solveur consomme-t-il un instantané complet, un différentiel ou les deux ?
3. Quelles familles de machines, matières, grilles de transport et quel flux de production serviront de périmètre pilote ?
4. Quelles caractéristiques sont obligatoires pour chacune de ces familles ?
5. Quels paramètres économiques sont réellement consommés : coûts horaires, main-d'œuvre, énergie, matière, gâche, minimums, sous-traitance, marge ou autres ?
6. Quelles sémantiques et formules exactes distinguent marge sur coût, majoration et remise dans une politique client ?
7. Quelles règles constituent une erreur bloquante, et lesquelles ne sont que des avertissements ?
8. Une publication doit-elle être validée par une seconde personne ? La réponse diffère-t-elle entre données techniques et financières ?
9. Le multi-sites et le multi-fournisseurs sont-ils requis dès le pilote, et les ressources peuvent-elles être partagées entre établissements ?
10. Comment un calcul ou devis existant référence-t-il aujourd'hui la version du parc utilisée ?
11. Les autorisations papier et transport ouvrent-elles toute l'offre correspondante du sous-traitant, ou faut-il pouvoir limiter ces offres à certaines références ou grilles ?
12. Une chaîne de sous-traitance au-delà d'un niveau doit-elle être interdite ou explicitement autorisable ?
13. Un bac à sable doit-il pouvoir appeler un serveur de calcul de test, ou seulement générer et télécharger son JSON ?

### Priorité moyenne — nécessaires avant finalisation du MVP

14. Quelles unités et conventions d'arrondi sont canoniques ?
15. Faut-il gérer plusieurs devises ? Si oui, qui fournit le taux et à quelle date est-il figé ?
16. Quelles données peuvent être héritées d'un modèle de machine et lesquelles doivent être saisies localement ?
17. Quels formats d'import existants doivent être repris ?
18. Quelle volumétrie maximale faut-il supporter : fournisseurs, sites, machines, matières, grilles, contrats, règles et versions ?
19. Quelle durée de conservation s'applique aux versions, bacs à sable, exports et journaux ?
20. Quels utilisateurs Clariprint ou support peuvent accéder aux données d'un client, et selon quelle procédure ?
21. Le solveur doit-il pouvoir demander une version historique ou uniquement la version courante ?
22. Que doit-il se passer si une publication est valide mais que sa livraison au solveur échoue ?
23. `PrinterEnvironment` est-il un agrégat distinct, une vue spécialisée du fournisseur/site ou le périmètre d'un dataset publiable ?
24. Une BU réutilise-t-elle le modèle de sous-tenant actuel ou nécessite-t-elle un concept et des policies dédiés ?
25. Paper et Transport Environments sont-ils des fournisseurs spécialisés, des catalogues mutualisés ou les deux ?
26. Quels éléments des listes PrintMaster de machines, supports, prestations, agréments et certifications sont canoniques ?
27. Quel est le schéma officiel d'un barème, qui exécute son test unitaire et comment arbitrer plusieurs barèmes applicables ?
28. Les référentiels matière et transport BU sont-ils copiés dans une publication ou référencés par version immuable ?
29. Quelle méthode d'identité et d'invitation doit remplacer le partage historique par lien et mot de passe ?
30. Quel module possède les projets et résultats de tests solveur ?
31. Quels éléments PrintMaster sont indispensables au MVP et lesquels appartiennent à une phase ultérieure ?
32. Une authentification renforcée est-elle obligatoire pour publier, modifier les coûts ou accorder une délégation externe ?
33. Quelles règles d'héritage s'appliquent entre devise, unités et pays de la BU et ceux d'un environnement ?
34. Quels champs d'audit avant/après peuvent contenir des informations financières ou personnelles ?
35. Les associations BU-fournisseur avec priorité et valeur par défaut sont-elles nécessaires au MVP ?
36. La nature coût de production ou tarif commercial s'applique-t-elle à tout le pool, à une publication ou à chaque montant ?
37. Une exception machine remplace-t-elle toujours la règle globale ou certains ajustements peuvent-ils se cumuler ?
38. Un contrat pointe-t-il une publication fixe ou résout-il la publication active à la date d'effet ?
39. Quels filtres de ressources un contrat peut-il exprimer : machines, matières, transport, sous-traitants ou catégories ?
40. Quel protocole permet à un système externe authentifié d'associer ses modes d'accès aux profils publiés ?
41. La projection ajustée est-elle persistée intégralement ou seulement régénérable avec empreinte et métadonnées ?

## 17. Hypothèses de cadrage à confirmer

- Clariprint Data est une application web multi-fournisseurs et multi-organisation.
- Une organisation peut contenir des BU ; leur correspondance avec les tenants et sous-tenants Magrit reste à confirmer.
- Un environnement est une configuration éditable et publiable rattachée à une BU, un fournisseur et éventuellement un site ; sa frontière d'agrégat reste à confirmer.
- Un fournisseur peut cumuler librement plusieurs capacités métier.
- Imprimeurs, papetiers, façonniers et transporteurs utilisent le même noyau d'identité, de versionnement et de publication.
- Machines, matières et grilles de transport restent des ressources métier distinctes.
- Le solveur peut consommer un export versionné et identifier la version utilisée.
- Les données techniques et financières peuvent nécessiter des droits différents.
- Le besoin porte sur la capacité structurelle du parc, non sur sa charge temps réel.
- Une organisation doit pouvoir préparer une évolution sans affecter la version active.
- Un bac à sable est une copie isolée dont le JSON ne peut viser que le calcul de test.
- La totalité du parc accessible, y compris les ressources sous-traitées sélectionnées, est incluse dans la publication JSON.
- Le MVP sera validé sur un parc et un flux réels fournis par un partenaire pilote.
- Le vocabulaire et le format historique du solveur existent mais ne sont pas encore documentés dans ce dépôt.
- Les listes issues de PrintMaster constituent un corpus métier utile mais non normalisé, et non des enums directement implémentables.
- Clariprint Data possède les profils clients, politiques tarifaires et contrats d'accès, applique les ajustements et génère le JSON complet consommé par le solveur.
- Un profil peut être résolu par plusieurs clés locales ou par un mode d'accès externe authentifié utilisant sa référence publiée.

## 18. Dépendances

- disponibilité d'un expert du modèle métier Clariprint ;
- documentation ou exemples réels du format d'entrée solveur ;
- jeu de données représentatif et anonymisable d'un parc existant ;
- résultats attendus ou tests de référence permettant de vérifier l'intégration ;
- règles de confidentialité applicables aux données industrielles et financières ;
- décision sur l'identité, le multi-tenant et le modèle de droits commun avec le reste de la plateforme.
- consolidation avec les experts des référentiels candidats et workflows décrits dans la source PrintMaster/Base44.
- revue du dictionnaire de données et des formules candidates du PRD initial PrintFlow Pro sans les traiter comme schéma ou moteur de calcul cible.

## 19. Prochain livrable recommandé

Après validation de ce cadrage, produire un **dossier de découverte métier** composé de :

1. un glossaire Clariprint validé ;
2. un exemple complet de parc actuel, de sa source jusqu'à l'entrée solveur ;
3. une matrice `capacité fournisseur × ressources × paramètres requis` ;
4. une matrice des rôles et droits ;
5. le contrat d'échange versionné avec le solveur ;
6. un exemple de contrat de sous-traitance avec machines et offres autorisées ;
7. une cartographie des règles de validation ;
8. le découpage du MVP en parcours et critères d'acceptation testables ;
9. une table de correspondance entre les concepts historiques PrintMaster et le modèle Clariprint Data retenu ;
10. des référentiels normalisés pour les machines, supports, prestations, certifications et zones du pilote.

Ces éléments permettront ensuite de produire l'architecture métier et technique sans figer prématurément un modèle de données incomplet.

## 20. Hiérarchie des sources

En cas de divergence documentaire, l'ordre de décision est :

1. décisions validées avec les experts métier et contrat réel du solveur ;
2. présent PRD et ADR acceptés ;
3. PRD initial PrintFlow Pro comme référence détaillée ;
4. prompts Base44 comme historique des besoins, variantes et choix de maquette.

Une information issue d'une source historique reste candidate tant qu'elle n'est pas validée ou intégrée explicitement dans une exigence du présent document.
