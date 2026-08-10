# Capacité `calculation-access-contracts`

**Statut :** candidate à valider métier
**Décision applicable :** Clariprint Data ne gère ni marge, ni majoration, ni remise, ni prix de vente.

## Responsabilité

Gérer les contrats donnant accès à une publication de données de production, les filtres de ressources, les modes d'authentification associés et la génération d'un JSON complet de **coûts de production** pour Clariprint Solveur.

Cette capacité ne transforme jamais un coût en prix commercial. Les profils clients, politiques tarifaires, marges, remises et prix de vente appartiennent au module de gestion commerciale.

## Concepts

### Publication source

Une publication accessible au calcul contient exclusivement des données techniques et des coûts de production validés. La nature des montants n'est donc pas configurable : un montant financier publié par Clariprint Data est un coût de production.

### Contrat d'accès calcul

```ts
type CalculationAccessContract = Readonly<{
  id: CalculationAccessContractId;
  tenantId: TenantId;
  poolId: ProductionEnvironmentId;
  publicationSelector: PublicationSelector;
  resourceFilter: ResourceFilter;
  consumerReference?: string;
  validFrom: string;
  validUntil?: string;
  status: "draft" | "active" | "suspended" | "archived";
  version: number;
}>;
```

Le sélecteur de publication est soit une version épinglée, soit une résolution de la publication active à la date d'effet. Le choix est explicite dans le contrat.

Le filtre peut autoriser ou exclure des machines et, après validation du besoin, des matières, transports, sous-traitants ou catégories. Une ressource non autorisée n'apparaît pas dans le JSON généré.

`consumerReference` est une référence technique facultative vers un consommateur extérieur. Elle ne porte aucune règle tarifaire et ne donne aucun accès sans authentification et contrat actif.

### Credentials locaux

Un contrat peut posséder plusieurs clés API :

```ts
type ApiCredential = Readonly<{
  id: ApiCredentialId;
  contractId: CalculationAccessContractId;
  label: string;
  secretHash: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
}>;
```

Le secret aléatoire de forte entropie est affiché une seule fois. Seule sa forme de vérification est persistée. L'identifiant public de clé permet de sélectionner le hash sans parcourir tous les credentials.

### Mode d'accès externe

Clariprint Data peut exposer un contrat à un système d'accès externe. Ce système configure ses propres credentials et transmet un principal authentifié avec une référence de contrat.

Le port de confiance doit fournir une preuve d'autorisation ; un `contractId` envoyé par un client anonyme est toujours refusé.

### Projection solveur

```ts
type SolverDatasetProjection = Readonly<{
  sourcePublicationId: PublicationId;
  contractId: CalculationAccessContractId;
  contractVersion: number;
  effectiveAt: string;
  schemaVersion: string;
  accessMode: "local_api_key" | "external_binding";
  credentialId?: ApiCredentialId;
  contentHash: string;
  dataset: SolverDataset;
}>;
```

La projection contient les données de production et leurs coûts, filtrés selon le contrat. Elle ne contient aucun ajustement commercial.

## Résolution d'une demande

```text
1. Authentifier la clé locale ou le principal externe
2. Résoudre le contrat autorisé
3. Vérifier le statut et la période du contrat
4. Résoudre la publication source à effectiveAt
5. Vérifier qu'elle ne contient que des coûts de production
6. Appliquer le filtre de ressources
7. Valider le JSON solveur complet
8. Calculer l'empreinte et enregistrer la preuve de génération
```

Le pool et la publication source ne sont jamais modifiés.

## Contrat applicatif

```ts
interface CalculationAccessService {
  createContract(actor: ActorContext, command: CreateAccessContract): Promise<Result<CalculationAccessContract, AccessContractError>>;
  createApiKey(actor: ActorContext, command: CreateApiKey): Promise<Result<CreatedApiKey, CredentialError>>;
  revokeApiKey(actor: ActorContext, command: RevokeApiKey): Promise<Result<void, CredentialError>>;
  generate(request: GenerateSolverDatasetRequest): Promise<Result<SolverDatasetProjection, ProjectionError>>;
}
```

`CreatedApiKey` contient le secret seulement dans la réponse de création. Aucun endpoint de lecture ne peut le retourner ensuite.

## Ports

- `CalculationAccessContractRepository` ;
- `ApiCredentialRepository` ;
- `ExternalAccessResolver` ;
- `SourcePublicationReader` ;
- `SolverDatasetRenderer` ;
- `ProjectionAuditRepository`.

## Autorisations d'administration

- `clariprint_data.calculation_contract.manage` ;
- `clariprint_data.api_key.manage` ;
- `clariprint_data.solver_projection.audit`.

Ces permissions utilisateur administrent les objets. Elles sont distinctes de l'authentification machine-to-machine d'une clé API.

## Invariants

- Clariprint Data ne stocke et n'applique aucune marge, majoration ou remise ;
- aucun prix de vente ou tarif commercial n'entre dans une publication ou une projection ;
- une projection ne modifie aucune publication ;
- credential et contrat doivent être actifs ;
- aucune clé ou secret en clair dans les logs, audits ou datasets ;
- le dataset complet ne contient que les ressources autorisées ;
- les valeurs source non autorisées ne sont pas exposées ;
- une même résolution produit une sortie déterministe ;
- le cache ne peut jamais traverser un contrat.

## Observabilité et audit

Conserver :

- request ID ;
- contrat et publication résolus ;
- date d'effet ;
- mode d'accès et identifiant du credential ou principal externe ;
- filtres appliqués, sans secret ;
- empreinte et version de schéma ;
- durée, résultat et catégorie d'erreur.

## Validation

- [ ] Une publication et sa projection contiennent exclusivement des coûts de production.
- [ ] Deux clés actives ouvrent le même contrat et peuvent être révoquées indépendamment.
- [ ] Une clé révoquée est refusée immédiatement.
- [ ] Un contrat sans principal externe autorisé ne donne aucun accès.
- [ ] Le JSON généré est complet, filtré et conforme au contrat solveur.
- [ ] Le pool source reste octet-logiquement inchangé.
- [ ] Deux contrats ne partagent jamais une entrée de cache ou une projection.
- [ ] La preuve de génération permet de reproduire la projection sans conserver le secret.
- [ ] Aucun champ de marge, majoration, remise ou prix de vente n'est accepté par les DTO et schémas du module.

## Décisions ouvertes

1. Publication épinglée ou active à date.
2. Filtres de ressources autorisés au MVP.
3. Protocole et identité du mode d'accès externe.
4. Persistance complète ou régénération des projections.
5. Politique de rate limiting, rotation et durée des clés.
