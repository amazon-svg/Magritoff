# Conventions API — module Gestion commerciale (Epic E10)

> **Statut : opposable.** Produit par la story **E10.0 « Socle API-first »**, Sprint 5.
> Source de vérité du contrat : [`openapi/magrit-core.v1.yaml`](../../openapi/magrit-core.v1.yaml).
> Exigence d'origine : API-first / modulaire posée par Xavier Péchoultres au WM du 2026-09-01 — l'intégration Magrit ↔ Studio démarre côté données à partir de ce contrat, pas à partir du code.

Le contrat n'est pas un sous-produit du code. Il vient **avant**. Un endpoint qui n'est pas décrit dans `openapi/magrit-core.v1.yaml` ne se code pas.

---

## 1. Les 13 critères d'acceptation et leur mise en œuvre

| # | Critère | Où c'est tenu | Comment le vérifier |
|---|---|---|---|
| 1 | `openapi/magrit-core.v1.yaml` (OpenAPI 3.1) fait foi ; aucun endpoint E10 codé sans y être décrit avant | Le contrat ; l'ancien `docs/architecture/api/openapi.yaml` porte un en-tête de dépréciation ; **registre `src/server/api/gescom-routes.ts`** | `pnpm test:contract` → « CA1 » du document **et** `gescom-routes.contract.test.ts`, qui exige pour chaque route enregistrée un `operationId` correspondant dans le contrat |
| 2 | Types TS générés depuis le contrat via `pnpm gen:api` ; aucun DTO écrit à la main des deux côtés | `scripts/gen-api-types.sh` → `src/platform/api/generated/magrit-core.v1.ts` ; `CONTRACT_ALIGNMENT` dans `src/modules/_shared/api/contracts.ts` (portée réelle : §2.1) | `pnpm gen:api:check` (échoue si le fichier généré a dérivé) + test « CA2 » |
| 3 | Routes préfixées `/api/v1/`, ressources au pluriel en kebab-case | `servers[0].url` du contrat ; règle **unique** `checkResourcePath()` dans `src/modules/_shared/api/path-rules.ts`, partagée par `assertRoutePath()` et le lint | test « CA3 » (contrat) + `gescom-middleware.contract.test.ts` (refus à la définition) |
| 4 | Tenant toujours résolu depuis le jeton, jamais un paramètre | `src/modules/_shared/application/tenant-resolution.ts` | test « CA4 » : `?tenant_id=` → 400 `api.tenant_not_addressable` ; `{tenantId}` en chemin → la route ne se déclare pas |
| 5 | Deux modes d'auth : Bearer JWT utilisateur et clé de service à scopes | `securitySchemes.bearerAuth` / `serviceKey` ; `resolvePrincipal()` + `assertScopes()` **fermé par défaut** (§3.1) | tests « CA5 » : route sans scope refusée à la définition, clé de service refusée en 403, `x-required-scopes` linté sur le contrat |
| 6 | Succès `{ data, meta }` ; erreur RFC 7807 `application/problem+json` avec `code` métier stable | `buildEnvelope()` et `renderProblem()` dans `gescom-middleware.ts` ; `problem.ts` | tests « CA6 » |
| 7 | Pagination par curseur `?page[size]&page[cursor]`, suivant dans `meta.next_cursor` | `src/modules/_shared/application/pagination.ts` | test « CA7 » |
| 8 | Tout POST créant une ressource honore `Idempotency-Key` | `idempotency.ts` + table `public.api_idempotency_keys` ; empreinte = méthode + chemin + **query** + corps | tests « CA8 », rejeu et réutilisation abusive compris |
| 9 | Tout PATCH protégé par `ETag`/`If-Match` ; conflit → 409 avec l'état courant | `concurrency.ts` ; `concurrencyGuarded` non désactivable sur un PATCH ; **`If-Match: *` refusé** (§3.2) | tests « CA9 » : 428 sans en-tête, 400 sur `*`, 409 sur ETag périmé, 200 + nouvel ETag sinon |
| 10 | Bus d'événements `outbox_events`, payload versionné, signature HMAC | `outbox.ts` + migration `20260901000100_gescom_outbox_events.sql` ; section `webhooks` du contrat | test « CA10 » (contrat) **et** `tests/sql/gescom-outbox-append-only.sql`, qui exerce réellement trigger et RLS via `pnpm test:storefront:sql` |
| 11 | Organisation modulaire cohérente avec le dépôt ; aucun composant React n'interroge la base | `src/modules/_shared/` (pas de `ui/`) | `pnpm test:architecture` → `gescom-api-socle-boundaries.test.ts` |
| 12 | Test de contrat par endpoint, CI bloquante | `tests/contract/` + `.github/workflows/architecture.yml` | `pnpm test:contract` |
| 13 | v1 additive uniquement ; changement cassant → `/api/v2` | §7 de ce document + en-tête du contrat | test « CA13 » |

