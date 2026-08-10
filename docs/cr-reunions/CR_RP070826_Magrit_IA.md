

| emplacement logo AGE Développement — 50 mm |  |
| :---: | :---- |

MAGRIT IA

AGE DÉVELOPPEMENT

---

Compte rendu de session de travail

RP\#070826 — Expert Solutions × AGE Développement

*Réunion de production du 7 août 2026*

|  | CONFIDENTIEL — USAGE INTERNE *Diffusion restreinte · AGE Développement · Expert Solutions / Clariprint* |
| :---- | :---- |

# Synthèse exécutive

---

Première session de production bilatérale Xavier Péchoultres / Arnaud Mazon depuis l'arbitrage de parallélisation acté au WM\#040826. Deux heures, deux blocs : architecture logicielle (diagnostic du dépôt Magrit, règles de développement, workflow Git) puis modèle fonctionnel du parc machine (fournisseurs, sous-traitance, wizard, modèle de coûts). C'est la séance la plus structurante depuis le lancement du POC sur le plan technique : elle fixe les invariants d'architecture sur lesquels tout le reste se construira.

Quatre conclusions à retenir :

* La voie socle AGE devient la voie de production effective. Xavier Péchoultres a analysé le dépôt Magrit d'AGE Dvt., produit un état des lieux et \~12 000 lignes de PRD/spécifications sur une branche dédiée — sans toucher au code applicatif. Le socle de Laurent Rebière (HC Platform / Magrit Core) est explicitement mis en attente : *« pour l'instant on va pas s'occuper du socle Laurent »*. La stratégie retenue n'est pas une réécriture mais un petit noyau applicatif portant les services essentiels, sur lequel le module Clariprint Data est développé en premier, avec migration progressive de l'existant.  
* Trois invariants d'architecture sont posés et deviennent opposables. API-first (interdiction pour l'UX de parler à la base), modularité (contre le code spaghetti *et* contre la saturation de la fenêtre de contexte des agents IA), puis exposition MCP par module. Séquencement acté : API-first \+ modulaire d'abord, MCP ensuite. Ces règles doivent être injectées dans les agents de développement des deux côtés et dans le contexte projet Obsidian — le jeu d'instructions figure en Annexe A de ce document.  
* Le modèle de données du parc machine est simplifié et arbitré. Notion unifiée de Fournisseur doté de capacités (papier / impression / transport) en remplacement des trois entités distinctes de Clariprint. La qualification interne / externe d'une machine devient non bloquante à la création du parc : priorité au setup le plus rapide possible, affinage a posteriori. La saisie d'un sous-traitant se fait par autocomplétion depuis le parc de l'imprimeur, sans obligation de décrire le parc du sous-traitant.  
* Frontière coûts / prix tranchée. Clariprint Data porte les coûts de production ; les marges commerciales, remises et prix de vente relèvent du module gestion commerciale (GesCom). Arbitrage assumé par AGE Dvt. contre le constat terrain d'Expert Solutions selon lequel les clients pratiquent les deux modèles — au nom de la cohérence analytique.

Un désaccord ergonomique sur le déroulé du wizard reste ouvert et sera tranché par maquette comparative. Xavier Péchoultres engage le développement de Clariprint Data dès l'après-midi ; Arnaud Mazon prend la charte graphique et les spécifications.

# ---

# 

# 

# 

# 

# 

# 1\. Cadre de la réunion

---

| Élément | Détail |
| :---- | :---- |
| Côté Expert Solutions | Xavier Péchoultres (Expert Solutions / Clariprint — architecture, moteur de calcul, parc machine) |
| Côté Magrit IA | Arnaud Mazon (PDG, AGE Développement — porteur du projet Magrit IA) |
| Date et durée | Vendredi 7 août 2026, 10 h 59 CEST — 2 h 00 |
| Format | Visioconférence Google Meet · Prise de notes et transcription Gemini AI · Partage d'écran (dépôt Magrit, maquettes Clariprint, environnement Clariprint historique) |
| Objet | Architecture du dépôt Magrit et workflow Git · Règles de développement opposables aux agents IA · Modèle de données parc machine et fournisseurs · Sous-traitance et lignes de production · Wizard de saisie du parc · Modèle de coûts, catalogues et snapshots · Transport et papetiers · Charte graphique applicative |
| Rédacteur | Arnaud Mazon — CR produit le 7 août 2026 |

*Note de méthode — la transcription automatique est de qualité inégale (termes techniques déformés : « guit » pour Git, « carré print » / « car prim data » pour Clariprint et Clariprint Data, « Delberg » pour Heidelberg, « Taiwind » pour Tailwind, « GScom » pour GesCom). Les verbatims cités ci-dessous ont été légèrement nettoyés pour la lisibilité, sans altération du sens. Toute correction est bienvenue avant diffusion élargie.*

# ---

# 2\. État des lieux du dépôt Magrit — ce que Xavier Péchoultres a produit

---

Point d'entrée de la séance : restituer, en langage accessible à un non-développeur, le travail conduit sur le dépôt Magrit d'AGE Dvt. depuis le WM\#040826.

