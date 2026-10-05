

| emplacement logo AGE Développement — 50 mm |  |
| :---: | :---- |

MAGRIT IA

AGE DÉVELOPPEMENT

---

Entrées de backlog — Stories & Epics

RP\#070826 — Expert Solutions × AGE Développement

*Session du 7 août 2026 · Document dérivé du CR\_RP070826*

|  | CONFIDENTIEL — USAGE INTERNE *Diffusion restreinte · AGE Développement · Expert Solutions / Clariprint* |
| :---- | :---- |

# 1\. Mode d'emploi

---

Entrées de backlog issues de la session de production RP\#070826, à porter au Sprint Board après validation du périmètre et estimation d'effort. Les identifiants suivent la convention BK-RP070826-NN.

Différence de nature avec le lot WM\#040826. Le lot précédent portait des intentions produit issues d'une session de cadrage. Celui-ci porte des décisions d'architecture et de modèle de données déjà arbitrées en séance, dont une partie est immédiatement en développement. Les entrées 01 à 06 ne sont pas négociables sur le fond : ce sont des invariants, pas des options.

Huit epics sont mobilisés : Architecture & socle, Méthode & documentation, Parc machine, Modèle de coûts, Gestion commerciale, Fournisseurs & données, Design & UI, Qualité & tests.

Chaîne de dépendances principale : 01 (noyau) → 02 (API-first) → 03 (modularité) → 04 (MCP), et 07 (modèle Fournisseur) → 09/10 (qualification et sous-traitance) → 14/16/17 (wizard) → 22/24 (modèle de coûts).

Recouvrement avec le lot WM\#040826. Certaines entrées prolongent ou précisent des entrées existantes — signalé dans les notes de chaque story. Les entrées WM\#040826-01 (modèle de données), \-03 (wizard), \-05 (chemin critique), \-06 (prix marché) et \-07 (API-first \+ MCP) sont précisées par ce lot et ne doivent pas être doublonnées au Sprint Board.

# ---

2\. Vue d'ensemble

---

| ID | Titre | Epic | Prio |
| :---- | :---- | :---- | :---- |
| BK-RP070826-01 | Petit noyau applicatif — services essentiels, compatible noyau Magrit existant | Architecture & socle | P0 |
| BK-RP070826-02 | Couche API-first — contrat d'API documenté entre front React/TS et serveur | Architecture & socle | P0 |
| BK-RP070826-03 | Découpage modulaire de l'application et convention de module | Architecture & socle | P0 |
| BK-RP070826-04 | Vocabulaire MCP exposé par module et serveur MCP associé | Architecture & socle | P1 |
| BK-RP070826-05 | Jeu d'instructions d'architecture injecté dans les agents de développement | Méthode & doc | P0 |
| BK-RP070826-06 | Convention Git — une branche par fonctionnalité, tags de version, nettoyage du dépôt | Méthode & doc | P1 |
| BK-RP070826-07 | Modèle Fournisseur unifié avec capacités papier / impression / transport | Parc machine | P0 |
| BK-RP070826-08 | L'imprimeur comme fournisseur de papier — stock local et prix à la feuille | Parc machine | P1 |
| BK-RP070826-09 | Qualification interne / externe par machine, non bloquante et éditable a posteriori | Parc machine | P0 |
| BK-RP070826-10 | Rattachement d'une machine externe à un sous-traitant par autocomplétion | Parc machine | P0 |
| BK-RP070826-11 | Import du parc d'un sous-traitant déjà présent dans le référentiel | Parc machine | P2 |
| BK-RP070826-12 | Lignes de production — assemblage de ressources internes et sous-traitées | Parc machine | P1 |
| BK-RP070826-13 | Coûts de transport et coûts fixes associés aux machines externes | Parc machine | P1 |
| BK-RP070826-14 | Wizard parc machine — déroulé guidé par type de machine | Parc machine | P0 |
| BK-RP070826-15 | Maquettes comparatives du wizard — deux parcours, arbitrage au nombre de clics | Parc machine | P0 |
| BK-RP070826-16 | Sélection des machines par tags et filtres dynamiques, logique panier | Parc machine | P0 |
| BK-RP070826-17 | Validations bloquantes du wizard — massicot obligatoire, confirmation plieuse | Parc machine | P0 |
| BK-RP070826-18 | Écrans dédiés fournisseurs papier et fournisseurs transport dans le wizard | Parc machine | P1 |
| BK-RP070826-19 | Champs encres dans le parcours de configuration | Parc machine | P1 |
| BK-RP070826-20 | Écran récapitulatif de fin de wizard et retour sur l'espace imprimeur | Parc machine | P1 |
| BK-RP070826-21 | Tris, filtres et tags sur la liste du parc machine existante | Parc machine | P1 |
| BK-RP070826-22 | Modèle de coût — saisie des taux horaires et valeurs par défaut | Modèle de coûts | P0 |
| BK-RP070826-23 | Produits standard pré-calculés à l'arrivée sur l'espace imprimeur | Modèle de coûts | P1 |
| BK-RP070826-24 | Séparation stricte coûts de production (Clariprint Data) / prix de vente (GesCom) | Modèle de coûts | P0 |
| BK-RP070826-25 | Catalogue de prix — snapshot daté des tarifs de production | Modèle de coûts | P0 |
| BK-RP070826-26 | Traçabilité et preuve de prix par catalogue historisé | Modèle de coûts | P1 |
| BK-RP070826-27 | Environnement de draft — machine non publiée exclue des calculs de production | Modèle de coûts | P1 |
| BK-RP070826-28 | Module GesCom — profils client, marges et remises (cadrage) | Gestion commerciale | P0 |
| BK-RP070826-29 | Import de grilles tarifaires transporteurs par CSV | Fournisseurs & données | P1 |
| BK-RP070826-30 | Connecteur papetier — API Antalis et imports CSV pour les autres | Fournisseurs & données | P2 |
| BK-RP070826-31 | Charte graphique applicative et template Tailwind commun | Design & UI | P0 |
| BK-RP070826-32 | Composants d'affichage réutilisables — templates d'écran systématiques | Design & UI | P1 |
| BK-RP070826-33 | Tests d'ergonomie du wizard avec utilisateurs finaux | Qualité & tests | P1 |

