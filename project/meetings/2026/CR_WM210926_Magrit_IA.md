![AGE Développement][image1]

MAGRIT IA  
AGE DÉVELOPPEMENT

Compte rendu de séance de travail — Weekly Magrit

Arnaud Mazon (AGE Développement) · Xavier Péchoultres (Expert Solutions)

*Lundi 21 septembre 2026*

| CONFIDENTIEL — USAGE INTERNE Diffusion : équipe projet Magrit — AGE Développement · Expert Solutions |
| :---- |

# **Sommaire**

---

Synthèse exécutive

1\. Cadre de la réunion

2\. Discipline Git et contrôle qualité

2.1 Fusions sur main sans revue

2.2 Règles de contribution et contrôle qualité automatisé

3\. Magrit Studio : état et alignement sur le POC

3.1 Constat sur la version Studio

3.2 Repartir des spécifications du POC

4\. Modèle fonctionnel du devis

4.1 Prix public, prix de production et contexte client

4.2 Sous-espaces et parcs machines multi-sites

4.3 Hiérarchie projet, devis, produit

4.4 Devis sans produit de catalogue

5\. Recherche, catalogue PIM et intégration Clariprint

5.1 Recherche unifiée ou recherche en deux volets

5.2 Alimentation du PIM par Clariprint

5.3 Verrouillage des champs produit

6\. Veille : UCP for Print

7\. Backlog : stories et consolidation

8\. Next steps

8.1 Engagements pris en séance

8.2 Actions internes

9\. Lecture stratégique pour le pilotage

# **Synthèse exécutive**

---

Séance de travail d'environ 1 h 45 consacrée à la bêta de Magrit : discipline de contribution sur le dépôt, écart entre Magrit Studio et le POC, modèle fonctionnel du devis, ergonomie de recherche et place du catalogue PIM, enfin consolidation du backlog. Les deux participants s'accordent sur la priorité : **l'intégration Clariprint–Magrit**, dont dépend la justesse des prix sur toute la chaîne.

**Trois conclusions opérationnelles à retenir**

* **Branche et revue obligatoires.** Tout développement passe par une branche et une demande de fusion, intégrée en fin de semaine sous la supervision de Xavier Péchoultres. La règle est inscrite dans les consignes que suivent les agents de développement.  
* **Le devis structure l'application.** Les produits vivent dans des devis brouillons rattachés à un client ; un projet regroupe plusieurs devis ; un devis envoyé ne se modifie plus, il se duplique sous un nouveau numéro.  
* **Un backlog propre, régénéré par agent.** Plutôt que de raccommoder les stories existantes, parfois contradictoires, un backlog consolidé (fonctionnalités, descriptions, cahiers de test) sera produit à partir de l'ensemble des artefacts.

Prochaine échéance : chaîne complète jusqu'au devis complet avec Clariprint visée d'ici la fin de la semaine du 21 septembre ; un client bêta à préparer sous une dizaine de jours.

# **1\. Cadre de la réunion**

---

