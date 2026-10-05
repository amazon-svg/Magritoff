![AGE Développement][image1]

MAGRIT IA

AGE DÉVELOPPEMENT

Compte rendu de session de travail

WM\#290726 — Expert Solutions × AGE Développement

*Réunion du 29 juillet 2026*

| CONFIDENTIEL — USAGE INTERNE *Diffusion restreinte · AGE Développement · Expert Solutions / Clariprint* |
| :---- |

# **Synthèse exécutive**

---

La session du 29 juillet 2026 — la première depuis fin juin — a croisé l'avancement des deux chantiers, le socle de génération d'applications côté Expert Solutions et le POC applicatif côté AGE, puis cadré la documentation produit. Elle s'est soldée par l'arrêt d'une méthode documentaire commune, la validation collective du corpus fonctionnel de Magrit, et l'ouverture d'un axe transverse d'outillage autour de la mémoire partagée entre agents.

Trois conclusions opérationnelles à retenir :

* **Méthode documentaire arrêtée.** Un **PRD unique et vivant** par projet — Bootstrap PRD puis PRD units successifs — remplace la logique de documents séparés. Laurent Rebière transmet son contrat de PRD ; le premier livrable ciblé est un PRD limité au périmètre bêta.  
* **Corpus fonctionnel validé.** Assistant Magrit et production de devis, boutiques en ligne, parcs machines, appels d'offres et back-office tenant sont actés comme le socle de la solution, avec accord explicite de Laurent Rebière et de Xavier Péchoultres.  
* **Fenêtre bêta posée mais non sécurisée.** Cible fin septembre / début octobre, point de clarté fin août, reprise de la prospection à la même échéance — avec une dépendance directe à la signature Altavia du 15 septembre et à la mobilisation d'Expert Solutions à partir de fin octobre.

La prochaine session est calée à la semaine suivante, même jour et même heure, avec l'analyse du dépôt Magrit par l'agent de Laurent Rebière comme livrable attendu.

# **1\. Cadre de la réunion**

---

| Élément | Détail |
| :---- | :---- |
| Côté Expert Solutions | Laurent Rebière (Expert Solutions / Clariprint — socle HC Platform) Xavier Péchoultres (Expert Solutions — moteur de calcul, contrat Altavia) |
| Côté Magrit IA | Arnaud Mazon (PDG, AGE Développement — porteur du projet Magrit IA) |
| Date et durée | Mercredi 29 juillet 2026 — 1 h 26 |
| Format | Visioconférence Google Meet · Transcription Gemini AI |
| Objet | Avancement HC Platform et chaîne de génération automatisée · Démonstration du POC Magrit · Cadrage de la documentation produit (PRD) · Alignement sur le corpus fonctionnel · Calendrier bêta et articulation avec le contrat Altavia · Mémoire partagée entre agents |
| Rédacteur | Arnaud Mazon — CR produit le 3 août 2026 |

# 

# **2\. Avancement du socle — HC Platform**

---

Laurent Rebière a consacré la période de congés et la semaine précédant la session à **HC Platform**, l'environnement de génération automatique d'applications à partir de PRD, avec un objectif de bouclage fin juillet — « pas très loin du compte » à la date de la session. L'enjeu qu'il pose n'est pas de produire une application de plus, mais d'**industrialiser le passage en production**, documentation et tutoriels compris.

## **2.1 Éclatement en dépôts spécialisés**

Le dépôt Magrit Core initial a été décomposé en trois dépôts aux responsabilités distinctes, dans une logique multi-repos assumée contre le mono-repo.

| Dépôt | Rôle |
| :---- | :---- |
| **runtime** | Partie serveur qui exécute les packages générés |
| **builder** | Création des packages |
| **factory** | Environnement de développement : création des applications, preview en dev et en prod, publication sur les serveurs de production |

## **2.2 Cockpit UX web — sortie du pilotage en ligne de commande**

Les deux derniers jours ont porté sur l'ergonomie du factory. Un serveur local expose désormais une interface web de gestion de projet : navigation dans les projets, ajout d'un projet, création d'un **PRD unit**, déclenchement du pipeline de traitement, lecture des résultats et preview des environnements. La référence ergonomique citée est celle de Lovable ou Base44 — à ceci près que l'itération n'y est pas conversationnelle mais portée par les PRD, selon la nomenclature héritée de BMAD.

