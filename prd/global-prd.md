# Magrit

> PRD produit global — reprise brownfield
>
> Version : 0.2  
> Date : 2026-08-04  
> Statut : draft de cadrage à valider par le Product Owner  
> Périmètre observé : dépôt `Magritoff`, branche `main`, jusqu'au commit `177edb3`  
> Format : compatible avec le contrat d'entrée PRD d'OWK Factory

## Summary

Magrit est un SaaS B2B multi-tenant destiné aux imprimeurs et à leurs clients. Il réunit dans un même produit un copilote de vente print, un catalogue PIM, la préparation de devis, la réponse aux appels d'offres, des boutiques B2B personnalisées et un portail acheteur couvrant la découverte produit, la configuration, le panier, le checkout, le suivi et le renouvellement des commandes. Magrit s'appuie sur Clariprint pour les données techniques et le calcul print, sur un enrichissement assisté par LLM pour structurer l'offre, et sur un modèle de données Supabase isolé par tenant.

Le projet est brownfield : une part importante de ces capacités existe déjà dans le dépôt, mais elle résulte d'itérations successives et n'est pas décrite par un document produit global à jour. Ce PRD établit la référence produit commune avant toute décision de refonte, de découpage en packages ou de réécriture.

## Business Goal

Permettre à un imprimeur de transformer plus vite une demande print, y compris un appel d'offres volumineux, en offre vendable et ré-commandable, puis d'offrir à ses acheteurs une expérience B2B moderne sans devoir construire ni maintenir un site e-commerce print spécifique. Le produit doit réduire le travail manuel de qualification, de lecture des dossiers de consultation, de chiffrage, de mise en catalogue et de suivi, tout en préservant le contrôle commercial de l'imprimeur, la fiabilité des données techniques et l'isolation stricte entre organisations.

## Capabilities

- Gestion SaaS multi-tenant avec tenant imprimeur, sous-espaces, membres, invitations, rôles et permissions
- Copilote conversationnel pour qualifier une demande print et préparer une configuration ou un devis
- Catalogue PIM global structuré par gammes, définitions, données techniques, contenus marketing et SEO
- Intégration Clariprint isolée derrière un adaptateur pour les configurations et prix print
- Bibliothèques tenant de produits et de devis réutilisables
- Création, édition, validation et historisation des devis
- Gestion des réponses aux appels d'offres : dossier de consultation, bordereaux volumineux, chiffrage, contrôles, pièces de réponse et export
- Création et administration de boutiques B2B brandées, privées ou ouvertes à l'auto-inscription
- Portail acheteur route-driven avec home, catalogue, pages gamme, recherche, fiche produit et compte
- Configuration produit, résolution de prix avec provenance explicite, panier et checkout court
- Gestion des commandes, renouvellement, annulation autorisée, transitions de workflow et piste d'audit
- Génération de mockups et administration des assets produit cohérents par gamme
- Administration PIM, catalogues, gammes, définitions et visuels
- Administration des utilisateurs, rôles, sous-espaces et paramètres tenant
- Notifications transactionnelles et reprise de parcours
- Observabilité de la sécurité multi-tenant, des intégrations et de la consommation LLM
- Politique qualité et accessibilité commune à tous les parcours

## Journeys

- journey-1 | Qualifier une demande print et préparer un devis | high
- journey-2 | Transformer un devis en offre réutilisable et en commande | high
- journey-3 | Créer et publier une boutique B2B pour un client | high
- journey-4 | Découvrir, configurer et commander un produit depuis une boutique | high
- journey-5 | Reprendre un panier, suivre ou renouveler une commande | high
- journey-6 | Administrer le PIM et affecter des produits aux catalogues tenant | high
- journey-7 | Inviter un collaborateur ou un acheteur avec le bon périmètre d'accès | high
- journey-8 | Configurer les rôles et faire progresser une commande de façon auditée | medium
- journey-9 | Administrer les sous-espaces et les gammes d'un tenant | medium
- journey-10 | Générer et valider les visuels produit d'une boutique | medium
- journey-11 | Importer un appel d'offres, chiffrer ses lignes et constituer une réponse contrôlée | high

## Package Candidates

- magrit-suite | Magrit Suite | business-app | Point d'entrée SaaS, navigation, orchestration, politique qualité et accessibilité | platform-core,sales-copilot,b2b-commerce,print-catalog,order-management
- platform-core | Platform Core | business-app | Gestion multi-tenant, utilisateurs, membres, invitations, scopes, rôles, permissions, paramètres, audit partagé et observabilité | none
- sales-copilot | Sales Copilot | business-app | Qualification conversationnelle, configuration print, devis et bibliothèques commerciales | platform-core,print-catalog,clariprint-connector
- print-catalog | Print Catalog | business-app | PIM global, gammes, définitions, enrichissement, mockups, assets et souscriptions de catalogue | platform-core,clariprint-connector
- b2b-commerce | B2B Commerce | business-app | Création et administration de boutiques, catalogues publiés, expérience acheteur, panier, checkout et compte | platform-core,print-catalog,order-management
- order-management | Order Management | business-app | Commandes tenant, rôles métier, transitions, audit, notifications et renouvellement | platform-core,print-catalog
- clariprint-connector | Clariprint Connector | connector | Adaptation, validation et observabilité des échanges avec Clariprint | none
- tender-response | Tender Response | business-app | Dossiers de consultation, ingestion de bordereaux, qualification, chiffrage en masse, conformité, pièces de réponse et exports | platform-core,sales-copilot,print-catalog,clariprint-connector

## Constraints