# ---

3\. Epic — Architecture & socle

---

Enjeu. Le dépôt Magrit présente trois défauts structurels qui, non corrigés, rendent l'application non maintenable et — point spécifique aux chaînes pilotées par agents — non modifiable au-delà d'un certain volume de code. Cet epic est bloquant pour tout le reste.

## BK-RP070826-01 · Petit noyau applicatif

En tant qu'architecte, je veux un noyau applicatif léger portant les services essentiels, afin de développer les modules métier sur une base propre sans réécrire l'application existante.

* Critères d'acceptation : le noyau porte l'authentification en tant que service, la configuration et l'accès aux données · L'écran d'authentification reste un module, pas un composant du noyau · Aucune logique métier dans le noyau · Le noyau reste compatible avec le noyau Magrit existant · Le premier module développé dessus est Clariprint Data.  
* Dépendances : aucune — entrée amont de l'epic.  
* Notes : décision explicite de ne pas réécrire l'application. La compatibilité avec le socle Expert Solutions (HC Platform / Magrit Core) est un objectif de conception : le noyau doit permettre de basculer d'un socle à l'autre sans difficulté majeure si la plateforme atteint un niveau satisfaisant.  
* Portage : Xavier Péchoultres, S32–S33.

## BK-RP070826-02 · Couche API-first

En tant qu'architecte, je veux que toute communication entre le front et les données passe par un contrat d'API documenté, afin de stabiliser l'application, la rendre pluggable et préparer l'exposition MCP.

* Critères d'acceptation : aucune requête construite côté navigateur ni appel direct au stockage depuis le front React / TypeScript · Un contrat d'API par domaine fonctionnel, documenté (OpenAPI ou équivalent), typé en entrée et en sortie · Documentation générée et publiée · Les points d'entrée serveur existants non contractualisés sont recensés et planifiés en migration.  
* Dépendances : BK-01.  
* Notes : précise et remplace la partie API de BK-WM040826-07, en l'élargissant de l'unique domaine parcs machines à l'ensemble de l'application. Bénéfices attendus au-delà de la propreté : capacité à brancher d'autres interfaces, à ajouter des services en aval, à documenter nativement.

## BK-RP070826-03 · Découpage modulaire

En tant qu'architecte, je veux que chaque fonctionnalité vive dans un module autonome, afin d'éviter le code spaghetti et la saturation de la fenêtre de contexte des agents de développement.

* Critères d'acceptation : un module \= un périmètre fonctionnel avec ses routes, son modèle et ses tests · Aucune dépendance directe d'un module à l'implémentation interne d'un autre — le passage se fait par l'API ou par le noyau · Convention de module documentée et applicable par un agent sans interprétation · Le module Clariprint Data sert de référence d'implémentation.  
* Dépendances : BK-01, BK-02.  
* Notes — argument dimensionnant : au-delà de la maintenabilité, la modularité conditionne la capacité d'un agent à intervenir sur le code. Constat rapporté en séance sur des projets anciens : sessions interrompues en plein milieu, fenêtre de contexte pleine, reprise impossible. Le coût de la non-modularité est exponentiel, pas linéaire.

## BK-RP070826-04 · Vocabulaire MCP par module

En tant qu'utilisateur de l'interface conversationnelle, je veux pouvoir interroger et piloter n'importe quel domaine de l'application depuis un agent, afin de rendre effective la promesse conversationnelle de Magrit.

