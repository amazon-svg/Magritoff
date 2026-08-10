# Glossaire candidat Clariprint Data

**Statut :** draft à valider avec les experts métier  
**Sources :** PRD 0.6, PRD initial PrintFlow Pro et corpus PrintMaster/Base44

## Gouvernance

| Terme | Définition candidate | Synonymes historiques | Point à confirmer |
|---|---|---|---|
| Tenant | Frontière principale de propriété et de sécurité d'une organisation cliente | Compte, organisation | Correspondance avec le client Clariprint |
| Business Unit | Sous-périmètre organisationnel ou régional possédant des administrateurs, référentiels et environnements | BU | Tenant enfant ou scope interne |
| Environnement de production | Configuration éditable et publiable d'un fournisseur/site dans un périmètre BU | Maker, PrinterEnv, PaperEnv, TransportEnv | Agrégat, vue ou dataset |
| Délégation | Grant temporaire donnant des capabilities limitées sur un environnement à un bénéficiaire authentifié | Partage, lien de partage | Type d'identité et invitation |

## Fournisseurs et ressources

| Terme | Définition candidate | Synonymes historiques | Point à confirmer |
|---|---|---|---|
| Fournisseur | Entité proposant une ou plusieurs capacités d'impression, façonnage, matière ou transport | Imprimeur, papetier, transporteur | Partage éventuel entre tenants |
| Site | Établissement physique auquel sont rattachées des ressources | Site de production | Obligatoire au MVP |
| Capacité fournisseur | Qualification cumulable décrivant une famille de services proposée | Type de fournisseur | Taxonomie canonique |
| Machine | Équipement industriel possédant caractéristiques, aptitudes et performances | Poste, équipement | Distinction machine/poste |
| Poste de travail | Ressource sur laquelle une opération et des barèmes peuvent être affectés, y compris un poste manuel | Poste, centre de charge | Relation avec machine physique |
| Prestation | Opération réalisable par un poste dans certaines conditions | Fonctionnalité, opération, façonnage | Référentiel solveur |
| Aptitude | Déclaration qu'une prestation est réalisable sur un domaine déterminé | Capacité technique | Structure par famille de poste |
| Contrainte | Borne, exclusion ou compatibilité limitant une aptitude | Condition technique | DSL ou schéma typé |
| Performance | Cadence, durée, consommation ou gâche contribuant à l'évaluation | Vitesse, temps, rendement | Unités canoniques |

## Économie et barèmes

| Terme | Définition candidate | Synonymes historiques | Point à confirmer |
|---|---|---|---|
| Paramètre économique | Valeur monétaire datée associée à un inducteur de coût de production | Coût | Catégories et unités attendues par le solveur |
| Barème | Règle versionnée associant conditions d'application, performance, coûts et gâche pour un poste | Catalogue de prix, tarif machine | Schéma et priorité officiels |
| Condition d'application | Prédicat contrôlé déterminant si un barème est applicable | DSL, filtre | Cumul et recouvrements |
| Cas unitaire de barème | Entrées de référence et résultat attendu permettant de vérifier le comportement du barème | Test unitaire machine | Solveur ou validateur officiel |
| Gâche | Quantité fixe ou proportionnelle consommée sans devenir produit livré | Gâche de calage, de roule, globale | Règles de cumul |

## Pool et accès calcul

