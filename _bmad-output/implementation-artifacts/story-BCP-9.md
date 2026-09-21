---
id: BCP-9
epic: E10 (hors E10, chantier boutique) — "chaine des prix Magrit -> panier et qualite d affichage"
status: round 2 (correction qa-review round 1 — debordement de cadrage), non affectee par le round 3 de BCP-6 — qa-review distincte requise avant merge
branch: worktree-agent-a5eb7f43d11a5f513 (worktree isole, depuis feat/gescom-e10-4-entite-client @ efc52207)
commit: 4f3d70cc (round 1), ef125da4 (round 2 — correction perimetre)
depends_on: [BCP-6 (meme fichier ShopLayout.tsx, ordre 6 -> 9 impose par le cadrage)]
parallelisable_avec: [BCP-5]
---
# BCP-9 — Libelle de l acheteur : aria-label "Mon compte (FullName)", elision corrigee

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [BCP-9 — Libellé du bouton de compte acheteur](https://app.notion.com/p/3ddd0131973c81e097bce8addf7488ed) · extrait le 17/09/2026 · page modifiée le 16/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P2 | XS | Terminé | Claude code | — | — | — |

### Description fonctionnelle (Notion)

Chantier boutique, lot 9. Le bouton de compte annonçait « Compte de acheteur ». Il dit désormais « Mon compte (Aline Petit) » pour un visiteur connecté, et « Compte boutique » sinon. Le texte affiché à l'écran reste inchangé.

**Relecture adversariale** : approuvée au round 2.

**Contrôle navigateur du 16/09** : conforme, dans les deux états.

Détail : `story-BCP-9.md`.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **5.5** :

> `ShopLayout.tsx:346` : `Compte de ${fullName}` devient **« Mon compte
> ({fullName}) »** avec une session. Sans session, « Compte boutique » est
> inchange. Le defaut d elision disparait pour **tout** nom commencant par
> une voyelle, pas seulement « acheteur ».

**Le cadrage ne vise QU UNE ligne : `ShopLayout.tsx:346`, l `aria-label`.**
Il ne dit rien du texte visible (`:355`). Round 1 avait, a tort, applique le
meme helper aux deux — corrige en round 2 (voir plus bas).

## Ce qui est livre (etat final, round 2)

| Element | Detail |
|---|---|
| `src/modules/shops/ui/storefront/ShopLayout.helpers.ts` | Helper pur `resolveAccountLabel(session)`. Pattern deja en place dans ce fichier (`resolveShopTheme`, `resolveCartLabel`, etc.) : logique extraite du JSX pour rester testable sans `@testing-library/react`. Contrat : (1) pas de session -> `"Compte boutique"` inchange ; (2) session avec `customer.fullName` non vide (apres trim) -> `` `Mon compte (${fullName.trim()})` `` ; (3) session presente mais `fullName` vide/blanc (cas defensif — `storefrontCustomerProfileSchema.fullName` impose `min(1)` cote contrat API, ce cas ne devrait pas se produire en pratique) -> repli sur `"Mon compte"` sans parenthese vide. Le champ lu est **exclusivement** `customer.fullName` — jamais `customer.email` ni `customer.id`. **Perimetre etroit, precise dans la docstring (round 2)** : ce helper alimente UNIQUEMENT l `aria-label`, jamais le texte visible. |
| `src/modules/shops/ui/storefront/ShopLayout.tsx` | Seul l `aria-label` (ligne ~346) du bouton compte utilise `resolveAccountLabel(storefrontSession)`. Le texte VISIBLE (le `<span>` a cote de l icone, ligne ~355) garde sa forme d origine, inchangee depuis `efc52207` : `storefrontSession?.customer.fullName ?? "Compte"`. Import de `resolveAccountLabel` ajoute a l import existant de `ShopLayout.helpers`. |

## Round 1 → round 2 : ce qui a change (correction qa-review)

**Debordement de cadrage signale par la qa-review distincte** : round 1
appliquait `resolveAccountLabel(storefrontSession)` **aussi** au texte
visible, ce qui changeait deux comportements hors perimetre :
- avec session, le bouton affichait « Mon compte (Camille Dupont) » au lieu
  de « Camille Dupont » (tronque par `max-w-36 truncate`, donc perte
  d information visible en plus) ;
- sans session, il affichait « Compte boutique » au lieu de « Compte ».

**Correction** : le texte visible est retabli exactement a sa forme
d origine (`git show efc52207:.../ShopLayout.tsx:355`). Seul l `aria-label`
passe par le helper — c est la seule ligne que le cadrage §8.25 5.5 vise.

**Correction terminologique du coordinateur** : le brief initial demandait
« Mon compte — {fullName} » (tiret) ; erreur signalee par le coordinateur,
le cadrage §8.25 5.5 fixe bien des **parentheses** — « Mon compte
({fullName}) ». Le texte livre en round 1 etait deja conforme aux
parentheses, donc **inchange** sur ce point.

## Pourquoi un helper, pas une correction inline

La decision vivait dans le JSX (une expression ternaire dans la prop
`aria-label`), donc non testable isolement — extraite en helper pur
conformement a la consigne de la mission (« si la decision vit dans le JSX,
extrais un helper pur »).

## Tests

- `tests/components/shop/ShopLayout.helpers.test.ts`, bloc `resolveAccountLabel` :
  - sans session -> `"Compte boutique"` (`null`/`undefined`) ;
  - avec session -> `"Mon compte (Camille Dupont)"` ;
  - nom commencant par une voyelle (`"Aline Petit"`, `"acheteur test"`) ->
    plus de faute d elision, le format ne construit plus de `"de"` ;
  - jamais d email ni d identifiant dans le libelle (assertion negative sur
    `@` et sur un UUID injecte dans le customer de test) ;
  - session presente mais `fullName` vide/blanc/`null` -> `"Mon compte"` sans
    parenthese vide, y compris quand `customer` lui-meme est `undefined` ;
  - trim defensif des espaces superflus.
- `tests/architecture/storefront-account-identity.test.ts` (round 2 —
  assertions renforcees suite au rejet qa-review) :
  - **B11** — asserte l `aria-label` **EXACTEMENT** via une regex sur l
    attribut JSX (`aria-label={resolveAccountLabel(storefrontSession)}`),
    pas un `toContain` de sous-chaine qui aurait pu passer grace au texte
    visible (c est precisement le defaut du round 1, signale par la
    qa-review) ;
  - **B12** — asserte que le texte visible garde sa forme d origine ET que
    `resolveAccountLabel(storefrontSession)` n apparait **qu une seule fois**
    dans le fichier (compte des occurrences) : une regression qui
    reutiliserait le helper pour le texte visible ferait remonter le compte
    a 2 et echouerait.

**Preuve d echec sur l ancien code (`efc52207`)** : les nouvelles assertions
du bloc `resolveAccountLabel` echouaient necessairement avant que le helper
n existe (fonction absente de `ShopLayout.helpers.ts` — erreur d import).
B11/B12 ont ete testees en conditions reelles de mutation (round 2, voir
tableau ci-dessous) : mutation appliquee localement, test lance, echec
constate, fichier restaure (aucune trace dans le diff final).

### Tableau mutation → test (round 2)

| Réf. | Mutation visée | Test qui la tue |
|---|---|---|
| B11 | Revenir a l ancien `aria-label` (`` `Compte de ${fullName}` : "Compte boutique"` ``) tout en gardant `resolveAccountLabel` ailleurs dans le fichier | `storefront-account-identity.test.ts` — regex exacte sur l attribut `aria-label` (testee : echoue quand l ancien format est reintroduit) |
| B12 | Reutiliser `resolveAccountLabel(storefrontSession)` pour le texte visible (debordement de cadrage, le bug du round 1) | `storefront-account-identity.test.ts` — `match(...).toHaveLength(1)` (testee : echoue des que le helper apparait une 2e fois) |

## Gestes de recette navigateur (pour qa-review / recette humaine)

1. Se connecter a une boutique publique avec un compte client dont le prenom
   commence par une voyelle (ex. "Aline", "Elodie", "Ines").
2. Observer le bouton compte dans le header : le texte VISIBLE reste
   simplement le prenom (`"Aline Petit"`), inchange par rapport a avant —
   ce n est pas dans le perimetre de ce lot.
3. Inspecter l attribut `aria-label` du bouton (DevTools ou lecteur d ecran) :
   doit lire `"Mon compte (Aline Petit)"`, jamais `"Compte de Aline
   Petit"` (faute d elision de l ancien format).
4. Se deconnecter (pas de session) : le texte visible redevient `"Compte"`,
   l `aria-label` redevient `"Compte boutique"` — les deux inchanges par
   rapport a avant.

## Gates executees

### Round 1 (commit 4f3d70cc)
- `pnpm typecheck` — OK, aucune erreur.
- `pnpm exec vitest run tests/components/shop/ShopLayout.helpers.test.ts
  tests/architecture` — 43 fichiers, 256 tests, OK.
- `pnpm test` (suite complete) — 285 fichiers, 2853 tests passes, 86 skips
  preexistants, OK.
- `pnpm test:contract` — 23 fichiers, 432 tests, OK.

### Round 2 (commit ef125da4, correction perimetre)
- `pnpm typecheck` — OK, aucune erreur.
- `pnpm exec vitest run tests/components/shop tests/architecture` — 67
  fichiers, 607 tests, OK.
- `pnpm test:architecture` — 43 fichiers, 251 tests, OK.
- `pnpm test` (suite complete) — 286 fichiers, 2897 tests passes, 86 skips
  preexistants, OK.
- `pnpm test:contract` — 23 fichiers, 432 tests, OK.

### Round 3 de BCP-6 (commit 8d4348ee) — aucun fichier BCP-9 touche
Le round 3 ne corrige que `tests/architecture/storefront-dialog-description*`
(garde AST, BCP-6). Aucun fichier de BCP-9 (`ShopLayout.tsx` pour l
aria-label, `ShopLayout.helpers.ts`, `storefront-account-identity.test.ts`,
`ShopLayout.helpers.test.ts`) n a ete modifie. B11/B12 restent verts :
`pnpm test:architecture` (round 3) — 257 tests, dont les 6 de
`storefront-account-identity.test.ts` (B11, B12 compris).

## Ce qui n est PAS dans le perimetre

- **BCP-5** (libelles de statut) — aucun fichier commun : `PortalThankYou.tsx`,
  `PortalCart.tsx`, `orderStatus.ts`, `ResumeBanner.tsx` et les tables de
  statut n ont pas ete touches.
- **Clariprint** — aucun fichier touche.
- **`openapi/` et `docs/api/CONVENTIONS.md`** — non touches, reserves a l
  agent `architecte`.
- **Le texte visible du bouton compte** — hors perimetre du cadrage §8.25
  5.5, retabli a sa forme d origine en round 2.
- **Aucun nouveau `data-testid`** — le bouton compte avait deja
  `TEST_IDS.shop.headerUserMenu` sur son conteneur ; rien de nouveau requis.
- **Aucune interrogation Supabase directe** — le libelle ne fait qu afficher
  un champ deja present dans `StorefrontSession` (passe en props), aucun
  appel reseau ajoute.
- **Aucun deploiement** — front seul (§6 du cadrage).

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
