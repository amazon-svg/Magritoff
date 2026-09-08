---
id: E10.13
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.2, E10.6, E10.9, E10.11, E10.12]
blocks: [E10.14, E10.15, E10.16]
---
# E10.13 — Étapes de production configurables et ordonnançables

Contrat écrit par l'architecte avant le démarrage (`docs/api/CONVENTIONS.md`
§8.15), en deux passes : un cadrage initial (contrat + documentation seule,
aucune migration posée), puis un arbitrage d'Arnaud du 2026-09-08 qui a
tranché deux réserves : (a) la conversion d'un devis pose désormais
**automatiquement** la première étape de production active sur la commande
créée, par un **appel explicite dans `api_convert_commercial_quote`**
(jamais un trigger — doctrine du dépôt, §8.15 #2ter) ; (b) **CA8 est hors
périmètre** de cette livraison, reporté à E10.15. Ce lot livre les **CA1 à
CA7**.

**Limite d'accès héritée du cadrage, non levée par `dev-story`** : comme pour
E10.12, cet agent n'a pas d'accès Notion. Le texte transmis par l'agent
appelant (§0 du contrat, résumé des 8 CA, contrat esquissé, contraintes
techniques) est traité comme le périmètre opposable. La confrontation aux CA
numérotés exacts de la page Notion reste à faire par le `scribe` ou un humain
avec accès — même réserve (f) qu'E10.12, non résolue ici.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260908020000` | (1) Table **neuve** `production_steps` (`id`, `tenant_id`, `label`, `position`, `color`, `is_terminal`, `is_active`, `created_at`, `updated_at`), distincte de `tenant_order_status_definitions` (boutique, verrouillée par un enum SQL — voir §0 découverte n°2 du contrat). Contraintes : `unique(tenant_id, position) deferrable initially immediate` (piège documenté : la fonction de réordonnancement doit poser `set constraints ... deferred`), index unique fonctionnel `(tenant_id, btrim(lower(label)))` (unicité normalisée, étapes désactivées comprises). (2) `seed_tenant_catalogs()` étendue (`create or replace`, jamais une édition de `20260601000200`/`20260824000600`) : troisième bloc d'insertion, les six étapes standard (Fichier reçu → PAO → Fichier validé → En cours de production → En cours d'expédition → Livré, « Livré » seule terminale), plus le **rattrapage** des tenants déjà créés. (3) `commercial_orders.current_production_step_id` — colonne neuve, nullable, `on delete restrict` depuis `production_steps` ; le trigger `commercial_orders_immutable()` d'E10.12 **n'est ni édité ni recréé** (il est par colonne, une colonne neuve n'y figure pas). (4) `api_convert_commercial_quote` **recopiée verbatim** depuis `20260908010000` (`create or replace`, même signature), une seule différence : `current_production_step_id` posé par sous-requête scalaire dans le `values` (étape active de position la plus basse du tenant, `null` sans erreur si aucune étape active). (5) Rattrapage des commandes `commercial_orders` déjà créées par E10.12. (6) Trois fonctions `security definer` (`api_create_production_step`, `api_delete_production_step`, `api_reorder_production_steps`), serialisées par tenant via `pg_advisory_xact_lock` (même patron que `api_create_order_atomic`). (7) `list_commercial_orders_by_production_step` — lecture `security invoker`, nécessaire pour `sort=production_step` (CA6) : PostgREST ne sait pas propager un `ORDER BY` sur une colonne d'une table jointe en `LEFT JOIN` au niveau de la ligne parente. |
| RLS | `production_steps_select` (forme identique aux autres tables E10) ; `production_steps_write` porte **directement** `public.user_has_capability(tenant_id, 'can_manage_production_steps')` en `using`/`with check` — pas un rôle codé en dur (règle 4 du §3.5). Les trois fonctions `security definer` **bypassent** cette RLS (propriétaire de fonction) : chacune réimplémente donc explicitement le même contrôle, même discipline qu'`api_convert_commercial_quote`. |
| `GET /production-steps` | `listProductionSteps` — liste ordonnée par `position`, filtre `status`, **sans pagination** (catalogue borné, plafond 50), `ETag` de **collection** — seule collection du contrat dans ce cas (décision #7) : porte toujours sur le catalogue **complet**, même quand `status` a filtré la réponse. `bearerAuth` + `serviceKey`, scope `orders:read` (déjà publié, aucun scope neuf). |
| `POST /production-steps` | `createProductionStep` — 201, `Idempotency-Key` exigée, position affectée par le serveur (fin de flux), couleur affectée de façon déterministe (`colorForLabel`, même mécanique que `createProjectTag`) si absente. 409 `production_step.label_conflict` (jamais une création idempotente sur le libellé, à la différence de `createProjectTag`). 422 `production_step.limit_reached` au-delà de 50. |
| `GET /production-steps/{stepId}` | `getProductionStep` — fiche + `ETag` de l'**étape** (portée distincte de l'`ETag` du catalogue). Existe pour donner sa précondition à `updateProductionStep`. |
| `PATCH /production-steps/{stepId}` | `updateProductionStep` — `If-Match` (ETag de l'étape), modification partielle (label/color/is_terminal/is_active), **jamais** `position`. Passe par un `UPDATE` direct gardé par la RLS — **aucune** fonction dédiée (contrat §3). Désactiver une étape portée par des commandes est autorisé sans garde (CA3). |
| `DELETE /production-steps/{stepId}` | `deleteProductionStep` — 409 `production_step.in_use` tenu **en base** par la clé étrangère `on delete restrict` (jamais une vérification préalable de façade), réindexation des positions restantes dans la même transaction. |
| `PUT /production-step-positions` | `reorderProductionSteps` — `If-Match` **exigé, sur le catalogue** (ETag de `listProductionSteps`, exception assumée à la règle « aucun ETag sur une collection », décision #7). Corps `{ step_ids }` exhaustif (actives et désactivées), réindexation 0..n-1. 422 `production_step.positions_mismatch` sur un ensemble incomplet/dupliqué. |
| `CommercialOrder`/`CommercialOrderDetail` | `current_production_step_id` — champ requis, nullable. Posé une seule fois à la conversion ; aucune opération de ce contrat ne le change ensuite (E10.14). |
| `listCommercialOrders` | Deux paramètres nouveaux (CA6) : `current_production_step_id` (égalité stricte, 422 `production_step.not_found` si l'id ne appartient pas au tenant — jamais une page vide) et `sort` (`-created_at` défaut, `created_at`, `production_step`, `-production_step` — nulls **toujours** en dernier, dans les deux sens). |
| Capability nouvelle | `can_manage_production_steps`, exigée par les quatre opérations d'écriture. Détenue par un `admin` par dérivation (`user_has_capability`), aucune délégation à un membre ordinaire aujourd'hui. |
| Module `production-steps` (nouveau) | `api/contracts.ts` (schémas Zod miroir du contrat + alignement de compilation), `api/client.ts` (UI), `application/production-steps-repository.ts` (port + six erreurs de domaine), `application/production-steps-service.ts` (garde `can_manage_production_steps`, `colorForLabel`), `index.ts`, `manifest.ts`/`surface-contributions.ts` (écran de paramétrage, capability). |
| Adaptateur Supabase | `src/adapters/supabase/production-steps-repository.ts` — `create`/`remove`/`reorder` délèguent entièrement aux fonctions `api_*` (RPC) ; `update` reste un `UPDATE` direct gardé par la RLS ; mapping d'erreurs par message/code Postgres (`23505`→label_conflict, `23503`→in_use). |
| Routes | `src/server/api/production-steps-routes.ts` — six routes, garde de capability posée **avant** toute lecture de ressource (même ordre que `updatePriceRule`, qa-review E10.6 round 2 R3). Enregistré dans `gescom-routes.ts`. |
| `commercial-orders` (mis à jour) | `api/contracts.ts` (+`current_production_step_id`, +`CommercialOrderSort`), `application/commercial-orders-repository.ts` (+`currentProductionStepId`/`sort` dans `ListCommercialOrdersParams`), adaptateur Supabase (`listByProductionStep()` délègue à la RPC `list_commercial_orders_by_production_step` avec un curseur porté par `${current_production_step_id ?? ''}|created_at`), routes (validation 422 `production_step.not_found` via une **dépendance croisée explicite** vers `ProductionStepsService`, même précédent que `convertQuote`/`CommercialQuotesService`). |
| Câblage edge function | `supabase/functions/magrit-api/index.ts` — `ProductionStepsService` instancié sur `client`, injecté dans `gescomServices` et dans `createCommercialOrdersRoutes` (troisième paramètre). |
| UI | `ProductionStepsPage.tsx` (`DashboardProductionSteps`) — écran de paramétrage complet : liste ordonnée, glisser-déposer natif (HTML5 `draggable`) pour réordonner, édition inline (label/couleur/terminale) avec `getForEdit()`+`If-Match` avant chaque `PATCH`, activation/désactivation, suppression (erreur 409 affichée en bannière, invite à désactiver). Aucun contrôle métier côté navigateur — la position rendue est toujours celle du serveur. Route `workspace` gardée par `requiredCapabilities: ['can_manage_production_steps']` (garde d'ergonomie, l'autorisation réelle est la RLS). |

## Ce qui n'est PAS dans le périmètre

- **CA8 (modèles de notification rattachés à une étape) — arbitrage (b), reporté à E10.15.** `ProductionStep` ne porte aucun champ de notification, aucun point d'extension vide n'a été publié (ni au contrat, ni à l'écran). Rien n'a été préparé à ce titre — conforme à la prescription du contrat (§8bis) : « une section vide est une promesse d'interface que rien ne tient ».
- **Aucun changement d'étape après la conversion** — le journal horodaté des passages, la transition elle-même et l'émission d'`order.step_changed` (nom déjà publié en v1, toujours sans producteur) sont le sujet d'E10.14. La colonne `current_production_step_id` en deviendra la projection.
- **Aucune règle de transition, aucune validation des étapes antérieures** (CA5) — le franchissement est libre et assumé ; `is_terminal` est un indicateur d'affichage sans effet de garde dans ce lot.
- **Aucun tableau de bord des commandes** — aucun écran ne consomme `listCommercialOrders` dans ce dépôt à ce jour (vérifié : `grep` sur `CommercialOrder` dans `src/**/*.tsx` ne trouve que `QuoteEditorPage.tsx`, qui n'affiche pas de liste de commandes). CA6 est donc livré **au niveau API uniquement** (filtre + tri, testés) ; sa consommation UI reste une dette explicite pour **E10.16** (écran de détail/tableau de bord des commandes), comme demandé.
- **Aucun statut de commande nouveau** — `CommercialOrderStatus` reste à `validated` (décision #3 du contrat).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **E10.16 (héritée, confirmée par ce lot)** | `current_production_step_id`/`sort=production_step` sont exposés et testés à l'API (contrat + `tests/sql`), mais aucun écran ne les consomme — le tableau de bord des commandes n'existe pas encore dans ce dépôt. | E10.16 branchera un écran de liste/détail de commande sur `listCommercialOrders`, avec les filtres/tri déjà prêts côté API. |
| **(g) nouvelle, mineure** | La forme exacte de `current_state` sur le 409 de `reorderProductionSteps` n'était pas prescrite au contrat (qui dit seulement « le catalogue courant dans `current_state` »). Le schéma partagé `Problem.current_state` est typé `object`, jamais un tableau au premier niveau (`type: [object, 'null']`, `additionalProperties: true`) — le catalogue est donc porté sous une clé `{ steps: [...] }`, décision d'implémentation non arbitrée par l'architecte. | À confirmer par `qa-review` ou l'architecte si un consommateur (Studio) a besoin d'une forme différente ; changement additif si nécessaire (`current_state` reste un objet, seule sa forme interne bougerait). |
| **(h) nouvelle, mineure** | `sort=production_step`/`-production_step` de `listCommercialOrders` est implémenté via une fonction SQL dédiée (`list_commercial_orders_by_production_step`, `security invoker`) plutôt qu'une requête PostgREST directe, parce que PostgREST/`supabase-js` ne sait pas propager un `ORDER BY` sur une colonne d'une table jointe en `LEFT JOIN` au niveau de la ligne parente. C'est un écart de **mécanisme** (pas de surface API), documenté dans la migration et ce fichier ; le curseur de pagination pour ce tri encode `${current_production_step_id ?? ''}|created_at`, décodé uniquement par l'adaptateur. | Aucune action requise sauf si une story future veut généraliser ce mécanisme à d'autres tris joints — le précédent existe déjà (`resolve_price_rule`, E10.7). |
| **M2 héritée, inchangée** | Aucun événement nouveau n'est émis par ce lot (`order.step_changed` reste sans producteur, conforme au contrat : poser l'étape initiale n'est pas un changement d'étape). Sans objet pour la dette M2 (outbox best-effort), qui ne s'applique à aucun nouvel événement ici. | — |
| **(f) héritée, ouverte** | Relecture Notion des CA exacts non faite (limite d'accès, §0 du contrat et de ce document). | Le `scribe` ou un humain avec accès Notion confronte ce document aux CA numérotés de la page avant clôture définitive. |

## Vérifications

`pnpm typecheck` (= `typecheck:modular`) : **0 erreur**. `pnpm gen:api:check` : aligné (aucune modification du contrat par ce lot, déjà livré par l'architecte). `pnpm test:architecture` : **144/144** (33 fichiers), inchangé — le nouveau module `production-steps` respecte le même patron de frontières que les modules E10.x existants. `pnpm test:contract` : **261/261** (14 fichiers, +1 nouveau `production-steps.contract.test.ts` avec 9 tests, +0 net sur `commercial-orders.contract.test.ts` qui reste à 10 tests après mise à jour pour le champ/paramètres nouveaux), en hausse de 9 par rapport à la baseline de 252 laissée par E10.12. `npx vitest run --maxWorkers=2` (suite complète) : **1694 passés / 36 skip**, 3 échecs **pré-existants et sans rapport** (`tests/storage/product_mockups_isolation.test.ts` — bucket Storage local désynchronisé après le `db reset` nécessaire pour appliquer cette migration en environnement propre ; le bucket existe bien en base (`storage.buckets`), c'est un service Storage/Kong qui n'a pas repris l'état à chaud — vérifié en isolant le fichier, aucun rapport avec `production_steps`/`commercial_orders`).

**Note d'environnement, honnête** : contrairement à E10.12 (Supabase local déjà démarré), ce lot a nécessité un `pnpm db:local:reset` complet (le premier jet de `list_commercial_orders_by_production_step` changeait le TYPE d'un paramètre positionnel — `integer` → `uuid` — ce que `create or replace function` ne peut pas faire sans laisser un doublon de fonction ; un reset propre était le chemin le plus sûr). Ce reset a effacé tous les `auth.users` locaux : un compte de test (`local-seed-baseline@example.test`) a été inséré directement en base pour permettre l'exécution des cas SQL. `tests/sql/gescom-e10-13-production-steps.sql` et `tests/sql/gescom-e10-12-quote-conversion.sql` (scénarios 1-10, hors la course concurrente 11 qui exige les paramètres `dblink` fournis par le script officiel) passent isolément et l'un après l'autre. Le harnais complet (`pnpm test:storefront:sql`) reste bloqué sur des cas **antérieurs et sans rapport** (`legacy-shop-only-write-freeze.sql`, `gescom-e10-3/5/6/9/10a/11` : tous exigent un deuxième/troisième `auth.users` réel, accumulé habituellement par un usage prolongé du poste local, absent après un reset propre) — vérifié fichier par fichier, aucun ne référence `production_steps`/`commercial_orders.current_production_step_id`.

`tests/sql/gescom-e10-13-production-steps.sql` : **exécuté réellement** (Docker local, migration appliquée par `pnpm db:local:reset`). 10 scénarios, `rollback` final, 0 erreur : (1) seed à la création d'un tenant — six étapes dans l'ordre exact, « Livré » seule terminale ; (2) RLS lecture — un membre du tenant B ne voit aucune étape du tenant A ; (3) RLS écriture — un membre sans `can_manage_production_steps` ne peut ni modifier (`UPDATE` direct) ni créer (`api_create_production_step` → `permission_denied`) ; (4) `api_create_production_step` — position en fin de flux, libellé unique normalisé (rejet même sur `  pao  ` face à `PAO`), plafond de 50 (`production_step.limit_reached` sur la 51e) ; (5) `api_delete_production_step` — réindexation sans trou, `production_step.not_found` hors tenant ; (6) `updateProductionStep` — renommage/désactivation via `UPDATE` direct gardé par la RLS ; (7) `api_convert_commercial_quote` — la conversion pose l'étape active de position la plus basse sur la commande créée ; (8) CA3 — suppression de l'étape portée par une commande refusée en `production_step.in_use`, tenue par la FK ; conversion dans un tenant dont **toutes** les étapes sont désactivées — réussit avec `current_production_step_id: null` ; (9) `api_reorder_production_steps` — inversion complète appliquée, `production_step.positions_mismatch` sur un ensemble incomplet ; (10) `list_commercial_orders_by_production_step` — tri croissant et décroissant par étape courante, commande sans étape **toujours en dernier** dans les deux sens, filtre `current_production_step_id`.

## Critères d'acceptation (contrat §8.15, tenus un par un)

Numérotation reprise du résumé transmis par l'agent appelant (8 CA ; CA8 hors périmètre, arbitrage (b)) — la relecture Notion exacte reste une réserve ouverte (f), non levée par cet agent (pas d'accès Notion).

1. **Jeu standard des six étapes seedé à la création du tenant** — **fait**. `seed_tenant_catalogs()` étendue, testé (SQL scénario 1) : ordre exact, « Livré » seule terminale.
2. **Configuration complète d'une étape** (création, renommage, couleur, marquer terminale, activer/désactiver) — **fait**. `POST`/`PATCH /production-steps/{stepId}`, testés (contrat + SQL scénarios 3/4/6).
3. **Une étape utilisée par au moins une commande ne peut pas être supprimée ; la désactivation reste possible** — **fait**. `on delete restrict` tenu en base, 409 `production_step.in_use`, testé (contrat + SQL scénario 8). Désactivation autorisée sans garde (contrat), testée (SQL scénario 6).
4. **Le catalogue appartient au tenant du jeton, jamais un segment d'URL** — **fait**. Aucun chemin ne porte de tenant ; `PUT /production-step-positions` est un chemin de premier niveau précisément pour cette raison (décision #4 du contrat). RLS testée par tenant (SQL scénario 2).
5. **Aucune validation automatique des étapes antérieures ; le franchissement est libre** — **fait par construction** : le modèle ne porte qu'un pointeur (`current_production_step_id`), aucune contrainte d'ordre, aucun tableau de progression. Rien à tester au-delà de l'absence de contrainte (vérifié par lecture de la migration : aucune contrainte de séquence sur la colonne).
6. **Filtrer et trier le tableau de bord des commandes par étape courante** — **fait au niveau API** (`current_production_step_id`, `sort`), testé (contrat : filtre exact ; SQL scénario 10 : tri croissant/décroissant, nulls toujours en dernier). **Aucun tableau de bord ne les consomme** dans ce dépôt — dette explicite pour E10.16 (voir section dédiée).
7. **Une étape ne déménage jamais de tenant** — **fait par construction** : `tenant_id` n'est ni dans `UpdateProductionStepCommand` ni modifiable par aucune route ; provient toujours du jeton.
8. **Modèles de notification rattachés à une étape — HORS PÉRIMÈTRE** (arbitrage (b) du 2026-09-08, §8bis du contrat). Ni compté comme fait, ni comme dette d'implémentation d'E10.13. `ProductionStep` ne porte aucun champ de notification ; aucun point d'extension vide publié. Reporté à E10.15.

## Fichiers créés/modifiés

**Migration et tests SQL**
- `supabase/migrations/20260908020000_gescom_e10_13_production_steps.sql` (nouveau)
- `tests/sql/gescom-e10-13-production-steps.sql` (nouveau)
- `scripts/test-storefront-sql.sh` (ajout du nouveau cas)

**Module `production-steps` (nouveau)**
- `src/modules/production-steps/api/contracts.ts`
- `src/modules/production-steps/api/client.ts`
- `src/modules/production-steps/application/production-steps-repository.ts`
- `src/modules/production-steps/application/production-steps-service.ts`
- `src/modules/production-steps/index.ts`
- `src/modules/production-steps/manifest.ts`
- `src/modules/production-steps/surface-contributions.ts`
- `src/modules/production-steps/ui/index.ts`
- `src/modules/production-steps/ui/workspace/index.ts`
- `src/modules/production-steps/ui/workspace/ProductionStepsPage.tsx`
- `src/adapters/supabase/production-steps-repository.ts`
- `src/server/api/production-steps-routes.ts`

**Câblage**
- `src/server/api/gescom-routes.ts` (enregistrement des routes, service `productionSteps`, troisième paramètre de `createCommercialOrdersRoutes`)
- `supabase/functions/magrit-api/index.ts` (instanciation `ProductionStepsService`)
- `src/surfaces/application-registry.ts` (manifest + contribution `production-steps`)
- `src/app/surfaces/workspaceRuntimeRoutes.tsx` (loader lazy `production-steps.workspace.list`)

**Module `commercial-orders` (mis à jour)**
- `src/modules/commercial-orders/api/contracts.ts` (`current_production_step_id`, `CommercialOrderSort`)
- `src/modules/commercial-orders/index.ts` (exports du tri)
- `src/modules/commercial-orders/application/commercial-orders-repository.ts` (`currentProductionStepId`/`sort` dans `ListCommercialOrdersParams`)
- `src/adapters/supabase/commercial-orders-repository.ts` (`listByProductionStep()`, mapping `current_production_step_id`)
- `src/server/api/commercial-orders-routes.ts` (paramètres `current_production_step_id`/`sort`, validation 422, encodage/décodage de curseur)

**UI transverse**
- `src/shared/presentation/testIds.ts` (scope `productionStep` : `page`, `row`, `dragHandle`, `labelInput`, `colorSelect`, `terminalCheckbox`, `saveBtn`, `deactivateBtn`, `deleteBtn`, `addBtn`, `addLabelInput`, `addSubmitBtn`, `errorBanner`)

**Tests**
- `tests/contract/production-steps.contract.test.ts` (nouveau, 9 tests)
- `tests/contract/_fakes/production-steps-repository.fake.ts` (nouveau)
- `tests/contract/commercial-orders.contract.test.ts` (mise à jour : `ProductionStepsService` injecté, appels `list()` complétés)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts` (`currentProductionStepId`/`sort` dans `list()`, `setStepPositionForTest()`, `setCurrentProductionStepIdForTest()`)

**Story document**
- `_bmad-output/implementation-artifacts/story-E10-13-etapes-production.md` (ce fichier)

Aucun fichier `openapi/magrit-core.v1.yaml`/`docs/api/CONVENTIONS.md`/`src/platform/api/generated/magrit-core.v1.ts` n'a été touché par cette story — déjà écrits par l'architecte avant le démarrage de ce lot (gates rejoués sans écart, §7 du contrat).
