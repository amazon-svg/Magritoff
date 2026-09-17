---
story_id: Q14-a
epic: Sprint 5 — chantier boutique « chaîne des prix Magrit → panier et qualité d'affichage » (hors E10, docs/api/CONVENTIONS.md §8.25)
title: Bouton "+ Panier" désactivé et grisé quand le prix n'est pas ferme (C2 seule)
status: round 2 — corrections D1/D2/D3 + réserves appliquées, en attente de nouvelle qa-review distincte
branch: feat/gescom-q14a-ajout-direct-grise
base_round1: worktree-agent-a36fe9d0d75f6af4a (3448193b) = main (f7326363) + docs/api/CONVENTIONS.md §8.25 réécrit le 2026-09-17
base_round2: worktree-agent-a36fe9d0d75f6af4a (c5e07929) = base_round1 + amendements architecte du 2026-09-17 (D1, D2, réserves, (g)/Q17)
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 3.7 (a) à (g), point 6 (ligne Q14-a), point 9 (ligne Q14)
commits: [f0f891d0 (round 1)]
---

# Story Q14-a — bouton "+ Panier" grisé quand le prix n'est pas ferme

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
- `src/modules/orders/ui/storefront/PortalCart.tsx` — **seulement** le type de props (`renewalPriceNotFirm` ajouté) et le bloc du bandeau S3.3 (D1). Rien d'autre : ni lignes, ni totaux, ni budget, ni format.
- `src/modules/shops/ui/storefront/PublicShop.tsx` — **seulement** la transmission de `renewalPriceNotFirm` (destructure du hook + prop passée à `PortalCart`), 4 lignes ajoutées, aucune ligne retirée (`git diff --stat`).
- `src/modules/catalog/ui/storefront/ShopProductCard.tsx` (suite) — `onConfigure` devient un prop obligatoire, repli sur `onAddToCart` supprimé (réserve qa-review).
- `src/modules/catalog/ui/storefront/ShopProductCard.typecheck.ts` — assertion de compilation ajoutée : un objet de props sans `onConfigure` ne doit plus satisfaire `ShopProductCardProps`.
- `src/modules/catalog/ui/storefront/addAsIs.ts` — en-tête corrigé (phrase fausse retirée, voir plus bas) ; `canAddAsIs` échoue si `priceHT <= 0` ; nouvelle fonction `isFirmPriceSource` (liste blanche explicite, réserve non bloquante).
- `tests/components/shop/portal/orderRenewal.helpers.test.ts` — 7 tests ajoutés pour `renewalBannerSections` (11→18, `grep -c "  it("` vérifié), dont le scénario exact demandé par la qa-review (1 produit retiré + 2 prix non fermes).

## Critères vérifiés un par un

1. **Le bouton « + Panier » est TOUJOURS rendu**, jamais absent, sur toutes les surfaces de carte (`ShopProductCard` est partagé par accueil/catalogue/gamme). — **FAIT.** Le JSX ne conditionne plus la présence du bouton, seulement son attribut `disabled` et sa classe. Vérifié par lecture du diff : le `<button>` reste un unique nœud toujours rendu.

2. **Actif quand `resolvePrice(product, quote).source ∈ {clariprint, library_cached}`.** — **FAIT.** `canAddAsIs` rend `{ ok: true }` exactement dans ces deux cas ; testé (`addAsIs.test.ts`, 2 cas).

3. **Désactivé par l'attribut natif `disabled`, jamais `aria-disabled` seul, quand la source est `prix_marche` ou `zero`.** — **FAIT.** `addToCartButtonState` rend `disabled: true` dans ce cas, posé sur l'attribut React natif `disabled={addToCartState.disabled}`. Aucune garde manuelle de clic n'a donc à être écrite : un bouton `disabled` natif ne déclenche pas `onClick`.

4. **Grisé par les jetons atténués EXISTANTS, aucun jeton de couleur nouveau.** — **FAIT.** Classe conditionnelle utilisant `border-line` (border « très fine », déjà défini dans `tokens.css`) et `text-ink-muted` (déjà utilisé ailleurs dans ce même composant — description, mention « / N ex. », badges FSC). Contraste calculé (pas mesuré au navigateur, calcul manuel WCAG) : `#52525B` sur `#FFFFFF` (thème clair) ≈ **7,7:1** ; `#A1A1AA` sur `#111113` (thème sombre) ≈ **7,35:1**. Les deux dépassent le seuil de 4,5:1 exigé par le cadrage. **Mesure au vrai navigateur non faite par moi** (hors de mon accès) — mentionnée comme recette au coordinateur, mais le calcul mathématique sur les tokens déclarés donne une marge large.

5. **Même géométrie que le bouton actif, aucun décalage de mise en page.** — **FAIT.** Seules les classes de couleur/bordure/curseur changent ; libellé, padding, taille de police et position dans la rangée sont identiques dans les deux branches du ternaire.

