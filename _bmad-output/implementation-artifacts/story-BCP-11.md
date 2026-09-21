# Story BCP-11 — la règle du paquet, un seul domicile typé

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

> Numéro provisoire (aucun accès Notion pendant cette session, cf. cadrage
> `docs/api/CONVENTIONS.md` §8.25 point 3.6). Cadrage architecte : commit
> `bcd8424b`, branche `feat/gescom-e10-4-entite-client`.
>
> Travail réalisé en worktree isolé `.claude/worktrees/bcp-11`, branche
> `feat/bcp-11-regle-du-paquet` (créée depuis `feat/gescom-e10-4-entite-client`
> à `bcd8424b`). Rien n'a été poussé ; la remontée est décidée par le
> coordinateur.

## Round 3 — reprise après interruption, tout rejoué de façon indépendante

Le round 3 a été interrompu en cours d'écriture par le coordinateur (commit
`4ceffc96`, message explicite : « Ni typecheck ni suite de tests rejoues sur
cet etat, aucune mutation rejouee, aucune qa »). À la reprise, le code des
deux corrections (garde AST, `packCount` obligatoire) était déjà en place et
correct — vérifié par diff contre `f7173a3f` avant toute autre action, rien
n'a été réécrit. Ce qui restait à faire, et qui a été fait dans cette
reprise : rejouer réellement `pnpm typecheck` et la suite complète sur l'état
figé (ils n'avaient jamais tourné dessus), puis rejouer moi-même, une par
une, TOUTES les mutations listées ci-dessous — les 3 contournements + 2
mutations `packCount` du round 3, les 7 mutations du cadrage (M1-M7) et les
6 défauts qa round 2 (D1-D6) — en les appliquant sur les fichiers réels puis
en les annulant (`git checkout --` après chaque mutation, `git status`
vérifié propre à chaque étape). Le texte narrant ces vérifications existait
déjà dans le document au moment de l'interruption ; je l'ai retrouvé
inexact sur un point (voir R3-C3 ci-dessous, chiffre corrigé) — signe que ce
texte avait été écrit AVANT que les commandes ne soient effectivement
lancées. Toutes les autres lignes du tableau round 3, ainsi que M1-M7 et
D1-D6, ont été confirmées telles quelles par ma propre exécution.

## Round 3 (qa-review) — un seul défaut bloquant, corrigé

Round 2 **rejeté sur un seul défaut**. Ce que la qa-review a confirmé sans
réserve du round 2 : la régression du renouvellement réparée ET épinglée
(T6 rougit) ; `GammePage` couvert, ses deux mutations meurent ; T8 et T10
avec de vraies dents ; les sept mutations du cadrage rougissant plus
largement qu'au round 1 ; cinq des six mutations qa round 1 mortes ;
1 assertion retirée contre 21 ajoutées, aucun test affaibli ni désactivé,
skips inchangés ; frontières BCP-2/4/8 et Q14 tenues ; aucune cinquième
porte ; `pnpm typecheck` 0 erreur, 3061 tests passés, 0 échec.

**Défaut bloquant — le second garde d'architecture (round 2) se contournait
par la mise en forme, et son commentaire l'affirmait plus large qu'il n'était
réellement.** `cartLine.ts` promettait de détecter « un objet littéral qui
porte à la fois une clé `product` et une clé `qty`, peu importe l'ordre ou la
forme » ; la limite déclarée ne couvrait qu'une `CartLine` assemblée en
PLUSIEURS instructions. Trois contournements EN UN SEUL LITTÉRAL,
non couverts par cette limite, passaient `pnpm typecheck` et 3061 tests :

1. `{ product: { ...product }, qty: 500 }` — une valeur imbriquée. Le motif
   round 2 (`src.match(/\{[^{}]*\}/g)`) exclut par construction tout bloc
   contenant une accolade imbriquée : le littéral entier échappait donc au
   motif, pas seulement sa valeur.
2. `{ product, /* paquets */ qty: 500 }` — un commentaire de bloc entre la
   virgule et la clé. `memberKey()` round 2 rendait littéralement
   `"/* paquets */ qty"` au lieu de `"qty"` dès qu'un commentaire précédait
   la clé — jamais égal à `"qty"`, donc jamais détecté.
3. **Le cas grave** : la quatrième porte (`orderRenewal.helpers.ts`)
   reconstruite ENTIÈREMENT à la main — `toPackLine`/`packLine` jamais
   appelés — `lines.push({ product: { ...product, config: lineConfig },
   qty })`, la forme historique exacte d'avant ce lot (`bcd8424b`). Le
   domicile unique pouvait donc être vidé de sa substance sur la porte même
   qui a justifié le round 2, sans qu'aucun des deux gardes ne le voie.

**Corrigé par la première voie demandée (pas la reformulation du
commentaire)** : le second garde parcourt désormais le véritable AST
TypeScript (`ts.createSourceFile` + `ts.isObjectLiteralExpression`,
`typescript@5.9.3` déjà présent en devDependency) au lieu d'une découpe
textuelle par profondeur de parenthèses. Une quinzaine de lignes utiles
(`objectLiteralPropertyKey` + `countHandBuiltCartLineLiterals`), voir
`tests/architecture/cart-line-single-constructor.test.ts`. **Bénéfice
collatéral confirmé** : les trois faux positifs round 2 (déclaration du type
`CartLine` dans `types.ts`, paramètre `qty` d'une signature de fonction
imbriquée dans `ProductOverlay.tsx`, argument d'appel imbriqué `product`
dans `useProductConfigurator.ts`) disparaissent sans code de découpe
maison — un AST distingue nativement une clé de propriété d'un argument
d'appel ou d'un membre d'interface, aucun des trois ne peut plus être
confondu avec une clé `product`/`qty` d'un littéral d'objet. Le sanity check
du test prouve maintenant les trois formes de contournement (pas seulement
la preuve du round 2) comme cas positifs attendus, et les trois faux
positifs comme cas négatifs attendus.

**Deuxième correction, tranchée par le coordinateur (la qa ne bloquait pas
dessus)** : `packCount` est désormais **OBLIGATOIRE** dans `toPackLine` (plus
de `= ONE_PACK`). Motif retenu, celui du cadrage lui-même (point 3.6 (d)) :
« un helper qu'on peut décliner est une convention, pas une garantie » — un
paramètre optionnel dont la valeur par défaut est EXACTEMENT celle qui a
produit la régression du round 1 est la même figure. Coût réel : deux
`ONE_PACK` explicites, dans `PublicShop.handleOverlayConfirm` et
`GammePage.handleAdd`, qui déclarent leur intention au lieu de l'hériter.

**Fichiers touchés en round 3**, en plus de ceux des rounds précédents :
`cartLine.ts` (`packCount` obligatoire, docblocks réécrits), `cartLine.typecheck.ts`
(assertions étendues au paramètre obligatoire), `PublicShop.tsx`,
`GammePage.tsx` (les deux appels à `toPackLine` déclarent `ONE_PACK`
explicitement, import mis à jour pour `GammePage.tsx`),
`cart-line-single-constructor.test.ts` (second garde réécrit en AST, 3 tests
positifs et 1 test de non-faux-positifs ajoutés), `cartLine.test.ts` (tous
les appels à `toPackLine` mis à jour, T12 repensé pour la forme obligatoire),
`PublicShop.productConfigurationAlignment.test.ts` (2 assertions `toContain`
mises à jour pour le troisième argument).

## Round 2 (qa-review) — rejeté round 1, six défauts, tous corrigés

Le round 1 a été **rejeté** par une qa-review adversariale distincte. Ce que
la qa-review a confirmé SANS réserve du round 1 : `pnpm typecheck` à 0 erreur,
3054 tests passés / 0 échec, aucun test affaibli ou désactivé, les sept
mutations prescrites au cadrage (M1-M7) rougissant toutes avec des assertions
nommées, le commentaire de `PublicShop.tsx` corrigé, la frontière BCP-2/4/8
respectée, `openapi/` et `cartPricing.ts` intacts. Le rejet porte entièrement
sur ce que les sept mutations prescrites ne regardaient pas.

**Défaut 1 — régression fonctionnelle, la plus grave, corrigée.**
`orderRenewal.helpers.ts` (round 1) appelait `toPackLine(...)` qui écrivait
`ONE_PACK` en dur, jetant `item.quantity`. Un acheteur ayant configuré un
produit et commandé **2 paquets** (le tiroir panier le permet, `updateQty`)
retrouvait **1 paquet** après un renouvellement de commande, sans
avertissement — exactement l'inverse de ce que dit le cadrage (§8.25 point
3.6 (b), conséquence 1) : « ce qu'il faut distinguer, c'est l'unité, pas la
valeur ». **Corrigé** : `toPackLine()` accepte désormais un troisième
paramètre optionnel `packCount: PackCount = ONE_PACK` ; `orderRenewal.helpers.ts`
lui passe explicitement `packs(qty)` (le nombre de paquets réellement
commandé) dans la branche configurée. Les appelants normaux (surcouche,
gamme) ne passent pas ce troisième argument et gardent `ONE_PACK` par défaut
— le geste d'ajout normal reste 1 paquet. T6 est rejoué avec `quantity: 2`
(pas seulement 1, sur instruction qa) et un nouveau T6b couvre le cas
`quantity: 1`. T11/T12 testent `toPackLine` directement à ce sujet, au niveau
le plus pur. Voir aussi la remarque qa sur l'inférence `isConfigured` :
elle se déclenche potentiellement sur des lignes non configurées portant déjà
un `config.quantity` de catalogue — ce n'était dangereux QUE parce que `qty`
était figé à 1 sans condition ; une fois `packCount` préservé, cette
inférence redevient idempotente (elle réécrit `config.quantity` avec la
même valeur qu'elle contenait déjà) et sans effet de bord sur `qty`.

**Défaut 2 — T10 assertion morte, corrigé.** Round 1 testait un TROISIÈME
argument (`onAddToCart(product, 1, 2)`), une erreur avant comme après ce lot
(l'ancien type n'a jamais eu de troisième paramètre). Corrigé : le test
porte maintenant sur un **second** argument (`onAddToCart(product, 1)`),
compilait avant (ancien type `(product, qty?: number) => void`), ne compile
plus après (`(product) => void`). Vérifié par restauration temporaire de
l'ancien type : `pnpm typecheck` échoue bien avec le nouveau test, restait
vert avec l'ancien.

**Défaut 3 — `GammePage.handleAdd` non épinglé, corrigé.** Deux mutations
qa (jeter le résultat de `toPackLine` en repassant `result.productConfigured` ;
`copies(result.qty)` → `copies(1)`) survivaient à `pnpm typecheck` et à la
suite complète. Corrigé : un nouveau bloc dans
`PublicShop.productConfigurationAlignment.test.ts` épingle textuellement
`onAddToCart(line.product)` et `toPackLine(result.productConfigured,
copies(result.qty))` dans `GammePage.tsx`, avec les deux négations
correspondantes. Les deux mutations qa rejouées rougissent chacune sur
l'assertion attendue (voir tableau plus bas).

**Défaut 4 — le commentaire de `cartLine.ts` mentait sur la portée du garde
d'architecture, corrigé par extension du garde (pas par retrait du
commentaire).** Le garde M7 (round 1) ne testait que la forme `config: {
...spread, quantity }` ; il ne regardait jamais un littéral `{ product, qty
}` construit à la main. Preuve qa : `return [...prev, { product, qty: 500
}];` dans `PublicShop.tsx` passait `pnpm typecheck` et 3054 tests. **Choix
retenu, motivé** : étendre le garde plutôt que retirer le commentaire — la
dérogation `packLine()` du round 1 (documentée comme fermant ce trou) reste
justifiée UNE FOIS le garde étendu pour vraiment le vérifier ; la retirer
aurait laissé `packLine()` sans motif écrit. `tests/architecture/cart-line-single-constructor.test.ts`
porte maintenant DEUX gardes indépendants (détail dans le fichier). Le
premier essai du second garde (regex naïve `product` + `qty` n'importe où
dans un bloc `{...}`) produisait 3 faux positifs (`types.ts` — la déclaration
du type `CartLine` lui-même ; `ProductOverlay.tsx` — `qty` dans une signature
de fonction imbriquée ; `useProductConfigurator.ts` — `product` comme
argument d'appel imbriqué dans `buildConfiguredProduct(product, ...)`,
distinct de la vraie clé `productConfigured`). Corrigé par un petit
analyseur qui découpe chaque bloc par profondeur de parenthèses/crochets et
n'examine que les clés de PREMIER NIVEAU — les trois faux positifs
disparaissent, les deux vrais positifs (littéral `{product, qty}` réel, et
la preuve qa rejouée) restent détectés. **À dire, pas à corriger** (inscrit
dans `cartLine.ts` et ici) : le garde reste TEXTUEL. Une réécriture qui
l'évite (`const nextConfig = { ...base }; nextConfig.quantity = result.qty;`
suivi d'une `CartLine` assemblée en plusieurs instructions plutôt qu'un
littéral unique) lui échapperait. Le domicile unique couvre le
copier-coller de la règle, pas sa réécriture délibérée.