---

## 2. Décisions techniques prises en E10.0

### 2.1 Outillage `gen:api` — contrat-first, `openapi-typescript`

**Retenu : `openapi-typescript` 7.13.0.** Le YAML est la source, les types TypeScript sont un artefact dérivé, régénéré par `pnpm gen:api` et **commité** (pour que `pnpm typecheck` et la CI n'aient pas à regénérer).

**Écarté : `zod-openapi`.** La compatibilité a été vérifiée, pas supposée : `zod-openapi@6.0.2` déclare `peerDependencies: { "zod": "^4.0.0" }`, et le dépôt est en `zod@4.4.3` — il **fonctionnerait**. Il est écarté pour une raison de direction, pas de version : `zod-openapi` va du code vers le contrat (code-first). Le YAML deviendrait un artefact de build, ce qui contredit frontalement le CA1 et l'attente du partenaire, qui veut un contrat lisible **avant** que le code existe.

Conséquence assumée : les schémas Zod du socle et le contrat décrivent la même chose à deux endroits. Deux garde-fous empêchent la dérive silencieuse.

**Ce que `CONTRACT_ALIGNMENT` garantit, et ce qu'il ne garantit pas.** Cette assertion de compilation (`src/modules/_shared/api/contracts.ts`) attrape la disparition ou le renommage d'un champ, un champ requis devenu incompatible, et surtout les **énumérations** — `EventName` est généré en union de littéraux, donc ajouter une valeur côté Zod sans l'ajouter au YAML ne compile plus.

Elle n'attrape **rien** de ce que le contrat exprime en `pattern`, `format`, `minimum` ou `maxLength`. `Money` et `Rate` sont générés en `string` des deux côtés : l'assertion y est **tautologique** (`string extends string`) et ne prouve rien sur le format. Un montant sérialisé en flottant passerait sans bruit.

La garantie de format est portée par le second garde-fou, à l'exécution : **`tests/contract/shared-components.contract.test.ts`** valide via Ajv 2020 les payloads réellement produits par le code contre le JSON Schema du contrat, dans les deux sens (ce que Zod produit est légal au contrat ; ce que le contrat déclare légal est accepté par Zod). C'est ce test-là qui tient le CA2 sur les formats.

### 2.2 Sort de `DomainEvent`

`src/kernel/events/index.ts` définissait `DomainEvent<Name, Payload>` sans aucun usage dans le dépôt.

**Décision : conservé et réutilisé comme socle, pas remplacé.** `OutboxEvent` en dérive par intersection (`src/modules/_shared/application/outbox.ts`). `DomainEvent` apportait déjà `id` / `name` / `occurredAt` / `tenantId` / `aggregateId` / `payload` ; il lui manquait les deux champs exigés par le CA10 : la **version du payload** et le **type d'agrégat**. Ils sont ajoutés côté module, pas dans le kernel — le kernel reste minimal (R4) et aucun code existant n'est touché.

### 2.3 Deux façades HTTP qui coexistent

`createApiV1Handler` (historique) et `createGescomApiHandler` (E10) tournent côte à côte. Elles partagent le routage (`compilePathTemplate`, exporté depuis `api-v1-handler.ts`) mais pas la forme de réponse :

| | Historique | E10 |
|---|---|---|
| Succès | payload nu | `{ data, meta }` |
| Erreur | `{ ..., requestId }` | `{ ..., request_id, code }` en `application/problem+json` |

Aligner l'historique casserait ses clients (dérogation R5 — voir §8).

**Comment elles coexistent concrètement** (décision du montage, E10.0) : elles sont servies par **la même edge function**, `supabase/functions/magrit-api/index.ts`, sur le même préfixe `/api/v1`. `createMagritApiApplication()` compose les deux et place devant elles `createApiFacadeRouter()`, qui aiguille **d'après le chemin** :

- le chemin correspond à une route de `gescomRoutes()` → façade E10 ;
- sinon → façade historique, inchangée.

*Pourquoi pas une edge function séparée* : il aurait fallu un second déploiement, une seconde configuration CORS et surtout une règle de routage côté hébergeur pour découper `/api/v1` entre deux fonctions — de la configuration de déploiement que ce sprint ne peut pas livrer. Le front (`FetchApiClient`) pointe déjà sur `/api/v1/...` sans savoir qui répond : router en interne le laisse inchangé.

*Pourquoi aiguiller sur le chemin seul, et pas sur le couple chemin + méthode* : un `DELETE /api/v1/customers` non déclaré retomberait sinon sur la façade historique, qui répondrait 404 dans **son** format (`requestId` camelCase) à un client qui attend `request_id`. Un chemin appartient à une façade, avec toutes ses méthodes.

*Collisions* : deux façades qui partagent un espace d'URL peuvent se recouvrir, et un recouvrement rendrait une route historique injoignable **en silence**. Le recouvrement par paramètre est traité : `/customers/{id}` capterait `/customers/export`.

`assertNoFacadeCollision()` s'exécute à **deux moments**, et il faut savoir lequel fait quoi :

1. **Au chargement du module** `src/server/api/legacy-routes.ts`, sur `GESCOM_ROUTES` × `LEGACY_ROUTE_DEFINITIONS` — deux listes de **définitions**, construites sans service réel, donc disponibles avant toute requête. L'edge function importe ce module : une collision fait échouer le démarrage à froid, franchement, et la CI la voit au premier test qui importe le module.
2. **À chaque composition**, dans `createMagritApiApplication()`. Ce second passage est une conséquence du fait que les services sont liés au client Supabase de la requête : la composition ne peut pas être hissée au chargement du module sans changer la façon dont les clients sont injectés. Il ne remplace pas le premier — il le double.

Autrement dit : la garantie « ça ne démarre pas » est portée par (1), pas par (2). Avant l'extraction de `legacy-routes.ts`, seul (2) existait, et une collision aurait levé une erreur **à chaque requête, en continu**, au lieu d'un échec de boot propre.

### 2.4 Table `api_idempotency_keys`

Le CA8 exige que l'`Idempotency-Key` soit **honorée**, ce qui suppose un stockage qui survive au redémarrage du process : c'est justement après un incident réseau que le client retente. Le socle définit le port `IdempotencyStore` et une implémentation en mémoire pour les tests ; la table `public.api_idempotency_keys` (migration `20260901000200`) est son support durable. L'adaptateur Supabase du port sera écrit par la première story E10.x qui expose une création.

---

## 3. Règles transverses opposables

### 3.1 Scopes de clé de service — fermé par défaut

Une opération joignable par une clé de service **doit** déclarer ses scopes, en code (`requiredScopes`) comme au contrat (`x-required-scopes`). La règle est fermée par défaut, dans les deux sens :

- `defineGescomRoute()` **refuse à la définition** toute route dont `authentication` vaut `'any'` (le défaut) ou `'service'` sans `requiredScopes` non vide ;
- `assertScopes()` **refuse en 403** une clé de service qui atteindrait malgré tout une opération sans scope déclaré ;
- `lintRequiredScopes()` refuse un contrat où une opération joignable par `serviceKey` n'annonce pas ses `x-required-scopes`, ou en annonce un absent de `x-magrit-scopes` ;
- `lintRoutesAgainstContract()` refuse un écart entre les scopes du code et ceux du contrat.

La seule dispense est de restreindre explicitement l'opération aux jetons utilisateur : `authentication: 'user'`. Leurs droits viennent des rôles du tenant, vérifiés par la RLS et le service métier, pas de scopes.

Laisser passer une liste vide reviendrait à transformer chaque oubli de déclaration en ouverture silencieuse de l'opération à **toutes** les clés du tenant — Studio pourrait écrire là où il n'a que la lecture.

### 3.2 `If-Match: *` est refusé

Contrairement à la sémantique RFC 7232, où `*` signifie « pourvu que la ressource existe », la façade le refuse en **400 `api.if_match_invalid`**. L'accepter reviendrait à laisser un appelant désactiver le contrôle de concurrence à sa guise : deux commerciaux éditant la même fiche s'écraseraient en silence, ce que le CA9 interdit. Le `pattern` du paramètre `IfMatch` au contrat n'admet qu'un ETag, faible ou fort.

### 3.3 Rejeu d'idempotence

Une requête est identifiée par **méthode + chemin + query + corps** — deux POST au même chemin avec des query différentes ne sont pas la même requête. Sur un rejeu :

- la réponse mémorisée est rendue telle quelle, `data` compris ;
- `meta.request_id` est **recalé sur la requête courante**, pour que la promesse « `meta.request_id` == en-tête `X-Request-Id` » reste vraie sans exception ;
- l'en-tête `Idempotency-Replayed: true` signale le rejeu, ce que le seul statut 201 ne dit pas.

### 3.4 Sélection de l'espace de travail — `X-Magrit-Tenant`

> ✅ **Amendement au CA4 — RATIFIÉ le 2026-09-01 (décision Arnaud).** Le CA4 avait été accepté tel quel par la revue du Lot 0. Le montage a montré qu'il était **inapplicable en l'état** : aucun claim du JWT ne porte le tenant Magrit. La lecture décrite ci-dessous est la règle en vigueur ; elle ne se rediscute plus story par story.

**Le problème.** Le CA4 impose que le tenant vienne du jeton. Or un JWT Supabase ne porte **aucun** tenant Magrit, et un compte appartient régulièrement à plusieurs espaces — un tenant parent et ses sous-tenants, une agence et ses clients. Le front lui-même résout l'espace courant depuis l'URL `/t/:slug` (voir `TenantContext`), pas depuis la session. Le port `PrincipalVerifier` n'avait donc **aucune implémentation possible** : E10.4 ne pouvait pas savoir de quel espace lister les clients.

Deviner « le » tenant d'un compte multi-espaces reviendrait à lui montrer le référentiel client d'un autre espace que celui qu'il consulte. C'est un défaut de confidentialité, pas une approximation d'ergonomie.

**La règle : le jeton autorise, l'en-tête sélectionne.**

| `X-Magrit-Tenant` | Espaces accessibles | Résultat |
|---|---|---|
| absent | exactement 1 | cet espace |
| absent | plusieurs | **400** `identity.tenant_selection_required` — l'API ne devine pas |
| absent | aucun | **403** `identity.tenant_not_resolved` |
| présent | l'espace en fait partie | cet espace |
| présent | l'espace n'en fait pas partie | **403** `identity.tenant_not_resolved`, réponse identique à celle d'un espace inexistant |

L'en-tête ne peut **jamais élargir** les droits : il choisit parmi ce que le jeton autorise déjà, et l'habilitation réelle reste tenue par la RLS. C'est le sens défendable du CA4 — interdire qu'un paramètre fasse **autorité**, ce que faisait `/tenants/{tenantId}/...`. Un en-tête n'est d'ailleurs ni un paramètre de chemin ni un paramètre de requête, les deux formes que le CA4 nomme.

`SupabaseApiPrincipalVerifier` interroge `current_user_tenant_ids()`, **la même fonction** que celle utilisée par les policies RLS : la façade et la base ne peuvent pas être en désaccord sur ce qui est accessible.

Côté front, `WorkspaceModuleUiBridge` attache l'en-tête depuis le tenant courant. Les clients de module ne transportent pas cette notion — `CustomersApiClient` ne connaît que sa ressource.

Une **clé de service** ignore cet en-tête : elle est émise **pour** un espace, qu'elle porte déjà.

---

## 4. Forme des réponses

### Succès

```json
{
  "data": { "id": "b1c2d3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d", "name": "Fidélité" },
  "meta": { "request_id": "0f8c...", "next_cursor": null, "page_size": 50 }
}
```

`meta.request_id` est toujours présent et vaut l'en-tête `X-Request-Id`.

### Erreur — RFC 7807, `Content-Type: application/problem+json`

```json
{
  "type": "about:blank",
  "title": "Conflit de version",
  "status": 409,
  "code": "api.resource_conflict",
  "request_id": "0f8c...",
  "detail": "La ressource a changé depuis la lecture.",
  "current_state": { "id": "...", "name": "Fidélité" }
}
```

`code` est **contractuel** : un client a le droit de brancher son comportement dessus. Forme `domaine.raison` en snake_case. Un code publié n'est jamais renommé en v1 — on en ajoute, on n'en retire pas.

Codes transverses du socle : voir `SHARED_PROBLEM_CODES` dans `src/modules/_shared/application/problem.ts`. Chaque module E10.x ajoute les siens sous son propre domaine (`quote.*`, `order.*`, `customer.*`, `price_rule.*`).

---

## 5. Typage — règles opposables

| Notion | Base | JSON | Exemple |
|---|---|---|---|
| Montant | `numeric(12,2)` | **chaîne** décimale, 2 décimales | `"1234.50"` |
| Taux | `numeric(6,4)` | **chaîne**, 4 décimales | `"0.5000"` = 50 % |
| Date / instant | `timestamptz` | ISO 8601 **UTC**, suffixe `Z` | `"2026-09-01T08:30:00.000Z"` |
| Date seule | `date` | `YYYY-MM-DD` | `"2026-09-01"` |
| Identifiant technique | `uuid` (v4) | UUID v4 | `"b1c2d3e4-5f60-4a7b-8c9d-0e1f2a3b4c5d"` |
| Numéro métier | colonne `text` | attribut, **jamais une clé** | `"DEV-2026-00042"` |
| Énumération | `text` + `check` | **snake_case** | `"margin_pct"` |

**Aucun montant ni taux en flottant JSON.** Un flottant perd des centimes sur les arrondis de TVA et de remise, et l'erreur ne se voit qu'à la facture.

---

## 6. Écrire un endpoint E10.x — la séquence

1. **Décrire l'opération dans `openapi/magrit-core.v1.yaml`** (seul l'agent `architecte` y touche). Réutiliser les composants partagés : `Problem`, `Meta`, `Money`, `Rate`, `Audit`, `PageSize`, `PageCursor`, `IdempotencyKey`, `IfMatch`, et les réponses d'erreur mutualisées.
2. **`pnpm gen:api`**, committer le fichier généré.
3. **Contrats Zod** dans `src/modules/<domaine>/api/contracts.ts`, client HTTP dans `api/client.ts`.
4. **Interface repository + service** dans `src/modules/<domaine>/application/`.
5. **Implémentation Supabase** dans `src/adapters/supabase/<domaine>-repository.ts`.
6. **Routes** dans `src/server/api/<domaine>-routes.ts`, via `defineGescomRoute()`.
7. **Test de contrat** dans `tests/contract/<domaine>.contract.test.ts`, avec `checkResponseAgainstContract()`.