6. **Motif écrit en PERMANENCE sous la rangée de boutons, jamais au survol/focus, jamais masqué aux petites largeurs, absent quand le critère est rempli, aucun `title`.** — **FAIT.** Le `<p>` est un enfant conditionnel simple (`{addToCartState.label && (...)}`), sans classe `hidden`/`opacity-0`/`sm:*`, positionné immédiatement après le conteneur des boutons dans le même conteneur `flex-col`. Aucun attribut `title` ajouté.

7. **Libellé exact « Configurez ce produit pour obtenir son prix définitif. » pour `price-not-firm`.** — **FAIT.** Chaîne testée mot pour mot (`addAsIs.test.ts`, « le libelle de price-not-firm est EXACTEMENT la chaine du cadrage »).

8. **Libellé de `config-incomplete` déjà fixé pour Q14-b.** — **FAIT.** Présent dans `ADD_AS_IS_REASON_LABELS`, testé, mais **jamais produit par `canAddAsIs` aujourd'hui** (Q14-a ne rend que `price-not-firm`).

9. **Table fermée : un motif sans libellé ne compile pas.** — **FAIT** par construction TypeScript (`Readonly<Record<AddAsIsReason, string>>`) ; `pnpm typecheck` (`tsconfig.modular.json`, strict) confirme.

10. **Accessibilité : `aria-describedby` sur le bouton désactivé, pointant un identifiant unique par INSTANCE de carte (pas seulement par produit) ; `aria-label` inchangé ; aucun `title`.** — **FAIT.** `useId()` (React 18, déjà utilisé ailleurs dans le dépôt — `ShopMegaMenu.tsx`) génère un identifiant stable et unique par position dans l'arbre de rendu, donc distinct entre deux instances simultanées de la même carte produit. Le même identifiant (`addAsIsReasonId`) alimente à la fois l'argument `reasonId` de `addToCartButtonState` et l'attribut `id` du `<p>` : les deux ne peuvent pas diverger sans modifier visiblement deux lignes séparées du composant. `aria-describedby` n'est posé QUE quand `addToCartState.describedBy` est défini (spread conditionnel) — absent sur un bouton actif.

11. **`data-testid` : `productCardQuoteBtn` conservé tel quel (pas renommé) ; nouvelle clé `productCardAddAsIsReason` déclarée dans `testIds.ts`, jamais écrite en dur dans le composant ; élément du motif porte `data-reason`.** — **FAIT.**