- Projet brownfield : conserver les comportements métier validés tant qu'une décision explicite ne les remplace pas
- Pas de réécriture big-bang ; avancer par tranches verticales réversibles et vérifiables
- Les packages ci-dessus sont des candidats de responsabilité, pas une décision immédiate d'extraction en dépôts séparés
- Une seule source de vérité par concept métier ; les anciens modèles `shop_orders` et les chemins de compatibilité doivent être inventoriés avant suppression
- Isolation tenant obligatoire dans la base, les RPC, le stockage, les edge functions et l'interface
- Accès acheteur `shop_only` limité à une allow-list de boutiques ; aucun héritage implicite vers les sous-tenants
- Le PIM global est un patrimoine Magrit ; les tenants souscrivent ou affectent des gammes et produits sans dupliquer la vérité globale
- Toute donnée de prix affichée doit exposer sa provenance et distinguer prix validé, prix de bibliothèque et estimation
- Toute sortie LLM structurée doit être validée par schéma et ne peut être la seule autorité sur un prix, un droit ou une transition de commande
- Tout contenu extrait d'un dossier de consultation conserve sa source, sa version et un niveau de confiance ; une extraction automatique ne vaut jamais validation de conformité
- Clariprint doit rester derrière un adaptateur unique et testable ; aucun appel ad hoc depuis l'interface
- Les actions sensibles doivent être autorisées côté serveur et auditables ; une garde React seule ne suffit pas
- L'accessibilité cible est WCAG 2.1 AA sur les parcours critiques
- Le français est la langue initiale ; les contenus PIM localisés doivent rester extensibles à d'autres locales
- Factory prépare le plan mais ne mute pas les sources, les tenants, le runtime ou la production sans handoff et approbation explicites
- La reprise doit préserver les données et permettre une migration progressive avec stratégie de retour arrière

## Document Purpose

Ce document remplace le PRD d'itération comme référence produit principale. Le fichier `_bmad-output/planning-artifacts/prd.md` reste une source historique utile pour l'itération e-shop v1.1, mais ne décrit plus à lui seul le produit présent.

Le PRD global sert à :

1. aligner la vision, les utilisateurs et les règles métier ;
2. distinguer ce qui existe réellement de ce qui reste à décider ;
3. fournir une entrée déterministe à OWK Factory ;
4. permettre ensuite un audit d'architecture et un plan de reprise sans réinventer le produit.

Ce PRD ne constitue pas encore un engagement de livraison. Les objectifs chiffrés non instrumentés et les questions ouvertes doivent être validés avant transformation en roadmap contractuelle.

## Product Vision

Magrit doit devenir la couche métier qui relie la demande commerciale ou l'appel d'offres, la connaissance print, le chiffrage, la mise en catalogue et la récurrence d'achat.

Pour l'imprimeur, Magrit réduit le temps passé à reformuler des demandes, ressaisir des paramètres, produire des descriptifs, créer des vitrines client et retrouver les commandes passées. Pour l'acheteur, Magrit masque la complexité du print derrière un parcours lisible, tout en conservant les options techniques nécessaires. Pour Magrit, chaque produit correctement structuré enrichit un patrimoine PIM réutilisable dans les futures offres et boutiques.

Le cœur de valeur n'est pas un e-commerce généraliste : c'est la combinaison d'une connaissance print structurée, d'un devis assisté et d'un portail B2B opéré par l'imprimeur.

## Problem Statement

Les demandes print B2B arrivent souvent sous forme de mails, briefs incomplets, commandes récurrentes mal documentées ou dossiers de consultation composés de plusieurs pièces et de bordereaux volumineux. L'imprimeur doit qualifier le besoin, retrouver les exigences applicables, rapprocher chaque ligne de ses capacités et produits, calculer un prix, produire une offre puis ressaisir tout ou partie de cette information dans un catalogue ou un outil de suivi. Dans le cas d'un appel d'offres, cette fragmentation augmente le risque d'oubli, d'incohérence de prix ou de réponse hors délai. L'acheteur dépend alors de l'imprimeur pour chaque répétition d'achat et dispose rarement d'une expérience digitale adaptée à son historique.

Les solutions e-commerce généralistes demandent un paramétrage lourd et connaissent mal les contraintes print. Les outils métier historiques gèrent la production mais exposent souvent une expérience commerciale peu accessible. Magrit cherche à combler cet espace sans retirer à l'imprimeur son contrôle sur la validation, le prix et le workflow.

## Users and Roles

### Imprimeur propriétaire

Dirigeant ou responsable de l'organisation cliente Magrit. Il crée son tenant, configure son offre, contrôle les accès, supervise les boutiques, les devis et les commandes, et délègue à ses équipes.

### Commercial ou deviseur

Il qualifie une demande, utilise le copilote, prépare et édite des devis, enrichit une bibliothèque, affecte une offre à une boutique et suit sa transformation en commande.

### Responsable appels d'offres

Il centralise le dossier de consultation, identifie les exigences et échéances, répartit le travail de chiffrage, contrôle la complétude des pièces, arbitre les anomalies et valide le dossier de réponse avant dépôt. Ce rôle peut être tenu par un commercial, un deviseur ou un responsable grands comptes selon l'organisation du tenant.

### Administrateur catalogue

Il gère les gammes actives, le PIM, les contenus éditoriaux, les visuels, les produits vendables et leur affectation aux boutiques.

### Opérateur de commande

Il consulte les commandes, exécute les transitions autorisées, modifie les informations permises et maintient la piste d'audit.

### Acheteur B2B

