---
id: BCP-6b
epic: E10 (hors E10, chantier boutique) — "chaine des prix Magrit -> panier et qualite d affichage"
status: round 3 (correction qa-review round 2, garde-fou anti-boucle preuve) — qa-review distincte requise avant merge
branch: worktree-agent-ad85f6c400202ba79 (worktree isole, depuis feat/gescom-e10-4-entite-client @ 57d909b5)
commit: (voir rapport de fin de story)
depends_on: []
parallelisable_avec: [] (aucun fichier commun avec BCP-7, BCP-8, BCP-9 — cf. cadrage)
---
# BCP-6b — Fin de la boucle de requêtes `session/current` + `catalog` de la boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [BCP-6b — Fin de la boucle d'appels session et catalogue](https://app.notion.com/p/3ddd0131973c8192adedd3721eb8562b) · extrait le 17/09/2026 · page modifiée le 16/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Terminé | Claude code | — | — | — |

### Description fonctionnelle (Notion)

Chantier boutique. Une page de boutique laissée ouverte déclenchait deux appels toutes les cinq secondes, dont le rechargement complet du catalogue. Mesuré en navigateur, non détecté par les tests.

**Livré** :

- plus aucun appel périodique : la boutique ne réagit qu'à un retour sur l'onglet, avec des délais ;
- une session expirée ramène l'écran de connexion au lieu de laisser l'en-tête afficher « connecté » indéfiniment ;
- garde contre l'emballement : une seule revalidation à la fois.

**Relecture adversariale** : deux rejets avant approbation. Le premier parce que la session expirée n'était pas traitée ; le second parce que la garde n'était prouvée par aucun test — un test qui « échouait » en saturant le processeur a été refusé comme preuve.

**Contrôle navigateur du 16/09** : zéro appel au repos sur deux minutes et demie, une seule revalidation quand la session expire, reproduit deux fois.

**Reste ouvert, non bloquant** : à la reconnexion, la liste des commandes est demandée quatre fois dont une annulée.

Détail : `story-BCP-6b.md`.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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

## Round 3 — correction qa-review round 2 (rejet ciblé sur un seul point bloquant)

La qa-review distincte a **validé** l'essentiel du round 2 (portée du
pub/sub, absence de boucle résiduelle par lecture du code, gates) et
**rejeté** `d04e2204` sur un seul point **bloquant** : le garde-fou
anti-boucle n'était prouvé par aucun test recevable.

### Le défaut exact (A1 et A2)

Le test d'intégration du round 2 (« pas de boucle si la revalidation
elle-même renvoie 401 ») maintenait sa PROPRE variable locale
`let checkInFlight = false` dans le corps du test, distincte du
`checkInFlightRef` réellement posé dans `useStorefrontSession.ts`. Deux
conséquences :

- **A2 — retirer `checkInFlightRef.current = true` du VRAI `checkCurrent`
  ne faisait échouer AUCUN test.** Le test exerçait sa propre copie du
  drapeau, jamais celle du hook : il ne prouvait donc rien sur le code de
  production. En cas de session réellement expirée, cette régression aurait
  fait boucler indéfiniment 401 → revalidation → 401 → ... en production.
