---
id: E10.18a
epic: E10 — Gestion commerciale
status: ready-for-qa-review
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.0, E10.12, E10.13]
blocks: [E10.18b, E10.18c, E10.18d, E10.18e]
---
# E10.18a — Export XLSX/CSV des commandes : « la période, à la grille d'abord »

Premier des six lots d'E10.18 (export comptable des commandes). Cadrage déjà
écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.24, point 8 pour le
découpage, point 5 règle 7 pour le fuseau, point 9 pour l'état des réserves)
— ce lot l'implémente à la lettre : bornes `created_from`/`created_to` sur
`GET /commercial-orders` (`listCommercialOrders`), constante unique de fuseau
de référence, et le filtre correspondant sur une grille des commandes.

`openapi/magrit-core.v1.yaml` et `docs/api/CONVENTIONS.md` **non modifiés
par cet agent** — le contrat était déjà écrit avant que ce lot ne commence
(les deux paramètres `created_from`/`created_to` sur `listCommercialOrders`
existent déjà dans le YAML). Vérifié par `pnpm gen:api:check` (aligné avant
et après ce lot) et par `git status` (aucun fichier sous `openapi/` ni
`docs/api/` dans le diff de ce lot).

## Écart trouvé au démarrage, et comment il a été traité

Le mandat demandait « le filtre correspondant sur l'écran de la grille des
commandes ». Vérification faite avant de coder : **aucune grille de
commandes de gestion commerciale n'existe dans le dépôt.** `src/modules/
commercial-orders/surface-contributions.ts` le disait explicitement depuis
E10.16 (« aucune grille de commandes dans ce lot, reserve (f) »), et la seule
grille de « Commandes » déjà montée (`src/modules/orders/ui/workspace/
OrdersPage.tsx`, `DashboardOrders`) porte les commandes **boutique**
(`tenant_orders`/`shop_orders` via `/api/v1/orders`), un domaine sans rapport
avec `commercial_orders` (même frontière que celle déjà posée côté API,
vérifiée §8.17 §0).

Deux options : construire un tableau de bord complet (hors périmètre d'un
lot étroit, et une décision produit — colonnes, tri, actions — qui
n'appartient pas à ce lot), ou une grille **minimale** qui porte
exactement le filtre de ce lot et rien de plus, sur le patron déjà établi
par `DashboardQuotes` (`commercial-quotes/ui/workspace/QuotesPage.tsx`) :
liste paginée par curseur, colonnes minimales, lien vers la fiche déjà
livrée (E10.16). **Choix retenu : la seconde** — elle donne au filtre une
valeur observable (« la grille sait montrer les commandes de septembre »,
qui est explicitement l'objectif de ce lot) sans anticiper une décision de
tableau de bord. **Accessible par URL directe uniquement, aucune entrée de
navigation** (même prudence qu'E10.16) : le module `orders` porte déjà une
entrée de sidebar « Commandes » pour les commandes boutique — nommer/
distinguer les deux dans la sidebar est une décision produit (IA du menu)
qui n'appartient pas à ce lot, signalée au scribe ci-dessous.

## Ce qui est livré

### 1. Constante unique de fuseau — `src/kernel/clock/timezone.ts`

`PRODUCT_REFERENCE_TIME_ZONE = 'Europe/Paris'`, **première occurrence d'un
fuseau non-UTC de tout le dépôt** (vérifié par `grep` sur `src/`,
`supabase/`, `docs/` avant d'écrire ce fichier — zéro occurrence). Deux
fonctions pures, testées : `startOfDayInReferenceTimeZone(dateOnly)` et
`endOfDayInReferenceTimeZone(dateOnly)`, qui convertissent une date civile
`YYYY-MM-DD` en instant UTC exact (premier/dernier instant de la journée
dans le fuseau de référence), par la même technique que les bibliothèques de
fuseaux usuelles (`Intl.DateTimeFormat` pour déduire le décalage réel à cet
instant — été/hiver — puis reconstruction en UTC), **sans dépendance
nouvelle**. Domicile choisi : à côté de `Clock`/`fixedClock` (notion de
temps pure, sans dépendance à Supabase). Exportée depuis `src/kernel/
clock/index.ts` et `src/kernel/index.ts`.

**Bug trouvé et corrigé en cours de route** : la première version calculait
le décalage horaire sur l'instant candidat **avec** ses millisecondes
(`23:59:59.999`), et `Intl.DateTimeFormat` ne restituant aucune fraction de
seconde, cela introduisait jusqu'à 999 ms d'erreur sur le décalage
lui-même — `endOfDayInReferenceTimeZone('2026-08-31')` rendait
`22:00:00.998Z` au lieu de `21:59:59.999Z`. Trouvé par le test dédié
(pas par relecture). Corrigé en calculant le décalage sur l'instant
**arrondi à la seconde**, puis en l'appliquant à l'instant complet
(millisecondes comprises) — le décalage d'`Europe/Paris` ne change jamais à
l'intérieur d'une même seconde.

**Tests** (`tests/kernel/timezone.test.ts`, **7 cas** à la remise initiale —
corrigé ici : le rapport annonçait à tort « 8 cas », **13 cas** après le
correctif qa-review round 1 ci-dessous, voir §« qa-review round 1 »)
: l'exemple exact du contrat (1er septembre 00h00 à Paris = 31 août 22h00
UTC, été CEST) ; le bord haut de journée (31 août 23:59:59.999 à Paris =
21:59:59.999 UTC) ; **les deux bords d'un mois** avec l'instant
`2026-08-31T22:30:00Z` (exemple du contrat) et son symétrique
`2026-09-30T22:30:00Z` ; le cas hiver (CET +01:00, pour prouver que le
calcul n'est pas figé sur l'été) ; le rejet d'une date mal formée.

### 2. Service + adaptateur — bornes ajoutées à `listCommercialOrders`

`src/modules/commercial-orders/application/commercial-orders-repository.ts` :
`ListCommercialOrdersParams` gagne `createdAtFrom: string | null` /
`createdAtTo: string | null` — **déjà résolus en instants UTC par la
route**, ni le service ni l'adaptateur ne connaissent le fuseau.

`src/adapters/supabase/commercial-orders-repository.ts` : le chemin de tri
par défaut (`-created_at`/`created_at`) ajoute `.gte()`/`.lte()` sur la
requête PostgREST directe, sans migration. Le chemin `sort=production_step`
(E10.13, `list_commercial_orders_by_production_step`) transmet les deux
bornes à la fonction SQL (voir migration ci-dessous).

**Pourquoi la fonction SQL d'E10.13 est touchée alors que le mandat ne le
demandait pas explicitement** : le contrat ne rend pas les deux filtres
mutuellement exclusifs — un atelier doit pouvoir demander « les commandes de
septembre, triées par étape de production ». Ignorer silencieusement
`created_from`/`created_to` dès qu'on trie par étape aurait été exactement
le genre de défaut qu'un test isolé ne révèle jamais (il faut penser à
combiner les deux pour le voir), et un filtre de période ignoré à la
clôture est précisément ce que ce lot existe pour empêcher (§8.24 point 2).
Traité comme une extension d'« adaptateur », pas comme un nouveau lot.

### 3. Migration SQL additive — `20260912000300_gescom_e10_18a_order_period_filter.sql`

`public.list_commercial_orders_by_production_step` gagne deux paramètres
**optionnels**, en fin de liste (`p_created_from timestamptz default null`,
`p_created_to timestamptz default null`) : `drop function` (signature à 11
arguments) **puis** `create function` (13 arguments) — jamais `create or
replace`, qui aurait créé une seconde fonction surchargée au lieu de
remplacer la première (PostgreSQL exige une signature strictement
identique pour un remplacement). `revoke`/`grant`/`comment on function`
refaits. Additive et rétrocompatible : un appel `supabase-js` existant
(nommé, jamais positionnel) qui omet les deux clés continue de tout lire.

**Appliquée avec succès** sur Supabase local (`pnpm db:local:push`, Docker
disponible dans cet environnement).

**3 scénarios prouvés par l'exécution réelle**
(`tests/sql/gescom-e10-18a-order-period-filter.sql`, nouveau, ajouté à
`scripts/test-storefront-sql.sh`) : (1) rétrocompatibilité — appel à 11
arguments (signature E10.13), comportement inchangé, aucun filtre de
période appliqué ; (2) bornes **inclusives aux deux bords d'un mois**, même
exemple que le contrat (commande à `2026-08-31T22:30:00Z` : entre dans
septembre, sort d'août) et son symétrique (`2026-09-30T22:30:00Z` : sort de
septembre, entre dans octobre) ; (3) étanchéité inter-tenant inchangée par
l'ajout des deux paramètres — un membre du tenant B, même en fournissant
explicitement le `p_tenant_id` du tenant A et une période qui couvre tout,
ne voit aucune commande (RLS `commercial_orders_select`, `security
invoker`).

Les fichiers SQL existants qui touchent `commercial_orders`/cette fonction
ont été rejoués **après** cette migration pour prouver l'absence de
régression : `gescom-e10-12-quote-conversion.sql`, `gescom-e10-13-
production-steps.sql` (dont le scénario 10, qui exerce directement la
fonction modifiée), `gescom-e10-14-order-step-changes.sql`, `gescom-e10-16-
order-contact-and-delivery.sql` — tous verts.

### 4. Route — validation et conversion de fuseau

`src/server/api/commercial-orders-routes.ts`, `parseCreatedAtRange()` :

- Format `created_from`/`created_to` invalide → **400** `api.validation_failed`
  (même parti que les autres paramètres de requête de cette opération :
  `customer_id`, `quote_id`, `current_production_step_id`).
- `created_from` postérieure à `created_to` → **422** `api.validation_failed`
  (exactement le code et le statut écrits au contrat — « jamais une page
  vide qui laisserait croire à une absence de commandes »).
- Sinon, conversion en instants UTC via `startOfDayInReferenceTimeZone`/
  `endOfDayInReferenceTimeZone`, transmis au service. Bornes absentes des
  deux côtés → comportement inchangé (aucun appelant existant affecté).

### 5. Client API du module

`src/modules/commercial-orders/api/client.ts` : `ListCommercialOrdersQuery`
gagne `createdFrom?: string` / `createdTo?: string` (`YYYY-MM-DD`), mappés
sur `created_from`/`created_to`. Le client ne convertit rien : la
conversion de fuseau reste **exclusivement serveur**.

### 6. La grille — `OrdersListPage.tsx` (`DashboardCommercialOrders`)

`src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx`, périmètre
volontairement étroit (voir « Écart trouvé au démarrage » ci-dessus) :
liste paginée par curseur (patron `DashboardQuotes`), colonnes N°/Client/
Créée le (affichée dans le fuseau de référence, jamais celui du
navigateur — `orders-list.helpers.ts`)/Total TTC, deux `<input type="date">`
(`Du`/`Au`) qui reconstruisent la requête à chaque changement. **Aucun
contrôle métier côté navigateur** : le filtre n'est qu'une mise en forme de
requête (`buildPeriodQuery`), la validation du format, l'ordre des bornes
et la conversion de fuseau sont faits par le serveur ; une réponse 400/422
est affichée telle quelle (bandeau d'erreur), jamais devinée côté client.

Enregistrée : `manifest.ts` (feature `commercial-orders.workspace-list`),
`surface-contributions.ts` (route `commercial-orders.workspace.list`, path
`commercial-orders`, **sans navigation**), `workspaceRuntimeRoutes.tsx`
(chargement différé). `OrderDetailPage.tsx` : commentaire de tête mis à jour
(il affirmait à tort qu'aucune grille n'existerait jamais).

`data-testid` déclarés dans `src/shared/presentation/testIds.ts`, sous
`TEST_IDS.commercialOrder` (namespace déjà existant, étendu) : `listPage`
(`order-list-page`), `listRow` (`order-list-row`, porte `data-order-id`),
`listCreatedFromInput`/`listCreatedToInput`, `listErrorBanner`,
`listLoadMoreBtn`. Aucun cas de test Notion publié à la remise de ce lot
(grille nouvelle) — à faire confirmer par le scribe dès que le cahier
existera.

### 7. Helpers purs de la grille

`src/modules/commercial-orders/ui/workspace/orders-list.helpers.ts` :
`formatOrderCreatedAt` (formatage dans le fuseau de référence, aucun calcul
métier) et `buildPeriodQuery` (construction des clés de requête à partir des
deux champs — une chaîne vide devient une clé absente, jamais une chaîne
vide envoyée au serveur). Testés isolément (`tests/modules/commercial-
orders/orders-list.helpers.test.ts`, 6 cas).

## Tests exécutés

- `pnpm gen:api:check` : **aligné**, aucune dérive. Confirme qu'aucun
  fichier `openapi/`/`docs/api/CONVENTIONS.md` n'a été touché par cet agent.
- `pnpm typecheck` (`typecheck:modular`) : **0 erreur**.
- `pnpm test:architecture` : **146/146** (34 fichiers), inchangé — la
  nouvelle page vit sous `ui/`, jamais sous `app/components` (baseline MUX
  non affectée).
- `pnpm test:contract` : **414/414** (22 fichiers) — **+2** par rapport à
  l'état avant ce lot (412, cf. cadrage), les deux nouveaux cas de
  `commercial-orders.contract.test.ts` (voir ci-dessous).
  `tests/contract/commercial-orders.contract.test.ts` : 2 cas neufs —
  (a) bornes inclusives aux deux bords d'un mois, **combiné avec
  `sort=production_step`** pour prouver que le filtre s'applique aussi sur
  ce chemin, et vérification qu'une période absente ne change le
  comportement d'aucun appelant existant ; (b) 400 sur date mal formée
  (les deux paramètres), 422 `api.validation_failed` avec
  `errors[0].field = 'created_from'` sur bornes inversées, 200 sur bornes
  égales (un seul jour, jamais un 422).
- `npx vitest run tests/kernel tests/modules/commercial-orders` :
  **38/38** (6 fichiers) — `tests/kernel/timezone.test.ts` (7 cas, nouveau),
  `tests/kernel/kernel.test.ts` (inchangé), `tests/modules/commercial-
  orders/orders-list.helpers.test.ts` (6 cas, nouveau), plus les 3 fichiers
  de tests déjà existants du module (inchangés).
- `pnpm test:storefront:sql` (Docker disponible dans cet environnement,
  container `supabase_db_magritoff-v5` déjà démarré, migration appliquée
  par `pnpm db:local:push`) :
  - `tests/sql/gescom-e10-18a-order-period-filter.sql` (nouveau) : **3/3
    scénarios OK** (rétrocompatibilité, bornes aux deux bords d'un mois,
    étanchéité inter-tenant).
  - `tests/sql/gescom-e10-12-quote-conversion.sql`, `gescom-e10-13-
    production-steps.sql`, `gescom-e10-14-order-step-changes.sql`,
    `gescom-e10-16-order-contact-and-delivery.sql` (existants, **rejoués
    après** cette migration) : tous verts, aucune régression sur
    `commercial_orders`/la fonction modifiée.
  - La suite **complète** (`./scripts/test-storefront-sql.sh`) échoue
    **avant** d'atteindre le fichier de ce lot (dernier de la liste) : un
    fichier **sans rapport**, `tests/sql/legacy-shop-only-write-freeze.sql`
    (dernier touché par un commit de 2026, `f3bb094e`, catalogue de rôles),
    échoue sur `tenant_members_role_admin_check` en tentant d'insérer le
    rôle `'owner'` — dette pré-existante, aucune mention de
    `commercial_orders`/`production_step`/`period`, aucun des fichiers
    fautifs n'a été modifié par ce lot. Contournée en exécutant chaque
    fichier concerné **individuellement** contre le conteneur (résultats
    ci-dessus), ce qui est la preuve pertinente pour ce lot — même
    situation déjà rencontrée et documentée par E10.15d-2 (D4 de son
    rapport, fichier différent mais même nature de dette).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **D1 — nouvelle, écran GARDÉ par arbitrage Arnaud (2026-09-12, qa-review E10.18a round 1), colonnes/pagination/présentation PROVISOIRES** | Arnaud a tranché : `OrdersListPage.tsx` (« Commandes atelier ») est **gardée**, sans entrée de menu. Trois points sont explicitement **provisoires, arbitrés par défaut par l'agent et non par Arnaud** : (1) le **jeu de colonnes** — N°/Client/Créée le/Total TTC, **sans statut ni étape de production** ; (2) la **taille de page** — `PAGE_SIZE = 50` figé en dur dans `OrdersListPage.tsx`, jamais exposé ni configurable ; (3) la **présentation générale** de l'écran (mise en page, absence de tri/filtre autre que la période). Les trois seront **rouverts avec Arnaud en E10.18e**. L'**absence d'entrée de navigation** reste, elle aussi, **délibérée jusque-là** : le module `orders` porte déjà une entrée de sidebar « Commandes » pour les commandes boutique (domaine sans rapport), et choisir comment nommer/distinguer les deux dans la sidebar est une décision produit qui n'appartient pas à ce lot étroit — d'où le renommage du titre en « Commandes atelier » (évite la collision de libellé dès qu'une entrée de navigation sera posée, sans trancher l'IA du menu elle-même). | Colonnes, pagination et présentation : à rouvrir AVEC Arnaud en E10.18e (ne pas les considérer comme un arbitrage produit acquis). Entrée de navigation : à trancher par une story dédiée (E10.18e pose déjà implicitement « le bouton sur la grille », donc une grille découvrable) ou par un arbitrage produit direct. |
| **D2 — nouvelle, mineure** | La suite complète `pnpm test:storefront:sql` échoue avant d'atteindre le fichier de ce lot, à cause d'un défaut sans rapport (`legacy-shop-only-write-freeze.sql`, `tenant_members_role_admin_check`) déjà de nature identique à D4 du rapport E10.15d-2 (fichier différent). | Hors périmètre de ce lot ; à signaler séparément — deux occurrences maintenant observées suggèrent une dette de suite de tests plus large que ce que chaque lot individuel devrait absorber. |
| **D3 — héritée, non aggravée** | La grille minimale ne montre ni le statut, ni l'étape de production, ni un tri configurable par l'écran (seul le tri par défaut `-created_at` est exercé) — un tableau de bord complet reste à construire. | Hors périmètre explicite de ce lot (voir « Écart trouvé au démarrage ») ; à cadrer par une story dédiée si le besoin dépasse la seule vérification du filtre de période. |
| **D4 — nouvelle (qa-review round 1, M5)** | Le chemin de tri PAR DÉFAUT de `listCommercialOrders` (`-created_at`/`created_at`) applique `.gte()`/`.lte()` directement dans `src/adapters/supabase/commercial-orders-repository.ts:67-68` (PostgREST direct, sans fonction SQL). Ce chemin n'est exercé QUE par le fake en mémoire du test de contrat — **jamais par du SQL réel contre Postgres réel**. Seul le chemin `sort=production_step` (`list_commercial_orders_by_production_step`) est prouvé par `tests/sql/gescom-e10-18a-order-period-filter.sql`. Le rapport initial de ce lot affirmait à tort une preuve SQL réelle pour « les bornes aux deux bords d'un mois » sans cette réserve. | Ajouter un scénario SQL dédié qui exerce le SELECT PostgREST par défaut (ou, plus simplement, un test d'intégration qui frappe réellement PostgREST local plutôt que le fake) avant de considérer le chemin par défaut aussi couvert que le chemin `production_step`. |
| **D5 — dupliquée depuis une dette existante (qa-review round 1, M3)** | `OrdersListPage.tsx:64-88` résout un client par commande via `GET /customers/{id}` en série de requêtes individuelles (N+1) : jusqu'à 50 appels au chargement initial, 100 après un « Charger plus » (`PAGE_SIZE = 50`). C'est le patron déjà présent dans `QuotesPage.tsx:79` (`commercial-quotes`) — une dette **existante**, mais **dupliquée** ici plutôt que corrigée à la source. | Endpoint de résolution de clients par lot (`GET /customers?ids=...` ou équivalent) à spécifier avec l'architecte, puis appliqué aux DEUX écrans (`QuotesPage.tsx` et `OrdersListPage.tsx`) en une seule story — ne pas corriger un seul des deux points d'appel séparément. |

## Critères d'acceptation (mandat de ce lot, tenus un par un)

1. **`created_from`/`created_to` ajoutés à `listCommercialOrders` — service,
   adaptateur, route, test de contrat** — **fait**. Bornes inclusives des
   deux côtés, résolution de fuseau exclusivement serveur, 400 sur forme
   invalide (`YYYY-MM-DD` mal formé), **422** `api.validation_failed` sur
   bornes inversées **et sur un jour inexistant du calendrier**
   (`2026-06-31`, corrigé en qa-review round 1, B1 — voir section dédiée).
2. **Filtre correspondant sur l'écran de la grille des commandes** —
   **fait**, avec l'écart documenté ci-dessus (aucune grille n'existait ;
   une grille minimale a été construite pour porter ce filtre et rien de
   plus, accessible par URL directe, sans entrée de navigation).
3. **Fuseau de référence introduit comme constante unique** — **fait**.
   `PRODUCT_REFERENCE_TIME_ZONE` (`src/kernel/clock/timezone.ts`), première
   occurrence d'un fuseau non-UTC du dépôt (vérifié par `grep` avant
   d'écrire), importée par la route (conversion) et par la grille
   (affichage) — jamais recopiée.
4. **Les bornes aux deux bords d'un mois sont testées, pas un mois
   calendaire naïf** — **fait**, à trois niveaux, **précision apportée en
   qa-review round 1 (M5, affirmation initialement trop large)** : unitaire
   (kernel, les deux chemins de tri confondus, la fonction ne connaît pas le
   tri) ; contrat (endpoint HTTP réel, `sort` par défaut **et** `sort=
   production_step`, contre le fake en mémoire) ; SQL réel contre Postgres
   réel **uniquement pour le chemin `sort=production_step`**
   (`list_commercial_orders_by_production_step`, seul chemin qui exigeait une
   migration). **Le chemin par défaut (`.gte()/.lte()` de l'adaptateur,
   `src/adapters/supabase/commercial-orders-repository.ts:67-68`) n'est
   exercé QUE par le fake en mémoire du test de contrat — jamais par du SQL
   réel.** Le rapport initial annonçait « SQL, fonction réelle contre
   Postgres réel » sans cette réserve, ce qui était plus large que la preuve
   réellement apportée. Trou tracé en **D4** (dette introduite, non
   corrigée dans ce round — voir tableau des dettes).
5. **Inclusivité des bornes exactement comme écrite au contrat** — **fait**.
   `created_from` premier jour inclus, `created_to` dernier jour inclus
   (journée entière, 23:59:59.999) — jamais une borne haute exclusive.
6. **Aucun fichier, aucun Storage, aucune dépendance nouvelle** — **fait**.
   Aucune ligne ajoutée à `package.json`/`pnpm-lock.yaml` (vérifié par
   `git status`). Aucune table, aucun bucket.
7. **`row.created_at` jamais brut dans un DTO** — **fait**, sans changement
   nécessaire : `toCommercialOrderDto()` utilisait déjà `toIsoTimestamp()`
   avant ce lot ; ce lot n'ajoute aucun nouveau point de sérialisation de
   `created_at` (les bornes de requête sont des paramètres, jamais un champ
   de réponse).
8. **Contrat non touché** — **fait**. `openapi/` et `docs/api/
   CONVENTIONS.md` non modifiés par cet agent (vérifié `git status` +
   `pnpm gen:api:check` avant/après). **Précision round 1** : l'architecte a
   lui-même amendé le contrat en parallèle (description de `created_from`/
   `created_to` de `listCommercialOrders` et de `OrderExportFilters`) pour y
   écrire explicitement la règle du calendrier ; `git status`/`gen:api:check`
   confirment qu'aucun de ces deux fichiers n'a été modifié par CET agent.

## qa-review round 1 — rejeté sur B1, corrigé

Le lot a été **rejeté** en première revue adversariale. Points traités :

- **B1 (BLOQUANT, corrigé)** — `created_from`/`created_to` n'étaient validés
  que par une regex de FORME (`/^\d{4}-\d{2}-\d{2}$/`), jamais de calendrier.
  `Date.UTC()` reportait alors en silence les dates impossibles
  (`2026-06-31` → 1er juillet, `2026-02-31` → 2 mars, `2026-00-10` → année
  précédente, `2026-99-99` → 2034). **Corrigé à la racine** dans
  `civilDateToUtc()` (`src/kernel/clock/timezone.ts`) : contrôle
  aller-retour, les composantes civiles relues depuis l'instant construit
  doivent égaler exactement celles fournies en entrée, sinon `TypeError`.
  Côté route (`src/server/api/commercial-orders-routes.ts`,
  `resolveCalendarBoundOrThrow`), le `TypeError` est capturé et traduit en
  **422** `api.validation_failed` sur le champ fautif — **pas 400** : le
  brief initial demandait 400, mais l'architecte a amendé le contrat en
  cours de correctif (`openapi/magrit-core.v1.yaml` ~ligne 4284 et ~19270)
  pour trancher explicitement 422, même code/statut que la borne inversée.
  Tests ajoutés : 6 cas dans `tests/kernel/timezone.test.ts` (31 juin, 31
  février, 30 février, mois 00, `2026-99-99`, et le cas positif `2028-02-29`
  bissextile réel) + 2 cas dans `tests/contract/commercial-orders.contract.test.ts`
  (`created_to=2026-06-31` et `created_from=2026-02-30`, tous deux 422).
  Correction posée dans `civilDateToUtc()` (source unique) : couvrira sans
  modification supplémentaire le futur `RequestOrderExportCommand.created_from/
  created_to` d'E10.18c.
- **Décision Arnaud sur l'écran (traité)** — `OrdersListPage.tsx` **gardé**,
  titre renommé « Commandes atelier » (`OrdersListPage.tsx`, commentaire de
  tête + `<h1>`) ; `commercialOrdersModuleManifest.name` (`manifest.ts`)
  également renommé « Commandes atelier » — le manifeste, invisible à
  l'écran, aurait sinon divergé du titre affiché et survécu comme source de
  vérité périmée. Dette **D1** réécrite pour nommer explicitement les trois
  arbitrages par défaut de l'agent (colonnes, `PAGE_SIZE`, présentation) à
  rouvrir avec Arnaud en E10.18e, et l'absence de navigation comme délibérée
  jusque-là (voir tableau des dettes).
- **M2 (MOYEN, corrigé)** — `order-detail.helpers.ts` (`formatOrderDate`) et
  `OrderStatusDialog.tsx` (historique horodaté) formataient dans le fuseau
  du NAVIGATEUR, alors que la grille voisine du même module affiche déjà
  dans `Europe/Paris`. Ajouté `timeZone: PRODUCT_REFERENCE_TIME_ZONE` (import
  depuis `src/kernel/clock`/`@/kernel`, jamais une chaîne recopiée) aux deux
  endroits.
- **M4 (MOYEN, corrigé)** — le scénario 3 de
  `tests/sql/gescom-e10-18a-order-period-filter.sql` n'assérait qu'un
  contrôle NÉGATIF (0 ligne pour l'acteur B), ce qui resterait vert même si
  la fonction ne rendait jamais rien sous RLS. Ajouté un scénario **3a**
  (contrôle POSITIF) : sous `set local role authenticated` avec le JWT de
  l'acteur A, ses 3 commandes de test sont bien visibles. Le scénario
  existant devient **3b**. Fichier réexécuté individuellement contre le
  conteneur Docker local (`supabase_db_magritoff-v5`) : 3a et 3b passent
  sans exception, ainsi que les scénarios 1/2 (rejoués) et les fichiers SQL
  voisins (`gescom-e10-12-quote-conversion.sql`,
  `gescom-e10-14-order-step-changes.sql`, rejoués avec les variables
  `dblink_host`/`dblink_password` requises par ces deux fichiers).
- **M3/M5 (tracés, non corrigés dans ce round, comme demandé)** — N+1 de
  résolution des clients (dupliqué depuis `QuotesPage.tsx`) tracé en **D5** ;
  écart entre l'affirmation du rapport (« SQL réel » pour les deux bords de
  mois) et la preuve réellement apportée (le chemin `sort` par défaut n'est
  couvert que par le fake en mémoire) tracé en **D4**, et l'affirmation du
  CA4 corrigée en conséquence.
- **Mineur (corrigé)** — le rapport annonçait « 8 cas » dans
  `tests/kernel/timezone.test.ts` ; il y en avait 7 à la remise initiale,
  corrigé partout dans ce document. Après les 6 cas ajoutés pour B1, le
  fichier en compte désormais 13.

Tests exécutés après correctifs : `pnpm gen:api:check` (aligné),
`pnpm typecheck` (0 erreur), `pnpm test:architecture` (146/146, inchangé),
`pnpm test:contract` (**416/416**, +2 par rapport aux 414 de la remise
initiale), `npx vitest run tests/kernel tests/modules/commercial-orders`
(**44/44**, +6 par rapport aux 38 de la remise initiale),
`tests/sql/gescom-e10-18a-order-period-filter.sql` exécuté individuellement
contre Docker local (3 scénarios dont 3a/3b, tous verts), fichiers SQL
voisins (`gescom-e10-12`, `gescom-e10-13`, `gescom-e10-14`, `gescom-e10-16`)
rejoués sans régression.

## Dérogations R5

Aucune.

## Fichiers créés

- `src/kernel/clock/timezone.ts` (qa-review round 1, B1 : contrôle calendrier aller-retour ajouté dans `civilDateToUtc()`, sur ce même fichier créé par ce lot)
- `supabase/migrations/20260912000300_gescom_e10_18a_order_period_filter.sql`
- `tests/sql/gescom-e10-18a-order-period-filter.sql`
- `tests/kernel/timezone.test.ts`
- `src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx`
- `src/modules/commercial-orders/ui/workspace/orders-list.helpers.ts`
- `tests/modules/commercial-orders/orders-list.helpers.test.ts`

## Fichiers modifiés

- `src/kernel/clock/index.ts`
- `src/kernel/index.ts`
- `src/modules/commercial-orders/application/commercial-orders-repository.ts`
- `src/adapters/supabase/commercial-orders-repository.ts`
- `src/server/api/commercial-orders-routes.ts` (qa-review round 1, B1 : `resolveCalendarBoundOrThrow()`, 422 sur jour inexistant)
- `src/modules/commercial-orders/api/client.ts`
- `src/modules/commercial-orders/manifest.ts` (qa-review round 1 : `name` renommé « Commandes atelier »)
- `src/modules/commercial-orders/surface-contributions.ts`
- `src/modules/commercial-orders/ui/index.ts`
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx` (commentaire de tête, précision seulement)
- `src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx` (qa-review round 1 : titre renommé « Commandes atelier »)
- `src/modules/commercial-orders/ui/workspace/order-detail.helpers.ts` (qa-review round 1, M2 : `timeZone: PRODUCT_REFERENCE_TIME_ZONE` sur `formatOrderDate`)
- `src/modules/commercial-orders/ui/components/OrderStatusDialog.tsx` (qa-review round 1, M2 : `timeZone: PRODUCT_REFERENCE_TIME_ZONE` sur l'historique horodaté)
- `src/app/surfaces/workspaceRuntimeRoutes.tsx`
- `src/shared/presentation/testIds.ts`
- `tests/kernel/timezone.test.ts` (qa-review round 1, B1 : 6 cas calendrier ajoutés)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts`
- `tests/contract/commercial-orders.contract.test.ts` (qa-review round 1, B1 : 2 cas 422 sur jour inexistant)
- `tests/sql/gescom-e10-18a-order-period-filter.sql` (qa-review round 1, M4 : contrôle positif 3a ajouté)
- `scripts/test-storefront-sql.sh` (ajout de la ligne du nouveau fichier SQL)

Aucun fichier `openapi/` ni `docs/api/CONVENTIONS.md` modifié par cet agent.
Aucune dépendance ajoutée à `package.json`/`pnpm-lock.yaml`.