Il accède à une ou plusieurs boutiques autorisées, découvre les produits, configure une demande, consulte un prix ou une estimation clairement identifiée, commande, suit et renouvelle.

### Super-administrateur Magrit

Il administre le patrimoine global, traite les candidats PIM, maintient les gammes et les templates de mockups, et intervient sur le support plateforme. Ses accès élevés doivent être explicites et audités.

## Product Principles

1. **La donnée avant le décor.** Les classifications, badges, contenus et recommandations doivent être dérivés du PIM, de Clariprint ou de l'historique quand ces sources existent.
2. **Honnêteté du prix.** Une estimation n'est jamais présentée comme un tarif validé.
3. **Contrôle humain aux points engageants.** Le LLM assiste ; les permissions, prix contractuels et transitions sensibles reposent sur des règles déterministes.
4. **Sécurité par la source de vérité.** La base et les RPC imposent les droits, indépendamment de l'interface.
5. **Un parcours acheteur court.** La complexité technique est révélée progressivement et le checkout tient au plus en deux écrans principaux.
6. **Une boutique, plusieurs capacités.** Boutique vitrine et boutique transactionnelle sont un même objet configuré par capacités et mode d'accès.
7. **Compatibilité brownfield visible.** Toute couche de transition est nommée, mesurée et assortie d'une condition de retrait.
8. **Preuve avant extraction.** Un package n'est extrait que si sa responsabilité, son contrat et ses validations sont stables.

## Verified Product Baseline

Le tableau suivant décrit les capacités observées dans le dépôt. « Vérifié » signifie présence de code, migrations et/ou tests locaux ; cela ne garantit pas que la capacité soit activée ou correctement configurée dans chaque environnement déployé.

| Domaine | Baseline observée | État PRD |
|---|---|---|
| Multi-tenant | Tenants, sous-tenants limités à deux niveaux, memberships, invitations, scopes `magrit_full` et `shop_only`, RLS et helpers serveur | À conserver et ré-auditer |
| Identité et rôles | Presets et rôles tenant, capabilities fines, affectation de boutiques, page d'administration | À consolider |
| Copilote | Chat, streaming Claude, configuration produit et préparation commerciale | À mesurer et clarifier |
| PIM | Gammes, définitions localisées, enrichissement, candidats d'ingestion, administration PIM, catalogue Exaprint | À normaliser |
| Clariprint | Adaptateur serveur, résolution gamme/configuration, ingestion et calcul de prix | À contracter et tester |
| Devis | Création, édition, statuts, bibliothèque et entrée depuis le panier | À unifier |
| Appels d'offres | Besoin historique identifié pour le traitement de fichiers Excel grands volumes, sans module vérifié dans la baseline actuelle | À construire |
| Boutiques | Branding, accès privé ou auto-inscription, catalogues manuels ou PIM, produits et gammes | À conserver |
| Portail acheteur | Routes dédiées, home, catalogue, gamme, produit, compte, reprise, recherche et checkout | À conserver |
| Commandes | Modèles historiques et cible `tenant_orders`, items, rôles, transitions, audit, renouvellement et annulation | Migration à achever |
| Visuels | Templates SVG, générateur de mockups, stockage et overrides par boutique | À industrialiser |
| SEO | Métadonnées de pages gamme, données structurées prudentes, sitemap et `noindex` des boutiques privées | À valider sur domaine public |
| Qualité | Vitest, Playwright, tests RLS/RPC, axe et identifiants de test stables | À intégrer au gate de reprise |

## Product Scope

### Scope de stabilisation — prochaine phase

- Valider ce PRD avec le Product Owner et corriger les hypothèses métier.
- Cartographier les flux réellement utilisés, leurs tables, RPC, edge functions et dépendances externes.
- Définir le modèle canonique pour devis, commande, produit vendable, rôle et prix.
- Mesurer les parcours critiques avant refactor : succès, durée, erreurs et dépendances.
- Mettre sous test de contrat les frontières Clariprint, LLM, Supabase et notifications.
- Supprimer uniquement les doublons dont les lectures et écritures ne sont plus utilisées.
- Introduire les frontières de packages dans le monolithe avant toute extraction physique.

### Scope produit cœur

- Acquisition et administration d'un tenant imprimeur.
- Qualification conversationnelle d'une demande print.
- Préparation, édition, sauvegarde et validation d'un devis.
- Import, analyse, chiffrage, contrôle et préparation d'une réponse à un appel d'offres.
- Gestion d'un catalogue print global enrichi et de bibliothèques tenant.
- Création d'une boutique B2B et affectation d'une offre vendable.
- Découverte, configuration, panier, checkout et commande côté acheteur.
- Suivi, validation, renouvellement et audit des commandes.
- Gestion des utilisateurs, scopes, rôles et permissions.
- Visuels produit cohérents et contenus PIM exploitables.

### Hors scope de la phase de stabilisation

- Réécriture complète de l'interface ou changement de design system.
- Extraction immédiate en plusieurs dépôts ou microservices.
- Paiement en ligne, facturation électronique et logistique complète.
- Synchronisation bidirectionnelle Shopify, WooCommerce ou Magento.
- Studio de création graphique natif concurrent de Canva ou Affinity.
- Remplacement de Clariprint comme moteur métier print.
- Internationalisation commerciale complète.
- Engagement de SLA Enterprise avant définition de l'exploitation.

## Functional Requirements

### Tenancy, identity and access

