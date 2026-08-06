# J3 — Ressources industrielles et sous-traitance

**Statut initial :** à préparer  
**Dépendance :** J2

**Spécifications applicables :** [ressources](../architecture/specifications/modules/clariprint-data/capabilities/resources.md), [sous-traitance](../architecture/specifications/modules/clariprint-data/capabilities/subcontracting.md)

## Goal

Décrire les ressources propres et sous-traitées accessibles pour le flux pilote, sans exposer les ressources non contractualisées.

## Périmètre

- machines internes ;
- matières et tarifs papier du pilote ;
- grilles de transport du pilote ;
- contrats de sous-traitance ;
- autorisations explicites par machine et famille d'offre ;
- dates de validité ;
- détection des cycles ;
- absence de transitivité par défaut.

## Livrables

1. Modèles `Machine`, `MaterialOffer`, `TransportGrid` et `SubcontractingAgreement`.
2. Référentiels initiaux de types de machines, unités et opérations.
3. Cas d'usage de gestion des ressources.
4. Calcul du parc accessible à une organisation.
5. Interface de contractualisation d'un sous-traitant.
6. Tests de restriction des ressources partagées.

## Critères de validation

- [ ] `J3-VAL-01` Une machine est rattachée à un fournisseur et un site valides.
- [ ] `J3-VAL-02` Une matière distingue référence, format, grammage, unité, tarif et date d'effet.
- [ ] `J3-VAL-03` Une grille de transport utilise uniquement les dimensions décidées pour le pilote.
- [ ] `J3-VAL-04` Un contrat autorise une liste explicite de machines.
- [ ] `J3-VAL-05` Les offres papier et transport sont autorisées séparément.
- [ ] `J3-VAL-06` Une ressource non autorisée du sous-traitant reste invisible et non exportable.
- [ ] `J3-VAL-07` Un contrat expiré n'ouvre plus de ressource pour une nouvelle publication.
- [ ] `J3-VAL-08` Les cycles de sous-traitance sont rejetés ou signalés selon la décision J0.
- [ ] `J3-VAL-09` Aucune transitivité implicite n'est possible.
- [ ] `J3-VAL-10` Les suppressions logiques préservent les publications historiques.

## Scénario de démonstration

Créer deux fournisseurs, autoriser une machine du second comme ressource sous-traitée du premier, refuser ses offres papier et transport, puis vérifier que ses autres machines restent inaccessibles.

## Condition de sortie

Le parc accessible calculé correspond exactement aux ressources internes et aux autorisations contractuelles du scénario pilote.
