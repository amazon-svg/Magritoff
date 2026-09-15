---
id: BCP-6
epic: E10 (hors E10, chantier boutique) — "chaine des prix Magrit -> panier et qualite d affichage"
status: done (implementation dev-story) — qa-review distincte requise avant merge
branch: worktree-agent-a5eb7f43d11a5f513 (worktree isole, depuis feat/gescom-e10-4-entite-client @ efc52207)
commit: 6377ab04
depends_on: []
parallelisable_avec: [BCP-5, BCP-9 (meme fichier ShopLayout.tsx, ordre 6 -> 9 impose)]
---
# BCP-6 — Console propre : forwardRef sur la famille des wrappers Radix, description du tiroir panier

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **5.2** (lots 5 a 9,
libelles exacts) et le decoupage §6 (BCP-6, fichiers possedes : `src/shared/ui/`,
`ShopLayout.tsx` pour la description).

Le smoke E2E du 15/09 relevait deux avertissements React a l ouverture du
panier boutique :
- `SheetOverlay` sans `forwardRef` (`src/shared/ui/sheet.tsx:31-45` a l epoque,
  chemin `src/components/ui/sheet.tsx` dans le smoke — deplace depuis) ;
- un `Content` Radix (le meme `@radix-ui/react-dialog` que Sheet enveloppe)
  sans `Description` — avertissement d accessibilite Radix.

## Ce qui est livre