- **A1 — retirer la garde du GESTIONNAIRE** (`createStorefrontUnauthorizedHandler`)
  ne faisait pas non plus échouer une assertion : elle bloquait le WORKER
  vitest en récursion synchrone de micro-tâches, que la qa a dû tuer après
  120 s malgré `--testTimeout=5000` (le délai ne peut pas se déclencher tant
  que la boucle de micro-tâches ne rend jamais la main à la boucle
  d'événements). Un test qui « échoue » en épuisant le CPU n'est pas une
  preuve — exactement le défaut relevé.

### Correctif : `createSessionChecker`, source unique du drapeau

`useStorefrontSession.ts` exporte désormais `createSessionChecker({ api })`,
une fabrique PURE (aucun React) qui encapsule l'appel réseau ET son drapeau
`isInFlight()` :

```ts
export interface SessionChecker {
  isInFlight(): boolean;
  check(): Promise<SessionCheckResult>; // 'resolved' | 'missing' | 'unavailable' — ne rejette jamais
}
```

Le hook crée **une seule instance** par montage (`checkerRef`, lazy-init via
ref — jamais recréée par un rendu), et **`checkCurrent` ET le gestionnaire
de 401 lisent tous deux CETTE MÊME instance** (`checkerRef.current!.check()`
/ `checkerRef.current!.isInFlight()`). Il n'existe donc plus deux copies du
drapeau susceptibles de diverger : le test peut désormais exercer le VRAI
mécanisme en instanciant `createSessionChecker` directement.

### Le test, borné pour échouer par assertion, jamais par délai ni CPU

Le nouveau test construit un vrai `FetchApiClient` dont le faux `fetch` est
**borné** (`createBoundedUnauthorizedFetch(5)`) : les 5 premières réponses
sont des 401, la 6ᵉ et les suivantes sont des 500 (qui ne notifient plus
rien). Si la garde manque (A1 ou A2), la chaîne 401 → revalidation → 401 →
... s'arrête donc d'elle-même après 5 tours au lieu de tourner à l'infini,
et l'assertion `expect(checkCalls).toBe(1)` échoue **proprement**, avec un
message lisible (`expected 5 to be 1`), jamais par timeout ni par
épuisement CPU.

**Vérifié par revert contrôlé, comme demandé, et chronométré :**

| Mutation | Ce qui casse | Résultat observé | Durée totale du fichier de test |
|---|---|---|---|
| A2 | Retrait de `inFlight = true;` dans `createSessionChecker.check()` | 4 tests échouent par assertion (`isInFlight()` reste `false` pendant l'appel ; `checkCalls` vaut 5 sur les deux tests d'intégration concernés) | **0,925 s** (`pnpm vitest run tests/hooks/useStorefrontSession.test.ts`, durée interne du fichier : 247 ms) |
| A1 | Retrait de `params.isCheckInFlight()` dans le corps de `createStorefrontUnauthorizedHandler` | 3 tests échouent par assertion (le test pur « anti-boucle » constate un appel au lieu de zéro ; `checkCalls` vaut 5 sur les deux tests d'intégration concernés) | **0,947 s** (durée interne du fichier : 282 ms), avec `--testTimeout=5000` — **aucun hang, aucun kill de worker nécessaire** |

Les deux mutations ont été **restaurées** ensuite (comparaison de diff
vérifiée identique à l'état livré), suite complète revérifiée verte.

### Non bloquant, traité : `withHeaders()` reprend les abonnés

`FetchApiClient.withHeaders()` copie désormais les abonnés
`onUnauthorized` existants sur l'instance dérivée (`derived.unauthorizedListeners`,
accessible en `private` au sein de la même classe). Un futur client
storefront qui passerait par `withHeaders()` ne perdrait plus silencieusement
sa revalidation sur 401. Test dédié dans
`tests/platform/api/fetch-api-client.test.ts` (« withHeaders() reprend les
abonnés onUnauthorized »).

### Mutations résiduelles acceptées (limite du choix (b1), pas de dépendance de rendu ajoutée)

Sur instruction explicite du coordinateur, **aucune dépendance de rendu
n'est ajoutée** (ce serait un arbitrage d'Arnaud). Les mutations suivantes
survivent donc à la suite automatisée et restent couvertes uniquement par
le comptage navigateur (gestes de recette ci-dessus) :

- **A5** — un désabonnement `onUnauthorized` perdu (ex. l'effet ne rend
  plus sa fonction de nettoyage) ;
- **D1c** — un statut forcé à `'ready'` au point d'appel plutôt que lu
  depuis l'état réel du hook ;
- **D2** — la vérification de génération (`generationRef`) non exercée au
  retour d'onglet (la réponse obsolète pourrait écraser un nouveau
  catalogue) ;
- les variantes « texte gardé, câblage retiré » de **M7b, M8, M9, M10 et
  M12** — un mutant qui garderait les chaînes attendues quelque part dans
  le fichier tout en cassant le branchement réel de l'effet React.

Ces cinq points partagent la même racine : ils portent sur le **rendu**
réel de l'effet React (montage, nettoyage, lecture de state), que seule une
exécution de composant peut observer. Le dépôt n'a pas cet outil
(`@testing-library/react` absent, environnement vitest `node` sans DOM) et
cette story n'en introduit pas.

### Fichiers modifiés en plus (round 3)

- `src/modules/shop-customers/ui/hooks/useStorefrontSession.ts` —
  `createSessionChecker` (nouvelle fabrique pure, `SessionChecker`,
  `SessionCheckResult`), `checkerRef` (remplace `checkInFlightRef`),
  `checkCurrent` réécrit pour déléguer à `checkerRef.current!.check()`.
- `src/platform/api/fetch-api-client.ts` — `withHeaders()` reprend les
  abonnés `onUnauthorized`.
