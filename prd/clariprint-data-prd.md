# Clariprint Data

> PRD du module métier de description des moyens de production
>
> Version : 0.3  
> Date : 2026-08-05  
> Statut : draft de cadrage à valider avec les experts métier  
> Produit parent : Clariprint  
> Périmètre : fournisseurs, machines, matières, transports, sous-traitance et publications

## 1. Résumé

Clariprint est une application métier permettant de calculer des prix d'impression. Son fonctionnement global repose sur trois ensembles distincts :

1. une interface de description du besoin d'impression, prévue ultérieurement ;
2. un solveur de calcul et d'optimisation, extérieur au présent projet ;
3. une application de description des fournisseurs, de leurs ressources, de leurs aptitudes techniques et de leurs paramètres économiques.

Le présent projet concerne exclusivement le troisième ensemble, nommé **Clariprint Data** dans ce document.

Clariprint Data doit permettre à une entreprise de décrire de manière fiable, structurée, versionnée et exploitable les fournisseurs mobilisables pour fabriquer et livrer un produit imprimé. Un fournisseur n'est pas enfermé dans un type unique : il porte une ou plusieurs **capacités métier**, par exemple impression offset, impression numérique, impression PLV, façonnage, fourniture de papier ou transport.

Le fournisseur qui utilise Clariprint peut décrire ses propres machines, matières et grilles de transport, mais aussi référencer des capacités proposées par d'autres fournisseurs en sous-traitance. Les données publiées par le module sont destinées à être exportées dans leur totalité, au format JSON directement consommable par le solveur Clariprint, qui reste seul responsable du calcul d'un scénario de production et de son prix.

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
6. **Le solveur est un consommateur externe.** Clariprint Data prépare et exporte les données ; il ne choisit pas la solution de production et ne calcule pas le prix final.
7. **Production et expérimentation sont isolées.** Seule une publication de production peut alimenter les calculs de production ; un bac à sable n'a aucun effet tant qu'il n'est pas validé et publié.
8. **Toute évolution est traçable.** L'auteur, la date, la raison et l'effet d'une modification doivent pouvoir être retrouvés.
9. **Le vocabulaire métier est partagé.** Les unités, catégories de machines, opérations et caractéristiques doivent provenir de référentiels contrôlés.

## 5. Périmètre

### 5.1 Dans le périmètre

- gestion des fournisseurs et, si retenu, de leurs établissements ou sites ;
- attribution de plusieurs capacités métier à un même fournisseur ;
- inventaire des machines et fonctionnalités propres ou accessibles en sous-traitance ;
- catalogue de matières premières et tarifs associés ;
- grilles de transport ;
- contrats de sous-traitance entre fournisseurs, limités aux machines et familles de services explicitement autorisées ;
- description des caractéristiques et aptitudes techniques ;
- définition des compatibilités, limites et exclusions ;
- description des opérations réalisables et de leurs enchaînements autorisés ;
- paramétrage des temps, consommations, gâches et autres inducteurs de coût ;
- paramétrage des coûts industriels et règles économiques nécessaires au solveur ;
- gestion des calendriers ou disponibilités structurelles si elles influencent le calcul ;
- contrôles de complétude et de cohérence ;
- simulation de l'impact d'une modification, limitée à des contrôles de données et non à l'exécution du solveur ;
- cycle brouillon, validation, publication et archivage ;
- versionnement, dates d'effet et historique ;
- création de bacs à sable à partir d'une publication de production ;
- comparaison et promotion contrôlée d'un bac à sable vers une publication ;
- import initial ou mise à jour en masse selon des formats contrôlés ;
- export d'un jeu de données vers le système solveur ;
- journal d'audit, droits et séparation des organisations.

### 5.2 Hors périmètre

- description du besoin d'impression par le client ou le commercial ;
- calcul du plan de production optimal ;
- calcul du prix final et comparaison des solutions ;
- ordonnancement temps réel de l'atelier ;
- pilotage des machines, collecte IoT ou supervision de production ;
- maintenance préventive ou curative des équipements ;
- gestion comptable, facturation ou paie ;
- PIM commercial et publication d'un catalogue de produits ;
- développement interne du solveur Clariprint.

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

## 6. Utilisateurs et rôles

### Administrateur d'organisation

Il crée les sites, gère les utilisateurs, attribue les droits et contrôle les paramètres généraux de son organisation.

### Responsable industriel

Il décrit le parc, les opérations, les limites techniques et les relations entre moyens de production. Il est responsable de la fidélité du modèle industriel.

### Contrôleur de gestion ou responsable financier

Il maintient ou valide les coûts horaires, coûts de calage, coûts matière, seuils et autres paramètres économiques autorisés. L'accès à ces informations peut être plus restreint que l'accès aux données techniques.

### Deviseur expert

Il consulte le référentiel, signale les incohérences et peut proposer des ajustements. Selon l'organisation, il peut aussi éditer ou valider certaines données.

### Validateur / publieur

