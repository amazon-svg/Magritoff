---
id: E10.18e-1
epic: E10 — Gestion commerciale
status: done-qa-approved-round-4-recette-ok
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.18a, E10.12, E10.13]
blocks: [E10.18e-2]
---
# E10.18e-1 — Refonte de la grille « Commandes atelier » et entrée de menu

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.18 — Export XLSX et CSV des commandes pour la comptabilité](https://app.notion.com/p/3cad0131973c812e9a64c38bb31b5add) · extrait le 17/09/2026 · page modifiée le 15/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.
> Ce story document est un **lot** de la story Notion **E10.18** : le périmètre ci-dessous est celui de la story entière ; la part propre à ce lot est décrite dans la partie implémentation.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | M | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 21 |

### Description fonctionnelle (Notion)

**En tant que** gestionnaire, **je veux** exporter les commandes et leur détail au format Excel ou CSV, **afin de** transmettre les données à un service comptable qui ne se connecte pas par API.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : le format Excel (XLSX) est le standard retenu, avec une variante CSV. Constat de Xavier Péchoultres : les services comptables sont fermés aux connexions directes par API et s'appuient sur des fichiers XLSX ou CSV pour éviter la ressaisie. L'export est donc un livrable de première classe, pas un pis-aller.

##### Critères d'acceptation

1. Un bouton « Exporter » est disponible sur la grille des commandes et respecte les filtres actifs.
2. Deux formats sont proposés : XLSX et CSV (séparateur point-virgule, encodage UTF-8 avec BOM).
3. Deux granularités sont proposées : une ligne par commande (entêtes) ou une ligne par ligne de commande (détail).
4. Les colonnes couvrent au minimum : numéro de commande, date, client, SIRET, numéro de TVA, interlocuteur, libellé produit, quantité, prix unitaire HT, montant HT, remise, statut courant, devis d'origine.
5. Les montants sont exportés en numérique typé, pas en texte ; les dates au format ISO.
6. Le fichier XLSX comporte une ligne d'en-tête figée et des largeurs de colonnes lisibles — il est destiné à être ouvert tel quel.
7. Un export de plus de 5 000 lignes est généré en tâche de fond et mis à disposition par lien de téléchargement.
8. L'export respecte le périmètre du tenant et les droits de l'utilisateur.

##### Tâches / Sous-tâches

- [ ] Service `src/services/exports/orders.ts` — construction du jeu de données (CA : 1, 3, 4, 8)
- [ ] Générateur XLSX (CA : 2, 5, 6)
- [ ] Générateur CSV avec BOM et point-virgule (CA : 2)
- [ ] Modale de choix format et granularité (CA : 2, 3)
- [ ] Bascule en génération asynchrone au-delà du seuil (CA : 7)

##### Dev Notes

###### Contraintes techniques

- CSV à destination d'Excel francophone : séparateur `;` et BOM UTF-8, faute de quoi les accents et les colonnes se cassent à l'ouverture — c'est exactement le problème que l'export doit éviter.
- Ne pas formater les montants en chaîne côté serveur : un nombre exporté en texte oblige la comptabilité à reformater, donc à ressaisir.
- La construction du jeu de données passe par une vue SQL dédiée, pas par une agrégation côté client.

###### data-testid

`orders-export-btn`, `orders-export-dialog`, `orders-export-format-radio` (+ `data-format="xlsx"|"csv"`), `orders-export-granularity-radio` (+ `data-granularity="order"|"line"`), `orders-export-submit-btn`, `orders-export-download-link`

###### Dépendances

- Bloquée par : E10.12, E10.16

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0**.

| Méthode | Route | Objet |
|---|---|---|
| POST | `/api/v1/orders/exports` | Demande un export : \`{ format: "xlsx" ⚠️ *cellule arrivée tronquée à l’extraction — lire la page Notion* |
| GET | `/api/v1/orders/exports/{jobId}` | État de la tâche et URL de téléchargement quand elle est prête |

Les filtres acceptés sont **exactement** ceux de `GET /api/v1/orders` : un export doit toujours pouvoir être reproduit à partir d'une vue de la grille. Le jeu de données est construit par une vue SQL dédiée, jamais par une agrégation côté client.

##### Tests

Parcours P13 — export XLSX au détail ligne sur une sélection filtrée, contrôle des colonnes et du typage numérique des montants.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Sonnet (dev-story : E10.18d, E10.18e-2) + Opus (qa-review : rounds multiples)

###### Debug Log References

(aucune fournie par le dev-story)

###### Completion Notes

**Lot E10.18a-b-c-d-e-1** : voir commits antérieurs.

**Lot E10.18e-2** (2026-09-15) — Interface utilisateur d'export (modale format/granularité, panneau de registre, suivi périodique, téléchargement à l'écart du navigateur). qa-review round 3 (2026-09-15) : APPROUVÉ sous réserve recette navigateur. Deux rounds de corrections : (1) doublon métier si fermeture pendant envoi, clé d'idempotence sur formatChanged/granularityChanged hors échec, modale générique, téléchargement par ancre détachée ; (2) arrêt définitif du suivi sur 401/403/404 et borne 10 min, URL signée avec `{ download: file_name }`. Recette navigateur jouée le 2026-09-15 sur recette-e10 : second passage CONFORME — parité filtres, double-clic = 1 POST, clé renouvelée, suivi 2 s avant terminal, reprise après coupure, `Content-Disposition: attachment`, téléchargement 14 lignes, messages français, registre 50 + mention. magrit-api v38 déployée le 2026-09-15.

**Lot E10.18d** (2026-09-13) — Renderer XLSX + recadrage du plafond. `write-excel-file` 4.1.1 entrée `/node`, `fflate` 0.8.3, tous deux épinglés exactement dans `package.json` et import-map Deno. Format par FAMILLE de cellule : `money` → `0.00`, `rate` → `0.0000` (quatre colonnes sans exception), `integer` → `0`. Dates natives en `Date.UTC` après résolution civile `Europe/Paris`. Cellule nulle → vide, jamais `0`. En-tête figée, largeurs de colonnes par colonne. Nombres natifs sans conversion chaîne côté serveur. **qa-review adversariale en cinq rounds** : (1) test Worker cassé ne simulait rien, cellules nulles non testées, (2) témoin négatif acceptait n'importe quelle erreur, (3-4) correctifs de commentaires et vocabulaire, (5) détection d'import `fflate` via regex restait sensible aux commentaires en bloc. **Passage 3 : recadrage architecte** — CPU tue l'export (pas mémoire) → plafond 50k → 5k lignes, une seule exécution de filet de reprise (migration `20260913010000` : export `running` depuis \>15 min → `failed`), formateur `Intl` mis en cache (1757 ms → 70 ms pour 50k lignes). Tous les critères d'acceptation vérifiés par mutation testing (44 cas nouveaux, 312 cas totaux order-exports). **Migration `20260913010000` appliquée, `magrit-order-export-runner` et `magrit-api` redéployés le 2026-09-13.** Runner reste INERTE (aucun secret Vault, aucun `pg_cron`).

###### File List

**Fichiers créés :**

- `src/modules/order-exports/application/renderers/xlsx-renderer.ts`
- `tests/modules/order-exports/xlsx-renderer.test.ts`
- `tests/modules/order-exports/xlsx-renderer.reference.test.ts`
- `tests/modules/order-exports/xlsx-renderer.volume.test.ts`
- `tests/server/api/order-export-run-composition.test.ts`
- `supabase/migrations/20260913010000_gescom_e10_18d_order_export_recovery_net.sql`
- `tests/sql/gescom-e10-18d-order-export-recovery-net.sql`
- `scripts/bench/order-export/` (archive complet : `harness/`, `Dockerfile.bench`, `c1/`, `README.md`)

**Fichiers modifiés :**

- `package.json`, `pnpm-lock.yaml` (ajout exact `write-excel-file: "4.1.1"`, `fflate: "0.8.3"`)
- `supabase/functions/magrit-order-export-runner/deno.json` (entries import-map)
- `src/modules/order-exports/application/order-export-columns.ts` (correction en-tête rate/Rate)
- `src/modules/order-exports/application/renderers/xlsx-renderer.ts` (format integer, épinglage fflate)
- `src/modules/order-exports/application/order-export-generation-service.ts` (`ORDER_EXPORT_ROW_LIMIT: 50_000 → 5_000`)
- `src/modules/order-exports/application/order-export-run-repository.ts` (`DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit: 5 → 1`)
- `src/kernel/clock/timezone.ts` (formateur DateTimeFormat mis en cache)
- `tests/kernel/timezone.test.ts` (2 nouveaux tests, formateur utilisé une fois)
- `tests/modules/order-exports/xlsx-renderer.reference.test.ts` (29 cas : +5 nouveaux, cellules nulles, colonne par colonne, fuseau forcé)
- `tests/modules/order-exports/xlsx-renderer.volume.test.ts` (réécriture complète round 1 : Worker cassé réellement, témoin négatif obligatoire)
- `tests/modules/order-exports/order-export-generation-service.test.ts` (assertions valeur + message resserrez)
- `tests/architecture/order-export-xlsx-library-boundaries.test.ts` (détection d'import via AST TypeScript, export/import=require)
- `scripts/test-storefront-sql.sh` (ajout nouveau fichier SQL, 50/51 → 51/51)
- `.github/workflows/architecture.yml` (étape bloquante tests/modules/order-exports après test:contract)
- `deno.lock` (2 lignes : `npm:fflate@0.8.3`, `npm:write-excel-file@4.1.1`)
- `_bmad-output/implementation-artifacts/story-E10.18d.md` (ce story document)

**E10.18e-2 (UI et recette), commits 3b6489e2 + 7466bbd6 + 8b23db6a :**

- `src/modules/commercial-orders/ui/components/order-export.helpers.ts` (réducteurs de modale/registre, descripteurs purs, suivi à horloge simulée)
- `src/modules/commercial-orders/ui/components/OrderExportDialog.tsx` (modale format/granularité)
- `src/modules/commercial-orders/ui/components/OrderExportPanel.tsx` (registre, suivi, téléchargement)
- `tests/modules/commercial-orders/order-export.helpers.test.ts` (+26 cas round 1, +4 cas round 2)
- `src/adapters/supabase/order-exports-repository.ts` (URL signée avec `{ download }`)
- `tests/adapters/supabase/order-exports-repository.test.ts` (nouveau, 2 cas MOYEN M2)

##### QA Results

**Accepté** (5 rounds : 2 bloquants + plusieurs mineurs détectés et corrigés, tous trous fermés par mutation testing). Verdict final qa-review round 3 (passage architecte) : vert. Critique : tests qui n'attrapaient rien ont été identifiés (Worker, cellules nulles, versions divergentes) et complètement réécrits. Migration de filet de reprise validée par exécution SQL réelle en 5 scénarios. Aucun faux positif détecté.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-187](https://app.notion.com/3cad0131973c811081d5ec192b193681) | GC — Export XLSX des commandes au détail ligne pour la comptabilité | OK | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.18, E10.16 |
| [TF-238](https://app.notion.com/3dbd0131973c810ca614fc5d54b0df48) | GC — Grille Commandes atelier : colonnes, filtres, tri, Charger plus et menu | OK | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.18, E10.18a, E10.18e-1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Cadrage déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.24,
bandeau quatorzième entrée + point 8 « E10.18e — périmètre arrêté le
2026-09-14 », consigne « E10.18e-1 — grille et menu », points 1 à 10) —
ce lot l'implémente à la lettre. **Aucun changement de contrat requis** :
les trois axes nouveaux (`customer_id`, `current_production_step_id`,
`sort=production_step`/`-production_step`) sont publiés depuis E10.12/
E10.13, et la route (`listCommercialOrders`) les servait déjà avant ce lot
— seul le **client** du module (`CommercialOrdersApiClient.list()`) ne les
transmettait pas encore. Vérifié `git status`/`pnpm gen:api:check` : ni
`openapi/` ni `docs/api/CONVENTIONS.md` touchés par cet agent.

C'est le lot qui lève la condition posée par E10.18a (D1 de son rapport) :
la grille des commandes de gestion commerciale, jusque-là un écran minimal
et provisoire (colonnes/pagination/présentation arbitrées par défaut,
accessible par URL directe uniquement), devient l'écran arrêté par Arnaud
en revue le 2026-09-14, découvrable depuis la sidebar.

## qa-review round 1 (2026-09-14) — REJETÉ (22 mutations sur 38 survivaient), CORRIGÉ

**Principe retenu, opposable à tout ce qui suit** : ce dépôt n'a AUCUN
outil de rendu React, et l'architecte tranche en ce moment s'il faut en
ajouter un. En attendant, et quelle que soit sa décision,
`OrdersListPage.tsx` devient une **COQUILLE** : chaque décision (quelle
requête envoyer, quand l'appliquer, comment réagir à une réponse périmée,
quel texte afficher dans une cellule) vit dans une fonction pure ou un
réducteur, testable sans rendre le composant. Ce que le JSX fait ENCORE
seul (brancher un `onChange` sur un `dispatch`, ouvrir le `Popover` du
sélecteur de client) reste un point NON PROUVÉ, signalé comme tel plus
bas — jamais affirmé comme testé.

### BLOQUANT B1 — course entre requêtes, corrigée par un réducteur à génération

**Le défaut.** `load`/`loadMore` (version round 0) écrivaient `orders`/
`nextCursor` sans vérifier que la réponse correspondait encore aux filtres
courants. Scénario exact de la qa-review : « Charger plus » sous le tri
`-created_at`, puis passage au tri `production_step` avant que la réponse
n'arrive — la page 1 du nouveau tri se pose, puis la réponse tardive de
l'ancien « Charger plus » ajoute sa page et réinstalle son curseur, sous
un tri qui n'est plus celui affiché.

**Corrigé.** `ordersListReducer` (`orders-list.helpers.ts`) : chaque
changement de filtre ou de tri (`filtersChanged`/`customerSelected`/
`customerCleared`) incrémente un compteur `generation` DANS LE MÊME
mouvement qui remet `orders`/`nextCursor` à zéro. `loadOrdersListPage()`
capture cette génération **avant** l'appel réseau ; le réducteur REJETTE
toute réponse (`pageLoaded`/`pageLoadFailed`) dont la génération ne
correspond plus à l'état courant — pour `load` comme pour `loadMore`,
sans distinction.

**Test qui prouve exactement le scénario de la qa-review** (pas seulement
le mécanisme abstrait) : `tests/modules/commercial-orders/orders-list.helpers.test.ts`,
« scénario B1 complet » — un "Charger plus" est laissé EN VOL sous l'ancien
tri, un changement de tri se produit pendant ce temps, la première page du
nouveau tri s'applique, PUIS la réponse périmée de l'ancien "Charger plus"
arrive : la liste et le curseur affichés restent ceux du nouveau tri.
Preuve par mutation : retirer la garde `if (action.generation !==
state.generation) return state;` du cas `pageLoaded` fait tomber CE test
ET le test unitaire dédié (« B1 — un pageLoaded de la génération n-1... »).

### BLOQUANT B2 — la remise à zéro du curseur n'était tenue par aucun test, et la story l'affirmait à tort

**Le défaut, décrit par la qa-review.** `expect(request.pageCursor).toBeUndefined()`
(round 0) ne pouvait pas tomber : le test ne passait jamais de curseur en
entrée à `buildInitialLoadRequest`, donc l'absence de curseur en sortie ne
prouvait rien sur une REMISE à zéro — seulement que la fonction n'en ajoute
pas d'elle-même. Le rapport de round 0 affirmait pourtant, à tort, que
« structurellement, un changement de n'importe quel axe déclenche un
rechargement... qui écrase `orders`/`nextCursor` » sans qu'aucun test ne
tienne cette affirmation au niveau de l'ÉTAT (par opposition à la seule
requête), et sa section « Détail des cas... » décrivait comme mutation du
test B2 l'ajout d'un paramètre `cursor` à `buildInitialLoadRequest` — un
changement qui ne pouvait pas être exercé par CE test précis, puisqu'il
n'appelait jamais la fonction avec un curseur à faire disparaître.

**Corrigé, à deux niveaux.** *(1)* L'état lui-même porte désormais la
propriété : `ordersListReducer`, cas `filtersChanged`/`customerSelected`/
`customerCleared`, tous délèguent à `resetForNewQuery()`, qui pose
`orders: []`/`nextCursor: null` inconditionnellement. *(2)* Le test
« B2 » (`orders-list.helpers.test.ts`) part explicitement d'un état qui
PORTE un curseur et des lignes (`nextCursor: 'cursor-old'`, `orders:
[fixtureOrder()]`), dispatch `filtersChanged`, et vérifie que l'état
résultant a `orders: []`/`nextCursor: null` — ET que la requête tirée de
ce nouvel état ne porte pas de curseur. Preuve par mutation : faire
retourner `orders: state.orders, nextCursor: state.nextCursor` dans
`resetForNewQuery()` fait tomber ce test (et trois autres qui en
dépendent — voir tableau de mutations plus bas).

**Les deux affirmations fausses signalées par la qa-review sont
corrigées** : la section 3 ci-dessous ne dit plus « structurellement » à
propos de l'état — seulement à propos de la SIGNATURE de
`buildInitialLoadRequest` (propriété réellement structurelle, celle-là :
la fonction n'a pas de paramètre curseur). La remise à zéro de l'ÉTAT est
maintenant attribuée explicitement au réducteur, avec le test qui la
tient.

### MOYENS

- **M1 (colonnes)** — `ORDERS_LIST_COLUMNS` ne pilotait que les en-têtes ;
  les cellules étaient écrites à la main dans le JSX (mutations M02/M03/M04
  de la campagne, toutes survivantes). Corrigé : chaque colonne est un
  descripteur `{ header, cell(order, ctx) }` (`orders-list.helpers.ts`),
  parcouru par le JSX à la fois pour les `<th>` et les `<td>` — il n'existe
  plus de liste d'intitulés ni de cellule séparée à faire diverger. Testé
  sur une commande fixture (Net HT ≠ TTC, étape nulle) :
  `columns.map(c => c.cell(...))` rend exactement les six valeurs
  attendues, plus un test dédié qui distingue réellement Net HT de TTC (un
  fixture où les deux montants diffèrent).
- **M2 (catalogue des étapes)** — extrait `loadProductionStepCatalog(api)`
  (`orders-list.helpers.ts`), qui rend `{ byId, ordered }` (ou `{ok:false,
  error}`). Testé avec un faux `{ list }` : `list` est appelée **sans
  argument de statut** (`toHaveBeenCalledWith()`), l'étape désactivée est
  gardée dans `byId`/`ordered`, et `ordered` suit la position.
- **M3 (client.ts)** — nouveau fichier
  `tests/modules/commercial-orders/commercial-orders-api-client.test.ts`,
  patron de `tests/platform/api/fetch-api-client.test.ts` : un `fetch`
  factice capture l'URL réelle, quatre cas vérifient
  `current_production_step_id`/`sort` (présents, absents, tri inverse,
  combinés à période/client/pagination).
- **M4 (`ORDERS_LIST_PAGE_SIZE` et actions du réducteur)** — la taille de
  page est exportée depuis les helpers et testée (`toBe(50)`). Les
  gestionnaires de filtre (tri, `customerSelected`, `customerCleared`)
  sont des actions du réducteur, testées individuellement (voir
  `ordersListReducer` dans le tableau de mutations).
- **M5 (troncature silencieuse du sélecteur de client)** — extrait
  `buildCustomerSearch(api)` (`customer-filter-select.helpers.ts`), qui
  propage `nextCursor` sous forme d'un indicateur `truncated` (jamais tu en
  silence) ; le composant affiche « Plus de 20 résultats, affinez la
  recherche. » quand `truncated` est vrai. Testé avec un faux : `q` est
  transmis tel quel, `pageSize` est celui du sélecteur (20, pas 200), et
  `truncated` reflète `nextCursor !== null`.

### MINEURS

- **m1 (`cancel()`)** — `createDebouncedSearch()` gagne `.cancel()` :
  annule le timer en attente ET invalide la génération d'un appel réseau
  déjà parti (sa réponse, si elle arrive quand même, ne résout jamais).
  `CustomerFilterSelect.tsx` l'appelle dès que le champ redevient vide, et
  au démontage. Deux tests dédiés, dont un avec un appel réseau
  délibérément laissé EN VOL au moment du `cancel()`.
- **m2 (`q` > 200 caractères, erreur avalée en « aucun résultat »)** —
  `maxLength={200}` posé sur `CommandInput` (borne du contrat sur
  `GET /customers?q=`) ; un état d'erreur DISTINCT (`error`, rendu séparé
  de `CommandEmpty`) remplace le `catch(() => setResults([]))` qui
  confondait échec réseau et absence de résultat.
- **m3 (échec du catalogue d'étapes avalé)** — `loadProductionStepCatalog()`
  rend un résultat `{ok:false, error}` plutôt que de laisser l'appelant
  avaler l'exception ; `OrdersListPage.tsx` affiche un bandeau
  (`listStepsLoadErrorBanner`) DISTINCT du tiret `—` d'une commande sans
  étape.
- **m4 (testid non déclaré)** — `${testId}-option` (dérivé, non déclaré)
  remplacé par une prop explicite `optionTestId`, alimentée par
  `TEST_IDS.commercialOrder.listCustomerFilterOption` (`order-list-customer-filter-option`),
  déclarée dans `testIds.ts`.
- **m5 (affirmations fausses de la story)** — corrigées dans la section 3
  ci-dessous et dans ce bloc B2. Le fond du reste du document (sections 1,
  4, 6) n'était pas mis en cause par la qa-review et reste inchangé pour
  les parties non affectées par le réducteur.

### C3 — capacité de la route non gardée par un test

`tests/surfaces/contribution-registry.test.ts` gagne un cas dédié :
`applicationContributionRegistry.forSurface('workspace').routes` contient
la route `commercial-orders.workspace.list` avec `requiredCapabilities:
['commercial-orders.read']`. Avant ce cas, retirer cette garde ne faisait
tomber aucune gate (mutation M29 de la campagne, survivante).

### Ce qui reste NON PROUVÉ par un test, explicitement (CORRIGÉ en round 2 — voir aussi la section dédiée plus bas)

> **Correction round 2 (qa-review, m5) : l'affirmation « Toute la logique
> qui PEUT être extraite sans rendre un composant l'a été » (round 1,
> ci-dessus) était FAUSSE.** La qa-review round 2 a trouvé, à la lecture,
> plusieurs blocs de logique qui pouvaient l'être et ne l'étaient pas :
> chaque filtre avait son propre `onChange` écrit à la main au lieu d'un
> descripteur générique, le catalogue d'étapes vivait hors du réducteur,
> le contexte de cellule et la décision « faut-il tenter Charger plus »
> étaient construits en ligne dans la page, et la machine d'état de la
> recherche client vivait dans le composant plutôt que dans un contrôleur
> pur. Round 2 extrait tout cela (détail : section « qa-review round 2 »
> ci-dessous). Le texte qui suit décrit l'état **après round 2**.

Le câblage React pur de `OrdersListPage.tsx`/`CustomerFilterSelect.tsx`
n'est vérifié que par lecture de code : ce dépôt n'a pas d'outil de rendu
React. Après round 2, ce qui reste dans cette catégorie est réduit à :
la boucle générique de rendu elle-même (est-ce que `ORDERS_LIST_FILTERS`/
`ORDERS_LIST_COLUMNS` sont réellement parcourus par le JSX, et pas
recopiés — mutations R04/R04b de la campagne), et le clic sur une option
du sélecteur de client (`CustomerFilterSelect`, mutations R34/R35 — la
liaison entre un clic et l'appel de `onSelect`/`onClear`). Ces deux
catégories sont *structurellement* hors de portée d'un test qui ne rend
rien : le coordinateur les vérifie par sa propre recette navigateur.
**Tout le reste** (quelle action une valeur de filtre doit produire, quel
contenu une cellule doit afficher, quand tenter un rechargement, comment
la recherche client gère la troncature/l'erreur/l'annulation) est
maintenant porté par des fonctions pures ou le réducteur, et testé — voir
le tableau de mutations round 2.

## qa-review round 2 (2026-09-14) — REJETÉ SUR UN BLOQUANT (condition (b1) non remplie), CORRIGÉ

**Le bloquant.** La condition (b1) de l'architecte (§8.24, bloc E10.18e,
consigne e-1, point 10) exige que la page soit une coquille **GÉNÉRIQUE** :
réducteur, descripteurs de colonnes **ET DE FILTRES** (chaque filtre porte
sa propre action de réducteur), et chargeur d'étapes, purs et testés — le
JSX ne fait que les PARCOURIR. Round 1 tenait cette condition pour les
colonnes et le réducteur des commandes, mais **aucun descripteur de
filtre n'existait** : chaque champ (Du, Au, client, étape, tri) avait son
propre `onChange` écrit à la main dans `OrdersListPage.tsx`, le catalogue
d'étapes vivait dans un `useState` hors du réducteur, et
`CustomerFilterSelect.tsx` portait sa propre machine d'état de recherche.

**Corrigé — condition (b1) tenue.**

1. **`ORDERS_LIST_FILTERS`** (`orders-list.helpers.ts`) : un descripteur
   par filtre de période/étape/tri
   (`{ id, testId, kind, read(state), options?(ctx), toAction(value) }`).
   `handleOrdersListFilterChange(dispatch, filters, filterId, value)` est
   le SEUL point qui traduit "le filtre `filterId` a reçu `value`" en
   `dispatch()`, pour n'importe lequel de ces filtres. La page ne fait plus
   que `ORDERS_LIST_FILTERS.map(...)`, un `<input type="date">` ou un
   `<select>` selon `kind`, chacun appelant
   `handleOrdersListFilterChange(...)`.
2. **Colonne N° — propriété `linkTo`** sur le descripteur
   (`ORDERS_LIST_COLUMNS[0].linkTo`), plus d'index magique `i === 0` dans
   le JSX : une permutation de colonnes ne peut plus déplacer le lien par
   accident (mutation N01).
3. **`buildCellContext(stepsById, customerLabelById)`**, pure : construit
   le contexte de cellule, avec le repli sur `'—'` pour un client encore
   inconnu du cache — avant ce correctif, ce repli (codé en ligne dans la
   page) tombait sur l'identifiant technique du client si la mutation N19
   était appliquée, sans qu'aucun test ne le remarque.
4. **Étapes dans le réducteur** : `OrdersListState` porte désormais
   `stepCatalog`/`stepsLoadError` ; deux actions, `stepsLoaded`/
   `stepsFailed`. `loadOrdersListStepsAction(api)` combine
   `loadProductionStepCatalog()` et le choix de l'action à dispatcher —
   avant ce correctif, ce choix vivait dans la page (mutation N10 :
   avaler un échec en dispatchant quand même un succès vide, indétectable
   sans rendre le composant).
5. **`planLoadMore(state)`** (pure) et **`requestMoreOrders(api, state)`**
   (combine la décision et l'appel réseau, rend `null` sans jamais
   appeler l'API si la tentative n'est pas pertinente) : la page ne porte
   plus aucune garde à elle seule pour éviter une requête "Charger plus"
   gaspillée (mutations N04, N18).
6. **`createCustomerSearchController(search, delayMs, notify)`**
   (`customer-filter-select.helpers.ts`) : toute la machine d'état de la
   recherche client (texte tapé, chargement, résultats, troncature,
   erreur, annulation sur champ vide/démontage) est déplacée ici, pure,
   testée avec des timers factices — `CustomerFilterSelect.tsx` ne fait
   plus que créer le contrôleur, miroiter son état, et transmettre les
   frappes. Ferme, en les rendant réellement testables, les mutations
   R20 (recherche sans debounce), N05 (annulation sur champ vide), N06
   (troncature jamais propagée), N09 (erreur avalée).
7. **`buildCustomerFilterOptions(searchState, hasActiveFilter, customerLabel)`**
   (pure) : construit la liste d'options du menu, « Tous les clients »
   compris (visible seulement si un filtre client est déjà actif).
8. **`customerFilterSelected(customerId, label)`/`customerFilterCleared()`**
   (pures, testées) : SEUL point de construction des actions du filtre
   client — avant ce correctif, l'objet d'action était construit en ligne
   dans la page (mutation N14 : perdre le libellé en le remplaçant par une
   chaîne vide, indétectable sans rendre le composant).

**Ce qui reste explicitement NON prouvé, et pourquoi (R34/R35, comme
demandé par la qa-review — "dis-le")** : le clic sur une option du menu
`CustomerFilterSelect` (sélectionner un client, ou "Tous les clients")
appelle `onSelect`/`onClear` depuis le `onSelect` d'un `CommandItem`
(bibliothèque `cmdk`) — c'est une interaction DOM, il n'y a pas de
fonction pure à appeler à la place de "l'utilisateur clique". Round 2
a rendu testable TOUT ce qui entoure ce clic (quelles options sont
proposées, quel libellé elles portent, dans quel ordre — voir
`buildCustomerFilterOptions`), mais pas le clic lui-même. Même limite,
structurellement, pour la boucle générique de rendu de
`ORDERS_LIST_FILTERS`/`ORDERS_LIST_COLUMNS` (mutations R04/R04b : est-ce
que le JSX lit réellement `col.header`/`filter.read(state)`, ou une copie
figée). Le coordinateur vérifie ces deux catégories par sa recette
navigateur ; **ce lot ne les affirme pas testées**.

### MINEURS round 2

- **V1 (race sur "Charger plus")** : deux réponses `pageLoaded` de mode
  `'more'` identiques (même génération) ajoutaient deux fois la même page,
  et une réponse `'more'` isolée pouvait s'appliquer même quand l'état
  n'attendait aucune réponse de ce type (`status !== 'loading-more'`).
  **Corrigé** : `pageLoaded`/`pageLoadFailed` portent désormais le
  `cursor` RÉELLEMENT utilisé pour la requête (`null` en mode initial) ;
  le réducteur (`isApplicableMoreResponse`) exige, pour une réponse
  `'more'`, `state.status === 'loading-more'` ET
  `action.cursor === state.nextCursor`. Testé : la sonde donnée par la
  qa-review (deux `pageLoaded` identiques) rend désormais `['a', 'b']`,
  pas `['a', 'b', 'b']` (cas « V1 (mineur, round 2) »).
- **D5 aggravée pendant une course** : `loadCustomers(action.items)`
  était appelé même pour une page REJETÉE comme périmée par le réducteur,
  jusqu'à `ORDERS_LIST_PAGE_SIZE` appels `GET /customers/{id}` gaspillés
  pour des lignes jamais affichées. **Corrigé** : la résolution des
  clients part maintenant de `state.orders` (un effet dédié dans la page,
  déclenché par le changement de cette valeur) — `state.orders` ne change
  QUE lorsque le réducteur a réellement accepté une page.
- **R09b/R11c** : ajouté un cas qui vérifie, depuis un état qui porte déjà
  un curseur, qu'une requête en mode `'initial'` ne porte jamais
  `pageCursor` (`loadOrdersListPage`, cas « R09b/R11c »).

### Tableau des mutations rejouées — round 2 (`mutations_r2.log`)

Chaque mutation ci-dessous a été REJOUÉE RÉELLEMENT contre le code
CORRIGÉ (édition du fichier source à l'emplacement adapté à la nouvelle
architecture — les emplacements littéraux du journal de la qa ne
correspondent plus après la refonte round 2 —, exécution de la suite
concernée, restauration vérifiée par comparaison de fichiers).

| Mutation | Description | Résultat contre le code corrigé |
|---|---|---|
| R08b | Filtre étape : `onChange` envoie une valeur vide | **TUÉE** — `toAction` du descripteur `productionStepId` forcé à `''` → échec du cas dédié |
| R32 | Filtre tri : le `<select>` ne dispatch rien | **TUÉE** — `toAction` du descripteur `sort` vidé → échec du cas « dispatch la bonne action... R32 » |
| N16 | Champ "Du" écrit dans `createdTo` | **TUÉE** — `toAction` du descripteur `createdFrom` redirigé vers `createdTo` → échec du cas N16 |
| R14b | Étapes désactivées retirées des options du filtre | **TUÉE** — `options()` du filtre étape filtré sur `is_active` → échec du cas R14b/R15b |
| R15b | Options d'étape tirées de `byId` (non triées) au lieu de `ordered` | **TUÉE** — même cas, `options()` lisant `byId.values()` → ordre différent de l'attendu |
| N15 | Options d'étape sans suffixe "désactivée" | **TUÉE** — `options()` du filtre étape utilisant `step.label` nu → échec du cas N15 |
| N01 | Lien posé sur la colonne Client au lieu de N° | **TUÉE** — `linkTo` déplacé sur la colonne Client → échec du cas « seule la colonne N° porte un lien » |
| N19 | Client inconnu affiche son identifiant au lieu d'un tiret | **TUÉE** — repli de `buildCellContext` changé en `customerId` → échec du cas N19 |
| N14 | Libellé du client choisi perdu (`label: ''`) | **TUÉE** — `customerFilterSelected` vidant `label` → échec du cas N14 |
| R20 | Recherche client sans debounce | **TUÉE** — `createCustomerSearchController` appelant `search` au lieu de `debounced` → échec du cas R20 |
| N05 | `cancel()` non appelé sur champ vide | **TUÉE** — retrait de `debounced.cancel()` dans la branche vide du contrôleur → échec du cas N05 |
| N06 | `truncated` jamais propagé | **TUÉE** — `truncated: false` figé dans la branche de succès du contrôleur → échec du cas N06 |
| N09 | Erreur de recherche avalée | **TUÉE** — `catch` du contrôleur ignorant `cause` → échec du cas N09 |
| N04 | Garde de `loadMore` retirée | **TUÉE** — retrait du `if (!planLoadMore(state))` dans `requestMoreOrders` → échec du cas N04 |
| N18 | "Charger plus" lance une requête `'initial'` | **TUÉE** — `requestMoreOrders` appelant `loadOrdersListPage(..., 'initial')` → échec du cas N18 |
| N10 | Échec du catalogue d'étapes avalé | **TUÉE** — `loadOrdersListStepsAction` rendant toujours `stepsLoaded` → échec du cas N10 |
| V1 (mineur) | Deux `pageLoaded` "more" identiques ajoutent deux fois la page | **TUÉE** — retrait de la garde de curseur/statut dans `isApplicableMoreResponse` → échec de la sonde V1 |
| R09b/R11c | Requête initiale reprend `state.nextCursor` | **TUÉE** — ajout de `pageCursor` conditionnel en mode initial → échec du cas dédié |
| R34 | "Tous les clients" n'appelle pas `onClear` (composant) | **SURVIT, ACCEPTÉ EXPLICITEMENT** — clic DOM pur, recette navigateur |
| R35 | `onClear` de la page ne dispatch rien | **SURVIT, ACCEPTÉ EXPLICITEMENT** — même raison, rejoué (`onClear={() => undefined}`) contre `tests/modules/commercial-orders tests/surfaces tests/platform/api` : suite entière VERTE malgré la mutation, confirmant qu'aucun test actuel ne la couvre |

**Gates rejouées après restauration complète** : `pnpm typecheck` vert ;
`pnpm exec vitest run tests/modules/commercial-orders tests/surfaces tests/platform/api`
vert (155 cas) ; `pnpm test:contract` vert (432/432) ; `pnpm test:architecture`
vert (153/153) ; `pnpm gen:api:check` aligné.

## qa-review round 3 (2026-09-14) — REJETÉ (rejet ÉTROIT : réducteur, colonnes, chargeur d'étapes, contrôleur de recherche et course B1 restaient acquis), CORRIGÉ

**Le bloquant.** Trois endroits de `OrdersListPage.tsx` restaient écrits
pour un filtre PRÉCIS, en contradiction avec la lettre de la condition
(b1) : une table `DATE_FILTER_LABEL` indexée par `filter.id` (ligne 106),
une comparaison `filter.id === 'sort' ? 'ml-auto' : ''` (ligne 243), et le
filtre CLIENT laissé hors de `ORDERS_LIST_FILTERS`, avec son propre
`onSelect`/`onClear` câblé à la main dans la page.

**Corrigé.**

1. **`label`/`align` déplacés sur le descripteur** (`orders-list.helpers.ts`,
   `OrdersListFilterDescriptor`) : `createdFrom`/`createdTo` portent
   `label: 'Du'`/`'Au'` ; `sort` porte `align: 'end'`. La page ne fait plus
   que lire `filter.label`/`filter.align` dans la boucle générique — la
   table `DATE_FILTER_LABEL` et la comparaison `filter.id === 'sort'` ont
   disparu.
2. **Le filtre CLIENT intégré à `ORDERS_LIST_FILTERS`**, `kind:
   'customer-search'`, DÉCISION DU COORDINATEUR appliquée à la lettre :
   aucune exception actée. Son `toAction` accepte une sélection
   (`{ customerId, label }`) ou `null` (effacer) et délègue à
   `customerFilterSelected`/`customerFilterCleared` — les MÊMES fonctions
   pures que round 2, désormais atteintes par le MÊME
   `handleOrdersListFilterChange()` que tous les autres filtres. La page
   ne construit plus `dispatch(customerFilterSelected(...))`/
   `dispatch(customerFilterCleared())` elle-même : elle appelle
   `handleOrdersListFilterChange(dispatch, ORDERS_LIST_FILTERS, filter.id,
   { customerId, label })`/`(..., null)`, exactement comme un `<select>`
   appellerait la même fonction avec `e.target.value`.

**Sur "doit tuer R35 et N14p, ou dis précisément ce qui reste une liaison
DOM générique" : les deux mutations ne sont PLUS applicables telles
quelles** (le code qu'elles ciblaient — la construction de l'action en
ligne dans la page — n'existe plus, remplacé par un appel à
`handleOrdersListFilterChange`). **Ce que round 3 ferme réellement** :
un nouveau cas dédié prouve que le `toAction` du descripteur `customerId`
transmet la sélection et le `null` d'effacement sans les altérer — ce qui
aurait fait tomber une régression équivalente à N14/R35 SI elle avait été
réintroduite dans `toAction` lui-même (vérifié par mutation, voir tableau
plus bas). **Ce qui reste, structurellement, une liaison DOM générique
non prouvée** : le point d'appel exact dans le JSX
(`onSelect={(customerId, label) => handleOrdersListFilterChange(...)}`)
est maintenant EXACTEMENT de la même nature que l'`onChange` d'un
`<select>` de tri ou d'étape — ni plus ni moins prouvable. Ce n'est plus
une exception du filtre client, c'est la même limite que la boucle de
colonnes (R04/R04b) : seule la recette navigateur du coordinateur la
couvre.

### MOYENS

- **X05/X06** : un test unique
  (`ORDERS_LIST_FILTERS.map(f => [f.id, f.kind, f.testId, f.label ?? null,
  f.align ?? null])`) fixe la table complète attendue, client compris —
  avant ce test, aucun cas ne fixait `testId`/`kind` d'un descripteur,
  seul leur comportement (`read`/`toAction`) l'était.
- **X24** : `loadMoreOrders(dispatch, api, state)` extrait
  (`orders-list.helpers.ts`) — SEUL point d'entrée du clic "Charger plus".
  Émet `loadMoreRequested` PUIS la réponse réseau, dans cet ordre, et ne
  fait RIEN (aucun `dispatch`, aucun appel réseau) si `planLoadMore()`
  refuse. La page ne fait plus que `void loadMoreOrders(dispatch,
  ordersApi, state)`.

### MINEURS

- **X07 (effet de résolution des clients)** : l'effet annulait son propre
  lot en vol à chaque nouvelle valeur de `state.orders` (ex. "Charger
  plus" répond avant les fiches clients de la page 1), qui repartait donc
  en double. Corrigé à trois niveaux : *(1)* `missingCustomerIds(orders,
  known, inFlight)` extraite, pure et testée — exclut les clients déjà
  connus ET ceux déjà en vol ; *(2)* un `ref` (`inFlightCustomerIds`)
  suit les identifiants en cours de chargement, partagé entre exécutions
  successives de l'effet ; *(3)* l'effet ne porte PLUS de fonction de
  nettoyage qui annule un lot en vol — les résultats sont fusionnés dès
  qu'ils arrivent, quel que soit l'état au moment où ils reviennent ;
  seul un `isMountedRef` (mis à jour par un effet dédié, monté une seule
  fois) empêche une mise à jour après un DÉMONTAGE réel.
- **X27** : `buildCellContext()` reçoit désormais les FICHES BRUTES des
  clients (`Pick<CustomerDto, 'type'|'company_name'|'first_name'|
  'last_name'>`), et calcule elle-même le libellé via
  `customerDisplayName()` — round 2 avait déjà corrigé le REPLI sur un
  tiret (N19), mais le CALCUL du libellé restait fait dans la page, hors
  du périmètre testé.
- **X25** : `canLoadMore(state)` extraite et testée — distincte de
  `planLoadMore()` (qui décide si une NOUVELLE requête doit partir) : le
  bouton reste VISIBLE (désactivé) pendant un chargement "more" déjà en
  cours, il disparaît seulement pendant le chargement initial ou sans
  page suivante.
- **`CustomerFilterSelect` — initialisation paresseuse du contrôleur** :
  `useRef(createCustomerSearchController(...))` évaluait son argument à
  CHAQUE rendu (donc construisait un contrôleur/debounce jetable à chaque
  rendu, même si seul le premier était conservé) — remplacé par
  `useRef(null)` + assignation conditionnelle au premier rendu.
- **Documentation** : l'en-tête de `OrdersListPage.tsx` affirmait « D5
  NON AGGRAVÉE » — vrai pour la remise en concurrence par une page
  REJETÉE (round 2), mais round 2 continuait d'ANNULER un lot en vol à
  chaque changement de `state.orders`, ce qui aggravait D5 par un autre
  chemin. Round 3 corrige ce chemin ; l'en-tête est réécrit pour dire
  PRÉCISÉMENT ce qui est corrigé et pourquoi round 2 ne suffisait pas.
  Les variantes JSX N01c, N14p (au sens littéral de sa mutation d'origine,
  devenue inapplicable), N10c restent des résidus de câblage DOM, non
  prouvés par un test — relèvent de la recette navigateur, sauf mention
  contraire ci-dessus.

### Ce qui restera, PAR CONSTRUCTION, à la recette navigateur (le coordinateur la joue lui-même)

La boucle de colonnes, la boucle de filtres (est-ce qu'elle lit vraiment
`filter.label`/`filter.align`/`filter.testId`, ou une copie figée), la
liaison générique du sélecteur client (le clic sur une option, l'appel
réel de `onSelect`/`onClear`), `maxLength` du champ de recherche, les
dépendances des effets (`useEffect(..., [ordersApi, state.generation])`
et consorts), le bandeau d'erreur des étapes (est-il RENDU dans le DOM),
la destruction du contrôleur de recherche au démontage
(`controller.dispose()` réellement appelé). **Ce lot ne les affirme pas
testés.**

### Tableau des mutations rejouées — round 3 (`mutations_r3.log`)

Chaque mutation ci-dessous a été REJOUÉE RÉELLEMENT contre le code
CORRIGÉ (édition adaptée à la nouvelle architecture, exécution de la
suite concernée, restauration vérifiée par comparaison de fichiers).

| Mutation | Résultat contre le code corrigé |
|---|---|
| X08 (bloquant — libellé "Du"/"Au" sur le descripteur) | **TUÉE** — le test X05/X06 (table complète) échoue si un `label` diverge |
| Alignement (bloquant — `align` sur le descripteur `sort`) | **TUÉE** — même test, `align` manquant/déplacé change la table attendue |
| Client — `toAction` perd le libellé de la sélection (équivalent N14 déplacé sur le descripteur) | **TUÉE** — cas dédié « le filtre client dispatche... via la MÊME fonction générique » |
| Client — `toAction` ignore l'effacement (équivalent R35 déplacé sur le descripteur) | **TUÉE** — même cas, branche `null` |
| X05 (testId étape/tri permutés) | **TUÉE** — table X05/X06 |
| X06 (kind du filtre étape = `'date'`) | **TUÉE** — table X05/X06 |
| X24 (`loadMoreOrders` oublie `loadMoreRequested`) | **TUÉE** — cas dédié, ordre des dispatchs vérifié |
| X07 (`missingCustomerIds` ignore `inFlight`) | **TUÉE** — cas dédié |
| X27 (`buildCellContext` retombe sur l'identifiant technique) | **TUÉE** — cas dédié (raison sociale et particulier) |
| X25 (`canLoadMore` ignore le curseur) | **TUÉE** — cas dédié |
| Page — l'effet de résolution des clients annule à nouveau un lot en vol | **NON COUVERTE PAR UN TEST UNITAIRE** — vérifiée par relecture (absence de fonction de nettoyage dans l'effet) ; `tsc` reste vert car ce n'est pas une erreur de type. Le comportement lui-même (fusion malgré un changement de `state.orders`) n'est prouvé qu'en recette navigateur. |
| `CustomerFilterSelect` — ref non paresseuse | **NON COUVERTE PAR UN TEST UNITAIRE**, même raison — vérifiée par relecture du code. |

**Gates rejouées après restauration complète** : `pnpm typecheck` vert ;
`pnpm exec vitest run tests/modules/commercial-orders tests/surfaces tests/platform/api`
vert (167 cas) ; `pnpm test:contract` vert (432/432) ; `pnpm test:architecture`
vert (153/153) ; `pnpm gen:api:check` aligné.

## Ce qui est livré (état après correction round 1, round 2 puis round 3)

### 1. Colonnes, dans l'ordre arrêté par Arnaud

`ORDERS_LIST_COLUMNS` (`orders-list.helpers.ts`) : **N° · Client · Créée
le · Étape de production · Net HT · Total TTC**. Exportée comme donnée
(pas recopiée dans le JSX de `OrdersListPage.tsx`), pour que l'ordre et
les intitulés soient vérifiables par un test sans rendre le composant.

« Net HT » = `totals.net_total`, « Total TTC » = `totals.total_incl_tax`,
tous deux rendus **tels que le serveur les sert** — `formatOrderMoney()`
ne fait que suffixer `€`, **aucune** conversion en `number` ni calcul
(E10.8 gelée, `PricingEngine` E10.21 non appelé). Même rendu que la
colonne Total TTC déjà en place avant ce lot.

### 2. Étape de production — colonne et filtre, UN SEUL appel, échec signalé

`resolveCurrentProductionStepLabel(currentProductionStepId, stepsById)` :
tiret (`—`) si la commande n'a pas d'étape courante (`null`) ou si
l'étape référencée n'est plus dans la collection chargée (cas théorique).
`formatProductionStepLabel(step)` signale une étape **désactivée**
(suffixe ` (désactivée)`), réutilisée à l'identique dans la colonne et
dans les options du filtre.

`loadProductionStepCatalog(api)` (`orders-list.helpers.ts`, extrait en
qa-review round 1, M2/m3) charge la collection **une seule fois**, par un
appel **sans argument de statut** (§8.24 point (iii) : le garder évite de
perdre le libellé d'une étape désactivée sur laquelle une commande de
gestion commerciale reste posée — le contrat garde ces commandes
lisibles), et rend `{ ok: true, catalog: { byId, ordered } }` ou
`{ ok: false, error }` — jamais une exception qui remonterait
silencieusement jusqu'au composant. `OrdersListPage.tsx` affiche un
bandeau (`listStepsLoadErrorBanner`) DISTINCT du tiret « — » d'une
commande sans étape si ce chargement échoue (m3, qa-review round 1) —
avant ce correctif, l'échec était avalé et chaque commande affichait un
tiret indiscernable du cas « sans étape ». Zéro appel par ligne de la
grille : la résolution du libellé (`resolveCurrentProductionStepLabel`)
est une simple lecture dans une `Map` déjà en mémoire.

### 3. Filtres et tri — état et réducteur UNIQUES (durci en qa-review round 1, B1/B2)

`OrdersListFilters` (`orders-list.helpers.ts`) : `createdFrom`,
`createdTo` (E10.18a, inchangés), `customerId`, `productionStepId`,
`sort`. **Une seule fonction pure** en tire la partie « filtres » d'une
requête, `buildOrdersListQuery()` — c'est elle, et elle seule, qu'E10.18e-2
réutilisera pour en tirer un second jeu de filtres (export), ce qui rendra
« exactement les filtres de la grille » testable plutôt qu'affirmé.

Ces filtres vivent maintenant DANS `OrdersListState` (`orders-list.helpers.ts`),
avec le tri, un compteur `generation`, le statut, les lignes et le
curseur. `ordersListReducer` est la SEULE fonction qui les fait
transitionner :
- **Client** : `CustomerFilterSelect` dispatch `customerSelected`/
  `customerCleared` (`ui/components/`, composant LOCAL au module — voir
  point 5).
- **Étape** : `<select>` natif dispatch `filtersChanged`, options =
  collection complète (actives et désactivées, ordre de `position`,
  `loadProductionStepCatalog`), libellé des désactivées signalé. Aucune
  option « sans étape » : le contrat n'en publie pas.
- **Tri** : `<select>` natif dispatch `filtersChanged`,
  `ORDERS_LIST_SORT_OPTIONS` — défaut `-created_at`, plus
  `production_step`/`-production_step` (sens du flux / sens inverse).
  `created_at` croissant **n'est pas exposé** : rien ne l'a décidé
  (§8.24, décision 2 d'Arnaud).

**Remise à zéro de la pagination, à deux niveaux distincts (précision
qa-review round 1, B2)** : *(1)* **structurellement**,
`buildInitialLoadRequest(filters, pageSize)` n'a PAS de paramètre curseur
dans sa signature — elle ne peut donc jamais en transmettre un, quel que
soit son appelant ; `buildLoadMoreRequest(filters, pageSize, cursor)` est
la seule fonction du fichier qui en accepte un. *(2)* **par le
réducteur** : `filtersChanged`/`customerSelected`/`customerCleared`
délèguent tous à `resetForNewQuery()`, qui pose `orders: []`/
`nextCursor: null`/`generation: generation + 1` — c'est CETTE remise à
zéro de l'ÉTAT, et non la seule signature de la fonction de requête, qui
empêche un curseur périmé de survivre à un changement de filtre. Le test
« B2 » part explicitement d'un état qui porte déjà un curseur et des
lignes pour le prouver (voir section qa-review ci-dessus).

### 4. `CommercialOrdersApiClient.list()` — deux paramètres ajoutés

`src/modules/commercial-orders/api/client.ts` : `ListCommercialOrdersQuery`
gagne `currentProductionStepId?: string` (→ `current_production_step_id`)
et `sort?: CommercialOrderSort` (→ `sort`). Aucune validation côté client
(même discipline que les autres paramètres) : la route valide déjà
`current_production_step_id` (422 `production_step.not_found` si l'étape
n'appartient pas au tenant) et `sort` (400 si la valeur ne fait pas partie
de l'énumération) — affichés tels quels par la grille (bandeau d'erreur).

### 5. `CustomerFilterSelect` — sélecteur de client à recherche serveur

`src/modules/commercial-orders/ui/components/CustomerFilterSelect.tsx`
(composant LOCAL au module, §8.24 point (iii)) : **PAS** un chargement de
200 clients d'un coup (l'anti-patron déjà présent dans
`PriceRuleFormModal`/`PricingRulesPage`/`AddToProjectModal`,
`customersApi.list({ pageSize: 200 })`, qui tronque en silence au-delà).
Recherche **serveur** (`GET /customers?q=`), debattue par
`createDebouncedSearch()` (`customer-filter-select.helpers.ts`, 300 ms).

UI : `Popover`/`Command` (`@/shared/ui`, `cmdk`), même patron que le
combobox déjà en place dans `RoleEditorDialog.tsx` (`shouldFilter={false}`
puisque le filtrage est déjà fait côté serveur). Le libellé du client
sélectionné vient du résultat de recherche déjà reçu, **sans appel
supplémentaire** (même règle que celle écrite pour l'export en E10.18e-2,
appliquée ici par cohérence).

`createDebouncedSearch()` isole la seule partie non triviale de ce
sélecteur — attendre l'arrêt de frappe, et ne jamais résoudre une réponse
PÉRIMÉE (une frappe plus récente a changé la requête avant que la
précédente n'ait répondu) — dans une fonction sans JSX, testée avec des
timers factices (`vi.useFakeTimers`), sans dépendre de
`@testing-library/react` (absente de ce dépôt).

**Durci en qa-review round 1** :
- `buildCustomerSearch(api)` (M5) est le SEUL point d'appel à
  `customersApi.list()` pour ce composant — il propage `nextCursor` sous
  forme d'un indicateur `truncated`, affiché comme « Plus de 20 résultats,
  affinez la recherche. » plutôt que tu en silence (l'anti-patron que ce
  composant dénonce par ailleurs pour `pageSize: 200` s'appliquait tout
  autant à une troncature à 20 non signalée).
- `createDebouncedSearch()` gagne `.cancel()` (m1) : annule le timer en
  attente ET invalide la génération d'un appel réseau déjà parti (sa
  réponse, si elle arrive quand même, ne résout jamais). Appelé dès que le
  champ redevient vide et au démontage — sans cela, taper « dup » puis
  effacer avant le délai de 300 ms laissait partir la recherche « dup » en
  arrière-plan.
- `maxLength={200}` sur `CommandInput` (m2, borne du contrat sur
  `GET /customers?q=`), et un état d'erreur DISTINCT de « aucun résultat »
  — avant ce correctif, toute erreur (réseau, 400) était avalée par le
  même `catch` que « zéro résultat », affichant faussement « Aucun client
  trouvé. » sur une recherche qui a en réalité échoué.
- `optionTestId` remplace un testid dérivé non déclaré (m4, voir section 8).

### 6. Entrée de menu — « Commandes atelier »

`src/modules/commercial-orders/surface-contributions.ts`,
`commercialOrdersWorkspaceContribution.navigation` :

```
id: 'commercial-orders.workspace.navigation'
moduleId: 'commercial-orders'
featureId: 'commercial-orders.workspace-list'
surface: 'workspace'
routeId: 'commercial-orders.workspace.list'
groupId: 'commercial'
label: 'Commandes atelier'
iconId: 'factory'
order: 135
```

Exactement les valeurs du cadrage (§8.24 point (iv)). `iconId: 'factory'`
**déjà enregistrée** dans `WORKSPACE_ICONS` (`DashboardLayout.tsx`, portée
par « Parcs machines » — vérifié avant d'écrire, une `iconId` absente du
catalogue fait lever `composeWorkspaceGroups()` au rendu). **Pas
`'shopping-bag'`**, déjà pris par l'entrée « Commandes » du module
`orders` (commandes boutique) — deux icônes différentes pour deux domaines
sans rapport, exactement le motif du cadrage.

Visibilité : aucune règle spéciale ajoutée dans `isNavigationVisible` —
l'entrée hérite de la garde de sa route (`requiredCapabilities:
['commercial-orders.read']`), comme « Devis » et « Clients ». Le fait que
cet identifiant ne soit pour l'instant réservé qu'aux administrateurs est
constaté (cadrage §8.24, point 8 sous le tableau) mais **hors périmètre de
ce lot** — pas touché.

Testé : `tests/surfaces/contribution-registry.test.ts`, nouveau cas
(patron de l'assertion « Devis ») + vérification que l'icône diffère de
celle de l'entrée « Commandes » boutique + (qa-review round 1, C3) un
second cas dédié qui vérifie `requiredCapabilities: ['commercial-orders.read']`
sur la route elle-même — retirer cette garde ne faisait tomber aucune
gate avant ce cas.

### 7. Énoncés survivants corrigés

Les trois commentaires « aucune entrée de navigation » relevés par
l'architecte (§8.24, quatorzième entrée) sont corrigés : en-tête de
`surface-contributions.ts`, en-tête d'`OrdersListPage.tsx`, bloc
`commercialOrder` de `testIds.ts`. La description de la fonctionnalité
`commercial-orders.workspace-list` du manifeste (`manifest.ts`), qui ne
citait que le filtre de période, est étendue aux filtres client/étape, au
tri et à la découvrabilité depuis la sidebar.

### 8. Testids

Bloc `commercialOrder` de `src/shared/presentation/testIds.ts`, préfixe
`order-list-` déjà en place :
- `listCustomerFilter: 'order-list-customer-filter'` — porté par le
  déclencheur du `CustomerFilterSelect`.
- `listCustomerFilterOption: 'order-list-customer-filter-option'`
  (qa-review round 1, m4) — porté par chaque option de la liste de
  résultats, transmis par la prop explicite `optionTestId`. **Remplace**
  un testid dérivé (`${testId}-option`) que la version round 0 utilisait
  sans le déclarer dans ce fichier.
- `listStepFilter: 'order-list-step-filter'` — le `<select>` d'étape.
- `listSortSelect: 'order-list-sort-select'` — le `<select>` de tri.
- `listStepsLoadErrorBanner: 'order-list-steps-load-error-banner'`
  (qa-review round 1, m3) — bandeau signalant un échec de chargement du
  catalogue d'étapes, DISTINCT de `listErrorBanner` (erreur de chargement
  des commandes) et du tiret « — » d'une commande sans étape.

**Aucun cahier de test Notion accessible à cet agent** (pas d'accès à
Notion, cf. mandat) : posés selon la convention documentée en tête de
`testIds.ts` (`<scope>-<element>[-<modifier>]`), listés ici pour
confrontation au cahier P13 par le coordinateur/scribe.

## Décisions prises et leur motif

1. **`formatOrderMoney()` créée plutôt que de recopier `${x} €` deux
   fois** : donne un point unique testable qui prouve l'absence de
   conversion (`Number(...).toFixed(2)` produirait un résultat différent
   sur une valeur à une seule décimale, ex. `"1234.5"` → `"1234.50"` ; le
   test dédié utilise exactement ce cas pour être sensible à une telle
   régression).
2. **`buildInitialLoadRequest`/`buildLoadMoreRequest` séparées de
   `buildOrdersListQuery`** plutôt qu'un seul paramètre optionnel de
   curseur : la garantie « un changement de filtre ne peut pas reprendre
   un curseur » devient une propriété de **signature** (la fonction
   appelée sur changement de filtre n'a structurellement pas de paramètre
   curseur), pas seulement une discipline d'appel à relire à chaque revue.
3. **`resolveCurrentProductionStepLabel` prend une `Map`, pas un
   `Record`** : lecture en O(1) sans recopie, et signature qui rend
   explicite qu'aucune fonction de ce fichier ne fait de recherche
   linéaire sur la liste des étapes par commande (donc pas de coût qui
   grandirait avec le nombre d'étapes).
4. **`CustomerFilterSelect` reçoit une fonction `search` en prop plutôt
   que d'instancier son propre `CustomersApiClient`** : le composant reste
   sans dépendance directe au runtime API du workspace
   (`useWorkspaceApi`), ce qui le rend réutilisable tel quel si un autre
   écran du module en a besoin, et supprime tout besoin de mock du
   runtime pour tester la seule partie qui compte (le debounce, testé
   séparément dans `customer-filter-select.helpers.ts`).
5. **`createDebouncedSearch` générique (`<TQuery, TResult>`)**, pas
   spécialisé « client » : aucune dépendance à `CustomerDto` dans ce
   fichier, testable sans le module Clients.
6. **Sélecteur de client construit avec `Popover`/`Command`
   (`@/shared/ui`)**, plutôt qu'un `<input>` + `<div>` de dropdown écrit à
   la main : réutilise un patron déjà éprouvé dans ce dépôt
   (`RoleEditorDialog.tsx`), `shouldFilter={false}` explicite pour ne pas
   laisser `cmdk` refiltrer côté client une liste déjà filtrée par le
   serveur (qui produirait un filtrage DOUBLE et potentiellement
   incohérent avec ce que le serveur a réellement rendu pertinent).
7. **Le tri n'est PAS envoyé au serveur quand il vaut le défaut
   (`-created_at`)** : `buildOrdersListQuery()` omet la clé `sort` dans ce
   cas (même discipline que les autres axes : absence = comportement par
   défaut, jamais une valeur par défaut recopiée explicitement). Un
   changement futur du défaut serveur n'aurait donc pas besoin d'un
   changement synchronisé côté client pour rester cohérent.
8. **(qa-review round 1) Un réducteur (`useReducer`) plutôt que des
   `useState` épars** : c'est la seule façon, sans outil de rendu React,
   de rendre TESTABLE la propriété « un changement de filtre remet tout à
   zéro » et « une réponse périmée est ignorée » — un réducteur est une
   fonction pure `(state, action) => state`, appelable directement dans un
   test avec des objets construits à la main, alors qu'un `useState` ne
   l'est pas sans monter le composant.
9. **(qa-review round 1) `loadOrdersListPage()` et
   `loadProductionStepCatalog()` rendent un résultat/une action, ne
   `throw`-ent jamais** : même discipline que le reste du dépôt E10
   (renderers d'export, services) — le composant n'a plus qu'à
   `dispatch()`/lire un champ `ok`, jamais un `try/catch` autour d'un appel
   dont il devrait interpréter l'échec lui-même.
10. **(qa-review round 1) `buildCustomerSearch`/`loadProductionStepCatalog`
    prennent l'API en paramètre (`Pick<Client, 'list'>`) plutôt que de
    fermer sur une instance capturée** : permet de les tester avec un objet
    littéral `{ list: vi.fn() }`, sans instancier `useWorkspaceApi` ni un
    vrai client HTTP.

## Points remontés au cadrage

Aucun. Le cadrage (§8.24, consigne E10.18e-1) a été suivi à la lettre ;
aucune contradiction trouvée entre les dix points de la consigne, ni avec
le code existant (route déjà prête à recevoir les deux nouveaux
paramètres — vérifié à la lecture de `commercial-orders-routes.ts` avant
d'écrire une ligne, exactement comme demandé par le point 8 du mandat).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **D5 (héritée, NON AGGRAVÉE)** | `OrdersListPage.tsx` résout toujours les clients par lignes en N+1 (`GET /customers/{id}` par identifiant distinct de la page, patron déjà présent avant ce lot et dans `QuotesPage.tsx`). Ce lot ajoute un filtre client (qui, une fois posé, résout ce client-là en un seul appel) mais ne corrige pas la résolution des AUTRES clients affichés dans la page. | Hors périmètre explicite de ce lot (§8.24 point (iii) : « la refonte n'aggrave pas D5 ... n'ajoute aucun appel par ligne » — sur les colonnes nouvelles, pas sur le nom du client, déjà connu). Chemin déjà tracé par E10.18a : endpoint de résolution par lot, à spécifier avec l'architecte, appliqué aux DEUX écrans (`QuotesPage.tsx`, `OrdersListPage.tsx`) en une seule story. |
| **Nouvelle, mineure — REFORMULÉE en qa-review round 1** | `OrdersListPage.tsx`/`CustomerFilterSelect.tsx` ne sont couverts par AUCUN test de rendu (pas de `@testing-library/react` dans ce dépôt). Après le round 1, toute la logique DÉCISIONNELLE extractible sans rendre un composant l'est (réducteur, orchestration réseau, catalogue d'étapes, recherche client, descripteurs de colonnes) et testée — il ne reste que le câblage React pur (un `onChange` qui dispatch la bonne action, un clic qui appelle la bonne prop, l'ouverture du `Popover`), vérifié uniquement par lecture de code. | L'architecte tranche en ce moment si ce dépôt doit adopter un outil de rendu React (ex. `@testing-library/react` + `jsdom`/`happy-dom`, ou des tests `react-dom/server` ciblés comme suggéré par la qa-review pour un rendu purement présentationnel). Tant que ce n'est pas tranché, tout nouveau composant de ce module doit suivre le même principe de « coquille » retenu ici. |

## Dérogations R5

Aucune.

## Tests exécutés (après correction qa-review round 1, round 2 puis round 3)

- `pnpm typecheck` (`typecheck:modular`) : **0 erreur**.
- `pnpm exec vitest run tests/modules/commercial-orders` : **6 fichiers,
  133 cas** (+12 par rapport aux 121 de round 2). Détail :
  - `orders-list.helpers.test.ts` : **86 cas** (+12 par rapport aux 74 de
    round 2) — ajouts round 3 : table X05/X06 (1), filtre client intégré à
    `ORDERS_LIST_FILTERS` (2, dont le cas dédié « dispatche... via la MÊME
    fonction générique »), `buildCellContext`/X27 (2 cas remplacés/ajoutés),
    `missingCustomerIds` (4, nouveau), `canLoadMore` (3, nouveau),
    `loadMoreOrders` (2, nouveau).
  - `customer-filter-select.helpers.test.ts` : **21 cas, inchangé** (round 3
    ne retouche pas ce fichier — le contrôleur de recherche n'a pas changé).
  - `commercial-orders-api-client.test.ts` : **4 cas, inchangé**.
- `pnpm exec vitest run tests/surfaces` : **2 fichiers, 25 cas, inchangé**.
- `pnpm exec vitest run tests/platform/api` : **1 fichier, 9 cas, inchangé**.
- `pnpm test:contract` : **432/432, 23 fichiers, inchangé**.
- `pnpm test:architecture` : **153/153, 35 fichiers, inchangé**.
- `pnpm gen:api:check` : **aligné**, aucune dérive (confirme qu'aucun
  fichier `openapi/`/`docs/api/CONVENTIONS.md`/`SPRINT_HANDOFF.md`/
  `supabase/` n'a été touché par cet agent, aux trois rounds).
- `pnpm test` (suite complète) : **269 fichiers passés, 2521 cas passés,
  36 ignorés, 1 fichier en échec — `tests/storage/product_mockups_isolation.test.ts`
  (3 cas), échec PRÉEXISTANT et SANS RAPPORT** (bucket `product_mockups`
  absent de l'environnement local, feature non touchée par ce lot). +12
  cas passés par rapport à l'état après round 2 (2509).

### Tableau des mutations rejouées

Reprise de la campagne du mandat (`mutate.py`/`variants.py`, journal
`mutations.log`) plus les mutations dédiées aux corrections nouvelles
(réducteur, orchestration réseau, catalogue d'étapes, recherche client),
**chacune exécutée réellement sur le code CORRIGÉ**, puis restaurée.

| # | Mutation | Avant correction | Après correction |
|---|---|---|---|
| B1 | Retirer la garde de génération du cas `pageLoaded` (`ordersListReducer`) | survivait (aucun réducteur) | **CAPTURÉE** — `ordersListReducer` (« B1 — un pageLoaded... ») + `loadOrdersListPage` (« scénario B1 complet ») |
| B2 | `resetForNewQuery()` conserve `orders`/`nextCursor` au lieu de les vider | survivait (aucune remise à zéro d'état testée) | **CAPTURÉE** — 4 cas du réducteur (`filtersChanged`, `customerSelected`, `customerCleared`, `filtersChanged` avec tri) |
| M01/M02/M03/M04 | Permuter/dupliquer les colonnes ou lire le mauvais champ (`net_total`/`total_incl_tax`/`lines_subtotal`) | M01 capturée, M02/M03/M04 survivaient (JSX à la main) | **TOUTES CAPTURÉES** — descripteurs `ORDERS_LIST_COLUMNS`, fixture testée (rejoué : lecture croisée Net HT/TTC → échec immédiat) |
| M06/M07 | Oublier la sérialisation de `current_production_step_id`/`sort` dans `client.ts` | survivaient (aucun test de `client.ts`) | **CAPTURÉES** — `commercial-orders-api-client.test.ts` (rejoué : suppression de la ligne `sort` → 2 cas échouent) |
| M08 | Écraser `productionStepId` avant l'appel réseau (dans la page) | survivait (page non testée) | **CAPTURÉE** — `loadOrdersListPage`, seul point d'appel testé (rejoué : override avant l'appel → échec immédiat) |
| M10 | `pageLoaded` (mode initial) ajoute au lieu de remplacer | survivait (`setOrders` non testé) | **CAPTURÉE** — cas dédié du réducteur |
| M12/M14/M15 | Charger les étapes avec `status:'active'` / les filtrer / ne pas les trier | survivaient (page non testée) | **TOUTES CAPTURÉES** — `loadProductionStepCatalog` (rejoué : `status:'active'` → échec sur `toHaveBeenCalledWith()`) |
| M17/M19 | Contourner `resolveCurrentProductionStepLabel`/`formatOrderMoney` dans le JSX | survivaient (JSX à la main) | **CAPTURÉES** — plus de chemin JSX séparé, seul le descripteur existe et il est testé |
| M20/R20 | Appeler `search` directement, sans passer par le debounce | survivait (composant non testé) | **CORRIGÉ ET CAPTURÉ EN ROUND 2** — cette mutation était fausse à l'époque : `search`/`debounced` vivent maintenant dans `createCustomerSearchController`, testé (« R20 — une frappe non vide passe TOUJOURS par le debounce interne »). |
| M22 | `customersApi.list({ pageSize: 200 })` sans `q` | survivait (recherche non extraite) | **CAPTURÉE** — `buildCustomerSearch` (rejoué : suppression de `q`/pageSize 200 → échec immédiat) |
| M29 | Route sans `requiredCapabilities` | survivait (aucun test) | **CAPTURÉE** — C3, `contribution-registry.test.ts` (rejoué : `requiredCapabilities: []` → échec immédiat) |
| M30/M31 | Envoyer le tri par défaut explicitement / ne jamais l'envoyer | M31 capturée, M30 survivait | Les deux **restent capturées** par `buildOrdersListQuery` |
| M32/R32 | Sélecteur de tri qui ne dispatch rien | survivait | **CAPTURÉE** — la traduction valeur→action du filtre `sort` est testée (`handleOrdersListFilterChange`/`toAction`). Ce qui reste hors de portée, depuis round 3 EXACTEMENT comme pour tout autre filtre (round 3 a supprimé l'ancienne exception "client") : le JSX appelle-t-il réellement ce point unique pour CE `<select>` précis (boucle générique — voir « Ce qui restera à la recette », section round 3). |
| M33 | `PAGE_SIZE` codée en dur à 20 | survivait | `ORDERS_LIST_PAGE_SIZE` exportée et testée (M4/R33/R33b) ; **CAPTURÉE** au niveau de la constante et de son usage dans `loadOrdersListPage`. |
| M34/R34 | Clic « Tous les clients » n'appelle pas `onClear` | survivait | **RESTE NON CAPTURÉE, EXPLICITEMENT ACCEPTÉ, MÊME APRÈS ROUND 3** — liaison de clic pure JSX (`CommandItem.onSelect` de `cmdk`), voir la section round 3. |
| M35/R35 | `onClear` de la page ne dispatch rien | survivait | **RÉSOLUE STRUCTURELLEMENT EN ROUND 3** — la construction de l'action que cette mutation ciblait a été remplacée par un appel à `handleOrdersListFilterChange`, testé (voir round 3, cas dédié « le filtre client dispatche... »). Le point d'appel JSX lui-même reste une liaison DOM générique, désormais identique à celle de n'importe quel autre filtre — plus une exception. |
| m1 | Retirer `clearTimeout` de `cancel()` | n'existait pas encore | **CAPTURÉE** — nouveau test dédié |
| m5/M5 | `buildCustomerSearch` reste en dur `pageSize:200`, `truncated` toujours faux | n'existait pas encore | **CAPTURÉE** — 3 cas dédiés |

**Correction round 2 (qa-review, m5) : l'affirmation qui suivait ici en
round 1 — « M20 et M32 restent des points de câblage React pur, aucune
preuve automatisée ne peut les couvrir » — était INEXACTE pour M20/R20 et
M32/R32, et seulement PARTIELLEMENT vraie pour M34/R34 et M35/R35.**
Round 2 a démontré que la LOGIQUE de M20 (le debounce doit toujours être
utilisé) et de M32 (le tri doit dispatcher la bonne action) pouvait être
extraite et testée — ce qui est fait. **Round 3 a fermé le reste de M35/
R35** en intégrant le filtre client à `ORDERS_LIST_FILTERS` (condition
(b1), voir section dédiée) : ce n'est plus un point spécial du filtre
client, c'est la même limite que tout `onChange` de `<select>`. **Seul
M34/R34 reste réellement NON capturé** : c'est un clic sur une option
d'un menu (`CustomerFilterSelect`) où le geste "cliquer" lui-même
(l'attribut `onSelect` de `CommandItem`, fourni par la bibliothèque
`cmdk`) doit être déclenché par une interaction DOM simulée pour être
observé — il n'y a pas de fonction pure à appeler à la place de
"l'utilisateur clique". C'est la même limite, structurellement, que
R04/R04b (la boucle de rendu elle-même). Le coordinateur le vérifie par
sa recette navigateur ; ce lot ne l'affirme pas testé.

### Détail des cas clés, et la mutation qui les fait tomber

- **B1 (scénario complet)** — `loadOrdersListPage`, test « scénario B1
  complet » : un "Charger plus" est laissé EN VOL sous l'ancien tri via une
  promesse contrôlée manuellement, un changement de tri est appliqué au
  réducteur, la première page du nouveau tri s'applique, PUIS la réponse
  périmée de l'ancien "Charger plus" est résolue. *Mutation exécutée :
  retirer `if (action.generation !== state.generation) return state;` du
  cas `pageLoaded` — les deux dernières assertions du test échouent
  (`['nouveau-tri', 'ancien-tri-page-2']` reçu, `'cursor-ancien-2'` reçu).*
- **B2** — `ordersListReducer`, test « B2 — filtersChanged remet
  orders/nextCursor à zéro... » : part d'un état qui porte un curseur et
  des lignes, dispatch `filtersChanged`, vérifie `orders: []`/
  `nextCursor: null`/`generation` incrémentée ET que la requête tirée du
  nouvel état ne porte pas de curseur. *Mutation exécutée :
  `resetForNewQuery()` retourne `orders: state.orders, nextCursor:
  state.nextCursor` — 4 cas échouent (celui-ci et trois autres qui
  dépendent de la remise à zéro).*
- **M1** — `ORDERS_LIST_COLUMNS`, test « rend exactement les six cellules
  attendues... » et « distingue réellement Net HT de Total TTC... ».
  *Mutation exécutée : permuter les deux cellules `money` dans le
  descripteur — les deux tests échouent, l'un immédiatement (fixture avec
  Net HT ≠ TTC), l'autre par comparaison de la valeur reçue.*
- **M2/m3** — `loadProductionStepCatalog`, trois cas : appel sans argument
  de statut, conservation/tri d'une étape désactivée, résultat `ok:false`
  sur échec. *Mutation exécutée : `api.list({ status: 'active' })` — le
  premier cas échoue (`toHaveBeenCalledWith()` reçoit un argument).*
- **M3** — `commercial-orders-api-client.test.ts`, quatre cas de
  sérialisation. *Mutation exécutée : retirer la ligne
  `params.set('sort', query.sort)` de `client.ts` — 2 des 4 cas échouent
  (tri absent de l'URL).*
- **M5/m1** — `buildCustomerSearch`/`createDebouncedSearch.cancel()`.
  *Mutations exécutées : `api.list({ pageSize: 200 })` sans `q` — le test
  de transmission de `q` échoue ; retrait de `clearTimeout` dans
  `cancel()` — le test dédié échoue (`search` appelée alors qu'il ne
  devrait pas l'être).*
- **M08** — `loadOrdersListPage`, test « tire la requête initiale
  EXACTEMENT de state.filters... ». *Mutation exécutée : appeler
  `buildInitialLoadRequest({ ...state.filters, productionStepId: '' },
  ...)` — le test échoue (`currentProductionStepId` absent de l'appel
  reçu).*
- **C3** — `contribution-registry.test.ts`, nouveau cas.
  *Mutation exécutée : `requiredCapabilities: []` sur la route de la
  grille — le test échoue immédiatement.*

Toutes les mutations ci-dessus ont été exécutées RÉELLEMENT (édition du
fichier source, exécution de la suite concernée, restauration vérifiée
par `git status`/comparaison du contenu), pas seulement raisonnées.

## Recette navigateur (condition (b2)) — 2026-09-14, jouée par le coordinateur — CONFORME

**Conditions** : Chrome réel piloté par Chrome DevTools (profil dédié), serveur Vite `:5177` servi depuis CE dossier (`git branch --show-current` = `feat/gescom-e10-4-entite-client`, cwd du processus vérifié), base **locale** (`pnpm supabase:use:local`, pile locale redémarrée pour corriger des montages de fichiers périmés de l'Edge Runtime qui faisaient échouer `magrit-api` en `BOOT_ERROR`). Espace `recette-e10` : 54 commandes créées par les chemins produit (devis → envoi → conversion → changement d'étape), 25 clients dont 23 répondent à « imp », 6 étapes dont PAO désactivée (2 commandes), 1 commande sans étape. Comptes `recette.admin` (ADMIN, sans super-admin) et `recette.membre` (MEMBER, session isolée). Code revu : état approuvé en qa-review round 4.

| # | Vérification | Preuve observée | Résultat |
|---|---|---|---|
| 1 | Menu admin | « Commandes atelier » dans « Gestion commerciale », juste avant « Commandes » ; icônes `lucide-factory` vs `lucide-shopping-bag` | ✅ |
| 1 | Menu membre | Entrée absente ; URL directe `/dashboard/commercial-orders` redirigée vers `/dashboard/quotes`, aucun appel `/commercial-orders` émis | ✅ |
| 2 | Colonnes | En-têtes N° · Client · Créée le · Étape de production · Net HT · Total TTC ; lien sur N° seul vers `/dashboard/commercial-orders/<id>` ; noms clients (jamais d'id) ; « — » sans étape ; « PAO (désactivée) » | ✅ |
| 2 | Montants | Comparaison automatisée affiché/JSON sur 11 lignes : `net_total` et `total_incl_tax` identiques à la chaîne près (+ « € ») | ✅ |
| 3 | Étapes | UN SEUL `GET /api/v1/production-steps`, sans `status` ; options dans l'ordre `position`, désactivée suffixée | ✅ |
| 3 | Filtre étape | `current_production_step_id=<Fichier validé>&page[size]=50`, sans curseur ; 11 lignes, toutes sur l'étape | ✅ |
| 3 | Tri | `sort=production_step` (combiné au filtre puis seul), sans curseur ; ordre affiché 10/2/11/10/10/7 conforme aux positions ; sans étape en dernier | ✅ |
| 3 | Période | `created_from` puis `created_from`+`created_to` ; période inversée → 422 affiché tel quel ; période valide vide → 0 ligne, sans bandeau | ✅ |
| 4 | Rechargement | Chaque changement de filtre/tri → une requête, liste et curseur remis à zéro (54 → 50 + « Charger plus ») | ✅ |
| 5 | Client | Frappe « imp » d'un trait → UNE requête `GET /customers?q=imp&page[size]=20` ; 20 options + « Plus de 20 résultats, affinez la recherche. » ; sélection → libellé sur le déclencheur, `customer_id=<id>`, 2 lignes ; « Tous les clients » → déclencheur réinitialisé, requête sans `customer_id` ; `maxLength` = 200 ; lettre effacée en 96 ms → aucune requête ; navigation < 300 ms → aucune requête ; recherche en échec → message distinct de « Aucun client trouvé. » | ✅ |
| 6 | Charger plus | `page[cursor]` identique à `meta.next_cursor` de la page précédente, même `sort` ; 54 lignes, 54 ids distincts ; bouton absent ensuite | ✅ |
| 7 | **B1 en réel** (Slow 3G) | « Charger plus » (curseur `-created_at`) puis changement de tri 50 ms après : seule la page 1 du nouveau tri affichée (50 lignes, ordre des étapes), aucun bandeau ; « Charger plus » suivant → curseur `production_step`, 200, 54 lignes | ✅ |
| 8 | Échec étapes | `/production-steps` bloqué → bandeau « Chargement des étapes de production impossible — les libellés d'étape peuvent être incomplets. », grille chargée (50 lignes) | ✅ |
| 8 | 422 étape | Étape supprimée pendant le filtrage → 422 `production_step.not_found`, `detail` affiché tel quel | ✅ |

**Non joué** : la relance d'un client en échec au changement de page suivant (qa round 4, point 7, mutation E2) — mineur, relu seulement.

**Constats mineurs (aucun bloquant)** : (i) l'option « Tous les clients » ne porte aucun `data-testid` (volontaire dans le code, mais invisible pour un test automatisé) ; (ii) les messages d'erreur du serveur sont affichés sans accents (« Requete invalide », « ne correspond a aucune etape ») et le bandeau d'erreur coexiste avec « Aucune commande pour ces filtres. » ; (iii) une recherche client en échec affiche le message technique brut du navigateur (« Failed to fetch »), en anglais ; (iv) catalogue d'étapes en échec → toutes les cellules affichent « — », le bandeau lève l'ambiguïté (arbitré en revue). Dette D5 inchangée : 25 `GET /customers/{id}` au chargement, aucun doublon observé, y compris pendant la course B1.

**Faux signaux écartés en cours de recette** (à ne pas reprendre pour des défauts) : l'outil `fill` de Chrome DevTools ne sait pas sélectionner une option `<select>` de valeur vide (« Toutes les étapes ») — le produit réagit correctement à un vrai événement `change` ; et une sonde qui cherchait « Tous les clients » par `data-testid` ne pouvait pas la trouver (cf. constat (i)).

## Fichiers créés

- `src/modules/commercial-orders/ui/components/CustomerFilterSelect.tsx`
- `src/modules/commercial-orders/ui/components/customer-filter-select.helpers.ts`
- `tests/modules/commercial-orders/customer-filter-select.helpers.test.ts`
- `tests/modules/commercial-orders/commercial-orders-api-client.test.ts` (qa-review round 1, M3)
- `_bmad-output/implementation-artifacts/story-E10.18e-1.md` (ce document)

## Fichiers modifiés

- `src/modules/commercial-orders/api/client.ts` (`currentProductionStepId`/`sort` ajoutés à `ListCommercialOrdersQuery` — round 0, non retouché en round 1 ni round 2)
- `src/modules/commercial-orders/ui/workspace/orders-list.helpers.ts` (round 0 : état unique de filtres, `buildOrdersListQuery`/`buildInitialLoadRequest`/`buildLoadMoreRequest`, options de tri, libellés d'étape, `formatOrderMoney` ; round 1 : `ORDERS_LIST_PAGE_SIZE`, `ORDERS_LIST_COLUMNS` en descripteurs, `loadProductionStepCatalog`, `OrdersListState`/`OrdersListAction`/`ordersListReducer`, `loadOrdersListPage` ; round 2 : `linkTo` sur la colonne N°, `buildCellContext`, `hasActiveOrdersListFilters`, étapes déplacées dans le réducteur, `loadOrdersListStepsAction`, `planLoadMore`/`requestMoreOrders`, curseur porté par `pageLoaded`/`pageLoadFailed`, `ORDERS_LIST_FILTERS`/`handleOrdersListFilterChange`, `customerFilterSelected`/`customerFilterCleared` ; **round 3** : `label`/`align` sur `OrdersListFilterDescriptor`, filtre `customerId` (`kind: 'customer-search'`) intégré à `ORDERS_LIST_FILTERS`, `buildCellContext` calcule désormais lui-même `customerDisplayName` depuis des fiches clients brutes, `missingCustomerIds`, `canLoadMore`, `loadMoreOrders`)
- `src/modules/commercial-orders/ui/components/customer-filter-select.helpers.ts` (round 1 : `cancel()` sur `createDebouncedSearch`, `buildCustomerSearch` ; round 2 : `createCustomerSearchController`, `buildCustomerFilterOptions` ; non retouché en round 3)
- `src/modules/commercial-orders/ui/components/CustomerFilterSelect.tsx` (round 1 : `optionTestId`, `maxLength`, état d'erreur distinct, indicateur `truncated`, `cancel()` sur champ vide/démontage ; round 2 : réécrit en coquille autour du contrôleur de recherche ; **round 3** : initialisation paresseuse du `ref` du contrôleur)
- `src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx` (round 0 : colonnes/filtres/tri/chargement des étapes ; round 1 : réécrit en coquille, `useReducer` ; round 2 : réécrit à nouveau, boucle générique sur les filtres date/étape/tri, `linkTo` de colonne, `buildCellContext` ; **round 3 : réécrit une troisième fois** — le filtre client entre dans la boucle générique (plus de `DATE_FILTER_LABEL`/comparaison `id === 'sort'`/bloc `CustomerFilterSelect` à part), `loadMore` délègue entièrement à `loadMoreOrders`, visibilité du bouton via `canLoadMore`, résolution des clients via `missingCustomerIds`/`inFlightCustomerIds`/`isMountedRef` sans annulation de lot en vol)
- `src/modules/commercial-orders/surface-contributions.ts` (round 0 : entrée de navigation, commentaire — non retouché depuis)
- `src/modules/commercial-orders/manifest.ts` (round 0, non retouché depuis)
- `src/shared/presentation/testIds.ts` (round 0 : trois testids ; round 1 : `listCustomerFilterOption`, `listStepsLoadErrorBanner` ; non retouché en round 2 ni round 3)
- `tests/modules/commercial-orders/orders-list.helpers.test.ts` (round 1 : réécrit, +21 cas ; round 2 : réécrit à nouveau, +34 cas ; **round 3** : +12 cas — table X05/X06, filtre client dans `ORDERS_LIST_FILTERS`, `buildCellContext`/X27, `missingCustomerIds`, `canLoadMore`, `loadMoreOrders`)
- `tests/modules/commercial-orders/customer-filter-select.helpers.test.ts` (round 2 : +12 cas ; non retouché en round 3)
- `tests/surfaces/contribution-registry.test.ts` (round 0 : cas de navigation ; round 1 : cas C3 ; non retouché en round 2 ni round 3)

Aucun fichier `openapi/` ni `docs/api/CONVENTIONS.md` ni `SPRINT_HANDOFF.md`
ni `supabase/` modifié par cet agent, aux quatre rounds. Aucune commande de
reset de base jouée. Aucune dépendance ajoutée à `package.json`/
`pnpm-lock.yaml` (`@shared/ui/popover`, `@shared/ui/command` existaient
déjà, utilisés par `RoleEditorDialog.tsx`).
