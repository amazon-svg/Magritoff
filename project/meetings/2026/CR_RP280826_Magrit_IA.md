![]()

MAGRIT IA

AGE DÉVELOPPEMENT

Compte rendu de session de travail

Spécification des fonctions de gestion commerciale

Arnaud Mazon (AGE Développement) × Xavier Péchoultres (Expert Solutions — Clariprint)

*Réunion du 28 août 2026*

| CONFIDENTIEL — USAGE INTERNE Diffusion restreinte · Équipe projet Magrit IA · AGE Développement · Expert Solutions |
| :---- |

# **Synthèse exécutive**

La session du 28 août 2026 a été consacrée à la spécification du socle de gestion commerciale de Magrit : projets, clients, devis, règles de prix, commandes, production et exports. Elle acte un changement de modèle — la logique e-commerce du panier est abandonnée sur les surfaces internes au profit d'une gestion par dossiers de projets — et referme la principale lacune structurelle de l'application : l'absence d'entité Client. Quatorze décisions ont été prises en séance, toutes traduites en stories de backlog.

Trois conclusions opérationnelles à retenir :

> * **Le projet remplace le panier.** Un commercial gère plusieurs affaires en parallèle : le chiffrage se range désormais dans un projet nommé, tagué et obligatoirement rattaché à un client, d'où le devis est émis par sélection de produits.  
> * **Le prix se construit dans Magrit, pas dans Clariprint.** Clariprint fournit le coût de production ; Magrit applique les marges et les remises, ligne par ligne, avec traçabilité d'audit complète et séparation stricte des droits Admin et Commercial.  
> * **Les règles de prix concurrentes se résolvent par découpage temporel automatique.** L'arbitrage « la plus avantageuse pour le client » et les niveaux de priorité ont été écartés : à la création d'une règle en conflit, le système alerte, puis borne, insère et duplique.

Le backlog produit et le cahier de tests fonctionnels ont été alimentés dans la foulée de la séance : un epic dédié, dix-huit stories au formalisme BMAD et vingt-huit cas de test rattachés.

# **1\. Cadre de la réunion**

| Élément | Détail |
| :---- | :---- |
| Participants | Arnaud Mazon (PDG, AGE Développement — porteur du projet Magrit IA) Xavier Péchoultres (Expert Solutions — moteur Clariprint) |
| Date et durée | Vendredi 28 août 2026 — 11h06 CEST · environ 1h40 |
| Format | Visioconférence Google Meet · Démonstration écran partagé · Transcription Gemini |
| Objet | Spécification fonctionnelle du bloc gestion commerciale : parcours commercial, projets, clients, devis, tarification, commandes, production, fichiers et exports |
| Rédacteur | Arnaud Mazon — AGE Développement |

# **2\. Du panier au projet — refondation du modèle de travail**

La séance s'est ouverte sur un constat d'usage : Magrit sert deux populations distinctes, les acheteurs et les commerciaux, et l'interface actuelle ne parle qu'aux premiers. Xavier Péchoultres a pointé le bouton « Ajouter au panier » comme la marque d'une logique e-commerce inadaptée à des professionnels qui conduisent plusieurs affaires simultanément. Arnaud Mazon a acté le remplacement : la surface de travail interne devient un dossier de projet, capable de regrouper plusieurs chiffrages et de les reprendre en itération.

## **2.1 Projet, client et tags**

Trois décisions structurent le module. Le projet est le conteneur des chiffrages ; il est **obligatoirement rattaché à un client**, ce qui conditionne la résolution du profil tarifaire et donc l'exactitude des prix présentés. Le classement se fait par **tags libres et colorés**, créés à la volée, combinés à un champ de recherche et à un filtre — l'arborescence de dossiers a été écartée comme trop rigide. Enfin, la création de devis s'amorce depuis l'en-tête du projet, par sélection d'un ou plusieurs produits.

## **2.2 Traduction au backlog**

Stories **E10.1** (espace Projets), **E10.2** (tags, recherche et filtrage) et **E10.3** (création de devis multi-produits depuis un projet). Le panier reste en vigueur côté boutique publique : le remplacement ne concerne que les surfaces internes.

# **3\. Client et interlocuteurs — la lacune structurelle**

Arnaud Mazon a relevé en séance l'absence de définition du client dans l'application : une adresse email y tient aujourd'hui lieu d'entité d'entreprise, et aucun lien ne relie les utilisateurs à la notion de client. La décision est prise de créer une **entité Client distincte**, personne morale (avec SIRET) ou personne physique, à laquelle se rattachent des interlocuteurs.  
Xavier Péchoultres a mis en garde contre la fusion des comptes de la boutique et des comptes internes Magrit. Les utilisateurs Magrit sont le personnel interne — commerciaux et administrateurs ; les clients finaux n'accèdent qu'à la boutique ou aux devis établis pour eux, jamais à la page d'accueil Magrit. La séance a explicitement décidé de traiter les concepts séquentiellement : la gestion commerciale d'abord, les droits d'accès des clients boutique ensuite.