| Verbatim — Laurent Rebière *« Je travaille sur ce cockpit-là pour que ce soit plus rapide et plus efficace que d'utiliser systématiquement les scripts CLI en ligne de commande. »* |
| :---- |

## **2.3 Chaîne automatisée — du PRD à la production**

Le pipeline enchaîne la génération documentaire depuis le PRD, l'assemblage en multi-repos — un dépôt par package, imbriqués au niveau de la suite — puis les **tests end-to-end Playwright** joués réellement dans le navigateur. Ces tests produisent un rapport qualitatif sur l'UX et des propositions d'amélioration réinjectées dans une boucle d'optimisation. Les scénarios générés depuis le PRD alimentent la documentation utilisateur et les tutoriels, et une évaluation qualitative automatique compare le rendu produit à son input, le PRD.

Un **rebuild complet from scratch** du projet de test a été rejoué depuis le PRD initial pour éprouver toute la chaîne. La nouvelle version embarque **une quarantaine de tests E2E avec preuves vidéo**, non encore rejoués manuellement.

## **2.4 Mini CRM — un banc d'essai, pas une cible fonctionnelle**

La « mini CRM suite » sert exclusivement à éprouver le framework et la génération automatique. Son PRD a été produit sans intervention et son périmètre reste générique : comptes, opportunités, pipeline à statuts, activités, notes, next action. Arnaud Mazon acte qu'il faudra réinvestir le backlog et le fonctionnel ; Laurent Rebière confirme et propose de repartir d'un PRD adapté.

| Verbatim — Arnaud Mazon (recadrage du besoin) *« C'est moins d'un CRM qu'on a besoin que d'une gestion commerciale qui permette de gérer des devis, des commandes, des relances. »* |
| :---- |

# 

# 

# **3\. Magrit — démonstration et périmètre fonctionnel**

## ---

**3.1 PIM auto-alimenté et boutiques**

Le PIM a été structuré puis **nourri automatiquement à partir de l'arborescence produit d'un site print**. L'agent a, de sa propre initiative, réécrit l'intégralité des contenus pour qu'on ne puisse pas en soupçonner la source. Un lot de visuels produits a été généré dans la foulée. Côté boutique, il est désormais possible de **basculer par défaut tout ou partie des gammes du PIM** à la création : une boutique créée ex nihilo n'est plus vide. Le catalogue expose un **search prompt** — si le produit est en base, il est proposé avec son taux de complétion ; sinon la demande part vers Magrit pour prompt, calcul et réponse — complété de menus de filtrage.

## **3.2 Édition de devis et gestion commerciale**

Le parcours commercial est complet : recherche de produits via l'assistant, variation des quantités et formats avec recalcul, puis **mise en bibliothèque** — les produits d'une bibliothèque rattachée à une boutique s'y retrouvent automatiquement — **ou mise au panier**. L'outil d'édition de devis gère les marges, le prix de vente, le gabarit de devis, le client destinataire et les statuts. Deux chemins coexistent : le devis simple depuis le panier, ou la bascule dans la gestion commerciale pour les cas multi-produits. Le devis est ensuite imprimé, communiqué au client, ou mis à sa disposition dans son store pour qu'il y passe commande.

## **3.3 Back-office tenant, sous-espaces et workflow**

Le tableau de bord constitue l'outil d'administration du propriétaire de tenant : utilisateurs et **droits par boutique**, historiques, listes de devis et de commandes avec tri et reprise, gabarits de devis, gestion des boutiques et des bibliothèques. Les **sous-espaces** permettent à un imprimeur de doter chaque filiale de son propre environnement, y compris sa propre Home Magrit — les boutiques s'adressant aux clients, les sous-espaces aux filiales. Un circuit de validation de commande avec rôles et fonctions assignées a été intégré, ainsi que la logique de démarrage de production destinée à transmettre à un système tiers les informations et gabarits de la commande. Arnaud Mazon signale un travail de ménage à mener sur les écrans d'administration.

## **3.4 Corpus fonctionnel de base — validé en séance**

