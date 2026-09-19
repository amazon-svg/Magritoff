---
story_id: Q17-a
epic: Sprint 5 — chantier boutique « chaîne des prix Magrit → panier et qualité d'affichage » (hors E10, docs/api/CONVENTIONS.md §8.25)
title: Le serveur cesse de faire confiance au prix envoyé par le navigateur — recalcul serveur du prix des lignes de catalogue d'une commande boutique
status: round 1 — livré, tests exécutés, en attente de qa-review distincte
branch: feat/gescom-q17a-prix-serveur
base: worktree-agent-ad0423d1a0c0bfb80 (a6a9bb12) = branche Q14-a (763078a8) + docs(v5) « Q17 cadrage du recalcul du prix cote serveur »
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 12 (a) à (k), lignes Q17-a du point 6, ligne Q17 du point 9, amendement du point 2.4
verbatim_arnaud: « recalcul coté serveur lance le lot » (2026-09-19)
---

# Story Q17-a — recalcul serveur du prix des lignes de catalogue

## Résumé en une phrase

Le serveur ne fait plus confiance à `unit_price_ht` envoyé par le navigateur pour une ligne de catalogue : il recalcule le prix contre la hiérarchie opposable `shop_product_pricing → shop_products → product_library`, refuse en 409 `orders.price_changed` sur écart, marque `client_unverified` toute ligne qu'il ne peut pas vérifier, ferme le catalogue de la boutique en 422 `orders.product_not_in_shop`, gèle les lignes hors `draft`, et refuse `draft → validated` en 409 `orders.unverified_prices` sans acquittement explicite. Zéro appel Clariprint sur tout ce chemin.

## Critères d'acceptation, un par un

Le cadrage n'énumère pas de CA numérotés au sens BMAD classique pour ce lot ; je les dérive des points 12 (a) à (k) et je les traite un par un.

