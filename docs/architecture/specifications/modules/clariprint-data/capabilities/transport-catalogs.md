# Capacité `transport-catalogs`

**Statut :** draft

## Responsabilité

Maintenir les transporteurs et grilles mutualisés d'une BU ainsi que les grilles propres à un environnement, avec contraintes, tarifs, périodes et provenance.

## Concepts

- `Carrier` ;
- `TransportGrid` ;
- `TransportServiceType` ;
- `DeliveryCommitment` ;
- `TransportConstraints` ;
- `TransportSurcharges` ;
- `ZonePair` ;
- `WeightBracket` ;
- version de catalogue.

## Données candidates

- fournisseur, coordonnées, devise et unités ;
- type de service et délai ;
- poids min/max ;
- plus grande dimension, périmètre et volume max ;
- enlèvement, minimum, frais fixe, taxe gasoil et hayon ;
- tarification forfaitaire ou à la tonne ;
- matrice zone d'enlèvement × destination × tranche de poids.

## Cas d'usage

- créer et qualifier un transporteur ;
- créer, activer, désactiver et versionner une grille ;
- éditer sa matrice tarifaire ;
- importer/exporter CSV avec prévisualisation ;
- détecter trous et recouvrements ;
- sélectionner une version dans un environnement.

## Invariants

- zones identifiées par un référentiel stable ;
- poids et dimensions utilisent des unités canoniques ;
- tranches strictement ordonnées et non ambiguës ;
- frais et variations conservent leur nature ;
- une grille BU et une grille propre imprimeur ont une provenance distincte ;
- une publication conserve la version effectivement utilisée.

## Validation

- [ ] Une zone et une tranche déterminent au plus une cellule tarifaire applicable.
- [ ] Les bornes incohérentes sont rejetées.
- [ ] Une taxe proportionnelle n'est pas stockée comme montant fixe.
- [ ] L'import réconcilie toutes les lignes et cellules.
- [ ] Une nouvelle version BU n'altère pas les publications antérieures.
- [ ] Le fournisseur d'origine reste visible dans l'export.

## Décisions ouvertes

1. Référentiel géographique canonique.
2. Périmètre exact des modes et délais du MVP.
3. Modèle de dépassement de dimensions.
4. Priorité entre grille BU, imprimeur et règle du payant.