| Terme | Définition candidate | Synonymes historiques | Point à confirmer |
|---|---|---|---|
| Pool de données source | Publication complète et immuable décrivant le parc, ses capacités, performances et montants de référence | Pool imprimeur, environnement publié, dataset | Relation exacte avec l'environnement de production |
| Nature des montants source | Qualification explicite des différentes catégories de coûts de production du pool | Type de coût | Granularité pool, publication ou montant |
| Coût de production | Montant représentant le coût supporté par l'imprimeur, sans marge, majoration, remise ni prix de vente | Prix de revient, coût industriel | Composantes incluses |
| Contrat d'accès calcul | Association versionnée entre un consommateur technique, un pool publié, des filtres de ressources, une période et des modes d'accès | Contrat de données, data contract | Sélecteur de publication |
| Clé API locale | Credential secret créé, rotatif et révocable indépendamment pour accéder à un contrat | Token, API key | Format et durée de vie |
| Mode d'accès externe | Résolution d'un contrat depuis un principal authentifié par un système de confiance extérieur | SSO machine, binding externe | Protocole de confiance |
| Projection solveur | JSON complet généré par Clariprint Data à partir d'une publication source, filtré par contrat et contenant les coûts de production | Dataset solveur | Durée de conservation |

## Matières

| Terme | Définition candidate | Synonymes historiques | Point à confirmer |
|---|---|---|---|
| Type de matière | Classification contrôlée d'un support | Type de support | Liste canonique et traduction |
| Famille matière | Libellé métier textuel et normalisé regroupant des marques | Famille de support | Conservation comme texte libre contrôlé |
| Marque de support | Identité commerciale qualifiée par procédés et certifications | Marque papier | Ownership BU ou global |
| SKU matière | Référence fournisseur achetable avec dimensions, conditionnement et tarif | Référence, référence catalogue | Unicité fournisseur + SKU |
| Catalogue matière | Version d'un ensemble de SKU et conditions proposées | Catalogue papier/support | Snapshot ou effectivité ligne par ligne |
| Fournisseur matière | Fournisseur proposant une capacité matière et des SKU | Acheteur papier dans certains prompts | Clarifier le terme « acheteur » historique |

## Transport

| Terme | Définition candidate | Synonymes historiques | Point à confirmer |
|---|---|---|---|
| Transporteur | Fournisseur proposant une capacité logistique | Carrier | Ownership et qualification |
| Grille de transport | Règle tarifaire datée croisant service, zones, contraintes et paliers | Matrice transport | Dimensions du MVP |
| Zone géographique | Identifiant contrôlé d'une origine ou destination | Code ISO, zone pays | Référentiel officiel |
| Tranche de poids | Intervalle ordonné utilisé par une grille | Palier | Bornes inclusives/exclusives |

## Cycle de vie

| Terme | Définition candidate | Synonymes historiques | Point à confirmer |
|---|---|---|---|
| Brouillon | État modifiable sans effet sur la production | En modification | Modèle de révision |
| Validation | Décision humaine confirmant la complétude avant publication | À valider | Simple ou double validation |
| Publication | Snapshot source complet, immuable, daté et versionné à partir duquel une projection peut être construite | Catalogue de production, version | Activation et période d'effet |
| Livraison solveur | Tentative d'envoi d'une publication brute ou d'une projection solveur et son résultat technique | Export, publication dans certains prompts | Protocole et retry |
| Sandbox | Copie isolée utilisée pour expérimenter et tester | Environnement test | Stockage copie ou delta |
| Restauration | Création d'un nouveau brouillon depuis une publication historique | Restaurer, rollback | Jamais un écrasement historique |
| Projet de validation | Cas produit destiné à vérifier une publication avec le solveur | Testing, devis test | Module propriétaire |

## Termes à éviter sans qualification

- `catalogue` seul : préciser matière, barèmes ou publication ;
- `environnement` seul : préciser production, sandbox ou destination solveur ;
- `capacité` seule : préciser fournisseur, aptitude technique ou quota ;
- `prix` seul : préciser coût, tarif d'achat, résultat solveur ou prix commercial ;
- `marge`, `majoration`, `remise` ou `prix de vente` : termes hors périmètre Clariprint Data ;
- `profil` seul : préciser profil utilisateur ou principal externe ;
- `clé` seule : préciser identifiant métier, clé API locale ou secret ;
- `partage` : préférer délégation, invitation ou grant ;
- `restauration` : rappeler qu'elle crée un nouveau brouillon.