### Convention de dossiers — précision opposable

E10.0 mentionnait littéralement une structure `routes/service/repository/dto/events/__tests__`. **Cette formulation est amendée.** Le socle et les modules E10.x suivent la convention **réellement en place** dans le dépôt, celle des 10 modules existants (`commercial`, `quotes`, `orders`, `shop-customers`, `catalog`, `members`, `roles`, `invitations`, `shops`, `libraries`) :

```
src/modules/<domaine>/
  api/contracts.ts          contrats Zod partagés client/serveur
  api/client.ts             client HTTP typé
  application/<d>-repository.ts   interface (port)
  application/<d>-service.ts      logique applicative
src/adapters/supabase/<domaine>-repository.ts   implémentation
src/server/api/<domaine>-routes.ts              routes HTTP
```

Introduire la structure littérale de l'énoncé aurait créé une onzième convention dans un dépôt qui en a déjà une, appliquée partout. Le socle transverse vit dans `src/modules/_shared/`, qui suit le même pattern et n'a **pas** de dossier `ui/` : il ne publie aucune UX.

---

## 7. Versionnement — v1 additive uniquement

**Autorisé en v1** (additif) :

- ajouter une opération, un chemin, un webhook ;
- ajouter un champ **optionnel** à une réponse ;
- ajouter une valeur à une énumération **de réponse** ;
- ajouter un paramètre optionnel, un code d'erreur, un scope de clé de service ;
- élargir une contrainte (augmenter un `maxLength`, relâcher un `pattern`).

