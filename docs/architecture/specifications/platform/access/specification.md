# Module plateforme `access`

**Statut :** candidate  
**Version :** 0.1

## Responsabilité

Répondre à la question « l'acteur possède-t-il la capability nécessaire sur cette ressource ? » et rendre la décision explicable.

## Non-responsabilités

- authentifier ;
- créer les tenants ;
- vendre ou activer une fonctionnalité ;
- décider si l'état métier autorise une transition ;
- remplacer la RLS.

La consultation et l'administration des rôles, affectations et projections UX
sont portées par le module métier
[`access-management`](../../modules/access-management/specification.md), qui
utilise ce contrat sans réimplémenter le moteur de décision.

## Contrat public

```ts
export type ResourceRef = Readonly<{
  type: string;
  id: string;
  tenantId: TenantId;
}>;

export type AccessDecision =
  | Readonly<{ allowed: true; reason: "role" | "ownership" | "tenant_admin" | "system_policy" }>
  | Readonly<{
      allowed: false;
      reason: "not_authenticated" | "not_a_member" | "missing_capability" | "wrong_tenant" | "resource_scope" | "provider_unavailable";
    }>;

export interface AccessService {
  can(actor: ActorContext, capability: string, resource?: ResourceRef): Promise<AccessDecision>;
  require(actor: ActorContext, capability: string, resource?: ResourceRef): Promise<Result<void, AccessError>>;
  listCapabilities(actor: ActorContext): Promise<Result<readonly string[], AccessError>>;
}
```

## Convention de nommage

```text
<module>.<resource>.<action>
```

Exemples :

- `clariprint_data.supplier.read` ;
- `clariprint_data.technical.edit` ;
- `clariprint_data.financial.read` ;
- `clariprint_data.publication.publish`.

Les modules déclarent leurs capabilities. `access` les évalue mais ne maintient pas une liste codée en dur de tous les métiers.

## Adaptation de l'existant

L'adaptateur initial peut utiliser `tenant_role_definitions`, les assignments actifs et le RPC `user_has_capability`. Les capabilities historiques `can_*` sont mappées explicitement ; aucun fallback implicite par nom n'est autorisé.

## Règles

- un rôle regroupe des capabilities ;
- plusieurs rôles produisent l'union de leurs capabilities actives ;
- une capability ne constitue pas un entitlement ;
- le module métier vérifie encore ses invariants ;
- la base applique encore la RLS ;
- un refus cross-tenant ne révèle pas si la ressource existe.

## Grants temporaires

Le module peut évaluer des grants limités à une ressource et une période, notamment pour déléguer l'édition d'un environnement à un fournisseur externe.

Un grant :

- cible un bénéficiaire authentifié ;
- liste les capabilities accordées ;
- cible une ressource et un tenant/BU ;
- possède une expiration et un statut de révocation ;
- est évalué côté serveur à chaque action ;
- est audité à la création, utilisation sensible et révocation.

Une URL, un mot de passe partagé ou un code OTP ne constitue jamais le grant. Ils peuvent seulement participer au processus d'authentification géré par `identity`.

## Critères d'acceptation

- [ ] `ACC-VAL-01` Chaque décision sensible est autorisée ou refusée avec une raison stable.
- [ ] `ACC-VAL-02` Le mapping des capabilities historiques est explicite et testé.
- [ ] `ACC-VAL-03` Plusieurs rôles actifs sont combinés sans réactiver un rôle révoqué.
- [ ] `ACC-VAL-04` Un tenant admin n'obtient pas automatiquement les entitlements absents.
- [ ] `ACC-VAL-05` Un contrôle applicatif réussi ne contourne jamais la RLS.
- [ ] `ACC-VAL-06` Les refus cross-tenant ne divulguent aucune donnée de ressource.
- [ ] `ACC-VAL-07` Un grant expiré ou révoqué est refusé immédiatement.
- [ ] `ACC-VAL-08` Un grant limité à une ressource ne s'applique à aucune autre.
