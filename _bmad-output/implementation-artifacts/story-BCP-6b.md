---
id: BCP-6b
epic: E10 (hors E10, chantier boutique) — "chaine des prix Magrit -> panier et qualite d affichage"
status: round 2 (correction qa-review round 1) — qa-review distincte requise avant merge
branch: worktree-agent-ad85f6c400202ba79 (worktree isole, depuis feat/gescom-e10-4-entite-client @ 57d909b5)
commit: (voir rapport de fin de story)
depends_on: []
parallelisable_avec: [] (aucun fichier commun avec BCP-7, BCP-8, BCP-9 — cf. cadrage)
---
# BCP-6b — Fin de la boucle de requêtes `session/current` + `catalog` de la boutique

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **5.2** (la partie
BCP-6b) et la ligne BCP-6b du tableau de découpage (§6). Fichiers possédés :
`src/modules/shops/ui/hooks/usePublicShopCatalog.ts`,
`src/modules/shop-customers/ui/hooks/useStorefrontSession.ts`.

## Le constat (recette navigateur, 2026-09-16)

- Onglet au repos, visible et actif, sans action : des paires
  `GET /storefront/session/current` + `GET /public/shops/<slug>/catalog`
  toutes les ~5 s.
- Catalogue rechargé EN ENTIER à chaque tour, et 14 appels identiques au
  chargement.