* Critères d'acceptation : chaque module expose son vocabulaire MCP, dérivé de son contrat d'API · Serveur MCP agrégeant les vocabulaires des modules · Nommage orienté ressource et action, aligné sur l'API · Un agent externe peut découvrir les capacités disponibles sans configuration manuelle.  
* Dépendances : BK-02 et BK-03 — bloquantes.  
* Statut de décision : différé assumé. *« Faut d'abord faire un truc API-first et modulaire, et le MCP on le rajoutera après. »* Ne pas anticiper l'implémentation ; en revanche, concevoir les API en gardant cette cible.

# ---

4\. Epic — Méthode & documentation

## ---

BK-RP070826-05 · Jeu d'instructions d'architecture pour les agents

En tant que pilote de la production, je veux que les règles d'architecture soient chargées automatiquement par tous les agents de développement, afin que tout code produit soit nativement conforme sans rappel manuel.

* Critères d'acceptation : jeu d'instructions rédigé et validé par les deux parties · Injecté dans les fichiers de règles projet côté AGE Dvt. (répertoire d'agents Claude, contexte projet) · Injecté dans un équivalent côté Expert Solutions (dossier Codex à créer) · Implanté dans le fichier de contexte Magrit sous Obsidian, chargé à chaque nouvelle session · Contient une clause de souplesse sur l'existant, avec obligation de tracer les dérogations · Contient un format de rapport de fin de tâche.  
* Livrable : rédigé — voir Annexe A du CR\_RP070826. En attente de validation par Xavier Péchoultres.  
* Notes : la règle est stricte sur le neuf, graduelle sur l'existant. *« Il faut être un petit peu souple sur la règle quand on va toucher aux développements qui ont déjà été faits. »* Aucune dérogation admise sur du code nouveau.  
* Portée hors Magrit : actif méthodologique transposable aux autres projets AGE Dvt. (site web, ABA, missions Agence IA).

## BK-RP070826-06 · Convention Git et nettoyage du dépôt

En tant qu'équipe, je veux une convention Git explicite et un dépôt assaini, afin d'éviter les collisions entre contributeurs et la confusion entre versions et lignes de travail.

* Critères d'acceptation : une branche par fonctionnalité ou évolution, jamais de développement direct sur le tronc commun · Les versions se matérialisent par des tags, pas par des branches · Nommage de branche explicite sur le périmètre fonctionnel · Changement de branche avec environnement local propre (aucune modification non commitée) · État des lieux des branches existantes, identification des branches remergées et des branches orphelines · Branche migration OWK renommée en intitulé explicite.  
* Notes : dette identifiée en séance — les versions successives (« bêta V5 », « design V2 ») ont été gérées comme des branches ad hoc. Plusieurs branches historiques non identifiées subsistent.  
* Recommandation d'outillage : client Git desktop plutôt que ligne de commande. *« Les mecs que je connais qui utilisent les fonctions Git évoluées, souvent ça finit avec des conneries. »*

# ---

5\. Epic — Parc machine

---

Enjeu. Le module Clariprint Data est le premier module métier développé sur la nouvelle architecture, et le back-office des données qui alimentent le solveur Clariprint. Le fil rouge fonctionnel est le même qu'au WM\#040826 : ramener le temps de constitution d'un parc exploitable à quelques minutes, et garantir qu'un prix sorte toujours.

## BK-RP070826-07 · Modèle Fournisseur unifié

En tant qu'architecte, je veux une entité Fournisseur unique qualifiée par ses capacités, afin de supprimer la distinction rigide entre fournisseur papier, imprimeur et transporteur.

* Critères d'acceptation : une entité Fournisseur avec capacités déclaratives (vend du papier / vend de l'impression / vend du transport), cumulables · La sous-traitance devient un cas particulier du modèle fournisseur, non un concept distinct · Environnement global multi-imprimeurs · Chaque imprimeur porte sa devise et son système d'unités de saisie.  
* Dépendances : aucune — entrée amont de l'epic.  
* Notes : précise BK-WM040826-01. La séparation partie technique / partie tarifaire posée au WM\#040826 reste valable et s'applique à l'intérieur de ce modèle. La gestion de la devise n'est pas anecdotique : elle conditionne toute internationalisation ultérieure.

## BK-RP070826-08 · L'imprimeur comme fournisseur de papier

En tant qu'imprimeur, je veux déclarer mon propre stock papier comme une source d'approvisionnement, afin de refléter mes conditions d'achat réelles et de pratiquer un prix à la feuille.

* Critères d'acceptation : l'imprimeur peut se déclarer lui-même fournisseur de papier avec ses propres références et conditions · Support du prix à la feuille, distinct des unités papetier (rame, palette, tonne) · Nombre de références volontairement limité, sans obligation d'exhaustivité · Coexistence avec les fournisseurs papetiers externes sur le même parc.  
* Dépendances : BK-07.  
* Notes : cas terrain systématique — achat en quantité de papiers courants (couché moderne 115 g cité en exemple), permettant réactivité et conditions spécifiques. Le prix à la feuille est particulièrement structurant en impression numérique.