- **FR-TEN-001** Le système doit permettre de créer un tenant imprimeur et de lui affecter un owner unique au moment de l'onboarding.
- **FR-TEN-002** Un tenant racine peut créer des sous-espaces directs ; la profondeur maximale reste de deux niveaux tant qu'une nouvelle règle n'est pas validée.
- **FR-TEN-003** Un membre interne autorisé peut accéder aux tenants hérités selon la règle d'héritage explicite.
- **FR-TEN-004** Un acheteur `shop_only` ne peut accéder qu'aux boutiques présentes dans son allow-list et n'hérite jamais d'un accès aux sous-tenants.
- **FR-TEN-005** Un administrateur autorisé peut inviter, désactiver et réaffecter un utilisateur sans contourner les contrôles serveur.
- **FR-TEN-006** Les permissions doivent être évaluées comme des capabilities métier, et pas uniquement comme un libellé de rôle.
- **FR-TEN-007** Toute élévation de privilège, invitation ou modification de scope doit laisser une trace exploitable.

### Sales copilot and quotes

- **FR-SAL-001** Un commercial peut décrire un besoin print en langage naturel et recevoir les questions de clarification nécessaires.
- **FR-SAL-002** Le système distingue les informations fournies, inférées et encore manquantes avant de proposer une configuration engageante.
- **FR-SAL-003** Un utilisateur peut transformer la configuration en devis éditable sans ressaisie des données validées.
- **FR-SAL-004** Un devis conserve un snapshot des éléments produit et prix nécessaires à sa relecture future.
- **FR-SAL-005** Un utilisateur autorisé peut modifier, envoyer, valider, rejeter ou classer un devis selon les transitions définies.
- **FR-SAL-006** Un devis ou une configuration récurrente peut être ajouté à une bibliothèque tenant.
- **FR-SAL-007** Le système doit signaler clairement un échec ou une donnée incomplète de Clariprint au lieu de fabriquer silencieusement une valeur.

### Tender response management

- **FR-AO-001** Un utilisateur autorisé peut créer un dossier d'appel d'offres avec une référence, un objet, un donneur d'ordre, un ou plusieurs lots, une date limite, des responsables et un statut.
- **FR-AO-002** Le système permet de déposer les pièces du dossier de consultation et d'identifier au minimum le règlement de consultation, le CCTP, le CCAP, l'acte d'engagement, le BPU, la DPGF et les annexes, sans imposer qu'elles soient toutes présentes.
- **FR-AO-003** Chaque fichier source est conservé avec son nom, sa version, sa date d'ajout, son auteur et une empreinte d'intégrité ; son remplacement crée une nouvelle version sans effacer l'original.
- **FR-AO-004** Un utilisateur peut importer un bordereau aux formats tabulaires retenus, prévisualiser le mapping des colonnes et corriger ce mapping avant toute création de lignes métier.
- **FR-AO-005** L'import normalise au minimum la référence, la désignation, la quantité, l'unité, les contraintes techniques, le lot et les cellules de prix, tout en conservant la ligne source pour audit et ré-export.
- **FR-AO-006** Le système détecte et regroupe les lignes incomplètes, dupliquées, incohérentes ou non interprétables ; aucune ligne en anomalie n'est supprimée silencieusement.
- **FR-AO-007** Le système peut rapprocher une ligne d'un produit PIM, d'une configuration de bibliothèque ou d'une capacité Clariprint et affiche la source ainsi qu'un niveau de confiance pour chaque proposition.
- **FR-AO-008** Un deviseur peut accepter, modifier ou rejeter un rapprochement proposé, traiter plusieurs lignes par action groupée et affecter les lignes non résolues à un collaborateur.
- **FR-AO-009** Chaque ligne peut recevoir un coût, une marge, un prix de vente, une provenance de prix, une durée de validité et des notes internes ; les totaux sont recalculés de manière déterministe.
- **FR-AO-010** Toute valeur saisie manuellement en remplacement d'un prix calculé conserve l'ancienne valeur, l'auteur, la date et un motif de dérogation.
- **FR-AO-011** Le dossier présente une checklist de conformité administrative, technique et financière, les pièces attendues, les points bloquants, les questions en suspens et l'état d'avancement par lot.
- **FR-AO-012** Une assistance LLM peut extraire des échéances, critères, exigences et réserves depuis les pièces du DCE, mais chaque élément extrait reste relié à sa source et doit pouvoir être confirmé, corrigé ou rejeté par un humain.
- **FR-AO-013** Un utilisateur autorisé peut générer un paquet de réponse contenant les bordereaux complétés et les pièces retenues, avec un contrôle final bloquant sur les anomalies critiques et les pièces obligatoires non validées.
- **FR-AO-014** Le système exporte les prix dans un format compatible avec le bordereau d'origine lorsque cela est techniquement possible ; sinon il produit un export normalisé et signale explicitement les écarts de structure ou de formule.
- **FR-AO-015** Le dossier suit des statuts explicites au minimum `brouillon`, `à qualifier`, `chiffrage en cours`, `à valider`, `prêt à déposer`, `déposé`, `gagné`, `perdu` et `archivé`, avec historique des transitions.
- **FR-AO-016** Un appel d'offres gagné peut être transformé en devis, commande, bibliothèque ou offre vendable sans ressaisie des lignes validées, tout en conservant le lien vers le dossier source.
- **FR-AO-017** Le tableau de bord expose les échéances proches, dossiers bloqués, lignes restant à chiffrer, validations attendues et résultats gagnés ou perdus selon les droits de l'utilisateur.
- **FR-AO-018** La première version prépare et exporte le dossier de réponse mais ne dépose pas automatiquement l'offre sur une plateforme externe tant que cette intégration et son niveau de responsabilité ne sont pas validés.