Il contrôle un jeu de modifications et autorise sa publication vers le solveur. Ce rôle peut être cumulé avec celui de responsable industriel, mais la séparation des rôles doit être possible.

### Auditeur ou support Clariprint

Il consulte les versions, contrôles et journaux nécessaires au diagnostic, dans les limites contractuelles et avec des accès explicitement tracés.

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
| Bac à sable | Branche isolée permettant d'expérimenter à partir de données existantes |
| Publication | Instantané JSON immuable, daté et directement consommable par le solveur |

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

## 11. Exigences non fonctionnelles

### Sécurité et confidentialité

- isolation stricte des organisations au niveau de la base et des services ;
- contrôle des droits côté serveur pour toute lecture ou modification sensible ;
- chiffrement des échanges et des données sensibles selon leur classification ;
- absence de secret dans les journaux et fichiers exportés ;
- journalisation des actions d'administration, de validation et d'export ;
- capacité à restreindre séparément les données techniques et financières.

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

### Utilisabilité et accessibilité

- interface utilisable par un expert métier sans connaissance du format d'export ;
- unités toujours visibles à proximité des valeurs ;
- aide contextuelle pour les termes et règles complexes ;
- erreurs formulées avec l'objet, le champ, la cause et une action corrective ;
- navigation clavier, contrastes et composants conformes à WCAG 2.1 AA sur les parcours principaux ;
- protection contre la perte d'un brouillon non enregistré.

### Observabilité

- métriques sur les imports, validations, publications et exports ;
- corrélation par identifiants d'organisation, publication et export ;
- alertes sur les échecs répétés d'export ou les incompatibilités de schéma ;
- aucun contenu financier sensible dans la télémétrie non sécurisée.

## 12. Proposition de MVP

Le MVP doit prouver que Clariprint Data peut produire un référentiel fiable et consommable pour un parc réel, sans chercher à couvrir immédiatement toutes les familles de machines.

### Inclus dans le MVP

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
- brouillon, contrôles bloquants, validation simple et publication immuable ;
- création d'un bac à sable depuis la publication active, modification isolée et comparaison ;
- comparaison entre brouillon et dernière publication ;
- export JSON complet et versionné vers un fichier ou endpoint défini avec l'équipe solveur ;
- historique des publications et statut des exports ;
- import tabulaire limité aux équipements et paramètres retenus pour le pilote ;
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
- connecteurs ERP, MIS ou systèmes comptables.

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
- capacité d'un support à retrouver en moins de cinq minutes la publication ayant alimenté un calcul donné.

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
10. démontrer qu'un utilisateur technique non financier ne peut ni lire ni modifier les coûts protégés.
11. créer un fournisseur cumulant impression et vente de papier sans dupliquer son identité ;
12. créer un contrat autorisant une machine d'un sous-traitant et refusant ses offres papier et transport, sans importer ses autres ressources ;
13. modifier une donnée dans un bac à sable et démontrer que le JSON de production reste inchangé ;
14. produire un JSON complet comportant les métadonnées de publication et accepté par le serveur de calcul de test.

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

## 16. Décisions à prendre avec les experts métier

### Priorité haute — nécessaires avant conception détaillée

1. Quel est le format actuel d'entrée du solveur et qui en maintient le contrat ?
2. Le solveur consomme-t-il un instantané complet, un différentiel ou les deux ?
3. Quelles familles de machines, matières, grilles de transport et quel flux de production serviront de périmètre pilote ?
4. Quelles caractéristiques sont obligatoires pour chacune de ces familles ?
5. Quels paramètres économiques sont réellement consommés : coûts horaires, main-d'œuvre, énergie, matière, gâche, minimums, sous-traitance, marge ou autres ?
6. La marge commerciale appartient-elle à Clariprint Data, au solveur ou à une autre application ?
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

## 17. Hypothèses de cadrage à confirmer

- Clariprint Data est une application web multi-fournisseurs et multi-organisation.
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

## 18. Dépendances

- disponibilité d'un expert du modèle métier Clariprint ;
- documentation ou exemples réels du format d'entrée solveur ;
- jeu de données représentatif et anonymisable d'un parc existant ;
- résultats attendus ou tests de référence permettant de vérifier l'intégration ;
- règles de confidentialité applicables aux données industrielles et financières ;
- décision sur l'identité, le multi-tenant et le modèle de droits commun avec le reste de la plateforme.

## 19. Prochain livrable recommandé

Après validation de ce cadrage, produire un **dossier de découverte métier** composé de :

1. un glossaire Clariprint validé ;
2. un exemple complet de parc actuel, de sa source jusqu'à l'entrée solveur ;
3. une matrice `capacité fournisseur × ressources × paramètres requis` ;
4. une matrice des rôles et droits ;
5. le contrat d'échange versionné avec le solveur ;
6. un exemple de contrat de sous-traitance avec machines et offres autorisées ;
7. une cartographie des règles de validation ;
8. le découpage du MVP en parcours et critères d'acceptation testables.

Ces éléments permettront ensuite de produire l'architecture métier et technique sans figer prématurément un modèle de données incomplet.