## BK-RP070826-09 · Qualification interne / externe non bloquante

En tant qu'imprimeur, je veux pouvoir constituer mon parc sans avoir à qualifier immédiatement chaque machine comme interne ou sous-traitée, afin d'obtenir un prix le plus vite possible.

* Critères d'acceptation : le champ interne / externe est disponible mais non obligatoire dans le wizard · Aucun blocage du parcours si le champ n'est pas renseigné · Le champ reste éditable a posteriori depuis la fiche machine · Le passage d'une machine en externe déclenche la saisie des coûts associés (BK-13).  
* Dépendances : BK-07.  
* Statut de décision : arbitré en séance. *« La meilleure solution dans un premier temps, c'est qu'on ait un setup complet du parc, le plus rapide et le plus simple possible, avec toutes les machines dont il dispose. Après, une fois qu'il aura ça, il peut déjà sortir un prix. »*  
* Notes : prolonge la logique de BK-WM040826-06 (prix de marché par défaut) — tout ce qui n'est pas indispensable à la sortie d'un premier prix est repoussé en affinage.

## BK-RP070826-10 · Rattachement d'une machine externe à un sous-traitant

En tant qu'imprimeur, je veux rattacher une machine externe au nom de mon sous-traitant sans avoir à décrire son parc, afin de ne saisir que ce qui concerne ma propre production.

* Critères d'acceptation : le marquage d'une machine en externe ouvre un champ de saisie du sous-traitant · Autocomplétion sur le référentiel des fournisseurs / imprimeurs existants · Si le sous-traitant existe, ses informations sont proposées à la reprise · S'il n'existe pas, le parcours continue sans blocage et le nom est enregistré en clair · La machine externe alimente le parc total de l'imprimeur.  
* Dépendances : BK-07, BK-09.  
* Statut de décision : arbitré en séance, en simplification du modèle historique Clariprint. *« Je ne m'occupe pas de définir mes sous-traitants, je m'occupe de mon parc. »* Expert Solutions a accepté le principe : *« On a ce modèle-là, mais il faut qu'on merge un peu les deux. »*

## BK-RP070826-11 · Import du parc d'un sous-traitant référencé

En tant qu'imprimeur, je veux être averti quand mon sous-traitant devient lui-même utilisateur du système, afin de bénéficier de ses données de parc et de ses tarifs réels.

* Critères d'acceptation : détection du rapprochement entre un sous-traitant saisi en clair et un imprimeur du référentiel · Proposition explicite d'import des machines du sous-traitant · Import optionnel, non automatique · Notification à l'imprimeur quand l'extension devient possible.  
* Dépendances : BK-10.  
* Notes : fonction de confort à valeur réseau — plus le référentiel se peuple, plus la valeur augmente. Ne doit jamais être un prérequis de saisie.

## BK-RP070826-12 · Lignes de production

En tant que moteur de calcul, je veux assembler dynamiquement des ressources de production internes et sous-traitées, afin d'optimiser le cheminement physique du produit et le coût total.

* Critères d'acceptation : une ligne de production assemble des ressources appartenant à des parcs distincts · Le moteur privilégie l'enchaînement des étapes au sein d'un même parc quand c'est possible · Les coûts de transport inter-prestataires sont pris en compte · Restitution des lignes les plus compétitives pour un job donné.  
* Dépendances : BK-07, BK-10.  
* Notes — justification technique : exemple donné en séance, une brochure suppose pliage → brochage → massicotage. Si tout est fusionné dans un parc unique, le moteur peut envoyer le job chercher le massicot de l'imprimerie principale alors que le produit est physiquement chez le façonnier. Le modèle en parcs séparés préserve cette information de localisation.  
* Point ouvert : articulation entre le modèle simplifié de saisie (BK-10) et le modèle en parcs séparés qui porte l'optimisation. Les deux doivent coexister — la saisie est simplifiée, la modélisation interne ne l'est pas.

## BK-RP070826-13 · Coûts de transport et coûts fixes sur machines externes

En tant qu'imprimeur, je veux associer des coûts de transport et des coûts fixes à mes machines externes, afin que le prix calculé reflète le coût réel de l'externalisation.

* Critères d'acceptation : coûts de transport saisissables par machine externe · Valeur zéro admise · Coûts fixes d'externalisation distincts des coûts de transport · Prise en compte par le moteur de calcul.  
* Dépendances : BK-09, BK-10.  
* Notes : le modèle existe déjà dans Clariprint sous forme de prix de transfert. Xavier Péchoultres relève qu'en pratique il y a toujours des coûts de messagerie, même quand l'utilisateur saisit zéro.

## BK-RP070826-14 · Wizard parc machine — déroulé guidé