## 2.1 Une branche, pas un fork

Xavier Péchoultres a créé une branche sur le dépôt Magrit d'AGE Dvt., et non une duplication. Le tronc commun (main) reste la référence ; la branche porte la somme des modifications et sera fusionnée après validation et test. La branche n'est pas mergée à ce stade.

Contenu réel de la branche, vérifié en séance : 10 commits, \~12 000 lignes de PRD, spécifications et plans — aucun code applicatif touché. Aucune régression fonctionnelle attendue ; la version exécutée en local par AGE Dvt. reste identique à la bêta V5.

## 2.2 Nommage à corriger

La branche s'appelle aujourd'hui migration OWK — nommage jugé inadapté par son auteur. Renommage acté en séance vers un intitulé explicite (clariprint-data), pour éviter la confusion avec les évolutions de Magrit Off.

## 2.3 Distinction branche / tag — point de vigilance méthodologique

Xavier Péchoultres relève un usage risqué côté AGE Dvt. : les versions successives (« bêta V5 », « design V2 ») ont été gérées comme des branches ad hoc, là où Git distingue :

* la branche — une ligne de travail parallèle destinée à être fusionnée ;  
* le tag — un point figé et nommé dans l'arbre, qui est la manière correcte de matérialiser une version.

Plusieurs branches historiques existent dans le dépôt, certaines remergées, d'autres non identifiées. Un nettoyage sera nécessaire.

# ---

# 3\. Diagnostic d'architecture — trois problèmes structurels

---

C'est le cœur technique de la séance. Le code généré à ce jour sur Magrit présente trois défauts que Xavier Péchoultres qualifie de bloquants pour la suite.

## 3.1 L'UX parle directement à la base de données

|  | Verbatim — Xavier Péchoultres (diagnostic) *« En gros, pour t'expliquer : l'UX cause quasi directement avec la base de données. C'est forbidden, interdiction absolue. »* |
| :---- | :---- |

Le front React / TypeScript envoie des requêtes « bâtonnées » que le serveur traite et renvoie brutalement. La correction est une couche d'abstraction API-first entre le navigateur et le serveur, matérialisée par un contrat d'API documenté.

Bénéfices identifiés : documentation native, capacité à brancher demain d'autres interfaces ou services, abstraction propre vis-à-vis de la base de données.