**Interdit en v1** — exige `/api/v2` :

- retirer ou renommer un champ, un chemin, une opération, un `operationId` ;
- rendre obligatoire un champ jusque-là optionnel ;
- changer le type ou le format d'un champ (`number` → `string`, décimales) ;
- retirer une valeur d'énumération, ou en ajouter une à une énumération **de requête** que le serveur refuserait ;
- changer le statut HTTP d'une réponse existante, ou renommer un `code` métier ;
- restreindre une contrainte (baisser un `maxLength`, durcir un `pattern`).

`/api/v1` n'est **jamais** muté rétroactivement. Une v2 se monte à côté ; v1 reste servie jusqu'à extinction annoncée de ses clients.

---

## 8. Dérogations R5 en cours

| Dérogation | Portée | Chemin de mise en conformité |
|---|---|---|
| `docs/architecture/api/openapi.yaml` et la façade `createApiV1Handler` restent en `requestId` (camelCase) et payload nu, hors enveloppe `{ data, meta }` | Endpoints historiques uniquement (`/health`, `/diagnostics/*`, modules pré-E10) | Migration endpoint par endpoint vers l'enveloppe E10 lors de leur prochaine évolution fonctionnelle, ou bascule groupée en `/api/v2`. Aucun **nouvel** endpoint n'est admis sur l'ancienne forme. |
| Le port `IdempotencyStore` n'a que son implémentation en mémoire | Socle E10.0, qui n'expose aucune création | Adaptateur `src/adapters/supabase/api-idempotency-store.ts` sur la table `api_idempotency_keys`, à écrire par la première story E10.x qui expose un POST de création. |
| Le dispatcher qui relaie `outbox_events` n'est pas écrit | Socle E10.0, qui n'émet aucun événement | À livrer avec la première story qui publie un événement. Le mécanisme d'écriture, la signature et l'enveloppe sont déjà en place et testés. |

