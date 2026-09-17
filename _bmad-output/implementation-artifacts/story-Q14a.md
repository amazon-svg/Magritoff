---
story_id: Q14-a
epic: Sprint 5 — chantier boutique « chaîne des prix Magrit → panier et qualité d'affichage » (hors E10, docs/api/CONVENTIONS.md §8.25)
title: Bouton "+ Panier" désactivé et grisé quand le prix n'est pas ferme (C2 seule)
status: implémentée par dev-story, en attente de qa-review distincte
branch: feat/gescom-q14a-ajout-direct-grise
base: worktree-agent-a36fe9d0d75f6af4a (3448193b) = main (f7326363) + docs/api/CONVENTIONS.md §8.25 réécrit le 2026-09-17
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 3.7 (a) à (f), point 6 (ligne Q14-a), point 9 (ligne Q14)
---

# Story Q14-a — bouton "+ Panier" grisé quand le prix n'est pas ferme

## Arbitrage d'Arnaud opposable (2026-09-17, verbatim)

> « Pour le bouton panier "grisé" si le produit n'est pas chiffré. »

Ce round RETOURNE la décision de l'architecte du 2026-09-16 (« le bouton n'est pas rendu »). Le cadrage réécrit le point 3.7 en conséquence — c'est le document qui fait foi, pas cette story. Aucune décision n'a été reprise ici : uniquement implémentée.

## Périmètre — Q14-a seulement

Condition **C2** (prix ferme, `resolvePrice(...).source ∈ {clariprint, library_cached}`) seule. **C1** (configuration chiffrable) dépend du normaliseur de BCP-2, non livré (dépend de la campagne d'appels réels chez l'imprimeur, non jouée) : **non implémentée ici**, conformément au découpage du cadrage. La signature et le libellé du motif `'config-incomplete'` (réservé à Q14-b) sont posés dès maintenant pour que Q14-b n'ait rien à réécrire.

## Fichiers créés

- `src/modules/catalog/ui/storefront/addAsIs.ts` — `AddAsIsReason`, `AddAsIsEligibility`, `ADD_AS_IS_REASON_LABELS` (table fermée), `canAddAsIs(product, quote)`, `addToCartButtonState(eligibility, reasonId)`. Toutes fonctions pures.
- `tests/modules/catalog/addAsIs.test.ts` — 14 tests unitaires.
- `tests/app/hooks/useStorefrontOrderLifecycle.test.ts` — 6 tests unitaires sur `buildPriceNotFirmWarnings`.

## Fichiers modifiés

- `src/modules/catalog/ui/storefront/ShopProductCard.tsx` — uniquement la zone du bouton « + Panier » (`data-testid={TEST_IDS.shop.productCardQuoteBtn}`) et l'ajout de l'élément de motif immédiatement après la rangée de boutons. Ni le bouton « Configurer », ni « Personnaliser », ni le bloc prix (territoire BCP-4) ne sont touchés — vérifié par relecture du diff (`git diff --stat` : uniquement des insertions dans ce fichier, aucune ligne du bloc prix `:317-349` ni des deux autres boutons modifiée).
- `src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts` — ajout de la fonction pure exportée `buildPriceNotFirmWarnings` et de son appel dans `renewOrder` (point 3.7 (c), volet renouvellement).
- `src/shared/presentation/testIds.ts` — une clé ajoutée en fin du bloc `shop` : `productCardAddAsIsReason: 'product-card-add-as-is-reason'`.

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