| Verbatim — Xavier Péchoultres *« Il faut d'abord définir complètement le processus commercial de base — les devis, les tarifs, les remises, la base clients, la transformation des devis en commandes — et ensuite seulement aborder les fonctionnalités de la boutique et les connexions de données. »* |
| :---- |

Stories **E10.4** (entité Client et interlocuteurs) et **E10.5** (dissociation des comptes Magrit et des comptes clients boutique).

# **4\. Construction du prix — marges, règles datées et remises**

## **4.1 Origine du prix et chaîne de calcul**

Xavier Péchoultres a rappelé que les prix remontés par Clariprint peuvent être soit des prix de vente saisis par les imprimeurs, soit des coûts de production purs. La pratique retenue, jugée la plus professionnelle par les deux parties, consiste à partir du **coût de production** et à lui appliquer les marges administrées dans Magrit. La chaîne est arrêtée ainsi : coût de production, puis marge générale ou de gamme pour obtenir le prix public, puis règle client pour obtenir le prix client.

## **4.2 Règles de prix et résolution des conflits**

Une règle de prix porte une portée — globale, gamme, client, ou client et gamme — une valeur et une période de validité, ce qui autorise les opérations promotionnelles à durée limitée. L'exemple travaillé en séance est une marge minimale de 50 % sur la gamme carterie. Point tranché avec précision : une règle client qui surcharge une règle générale **n'est pas un conflit**, c'est une hiérarchie de spécificité. Le conflit se limite à deux règles de même portée et même cible dont les périodes se chevauchent.  
Face à ce cas, l'arbitrage automatique « on prend la plus avantageuse pour le client » et les niveaux de priorité ont été écartés, jugés trop permissifs et générateurs de règles de gestion arbitraires. Le mécanisme retenu est le découpage temporel, avec alerte et confirmation explicite de l'utilisateur.

| Verbatim — Xavier Péchoultres *« Tu as une règle générale, tu veux faire une règle de remise spéciale, et tu te retrouves à devoir découper. Ça peut se faire automatiquement : une fois que le mec a validé, on arrête la règle précédente, on lui met une date de fin, on met celle-là, et après on duplique celle qu'il y avait avant. »* |
| :---- |

## **4.3 Remises par ligne, traçabilité et droits**

Le calcul est granulaire, au niveau de chaque ligne de devis — la séance a pris l'exemple d'une remise distincte sur l'impression et sur la structure. Le commercial agit indifféremment sur le prix de vente ou sur le taux de marge, les deux étant affichés ; la remise, positive ou négative, en est déduite. La base enregistre le prix de production, le prix public, le prix client, la marge appliquée et l'écart à la marge initiale.

| Verbatim — Xavier Péchoultres *« Il faut qu'on ait la traçabilité totale de tout ça en audit, que l'administrateur puisse auditer ce qui a été fait dans les devis. Il ne faut pas que le commercial puisse dire "non, j'ai vendu tel prix, c'est ce qui était affiché". »* |
| :---- |

L'affichage des remises sur le document remis au client devient une option du devis, notamment pour les remises négatives — le masquage est cosmétique, les données et l'audit restent complets côté administrateur. Les droits sont scindés en deux niveaux : l'administration détient la stratégie tarifaire, le commercial exécute dans le cadre hérité.  
Stories **E10.6** (référentiel des règles de prix), **E10.7** (détection des conflits et découpage automatique), **E10.8** (moteur de calcul), **E10.9** (remises par ligne et audit), **E10.10** (affichage optionnel des remises) et **E10.11** (droits Admin et Commercial).

# **5\. Du devis à la commande**

Xavier Péchoultres a écarté le changement de statut par liste déroulante au profit d'un **bouton de validation explicite**, en style primaire, qui transforme le devis en commande et l'alimente dans le tableau de bord — le motif étant l'ergonomie et la prévention des modifications accidentelles après validation. Corollaire acté : une commande entrée dans le système, qu'elle vienne de la boutique ou d'un devis converti, est réputée validée. Il n'y a pas de seconde validation.  
Story **E10.12**. La story **E4.2** (transformation devis vers commande côté mini-shop) recoupe ce périmètre : la fusion des deux est à arbitrer avant développement.

# **6\. Production, statuts et notifications**

## **6.1 Étapes de production**

