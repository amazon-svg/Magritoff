# Capacité `calculation-access-contracts`

**Statut :** candidate à valider métier

## Responsabilité

Gérer les profils clients, leurs politiques tarifaires datées, les contrats donnant accès à un pool de données, les modes d'authentification associés et la génération d'un JSON complet aux tarifs ajustés pour Clariprint Solveur.

Cette capacité applique les ajustements. Le solveur consomme les montants résultants et ne réinterprète pas la politique client.

## Concepts

### Pool source

Une publication de pool porte une nature de montants explicite :

```ts
type SourceAmountKind = "production_cost" | "commercial_rate";
```

La granularité définitive — pool, publication ou montant — reste à décider. Aucun consommateur ne doit l'inférer d'un nom de champ.

### Profil client

```ts
type ClientProfile = Readonly<{
  id: ClientProfileId;
  tenantId: TenantId;
  code: string;
  label: string;
  status: "draft" | "active" | "disabled" | "archived";
  version: number;
}>;
```

Le `code` ou l'identifiant stable peut être publié à un système externe. Il ne constitue pas un secret et ne donne aucun accès sans authentification et association autorisée.

### Politique tarifaire

```ts
type PricingPolicy = Readonly<{
  id: PricingPolicyId;
  profileId: ClientProfileId;
  version: number;
  validFrom: string;
  validUntil?: string;
  globalAdjustment?: PriceAdjustment;
  machineAdjustments: readonly MachinePriceAdjustment[];
  status: "draft" | "active" | "archived";
}>;
```

Types d'ajustement initiaux :

```ts
type PriceAdjustment =
  | { type: "markup_rate"; rate: DecimalString }
  | { type: "discount_rate"; rate: DecimalString }
  | { type: "target_margin_rate"; rate: DecimalString };
```

Sémantique candidate :

- `markup_rate` : `source × (1 + rate)` ;
- `discount_rate` : `source × (1 - rate)` ;
- `target_margin_rate` : `source ÷ (1 - rate)`, autorisé seulement si `source` représente un coût de production.

Ces formules doivent être confirmées par l'expert métier. Les taux, bornes et arrondis sont validés avant activation.

### Contrat d'accès calcul

```ts
type CalculationAccessContract = Readonly<{
  id: CalculationAccessContractId;
  tenantId: TenantId;
  profileId: ClientProfileId;
  poolId: ProductionEnvironmentId;
  publicationSelector: PublicationSelector;
  resourceFilter: ResourceFilter;
  validFrom: string;
  validUntil?: string;
  status: "draft" | "active" | "suspended" | "archived";
  version: number;
}>;
```

Le sélecteur de publication est soit une version épinglée, soit une résolution de la publication active à la date d'effet. Le choix doit être explicite dans le contrat.

Le filtre peut autoriser ou exclure des machines et, après validation du besoin, des matières, transports, sous-traitants ou catégories. Une ressource non autorisée n'apparaît pas dans le JSON généré.

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

Clariprint Data peut publier la liste des profils et contrats exposables à un système d'accès externe. Ce système configure ses propres credentials et transmet un principal authentifié avec une référence de profil ou contrat.

Le port de confiance doit fournir une preuve d'autorisation ; un `profileId` envoyé par un client anonyme est toujours refusé.

### Projection ajustée

```ts
type AdjustedDatasetProjection = Readonly<{
  sourcePublicationId: PublicationId;
  contractId: CalculationAccessContractId;
  contractVersion: number;
  profileId: ClientProfileId;
  profileVersion: number;
  policyId: PricingPolicyId;
  policyVersion: number;
  effectiveAt: string;
  schemaVersion: string;
  accessMode: "local_api_key" | "external_binding";
  credentialId?: ApiCredentialId;
  contentHash: string;
  dataset: SolverDataset;
}>;
```

## Résolution d'une demande

```text
1. Authentifier la clé locale ou le principal externe
2. Résoudre le contrat autorisé
3. Vérifier statut et période du contrat et du profil
4. Résoudre la publication source à effectiveAt
5. Vérifier la nature des montants source
6. Résoudre l'unique politique active à effectiveAt
7. Appliquer le filtre de ressources
8. Pour chaque montant : résoudre la règle machine et la règle globale selon la priorité versionnée
9. Appliquer le résultat de cette résolution sans composition implicite
10. Arrondir selon la convention du contrat
11. Valider le JSON solveur complet
12. Calculer l'empreinte et enregistrer la preuve de génération
```

Le pool et la publication source ne sont jamais modifiés.

## Contrats applicatifs