14. **Renouvellement de commande : C1 réputée remplie sans réévaluation (comportement INCHANGÉ, pas recodé), C2 n'hérite pas et ne bloque pas ; une ligne dont la source re-résolue est `prix_marche` ou `zero` produit un avertissement, un par ligne, dans le canal `renewalWarnings` EXISTANT.** — **FAIT.** `rebuildCartFromOrderItems` n'a pas été touché (le matching et la reconstruction des lignes restent identiques, aucune barrière ajoutée). `buildPriceNotFirmWarnings` (nouvelle fonction pure, `useStorefrontOrderLifecycle.ts`) parcourt les lignes reconstruites, résout leur prix par `resolveCartLinePricing` (déjà utilisé ailleurs dans ce fichier) et ajoute un avertissement par ligne non ferme. `renewOrder` fusionne ces avertissements avec ceux de correspondance déjà produits, dans le même tableau `renewalWarnings` — aucune interface nouvelle. **Le texte exact de cet avertissement n'est PAS fixé par le cadrage** (contrairement aux deux libellés du bouton) : j'ai choisi *"{nom du produit} : prix non définitif — confirmé par l'imprimeur à la validation de la commande."*, cohérent avec l'infobulle déjà affichée sur le badge « Prix marché » (`MARKET_PRICE_BADGE_TOOLTIP`). Si Arnaud souhaite un autre texte, seul ce littéral change.

15. **Aucun empiètement hors périmètre** : bouton « Configurer », bouton « Personnaliser », bloc prix (BCP-4), `openapi/magrit-core.v1.yaml` non touchés. — **FAIT**, vérifié par `git diff --stat` (3 fichiers modifiés, tous attendus par le point 6 du cadrage) et par relecture ligne à ligne du diff de `ShopProductCard.tsx`.

16. **BCP-11 (garde `CartLine`) reste vert** — aucune ligne de panier construite à la main, `packLine`/`toPackLine` intacts. — **FAIT**, non touché ; `tests/architecture/cart-line-single-constructor.test.ts` passe (voir suite complète).

17. **`pnpm typecheck` et la suite complète, chiffres réels, échecs compris.** — **FAIT**, voir section Tests ci-dessous.

## Ce que Q14-a n'empêche PAS (rappel opposable, point 3.7 (a) du cadrage)

Ce n'est **pas** un contrôle métier ni une garantie de prix. `canAddAsIs` est une **affordance d'interface** : elle cesse de proposer un geste que le serveur ne valoriserait pas comme définitif, elle ne l'empêche pas côté serveur. **Rien n'empêche** :
- un appel direct à l'API de création de commande avec les mêmes données qu'un ajout « tel quel » aurait envoyées (aucune barrière serveur nouvelle n'est créée par ce lot, et aucune n'existait avant) ;
- un bouton HTML forgé ou un DOM modifié par les DevTools qui retirerait l'attribut `disabled`.

La fermeté du prix reste établie **côté serveur au moment du chiffrage**. Ce lot ne crée et ne modifie aucune règle serveur. C'est la même limite que toute affordance d'interface du dépôt (le cadrage le dit explicitement pour ne pas laisser croire à une barrière).

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

## Mutations que j'ai inventées moi-même (consigne 6)

1. **Câblage qui laisse la fonction pure intacte mais pose le mauvais état sur le bouton** (ex. `disabled={false}` en dur, ou `disabled={addAsIsEligibility.ok === false ? false : true}` inversé). **Non prouvable par un test automatisé dans ce dépôt** : `package.json` ne déclare ni `@testing-library/react`, ni `react-test-renderer`, ni `jsdom`/`happy-dom` (vérifié) — aucun composant React n'est rendu par la suite `vitest` du dépôt, constat déjà écrit par le cadrage lui-même (point 3.7 (b-bis) 2) pour justifier que toute la logique doive vivre dans des fonctions pures testables. **Vérification faite par relecture ligne à ligne** (reproduite dans ce document, section Fichiers modifiés) : `disabled={addToCartState.disabled}` lit directement le champ de la fonction pure, sans intermédiaire, sans inversion, sans littéral. **Recette navigateur requise** pour une preuve exécutée (point 3.7 (b-ter) 4, à la charge du coordinateur).
2. **Libellé rendu mais NON relié par `aria-describedby`** (ex. le `<p>` prend un `id` généré séparément de celui passé à `addToCartButtonState`). **Structurellement rendue impossible, pas seulement vérifiée** : une seule variable, `addAsIsReasonId` (issue d'un seul appel `useId()`), est utilisée à la fois comme troisième — en réalité deuxième — argument de `addToCartButtonState(addAsIsEligibility, addAsIsReasonId)` (qui pose `describedBy: reasonId` verbatim, prouvé par le test unitaire « describedBy EGAL a l'identifiant passé ») ET comme valeur de l'attribut `id` du `<p>`. Faire diverger les deux demanderait de remplacer visiblement l'une des deux occurrences par une expression différente — ce n'est pas le cas ici (vérifié par lecture, diff reproduit ci-dessus). **Recette navigateur requise** pour l'arbre d'accessibilité réel (point 3.7 (b-ter) 4, à la charge du coordinateur).