| Element | Detail |
|---|---|
| `src/shared/ui/sheet.tsx` | `SheetTrigger`, `SheetClose`, `SheetOverlay`, `SheetContent`, `SheetTitle`, `SheetDescription` passent en `React.forwardRef`, exactement l idiome deja en place dans `dialog.tsx`/`alert-dialog.tsx` (memes noms de types `React.ElementRef`/`React.ComponentPropsWithoutRef`, `ref={ref}` transmis au primitif Radix, `displayName` conserve pour React DevTools). Sheet enveloppe le meme paquet Radix (`@radix-ui/react-dialog`) que Dialog — c est la meme famille de bug, corrigee de la meme facon. |
| `src/shared/ui/accordion.tsx`, `context-menu.tsx`, `dropdown-menu.tsx`, `hover-card.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `popover.tsx`, `select.tsx`, `tabs.tsx`, `tooltip.tsx` | Chaque wrapper de type `*Content`/`*SubContent` (le seul point d enveloppement d un `Content` Radix dans ces fichiers — pas de `Overlay` hors Dialog/Sheet) passe en `React.forwardRef`, meme idiome. C est la lecture retenue de « la famille » (CONVENTIONS §8.25 5.2, « un critere, pas une ligne ») : tout composant de `src/shared/ui/` qui enveloppe un `Overlay` ou un `Content` Radix de la meme facon que `SheetOverlay` — c est a dire une fonction simple sans transmission de ref — recoit desormais un `forwardRef`. `drawer.tsx` (paquet `vaul`, pas `@radix-ui`, et sans aucun importeur dans le depot — verifie) est laisse hors perimetre : ce n est pas un wrapper Radix, et le critere du cadrage nomme explicitement « Radix ». |
| `src/modules/shops/ui/storefront/ShopLayout.tsx` | Ajout d une `SheetDescription` visuellement masquee (`className="sr-only"`, idiome deja utilise par le bouton de fermeture du meme fichier `sheet.tsx`) dans l en-tete du tiroir panier, texte exact impose par le contrat : « Articles de votre panier et total de la commande. ». Import de `SheetDescription` ajoute a l import existant de `@/shared/ui/sheet`. |

## Ce qui n a pas ete fait, et pourquoi

- **Mesure de la paire `session/current` + `catalog`** (point 5.2, 3e puce du
  cadrage) : le cadrage la classe explicitement « a mesurer, pas a corriger
  d office », sur 60 s d inactivite catalogue, **sans aucun agent qui ecrive**.
  Cet agent tourne dans un worktree isole sans navigateur ni serveur Vite
  (regle de la mission) : la mesure ne peut pas etre faite ici. Elle reste
  ouverte pour la recette humaine ou un futur agent avec navigateur dedie.
- **MCP `context7`** : non disponible dans cet environnement d agent (absent
  de la liste d outils fournie). Conformement a la consigne du cadrage, ceci
  est signale explicitement plutot que tu par le silence : l alignement s est
  fait strictement sur l idiome deja present dans le depot (`dialog.tsx`,
  `alert-dialog.tsx`), pas sur une affirmation de memoire concernant React ou
  Radix.

## Tests

- `tests/architecture/radix-ref-forwarding.test.ts` (etendu) :
  - un test dedie verifie **en detail** `sheet.tsx` (les 6 wrappers, les deux
    `ref={ref}` sur `SheetPrimitive.Overlay` et `SheetPrimitive.Content`) ;
  - une table `it.each` verifie, pour chacun des 10 autres fichiers touches,
    que le wrapper `*Content`/`*SubContent` concerne est bien un
    `React.forwardRef` avec son `displayName`.
- **Preuve d echec sur l ancien code** : verifie via `git show HEAD:<fichier>
  | grep -c "React.forwardRef"` sur `sheet.tsx`, `tabs.tsx`, `select.tsx`
  avant le correctif — 0 occurrence dans chacun, donc les nouvelles
  assertions du test etendu echouaient necessairement contre le commit
  parent (`efc52207`).
- Aucun test de rendu React ajoute : le depot n a pas d infrastructure de
  test de composant (`@testing-library/react` absent), signale plutot que
  contourne.

## Gestes de recette navigateur (pour qa-review / recette humaine)

1. Ouvrir une boutique publique (`/shop/:slug`), ouvrir la console navigateur.
2. Cliquer sur l icone panier pour ouvrir le tiroir (`Sheet`).
3. Verifier dans la console : **aucun** avertissement « Function components
   cannot be given refs » ni « Missing Description for DialogContent ».
4. Verifier a l inspecteur d accessibilite (ou lecteur d ecran) que le tiroir
   panier est annonce avec la description « Articles de votre panier et
   total de la commande. » (elle est visuellement masquee mais presente dans
   le DOM, `class="sr-only"`, associee par `aria-describedby` automatique de
   Radix `Dialog.Description`).
5. Ouvrir/fermer plusieurs fois le tiroir : aucune regression visuelle ni de
   focus (le comportement de fermeture/ouverture est inchange, seule la
   transmission de ref a ete ajoutee).

## Gates executees

- `pnpm typecheck` — OK, aucune erreur.
- `pnpm exec vitest run tests/architecture/radix-ref-forwarding.test.ts
  tests/components/shop/ShopLayout.helpers.test.ts` — 60 tests, OK.
- `pnpm test:architecture` — 42 fichiers, 207 tests, OK (avant le commit
  BCP-9 qui suit dans la meme session).
- `pnpm test` (suite complete, apres les deux commits BCP-6 + BCP-9) — 285
  fichiers, 2853 tests passes, 86 skips preexistants, OK.
- `pnpm test:contract` — 23 fichiers, 432 tests, OK.

## Ce qui n est PAS dans le perimetre

- **BCP-5** (libelles de statut) — aucun fichier commun : `PortalThankYou.tsx`,
  `PortalCart.tsx`, `orderStatus.ts`, `ResumeBanner.tsx` et les tables de
  statut n ont pas ete touches.
- **Clariprint** — aucun fichier de `src/adapters/clariprint/`,
  `src/modules/clariprint/` touche.
- **`openapi/` et `docs/api/CONVENTIONS.md`** — non touches, reserves a l
  agent `architecte`.
- **Aucun nouveau `data-testid`** — le tiroir panier avait deja
  `TEST_IDS.shop.cartDrawer` ; la `SheetDescription` ajoutee n en necessitait
  pas de nouveau (aucun Hint DOM du cadrage ne le demande).
- **Aucun deploiement** — front seul, pas de Supabase concerne par ce lot
  (§6 du cadrage : « tous les autres lots : front seul, aucun deploiement
  Supabase »).