|  | Verbatim — Xavier Péchoultres (niveau d'exigence) *« Aujourd'hui, en 2025-2026, c'est interdit de faire différemment. »* |
| :---- | :---- |

## 3.2 L'application n'est pas modulaire — et le mur est double

En ajoutant des fonctionnalités, l'agent dispose du code partout où c'est nécessaire pour que ça fonctionne. Confortable au départ, ingérable ensuite. Deux murs distincts :

* Le mur classique du spaghetti — toute modification en casse une autre, sans traçabilité.  
* Le mur propre à l'IA — le volume de code à charger pour effectuer une modification croît de façon exponentielle jusqu'à saturer la fenêtre de contexte. Xavier Péchoultres rapporte des sessions interrompues en plein milieu sur des projets anciens, contexte plein, impossibles à reprendre.Ce second point est un argument d'architecture spécifique aux chaînes de développement pilotées par agents : la modularité n'est plus seulement une bonne pratique de maintenabilité, c'est une condition de faisabilité.

## 

## 3.3 Pas de vocabulaire MCP

Cible : chaque module expose son propre vocabulaire à un serveur MCP, ce qui rend l'application nativement adressable par un agent conversationnel. La proximité conceptuelle avec l'API-first est forte — GET /machines d'un côté, get.device de l'autre — ce qui rend l'ajout peu coûteux une fois l'API-first en place.

Séquencement acté : API-first et modularité d'abord, MCP ensuite. *« Faut d'abord faire un truc API-first et modulaire, et le MCP on le rajoutera après. »*

# ---

4\. Stratégie de refonte — le petit noyau

---

Pas de réécriture complète 

## 4.1 Le principe

* Écrire un petit noyau (kernel) portant les services de base — l'authentification en tant que service, l'écran d'authentification restant un module.  
* Ce petit noyau doit rester compatible avec le gros noyau existant de Magrit.  
* Développer le module Clariprint Data sur ce petit noyau, avec les nouveaux préceptes.  
* Migrer ensuite progressivement les services existants vers l'architecture modulaire, sans perturber le fonctionnement actuel.

## 4.2 Conséquence sur le socle Expert Solutions

Décision explicite en séance : le socle de Laurent Rebière est mis en attente. *« Ça c'est censé être dans le socle, mais là pour l'instant on va pas s'en occuper du socle Laurent. On va partir sur consolider la tienne et on va essayer de faire une application propre sur la tienne. »*

Le bénéfice conservé : si HC Platform / Magrit Core atteint un niveau satisfaisant, le petit noyau doit permettre de switcher de l'un à l'autre sans difficulté majeure. C'est la justification technique de la parallélisation actée au WM\#040826 — et, dans les faits, le basculement de la production sur la voie socle AGE.

*Point de pilotage : cette inflexion n'a pas été formalisée comme un arbitrage vis-à-vis de Laurent Rebière. Elle doit l'être en session hebdomadaire (voir § 9).*

# ---

5\. Règles de développement opposables aux agents

---

Sujet ouvert par Arnaud Mazon à partir d'une question opérationnelle : « quand je demanderai demain d'améliorer le PIM, est-ce que l'agent appliquera naturellement l'architecture modulaire et API-first ? » Réponse : non, sauf à l'inscrire dans les règles chargées à chaque session.

## 5.1 La décision

Production d'un jeu d'instructions d'architecture, injecté :

* dans les fichiers de règles projet côté AGE Dvt. (répertoire d'agents Claude, contexte projet) ;  
* dans un équivalent côté Expert Solutions (dossier Codex à créer) ;  
* dans le fichier de contexte Magrit sous Obsidian, chargé à chaque nouvelle session.

Le jeu d'instructions figure en Annexe A de ce document. Il est soumis à validation de Xavier Péchoultres avant injection.

## 5.2 La nuance apportée par Expert Solutions

|  | Verbatim — Xavier Péchoultres (souplesse sur l'existant) *« Les précisions, c'est : essayer de ne pas casser le fonctionnement actuel. Il faut être un petit peu souple sur la règle quand on va toucher aux développements qui ont déjà été faits. »* |
| :---- | :---- |

La règle est donc stricte sur le neuf, graduelle sur l'existant. Elle est intégrée comme telle en Annexe A.

## 5.3 Règle de workflow Git

Actée en parallèle, applicable aux deux parties :

* Une branche par fonctionnalité ou évolution. Aucun développement direct sur le tronc commun.  
* Les versions se matérialisent par des tags, pas par des branches.  
* Passage d'une branche à l'autre avec un environnement local propre (pas de modification non commitée).  
* Recommandation d'outillage : client Git desktop plutôt que ligne de commande. *« Les mecs que je connais qui utilisent les fonctions Git évoluées, souvent ça finit avec des conneries. »*

# ---

6\. Modèle de données du parc machine

---

Second bloc de la séance. Objectif : arrêter le modèle fonctionnel avant que Xavier Péchoultres ne lance la génération du module Clariprint Data.

## 6.1 Unification de la notion de fournisseur

Évolution majeure par rapport à Clariprint historique :

| Clariprint (existant) | Magrit / Clariprint Data (cible) |
| :---- | :---- |
| Trois entités distinctes : fournisseur papier, fournisseur imprimeur, fournisseur transport | Une entité Fournisseur, qualifiée par ses capacités : vend du papier, vend de l'impression, vend du transport |
| Sous-traitance gérée comme un concept à part | La sous-traitance devient un cas particulier du modèle fournisseur |

Corollaire assumé : l'imprimeur est lui-même un fournisseur de papier. Cas terrain qui le justifie — beaucoup d'imprimeurs stockent leurs papiers courants (couché moderne 115 g acheté en quantité), ce qui leur permet de répondre vite et de pratiquer un prix à la feuille, impossible en passant par un papetier qui vend à la rame, à la palette ou à la tonne. Le prix à la feuille est particulièrement structurant en numérique.

Autres concepts confirmés : environnement global multi-imprimeurs ; chaque imprimeur dispose de sa devise et de son système d'unités de saisie — point non anecdotique pour une internationalisation ultérieure.

## 

## 6.2 Sous-traitance — les trois modèles historiques

Xavier Péchoultres expose les trois mécanismes existants dans Clariprint :

| Modèle | Principe | Usage réel |
| :---- | :---- | :---- |
| Machine externalisée dans son propre parc | La machine est déclarée chez soi, avec coûts fixes et coûts de transport associés | Peu utilisé — a peu de sens hors machines de façonnage |
| Lignes de production | Le sous-traitant est déclaré comme un autre parc / un autre imprimeur ; on assemble dynamiquement des ressources de production internes et externes | Le mode réellement utilisé — considéré comme la vraie sous-traitance |
| Déclinaison papetiers / transporteurs | Un papetier ou un transporteur (UPS) est un sous-traitant comme un autre | En production |

L'intérêt des lignes de production est l'optimisation du cheminement du produit. Exemple donné : pour une brochure, il faut plier, brocher, puis massicoter. Si tout est fusionné dans un parc unique, le moteur peut envoyer le job chercher le massicot de l'imprimerie principale alors que le produit se trouve physiquement dans l'atelier du façonnier. Le modèle en parcs séparés préserve cette information.

## 6.3 La position AGE Dvt. — économie d'effort de saisie

Arnaud Mazon conteste l'ordre de saisie induit par le modèle historique : il obligerait l'imprimeur soit à décrire intégralement le parc de chacun de ses sous-traitants, soit à attendre que ces sous-traitants soient eux-mêmes utilisateurs du système.

|  | Verbatim — Arnaud Mazon (principe de saisie) *« Je ne m'occupe pas de définir mes sous-traitants, je m'occupe de mon parc. Mais dans mon parc, il y a des sous-traitants, et il me suffit de dire que c'est cette machine chez ce sous-traitant, qui vient nourrir mon parc total dans la partie machine externe. »* |
| :---- | :---- |

Mécanique proposée et retenue : dès qu'une machine est marquée externe, un champ de saisie du nom du sous-traitant s'ouvre, avec autocomplétion sur le référentiel. Si le sous-traitant existe déjà dans le système, ses informations — et éventuellement ses machines — sont proposées à l'import. S'il n'existe pas, le parcours continue sans blocage.

Xavier Péchoultres accepte le principe : le modèle interne/externe par machine existe déjà dans Clariprint, avec des prix de transport associés. *« On a ce modèle-là, mais en fait il faut qu'on merge un peu les deux. »*

## 6.4 Qualification interne / externe — non bloquante

Point de convergence important, dans le prolongement direct de la décision « prix de marché par défaut » du WM\#040826.

|  | Verbatim — Xavier Péchoultres (priorité au setup rapide) *« La meilleure solution dans un premier temps, c'est qu'on ait un setup complet du parc, le plus rapide et le plus simple possible, avec toutes les machines dont il dispose — qu'elle soit sous-traitée, qu'elle soit pas dans la même unité de production, peu importe. Tu cherches pas à comprendre. Après, une fois qu'il aura ça, il peut déjà sortir un prix. »* |
| :---- | :---- |

L'affinage vient ensuite, machine par machine : *« Ouais mais la KBA 702, en fait elle est externe, il faut que je rajoute des coûts. »*

Règle retenue : la qualification interne/externe est disponible mais non obligatoire dans le wizard. Aucun caractère bloquant. Elle reste éditable a posteriori sur la fiche machine.

Arnaud Mazon confirme par ailleurs que la faculté doit exister dès la création, pour l'utilisateur qui sait ce qu'il fait — typiquement celui qui décrira son parc en langage naturel.

## 6.5 Coûts de transport

Les coûts de transport / messagerie sont structurellement liés à l'externalisation. Le modèle doit permettre de les porter, y compris à zéro dans un premier temps.

# ---

# 7\. Wizard de saisie du parc

## ---

7.1 Le principe partagé

Le parcours est un wizard guidé, écran par écran, sur les grands types de machines : presses offset, presses numériques, grand format, roto, découpe, pliage, massicotage, machines de finition. Le mécanisme est celui du panier : l'utilisateur ajoute des machines depuis la bibliothèque, peut les supprimer, puis valide.

## 7.2 Le point de désaccord — l'ordre de saisie

|  | Position Xavier Péchoultres | Position Arnaud Mazon |
| :---- | :---- | :---- |
| Principe | Déroulé rigide, type par type : « Avez-vous des presses offset ? » → liste filtrée si oui, écran suivant si non | Qualification préalable des types de production pratiqués, puis passage en revue des seuls types déclarés |
| Argument | Garantie d'exhaustivité — le wizard doit imposer le passage sur tous les postes nécessaires au calcul | Économie de clics et d'écrans ; navigation par onglets dynamiques sur les types déclarés |
| Refus explicite | Les onglets sont refusés : l'utilisateur ne doit pas pouvoir naviguer librement dans un wizard | — |

Décision : arbitrage par maquette. Deux interfaces à réaliser et à comparer sur le nombre de clics et la pertinence du parcours. En attendant, Arnaud Mazon s'aligne explicitement sur le déroulé guidé : *« le fait que tu motives qu'on balise complètement une typologie de prod pour les raisons que tu évoques, OK, ça se tient. »*

## 

## 7.3 Sélection des machines — tags et filtres dynamiques

Arbitrage tranché en séance : pas d'arborescence. Le filtrage se fait par tags cliquables remontés des caractéristiques des machines, sur le modèle des facettes de boutique en ligne.

Attributs de filtrage identifiés : marque, format, nombre de groupes / couleurs, présence d'un groupe vernis.

|  | Verbatim — Xavier Péchoultres (ergonomie de filtrage) *« Il ne faut pas qu'il ait à cliquer 50 fois. Soit il a la machine et il la trouve d'un coup de molette, soit il clique sur Heidelberg et il n'a que les Heidelberg. C'est vachement chiant d'avoir une arborescence — je ne suis pas fan, surtout avec les interfaces tactiles qui arrivent. »* |
| :---- | :---- |

Sur la profondeur de la bibliothèque : elle doit couvrir l'historique, une machine de neuf ans n'étant plus au catalogue constructeur mais toujours en production chez l'imprimeur. Le volume reste maîtrisable — les constructeurs ne sortent pas de nouveau modèle en continu. Nuance de méthode : ne pas surcharger le parcours de filtres.

## 7.4 Contrôles et validations

* Massicot obligatoire — sans lui, aucun prix ne sort. Le wizard doit bloquer.  
* Question de confirmation sur la plieuse — l'absence est possible mais suspecte : *« est-ce que vous êtes sûr de ne pas avoir de plieuse ? »*. Cas légitime identifié : imprimeur numérique dont le groupe de pliage est intégré en ligne au cul de la presse.  
* Écran récapitulatif en fin de parcours.  
* Retour direct sur l'espace de travail de l'imprimeur, avec les machines créées.

## 7.5 Compléments identifiés

* Écrans séparés pour les fournisseurs papier et les fournisseurs transport — ils étaient sur le même écran dans la maquette existante, ce qui est jugé non conforme à la logique wizard.  
* Champs encres manquants — à intégrer au parcours.  
* Tests utilisateurs finaux obligatoires avant figeage de l'ergonomie.

## 

## 7.6 Statut de la maquette existante

La maquette Clariprint présentée en séance est ancienne et techniquement inexploitable. En revanche, les spécifications qui la sous-tendent sont récupérées et ont été remaniées pour entrer dans la logique Magrit. C'est ce corpus qui alimente la génération du module.

# ---

8\. Modèle de coûts, prix et catalogues

## ---

8.1 Modèle de coût dans le parcours

À intégrer au wizard, ou juste avant la sortie : proposer un modèle de coût avec saisie des taux horaires — notamment le coût de la main-d'œuvre, qui doit être saisi par l'utilisateur avec une valeur par défaut proposée. D'autres postes (coût du kWh) peuvent rester en valeur par défaut sans saisie.

## 8.2 Produits de test pré-calculés

Proposition d'Expert Solutions retenue : à l'arrivée sur son espace, l'imprimeur dispose déjà d'une liste de produits standard calculés avec son parc. Il voit immédiatement des prix, peut créer ses propres produits de test et les recalculer en direct.

C'est le prolongement direct de la décision « prix de marché par défaut » du WM\#040826, dont Arnaud Mazon réaffirme le caractère clé : l'imprimeur peut commencer à faire des devis avant même d'avoir fini de renseigner son parc. Xavier Péchoultres maintient sa nuance : l'objectif reste que l'utilisateur obtienne rapidement un prix avec ses propres données. Les deux fonctions du prix de marché — amorçage et positionnement tarifaire — restent distinctes.

## 8.3 Frontière coûts de production / prix de vente — décision structurante

Question posée : les marges commerciales doivent-elles être paramétrées dans le module parc machine ?

|  | Verbatim — Arnaud Mazon (arbitrage) *« Je ne le foutrais pas là du tout. La logique du prix de vente, elle est relative au client. C'est dans le module gestion commerciale qu'on va définir le client, et c'est donc là que l'aspect marge commerciale a vocation à être géré. Ici tu gères ton environnement de production et ton coût de production ; quand tu gères tes clients, tu gères à quel prix tu leur vends. »* |
| :---- | :---- |

Objection d'Expert Solutions, fondée sur l'observation terrain : les deux pratiques coexistent chez les clients et ne sont pas imposables — certains saisissent leurs coûts internes puis ajoutent des marges en gestion commerciale ; d'autres saisissent des coûts déjà margés puis gèrent des remises. *« Arnaud, tu peux dire ce que tu veux, en face de toi tu as des clients qui fonctionnent d'une manière et d'autres d'une autre. Tu vas te casser les dents. »*

Contre-argument d'AGE Dvt., retenu comme arbitrage :

|  | Verbatim — Arnaud Mazon (cohérence analytique) *« Si le mec met des prix margés ici et zéro dans la GesCom, ça relève d'un flou en termes d'analytique et de capacité à savoir si tu gagnes de l'argent qui est drastique. Tu paramètres tes machines et tes coûts de prod ici, tes prix de vente dans la GesCom : c'est économiquement cohérent. »* |
| :---- | :---- |

Décision retenue : Clariprint Data \= coûts de production exclusivement. GesCom \= prix de vente, marges, remises, par client et par groupe de produits. La flexibilité par client reste ouverte à discussion, mais dans le module commercial.

## 8.4 Marge contre remise — position commerciale AGE Dvt.

Débat annexe mais utile à l'argumentaire produit. Position d'Expert Solutions : le schéma classique est coût de prod \+ marge → prix public → remise négociée avec le client, la négociation portant sur la remise et jamais sur la marge.

Position d'AGE Dvt. :

|  | Verbatim — Arnaud Mazon (pratique commerciale) *« Faire de la remise, commercialement, ce n'est pas une technique très efficace. Vaut mieux instaurer avec son client le fait de lui dire : quand je te donne un prix, c'est le bon. Ça amène de la confiance, et ça t'évite qu'il te rabâche à chaque fois pour de la remise. »* |
| :---- | :---- |

Métrique citée de mémoire, à vérifier avant tout usage externe : chez Exaprint, environ 23 % de marge sur la vente par les commerciaux contre 42 % sur la vente en ligne.

## 8.5 Catalogues de prix et snapshots

Fonctionnalité existante dans Clariprint, à reprendre — et inscrite au cahier des charges d'Altavia, donc non négociable sur le calendrier de ce compte.

Principe. Quand l'imprimeur a validé ses prix, il crée un catalogue — un snapshot figé de l'ensemble de ses prix de production à un instant T, avec date de validité. Ce sont ces données figées qui servent aux calculs en production. Il peut continuer à modifier ses paramètres à côté sans impacter la production, puis publier une nouvelle version quand il est prêt.

Deux fonctions distinctes :

* Isolation production / simulation — une modification en cours n'affecte pas les prix servis aux clients réels.  
* Traçabilité et preuve de prix — pouvoir expliquer, deux mois après, pourquoi un dossier est sorti à tel prix, en remontant au catalogue en vigueur à cette date.

## 8.6 Environnement de draft

Problème connexe : une machine nouvellement saisie, non encore livrée ou non calibrée, ne doit pas entrer immédiatement dans les calculs servis en boutique. Deux options envisagées — un espace de travail draft, ou un statut draft porté par la machine. Le flag actif / inactif existant répond partiellement au besoin. La publication prend la forme d'une validation explicite des modifications.

## 

## 8.7 Transport et papetiers — état des interfaces

| Sujet | Constat |
| :---- | :---- |
| API de pricing transporteurs | Ne tiennent généralement pas compte des conditions particulières négociées. Pas d'API de pricing chez Colissimo / Chronopost — l'API sert à créer le bon de transport, pas à interroger un prix. Rarement fonctionnel en e-commerce. |
| Grilles tarifaires | Restent la solution de référence — en dur ou par import CSV. Négociées imprimeur par imprimeur ; Altavia dispose de ses propres grilles négociées. |
| Papetiers | Antalis dispose d'une API propre, chantier en cours côté Expert Solutions. La plupart des autres exposent des exports CSV. |
| Référentiel des points de livraison | Sujet interne Expert Solutions, considéré comme bien maîtrisé. |

Ouverture notée par Xavier Péchoultres : la situation peut évoluer, et Magrit / Expert Solutions pourrait se positionner comme intermédiaire d'agrégation sur ces interfaces.

## 8.8 Chaîne technique de bout en bout

Clarification apportée en séance : Clariprint Data est le back-office des données de parc. Une fois le parc constitué et validé, les données réelles sont envoyées au solveur Clariprint, qui porte le calcul de prix. C'est la frontière fonctionnelle entre le module de paramétrage et le moteur.

# 

# 

# ---

9\. Design applicatif et charte graphique

---

Sujet ouvert par AGE Dvt. en fin de séance.

* Constat. Manque de continuité visuelle entre la home Magrit et le tableau de bord. Le tableau de bord est jugé insuffisamment abouti.  
* Socle technique confirmé. Magrit est déjà bâti sur Tailwind — choix effectué par l'agent, non arbitré. Xavier Péchoultres valide ce choix a posteriori : successeur de facto de Bootstrap, standard actuel.  
* Distinction posée. Tailwind est la technologie qui permet de construire le design, pas le design lui-même. Il faut donc choisir un template applicatif — une charte graphique de référence — à appliquer sur Tailwind.  
* Défaut d'organisation identifié. Aucun template d'affichage systématique n'a été repéré dans le code actuel : l'absence de modularité se retrouve au niveau graphique, avec un risque de réécriture des mêmes composants d'un écran à l'autre.  
* Action. Arnaud Mazon recherche des designs applicatifs Tailwind et organise un point avec Tony, référent design.

# ---

10\. Points ouverts et sujets non tranchés

---

| Sujet | Constat | Impact / action recommandée |
| :---- | :---- | :---- |
| Statut du socle Expert Solutions | Le socle de Laurent Rebière est mis en attente de fait, sans arbitrage formalisé ni critère de reprise | P0 — Porter cette inflexion en session hebdomadaire et acter explicitement le statut de HC Platform / Magrit Core |
| Ordre de saisie du wizard | Désaccord ergonomique non tranché — déroulé rigide par type contre qualification préalable des types de production | P0 — Deux maquettes comparatives, critère : nombre de clics et taux d'oubli d'équipement |
| Frontière Clariprint Data / GesCom | Arbitrage posé par AGE Dvt., contesté sur la faisabilité terrain par Expert Solutions | P0 — Documenter la règle dans le PRD et prévoir la conduite du changement côté clients existants |
| Périmètre du module GesCom | Le module est invoqué comme réceptacle des marges, remises et prix de vente, mais n'est ni spécifié ni planifié | P0 — Ouvrir une entrée de backlog dédiée et la positionner dans la roadmap bêta |
| Sourcing de la bibliothèque de machines | Volumétrie, profondeur historique et sources non chiffrées — point déjà ouvert au WM\#040826, toujours non instruit | P1 — Chiffrer l'effort avant tout engagement de périmètre bêta |
| Environnement de draft | Deux options concurrentes (espace de draft / statut machine), interaction avec le flag actif-inactif non résolue | P1 — Trancher au moment de la spécification du catalogue |
| Nettoyage du dépôt Magrit | Branches historiques multiples, certaines remergées, d'autres non identifiées ; versions gérées en branches au lieu de tags | P1 — Faire un état des lieux des branches et poser une convention de tagging |
| APIs transporteurs et papetiers | Grilles en dur / CSV restent la norme ; opportunité d'agrégation identifiée mais non instruite | P2 — Qualifier comme brique d'offre potentielle, hors périmètre POC |
| Métrique de marge Exaprint | Chiffres cités de mémoire (23 % / 42 %) | P2 — Vérifier avant tout usage en argumentaire commercial |
| Template graphique applicatif | Aucun template retenu ; absence de composants d'affichage réutilisables dans le code | P1 — Arbitrer après le point avec Tony, avant que Clariprint Data ne produise ses écrans |

# ---

11\. Next steps

## ---

11.1 Engagements pris en séance

| Action | Responsable | Échéance | Statut |
| :---- | :---- | :---- | :---- |
| Transmettre le CR et les spécifications / stories issues de la séance | Arnaud Mazon | 7 août, avant 14 h 00 | ● Acté |
| Réinjecter le reporting de séance dans les PRD | Xavier Péchoultres | 7 août | ● À traiter |
| Lancer la génération du module Clariprint Data sur les spécifications remaniées | Xavier Péchoultres | 7 août — après-midi | ● En cours |
| Renommer la branche migration OWK en intitulé explicite (clariprint-data) | Xavier Péchoultres | S32 | ● À traiter |
| Isoler les développements Clariprint Data sur une branche dédiée, sans écraser l'existant | Xavier Péchoultres | S32 | ● Acté |
| Porter les améliorations API-first sur Magrit Off | Xavier Péchoultres | S32–S33 | ● À traiter |
| Écrire le petit noyau applicatif (services essentiels, compatible gros noyau) | Xavier Péchoultres | S32–S33 | ● À traiter |
| Lire et valider les spécifications techniques générées dans le dossier doc | Xavier Péchoultres | S32 | ● À traiter |
| Produire le jeu d'instructions d'architecture pour les agents de développement | Arnaud Mazon | 7 août | ● Fait — Annexe A |
| Valider le jeu d'instructions et les emplacements d'injection | Xavier Péchoultres | S32 | ● À traiter |
| Implanter les règles d'architecture dans le fichier de contexte Magrit sous Obsidian | Arnaud Mazon | S32 | ● À traiter |
| Rechercher des templates de design applicatif compatibles Tailwind | Arnaud Mazon | S32 | ● À traiter |
| Organiser un point design avec Tony | Arnaud Mazon | S32 | ● À traiter |
| Réaliser deux maquettes comparatives du wizard parc machine | Groupe | S33 | ● À traiter |
| Intégrer les champs encres manquants au parcours wizard | Groupe | S33 | ● À traiter |
| Spécifier le système de tags et les validations bloquantes du wizard | Groupe | S32–S33 | ● À traiter |
| Clarifier la logique de marges et de structures de coûts dans le module commercial | Groupe | S33 | ● À traiter |

## 11.2 Actions internes AGE Dvt. — pilotage

* Formaliser le basculement vis-à-vis de Laurent Rebière. La mise en attente du socle Expert Solutions a été décidée en bilatéral. Elle doit être portée en session hebdomadaire pour ne pas produire un désalignement entre les deux intervenants d'Expert Solutions.  
* Traiter GesCom comme un chantier, pas comme un renvoi. Trois décisions de la séance renvoient explicitement à un module de gestion commerciale qui n'existe pas encore, même à l'état de spécification. Le risque est de vider Clariprint Data d'une partie de sa valeur perçue sans que le réceptacle existe.  
* Verrouiller le PRD comme unique source de vérité. Les spécifications remaniées sont désormais le point d'entrée de la génération. Toute décision de séance non écrite dans le PRD n'existe pas pour la chaîne de production.  
* Ne pas laisser le désaccord wizard s'installer. L'arbitrage par maquette est sain, mais il consomme du temps de conception. Fixer une date de décision et un critère unique (nombre de clics jusqu'au premier prix).  
* Capitaliser le jeu d'instructions au-delà de Magrit. Les règles d'architecture posées ici (API-first, modularité, MCP, une branche par fonctionnalité) sont directement transposables aux autres projets AGE Dvt. — site web, ABA, missions Agence IA. C'est un actif méthodologique, pas un livrable projet.

# ---

12\. Lecture stratégique pour le pilotage

## ---

12.1 Ce qui est acquis

* Le socle applicatif Magrit a été audité par Expert Solutions et jugé reprenable — l'analyse d'architecture demandée au WM\#040826 est faite, et elle débouche sur un plan de reprise, pas sur un rejet.  
* Les invariants d'architecture sont posés et documentés. API-first, modularité, MCP : ce sont des règles opposables, pas des intentions.  
* Le modèle de données du parc machine est arbitré sur ses points structurants : fournisseur unifié, sous-traitance par autocomplétion, qualification non bloquante.  
* La frontière coûts / prix est tranchée, ce qui débloque la spécification du module et clarifie le discours commercial.  
* La production est effectivement lancée — le développement de Clariprint Data démarre le jour même, sur des spécifications consolidées.

## 12.2 Points de vigilance

* L'arbitrage marges / GesCom est un pari d'adoption. AGE Dvt. impose une logique que le partenaire dit avoir vu échouer sur le terrain. Le pari est défendable — il est même structurant pour la promesse analytique de Magrit — mais il doit être assumé comme tel et outillé côté conduite du changement.  
* La dette de non-modularité est déjà là. Le code existant devra être migré progressivement ; la règle « souple sur l'existant » est nécessaire mais crée une zone grise durable entre ancien et nouveau régime.

## 12.3 Décisions à prendre avant la prochaine session hebdomadaire

* Acter le statut du socle HC Platform / Magrit Core et le critère de reprise éventuelle.  
* Positionner GesCom dans la roadmap : périmètre bêta ou phase suivante.  
* Fixer la date de l'arbitrage wizard et le critère de décision.  
* Confirmer ou corriger la fenêtre bêta au vu du périmètre réel.  
* Valider le jeu d'instructions d'architecture (Annexe A) et ses emplacements d'injection.

## 12.4 Entrées de backlog issues de la session

Le détail des stories, critères d'acceptation et dépendances figure dans le document *Stories\_Epics\_RP070826\_Magrit*.

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

Suites documentaires :

* Obsidian — implanter le jeu d'instructions (Annexe A) dans le fichier de contexte Magrit, chargé à chaque nouvelle session ; consigner la fiche de traçabilité du présent CR dans 03\_MAGRIT/.  
* Notion — passer les 33 entrées ci-dessus au Sprint Board après estimation, source RP\#070826.  
* Dépôt Magrit — répercuter les règles d'architecture dans les fichiers de règles projet et le répertoire d'agents.  
* Suivi Dihnamic — qualifier le rattachement du module GesCom au périmètre POC déclaré.

# ---

Annexe A — Jeu d'instructions d'architecture pour les agents de développement

---

*Livrable demandé en séance par Arnaud Mazon, à valider par Xavier Péchoultres avant injection. À placer dans les fichiers de règles projet (AGE Dvt. et Expert Solutions) et dans le fichier de contexte Magrit sous Obsidian.*

| \# Règles d'architecture — projet Magrit / Clariprint Data \# Statut : opposable à tout développement. Chargé à chaque session. \# Source : session de travail RP\#070826 (Expert Solutions × AGE Dvt., 07/08/2026) \#\# R1 — API-first (bloquant) Le front (React / TypeScript) ne communique JAMAIS directement avec la base de données. Toute interaction passe par une couche serveur exposant un contrat d'API explicite et documenté. \- Interdit : requêtes construites côté navigateur, appels directs au stockage,   points d'entrée serveur non contractualisés. \- Requis : un contrat d'API par domaine fonctionnel, documenté (OpenAPI ou   équivalent), avec typage des entrées et sorties. \- Avant d'écrire un écran, écrire et documenter l'API qui l'alimente. \#\# R2 — Modularité (bloquant) Toute fonctionnalité nouvelle est développée comme un module autonome. \- Un module \= un périmètre fonctionnel, ses routes, son modèle, ses tests. \- Interdit : disperser du code dans plusieurs zones de l'application pour   faire fonctionner une fonctionnalité. \- Interdit : dépendance directe d'un module à l'implémentation interne d'un   autre module — le passage se fait par l'API ou par le noyau. \- Motif explicite : au-delà de la maintenabilité, la modularité conditionne   la capacité d'un agent à travailler sur le code sans saturer sa fenêtre   de contexte. \#\# R3 — Vocabulaire MCP (différé, à ne pas anticiper) Chaque module exposera un vocabulaire MCP dérivé de son API. \- N'est PAS à implémenter tant que R1 et R2 ne sont pas satisfaites. \- Concevoir les API en gardant cette cible : nommage explicite orienté   ressource et action (get / list / create sur des entités métier nommées). \#\# R4 — Noyau minimal Les services essentiels (authentification, configuration, accès aux données) vivent dans un noyau léger. Les écrans qui les exposent sont des modules. \- Le noyau reste compatible avec le noyau Magrit existant. \- Aucune logique métier dans le noyau. \#\# R5 — Souplesse sur l'existant (dérogation encadrée) Sur du code déjà écrit, ne pas casser le fonctionnement actuel. \- Migration progressive vers R1/R2, au fil des interventions. \- Toute dérogation est explicitée en commentaire et remontée dans le rapport   de fin de tâche, avec le chemin de mise en conformité. \- Aucune dérogation n'est admise sur du code nouveau. \#\# R6 — Workflow Git (bloquant) \- Une branche par fonctionnalité ou évolution. Jamais de développement direct   sur le tronc commun. \- Les versions se matérialisent par des tags, pas par des branches. \- Avant tout changement de branche : environnement local propre, aucune   modification non commitée. \- Nommage de branche explicite sur le périmètre fonctionnel. \#\# R7 — Design \- Framework : Tailwind. \- Les composants d'affichage sont mutualisés dans des templates réutilisables.   Interdit de réécrire une mise en page d'écran en écran. \- La charte graphique de référence est celle définie au niveau projet ; ne   pas introduire de style ad hoc. \#\# R8 — Sortie de tâche À la fin de toute tâche, produire un rapport court indiquant : 1\. les modules touchés ; 2\. les API créées ou modifiées, avec leur contrat ; 3\. les dérogations R5 utilisées et leur chemin de mise en conformité ; 4\. les tests exécutés et leur résultat. |
| :---- |

---

---

*Document confidentiel. Usage interne AGE Développement & Expert Solutions.*