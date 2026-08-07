# Analyse de la source PrintMaster / Base44

**Source :** [`prompt  - base44 - PrintMaster.txt`](./prompt%20%20-%20base44%20-%20PrintMaster.txt)  
**Date d'analyse :** 2026-08-07  
**Statut :** source historique et fonctionnelle à consolider

## Nature de la source

Le fichier regroupe des prompts successifs utilisés pour faire évoluer une maquette Base44. Il contient quatre niveaux d'information qu'il ne faut pas confondre :

1. des besoins métier répétés et structurants ;
2. des propositions de modèle et de workflow ;
3. des choix d'ergonomie propres à la maquette ;
4. des corrections ou variantes qui remplacent des demandes antérieures.

Le fichier n'est donc pas une spécification contractuelle en l'état. Les besoins consolidés alimentent le PRD et les spécifications. Les listes détaillées deviennent des référentiels candidats à valider avec le solveur et les experts métier.

## Terminologie observée

| Terme de la source | Interprétation proposée | Statut |
|---|---|---|
| PrintMaster | Nom historique de l'application de paramétrage imprimeur | Alias à confirmer |
| HubMaster / Price Factory | Niveau tenant/BU et référentiels mutualisés | Alias à confirmer |
| PrinterEnvironment | Configuration versionnable d'un site ou fournisseur imprimeur | Concept retenu, nom à valider |
| PaperEnvironment | Offre ou environnement d'un fournisseur matière | Concept candidat |
| TransportEnvironment | Offre ou environnement d'un transporteur | Concept candidat |
| ProjectEnvironment | Espace de projets/devis de test | Hors cœur Data, intégration candidate |
| Catalogue de production | Snapshot complet de configuration | À aligner sur `Publication` |
| Barème | Règle conditionnelle de performance et/ou de coût d'un poste | Concept retenu |
| Testing | Exécution de cas de référence par le solveur | Intégration de validation, pas calcul interne |

## Informations structurantes retenues

### Gouvernance

- hiérarchie `tenant → BU → environnements` ;
- administration globale par tenant et déléguée par BU ;
- rôles spécialisés pour imprimantes, matières, transport et projets ;
- délégation possible de l'édition d'un environnement à un utilisateur externe ou partenaire ;
- environnement activable, désactivable, modifiable, validable, publiable et archivable.

### Printer Environment

- informations du site : identité, adresse, zones géographiques, identifiant légal, devise et système d'unités ;
- agréments et certifications ;
- préférences de calcul et de production ;
- machines et postes de travail ;
- prestations réalisables et contraintes techniques ;
- barèmes associés ;
- catalogues papier/support ;
- grilles de transport ;
- tests de référence ;
- publications versionnées.

### Machines et postes

- taxonomie détaillée de presses, façonnage, découpe, assemblage et postes manuels ;
- types de supports acceptés ;
- dimensions d'entrée et zones non transformables ;
- prestations filtrées selon le type de poste ;
- technologie, méthodes d'impression, teintes et finitions ;
- test unitaire d'application des barèmes.

Les listes de types et prestations sont des référentiels candidats. Elles contiennent des doublons, fautes et variantes ; elles doivent être normalisées et versionnées avant implémentation.

### Barèmes

- conditions sur prestation, support, format fini, pages, postes, passes, exemplaires et surface ;
- coûts fixes, au millier, horaires, surfaciques et limitations de cadence ;
- variations en pourcentage ;
- gâche fixe et proportionnelle ;
- import/export tabulaire ;
- sélection des barèmes applicables ;
- test tabulaire expliquant chaque composante du coût ;
- modification en lot avec sauvegarde explicite, sans update live.

### Matières

- référentiel de marques de support au niveau BU ;
- famille textuelle modifiable et type de matière contrôlé ;
- compatibilités avec les procédés d'impression ;
- certifications presse, feu et environnement ;
- fournisseurs matière qualifiés ;
- catalogue SKU global BU ;
- unicité proposée `fournisseur + SKU` ;
- imports complet et tarifaire séparés ;
- création contrôlée des fournisseurs et marques inconnus ;
- tarifs, minimums, unités et paliers.

