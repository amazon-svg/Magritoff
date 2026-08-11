# Module plateforme `entitlements`

**Statut :** draft  
**Version :** 0.1

## Responsabilité

Répondre à la question « le tenant dispose-t-il commercialement de cette fonctionnalité ou de ce quota ? ».

## Non-responsabilités

- authentification ;
- membership ;
- permission individuelle ;
- validité d'une action métier ;
- facturation complète.

L'API et l'UX opérateur permettant de consulter ou modifier un entitlement
sont portées par
[`access-management`](../../modules/access-management/specification.md). Un
administrateur tenant ne peut pas s'accorder lui-même une fonctionnalité.

## Contrat public

```ts
export interface EntitlementService {
  hasFeature(tenantId: TenantId, feature: string): Promise<Result<boolean, EntitlementError>>;
  requireFeature(tenantId: TenantId, feature: string): Promise<Result<void, EntitlementError>>;
  getLimit(tenantId: TenantId, quota: string): Promise<Result<number | null, EntitlementError>>;
  consume(tenantId: TenantId, quota: string, amount: number): Promise<Result<void, EntitlementError>>;
}
```

## Clariprint Data

Feature proposée : `clariprint_data.enabled`.

Les quotas éventuels de fournisseurs, machines, sandboxes ou publications restent ouverts tant que l'offre commerciale n'est pas validée. Aucun quota arbitraire ne doit être codé dans le module métier.

## Sources possibles

- plan souscrit ;
- période d'essai ;
- contrat entreprise ;
- override administrateur daté ;
- fonctionnalité disponible par défaut.

## Adaptateur pilote

L'incrément J1 utilise temporairement `tenants.settings.features` et
`tenants.settings.quotas` comme source, derrière
`SupabaseTenantSettingsEntitlementService`. Une feature absente ou mal formée
est refusée par défaut. Cet adaptateur ne consomme aucun quota, car une mise à
jour atomique exige un contrat serveur dédié.

**Condition de retrait :** remplacer cet adaptateur lorsque le modèle
commercial des features et quotas est validé et qu'un service transactionnel
d'entitlements est disponible.

## Critères d'acceptation

- [ ] `ENT-VAL-01` Une feature et une capability sont deux décisions distinctes.
- [ ] `ENT-VAL-02` Un override possède une provenance, une période et un audit.
- [ ] `ENT-VAL-03` Une limite absente est distinguée d'une limite égale à zéro.
- [ ] `ENT-VAL-04` La consommation concurrente d'un quota est atomique.
- [ ] `ENT-VAL-05` Clariprint Data ne connaît aucun nom de plan commercial.

## Décisions ouvertes

1. Clariprint Data est-il activé pour tous les tenants pilotes ou par entitlement ?
2. Quels quotas sont commercialisés ?
3. Quelle politique appliquer en cas d'indisponibilité du service d'entitlements ?