| Module | Périmètre |
| :---- | :---- |
| **Magrit — assistant & devis** | Prompt, résultats en cards produit, variation quantité / format / objet avec recalcul, mise au panier ou en bibliothèque, production du devis |
| **Boutiques en ligne** | Catalogue, search prompt, menus de filtrage, comptes clients, commandes |
| **Parcs machines** | Saisie des parcs et détermination des prix en fonction des parcs concernés |
| **Appels d'offres** | Traitement des AO reçus et émis |
| **Back-office tenant** | Utilisateurs, droits, BU et sous-espaces, devis, commandes, gabarits, boutiques |
| *Connecteurs ERP / API* | *Hors périmètre « fonctionnalité utilisateur »* |

Deux précisions actées. Le **PIM n'est pas un module** en tant que tel mais une façon de structurer la data produit pour en faciliter l'usage, en particulier côté boutiques — un renommage en « bibliothèque de produits » est envisagé, un rapprochement avec un DAM ayant par ailleurs été évoqué. La gestion des utilisateurs, des BU et des droits est en revanche à traiter dès le début.

| Verbatim — Laurent Rebière (sur le back-office) *« La gestion des utilisateurs, des BU et des droits, c'est assez fondamental. C'est quelque chose qui va être dès le début — c'est un module essentiel en fait. »* |
| :---- |

## 

## **3.5 Méthodologie PRD — un document unique et vivant**

La règle est arrêtée : **un seul PRD.md par projet**, document vivant, plutôt qu'une série de documents séparés. Le projet démarre sur un **Bootstrap PRD**, puis évolue par **PRD units** successifs ; la traçabilité est portée par le fichier unique et son historique de commits.

### **3.5.1 État du PRD côté AGE**

Interrogé en séance, l'agent d'Arnaud Mazon confirme la structure du POC : un seul PRD.md, trois commits, un périmètre courant de **70 fonctionnalités réparties sur 11 domaines** plus les sections classiques. Point de vigilance : l'itération « gabarit boutique V2 » n'est pas passée par le PRD — elle a été cadrée directement en spec et architecture ; rétablir la traçabilité suppose un amendement du domaine 12\. Les *product briefs* sont des artefacts d'analyse distincts, situés dans les planning artifacts, et ne sont pas des PRD.

### **3.5.2 Méthode retenue pour les PRD Magrit**

* Laurent Rebière transmet à Arnaud Mazon un **contrat de PRD** qui servira de base au promptage.  
* Approche **itérative par brique** : un PRD global décrivant la composition de Magrit, puis des PRD par package ou groupe fonctionnel.  
* Premier livrable ciblé : un **PRD de bêta** limité au subset de fonctions déjà envisagé — « pas aller trop loin, commencer avec un truc comme ça et après faire d'autres PRD pour enrichir la solution ».  
* Piste ouverte : une fonction qui **analyse un dépôt ou une base documentaire pour en reformer un PRD**. Arnaud Mazon va plus loin — « c'est le backlog et le code qui vont avec qu'il faudrait réintégrer là-dedans » — le résultat pouvant servir d'étalon aux tests d'UX.

## **3.6 Accès au dépôt Magrit**

Le dépôt contient **code et documentation poussés ensemble** — backlog, specs, stories, doc d'état, sortie BMAD. Xavier Péchoultres a cloné le dépôt et y navigue en séance ; Laurent Rebière n'a pas retrouvé son invitation GitHub, vraisemblablement envoyée sur une adresse distincte de celle de son compte. Il prévoit un **checkout dans un sous-dossier de Magrit Core** pour le faire analyser par son agent et déterminer comment en dériver les PRD.

# **4\. Points ouverts et sujets non tranchés**

---