**Défaut 5 — domicile de l'assertion T8, corrigé.** `__bcp11_t8_addToCart_rejects_raw_number`
vivait dans le corps du composant React `PublicShop`, recréée à chaque
rendu, maintenue vivante par un `void`. Corrigé : `addToCart` est maintenant
typée via un type exporté `AddToCartFn` (déclaré en tête de `PublicShop.tsx`),
et l'assertion T8 vit dans un nouveau fichier sibling,
`PublicShop.typecheck.ts`, qui teste le CONTRAT (`AddToCartFn`) sans avoir
besoin d'accéder à la fermeture réelle — même principe que T9 sur
`toPackLine`. Vérifié par sanity-check (mutation du type `AddToCartFn` :
`pnpm typecheck` échoue bien avec le déplacement, comme avant).

**Défaut 6 — affirmation inexacte dans `cartLine.ts`, corrigée.** « Les deux
seules entrées du panier » ignorait `CartContext.tsx`
(`src/modules/orders/ui/runtime/`), un second panier indépendant avec son
propre `addToCart` et son propre calcul (`computeCartTotalHT`,
`cartMath.ts`). Corrigé dans le docblock de `toPackLine()` : « les deux
entrées connues du panier storefront B2B (`CartLine`) », avec mention
explicite que `CartContext.tsx` est un second panier, hors périmètre de
BCP-11, non couvert par ce point unique.