En tant que nouvel imprimeur, je veux être guidé écran par écran dans la déclaration de mon parc, afin de n'oublier aucun équipement nécessaire au calcul.

* Critères d'acceptation : parcours séquentiel par type de machine — presses offset, presses numériques, grand format, roto, découpe, pliage, massicotage, machines de finition · Question binaire par type, puis liste filtrée si réponse positive · Pas de navigation libre par onglets · Reprise possible d'un parcours interrompu · Enchaînement automatique vers le type suivant.  
* Dépendances : BK-07, BK-16, BK-17.  
* Statut de décision : le principe du wizard contraint est acquis, l'ordre de saisie ne l'est pas — voir BK-15.  
* Notes : précise BK-WM040826-03. La justification du caractère contraint est explicite : *« Je les pratique depuis 2000 ans. Si tu n'es pas dans un wizard, le mec va oublier de mettre son massicot, et tu n'auras jamais rien qui sortira. »*

## BK-RP070826-15 · Maquettes comparatives du wizard

En tant qu'équipe produit, je veux comparer deux parcours de wizard sur maquette, afin de trancher l'ordre de saisie sur des critères objectifs plutôt que sur des convictions.

* Critères d'acceptation : maquette A — déroulé rigide type par type, question binaire puis liste (position Expert Solutions) · Maquette B — qualification préalable des types de production pratiqués, puis passage en revue des seuls types déclarés, navigation par onglets dynamiques (position AGE Dvt.) · Critère d'arbitrage : nombre de clics jusqu'au premier prix, et taux d'oubli d'équipement · Date de décision fixée avant réalisation.  
* Dépendances : aucune — peut démarrer immédiatement.  
* Statut : désaccord ouvert, arbitrage par maquette acté en séance. Position d'attente : AGE Dvt. s'aligne sur le déroulé guidé tant que l'arbitrage n'est pas rendu. Le refus des onglets par Expert Solutions est explicite : l'utilisateur ne doit pas pouvoir sortir du parcours.

## BK-RP070826-16 · Sélection par tags et filtres dynamiques

En tant qu'imprimeur, je veux filtrer les machines par tags cliquables plutôt que naviguer dans une arborescence, afin de trouver mes équipements en quelques clics.

* Critères d'acceptation : pas d'arborescence · Filtres à facettes sur marque, format, nombre de groupes / couleurs, présence d'un groupe vernis · Les tags sont dérivés des caractéristiques des machines, pas saisis manuellement · Cumul de filtres · Logique panier : ajout d'une machine à la sélection, suppression possible avant validation · Le clic sur une machine déjà au panier ne fait que la retirer.  
* Dépendances : BK-07, et bibliothèque de machines (BK-WM040826-02).  
* Notes : *« Il ne faut pas qu'il ait à cliquer 50 fois. Soit il a la machine et il la trouve d'un coup de molette, soit il clique sur Heidelberg et il n'a que les Heidelberg. »* Modèle de référence explicite : les facettes de boutique en ligne.  
* Profondeur de bibliothèque : doit couvrir l'historique constructeur — une machine de neuf ans n'est plus au catalogue mais reste en production. Volume jugé maîtrisable, les constructeurs ne renouvelant pas leurs gammes en continu. Chiffrage de l'effort de sourcing toujours non instruit (report du WM\#040826).

## BK-RP070826-17 · Validations bloquantes du wizard

En tant que système, je veux empêcher la sortie du wizard sans les équipements indispensables au calcul, afin d'éviter qu'un utilisateur termine son paramétrage sans obtenir de prix.

* Critères d'acceptation : massicot obligatoire — blocage explicite avec message compréhensible · Question de confirmation sur l'absence de plieuse — l'absence est possible mais doit être confirmée · Le chemin critique est paramétrable, non codé en dur · Les messages expliquent la conséquence du manque, pas seulement le manque.  
* Dépendances : BK-14.  
* Notes : précise BK-WM040826-05. Cas légitime d'absence de plieuse identifié en séance : imprimeur numérique dont le groupe de pliage est intégré en ligne au cul de la presse.

## BK-RP070826-18 · Écrans dédiés papier et transport

En tant qu'utilisateur du wizard, je veux choisir mes fournisseurs papier et mes fournisseurs transport sur deux écrans distincts, afin de ne pas mélanger deux natures de décision.

* Critères d'acceptation : un écran fournisseurs papier · Un écran fournisseurs transport · Ordre : papier avant transport · Sélection multiple sur chaque écran.  
* Dépendances : BK-07, BK-14.  
* Notes : correction d'un défaut de la maquette existante, où les deux étaient sur le même écran — jugé non conforme à la logique wizard.

## BK-RP070826-19 · Champs encres

En tant que moteur de calcul, je veux disposer des informations d'encrage déclarées dans le parcours, afin de calculer correctement les coûts consommables.

