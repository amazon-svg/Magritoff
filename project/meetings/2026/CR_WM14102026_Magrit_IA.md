![][image1]

MAGRIT IA

AGE   DÉVELOPPEMENT

Compte rendu de session de travail

Avancement, intégration de Studio, TVA et livraison, financement

Arnaud Mazon (AGE Développement) · Xavier Péchoultres (Expert Solutions)

*Réunion du mercredi 14 octobre 2026*

| CONFIDENTIEL — USAGE INTERNE Diffusion : équipe projet Magrit — AGE Développement · Expert Solutions · Clariprint. Ce compte rendu fait foi pour les orientations de la séance ; elles ne deviennent applicables qu'une fois reportées et approuvées dans le dépôt Git. |
| :---- |

# 

# **Sommaire**

Synthèse exécutive

1\. Cadre de la réunion

2\. Point d'avancement technique

2.1 Commandes, boutiques et prix

2.2 Préproduction et courriels

2.3 Noms de domaine et dépôt GitHub

3\. Bêta avancée et intégration de Studio

3.1 Ce qui reste pour la bêta avancée

3.2 Comment Studio s'intègre dans Magrit

3.3 Cadrage de Studio : historique et prompts

4\. TVA et livraison

4.1 Le constat

4.2 Devis, commande et lieu de livraison

4.3 Des lots de lignes indivisibles

4.4 Coûts de transport

5\. Infrastructure, financement et partenaires

5.1 Préconisations d'architecture

5.2 Levée de fonds et création de Magrit SAS

5.3 Contexte commercial et partenaires

6\. Next steps

6.1 Engagements pris en séance

6.2 Actions internes

7\. Lecture stratégique pour le pilotage

Ce qui est acquis

Points de vigilance

Décisions à prendre

Inscriptions dans les outils projet

# 

# **Synthèse exécutive**

La séance du 14 octobre a fait le point sur une semaine où l'intégration de Studio, prévue comme dernière marche avant la bêta avancée, n'a pas pu avancer : Xavier Péchoultres et Laurent Rebière ont été mobilisés par le contrat Altavia et le crédit d'impôt recherche. Le reste du chantier a progressé : commandes nettoyées, écrans de boutique remis aux normes d'ergonomie, préproduction installée sur un serveur privé virtuel. L'essentiel de la réunion a porté sur la TVA, que la livraison rend plus complexe que prévu : elle impose de faire évoluer le modèle de devis de Magrit vers des lots de lignes indivisibles. Arnaud Mazon a enfin présenté le calendrier de financement.

Trois conclusions opérationnelles à retenir

> * Studio est la priorité de la semaine. L'intégration de Studio jusqu'aux boutiques — chat, prix, formulaires — est le seul manque identifié pour atteindre la bêta avancée. Studio est une bibliothèque d'interface chargée dans Magrit, pas un service appelé à distance : ses fonctions natives sont celles de Magrit.  
> * Plusieurs points de livraison, plusieurs lots. Un même calcul Studio doit pouvoir alimenter plusieurs lignes de devis liées entre elles, une par point de livraison, que l'on ne peut pas supprimer séparément. La règle fiscale à appliquer à chaque lot reste à qualifier : le pays de livraison détermine le régime de TVA, pas seulement le taux.  
> * Le financement se prépare pour début novembre. Premiers rendez-vous visés avec Bpifrance et un conseil en levée de fonds, pour financer une phase d'environ six mois de qualification de clients test ; la création de Magrit SAS est envisagée à la fin du premier trimestre 2027\.

Prochaine échéance : intégration de Studio dans les boutiques, semaine du lundi 19 octobre 2026\.

# 

# **1\. Cadre de la réunion**

| Élément | Détail |
| :---- | :---- |
| Parties | Arnaud Mazon (AGE Développement) · Xavier Péchoultres (Expert Solutions). Laurent Rebière (Clariprint), invité, n'a pas participé : il était en réunion avec Altavia |
| Date et durée | Mercredi 14 octobre 2026, 9 h 30 – 10 h 46 environ (1 h 16\) |
| Format | Visioconférence Google Meet |
| Objet | Weekly meeting Magrit WM14102026 : avancement, périmètre de la bêta avancée, TVA et livraison, infrastructure, financement |
| Source | Notes et transcription automatiques Gemini de la séance |
| Report dans le dépôt | À faire : compte rendu et orientations TVA et livraison à reporter dans le dépôt Magritoff |
| Rédacteur | Claude, pour Arnaud Mazon |
| Convention | Les citations sont rétablies en langue écrite, sans altération du propos. Les assertions techniques ont été vérifiées ; les écarts significatifs sont signalés en encadré « Précision technique ». « Studio » désigne Clariprint Studio, la bibliothèque de description de produits et de calcul de prix intégrée à Magrit |