### PIM and catalog

- **FR-PIM-001** Magrit maintient un catalogue global de gammes et définitions produit versionnables et localisables.
- **FR-PIM-002** Une définition produit peut contenir données techniques, contenu marketing, SEO, cas d'usage, FAQ, attributs et références visuelles.
- **FR-PIM-003** Les données techniques autoritatives et les contenus générés doivent avoir une provenance distincte.
- **FR-PIM-004** Un administrateur Magrit peut valider, rejeter, fusionner ou remplacer un candidat PIM.
- **FR-PIM-005** Un tenant peut activer des gammes et constituer une bibliothèque sans dupliquer le patrimoine global.
- **FR-PIM-006** Une boutique peut fonctionner en mode catalogue PIM ou avec une sélection explicite de produits vendables.
- **FR-PIM-007** Tout enrichissement LLM est validé par schéma avant persistance et reste éditable par un humain autorisé.

### B2B shops and buyer portal

- **FR-SHP-001** Un administrateur peut créer une boutique avec slug, identité visuelle, coordonnées, gammes et règles d'accès.
- **FR-SHP-002** Une boutique est `invite_only` par défaut et peut être passée explicitement en `self_signup`.
- **FR-SHP-003** L'auto-inscription crée un accès minimal `shop_only` à la seule boutique concernée.
- **FR-SHP-004** Le portail offre des URL stables pour la home, le catalogue, les gammes, les produits, le checkout, les commandes, les devis et le profil.
- **FR-SHP-005** L'acheteur peut rechercher, filtrer et parcourir les produits à partir de données PIM réelles.
- **FR-SHP-006** Une page gamme ne doit pas être vide lorsque des produits vendables existent et doit expliciter l'absence de résultat sinon.
- **FR-SHP-007** L'acheteur peut configurer un produit avec des choix contrôlés et comprendre l'effet des options sur le prix.
- **FR-SHP-008** L'acheteur peut reprendre un panier ou un parcours éligible depuis la home ou son compte.
- **FR-SHP-009** Le checkout demande uniquement les informations nécessaires et présente un récapitulatif avant confirmation.
- **FR-SHP-010** Une boutique privée ne doit pas être indexée ; une boutique publique doit exposer des URL canoniques et un sitemap utilisant le domaine public réel.

### Pricing and Clariprint

- **FR-PRC-001** Les appels Clariprint passent par un contrat unique qui normalise les unités, erreurs et réponses.
- **FR-PRC-002** Le système résout un prix selon une hiérarchie documentée et testée.
- **FR-PRC-003** Chaque ligne et total affichés conservent une `price_source` lisible par le système.
- **FR-PRC-004** Une estimation de marché est identifiée comme indicative et ne devient pas un prix contractuel sans validation.
- **FR-PRC-005** Les requêtes obsolètes de calcul sont annulées ou ignorées afin qu'une réponse tardive ne remplace pas une configuration plus récente.
- **FR-PRC-006** Les paramètres et prix internes sous licence Clariprint ne sont jamais exposés au-delà des droits convenus.

### Orders and workflow

- **FR-ORD-001** La commande canonique est tenant-scoped et conserve ses lignes, snapshots, montants, auteur, boutique et dates.
- **FR-ORD-002** La création d'une commande vérifie côté serveur la capability de l'acteur et l'accès à la boutique.
- **FR-ORD-003** Chaque transition de statut est validée par le workflow applicable et ajoutée à une piste d'audit immuable.
- **FR-ORD-004** Les rôles de commande peuvent différencier achat, validation, modification, annulation, export et administration.
- **FR-ORD-005** L'acheteur peut consulter les commandes qu'il est autorisé à voir, sans fuite inter-tenant ou inter-boutique.
- **FR-ORD-006** Une commande éligible peut être renouvelée en créant un nouveau brouillon traçable plutôt qu'en modifiant l'original.
- **FR-ORD-007** Une annulation exige un statut et une permission compatibles et conserve la raison et l'acteur.
- **FR-ORD-008** Les modèles historiques restent en compatibilité lecture uniquement pendant la migration, avec métrique d'usage et date de retrait.

### Visuals and notifications

- **FR-MED-001** Le système choisit un visuel produit via une résolution centralisée et déterministe.
- **FR-MED-002** Un mockup peut être généré depuis un template de gamme et personnalisé par la boutique sans altérer l'asset global.
- **FR-MED-003** Un administrateur autorisé peut remplacer ou restaurer un visuel de boutique.
- **FR-MED-004** Les assets stockés respectent les mêmes frontières tenant que les données associées.
- **FR-NOT-001** Une action de commande importante peut déclencher une notification idempotente et traçable.
- **FR-NOT-002** L'échec d'envoi d'une notification ne doit pas invalider silencieusement la transaction métier déjà persistée.

### Administration and observability

- **FR-ADM-001** Les administrateurs disposent de vues dédiées pour utilisateurs, rôles, boutiques, gammes, bibliothèques, devis, commandes, PIM et mockups selon leurs droits.
- **FR-ADM-002** Les appels LLM enregistrent modèle, usage, latence, résultat et contexte tenant sans stocker de secret.
- **FR-ADM-003** Les intégrations externes exposent des erreurs corrélables entre interface, edge function et événement serveur.
- **FR-ADM-004** Les données de démonstration, tests et production doivent être distinguables et nettoyables sans requête destructive large.
- **FR-ADM-005** Les administrateurs disposent d'une vue dédiée aux appels d'offres, à leurs échéances, responsables, anomalies, résultats et volumes traités selon leurs droits.

