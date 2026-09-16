---
id: BCP-10
epic: E10 (hors E10, chantier boutique) — "chaine des prix Magrit -> panier et qualite d affichage"
status: round 1 — qa-review distincte requise avant merge
branch: worktree-agent-a9e4a48a6b3612c3a (worktree isolé, depuis feat/gescom-e10-4-entite-client, HEAD au départ 907dc489)
depends_on: []
parallelisable_avec: [] — "lançable tout de suite" (cadrage §8.25 point 3.5), ne dépend ni de la campagne banc ni du contrat ; doit passer AVANT BCP-2
---
# BCP-10 — Alignement des deux parcours de configuration produit : la surcouche devient l unique surface, la fiche produit cesse de configurer

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **3.5** (commit
`907dc489`). Les cinq points laissés ouverts par Q12 y sont tranchés
explicitement et n ont pas été rouverts ici.

## Le défaut corrigé

`src/modules/catalog/ui/storefront/PortalProduct.tsx` portait ses propres
listes d options en dur (papier/finition/coins), son propre chiffrage
Clariprint (`calculatePrice`) et sa propre mise à l échelle proportionnelle
du prix (`priceHT * (qty / 500)`). Son bouton « Ajouter au panier » appelait
`onAddToCart(productWithPrice, 1, selectedOpts)` (troisième argument), reçu
par `addToCart(product, qty = 1)` (`PublicShop.tsx:176`, DEUX paramètres) —
la sélection de la fiche était donc **silencieusement jetée**, sans erreur
TypeScript (un appelant à deux paramètres est assignable à un type de
callback à trois : c est exactement ce qui a laissé passer le défaut).

L instruction de l architecte a montré que le défaut dépassait « l accueil » :
**cinq chemins d entrée sur six** vers un produit menaient à cette fiche
morte (accueil, page gamme, suggestions de Magrit, landing de catégorie,
recherche), et un seul (grille du catalogue) ouvrait déjà la bonne surface,
`ProductOverlay`.

## Ce que le cadrage tranche, repris tel quel

1. **La fiche produit survit** comme fiche descriptive, URL `/p/:id`
   indexable sur les boutiques `self_signup` — elle ne configure, ne chiffre
   et n ajoute plus rien elle-même.
2. **Le bloc mort est supprimé**, listes comprises. Les « coins » ne migrent
   PAS vers la surcouche : `cornerOptions` n existe nulle part ailleurs dans
   le dépôt (aucun code Clariprint connu) — les migrer créerait une option
   non chiffrable, interdit par Q3. Ils rejoignent la liste des options
   gelées.
3. **Valeur initiale de finition : `aucun`**, entrée réelle de `FINISHINGS`
   que `buildClariprintPayload` omet de la charge. `'Soft touch'`
   (`PortalProduct.tsx:46`) disparaît avec le bloc entier.
4. **`addToCart` garde sa signature à deux paramètres.** C est le troisième
   argument qui disparaît, pas un quatrième qui apparaît.
5. **La fiche adopte la règle de prix déjà écrite au point 4 (a)** du
   cadrage (`resolvePrice(product, product.config.clariprintQuote ?? null)`,
   prix sans badge pour `clariprint`/`library_cached`, badge « Prix marché »
   pour `prix_marche`, « Prix à la configuration » — jamais « 0 € » — pour
   `zero`). BCP-10 **crée** la fonction pure « résolution → texte + badge » ;
   BCP-4 la **consommera** sur la carte, le plancher et les suggestions.

## Ce qui n est PAS fait ici, sur instruction explicite

- **`DEFAULT_OPTIONS` de la surcouche** (`format: "A5"`, `paper: "135g"`,
  `ProductOverlay.helpers.ts:223-231`) — défaut de l écran cible, nommé mais
  **non corrigé** : relève du normaliseur de BCP-2 (point 3.2), qui attend la
  campagne d appels chez l imprimeur (BCP-1b). Corriger ici serait déborder.
- **Le normaliseur**, les deux formes imprévues de l audit des configurations
  (huit `kind` sans mappage, neuf `papers` non canoniques) — propriété de
  BCP-2.