# 

# **2\. Point d'avancement technique**

## **2.1 Commandes, boutiques et prix**

Faute d'avancée sur Studio, Xavier Péchoultres a traité les chantiers qui n'en dépendaient pas. Les écrans ont été repris en profondeur, avec des effets sur les données sous-jacentes.

> * Commandes. Nettoyage complet de la gestion des commandes, testé et validé, et reprise de la génération des bons de commande en PDF, qui ne fonctionnait pas correctement.  
> * Référentiel produit. Le référentiel accepte désormais des produits à prix fixe, utiles en soi et nécessaires pour tester toute la chaîne avant le branchement du calcul.  
> * Boutiques. L'écran unique qui mêlait configuration, liste des clients et paramètres a été scindé pour respecter les règles d'ergonomie du projet.  
> * Prix, marges et remises. Les deux écrans qui se recouvraient sont unifiés. Il s'agissait d'un défaut de présentation, sans incidence sur les données.

## **2.2 Préproduction et courriels**

Xavier Péchoultres a cherché un hébergement pour la préproduction. Clever Cloud présentait des limitations bloquantes pour le déploiement, Scaleway des conditions peu claires, et OVH n'avait plus aucun serveur privé virtuel disponible hors du Canada. La préproduction tourne donc sur un serveur privé virtuel existant d'Expert Solutions, sous une adresse provisoire. Cette solution remplace l'installation sur Clever Cloud annoncée le 7 octobre.

Arnaud Mazon n'a pas pu créer de compte : le courriel de confirmation n'arrive pas. Ce n'est pas une anomalie. En développement, les courriels transactionnels sont interceptés par Mailpit, un outil qui les retient pour inspection au lieu de les envoyer. Xavier configure le serveur d'envoi (SMTP) dans la journée pour que la création de compte aboutisse.

## **2.3 Noms de domaine et dépôt GitHub**

Le domaine déposé est magritapp.com ; le site vitrine est déjà en ligne sur www\.magritapp.com. Xavier Péchoultres recommande des sous-domaines plutôt que des chemins (magritapp.com/app) : un chemin oblige à servir le site et l'application depuis le même point d'entrée. Arnaud Mazon crée dans la zone DNS de Gandi app.magritapp.com pour la production et preprod.magritapp.com pour la préproduction. Un sous-domaine ne demande aucun dépôt de nom supplémentaire.

Côté dépôt, les clés ajoutées par Arnaud ont permis à Xavier de mettre en place le déploiement automatique. Reste l'administration : Xavier ne peut pas être administrateur d'un dépôt de compte personnel. Arnaud organise le transfert du dépôt Magritoff dans une organisation GitHub.

| ◆ Précision technique — transfert du dépôt GitHub Un fork n'est pas nécessaire. Le transfert d'un dépôt vers une organisation conserve l'historique des commits, les tickets, les demandes de fusion, les clés de déploiement et les secrets ; les liens et les commandes git vers l'ancienne adresse sont redirigés automatiquement, tant qu'aucun dépôt n'est recréé à l'ancien emplacement. L'offre gratuite de GitHub couvre les organisations, avec dépôts privés et collaborateurs illimités. Sources : documentation GitHub « Transferring a repository » et page des tarifs GitHub, consultées le 14 octobre 2026\. |
| :---- |

# **3\. Bêta avancée et intégration de Studio**

## **3.1 Ce qui reste pour la bêta avancée**

Pour Xavier Péchoultres, la seule brique manquante est l'intégration de Studio, prévue la semaine suivante. Avec elle, Magrit disposera d'une chaîne complète : calcul Clariprint, prix dynamiques, boutique, administration et arrière-guichet, déjà bien avancés.

> * Première phase : produire du prix. Le prix s'appuie sur des prix de marché, voire sur des parcs machines décrits dans Clariprint ; la gestion commerciale est active. C'est le contenu de la bêta.  
> * Seconde phase : Clariprint Data. Elle suppose de construire dans Magrit l'interface de description des parcs machines, chantier plus lourd. Arnaud Mazon estime que l'ergonomie de cette saisie est désormais claire, entre les travaux du POC et l'analyse de GelatoConnect.

| Verbatim — Xavier Péchoultres *« Nous sommes sur une donnée métier très technique. La structuration de la donnée conditionne le fonctionnement du moteur de calcul : ce n'est pas seulement une question d'affichage de champs à l'écran. »* |
| :---- |

