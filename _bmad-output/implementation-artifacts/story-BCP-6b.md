---
id: BCP-6b
epic: E10 (hors E10, chantier boutique) — "chaine des prix Magrit -> panier et qualite d affichage"
status: livre, qa-review distincte requise avant merge
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
| Session au repos | Revalidée toutes les 15 s, et à chaque `focus` | Aucun intervalle. Revalidation au retour au premier plan, au plus 1×/min, et sur un 401 (porte d'entrée exposée, câblage des appelants hors périmètre — voir « hors périmètre ») |
| Bascules de `sessionLoading` | Relançaient sonde et catalogue | Le catalogue ne dépend plus que de la PREMIÈRE résolution de session (`sessionReady`, latch qui ne redevient jamais `false`) ; une revalidation ultérieure de session, même bloquante, ne relance plus le catalogue |

## Ce qui est livré

| Fichier | Détail |
|---|---|
| `src/modules/shops/ui/hooks/usePublicShopCatalog.ts` | Retrait du `focus` + `setInterval`. Nouvelle politique pure exportée `shouldReloadPublicShopCatalogOnVisible(event, lastLoadedAt)` + constante `PUBLIC_SHOP_CATALOG_REFRESH_MIN_INTERVAL_MS` (10 min). Nouveau state `sessionReady` : bascule UNE FOIS de `false` à `true` à la première résolution de session (`sessionLoading` → `false`), ne redevient jamais `false` — l'effet de chargement dépend désormais de `sessionReady` (pas de `sessionLoading`), donc une revalidation de session ultérieure ne relance plus le catalogue. Un second effet, monté une fois `sessionReady`, écoute `visibilitychange` et ne recharge QUE le catalogue (pas la sonde), via la politique pure, avec un `lastLoadedAtRef` mis à jour à chaque chargement réussi. |
| `src/modules/shop-customers/ui/hooks/useStorefrontSession.ts` | Retrait du `focus` + `setInterval`. Nouvelle politique pure exportée `shouldRevalidateStorefrontSession(event, lastRevalidatedAt)` + constante `STOREFRONT_SESSION_REVALIDATION_MIN_INTERVAL_MS` (1 min). Effet `visibilitychange` unique, revalidation SILENCIEUSE (`checkCurrent(false)`, ne touche jamais `loading`). Nouvelle fonction retournée `notifyUnauthorized()` : porte d'entrée pour qu'une action storefront, ailleurs dans le code, signale un 401 et déclenche une revalidation immédiate (la politique pure retourne toujours `true` pour `type: 'unauthorized'`, sans throttle). |
| `tests/hooks/usePublicShopCatalog.test.ts` | Tests de la politique pure (focus neutre, seuil 10 min, limite exacte, premier retour sans historique) + preuve à horloge simulée (`vi.useFakeTimers`) : ancienne politique = 8 appels/60 s (2 canaux), nouvelle = 0. |
| `tests/hooks/useStorefrontSession.test.ts` | Même structure pour la politique de session (seuil 1 min) + preuve à horloge simulée : ancien canal = 4 appels/60 s, nouveau = 0. |
| `tests/architecture/storefront-refresh-scheduling.test.ts` (nouveau) | Garde de non-régression : lecture directe du source des deux hooks, interdit tout `setInterval` et tout `addEventListener('focus'`, exige `addEventListener('visibilitychange'`. |
| `tests/architecture/storefront-catalog-access.test.ts` | Assertion mise à jour : vérifie désormais le latch `sessionReady` (`if (!sessionLoading) setSessionReady(true)` + `if (!slug || !sessionReady) return`) au lieu de l'ancien `if (!slug || sessionLoading) return`. Même intention (attendre la résolution storefront avant de charger un catalogue privé), rendue plus précise par cette story. |
| `tests/components/shop/StorefrontDelegationBanner.test.ts` | Assertion mise à jour : vérifie `document.addEventListener('visibilitychange'` et l'absence de tout `addEventListener('focus'` dans `useStorefrontSession.ts`, au lieu de l'ancienne assertion littérale sur `focus`. |

## Ce qui n'est pas dans le périmètre (hors dérogation R5, limites de mission)

- **Câblage de `notifyUnauthorized()` aux points d'appel réels** (checkout,
  soumission de commande, etc.) : la cible « un 401 déclenche la
  revalidation » est livrée comme **capacité exposée par le hook**, testée en
  isolation (pure function), mais son branchement aux actions storefront
  toucherait `orderCancellation.helpers.ts`, `orderValidation.helpers.ts`,
  les dialogues de commande et potentiellement `ProductOverlay.tsx` — tous
  explicitement réservés à l'agent qui les corrige en parallèle. **Chemin de
  mise en conformité** : une story de suivi (ou le lot qui possède ces
  fichiers) appelle `notifyUnauthorized()` depuis son propre gestionnaire de
  401, sans toucher aux deux hooks de cette story.
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