- **`priceResolver.ts`, `gammeFloorPrices.ts`, `ShopProductCard.tsx`,
  `GammeTile.tsx`** — non touchés. Ils restent la propriété de BCP-4, qui
  consommera la fonction pure créée ici au lieu d en écrire une seconde
  copie.
- **`openapi/magrit-core.v1.yaml` et `docs/api/CONVENTIONS.md`** — non
  touchés. Motif écrit au cadrage point (k) : aucun endpoint ni schéma ne
  change, la configuration voyage dans un champ qui la porte déjà
  (`config.clariprintData`), le panier n a jamais été une ressource d API.

## Fichiers créés / modifiés

| Fichier | Nature du changement |
|---|---|
| `src/modules/catalog/ui/storefront/productPriceDisplay.ts` | **Créé.** Fonction pure `resolveProductPriceDisplay(resolution)` — « résolution → texte + badge », testée cas par cas. Ne touche pas `priceResolver.ts`. |
| `src/modules/catalog/ui/storefront/PortalProduct.tsx` | Réécrit : fiche descriptive seule (visuel, fil d Ariane, description, prix via `resolvePrice` + la fonction pure ci-dessus, un bouton « Configurer »). Bloc mort entier supprimé (listes en dur, `selectedOpts`, `setQty`, `calculatePrice`, `computeClariprintQuoteSafe`, mise à l échelle `qty/500`, bouton panier). Prop `onAddToCart` (3 args) remplacée par `onConfigure: (p: ShopProduct) => void`. |
| `src/modules/shops/ui/storefront/PublicShop.tsx` | **Hôte unique** de `ProductOverlay` (lazy, importé via l entrée publique `@/modules/catalog/ui/storefront`). Nouveaux : état `overlayProduct`, `onConfigure(product)`, `handleOverlayConfirm` (règle du paquet — qty = exemplaires, 1 paquet au panier — déplacée ici, retirée de `PortalCatalog.tsx`). `onConfigure` propagé à `PortalHome`, `PortalCatalog`, `GammePage`, `PortalProduct`. Reset de l overlay ajouté à l effet de changement de boutique (UM10.4). `addToCart` **inchangé** (toujours 2 paramètres). |
| `src/modules/catalog/ui/storefront/PortalCatalog.tsx` | Perd son `overlayProduct` local, son import lazy de `ProductOverlay`, sa règle du paquet dupliquée et sa prop `taxRate` (devenue inutile, plus consommée que par l ex-overlay local). Nouvelle prop requise `onConfigure`, câblée sur la carte de la grille, la landing et le bouton « Configurer » des suggestions de Magrit (résultats IA). |
| `src/modules/catalog/ui/storefront/PortalHome.tsx` | Nouvelle prop `onConfigure`, câblée sur `ShopProductCard` (section Nouveautés) à la place de `onSelectProduct`. |
| `src/modules/catalog/ui/storefront/gamme/GammePage.tsx` | Nouvelle prop `onConfigure`, câblée sur `ShopProductCard` (section « Produits de la gamme ») à la place de `onSelectProduct`. Le configurateur héros de la page (`GammeConfigurator`/`useProductConfigurator`) est une surface distincte, non touchée. |
| `src/modules/catalog/ui/storefront/PortalCategoryLanding.tsx` | Prop `onSelectProduct` renommée `onConfigure` (la tuile « Les plus demandés » n a pas de bouton séparé — le clic entier ouvre désormais la surcouche, conformément au point (b) qui nomme « landing » dans la liste des surfaces à bouton Configurer). |
| `src/modules/catalog/ui/storefront/index.ts` | `ProductOverlay` ajouté aux exports publics du barrel `storefront` (règle MUX0-MUX6 : un import inter-module doit passer par une entrée publique — `PublicShop`, module `shops`, en a désormais besoin). `resolveProductPriceDisplay` et ses constantes également exportées, pour BCP-4. |
| `src/shared/presentation/testIds.ts` | 3 nouveaux testid déclarés (`productPage`, `productPageConfigureBtn`, `productPagePrice`), aucun sur l ex-bloc d options (supprimé). |
| `tests/architecture/storefront-tax-boundary.test.ts` | Mis à jour : l assertion « `PortalCatalog` héberge `ProductOverlay` et lui injecte `taxRate` » devient « `PublicShop` héberge `ProductOverlay` (hôte unique) ; `PortalCatalog` ne l héberge plus » — c est exactement le changement d architecture demandé par BCP-10, pas un affaiblissement. |
| `tests/modules/catalog/productPriceDisplay.test.ts` | **Créé.** Tests unitaires cas par cas de la fonction pure. |
| `tests/components/shop/PublicShop.productConfigurationAlignment.test.ts` | **Créé.** Tests de régression texte (pattern déjà en usage dans ce dossier, `PublicShop.submitCart.test.ts`) sur le câblage entre composants — voir tableau mutation → test ci-dessous. |

