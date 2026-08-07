# Capacité `publications`

**Statut :** draft

## Responsabilité

Contrôler un dataset de travail et créer un snapshot de production complet, immuable, versionné et référençable.

## Concepts

- `WorkingDataset` ;
- `ValidationReport` ;
- `ValidationIssue` ;
- `Publication` ;
- `PublicationVersion` ;
- empreinte de contenu.

## Cas d'usage

```ts
interface PublicationService {
  validate(actor: ActorContext, command: ValidateDataset): Promise<Result<ValidationReport, PublicationError>>;
  publish(actor: ActorContext, command: PublishDataset): Promise<Result<Publication, PublicationError>>;
  restoreAsDraft(actor: ActorContext, command: RestorePublicationAsDraft): Promise<Result<WorkingDataset, PublicationError>>;
  get(actor: ActorContext, id: PublicationId): Promise<Result<Publication | null, PublicationError>>;
  compare(actor: ActorContext, query: ComparePublications): Promise<Result<PublicationDiff, PublicationError>>;
}
```

## Invariants

- une erreur bloquante interdit la publication ;
- la validation indique sa version de règles ;
- le snapshot est complet pour le périmètre accessible ;
- tenant, version, schéma, auteur, date et période d'effet sont obligatoires ;
- l'empreinte est calculée sur une sérialisation canonique ;
- une publication n'est jamais modifiable ;
- une correction produit une nouvelle version ;
- l'état de livraison au solveur ne modifie pas le snapshot.
- restaurer une version crée un nouveau dataset de travail avec une nouvelle identité et conserve la publication source intacte.

## Transaction de publication

La transaction :

1. vérifie membership, entitlement et capability ;
2. verrouille ou vérifie la version du dataset ;
3. exécute les contrôles sur la même révision ;
4. construit et persiste le snapshot ;
5. attribue une version unique ;
6. ajoute l'audit ;
7. enregistre l'événement/outbox éventuel ;
8. commit ou annule l'ensemble.

## Validation

- [ ] Deux publications concurrentes ne reçoivent pas la même version.
- [ ] Une modification après validation force une nouvelle validation.
- [ ] Une publication est impossible avec une erreur bloquante.
- [ ] Aucun endpoint ne permet de modifier le snapshot.
- [ ] V1 reste octet-logiquement stable après création de V2.
- [ ] Un calcul peut stocker et retrouver l'identifiant exact de publication.
- [ ] Restaurer V1 après V2 crée un nouveau brouillon et ne modifie ni V1 ni V2.
- [ ] La comparaison distingue changements techniques et financiers selon les droits.

## Décisions ouvertes

- structure exacte du snapshot ;
- activation immédiate ou séparée de la publication ;
- convention de version ;
- rétention et archivage.