## Business Rules

- **BR-001** Le tenant est la frontière de propriété principale des données commerciales.
- **BR-002** Une boutique appartient à un tenant et peut exposer une sélection de son catalogue à des acheteurs externes.
- **BR-003** Le PIM global appartient à Magrit ; une bibliothèque ou une offre vendable appartient au tenant.
- **BR-004** Le prix calculé, le prix estimé et le prix accepté sont trois états distincts.
- **BR-005** Un devis et une commande conservent leurs snapshots même si le PIM change ensuite.
- **BR-006** Un renouvellement crée un nouvel objet ; l'historique source reste immuable.
- **BR-007** Une transition métier refusée côté serveur ne peut pas être rendue possible par une option d'interface.
- **BR-008** Le mode `self_signup` est un choix boutique explicite ; `invite_only` reste le défaut sûr.
- **BR-009** Une boutique privée est `noindex` indépendamment de l'état d'authentification du visiteur.
- **BR-010** Les contenus générés automatiquement ne remplacent pas silencieusement un contenu humain existant.
- **BR-011** Un dossier d'appel d'offres, ses fichiers, ses lignes, ses commentaires et ses exports appartiennent à un tenant unique et ne sont jamais partagés implicitement avec un autre tenant.
- **BR-012** Le fichier source et les versions déposées sont immuables ; les corrections s'appliquent au modèle de travail et restent traçables.
- **BR-013** Une ligne n'est considérée comme prête que si ses données obligatoires, son prix et sa provenance ont été validés ou si son exclusion a été explicitement motivée.
- **BR-014** Un score de confiance, une extraction LLM ou un rapprochement automatique constitue une aide à la décision et non une preuve de conformité au DCE.
- **BR-015** Le total d'une réponse est dérivé des lignes incluses et de règles de calcul versionnées ; il n'est jamais maintenu comme une valeur indépendante non réconciliée.
- **BR-016** Seul un utilisateur disposant de la capability de validation d'appel d'offres peut passer un dossier à `prêt à déposer`, `déposé`, `gagné` ou `perdu`.

## Non-Functional Requirements

### Security and privacy

- **NFR-SEC-001** Zéro accès cross-tenant toléré sur les données, RPC, événements temps réel et assets tenant-scoped.
- **NFR-SEC-002** Toutes les tables tenant-scoped sont couvertes par RLS et par au moins un test positif et un test négatif représentatif.
- **NFR-SEC-003** Les opérations privilégiées utilisent une allow-list d'arguments et vérifient l'acteur dans la base.
- **NFR-SEC-004** Les secrets restent exclusivement dans les mécanismes de secrets d'environnement ; aucun secret n'est livré au navigateur ou commité.
- **NFR-SEC-005** Les journaux évitent les données personnelles inutiles et permettent l'exécution des droits RGPD définis.

### Reliability and data integrity

- **NFR-REL-001** Postgres est la source de vérité des devis, appels d'offres, commandes, droits et états de workflow ; aucun état critique ne dépend uniquement de la mémoire du navigateur.
- **NFR-REL-002** Les écritures multi-étapes critiques sont transactionnelles ou compensables et idempotentes.
- **NFR-REL-003** Les migrations de schéma disposent d'un dry-run, d'une validation de données et d'une stratégie de rollback ou roll-forward.
- **NFR-REL-004** Aucune erreur d'intégration ne se traduit par page blanche, spinner infini ou succès trompeur.
- **NFR-REL-005** Les duplications temporaires de modèle ont un propriétaire, une télémétrie et un critère de suppression.
- **NFR-REL-006** L'import d'un bordereau est idempotent à fichier et version identiques, peut reprendre après interruption et fournit un bilan réconciliant lignes lues, importées, ignorées et en anomalie.

### Performance

- **NFR-PERF-001** Les routes principales sont chargées à la demande sans déplacer la logique métier dans les composants de présentation.
- **NFR-PERF-002** Après instrumentation de référence, le p75 de l'affichage catalogue et produit ne doit pas régresser de plus de 10 % pendant la reprise.
- **NFR-PERF-003** Un calcul de prix obsolète ne doit jamais bloquer la saisie ou écraser une réponse plus récente.
- **NFR-PERF-004** Les mockups et assets stables utilisent un cache avec invalidation explicite.
- **NFR-PERF-005** L'import et la consultation d'un bordereau au volume cible validé ne bloquent pas l'interface ; la volumétrie de référence et les seuils p75 de traitement serveur et d'affichage seront fixés après mesure sur des fichiers représentatifs.

### Accessibility and usability

- **NFR-A11Y-001** Les parcours d'authentification, catalogue, configuration, panier, checkout, compte et administration critique visent WCAG 2.1 AA.
- **NFR-A11Y-002** Toute action métier reste utilisable au clavier, possède un nom accessible et expose son état sans dépendre uniquement de la couleur.
- **NFR-A11Y-003** Les layouts critiques sont vérifiés sur mobile, tablette et desktop avant livraison.
- **NFR-A11Y-004** Les identifiants de test publiés restent stables ou suivent une période de compatibilité documentée.

### Maintainability and testability

- **NFR-MNT-001** Les règles métier résident dans des fonctions, services ou hooks testables, distincts du rendu React.
- **NFR-MNT-002** Chaque frontière externe dispose de fixtures et de tests de contrat couvrant succès, timeout, données invalides et indisponibilité.
- **NFR-MNT-003** Une tranche de reprise ne peut être clôturée que si les tests unitaires, intégration, RLS/RPC, E2E critique et accessibilité proportionnels au risque passent.
- **NFR-MNT-004** Le build TypeScript et les migrations sont reproductibles depuis un environnement documenté.
- **NFR-MNT-005** Les packages candidats ne partagent pas directement leurs tables ou composants internes une fois leurs contrats stabilisés.