## 

## **3.2 Comment Studio s'intègre dans Magrit**

Arnaud Mazon a demandé si Magrit dialogue avec Studio par une interface de programmation ou s'il l'affiche directement. Réponse de Xavier Péchoultres : Studio est une bibliothèque d'interface chargée dans Magrit. Au chargement, Magrit lui indique où lire les données à afficher et où enregistrer celles qui sont saisies. Description des produits et des projets, formulaires, chat et calcul du prix hors taxe relèvent de Studio ; il n'y a pas de surcouche Magrit à concevoir pour ces fonctions.

Magrit prend le relais quand un prix calculé est ajouté à un devis ou à un projet : Studio injecte alors les lignes dans les données de Magrit, qui porte la gestion commerciale. Aujourd'hui, Magrit ne sait recevoir qu'une ligne par calcul ; c'est ce point qui doit évoluer (section 4.3).

## **3.3 Cadrage de Studio : historique et prompts**

> * Fidélité au POC. Arnaud Mazon demande que la vision du POC soit conservée et mise en cohérence avec les notions introduites depuis, dont les projets, y compris le panneau gauche de l'écran : historique des résultats, rattachement à un projet.  
> * Historique. Il s'agit de pouvoir rappeler un résultat obtenu par un prompt. Dans l'implémentation actuelle, un prompt est rattaché d'office à un projet ; Arnaud rappelle qu'un prompt peut produire plusieurs produits, dont seuls certains iront dans un projet. Xavier met l'usage à disposition pour qu'Arnaud le teste.  
> * Parcs machines. Arnaud apprécie, dans l'interface GelatoConnect vue le 7 octobre, la barre latérale des parcs préremplis (presse numérique, plieuse) où l'on sélectionne ses machines. Xavier et Laurent Rebière avaient déjà vu cet outil il y a quelques années ; ils jugent son ergonomie proche de leur propre maquette.  
> * Tests. Les deux parties s'accordent : faire tester l'application intensivement par les agents, qui font partie de la chaîne de production, et la tester eux-mêmes tant que cette chaîne n'est pas éprouvée.

# 

# **4\. TVA et livraison**

## **4.1 Le constat**

Le principe arrêté le 7 octobre — TVA portée par chaque ligne, taux tiré du pays du client — ne suffit pas. Xavier Péchoultres rappelle que la TVA dépend du lieu de livraison et non du pays du client. Cas vécu chez un imprimeur : une entreprise portugaise commande en France et fait livrer en France ; c'est la TVA française qui s'applique, comme pour un client luxembourgeois livré en France. Arnaud Mazon précise que la question ne se pose que lorsque l'imprimeur assure la livraison, ce qui est le cas courant : une agence de communication fait souvent livrer plusieurs filiales ou services de son client.

| Verbatim — Xavier Péchoultres *« Ce n'est pas le pays de l'entreprise ni celui du client qui compte : c'est le pays de livraison. »* |
| :---- |

| ◆ Précision technique — lieu d'imposition et régime de TVA L'exemple cité en séance est exact : un bien expédié depuis la France est livré en France au sens de la TVA (CGI, art. 258, I-a), quel que soit le pays du client ; la TVA française s'applique. En revanche, quand le bien part vers un autre État membre, l'imprimeur n'applique pas, dans le cas général, le taux du pays de destination. Vente à une entreprise identifiée à la TVA : livraison intracommunautaire exonérée, l'acheteur autoliquide la TVA dans son pays. Vente à un particulier : TVA du pays de destination au-delà de 10 000 € de ventes à distance annuelles dans l'Union (CGI, art. 258 A). Hors Union : exportation exonérée. Chaque lot doit donc porter un régime — France, intracommunautaire exonéré, vente à distance, export — autant qu'un taux. Le taux normal portugais est de 23 % sur le continent, et non 18 ou 19 %. Sources : BOFiP BOI-TVA-CHAMP-20-20-10 ; taux portugais : guide TVA Portugal de vatcalc.com, consultés le 14 octobre 2026\. |
| :---- |

## 

## **4.2 Devis, commande et lieu de livraison**

Arnaud Mazon soulève le cas d'un devis établi avant que la livraison ne soit connue. Dans Clariprint, la livraison fait partie du calcul — conditionnement, délais, optimisation — mais sa saisie reste optionnelle. L'échange aboutit aux règles suivantes.

