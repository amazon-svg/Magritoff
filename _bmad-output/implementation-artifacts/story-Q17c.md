---
story_id: Q17-c
epic: Sprint 5 — chantier boutique « chaîne des prix Magrit → panier et qualité d'affichage » (hors E10, docs/api/CONVENTIONS.md §8.25)
title: Ce que l'atelier voit — rendre visible l'écart de prix que Q17-a a rendu vrai côté serveur
status: livré, en attente de qa-review distincte
branch: feat/gescom-q17c-ecart-prix-visible
base: origin/main (03933044), Q17-a déjà fusionné
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 12 (h), lignes Q17-c des points 6 et 9 (i)
citation_cadrage: « Le filet d'aujourd'hui est l'œil de la personne qui valide, et il est aveugle. »
---

# Story Q17-c — l'atelier voit l'écart de prix

## Résumé en une phrase

Q17-a recalcule et marque (`price_origin`, `has_unverified_prices`) ; Q17-c rend ce marquage visible à l'atelier : pastille « Prix non vérifié » sur la grille des commandes, prix reçu et prix catalogue au détail de chaque ligne, confirmation nommée obligatoire pour valider une commande marquée. Front seul, aucun déploiement Supabase — les deux champs remontent par la façade (`listTenantOrders`/`listPortalOrders`/`getDraft`), jamais par une lecture directe de table.

## Constat de départ (pourquoi ce lot ne partait pas de zéro applicatif)

En lisant le code avant d'écrire une ligne, j'ai trouvé que `getDraftOrder`/`draftOrderSchema` exposaient déjà `priceOrigin` par ligne et `hasUnverifiedPrices` (Q17-a l'avait fait, precisement pour préparer ce lot — voir story Q17-a, section « Écart remonté »). Mais **`orderSummarySchema`** — le DTO consommé par `listTenantOrders` (DashboardOrders/atelier) et `listPortalOrders` (PortalOrders/acheteur) — **n'exposait ni l'un ni l'autre**. C'est précisément le trou que la story Q17-a avait signalé sans le combler (« non redemandé par la qa-review round 1, laissé en l'état »). La grille de l'atelier (`OrderHistoryTable.tsx`) consomme `OrderSummary`, pas `DraftOrder` : sans cet ajout, aucune pastille n'était possible. Ce lot ferme cet écart en premier, puis construit l'UI dessus.

## Ce que j'ai tranché (le cadrage laissait un point ouvert)

Le point 12 (h) dit : « Au détail de la commande : par ligne, le prix reçu, et, quand le serveur sait le calculer, le prix du catalogue à côté. » Il ne précise pas où vit ce « détail de commande » : aucune page de détail de commande n'existe aujourd'hui côté atelier (`DashboardOrders`/`OrderHistoryTable.tsx` n'affichent qu'un résumé « N lignes · M ex. »). **Tranché : le détail est une ligne de tableau dépliable**, ouverte par un bouton sur ce résumé (chevron), à l'intérieur de `OrderHistoryTable.tsx` — pas une page séparée. C'est la lecture la plus simple qui respecte le tableau de répartition du point 12 (i), qui ne liste que `OrderHistoryTable.tsx` (et pas un nouveau composant de page) comme fichier de ce lot.

**Second point tranché : que montrer comme « prix catalogue » ?** Par construction de Q17-a, une ligne `catalog` porte déjà EXACTEMENT le prix catalogue (le serveur refuse en 409 tout écart à la création/modification) : il n'y a donc rien à comparer côté affichage, seulement à confirmer. Une ligne `client_unverified` n'a, par définition, aucun prix catalogue connu du serveur (rang 4 de la hiérarchie du point 12 (b) : « aucun prix ferme »). Il n'existe donc aucun cas où un second nombre différent du premier serait disponible sans un appel réseau supplémentaire (interdit : « Il ne lit aucune table en direct », et je n'ai ajouté aucun endpoint). **Tranché : le « prix catalogue à côté » est un LIBELLÉ de provenance** (« Prix catalogue vérifié » / « Prix catalogue non vérifiable »), pas un second montant — l'écart en pourcentage est explicitement exclu par le cadrage lui-même (« Pas d'écart en pourcentage : le montant brut suffit »).