- Console vide (exclut une boucle d'erreur).

## Le mécanisme établi (avant tout correctif)

**Ce qui a été vérifié par lecture de code, avec certitude :**

1. **`usePublicShopCatalog.ts` (avant ce commit) armait un `focus` +
   un `setInterval(15_000)`** dont le callback appelle `api.publicCatalog(slug)`
   DIRECTEMENT, sans repasser par `publicProbe` — ce qui explique pourquoi les
   paires mesurées en recette ne contenaient pas la sonde : ce n'est pas
   l'effet entier qui se relançait, seulement ce raccourci.
2. **`useStorefrontSession.ts` (avant ce commit) armait, séparément, son
   propre `focus` + `setInterval(15_000)`**, actif dès qu'une session existe.
3. **React `StrictMode` est absent du dépôt** (`grep -rn "StrictMode" src`
   ne trouve rien) : le doublement d'effets au montage, hypothèse plausible
   pour expliquer un multiplicateur, est écarté.
4. **`apiClient` est stable** : `StorefrontRuntimeBoundary.tsx` le crée une
   seule fois via `useMemo(() => ..., [])`. `useStorefrontApi` le mémoïse à
   son tour sur `[Client, apiClient]`. La piste « `apiClient` recréé à
   chaque rendu » est donc écartée pour ce runtime.
5. **`sessionShopId` est un `string | null` primitif**, dérivé de
   `session?.identity.shopId`. Une revalidation de session qui recrée un
   nouvel objet `session` NE change PAS la valeur de `sessionShopId` par
   égalité de référence : cette dépendance de l'effet catalogue ne se
   redéclenche donc pas à chaque revalidation, seulement sur un changement
   d'identité réel.
6. **Calcul analytique, confirmé à l'horloge simulée (`vi.useFakeTimers`)** :
   deux canaux indépendants à 15 s chacun, onglet visible, aucun événement,
   sur une fenêtre de 60 s → 4 déclenchements par canal (à 15, 30, 45, 60 s)
   → **8 au total**, exactement le compte de l'architecte. Voir
   `tests/hooks/usePublicShopCatalog.test.ts` et
   `tests/hooks/useStorefrontSession.test.ts`, bloc « horloge simulée ».

**Ce qui n'est PAS établi, et reste non confirmé au sens strict :**

- **La cadence mesurée (~5 s) reste 3 fois plus rapide que les intervalles
  écrits (15 s).** Sans navigateur (interdit par la mission) ni infrastructure
  de rendu React dans le dépôt (aucun `@testing-library/react`, environnement
  vitest en `node` sans DOM — vérifié dans `vitest.config.ts`), cette story ne
  peut pas rejouer les deux `focus` réels dans un vrai onglet pour confirmer
  ou infirmer l'hypothèse de l'architecte (les deux écouteurs `focus` se
  déclenchant ensemble, sous l'effet de l'outillage de recette ou de la page).
  Ce point reste une hypothèse, pas un fait établi par cette story.
- **La source exacte des 14 appels identiques au chargement** n'est pas
  identifiable avec certitude par lecture statique seule : les pistes
  structurelles plausibles (bascule de `sessionLoading`, `apiClient`
  instable) sont, elles, formellement écartées ci-dessus (points 4 et 5) — il
  ne reste donc, dans le code applicatif, AUCUN mécanisme qui expliquerait un
  rechargement répété du catalogue à lui seul. L'explication la plus probable
  est donc extérieure au code métier (outillage de recette / navigateur),
  cohérent avec le mécanisme du point 1 ci-dessus (le raccourci sans sonde).

**Conséquence pour le correctif : il est invariant à l'hypothèse exacte.**
Le correctif retire ENTIÈREMENT les deux mécanismes de scheduling
incriminés — plus aucun `setInterval`, plus aucun écouteur `focus`, dans
aucun des deux hooks. Que la cause première ait été un double `focus`, une
dérive de minuteur, ou autre chose non identifiée, elle disparaît avec eux :
il ne reste plus, dans le code, de canal capable de produire un appel sans
événement explicite. C'est un choix délibéré de ne pas suracquérir une
certitude que la mission interdit de vérifier empiriquement dans ce
worktree — la recette navigateur (geste ci-dessous) referme ce point.

## Comportement cible livré

| | Avant | Après (BCP-6b) |
|---|---|---|
| Chargement | 14 appels au catalogue | 1 `session/current`, 1 sonde, 1 catalogue |
| Catalogue au repos | Rechargé en entier toutes les 15 s, et à chaque `focus` | Jamais, tant que l'onglet vit. Ne se recharge que sur : reload de page, `retry`, changement d'identité de session (`sessionShopId`), retour au premier plan (`visibilitychange` → `visible`) si le dernier chargement date de plus de 10 min |
| Session au repos | Revalidée toutes les 15 s, et à chaque `focus` | Aucun intervalle. Revalidation au retour au premier plan, au plus 1×/min, et sur un 401 **de toute action storefront** (round 2 : câblé au niveau du `FetchApiClient` partagé, voir plus bas — plus aucune dette) |
| Bascules de `sessionLoading` | Relançaient sonde et catalogue | Le catalogue ne dépend plus que de la PREMIÈRE résolution de session (`sessionReady`, latch qui ne redevient jamais `false`) ; une revalidation ultérieure de session, même bloquante, ne relance plus le catalogue |

## Ce qui est livré

| Fichier | Détail |
|---|---|
| `src/modules/shops/ui/hooks/usePublicShopCatalog.ts` | Retrait du `focus` + `setInterval`. Nouvelle politique pure exportée `shouldReloadPublicShopCatalogOnVisible(event, lastLoadedAt)` + constante `PUBLIC_SHOP_CATALOG_REFRESH_MIN_INTERVAL_MS` (10 min). Nouveau state `sessionReady` : bascule UNE FOIS de `false` à `true` à la première résolution de session (`sessionLoading` → `false`), ne redevient jamais `false` — l'effet de chargement dépend désormais de `sessionReady` (pas de `sessionLoading`), donc une revalidation de session ultérieure ne relance plus le catalogue. Un second effet, monté une fois `sessionReady`, écoute `visibilitychange` et ne recharge QUE le catalogue (pas la sonde), via la politique pure, avec un `lastLoadedAtRef` mis à jour à chaque chargement réussi. |
| `src/modules/shop-customers/ui/hooks/useStorefrontSession.ts` | Retrait du `focus` + `setInterval`. Nouvelle politique pure exportée `shouldRevalidateStorefrontSession(event, lastRevalidatedAt)` + constante `STOREFRONT_SESSION_REVALIDATION_MIN_INTERVAL_MS` (1 min). Effet `visibilitychange` unique, revalidation SILENCIEUSE (`checkCurrent(false)`, ne touche jamais `loading`). **Round 2** : nouvelle fonction pure exportée `createStorefrontUnauthorizedHandler(...)`, branchée via `apiClient.onUnauthorized(handler)` (le hook lit `apiClient` via `useStorefrontUiRuntime()`) — voir section Round 2. |
| `tests/hooks/usePublicShopCatalog.test.ts` | Tests de la politique pure (focus neutre, seuil 10 min, limite exacte, premier retour sans historique) + preuve à horloge simulée (`vi.useFakeTimers`) : ancienne politique = 8 appels/60 s (2 canaux), nouvelle = 0. |
| `tests/hooks/useStorefrontSession.test.ts` | Même structure pour la politique de session (seuil 1 min) + preuve à horloge simulée : ancien canal = 4 appels/60 s, nouveau = 0. |
| `tests/architecture/storefront-refresh-scheduling.test.ts` (nouveau) | Garde de non-régression : lecture directe du source des deux hooks, interdit tout `setInterval` et tout `addEventListener('focus'`, exige `addEventListener('visibilitychange'`. |
| `tests/architecture/storefront-catalog-access.test.ts` | Assertion mise à jour : vérifie désormais le latch `sessionReady` (`if (!sessionLoading) setSessionReady(true)` + `if (!slug || !sessionReady) return`) au lieu de l'ancien `if (!slug || sessionLoading) return`. Même intention (attendre la résolution storefront avant de charger un catalogue privé), rendue plus précise par cette story. |
| `tests/components/shop/StorefrontDelegationBanner.test.ts` | Assertion mise à jour : vérifie `document.addEventListener('visibilitychange'` et l'absence de tout `addEventListener('focus'` dans `useStorefrontSession.ts`, au lieu de l'ancienne assertion littérale sur `focus`. |

## Ce qui n'est pas dans le périmètre (hors dérogation R5, limites de mission)

- **Confirmation empirique de la cause exacte des 5 s / 14 appels** : non
  disponible sans navigateur (interdit par la mission). Le correctif retire
  structurellement tous les canaux automatiques identifiés — voir « Le
  mécanisme établi » ci-dessus pour le raisonnement d'invariance.
- **`apiClient` du runtime storefront** : lu et vérifié stable
  (`StorefrontRuntimeBoundary.tsx`, `useMemo(..., [])`), non modifié —
  conforme au cadrage (« runtime boutique si `apiClient` s'y révèle
  instable », ce qui n'est pas le cas ici).
- **`openapi/` et `docs/api/CONVENTIONS.md`** : non touchés, réservés à
  l'agent `architecte`.
- **Aucun nouveau `data-testid`** : cette story ne touche à aucun rendu
  JSX, seulement à des hooks.
- **Aucun déploiement** : front seul, aucun appel Supabase modifié.

## Preuves d'échec sur le code d'avant (exécutées)

Avant d'écrire le correctif, les deux hooks ont été restaurés à leur contenu
d'avant ce commit (`git checkout -- <fichier>`, copie de sauvegarde du
correctif conservée à côté), et la suite de tests ciblée (déjà écrite avec
les nouveaux exports et la nouvelle garde d'architecture) a été rejouée :

```
pnpm vitest run tests/hooks/usePublicShopCatalog.test.ts \
  tests/hooks/useStorefrontSession.test.ts \
  tests/architecture/storefront-refresh-scheduling.test.ts
```

Résultat contre le code d'avant : **3 fichiers en échec, 16 tests en échec,
7 passés** (23 au total) :
- Les 6 tests de `tests/architecture/storefront-refresh-scheduling.test.ts`
  échouent (le code d'avant contient bien `setInterval` et
  `addEventListener('focus'`, et ne contient pas `visibilitychange`).
- 10 tests échouent par `TypeError: ... is not a function` ou
  `expected undefined to be ...` : les fonctions pures
  `shouldReloadPublicShopCatalogOnVisible` / `shouldRevalidateStorefrontSession`
  et leurs constantes n'existent pas encore dans le code d'avant.
- Les 2 tests « ancienne politique = 8 / 4 appels en 60 s » passent déjà
  (ils ne testent pas le hook, mais une reproduction fidèle et isolée de son
  minutage, à des fins de preuve) ; les tests `mapPublicShopCatalog` /
  `isMissingStorefrontSession` préexistants passent aussi (non concernés).

Les hooks ont ensuite été restaurés à leur contenu corrigé (comparaison de
diff vérifiée identique à l'état livré), et la suite rejouée passe
intégralement (23/23) — voir gates ci-dessous.

## Preuve (2) — chargement à 1 appel de chaque

Non disponible : le dépôt n'a aucun outil de rendu React
(`@testing-library/react` absent, `vitest.config.ts` en environnement
`node` sans DOM). Construire un tel outil pour cette seule story serait
créer un framework de test de composants, explicitement exclu par la
mission. **La preuve (2) est donc la recette navigateur (geste 1
ci-dessous.)**

## Gestes de recette navigateur (pour qa-review / recette humaine)

Compter **par point d'entrée** (session, sonde, catalogue), jamais un total,
dans l'onglet Réseau de Chrome DevTools, filtré sur `session/current`,
`shops/.../probe`, `shops/.../catalog` :

1. **Chargement** : ouvrir `/shop/<slug>` (session déjà expirée ou non,
   peu importe). Attendu : **1** `session/current`, **1** `probe`, **1**
   `catalog`.
2. **60 s au repos, onglet visible et actif, aucune action** : attendu
   **0** requête sur les trois entrées.
3. **Onglet masqué (autre onglet actif) puis ré-affiché après plus d'une
   minute** : attendu **1** `session/current`, **0** `catalog` (le seuil
   catalogue est de 10 min, pas 1 min).
4. **Onglet masqué puis ré-affiché après plus de 10 minutes** : attendu
   **1** `session/current` (si plus d'1 min s'est aussi écoulée), **1**
   `catalog`.
5. **Clics dans la page** (qui provoquent des `focus` de fenêtre) : attendu
   **0** requête sur les trois entrées — c'est le point qui referme
   directement le défaut mesuré le 2026-09-16.
6. **`retry`** (bouton de nouvelle tentative sur l'écran d'indisponibilité) :
   attendu exactement 1 nouveau cycle sonde + catalogue.
7. **Changement d'identité de session** (connexion/déconnexion storefront
   pendant que l'onglet reste ouvert sur la même boutique) : attendu un
   nouveau cycle sonde + catalogue.

Le geste 3 prouve aussi, en creux, qu'« une revalidation silencieuse de la
session ne relance pas le catalogue » : la session se revalide (1 appel)
sans qu'aucun catalogue ne suive.

## Tests exécutés et résultat

- `pnpm typecheck` — OK, aucune erreur (`tsc --noEmit -p tsconfig.modular.json`).
- `pnpm vitest run tests/hooks/usePublicShopCatalog.test.ts tests/hooks/useStorefrontSession.test.ts tests/architecture/storefront-refresh-scheduling.test.ts` — 3 fichiers, 23 tests, OK.
- `pnpm test:architecture` — 45 fichiers, 265 tests, OK.
- `pnpm test` (suite complète) — 293 fichiers passés, 11 skippés (dont
  `tests/storage/product_mockups_isolation.test.ts`, préexistant, lié à
  l'environnement local — seul échec toléré par la mission, ici skip et non
  échec), 2941 tests passés, 86 skips, OK.

## Round 2 — corrections qa-review round 1 (rejet ciblé)

La qa-review distincte a **rejeté** le commit `b8a12879` sur trois points :
un point **bloquant** (aucun 401 traité — régression), un point **moyen**
(D1, rechargement du catalogue sans limite hors statut `ready`), et des
**tests manquants** qui auraient laissé passer des mutations (M7b, M8, M9,
M10, M11, M12). Deux points en **dette non bloquante** étaient aussi
signalés (garde d'architecture élargie, D2 — annulation du rechargement
obsolète). Tout est traité dans ce round.

### 1. BLOQUANT — un 401 d'une action storefront déclenche désormais la revalidation

**Mécanisme retenu.** `FetchApiClient` ( `src/platform/api/fetch-api-client.ts`)
porte un pub/sub minimal :

- `onUnauthorized(listener): () => void` — abonnement, rend le
  désabonnement ;
- `parseResponse()` (devenu méthode privée, appelée par `request()`,
  `requestWithEtag()` et `requestForm()`) notifie tous les abonnés dès
  qu'une réponse non-`ok` a le statut `401`, **avant** de lancer
  `ApiClientError`.

C'est un ajout **rétrocompatible** (aucun paramètre requis, aucun abonné par
défaut) : les autres consommateurs de `FetchApiClient` (workspace, etc.) ne
sont pas affectés — vérifié par `pnpm test` complet, aucune régression.

**Pourquoi ce point précis, et pas un branchement dans chaque module
d'action.** Tous les hooks storefront d'action
(`useStorefrontOrderLifecycle`, `useStorefrontOrderList`,
`useStorefrontOrderEditor`, `useStorefrontOrderReceipt`,
`useStorefrontCredentialSetup`, `useStorefrontIdentityForm`,
`useStorefrontQuotesList`, `useStorefrontCategoryEditorial`, et
`usePublicShopCatalog`/`useStorefrontSession` eux-mêmes) obtiennent leur
client via `useStorefrontApi(SomeApiClient)`, qui les construit TOUS sur le
même `apiClient` du contexte (`useStorefrontUiRuntime()`,
`StorefrontRuntimeBoundary.tsx`, un seul `new FetchApiClient(...)` par
montage). S'abonner UNE FOIS, dans `useStorefrontSession`, à
`apiClient.onUnauthorized(...)` couvre donc structurellement toute action
storefront à venir, sans toucher à aucun des fichiers réservés à l'agent
parallèle (`orderCancellation.helpers.ts`, `orderValidation.helpers.ts`,
dialogues de commande, `useStorefrontOrderList`,
`useDashboardOrderManagement`, `ProductOverlay.tsx`) — vérifié : **aucun**
de ces fichiers n'apparaît dans le diff de ce round.

**Anti-boucle.** `createStorefrontUnauthorizedHandler(...)` (fonction pure,
`useStorefrontSession.ts`) se tait si `isCheckInFlight()` répond `true`. Le
hook fixe ce garde via `checkInFlightRef`, vrai pendant toute la durée d'un
`checkCurrent` — y compris son propre appel réseau. Séquence si la session
est réellement absente : (1) une action métier reçoit 401 → le handler
n'est pas en vol → il appelle `checkCurrent(false)` → `checkInFlightRef`
passe à `true` avant l'`await` ; (2) `api.current()` (dans ce
`checkCurrent`) reçoit LUI-MÊME un 401 → `FetchApiClient` notifie à nouveau,
de façon **synchrone**, à l'intérieur de cet `await` → le handler voit
`isCheckInFlight() === true` et se tait. Aucune boucle, exactement 1
`checkCurrent` déclenché par l'action. **Preuve exécutée** : en retirant
temporairement le garde `isCheckInFlight()`, le test « pas de boucle » ne
lève pas d'assertion — il **fait boucler le process Node en récursion de
micro-tâches jusqu'à épuisement CPU** (observé : ~110 % CPU, worker tué,
`pnpm vitest` rapporte l'exécution en échec). C'est la preuve la plus
directe qu'on puisse obtenir sans navigateur que le garde n'est pas
cosmétique. Remis en place, rejoué, vert.

### 2. D1 — le catalogue ne recharge plus au retour d'onglet hors statut `ready`

`shouldReloadPublicShopCatalogOnVisible` prend désormais un état
`{ status, lastLoadedAt }` au lieu du seul horodatage : `status !== 'ready'`
→ jamais de rechargement, quel que soit le temps écoulé (chargement en
cours, boutique privée sans session, échec, boutique introuvable — ces cas
se rejouent par `retry` ou par un changement d'identité, jamais par un
retour d'onglet). Un `status === 'ready'` sans `lastLoadedAt` connu (état
incohérent qui ne devrait pas se produire, `ready` et `lastLoadedAt` étant
posés ensemble) ne recharge pas non plus, par défense. Le hook lit le
statut courant via `stateRef` (synchronisé par un effet sur `[state]`, pas
par dépendance directe de l'écouteur `visibilitychange`, pour éviter une
resouscription à chaque rendu).

### 3. Tests manquants — traités

| Réf. | Ce que le test prouve | Où | Preuve d'échec exécutée |
|---|---|---|---|
| 401 bloquant | Un 401 d'une action quelconque déclenche exactement 1 revalidation ; un autre statut n'en déclenche aucune ; pas de boucle si la revalidation échoue elle-même en 401 | `tests/hooks/useStorefrontSession.test.ts` (3 `it` dédiés, intégration avec un vrai `FetchApiClient`) + `tests/platform/api/fetch-api-client.test.ts` (`onUnauthorized`, 4 `it`) | Test « pas de boucle » : guard `isCheckInFlight()` retiré → le process boucle en micro-tâches jusqu'à épuisement CPU (worker tué). Guard remis → vert. |
| D1 | Statut ≠ `ready` ne recharge jamais, même après 100 min | `tests/hooks/usePublicShopCatalog.test.ts` (`it.each` sur 4 statuts + cas `ready`/`lastLoadedAt: null`) | Signature changée : sans la garde de statut, les anciens tests (lastLoadedAt-only) auraient laissé passer un rechargement sur `authentication_required` — la nouvelle suite l'interdit explicitement. |
| M8 | L'écouteur `visibilitychange` du catalogue appelle réellement la politique, puis l'action, dans cet ordre | `tests/architecture/storefront-refresh-scheduling.test.ts` | Retrait de `if (!shouldReload) return;` → `guardIndex` vaut `-1` → `expect(guardIndex).toBeGreaterThan(-1)` échoue. Exécuté, vu rouge, remis, revu vert. |
| M7b | L'écouteur `visibilitychange` de la session appelle réellement la politique, puis `checkCurrent(false)` | idem | Voir M12 (même bloc source) — le remplacement de `checkCurrent(false)` par `checkCurrent(true)` fait échouer CE test ET M12 simultanément (2 échecs), preuve qu'ils couvrent le même câblage sous deux angles. |
| M9 | Un changement d'identité (`sessionShopId`) déclenche un cycle sonde + catalogue | `tests/architecture/storefront-catalog-access.test.ts` | `sessionShopId` retiré du tableau de dépendances de l'effet principal → `mainEffectMatch?.[1]` vaut `'api, attempt, sessionReady, slug'` ≠ attendu → échec. Exécuté, vu rouge, remis, revu vert. |
| M10 | `retry` (`attempt`) déclenche un cycle | idem (même assertion, même tableau) | Couvert par la même extraction exacte du tableau de dépendances — `attempt` en fait partie, un retrait serait détecté de la même façon (vérifié par lecture : le test compare la chaîne ENTIÈRE, pas une sous-chaîne). |
| M11 | L'effet PRINCIPAL garde son verrou `sessionReady`, ET ce sont bien SES dépendances qui sont vérifiées (pas celles de l'effet `visibilitychange`, qui partage le même garde littéral) | idem | L'extraction cible la PREMIÈRE occurrence du garde dans le fichier (l'effet principal apparaît en premier) et exige le tableau de dépendances complet, terme à terme — pas un `toContain` sur une sous-chaîne ambiguë comme dans le round 1. |
| M12 | La revalidation au retour d'onglet ne bascule jamais `loading` (pas de clignotement) | `tests/architecture/storefront-refresh-scheduling.test.ts` | `checkCurrent(false)` → `checkCurrent(true)` dans l'effet `visibilitychange` → 2 assertions échouent (présence de `checkCurrent(false)`, absence de `checkCurrent(true)`). Exécuté, vu rouge, remis, revu vert. |