Un jeu standard d'étapes est arrêté, personnalisable et ordonnançable : Fichier reçu, PAO, Fichier validé, En cours de production, En cours d'expédition, Livré. L'administrateur peut créer ses propres étapes et en définir l'ordre. Point tranché explicitement : passer une commande à une étape avancée ne valide **pas** automatiquement les étapes antérieures, car toutes les commandes ne passent pas par toutes les étapes.

## **6.2 Interface de changement de statut**

Le changement de statut en édition directe dans la grille des commandes a été écarté. La solution retenue est une fenêtre modale dédiée, déclenchée par un bouton « Statut » ou un menu d'action, strictement identique depuis la liste et depuis la fiche commande. Un historique horodaté de chaque transition est posé comme indispensable.

| Verbatim — Xavier Péchoultres *« On ne change pas les statuts dans une grosse interface avec plein de lignes. Le risque d'erreur est trop gros. Tu fais changer le statut, tu as une fenêtre dédiée à ça, le mec change le statut, il valide. »* |
| :---- |

## **6.3 Notifications**

Les transitions d'étapes déclenchent des notifications. La décision porte sur la création d'un **objet de notification déclinable par canal** : email et SMS pour la V1, architecture ouverte pour Slack, WhatsApp ou d'autres canaux ensuite. Le SMS est retenu avant WhatsApp — plus rapide et plus simple à mettre en place, WhatsApp imposant une validation Business à l'entreprise.  
Stories **E10.13** (étapes de production), **E10.14** (modale de statut et historique) et **E10.15** (objet Notification multicanal).

# **7\. Fichiers de production et exports comptables**

## **7.1 Lien unique de dépôt**

Le transit des fichiers de production est traité par une **URL unique par commande**, transmissible au client et à son graphiste sans création de compte. Le lien porte une date de péremption paramétrable — dix jours ou un mois ont été évoqués — et est invalidé dès que le statut de la commande change ou que les fichiers sont reçus, pour éviter qu'un ancien courriel ne serve à déposer des fichiers au mauvais endroit.  
Un arbitrage de simplification a été posé pour la V1 : on s'en tient à un statut « fichier reçu » et à un lien vers l'emplacement de dépôt.

| Verbatim — Arnaud Mazon *« On conserve un lien vers l'endroit où les fichiers ont été déposés. Mais à ce stade, on n'imagine pas que depuis l'interface Magrit on est un gestionnaire de fichiers de production. »* |
| :---- |

## **7.2 Écran de commande et exports**

L'écran de commande actuel a été qualifié de rustique : la séance acte une fiche complète portant le client, les dates, les articles, les détails techniques, les informations commerciales et la gamme de fabrication récupérée de Clariprint. L'export des commandes est arrêté au format Excel (XLSX) comme standard, avec une variante CSV.

| Verbatim — Xavier Péchoultres *« Les services comptables sont fermés aux connexions directes par API. Ils s'appuient sur des fichiers XLSX ou CSV — c'est ce qui leur évite la ressaisie. »* |
| :---- |

Stories **E10.16** (écran de détail commande), **E10.17** (lien de dépôt de fichiers) et **E10.18** (export XLSX et CSV).

# **8\. Méthode de développement retenue**

Xavier Péchoultres a posé une règle de séquencement qui vaut pour tout le sprint : les interactions avec les clients doivent d'abord fonctionner **sans exiger que le client se connecte à la plateforme**. On décrit chaque processus de bout en bout sans interférence prématurée entre eux. Concrètement : processus commercial interne d'abord — devis, tarifs, remises, base clients, transformation en commandes — puis fonctionnalités de la boutique et connexions de données.  
Cette règle a une conséquence directe sur le backlog : les stories relatives aux droits d'accès des utilisateurs de la boutique ne sont pas traitées dans ce sprint, à l'exception de l'étanchéité entre les deux populations, qui est un prérequis de sécurité.

# **9\. Next steps**

## **9.1 Engagements pris en séance**

| Action | Responsable | Échéance | Statut |
| :---- | :---- | :---- | :---- |
| Actualiser le backlog Magrit avec les stories issues de la séance | Arnaud Mazon | 28/08/2026 | ● Acté |
| Créer une feuille de route dédiée au sprint gestion commerciale | Arnaud Mazon | S+1 | ● En cours |
| Partager les liens du backlog et de la feuille de route | Arnaud Mazon | S+1 | ● En attente |
| Développer le module Projets (création, client obligatoire, tags) | Équipe dev | Sprint 5 | ● À traiter |
| Développer le module Clients et les interlocuteurs | Équipe dev | Sprint 5 | ● À traiter |
| Poser la règle de marge publique par gamme et le verrou anti-concurrence | Équipe dev | Sprint 5 | ● À traiter |
| Développer le découpage automatique des règles en conflit de dates | Équipe dev | Sprint 5 | ● À traiter |
| Intégrer le bouton de validation devis vers commande | Équipe dev | Sprint 5 | ● À traiter |
| Configurer le workflow d'étapes de production et le schéma standard | Équipe dev | Sprint 5 | ● À traiter |