**Aucune dérogation n'est admise sur du code nouveau** (R5). Les trois lignes ci-dessus sont des périmètres non encore implémentés, pas des écarts dans ce qui a été livré.

### 8.1 Dette de vérification acceptée à la clôture du Lot 0

Ces points sont des **trous de couverture**, pas des défauts de comportement : le code fait ce qu'il doit, mais rien ne le prouverait automatiquement s'il cessait de le faire. Acceptés à la clôture du Lot 0 (revue qa-review), à résorber par les stories indiquées.

| Réf. | Trou | Pourquoi c'est un risque | Chemin de mise en conformité |
|---|---|---|---|
| **B3** | `tests/sql/gescom-outbox-append-only.sql` n'a **jamais été exécuté** — le poste de rédaction n'avait ni Docker ni `psql`. Le fichier est écrit et enregistré dans `SQL_CASES`, mais son verdict est inconnu. | Un cas SQL jamais lancé peut échouer sur une broutille (colonne manquante, seed absent) et donner l'illusion d'une garantie. | Lancer `pnpm db:local:start && pnpm test:storefront:sql` sur un poste équipé, **avant** la première story E10.x qui émet un événement. Corriger le cas s'il échoue. |
| **R1** | Le cas SQL accorde `grant select ... to authenticated` pour exercer la policy, puis le retire. Il ne teste donc **pas** l'état réel de production, où `authenticated` n'a aucun privilège : la policy est vérifiée, la fermeture par `revoke` l'est séparément, mais jamais les deux ensemble dans l'ordre réel. | Si un jour un `grant` est accordé par erreur, le test le détecte (dernière assertion). Mais si la policy était supprimée **et** le grant maintenu, l'ordre actuel des assertions ne le verrait pas. | Ajouter un scénario qui, sans aucun grant, vérifie que `authenticated` reçoit bien `42501` sur `select`. À faire avec le premier passage réel du cas (B3). |
| **R2** | Aucun test ne couvre `public.api_idempotency_keys` : ni ses contraintes (`unique (tenant_id, idempotency_key)`, forme de l'empreinte, cohérence `completed`), ni sa fermeture aux rôles client. | La table est le support durable du CA8. Une contrainte qui ne tient pas ferait silencieusement dériver l'idempotence vers du best-effort. | Cas SQL `tests/sql/gescom-idempotency-keys.sql`, à écrire avec l'adaptateur Supabase du port `IdempotencyStore` (première story E10.x exposant un POST). |
| **R3** | Le garde B2 tient sur **deux gonds** non redondants : le test d'architecture vérifie que tout fichier appelant `defineGescomRoute(` est cité par `gescom-routes.ts`, et le test de contrat vérifie que les routes du registre existent au contrat. Une route déclarée **hors** de `src/server/api/` (dans un module, par exemple) échapperait au premier gond, donc au second. | Le CA1 reposerait alors sur la discipline, ce que ce garde était censé remplacer. | Élargir le balayage du test d'architecture à `src/modules/**` et `src/adapters/**`, ou déplacer l'assertion dans `createGescomApiHandler` (refus au démarrage d'une route absente d'un manifeste d'operationId généré depuis le contrat). À faire à la première story qui publie un endpoint. |