**Dette non bloquante — traitée :**

- **Garde d'architecture élargie** : `tests/architecture/storefront-refresh-scheduling.test.ts`
  scanne désormais récursivement 8 racines de la surface boutique
  (`src/modules/shops/ui`, `src/modules/shop-customers/ui`,
  `src/modules/orders/ui`, `src/modules/catalog/ui/storefront`,
  `src/modules/account/ui/customer-portal`, `src/surfaces/customer-portal`,
  `src/app/surfaces`, `src/platform/runtime`) contre `setInterval` littéral,
  sa forme obfusquée `globalThis['set'+'Interval']`, `window.onfocus` et
  `addEventListener('focus', ...)`. **Non traité, resté en dette
  explicitement** : un `setTimeout` auto-réarmé (récursif) — aucun motif
  statique fiable ne le distingue d'un usage légitime (debounce) sans
  lecture humaine, comme permis par le mandat (« si c'est simple, sinon
  laisse-le en dette »).
- **D2 — rechargement obsolète du catalogue** : `generationRef` (compteur
  incrémenté à chaque lancement ET à chaque nettoyage de l'effet principal,
  y compris au démontage) capturé par la requête déclenchée au retour
  d'onglet ; si l'identité change avant que la réponse n'arrive, la réponse
  obsolète est jetée au lieu d'écraser le catalogue de la nouvelle identité.
  Remplace le précédent booléen `cancelled`, qui ne protégeait que contre un
  changement issu du MÊME effet, pas contre une réponse en vol issue de
  l'écouteur `visibilitychange` sous une identité déjà remplacée.

