# Module `access-management`

**Statut :** candidate — lectures AM1 implémentées, commandes à valider  
**Version :** 0.1  
**Dépendances :** `kernel`, `platform/identity`, `platform/tenant`, `platform/access`, `platform/entitlements`, `platform/audit`

## Mission

Fournir un point d'entrée métier unique pour consulter et administrer les accès d'un tenant : capacités effectives, rôles, affectations et disponibilité des modules. Le module expose des API explicites et une UX d'administration sans laisser React connaître Supabase, les tables ou les RPC historiques.

## Séparation avec les modules plateforme

`platform/access` reste le moteur transversal qui répond à « cet acteur peut-il réaliser cette action ? ». `platform/entitlements` répond à « ce tenant dispose-t-il de cette fonctionnalité ? ».

`access-management` orchestre ces services pour les cas d'usage administratifs et les projections destinées aux surfaces UX. Il ne réimplémente pas leur logique et ne devient pas une dépendance obligatoire de tous les modules métier.

```text
surfaces UI / modules métier
           |
           v
API access-management
           |
           v
services applicatifs access-management
   |          |          |          |
 identity   tenant     access   entitlements/audit
                          |
                          v
            adaptateurs Supabase ou legacy
```

## Responsabilités

- exposer les capacités effectives de l'acteur dans un tenant ;
- exposer l'état des modules du tenant et leur accessibilité pour l'acteur ;
- lister, créer, modifier et archiver les rôles du tenant ;
- remplacer de manière atomique les rôles affectés à un membre ;
- fournir la projection des membres nécessaire à l'administration des rôles ;
- exposer le catalogue des capabilities déclarées par les modules ;
- administrer les entitlements uniquement pour un acteur plateforme autorisé ;
- auditer toute modification de rôle, d'affectation ou d'entitlement ;
- masquer les détails du stockage et du fournisseur d'identité.

## Non-responsabilités

- authentifier ou gérer les sessions ;
- créer, inviter, suspendre ou supprimer un membre ;
- créer un tenant ou gérer sa hiérarchie ;
- définir les invariants d'un module métier ;
- vendre, facturer ou renouveler un abonnement ;
- remplacer la RLS ;
- coder en dur le catalogue complet des capabilities des autres modules ;
- servir de kernel ou de dépôt générique pour toutes les données utilisateur.

## Structure cible

```text
src/modules/access-management/
  domain/
    roles/
    assignments/
    module-availability/
  application/
    commands/
    queries/
    ports/
    services/
  api/
    contracts/
    client/
  infrastructure/
    http/
    legacy/
    supabase/
  ui/
    routes/
    hooks/
    components/
  testing/
```

Les surfaces composent le client API dans leur composition root. Aucun fichier sous `domain`, `application`, `api` ou `ui` n'importe Supabase.

## Cas d'usage publics

### Consultation

- `GetMyTenantAccess` : capacités effectives et disponibilité des modules pour l'acteur courant ;
- `ListCapabilityCatalog` : catalogue déclaré par les modules installés ;
- `ListRoles` et `GetRole` ;
- `ListMemberRoleAssignments` : projection en lecture des membres et de leurs rôles ;
- `ListModuleEntitlements` ;
- `ListAccessAuditEvents`.

### Administration tenant

- `CreateRole` ;
- `UpdateRole` ;
- `ArchiveRole` ;
- `ReplaceMemberRoleAssignments`.

### Administration plateforme

- `SetTenantModuleEntitlement` avec provenance, période éventuelle et motif obligatoire.

## Contrat HTTP

Le contrat normatif est [`openapi.yaml`](./openapi.yaml). Les routes sont orientées métier et indépendantes de l'hébergeur :

```text
GET    /api/v1/tenants/{tenantId}/access/me
GET    /api/v1/tenants/{tenantId}/access/capabilities
GET    /api/v1/tenants/{tenantId}/access/roles
POST   /api/v1/tenants/{tenantId}/access/roles
GET    /api/v1/tenants/{tenantId}/access/roles/{roleId}
PATCH  /api/v1/tenants/{tenantId}/access/roles/{roleId}
DELETE /api/v1/tenants/{tenantId}/access/roles/{roleId}
GET    /api/v1/tenants/{tenantId}/access/members
PUT    /api/v1/tenants/{tenantId}/access/members/{userId}/roles
GET    /api/v1/tenants/{tenantId}/access/modules
PATCH  /api/v1/tenants/{tenantId}/access/modules/{moduleKey}
GET    /api/v1/tenants/{tenantId}/access/events
```

L'URL Supabase `/functions/v1/...`, les noms de table et les RPC ne font jamais partie du contrat public. Une Edge Function peut héberger l'adaptateur HTTP, derrière `/api/v1` ou un gateway, sans être visible dans les modules UI.

## Règles métier principales