### 8.2 Dette introduite par le montage des façades

| Réf. | Trou | Pourquoi c'est un risque | Chemin de mise en conformité |
|---|---|---|---|
| **M1** | L'edge function `supabase/functions/magrit-api/index.ts` n'est **ni typecheckée ni testée** : elle n'est dans aucun `tsconfig` (`include` ne couvre pas `supabase/`) et son exécution demande Deno + un déploiement Supabase. | Une erreur de câblage dans ce fichier n'est vue qu'au déploiement. C'est le seul maillon du montage qu'aucune commande locale ne couvre. | La composition a été **sortie du fichier** vers `createMagritApiApplication()` (dans `src/`, typechecké et testé) pour réduire au minimum ce qui reste non couvert : il n'y subsiste que l'instanciation des adaptateurs. Couverture réelle possible via `deno check` en CI. |
| **M2** | L'écriture dans `outbox_events` n'est **pas transactionnelle** avec l'écriture métier : les deux passent par PostgREST en deux appels HTTP. Le pattern outbox suppose l'atomicité. | Un événement peut se perdre si l'écriture métier réussit et l'ajout à l'outbox échoue. `bestEffortOutbox` journalise sans faire échouer la requête — échouer dirait au client que son opération a échoué alors qu'elle a réussi, et il rejouerait en créant un doublon. | Déplacer l'écriture métier **et** l'ajout à l'outbox dans une même fonction `api_*` `security definer`. À trancher avec la première story qui rend un événement critique (facturation, Studio). |
| **M3** | Le store d'idempotence monté est `InMemoryIdempotencyStore` : il ne survit pas au recyclage de l'isolat Deno. | La garantie du CA8 ne couvre qu'une fenêtre courte. Deux tentatives séparées par un recyclage créeraient un doublon. | Adaptateur Supabase sur `api_idempotency_keys` — déjà tracé en §8.1 (R2) et §8 (dérogations R5). Le montage rend cette dette **active** : elle n'était que théorique tant qu'aucun POST n'était joignable. |