12. **`canAddAsIs` est une fonction pure dans `src/modules/catalog/ui/storefront/addAsIs.ts`** (et non `src/modules/clariprint/application/`, qui n'existe pas encore), **signature `(product, quote) => {ok:true}|{ok:false,reason}`**, ne rend pour l'instant que `'price-not-firm'`. — **FAIT**, conforme à la précision du 2026-09-17 du cadrage sur l'emplacement.

13. **`addToCartButtonState` est une seconde fonction pure séparée**, fournissant tout ce que le JSX pose sur le bouton et sous lui ; **le composant ne choisit aucun texte, ne lit ni `reason` ni `source`.** — **FAIT.** Vérifié par lecture : le JSX ne fait que `addToCartState.disabled`, `addToCartState.describedBy`, `addToCartState.label`, `addToCartState.reason` (pour `data-reason` seul, jamais pour choisir un texte).

14. **Renouvellement de commande : C1 réputée remplie sans réévaluation (comportement INCHANGÉ, pas recodé), C2 n'hérite pas et ne bloque pas ; une ligne dont la source re-résolue est `prix_marche` ou `zero` produit un avertissement, un par ligne.** — **FAIT, mais le canal a changé en round 2 (défaut D1).** `rebuildCartFromOrderItems` n'a pas été touché (le matching et la reconstruction des lignes restent identiques, aucune barrière ajoutée). **Round 1** fusionnait les avertissements de prix dans `renewalWarnings`, dont le titre affiché par `PortalCart` (« N produit(s) indisponible(s), non ajouté(s) au panier ») **contredisait le fait que ces lignes avaient bien été ajoutées** — défaut D1, bloquant, relevé par la qa-review. **Round 2 (point 3.7 (c-bis)) : deux canaux séparés.** `collectPriceNotFirmProductNames` (renommée depuis `buildPriceNotFirmWarnings`) rend maintenant les NOMS seuls (pas des phrases), exposés dans un état séparé `renewalPriceNotFirm`. `renewalBannerSections` (nouvelle fonction pure, `orderRenewal.helpers.ts`) compose les DEUX sections du bandeau — titre exact fixé par le cadrage pour chacune, jamais composé dans `PortalCart`. Voir section « D1 » ci-dessous pour le détail complet et les mutations rejouées.

15. **Aucun empiètement hors périmètre** : bouton « Configurer », bouton « Personnaliser », bloc prix (BCP-4), `openapi/magrit-core.v1.yaml` non touchés. — **FAIT**, vérifié par `git diff --stat` (3 fichiers modifiés, tous attendus par le point 6 du cadrage) et par relecture ligne à ligne du diff de `ShopProductCard.tsx`.

16. **BCP-11 (garde `CartLine`) reste vert** — aucune ligne de panier construite à la main, `packLine`/`toPackLine` intacts. — **FAIT**, non touché ; `tests/architecture/cart-line-single-constructor.test.ts` passe (voir suite complète).

17. **`pnpm typecheck` et la suite complète, chiffres réels, échecs compris.** — **FAIT**, voir section Tests ci-dessous.

18. **(ROUND 2) Le câblage entre les fonctions pures et le JSX est épinglé par un test qui rougit si on le casse (défaut D2).** — **FAIT.** Voir section « D2 » : six mutations (W1-W6, adaptées à ce round pour W6) rejouées au rouge contre `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts`.

19. **(ROUND 2) Un devis Clariprint réussi à `priceHT: 0` échoue toujours, quelle que soit la source (réserve tranchée par l'architecte).** — **FAIT.** `canAddAsIs` retourne `price-not-firm` dès que `resolution.priceHT <= 0`, avant même de consulter la source. Testé, mutation rejouée (section « Mutations round 2 »).

20. **(ROUND 2) `onConfigure` devient obligatoire, le repli sur `onAddToCart` disparaît (réserve tranchée par l'architecte).** — **FAIT.** `ShopProductCardProps.onConfigure` n'est plus optionnel ; les trois appelants (`PortalCatalog.tsx`, `PortalHome.tsx`, `GammePage.tsx`) le passaient déjà, confirmé par `pnpm typecheck` à 0 erreur immédiatement après le changement (aucun site d'appel à modifier). Assertion de compilation ajoutée dans `ShopProductCard.typecheck.ts`, mutation rejouée (un retour à `onConfigure?:` fait échouer `pnpm typecheck` à deux endroits distincts, voir section dédiée).

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

**Mutation exigée par le cadrage — « reverser les prix dans `renewalWarnings` doit faire échouer un test »** : rejouée en retirant l'appel à `setRenewalPriceNotFirm` dans `renewOrder` (revert à `setRenewalWarnings(warnings)` seul, sans le second état). **Verdict : ROUGE** — le test `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts > le hook appelle REELLEMENT collectPriceNotFirmProductNames…` échoue. Fichier restauré, vérifié identique par `diff`.

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
| W6 (adaptée round 2) | supprimer l'appel `setRenewalPriceNotFirm(...)` dans `renewOrder`, débranchant tout le volet prix non ferme (la forme round 1 de cette mutation, `setRenewalWarnings(warnings)` seul, n'a plus de sens depuis que D1 a scindé les deux canaux) | **ROUGE** | `le hook appelle REELLEMENT collectPriceNotFirmProductNames…` |
| D1-1 | retirer `renewalPriceNotFirm={renewalPriceNotFirm}` dans `PublicShop.tsx` | **ROUGE** | `PublicShop transmet REELLEMENT renewalPriceNotFirm…` |
| D1-2 | `PortalCart` revient à `{renewalWarnings.length > 0 && (` (masque la section prix non ferme quand aucun produit n'est indisponible) | **ROUGE** | `le bandeau entier est conditionne sur renewalSections.length…` |

**Ce que je retire de mon affirmation round 1** : « non prouvable » décrivait une limite réelle du dépôt (pas de rendu React en test), mais j'en ai conclu à tort qu'aucune preuve automatisée n'était possible du tout. Le pattern texte-sur-source, déjà utilisé ailleurs dans ce même dossier (`PublicShop.submitCart.test.ts`, `PortalCart.text.test.ts`), le permettait — je ne l'avais pas cherché avant de conclure. C'est exactement le réflexe que le coordinateur demande de changer.

## Mutations round 2 — réserves de l'architecte

- **`priceHT <= 0` → toujours `price-not-firm`** : mutation = retirer la garde (`if (resolution.priceHT <= 0) { ... }`) de `canAddAsIs`. **Verdict : ROUGE** — le test `devis Clariprint reussi a priceHT: 0 -> price-not-firm, MEME source clariprint` échoue (`expected { ok: true } to deeply equal { ok: false, reason: 'price-not-firm' }`).
- **`onConfigure` obligatoire** : mutation = rendre `onConfigure?:` optionnel de nouveau dans `ShopProductCardProps`. **Verdict : ROUGE, à DEUX endroits distincts** de `pnpm typecheck` : `Cannot invoke an object which is possibly 'undefined'` sur l'appel direct `onConfigure(product)` (le repli protecteur ayant été retiré), ET `Unused '@ts-expect-error' directive` sur l'assertion de compilation ajoutée dans `ShopProductCard.typecheck.ts`. Fichier restauré, vérifié identique par `diff`.

## Tests exécutés — chiffres réels (round 2, après restauration de TOUTES les mutations)

```
pnpm typecheck
  $ tsc --noEmit -p tsconfig.modular.json
  → 0 erreur (sortie vide, code de sortie 0)

pnpm vitest run tests/modules/catalog/addAsIs.test.ts
  → Test Files  1 passed (1)
  → Tests  19 passed (19)

pnpm vitest run tests/app/hooks/useStorefrontOrderLifecycle.test.ts
  → Test Files  1 passed (1)
  → Tests  6 passed (6)

pnpm vitest run tests/components/shop/portal/orderRenewal.helpers.test.ts
  → Test Files  1 passed (1)
  → Tests  18 passed (18)

pnpm vitest run tests/components/shop/ShopProductCard.addAsIsWiring.test.ts
  → Test Files  1 passed (1)
  → Tests  13 passed (13)

pnpm vitest run tests/architecture/
  → Test Files  46 passed (46)
  → Tests  288 passed (288)

pnpm vitest run   (suite complète du dépôt)
  → Test Files  321 passed | 12 skipped (333)
  → Tests  3172 passed | 88 skipped (3260)
  → 0 échec
```

**Correction D3 sur les skips** : round 1 affirmait que 88 skips étaient « du même ordre » que le baseline sans l'avoir vérifié par comparaison directe. **Vérifié maintenant, précisément** : la qa-review round 1 a elle-même rapporté 88 skips sur le HEAD round 1 (`f0f891d0`) ; la suite complète round 2 (ci-dessus, sur `c5e07929` + mes corrections) rapporte **également 88 skips, chiffre identique**. Le nombre de fichiers de test verts est passé de 320 à **321** (le nouveau fichier `ShopProductCard.addAsIsWiring.test.ts`), et le nombre de tests verts de 3147 à **3172** (**+25, décompte exact par `grep -c "  it("` sur chaque fichier, avant/après** : `addAsIs.test.ts` 14→19 (+5), `orderRenewal.helpers.test.ts` 11→18 (+7), `useStorefrontOrderLifecycle.test.ts` 6→6 (réécrit, effectif inchangé), `ShopProductCard.addAsIsWiring.test.ts` 0→13 (+13, nouveau fichier) ; 5+7+13 = **25**, exactement le delta observé).

## Ce que je n'ai PAS fait, et pourquoi

- **Q14-b (condition C1)** : non implémentée, dépend du normaliseur de BCP-2, lui-même dépendant de la campagne d'appels réels chez l'imprimeur — non jouée. Conforme au découpage prescrit par le cadrage.
- **Recette navigateur** (arbre d'accessibilité réel, clic/tactile/clavier n'ajoutent rien, `pnpm test:e2e:quality` sans violation nouvelle, mesure de contraste réelle) : **hors de mon rôle** — le cadrage l'attribue explicitement au coordinateur, « sans aucun agent qui écrive dans la copie de travail servie » (point 8 (3)), et la règle « Recette sans agent en parallèle » de ce projet l'interdit pendant qu'un agent modifie le dépôt.
- **Décompte « combien de cartes seront grisées par boutique active »** (porte avant déploiement, point 3.7 (f)) : explicitement hors de mon ressort selon la consigne reçue — je n'ai accédé à aucune donnée de production.
- **Correction de la dette « le serveur ne revalorise pas le prix »** (point 3.7 (g), Q17) : nommée, remontée à Arnaud par le cadrage, explicitement hors du territoire de Q14-a. Je n'ai touché à aucune fonction serveur ni migration.
- **(Round 2, résolu)** ~~Correction du texte de l'avertissement de renouvellement~~ : n'est plus une question ouverte — le cadrage (c-bis) fixe désormais les deux titres de section ET la phrase secondaire mot pour mot ; je n'ai plus de choix de formulation à faire valider.

## Commits

- `f0f891d0` — round 1 (rejeté par la qa-review), branche `feat/gescom-q14a-ajout-direct-grise`, créée depuis `worktree-agent-a36fe9d0d75f6af4a` (HEAD `3448193b` à l'époque).
- **Round 2 : aucun commit créé à ce stade de la rédaction de ce rapport.** Les corrections D1, D2, D3 et les réserves sont dans l'arbre de travail (modifiées/non suivies), sur la même branche, HEAD actuel `c5e07929` (fusion de l'amendement architecte par `git merge --ff-only`) + les changements non commités listés dans « Fichiers créés/modifiés ». Aucun push effectué.