## Critères d acceptation, un par un

| # | Critère | Statut | Preuve |
|---|---|---|---|
| 1 | La fiche produit survit comme fiche descriptive, URL `/p/:id` inchangée, indexable sur `self_signup` | Fait | `PortalProduct.tsx` conserve son rendu direct dans `PublicShop.tsx` sous `view === 'product'` ; aucune route touchée (`portal-routes.ts` non modifié) ; le `noindex` conditionnel de `PublicShop.tsx:150` n est pas touché |
| 2 | Bloc mort supprimé (listes, sélecteur qty, `calculatePrice`, ajout panier), coins gelés et non migrés | Fait | `PortalProduct.tsx` réécrit ; `cornerOptions` n apparaît nulle part dans le diff, ni dans `ProductOverlay.helpers.ts` (non touché) ; test `PublicShop.productConfigurationAlignment.test.ts` (bloc 1), preuve d échec sur l ancien code vérifiée par revert contrôlé |
| 3 | Valeur initiale de finition `aucun`, jamais `Soft touch` | Fait | `'Soft touch'` disparaît avec le bloc entier de `PortalProduct.tsx` ; la surcouche portait déjà `finishingFront: "aucun"` dans `DEFAULT_OPTIONS` (`ProductOverlay.helpers.ts:227`, non touché — c était déjà correct) |
| 4 | `addToCart` garde sa signature à deux paramètres, le 3e argument disparaît sans en ajouter un 4e | Fait | `PublicShop.tsx` : `const addToCart = (product: ShopProduct, qty = 1) => {` inchangé caractère pour caractère ; `PortalProduct.tsx` n a plus de prop `onAddToCart` du tout (remplacée par `onConfigure`) ; test dédié + `pnpm typecheck` vert (le compilateur est la preuve de fond, point (f) du cadrage) |
| 5 | La fiche adopte la règle de prix du point 4 (a) via une fonction pure créée par ce lot, consommable par BCP-4 sans qu il la récrive | Fait | `src/modules/catalog/ui/storefront/productPriceDisplay.ts` créé, `priceResolver.ts` non touché ; `PortalProduct.tsx` appelle `resolvePrice(product, product.config.clariprintQuote ?? null)` puis `resolveProductPriceDisplay(...)` ; 5 tests unitaires cas par cas |
| 6 | Hôte unique de la surcouche, les six chemins convergent (cinq corrigés, un déjà correct) | Fait | `PublicShop.tsx` monte `<ProductOverlay>` une seule fois (vérifié par `match(/<ProductOverlay/g)?.length === 1`) ; `PortalCatalog.tsx` ne l héberge plus ; `onConfigure` câblé sur `PortalHome`, `GammePage`, `PortalCategoryLanding`, le bouton Configurer des suggestions de Magrit et la fiche produit elle-même |
| 7 | Aucune modification d `openapi/magrit-core.v1.yaml` ni de `docs/api/CONVENTIONS.md` | Fait | `git status` : aucun de ces deux fichiers dans la liste des fichiers modifiés |
| 8 | Aucun contrôle métier posé uniquement côté navigateur | Fait | La règle du paquet (qty = exemplaires, 1 paquet au panier) n est qu une transformation d affichage/stockage local, déjà existante avant ce lot (elle ne calcule ni prix ni seuil) ; le chiffrage réel reste dans `useProductConfigurator`/Clariprint, non touché ; aucune nouvelle validation de seuil, quota ou numérotation introduite |
| 9 | Extension `.ts` sur les imports relatifs atteignables depuis une Edge Function | Sans objet | Aucun fichier créé/modifié par ce lot n est importé par une Edge Function (`supabase/functions/`) — tous les imports ajoutés sont des alias `@/modules/...`, aucun import relatif nouveau |
| 10 | Gates : `pnpm typecheck`, `pnpm test:architecture`, `pnpm test` (hors `product_mockups_isolation.test.ts`) | Fait | Voir « Gates exécutées » ci-dessous |