* Critères d'acceptation : champs encres intégrés au parcours de configuration machine · Valeurs par défaut proposées · Identifiés comme manquants dans la spécification actuelle.  
* Dépendances : BK-14.  
* Notes : qualifié de détail technique en séance, mais bloquant pour la justesse du calcul.

## BK-RP070826-20 · Récapitulatif de fin de wizard

En tant qu'imprimeur, je veux voir un récapitulatif de ce que j'ai déclaré avant validation, puis arriver directement sur mon espace de travail, afin de vérifier ma saisie et enchaîner sur l'usage.

* Critères d'acceptation : écran récapitulatif listant machines, fournisseurs papier et transport retenus · Retour arrière possible sur chaque section · Validation créant l'environnement imprimeur · Atterrissage direct sur l'espace de travail avec les machines créées.  
* Dépendances : BK-14.  
* Notes : cohérent avec l'exigence posée au WM\#040826 — la sortie du wizard doit mettre en exergue ce qui reste à paramétrer, le reste étant déjà renseigné.

## BK-RP070826-21 · Tris, filtres et tags sur la liste du parc existant

En tant qu'imprimeur, je veux retrouver rapidement une machine dans mon parc constitué, afin de l'éditer sans faire défiler une liste.

* Critères d'acceptation : filtres de tri sur la liste du parc · Machines taguées, tags cliquables pour refiltrer · Cohérence des tags avec ceux du wizard (BK-16) · Accès direct au détail machine et à l'édition des données techniques.  
* Dépendances : BK-16.  
* Notes : amélioration de l'écran existant, identifiée comme prioritaire en séance sur démonstration de l'interface actuelle.

# ---

6\. Epic — Modèle de coûts

---

Enjeu. C'est le bloc qui porte la décision la plus structurante de la séance : la frontière entre coûts de production et prix de vente. Il conditionne à la fois la spécification du module, la promesse analytique de Magrit et le discours commercial.

## BK-RP070826-22 · Modèle de coût et taux horaires

En tant qu'imprimeur, je veux saisir mes taux horaires et disposer de valeurs par défaut sur le reste, afin d'obtenir un coût de production réaliste sans tout renseigner.

* Critères d'acceptation : proposition d'un modèle de coût dans le parcours, avant ou en sortie de wizard · Saisie du taux horaire de main-d'œuvre avec valeur par défaut proposée · Valeurs par défaut non saisies sur les postes secondaires (coût du kWh cité en exemple) · Distinction visible entre les valeurs saisies par l'utilisateur et les valeurs par défaut.  
* Dépendances : BK-14.  
* Notes : cohérent avec l'ambition posée au WM\#040826 de réduire la saisie résiduelle à une ou deux variables — taux horaire global et coûts fixes de l'entreprise.

## BK-RP070826-23 · Produits standard pré-calculés

En tant que nouvel imprimeur, je veux voir des prix dès mon arrivée sur mon espace, afin de constater immédiatement que le système fonctionne avec mon parc.

* Critères d'acceptation : une liste de produits standard est proposée et déjà calculée avec le parc déclaré · L'utilisateur peut créer ses propres produits de test · Recalcul en direct à chaque modification de paramètre · Comparaison visible entre prix issus des valeurs de marché et prix issus des paramètres propres.  
* Dépendances : BK-22, et prix de marché par défaut (BK-WM040826-06).  
* Notes : matérialisation concrète de la décision « prix de marché servi par défaut ». Rappel de la nuance Expert Solutions : l'objectif final reste que l'utilisateur obtienne vite un prix avec ses propres données ; le prix de marché est un amorçage, et par ailleurs un outil de positionnement — deux fonctions à ne pas confondre dans l'interface.

## BK-RP070826-24 · Séparation coûts de production / prix de vente

En tant que dirigeant d'imprimerie, je veux que mon outil distingue strictement mes coûts de production de mes prix de vente, afin de savoir si je gagne de l'argent.

* Critères d'acceptation : Clariprint Data ne porte que des coûts de production · Aucune saisie de marge commerciale, de remise ou de prix de vente dans le module parc machine · Les marges, remises et prix de vente sont portés par le module GesCom (BK-28) · La documentation utilisateur et le discours commercial explicitent cette logique.  
* Dépendances : BK-22, BK-28.  
* Statut de décision : arbitré par AGE Dvt., contesté sur la faisabilité terrain. Expert Solutions rapporte que les deux pratiques coexistent chez les clients — coûts internes puis marges en GesCom, ou coûts déjà margés puis remises en GesCom — et qu'elles ne sont pas imposables : *« Arnaud, tu peux dire ce que tu veux, en face de toi tu as des clients qui fonctionnent d'une manière et d'autres d'une autre. Tu vas te casser les dents. »*  
* Justification de l'arbitrage : *« Si le mec met des prix margés ici et zéro dans la GesCom, ça relève d'un flou en termes d'analytique et de capacité à savoir si tu gagnes de l'argent qui est drastique. »*  
* Risque à porter : pari d'adoption. À outiller côté conduite du changement — migration des clients existants, discours de mise en service, valeurs par défaut.