| Élément | Détail |
| :---- | :---- |
| Parties | Arnaud Mazon (PDG, AGE Développement) · Xavier Péchoultres (Expert Solutions) |
| Date et durée | Lundi 21 septembre 2026, 15 h 10 – 16 h 55 environ |
| Format | Visioconférence Google Meet, avec partage d'écran (dépôt GitHub, Magrit Studio, back-office) |
| Objet | Weekly Magrit — Git, Magrit Studio, devis, recherche et PIM, backlog |
| Source | [Notes et transcription Gemini du 21/09/2026](https://docs.google.com/document/d/1agDq9v6bf0SfStgpqP3hlrksMs4ZTfFvr15A4YHRCWw/edit?tab=t.ab4z7nrcqlgw) |
| Rédacteur | Arnaud Mazon |
| Précédent | CR\_WM170926\_Magrit\_IA (17/09/2026) |

*Note de méthode : les citations sont rétablies en langue écrite, sans altération du propos, de sa portée ni de son auteur. Les constats portant sur le dépôt ont été vérifiés sur l'historique de la branche main le 21/09/2026.*

# **2\. Discipline Git et contrôle qualité**

## ---

**2.1 Fusions sur main sans revue**

Xavier Péchoultres signale qu'un volume important de contributions est arrivé sur la branche principale sans passer par une revue. Seul le lot d'intégration des fichiers Notion a suivi le circuit attendu : branche dédiée, demande de fusion, validation. Le reste a brouillé la lecture de main et lui a demandé du temps pour reconstituer ce qui avait été livré. Arnaud Mazon en prend la responsabilité : l'agent avait proposé de fusionner les demandes en attente pour clore le sprint 5, et il l'a laissé faire.

| Verbatim — Xavier Péchoultres *« Tout ce qui a été fait ce week-end est arrivé directement sur main, au lieu de passer par une branche propre que l'on intègre une fois tout calé. Ce n'est pas la bonne pratique. »* |
| :---- |

| Précision technique L'historique de main distingue deux épisodes. Du 11 au 16 septembre, 89 commits ont été poussés directement sur main. Depuis le 18 septembre, les contributions sont passées par des demandes de fusion (n° 14 à 21), mais celles-ci ont été fusionnées par le compte du porteur de projet, sans revue d'un tiers. Le défaut du week-end n'est donc pas l'absence de branche, c'est l'absence de relecture avant fusion — ce que la règle ci-dessous corrige. |
| :---- |

## **2.2 Règles de contribution et contrôle qualité automatisé**

La règle est actée : on travaille par branche, et c'est Xavier Péchoultres qui intègre en fin de semaine, au moment du point sur ce qui a été fait, afin que chaque ajout soit supervisé par quelqu'un qui maîtrise le code. Arnaud Mazon inscrit ces règles dans les consignes que suivent les agents, pour qu'elles s'appliquent sans rappel. Elles prolongent la fusion hebdomadaire des branches actée le 17 septembre.

| Verbatim — Arnaud Mazon *« Nous fonctionnons par branche, et c'est toi qui, en fin de semaine, lorsque nous faisons le point, intègres le travail pour qu'il soit supervisé par quelqu'un qui sait. Ces règles seront gravées dans le marbre des consignes que l'agent doit suivre. »* |
| :---- |

Xavier Péchoultres a par ailleurs renforcé les prérequis de qualité, notamment la documentation OpenAPI selon l'approche « API d'abord ». Ils vivent dans le dossier *quality* du dépôt, avec des scripts de vérification.

| Précision technique Le dépôt confirme le mécanisme : le dossier *quality* porte les règles et les grilles d'audit (API, architecture, fonctionnel, tests, UX), et le flux GitHub *quality-audit* s'exécute à chaque demande de fusion vers main. Ce flux est déclaré consultatif : il signale les dérives, il ne bloque pas la fusion. La revue humaine reste donc la barrière. |
| :---- |

# **3\. Magrit Studio : état et alignement sur le POC**

## ---

**3.1 Constat sur la version Studio**

Arnaud Mazon a examiné la version Magrit Studio, dont l'interface est servie par HopStudio. Le périmètre fonctionnel est loin d'être couvert : aucune persistance (un aller-retour par le tableau de bord efface la session), aucun historique, et une ergonomie dont aucune story ne décrit le comportement attendu. Xavier Péchoultres précise que cette version a été poussée rapidement en fin de semaine précédente pour montrer l'ergonomie à double écran, qu'elle n'est pas testée, et qu'une case à cocher permet de basculer entre l'ancienne et la nouvelle présentation.

## 

## **3.2 Repartir des spécifications du POC**

La question posée par Arnaud Mazon est celle de la méthode : comment faire converger Magrit Studio vers le POC, dont le backlog a déjà permis d'atteindre le niveau fonctionnel actuel. Xavier Péchoultres répond qu'il manque un travail de spécification des interactions — écran d'accueil sans client ni projet, choix du client, choix du projet — apparu avec les concepts de projet fusionnés en fin de semaine. La conclusion est posée : les évolutions de Magrit Studio repartent des spécifications de Magrit POC, complétées des décisions de la présente séance.

# **4\. Modèle fonctionnel du devis**

## ---

**4.1 Prix public, prix de production et contexte client**

Deux lectures se sont confrontées. Pour Arnaud Mazon, la recherche produit donne d'abord un prix public : Clariprint calcule un prix de production sur des paramètres machine standard, auquel s'applique la marge par défaut ; les remises et marges propres au client interviennent ensuite, dans le devis, via les règles de prix (par client, par groupe de clients, par gamme ou sur tout le catalogue). Pour Xavier Péchoultres, les tarifs dépendent du client, et le prix de production lui-même varie selon le site et le parc machines : le chiffrage doit donc connaître son contexte dès le départ.

Le point de convergence : un commercial au téléphone doit voir immédiatement le prix du client, sans manipulation. La connaissance préalable du client est donc la condition d'un affichage juste et rapide. Le meilleur tarif est proposé par défaut, avec la possibilité d'en afficher le détail ; chaque prix reste adossé à sa gamme de fabrication, document de traçabilité qui justifie le calcul face au client.

## **4.2 Sous-espaces et parcs machines multi-sites**

Pour les groupes d'imprimeurs multi-sites, Arnaud Mazon propose d'utiliser les sous-espaces : le commercial choisit l'entité ou le parc machines sur lequel il travaille. Xavier Péchoultres valide le principe d'une variable de session qui rappelle en permanence le sous-espace actif. Arnaud Mazon ouvre une piste complémentaire : que la solution propose d'elle-même la ou les meilleures solutions de production parmi toutes les capacités du groupe.

## **4.3 Hiérarchie projet, devis, produit**

La structure est arrêtée. Un produit n'existe pas seul : il est saisi dans un devis. Le devis est rattaché à un client ; il peut rester en brouillon, être rappelé pour recevoir d'autres produits, puis être finalisé. Un projet est un agrégat de devis, et un devis peut exister hors projet. Seuls les devis ouverts peuvent être rappelés ; un devis au statut « envoyé » ne se modifie plus et se duplique sous un nouveau numéro.

Côté ergonomie, Magrit Home devra permettre de choisir le client (recherche avec saisie semi-automatique, jamais une liste déroulante de cinquante entrées), de choisir ou créer le projet, puis de basculer directement dans l'écran du devis.

## **4.4 Devis sans produit de catalogue**

Xavier Péchoultres rappelle le cas courant de la demande atypique, qu'aucun calcul ni aucun article ne couvre. Arnaud Mazon montre qu'on peut déjà ajouter une ligne libre à un devis ; la démonstration fait apparaître une friction, la création d'un client exigeant un identifiant d'entreprise. La capacité de créer un devis à partir de rien est confirmée comme indispensable.

| Verbatim — Xavier Péchoultres *« Il y aura toujours une demande que l'on ne sait pas calculer. Il faut toujours gérer le cas où l'on part de rien : nouveau devis, et j'ajoute une ligne. »* |
| :---- |

# **5\. Recherche, catalogue PIM et intégration Clariprint**

## ---

**5.1 Recherche unifiée ou recherche en deux volets**

Xavier Péchoultres présente une maquette inspirée de la page de résultats de Google : un volet de réponse par l'assistant et un volet catalogue (PIM), côte à côte. Arnaud Mazon la juge trop encombrante et défend le concept de recherche unifiée déjà promis aux clients, y compris pour la boutique : l'origine du produit, catalogue ou calcul, est une métadonnée de la carte produit, signalée par un indicateur. **Le désaccord demeure** ; les deux participants conviennent d'étudier une unification qui valorise l'enrichissement progressif du catalogue.

| Verbatim — Arnaud Mazon *« Catalogue ou calcul, cela relève d'une métadonnée de la carte produit. En tant qu'utilisateur, peu m'importe d'où vient le prix, du moment qu'il arrive vite. »* |
| :---- |

| Verbatim — Xavier Péchoultres *« Le grand avantage du catalogue, c'est une réponse beaucoup plus rapide : on peut déjà afficher quelque chose à l'écran en attendant l'assistant. »* |
| :---- |

## **5.2 Alimentation du PIM par Clariprint**

Xavier Péchoultres identifie deux chantiers d'intégration majeurs : l'alimentation du PIM à partir de Clariprint, indispensable pour obtenir des prix justes sur toute la chaîne et dans la boutique, et la génération des prix. Il souligne l'écart entre une maquette et la production de prix réalistes, qui suppose des données métier validées (papiers, vernis, quantités). Arnaud Mazon voit le PIM comme un stockage réutilisable, alimenté par Clariprint en données techniques et en prix ; Xavier Péchoultres rappelle qu'un produit du PIM n'est jamais tout à fait statique, puisqu'un changement de quantité impose un recalcul. Le fond est partagé : **l'intégration Clariprint–Magrit est la priorité**.

| Verbatim — Xavier Péchoultres *« Entre une maquette et la capacité de sortir un prix derrière, l'écart n'est pas nul. »* |
| :---- |

Une démonstration du back-office montre que le catalogue d'une boutique est alimenté en appelant le PIM et en sélectionnant des familles de produits ; le PIM est multi-locataire. Xavier Péchoultres relève une anomalie : les produits du PIM sont servis par une façade historique absente des vues actuelles.

## **5.3 Verrouillage des champs produit**

Xavier Péchoultres demande de pouvoir figer certaines propriétés d'un produit, pour les imprimeurs qui ouvriront des boutiques à leurs clients (par exemple des cartes de visite commandées par des filiales). Arnaud Mazon propose une voie plus simple : un produit reste « au catalogue » tant qu'on n'y touche pas ; toute modification lui retire ce statut et déclenche un recalcul par Clariprint ; le verrouillage se règle au niveau de la boutique, pas champ par champ dans le PIM. Xavier Péchoultres préférerait porter le verrouillage par le produit, pour qu'il reste une unité technique complète, mais admet de commencer par faire du PIM une véritable entité de base. **L'arbitrage est reporté.**

# 

# 

# **6\. Veille : UCP for Print**

---

Xavier Péchoultres rapporte une information transmise par un partenaire (« Alta » dans la transcription, vraisemblablement Altavia — ⚠️ à confirmer) : une initiative de normalisation du commerce de produits imprimés adossée au protocole de commerce de Google, désignée « UCP Print ». Selon lui, si elle aboutit, le référencement par fiche produit perdra de son importance. Les spécifications restent sommaires ; les deux participants lanceront chacun une analyse.

| Précision technique L'initiative existe et porte le nom UCP for Print. Elle vise à adapter au secteur de l'impression l'*Universal Commerce Protocol* de Google, conçu pour le commerce conduit par des agents d'IA. Elle est portée par l'Initiative Online Print, le BVDM et Intergraf ; PRINTING United Alliance et le Ghent Workgroup l'ont rejointe en juillet 2026\. La participation de CIP4, évoquée en séance, reste à vérifier. |
| :---- |

# **7\. Backlog : stories et consolidation**

---

La demande de fusion consacrée aux stories Notion a été fusionnée en séance : elle réinjecte le contenu fonctionnel (récit utilisateur, critères d'acceptation, contraintes techniques) dans les artefacts d'implémentation du dépôt. Xavier Péchoultres relève la limite de l'exercice : des stories récentes complètent ou contredisent des stories déjà développées, si bien qu'un test adossé à une story ancienne peut échouer à tort.

| Précision technique Arnaud Mazon a annoncé 380 stories ajoutées. Selon le dépôt, la demande de fusion n° 12, fusionnée le 21 septembre à 16 h 44, crée 180 fichiers et en modifie 349 dans le dossier des artefacts d'implémentation. |
| :---- |

Arnaud Mazon propose de produire, à partir de tout l'existant, un backlog propre et consolidé — fonctionnalités, descriptions, cahiers de test — par un prompt détaillé confié à des agents (méthode BMAD), au point qu'un agent puisse redévelopper l'application de zéro. Xavier Péchoultres valide : l'opération permettrait aussi d'éliminer un encombrement d'architecture ancien, comme les serveurs obligatoires qui multiplient les conteneurs Docker. Il estime le coût à quelques centaines d'euros de jetons, et suggère qu'un agent refasse cette consolidation à intervalles réguliers. Arnaud Mazon prend l'itération en charge ; Xavier Péchoultres reste sur les développements immédiats.

# **8\. Next steps**

## ---

**8.1 Engagements pris en séance**

| Action | Responsable | Échéance | Statut |
| :---- | :---- | :---- | :---- |
| Inscrire les règles branche \+ demande de fusion \+ revue dans les consignes des agents | Arnaud Mazon | Non fixée |  À traiter  |
| Vérifier que les agents appliquent les règles du dossier *quality* | Arnaud Mazon | Non fixée |  À traiter  |
| Chaîne complète jusqu'au devis complet avec Clariprint | Xavier Péchoultres | Fin de semaine du 21/09 |  En cours  |
| Créer des produits depuis le chat, les verser au PIM, paramétrer les champs modifiables | Le groupe | Non fixée |  À traiter  |
| Magrit Home : choix du client et du projet, bascule vers le devis | Arnaud Mazon | Non fixée |  À traiter  |
| Explorer et tester le back-office | Arnaud Mazon | Non fixée |  À traiter  |
| Rechercher et analyser UCP for Print | Xavier Péchoultres · Arnaud Mazon | Non fixée |  À traiter  |
| Transmettre le CR pour génération des stories | Xavier Péchoultres | Après diffusion du CR |  En attente  |
| Documenter les pratiques de gestion et de synthèse de backlogs | Xavier Péchoultres | Non fixée |  À traiter  |
| Itérer sur le backlog consolidé par agents | Arnaud Mazon | Non fixée |  À traiter  |
| Préparer un client bêta | Arnaud Mazon | Sous une dizaine de jours |  En cours  |

## **8.2 Actions internes**

* Diffuser le présent compte rendu à l'équipe projet.  
* Mettre à jour la fiche projet Magrit et les décisions du vault (règles de contribution, structure du devis).  
* Retirer de la liste des préalables la fusion de la branche *docs/stories-perimetre-fonctionnel-notion*, faite en séance.

# **9\. Lecture stratégique pour le pilotage**

* ---

  **Ce qui est acquis.** Circuit de contribution par branche et revue ; structure client, projet, devis, produit ; priorité à l'intégration Clariprint ; principe d'un backlog régénéré par agents.  
* **Points de vigilance.** Le flux qualité est consultatif : sans revue humaine, rien n'arrête une fusion. Magrit Studio n'est ni persistant ni spécifié, alors qu'un client bêta est visé sous dix jours. Des stories contradictoires faussent les tests tant que le backlog n'est pas consolidé.  
* **Décisions à prendre.** Recherche unifiée ou en deux volets ; niveau du verrouillage des champs (boutique ou produit) ; moment où le commercial choisit son parc machines (session ou devis).  
* **Inscriptions dans les outils projet.** Règles de contribution dans les consignes des agents et *docs/CONVENTION\_GIT.md* ; stories issues du CR ; fiche projet Magrit et décisions du vault.

*Confidentiel — usage interne AGE Développement & Expert Solutions*

[image1]: <data:image/png;base64,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>