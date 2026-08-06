# Capacité `suppliers`

**Statut :** draft

## Responsabilité

Maintenir l'identité des fournisseurs, leurs sites et leurs capacités métier sans dupliquer un fournisseur lorsqu'il cumule plusieurs activités.

## Concepts

- `Supplier` ;
- `Site` ;
- `SupplierCapability` ;
- statut, provenance et période d'effet.

## Cas d'usage

```ts
interface SupplierService {
  create(actor: ActorContext, command: CreateSupplier): Promise<Result<Supplier, SupplierError>>;
  update(actor: ActorContext, command: UpdateSupplier): Promise<Result<Supplier, SupplierError>>;
  archive(actor: ActorContext, command: ArchiveSupplier): Promise<Result<void, SupplierError>>;
  setCapabilities(actor: ActorContext, command: SetSupplierCapabilities): Promise<Result<Supplier, SupplierError>>;
  get(actor: ActorContext, id: SupplierId): Promise<Result<Supplier | null, SupplierError>>;
  search(actor: ActorContext, query: SupplierSearch): Promise<Result<Page<SupplierSummary>, SupplierError>>;
}
```

## Invariants

- identité unique dans le périmètre défini au J0 ;
- au moins un nom exploitable ;
- une capacité est issue d'un référentiel contrôlé ;
- archivage sans destruction des références historiques ;
- une période possède des bornes cohérentes ;
- aucune lecture ou écriture cross-tenant.

## Données et ports

`SupplierRepository` expose recherche tenant-scoped, chargement, sauvegarde optimiste et archivage. Les critères de doublon sont métier et ne reposent pas uniquement sur le nom.

## Événements

- `supplier.created` ;
- `supplier.updated` ;
- `supplier.archived` ;
- `supplier.capabilities_changed`.

## Validation

- [ ] Un fournisseur cumule plusieurs capacités sous un seul identifiant.
- [ ] Deux modifications concurrentes ne s'écrasent pas silencieusement.
- [ ] Un fournisseur archivé reste présent dans une publication historique.
- [ ] La recherche et les erreurs ne divulguent aucune donnée cross-tenant.
- [ ] Les modifications sont auditées avec leur provenance.

## Décisions ouvertes

- clé de détection des doublons ;
- fournisseur global partagé ou copie tenant-scoped ;
- site obligatoire ou facultatif au MVP.