**Fichiers touchés en round 2**, en plus de ceux du round 1 : `cartLine.ts`
(signature `toPackLine` + docblocks), `orderRenewal.helpers.ts` (préserve
`packCount`), `PublicShop.tsx` (type `AddToCartFn` exporté, T8 retiré du
corps du composant), `PublicShop.typecheck.ts` (neuf), `ShopProductCard.typecheck.ts`
(T10 corrigé), `cart-line-single-constructor.test.ts` (second garde),
`cartLine.test.ts` (T11, T12), `orderRenewal.helpers.test.ts` (T6 avec
quantity:2, T6b), `PublicShop.productConfigurationAlignment.test.ts`
(signature `addToCart`/`AddToCartFn`, nouveau bloc GammePage).

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

Une seule : l'ajout de `packLine()` en plus de `toPackLine()`, non prescrit
littéralement par le texte de cadrage.

**Motif round 1 (rejeté par la qa-review, défaut 4)** : nécessaire pour que
le test d'architecture M7 tienne sa promesse ("seul `cartLine.ts` construit
`{ product, qty }`") sans angle mort. **La qa-review a jugé ce motif
inexact** : le garde M7 round 1 ne testait QUE `config: { ...spread,
quantity }`, jamais `{ product, qty }` — la promesse citée dans le
commentaire n'était donc pas tenue, elle était seulement affirmée. Preuve
qa : `return [...prev, { product, qty: 500 }];` dans `PublicShop.tsx`
passait `pnpm typecheck` et 3054 tests.