| Sujet | Constat | Impact / action recommandée |
| :---- | :---- | :---- |
| **État fonctionnel de la bêta** | Cible annoncée fin septembre / début octobre mais assumée comme imprécise ; le périmètre fonctionnel de la bêta n'est pas figé | P0 — bloquant pour l'onboarding de prospects · Qualifier périmètre, prérequis et dates fin août |
| **Accès GitHub de Laurent Rebière** | Invitation non retrouvée, probablement envoyée sur une adresse différente de celle du compte GitHub | Bloquant immédiat pour l'analyse du dépôt · Nouvelle invitation à émettre sous 24 h |
| **Traçabilité du PRD** | L'itération « gabarit boutique V2 » a été cadrée hors PRD (spec \+ architecture) ; le domaine 12 n'existe pas | Amendement à produire avant que le dépôt ne serve de source aux PRD |
| **Nommage du PIM** | Traité comme structuration de la data produit, pas comme module ; renommage « bibliothèque de produits » évoqué, rapprochement DAM en suspens | Arbitrage à rendre avant rédaction du PRD global — le nom conditionne le découpage en packages |
| **Parcs machines** | Aucun avancement ; chantier conditionné à la disponibilité de Magrit Core et repris conjointement avec le cahier des charges Altavia | À replanifier post-Magrit Core · Maquette Base44 à exploiter comme base du document de référence |
| **Ménage du back-office** | Écrans d'administration chargés — paramètres, workflows, plans tarifaires — dont la justesse reste à revoir | À traiter avant toute démo bêta · Ne pas exposer d'écrans non aboutis à un prospect |
| **Charge Altavia vs Magrit** | Signature au 15 septembre, mobilisation forte d'Expert Solutions à partir de fin octobre ; mutualisation annoncée (moteur de calcul) mais non formalisée | Documenter ce qui est effectivement mutualisé, et ce qui ne l'est pas, avant fin octobre |

# **5\. Mémoire partagée entre agents**

---

La session a ouvert un axe transverse aux deux chantiers : la mise en commun de ce que chacun produit via l'IA, pour que l'agent de l'un soit au fait des travaux de l'autre. Deux réponses complémentaires ont été exposées.

## **5.1 Réponse Expert Solutions — la structuration documentaire du dépôt**

Pour Laurent Rebière, le contexte dynamique du fil de discussion doit devenir de moins en moins important au profit de documents de référence : un README à la racine et dans chaque dossier, un dossier documentaire structuré avec des raccourcis explicites. L'objectif est une **persistance de l'information par la structure documentaire**, permettant l'onboarding d'un développeur humain comme d'un nouvel agent ou d'un nouveau fil de discussion, à partir du seul dépôt. Xavier Péchoultres cite l'environnement d'équipe de Codex, qui vise le même partage via une base documentaire commune.

## **5.2 Proposition AGE — Obsidian comme second cerveau**

Arnaud Mazon a démontré son vault en séance : fichiers Markdown locaux sauvegardés sur Drive donc partageables, mode graphe matérialisant les liens entretenus entre notes, branchement des agents via MCP. Quel que soit le point d'entrée — Claude, Gemini, VS Code, un projet ou Claude Code — le démarrage d'une discussion charge le contexte pertinent, y compris ce qui a été traité ailleurs. Le modèle est extensible à l'échelle de l'équipe, chacun choisissant ce qu'il partage. Le backlog Notion est lui-même nourri par cette mécanique, ce qui permet de filtrer par personne ou par projet sans base de données dédiée.

| Verbatim — Xavier Péchoultres (adhésion) *« L'approche est intéressante, ça permet de partager les contextes et de les sauvegarder. \[…\] Je vais tester ça tout de suite. »* |
| :---- |

Xavier Péchoultres a ouvert une piste plus large : une **gestion de projet en fichiers Markdown** — tâches, cartes et statuts mis à jour par l'IA, déplacés d'un dossier à l'autre quand c'est pertinent — qui supprimerait « une grosse partie des applications base de données hyper complexes avec des API dans tous les sens ». Laurent Rebière s'interroge sur le comportement à volume de contexte élevé et suppose un fonctionnement par abstracts en cascade. Réserve exprimée des deux côtés : chacun veut choisir ce qu'il partage.

## **5.3 Outillage relevé au passage**

* **Laurent Rebière** — Codex, en mono-agent : « en fonction de ce que je lui demande, il a directement les MD qu'il doit lire pour créer son contexte ».  
* **Xavier Péchoultres** — GitHub qui dispatche la requête selon sa complexité, Codex, Open Code, Cline avec des modèles locaux (Qwen sur M4 Pro) et des clés API Mistral pour les traitements simples et massifs. Abonnement principal d'environ 60 €/mois, passage à 100-200 € envisagé. Contrainte principale en local : la taille de contexte.  
* **Arnaud Mazon** — BMAD implanté et invoqué via Claude, avec appel aux différents agents selon la tâche. Signale Kimi, non testé.

# 

# **6\. Next steps**

## ---

