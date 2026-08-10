# Spécification du kernel

**Statut :** candidate  
**Version :** 0.2

**Implémentation initiale :** [`src/kernel`](../../../../src/kernel/index.ts), couverte par [`tests/kernel`](../../../../tests/kernel/kernel.test.ts)

## Mission

Le kernel fournit le langage technique minimal commun aux modules. Il garantit des représentations cohérentes des identifiants, résultats, erreurs, montants, unités, temps, pagination, contexte d'acteur et événements.

Il ne contient aucune règle fonctionnelle susceptible d'évoluer avec Clariprint, les commandes, les boutiques, les plans commerciaux ou Supabase.

## API publique proposée

```text
src/kernel/
  actor/
  clock/
  errors/
  events/
  ids/
  money/
  pagination/
  result/
  units/
```

## Identifiants

Les identifiants sont opaques au niveau TypeScript afin d'éviter les substitutions accidentelles.

```ts
declare const brand: unique symbol;

export type Id<Name extends string> = string & {
  readonly [brand]: Name;
};

export type UserId = Id<"UserId">;
export type TenantId = Id<"TenantId">;
export type RequestId = Id<"RequestId">;
```

Règles :

- le kernel définit uniquement les identifiants transversaux ;
- `SupplierId`, `MachineId` ou `PublicationId` appartiennent à Clariprint Data ;
- le parsing depuis une chaîne est explicite et valide au minimum le format non vide ;
- le kernel ne suppose pas que tous les identifiants sont des UUID tant que cette règle n'est pas contractuelle.

## Contexte d'acteur

```ts
export type ActorContext = Readonly<{
  kind: "user";
  userId: UserId;
  tenantId: TenantId;
  requestId: RequestId;
}>;
```

`ActorContext` représente une action utilisateur authentifiée et tenant-scoped. Il ne contient ni rôle, ni capability, ni entitlement : ces informations sont résolues par les modules plateforme.

Les traitements système utilisent un type distinct, par exemple `SystemActorContext`, et non un faux utilisateur administrateur.

Le discriminant `kind` empêche de confondre un contexte utilisateur et un contexte système. Il ne représente ni un rôle ni une capability.

## Résultat et erreurs

```ts
export type Result<T, E extends AppError = AppError> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: E }>;

export type AppError = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
  details?: Readonly<Record<string, unknown>>;
}>;
```

Règles :

- `code` est stable et destiné aux consommateurs ;
- `message` est sûr pour les journaux mais n'expose aucun secret ;
- les erreurs métier spécialisent `AppError` dans leur module ;
- les erreurs inattendues sont normalisées aux frontières ;
- un refus d'accès ne révèle pas l'existence d'une ressource cross-tenant.

## Argent

```ts
export type Currency = "EUR" | string;

export type Money = Readonly<{
  minorUnits: bigint;
  currency: Currency;
}>;
```

Règles :

- aucun calcul monétaire métier en virgule flottante ;
- addition et comparaison exigent la même devise ;
- arrondi et conversion ne sont jamais implicites ;
- taux de change, marge et fiscalité restent hors du kernel.

## Unités

Le kernel fournit le mécanisme de quantité typée, pas le catalogue métier complet.

```ts
export type Quantity<Unit extends string> = Readonly<{
  value: string;
  unit: Unit;
}>;
```

La valeur décimale est sérialisée sous forme de chaîne. Les unités autorisées et conversions propres au print appartiennent au module Clariprint Data ou à un référentiel explicitement partagé.

## Temps et horloge

```ts
export interface Clock {
  now(): Date;
}
```

- les services métier reçoivent une horloge injectable ;
- les timestamps persistés sont en UTC ;
- les dates d'effet métier restent distinctes des dates de création technique ;
- le kernel ne décide pas des fuseaux d'affichage.

## Pagination

```ts
export type PageRequest = Readonly<{
  cursor?: string;
  limit: number;
}>;

export type Page<T> = Readonly<{
  items: readonly T[];
  nextCursor?: string;
}>;
```

Le curseur est opaque. Le kernel ne connaît ni offset SQL ni PostgREST.

## Événements

```ts
export type DomainEvent<Name extends string, Payload> = Readonly<{
  id: string;
  name: Name;
  occurredAt: string;
  tenantId: TenantId;
  aggregateId: string;
  payload: Readonly<Payload>;
}>;
```

Les modules définissent leurs noms et payloads. Un événement est émis après validation des invariants. La persistance transactionnelle et la livraison relèvent de l'infrastructure, pas du kernel.

## Dépendances autorisées

Le kernel peut dépendre uniquement :

- de TypeScript et de la bibliothèque standard ;
- d'une bibliothèque décimale si elle est retenue par ADR ;
- d'une bibliothèque de validation uniquement derrière une API stable, si nécessaire.

Le kernel ne peut jamais importer :

- React ou un framework UI ;
- Supabase, Postgres ou un client HTTP ;
- les modules plateforme ;
- un module métier ;
- des variables d'environnement ;
- les types générés de la base ;
- un schéma ou payload d'intégration externe.

## Compatibilité et évolution

- toute rupture de contrat exige un ADR et une migration des consommateurs ;
- une primitive n'entre dans le kernel qu'après au moins deux usages réels ou une nécessité universelle démontrée ;
- aucune primitive ne doit être ajoutée pour éviter localement trois lignes de code ;
- les exports publics passent par un `index.ts` explicite ;
- les imports de fichiers internes du kernel sont interdits aux modules.

L'import public courant est `@/kernel`. Les sous-dossiers restent des détails d'implémentation.

## Critères d'acceptation

- [x] `KER-VAL-01` Le kernel est inclus dans un build Vite réussi sans React, Supabase ou module métier.
- [x] `KER-VAL-02` Les imports React, Supabase et couches applicatives interdites sont contrôlés par un test automatique.
- [x] `KER-VAL-03` Deux identifiants de domaines différents ne sont pas interchangeables au compile-time.
- [x] `KER-VAL-04` Les opérations monétaires refusent les devises incompatibles.
- [x] `KER-VAL-05` L'horloge peut être figée dans un test.
- [x] `KER-VAL-06` Les erreurs possèdent un code stable et un caractère retentable explicite.
- [x] `KER-VAL-07` Aucun rôle, entitlement, table ou statut métier n'apparaît dans le kernel.

`KER-VAL-03` est contrôlé par `tests/kernel/types.typecheck.ts` et le script `pnpm typecheck`, configuré en mode strict pour le kernel et les futurs modules. `pnpm typecheck:all` conserve séparément la visibilité sur la dette TypeScript du code brownfield historique.

## Décisions ouvertes

1. Bibliothèque décimale ou représentation entière/chaîne selon les précisions requises.
2. Format canonique des identifiants transversaux.
3. Outil complet de contrôle des frontières au-delà du premier test ciblé sur le kernel.
