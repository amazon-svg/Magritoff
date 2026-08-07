# Capacité `material-references`

**Statut :** draft

## Responsabilité

Maintenir au niveau BU les fournisseurs matière, marques qualifiées et SKU mutualisés, puis fournir des références versionnées aux environnements.

## Concepts

- `MaterialSupplier` ;
- `MaterialBrand` ;
- `MaterialTypeRef` ;
- famille textuelle normalisée ;
- `MaterialSku` ;
- `SkuPriceTerms` ;
- version de catalogue.

## Qualification des marques

Une marque peut porter :

- type de matière contrôlé ;
- famille textuelle modifiable ;
- tenue au feu ;
- certifications presse numérique ;
- procédés d'impression compatibles ;
- labels environnementaux.

Ces dimensions proviennent de référentiels versionnés. Les noms issus du prompt PrintMaster doivent être nettoyés et validés avant création d'enums.

## SKU

Le SKU distingue :

- fournisseur et identifiant fournisseur ;
- type de support, marque, libellé et couleur ;
- grammage, épaisseur et dimensions avec unités ;
- conditionnement ;
- minimum et unité de commande ;
- tarif et unité de tarification ;
- remises, bornes et variations éventuelles.

La clé candidate `fournisseur + SKU` doit être confirmée sur des données réelles.

## Cas d'usage

- qualifier un fournisseur ou une marque ;
- rechercher et filtrer les SKU ;
- importer un catalogue complet ;
- importer une mise à jour tarifaire ;
- prévisualiser les fournisseurs ou marques inconnus ;
- exporter le catalogue ;
- publier une version de référentiel BU ;
- sélectionner cette version dans un environnement.

## Invariants

- identifiants stables indépendants des libellés normalisés ;
- fournisseur et marque inconnus créés au statut `à qualifier` uniquement ;
- aucune création automatique directement productive ;
- unités compatibles avec la forme du support ;
- prix datés, précis et traçables ;
- une publication d'environnement référence une version immuable ou snapshotte les SKU utilisés.

## Validation

- [ ] Deux imports du même fournisseur/SKU ne créent pas de doublon.
- [ ] Un import tarifaire ne modifie pas les qualifications techniques.
- [ ] Une marque inconnue est visible dans la file de qualification.
- [ ] Les codes de type support sont contrôlés et documentés.
- [ ] Une mise à jour BU ne change pas une publication existante.
- [ ] Les recherches n'exposent aucun catalogue d'une autre BU non autorisée.

## Décisions ouvertes

1. Modèle de partage des référentiels entre BU.
2. Statut définitif de la famille textuelle.
3. Normalisation fournisseur/SKU et gestion des fusions.
4. Copie ou référence versionnée dans les publications.

