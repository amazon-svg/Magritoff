# Précisions d'architecture — Kernel, modules et services

**Projet :** Magrit  
**Date :** 5 août 2026  
**Statut :** proposition à valider  
**Document parent :** [Diagnostic d'architecture et trajectoire de consolidation](./ARCHITECTURE_ASSESSMENT_AND_ROADMAP.md)

## 1. Objet

Cette note précise la répartition des responsabilités entre :

- le kernel applicatif ;
- les modules plateforme transversaux ;
- les modules métier ;
- les services publiés par ces modules ;
- les adaptateurs frontend, API et MCP.

Elle répond en particulier aux questions suivantes :

- où placer l'utilisateur et son identité ;
- où gérer les tenants et les sous-tenants ;
- où calculer les permissions ;
- où gérer les plans, abonnements, fonctionnalités et quotas ;
- comment éviter que le module `tenant` connaisse tous les modules métier ;
- comment partager les mêmes règles entre React, les API et MCP.

## 2. Décision générale

Magrit doit adopter :

1. un **kernel très réduit** contenant seulement le langage technique commun ;
2. des **modules plateforme spécialisés** pour l'identité, le tenant, l'accès et les droits commerciaux ;
3. des **modules métier autonomes** propriétaires de leurs règles et de leurs données ;
4. des **services applicatifs** comme façades d'utilisation des modules ;
5. des **adaptateurs entrants** pour React, les API et MCP ;
6. des **repositories et adaptateurs sortants** pour Supabase et les services externes.

Le kernel ne doit pas devenir un module central connaissant tout le produit.

## 3. Définitions

### 3.1 Kernel

Le kernel fournit les types et mécanismes universels nécessaires à la majorité des modules.

```text
kernel/
  ids/
  errors/
  result/
  money/
  pagination/
  clock/
  actor-context/
  domain-events/
```

Exemples :

```ts
type UserId = string;
type TenantId = string;
type RequestId = string;

type ActorContext = {
  userId: UserId;
  tenantId: TenantId;
  requestId: RequestId;
};
```

Le kernel ne contient pas :

- les plans tarifaires ;
- les abonnements ;
- les rôles métier ;
- les règles de commande ;
- les règles de boutique ou de PIM ;
- les tables Supabase ;
- les fonctionnalités disponibles pour un tenant ;
- les handlers React, HTTP ou MCP.

Règle de décision :

> Une notion susceptible d'évoluer avec le métier ou le modèle commercial n'appartient probablement pas au kernel.

### 3.2 Module

Un module correspond à un périmètre cohérent. Il possède :

- ses concepts et invariants ;
- ses types métier ;
- ses services applicatifs ;
- ses ports et repositories ;
- ses implémentations d'infrastructure ;
- ses événements ;
- ses contrats publics internes ;
- ses adaptateurs UI, API et MCP ;
- ses tests.

```text
modules/orders/
  domain/
  application/
  infrastructure/
  api/
  ui/
  mcp/
```

Un module n'est pas nécessairement un paquet publié, un microservice ou un processus séparé.

### 3.3 Service

Un service est une capacité publiée par un module. Dans cette note, le terme ne signifie pas nécessairement « serveur réseau ».

```ts
interface OrderService {
  createDraft(command: CreateOrderDraft): Promise<Order>;
  submit(command: SubmitOrder): Promise<Order>;
  transition(command: TransitionOrder): Promise<Order>;
}
```

Le service constitue la façade applicative du module. Les adaptateurs React, HTTP et MCP appellent cette façade au lieu d'accéder aux tables.

### 3.4 Adaptateur

Un adaptateur traduit un protocole ou fournisseur vers les contrats de l'application.

Adaptateurs entrants :

- hooks et contrôleurs React ;
- routes HTTP ;
- handlers MCP ;
- jobs et commandes d'administration.

Adaptateurs sortants :

- repositories Supabase ;
- Clariprint ;
- Anthropic ;
- Resend ;
- stockage de fichiers.

## 4. Modules plateforme transversaux

Les notions transversales ne doivent pas toutes être regroupées dans un unique module `auth`. Quatre responsabilités doivent être distinguées.

| Module | Question traitée |
|---|---|
| `identity` | Qui est l'utilisateur ? |
| `tenant` | Dans quelle organisation agit-il ? |
| `access` | Que peut-il faire dans cette organisation ? |
| `entitlements` | Quelles fonctionnalités et limites sont disponibles pour cette organisation ? |

Ces modules sont transversaux, mais ils restent hors du kernel car ils portent des règles fonctionnelles et commerciales susceptibles d'évoluer.

### 4.1 Module `identity`

Responsabilités :

- authentification ;
- validation de session et de token ;
- identité utilisateur globale ;
- profil global ;
- intégration Supabase Auth ;
- récupération de compte ;
- MFA si nécessaire.

Contrat indicatif :

```ts
interface IdentityService {
  verifyToken(token: string): Promise<AuthenticatedIdentity>;
  getCurrentUser(session: Session): Promise<UserIdentity>;
  getUser(userId: UserId): Promise<UserIdentity | null>;
}
```

Le module `identity` ne décide pas si un utilisateur peut valider une commande dans un tenant.

### 4.2 Module `tenant`

Responsabilités :

- création et cycle de vie des tenants ;
- hiérarchie tenant/sous-tenant ;
- sélection du tenant courant ;
- rattachement utilisateur-tenant ;
- membres ;
- invitations ;
- paramètres organisationnels généraux.

Contrat indicatif :

```ts
interface TenantService {
  get(tenantId: TenantId): Promise<Tenant | null>;
  listMemberships(userId: UserId): Promise<TenantMembership[]>;
  resolveMembership(userId: UserId, tenantId: TenantId): Promise<TenantMembership | null>;
  getHierarchy(tenantId: TenantId): Promise<TenantHierarchy>;
}
```

Le module `tenant` ne doit pas connaître les détails des fonctionnalités `orders`, `shops`, `quotes` ou `pim`.

### 4.3 Module `access`

Responsabilités :

- rôles ;
- capabilities ;
- affectation des rôles ;
- politiques d'autorisation ;
- règles d'ownership ;
- décision d'accès ;
- explication et audit des refus sensibles.

Contrat indicatif :

```ts
type AccessDecision =
  | {
      allowed: true;
      reason: "role" | "ownership" | "tenant_admin";
    }
  | {
      allowed: false;
      reason:
        | "not_authenticated"
        | "not_a_member"
        | "missing_capability"
        | "wrong_tenant";
    };

interface AccessService {
  can(actor: ActorContext, capability: string, resource?: ResourceRef): Promise<AccessDecision>;
  require(actor: ActorContext, capability: string, resource?: ResourceRef): Promise<void>;
  listCapabilities(actor: ActorContext): Promise<string[]>;
}
```

Le résultat doit pouvoir expliquer pourquoi une action est autorisée ou refusée.

### 4.4 Module `entitlements`

Responsabilités :

- plans ;
- abonnements ;
- fonctionnalités souscrites ;
- périodes d'essai ;
- overrides commerciaux ;
- quotas et limites d'usage ;
- consommation facturable si nécessaire.

Contrat indicatif :

```ts
interface EntitlementService {
  hasFeature(tenantId: TenantId, feature: string): Promise<boolean>;
  requireFeature(tenantId: TenantId, feature: string): Promise<void>;
  getLimit(tenantId: TenantId, quota: string): Promise<number | null>;
  consume(tenantId: TenantId, quota: string, amount: number): Promise<void>;
  getTenantEntitlements(tenantId: TenantId): Promise<TenantEntitlements>;
}
```

Le terme `entitlements` est préféré à `subscriptions`, car un droit commercial peut provenir :

- d'un abonnement ;
- d'une période d'essai ;
- d'un contrat entreprise ;
- d'un override administrateur ;
- d'une promotion ;
- d'une fonctionnalité incluse par défaut.

## 5. Composition d'une décision d'accès

Une autorisation métier est le résultat de plusieurs contrôles indépendants.

```text
Utilisateur authentifié
        |
        v
Membre du tenant
        |
        v
Capability fonctionnelle
        |
        v
Fonctionnalité incluse dans les entitlements
        |
        v
Invariant du module métier
        |
        v
Action autorisée
```

Exemple : passage d'une commande en production.

```ts
async function transitionOrder(
  actor: ActorContext,
  command: TransitionOrderCommand,
) {
  await tenantService.requireMembership(actor.userId, actor.tenantId);

  await accessService.require(actor, "orders.transition", {
    type: "order",
    id: command.orderId,
  });

  await entitlementService.requireFeature(
    actor.tenantId,
    "orders.advanced_workflow",
  );

  return orderService.transition(actor, command);
}
```

Le module `orders` vérifie encore ses invariants :

- appartenance de la commande au tenant ;
- statut courant attendu ;
- transition existante ;
- commande non annulée ;
- informations obligatoires présentes.

Répartition des décisions :

| Responsable | Décision |
|---|---|
| `identity` | l'appelant est authentifié |
| `tenant` | l'appelant appartient au contexte organisationnel |
| `access` | l'acteur possède la capability nécessaire |
| `entitlements` | le tenant dispose commercialement de la fonctionnalité |
| module métier | l'action est valide pour la ressource et son état |
| RLS | la requête ne franchit jamais la frontière de données autorisée |

Une capability et un entitlement ne doivent pas être confondus :

```text
« L'utilisateur peut-il valider une commande ? »
                           ≠
« Le plan du tenant inclut-il le workflow de validation ? »
```

Les deux réponses doivent être positives.

## 6. Publication des fonctionnalités par les modules

Le module `tenant` ne doit pas recevoir ou connaître directement tous les modes d'accès et abonnements des modules métier. Cela créerait une dépendance centrale croissante.

Chaque module publie plutôt un manifeste déclaratif :

```ts
const ordersManifest = {
  module: "orders",
  features: [
    "orders.basic",
    "orders.advanced_workflow",
    "orders.audit_trail",
  ],
  capabilities: [
    "orders.read",
    "orders.create",
    "orders.submit",
    "orders.transition",
    "orders.cancel",
  ],
};
```

Un registre assemble les manifestes au niveau du composition root :

```ts
const moduleManifests = [
  ordersManifest,
  catalogManifest,
  quotesManifest,
  shopsManifest,
];
```

Ensuite :

- `orders` déclare son vocabulaire de features et capabilities ;
- `entitlements` associe les features aux plans et contrats ;
- `access` associe les capabilities aux rôles ;
- `tenant` fournit le contexte organisationnel ;
- le composition root vérifie l'unicité et la cohérence des déclarations.

Exemple de plan :

```ts
const proPlan = {
  features: [
    "orders.basic",
    "orders.advanced_workflow",
    "orders.audit_trail",
  ],
};
```

Exemple de rôle :

```ts
const validatorRole = {
  capabilities: [
    "orders.read",
    "orders.transition",
  ],
};
```

## 7. Dépendances autorisées

Architecture logique cible :

```text
                         kernel
                           ^
             +-------------+-------------+
             |             |             |
         identity        tenant     entitlements
             |             |             |
             +-------------+-------------+
                           |
                         access
                           ^
             +-------------+-------------+
             |             |             |
           orders        quotes         shops
```

Ce schéma indique les contrats consommés, pas des imports bidirectionnels.

Règles :

1. tous les modules peuvent dépendre du kernel ;
2. le kernel ne dépend d'aucun module ;
3. les modules métier peuvent consommer les contrats plateforme ;
4. les modules plateforme n'importent pas les modules métier ;
5. un module métier n'accède pas directement aux tables d'un autre module ;
6. les dépendances concrètes sont injectées dans le composition root ;
7. les synchronisations non immédiates passent par des événements ;
8. le kernel ne sert jamais de service locator.

## 8. Communication intermodules

### 8.1 Appels synchrones

Utiliser un contrat de service lorsque l'appelant a besoin d'une réponse immédiate pour poursuivre son cas d'usage.

Exemples :

- vérifier une capability ;
- vérifier un entitlement ;
- résoudre un membership ;
- obtenir le prix d'un produit avant validation.

### 8.2 Événements

Utiliser un événement lorsqu'un changement doit déclencher des réactions indépendantes sans coupler directement les modules.

Événements possibles :

```text
TenantCreated
TenantMemberInvited
TenantMemberRemoved
SubscriptionChanged
EntitlementsChanged
OrderSubmitted
OrderCancelled
```

Exemple :

```text
SubscriptionChanged
        |
        +--> entitlements recalcule les fonctionnalités
        +--> audit enregistre le changement
        +--> notifications informe les administrateurs
```

Une vérification synchrone comme `canCreateOrder` ne doit pas être modélisée par un événement.

## 9. Modèle d'autorisation Magrit

Le modèle recommandé combine plusieurs niveaux complémentaires.

### 9.1 RBAC

Rôles standards :

```text
Owner
Admin
Acheteur
Validateur
Producteur
```

### 9.2 Capabilities

```text
orders.read
orders.create
orders.submit
orders.approve
orders.produce
orders.cancel
```

### 9.3 Conditions contextuelles

- même tenant ;
- sous-tenant accessible ;
- acteur créateur de la ressource ;
- rôle affecté à cette commande ;
- transition autorisée ;
- état compatible avec l'action.

### 9.4 Entitlements

- workflow avancé disponible ;
- nombre maximal de boutiques ;
- accès au PIM enrichi ;
- quota IA disponible ;
- génération de mockups activée.

### 9.5 RLS

La RLS PostgreSQL reste la protection finale et indépendante du comportement de l'interface, des API ou de MCP.

## 10. Intégration avec MCP

Le serveur MCP construit un contexte d'acteur après authentification :

```ts
type McpRequestContext = {
  actor: ActorContext;
  access: AccessService;
  entitlements: EntitlementService;
  requestId: string;
};
```

Un handler MCP reste un adaptateur léger :

```ts
async function transitionOrderTool(
  input: TransitionOrderInput,
  context: McpRequestContext,
) {
  await context.access.require(
    context.actor,
    "orders.transition",
  );

  await context.entitlements.requireFeature(
    context.actor.tenantId,
    "orders.advanced_workflow",
  );

  return orderService.transition(
    context.actor,
    input,
  );
}
```

Le handler MCP ne doit pas :

- lire directement les rôles en base ;
- interpréter lui-même le plan commercial ;
- recalculer les permissions ;
- accéder directement aux tables Supabase ;
- réimplémenter les transitions de commande.

Le frontend, l'API et MCP appellent le même service :

```text
Frontend React ----+
                   |
API HTTP ----------+--> OrderService --> OrderRepository / RPC
                   |
Serveur MCP -------+
```

## 11. Structure cible du dépôt

```text
src/
  kernel/
    actor/
    errors/
    events/
    ids/
    money/
    pagination/
    result/

  platform/
    identity/
    tenant/
    access/
    entitlements/
    audit/
    notifications/

  modules/
    orders/
    catalog/
    shops/
    quotes/
    pim/
    conversations/

  mcp/
    server/
    auth/
    registry/
    observability/

  shared/
    ui/
    validation/
    testing/
```

Le dossier `shared` doit rester contrôlé. Une fonctionnalité propre à un domaine ne doit pas y être déplacée uniquement parce qu'elle est utilisée deux fois.

## 12. Stratégie de migration

### Étape 1 — Définir les contrats

- créer `ActorContext` dans le kernel ;
- définir `IdentityService`, `TenantService`, `AccessService` et `EntitlementService` ;
- documenter les responsabilités et non-responsabilités ;
- inventorier les rôles, capabilities, features et quotas existants.

### Étape 2 — Construire les adaptateurs existants

- implémenter les contrats au-dessus de Supabase Auth, des memberships, rôles, plans et RLS actuels ;
- conserver le comportement utilisateur existant ;
- ajouter des tests d'autorisation et d'isolation.

### Étape 3 — Module pilote `orders`

- déplacer les types et invariants de commande ;
- créer `OrderService` et `OrderRepository` ;
- centraliser les transitions ;
- déplacer la création multi-tables vers une RPC transactionnelle ;
- faire consommer le service par React ;
- ajouter ensuite l'adaptateur MCP en lecture seule.

### Étape 4 — Registre déclaratif

- publier le manifeste `orders` ;
- valider l'unicité des features et capabilities ;
- relier les rôles aux capabilities ;
- relier les plans aux features ;
- introduire progressivement les manifestes des autres modules.

### Étape 5 — Généraliser

- migrer `catalog`, `quotes`, `shops`, puis `pim` ;
- réduire les providers React globaux ;
- retirer les accès Supabase directs des composants ;
- compléter les adaptateurs MCP domaine par domaine.

## 13. Garde-fous

1. Le kernel reste petit et stable.
2. Aucun plan, rôle métier ou statut de commande dans le kernel.
3. `identity`, `tenant`, `access` et `entitlements` restent séparés.
4. Une capability ne représente pas un abonnement.
5. Un entitlement ne donne pas automatiquement une permission utilisateur.
6. Chaque module reste propriétaire de ses invariants.
7. Aucun module ne lit directement les tables privées d'un autre module.
8. Le module `tenant` ne connaît pas les détails des modules métier.
9. Les modules déclarent leurs features et capabilities par manifeste.
10. Le composition root assemble les implémentations.
11. Les événements servent aux réactions asynchrones, pas aux validations immédiates.
12. React, HTTP et MCP utilisent les mêmes services applicatifs.
13. La RLS reste active même si les contrôles applicatifs existent.
14. Les décisions sensibles sont explicables et auditables.

## 14. Critères de réussite

Cette architecture sera considérée comme correctement mise en place lorsque :

- l'identité, le membership, la permission et l'abonnement sont quatre décisions distinctes ;
- chaque capability et feature possède un propriétaire clairement identifié ;
- le module `tenant` ne dépend d'aucun module métier ;
- les handlers React et MCP ne connaissent pas les tables de rôles ou d'abonnements ;
- un même cas d'usage produit le même résultat depuis React, HTTP ou MCP ;
- les décisions de refus peuvent être expliquées et auditées ;
- les tests couvrent l'intersection rôle, tenant, entitlement, état métier et RLS ;
- un nouveau module peut publier ses capabilities sans modifier le code interne de `tenant` ;
- une évolution de plan commercial ne nécessite pas de modifier les modules métier ;
- les dépendances circulaires sont détectées par les outils de build ou de lint.

## 15. ADR proposés

| ID | Décision | Statut |
|---|---|---|
| ADR-CORE-001 | Maintenir un kernel minimal sans logique fonctionnelle ou commerciale | À confirmer |
| ADR-CORE-002 | Classer `identity`, `tenant`, `access` et `entitlements` comme modules plateforme | À confirmer |
| ADR-CORE-003 | Séparer capabilities utilisateur et entitlements tenant | À confirmer |
| ADR-CORE-004 | Faire publier par chaque module un manifeste de features et capabilities | À confirmer |
| ADR-CORE-005 | Assembler les manifestes et implémentations dans un composition root | À confirmer |
| ADR-CORE-006 | Interdire aux modules plateforme d'importer les modules métier | À confirmer |
| ADR-CORE-007 | Utiliser des événements pour les réactions intermodules asynchrones | À confirmer |
| ADR-CORE-008 | Partager les mêmes services applicatifs entre React, HTTP et MCP | À confirmer |
| ADR-CORE-009 | Conserver la RLS comme dernière barrière d'autorisation | À confirmer |

## 16. Formulation de référence

> Le kernel fournit le langage commun minimal.  
> Les modules plateforme fournissent l'identité, le contexte organisationnel, l'autorisation et les droits commerciaux.  
> Les modules métier fournissent les cas d'usage et restent propriétaires de leurs règles.  
> React, les API et MCP sont des adaptateurs qui consomment ces mêmes services.
