# Capacité `resources`

**Statut :** draft

## Responsabilité

Maintenir les ressources propres ou proposées par un fournisseur : machines, offres matière et grilles de transport du périmètre pilote.

## Concepts

- `Machine` ;
- `MaterialReference` et `MaterialOffer` ;
- `TransportGrid` ;
- statut et période d'effet ;
- provenance.

## Cas d'usage

- créer, modifier, désactiver et consulter une machine ;
- gérer les offres matière et leurs tarifs datés ;
- gérer les grilles de transport ;
- rechercher les ressources d'un fournisseur ou site ;
- calculer les ressources propres actives à une date.

## Invariants

- une ressource appartient à un fournisseur et, si requis, à un site ;
- la famille et les unités proviennent des référentiels acceptés ;
- désactiver ne supprime jamais une référence historique ;
- une offre matière distingue la matière de ses conditions d'achat ;
- une grille ne contient que les dimensions définies pour le pilote ;
- les périodes qui se chevauchent suivent une règle explicite, sans choix arbitraire.

## Ports

```ts
interface ResourceRepository {
  getMachine(scope: TenantScope, id: MachineId): Promise<Machine | null>;
  saveMachine(machine: Machine, expectedVersion: number): Promise<void>;
  listActiveResources(scope: SupplierScope, effectiveAt: Date): Promise<readonly ProductionResource[]>;
}
```

## Validation

- [ ] Les trois familles du MVP sont distinguées par des types explicites.
- [ ] La désactivation conserve les snapshots antérieurs.
- [ ] Les unités et périodes invalides sont refusées.
- [ ] Un tarif matière daté ne remplace pas rétroactivement une ancienne valeur.
- [ ] Une ressource ne peut être rattachée à un fournisseur d'un autre tenant.

## Décisions ouvertes

- familles exactes du pilote ;
- modèle de transport ;
- héritage depuis un modèle de machine ;
- partage éventuel de ressources entre sites.