```ts
interface ClientProfileService {
  create(actor: ActorContext, command: CreateClientProfile): Promise<Result<ClientProfile, ClientProfileError>>;
  createPolicy(actor: ActorContext, command: CreatePricingPolicy): Promise<Result<PricingPolicy, PricingPolicyError>>;
  publishProfiles(actor: ActorContext, query: PublishedProfileQuery): Promise<Result<readonly PublishedProfile[], ProfileError>>;
}

interface CalculationAccessService {
  createContract(actor: ActorContext, command: CreateAccessContract): Promise<Result<CalculationAccessContract, AccessContractError>>;
  createApiKey(actor: ActorContext, command: CreateApiKey): Promise<Result<CreatedApiKey, CredentialError>>;
  revokeApiKey(actor: ActorContext, command: RevokeApiKey): Promise<Result<void, CredentialError>>;
  generate(request: GenerateAdjustedDatasetRequest): Promise<Result<AdjustedDatasetProjection, ProjectionError>>;
}
```

`CreatedApiKey` contient le secret seulement dans la réponse de création. Aucun endpoint de lecture ne peut le retourner ensuite.

## Ports

- `ClientProfileRepository` ;
- `PricingPolicyRepository` ;
- `CalculationAccessContractRepository` ;
- `ApiCredentialRepository` ;
- `ExternalAccessResolver` ;
- `SourcePublicationReader` ;
- `AdjustedDatasetRenderer` ;
- `ProjectionAuditRepository`.

## Autorisations d'administration

- `clariprint_data.client_profile.read` ;
- `clariprint_data.client_profile.manage` ;
- `clariprint_data.pricing_policy.manage` ;
- `clariprint_data.calculation_contract.manage` ;
- `clariprint_data.api_key.manage` ;
- `clariprint_data.adjusted_projection.audit`.

Ces permissions utilisateur administrent les objets. Elles sont distinctes de l'authentification machine-to-machine d'une clé API.

## Invariants

- montant source et montant ajusté ne sont jamais confondus ;
- une projection ne modifie aucune publication ;
- au plus une politique non ambiguë par profil, cible et date ;
- la priorité entre exception machine et règle globale est explicite et versionnée ;
- aucune composition n'est autorisée tant que sa règle n'a pas été décidée et versionnée ;
- marge sur coût interdite sur un tarif commercial si sa formule n'est pas définie ;
- credential, contrat, profil et politique doivent tous être actifs ;
- aucune clé ou secret en clair dans les logs, audits ou datasets ;
- le dataset complet ne contient que les ressources autorisées ;
- les valeurs source non autorisées ne sont pas exposées ;
- une même résolution produit une sortie déterministe ;
- le cache ne peut jamais traverser un contrat ou profil.

## Observabilité et audit

Conserver :

- request ID ;
- contrat, profil, politique et publication résolus ;
- date d'effet ;
- mode d'accès et identifiant du credential ou principal externe ;
- règles appliquées par cible, sans secret ;
- empreinte et version de schéma ;
- durée, résultat et catégorie d'erreur.

## Validation

- [ ] Un pool `production_cost` et un pool `commercial_rate` sont distingués.
- [ ] Une règle globale s'applique en l'absence d'exception machine.
- [ ] Une exception machine et une règle globale suivent la priorité décidée, sans double application implicite.
- [ ] Deux dates résolvent deux politiques successives sans chevauchement.
- [ ] Marge, majoration et remise suivent leurs formules respectives.
- [ ] Deux clés actives ouvrent le même contrat et peuvent être révoquées indépendamment.
- [ ] Une clé révoquée est refusée immédiatement.
- [ ] Un profil publié sans principal externe autorisé ne donne aucun accès.
- [ ] Le JSON généré est complet, filtré, ajusté et conforme au contrat solveur.
- [ ] Le solveur n'a pas besoin de connaître la politique tarifaire.
- [ ] Le pool source reste octet-logiquement inchangé.
- [ ] Deux profils ne partagent jamais une entrée de cache ou une projection.
- [ ] La preuve de génération permet de reproduire l'ajustement sans conserver le secret.

## Décisions ouvertes

1. Granularité de `SourceAmountKind`.
2. Formules exactes de marge, majoration et remise.
3. Remplacement ou cumul entre règle globale et règle machine.
4. Publication épinglée ou active à date.
5. Filtres de ressources autorisés au MVP.
6. Protocole et identité du mode d'accès externe.
7. Persistance complète ou régénération des projections.
8. Politique de rate limiting, rotation et durée des clés.