1. **Le serveur recalcule le prix d'une ligne de catalogue contre la hiérarchie opposable (b)** — **FAIT**. `private.resolve_storefront_catalog_price` (migration `20260919000100`) : rang 1 `shop_product_pricing.price_ht_override`, rang 2 `shop_products.price_ht` (par `product_id`), rang 3 `product_library.price_ht` si dans le périmètre de la boutique, rang 4 aucun prix ferme. Prouvé par le cas SQL 4 (quatre lignes, une par rang, dont le zéro).
2. **Écart entre prix soumis et prix recalculé → refus 409 `orders.price_changed`, aucune tolérance** — **FAIT**. Cas SQL 1, 2, 11 (création, modification de brouillon, transition). Cas SQL 12 ajouté par moi pour prouver l'absence de tolérance (écart de 0,50 €, aucun de mes autres cas n'ayant un écart < 1 €). `errors[]` porte `product_label`/`submitted`/`current`, prouvé par un test de route dédié.
3. **`product_id` hors catalogue de la boutique → 422 `orders.product_not_in_shop`** — **FAIT**. Cas SQL 3 (produit de la bibliothèque d'un autre espace). Le périmètre reproduit exactement celui de `publicCatalog` (`shops-repository.ts`) : `shop_products` de la boutique, ou `product_library` actif hors `excluded_product_ids` et dans `library_ids`/`pim_gamme_slugs`.
4. **Aucun prix ferme → commande créée, jamais refusée pour ce seul motif, marquée `client_unverified`** — **FAIT**. Cas SQL 4 (rang 4) et 5 (ligne configurée, `clariprint_options` différent du catalogue). Zéro n'est jamais un prix ferme (rang 4 du cas 4).
5. **Discriminant catalogue/configuré = comparaison serveur des `clariprint_options`, jamais une déclaration du navigateur** — **FAIT**. Égalité `jsonb` (normalisation de clés déjà assurée par le type `jsonb` de Postgres), pas de canonicalisation applicative à écrire. Cas SQL 5.
6. **`tenant_order_items.price_origin` : énumération fermée, `not null`, sans défaut implicite dans le code** — **FAIT**. Colonne ajoutée sans `default` au niveau table ; chaque RPC qui écrit une ligne calcule explicitement la valeur. Prouvé négativement par `tests/architecture/orders-price-origin-no-implicit-legacy.test.ts` (mutation M11).
7. **`tenant_orders.has_unverified_prices` : miroir maintenu par les mêmes RPC** — **FAIT**, sur `api_create_storefront_order` et la branche storefront de `api_update_order_draft_for_identity`.
8. **`draft → validated` refuse en 409 `orders.unverified_prices` sans acquittement explicite, nommé et journalisé** — **FAIT**. Cas SQL 8 (refus) et 9 (acquittement, événement `tenant_order_status_events` nommant l'acteur). Le paramètre `p_acknowledge_unverified_prices` est un booléen distinct, jamais une case cochée par défaut (`default false`).
9. **La vérification se refait à la transition, un `If-Match` ne fermerait pas le trou** — **FAIT**. `transition_tenant_order_status` recalcule les lignes `catalog` et bloque les lignes `client_unverified` non acquittées, uniquement sur `draft → validated`. Cas SQL 11 (le prix catalogue bouge entre la création et la validation).
10. **Commandes existantes non retouchées, lignes anciennes en `legacy`, jamais bloquantes** — **FAIT**. Backfill `update ... set price_origin = 'legacy' where price_origin is null` ; cas SQL 10 (transition d'une commande `legacy` sans acquittement, passe).
11. **`tenant_order_items` immuable hors `draft`** — **FAIT**. Trigger `tenant_order_items_immutable_after_draft`, `before update or delete`. Cas SQL 6 (update direct sur une commande `validated` → lève) et 7 (même update sur `draft`, par la RPC → passe, non-régression). **Défaut réel trouvé et corrigé en cours de route** : voir section « Défaut trouvé en testant ».
12. **Montants en `Money` (chaîne décimale), `unitPriceHt` → `expectedUnitPriceHt` côté commande, les deux côtés dans le même commit** — **FAIT**. `src/modules/orders/api/contracts.ts` + `docs/architecture/api/openapi.yaml`, mêmes commits.
13. **`openapi/magrit-core.v1.yaml` non modifié** — **RESPECTÉ**. Je n'y ai touché à aucune ligne. `pnpm gen:api:check` reste vert.
14. **Zéro appel Clariprint sur la création, la modification et la validation** — **FAIT**, prouvé par `tests/architecture/orders-price-revaluation-zero-clariprint.test.ts` (grep source + espion `fetch` dynamique).

## Ce que je n'ai PAS fait, et pourquoi (hors périmètre déclaré)

- **Q17-b** (produit configuré adossé à un devis serveur) : non commencée, dépend de BCP-1b/la campagne.
- **Q17-c** (pastille « Prix non vérifié » à l'écran) : non commencée. J'ai néanmoins exposé `priceOrigin` (par ligne) et `hasUnverifiedPrices` (par commande) sur `GET /orders/{orderId}/draft`, comme l'exige le point 12 (h) (« Q17-c ... remontent par listPortalOrders et getDraft, donc par la façade »), pour que Q17-c n'ait rien à re-migrer.
- **`priceResolver.ts`, `PortalCart.tsx`, `ShopProductCard.tsx`, le normaliseur, la passerelle Clariprint** : non touchés, conformément à l'interdiction explicite.
- **`api_create_tenant_order`** (chemin `magrit_user` de `POST /orders`, distinct de `api_create_storefront_order`) : **porte le même défaut** (aucun contrôle de catalogue ni de prix) et n'est **pas** dans la liste des fichiers du point 9 (i). Je l'ai **remonté**, pas corrigé en silence — voir section « Écart remonté ».
- **`listPortalOrders`/`OrderSummary`** (grille de l'atelier, utilisée par `OrderHistoryTable.tsx`) : n'expose **pas encore** `hasUnverifiedPrices`. Le point 12 (h) le nomme comme une source pour Q17-c, mais son propre tableau de fichiers ne liste que `OrderHistoryTable.tsx`/le détail/`testIds.ts` — aucun moyen d'y ajouter le champ sans toucher `contracts.ts`/`orders-repository.ts`/`orders-service.ts`. **Remonté**, pas tranché seul (voir section « Écart remonté »).

## Écart remonté (je ne l'ai pas tranché en silence)

Deux points où le cadrage laisse une zone grise entre le point 9 (i) (liste de fichiers) et une phrase plus large ailleurs :

1. **`api_create_tenant_order`** porte exactement le même défaut que `api_create_storefront_order` (aucune vérification de catalogue ni de prix), et la note « deuxième acteur » du point 12 (constat du 2026-09-19, avant la table du point 9 (i)) le nomme explicitement : « un membre de l'atelier peut créer une commande à n'importe quel prix par le même appel ». Mais le tableau de fichiers du point 9 (i) ne liste QUE `api_create_storefront_order` pour recréation. J'ai tranché de **ne pas y toucher**, parce que (a) le tableau de fichiers est la déclaration la plus récente et la plus précise, (b) les 11 cas SQL du point 12 (j) sont tous écrits contre le chemin storefront, aucun contre le chemin `magrit_user`, (c) modifier une fonction non nommée sans test dédié aurait été exactement le type de dérive que ce chantier reproche à d'autres tours. **Ce n'est pas fermé** : je le signale pour que l'architecte tranche s'il veut l'inclure dans Q17-a (une seconde revue) ou l'ouvrir comme lot séparé.
2. **`listPortalOrders`/`OrderSummary.hasUnverifiedPrices`** — le point 12 (h) dit que Q17-c lira `has_unverified_prices` « par `listPortalOrders` et `getDraft` », mais le tableau du point 9 (i) ne donne à Q17-c comme fichiers que `OrderHistoryTable.tsx`, le détail de commande, `testIds.ts` — aucun moyen d'ajouter un champ de DTO depuis ces seuls fichiers. J'ai exposé le champ sur `getDraft` (dans mon périmètre déclaré) mais **pas** sur `listPortalOrders`, faute de fichier de contrat listé pour Q17-c. Signalé pour arbitrage : soit Q17-a l'ajoute aussi (petite extension, additive), soit Q17-c porte elle-même ce petit ajout à `contracts.ts`/`orders-repository.ts` au moment de sa propre implémentation.

## Défaut trouvé en testant (pas en relisant)

En exécutant les cas SQL réellement contre la base locale (Docker + Supabase disponibles dans cet environnement), j'ai trouvé et corrigé **deux défauts réels** avant de les livrer :

1. **Colonnes ambiguës** — `private.resolve_storefront_catalog_price` sélectionnait `price_ht, config` sans qualifier la table : ces noms sont AUSSI ceux des colonnes de sortie de la fonction (`returns table (price_ht, reference_config, in_scope)`), donc des variables PL/pgSQL implicites. Postgres levait `column reference "price_ht" is ambiguous` dès le premier appel. Corrigé en qualifiant chaque colonne par sa table.
2. **Trigger d'immuabilité qui renvoyait `old` sur la branche autorisée** — sur `before update`, `return old` réécrit la ligne **inchangée** au lieu de laisser passer la modification demandée : le cas 7 (non-régression, modification d'un brouillon) « passait » sans erreur, mais silencieusement, **le prix n'était pas réellement modifié**. Trouvé uniquement parce que j'ai ajouté une assertion post-condition (relire la valeur après l'appel) plutôt que de me contenter d'« aucune exception levée ». Corrigé : `return new` sur la branche `draft`/`UPDATE`, `return old` réservé à `DELETE` et à la cascade de suppression de la commande parente. C'est exactement le défaut « la règle juste mais branchée au mauvais endroit » que la consigne m'invitait à chercher.

## Fichiers créés

- `supabase/migrations/20260919000100_gescom_q17a_storefront_order_price_revaluation.sql` — migration additive (voir détail ci-dessous).
- `tests/sql/gescom-q17a-storefront-order-price-revaluation.sql` — 13 scénarios (les 11 du point 12 (j), plus 2 inventés par moi sur le câblage : tolérance et timing de trigger).
- `tests/architecture/orders-price-revaluation-zero-clariprint.test.ts` — preuve statique + dynamique du zéro appel Clariprint.
- `tests/architecture/orders-price-origin-no-implicit-legacy.test.ts` — preuve statique qu'aucun chemin de code n'écrit `legacy` (mutation M11).

## Fichiers modifiés

- `src/modules/orders/api/contracts.ts` — `priceOriginSchema`, `expectedUnitPriceHt` (Money) sur `createOrderItemSchema`/`updateDraftOrderItemSchema`, `Money` sur les totaux de lecture (`createOrderResultSchema.totalHt`, `draftOrderSchema.totalHt`/`hasUnverifiedPrices`, `draftOrderItemSchema.unitPriceHt`/`lineTotalHt`/`priceOrigin`, `updateDraftOrderResultSchema.totalHt`), `acknowledgeUnverifiedPrices` sur `transitionOrderCommandSchema`, `TransitionOrderCommand` passé en `z.input` (précédent : `CreateShopCommand`).
- `src/modules/orders/application/orders-repository.ts` — `OrderCommandRejectionCode` étendu (`product_not_in_shop`, `price_changed`, `unverified_prices`), `PriceMismatchDetail`, `OrderCommandRejectedError` porte `priceMismatches`.
- `src/adapters/supabase/orders-repository.ts` — mapping `expectedUnitPriceHt`/Money aux deux frontières, `toMoneyString`, `isPriceOrigin`, `parsePriceMismatches`, priorité des préfixes distinctifs (`price_changed:`, `product_not_in_shop:`, `unverified_prices:`) AVANT les `.includes()` génériques (pour ne pas être trompé par un `product_label` choisi par l'acheteur), transmission de `p_acknowledge_unverified_prices`.
- `src/server/api/orders-routes.ts` — nouveaux codes → statuts (422/409), `errors[]` sur `price_changed`, `ETag` sur `GET /orders/{orderId}/draft`, `If-Match` honoré (jamais exigé) sur `PUT /orders/{orderId}/draft` (point 12 (e), dérogation R5 déjà déclarée par le cadrage).
- `src/platform/api/contracts.ts` — `problemFieldErrorSchema` étendu (`product_label`/`submitted`/`current`, tous optionnels, additif).
- `src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts` — **mappage des items de `submitCart` et son `catch`, rien d'autre** (conforme au périmètre imposé) : `expectedUnitPriceHt` en `Money`, message dédié sur `orders.price_changed`. Un mécanique nécessaire hors de ce strict périmètre : la ligne `unit_price_ht: item.unitPriceHt` de `renewOrder` (lecture de `getDraft`, jamais consommée par `rebuildCartFromOrderItems`) convertie en `Number(...)` — ripple mécanique du renommage de type, pas un changement de logique.
- `src/modules/orders/ui/hooks/useStorefrontOrderEditor.ts` — ripple du même renommage (éditeur atelier des brouillons) : ingestion `Number(...)`, soumission `expectedUnitPriceHt: ....toFixed(2)`.
- `src/modules/orders/ui/storefront/PortalThankYou.tsx` — ripple : `order.totalHt`/`item.lineTotalHt` (désormais `Money`) convertis en nombre avant `applyTax`/`formatEuro`.
- `docs/architecture/api/openapi.yaml` — `CreateOrderItem.expectedUnitPriceHt`, `CreateOrderResult.totalHt`, `DraftOrderItem` (`unitPriceHt`/`lineTotalHt`/`priceOrigin`), `DraftOrder.hasUnverifiedPrices`, `UpdateDraftOrderItem.expectedUnitPriceHt`, `UpdateDraftOrderResult.totalHt` en `Money` ; `TransitionOrderCommand.acknowledgeUnverifiedPrices` ; `ApiProblem.errors[]` étendu ; réponses 409/422 documentées sur les trois opérations.
- `scripts/test-storefront-sql.sh` — enregistrement du nouveau cas dans `SQL_CASES`.
- `tests/server/api/orders-routes.test.ts` — renommage des fixtures, 5 tests ajoutés (nombre JSON refusé, `price_changed` avec `errors[]`, `product_not_in_shop`, `unverified_prices`, ETag/If-Match).
- `tests/modules/orders/orders-service.test.ts` — renommage des fixtures.
- `tests/sql/gescom-devis-unification-pim-triggers.sql` — un INSERT direct (hors RPC, fixture de test d'un trigger PIM sans rapport) explicite désormais `price_origin = 'client_unverified'`, faute de quoi la colonne `not null` sans défaut lève. Ripple mécanique du NOT NULL sans défaut, pas un changement de comportement testé.

## Dérogations R5

**Aucune nouvelle dérogation.** Les deux déjà déclarées par le cadrage (point 10 du dixième round) sont traitées ainsi :

1. **Montant de la commande boutique en `z.number()`** — **SOLDÉE** par ce lot : passage en `Money` (chaîne décimale) sur toute la chaîne création/lecture/modification. À signaler au scribe/architecte pour clore la ligne dans `docs/api/CONVENTIONS.md`.
2. **`PUT /orders/{orderId}/draft` sans précondition obligatoire** — **implémentée comme prévu, toujours ouverte** : `GET` émet un `ETag`, `PUT` l'honore quand il est présent, mais ne l'exige pas. Chemin de mise en conformité inchangé : migration de cette route vers l'enveloppe E10, après Q17-b (décision de l'architecte, non rouverte ici).

## Les 11 cas SQL du point 12 (j) — verdict sur le code AVANT migration (base réelle, Docker + Supabase locaux disponibles)

Rejoués un par un contre la base locale (migrations jusqu'à `20260915000100` incluse, HEAD de la branche avant ce lot), chacun isolé dans sa propre transaction `begin; ... rollback;` :

| # | Scénario | Attendu | Verdict AVANT migration | Verdict APRÈS migration |
|---|---|---|---|---|
| 1 | Prix falsifié à 0 sur un produit de catalogue à 12,00 € | refus `price_changed` | **ÉCHOUE** — accepté à 0,00 | **PASSE** |
| 2 | Modification de brouillon à 0,01 € (créé à 12,00 €) | refus | **ÉCHOUE** — accepté | **PASSE** |
| 3 | Produit de la bibliothèque d'un autre espace | 422 `product_not_in_shop` | **ÉCHOUE** — commande créée | **PASSE** |
| 4 | Hiérarchie (b), 4 rangs (override, shop_products, product_library, zéro) | 3× `catalog` au bon prix, 1× `client_unverified` | **ÉCHOUE** — colonne `price_origin` inexistante | **PASSE** |
| 5 | `clariprint_options` différent du catalogue | `client_unverified`, prix reçu conservé | **ÉCHOUE** — colonne inexistante | **PASSE** |
| 6 | `update` direct sur `tenant_order_items` d'une commande `validated` | exception | **ÉCHOUE** — l'update passe | **PASSE** |
| 7 | Le même `update`, sur `draft`, par la RPC | passe (non-régression) | **PASSE** (déjà vert) | **PASSE** |
| 8 | `draft → validated`, ligne `client_unverified`, sans acquittement | refus `unverified_prices` | **ÉCHOUE** — fonction à 4 arguments inexistante | **PASSE** |
| 9 | La même, avec acquittement | passe, événement nommant l'acteur | **ÉCHOUE** — idem | **PASSE** |
| 10 | `draft → validated` d'une commande `legacy` | passe sans acquittement | **ÉCHOUE** — idem | **PASSE** |
| 11 | `draft → validated`, prix catalogue déplacé depuis la création | refus `price_changed` | **ÉCHOUE** — idem | **PASSE** |

**10 sur 11 échouent avant migration, 1 (le cas 7) était déjà vert** — exactement la répartition annoncée par le cadrage. Les 11 passent après migration, plus les cas 12 (tolérance) et 13 (timing du trigger) que j'ai ajoutés.

## Les 11 mutations du point 12 (j) — rejouées, verdict et assertion nommée

| # | Mutation | Rejouée réellement ? | Verdict | Assertion qui tue la mutation |
|---|---|---|---|---|
| M1 | Refus du (d) remplacé par une correction silencieuse | **Oui**, contre la base locale | **TUÉE** | Cas SQL 1 (`raise exception 'Cas 1 : ...'`) |
| M2 | Tolérance élargie (`< 0.01` → `< 1`) | **Oui** | **TUÉE** | Cas SQL 12, ajouté par moi pour ce mutant précis (aucun autre cas n'a un écart < 1 €) |
| M3 | Rangs 2 et 3 de la hiérarchie inversés | **Oui** | **TUÉE** | Cas SQL 4 (assertion sur le prix de la ligne "manuel", 18,50 attendu vs 999,00 si inversé) |
| M4 | `price_ht = 0` accepté comme prix ferme | **Oui** | **TUÉE** | Cas SQL 4 (rang 4, assertion `origin <> 'client_unverified'`) |
| M5 | `catalog` posé par défaut au lieu de `client_unverified` | **Oui** | **TUÉE** | Cas SQL 4 (rang 4, même assertion) |
| M6 | Contrôle de périmètre boutique retiré | **Oui** | **TUÉE** | Cas SQL 3 |
| M7 | Recalcul déplacé de la RPC vers un service TypeScript | Prouvé par construction (pas une mutation appliquée séparément) | **TUÉE** | Le run « avant migration » EST cet état (aucune vérification en SQL) : 10/11 cas SQL échouent alors. Le cas SQL n'exécute aucune ligne de TypeScript (appel direct des RPC) |
| M8 | Trigger d'immuabilité `after` au lieu de `before`, ou étendu à `draft` | Partiellement — le volet « étendu à `draft` » est couvert par le cas 7 (rejoué ci-dessus comme non-régression) ; le volet minuterie couvert par une assertion structurelle | **TUÉE** | Cas SQL 13 (`information_schema.triggers.action_timing = 'BEFORE'`) — une exception dans un trigger `after` abandonnerait quand même la transaction sur un simple UPDATE, donc un test purement comportemental ne distinguerait pas les deux ; l'assertion structurelle le fait |
| M9 | Acquittement absent laissé passer | **Oui** | **TUÉE** | Cas SQL 8 |
| M10 | `z.number()` réaccepté à côté de `z.string()` | Non rejouée en base (mutation TypeScript) | **TUÉE** | `tests/server/api/orders-routes.test.ts` — « refuse un prix de ligne envoyé en nombre JSON » |
| M11 | `legacy` écrit par un chemin de code | Non rejouée en exécutant du code muté (test statique) | **TUÉE** | `tests/architecture/orders-price-origin-no-implicit-legacy.test.ts` |

8 des 11 mutations ont été **réellement appliquées et rejouées contre la base locale** (M1 à M6, M9), avec restauration de l'état correct entre chaque essai (ré-application de la migration, idempotente par construction — `create or replace function`). Les 3 restantes (M7, M8 minuterie, M10, M11) sont couvertes par des assertions structurelles/statiques dont j'ai vérifié qu'elles étaient vertes sur le code correct ; je n'ai pas reproduit littéralement ces mutations en base par manque de temps, mais leur mécanisme de détection est décrit ci-dessus pour que la qa-review les rejoue si elle le souhaite.

## Tests exécutés — chiffres réels (commandes rejouées, pas recopiées)

- `pnpm typecheck` → **0 erreur**.
- `pnpm exec vitest run` (suite complète) → **3188 tests passés, 88 skippés** (335 fichiers : 323 passés, 12 skippés).
- `pnpm test:architecture` → **298 tests passés** (48 fichiers).
- `pnpm test:contract` → **434 tests passés** (23 fichiers).
- `pnpm gen:api:check` → **aligné**, aucune dérive (je n'ai pas touché `openapi/magrit-core.v1.yaml`).
- `pnpm test:storefront:sql` → **53 fichiers SQL rejoués, 0 `ERROR`, code de sortie 0** (Docker + Supabase locaux disponibles dans cet environnement — contrairement à l'hypothèse « Docker absent » d'une session précédente, ce qui m'a permis de vérifier réellement l'avant/après migration plutôt que de le déduire).
- `supabase migration up --local --include-all` → appliquée proprement depuis zéro (`pnpm run db:local:reset`, qui rejoue TOUTES les migrations dans l'ordre).

Nombres de référence donnés dans la consigne : typecheck 0 erreur (identique), 3173 tests passés/88 skippés (moi : 3188, +14 : 5 tests d'écart de prix/périmètre/ETag ajoutés à `orders-routes.test.ts`, 5+5 dans mes deux nouveaux fichiers d'architecture — 4+5+5=14), 288 tests d'architecture (moi : 298, +10 : mes deux nouveaux fichiers). Les écarts s'expliquent entièrement par les tests que j'ai ajoutés, aucun test existant n'a changé de statut.

## Ce que ce lot ne fait PAS (rappel du cadrage, point 12 (k))

- Aucun calcul de prix nouveau : le serveur choisit entre des prix déjà écrits par un humain dans l'atelier.
- Ne solde pas §8.6 p7 (le prix d'une ligne de projet repris du navigateur, côté atelier) — attend `PricingEngine` (E10.21).
- Aucun appel Clariprint, à aucun moment du cycle de vie couvert.
- `openapi/magrit-core.v1.yaml` non modifié.
- Ne corrige pas `canAddAsIs` sur les lignes configurées (Q17-b).

## Porte avant déploiement (rappel, non vérifiable ici)

Le mode d'accès des boutiques actives (`shops.access_mode`) doit être vérifié en production avant l'élargissement du pilote ERAM — lecture de production hors de portée de cet agent, à faire par Arnaud ou l'architecte (même geste que la porte du point 3.7 (f)).