| Point | Orientation de séance | Statut |
| :---- | :---- | :---- |
| Devis sans livraison | Le devis s'établit sans coût de livraison, prix hors taxe affichés avec la mention d'une TVA applicable selon le lieu de livraison | ● Acté |
| Commande | Les points de livraison doivent être connus au plus tard à la commande, qui devient la facture | ● Acté |
| Livraison précisée après envoi | Elle donne lieu à un nouveau devis, lié au précédent — comportement déjà prévu | ● Acté |
| Saisie manuelle | L'opérateur peut reprendre la ligne calculée par Studio pour y ajouter les livraisons, ou ajouter une ligne libre de frais de livraison au forfait | ● Acté |
| Suivi de transport | Bons de transport et numéros de suivi restent hors périmètre : Magrit n'est pas un ERP (report du 7 octobre confirmé) | ● Acté |
| Verrou transitoire | Proposition de Xavier : limiter dans un premier temps un devis à un seul pays de livraison, les cas complexes étant traités par téléphone | ● À traiter |

| Verbatim — Arnaud Mazon *« Pour l'instant, nous ne sommes pas un ERP : nous ne nous imposons pas les contraintes qui vont avec. »* |
| :---- |

## 

## **4.3 Des lots de lignes indivisibles**

Une commande de 50 000 brochures réparties entre plusieurs pays n'est pas cinq commandes de 10 000 : le coût de fabrication est celui de 50 000 exemplaires. Il faut donc pouvoir répartir un même calcul sur plusieurs lignes, chacune avec sa TVA, sans pouvoir en supprimer une isolément.

> * Règle retenue. Plusieurs points de livraison donnent plusieurs lots, une ligne par point de livraison. Magrit vérifie le régime de TVA applicable à chaque lot d'après son adresse de livraison et l'applique.  
> * Modèle de données. Le devis doit accueillir des groupes de lignes liés à un seul calcul : on supprime le groupe entier ou rien. Studio connaît déjà, pour chaque calcul, les quantités livrées par destination ; il les injectera dès que Magrit saura les recevoir.  
> * Table des taux. Magrit doit disposer en permanence des taux de TVA à jour pour l'ensemble des pays concernés.  
> * Bénéfice induit. La même structure permettra de détailler un prix par poste — papier, impression, façonnage, livraison —, une demande croissante des grands comptes pour leur comptabilité et leurs achats.  
> * Livraisons différées. Une partie laissée en stock chez l'imprimeur se traite en ne la déclarant pas dans les quantités livrées. Les accords de facturation du stock relèvent de la facture et restent hors périmètre.

Arnaud Mazon demande que les agents Magrit produisent, sur la base de cet échange, les stories qui spécifient le comportement attendu de la TVA dans Magrit, avec Studio intégré.

## **4.4 Coûts de transport**

Clariprint calcule les coûts de transport à partir de grilles tarifaires importées fournisseur par fournisseur, au format Excel : les conditions sont négociées par chaque imprimeur avec chaque transporteur et ne sont pas exposées par une interface de calcul. Le maintien de ces grilles est une charge réelle pour les imprimeurs. Des intermédiaires numériques agrègent désormais les tarifs de transporteurs comme Chronopost et Colissimo ; Arnaud Mazon retient cette piste comme fonctionnalité ultérieure.

# 

# **5\. Infrastructure, financement et partenaires**

## **5.1 Préconisations d'architecture**

Arnaud Mazon rencontre le jeudi 22 octobre l'architecte chargé des préconisations d'infrastructure de Magrit. Il lui adresse auparavant un mémo d'architecture. Xavier Péchoultres lui transmet ses réflexions issues des essais de déploiement — limites rencontrées chez chaque hébergeur, contraintes identifiées — pour alimenter ce travail.

## **5.2 Levée de fonds et création de Magrit SAS**

Les derniers jours ont été consacrés au business plan, à la levée de fonds et à l'organisation du développement commercial. Les documents de présentation sont en cours de finalisation.

> * Interlocuteurs. Bpifrance et un conseil en levée de fonds avec qui Arnaud Mazon a déjà travaillé ; premiers rendez-vous visés début novembre 2026\.  
> * Première phase. Qualifier des clients test pendant environ six mois, financés par un programme Bpifrance à identifier, pour disposer de références auprès des financeurs.  
> * Étapes juridiques. D'abord l'accord entre Expert Solutions et AGE Développement, puis la création de Magrit SAS, qui associera les partenaires et permettra l'entrée des investisseurs. Création envisagée à la fin du premier trimestre 2027 ; le déclencheur reste l'entrée d'investisseurs.

## **5.3 Contexte commercial et partenaires**