## Tableau mutation → test, avec preuve par revert contrôlé

Chaque ligne a été vérifiée en revertant le(s) fichier(s) concerné(s) à leur
version `HEAD` (commit `907dc489`, pré-BCP-10, via `git show HEAD:<fichier>
> <fichier>`), en exécutant le test visé, puis en restaurant la version
corrigée depuis une copie de sauvegarde (jamais de `git checkout`/`reset`
destructeur sur le worktree).

| # | Mutation (= régression au code d avant BCP-10) | Test qui la tue | Vérifiée par revert |
|---|---|---|---|
| M1 | `PortalProduct.tsx` réintroduit `paperOptions`/`finishOptions`/`cornerOptions`, `'Soft touch'`, `calculatePrice`, la mise à l échelle `qty/500` ou `computeClariprintQuoteSafe` | `PublicShop.productConfigurationAlignment.test.ts` — bloc « PortalProduct n a plus de bloc d options mort » | Oui — reverté sur `907dc489`, 2/2 assertions du bloc échouent (`Soft touch` et `calculatePrice`/`qty/500`/`computeClariprintQuoteSafe` présents) |
| M2 | `PortalProduct.tsx` réintroduit un `onAddToCart` à 3 paramètres (`opts: Record<string, string>`) ou `selectedOpts` | idem — bloc « le troisième argument d onAddToCart a disparu » | Oui — reverté, échoue (le fichier `907dc489` porte exactement `onAddToCart: (p: ShopProduct, qty: number, opts: Record<string, string>) => void`) |
| M3 | `PublicShop.tsx` perd son hôte unique de `ProductOverlay`, ou `PortalCatalog.tsx` réhéberge le sien | idem — bloc « PublicShop est l HÔTE UNIQUE de ProductOverlay » | Oui — reverté (les 5 fichiers de câblage ensemble sur `907dc489`), `publicShop.match(/<ProductOverlay/g)` est `null` (≠ 1) |
| M4 | `PortalHome.tsx`/`GammePage.tsx` recâblent `onConfigure={onSelectProduct}` (le défaut exact relevé par l architecte) | idem — bloc « les cartes des cinq autres surfaces ouvrent la surcouche » | Oui — reverté, `onConfigure={onSelectProduct}` présent dans les deux fichiers `907dc489` |
| M5 | `PortalCategoryLanding.tsx` revient à `onClick={() => onSelectProduct(p)}` sur la tuile bestseller | idem — même bloc | Oui — reverté, motif présent tel quel dans `907dc489` |
| M6 | `resolveProductPriceDisplay` confond une source `zero` avec un prix à 0, ou fait perdre le badge `prix_marche` à 0 | `productPriceDisplay.test.ts` — 5 cas (`clariprint`, `library_cached`, `prix_marche`, `prix_marche` à 0, `zero`) | Fonction nouvelle (pas de code « ancien » à reverter) ; la table de cas couvre explicitement le piège du branchement naïf sur `priceHT > 0` au lieu de `source === 'zero'` |
| M7 | `PortalCatalog.tsx` ré-exécute la règle du paquet localement (duplication d origine du défaut) | `storefront-tax-boundary.test.ts` — assertion `catalog.not.toContain('<ProductOverlay')` / `not.toContain('taxRate={taxRate}')` | Vérifiée par lecture (l assertion inverse était vraie sur `907dc489` : `PortalCatalog.tsx` y contient bien `<ProductOverlay` et `taxRate={taxRate}`) |
| M8 | Import direct de `ProductOverlay` par un chemin profond depuis un autre module (contournement de l entrée publique) | `tests/architecture/modular-ui-boundaries.test.ts` — « autorise uniquement les entrées publiques » | Oui — constatée en cours de lot : le premier essai (import profond `@/modules/catalog/ui/storefront/ProductOverlay` depuis `PublicShop.tsx`) faisait échouer ce test existant ; corrigé en passant par l entrée publique `@/modules/catalog/ui/storefront` |

