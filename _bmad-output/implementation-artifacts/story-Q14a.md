---
story_id: Q14-a
epic: Sprint 5 — chantier boutique « chaîne des prix Magrit → panier et qualité d'affichage » (hors E10, docs/api/CONVENTIONS.md §8.25)
title: Bouton "+ Panier" désactivé et grisé quand le prix n'est pas ferme (C2 seule)
status: round 3 — corrections D4/D5 + six inexactitudes documentaires round 2 corrigées, en attente de nouvelle qa-review distincte
branch: feat/gescom-q14a-ajout-direct-grise
base_round1: worktree-agent-a36fe9d0d75f6af4a (3448193b) = main (f7326363) + docs/api/CONVENTIONS.md §8.25 réécrit le 2026-09-17
base_round2: worktree-agent-a36fe9d0d75f6af4a (c5e07929) = base_round1 + amendements architecte du 2026-09-17 (D1, D2, réserves, (g)/Q17)
base_round3: HEAD 796dace8 (round 2, commité)
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 3.7 (a) à (g), point 6 (ligne Q14-a), point 9 (ligne Q14)
commits: [f0f891d0 (round 1), 796dace8 (round 2), 8787d757 (round 3)]
---

# Story Q14-a — bouton "+ Panier" grisé quand le prix n'est pas ferme

## ROUND 3 — corrections après rejet qa-review (D4, D5, six inexactitudes documentaires)

Le round 2 (commit `796dace8`) a été **rejeté** sur deux défauts courts, tout en confirmant que D1 et D2 étaient corrigés sur le fond, que W1-W6 mouraient chacune sur un test nommé, que les trois réserves durcies mouraient, que le rendu vu par l'acheteur était juste dans les quatre cas de figure du bandeau, et que les chiffres (3172 / 88 / 0) étaient exacts.

**DÉFAUT D4 (bloquant, corrigé)** — `collectPriceNotFirmProductNames` **recopiait** le critère C2 (`source === 'clariprint' || source === 'library_cached'`) au lieu d'**appeler** `canAddAsIs`, alors que le commentaire prétendait (faussement) que la réserve `priceHT <= 0` était « comprise ». Un devis Clariprint réussi à `priceHT: 0` faisait grisouiller le bouton de la carte (`canAddAsIs` → `price-not-firm`) sans avertir l'acheteur au renouvellement (`collectPriceNotFirmProductNames` → `[]`). **Corrigé exactement selon les cinq points prescrits par le coordinateur** : `canAddAsIs` exporté depuis l'entrée publique `@/modules/catalog/ui/storefront` (une ligne ajoutée à `index.ts`, seul fichier hors de la ligne Q14-a du point 6 que je touche, autorisé explicitement) ; le hook importe et appelle cette même fonction ; le commentaire menteur est réécrit ; un test « devis à `priceHT: 0` → nom listé » a été écrit, vérifié ROUGE sur `796dace8`, puis vert après le fix.

**DÉFAUT D5 (bloquant, corrigé)** — mon garde d'épinglage (D2, round 2) lisait le texte BRUT des fichiers sources, commentaires compris : une ligne commentée (`// disabled={...}`) contient toujours, comme sous-chaîne, le motif que ma regex cherchait — le test restait vert alors que l'attribut réel avait disparu. Même faille pour un spread mis en commentaire de bloc, un `id` déplacé vers un élément conteneur, une constante figée à `null`, et un `merged` reversé dans `renewalWarnings` qui réintroduit D1. **Corrigé** : `read()` retire désormais les commentaires (bloc et ligne) avant toute recherche de motif ; deux assertions sont resserrées pour ne plus matcher n'importe où dans le fichier (`id` rattaché au `<p>` du libellé, `clariprintQuote` rattaché à une déclaration dérivée de `product.config`) ; une assertion positive ET négative ferme le cas du `merged`. Les cinq évasions (E1, E1b, E6, E7, E9) ont été rejouées par moi, une par une, ROUGE ; W1 à W6 (les mutations originales, pas les évasions) ont été rejouées à nouveau avec le garde durci : toujours ROUGE.

**Six inexactitudes du story doc round 2 corrigées** — détaillées à l'endroit de chacune ci-dessous, avec la mention explicite « ROUND 3 » : le commit `796dace8` avait été nié (répétition du défaut D3 du round 1) ; le critère 15 était périmé (le `onClick` de « Configurer » est modifié, autorisé, et neuf fichiers sous `src/` bougent au total round 1+2+3) ; le critère 2 était périmé (la garde `priceHT <= 0` change la frontière) ; le critère 10 affirmait à tort qu'une divergence demandait deux lignes séparées (W3/E6 la produisent en une seule) ; la mutation « reverser dans `renewalWarnings` » décrite au round 2 n'était pas celle réellement rejouée (j'avais joué une mutation voisine, W6a, pas W6b) ; et le commentaire du hook affirmait la réserve `priceHT <= 0` « comprise » sans l'être (D4).

Deux ajouts non déclarés au round 2 sont documentés ici, tolérés par la qa mais qu'il fallait nommer : dans `PortalCart.tsx`, l'import de `renewalBannerSections` et la constante `renewalSections` (nécessaires pour appeler la fonction pure, hors de la lettre stricte du (c-bis) qui ne prescrivait que « le type de props et le bloc du bandeau », mais indissociables de ce bloc). Et l'ajout round 3 dans `src/modules/catalog/ui/storefront/index.ts`, explicitement autorisé par le coordinateur pour D4.

**Non bloquant, signalé sans être corrigé (consigne du coordinateur)** :
- Si l'acheteur retire une ligne du panier après un renouvellement, la section « prix non définitif » du bandeau continue de lister le nom de cette ligne jusqu'au prochain renouvellement ou à la fermeture du bandeau — `renewalPriceNotFirm` n'est recalculé qu'à ces deux moments, jamais sur un retrait de ligne.
- Un produit sans nom (`product.name === ''`) produit une puce vide dans la section « prix non définitif » — `renewalBannerSections`/`collectPriceNotFirmProductNames` ne filtrent ni ne substituent un libellé de repli.

## ROUND 2 — corrections après rejet qa-review

