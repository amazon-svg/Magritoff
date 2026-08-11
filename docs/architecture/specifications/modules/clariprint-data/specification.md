# Module `clariprint-data`

**Statut :** draft  
**Version :** 0.2
**PRD :** [`../../../../../prd/clariprint-data-prd.md`](../../../../../prd/clariprint-data-prd.md)  
**Plan :** [`../../../../clariprint-data-plan/README.md`](../../../../clariprint-data-plan/README.md)

## Mission

Maintenir une représentation fiable, structurée, versionnée et publiable des fournisseurs et ressources mobilisables pour fabriquer et livrer un produit imprimé, puis produire un snapshot JSON consommable par le solveur Clariprint.

## Non-responsabilités

- décrire le besoin d'impression du client ;
- calculer le plan de production optimal ;
- calculer le prix final ;
- ordonnancer l'atelier en temps réel ;
- piloter les machines ;
- gérer le PIM commercial ;
- gérer les plans, utilisateurs ou tenants ;
- implémenter le solveur.

## Dépendances autorisées

Le module dépend de :

- `kernel` pour les primitives techniques ;
- `platform/tenant` pour le contexte organisationnel ;
- `platform/access` pour les capabilities ;
- `platform/entitlements` pour l'activation commerciale ;
- `platform/audit` pour la traçabilité ;
- ses propres ports pour la persistance, les fichiers et le solveur.

Il ne dépend pas :

- des composants ou contexts React historiques ;
- des types générés de la base dans `domain` ou `application` ;
- des tables privées des modules commandes, PIM ou boutiques ;
- de l'adaptateur Clariprint tarifaire existant, sauf par un port explicitement défini ultérieurement.

## Structure cible

```text
src/modules/clariprint-data/
  domain/
    environments/
    suppliers/
    resources/
    subcontracting/
    capabilities/
    economics/
    pricing-schedules/
    calculation-access/
    reference-catalogs/
    datasets/
  application/
    services/
    ports/
    commands/
    queries/
  infrastructure/
    supabase/
    solver/
    imports/
  ui/
    routes/
    hooks/
    components/
  api/
  mcp/
  testing/
```

React appartient à `ui/`. Le domaine et l'application restent exécutables sans React.

## Façades applicatives

```ts
export interface ClariprintDataServices {
  environments: ProductionEnvironmentService;
  suppliers: SupplierService;
  resources: ResourceService;
  subcontracting: SubcontractingService;
  technicalCapabilities: TechnicalCapabilityService;
  economics: EconomicsService;
  pricingSchedules: PricingScheduleService;
  clientProfiles: ClientProfileService;
  calculationAccess: CalculationAccessService;
  materialReferences: MaterialReferenceService;
  transportCatalogs: TransportCatalogService;
  validationProjects: ValidationProjectService;
  publications: PublicationService;
  sandboxes: SandboxService;
  imports: ImportService;
  solverExports: SolverExportService;
}
```

Les façades acceptent toujours un `ActorContext` et des commandes validées. Elles ne retournent ni ligne SQL, ni réponse PostgREST, ni type React.

## Ports sortants

- `SupplierRepository` ;
- `ProductionEnvironmentRepository` ;
- `ResourceRepository` ;
- `SubcontractingRepository` ;
- `DraftDatasetRepository` ;
- `PublicationRepository` ;
- `SandboxRepository` ;
- `ImportFileStore` ;
- `ReferenceCatalogRepository` ;
- `ClientProfileRepository` ;
- `PricingPolicyRepository` ;
- `CalculationAccessContractRepository` ;
- `ApiCredentialRepository` ;
- `ExternalAccessResolver` ;
- `ValidationProjectGateway` ;
- `SolverDatasetPublisher` ;
- `TransactionManager` ou opérations repository transactionnelles explicites.

Un repository générique `DatabaseRepository<T>` est interdit : chaque port exprime des opérations métier et la cohérence transactionnelle attendue.

## Adaptateurs entrants

- hooks et contrôleurs React ;
- API de contrôle d'accès fournie par
  [`access-management`](../access-management/openapi.yaml) ;
- routes HTTP métier avant tout nouveau consommateur React ;
- handlers MCP en lecture seule au premier incrément ;
- jobs de livraison ou reprise ;
- commandes d'import.