## BK-RP070826-25 · Catalogue de prix — snapshot daté

En tant qu'administrateur, je veux figer mes tarifs de production dans un catalogue daté, afin de pouvoir modifier mes paramètres sans impacter les prix servis en production.

* Critères d'acceptation : création d'un catalogue \= snapshot de l'ensemble des prix de production à un instant T · Date de validité portée par le catalogue · Ce sont les données figées qui servent aux calculs en production · Les modifications en cours n'affectent pas le catalogue publié · Publication explicite \= validation des modifications.  
* Dépendances : BK-22, BK-24.  
* Contrainte externe : fonctionnalité inscrite au cahier des charges d'Altavia — non négociable sur le calendrier de ce compte.  
* Notes : la fonction existe dans Clariprint et est décrite comme indispensable et éprouvée. À reprendre, pas à réinventer.

## BK-RP070826-26 · Traçabilité et preuve de prix

En tant que responsable commercial, je veux retrouver le catalogue en vigueur à une date donnée, afin d'expliquer pourquoi un dossier est sorti à tel prix.

* Critères d'acceptation : historisation des catalogues publiés · Consultation d'un catalogue antérieur · Rattachement d'un dossier chiffré au catalogue utilisé · Restitution lisible de la décomposition du prix à cette date.  
* Dépendances : BK-25.  
* Notes : identifié en séance comme une fonction distincte du snapshot, et à valeur propre — logique de preuve de prix et de traçabilité, au-delà de l'isolation production / simulation.

## BK-RP070826-27 · Environnement de draft

En tant qu'imprimeur, je veux paramétrer une machine non encore livrée ou non calibrée sans qu'elle entre dans mes calculs, afin de ne pas servir de prix erronés en boutique.

* Critères d'acceptation : une machine non publiée est exclue des calculs servis en production · Elle reste testable en simulation · Publication explicite pour mise en production.  
* Dépendances : BK-25.  
* Point ouvert — deux options concurrentes : (a) un espace de travail draft global, (b) un statut draft porté par la machine. Le flag actif / inactif existant répond partiellement au besoin, mais couvre une autre intention fonctionnelle. À trancher au moment de la spécification du catalogue.  
* Notes : cas d'usage donné en séance — « je vais peut-être acheter une nouvelle machine, je veux voir ce que ça donne, mais elle n'est pas encore arrivée et je ne l'ai pas calibrée ».

# ---

7\. Epic — Gestion commerciale

## ---

BK-RP070826-28 · Module GesCom — cadrage

En tant que responsable commercial, je veux un module dédié à la gestion des prix de vente, afin de paramétrer mes marges et remises par client sans toucher à mes coûts de production.

* Critères d'acceptation attendus (cadrage à produire) : notion de profil client — reprise du concept existant dans Clariprint · Marges et / ou remises paramétrables par client et par groupe de produits · Application des règles au-dessus des coûts de production issus de Clariprint Data · Restitution de la marge réelle par dossier.  
* Dépendances : BK-24 — dépendance croisée, les deux stories se conditionnent mutuellement.  
* Statut : entrée de cadrage, pas de développement. Le module est invoqué comme réceptacle de trois décisions de la séance mais n'existe ni en spécification ni en roadmap. C'est le principal angle mort du lot.  
* Alerte de pilotage : vider Clariprint Data de la dimension commerciale sans que le réceptacle existe crée un trou fonctionnel visible en démonstration. À arbitrer : GesCom dans le périmètre bêta, ou phase suivante avec palliatif assumé.  
* Élément de contexte commercial : débat marge / remise tranché côté discours AGE Dvt. en faveur de la stratégie du « bon prix » plutôt que de la remise systématique. Métrique citée de mémoire et à vérifier avant tout usage externe : chez Exaprint, environ 23 % de marge en vente par les commerciaux contre 42 % en vente en ligne.

# ---

8\. Epic — Fournisseurs & données

## ---

BK-RP070826-29 · Import de grilles tarifaires transporteurs

En tant qu'imprimeur, je veux importer les grilles tarifaires négociées avec mes transporteurs, afin de calculer un coût de livraison juste.

* Critères d'acceptation : import CSV de grilles tarifaires · Support de grilles négociées propres à chaque imprimeur · Gestion du référentiel des points de livraison · Saisie manuelle possible en complément.  
* Notes — état des interfaces : les API transporteurs ne tiennent généralement pas compte des conditions particulières négociées. Pas d'API de pricing chez Colissimo / Chronopost — l'API sert à créer le bon de transport, pas à interroger un prix. Constat e-commerce : *« on est toujours sur des grilles de tarif en dur »*. Altavia dispose de ses propres grilles négociées.  
* Décision : les grilles en dur / CSV sont la solution de référence, pas un palliatif.

