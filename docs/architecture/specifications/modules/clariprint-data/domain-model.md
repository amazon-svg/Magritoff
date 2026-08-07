# Modèle de domaine Clariprint Data

**Statut :** draft  
**Version :** 0.2

## Agrégats proposés

```text
BusinessUnitRef
  └── ProductionEnvironment
        ├── SupplierRef / SiteRef
        ├── Preferences
        └── ActivePublicationRef

Supplier
  ├── Sites
  └── SupplierCapabilities

ProductionResource
  ├── Machine
  ├── MaterialOffer
  └── TransportGrid

PricingSchedule
  └── Conditions + Performance + Economics + Waste

BusinessUnitReferenceCatalog
  ├── MaterialSuppliers / Brands / SKUs
  └── Carriers / TransportGrids

ClientProfile
  └── PricingPolicy versions

CalculationAccessContract
  ├── Pool / PublicationSelector / ResourceFilter
  ├── LocalApiCredentials
  └── ExternalAccessBindings

AdjustedDatasetProjection
  └── SourcePublication + Profile + Policy + DatasetHash

SubcontractingAgreement
  └── AuthorizedResourceRefs

WorkingDataset
  └── références versionnées vers le parc de travail

Publication
  └── snapshot immuable complet

Sandbox
  └── snapshot de travail dérivé d'une publication
```

Les frontières définitives d'agrégat doivent être validées par les transactions du flux pilote. Ce document interdit de traduire automatiquement chaque agrégat par une seule table.

## BU et environnement de production

La BU est pour l'instant une référence fournie par la plateforme tenant. `ProductionEnvironment` est le candidat pour représenter le périmètre de configuration, d'édition et de publication observé dans PrintMaster.

Il référence un fournisseur et éventuellement un site au lieu d'en recopier l'identité. Son type spécialise les écrans et données disponibles sans transformer imprimeur, papetier et transporteur en identités exclusives.

La correspondance entre BU, tenant enfant et scope RLS doit être décidée avant le schéma.

## Fournisseur

`Supplier` représente une identité juridique ou opérationnelle mobilisable. Il peut cumuler plusieurs capacités.

Invariants initiaux :

- appartient à une organisation propriétaire ;
- possède un identifiant stable ;
- possède au moins un nom ;
- une capacité ne duplique pas l'identité ;
- l'archivage n'efface pas l'historique ;
- un fournisseur archivé ne peut être ajouté à un nouveau dataset actif.

## Site

Un `Site` localise des ressources et paramètres dépendant d'un établissement.

Décisions ouvertes :

- un site est-il obligatoire pour chaque ressource du MVP ?
- une ressource peut-elle être partagée entre sites ?
- quelle profondeur organisationnelle est nécessaire ?

## Ressources

### Machine

Identité, famille, site, statut, dates d'effet et référence éventuelle à un modèle. Les aptitudes, performances et coûts sont séparés de l'identité de la machine.

### Offre matière

Représente une matière achetable auprès d'un fournisseur avec caractéristiques, formats, unité, tarif et période d'effet. Le référentiel matière et l'offre commerciale ne doivent pas être confondus.

### Grille de transport

Représente une capacité et un coût de livraison selon les dimensions retenues au J0. Elle ne devient pas un moteur logistique généraliste.

## Sous-traitance

`SubcontractingAgreement` relie un fournisseur client à un fournisseur exécutant et contient une allow-list de ressources ou familles d'offres.

Invariants initiaux :

- client et exécutant sont distincts ;
- période contractuelle explicite ;
- aucune transitivité implicite ;
- aucune ressource non autorisée n'est visible ou exportée ;
- les cycles sont rejetés pour le MVP proposé ;
- une publication historique conserve les ressources autrefois autorisées dans son snapshot.

## Aptitudes, performances et économie

Ces concepts sont distincts :

| Concept | Question |
|---|---|
| Aptitude | Cette ressource peut-elle réaliser l'opération ? |
| Contrainte | Dans quelles bornes ou conditions ? |
| Performance | À quelle cadence, avec quel temps ou quelle consommation ? |
| Paramètre économique | Quel coût contribue au calcul ? |

Une valeur possède une sémantique d'absence explicite : `known`, `unknown`, `not_applicable` ou, si validé, `unbounded`. La valeur numérique zéro reste une valeur connue.

## Barème

`PricingSchedule` est rattaché à une machine ou un poste et possède quatre sous-structures : conditions d'applicabilité, performance, économie et gâche. Les cas de test référencent une révision déterminée du barème et l'implémentation officielle du solveur ou validateur.

## Référentiels BU

Les catalogues matière et transport mutualisés sont versionnés indépendamment des environnements. Une publication doit soit embarquer les entrées utilisées, soit conserver une référence vers une version immuable garantissant sa reproductibilité.

## Profils clients et accès calcul

Le pool publié contient les montants source de l'imprimeur, qualifiés comme coûts de production ou tarifs commerciaux. `ClientProfile` porte des versions de `PricingPolicy` effectives dans le temps. Une politique contient une règle globale et des exceptions par machine.

`CalculationAccessContract` relie le profil à un pool, à un sélecteur de publication et à des filtres de ressources. Il peut être authentifié par plusieurs clés locales ou par un binding externe vers la référence publiée du profil.

`AdjustedDatasetProjection` est construit par Clariprint Data. Il contient le JSON solveur complet après filtrage et ajustement, ainsi que toutes les références de versions nécessaires à sa reproduction. Le solveur ne reçoit pas la responsabilité d'appliquer la politique client.

## Dataset de travail

Le dataset de travail est l'état modifiable utilisé pour préparer une publication. Il ne doit pas être confondu avec la somme implicite des dernières lignes de toutes les tables si cette approche empêche de reproduire un état antérieur.

Décision à prendre : versionnement effectif-dated, révisions explicites ou combinaison des deux.

## Publication

Une publication est un snapshot complet immuable du parc accessible, accompagné de :

- tenant et organisation ;
- version métier ;
- version du schéma d'échange ;
- auteur et date ;
- période d'effet ;
- empreinte du contenu ;
- statut de livraison indépendant.

La livraison peut échouer sans invalider ou modifier la publication.

## Sandbox

Un sandbox dérive d'une publication et évolue dans un environnement isolé. Il ne peut pas être activé directement en production. Sa promotion crée un nouveau brouillon contrôlable.

## Identité et versionnement

- les objets métier possèdent des identifiants stables ;
- une révision ne change pas l'identifiant métier ;
- un snapshot inclut les valeurs nécessaires à sa reproduction ;
- les références externes ne servent pas de clé primaire interne ;
- toutes les dates techniques sont UTC ;
- les périodes d'effet utilisent une convention de bornes documentée.

## Éléments à confirmer avant schéma SQL

1. Vocabulaire et taxonomie des capacités.
2. Familles de machines du pilote.
3. Modèle d'offres matière et transport attendu par le solveur.
4. Paramètres et unités consommés.
5. Granularité des dates d'effet.
6. Multi-sites et partage de ressources.
7. Référencement des versions par les calculs historiques.
8. Nature de `ProductionEnvironment` et correspondance BU/tenant.
9. Schéma et priorité des barèmes.
10. Copie ou référence des catalogues BU dans les publications.
11. Granularité de la nature coût de production / tarif commercial.
12. Formules et priorité des règles tarifaires client.
13. Protocole de résolution externe des profils.
