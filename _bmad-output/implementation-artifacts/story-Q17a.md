---
story_id: Q17-a
epic: Sprint 5 — chantier boutique « chaîne des prix Magrit → panier et qualité d'affichage » (hors E10, docs/api/CONVENTIONS.md §8.25)
title: Le serveur cesse de faire confiance au prix envoyé par le navigateur — recalcul serveur du prix des lignes de catalogue d'une commande boutique
status: round 2 — trois bloquants (B1, B2, B3) et six durcissements (D1-D6) corrigés après rejet qa-review, en attente de nouvelle qa-review distincte
branch: feat/gescom-q17a-prix-serveur
base_round1: worktree-agent-ad0423d1a0c0bfb80 (a6a9bb12) = branche Q14-a (763078a8) + docs(v5) « Q17 cadrage du recalcul du prix cote serveur »
base_round2: HEAD round 1 (271e8af6, commité)
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 12 (a) à (k), lignes Q17-a du point 6, ligne Q17 du point 9, amendement du point 2.4
verbatim_arnaud: « recalcul coté serveur lance le lot » (2026-09-19)
---

# Story Q17-a — recalcul serveur du prix des lignes de catalogue

## ROUND 2 — corrections après rejet qa-review (B1, B2, B3, D1-D6)

Le round 1 (commit `271e8af6`) a été **rejeté** sur trois défauts bloquants, tout en confirmant que la garde SQL, les 11 cas et les 11 mutations du point 12 (j) tenaient, que les deux défauts trouvés en testant au round 1 étaient réellement corrigés, que les chiffres étaient exacts et qu'aucune dérogation nouvelle n'avait été introduite.

**BLOQUANT B1 (corrigé) — `api_create_tenant_order` (chemin `magrit_user` de `POST /orders`) levait une erreur NOT NULL sur `price_origin` dès le premier appel.** Ma migration ajoute `price_origin` NOT NULL sans défaut de colonne, et cette fonction — que j'avais explicitement décidé de ne pas toucher — insérait dans `tenant_order_items` sans cette colonne. C'était une **régression** que je n'avais pas mesurée : mon affirmation « `api_create_tenant_order` porte le même défaut » et « je ne l'ai pas touché » était fausse sur le second point, puisque ne pas la recréer la CASSAIT quand même. Corrigé par le minimum motivé : `price_origin = 'client_unverified'` explicite sur chaque ligne, `has_unverified_prices = true` sur la commande (échec fermé, cette fonction ne vérifie toujours rien). Le fond — aucun contrôle de catalogue ni de prix sur ce chemin — reste porté à l'architecte, pas tranché par moi. Cas SQL 14 ajouté, rejoué ROUGE sur le code de round 1, VERT après correction ; mutation inverse (retirer `price_origin` de l'insert) rejouée, cas 14 retombe.

**BLOQUANT B2 (corrigé) — le serveur écrivait le total sur le prix REÇU, pas sur celui qu'il avait résolu.** `classify_storefront_order_line` comparait `round(p_unit_price_ht, 2)` au prix catalogue pour décider du refus, mais les trois écritures (`api_create_storefront_order`, la branche storefront et — après B3 — la branche atelier de la modification de brouillon) reprenaient ensuite la valeur BRUTE reçue (`item->>'unit_price_ht'`) pour `unit_price_ht`, `line_total_ht` et `total_ht`. Un prix soumis à 11,995 € pour un produit à 12,00 € passait le test d'égalité (arrondi à 12,00) mais la ligne stockée restait à 11,995 € — sur une grande quantité (100 000), l'écart se chiffre en centaines d'euros (500 € reproduits exactement par la qa). Corrigé à la source : `classify_storefront_order_line` rend maintenant `resolved_unit_price_ht` (le prix SERVEUR pour une ligne `catalog`, la valeur soumise arrondie pour une ligne `client_unverified`), et les trois écritures utilisent cette seule valeur, plus jamais `item->>'unit_price_ht'`. Cas SQL 15 ajouté (11,995 € × 100 000, puis 11,996 € à la modification), rejoué ROUGE sur le code de round 1 (`line_total_ht = 1199500.00` au lieu de `1200000.00`), VERT après correction ; mutation inverse rejouée, retombe.

