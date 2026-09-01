# Conventions API — module Gestion commerciale (Epic E10)

> **Statut : opposable.** Produit par la story **E10.0 « Socle API-first »**, Sprint 5.
> Source de vérité du contrat : [`openapi/magrit-core.v1.yaml`](../../openapi/magrit-core.v1.yaml).
> Exigence d'origine : API-first / modulaire posée par Xavier Péchoultres au WM du 2026-09-01 — l'intégration Magrit ↔ Studio démarre côté données à partir de ce contrat, pas à partir du code.

Le contrat n'est pas un sous-produit du code. Il vient **avant**. Un endpoint qui n'est pas décrit dans `openapi/magrit-core.v1.yaml` ne se code pas.

---

## 1. Les 13 critères d'acceptation et leur mise en œuvre

| # | Critère | Où c'est tenu | Comment le vérifier |
|---|---|---|---|
| 1 | `openapi/magrit-core.v1.yaml` (OpenAPI 3.1) fait foi ; aucun endpoint E10 codé sans y être décrit avant | `openapi/magrit-core.v1.yaml` ; l'ancien `docs/architecture/api/openapi.yaml` porte un en-tête de dépréciation | `pnpm vitest run tests/contract` → `openapi-document.contract.test.ts` « CA1 » |
| 2 | Types TS générés depuis le contrat via `pnpm gen:api` ; aucun DTO écrit à la main des deux côtés | `scripts/gen-api-types.sh` → `src/platform/api/generated/magrit-core.v1.ts` ; verrou de compilation `CONTRACT_ALIGNMENT` dans `src/modules/_shared/api/contracts.ts` | `pnpm gen:api:check` (échoue si le fichier généré a dérivé) + test « CA2 » |
| 3 | Routes préfixées `/api/v1/`, ressources au pluriel en kebab-case | `servers[0].url` du contrat ; `assertRoutePath()` dans `src/server/api/gescom-middleware.ts` | test « CA3 » (contrat) + `gescom-middleware.contract.test.ts` (refus à la définition) |
| 4 | Tenant toujours résolu depuis le jeton, jamais un paramètre | `src/modules/_shared/application/tenant-resolution.ts` | test « CA4 » : `?tenant_id=` → 400 `api.tenant_not_addressable` ; `{tenantId}` en chemin → la route ne se déclare pas |
| 5 | Deux modes d'auth : Bearer JWT utilisateur et clé de service à scopes | `securitySchemes.bearerAuth` / `securitySchemes.serviceKey` ; `resolvePrincipal()` + `assertScopes()` | test « CA5 » |
| 6 | Succès `{ data, meta }` ; erreur RFC 7807 `application/problem+json` avec `code` métier stable | `buildEnvelope()` et `renderProblem()` dans `gescom-middleware.ts` ; `problem.ts` | tests « CA6 » |
| 7 | Pagination par curseur `?page[size]&page[cursor]`, suivant dans `meta.next_cursor` | `src/modules/_shared/application/pagination.ts` | test « CA7 » |
| 8 | Tout POST créant une ressource honore `Idempotency-Key` | `idempotency.ts` + table `public.api_idempotency_keys` | test « CA8 » |
| 9 | Tout PATCH protégé par `ETag`/`If-Match` ; conflit → 409 avec l'état courant | `concurrency.ts` ; `concurrencyGuarded` non désactivable sur un PATCH | tests « CA9 » |
| 10 | Bus d'événements `outbox_events`, payload versionné, signature HMAC | `outbox.ts` + migration `20260901000100_gescom_outbox_events.sql` ; section `webhooks` du contrat | test « CA10 » |
| 11 | Organisation modulaire cohérente avec le dépôt ; aucun composant React n'interroge la base | `src/modules/_shared/` (pas de `ui/`) | `pnpm test:architecture` → `gescom-api-socle-boundaries.test.ts` |
| 12 | Test de contrat par endpoint, CI bloquante | `tests/contract/` + `.github/workflows/architecture.yml` | `pnpm test:contract` |
| 13 | v1 additive uniquement ; changement cassant → `/api/v2` | §6 de ce document + en-tête du contrat | test « CA13 » |

---

## 2. Décisions techniques prises en E10.0

### 2.1 Outillage `gen:api` — contrat-first, `openapi-typescript`