Tous invoquent les mêmes services applicatifs.

## Événements initiaux

- `clariprint_data.supplier.created` ;
- `clariprint_data.environment.created` ;
- `clariprint_data.environment.delegation_changed` ;
- `clariprint_data.resource.changed` ;
- `clariprint_data.pricing_schedule.changed` ;
- `clariprint_data.calculation_contract.changed` ;
- `clariprint_data.api_credential.rotated` ;
- `clariprint_data.solver_projection.generated` ;
- `clariprint_data.economic_parameter.changed` ;
- `clariprint_data.dataset.validated` ;
- `clariprint_data.publication.created` ;
- `clariprint_data.sandbox.promoted` ;
- `clariprint_data.import.completed` ;
- `clariprint_data.solver_delivery.completed` ;
- `clariprint_data.solver_delivery.failed`.

Les événements ne servent pas à valider une action immédiate. Une publication n'est réussie que lorsque sa transaction métier est terminée.

## Stratégie d'erreurs

Préfixe : `clariprint_data.*`.

Catégories :

- `validation` : entrée ou invariant invalide ;
- `not_found` : ressource inexistante dans le tenant visible ;
- `conflict` : version concurrente ou doublon ;
- `forbidden` : capability ou portée insuffisante ;
- `incomplete` : données obligatoires absentes ;
- `immutable` : tentative de modification d'une publication ;
- `integration` : import, stockage ou solveur ;
- `temporarily_unavailable` : erreur retentable.

## Transactions critiques

Doivent être atomiques côté serveur :

- création d'une publication et activation éventuelle ;
- promotion d'un sandbox vers un brouillon ;
- confirmation d'un import ;
- modification datée remplaçant une valeur active ;
- contractualisation d'un ensemble de ressources ;
- restauration d'une publication vers un nouveau brouillon ;
- sauvegarde groupée de modifications de barèmes ;
- création, rotation et révocation d'un credential ;
- création ou révocation d'une délégation d'environnement ;
- écriture métier accompagnée d'un audit obligatoire.

## Observabilité

Chaque commande importante transporte un `requestId`. Les métriques initiales couvrent :

- erreurs de validation ;
- durée et volume des imports ;
- publications réussies/refusées ;
- livraisons solveur, latence et catégories d'erreurs ;
- nombre de sandboxes actifs ;
- modifications de données financières.
- tests de barèmes et exécutions de validation solveur ;
- génération de projections ajustées, latence, profil, contrat et catégories d'erreurs ;
- utilisation, rotation et révocation des credentials sans journaliser leurs secrets ;
- créations, expirations et révocations de délégations.

## Compatibilité avec le code existant

- l'identité, les tenants, rôles et RLS sont réutilisés via les modules plateforme ;
- aucune table historique n'est lue directement depuis le domaine ;
- toute dépendance temporaire passe par un adaptateur `legacy` nommé ;
- l'absence de données de production permet une bascule franche du nouveau schéma ;
- aucun dual-write n'est introduit sans besoin prouvé.

La source PrintMaster est utilisée comme corpus de découverte, pas comme contrat technique. Ses dispositions de page, noms de composants Base44 et listes non normalisées ne traversent pas les contrats du domaine.

## Critères d'acceptation architecture

- [ ] `CPD-ARCH-01` Les imports respectent la direction kernel → plateforme → module → adaptateurs.
- [ ] `CPD-ARCH-02` React est limité à la couche UI.
- [ ] `CPD-ARCH-03` Supabase est limité aux adaptateurs d'infrastructure.
- [ ] `CPD-ARCH-04` Chaque donnée possède un module propriétaire.
- [ ] `CPD-ARCH-05` Les transactions critiques sont exécutées côté serveur.
- [ ] `CPD-ARCH-06` Les mêmes services sont utilisables depuis React, API ou MCP.
- [ ] `CPD-ARCH-07` Les publications sont immuables et tenant-scoped.
- [ ] `CPD-ARCH-08` Toute dépendance legacy est explicite et supprimable.

## Décisions bloquantes

Les décisions J0 du plan restent préalables au statut `accepted`, particulièrement le contrat solveur, le flux pilote, les unités, les paramètres économiques et la profondeur de sous-traitance.
