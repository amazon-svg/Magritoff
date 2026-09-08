---
id: E10.12
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.3, E10.9, E10.10a, E10.10b-2]
blocks: [E10.13, E10.16]
---
# E10.12 — « Bouton Valider » : le devis devient une commande

Contrat écrit par l'architecte avant le démarrage (`docs/api/CONVENTIONS.md`
§8.14), avec deux arbitrages d'Arnaud tranchés le 2026-09-08 avant que
`dev-story` ne commence : (a) la conversion part de `sent` **et** `accepted`,
(b) elle n'est gardée par **aucune** capability — tout membre du tenant
valide. Les deux sont acquis pour la durée de v1.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260908010000` | (1) `commercial_quotes.converted_at` (colonne d'entête, même motif que `sent_at`/`decided_at`). (2) `commercial_quote_header_audit` gagne l'action `converted` (mêmes contraintes de forme que `resent`/`duplicated`/`status_forced`). (3) Deux tables **nouvelles** : `commercial_orders` (huit colonnes de totaux figés, `quote_id unique`, `source_quote_status`) et `commercial_order_lines` (copie figée du bloc `PricedLine` + geste commercial), plus `commercial_order_number_counters` (séquence propre `CDE-AAAA-NNNNN`, aucune policy RLS = déni total, comme son équivalent devis). (4) Deux triggers d'**immuabilité en base** : `commercial_order_lines` refuse tout UPDATE/DELETE hors cascade tenant ; `commercial_orders` refuse tout changement des colonnes figées (identité, filiation, totaux), `status`/`updated_at` restant mutables pour E10.13. (5) `private.commercial_order_totals_at_conversion()` — même arithmétique que `computeQuoteTotals()`/`private.commercial_quote_totals` (b-1), **sans** le filtre `show_discounts` (document atelier, pas une vue client). (6) `api_convert_commercial_quote(p_tenant_id, p_quote_id)` — transition atomique, numérotation, copie figée des lignes, audit d'entête, **une seule transaction**. |
| Transition atomique | **Correctif qa-review round 1 (B1)** : la livraison initiale utilisait un patron `WITH previous AS (SELECT ...), transitioned AS (UPDATE ... RETURNING) SELECT ...`, présenté à tort dans ce document comme "exactement le patron décrit par le contrat" et comme un progrès par rapport à E10.10a — c'était l'inverse. qa-review a prouvé en exécution réelle (deux sessions psql concurrentes) que la CTE `previous` lit le snapshot pris au **début** de l'instruction, tandis que l'`UPDATE` attend le verrou puis ré-évalue sur la version la **plus récente** (EvalPlanQual) : les deux CTE peuvent voir deux versions différentes de la ligne sous course réelle, laissant `source_quote_status` enregistrer une valeur périmée (ex. `sent` alors que le client venait d'accepter). Le lot revient donc au patron **d'E10.10a** (`api_send_commercial_quote`, migration 20260906160000, lignes 647-651) : `select status, customer_id into ... from commercial_quotes where id = ... and tenant_id = ... for update`, puis `update ... where status in ('sent','accepted') returning id`. `FOR UPDATE` pose un verrou de ligne tenu jusqu'à la fin de la transaction et rend toujours la dernière version **committée** — la fenêtre de staleness disparaît, l'atomicité repose sur le verrou tenu de bout en bout plutôt que sur un seul plan d'exécution. `source_quote_status` enregistré est donc **toujours** celui réellement en vigueur au moment de la transition, jamais une valeur lue quelques instants plus tôt. |
| Immuabilité (B7 appliqué) | Échappatoire `magrit.quote_transition`/`magrit.change_set_id` posée avant la transition, **remise à vide explicitement sur les deux branches d'échec** (`quote.not_found`, `quote.conversion_forbidden_status`) et sur le retour de succès — même correctif que B7 (E10.10a round 5). Vérifié par exécution réelle (scénario 10 du cas SQL). |
| Audit d'entête | `field`/`quote_snapshot` NULL (le devis est figé depuis `sent`, l'instantané pris à l'envoi fait déjà foi), `previous_value` = le statut source (`sent`/`accepted`), `new_value` = `converted`, `actor_id`/`actor_label` = le **membre** qui a validé (contrairement à `accepted`/`rejected`, cette action a toujours un auteur Magrit). |
| `POST /quotes/{quoteId}/conversions` | `convertQuote` — `authentication: 'user'` (bearerAuth seul, **aucune** `x-required-capabilities`, arbitrage (b)), `createsResource: true` (`Idempotency-Key` exigée, brancée nativement), **aucun** `If-Match` (décision #6 du contrat : un devis `sent`/`accepted` est déjà immuable). Rend `CommercialOrderDetail` (201) + `ETag`. |
| `GET /commercial-orders`, `GET /commercial-orders/{orderId}` | `listCommercialOrders`/`getCommercialOrder` — `bearerAuth` + `serviceKey`, `x-required-scopes: [orders:read]` (scope déjà publié par le socle E10.0, jamais consommé jusqu'ici). Filtres `customer_id`/`quote_id`/`status`, pagination par curseur. |
| Événement sortant | `quote.converted` (déjà publié en v1 depuis le socle, sans producteur jusqu'ici) — publié par `CommercialOrdersService.convert()` **après** la conversion, hors de la transaction SQL (même limite déjà acceptée pour `quote.created`/`quote.sent`/`quote.accepted`, dette M2). Payload `QuoteConversionPayload` : `quote_id`, `customer_id`, `number` (devis), `order_id`, `order_number`, `source_quote_status` — aucun montant. |
| Module `commercial-orders` (nouveau) | `api/contracts.ts` (schémas Zod miroir du contrat), `application/commercial-orders-repository.ts` (port + erreurs `CommercialOrderNotFoundError`/`QuoteConversionForbiddenStatusError`), `application/commercial-orders-service.ts` (dépend du **service** `CommercialQuotesService`, pas de son repository — même pattern de composition inter-modules que `CommercialQuotesService` déjà construit sur `ProjectsRepository`/`PriceRulesService`), `api/client.ts` (UI), `index.ts`. Aucun `manifest.ts`/`surface-contributions.ts`/`ui/` — pas d'écran dédié, comme `commercial-settings`. |
| Adaptateur Supabase | `src/adapters/supabase/commercial-orders-repository.ts` — `convertQuote()` délègue entièrement à `api_convert_commercial_quote` (RPC), mapping d'erreurs par message (`quote.conversion_forbidden_status`, `quote.not_found` en défense en profondeur). |
| Routes | `src/server/api/commercial-orders-routes.ts` — `convertQuote` compose **deux** services (`CommercialOrdersService` + `CommercialQuotesService`, même précédent que `createCustomerShopAccessRoutes`) : le devis est lu **avant** la conversion pour produire 404 avant toute écriture et fournir `current_state` sans seconde lecture sur 409. Enregistré dans `gescom-routes.ts`. |
| Câblage edge function | `supabase/functions/magrit-api/index.ts` — `CommercialOrdersService` instancié sur `client` (jamais `storefrontClient`), dépend de `commercialQuotesService` déjà construit. |
| Module `commercial-quotes` (atelier) | `Quote`/`QuoteDetail` gagnent `converted_at` (contrat), `QuoteAuditAction` gagne `converted`. Adaptateur Supabase et faux de test mis à jour ; le faux gagne `applyConversionForTest()` (transition atomique en mémoire, consommée par `InMemoryCommercialOrdersRepository`, **jamais réimplémentée deux fois**) et `seedDraftQuoteForTest()` (fixture). |
| UI | `QuoteEditorPage.tsx` — bouton « Valider (créer la commande) » visible pour un devis `sent` **ou** `accepted` (`canConvert`, affichage seul — le serveur tranche). Boîte de confirmation (`quote-convert-dialog`) : avertissement explicite quand la source est `sent` (« le client ne s'est pas encore prononcé… ») — **courtoisie d'interface, pas une garde** (contrat §8.14 #5ter, point ii). Bannière de succès avec le numéro de commande. Aucun contrôle métier côté navigateur : `CommercialOrdersApiClient.convertQuote()` appelle `POST /quotes/{id}/conversions` avec `Idempotency-Key` générée localement, sans `If-Match`. |

## Ce qui n'est PAS dans le périmètre

- **Aucun cycle de vie de commande** — `CommercialOrderStatus` porte une seule valeur (`validated`). Étapes de production, expédition, facturation : E10.13.
- **Aucune annulation** — voir dette (d) ci-dessous.
- **Aucun dépôt de fichier d'exécution** — E10.16.
- **Aucune modification d'une commande après conversion**, ni de ses prix — pas de `PATCH /commercial-orders/{id}`, garde posée EN BASE (triggers d'immuabilité), pas seulement en façade.
- **Aucun appel à `PricingEngine`** — la conversion recopie les prix déjà chiffrés par E10.9, jamais ne les recalcule (E10.8 gelée).
- **Aucune facture, aucun PDF de commande**.
- **Aucun écran de liste/détail de commande** — `GET /commercial-orders`/`GET /commercial-orders/{id}` sont exposés et testés, mais aucune page ne les consomme dans ce lot (hors périmètre demandé : seul le bouton « Valider » était à livrer).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **(d)** héritée, ouverte | Aucune annulation ni retour en arrière n'existe. Une conversion faite par erreur est définitive : le devis reste `converted` pour toujours, la commande existe pour toujours, son numéro est consommé. La seule issue aujourd'hui est une correction manuelle en base par un administrateur, qui laisse une entrée `status_forced` au journal du **devis** et **rien du tout** côté commande. | E10.13 (cycle de vie de la commande) est le candidat naturel pour introduire un statut d'annulation. Aucune confirmation UI (« êtes-vous sûr ? ») n'a été ajoutée côté navigateur au-delà de la boîte de dialogue déjà posée (courtoisie, pas une garde) — à arbitrer si jugé insuffisant avant mise en service. |
| **(e)** héritée, ouverte | Vocabulaire `CDE-AAAA-NNNNN` (préfixe) et statut initial `validated` : **implémentés tels quels par ce lot** (repris du contrat, lui-même repris du vocabulaire boutique existant `tenant_order_status`), mais leur validation métier par Arnaud reste **non confirmée** — ce sont des chaînes qui apparaîtront sur des documents clients (bons de commande, futures factures) et qu'on ne renomme plus après coup une fois émises. | Confirmation à obtenir avant la première mise en service réelle (pas avant la première ligne de code, la story n'était pas bloquée dessus par l'architecte). Si `CDE` ou `validated` change, c'est un changement cassant au sens §7 (`/api/v2`) une fois publié — mieux vaut trancher avant. |
| **(f)** sans objet pour `dev-story` | La relecture Notion de la page E10.12 (critères d'acceptation numérotés exacts) n'a pas pu être faite par l'agent `architecte`, qui n'a pas d'accès Notion (§0 du contrat). Ce lot a été implémenté **tel que cadré par le contrat**, lui-même construit à partir de deux extraits fournis par l'agent appelant et de l'état réel du dépôt. | Le `scribe` ou un humain avec accès Notion doit confronter ce cadrage aux CA numérotés de la page avant clôture définitive de la story sur Notion. |
| **M2** héritée, inchangée | Publication de `quote.converted` en **best-effort**, hors de la transaction SQL — comme tous les événements E10 précédents. | Dette de socle documentée depuis E10.0 (`docs/api/CONVENTIONS.md` §8.2), non reprise ici. |

## Vérifications

`pnpm typecheck` : 0 erreur. `pnpm gen:api:check` : aligné (types déjà régénérés par l'architecte avec le contrat, aucun symbole généré n'a bougé depuis). `pnpm test:architecture` : **144/144** (33 fichiers), inchangé — aucune frontière modulaire nouvelle cassée, le module `commercial-orders` respecte le même patron d'imports croisés en `application/` que `commercial-quotes` (deep-imports directs, pas de cycle). `pnpm test:contract` : **252/252** (13 fichiers, +1 nouveau `commercial-orders.contract.test.ts` avec 10 tests), en hausse de 10 par rapport à la baseline de 242 laissée par E10.10b-2/b-3. `npx vitest run` (suite complète) : **1685 passés**, 3 échecs **pré-existants et sans rapport** (`tests/storage/product_mockups_isolation.test.ts`, bucket Storage `product_mockups` absent en local — infrastructure de test antérieure à ce lot, jamais touchée par lui), 36 skip.

`tests/sql/gescom-e10-12-quote-conversion.sql` : **exécuté réellement** (Docker local disponible, migration appliquée via `pnpm db:local:push`). 10 scénarios, tous en `rollback`, 0 erreur : (1) conversion depuis `sent` — commande créée, numéro `CDE-2026-00001`, totaux figés corrects (deux lignes, 290.00 HT / 58.00 TVA / 348.00 TTC), lignes copiées dans l'ordre, devis → `converted` + `converted_at`, audit `converted` correct (`previous_value='sent'`, `actor_id` = le membre) ; (2) conversion depuis `accepted` — numéro **suivant** (`CDE-2026-00002`, séquence partagée), `source_quote_status='accepted'` ; (3) re-conversion du même devis déjà `converted` — refusée, aucune seconde commande (le `unique(quote_id)` n'a même pas eu à intervenir, la garde de statut a suffi) ; (4) devis `draft` — refusé ; (5) devis `rejected` — refusé ; (6) isolation inter-tenant en **écriture** — un membre du tenant B qui tente de convertir un devis du tenant A reçoit `quote.not_found`, jamais une fuite ; (7) immuabilité en base — UPDATE/DELETE direct sur une ligne de commande refusés, colonne figée d'entête refusée, DELETE direct d'une commande refusé, `status`/`updated_at` restent mutables comme prévu ; (8) RLS — isolation inter-tenant en **lecture** (`commercial_orders_select`/`commercial_order_lines_select`) ; (9) `commercial_order_number_counters` — déni total même sous `authenticated` ; (10) GUC `magrit.quote_transition`/`magrit.change_set_id` vides après tous les appels, succès et échecs compris.

**Note d'environnement, honnête** : ce poste de développement portait un Supabase local **fraîchement démarré, zéro `auth.users`** — condition non documentée par les stories précédentes (qui supposaient un ou plusieurs utilisateurs déjà présents). Deux comptes de test ont été insérés directement en base (`dev-story-local@example.test`, `dev-story-local-2@example.test`, hors de toute transaction de test, donc persistants sur ce poste) pour permettre l'exécution des cas SQL. Une fois ces comptes présents, `tests/sql/gescom-e10-12-quote-conversion.sql` passe isolément ET après l'exécution de l'ensemble des cas SQL antérieurs (aucune pollution d'état, chaque fichier `rollback`). Le harnais complet (`pnpm test:storefront:sql`) reste bloqué, comme documenté par E10.10b-2/b-3, sur des cas **antérieurs et sans rapport** avec ce lot (`legacy-shop-only-write-freeze.sql` : rôle `owner` retiré par une migration ultérieure ; plusieurs fichiers E10.x plus anciens exigent un deuxième/troisième utilisateur Auth ou des données PIM (`product_library`) non présentes sur ce poste) — vérifié explicitement fichier par fichier, aucun ne référence `commercial_orders`/`commercial_order_lines`/`converted_at`.

## Critères d'acceptation (contrat §8.14, tenus un par un)

1. `openapi/magrit-core.v1.yaml` fait foi, écrit par l'architecte avant le début du lot — **fait**, aucune modification du contrat par `dev-story`.
2. Conversion depuis `sent` **et** `accepted` (arbitrage (a)) — **fait**, garde `status in ('sent','accepted')` en base, testé (SQL scénarios 1/2, contrat tests).
3. Aucune garde de capability (arbitrage (b)) — **fait**, `security: [bearerAuth]` seul sur `convertQuote`, aucune `x-required-capabilities`, testé (un `member` sans `can_manage_pricing` convertit avec succès dans le cas SQL).
4. Prix **copiés**, jamais recalculés (décision #4) — **fait**, `api_convert_commercial_quote` ne calcule aucun montant, il `SELECT`/`INSERT` tel quel depuis `commercial_quote_lines`. Aucun appel à `PricingEngine`.
5. Ressource d'acte (`POST /quotes/{id}/conversions`), pas un `PATCH` (décision #3) — **fait**, `createsResource: true`.
6. Un seul événement (`quote.converted`), pas de doublon `order.created` (décision #7) — **fait**, testé (assertion outbox unique).
7. Devis ↔ commande porté une seule fois (`commercial_orders.quote_id unique`), pas de `converted_order_id` sur le devis (décision #8) — **fait**, `converted_at` est une simple colonne sans référence à la commande ; `GET /commercial-orders?quote_id=` publié et testé.
8. Aucun `If-Match` sur `convertQuote` (décision #6) — **fait**, divergence assumée et documentée, testée implicitement (le client UI n'en transmet pas).
9. `Idempotency-Key` exigée (CA8 du socle) — **fait**, `createsResource: true`, testé (400 sans clé, rejeu = même commande).
10. Immuabilité en base d'une commande et de ses lignes, pas seulement en façade — **fait**, deux triggers `BEFORE UPDATE OR DELETE`, testés par exécution réelle (SQL scénario 7).
11. Code d'erreur unique `quote.conversion_forbidden_status` (409) pour les quatre statuts refusés — **fait**, `current_state.status` porte la nuance, testé sur `draft`/`rejected`/`converted`.
12. Numérotation `CDE-AAAA-NNNNN`, séquence propre, jamais calculée côté client — **fait**, `commercial_order_number_counters`, verrou de ligne `on conflict do update`, testé (deux conversions du même tenant → numéros consécutifs).
13. Journal d'entête du devis : action `converted`, `previous_value` = statut source, auteur = le membre — **fait**, contrainte SQL étendue, testé (contrat + SQL).
14. `PortalQuotes`/`decideStorefrontQuote` : conséquence de (a) déjà cohérente sans modification (§5ter) — **vérifié, rien à changer** : `PortalQuotes` rend déjà un libellé pour `converted` (« Transformé en commande », posé par b-1), `decideStorefrontQuote` refuse déjà `converted` (guard `status='sent'` posée par b-2). Aucune régression introduite.
15. `CustomerDetail.projects`/`.quotes`/`.orders` restent vides — **vérifié, rien à changer**, conforme au contrat révisé par l'architecte.
16. Aucun composant React n'appelle Supabase directement — **fait**, `QuoteEditorPage` passe par `CommercialOrdersApiClient` → `/api/v1/...`, vérifié par `tests/architecture`.

## Fichiers créés/modifiés

**Migration et tests SQL**
- `supabase/migrations/20260908010000_gescom_e10_12_quote_conversion.sql` (nouveau)
- `tests/sql/gescom-e10-12-quote-conversion.sql` (nouveau)
- `scripts/test-storefront-sql.sh` (ajout du nouveau cas)

**Module `commercial-orders` (nouveau)**
- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/commercial-orders/api/client.ts`
- `src/modules/commercial-orders/application/commercial-orders-repository.ts`
- `src/modules/commercial-orders/application/commercial-orders-service.ts`
- `src/modules/commercial-orders/index.ts`
- `src/adapters/supabase/commercial-orders-repository.ts`
- `src/server/api/commercial-orders-routes.ts`