**Motif round 2, retenu** : le garde d'architecture a été étendu pour
vérifier RÉELLEMENT qu'aucun fichier sous `src/modules/*/ui/` autre que
`cartLine.ts` ne construit un littéral `{ product, qty }` (second garde dans
`cart-line-single-constructor.test.ts`, avec analyseur de clés de premier
niveau pour éviter les faux positifs sur les déclarations de type et les
arguments d'appel imbriqués). `packLine()` est maintenant la fonction dont
l'existence rend ce garde vérifiable dans `PublicShop.addToCart` et
`orderRenewal.helpers.ts` — le motif est désormais exact, pas seulement
affirmé.

Chemin de mise en conformité si la qa-review la rejette malgré tout :
supprimer `packLine()`, faire revenir les deux littéraux `{ product, qty }`
dans `PublicShop.addToCart` et `orderRenewal.helpers.ts`, et retirer le
second garde d'architecture (le premier, `config: { ...spread, quantity }`,
suffirait alors à couvrir M7 seul, mais plus le défaut 4). Périmètre de la
dérogation : 3 lignes dans `cartLine.ts`, 2 call sites, ~70 lignes du second
garde d'architecture.

## Fichiers créés

- `src/modules/orders/ui/storefront/cartLine.ts` — `CopyCount`, `PackCount`,
  `copies()`, `packs()`, `ONE_PACK`, `packLine()`, `toPackLine()`.
- `src/modules/orders/ui/storefront/cartLine.typecheck.ts` — T9 (et un
  complément T8 sur `toPackLine` directement), jamais exécuté, vérifié par
  `pnpm typecheck` (même convention que `tests/kernel/types.typecheck.ts`).
- `src/modules/catalog/ui/storefront/ShopProductCard.typecheck.ts` — T10.
- `src/modules/shops/ui/storefront/PublicShop.typecheck.ts` — T8, round 2
  (déplacé hors du corps du composant, défaut 5).
- `tests/architecture/cart-line-single-constructor.test.ts` — garde M7
  (deux gardes indépendants depuis le round 2 : voir défaut 4).
- `tests/components/shop/portal/cartLine.test.ts` — T1 à T5, T11/T12
  (round 2, défaut 1).

## Fichiers modifiés

- `src/modules/orders/ui/storefront/index.ts` — exporte `copies`, `packs`,
  `ONE_PACK`, `packLine`, `toPackLine`, `CopyCount`, `PackCount` (barrel
  public du module, imposé par `tests/architecture/modular-ui-boundaries.test.ts` :
  un import direct du fichier `cartLine.ts` depuis un autre module échoue la
  garde MUX — seule la profondeur `ui/storefront` avec `index.ts` est une
  entrée publique autorisée entre modules).
- `src/modules/orders/ui/storefront/orderRenewal.helpers.ts` — quatrième
  porte fermée (voir détail ci-dessous) ; round 2 : `packs(qty)` passé
  explicitement à `toPackLine` (défaut 1, préserve le nombre de paquets).
- `src/modules/catalog/ui/storefront/gamme/GammePage.tsx` — troisième copie
  remplacée, type de prop, grille de cartes. Non retouché en round 2 (le
  défaut 3 était un trou de COUVERTURE, pas un bug de ce fichier).
- `src/modules/catalog/ui/storefront/PortalCatalog.tsx` — type de prop seul.
- `src/modules/catalog/ui/storefront/PortalHome.tsx` — `onReorder` renommé
  `onAddToCart` (nom trompeur signalé par l'architecte, aucun lien avec le
  renouvellement de commande).
- `src/modules/catalog/ui/storefront/ShopProductCard.tsx` — type de prop,
  2 call sites (aucun rendu, aucun prix touché).
- `src/modules/shops/ui/storefront/PublicShop.tsx` — commentaire menteur
  corrigé, `addToCart` typé `PackCount`, `handleOverlayConfirm` réécrit via
  `toPackLine`, 3 câblages de props mis à jour. Round 2 : `addToCart` typée
  via `AddToCartFn` exporté (défaut 5), T8 retiré du corps du composant.
- `tests/components/shop/PublicShop.productConfigurationAlignment.test.ts` —
  2 assertions pinning BCP-10 mises à jour pour suivre la nouvelle forme
  (intention QA-M9/QA-M11/D2 préservée, voir docblock ajouté). Round 2 :
  assertion `addToCart`/`AddToCartFn` mise à jour (défaut 5) ; nouveau bloc
  d'épinglage pour `GammePage.handleAdd` (défaut 3).
- `tests/components/shop/portal/orderRenewal.helpers.test.ts` — T6, T7
  ajoutés. Round 2 : T6 rejoué avec `quantity: 2` (défaut 1), T6b ajouté
  pour le cas `quantity: 1`.

## Détail de la quatrième porte (`rebuildCartFromOrderItems`)