**6.1 Engagements pris en séance**

| Action | Responsable | Échéance | Statut |
| :---- | :---- | :---- | :---- |
| Renvoyer l'invitation GitHub du dépôt Magrit (vérifier l'adresse rattachée au compte) | Arnaud Mazon | S31 — immédiat | ● À traiter |
| Finaliser le cockpit UX du factory (HC Platform) | Laurent Rebière | Fin juillet | ● En cours |
| Transmettre le contrat de PRD servant de base au promptage | Laurent Rebière | S31–S32 | ● À traiter |
| Checkout du dépôt Magrit dans un sous-dossier de Magrit Core et analyse par agent → méthode de production des PRD | Laurent Rebière | S32 | ● En attente |
| Épreuvage du framework, puis démarrage des premières briques Magrit | Laurent Rebière | Début août | ● À traiter |
| Rédiger le PRD bêta Magrit à partir du contrat de PRD, puis les PRD par brique | Arnaud Mazon | S32 | ● En attente |
| Faire amender le PRD.md — évolutions boutiques, domaine 12 | Arnaud Mazon | S32 | ● À traiter |
| Diffuser au groupe la documentation Obsidian et le lien vidéo | Arnaud Mazon | S31 | ● À traiter |
| Transmettre les entrées de backlog depuis Obsidian | Arnaud Mazon | S32 | ● À traiter |
| Tester Obsidian pour la gestion du contexte et des projets | Xavier Péchoultres | S31 | ● En cours |
| Éplucher le contrat et le cahier des charges Altavia en vue de la signature | Xavier Péchoultres | 15 septembre | ● En cours |
| Reprendre l'application de saisie des parcs machines | Xavier Péchoultres | Post-Magrit Core | ● En attente |
| Parcourir le guide Magrit, en faire tourner une version locale et brancher Playwright pour des tests de comparaison | Groupe | S32 | ● À traiter |
| Qualifier l'état fonctionnel cible de la bêta et fiabiliser les dates | Groupe | Fin août | ● En attente |
| Session de travail hebdomadaire suivante — même jour, même heure | Groupe | Mer. 5 août | ● Acté |

## **6.2 Actions internes AGE Dvt. — pilotage**

* Consolider les écrans d'administration du back-office avant toute démo bêta — la justesse de ce qui est affiché conditionne la crédibilité de la démonstration.  
* Trancher le nommage du PIM (« bibliothèque de produits » ou non) avant la rédaction du PRD global : le nom conditionne le découpage en packages.  
* Documenter le périmètre bêta comme un engagement opposable — fonctions incluses, prérequis client, retour attendu — et non comme une intention de calendrier.  
* Reprendre la prospection fin août avec des dates tenables ; ne pas engager d'onboarding prospect avant que le périmètre bêta ne soit figé.  
* Préparer la diffusion Obsidian au groupe (documentation, lien vidéo, périmètre de partage) en explicitant ce que chacun garde privé — la réserve a été exprimée en séance des deux côtés.

# **7\. Lecture stratégique pour le pilotage**

### ---

**7.1 Ce qui est acquis**

* **Une méthode documentaire commune.** Le PRD unique et vivant règle un point qui restait flou entre les deux équipes : où vit la définition produit et comment elle évolue. C'est la condition pour que le dépôt Magrit devienne exploitable par la chaîne de génération d'Expert Solutions.  
* **Un corpus fonctionnel validé à trois voix.** Le périmètre de Magrit n'est plus une liste portée par AGE seul : il est acté par ceux qui vont le produire. C'est la base d'un chiffrage et d'un découpage en packages.  
* **Un POC qui démontre, pas qui promet.** PIM auto-alimenté, éditeur de devis, boutiques, back-office et sous-espaces ont été montrés en fonctionnement — l'écart entre le discours commercial et l'objet réel se réduit.  
* **Un axe transverse ouvert sans coût.** Obsidian est gratuit, local, et testé immédiatement par Xavier Péchoultres. S'il s'installe dans l'équipe, il résout la continuité de contexte entre trois personnes qui travaillent avec des agents différents.

### **7.2 Points de vigilance**