## Gates exécutées

- `pnpm typecheck` — OK, aucune erreur (`tsc --noEmit -p tsconfig.modular.json`).
- `pnpm test:architecture` — **45 fichiers, 279 tests, OK.**
- `pnpm vitest run --maxWorkers=2 --exclude "**/tests/storage/product_mockups_isolation.test.ts"`
  (équivalent de `pnpm test` avec le seul écart toléré par la mission) —
  **298 fichiers passés, 10 skippés (préexistants) ; 3043 tests passés, 82
  skips (préexistants) ; 0 échec.**
- Les deux tests d architecture existants qui encodaient l ancienne
  architecture (`PortalCatalog` seul hôte de la surcouche) ont été mis à
  jour pour encoder la nouvelle (`storefront-tax-boundary.test.ts`) et un
  export public a été ajouté pour rester conforme à un troisième
  (`modular-ui-boundaries.test.ts`) — aucun test n a été affaibli, les deux
  ont été vérifiés en échec contre l ancien état puis en succès contre le
  nouveau.

## Dérogations R5

Aucune. Ce lot ne touche ni `openapi/`, ni une Edge Function, ni une
migration SQL, ni un secret.

## Gestes de recette navigateur (pour qa-review / recette humaine)

Repris du cadrage §8.25 point 3.5 (j), à jouer sur `/shop/eram`, **sans
aucun agent qui écrive dans la copie de travail servie** (règle du point
8.3 : Vite recharge tous les onglets de son serveur). Pas de merge sans
cette recette.

1. **Accueil** → bouton « Configurer » d une carte : la surcouche s ouvre
   sur place, l URL ne change pas.
2. **Accueil** → clic sur le corps de la même carte : arrivée sur
   `/shop/eram/p/<id>`, aucun bloc PAPIER/FINITION/COINS, un seul bouton
   primaire « Configurer ».
3. Sur cette fiche → « Configurer » : la même surcouche s ouvre par-dessus,
   l URL reste `/p/<id>`, fermer laisse sur la fiche.
4. Dans la surcouche : changer le papier, la quantité, attendre le
   recalcul, « Ajouter au panier » — la ligne de panier porte le papier et
   la quantité choisis (le geste décisif : c est exactement ce qui était
   jeté avant ce lot).
5. **Panier vidé d abord** (sinon `addToCart` fusionne par `product.id` et
   la comparaison devient illisible). Catalogue → même produit →
   « Configurer » → mêmes choix qu au geste 4 → ajouter : ligne identique
   (même papier, même quantité, même prix) — la preuve de l alignement.
6. Ouvrir la configuration depuis la page gamme, puis depuis une suggestion
   de Magrit (résultats IA) : la surcouche s ouvre dans les deux cas,
   jamais la fiche.
7. À chaque ouverture de la surcouche : aucune finition présélectionnée
   autre que `aucun`, aucune « Dorure », aucun « Soft touch », aucun bloc
   « Coins » nulle part.
8. Coller `/shop/eram/p/<id>` dans un onglet neuf : la fiche s affiche
   (visuel, fil d Ariane, description, prix d appel, bouton « Configurer »
   opérant).
9. Sur la fiche : le prix affiché n est jamais « 0 € » ; « Prix marché »
   porte son badge ; une source `clariprint`/`library_cached` n en porte
   pas.
10. Console pendant tout le parcours : zéro erreur, zéro avertissement.

**Deux pièges à ne pas manquer** : le retour de navigateur après le geste 3
ne doit pas empiler une entrée d historique ; le geste 5 doit être joué
panier vidé, sinon la fusion par `product.id` rend la comparaison illisible.

**Chaque rejouage crée une commande ERAM réelle si l on va jusqu à la
commande** ; la recette ci-dessus s arrête au panier.

## Ce qui reste ouvert (hors périmètre de BCP-10, sur instruction)

- Q13 (`DEFAULT_OPTIONS` de la surcouche invente `A5`/`135g`) — BCP-2.
- Les deux formes imprévues de l audit des configurations stockées — BCP-2.
- Le badge « Prix marché » sur la carte catalogue, le plancher de gamme et
  les suggestions de Magrit — BCP-4, qui consommera
  `resolveProductPriceDisplay` créée ici.
