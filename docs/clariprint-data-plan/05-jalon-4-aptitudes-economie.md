# J4 — Aptitudes, performance et paramètres économiques

**Statut initial :** à préparer  
**Dépendance :** J3

**Spécifications applicables :** [aptitudes techniques](../architecture/specifications/modules/clariprint-data/capabilities/technical-capabilities.md), [économie](../architecture/specifications/modules/clariprint-data/capabilities/economics.md), [barèmes](../architecture/specifications/modules/clariprint-data/capabilities/pricing-schedules.md)

## Goal

Décrire ce qui est techniquement réalisable et les paramètres nécessaires au coût du flux pilote, sans confondre aptitude, performance et économie.

## Périmètre

- aptitudes techniques ;
- bornes, listes de valeurs, compatibilités et exclusions ;
- opérations et enchaînements du pilote ;
- temps fixes et cadences ;
- gâche et consommation ;
- coûts retenus au J0 ;
- provenance et dates d'effet ;
- séparation des droits techniques et financiers.

## Livrables

1. Modèles typés d'aptitude, contrainte, performance et paramètre économique.
2. Validateurs métier par famille couverte.
3. Cas d'usage de mise à jour technique et financière.
4. Vue de complétude d'une machine ou ressource.
5. Tests sur zéro, absence, non-applicable, unités et arrondis.
6. Tests d'accès aux données financières.
7. Barèmes minimaux du poste pilote et cas de test explicables.

## Critères de validation

- [ ] `J4-VAL-01` Le flux pilote est entièrement représentable avec les structures retenues.
- [ ] `J4-VAL-02` Une aptitude indique ce qui est réalisable sans contenir de coût.
- [ ] `J4-VAL-03` Une cadence ou un temps ne constitue pas à lui seul une aptitude.
- [ ] `J4-VAL-04` Zéro, valeur absente et non-applicable sont trois états distincts.
- [ ] `J4-VAL-05` Toute valeur possède une unité canonique et une règle de conversion testée.
- [ ] `J4-VAL-06` Un coût possède une provenance et une date d'effet.
- [ ] `J4-VAL-07` Une nouvelle valeur n'altère pas rétroactivement la valeur applicable à une publication antérieure.
- [ ] `J4-VAL-08` Un éditeur technique ne peut ni lire ni modifier les champs financiers protégés.
- [ ] `J4-VAL-09` Un éditeur financier ne peut modifier les contraintes techniques sans capability correspondante.
- [ ] `J4-VAL-10` Les contradictions du jeu de référence sont détectées selon le catalogue J0.
- [ ] `J4-VAL-11` Les prestations et supports d'un barème sont limités à ceux du poste.
- [ ] `J4-VAL-12` Le test officiel du barème référence le solveur ou validateur retenu.

## Scénario de démonstration

Configurer la machine du flux pilote, sa matière, ses formats, sa cadence, son temps de calage, sa gâche et ses coûts ; faire apparaître une erreur de complétude, la corriger puis vérifier la séparation des droits.

## Condition de sortie

Toutes les données consommées par le solveur pour le flux pilote sont représentables, contrôlées et protégées selon leur sensibilité.
