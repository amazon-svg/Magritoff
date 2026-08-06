# Capacité `economics`

**Statut :** draft

## Responsabilité

Maintenir les paramètres économiques consommés par le solveur, avec provenance, dates d'effet, séparation des droits et historique.

## Concepts

- `EconomicParameter` ;
- `EffectiveValue` ;
- `CostCategory` ;
- devise et unité ;
- provenance et justification.

## Cas d'usage

- consulter les paramètres autorisés ;
- créer une valeur datée ;
- corriger une valeur future ;
- clôturer la période d'une ancienne valeur ;
- comparer les valeurs entre deux publications ;
- contrôler la complétude financière.

## Invariants

- aucun calcul métier en virgule flottante ;
- devise et unité obligatoires lorsque pertinentes ;
- absence distincte de zéro ;
- périodes cohérentes et sans sélection ambiguë ;
- ancienne valeur conservée ;
- provenance obligatoire ;
- marge commerciale exclue tant que sa propriété n'est pas décidée.

## Sécurité

- lecture et édition utilisent des capabilities distinctes ;
- les DTO non financiers n'exposent aucun champ sensible ;
- les contrôles sont réalisés côté serveur et en RLS/RPC ;
- l'audit ne recopie que les champs autorisés.

## Validation

- [ ] Un utilisateur technique ne peut ni lire ni modifier un coût.
- [ ] Une nouvelle valeur ne modifie pas une publication passée.
- [ ] Zéro et absence produisent des résultats de validation différents.
- [ ] Les chevauchements interdits sont rejetés transactionnellement.
- [ ] Les conversions et arrondis utilisent les conventions J0.
- [ ] Chaque modification est datée, justifiée et auditée.

## Décisions ouvertes

- paramètres exacts du pilote ;
- propriété de la marge ;
- multi-devise ;
- double validation des changements financiers.
