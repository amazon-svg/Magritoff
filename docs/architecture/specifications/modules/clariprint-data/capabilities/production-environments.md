# Capacité `production-environments`

**Statut :** draft

## Responsabilité

Gérer le périmètre éditable et publiable d'une configuration de production rattachée à une BU, un fournisseur et éventuellement un site.

## Concepts

- `ProductionEnvironmentId` ;
- `EnvironmentKind` candidat : printer, paper, transport ;
- `BusinessUnitRef` ;
- `SupplierRef` et `SiteRef` ;
- statut d'activation ;
- statut de travail et référence de publication active ;
- préférences versionnées ;
- certifications versionnées.

`ProjectEnvironment` reste hors cœur tant que la propriété des projets n'est pas décidée.

## Cas d'usage

- créer un environnement brouillon ;
- renseigner identité, zone, devise et unités ;
- activer, désactiver ou archiver ;
- configurer les certifications et préférences ;
- rechercher par BU, type, statut et date ;
- obtenir la publication active ;
- déléguer une capacité d'édition limitée.

## Invariants

- un environnement appartient à un tenant et une BU visibles ;
- il référence une identité fournisseur sans la dupliquer ;
- devise et système d'unités sont explicites ;
- toute valeur héritée de la BU conserve sa provenance et est résolue dans le snapshot ;
- les zones et certifications proviennent de référentiels versionnés ;
- désactivation et archivage ne modifient aucune publication ;
- un environnement non publié n'est jamais présenté comme productif ;
- état de travail, publication et livraison solveur sont distincts.

## Contrat indicatif

```ts
interface ProductionEnvironmentService {
  create(actor: ActorContext, command: CreateEnvironment): Promise<Result<ProductionEnvironment, EnvironmentError>>;
  update(actor: ActorContext, command: UpdateEnvironment): Promise<Result<ProductionEnvironment, EnvironmentError>>;
  setActivation(actor: ActorContext, command: SetEnvironmentActivation): Promise<Result<void, EnvironmentError>>;
  search(actor: ActorContext, query: EnvironmentSearch): Promise<Result<Page<EnvironmentSummary>, EnvironmentError>>;
}
```

## Validation

- [ ] Un environnement est retrouvable depuis sa BU, son fournisseur et son site.
- [ ] Créer un environnement papier pour un fournisseur imprimeur ne duplique pas le fournisseur.
- [ ] Un environnement désactivé ne peut servir à une nouvelle publication active.
- [ ] Le dashboard ne mélange pas statut de travail et statut de publication.
- [ ] Une préférence modifiée n'altère pas une publication historique.
- [ ] Les recherches et délégations respectent le scope BU et tenant.

## Décisions ouvertes

1. Agrégat distinct, vue spécialisée ou périmètre de dataset.
2. Correspondance BU avec tenant/sous-tenant existant.
3. Types d'environnements du MVP.
4. Ownership des certifications et préférences.
5. Règles d'héritage des pays, devises et unités BU/environnement.