**Troisième point tranché : qui voit la pastille ?** `OrderHistoryTable.tsx` sert à la fois `DashboardOrders` (atelier, `appearance="dashboard"`) et `PortalOrders.tsx` (acheteur, « Mes commandes », `appearance="portal"`). Le cadrage dit : « Ce que voit l'acheteur : rien de nouveau. [...] Q17 n'ajoute aucun libellé acheteur. » **Tranché : la pastille, le détail dépliable et le prix catalogue sont réservés à `appearance === 'dashboard'`**, jamais rendus côté `portal`, y compris sur une commande marquée. Vérifié : `PortalOrders.tsx` ne fournit aucun callback de validation (`onValidateOrder`) — la validation est déjà, dans le code existant, une action strictement atelier.

**Quatrième point tranché : quelles lignes nommer dans la confirmation ?** Seules les lignes `client_unverified` bloquent la transition (point 12 (c)) — une ligne `legacy` ne l'a jamais fait (point 12 (g), commande antérieure à la règle). La confirmation nomme donc les lignes `client_unverified` uniquement, pas toutes les lignes de la commande.

## Contraintes de conception respectées

- **Front seul** : aucune migration, aucune Edge Function. Les deux colonnes DB (`tenant_order_items.price_origin`, `tenant_orders.has_unverified_prices`) existaient déjà (migration Q17-a `20260919000100`, déjà fusionnée) ; ce lot ne fait que les FAIRE REMONTER par la façade jusqu'à `OrderSummary`, là où elles manquaient.
- **Aucune lecture directe de table** : `OrderHistoryTable.tsx`/`ValidateOrderConfirmDialog.tsx` ne lisent que `OrderUI`, construit par `orderSummaryToUi()` depuis `OrderSummary` (DTO HTTP). Aucun import Supabase dans ces fichiers (déjà gardé par `tests/architecture/modular-ui-boundaries.test.ts`, rejoué vert).
- **Aucun `data-testid` inventé** : 7 nouveaux testids déclarés dans `src/shared/presentation/testIds.ts` avant tout usage.
- **`Money` préservé** : aucune arithmétique de prix ajoutée côté navigateur. Le détail de ligne affiche `item.price_ht` déjà résolu par le serveur (via `formatEuro`, un formateur d'affichage, pas un calcul).
- **Libellé imprimeur** : `client_unverified` n'apparaît jamais à l'écran. `describePriceOrigin()` traduit chaque valeur d'énumération en une phrase (« Prix catalogue non vérifiable », etc.), testé pour ne jamais contenir le nom technique.

## Ce que j'ai livré, point 12 (h) minimum opposable, un par un

1. **« Une pastille sur la ligne quand `has_unverified_prices`, libellé "Prix non vérifié", rendue depuis une table fermée »** — **FAIT**. `showsUnverifiedPriceBadge(order, appearance)` (fonction pure exportée, `OrderHistoryTable.tsx`) ; rendue dans la cellule Statut, `data-testid="shop-order-unverified-price-badge"`. Réservée à `appearance === 'dashboard'`. Aucun jeton de couleur nouveau autre que `warn-bg`/`warn-fg`, déjà utilisés ailleurs dans le dépôt (`ProductOverlay.tsx`, `PortalCatalog.tsx`, etc.) — pas une teinte inventée.
2. **« Au détail de la commande : par ligne, le prix reçu, et, quand le serveur sait le calculer, le prix du catalogue à côté »** — **FAIT**, sous la forme tranchée ci-dessus. Ligne dépliable (`data-testid="shop-order-detail-toggle"` sur le bouton, `shop-order-detail-row` sur la ligne, `shop-order-detail-line-item` par article), avec le prix reçu (`formatEuro(item.price_ht)`) et, quand `describePriceOrigin(item.priceOrigin)` rend un texte non nul, ce libellé à côté (`shop-order-detail-line-price-origin`). Aucun écart en pourcentage.
3. **« Le bouton "Valider" d'une commande marquée ouvre la confirmation du (c), qui nomme les lignes concernées »** — **FAIT**. `ValidateOrderConfirmDialog` reçoit désormais `order: OrderUI` (au lieu de `orderId`/`orderShortId` séparés) et calcule `unverifiedLineNamesOf(order)` (fonction pure exportée). Quand `order.hasUnverifiedPrices` est vrai : une notice nommée (`data-testid="shop-validate-order-dialog-unverified-notice"`) liste les lignes `client_unverified`, et le bouton de confirmation change de libellé et de testid (« Valider malgré les prix non vérifiés », `shop-validate-order-dialog-confirm-unverified`) — un second bouton distinct, jamais une case à cocher discrète, exactement comme le prescrit le point 12 (c).
4. **« Il ne lit aucune table en direct : `price_origin` et `has_unverified_prices` remontent par `listPortalOrders` et `getDraft`, donc par la façade »** — **FAIT, et complété** : `getDraft` les exposait déjà (Q17-a). J'ai ajouté ce qui manquait pour que **`listTenantOrders`/`listPortalOrders`** les exposent aussi (`orderSummarySchema.hasUnverifiedPrices`, `orderItemSchema.priceOrigin`), en remontant toute la chaîne : contrat Zod → `TenantOrderRecord`/`LegacyOrderRecord` → `OrdersService.toTenantSummary`/`toLegacySummary` → `SupabaseOrdersRepository` (`TENANT_ORDER_SELECTION` étendu à `has_unverified_prices` et `tenant_order_items.price_origin`) → `orderSummaryToUi()`.

## Geste distinct : l'acquittement voyage jusqu'à l'API, jamais deviné

Le point 12 (c) exige un acquittement explicite pour valider une commande marquée. Le contrat (`transitionOrderCommandSchema.acknowledgeUnverifiedPrices`) existait déjà depuis Q17-a, mais **rien côté UI ne le posait jamais à `true`** — la confirmation nommée aurait été cosmétique sans ce câblage. Fait :
- `ValidateOrderConfirmDialog.handleConfirm()` appelle `onConfirm(orderId, hasUnverifiedPrices)`.
- `useDashboardOrderManagement.validate(orderId, acknowledgeUnverifiedPrices = false)` relaie ce booléen à `transition(order, 'validated', acknowledgeUnverifiedPrices)`, qui le transmet à `ordersApi.transition(...)`.
- `cancel()` ne relaie AUCUN acquittement (annuler un brouillon n'a rien à acquitter) — vérifié explicitement par un test.
- Repli défensif ajouté : `isUnverifiedPrices()` (nouveau classifieur, `orderTransitionErrors.helpers.ts`) et un message clair dans `formatValidateErrorMessage()` si le refus 409 `orders.unverified_prices` atteint quand même l'écran (état affiché périmé entre le chargement de la liste et le clic) — sans ce repli, le texte technique brut `unverified_prices: [...]` aurait fui à l'écran, exactement le défaut déjà corrigé pour les autres codes de ce fichier.

## Fichiers créés

Aucun. Ce lot étend des fichiers existants, conformément au tableau de répartition du point 12 (i)/(h) (« `OrderHistoryTable.tsx`, le détail de commande de l'atelier, `testIds.ts` »).

## Fichiers modifiés

- `src/modules/orders/api/contracts.ts` — `orderItemSchema.priceOrigin` (nullable), `orderSummarySchema.hasUnverifiedPrices`.
- `src/modules/orders/index.ts` — export du type `PriceOrigin`.
- `src/modules/orders/application/orders-repository.ts` — `TenantOrderRecord` porte `hasUnverifiedPrices` et `items[].priceOrigin`.
- `src/modules/orders/application/orders-service.ts` — `toTenantSummary`/`toLegacySummary` posent ces deux champs (`false`/`null` pour la cohorte legacy `shop_orders`, qui n'a pas cette notion).
- `src/adapters/supabase/orders-repository.ts` — `TENANT_ORDER_SELECTION` étendu (`has_unverified_prices`, `tenant_order_items.price_origin`), `TenantOrderRow` élargi à la main (colonnes Q17-a absentes de `database.types.ts` généré, front seul — pas de régénération qui exigerait un déploiement), `toTenantOrder()` mappe les deux champs avec repli fermé (`?? false`, `isPriceOrigin(...) : null`).
- `src/modules/orders/ui/storefront/PortalOrders.helpers.ts` — `OrderUI.items[].priceOrigin` et `OrderUI.hasUnverifiedPrices` (optionnels — cohorte legacy ne les porte pas), `orderSummaryToUi()` les copie.
- `src/modules/orders/ui/storefront/OrderHistoryTable.tsx` — `showsUnverifiedPriceBadge()`, `describePriceOrigin()` (fonctions pures exportées), pastille, bouton de détail dépliable, ligne de détail par commande (`Fragment` pour porter deux `<tr>` par commande), `colSpan` calculé dynamiquement selon les colonnes réellement affichées.
- `src/modules/orders/ui/storefront/ValidateOrderConfirmDialog.tsx` — prop `order` (remplace `orderId`/`orderShortId`), `unverifiedLineNamesOf()` (fonction pure exportée), notice nommée, second bouton de confirmation distinct.
- `src/modules/orders/ui/hooks/useDashboardOrderManagement.ts` — `transition()`/`validate()` acceptent et relaient `acknowledgeUnverifiedPrices`.
- `src/modules/orders/ui/workspace/OrdersPage.tsx` — passe `order={orderToValidate}` et relaie l'acquittement à `validate()`.
- `src/modules/orders/ui/storefront/orderTransitionErrors.helpers.ts` — `ORDER_ERROR_CODE.UNVERIFIED_PRICES`, `isUnverifiedPrices()`.
- `src/modules/orders/ui/storefront/orderValidation.helpers.ts` — message clair sur le refus défensif `orders.unverified_prices`.
- `src/shared/presentation/testIds.ts` — 7 testids déclarés : `orderUnverifiedPriceBadge`, `orderDetailToggle`, `orderDetailRow`, `orderDetailLineItem`, `orderDetailLinePriceOrigin`, `validateOrderDialogUnverifiedNotice`, `validateOrderDialogConfirmUnverified`.
- `docs/architecture/api/openapi.yaml` — `OrderItem.priceOrigin`, `OrderSummary.hasUnverifiedPrices` (documentation, non gardée par un test d'exécution — voir « Ce que je n'ai pas su vérifier »).
- Tests : `tests/modules/orders/orders-service.test.ts`, `tests/server/api/orders-routes.test.ts`, `tests/components/shop/portal/{OrderHistoryTable.helpers,PortalOrders.helpers,ValidateOrderConfirmDialog.text,orderTransitionErrors.helpers,orderValidation.helpers}.test.ts`, `tests/app/hooks/useDashboardOrderManagement.test.ts` — fixtures étendues + nouveaux cas (détail ci-dessous).

## Dérogations R5

Aucune nouvelle. Ce lot ne touche à aucun endpoint E10, ne modifie pas `openapi/magrit-core.v1.yaml` (route hors périmètre E10, comme établi par Q17-a point 12 (f)).

## Ce que je n'ai PAS su faire / limites assumées

- **`docs/architecture/api/openapi.yaml` n'est pas gardé par un test d'exécution** pour ces deux nouveaux champs (contrairement au contrat Zod, réellement vérifié par `outputSchema.safeParse` à chaque requête). Je l'ai mis à jour par cohérence documentaire et parce que Q17-a avait établi ce précédent, mais aucun test ne casserait si ce fichier divergeait à nouveau du code — c'est une limite déjà connue de cette façade historique (pas un défaut introduit par moi).
- **Aucun test de rendu React (RTL)** : ce dépôt n'a pas de bibliothèque de rendu de composants (vérifié par grep, `@testing-library/react` absent). Toute la logique nouvellement ajoutée est donc extraite en fonctions pures testées directement (`showsUnverifiedPriceBadge`, `describePriceOrigin`, `unverifiedLineNamesOf`, `isUnverifiedPrices`), complétée par des tests textuels sur le code source pour les libellés et le câblage qui ne peuvent pas être extraits (pattern déjà en place dans ce dépôt — `*.text.test.ts`). Je n'ai donc **pas** vérifié par un test automatisé que la pastille s'affiche réellement à l'écran dans le DOM ni que le clic sur le bouton de détail déplie réellement la ligne — seule la logique qui décide QUAND l'afficher est prouvée.
- **`Q17-b`** (produit configuré, devis serveur) : hors périmètre, non commencé, dépend de BCP-1b.

## Tests exécutés — chiffres réels

**Vérification préalable demandée** : chacun des tests suivants a été rejoué contre `origin/main` (avant ce lot, via un worktree Git détaché temporaire avec les mêmes `node_modules`) et **échoue** — 27 tests en échec, répartis sur 8 fichiers, tous liés au code absent (import inexistant ou propriété non exposée) :

```
Test Files  8 failed | 11 passed (19)
     Tests  27 failed | 212 passed (239)
```

Rejoués contre le code de ce lot, les mêmes 19 fichiers passent intégralement.

**Gates complètes, rejouées après le lot complet** :
- `pnpm typecheck` → **0 erreur**.
- `pnpm test:architecture` → **461 tests passés** (49 fichiers) — inchangé par rapport à la fin de Q17-a, ce lot ne touche aucun test d'architecture.
- `pnpm test:contract` → **434 tests passés** (23 fichiers) — inchangé, ce lot ne modifie ni ne crée d'endpoint.
- `pnpm gen:api:check` → **aligné**, aucune dérive (`openapi/magrit-core.v1.yaml` non touché).
- `pnpm test` (suite complète) → **3379 tests passés, 88 skippés** (336 fichiers : 324 passés, 12 skippés).

## Critères d'acceptation, un par un (dérivés du point 12 (h), pas de CA numérotés BMAD pour ce lot)

1. **Pastille « Prix non vérifié » sur la grille atelier quand `has_unverified_prices`** — **FAIT**. `showsUnverifiedPriceBadge()`, testé (4 cas : vrai/faux/portail toujours faux/valeur absente).
2. **Le prix reçu, et le prix catalogue à côté quand le serveur sait le calculer, au détail de la ligne** — **FAIT**, sous la forme tranchée (libellé de provenance, pas un second montant) : ligne dépliable dans `OrderHistoryTable.tsx`.
3. **La confirmation de validation nomme les lignes concernées sur une commande marquée** — **FAIT**. `unverifiedLineNamesOf()`, notice nommée, second bouton distinct au libellé exact du cadrage.
4. **Front seul, aucun déploiement Supabase** — **RESPECTÉ**. Aucune migration, aucune Edge Function.
5. **Aucune lecture directe de table ; `price_origin`/`has_unverified_prices` remontent par la façade** — **FAIT ET COMPLÉTÉ** : le trou laissé par Q17-a sur `listPortalOrders`/`OrderSummary` est comblé.
6. **Aucun `data-testid` inventé** — **RESPECTÉ**. 7 testids déclarés dans `testIds.ts` avant usage.
7. **Libellé compréhensible par un imprimeur, jamais `client_unverified` à l'écran** — **FAIT**, testé explicitement (`describePriceOrigin` ne contient jamais le nom technique ; recherche textuelle sur le composant de dialogue).
8. **Aucune arithmétique de prix réintroduite côté navigateur** — **RESPECTÉ**. Affichage seul (`formatEuro`), aucun calcul.