* **La date de bêta n'est pas un engagement, c'est une intention.** « Fin septembre / début octobre » est reconduit sans être réévalué, et août ne produira presque rien. Or c'est cette date qui commande la reprise de la prospection.  
* **Le contrat Altavia est le vrai facteur de charge.** Signature au 15 septembre, montée en charge fin octobre. La mutualisation annoncée (moteur de calcul) est plausible mais n'est pas documentée — si elle ne se vérifie pas, Magrit passe au second rang au moment précis où la bêta doit tourner.  
* **Le fonctionnel de la gestion commerciale reste à écrire.** Le mini CRM a validé la chaîne de production, pas le métier. Entre le banc d'essai et une Gescom qui gère devis, commandes et relances, il y a un PRD complet à produire.  
* **Dépendance à un seul point d'entrée documentaire.** Tout le plan repose sur le contrat de PRD de Laurent Rebière et sur l'analyse du dépôt par son agent. Tant que l'invitation GitHub n'est pas réglée, la semaine du 3 août est bloquée sur un détail administratif.

### **7.3 Décisions à prendre avant la prochaine session**

* Arrêter le **périmètre exact du PRD bêta** — quelles fonctions du corpus entrent dans la première itération, lesquelles attendent.  
* Trancher le **nommage et le statut du PIM** dans l'architecture des packages.  
* Décider si le **PRD est dérivé du dépôt existant** (backlog \+ code) ou réécrit à partir du contrat de PRD — les deux approches ont été évoquées sans être départagées.  
* Fixer ce qui est **mutualisé avec le chantier Altavia** et ce qui ne l'est pas, avant que la charge ne se matérialise fin octobre.

### **7.4 Inscriptions dans les outils projet**

Entrées à porter au Sprint Board Notion après validation et estimation d'effort par Laurent Rebière.

| ID | Titre | Epic | Prio |
| :---- | :---- | :---- | :---- |
| **BK-WM290726-01** | PRD global Magrit — périmètre bêta | PRD / Doc | P0 |
| **BK-WM290726-02** | PRD par brique fonctionnelle (PRD units) | PRD / Doc | P1 |
| **BK-WM290726-03** | Amendement PRD — domaine 12 (gabarit boutique V2) | PRD / Doc | P1 |
| **BK-WM290726-04** | Génération de PRD depuis un dépôt existant (backlog \+ code \+ doc) | HC Platform | P2 |
| **BK-WM290726-05** | Cockpit UX web du factory | HC Platform | P0 |
| **BK-WM290726-06** | Dépôts spécialisés runtime / builder / factory | HC Platform | P0 |
| **BK-WM290726-07** | Tests E2E Playwright et boucle d'optimisation UX | HC Platform | P1 |
| **BK-WM290726-08** | Documentation et tutoriels générés depuis les scénarios du PRD | HC Platform | P1 |
| **BK-WM290726-09** | Gestion commerciale — reprise du fonctionnel (devis, commandes, relances) | GESCO | P0 |
| **BK-WM290726-10** | Éditeur de devis — marges, gabarits, statuts, client destinataire | GESCO | P0 |
| **BK-WM290726-11** | Back-office tenant — consolidation et ménage des écrans | Admin / UX | P0 |
| **BK-WM290726-12** | Sous-espaces filiales — Home Magrit propre par filiale | Admin / UX | P1 |
| **BK-WM290726-13** | PIM auto-alimenté et bascule des gammes en boutique | PIM / Boutique | P1 |
| **BK-WM290726-14** | Search prompt catalogue avec repli sur le calcul Magrit | Boutique | P1 |
| **BK-WM290726-15** | Workflow de validation de commande et définition des rôles | GESCO | P1 |
| **BK-WM290726-16** | Démarrage de production — transmission vers système tiers | Intégration | P2 |
| **BK-WM290726-17** | Saisie des parcs machines — reprise post-Magrit Core (base Base44 \+ CDC Altavia) | Parcs machines | P1 |

* Obsidian — consigner dans 03\_MAGRIT/ la fiche de traçabilité du présent CR et la décision « PRD unique et vivant ».  
* Notion — passer les 17 entrées ci-dessus au Sprint Board après estimation, source WM\#290726.  
* Pipeline commercial Magrit — maintenir la prospection en attente jusqu'à la qualification du périmètre bêta de fin août.

---

*— Document confidentiel. Usage interne AGE Développement & Expert Solutions. —*

[image1]: <data:image/png;base64,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>