## Success Measures

Les valeurs finales doivent être validées avec le Product Owner après mise en place de la baseline. Les mesures suivantes définissent ce qu'il faut instrumenter avant de fixer des engagements.

| Objectif | Indicateur | Première cible proposée |
|---|---|---|
| Accélérer le devis | Temps entre demande qualifiée et devis sauvegardé | Baseline puis amélioration de 30 % |
| Réduire les erreurs | Taux de configurations nécessitant une correction manuelle après calcul | Baseline puis réduction de 25 % |
| Activer une boutique | Temps entre création tenant et première boutique avec un produit commandable | Moins d'une journée ouvrée |
| Faciliter l'achat | Taux de checkout terminé après ajout panier | Baseline puis progression continue |
| Favoriser la récurrence | Part des commandes créées par renouvellement | À mesurer par cohorte tenant |
| Garantir l'isolation | Incidents ou tests cross-tenant en échec | 0 incident ; 100 % des gates verts |
| Stabiliser la reprise | Régressions critiques par tranche de refactor | 0 avant passage à la tranche suivante |
| Réduire la dette | Lectures/écritures sur modèles legacy | 0 avant suppression documentée |
| Accélérer les appels d'offres | Temps entre réception du DCE et dossier prêt à déposer | Baseline puis objectif d'amélioration à valider |
| Fiabiliser les réponses | Part des lignes exportées sans anomalie critique non traitée | 100 % |
| Réutiliser la connaissance print | Part des lignes rapprochées d'un produit, d'une configuration ou d'un historique validé | Baseline puis progression continue |
| Mesurer la performance commerciale AO | Taux de dossiers déposés, gagnés et perdus, par tenant et période | Baseline par cohorte tenant |

## Acceptance and Evidence Strategy

Chaque exigence planifiée doit être reliée à une preuve proportionnée :

- fonctions pures et schémas : tests unitaires et cas limites ;
- repositories, hooks et edge functions : tests d'intégration avec doubles contrôlés ;
- RLS, RPC, rôles et transitions : tests base positifs et négatifs avec plusieurs tenants ;
- parcours utilisateur critiques : Playwright sur un environnement représentatif ;
- accessibilité : axe automatisé complété par clavier et responsive ;
- intégrations Clariprint, Anthropic et email : tests de contrat, timeouts et reprises ;
- migration brownfield : comparaison avant/après, métrique de fallback et preuve de rollback.
- import et export d'appels d'offres : jeux de fichiers représentatifs, conservation des formules et formats utiles, réconciliation ligne à ligne et test de non-régression sur les fichiers sources retenus.

La Definition of Done d'une tranche inclut : exigences acceptées, décisions enregistrées, tests verts, absence de nouvelle dette silencieuse, observabilité suffisante et documentation du changement de contrat.

## Data and Integration Boundaries

### Supabase

Supabase fournit actuellement l'authentification, Postgres, RLS, RPC, edge functions et storage. La reprise doit traiter ces éléments comme plusieurs frontières techniques, même s'ils partagent la même plateforme. Les policies et fonctions `security definer` sont du code métier critique.

### Clariprint

Clariprint est une source technique et tarifaire externe. Le connecteur doit posséder des types d'entrée/sortie, une normalisation d'unités, une classification d'erreurs, des délais maximum, une politique de retry et des fixtures contractuelles. Toute divergence entre donnée Clariprint et donnée PIM doit être explicite.

### LLM

Le LLM assiste la qualification, la structuration et l'enrichissement. Ses réponses sont non déterministes : elles doivent être validées, versionnées par prompt/modèle si elles affectent une donnée persistée, observées en coût et latence, et révisables.

### Notifications

Les emails et autres notifications sont des effets secondaires après persistance de l'événement métier. Ils doivent être idempotents, retentables et corrélés à l'objet source.

### Dossiers de consultation et bordereaux

Les pièces de DCE et les bordereaux sont des sources externes potentiellement hétérogènes, volumineuses et confidentielles. L'ingestion doit séparer le fichier original immuable, sa version, le mapping appliqué, les données normalisées et les corrections humaines. Les parseurs de documents et de tableurs sont des frontières non fiables : ils doivent imposer des limites de taille, neutraliser les contenus actifs, résister aux formules malveillantes et produire un bilan d'import explicite. L'export ne doit jamais altérer l'original et doit permettre de rattacher chaque cellule produite à une ligne métier validée.

## Migration and Rebuild Strategy

1. **Baseline.** Exécuter les suites locales, inventorier les environnements et capturer les parcours critiques.
2. **Model map.** Relier chaque concept produit aux tables, RPC, edge functions, contexts, hooks et écrans actuels.
3. **Canonical contracts.** Décider les modèles cibles et écrire des tests de caractérisation autour de l'existant.
4. **Internal boundaries.** Créer des modules de domaine et ports explicites dans le dépôt actuel.
5. **Vertical migration.** Migrer un parcours complet à la fois derrière une bascule contrôlée.
6. **Legacy retirement.** Mesurer l'absence d'usage, sauvegarder, puis retirer les chemins historiques avec migration dédiée.
7. **Package decision.** Extraire un package uniquement si son contrat est stable et si l'extraction apporte un bénéfice opérationnel mesurable.

## Risks