La qa-review distincte a **rejeté** le round 1 sur deux défauts bloquants (D1, D2) et une inexactitude documentaire (D3), tout en confirmant que les fonctions pures, les quatre mutations du cadrage, le typecheck et la suite complète étaient corrects. Résumé des corrections apportées dans ce round (détail dans les sections dédiées ci-dessous, insérées à l'endroit pertinent) :

- **D1 (bloquant, corrigé)** — le bandeau de renouvellement titrait TOUT « N produit(s) indisponible(s) (non ajouté(s) au panier) », y compris les lignes de prix non ferme pourtant bien ajoutées. Le cadrage (point 3.7 (c-bis), nouveau) sépare en deux canaux (`renewalWarnings` / `renewalPriceNotFirm`) et deux sections rendues par une fonction pure (`renewalBannerSections`, `orderRenewal.helpers.ts`). Voir section « D1 ».
- **D2 (bloquant, corrigé)** — le câblage entre les fonctions pures et le JSX n'était lu par aucun test : six mutations de la qa-review (W1-W6) survivaient. Un fichier de tests texte sur les sources (`tests/components/shop/ShopProductCard.addAsIsWiring.test.ts`) épingle désormais ce câblage, W1-W6 (adaptées) rejouées au rouge. Voir section « D2 ».
- **Réserves de la qa-review, tranchées par l'architecte** — `canAddAsIs` échoue désormais aussi quand `priceHT <= 0` (quelle que soit la source) ; `onConfigure` devient obligatoire dans `ShopProductCardProps`, le repli sur `onAddToCart` est supprimé.
- **Correction d'une affirmation fausse (point 3.7 (a)/(g) du cadrage, barrée par l'architecte)** — l'en-tête de `addAsIs.ts` affirmait que « la fermeté du prix est établie côté serveur au moment du chiffrage ». C'est faux : le serveur accepte le prix envoyé par le navigateur, zéro compris. Corrigé dans le fichier et dans ce document. Le serveur n'est pas corrigé par ce lot (Q17, remontée à Arnaud).
- **Réserve non bloquante appliquée** — `isFirmPriceSource` est une liste blanche explicite, testée y compris avec une source hors énumération forgée par `as`.
- **D3 (inexactitudes documentaires, corrigées)** — voir section « D3 » : le compte de suppressions dans `ShopProductCard.tsx`, l'état des commits et la comparaison des skips ont été refaits avec les commandes réellement exécutées.

Toutes les affirmations du round 1 ci-dessous qui ne sont PAS annotées « ROUND 2 » restent valides et n'ont pas été rejouées inutilement — sauf quand une correction les traverse, auquel cas la correction est insérée au même endroit avec la mention explicite du round.

## Arbitrage d'Arnaud opposable (2026-09-17, verbatim)

> « Pour le bouton panier "grisé" si le produit n'est pas chiffré. »

Ce round RETOURNE la décision de l'architecte du 2026-09-16 (« le bouton n'est pas rendu »). Le cadrage réécrit le point 3.7 en conséquence — c'est le document qui fait foi, pas cette story. Aucune décision n'a été reprise ici : uniquement implémentée.

## Périmètre — Q14-a seulement

Condition **C2** (prix ferme, `resolvePrice(...).source ∈ {clariprint, library_cached}`) seule. **C1** (configuration chiffrable) dépend du normaliseur de BCP-2, non livré (dépend de la campagne d'appels réels chez l'imprimeur, non jouée) : **non implémentée ici**, conformément au découpage du cadrage. La signature et le libellé du motif `'config-incomplete'` (réservé à Q14-b) sont posés dès maintenant pour que Q14-b n'ait rien à réécrire.

## Fichiers créés

**Round 1 :**
- `src/modules/catalog/ui/storefront/addAsIs.ts` — `AddAsIsReason`, `AddAsIsEligibility`, `ADD_AS_IS_REASON_LABELS` (table fermée), `canAddAsIs(product, quote)`, `addToCartButtonState(eligibility, reasonId)`. Toutes fonctions pures.
- `tests/modules/catalog/addAsIs.test.ts` — 14 tests unitaires round 1, **19 après round 2** (réserves + liste blanche).
- `tests/app/hooks/useStorefrontOrderLifecycle.test.ts` — 6 tests unitaires round 1 sur `buildPriceNotFirmWarnings` (fonction **renommée et modifiée** en round 2, voir D1).

**Round 2 (nouveau) :**
- `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts` — 13 tests, correction du défaut D2 : assertions texte sur les sources (`ShopProductCard.tsx`, `useStorefrontOrderLifecycle.ts`, `PortalCart.tsx`, `PublicShop.tsx`) épinglant le câblage entre les fonctions pures et le JSX.

## Fichiers modifiés