> * Prospects. Le Groupe ICI ne donne pas suite pour l'instant. Le marketing et la démarche commerciale ont avancé pour recruter les clients test.  
> * Altavia. Après un mois de négociation juridique sur des clauses de responsabilité étendues, notamment sur les erreurs de prix, toutes les clauses seraient validées ; Laurent Rebière était en réunion de conclusion pendant la séance. Ce dossier et le crédit d'impôt recherche expliquent le retard de la semaine sur Studio.

# 

# **6\. Next steps**

## **6.1 Engagements pris en séance**

| Action | Responsable | Échéance | Statut |
| :---- | :---- | :---- | :---- |
| Configurer le serveur d'envoi de courriels (SMTP) de la préproduction | Xavier Péchoultres | 14/10/2026 | ● En cours |
| Créer un compte sur la préproduction une fois les courriels actifs | Arnaud Mazon | après SMTP | ● En attente |
| Intégrer Studio jusqu'aux boutiques : chat, prix, formulaires | Xavier Péchoultres · Laurent Rebière | semaine du 19/10/2026 | ● À traiter |
| Tester l'intégration de Studio : livraison, formulaires, prix | Arnaud Mazon | après intégration | ● En attente |
| Mettre à disposition l'historique et le rattachement des prompts pour test | Xavier Péchoultres | non fixée | ● À traiter |
| Faire produire par les agents les stories TVA et livraison (lots, régime par lot, table des taux) | Arnaud Mazon | non fixée | ● À traiter |
| Transférer le dépôt Magritoff dans une organisation GitHub et nommer Xavier administrateur | Arnaud Mazon | non fixée | ● À traiter |
| Créer app.magritapp.com et preprod.magritapp.com dans la zone DNS de Gandi | Arnaud Mazon | avant bascule de la préproduction | ● À traiter |
| Finaliser la préproduction sur le serveur privé virtuel et la pointer sur preprod.magritapp.com | Xavier Péchoultres | non fixée | ● À traiter |
| Transmettre les réflexions sur le déploiement pour l'architecte | Xavier Péchoultres | avant le 22/10/2026 | ● À traiter |
| Rédiger le mémo d'architecture pour l'architecte | Arnaud Mazon | avant le 22/10/2026 | ● À traiter |
| Initier les rendez-vous Bpifrance et conseil en levée de fonds | Arnaud Mazon | début novembre 2026 | ● En cours |

## **6.2 Actions internes**

> * Reporter dans le dépôt Magritoff le compte rendu et les orientations TVA et livraison, puis les passer à l'approbation.  
> * Compléter la question ouverte OQ-TVA-LIGNE avec la précision de la section 4.1 : régime par lot et non seulement taux ; le responsable fiscal ou comptable reste à nommer.  
> * Trancher le verrou transitoire « un seul pays de livraison par devis ».

# **7\. Lecture stratégique pour le pilotage**

## **Ce qui est acquis**

> * Une architecture clarifiée. Studio est intégré comme bibliothèque d'interface : Magrit n'a pas à recréer ses fonctions, seulement à recevoir correctement ses données.  
> * Une règle de livraison. Un point de livraison, un lot ; des lots indivisibles quand ils naissent d'un même calcul.  
> * Une préproduction en ligne. Commandes, boutiques et prix sont nettoyés, l'application tourne sur un serveur privé virtuel.

## 

## 

## **Points de vigilance**

> * Fiscalité. La règle « taux du pays de livraison » ne couvre que la vente à distance aux particuliers ; ventes entre entreprises européennes et export restent à qualifier avant tout développement.  
> * Disponibilité des partenaires. Une semaine a été perdue sur Studio ; la bêta avancée dépend de la disponibilité de Xavier et de Laurent la semaine du 19 octobre.  
> * Hébergement provisoire. La préproduction tourne sur un serveur d'Expert Solutions ; l'hébergement cible dépend des préconisations de l'architecte.

## **Décisions à prendre**

> * Adopter ou non le verrou transitoire d'un seul pays de livraison par devis.  
> * Désigner le responsable fiscal ou comptable.  
> * Choisir l'hébergement de production après les préconisations d'architecture.

## **Inscriptions dans les outils projet**

> * Dépôt Git : compte rendu, orientations TVA et livraison, mise à jour d'OQ-TVA-LIGNE, stories à produire par les agents.  
> * Coffre AGE : fiche de traçabilité de la réunion et pointeur dans l'état du sprint.

*Confidentiel — usage interne · Magrit IA · AGE Développement · Compte rendu du 14 octobre 2026*

[image1]: <data:image/png;base64,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>