**Précision sur l'hypothèse Vite écartée** (remarque du coordinateur) :
pendant la mesure du 2026-09-16, Vite n'a enregistré AUCUN rechargement.
L'hypothèse d'un rechargement de dev-server comme origine de la cadence de
5 s est donc écartée pour CETTE mesure — la section « Ce qui n'est PAS
établi » plus haut ne s'appuyait de toute façon pas sur cette hypothèse
(elle cite l'outillage de recette / les `focus` en double, pas Vite). Le
comptage navigateur (gestes ci-dessus) tranchera ce qui reste incertain.

### Fichiers modifiés en plus (round 2)

- `src/platform/api/fetch-api-client.ts` — `onUnauthorized`/`notifyUnauthorized`
  (pub/sub 401), `parseResponse` devenu méthode privée.
- `src/platform/api/index.ts` — export du type `UnauthorizedListener`.
- `src/modules/shop-customers/ui/hooks/useStorefrontSession.ts` — lit
  `apiClient` via `useStorefrontUiRuntime()`, `checkInFlightRef`,
  `createStorefrontUnauthorizedHandler`, effet d'abonnement.
- `src/modules/shops/ui/hooks/usePublicShopCatalog.ts` — `stateRef`,
  `generationRef` (remplace `cancelled`), politique catalogue étendue au
  statut.
- `tests/platform/api/fetch-api-client.test.ts` — 4 `it` sur `onUnauthorized`.
- `tests/hooks/useStorefrontSession.test.ts` — `createStorefrontUnauthorizedHandler`
  (3 `it` purs) + câblage `FetchApiClient` réel (4 `it` d'intégration).
- `tests/hooks/usePublicShopCatalog.test.ts` — politique catalogue mise à
  jour (nouvelle signature `{ status, lastLoadedAt }`), `it.each` D1.
- `tests/architecture/storefront-catalog-access.test.ts` — extraction exacte
  du tableau de dépendances de l'effet principal (M9/M10/M11).
- `tests/architecture/storefront-refresh-scheduling.test.ts` — blocs M7b/M8/M12
  (câblage réel, pas seulement présence) + garde élargie (dette).

### Gates rejouées (round 2)

- `pnpm typecheck` — OK, aucune erreur.
- `pnpm vitest run tests/hooks/usePublicShopCatalog.test.ts tests/hooks/useStorefrontSession.test.ts tests/architecture/storefront-refresh-scheduling.test.ts tests/architecture/storefront-catalog-access.test.ts tests/platform/api/fetch-api-client.test.ts tests/components/shop/StorefrontDelegationBanner.test.ts` — 6 fichiers, 65 tests, OK.
- `pnpm test:architecture` — 45 fichiers, 278 tests, OK.
- `pnpm test` (suite complète) — 293 fichiers passés, 11 skippés (dont
  `tests/storage/product_mockups_isolation.test.ts`, préexistant/environnement
  local, seul écart toléré), 2969 tests passés, 86 skips, OK.
- `pnpm test:contract` — 23 fichiers, 432 tests, OK (vérifie l'absence de
  régression sur `FetchApiClient`, partagé avec le reste de l'API).
