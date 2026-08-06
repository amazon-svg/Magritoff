# Capacité `technical-capabilities`

**Statut :** draft

## Responsabilité

Décrire les opérations réalisables par une ressource, leurs bornes, compatibilités, exclusions et performances nécessaires au solveur.

## Concepts

- `OperationType` ;
- `TechnicalCapability` ;
- `Constraint` ;
- `CompatibilityRule` ;
- `ProductionRate` ;
- `SetupTime` ;
- `WasteRule`.

## Séparation obligatoire

- aptitude : faisabilité ;
- contrainte : condition ou borne ;
- performance : cadence, temps, consommation ;
- économie : coût, traité dans `economics`.

## Cas d'usage

- déclarer une aptitude ;
- fixer bornes ou valeurs autorisées ;
- définir compatibilités et exclusions ;
- renseigner cadence, calage et gâche ;
- vérifier la complétude technique ;
- diagnostiquer une impossibilité structurelle.

## Invariants

- toute valeur a une unité canonique ;
- zéro, inconnu, non applicable et illimité sont distincts ;
- une borne minimale n'excède pas la maximale ;
- une règle référence uniquement des concepts du référentiel versionné ;
- pas de code utilisateur arbitraire dans les règles ;
- les règles du pilote restent déclaratives et testables.

## Validation

- [ ] Le flux pilote est entièrement représentable.
- [ ] Une aptitude ne contient aucun coût.
- [ ] Une cadence ne crée pas implicitement une aptitude.
- [ ] Les contradictions sont détectées et expliquées.
- [ ] Les conversions d'unités sont testées sur les limites.
- [ ] Une donnée manquante n'est jamais remplacée silencieusement par zéro.

## Décisions ouvertes

- DSL ou structures typées par famille ;
- versionnement des référentiels ;
- enchaînements d'opérations requis par le solveur ;
- tolérances et conventions d'arrondi.

