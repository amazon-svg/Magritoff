# Modèle de domaine `access-management`

**Statut :** candidate  
**Version :** 0.1

## Agrégats et projections

### `RoleDefinition`

Agrégat administrable appartenant à un tenant.

```ts
type RoleDefinition = Readonly<{
  id: RoleId;
  tenantId: TenantId;
  name: string;
  description?: string;
  capabilities: readonly CapabilityName[];
  kind: 'system' | 'custom';
  status: 'active' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}>;
```

Un rôle `system` peut être protégé contre l'archivage ou certaines modifications. Cette protection est une propriété explicite, jamais déduite du libellé.

### `MemberRoleAssignmentSet`

Ensemble versionné des rôles actifs affectés à un membre pour un tenant.

```ts
type MemberRoleAssignmentSet = Readonly<{
  tenantId: TenantId;
  userId: UserId;
  roleIds: readonly RoleId[];
  version: number;
  updatedAt: string;
}>;
```

La commande publique remplace l'ensemble complet. Le module calcule les ajouts et révocations nécessaires dans une transaction.

### `CapabilityDescriptor`

Entrée du catalogue déclarée par le module propriétaire.

```ts
type CapabilityDescriptor = Readonly<{
  name: string;
  moduleKey: string;
  label: string;
  description?: string;
  assignableByTenantAdmin: boolean;
  sensitivity: 'standard' | 'sensitive' | 'platform_only';
}>;
```

`access-management` valide et présente ce catalogue, mais ne devient pas propriétaire de la signification métier d'une capability.

### `ModuleAvailability`

Projection calculée pour un acteur et un tenant.

```ts
type ModuleAvailability = Readonly<{
  moduleKey: string;
  enabled: boolean;
  accessible: boolean;
  reason: 'available' | 'feature_disabled' | 'missing_capability';
}>;
```

Les raisons techniques internes ne sont pas exposées comme disponibilité fonctionnelle. Une panne fournisseur produit une erreur d'API, pas `enabled: false`.

### `TenantModuleEntitlement`

Projection administrative de l'activation commerciale.

```ts
type TenantModuleEntitlement = Readonly<{
  tenantId: TenantId;
  moduleKey: string;
  enabled: boolean;
  source: 'plan' | 'trial' | 'contract' | 'operator_override' | 'default';
  validFrom?: string;
  validUntil?: string;
  version: number;
}>;
```

## Ports applicatifs

- `RoleRepository` ;
- `RoleAssignmentRepository` ;
- `CapabilityCatalog` ;
- `MemberDirectory` en lecture uniquement ;
- `AccessEvaluator` adapté depuis `platform/access` ;
- `EntitlementGateway` adapté depuis `platform/entitlements` ;
- `AuditRecorder` adapté depuis `platform/audit` ;
- `AccessTransaction` pour les mutations atomiques.

## Invariants

- toutes les références d'une commande appartiennent au tenant de l'`ActorContext` ;
- une capability `platform_only` n'est jamais assignable par un administrateur tenant ;
- un rôle archivé ne contribue plus aux capacités effectives ;
- une affectation révoquée reste dans l'historique mais ne contribue plus aux capacités ;
- l'union des rôles ne peut pas transformer un entitlement absent en fonctionnalité disponible ;
- une indisponibilité fournisseur n'est jamais interprétée comme une absence de droit ;
- le dernier chemin d'administration effectif du tenant est protégé.

## Événements

- `access_management.role.created` ;
- `access_management.role.updated` ;
- `access_management.role.archived` ;
- `access_management.assignments.replaced` ;
- `access_management.entitlement.changed` ;
- `access_management.legacy_mapping.failed`.

Les événements sont émis après réussite de la transaction métier. Ils ne remplacent pas l'audit obligatoire.

