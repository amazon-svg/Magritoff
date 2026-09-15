---
id: BCP-9
epic: E10 (hors E10, chantier boutique) — "chaine des prix Magrit -> panier et qualite d affichage"
status: done (implementation dev-story) — qa-review distincte requise avant merge
branch: worktree-agent-a5eb7f43d11a5f513 (worktree isole, depuis feat/gescom-e10-4-entite-client @ efc52207)
commit: 4f3d70cc
depends_on: [BCP-6 (meme fichier ShopLayout.tsx, ordre 6 -> 9 impose par le cadrage)]
parallelisable_avec: [BCP-5]
---
# BCP-9 — Libelle de l acheteur : "Mon compte (FullName)", elision corrigee pour tout nom

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **5.5** :

> `ShopLayout.tsx:346` : `Compte de ${fullName}` devient **« Mon compte
> ({fullName}) »** avec une session. Sans session, « Compte boutique » est
> inchange. Le defaut d elision disparait pour **tout** nom commencant par
> une voyelle, pas seulement « acheteur ».

## Ce qui est livre

| Element | Detail |
|---|---|
| `src/modules/shops/ui/storefront/ShopLayout.helpers.ts` | Nouveau helper pur `resolveAccountLabel(session)`. Pattern deja en place dans ce fichier (`resolveShopTheme`, `resolveCartLabel`, etc.) : logique extraite du JSX pour rester testable sans `@testing-library/react`. Contrat : (1) pas de session -> `"Compte boutique"` inchange ; (2) session avec `customer.fullName` non vide (apres trim) -> `` `Mon compte (${fullName.trim()})` `` ; (3) session presente mais `fullName` vide/blanc (cas defensif — `storefrontCustomerProfileSchema.fullName` impose `min(1)` cote contrat API, donc ce cas ne devrait pas se produire en pratique, mais le helper reste sur) -> repli sur `"Mon compte"` sans parenthese vide. Le champ lu est **exclusivement** `customer.fullName` — jamais `customer.email` ni `customer.id`, conformement a l exigence « ne doit afficher ni l e-mail ni un identifiant ». |
| `src/modules/shops/ui/storefront/ShopLayout.tsx` | `aria-label` (ligne ~346) et le texte visible du bouton compte (ligne ~355) utilisent desormais tous deux `resolveAccountLabel(storefrontSession)`, au lieu de deux formulations divergentes (`` `Compte de ${fullName}` `` pour l aria-label, `fullName ?? "Compte"` pour le texte visible — qui ne partageaient meme pas le meme fallback). Import de `resolveAccountLabel` ajoute a l import existant de `ShopLayout.helpers`. |

## Pourquoi un helper, pas une correction inline

La decision vivait dans le JSX (deux expressions ternaires differentes,
directement dans les props `aria-label` et le contenu du `<span>`), donc
non testable isolement — extraite en helper pur conformement a la consigne
de la mission (« si la decision vit dans le JSX, extrais un helper pur »).

## Tests

- `tests/components/shop/ShopLayout.helpers.test.ts` (etendu), nouveau bloc
  `resolveAccountLabel` :
  - sans session -> `"Compte boutique"` (`null`/`undefined`) ;
  - avec session -> `"Mon compte (Camille Dupont)"` ;
  - nom commencant par une voyelle (`"Aline Petit"`, `"acheteur test"`) ->
    plus de faute d elision, le format ne construit plus de `"de"` ;
  - jamais d email ni d identifiant dans le libelle (assertion negative sur
    `@` et sur un UUID injecte dans le customer de test) ;
  - session presente mais `fullName` vide/blanc/`null` -> `"Mon compte"` sans
    parenthese vide, y compris quand `customer` lui-meme est `undefined` ;
  - trim defensif des espaces superflus.
- `tests/architecture/storefront-account-identity.test.ts` (mis a jour) :
  l assertion litterale sur `storefrontSession?.customer.fullName` dans le
  JSX (qui a disparu, remplacee par l appel au helper) est remplacee par une
  assertion sur `resolveAccountLabel(storefrontSession)` dans `ShopLayout.tsx`
  et sur `session.customer?.fullName` dans `ShopLayout.helpers.ts` — le test
  continue de garantir que l identite affichee vient de `customer.fullName`
  et non d un menu Magrit (`AuthMenu`, toujours absent).

**Preuve d echec sur l ancien code** : avant le correctif, l ancien libelle
etait `` `Compte de ${fullName}` ``, ce qui pour un nom comme "Aline Petit"
produisait `"Compte de Aline Petit"` (faute d elision) au lieu de
`"Mon compte (Aline Petit)"`. Les nouvelles assertions du test
`resolveAccountLabel` echouaient necessairement avant que le helper
n existe (fonction absente de `ShopLayout.helpers.ts` au commit parent
`efc52207` — `pnpm exec vitest run` aurait echoue avec une erreur d import).
De meme, `tests/architecture/storefront-account-identity.test.ts` echouait
tel quel contre l ancien JSX puisque la chaine litterale attendue par
l ancienne assertion (`resolveAccountLabel(storefrontSession)`) n existait
pas encore dans `ShopLayout.tsx` avant ce commit.

## Gestes de recette navigateur (pour qa-review / recette humaine)

1. Se connecter a une boutique publique avec un compte client dont le prenom
   commence par une voyelle (ex. "Aline", "Elodie", "Ines").
2. Observer le bouton compte dans le header : le texte visible doit afficher
   `"Mon compte (Aline ...)"`, jamais `"Compte de Aline ..."`.
3. Inspecter l attribut `aria-label` du bouton (DevTools ou lecteur d ecran) :
   meme libelle que le texte visible, memes garanties (pas d email, pas d
   identifiant technique visible dans le nom lu).
4. Se deconnecter (pas de session) : le bouton doit revenir a
   `"Compte boutique"`, inchange par rapport au comportement actuel.

## Gates executees

- `pnpm typecheck` — OK, aucune erreur.
- `pnpm exec vitest run tests/components/shop/ShopLayout.helpers.test.ts
  tests/architecture` — 43 fichiers, 256 tests, OK.
- `pnpm test` (suite complete) — 285 fichiers, 2853 tests passes, 86 skips
  preexistants, OK.
- `pnpm test:contract` — 23 fichiers, 432 tests, OK.

## Ce qui n est PAS dans le perimetre

- **BCP-5** (libelles de statut) — aucun fichier commun : `PortalThankYou.tsx`,
  `PortalCart.tsx`, `orderStatus.ts`, `ResumeBanner.tsx` et les tables de
  statut n ont pas ete touches.
- **Clariprint** — aucun fichier touche.
- **`openapi/` et `docs/api/CONVENTIONS.md`** — non touches, reserves a l
  agent `architecte`.
- **Aucun nouveau `data-testid`** — le bouton compte avait deja
  `TEST_IDS.shop.headerUserMenu` sur son conteneur ; rien de nouveau requis.
- **Aucune interrogation Supabase directe** — le libelle ne fait qu afficher
  un champ deja present dans `StorefrontSession` (passe en props), aucun
  appel reseau ajoute.
- **Aucun deploiement** — front seul (§6 du cadrage).