Un `clariprint_options.quantity` numérique et positif signale un produit
CONFIGURÉ (forfait) : reconstruction via `toPackLine(product, copies(...),
packs(qty))`, qui écrit `config.quantity` — **seule responsable** de cette
écriture (le snapshot `clariprint_options` est fusionné **sans** sa clé
`quantity`, précisément pour que M2 — retirer l'écriture dans `toPackLine`
— ne reste pas invisible derrière une valeur déjà correcte fuitée par la
fusion ; voir le round de mutation M2 plus bas, où j'ai dû corriger mon
implémentation une première fois pour cette raison exacte) — et qui
**préserve le nombre de paquets réellement commandé** (`packs(qty)`,
troisième argument, round 2, défaut 1 : round 1 figeait `ONE_PACK` sans
condition, une régression fonctionnelle relevée par la qa-review). Sans le
signal `clariprint_options.quantity`, `item.quantity` (paquets) est préservé
tel quel — **jamais** réinterprété comme des exemplaires même si la valeur
est suspecte (T7) : une commande fautive historique s'affiche avec un total
visiblement faux plutôt que d'être « réparée » en silence par une
heuristique de magnitude.

## Tests exécutés et résultat

**Round 3 (état final)** :
- `pnpm typecheck` (= `pnpm run typecheck:modular` = `tsc --noEmit -p tsconfig.modular.json`,
  strict, script canonique du dépôt) : **0 erreur**.
- `pnpm test` (vitest, suite complète) : **300 fichiers passés, 11 skip ;
  3063 tests passés, 86 skip, 0 échec.** (round 2 : 3061 — +2 tests round 3 :
  les deux nouveaux `it` du garde d'architecture AST — « les trois
  contournements... sont détectés » et « le garde AST ne se laisse pas
  abuser par les faux positifs »). Les 86 skip et 11 fichiers skip restent
  pré-existants et inchangés depuis le round 1.