1. Un rôle appartient à un seul tenant.
2. Le nom d'un rôle actif est unique dans son tenant, sans tenir compte de la casse et des espaces périphériques.
3. Un rôle contient uniquement des capabilities présentes dans le catalogue déclaré.
4. Plusieurs rôles actifs produisent l'union des capabilities actives.
5. Archiver un rôle empêche toute nouvelle affectation sans effacer l'historique.
6. Le remplacement des rôles d'un membre est atomique et refuse les rôles d'un autre tenant.
7. Une opération ne peut pas retirer le dernier moyen d'administrer les accès du tenant sans procédure de récupération explicitement autorisée.
8. Une capability et un entitlement restent deux décisions indépendantes.
9. Un administrateur tenant ne peut ni créer ni activer son propre entitlement commercial.
10. Toute écriture exige un motif, un `requestId` et une trace d'audit.
11. Un refus cross-tenant ne révèle pas l'existence d'un rôle, membre ou module.
12. L'API ne fait jamais confiance à un `userId`, `tenantId` ou rôle affirmé par le navigateur sans reconstruire l'`ActorContext` côté serveur.

## Capabilities propres au module

```text
access_management.access.read
access_management.roles.read
access_management.roles.manage
access_management.assignments.read
access_management.assignments.manage
access_management.audit.read
platform.entitlements.read
platform.entitlements.manage
```

`platform.entitlements.manage` est réservée au périmètre opérateur plateforme. Elle ne doit pas être attribuable depuis l'éditeur de rôles d'un tenant.

## Compatibilité avec l'historique

Le premier adaptateur peut appeler :

- `tenant_role_definitions` ;
- `tenant_role_assignments` ;
- `tenant_members` pour une projection de lecture ;
- `tenant_member_events` pour reprendre l'historique disponible ;
- le RPC `user_has_capability` ;
- `tenants.settings.features` pour l'adaptateur temporaire d'entitlements.

Cette compatibilité suit un pattern anti-corruption :

- seul `infrastructure/legacy` connaît ces noms ;
- les lignes SQL sont traduites vers le modèle du module ;
- aucun type Supabase ne traverse un port applicatif ;
- chaque mapping de capability historique `can_*` est explicite et testé ;
- aucune nouvelle UI ne peut invoquer directement ces tables ou RPC ;
- la condition de retrait est la disponibilité d'un stockage et de commandes transactionnelles propres au module plateforme concerné.

## Cohérence et concurrence

- les commandes de modification utilisent une version attendue ou un `ETag` ;
- un conflit optimiste retourne `409 access_management.concurrent_modification` ;
- le remplacement des affectations et son audit sont atomiques ;
- l'archivage d'un rôle utilisé exige une confirmation explicite et révoque ses affectations dans la même transaction, ou retourne un conflit ;
- les commandes rejouées avec la même clé d'idempotence ne créent pas de doublon.

## Erreurs

Préfixe : `access_management.*`.

- `validation` : entrée ou capability inconnue ;
- `not_found` : ressource inexistante ou non visible ;
- `forbidden` : capability de gestion absente ;
- `conflict` : nom dupliqué, dernière administration ou version concurrente ;
- `cross_tenant` : référence appartenant à un autre tenant, exposée comme refus non révélateur ;
- `provider_unavailable` : adaptateur temporairement indisponible ;
- `audit_failed` : écriture non validée faute d'audit atomique.

Chaque erreur HTTP contient un code stable, un message non sensible et un `requestId`.

## Observabilité

- latence et taux d'erreur par cas d'usage, sans journaliser les tokens ;
- compteur des refus par raison stable ;
- changements de rôles, affectations et entitlements corrélés au `requestId` ;
- métrique d'utilisation de l'adaptateur legacy pour suivre son retrait ;
- alerte sur échec d'audit, incohérence cross-tenant ou tentative d'auto-activation commerciale.

## Critères d'acceptation

- [ ] `AM-VAL-01` L'UI ne dépend que d'un client API typé injecté.
- [x] `AM-VAL-02` Aucune URL, table, RPC ou type Supabase n'apparaît dans `domain`, `application`, `api` ou `ui`.
- [x] `AM-VAL-03` `access/me` distingue membership, entitlement et capability.
- [ ] `AM-VAL-04` Les lectures et écritures cross-tenant sont refusées sans divulgation.
- [ ] `AM-VAL-05` Les écritures de rôles et affectations sont atomiques, versionnées et auditées.
- [ ] `AM-VAL-06` Un administrateur tenant ne peut pas modifier les entitlements.
- [ ] `AM-VAL-07` Un opérateur autorisé peut activer `clariprint_data.enabled` avec motif et provenance.
- [x] `AM-VAL-08` Les mappings historiques sont couverts par des tests de contrat.
- [ ] `AM-VAL-09` L'API et la RLS appliquent toutes deux les contrôles d'accès.
- [x] `AM-VAL-10` Clariprint Data consomme l'API métier et ne connaît pas l'Edge Function qui l'héberge.
- [ ] `AM-VAL-11` Le dernier administrateur effectif ne peut pas être retiré accidentellement.
- [ ] `AM-VAL-12` Le contrat OpenAPI passe la validation automatique et génère des types compatibles.

## Décisions à valider avant implémentation durable

1. Hébergement de `/api/v1` : gateway dédié ou routage de façade vers des Edge Functions.
2. Source de vérité future des entitlements et propriétaire de leur UX opérateur.
3. Politique exacte de récupération lorsqu'un tenant n'a plus d'administrateur.
4. Sémantique d'archivage d'un rôle encore affecté.
5. Catalogue de capabilities : manifest statique versionné au build ou registre serveur.
