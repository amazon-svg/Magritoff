# Module plateforme `tenant`

**Statut :** candidate  
**Version :** 0.1

## Responsabilité

Répondre à la question « dans quelle organisation l'utilisateur agit-il ? » : cycle de vie du tenant, hiérarchie, memberships, invitations et résolution du contexte tenant.

## Non-responsabilités

- authentifier l'utilisateur ;
- décider une permission métier ;
- gérer les abonnements ;
- connaître les fournisseurs, machines, commandes ou publications.

## Contrat public

```ts
export interface TenantService {
  get(tenantId: TenantId): Promise<Result<Tenant | null, TenantError>>;
  listMemberships(userId: UserId): Promise<Result<readonly TenantMembership[], TenantError>>;
  resolveMembership(userId: UserId, tenantId: TenantId): Promise<Result<TenantMembership | null, TenantError>>;
  requireMembership(userId: UserId, tenantId: TenantId): Promise<Result<TenantMembership, TenantError>>;
  getHierarchy(tenantId: TenantId): Promise<Result<TenantHierarchy, TenantError>>;
}
```

`TenantMembership` exprime l'appartenance et son état. Il ne transporte pas toutes les règles d'autorisation calculées.

## Compatibilité initiale

L'adaptateur encapsule les tenants, sous-tenants, memberships, invitations et scopes `magrit_full`/`shop_only` actuels. Ces noms historiques ne deviennent pas des primitives du kernel.

## Invariants

- un membership appartient à un utilisateur et un tenant ;
- un membership révoqué ne permet aucune action ;
- la hiérarchie respecte la profondeur contractuelle ;
- un contexte tenant doit être résolu avant toute action métier tenant-scoped ;
- une invitation n'est pas un membership actif avant acceptation transactionnelle.

## Critères d'acceptation

- [ ] `TEN-VAL-01` Le module ne dépend d'aucun module métier.
- [ ] `TEN-VAL-02` Un utilisateur sans membership ne peut créer un `ActorContext` pour le tenant.
- [ ] `TEN-VAL-03` Un membership révoqué est refusé immédiatement.
- [ ] `TEN-VAL-04` Les invitations concurrentes ne créent pas de memberships incohérents.
- [ ] `TEN-VAL-05` Les règles de hiérarchie sont testées.
- [ ] `TEN-VAL-06` Les détails des tables historiques ne traversent pas le contrat.