**Round 1 :**
- `src/modules/catalog/ui/storefront/ShopProductCard.tsx` — round 1 : uniquement la zone du bouton « + Panier » (`data-testid={TEST_IDS.shop.productCardQuoteBtn}`) et l'ajout de l'élément de motif immédiatement après la rangée de boutons. Ni le bouton « Personnaliser », ni le bloc prix (territoire BCP-4) ne sont touchés. **Correction D3** : l'affirmation round 1 « uniquement des insertions » était fausse — le commit `f0f891d0` porte, sur ce fichier, **63 insertions(+) et 3 deletions(-)** (`git show f0f891d0 --stat`, vérifié). Les 3 lignes réellement supprimées (`git show f0f891d0 -- ShopProductCard.tsx | grep '^-'`, vérifié) : l'import React (`import { useMemo } from "react";`, remplacé par l'import incluant `useId`), l'ancien commentaire du bouton « + Panier » (remplacé par un commentaire plus long), et l'ancienne ligne `className` littérale du bouton (remplacée par le ternaire actif/désactivé). Aucune de ces trois ne touche au bouton « Configurer », à « Personnaliser » ni au bloc prix.
- `src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts` — round 1 : ajout de `buildPriceNotFirmWarnings`. **Round 2** : fonction renommée `collectPriceNotFirmProductNames`, ne rend plus que les NOMS (plus des phrases), et alimente un état séparé `renewalPriceNotFirm` (voir D1).
- `src/shared/presentation/testIds.ts` — round 1 : une clé ajoutée en fin du bloc `shop` : `productCardAddAsIsReason: 'product-card-add-as-is-reason'`. **Round 2** : deux clés de plus, `cartRenewalNotAddedSection` et `cartRenewalPriceNotFirmSection` (valeurs fixées par l'architecte, point 3.7 (c-bis)).

**Round 2 (nouveau ou étendu) :**
- `src/modules/orders/ui/storefront/orderRenewal.helpers.ts` — nouvelle fonction pure `renewalBannerSections(notAdded, priceNotFirm)` (D1).
- `src/modules/orders/ui/storefront/PortalCart.tsx` — le type de props (`renewalPriceNotFirm` ajouté), le bloc du bandeau S3.3 (D1), **et deux ajouts hors de la lettre du (c-bis), indispensables** : la ligne d import de `renewalBannerSections` et `const renewalSections = …` dans le corps du composant. Ni lignes, ni totaux, ni budget, ni format. *(Corrigé par le coordinateur : cette phrase disait « seulement … rien d autre », ce qui contredisait la section Fichiers.)*
- `src/modules/shops/ui/storefront/PublicShop.tsx` — **seulement** la transmission de `renewalPriceNotFirm` (destructure du hook + prop passée à `PortalCart`), 4 lignes ajoutées, aucune ligne retirée (`git diff --stat`).
- `src/modules/catalog/ui/storefront/ShopProductCard.tsx` (suite) — `onConfigure` devient un prop obligatoire, repli sur `onAddToCart` supprimé (réserve qa-review).
- `src/modules/catalog/ui/storefront/ShopProductCard.typecheck.ts` — assertion de compilation ajoutée : un objet de props sans `onConfigure` ne doit plus satisfaire `ShopProductCardProps`.
- `src/modules/catalog/ui/storefront/addAsIs.ts` — en-tête corrigé (phrase fausse retirée, voir plus bas) ; `canAddAsIs` échoue si `priceHT <= 0` ; nouvelle fonction `isFirmPriceSource` (liste blanche explicite, réserve non bloquante).
- `tests/components/shop/portal/orderRenewal.helpers.test.ts` — 7 tests ajoutés pour `renewalBannerSections` (11→18, `grep -c "  it("` vérifié), dont le scénario exact demandé par la qa-review (1 produit retiré + 2 prix non fermes).

**Round 3 (nouveau, défauts D4 et D5) :**
- `src/modules/catalog/ui/storefront/index.ts` — **une ligne ajoutée** : `export { canAddAsIs } from './addAsIs';`. Seul fichier hors de la ligne Q14-a du point 6 du cadrage que je touche, **explicitement autorisé par le coordinateur** pour corriger D4 (le garde d'architecture refuse l'import direct de `addAsIs.ts` depuis `orders`).
- `src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts` (suite) — `collectPriceNotFirmProductNames` appelle désormais `canAddAsIs` (importé depuis `@/modules/catalog/ui/storefront`) au lieu de retester la source ; commentaire menteur corrigé.
- `tests/app/hooks/useStorefrontOrderLifecycle.test.ts` — 1 test ajouté (6→7) : « devis Clariprint réussi à `priceHT: 0` → le NOM est listé ».
- `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts` — `read()` retire désormais les commentaires avant de chercher un motif (défaut D5) ; deux assertions resserrées (W3 : `id` rattaché au `<p>`, pas n'importe où ; W4 : `clariprintQuote` dérivé de `product.config`, pas figé) ; une assertion positive/négative ajoutée sur `setRenewalWarnings(warnings)` (évasion E9). Effectif inchangé (13 tests), contenu durci.

## Critères vérifiés un par un

1. **Le bouton « + Panier » est TOUJOURS rendu**, jamais absent, sur toutes les surfaces de carte (`ShopProductCard` est partagé par accueil/catalogue/gamme). — **FAIT.** Le JSX ne conditionne plus la présence du bouton, seulement son attribut `disabled` et sa classe. Vérifié par lecture du diff : le `<button>` reste un unique nœud toujours rendu.

2. **Actif quand `resolvePrice(product, quote).source ∈ {clariprint, library_cached}`.** — **FAIT au round 1, PÉRIMÉ depuis (ROUND 2/3, correction du critère).** « Exactement dans ces deux cas » n'est plus vrai depuis la réserve `priceHT <= 0` (round 2) : `canAddAsIs` rend `{ ok: true }` quand la source est `clariprint` OU `library_cached` **ET** `priceHT > 0`. Un devis `clariprint` réussi à `priceHT: 0` échoue désormais (testé, `addAsIs.test.ts`). Formulation correcte : actif quand `isFirmPriceSource(resolution.source) && resolution.priceHT > 0`.

3. **Désactivé par l'attribut natif `disabled`, jamais `aria-disabled` seul, quand le prix n est pas ferme : source `prix_marche` ou `zero`, OU prix `priceHT <= 0` quelle que soit la source (devis Clariprint réussi à 0 € compris).** — **FAIT.** `addToCartButtonState` rend `disabled: true` dans ce cas, posé sur l'attribut React natif `disabled={addToCartState.disabled}`. Aucune garde manuelle de clic n'a donc à être écrite : un bouton `disabled` natif ne déclenche pas `onClick`.

4. **Grisé par les jetons atténués EXISTANTS, aucun jeton de couleur nouveau.** — **FAIT.** Classe conditionnelle utilisant `border-line` (border « très fine », déjà défini dans `tokens.css`) et `text-ink-muted` (déjà utilisé ailleurs dans ce même composant — description, mention « / N ex. », badges FSC). Contraste calculé (pas mesuré au navigateur, calcul manuel WCAG) : `#52525B` sur `#FFFFFF` (thème clair) ≈ **7,7:1** ; `#A1A1AA` sur `#111113` (thème sombre) ≈ **7,35:1**. Les deux dépassent le seuil de 4,5:1 exigé par le cadrage. **Mesure au vrai navigateur non faite par moi** (hors de mon accès) — mentionnée comme recette au coordinateur, mais le calcul mathématique sur les tokens déclarés donne une marge large.

5. **Même géométrie que le bouton actif, aucun décalage de mise en page.** — **FAIT.** Seules les classes de couleur/bordure/curseur changent ; libellé, padding, taille de police et position dans la rangée sont identiques dans les deux branches du ternaire.

6. **Motif écrit en PERMANENCE sous la rangée de boutons, jamais au survol/focus, jamais masqué aux petites largeurs, absent quand le critère est rempli, aucun `title`.** — **FAIT.** Le `<p>` est un enfant conditionnel simple (`{addToCartState.label && (...)}`), sans classe `hidden`/`opacity-0`/`sm:*`, positionné immédiatement après le conteneur des boutons dans le même conteneur `flex-col`. Aucun attribut `title` ajouté.

7. **Libellé exact « Configurez ce produit pour obtenir son prix définitif. » pour `price-not-firm`.** — **FAIT.** Chaîne testée mot pour mot (`addAsIs.test.ts`, « le libelle de price-not-firm est EXACTEMENT la chaine du cadrage »).

8. **Libellé de `config-incomplete` déjà fixé pour Q14-b.** — **FAIT.** Présent dans `ADD_AS_IS_REASON_LABELS`, testé, mais **jamais produit par `canAddAsIs` aujourd'hui** (Q14-a ne rend que `price-not-firm`).

9. **Table fermée : un motif sans libellé ne compile pas.** — **FAIT** par construction TypeScript (`Readonly<Record<AddAsIsReason, string>>`) ; `pnpm typecheck` (`tsconfig.modular.json`, strict) confirme.

10. **Accessibilité : `aria-describedby` sur le bouton désactivé, pointant un identifiant unique par INSTANCE de carte (pas seulement par produit) ; `aria-label` inchangé ; aucun `title`.** — **FAIT, mais une phrase de la justification round 1/2 était fausse (ROUND 3, correction du critère, défaut D5).** `useId()` (React 18, déjà utilisé ailleurs dans le dépôt — `ShopMegaMenu.tsx`) génère un identifiant stable et unique par position dans l'arbre de rendu, donc distinct entre deux instances simultanées de la même carte produit. J'affirmais que « les deux ne peuvent pas diverger sans modifier visiblement deux lignes séparées » : **c'est faux**, la qa-review l'a démontré avec deux mutations d'**une seule ligne chacune** (W3 : `id={`reason-${product.id}`}` sur le `<p>`, forme jouée par la qa-review ; E6 : déplacement de `id={addAsIsReasonId}` du `<p>` vers le `<div>` conteneur des boutons et du prix). Ce n'est **pas une garantie structurelle** : c'est un test dédié (`W3` de `ShopProductCard.addAsIsWiring.test.ts`, durci en round 3 pour exiger `<p\s+id=\{addAsIsReasonId\}` et non n'importe quel `id=\{addAsIsReasonId\}` dans le fichier) qui tient ce comportement, comme toute autre propriété du câblage. `aria-describedby` n'est posé QUE quand `addToCartState.describedBy` est défini (spread conditionnel) — absent sur un bouton actif.

11. **`data-testid` : `productCardQuoteBtn` conservé tel quel (pas renommé) ; nouvelle clé `productCardAddAsIsReason` déclarée dans `testIds.ts`, jamais écrite en dur dans le composant ; élément du motif porte `data-reason`.** — **FAIT.**

12. **`canAddAsIs` est une fonction pure dans `src/modules/catalog/ui/storefront/addAsIs.ts`** (et non `src/modules/clariprint/application/`, qui n'existe pas encore), **signature `(product, quote) => {ok:true}|{ok:false,reason}`**, ne rend pour l'instant que `'price-not-firm'`. — **FAIT**, conforme à la précision du 2026-09-17 du cadrage sur l'emplacement.

13. **`addToCartButtonState` est une seconde fonction pure séparée**, fournissant tout ce que le JSX pose sur le bouton et sous lui ; **le composant ne choisit aucun texte, ne lit ni `reason` ni `source`.** — **FAIT.** Vérifié par lecture : le JSX ne fait que `addToCartState.disabled`, `addToCartState.describedBy`, `addToCartState.label`, `addToCartState.reason` (pour `data-reason` seul, jamais pour choisir un texte).

14. **Renouvellement de commande : C1 réputée remplie sans réévaluation (comportement INCHANGÉ, pas recodé), C2 n'hérite pas et ne bloque pas ; une ligne dont le prix re-résolu n est pas ferme — source `prix_marche` ou `zero`, OU `priceHT <= 0` quelle que soit la source, soit exactement le verdict `price-not-firm` de `canAddAsIs` — produit un avertissement, un par ligne.** — **FAIT, mais le canal a changé en round 2 (défaut D1).** `rebuildCartFromOrderItems` n'a pas été touché (le matching et la reconstruction des lignes restent identiques, aucune barrière ajoutée). **Round 1** fusionnait les avertissements de prix dans `renewalWarnings`, dont le titre affiché par `PortalCart` (« N produit(s) indisponible(s), non ajouté(s) au panier ») **contredisait le fait que ces lignes avaient bien été ajoutées** — défaut D1, bloquant, relevé par la qa-review. **Round 2 (point 3.7 (c-bis)) : deux canaux séparés.** `collectPriceNotFirmProductNames` (renommée depuis `buildPriceNotFirmWarnings`) rend maintenant les NOMS seuls (pas des phrases), exposés dans un état séparé `renewalPriceNotFirm`. `renewalBannerSections` (nouvelle fonction pure, `orderRenewal.helpers.ts`) compose les DEUX sections du bandeau — titre exact fixé par le cadrage pour chacune, jamais composé dans `PortalCart`. Voir section « D1 » ci-dessous pour le détail complet et les mutations rejouées.

15. **Aucun empiètement hors périmètre non autorisé** : bouton « Personnaliser », bloc prix (BCP-4), `openapi/magrit-core.v1.yaml` non touchés. — **PÉRIMÉ au round 1 (« 3 fichiers modifiés »), CORRIGÉ ici (ROUND 3).** Round 1 affirmait « bouton Configurer non touché » et « 3 fichiers modifiés » : les deux sont faux depuis le round 2 et le contredisent déjà à la ligne 60 de ce document (`onConfigure` obligatoire touche le `onClick` du bouton « Configurer », changement **autorisé** par la réserve de la qa-review — le libellé, la position et le style du bouton ne changent pas). Au round 3, **neuf fichiers sous `src/` bougent au total** (round 1+2+3 cumulés : `ShopProductCard.tsx`, `ShopProductCard.typecheck.ts`, `addAsIs.ts`, `useStorefrontOrderLifecycle.ts`, `PortalCart.tsx`, `orderRenewal.helpers.ts`, `PublicShop.tsx`, `testIds.ts`, `catalog/ui/storefront/index.ts`), tous attendus par le point 6 du cadrage à l'exception du dernier, **explicitement autorisé par le coordinateur** pour D4. Ni « Personnaliser » ni le bloc prix (BCP-4) ne sont touchés, vérifié par relecture ligne à ligne des diffs cumulés.

16. **BCP-11 (garde `CartLine`) reste vert** — aucune ligne de panier construite à la main, `packLine`/`toPackLine` intacts. — **FAIT**, non touché ; `tests/architecture/cart-line-single-constructor.test.ts` passe (voir suite complète).

17. **`pnpm typecheck` et la suite complète, chiffres réels, échecs compris.** — **FAIT**, voir section Tests ci-dessous.

18. **(ROUND 2) Le câblage entre les fonctions pures et le JSX est épinglé par un test qui rougit si on le casse (défaut D2).** — **FAIT.** Voir section « D2 » : six mutations (W1-W6, adaptées à ce round pour W6) rejouées au rouge contre `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts`.

19. **(ROUND 2) Un devis Clariprint réussi à `priceHT: 0` échoue toujours, quelle que soit la source (réserve tranchée par l'architecte).** — **FAIT.** `canAddAsIs` retourne `price-not-firm` dès que `resolution.priceHT <= 0`, avant même de consulter la source. Testé, mutation rejouée (section « Mutations round 2 »).

20. **(ROUND 2) `onConfigure` devient obligatoire, le repli sur `onAddToCart` disparaît (réserve tranchée par l'architecte).** — **FAIT.** `ShopProductCardProps.onConfigure` n'est plus optionnel ; les trois appelants (`PortalCatalog.tsx`, `PortalHome.tsx`, `GammePage.tsx`) le passaient déjà, confirmé par `pnpm typecheck` à 0 erreur immédiatement après le changement (aucun site d'appel à modifier). Assertion de compilation ajoutée dans `ShopProductCard.typecheck.ts`, mutation rejouée (un retour à `onConfigure?:` fait échouer `pnpm typecheck` à deux endroits distincts, voir section dédiée).

21. **(ROUND 3) Le verdict de fermeté de prix consommé au renouvellement est le MÊME que celui de la carte — appelé, jamais recopié (défaut D4).** — **FAIT.** `collectPriceNotFirmProductNames` appelle `canAddAsIs` (importé depuis `@/modules/catalog/ui/storefront`, entrée publique déjà utilisée par `orders`). Un devis Clariprint réussi à `priceHT: 0` est désormais listé au renouvellement, comme sur la carte. Test écrit, vérifié ROUGE sur le code d'avant (`796dace8`), vert après correction.

22. **(ROUND 3) Le garde d'épinglage du câblage (D2) résiste au code commenté et aux évasions structurelles (défaut D5).** — **FAIT.** `read()` retire les commentaires avant recherche de motif. Cinq évasions (E1 : `disabled` commenté ; E1b : spread `aria-describedby` en commentaire de bloc ; E6 : `id` déplacé vers le conteneur ; E7 : `clariprintQuote` figé à `null` ; E9 : `merged` reversé dans `renewalWarnings`) rejouées par moi, ROUGE chacune. W1 à W6 (mutations originales) rejouées avec le garde durci : toujours ROUGE.

## Ce que Q14-a n'empêche PAS (rappel opposable, point 3.7 (a)/(g) du cadrage)

**ROUND 2 — CORRECTION D'UNE AFFIRMATION FAUSSE.** Le round 1 de ce document affirmait : *« La fermeté du prix reste établie côté serveur au moment du chiffrage. »* **C'est faux, et la qa-review de round 1 l'a démontré** (constat vérifié par l'architecte, point 3.7 (g) du cadrage, barré et corrigé le 2026-09-17) :

- `submitCart` envoie un `unitPriceHt` **calculé dans le navigateur** par `resolveCartLinePricing` (`useStorefrontOrderLifecycle.ts`).
- La fonction serveur `api_create_storefront_order` (**une seule définition dans le dépôt**, `20260817000100_storefront_order_identity.sql`) **refuse seulement `unit_price_ht < 0`**, puis calcule `line_total_ht` et `total_ht` à partir du prix REÇU. Aucun rapprochement avec `product_library.price_ht` ni `shop_product_pricing`.
- **Un acheteur avec une session boutique valide peut, par un appel direct à l'API, créer ou modifier une commande à n'importe quel prix positif ou nul, zéro compris.** Le bouton grisé n'y peut rien, et ne l'a jamais pu.
- **Atténuation réelle, mais partielle** : la commande naît `draft`, réservée à la validation de l'atelier (`can_validate` ou administrateur), qui voit le total HT — mais rien ne lui signale qu'un prix diffère du catalogue. L'atelier repose sur son propre jugement.

C'est **la même dette** que celle déjà connue sur le prix d'une ligne de projet repris du navigateur (§8.6 p7 du cadrage), sur une seconde surface — celle de l'acheteur externe, plus exposée. **Ce lot ne la corrige pas** : le cadrage la nomme, l'affecte à une question ouverte (**Q17**, point 9), et précise explicitement que ce n'est pas le territoire de Q14-a. J'ai corrigé l'en-tête de `addAsIs.ts` en conséquence (voir diff plus haut).

Ce que Q14 reste, correctement décrit : ce n'est **pas** un contrôle métier ni une garantie de prix. `canAddAsIs` est une **affordance d'interface** : elle cesse de proposer un geste que l'interface juge imprudent — elle ne l'empêche à aucun niveau serveur, et ne l'a jamais empêché. **Rien n'empêche** :
- un appel direct à l'API de création de commande avec les mêmes données qu'un ajout « tel quel » aurait envoyées (aucune barrière serveur nouvelle n'est créée par ce lot, et aucune n'existait avant — et, on le sait maintenant, aucune n'existait non plus pour le geste que Q14-a conditionne) ;
- un bouton HTML forgé ou un DOM modifié par les DevTools qui retirerait l'attribut `disabled`.

Ce lot ne crée et ne modifie aucune règle serveur, et ne corrige pas celle qui existe. C'est la limite honnête de toute affordance d'interface de ce dépôt.

## Dérogations R5

**Aucune.** Ce lot n'a nécessité aucune dérogation aux règles R1-R8 : pas de nouvel endpoint (donc pas de question OpenAPI), pas de nouvelle table, pas de composant appelant Supabase.

## Mutations exigées par le cadrage (point 3.7 (b-ter) 4) — rejouées une par une

Méthode : sur le code sain (14 tests verts dans `addAsIs.test.ts` après ajout du test manquant décrit ci-dessous), j'introduis la mutation, relance `pnpm vitest run tests/modules/catalog/addAsIs.test.ts`, note le verdict et l'assertion qui meurt, puis restaure le fichier original avant la mutation suivante.

| # | Mutation | Verdict | Assertion qui meurt |
|---|---|---|---|
| 1 | `addToCartButtonState` : forcer `disabled: false` sur la branche d'échec | **ROUGE** | `addToCartButtonState — point 3.7 (b-bis) 2 > echec -> disabled: true, describedBy EGAL a l identifiant passe, label EGAL a la table` — `expected { disabled: false, … } to deeply equal { disabled: true, … }` |
| 2 | `addToCartButtonState` : retirer `describedBy` du retour d'échec | **ROUGE** | 2 tests meurent : le même test que la mutation 1 (`describedBy` absent au lieu de l'identifiant attendu) ET `deux instances de la meme carte recoivent deux identifiants distincts, non recycles` (`expected undefined not to be undefined`) |
| 3 | `addToCartButtonState` : remplacer `ADD_AS_IS_REASON_LABELS[eligibility.reason]` par le littéral `'Configurez ce produit pour obtenir son prix définitif.'` | **SURVIT d'abord** (13/13 verts) avec la seule suite écrite au premier passage — **constat honnête, pas maquillé** : aucun test n'exerçait `addToCartButtonState` avec le motif `'config-incomplete'`, donc rien ne distinguait la table d'un littéral figé sur l'unique motif que Q14-a produit. **Test ajouté** (`lit REELLEMENT la table (motif config-incomplete -> son propre libelle, pas celui de price-not-firm)`), qui passe sur le code sain (14/14 verts). Mutation rejouée : **ROUGE** — `expected 'Configurez ce produit pour obtenir so…' to be 'Configurez ce produit pour préciser s…'` |
| 4 | `canAddAsIs` : ajouter `resolution.source === 'prix_marche'` à la condition `ok: true` (laisser `prix_marche` passer) | **ROUGE** | 3 tests meurent : `source prix_marche (heuristique, aucun cache) -> price-not-firm`, `produit a price_ht = 0 sans devis (source resolue prix_marche) -> price-not-firm`, `un quote Clariprint en echec (success: false) retombe sur le prix marche -> price-not-firm` |

**La mutation 3 est le résultat le plus important de ce tour** : elle a d'abord SURVÉCU, exactement le cas que la consigne 6 demande de traiter comme « un test à écrire ». Je l'ai écrit avant de continuer, je ne l'ai pas signalé comme acquis avant de l'avoir effectivement rejoué au rouge.

**ROUND 2 — les quatre mutations ci-dessus ont été REJOUÉES contre le code round 2** (la logique de `canAddAsIs` a changé : garde `priceHT <= 0` ajoutée, extraction dans `isFirmPriceSource`). Verdicts, sur `tests/modules/catalog/addAsIs.test.ts` (19 tests sur le code sain avant chaque mutation) :

| # | Mutation rejouée round 2 | Verdict | Détail |
|---|---|---|---|
| 1 | `disabled: false` en dur sur l'échec | **ROUGE** | 1/19 échoue (même assertion qu'en round 1) |
| 2 | retirer `describedBy` | **ROUGE** | 2/19 échouent (mêmes deux tests qu'en round 1) |
| 3 | table remplacée par le littéral `'price-not-firm'` | **ROUGE** | 1/19 échoue (`lit REELLEMENT la table…`) |
| 4 | laisser `prix_marche` passer (ajouté à `isFirmPriceSource`) | **ROUGE** | 4/19 échouent : les 3 du round 1, PLUS `isFirmPriceSource — prix_marche et zero -> false` (nouveau test round 2, qui aurait survécu si je ne l'avais pas écrit) |

## Défaut D1 — bandeau de renouvellement, corrigé

**Constat de la qa-review, vérifié.** `PortalCart.tsx` titrait tout le bandeau « N produit(s) indisponible(s) (non ajouté(s) au panier) », y compris les avertissements de prix versés par `renewalWarnings` en round 1 : une ligne **ajoutée** au panier (à prix non ferme) s'affichait comme **non ajoutée**. Le cadrage a admis la faute (prescription du canal sans lecture de son titre) et amendé le point 3.7 en (c-bis).

**Correction appliquée, exactement selon (c-bis) :**
- `useStorefrontOrderLifecycle.ts` : `renewalWarnings` retrouve son sens d'origine (produits non ajoutés SEULS) ; nouvel état `renewalPriceNotFirm` (noms des produits ajoutés à prix non ferme), alimenté par `collectPriceNotFirmProductNames` (renommée depuis `buildPriceNotFirmWarnings`, qui rendait des phrases). Les deux états sont vidés aux trois mêmes endroits (changement de slug, `dismissRenewalWarnings`, `submitCart` réussi) — vérifié par un test qui compte les occurrences (`setRenewalPriceNotFirm([])` × 3, `setRenewalWarnings([])` × 3).
- `orderRenewal.helpers.ts` : nouvelle fonction pure `renewalBannerSections(notAdded, priceNotFirm)`, qui rend les sections non vides, dans l'ordre (non ajoutés puis prix non ferme), avec leurs textes déjà composés — titres exacts du cadrage, accord singulier/pluriel.
- `PortalCart.tsx` : ne compose plus aucun texte. Il appelle `renewalBannerSections(renewalWarnings, renewalPriceNotFirm)` et parcourt le résultat. Deux `data-testid` nouveaux (`cartRenewalNotAddedSection`, `cartRenewalPriceNotFirmSection`), un par section.
- `PublicShop.tsx` : transmet `renewalPriceNotFirm` à `PortalCart`, rien d'autre.

**Test exigé par la qa (scénario exact : 1 produit retiré + 2 prix non fermes)** — `tests/components/shop/portal/orderRenewal.helpers.test.ts` :
```
renewalBannerSections(
  ['Produit indisponible : Flyer A5 (retiré du catalogue)'],
  ['Cartes de visite', 'Kakemono'],
)
→ [
    { kind: 'not-added', title: '1 produit indisponible (non ajouté au panier)', items: [...] },
    { kind: 'price-not-firm', title: '2 produits ajoutés au panier avec un prix non définitif', detail: "...", items: ['Cartes de visite', 'Kakemono'] },
  ]
```
Vérifié vert (voir chiffres ci-dessous).

**Mutation exigée par le cadrage — « reverser les prix dans `renewalWarnings` doit faire échouer un test ».** **ROUND 3, correction d'une inexactitude (une des six relevées par le coordinateur) :** ce que j'ai décrit ici au round 2 comme la mutation rejouée — retirer l'appel à `setRenewalPriceNotFirm` dans `renewOrder` (revert à `setRenewalWarnings(warnings)` seul, sans le second état) — **n'est PAS la mutation littéralement exigée**. C'est une mutation voisine (nommée **W6a** ci-dessous, D2) : elle débranche le volet prix non ferme, elle ne « reverse » rien DANS `renewalWarnings`. **La mutation réellement exigée par le cadrage (W6b)** construit une variable `merged` qui fusionne les deux listes et la passe à `setRenewalWarnings` :
```ts
const merged = [...warnings, ...collectPriceNotFirmProductNames(lines)];
setRenewalWarnings(merged);
```
**Les deux meurent, vérifié séparément en round 3** :
- W6a (retirer `setRenewalPriceNotFirm`) : **ROUGE** — `le hook appelle REELLEMENT collectPriceNotFirmProductNames…` échoue.
- W6b (`merged` reversé dans `renewalWarnings`, la mutation exacte du cadrage) : **ROUGE** — `le hook appelle REELLEMENT collectPriceNotFirmProductNames…` échoue également, sur la première assertion durcie en round 3 (`toMatch(/setRenewalWarnings\(warnings\);/)`).

Les deux fichiers ont été restaurés, vérifiés identiques par `diff` après chaque mutation.

## Défaut D2 — câblage non lu par un test, corrigé

**Constat de la qa-review, vérifié et reconnu comme une erreur de ma part.** Round 1 de ce document affirmait que le câblage entre `canAddAsIs`/`addToCartButtonState` et le JSX de `ShopProductCard.tsx` était « non prouvable par un test automatisé dans ce dépôt » et que W3 (id du libellé décorrélé de l'identifiant passé à l'état) était « structurellement impossible ». **Les deux affirmations étaient fausses.** La qa a démontré, avec des assertions texte sur les sources (le pattern déjà en usage dans `tests/components/shop/`), que six mutations (W1-W6) rougissaient bel et bien sans qu'aucun test existant ne les voie.

**Correction : nouveau fichier `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts`**, 13 tests, assertions texte sur `ShopProductCard.tsx`, `useStorefrontOrderLifecycle.ts`, `PortalCart.tsx`, `PublicShop.tsx`. **Chaque mutation ci-dessous a été rejouée par moi, manuellement, une par une**, avec restauration exacte vérifiée par `diff` entre chaque :

| # | Mutation | Verdict | Test qui rougit |
|---|---|---|---|
| W1 | `disabled={false}` en dur (`ShopProductCard.tsx`) | **ROUGE** | `W1 — disabled est pose depuis addToCartState.disabled…` |
| W2 | `aria-describedby` retiré | **ROUGE** | `W2 — aria-describedby est pose depuis addToCartState.describedBy…` |
| W3 | `id` du libellé différent de l'identifiant passé à l'état (`id={String(addAsIsReasonId) + "-x"}`) | **ROUGE** — **contrairement à ce que j'affirmais en round 1, cette mutation ÉTAIT détectable** dès qu'un test lit le texte source ; je n'avais simplement pas écrit ce test | `W3 — … le libelle porte le MEME identifiant en id` |
| W4 | `canAddAsIs(product, null)` en dur au lieu du quote extrait | **ROUGE** | `W4 — canAddAsIs est appele avec le quote extrait…` |
| W5 | libellé jamais rendu (`{false && (`) | **ROUGE** | `W5 — le libelle est rendu conditionnellement…` |
| W6a (adaptée round 2 — **nommée ainsi depuis le round 3**, distincte de W6b ci-dessous) | supprimer l'appel `setRenewalPriceNotFirm(...)` dans `renewOrder`, débranchant tout le volet prix non ferme | **ROUGE** | `le hook appelle REELLEMENT collectPriceNotFirmProductNames…` |
| D1-1 | retirer `renewalPriceNotFirm={renewalPriceNotFirm}` dans `PublicShop.tsx` | **ROUGE** | `PublicShop transmet REELLEMENT renewalPriceNotFirm…` |
| D1-2 | `PortalCart` revient à `{renewalWarnings.length > 0 && (` (masque la section prix non ferme quand aucun produit n'est indisponible) | **ROUGE** | `le bandeau entier est conditionne sur renewalSections.length…` |

**Ce que je retire de mon affirmation round 1** : « non prouvable » décrivait une limite réelle du dépôt (pas de rendu React en test), mais j'en ai conclu à tort qu'aucune preuve automatisée n'était possible du tout. Le pattern texte-sur-source, déjà utilisé ailleurs dans ce même dossier (`PublicShop.submitCart.test.ts`, `PortalCart.text.test.ts`), le permettait — je ne l'avais pas cherché avant de conclure. C'est exactement le réflexe que le coordinateur demande de changer.

## Mutations round 2 — réserves de l'architecte

- **`priceHT <= 0` → toujours `price-not-firm`** : mutation = retirer la garde (`if (resolution.priceHT <= 0) { ... }`) de `canAddAsIs`. **Verdict : ROUGE** — le test `devis Clariprint reussi a priceHT: 0 -> price-not-firm, MEME source clariprint` échoue (`expected { ok: true } to deeply equal { ok: false, reason: 'price-not-firm' }`).
- **`onConfigure` obligatoire** : mutation = rendre `onConfigure?:` optionnel de nouveau dans `ShopProductCardProps`. **Verdict : ROUGE, à DEUX endroits distincts** de `pnpm typecheck` : `Cannot invoke an object which is possibly 'undefined'` sur l'appel direct `onConfigure(product)` (le repli protecteur ayant été retiré), ET `Unused '@ts-expect-error' directive` sur l'assertion de compilation ajoutée dans `ShopProductCard.typecheck.ts`. Fichier restauré, vérifié identique par `diff`.

## Défaut D4 — le verdict se recopiait au lieu de s'appeler, corrigé

**Constat de la qa-review, reproduit, vérifié.** `collectPriceNotFirmProductNames` (round 2) retestait `resolution.source === 'clariprint' || resolution.source === 'library_cached'` directement, en prétendant dans son commentaire que la réserve `priceHT <= 0` de `canAddAsIs` était « comprise ». Elle ne l'était pas : un produit avec `config.clariprintQuote = { success: true, priceHT: 0 }` fait rendre `price-not-firm` à `canAddAsIs` (bouton grisé sur la carte) mais `[]` à `collectPriceNotFirmProductNames` (aucun avertissement au renouvellement) — deux règles qui divergent alors qu'elles doivent être UNE seule règle. La cause : le garde d'architecture refuse l'import direct de `addAsIs.ts` depuis `orders`. **Le cadrage prévoyait exactement ce cas : remonter, pas recopier.**

**Correction, dans l'ordre prescrit par le coordinateur :**
1. `src/modules/catalog/ui/storefront/index.ts` : `export { canAddAsIs } from './addAsIs';` (une ligne, seul fichier hors périmètre Q14-a touché, autorisé explicitement).
2. `useStorefrontOrderLifecycle.ts` importe `canAddAsIs` depuis `@/modules/catalog/ui/storefront` — le même import que `CheckoutPage.tsx`/`ResumeBanner.tsx`.
3. `collectPriceNotFirmProductNames` appelle `canAddAsIs(line.product, clariprintQuote)`, avec la MÊME extraction du devis que `cartPricing.ts` (`resolveCartLinePricing`).
4. Le commentaire est réécrit pour dire ce qui est vrai (le critère s'appelle, il ne se recopie pas).
5. Test ajouté : « devis Clariprint réussi à `priceHT: 0` → le NOM est listé ».

**Mutation-preuve, rejouée dans les deux sens** (méthode exigée par le coordinateur) :
- **Sur `796dace8` (code d'avant round 3)** : le nouveau test échoue — `expected [] to deeply equal [ 'Brochure a prix nul' ]`. Reproduit manuellement en réappliquant temporairement l'ancien corps de `collectPriceNotFirmProductNames` sur le code round 3, avec restauration vérifiée par `diff`.
- **Sur le code round 3 corrigé** : le test passe (7/7 sur `useStorefrontOrderLifecycle.test.ts`).

`pnpm typecheck` : 0 erreur. `tests/architecture/` : 288/288, inchangé — c est CE garde, et non le typecheck, qui prouve que l import par l entrée publique est accepté.

## Défaut D5 — le garde d'épinglage (D2) passait sur du code commenté, corrigé

**Constat de la qa-review, reproduit, vérifié.** Round 2 lisait le texte BRUT des fichiers sources. Une ligne commentée (`// disabled={addToCartState.disabled}`) contient, comme sous-chaîne, exactement le motif que ma regex cherchait : le test restait vert alors que l'attribut réel avait disparu du bouton (« + Panier » actif sur toutes les cartes). Même faille pour un spread `aria-describedby` mis en commentaire de bloc. Trois autres évasions structurelles : `id` déplacé du `<p>` vers le `<div>` conteneur (aria-describedby pointerait alors vers un élément qui englobe aussi le prix et les trois boutons) ; `clariprintQuote` figé à une constante `null` ; et un `merged` qui réintroduit D1 dans `renewalWarnings`.

**Correction :** `read()` retire les commentaires de bloc ET de ligne avant toute recherche de motif. Deux assertions resserrées pour ne plus matcher n'importe où dans le fichier (W3 : `<p\s+id=\{addAsIsReasonId\}`, l'id doit être porté par le `<p>` lui-même ; W4 : `const clariprintQuote = \(\s*product\.config as`, la constante doit être dérivée de `product.config`). Une assertion positive ET négative sur le hook (`setRenewalWarnings(warnings);` doit être présent tel quel, `setRenewalWarnings([...warnings` et `setRenewalWarnings(merged)` ne doivent jamais apparaître).

**Cinq évasions rejouées par moi, une par une, avec restauration vérifiée par `diff` entre chaque :**

| # | Évasion | Verdict | Test qui rougit |
|---|---|---|---|
| E1 | `disabled={addToCartState.disabled}` mis en commentaire de ligne (`// disabled={...}`) | **ROUGE** | `W1 — disabled est pose depuis addToCartState.disabled…` |
| E1b | spread `aria-describedby` mis en commentaire de bloc (`/* {...} */`) | **ROUGE** | `W2 — aria-describedby est pose depuis addToCartState.describedBy…` |
| E6 | `id={addAsIsReasonId}` déplacé du `<p>` du libellé vers le `<div className="flex flex-col gap-2 mt-1.5">` conteneur (prix + boutons + libellé) | **ROUGE** | `W3 — … le libelle (le <p>, pas un conteneur) porte le MEME identifiant en id` |
| E7 | `clariprintQuote` figé (`const clariprintQuote: ClariprintQuoteResult \| null = null;`) au lieu d'être dérivé de `product.config` | **ROUGE** | `W4 — canAddAsIs est appele avec le quote extrait…` |
| E9 | `const merged = [...warnings, ...collectPriceNotFirmProductNames(lines)]; setRenewalWarnings(merged);` (réintroduit D1) | **ROUGE** | `le hook appelle REELLEMENT collectPriceNotFirmProductNames…` (première assertion durcie, `setRenewalWarnings(warnings);` absent) |

**W1 à W6 (les six mutations originales, pas les évasions) rejouées une seconde fois avec le garde durci** : toutes encore **ROUGE**, la suppression des commentaires n'a fait perdre aucune détection existante (13/13 verts sur le code sain avant chaque mutation, restaurations vérifiées par `diff`).

## Tests exécutés — chiffres réels (round 3, après restauration de TOUTES les mutations et évasions)

```
pnpm typecheck
  $ tsc --noEmit -p tsconfig.modular.json
  → 0 erreur (sortie vide, code de sortie 0)

pnpm vitest run tests/modules/catalog/addAsIs.test.ts tests/app/hooks/useStorefrontOrderLifecycle.test.ts tests/components/shop/portal/orderRenewal.helpers.test.ts tests/components/shop/ShopProductCard.addAsIsWiring.test.ts
  → Test Files  4 passed (4)
  → Tests  57 passed (57)
  (détail : addAsIs.test.ts 19, useStorefrontOrderLifecycle.test.ts 7 (+1 round 3, D4), orderRenewal.helpers.test.ts 18, ShopProductCard.addAsIsWiring.test.ts 13 → 19+7+18+13 = 57)

pnpm vitest run tests/architecture/
  → Test Files  46 passed (46)
  → Tests  288 passed (288)

pnpm vitest run   (suite complète du dépôt)
  → Test Files  321 passed | 12 skipped (333)
  → Tests  3173 passed | 88 skipped (3261)
  → 0 échec
```

**Chiffres exacts, correspondant à ceux annoncés par la qa-review pour sa correction à blanc de D4** (« typecheck 0, 3173 passés / 88 skippés, architecture comprise »). Delta vs round 2 (3172 → 3173) : **+1**, exactement le nouveau test de `useStorefrontOrderLifecycle.test.ts` (défaut D4). Les skips restent à **88**, chiffre identique aux rounds 1 et 2 — round 3 ne touche aucun test conditionné par des variables d'environnement.

**Correction D3 (round 2) sur les skips, rappel** : round 1 affirmait que 88 skips étaient « du même ordre » que le baseline sans l'avoir vérifié par comparaison directe. Vérifié depuis le round 2 : 88 skips identiques sur `f0f891d0`, `796dace8` et le round 3.

## Ce que je n'ai PAS fait, et pourquoi

- **Q14-b (condition C1)** : non implémentée, dépend du normaliseur de BCP-2, lui-même dépendant de la campagne d'appels réels chez l'imprimeur — non jouée. Conforme au découpage prescrit par le cadrage.
- **Recette navigateur** (arbre d'accessibilité réel, clic/tactile/clavier n'ajoutent rien, `pnpm test:e2e:quality` sans violation nouvelle, mesure de contraste réelle) : **hors de mon rôle** — le cadrage l'attribue explicitement au coordinateur, « sans aucun agent qui écrive dans la copie de travail servie » (point 8 (3)), et la règle « Recette sans agent en parallèle » de ce projet l'interdit pendant qu'un agent modifie le dépôt.
- **Décompte « combien de cartes seront grisées par boutique active »** (porte avant déploiement, point 3.7 (f)) : explicitement hors de mon ressort selon la consigne reçue — je n'ai accédé à aucune donnée de production.
- **Correction de la dette « le serveur ne revalorise pas le prix »** (point 3.7 (g), Q17) : nommée, remontée à Arnaud par le cadrage, explicitement hors du territoire de Q14-a. Je n'ai touché à aucune fonction serveur ni migration.
- **(Round 2, résolu)** ~~Correction du texte de l'avertissement de renouvellement~~ : n'est plus une question ouverte — le cadrage (c-bis) fixe désormais les deux titres de section ET la phrase secondaire mot pour mot ; je n'ai plus de choix de formulation à faire valider.

## Commits

**ROUND 3 — correction d'un défaut RÉPÉTÉ (le coordinateur le signale comme « exactement D3 du round 1, répété »).** Round 2 avait écrit dans ce document, en front-matter ET dans cette section, que le commit round 2 n'existait pas (« aucun commit créé… HEAD `c5e07929` »), **alors que ce commit existait déjà au moment où j'ai écrit cette phrase** (`796dace8`, créé avant la rédaction du rapport de fin de round 2). Je n'ai pas relu cette section contre l'état réel du dépôt avant de la livrer. Corrigé ci-dessous, et dans le front-matter en tête de ce document.

- `f0f891d0` — round 1 (rejeté par la qa-review), branche `feat/gescom-q14a-ajout-direct-grise`, créée depuis `worktree-agent-a36fe9d0d75f6af4a` (HEAD `3448193b` à l'époque).
- `796dace8` — round 2 (rejeté par la qa-review sur D4 et D5), fix D1 (bandeau de renouvellement) et D2 (câblage non testé), réserves priceHT<=0 et onConfigure obligatoire, correction de l'affirmation fausse sur le serveur.
- `8787d757` — round 3 (ce round) : fix D4 (verdict recopié au lieu d'appelé) et D5 (garde d'épinglage vulnérable au code commenté), correction des six inexactitudes documentaires relevées par le coordinateur. **Ajouté par un commit de documentation séparé** (celui-ci ne modifie que ce fichier, pour inscrire son propre hash sans le deviner avant qu'il existe). Aucun push effectué, sur aucun round.

## Durcissements du coordinateur apres approbation (qa-review round 3)

La qa-review approuve le round 3 sous trois durcissements du garde et quatre
corrections de texte, a livrer avant fusion. Appliques par le coordinateur,
chacun prouve par une mutation rejouee et annulee (worktree propre apres
chaque annulation).

1. **H1 — le hook doit APPELER le verdict de la carte** (faute N0 de la qa).
   Le test D4 ne voyait une recopie que si elle divergeait sur le prix a 0 EUR.
   **Mutation jouee** : corps de `collectPriceNotFirmProductNames` remplace par
   une recopie FIDELE (`resolveCartLinePricing(line).resolution` puis
   `priceHT > 0 && (source === "clariprint" || source === "library_cached")`,
   sans appel a `canAddAsIs`). Resultat : `pnpm typecheck` 0 erreur, **les 19
   autres tests verts**, un seul echec — le test « le hook appelle
   REELLEMENT… », sur l assertion ajoutee
   `canAddAsIs\(line\.product,\s*clariprintQuote\)`. C est donc la SEULE
   chose dans le depot qui voie une recopie fidele, c est-a-dire exactement la
   faute du round 2.

2. **H2 — W1 et W2 bornes a la balise du bouton « + Panier »** (faute N2).
   `addToCartTag()` reperee par `TEST_IDS.shop.productCardQuoteBtn`.
   **Mutation jouee** : `disabled={addToCartState.disabled}` retire de
   « + Panier » et pose sur « Configurer » (le spread `aria-describedby` a ete
   retire dans le meme mutant). Resultat : typecheck 0, **W1 et W2 rouges**.
   Limite : la balise est bornee au `onClick` ; un attribut place apres
   `onClick` ferait rougir le test (echec du cote sur).

3. **H3 — retrait des commentaires resserre** (faute N3). L ancienne version
   retirait tout `/* ... */`, y compris dans une chaine.
   **Mutation jouee** : `data-accept="image/*"` ajoute sur « + Panier ».
   Resultat : **13/13 verts** (echouait avant, avec un diagnostic trompeur).
   **Non-regression** : `// disabled={addToCartState.disabled}` (E1) fait
   toujours rougir W1. Limite declaree : un `/* ... */` en milieu de ligne apres
   du code n est pas retire (evasion deliberee).

4. **Quatre phrases fausses corrigees** : section Fichiers round 2
   (`PortalCart.tsx` « seulement… rien d autre », alors que l import et
   `const renewalSections` ont aussi ete ajoutes) ; criteres 3 et 14 (la
   frontiere n incluait pas le devis Clariprint a `priceHT: 0`, cas meme de
   D4) ; critere 10 (la mutation W3 attribuee a la qa n etait pas la sienne) ;
   resultats round 3 (c est `pnpm test:architecture`, non le typecheck, qui
   prouve l acceptation de l import par l entree publique).

**Reserve pour Q14-b, relevee par la qa et non traitee ici** : le hook teste
`eligibility.ok`. Quand Q14-b fera rendre `config-incomplete` a `canAddAsIs`,
un produit a configuration incomplete mais a prix ferme sera annonce « prix
non definitif » au renouvellement, alors que le (c) dit que le renouvellement
echappe a C1. Q14-b devra exposer un verdict C2 seul, ou le cadrage trancher.

Gates apres durcissements : `pnpm typecheck` 0 erreur ; `pnpm test` 321
fichiers passes / 12 skip, **3173 tests passes / 88 skip, 0 echec** ;
`pnpm test:architecture` 288/288.