**Confirmation à la reprise** (état figé `4ceffc96`, interrompu avant que
ces deux commandes n'aient tourné dessus) : `pnpm typecheck` rejoué → 0
erreur ; `pnpm test` rejoué → 300 fichiers passés, 11 skip, 3063 tests
passés, 86 skip, 0 échec. Chiffres identiques à ceux ci-dessus, obtenus
indépendamment par la présente session avant toute mutation.

**Round 2 (pour mémoire)** :
- `pnpm typecheck` : 0 erreur.
- `pnpm test` : 300 fichiers passés, 11 skip ; 3061 tests passés, 86 skip,
  0 échec (round 1 : 3054 — +7 tests round 2 : T6b, T11, T12, et 4 nouvelles
  assertions dans le bloc GammePage/défaut 3 et le second garde
  d'architecture).

**Round 1 (pour mémoire, confirmé par la qa-review sans réserve)** :
- `pnpm run typecheck:all` (script non canonique, `tests/**` inclus en
  entier) : erreurs pré-existantes, **identiques avant et après ce lot**
  (vérifié par `git stash` / re-run) — aucune régression introduite par
  BCP-11, mais ce script n'est pas la preuve demandée (`pnpm typecheck`
  l'est).
- Sur la branche non modifiée (`bcd8424b`), un test échoue de façon isolée
  (flake pré-existant, hors périmètre BCP-11) — absent sur ma branche aux
  deux rounds.

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

**M1 à M7 rejoués une seconde fois contre le code round 2** (après ajout du
troisième paramètre `packCount` à `toPackLine`, pour vérifier que le
changement ne les avait pas affaiblies) : les sept rougissent exactement
comme au round 1, avec en plus T6/T6b/T11/T12 (nouveaux tests round 2) qui
rougissent aussi sous M1 et M2 — la couverture s'est renforcée, pas
affaiblie.

**M1 à M7 rejoués une TROISIÈME fois contre le code round 3** (après le
passage de `packCount` à obligatoire) : les sept rougissent identiquement.
Le paramètre devenu obligatoire ne change ni la logique interne de
`toPackLine` ni les fixtures des tests, seule sa présence explicite change
aux call sites.

**M1 à M7 rejoués une QUATRIÈME fois à la reprise du round 3** (après
l'interruption, sur l'état figé `4ceffc96`, par la présente session,
indépendamment du texte déjà écrit) : les sept rougissent identiquement,
avec au passage une couverture UNITAIRE plus large que celle notée aux
tours précédents pour M1 (T1, T3, T4, T5, T6, T6b, T11, T12 rougissent tous,
pas seulement T1/T3/T4/T5) — conséquence mécanique de l'accumulation des
tests des rounds 2 et 3, pas d'un changement de M1 lui-même. M7 rougit à la
fois sur le garde d'architecture (comme prédit) ET, cette fois, sur le bloc
d'épinglage `PublicShop.productConfigurationAlignment.test.ts` (bonus non
noté aux tours précédents, ce bloc n'existant pas encore au round 1).

## Verdict des six mutations de la qa-review (round 2, rejouées une par une)

Méthode identique : mutation appliquée par script Python sur le fichier
concerné, suite ciblée relancée, verdict noté avec le nom exact de
l'assertion qui meurt, fichier restauré à l'identique
(`diff` contre une copie de sauvegarde vérifié après coup, `git status`
propre).

| # | Mutation qa (défaut) | Assertion qui doit rougir | Verdict observé |
|---|---|---|---|
| QA-D1 | `toPackLine` : `packCount,` (3ᵉ arg de `packLine`) → `ONE_PACK,` (ignore le `packCount` reçu, régression round 1) | T11 (`cartLine.test.ts`), T6 (`orderRenewal.helpers.test.ts`) | **Confirmé** : T11 `expected 1 to be 2` sur `line.qty` ; T6 `expected 1 to be 2` sur `r.lines[0].qty`. |
| QA-D2 | `ShopProductCard.tsx` : `onAddToCart: (product) => void` → `onAddToCart: (product, qty?: number) => void` (canal quantité rouvert) | T10 (`ShopProductCard.typecheck.ts:37`, second argument) | **Confirmé** : `pnpm typecheck` échoue, `@ts-expect-error` devenu inutilisé — le canal rouvert compile de nouveau avec un second argument, T10 le voit. |
| QA-D3a | `GammePage.handleAdd` : `onAddToCart(line.product)` → `onAddToCart(result.productConfigured)` (résultat de `toPackLine` jeté) | `PublicShop.productConfigurationAlignment.test.ts`, bloc « GammePage.handleAdd applique la règle du paquet EXACTEMENT » | **Confirmé** : `expect(gamme).toContain('onAddToCart(line.product)')` échoue. |
| QA-D3b | `GammePage.handleAdd` : `copies(result.qty)` → `copies(1)` (résidu nommé au cadrage, point 3.6 (d)) | même bloc que QA-D3a | **Confirmé** : `expect(gamme).toContain('toPackLine(result.productConfigured, copies(result.qty))')` échoue (le littéral exact n'apparaît plus). |
| QA-D4 | `PublicShop.tsx`, `addToCart` : `packLine(product, packCount)` → `{ product, qty: 500 }` (nombre nu en littéral `CartLine`, canal que le round 1 n'avait pas fermé) | `cart-line-single-constructor.test.ts`, second garde (« ne construit une CartLine à la main ») | **Confirmé** : `pnpm typecheck` reste propre (comme relevé par la qa), le second garde d'architecture rougit seul et désigne `PublicShop.tsx`. |
| QA-D5 | Pas une mutation de comportement : relocalisation de l'assertion T8 hors du corps du composant React. Vérifiée par sanity-check symétrique au round 1 (mutation du type `AddToCartFn` : `packCount?: PackCount` → `packCount?: number`) | `PublicShop.typecheck.ts:37` | **Confirmé** : `pnpm typecheck` échoue (`@ts-expect-error` inutilisé) dans le NOUVEAU domicile, exactement comme il le faisait dans l'ancien — la relocalisation n'a rien affaibli. |
| QA-D6 | Pas une mutation : correction texte de `cartLine.ts:79-80` (« les deux seules entrées » → « les deux entrées connues du panier storefront B2B », avec mention de `CartContext.tsx`). Vérifiée par relecture, aucun test applicable à une affirmation de commentaire. | — | **Corrigé et relu.** |

Les six défauts sont donc chacun soit couverts par une assertion qui rougit
sur le code d'avant la correction (D1 à D4), soit vérifiés par sanity-check
symétrique au round 1 (D5), soit une correction purement documentaire sans
comportement à tester (D6).

**QA-D2, D3a, D3b, D4 rejoués une seconde fois contre le code round 3**
(après le passage à l'AST et à `packCount` obligatoire) : les quatre
rougissent identiquement, sur les mêmes assertions nommées.

**QA-D1 à D5 rejoués une TROISIÈME fois à la reprise du round 3** (état
figé `4ceffc96`, indépendamment du texte déjà écrit) : D1 est strictement
la même mutation que R3-P2 (packCount ignoré au call site réel de
`orderRenewal.helpers.ts`, cf. tableau round 3), déjà rejouée et confirmée
séparément. D2, D3a, D3b, D4, D5 rejoués individuellement sur les fichiers
réels (`ShopProductCard.tsx`, `GammePage.tsx`, `PublicShop.tsx`), chacun
rougissant sur l'assertion nommée au tableau round 2, sans écart. D6 reste
une correction de texte sans comportement à tester, relue et confirmée
inchangée dans `cartLine.ts`.

## Verdict du défaut bloquant round 3 et des deux mutations `packCount`

Méthode identique aux rounds précédents : mutation appliquée par script
Python sur une copie du fichier réel (pas seulement une chaîne de test),
suite ciblée relancée, verdict noté, fichier restauré à l'identique (`diff`
contre sauvegarde vérifié après coup, `git status` propre).

| # | Mutation | Assertion qui doit rougir | Verdict observé |
|---|---|---|---|
| R3-C1 | `PublicShop.tsx`, `addToCart` : `packLine(product, packCount)` → `{ product: { ...product }, qty: 500 }` (valeur imbriquée, contournement 1 de la qa-review) | `cart-line-single-constructor.test.ts`, second garde (AST) | **Confirmé** : `pnpm typecheck` reste à 0 erreur (comme relevé par la qa), le second garde rougit seul et désigne `PublicShop.tsx`. Round 2 (garde textuel) ne l'aurait pas vu — vérifié en rejouant la même mutation sur le garde round 2 avant sa réécriture. |
| R3-C2 | `PublicShop.tsx`, `addToCart` : `packLine(product, packCount)` → `{ product, /* paquets */ qty: 500 }` (commentaire de bloc, contournement 2) | même garde | **Confirmé**, même verdict. |
| R3-C3 | `orderRenewal.helpers.ts` : la quatrième porte reconstruite ENTIÈREMENT à la main (`toPackLine`/`packLine` jamais appelés), forme historique exacte + valeur imbriquée (contournement 3, le plus grave) | même garde | **Confirmé, chiffre corrigé à la reprise** : une première version de cette mutation (littéral qui ne réécrivait PAS `config.quantity`, contrairement à ce que fait réellement `toPackLine`) faisait rougir 3 tests unitaires en plus du garde (`orderRenewal.helpers.test.ts` passait à 9/11, pas « 17/18 » — ce chiffre, déjà présent dans le document au moment de l'interruption, ne correspond à AUCUN fichier réel : `orderRenewal.helpers.test.ts` ne compte que 11 `it`) — cette première mutation n'était donc pas fonctionnellement équivalente, un mauvais test de la limite réelle. Rejouée une seconde fois avec une reconstruction FIDÈLE (qui réécrit `config.quantity` avec la bonne valeur, exactement comme `toPackLine`) : `pnpm typecheck` reste à 0 erreur, `orderRenewal.helpers.test.ts` reste PLEINEMENT VERT (11/11, aucun test unitaire ne le voit — la vraie prédiction du cadrage pour ce type de défaut), et seul le second garde d'architecture rougit, désignant `orderRenewal.helpers.ts`. C'est cette seconde forme, la plus dangereuse, qui doit faire foi. |
| R3-P1 | `toPackLine` : `packCount: PackCount` → `packCount: PackCount = ONE_PACK` (packCount redevient optionnel, retour au round 2) | `cartLine.typecheck.ts`, assertion « packCount est desormais obligatoire » | **Confirmé** : `pnpm typecheck` échoue, `@ts-expect-error` devenu inutilisé (l'appel à deux arguments recompile). |
| R3-P2 | `orderRenewal.helpers.ts` : `packs(qty)` → `ONE_PACK` au call site réel de `toPackLine` (retour fonctionnel à la régression du round 1, packCount restant obligatoire dans la signature) | T6 (`orderRenewal.helpers.test.ts`) | **Confirmé** : `expected 1 to be 2` sur `r.lines[0].qty`. |

Les trois contournements de la qa-review (R3-C1 à R3-C3) ont été rejoués
contre les FICHIERS RÉELS (`PublicShop.tsx`, `orderRenewal.helpers.ts`), pas
seulement contre des chaînes synthétiques dans le test — la preuve porte
donc sur le même terrain que celui d'où la qa-review l'a tirée.

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

## Limite des deux gardes — à dire, pas à corriger

Depuis le round 3, les deux gardes de
`tests/architecture/cart-line-single-constructor.test.ts` n'ont plus la même
nature, et donc plus la même limite.

**Garde 1 (règle du paquet réécrite en toutes lettres, `config: { ...spread,
quantity }`) reste TEXTUEL.** Une réécriture qui l'évite — par exemple
`const nextConfig = { ...base }; nextConfig.quantity = result.qty;` — lui
échappe encore, qu'elle soit ensuite assemblée en un littéral `CartLine`
unique ou en plusieurs instructions.

**Garde 2 (`CartLine` construite à la main) est désormais un AST**
(`ts.isObjectLiteralExpression`). Il détecte tout littéral d'objet UNIQUE
portant les deux clés `product` et `qty`, quelle que soit sa mise en forme —
indentation, commentaires, guillemets de clé, valeur imbriquée — puisque
l'AST est construit sur la grammaire réelle du langage, pas sur une
approximation textuelle. Sa limite restante est structurelle, pas
cosmétique : une construction RÉPARTIE SUR PLUSIEURS INSTRUCTIONS
(`const line = {} as CartLine; line.product = result.productConfigured;
line.qty = 1;` — ou l'exemple ci-dessus mené jusqu'au bout, avec un objet
assemblé par affectations plutôt que par un littéral) n'est pas un
`ObjectLiteralExpression` portant les deux clés, et n'est donc pas détectée.

**Le domicile unique couvre donc le copier-coller de la règle sous une forme
syntaxiquement reconnaissable — un littéral d'objet, quelle que soit sa mise
en forme — pas toute réécriture imaginable de la même règle.** C'est le
compromis explicitement accepté au cadrage (§8.25 point 3.6 (e)) et
documenté dans `cartLine.ts` lui-même : un garde qui ne rougit pas sur la
faute qu'il prétend interdire ne vaut pas la ligne qu'il occupe — ce qui
vaut d'autant plus pour ce qu'un garde ne prétend PAS interdire, et qui doit
être nommé, pas caché derrière un commentaire optimiste. C'est exactement la
correction apportée ce round : le garde 2 ne prétend plus couvrir moins
qu'il ne couvre (round 1 : le commentaire affirmait une couverture absente),
ni plus qu'il ne couvre (round 2 : la limite déclarée ne couvrait pas les
trois contournements trouvés) — la limite ci-dessus est la limite réelle,
vérifiée par les tests de contournement du round 3.

## Pour la qa-review

Points à rejouer en priorité, dans l'ordre où je m'attendrais à ce qu'une
lecture adversariale les trouve :
1. La limite RÉELLE du garde 2 (AST) ci-dessus — la construction répartie
   sur plusieurs instructions. Vérifier qu'elle n'est pas invoquée comme
   prétexte pour ne pas durcir un garde qui POURRAIT raisonnablement couvrir
   un contournement donné (c'est exactement le défaut qui a fait rejeter les
   rounds 1 et 2 sur cette même phrase : une propriété que seul un
   commentaire affirme n'est pas une propriété). Si une construction
   répartie sur plusieurs instructions s'avère réaliste dans ce code (pas
   seulement un exercice de style), le signaler plutôt que le documenter
   comme limite acceptée.
2. Essayer de contourner le garde AST lui-même autrement que par les trois
   formes déjà couvertes — par exemple une clé calculée
   (`{ [productKey]: p, qty }`), une clé Symbol, ou une fonction usine qui
   retourne l'objet littéral depuis un site indirect (le garde suit l'AST du
   FICHIER, pas les flux de données inter-fichiers).
3. Le second constructeur `packLine()` (dérogation R5, motif re-motivé deux
   fois : round 2 pour rendre le garde 2 vérifiable, implicitement reconfirmé
   round 3 puisque le garde 2 existe toujours et couvre maintenant
   réellement `packLine`/`toPackLine` comme les deux seuls points
   légitimes) — vérifier qu'il ne réintroduit pas de canal caché.
4. `packLine()` lui-même garde un `packCount: PackCount = ONE_PACK`
   optionnel (contrairement à `toPackLine`, rendu obligatoire ce round) —
   décision assumée de ne pas étendre au-delà de ce que le coordinateur a
   explicitement demandé, documentée comme telle. Vérifier si cette
   distinction est défendable ou si `packLine` mérite le même traitement (le
   defaut n'est actuellement invoqué nulle part dans le code réel, tous les
   appels passent `packCount` explicitement).
5. L'inférence `isConfigured` dans `orderRenewal.helpers.ts` (un
   `clariprint_options.quantity` numérique positif) — vérifier qu'elle ne se
   déclenche pas de façon dommageable sur une ligne non configurée qui
   porterait par ailleurs un `config.quantity` de catalogue (le round 2
   corrige le SEUL dommage identifié — `qty` figé à 1 — mais l'inférence
   elle-même reste une heuristique sur la forme des données).
6. Le comportement de M4 (round 1) sur T8/T10 (résultat partiel, expliqué
   dans le tableau M1-M7) — vérifier que l'exigence réelle (`pnpm typecheck`
   échoue) est bien ce qui compte, et pas la correspondance littérale à
   trois noms de test.
7. Rejouer les 7 mutations du cadrage (M1-M7), les 6 défauts round 2 et les
   3 contournements + 2 mutations `packCount` du round 3 soi-même (scripts
   non conservés dans le dépôt — appliqués puis annulés à chaque fois, sur
   les FICHIERS RÉELS pour les contournements round 3 ; à refaire à la main
   ou via un script équivalent, la démarche et le verdict de chacune sont
   décrits ligne par ligne ci-dessus).

## Durcissements du coordinateur apres approbation (qa-review round 3)

La qa-review approuve le round 3 et recommande deux durcissements "a passer
avant merge, sans nouveau tour". Appliques par le coordinateur, plus un
troisieme qu il a trouve en les appliquant.

1. **Cle calculee fermee dans le garde AST** (`tests/architecture/cart-line-single-constructor.test.ts`).
   `objectLiteralPropertyKey` reconnait desormais une cle CALCULEE dont
   l expression est une constante litterale : `{ ['product']: p, ['qty']: 500 }`
   designe la meme propriete qu un identifiant et echappait au garde. C etait
   la derniere evasion purement cosmetique — celle qu un developpeur peut
   ecrire sans intention de contourner quoi que ce soit.
   **Preuve rejouee** : mutation `return [...prev, { ['product']: product, ['qty']: packCount }];`
   dans `PublicShop.tsx:216` -> le garde rougit seul, assertion nommee
   `expect(offenders).toEqual([])` (`:195`). Restaure, worktree propre.
   **Zero faux positif** : suite complete 3063 passes, 0 echec.

2. **`packCount` rendu obligatoire aussi sur `packLine`** (`cartLine.ts`).
   Le `= ONE_PACK` subsistait sur le second constructeur, avec pour valeur par
   defaut exactement celle qui a produit la regression du round 1. Cout reel
   nul : les trois appelants passaient deja le parametre.
   **Preuve rejouee** : mutation `packLine(productMerged)` dans
   `orderRenewal.helpers.ts:155` -> `error TS2554: Expected 2 arguments, but
   got 1`, diagnostic nomme. Restaure.

3. **Un TROISIEME commentaire faux, trouve par le coordinateur, que ni
   l auteur ni la qa n avaient vu.** Le docblock de `toPackLine` decrivait
   encore `packCount` comme valant "`ONE_PACK` par defaut" alors que le round
   3 venait de le rendre obligatoire. Meme faute que les deux precedentes de
   ce lot — une propriete affirmee par un commentaire et non tenue par le code
   —, dans le fichier ecrit pour reparer cette faute, et une ligne au-dessus
   du paragraphe qui explique l obligation. Corrige, et le motif est ecrit :
   ce defaut a coute une regression et un tour de revue.

Gates apres durcissements : `pnpm typecheck` 0 erreur ; `pnpm test` 300
fichiers passes / 11 skip, **3063 tests passes / 86 skip, 0 echec**.
