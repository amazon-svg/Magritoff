# Story BCP-11 — la règle du paquet, un seul domicile typé

> Numéro provisoire (aucun accès Notion pendant cette session, cf. cadrage
> `docs/api/CONVENTIONS.md` §8.25 point 3.6). Cadrage architecte : commit
> `bcd8424b`, branche `feat/gescom-e10-4-entite-client`.
>
> Travail réalisé en worktree isolé `.claude/worktrees/bcp-11`, branche
> `feat/bcp-11-regle-du-paquet` (créée depuis `feat/gescom-e10-4-entite-client`
> à `bcd8424b`). Rien n'a été poussé ; la remontée est décidée par le
> coordinateur.

## Ce que ce lot ferme

Le prix d'un produit configuré (Clariprint) est **forfaitaire** pour N
exemplaires (35 € pour 500 ex.). `lineTotalHt = resolution.priceHT * line.qty`
(`cartPricing.ts:27`) multiplie ce forfait par `line.qty` : si un jour un
appelant fait transiter un nombre d'exemplaires là où un nombre de paquets est
attendu, le panier affiche 17 500 € au lieu de 35 €. Avant ce lot, la règle
« qty = exemplaires, on ajoute 1 PAQUET » vivait en **trois copies littérales**
non protégées par le compilateur (PortalCatalog.tsx et PortalProduct.tsx,
fermées par BCP-10 ; GammePage.tsx, une troisième copie que BCP-10 n'avait pas
détectée — le commentaire de `PublicShop.tsx:207-214` affirmant qu'elle « ne
vit plus qu'ici » était donc faux).

BCP-11 lui donne un domicile unique et typé (`src/modules/orders/ui/storefront/cartLine.ts`)
et ferme les quatre portes qui peuvent faire transiter un nombre vers le
panier, la quatrième (`rebuildCartFromOrderItems`, qui ne passe pas par
`addToCart`) comprise.

## Critères d'acceptation — un par un

Le cadrage architecte (point 3.6) ne numérote pas de CA au sens Notion
classique ; je reprends les points (a) à (i) comme grille de vérification,
chacun étant soit une décision déjà tranchée (exécutée telle quelle), soit une
exigence vérifiable.

1. **(a) Le commentaire menteur de `PublicShop.tsx:207-214` est corrigé** —
   FAIT. Il ne prétend plus que la règle « ne vit que là » ; il dit
   maintenant où elle vit réellement (`cartLine.ts`) et pourquoi l'ancien
   commentaire était faux (troisième copie non détectée par BCP-10).
   Corrigé **dans le même commit** que le reste (aucun commit poussé — voir
   note en tête — mais dans le même lot de travail, prêt à committer d'un
   bloc).
2. **(b)/(d) Les quatre portes sont fermées, la quatrième comprise** — FAIT.
   - Porte 1 (surcouche, `handleOverlayConfirm`) : passe par `toPackLine`.
   - Porte 2 (`PortalCatalog` → `ShopProductCard`) : canal quantité retiré du
     type (`onAddToCart: (product: ShopProduct) => void`), les deux call
     sites de `ShopProductCard` (`:331`, `:369`) ne passent plus de `1`
     littéral car il n'y a plus de second paramètre.
   - Porte 3 (`GammePage`) : troisième copie remplacée par
     `toPackLine(result.productConfigured, copies(result.qty))` ; canal
     quantité retiré du type et de la grille de cartes liées.
   - Porte 4 (`rebuildCartFromOrderItems`) : **ne passe pas par `addToCart`**,
     fermée séparément — voir point 5.
3. **(c) Domicile unique : `src/modules/orders/ui/storefront/cartLine.ts`** —
   FAIT, conforme (module `orders`, `ui/storefront/`, à côté de
   `cartPricing.ts` et `orderRenewal.helpers.ts`).
4. **(d) Discipline : deux types nominaux + un seul constructeur de ligne
   configurée, canal retiré ailleurs** — FAIT.
   - `CopyCount` et `PackCount` : `number & { readonly __unit: 'copies' | 'packs' }`
     respectivement, constructeurs `copies()`, `packs()`, `ONE_PACK`.
   - `toPackLine(productConfigured, quantity: CopyCount): CartLine` est
     l'unique fonction qui écrit `config.quantity` pour un produit configuré.
   - **Extension non prescrite littéralement par le cadrage, documentée ici
     pour transparence** : j'ai ajouté un second constructeur,
     `packLine(product, packCount: PackCount = ONE_PACK): CartLine`, pour que
     `PublicShop.addToCart` et la branche non-configurée de
     `rebuildCartFromOrderItems` n'aient elles non plus jamais à écrire
     `{ product, qty }` en littéral. Sans ce second constructeur, le test
     d'architecture M7 (point 8 ci-dessous) aurait un angle mort évident :
     n'importe quel autre fichier aurait pu construire une `CartLine` brute
     sans passer par `cartLine.ts`. `toPackLine` l'utilise en interne.
     Dérogation R5 : aucune (nouvelle fonction dans un fichier que je possède
     déjà, pas de nouveau module, pas de nouvelle convention de dossier).
5. **(e) Tests T1 à T10 et mutations M1 à M7 — voir section dédiée
   ci-dessous.**
6. **(f) Ce que le lot ne fait pas** — RESPECTÉ.
   - `cartPricing.ts:27` n'est pas modifié (`git diff` vide sur ce fichier).
   - Aucune règle nouvelle : S-FIX-PANIER-11/05 reste ce qu'elle était.
   - Aucun calcul de prix, aucune marge, aucun arrondi — hors périmètre
     `PricingEngine`.
   - `DEFAULT_OPTIONS`/normaliseur non touchés.
   - Famille `cartPricing`/`orderRenewal` non déplacée vers `application/`
     (dette nommée par l'architecte, pas ce lot).
   - `openapi/magrit-core.v1.yaml` non touché.
   - Aucun bouton conditionné (Q14, point 3.7 — explicitement hors mandat).
7. **(g) Conflits de fichiers** — RESPECTÉS. Seuls les fichiers listés au
   tableau (g) ont été touchés, dans les blocs autorisés :
   `cartLine.ts` (neuf), `orderRenewal.helpers.ts` (construction des lignes),
   `GammePage.tsx` (`:42`-équiv., `:148-161`-équiv., grille de cartes),
   `PortalHome.tsx` (`onReorder` → `onAddToCart`), `PublicShop.tsx` (blocs
   listés, disjoints du bloc budget BCP-8), `PortalCatalog.tsx` (type de la
   prop seule), `ShopProductCard.tsx` (type + 2 call sites, aucun rendu,
   aucun prix — pas le bouton `:355-366` visé par le point 3.7).
   **`useProductConfigurator.ts` non touché** (frontière BCP-2 respectée : le
   marquage `copies(result.qty)` se fait côté consommateur, dans
   `PublicShop.tsx` et `GammePage.tsx`).
8. **(h) `openapi/` non touché** — CONFORME, aucun fichier sous `openapi/`
   dans le diff.
9. **(i) Pas d'attente de BCP-2** — respecté, ce lot ne dépend de rien de ce
   qui bloque BCP-2.

## Dérogations R5

Une seule, déjà nommée au point 4 ci-dessus : l'ajout de `packLine()` en plus
de `toPackLine()`, non prescrit littéralement par le texte de cadrage mais
nécessaire pour que le test d'architecture M7 (garde du point (e)) tienne sa
promesse ("seul `cartLine.ts` construit `{ product, qty }`") sans angle mort.
Chemin de mise en conformité si la qa-review la rejette : supprimer
`packLine()`, faire revenir les deux littéraux `{ product, qty }` dans
`PublicShop.addToCart` et `orderRenewal.helpers.ts`, et restreindre le test
d'architecture M7 à la seule forme `config: { ...spread, quantity }` (ce qu'il
fait déjà — `packLine` n'est pas indispensable à CE garde précis, il l'est à
la promesse plus large "un seul domicile pour toute construction de
`CartLine`"). Périmètre de la dérogation : 3 lignes dans `cartLine.ts`, 2
call sites.

## Fichiers créés

- `src/modules/orders/ui/storefront/cartLine.ts` — `CopyCount`, `PackCount`,
  `copies()`, `packs()`, `ONE_PACK`, `packLine()`, `toPackLine()`.
- `src/modules/orders/ui/storefront/cartLine.typecheck.ts` — T9 (et un
  complément T8 sur `toPackLine` directement), jamais exécuté, vérifié par
  `pnpm typecheck` (même convention que `tests/kernel/types.typecheck.ts`).
- `src/modules/catalog/ui/storefront/ShopProductCard.typecheck.ts` — T10.
- `tests/architecture/cart-line-single-constructor.test.ts` — garde M7.
- `tests/components/shop/portal/cartLine.test.ts` — T1 à T5.

## Fichiers modifiés

- `src/modules/orders/ui/storefront/index.ts` — exporte `copies`, `packs`,
  `ONE_PACK`, `packLine`, `toPackLine`, `CopyCount`, `PackCount` (barrel
  public du module, imposé par `tests/architecture/modular-ui-boundaries.test.ts` :
  un import direct du fichier `cartLine.ts` depuis un autre module échoue la
  garde MUX — seule la profondeur `ui/storefront` avec `index.ts` est une
  entrée publique autorisée entre modules).
- `src/modules/orders/ui/storefront/orderRenewal.helpers.ts` — quatrième
  porte fermée (voir détail ci-dessous).
- `src/modules/catalog/ui/storefront/gamme/GammePage.tsx` — troisième copie
  remplacée, type de prop, grille de cartes.
- `src/modules/catalog/ui/storefront/PortalCatalog.tsx` — type de prop seul.
- `src/modules/catalog/ui/storefront/PortalHome.tsx` — `onReorder` renommé
  `onAddToCart` (nom trompeur signalé par l'architecte, aucun lien avec le
  renouvellement de commande).
- `src/modules/catalog/ui/storefront/ShopProductCard.tsx` — type de prop,
  2 call sites (aucun rendu, aucun prix touché).
- `src/modules/shops/ui/storefront/PublicShop.tsx` — commentaire menteur
  corrigé, `addToCart` typé `PackCount`, `handleOverlayConfirm` réécrit via
  `toPackLine`, 3 câblages de props mis à jour, assertion de compilation T8.
- `tests/components/shop/PublicShop.productConfigurationAlignment.test.ts` —
  2 assertions pinning BCP-10 mises à jour pour suivre la nouvelle forme
  (intention QA-M9/QA-M11/D2 préservée, voir docblock ajouté).
- `tests/components/shop/portal/orderRenewal.helpers.test.ts` — T6, T7
  ajoutés.

## Détail de la quatrième porte (`rebuildCartFromOrderItems`)

Un `clariprint_options.quantity` numérique et positif signale un produit
CONFIGURÉ (forfait) : reconstruction via `toPackLine(product, copies(...))`,
qui fige `qty` à 1 paquet et est **seule responsable** de l'écriture de
`config.quantity` (le snapshot `clariprint_options` est fusionné **sans** sa
clé `quantity`, précisément pour que M2 — retirer l'écriture dans
`toPackLine` — ne reste pas invisible derrière une valeur déjà correcte
fuitée par la fusion ; voir le round de mutation M2 ci-dessous, où j'ai dû
corriger mon implémentation une première fois pour cette raison exacte).
Sans ce signal, `item.quantity` (paquets) est préservé tel quel — **jamais**
réinterprété comme des exemplaires même si la valeur est suspecte (T7) : une
commande fautive historique s'affiche avec un total visiblement faux plutôt
que d'être « réparée » en silence par une heuristique de magnitude.

## Tests exécutés et résultat

- `pnpm typecheck` (= `pnpm run typecheck:modular` = `tsc --noEmit -p tsconfig.modular.json`,
  strict, script canonique du dépôt) : **0 erreur**.
  - `pnpm run typecheck:all` (script non canonique, `tests/**` inclus en
    entier) : erreurs pré-existantes, **identiques avant et après ce lot**
    (vérifié par `git stash` / re-run) — aucune régression introduite par
    BCP-11, mais ce script n'est pas la preuve demandée (`pnpm typecheck`
    l'est).
- `pnpm test` (vitest, suite complète) : **300 fichiers passés, 11 skip ;
  3054 tests passés, 86 skip, 0 échec.** Les 86 skip et 11 fichiers skip sont
  pré-existants (vérifiés identiques sur la branche non modifiée via
  `git stash`). Sur la branche non modifiée, un test échoue de façon isolée
  (flake pré-existant, hors périmètre BCP-11) — absent sur ma branche.

## Verdict des mutations (rejouées une par une, puis annulées)

Méthode : chaque mutation appliquée par script Python sur une copie du
fichier concerné, suite ciblée relancée, verdict noté, fichier restauré à
l'identique (`git status` vérifié propre après coup).

| # | Mutation | Verdict attendu | Verdict observé |
|---|---|---|---|
| M1 | `toPackLine` : `qty: ONE_PACK` → `qty: quantity` (ici : l'argument `ONE_PACK` passé à `packLine` remplacé par `quantity`) | T1, T3, T4, T5 rougissent | **Confirmé** : T1 (`qty` attendu 1, obtenu 500), T3 (`lineTotalHt` attendu 35, obtenu 17500 — exactement le défaut des 17 500 €), T4 (attendu 95, obtenu 77500), T5 (`qty` attendu 2 obtenu 501, `lineTotalHt` attendu 70 obtenu 17535). Bonus : T6 (orderRenewal) rougit aussi. |
| M2 | `toPackLine` : retrait de l'écriture `config.quantity` | T1, T2, T6 rougissent | **Confirmé** après correction (voir dérogation implicite ci-dessus) : sans exclure `quantity` du merge côté `orderRenewal.helpers.ts`, T6 restait vert sous M2 (la valeur fuitait par la fusion, pas par `toPackLine`) — corrigé, puis T1, T2, T6 rougissent bien. |
| M3 | `toPackLine` : inversion d'ordre (`quantity` étalé avant `config`) | T1 rougit | **Confirmé**, et seulement T1 (T2/T3/T4/T5 restent verts, comme attendu — la valeur périmée du fixture T1, `quantity: 100`, est nécessaire pour que M3 soit détectable ; sans elle, l'inversion est invisible car rien ne la contredit). |
| M4 | `copies()`/`packs()` rendus interchangeables (brand fusionné) | T8, T9, T10 rougissent, `pnpm typecheck` échoue | **Partiellement confirmé** : `pnpm typecheck` échoue bien (T9, `cartLine.typecheck.ts:19`, `@ts-expect-error` inutilisé). T8 et T10 restent verts sous cette mutation précise, car ils testent un canal DIFFÉRENT (rejet d'un nombre nu, indépendant de la fusion `CopyCount`/`PackCount`) — vérifié séparément par sanity-check dédié (T8 rougit si `PackCount`→`number` sur `addToCart` ; T10 rougit si `onAddToCart` regagne des paramètres). Le residu utile de M4 (« un seul type ») est bien détecté par T9 et fait échouer `pnpm typecheck`, ce qui est l'exigence forte du tableau. |
| M5 | `cartPricing.ts:27` : `* line.qty` → `* 1` | T5 rougit | **Confirmé**, et le test pré-existant `cartPricing.test.ts` ("réutilise le prix catalogue") rougit aussi en bonus. |
| M6 | `rebuildCartFromOrderItems` : `qty` ← `clariprint_options.quantity` (adapté à ma structure : dans la branche configurée, `copies(rawCopyCount)` → `copies(qty)`, substituant les paquets à la place des exemplaires) | T6 rougit | **Confirmé.** |
| M7 | Réintroduction manuelle de la règle dans `GammePage.handleAdd` (adaptée à la signature à 1 argument) | Aucun test unitaire ne la voit ; le test d'architecture doit rougir | **Confirmé exactement comme prédit** : `pnpm typecheck` reste propre, la suite unitaire ne bouge pas, et `tests/architecture/cart-line-single-constructor.test.ts` rougit seul, en désignant `GammePage.tsx`. |

**Note de transparence sur M1/M4/M6** : la table du cadrage a été écrite de
façon abstraite avant que le code n'existe ; ma structure concrète diffère
par endroits (ex. le calcul de `qty`/`packCount` est explicite plutôt qu'une
seule variable partagée). J'ai donc rejoué l'ESPRIT de chaque mutation
(le même type de défaut, appliqué à l'endroit équivalent dans mon code) et
noté ci-dessus tout écart entre la prédiction littérale et le résultat
observé, plutôt que de forcer une correspondance artificielle.

## Ce que je n'ai pas fait

- Pas touché à `useProductConfigurator.ts` (frontière BCP-2).
- Pas touché à `ProductOverlay.tsx`.
- Pas modifié `openapi/`.
- Pas conditionné de bouton (Q14, point 3.7) — hors mandat, attend un
  arbitrage d'Arnaud.
- Pas déplacé `cartPricing.ts`/`orderRenewal.helpers.ts` vers
  `orders/application/` (dette nommée, pas ce lot).
- Pas modifié `CartLine.qty` (reste `number`, décision de l'architecte).
- N'ai rien poussé ni committé — la remontée est décidée par le coordinateur
  (consigne #8 de la tâche).

## Pour la qa-review

Points à rejouer en priorité, dans l'ordre où je m'attendrais à ce qu'une
lecture adversariale les trouve :
1. Le second constructeur `packLine()` (dérogation R5 documentée ci-dessus) —
   vérifier qu'il ne réintroduit pas de canal caché.
2. Le comportement de M4 sur T8/T10 (résultat partiel, expliqué) — vérifier
   que l'exigence réelle (`pnpm typecheck` échoue) est bien ce qui compte, et
   pas la correspondance littérale à trois noms de test.
3. Le choix de discriminer "produit configuré" via `clariprint_options.quantity`
   plutôt que via un champ explicite dédié — c'est une inférence sur la forme
   des données, documentée et testée (T6/T7), mais c'est une inférence.
4. Rejouer M1 à M7 soi-même (scripts non conservés dans le dépôt — appliqués
   puis annulés à chaque fois ; à refaire à la main ou via un script
   équivalent, la démarche est décrite ligne par ligne ci-dessus).