**BLOQUANT B3 (corrigé) — la branche ATELIER de `PUT /orders/{orderId}/draft` (`api_update_tenant_order_draft`, atteinte quand l'acteur authentifié EST le `created_by` sans cookie boutique — notamment une commande créée via une session boutique DÉLÉGUÉE) n'avait aucune garde.** Le round 1 ne fermait que la branche storefront de `api_update_order_draft_for_identity` ; l'autre déléguait intégralement à une fonction inchangée, sans recalcul, sans mise à jour de `price_origin` ni de `has_unverified_prices`. Corrigé : `api_update_tenant_order_draft` est recréée avec la même classification et le même refus que la branche storefront, en lisant le `shop_id` de la commande. Cas SQL 16 ajouté (session déléguée, PUT sans cookie, prix falsifié à 0,01 € sur une ligne à 12,00 €), rejoué ROUGE sur le code de round 1, VERT après correction, plus une non-régression sur un prix correct ; mutation inverse (fonction round 1 réinjectée telle quelle) rejouée, retombe.

**DURCISSEMENT D1 (fait, deux volets)** — le trigger de gel ne couvrait que `UPDATE`/`DELETE` : un `INSERT` direct dans une commande `shipped` passait. Étendu à `INSERT`. Deuxième volet, plus large : `tenant_orders.status` restait écrivable en direct par tout `can_manage_tenant_orders` (`shipped → draft → reprix → shipped` sans le moindre événement). Un nouveau trigger `tenant_orders_status_change_guard` refuse tout changement de `status` hors d'un laissez-passer transactionnel (`app.q17a_allow_status_transition`) posé uniquement par `transition_tenant_order_status` et par l'annulation storefront, juste avant leur propre `UPDATE`, et refermé juste après (le laissez-passer est porté par la transaction, pas par l'instruction — un test qui enchaîne plusieurs opérations dans une même transaction l'aurait laissé ouvert sans ce refermement explicite, défaut que j'ai trouvé en écrivant mon propre cas de test). Cas SQL 17 (deux volets), rejoués ROUGE sur le code non durci, VERT après ; mutations inverses (retirer `insert` du trigger, retirer le second trigger) rejouées, retombent.

**DURCISSEMENT D2 (fait)** — la re-vérification était indexée sur le libellé `validated`, alors que `tenant_order_status_transitions` est une matrice PAR TENANT modifiable : un tenant ajoutant `draft → in_production` aurait contourné le refus `unverified_prices` ET la re-vérification `price_changed`. Condition changée en « quitter `draft` sauf vers `cancelled` ». Cas SQL 18 ajouté (transition personnalisée `draft → in_production`), rejoué ROUGE sur la condition round 1, VERT après ; mutation inverse rejouée, retombe.

**DURCISSEMENT D3 (fait)** — l'`If-Match`/`ETag` du round 1 était réimplémenté à la main, avec un code `orders.draft_changed` inventé, sans le contrôle de syntaxe de `readIfMatch` (`If-Match: *` ou un ETag malformé donnaient 409 au lieu de 400) et sans `current_state`. Recâblé sur les utilitaires PARTAGÉS du socle (`readIfMatch`, `assertPrecondition`, `computeEntityTag`, `_shared/application/concurrency.ts`), avec une conversion `ProblemError → ApiHttpError` (`toApiHttpError`) puisque cette route appartient à la façade historique, pas à la façade E10. `docs/architecture/api/openapi.yaml` documente l'`ETag` sur `GET` et les nouveaux codes (`api.if_match_invalid` 400, `api.resource_conflict` 409) sur `PUT`. Test de route étendu : `*`, ETag malformé, ETag correct, ETag faux — les quatre cas.

**DURCISSEMENT D4 (fait)** — le test « aucun chemin de code n'écrit `legacy` » ne lisait qu'un seul fichier de migration en dur. Réécrit pour balayer TOUT `supabase/migrations/*.sql` (165 fichiers testés), avec une liste d'exceptions NOMMÉE (deux occurrences déclarées, motivées, dans la seule migration Q17-a).

**DURCISSEMENT D5 (fait)** — `moneySchema` (partagé) accepte un signe négatif ; un montant de commande boutique ne l'est jamais. Nouveau `nonNegativeMoneySchema` (précédent : `nonNegativeRateSchema`), appliqué à tous les champs Money du module `orders` (`expectedUnitPriceHt`, `unitPriceHt`, `lineTotalHt`, `totalHt`).

**DURCISSEMENT D6 (signalé, non corrigé, comme demandé)** — `toMoneyString` fait `.toFixed(2)` sur un `number`, du flottant sur un montant. Convention déjà établie ailleurs dans le dépôt (`commercial-orders-repository.ts`) ; corriger demande une décision transverse (parseur décimal partagé), pas un correctif local. Documenté dans le code et ici.

**Corrections documentaires demandées, faites** : l'arithmétique des tests ajoutés était fausse (j'avais écrit 4+5+5=14 ; c'est 5+5+5=15) — section « Tests exécutés » corrigée avec les VRAIS comptes du round 2 ; le fichier de cas SQL est renommé en `tests/sql/storefront-order-price-revaluation.sql`, exactement le nom prescrit par le point 12 (j) (je l'avais préfixé `gescom-q17a-` par analogie avec les stories E10, à tort — ce lot n'est pas une story E10) ; les mentions « non rejouées par manque de temps » sur M7, M8, M10, M11 sont retirées de la section mutations (la qa les a rejouées, elles tombent) ; la phrase sur `api_create_tenant_order` est corrigée : ce n'était pas « inchangé », c'était **cassé par ce lot** (B1).

## Résumé en une phrase

Le serveur ne fait plus confiance à `unit_price_ht` envoyé par le navigateur pour une ligne de catalogue : il recalcule le prix contre la hiérarchie opposable `shop_product_pricing → shop_products → product_library`, refuse en 409 `orders.price_changed` sur écart, marque `client_unverified` toute ligne qu'il ne peut pas vérifier, ferme le catalogue de la boutique en 422 `orders.product_not_in_shop`, gèle les lignes hors `draft`, et refuse `draft → validated` en 409 `orders.unverified_prices` sans acquittement explicite. Zéro appel Clariprint sur tout ce chemin.

## Critères d'acceptation, un par un

Le cadrage n'énumère pas de CA numérotés au sens BMAD classique pour ce lot ; je les dérive des points 12 (a) à (k) et je les traite un par un.

1. **Le serveur recalcule le prix d'une ligne de catalogue contre la hiérarchie opposable (b)** — **FAIT**. `private.resolve_storefront_catalog_price` (migration `20260919000100`) : rang 1 `shop_product_pricing.price_ht_override`, rang 2 `shop_products.price_ht` (par `product_id`), rang 3 `product_library.price_ht` si dans le périmètre de la boutique, rang 4 aucun prix ferme. Prouvé par le cas SQL 4 (quatre lignes, une par rang, dont le zéro). **Round 2** : la valeur ÉCRITE (`unit_price_ht`, `line_total_ht`, `total_ht`) est désormais garantie être le prix RÉSOLU par cette hiérarchie (`resolved_unit_price_ht`), jamais la valeur brute reçue — BLOQUANT B2, prouvé par le cas SQL 15.
2. **Écart entre prix soumis et prix recalculé → refus 409 `orders.price_changed`, aucune tolérance** — **FAIT**. Cas SQL 1, 2, 11 (création, modification de brouillon, transition). Cas SQL 12 ajouté par moi pour prouver l'absence de tolérance (écart de 0,50 €, aucun de mes autres cas n'ayant un écart < 1 €). `errors[]` porte `product_label`/`submitted`/`current`, prouvé par un test de route dédié. **Round 2** : cette règle s'applique désormais aussi à la branche ATELIER de la modification de brouillon (`api_update_tenant_order_draft`, BLOQUANT B3, cas SQL 16), et la re-vérification à la transition ne dépend plus du libellé `validated` mais de « quitter `draft` » (DURCISSEMENT D2, cas SQL 18).
3. **`product_id` hors catalogue de la boutique → 422 `orders.product_not_in_shop`** — **FAIT**. Cas SQL 3 (produit de la bibliothèque d'un autre espace). Le périmètre reproduit exactement celui de `publicCatalog` (`shops-repository.ts`) : `shop_products` de la boutique, ou `product_library` actif hors `excluded_product_ids` et dans `library_ids`/`pim_gamme_slugs`.
4. **Aucun prix ferme → commande créée, jamais refusée pour ce seul motif, marquée `client_unverified`** — **FAIT**. Cas SQL 4 (rang 4) et 5 (ligne configurée, `clariprint_options` différent du catalogue). Zéro n'est jamais un prix ferme (rang 4 du cas 4).
5. **Discriminant catalogue/configuré = comparaison serveur des `clariprint_options`, jamais une déclaration du navigateur** — **FAIT**. Égalité `jsonb` (normalisation de clés déjà assurée par le type `jsonb` de Postgres), pas de canonicalisation applicative à écrire. Cas SQL 5.
6. **`tenant_order_items.price_origin` : énumération fermée, `not null`, sans défaut implicite dans le code** — **FAIT**. Colonne ajoutée sans `default` au niveau table ; chaque RPC qui écrit une ligne calcule explicitement la valeur. Prouvé négativement par `tests/architecture/orders-price-origin-no-implicit-legacy.test.ts` (mutation M11).
7. **`tenant_orders.has_unverified_prices` : miroir maintenu par les mêmes RPC** — **FAIT**, sur `api_create_storefront_order`, `api_create_tenant_order` (round 2, toujours `true` — BLOQUANT B1), la branche storefront ET la branche atelier (round 2, BLOQUANT B3) de la modification de brouillon.
8. **`draft → validated` refuse en 409 `orders.unverified_prices` sans acquittement explicite, nommé et journalisé** — **FAIT**. Cas SQL 8 (refus) et 9 (acquittement, événement `tenant_order_status_events` nommant l'acteur). Le paramètre `p_acknowledge_unverified_prices` est un booléen distinct, jamais une case cochée par défaut (`default false`). **Round 2** : le refus s'applique à toute transition qui quitte `draft` (sauf `cancelled`), pas seulement vers `validated` — DURCISSEMENT D2, cas SQL 18.
9. **La vérification se refait à la transition, un `If-Match` ne fermerait pas le trou** — **FAIT**. `transition_tenant_order_status` recalcule les lignes `catalog` et bloque les lignes `client_unverified` non acquittées, sur toute transition qui quitte `draft` (round 2, DURCISSEMENT D2). Cas SQL 11 (le prix catalogue bouge entre la création et la validation) et 18 (transition personnalisée hors `validated`). **Round 2** : l'`If-Match` du `PUT /orders/{orderId}/draft`, quand il est présent, est désormais vérifié via les utilitaires PARTAGÉS du socle (`readIfMatch`/`assertPrecondition`, DURCISSEMENT D3), pas une réimplémentation locale.
10. **Commandes existantes non retouchées, lignes anciennes en `legacy`, jamais bloquantes** — **FAIT**. Backfill `update ... set price_origin = 'legacy' where price_origin is null` ; cas SQL 10 (transition d'une commande `legacy` sans acquittement, passe). **Round 2 (D4)** : preuve statique étendue à tout le corpus de migrations (157 fichiers), pas un seul fichier en dur.
11. **`tenant_order_items` immuable hors `draft`** — **FAIT**. Trigger `tenant_order_items_immutable_after_draft`, `before insert or update or delete` (round 2 : étendu à `insert`, DURCISSEMENT D1 volet 1 — round 1 ne couvrait que `update or delete`). Cas SQL 6 (update direct sur une commande `validated` → lève), 7 (même update sur `draft`, par la RPC → passe, non-régression) et 17 volet 1 (round 2, insert direct dans une commande `shipped` → lève). **Round 2, DURCISSEMENT D1 volet 2** : `tenant_orders.status` est lui-même protégé par un trigger dédié (`tenant_orders_status_change_guard`) contre toute écriture directe hors de `transition_tenant_order_status` — cas SQL 17 volet 2. **Défaut réel trouvé et corrigé en cours de route (round 1)** : voir section « Défaut trouvé en testant ».
12. **Montants en `Money` (chaîne décimale), `unitPriceHt` → `expectedUnitPriceHt` côté commande, les deux côtés dans le même commit** — **FAIT**. `src/modules/orders/api/contracts.ts` + `docs/architecture/api/openapi.yaml`, mêmes commits.
13. **`openapi/magrit-core.v1.yaml` non modifié** — **RESPECTÉ**. Je n'y ai touché à aucune ligne. `pnpm gen:api:check` reste vert.
14. **Zéro appel Clariprint sur la création, la modification et la validation** — **FAIT**, prouvé par `tests/architecture/orders-price-revaluation-zero-clariprint.test.ts` (grep source + espion `fetch` dynamique).

## Ce que je n'ai PAS fait, et pourquoi (hors périmètre déclaré)

- **Q17-b** (produit configuré adossé à un devis serveur) : non commencée, dépend de BCP-1b/la campagne.
- **Q17-c** (pastille « Prix non vérifié » à l'écran) : non commencée. J'ai néanmoins exposé `priceOrigin` (par ligne) et `hasUnverifiedPrices` (par commande) sur `GET /orders/{orderId}/draft`, comme l'exige le point 12 (h) (« Q17-c ... remontent par listPortalOrders et getDraft, donc par la façade »), pour que Q17-c n'ait rien à re-migrer.
- **`priceResolver.ts`, `PortalCart.tsx`, `ShopProductCard.tsx`, le normaliseur, la passerelle Clariprint** : non touchés, conformément à l'interdiction explicite.
- **`api_create_tenant_order`** (chemin `magrit_user` de `POST /orders`) : **CORRIGÉ en round 2 (B1)**. Round 1 disait « inchangé, remonté à l'architecte » — c'était faux : ne pas la recréer la CASSAIT (crash 500 sur le premier appel, colonne `price_origin` NOT NULL sans défaut). Le minimum a été corrigé (`price_origin = 'client_unverified'` explicite, `has_unverified_prices = true`) ; le FOND — cette fonction n'a toujours aucun contrôle de catalogue ni de prix — reste porté à l'architecte, non tranché par moi.
- **`listPortalOrders`/`OrderSummary`** (grille de l'atelier, utilisée par `OrderHistoryTable.tsx`) : n'expose **toujours pas** `hasUnverifiedPrices` — non redemandé par la qa-review round 1, laissé en l'état, voir section « Écart remonté ».

## Écart remonté (je ne l'ai pas tranché en silence)

- **`listPortalOrders`/`OrderSummary.hasUnverifiedPrices`** — le point 12 (h) dit que Q17-c lira `has_unverified_prices` « par `listPortalOrders` et `getDraft` », mais le tableau du point 9 (i) ne donne à Q17-c comme fichiers que `OrderHistoryTable.tsx`, le détail de commande, `testIds.ts` — aucun moyen d'ajouter un champ de DTO depuis ces seuls fichiers. J'ai exposé le champ sur `getDraft` (dans mon périmètre déclaré) mais **pas** sur `listPortalOrders`, faute de fichier de contrat listé pour Q17-c. Signalé pour arbitrage : soit Q17-a l'ajoute aussi (petite extension, additive), soit Q17-c porte elle-même ce petit ajout à `contracts.ts`/`orders-repository.ts` au moment de sa propre implémentation. **Non rouvert par la qa-review round 1** : reste un écart ouvert, pas un défaut corrigé.

**Écart round 1 CLOS par la qa-review** : `api_create_tenant_order` — round 1 remontait ce point à l'architecte pour arbitrage. La qa-review l'a requalifié en BLOQUANT B1 (régression, pas une question d'arbitrage) et l'a fait corriger dans ce round. Le fond (aucune vérification de catalogue/prix sur ce chemin) reste, lui, porté à l'architecte — la qa l'a confirmé explicitement : « le fond ... est porté à l'architecte par moi, ne le traite pas de ta propre initiative ».

## Défaut trouvé en testant (pas en relisant)

En exécutant les cas SQL réellement contre la base locale (Docker + Supabase disponibles dans cet environnement), j'ai trouvé et corrigé **deux défauts réels** avant de les livrer :

1. **Colonnes ambiguës** — `private.resolve_storefront_catalog_price` sélectionnait `price_ht, config` sans qualifier la table : ces noms sont AUSSI ceux des colonnes de sortie de la fonction (`returns table (price_ht, reference_config, in_scope)`), donc des variables PL/pgSQL implicites. Postgres levait `column reference "price_ht" is ambiguous` dès le premier appel. Corrigé en qualifiant chaque colonne par sa table.
2. **Trigger d'immuabilité qui renvoyait `old` sur la branche autorisée** — sur `before update`, `return old` réécrit la ligne **inchangée** au lieu de laisser passer la modification demandée : le cas 7 (non-régression, modification d'un brouillon) « passait » sans erreur, mais silencieusement, **le prix n'était pas réellement modifié**. Trouvé uniquement parce que j'ai ajouté une assertion post-condition (relire la valeur après l'appel) plutôt que de me contenter d'« aucune exception levée ». Corrigé : `return new` sur la branche `draft`/`UPDATE`, `return old` réservé à `DELETE` et à la cascade de suppression de la commande parente. C'est exactement le défaut « la règle juste mais branchée au mauvais endroit » que la consigne m'invitait à chercher.

**Round 2 — un troisième défaut trouvé en écrivant mon propre cas de test (pas signalé par la qa)** : le laissez-passer transactionnel `app.q17a_allow_status_transition` (durcissement D1) est posé via `set_config(..., true)`, qui le porte pour toute la DURÉE DE LA TRANSACTION, pas pour la seule instruction suivante. Mon premier jet du cas SQL 6/7 (qui pose ce laissez-passer une fois, en fixture, avant de tester le cas 6) faisait **passer à tort** le cas 17 (volet 2, régression de statut) exécuté plus loin dans le MÊME fichier — puisque le fichier entier tourne dans une seule transaction `begin; ... rollback;`, le laissez-passer restait ouvert. Corrigé en refermant le laissez-passer immédiatement après chaque usage (dans le code ET dans le test), avec un commentaire explicite sur pourquoi ce refermement est nécessaire.

## Fichiers créés

- `supabase/migrations/20260919000100_gescom_q17a_storefront_order_price_revaluation.sql` — migration additive (voir détail ci-dessous). **Amendée en round 2** : `api_create_tenant_order` (B1), `resolved_unit_price_ht` sur `classify_storefront_order_line` et ses trois appelants (B2), `api_update_tenant_order_draft` (B3), trigger étendu à `INSERT` + `tenant_orders_status_change_guard` (D1), condition de re-vérification (D2).
- `tests/sql/storefront-order-price-revaluation.sql` — **renommé en round 2** depuis `tests/sql/gescom-q17a-storefront-order-price-revaluation.sql` (nom exact prescrit par le point 12 (j)). 18 scénarios au total : les 11 du point 12 (j), 2 inventés en round 1 (tolérance, timing de trigger), 5 ajoutés en round 2 pour B1/B2/B3/D1 (deux volets)/D2.
- `tests/architecture/orders-price-revaluation-zero-clariprint.test.ts` — preuve statique + dynamique du zéro appel Clariprint (inchangé en round 2).
- `tests/architecture/orders-price-origin-no-implicit-legacy.test.ts` — preuve statique qu'aucun chemin de code n'écrit `legacy` (mutation M11). **Réécrit en round 2** (D4) : balaie tout `supabase/migrations/*.sql` (165 fichiers) avec une liste d'exceptions nommée, au lieu d'un seul fichier en dur.

## Fichiers modifiés

- `src/modules/orders/api/contracts.ts` — `priceOriginSchema`, `expectedUnitPriceHt` (Money) sur `createOrderItemSchema`/`updateDraftOrderItemSchema`, `Money` sur les totaux de lecture (`createOrderResultSchema.totalHt`, `draftOrderSchema.totalHt`/`hasUnverifiedPrices`, `draftOrderItemSchema.unitPriceHt`/`lineTotalHt`/`priceOrigin`, `updateDraftOrderResultSchema.totalHt`), `acknowledgeUnverifiedPrices` sur `transitionOrderCommandSchema`, `TransitionOrderCommand` passé en `z.input` (précédent : `CreateShopCommand`). **Round 2 (D5)** : `nonNegativeMoneySchema` (précédent `nonNegativeRateSchema`) remplace `moneySchema` sur tous ces champs — un montant de commande boutique n'est jamais négatif.
- `src/modules/orders/application/orders-repository.ts` — `OrderCommandRejectionCode` étendu (`product_not_in_shop`, `price_changed`, `unverified_prices`), `PriceMismatchDetail`, `OrderCommandRejectedError` porte `priceMismatches`.
- `src/adapters/supabase/orders-repository.ts` — mapping `expectedUnitPriceHt`/Money aux deux frontières, `toMoneyString`, `isPriceOrigin`, `parsePriceMismatches`, priorité des préfixes distinctifs (`price_changed:`, `product_not_in_shop:`, `unverified_prices:`) AVANT les `.includes()` génériques (pour ne pas être trompé par un `product_label` choisi par l'acheteur), transmission de `p_acknowledge_unverified_prices`. **Round 2 (D6, signalé)** : commentaire ajouté sur `toMoneyString` documentant le flottant non corrigé.
- `src/server/api/orders-routes.ts` — nouveaux codes → statuts (422/409), `errors[]` sur `price_changed`, `ETag` sur `GET /orders/{orderId}/draft`, `If-Match` honoré (jamais exigé) sur `PUT /orders/{orderId}/draft` (point 12 (e), dérogation R5 déjà déclarée par le cadrage). **Recâblé en round 2 (D3)** : `readIfMatch`/`assertPrecondition`/`computeEntityTag` du socle E10 (`_shared/application/concurrency.ts`) remplacent ma réimplémentation manuelle round 1 ; `toApiHttpError` convertit le `ProblemError` du socle vers `ApiHttpError` (façade historique).
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

**10 sur 11 échouent avant migration, 1 (le cas 7) était déjà vert** — exactement la répartition annoncée par le cadrage. Les 11 passent après migration.

### Cas ajoutés au-delà du point 12 (j)

| # | Scénario | Origine | Verdict avant correction du round concerné | Verdict après |
|---|---|---|---|---|
| 12 | Écart de 0,50 € (aucune tolérance) | Round 1, mutation M2 | (case neuve, pas de « avant » applicable) | **PASSE** |
| 13 | Timing du trigger d'immuabilité = BEFORE | Round 1, mutation M8 | (assertion structurelle, pas de « avant » applicable) | **PASSE** |
| 14 | `api_create_tenant_order` (chemin `magrit_user`) écrit `price_origin` | Round 2, BLOQUANT B1 | **ÉCHOUE** — `null value in column "price_origin" ... violates not-null constraint` | **PASSE** |
| 15 | Prix sous le centime (11,995 €) × 100 000, création ET modification | Round 2, BLOQUANT B2 | **ÉCHOUE** — `line_total_ht = 1199500.00` (attendu 1200000.00) | **PASSE** |
| 16 | Session boutique déléguée, `PUT` sans cookie, branche atelier | Round 2, BLOQUANT B3 | **ÉCHOUE** — prix falsifié à 0,01 € accepté | **PASSE** |
| 17 | `INSERT` direct dans une commande `shipped` (volet 1) + régression de statut `shipped → draft` hors RPC (volet 2) | Round 2, DURCISSEMENT D1 | **ÉCHOUE** (les deux volets, sur le code non durci) | **PASSE** |
| 18 | Transition personnalisée `draft → in_production` (hors `validated`/`cancelled`) | Round 2, DURCISSEMENT D2 | **ÉCHOUE** — ligne `client_unverified` validée sans acquittement | **PASSE** |

## Les 11 mutations du point 12 (j) — rejouées, verdict et assertion nommée

**Round 2 — corrigé** : round 1 affirmait que M7, M8 (volet minuterie), M10 et M11 n'avaient « pas été rejouées par manque de temps ». La qa-review les a rejouées elle-même et confirmé qu'elles tombent toutes : la preuve existait dans le code (les assertions structurelles/statiques listées ci-dessous), elle n'avait simplement pas été exécutée par moi. Ce round confirme, sous le code CORRIGÉ (round 2), que ces quatre assertions restent vertes (`pnpm exec vitest run` et `pnpm test:storefront:sql`, chiffres ci-dessous) — le mécanisme de chacune n'a pas changé depuis le round 1.

| # | Mutation | Rejouée réellement, sous quel code ? | Verdict | Assertion qui tue la mutation |
|---|---|---|---|---|
| M1 | Refus du (d) remplacé par une correction silencieuse | **Oui**, round 1 ET round 2 (re-rejouée contre le code round 2 après B2, pour vérifier la non-régression) | **TUÉE** | Cas SQL 1 |
| M2 | Tolérance élargie (`< 0.01` → `< 1`) | **Oui**, round 1 | **TUÉE** | Cas SQL 12 |
| M3 | Rangs 2 et 3 de la hiérarchie inversés | **Oui**, round 1 | **TUÉE** | Cas SQL 4 |
| M4 | `price_ht = 0` accepté comme prix ferme | **Oui**, round 1 | **TUÉE** | Cas SQL 4 (rang 4) |
| M5 | `catalog` posé par défaut au lieu de `client_unverified` | **Oui**, round 1 | **TUÉE** | Cas SQL 4 (rang 4) |
| M6 | Contrôle de périmètre boutique retiré | **Oui**, round 1 ET round 2 (re-rejouée contre le code round 2, non-régression) | **TUÉE** | Cas SQL 3 |
| M7 | Recalcul déplacé de la RPC vers un service TypeScript | Prouvé par construction : le run « avant migration » (round 1) EST cet état, 10/11 cas SQL échouent alors, et le cas SQL n'exécute aucune ligne de TypeScript | **TUÉE** | Absence totale de vérification en SQL sur le code pré-Q17-a |
| M8 | Trigger d'immuabilité `after` au lieu de `before`, ou étendu à `draft` | **Oui, round 2** — le volet minuterie rejoué en mutant réellement le trigger (`before update or delete` sans `insert`, et le trigger `after`) | **TUÉE** | Cas SQL 13 (assertion structurelle `action_timing = 'BEFORE'`) ; volet « étendu à `draft` » couvert par le cas 7 (non-régression) |
| M9 | Acquittement absent laissé passer | **Oui**, round 1 | **TUÉE** | Cas SQL 8 |
| M10 | `z.number()` réaccepté à côté de `z.string()` | Test statique TypeScript (Zod refuse structurellement un nombre JSON), vérifié vert à chaque exécution de la suite, rounds 1 et 2 | **TUÉE** | `tests/server/api/orders-routes.test.ts` — « refuse un prix de ligne envoyé en nombre JSON » |
| M11 | `legacy` écrit par un chemin de code | Test statique, **réécrit en round 2 (D4)** pour balayer tout le corpus de migrations, vérifié vert | **TUÉE** | `tests/architecture/orders-price-origin-no-implicit-legacy.test.ts` (165 fichiers balayés) |

## Tests exécutés — chiffres réels (commandes rejouées, pas recopiées)

**Round 2.** Correction de l'arithmétique du round 1 (qui affirmait à tort 4+5+5=14) : l'écart round 1 était de **5+5+5=15** tests ajoutés (5 dans `orders-routes.test.ts`, 5 dans `orders-price-revaluation-zero-clariprint.test.ts`, 5 dans `orders-price-origin-no-implicit-legacy.test.ts`), soit 3173 + 15 = 3188 — exactement le chiffre rapporté, l'erreur portait sur le détail du calcul, pas sur le total.

- `pnpm typecheck` → **0 erreur**.
- `pnpm exec vitest run` (suite complète) → **3348 tests passés, 88 skippés** (335 fichiers : 323 passés, 12 skippés). Écart avec le round 1 (3188) : **+160**, TOUT dans `tests/architecture/orders-price-origin-no-implicit-legacy.test.ts` (durcissement D4 : 5 tests round 1 → 165 tests round 2, soit 157 fichiers de migration balayés un par un + 1 garde-fou de comptage + 1 vérification des exceptions nommées + 6 tests par fonction Q17-a nommée). `orders-routes.test.ts` reste à 11 tests (les nouveaux cas If-Match `*`/malformé sont des assertions ajoutées DANS le test ETag existant, pas de nouveaux `it()`).
- `pnpm test:architecture` → **458 tests passés** (48 fichiers). Écart avec le round 1 (298) : **+160**, même origine (D4).
- `pnpm test:contract` → **434 tests passés** (23 fichiers).
- `pnpm gen:api:check` → **aligné**, aucune dérive (je n'ai pas touché `openapi/magrit-core.v1.yaml`).
- `pnpm test:storefront:sql` → **53 fichiers SQL rejoués, 0 `ERROR`, code de sortie 0** (Docker + Supabase locaux disponibles dans cet environnement — contrairement à l'hypothèse « Docker absent » d'une session précédente, ce qui m'a permis de vérifier réellement l'avant/après migration plutôt que de le déduire).
- `supabase migration up --local --include-all` → appliquée proprement depuis zéro (`pnpm run db:local:reset`, qui rejoue TOUTES les migrations dans l'ordre).

Nombres de référence donnés dans la consigne initiale (avant round 1) : typecheck 0 erreur (identique), 3173 tests passés/88 skippés, 288 tests d'architecture. **Correction round 2** : le round 1 affirmait à tort « 4+5+5=14 » pour l'écart round 1 (3173 → 3188) — l'arithmétique correcte est **5+5+5=15** (5 tests ajoutés dans `orders-routes.test.ts`, 5 dans `orders-price-revaluation-zero-clariprint.test.ts`, 5 dans `orders-price-origin-no-implicit-legacy.test.ts` round 1), et 3173+15=3188 est bien le total round 1 correctement rapporté — seul le détail du calcul était faux, pas le résultat final. Round 2 ajoute encore +160 (durcissement D4, voir ci-dessus), pour un total de 3348. Les écarts s'expliquent entièrement par les tests ajoutés, aucun test existant n'a changé de statut à travers les deux rounds.

## Ce que ce lot ne fait PAS (rappel du cadrage, point 12 (k))

- Aucun calcul de prix nouveau : le serveur choisit entre des prix déjà écrits par un humain dans l'atelier.
- Ne solde pas §8.6 p7 (le prix d'une ligne de projet repris du navigateur, côté atelier) — attend `PricingEngine` (E10.21).
- Aucun appel Clariprint, à aucun moment du cycle de vie couvert.
- `openapi/magrit-core.v1.yaml` non modifié.
- Ne corrige pas `canAddAsIs` sur les lignes configurées (Q17-b).

## Porte avant déploiement (rappel, non vérifiable ici)

Le mode d'accès des boutiques actives (`shops.access_mode`) doit être vérifié en production avant l'élargissement du pilote ERAM — lecture de production hors de portée de cet agent, à faire par Arnaud ou l'architecte (même geste que la porte du point 3.7 (f)).