### 8.3 Dette signalée sur E10.4 (module Clients), acceptée

| Réf. | Trou | Pourquoi c'est un risque | Chemin de mise en conformité |
|---|---|---|---|
| **m5** | Le trigger qui réinitialise `siret_verified` quand le SIRET change n'a **aucun test SQL réel**. Il n'est couvert que par un test de contrat contre un faux repository qui **réimplémente** le comportement du trigger. | Un test qui rejoue en TypeScript ce que fait le trigger prouve que le faux est cohérent avec lui-même, pas que le trigger existe ni qu'il fonctionne. Le supprimer ne casserait aucun test. | Ajouter le scénario au cas SQL `tests/sql/gescom-e10-4-customers.sql` : insérer un client SIRET vérifié, changer le SIRET, vérifier que `siret_verified` retombe à `false`. À faire au premier passage réel des cas SQL (§8.1 B3, Docker requis). |

**Corrigé plutôt que tracé** : `markSiretVerified` filtrait sur `tenant_id` + `id` sans le SIRET (m4). Un appel INSEE dure ; un `PATCH` concurrent changeant le SIRET pendant la vérification faisait apposer « vérifié » sur un numéro que personne n'avait contrôlé — un faux positif à valeur commerciale, pas une approximation. Le SIRET vérifié est désormais une **condition d'écriture** : zéro ligne touchée → `CustomerNotFoundError`, la vérification est perdue et relançable, ce qui est le bon comportement. Un test de contrat joue la course (crochet d'interleaving sur le délai INSEE) et vérifie que le résultat est perdu, pas appliqué.

> **Piège à connaître : un faux qui diverge de son port sans que rien ne le dise.**
> Ce correctif a d'abord été livré incomplet. Le port exigeait la nouvelle condition, l'adaptateur Supabase l'appliquait, mais le faux repository des tests de contrat avait gardé l'ancienne signature — et **passait le typecheck**, parce que TypeScript autorise la bivariance sur les paramètres de méthode. Une méthode déclarée avec moins de paramètres reste assignable.
>
> Conséquence : la suite de contrat attestait le comportement **inverse** de la production, et retirer la garde de l'adaptateur n'aurait fait échouer aucun test.
>
> À retenir pour toute évolution de port : `tsc` ne garantit pas qu'un faux honore le contrat qu'il implémente. Seul un test **comportemental** sur le cas que la garde protège le prouve. Écrire ce test fait partie du changement de port, pas d'un lot de suivi.

**Ce qui a été corrigé au montage et n'est donc pas de la dette** : `Access-Control-Allow-Headers` ne listait ni `idempotency-key` ni `if-match`, et `Access-Control-Expose-Headers` était absent. Le préflight aurait rejeté toute création et toute modification E10.4, et `response.headers.get('etag')` aurait rendu `null` dans le navigateur — le flux `If-Match` était inutilisable depuis le front, indépendamment du montage.

**Ce qui a été corrigé et n'est donc pas de la dette** : `Timestamp` déclarait `format: date-time` sans `pattern`, ce qui laissait le contrat accepter `2026-09-01T08:30:00+02:00` que Zod refusait. Corrigé à la clôture du Lot 0 — c'était la dernière fenêtre où durcir ce schéma restait gratuit, la règle « v1 additive » (§7) l'interdisant dès la publication du premier endpoint. La divergence est désormais impossible à réintroduire sans être vue : le test de **parité** de `shared-components.contract.test.ts` confronte, échantillon par échantillon, le verdict Zod et le verdict du contrat sur tous les scalaires.

### 8.4 Dette signalée sur E10.5 (dissociation comptes Magrit / comptes clients boutique), acceptée

| Réf. | Trou | Pourquoi c'est un risque | Chemin de mise en conformité |
|---|---|---|---|
| **n1** | `tests/sql/gescom-e10-5-shop-customer-link.sql` (unicité par boutique, cohérence inter-tenant, exclusivité `tenant_members` ⟺ `shop_customer_accounts`, `current_user_is_shop_customer()`) n'a **jamais été exécuté** — même contrainte que B3 (§8.1), Docker indisponible au poste de rédaction. | Une contrainte SQL écrite mais jamais lancée peut échouer sur une broutille et donner l'illusion d'une garantie prouvée. | Lancer `pnpm db:local:start && pnpm test:storefront:sql` sur un poste équipé. Le fichier est déjà enregistré dans `SQL_CASES` (`scripts/test-storefront-sql.sh`). |
| **n2** | `SupabaseApiPrincipalVerifier.isShopCustomer()` **échoue ouvert** (`return false`) si l'appel RPC `current_user_is_shop_customer()` erre, au lieu d'échouer fermé (503) comme `accessibleTenantIds()`. | Une erreur transitoire sur cette primitive laisserait passer un compte client boutique jusqu'au refus générique (0 espace accessible → 403 `identity.tenant_not_resolved`), pas jusqu'au 403 `auth.scope_forbidden` nommé. Ce n'est **pas** un trou de sécurité : la RLS (fermée par défaut sur `shop_customer_accounts`, membership `tenant_members` inexistante par construction, CA5) reste la barrière réelle — ce garde n'est qu'un diagnostic plus précis. | Si l'observabilité montre des erreurs récurrentes sur cette RPC en production, aligner sur `accessibleTenantIds()` (503) plutôt que fail-open. Décision volontairement différée pour ne pas faire d'une primitive de confort une nouvelle cause de panne totale de la façade. |
| **n3** | La fiche client (CustomerDetailPage) n'affiche qu'**un seul** badge d'accès boutique par interlocuteur (`shop_accesses[0]`), même si le modèle autorise un accès par boutique. | Un interlocuteur avec des accès dans plusieurs boutiques du même tenant ne verrait que le premier dans l'UI (l'API, elle, restitue bien le tableau complet — `GET .../contacts` n'est pas concerné). | Étendre l'UI à une liste de badges quand un tenant multi-boutiques l'exige réellement ; pas de donnée inventée en attendant, juste une simplification d'affichage assumée (story hors périmètre : « aucune UI de gestion de compte boutique complète »). |

---

## 9. Commandes

```bash
pnpm gen:api               # regénère les types depuis le contrat
pnpm gen:api:check         # échoue si les types générés ont dérivé du contrat
pnpm typecheck             # tsc sur kernel + platform + modules + adapters + server/api
pnpm test:architecture     # frontières modulaires, dont le socle E10
pnpm test:contract         # conformité du contrat et du code au contrat
pnpm test:storefront:sql   # comportement réel en base : triggers, RLS, append-only
```

Les quatre premières tournent en CI sur toute PR vers `main` ([`.github/workflows/architecture.yml`](../../.github/workflows/architecture.yml)) et sont **bloquantes**.

### Ce qui est vérifiable localement, et ce qui ne l'est pas

| Maillon | Vérifiable ici ? | Par quoi |
|---|---|---|
| Aiguillage entre les deux façades | **oui** | `tests/server/api/api-facade-router.test.ts` — façades bouchonnées, on observe laquelle reçoit la requête |
| Refus des collisions de chemin | **oui** | même fichier, `assertNoFacadeCollision` |
| Composition réelle (routes E10.4 montées, tenant du jeton, formats de réponse des deux façades) | **oui** | `tests/server/api/magrit-api-composition.test.ts` |
| Câblage des adaptateurs dans l'edge function | **non** | fichier hors `tsconfig`, exécution Deno requise (§8.2 M1) |
| Exécution bout en bout (`pnpm dev:b5` → clic « Clients » → réponse) | **non** | demande un déploiement Supabase Functions, donc Docker — absent de la machine de développement |
| Comportement réel en base (triggers, RLS) | **non** | `pnpm test:storefront:sql`, Docker requis (§8.1 B3) |

`pnpm test:storefront:sql` exige **Supabase local démarré** (`pnpm db:local:start`, donc Docker) : il exécute les cas de `tests/sql/` par `psql` contre la base réelle. Il n'est pas dans le workflow CI actuel, qui n'a pas de service Postgres. C'est le seul moyen de tester un trigger ou une policy pour de vrai — relire le texte d'une migration ne prouve rien, puisqu'une migration ne change jamais après coup.