## BK-RP070826-30 · Connecteur papetier

En tant qu'imprimeur, je veux récupérer automatiquement les tarifs de mes papetiers, afin de maintenir mes coûts matière à jour sans ressaisie.

* Critères d'acceptation : connecteur API pour les papetiers qui en exposent une (Antalis identifié) · Import CSV pour les autres · Fréquence de rafraîchissement paramétrable · Traçabilité de la date de dernière mise à jour tarifaire.  
* Notes : chantier en cours côté Expert Solutions sur l'API Antalis. Ouverture stratégique notée en séance : Magrit / Expert Solutions pourrait se positionner en intermédiaire d'agrégation sur ces interfaces — à qualifier comme brique d'offre, hors périmètre POC.

# ---

9\. Epic — Design & UI

## ---

BK-RP070826-31 · Charte graphique applicative et template Tailwind

En tant qu'utilisateur, je veux une expérience visuelle continue entre la home Magrit, le tableau de bord et les modules, afin de percevoir un produit unique et abouti.

* Critères d'acceptation : un template applicatif de référence retenu, compatible Tailwind · Charte graphique documentée (couleurs, typographie, composants) · Application au tableau de bord en priorité · Cohérence avec la home Magrit · Le template s'applique aux modules à venir, à commencer par Clariprint Data.  
* Statut : socle technique confirmé — Magrit est déjà bâti sur Tailwind, choix effectué par l'agent et validé a posteriori par Expert Solutions (successeur de facto de Bootstrap, standard actuel). Distinction posée en séance : Tailwind est la technologie qui permet de construire le design, pas le design.  
* Portage : Arnaud Mazon — recherche de templates, puis point avec Tony (référent design).  
* Urgence : à arbitrer avant que Clariprint Data ne produise ses premiers écrans, sous peine de reprise.

## BK-RP070826-32 · Composants d'affichage réutilisables

En tant que développeur, je veux des templates d'écran systématiques, afin de ne pas réécrire une mise en page d'un écran à l'autre.

* Critères d'acceptation : bibliothèque de composants d'affichage mutualisés · Templates d'écran types (liste, détail, formulaire, wizard) · Interdiction de style ad hoc au niveau module · Documentation d'usage intégrée au jeu d'instructions (BK-05).  
* Dépendances : BK-31, BK-03.  
* Notes : défaut constaté en séance — aucun template d'affichage systématique repéré dans le code actuel. L'absence de modularité se retrouve au niveau graphique.

# ---

10\. Epic — Qualité & tests

## ---

BK-RP070826-33 · Tests d'ergonomie du wizard avec utilisateurs finaux

En tant qu'équipe produit, je veux valider l'ergonomie du wizard auprès d'imprimeurs réels, afin de ne pas figer un parcours conçu par et pour des utilisateurs avancés.

* Critères d'acceptation : protocole de test défini (tâche, mesure, échantillon) · Test sur les deux maquettes de BK-15 · Mesure du nombre de clics jusqu'au premier prix et du taux d'oubli d'équipement · Population cible : opérateurs et commerciaux d'imprimerie, pas de profils techniques.  
* Dépendances : BK-15.  
* Notes : exigence portée par Expert Solutions. *« On a un tropisme de développeur ou d'utilisateur avancé, des cliqueurs fous. Parfois on se trompe sur le fonctionnement du cerveau du tiers. »* Le Groupe ICI constitue un terrain de test naturel.

# ---

11\. Points bloquants pour l'estimation

---

| Story | Point à lever | Qui |
| :---- | :---- | :---- |
| BK-04 | Différé assumé — ne pas estimer tant que BK-02 et BK-03 ne sont pas livrées | — |
| BK-05 | Jeu d'instructions rédigé, en attente de validation | Xavier Péchoultres |
| BK-12 | Articulation entre saisie simplifiée (BK-10) et modélisation en parcs séparés non spécifiée | Expert Solutions |
| BK-15 | Date de décision et critère unique d'arbitrage non fixés | AGE Dvt. \+ Expert Solutions |
| BK-16 | Volumétrie et sourcing de la bibliothèque de machines toujours non chiffrés (report WM\#040826) | Expert Solutions |
| BK-24 | Conduite du changement vers les clients existants non instruite | AGE Dvt. |
| BK-27 | Deux options concurrentes (espace draft / statut machine), articulation avec le flag actif-inactif | Expert Solutions |
| BK-28 | Module non spécifié, non planifié, non arbitré en périmètre bêta | AGE Dvt. — session S32 |
| BK-31 | Template graphique non retenu ; à arbitrer avant production des premiers écrans | AGE Dvt. \+ Tony |
| Tous | Inclusion ou exclusion du périmètre bêta non arbitrée ; fenêtre bêta toujours non revisitée | AGE Dvt. — session S32 |

---

---

*Document confidentiel. Usage interne AGE Développement & Expert Solutions.*