**Câblage**
- `src/server/api/gescom-routes.ts` (enregistrement des routes, service `commercialOrders`)
- `supabase/functions/magrit-api/index.ts` (instanciation `CommercialOrdersService`)

**Module `commercial-quotes` (atelier)**
- `src/modules/commercial-quotes/api/contracts.ts` (`converted_at`, `QuoteAuditAction += converted`)
- `src/adapters/supabase/commercial-quotes-repository.ts` (mapping `converted_at`)
- `src/modules/commercial-quotes/ui/workspace/QuoteEditorPage.tsx` (bouton « Valider », dialogue de confirmation, bannière de succès)

**UI transverse**
- `src/shared/presentation/testIds.ts` (`convertBtn`, `convertDialog`, `convertConfirmBtn`, `convertCancelBtn`, `convertSuccessBanner`)

**Tests**
- `tests/contract/commercial-orders.contract.test.ts` (nouveau, 10 tests)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts` (nouveau)
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts` (`converted_at`, `applyConversionForTest()`, `seedDraftQuoteForTest()`)

**Story document**
- `_bmad-output/implementation-artifacts/story-E10-12-conversion-commande.md` (ce fichier)

Aucun fichier `openapi/magrit-core.v1.yaml`/`docs/api/CONVENTIONS.md`/`src/platform/api/generated/magrit-core.v1.ts` n'a été touché par cette story — déjà écrits par l'architecte avant le démarrage de ce lot (gates rejoués sans écart, §7 du contrat).