- `tests/hooks/useStorefrontSession.test.ts` — describe `createSessionChecker`
  (5 `it` purs), describe « câblage » réécrit sur `createSessionChecker` +
  fetch borné (4 `it`, dont le test anti-boucle).
- `tests/platform/api/fetch-api-client.test.ts` — 1 `it` sur `withHeaders()`.
- `tests/components/shop/StorefrontDelegationBanner.test.ts` — assertion
  mise à jour (`await params.api.current()`, le code source ayant changé de
  place, même intention).
- `_bmad-output/implementation-artifacts/story-BCP-6b.md` — cette section.

### Gates rejouées (round 3)

- `pnpm typecheck` — OK, aucune erreur.
- `pnpm vitest run tests/hooks/useStorefrontSession.test.ts` — 21 tests, OK.
- `pnpm test:architecture` — 45 fichiers, 278 tests, OK.
- `pnpm test:contract` — 23 fichiers, 432 tests, OK.
- `pnpm test` (suite complète) — 293 fichiers passés, 11 skippés (dont
  `tests/storage/product_mockups_isolation.test.ts`, préexistant/environnement
  local, seul écart toléré), 2975 tests passés, 86 skips, OK.

## Contrôle navigateur du 2026-09-16 (après fusion des correctifs)

**Code contrôlé** : `0e54e804` — correctif post-recette BCP-5/6 (merge `24634582`, qa round 2 approuvée) et BCP-6b (merge `c165e751`, qa round 3 approuvée). Environnement local, Chrome, contextes isolés acheteuse et atelier. **0 rechargement Vite pendant le contrôle** (compteur à 47 au départ comme à l'arrivée), aucun agent n'écrivant dans le dépôt.

**Les deux correctifs sont confirmés en navigateur.**

- **Conflits de transition, dans les deux sens.** C1 (annulation côté acheteuse pendant que l'atelier valide) et C2 (validation côté atelier pendant que l'acheteuse annule) affichent le message français attendu. Aucun `transition_not_allowed`, `permission_denied` ni `order_not_found` visible à l'écran.
- **C6** : après le refus 409, **exactement une** relecture de la liste et **aucun** message de succès, des deux côtés. C'est le point que les mutations M4c et M4d laissaient sans test.
- **C4** : hauteur de ligne du sous-titre de la surcouche produit revenue à **18 px** (12 px de taille, `rgb(82, 82, 91)`, une seule occurrence, description accessible en place). La régression de BCP-6 (17,14 px) est corrigée.
- **Fin de la boucle session/catalogue** : 0 appel au repos sur 149 s, 0 sur `focus` seul, 0 à la navigation interne, 0 après un démontage-remontage. 1 appel de chaque au chargement, avec ou sans session.
- **Session expirée** : une seule revalidation, retour immédiat à l'écran de connexion, aucune rafale — reproduit deux fois, dont une par un vrai clic d'interface. C'est le geste qui couvre les contournements H1 et H4 que la qa n'a pas pu tuer par des tests.
- **Correction D1** : retour sur l'onglet après plus d'une minute, sans session — 1 revalidation, **0 catalogue**.

**Écarts relevés, aucun bloquant**

1. **Reconnexion** : la liste des commandes est appelée quatre fois, dont une requête annulée (`net::ERR_ABORTED`). La sonde et le catalogue restent uniques et la série s'arrête, mais la concurrence entre le point d'entrée et le rechargement d'identité reste à instruire.
2. **Parcours produit** : « Configurer et ajouter » navigue vers une page produit depuis l'accueil, alors que le même libellé ouvre la surcouche depuis le catalogue.
3. **Console** : uniquement des signalements mineurs et préexistants (champs de formulaire sans `id`/`name`, un `label for` mal formé). Aucun avertissement React, aucun `ref`, aucun « Missing Description ».

**Gestes non joués, avec leur raison** : R5 (retour après 10 min, couvert par le test à horloge simulée), R8 (ouverture en arrière-plan, non reproductible fidèlement), R10 (`retry` : une navigation interne ne rappelle pas le catalogue, et un chargement réseau coupé casse le document lui-même ; couvert par le test dédié), C5 (aucune entrée d'interface ne provoque un 403 ou un 404) et C7 (réseau coupé : exige une session). C5 et C7 sont couverts par la sonde de la qa round 2.

**Relevés hors lot, inchangés** (lots 7 et 8) : « ?×? mm », « Livraison : Siège social · Paris », budget factice « 8 420 € / 13 500 € ».

Procès-verbal détaillé, geste par geste avec les `reqid` : hors dépôt, dans le scratchpad de session (`recette-boutique/pv-controle-post-correctifs.md`).