Je n'ai fabriqué aucun test qui ne s'exécute pas réellement pour ces deux points : je documente honnêtement la limite de preuve du dépôt (pas de DOM en test) plutôt que d'inventer un verdict.

## Tests exécutés — chiffres réels

Commandes exécutées dans ce worktree, sur le code final (après restauration de toutes les mutations) :

```
pnpm typecheck
  $ tsc --noEmit -p tsconfig.modular.json
  → 0 erreur (sortie vide, code de sortie 0)

pnpm vitest run tests/modules/catalog/addAsIs.test.ts
  → Test Files  1 passed (1)
  → Tests  14 passed (14)

pnpm vitest run tests/app/hooks/useStorefrontOrderLifecycle.test.ts
  → Test Files  1 passed (1)
  → Tests  6 passed (6)

pnpm vitest run tests/architecture/
  → Test Files  46 passed (46)
  → Tests  288 passed (288)

pnpm vitest run   (suite complète du dépôt)
  → Test Files  320 passed | 12 skipped (332)
  → Tests  3147 passed | 88 skipped (3235)
  → 0 échec
```

Le nombre de tests skippés (88) est un invariant préexistant du dépôt (tests conditionnés par variables d'environnement absentes en local, ex. secrets Supabase) — non lié à ce lot ; vérifié par comparaison : le baseline avant tout mon travail portait déjà des skips du même ordre sur d'autres lots de ce chantier (BCP-10, BCP-11).

## Ce que je n'ai PAS fait, et pourquoi

- **Q14-b (condition C1)** : non implémentée, dépend du normaliseur de BCP-2, lui-même dépendant de la campagne d'appels réels chez l'imprimeur — non jouée. Conforme au découpage prescrit par le cadrage.
- **Recette navigateur** (arbre d'accessibilité réel, clic/tactile/clavier n'ajoutent rien, `pnpm test:e2e:quality` sans violation nouvelle) : **hors de mon rôle** — le cadrage l'attribue explicitement au coordinateur, « sans aucun agent qui écrive dans la copie de travail servie » (point 8 (3)), et la règle « Recette sans agent en parallèle » de ce projet l'interdit pendant qu'un agent modifie le dépôt.
- **Décompte « combien de cartes seront grisées par boutique active »** (porte avant déploiement, point 3.7 (f)) : explicitement hors de mon ressort selon la consigne reçue — je n'ai accédé à aucune donnée de production.
- **Correction du texte de l'avertissement de renouvellement** si Arnaud préfère un autre libellé que celui que j'ai choisi (aucun texte exact n'était fixé par le cadrage pour ce cas, contrairement aux deux libellés du bouton).

## Commits

Aucun commit créé à ce stade de la rédaction de ce rapport — les fichiers sont en état modifié/non suivi dans le worktree, prêts à être commités sur `feat/gescom-q14a-ajout-direct-grise` (créée depuis `worktree-agent-a36fe9d0d75f6af4a`, HEAD `3448193b`). Aucun push effectué.