**Retenu : `openapi-typescript` 7.13.0.** Le YAML est la source, les types TypeScript sont un artefact dérivé, régénéré par `pnpm gen:api` et **commité** (pour que `pnpm typecheck` et la CI n'aient pas à regénérer).

**Écarté : `zod-openapi`.** La compatibilité a été vérifiée, pas supposée : `zod-openapi@6.0.2` déclare `peerDependencies: { "zod": "^4.0.0" }`, et le dépôt est en `zod@4.4.3` — il **fonctionnerait**. Il est écarté pour une raison de direction, pas de version : `zod-openapi` va du code vers le contrat (code-first). Le YAML deviendrait un artefact de build, ce qui contredit frontalement le CA1 et l'attente du partenaire, qui veut un contrat lisible **avant** que le code existe.

Conséquence assumée : les schémas Zod du socle et le contrat décrivent la même chose à deux endroits. Deux garde-fous empêchent la dérive silencieuse :

1. **Compilation** — `CONTRACT_ALIGNMENT` dans `src/modules/_shared/api/contracts.ts` : chaque schéma Zod doit produire une valeur assignable au type généré depuis le YAML, sinon `tsc` échoue.
2. **Exécution** — `tests/contract/shared-components.contract.test.ts` valide les payloads réellement produits par le code contre le JSON Schema du contrat, via Ajv 2020.

### 2.2 Sort de `DomainEvent`

`src/kernel/events/index.ts` définissait `DomainEvent<Name, Payload>` sans aucun usage dans le dépôt.

**Décision : conservé et réutilisé comme socle, pas remplacé.** `OutboxEvent` en dérive par intersection (`src/modules/_shared/application/outbox.ts`). `DomainEvent` apportait déjà `id` / `name` / `occurredAt` / `tenantId` / `aggregateId` / `payload` ; il lui manquait les deux champs exigés par le CA10 : la **version du payload** et le **type d'agrégat**. Ils sont ajoutés côté module, pas dans le kernel — le kernel reste minimal (R4) et aucun code existant n'est touché.

### 2.3 Deux façades HTTP qui coexistent

`createApiV1Handler` (historique) et `createGescomApiHandler` (E10) tournent côte à côte. Elles partagent le routage (`compilePathTemplate`, exporté depuis `api-v1-handler.ts`) mais pas la forme de réponse :

| | Historique | E10 |
|---|---|---|
| Succès | payload nu | `{ data, meta }` |
| Erreur | `{ ..., requestId }` | `{ ..., request_id, code }` en `application/problem+json` |

Aligner l'historique casserait ses clients (dérogation R5 — voir §7).

### 2.4 Table `api_idempotency_keys`

Le CA8 exige que l'`Idempotency-Key` soit **honorée**, ce qui suppose un stockage qui survive au redémarrage du process : c'est justement après un incident réseau que le client retente. Le socle définit le port `IdempotencyStore` et une implémentation en mémoire pour les tests ; la table `public.api_idempotency_keys` (migration `20260901000200`) est son support durable. L'adaptateur Supabase du port sera écrit par la première story E10.x qui expose une création.

---

## 3. Forme des réponses

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

## 4. Typage — règles opposables

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

## 5. Écrire un endpoint E10.x — la séquence

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

## 6. Versionnement — v1 additive uniquement

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

## 7. Dérogations R5 en cours

| Dérogation | Portée | Chemin de mise en conformité |
|---|---|---|
| `docs/architecture/api/openapi.yaml` et la façade `createApiV1Handler` restent en `requestId` (camelCase) et payload nu, hors enveloppe `{ data, meta }` | Endpoints historiques uniquement (`/health`, `/diagnostics/*`, modules pré-E10) | Migration endpoint par endpoint vers l'enveloppe E10 lors de leur prochaine évolution fonctionnelle, ou bascule groupée en `/api/v2`. Aucun **nouvel** endpoint n'est admis sur l'ancienne forme. |
| Le port `IdempotencyStore` n'a que son implémentation en mémoire | Socle E10.0, qui n'expose aucune création | Adaptateur `src/adapters/supabase/api-idempotency-store.ts` sur la table `api_idempotency_keys`, à écrire par la première story E10.x qui expose un POST de création. |
| Le dispatcher qui relaie `outbox_events` n'est pas écrit | Socle E10.0, qui n'émet aucun événement | À livrer avec la première story qui publie un événement. Le mécanisme d'écriture, la signature et l'enveloppe sont déjà en place et testés. |

**Aucune dérogation n'est admise sur du code nouveau** (R5). Les trois lignes ci-dessus sont des périmètres non encore implémentés, pas des écarts dans ce qui a été livré.

---

## 8. Commandes

```bash
pnpm gen:api            # regénère les types depuis le contrat
pnpm gen:api:check      # échoue si les types générés ont dérivé du contrat
pnpm typecheck          # tsc sur kernel + platform + modules + adapters + server/api
pnpm test:architecture  # frontières modulaires, dont le socle E10
pnpm test:contract      # conformité du contrat et du code au contrat
```

Les trois derniers tournent en CI sur toute PR vers `main` ([`.github/workflows/architecture.yml`](../../.github/workflows/architecture.yml)) et sont **bloquants**.