La correction la plus récente supprime l'entité structurée « famille de support » au profit d'une famille textuelle et d'un type de matière contrôlé.

### Transport

- transporteurs qualifiés au niveau BU ;
- grilles datées et activables ;
- type de transport et délai ;
- contraintes de poids, dimension, périmètre et volume ;
- frais fixes, minimum, gasoil et suppléments ;
- matrice zones d'enlèvement/destination × tranches de poids ;
- import/export CSV.

### Publication

- snapshot complet de la configuration ;
- auteur, commentaire, dates de validité et statut ;
- export JSON et document de validation ;
- passage `à valider → en production → archivé` ;
- restauration d'une ancienne configuration.

La restauration doit créer un nouveau brouillon fondé sur l'ancienne publication. Elle ne doit pas écraser une publication ni réécrire l'historique.

## Informations retenues comme exigences UX, pas comme modèle métier

- dashboard avec filtres et statuts ;
- wizard séquentiel de création ;
- panneaux rétractables et dispositions en deux ou trois colonnes ;
- fenêtres modales ;
- colonnes figées dans les grilles ;
- résumés abrégés des conditions et coûts ;
- boutons copier, exporter et recalculer ;
- mise en évidence des modifications non sauvegardées.

Ces éléments doivent alimenter les parcours UX, mais ne déterminent pas la structure des agrégats ou des tables.

## Éléments hors cœur ou à séparer

- implémentation technique i18n propre à Base44 ;
- calcul complet de devis projet, qui reste sous la responsabilité du solveur ;
- Hopes-Studio et OptimProject, qui sont des intégrations externes à spécifier ;
- statistiques de dashboard tenant, qui relèvent de l'administration plateforme ;
- détails de framework JavaScript de la maquette.

L'exigence produit `fr/en` peut être conservée comme NFR, sans reprendre l'implémentation i18n « lite » de la maquette.

## Conflits et arbitrages proposés

| Sujet | Source PrintMaster | Architecture retenue |
|---|---|---|
| Fournisseurs | Environnements séparés imprimeur/papier/transport | Fournisseur multi-capacités, avec environnements ou vues spécialisées |
| Restauration | Écrase les données courantes | Crée un nouveau brouillon depuis une publication |
| Suppression de version | Bouton supprimer | Archivage ; suppression physique interdite si publiée |
| Partage | Lien et code OTP ad hoc | Délégation temporaire capability-scoped via identity/tenant/access |
| Tests devis | Calcul présenté dans l'application | Clariprint Data prépare les cas et affiche la réponse du solveur |
| Barèmes | Formulaire mêlant performance et coût | Concepts séparés mais règle composite possible dans l'export |
| Référentiel famille matière | Entité puis suppression | Dernière correction retenue : famille textuelle + type contrôlé |
| i18n | Implémentations i18next puis « lite » | Exigence fr/en ; choix technique distinct |

## Nouvelles décisions nécessaires

1. `PrinterEnvironment` est-il un agrégat métier distinct du fournisseur et du site, ou une vue/version de leur configuration ?
2. Une BU est-elle un tenant enfant existant ou un concept organisationnel distinct ?
3. Paper/Transport Environments sont-ils des fournisseurs à capacité spécialisée ou des espaces de données autonomes ?
4. Quels barèmes sont consommés directement par le solveur et sous quel schéma ?
5. Le test unitaire de barème est-il calculé localement ou uniquement par un validateur officiel du solveur ?
6. Quels référentiels machines, supports, prestations et certifications font autorité ?
7. La délégation temporaire exige-t-elle un compte persistant, une invitation ou une identité OTP éphémère ?
8. Quels écrans et fonctions PrintMaster entrent réellement dans le MVP Clariprint Data ?
9. Les référentiels matière et transport BU sont-ils inclus dans la publication de chaque Printer Environment ou référencés par version ?
10. Quel système est propriétaire des projets et résultats de test ?

## Traçabilité

Les ajouts issus de cette source sont marqués `PrintMaster` dans le PRD ou reliés à ce document. Une liste détaillée issue du prompt ne devient un enum contractuel qu'après normalisation et validation dans un référentiel versionné.