| Risque | Impact | Réponse attendue |
|---|---|---|
| PRD historique confondu avec la vision produit | Repriorisation incohérente | Maintenir ce PRD global et utiliser des delta PRD par évolution |
| Deux modèles de commandes ou devis coexistent | Divergence et perte de données | Définir un canon, instrumenter les fallbacks, migrer avant suppression |
| Règles d'accès réparties entre UI, RLS et RPC | Fuite ou blocage légitime | Matrice de capacités et tests multi-acteurs à chaque frontière |
| Couplage React/Supabase direct | Refactor risqué et tests fragiles | Introduire repositories et contrats de domaine par tranche |
| Données Clariprint incomplètes ou variables | Prix faux ou parcours bloqué | Adaptateur unique, provenance, fallback honnête et validation humaine |
| Sorties LLM invalides | Données incohérentes | Schémas stricts, observabilité, versionnement et revue humaine |
| DCE ou bordereaux hétérogènes | Import incomplet, lignes perdues ou export inutilisable | Prévisualisation du mapping, conservation de la source, bilan de réconciliation et corpus de fichiers de référence |
| Formules, macros ou fichiers bureautiques malveillants | Exécution indésirable ou fuite de données | Analyse isolée, formats autorisés, limites de ressources, neutralisation des contenus actifs et antivirus |
| Échéance ou exigence mal extraite | Réponse non conforme ou hors délai | Citation de la source, confirmation humaine et alertes déterministes basées sur les données validées |
| Chiffrage en masse erroné | Marge dégradée ou engagement commercial incorrect | Provenance des prix, contrôles d'écart, validation par lot et audit des dérogations |
| Extraction prématurée en packages | Complexité distribuée sans gain | Stabiliser les frontières dans le monolithe d'abord |
| État réel des déploiements non documenté | Baseline trompeuse | Inventaire séparé des environnements et configurations |
| Métriques business non instrumentées | Décisions sur intuition | Plan d'événements et baseline avant objectifs contractuels |

## Open Decisions

Ces points nécessitent une décision produit ou opérationnelle avant le plan de livraison détaillé :

1. Quel segment est prioritaire pour les douze prochains mois : imprimeur traditionnel, W2P, grand compte industriel ou intégrateur ?
2. Quel est le parcours commercial cœur à optimiser en premier : devis assisté, création de boutique ou réassort acheteur ?
3. Où se situe exactement la frontière d'autorité entre Clariprint, PIM Magrit, bibliothèque tenant et saisie humaine ?
4. Quels statuts de devis et commande sont contractuels pour la V1, et lesquels sont internes ?
5. Le prix marché estimé est-il une fonction de démonstration, une aide commerciale ou une future offre de données ?
6. Quels plans tarifaires et quotas sont réellement commercialisés aujourd'hui ?
7. Quelles boutiques et quels environnements sont actifs, pilotes ou purement démonstratifs ?
8. Quelles obligations RGPD, conservation, disponibilité et support sont promises contractuellement ?
9. Les candidats de packages OWK doivent-ils rester dans un monorepo ou viser plusieurs dépôts à terme ?
10. Quel niveau de compatibilité doit être maintenu avec les anciens objets `shop_orders` et les anciennes routes ?
11. Le premier périmètre appels d'offres vise-t-il uniquement les BPU/DPGF tabulaires ou l'ensemble du DCE administratif et technique ?
12. Quels formats doivent être garantis au lancement : XLSX, XLS, CSV, ODS, PDF natif et PDF scanné ?
13. L'export doit-il préserver strictement la mise en forme, les formules, feuilles masquées et protections du classeur source ?
14. Quels volumes réels définissent le cas « grands volumes » : nombre de fichiers, feuilles, lignes, lots et taille totale du DCE ?
15. Quelles plateformes de dépôt et quels mécanismes de signature électronique pourraient être intégrés ultérieurement, et avec quelle responsabilité juridique ?
16. Quelles capabilities distinguent préparation, chiffrage, validation finale, export et déclaration du résultat ?
17. Les variantes, options, reconductions, tranches et critères de notation doivent-ils être modélisés dès la première version ?

## Source Traceability

Ce PRD a été reconstruit à partir des sources locales suivantes :

- `_bmad-output/planning-artifacts/prd.md` — PRD historique e-shop v1.1 ;
- `_bmad-output/planning-artifacts/architecture.md` et `V3_MULTI_TENANT.md` — décisions techniques historiques ;
- `_bmad-output/planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md` — qualité et suites de livraison ;
- `_bmad-output/implementation-artifacts/retrospective-epic-7-2026-07-27.md` — dernier état fonctionnel consolidé ;
- `src/app/routes.tsx`, composants, contexts, hooks et schémas — surface applicative présente ;
- `supabase/migrations/` et `supabase/functions/` — modèle serveur et intégrations ;
- `tests/` — preuves et intentions de validation ;
- `/Users/xpech/dev/owk-factory/docs/prd-intake-contract.md` — contrat de format Factory.

Les références à des décisions commerciales externes présentes dans le PRD historique n'ont pas été reconduites comme faits actuels sans validation. L'état d'un déploiement distant n'est pas déduit de la seule présence du code dans le dépôt.

## Change Policy

- Ce fichier est la baseline globale et évolue lentement par décision produit validée.
- Une évolution de scope significative commence par un delta PRD distinct.
- Une exigence supprimée reste traçable dans l'historique Git et dans le delta qui motive sa suppression.
- Les epics, stories et plans d'implémentation référencent les identifiants FR, BR et NFR de ce document.
- Après validation du Product Owner, le statut passe de `draft` à `approved` et la version à `1.0`.