## **9.2 Actions internes Magrit / AGE Dvt.**

> * **Backlog alimenté.** Epic « E10 — Gestion commerciale » créé, dix-huit stories E10.1 à E10.18 rédigées au formalisme BMAD, rattachées au sprint « Sprint 5 — Gestion commerciale » et à la source « RP 28/08/2026 ».  
> * **Cahier de tests enrichi.** Vingt-huit cas de test créés sur les parcours P13 et P12, avec préconditions, étapes, résultat attendu et sélecteurs *data-testid* conformes à la spécification d'instrumentation du 06/05/2026.  
> * **Arbitrage E4.2 à rendre.** La transformation devis vers commande existe déjà au backlog côté mini-shop : décider de la fusion avec E10.12 avant d'ouvrir le développement.  
> * **Point RGPD à trancher.** La durée de rétention des journaux de notification, qui portent des données personnelles de contact, doit être arbitrée avant mise en production de E10.15.  
> * **Fournisseur SMS à sélectionner.** Aucun fournisseur n'est retenu à ce stade ; l'adaptateur est spécifié, le choix reste ouvert.

# **10\. Lecture stratégique pour le pilotage**

### **10.1 Ce qui est acquis**

> * **Un modèle de données commercial complet.** Client, projet, devis, ligne de devis, règle de prix, commande, étape de production, notification : la séance a produit un schéma cohérent, ce que les itérations précédentes n'avaient pas.  
> * **La frontière Clariprint / Magrit est nette.** Clariprint fournit le coût de production et les données techniques ; tout le reste du calcul commercial se passe dans Magrit. C'est un point de gouvernance autant qu'un point technique, au regard de la convention de licence.  
> * **Un mécanisme de tarification défendable.** Le découpage temporel automatique règle un problème que la plupart des outils du marché traitent par une règle d'arbitrage opaque. C'est un argument commercial à conserver.  
> * **Une exigence d'audit posée par le partenaire.** La traçabilité complète des remises n'est pas une commodité technique : c'est ce qui rend l'outil acceptable par une direction commerciale.

### **10.2 Points de vigilance**

> * **Le volume du sprint.** Dix-huit stories dont neuf en P0, avec un chaînage fort de dépendances qui part de l'entité Client. Un séquencement erroné bloque tout le reste — E10.4 doit être livrée en premier.  
> * **L'audit et l'historique doivent être irréversibles.** Tables en append-only, privilèges retirés en écriture. Un audit modifiable ne vaut rien, et c'est précisément l'exigence formulée par Xavier Péchoultres.  
> * **Les contrôles serveur ne sont pas négociables.** Seuils de remise, numérotation, calcul des totaux, contrôle d'extension à l'upload : tout contrôle posé uniquement côté React se contourne par appel direct à l'API.  
> * **Le lien de dépôt de fichiers est une surface publique.** Jeton haché en base, page publique sans donnée tarifaire, message générique à l'expiration. C'est le seul point du sprint exposé hors authentification.  
> * **Le périmètre boutique reste ouvert.** La méthode retenue le repousse volontairement, mais la dette de spécification demeure : droits des utilisateurs boutique, parcours de commande client, articulation avec le storefront.

### **10.3 Décisions à prendre**

> * Fusionner ou non E4.2 avec E10.12 — deux stories décrivent aujourd'hui la même transformation devis vers commande.  
> * Fixer la cible de version : les stories sont posées sur B6, à confirmer au regard de l'itération en cours sur la gestion des utilisateurs.  
> * Arrêter le seuil de remise par défaut laissé au commercial, et décider s'il est bloquant ou simplement alertant.  
> * Trancher la durée de rétention des journaux de notification et la politique de conservation des fichiers de production déposés.  
> * Décider du fournisseur SMS et de son mode de facturation avant l'ouverture de E10.15.

### **10.4 Inscriptions dans les outils projet**

> * **Backlog Magrit — Sprint Board.** Epic « E10 — Gestion commerciale », sprint « Sprint 5 — Gestion commerciale », source « RP 28/08/2026 » créés ; stories E10.1 à E10.18 déposées avec corps de page au formalisme BMAD.  
> * **Cahiers de tests fonctionnels Magrit.** Bloc fonctionnel « Gestion commerciale » créé ; vingt-huit cas rattachés aux parcours P13 et P12, cible B6, statut À jouer.  
> * **Feuille de route.** À créer et à partager avec Xavier Péchoultres, en reprenant l'ordre de dépendance des stories.

*Document confidentiel — AGE Développement · Diffusion restreinte à l'équipe projet Magrit IA*