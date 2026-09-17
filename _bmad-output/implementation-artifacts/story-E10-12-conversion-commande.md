---
id: E10.12
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.3, E10.9, E10.10a, E10.10b-2]
blocks: [E10.13, E10.16]
---
# E10.12 — « Bouton Valider » : le devis devient une commande

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.12 — Bouton Valider : transformation d'un devis en commande côté back-office Magrit](https://app.notion.com/p/3cad0131973c81adbf27e20225e3f6ce) · extrait le 17/09/2026 · page modifiée le 08/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 13 |

### Description fonctionnelle (Notion)

**En tant que** commercial, **je veux** transformer un devis en commande par un bouton « Valider » explicite, **afin d'**éviter les changements d'état accidentels d'un menu déroulant.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : Xavier Péchoultres recommande un bouton de validation explicite et vert plutôt qu'un changement de statut par liste déroulante, pour l'ergonomie et pour éviter les modifications après validation. Arnaud Mazon acte le bouton qui transforme le devis en commande et l'alimente dans le tableau de bord des commandes. Corollaire : une commande entrée dans le système — boutique ou devis converti — est réputée validée, il n'y a pas de seconde validation.

##### Critères d'acceptation

1. Un bouton « Valider et passer en commande » est présent dans l'en-tête du devis, en style primaire, actif uniquement au statut « Brouillon » ou « Envoyé ».
2. Le clic ouvre une confirmation récapitulant le client, le nombre de lignes et le total.
3. Après confirmation : création d'une commande reprenant client, lignes, prix et remises figés ; le devis passe au statut « Converti » et devient non modifiable.
4. Un numéro de commande unique et séquentiel par tenant est attribué (format `CMD-AAAA-NNNNN`).
5. La commande créée est réputée validée : aucune étape de validation supplémentaire n'est requise ; elle entre directement dans le circuit des étapes de production (E10.13).
6. La commande conserve la référence `quote_id` et le devis la référence `order_id`.
7. Un devis converti ne peut plus être validé une seconde fois ; le bouton disparaît et l'opération est refusée côté serveur.
8. Le statut « Refusé » reste accessible sur un devis non converti.

##### Tâches / Sous-tâches

- [ ] Migration SQL `orders` et `order_lines` (CA : 3, 4, 6)
    - [ ] `orders` : id, tenant_id, customer_id, quote_id, number, source ('quote'\|'shop'), current_step_id, created_at
    - [ ] `order_lines` : snapshot figé des lignes de devis (libellé, config, quantité, prix, remise)
- [ ] Fonction transactionnelle `convertQuoteToOrder(quoteId)` (CA : 3, 4, 5, 6, 7)
- [ ] Composant `src/components/quotes/ValidateQuoteDialog.tsx` (CA : 1, 2)
- [ ] Verrouillage en écriture du devis converti, côté UI et côté RLS (CA : 3, 7)
- [ ] Alimentation du tableau de bord des commandes (CA : 5)

##### Dev Notes

###### Contraintes techniques

- Les lignes de commande sont un **snapshot figé**, pas une jointure vers `quote_lines` : une règle de prix modifiée plus tard ne doit jamais changer rétroactivement une commande.
- `convertQuoteToOrder` doit être idempotente sur `quote_id` : un double clic ou un rejeu réseau ne doit pas produire deux commandes. Contrainte UNIQUE sur `orders.quote_id`.

###### data-testid

`quote-validate-btn`, `quote-validate-dialog`, `quote-validate-confirm-btn`, `quote-validate-cancel-btn`, `quote-status-badge` (+ `data-status`), `order-number-display`

###### Dépendances

- Bloquée par : E10.3, E10.8, E10.9
- Bloque : E10.13, E10.16
- Recoupe : E4.2 (transformation devis → commande côté mini-shop) — arbitrer la fusion des deux stories avant développement

##### Mise à jour — WM du 01/09/2026

**Arbitrage rendu : E4.2 et E10.12 ne fusionnent pas. Ce sont deux workflows distincts.**

- **E10.12 (cette story) — côté back-office Magrit.** Un utilisateur Magrit (commercial) transforme un devis qu'il a produit en commande, par le bouton de validation explicite. C'est **la story de référence du workflow commercial Magrit**.
- **E4.2 — côté boutique.** Un utilisateur « Pro » de la boutique valide le panier d'un utilisateur lambda pour qu'il devienne une commande. La notion d'utilisateur Pro appartient au storefront, pas à Magrit.
- Les deux workflows convergent sur **le même objet Commande**. La transformation d'un panier boutique en commande Magrit est un sujet à traiter séparément, avec au besoin un statut standard « en attente de validation client ». Xavier Péchoultres : « il faut travailler flux par flux, workflow par workflow ; la E10 concerne le workflow de gestion commerciale, il faut travailler là-dessus ».
- Le titre de cette story est précisé en conséquence, et E4.2 est reprécisée de son côté. **Le CA de dépendance « arbitrer la fusion avec E4.2 » est levé.**
- Le prix des lignes de commande provient de `PricingEngine` (**E10.21**), E10.8 étant gelée.

##### Contrat API

| Méthode | Route | Objet |
| --- | --- | --- |
| POST | `/api/v1/quotes/{quoteId}/convert` | Transforme le devis en commande ; `Idempotency-Key` **obligatoire** ; renvoie la commande créée |
| GET | `/api/v1/orders` | Liste des commandes ; `?status=`, `?step_id=`, `?customer_id=`, pagination par curseur |
| GET | `/api/v1/orders/{orderId}` | Détail |

Contrainte d'unicité sur `orders.quote_id` : un second appel de conversion renvoie **200 avec la commande existante**, pas une erreur ni un doublon. Événement émis : `quote.converted` (`{ quote_id, order_id, customer_id }`).

##### Tests

Parcours P13 — validation d'un devis, contrôle de la création de la commande, du gel du devis et de l'unicité du numéro. Cas limite : double clic sur le bouton, une seule commande attendue.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Claude Sonnet 4.5 (dev-story, implémentation) + Claude Opus 4 (qa-review round 2, validation)

###### Debug Log References

(aucune fournie par dev-story)

###### Completion Notes

**Round 1 (qa-review, Changes Requested)** :

- **B1 (grave, bloquant)** : fonction transactionnelle utilisait un patron CTE (`WITH previous AS ... SELECT ... FROM ... FOR UPDATE, transitioned AS (UPDATE RETURNING) SELECT ...`) qui lisait un instantané périmé au lieu de verrouiller. Reproduction en vraie concurrence (deux sessions psql) : le client acceptait le devis PENDANT que l'atelier le convertissait → `source_quote_status` enregistrait `'sent'` alors que `'accepted'` était entré en base entre-temps. Donnée immuable une fois écrite (preuve juridique, aucune correction possible après création).
- **B2 (bloquant)** : code d'erreur 409 renvoyait `current_state.status` périmé (lu avant l'UPDATE au lieu d'après son échec).

**Correctif livré (dev-story)** :

- **B1 fermé** : retour au patron d'E10.10a (`SELECT ... FOR UPDATE` dès le départ, verrou tenu jusqu'à fin de transaction). Nouveau test SQL avec dblink pour vraie concurrence (rejoué aussi sur ancien patron CTE pour confirmer qu'il le détecte). Résultat : 5 conversions simultanées du même devis → 1 seule commande, 4 rejets propres, aucun deadlock, aucun numéro brûlé.
- **B2 fermé** : relecture de l'état du devis dans la branche d'échec (`quote.not_found`/`quote.conversion_forbidden_status`), pas avant l'UPDATE.

**Round 2 (qa-review, Approved)** :

- **B1 re-vérification** : révision advers détient deux sessions psql propres (pg_stat_activity observe le verrou, wait_event = transactionid), rejoue le contrôle négatif (ancien patron toujours détecté), teste vraiment 5 conversions concurrentes : 1 commande, 4 rejets nets, aucune anomalie.
- **B2 re-vérification** : sonde sur réponse HTTP réelle (handler), vérification que la relecture se fait bien à partir de l'état post-échec.
- **Réserves non bloquantes** tracées (R1-R8) : idempotence régénérée côté client (préexistant à E10.3), filtre de statut ignoré silencieusement, schéma d'événement non validé en exécution, branche hors convention (héritée de b-1/b-2/b-3), incohérence traduction erreur inter-adaptateurs, vocabulaire `CDE-AAAA-NNNNN`/`validated` non tranchés Arnaud (en attente confirmation avant mise en service), contrat assoupli potentiellement, privil. TRUNCATE sur table d'audit (pré-existant).

**Critères d'acceptation tenus** (contrat §8.14) :

- (1) OpenAPI fait foi, non modifié par ce lot.
- (2) Conversion depuis `sent` ET `accepted`.
- (3) Aucune garde de capability (tout tenant member valide).
- (4) Prix copiés, jamais recalculés.
- (5-12) Ressource POST, événement unique, idempotence, immuabilité base, codes d'erreur, numérotation, audit d'entête.
- (13-14) Conséquences sur PortalQuotes/decideStorefrontQuote — aucune régression, déjà cohérent sans modif.
- (15-16) CustomerDetail, aucun appel Supabase direct du navigateur.

**Gates finales** :

- `pnpm typecheck` : 0 erreur
- `pnpm gen:api:check` : inchangé (contrat déjà publié)
- `pnpm test:architecture` : 144/144
- `pnpm test:contract` : 252/252 (+10 nouveaux, commercial-orders.contract.test.ts)
- `npx vitest run` : 1685 passés, 3 pre-existants non liés, 36 skip
- `tests/sql/gescom-e10-12-quote-conversion.sql` : 11 scénarios (docker local, atomic/isolation/RLS/immuabilité/GUC), tous réussis en rollback

**Commit local** : `423f52e` (non poussé, en attente merge)

###### File List

**Migrations et tests SQL**

- `supabase/migrations/20260908010000_gescom_e10_12_quote_conversion.sql`
- `tests/sql/gescom-e10-12-quote-conversion.sql`
- `scripts/test-storefront-sql.sh`

**Module commercial-orders (nouveau)**

- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/commercial-orders/api/client.ts`
- `src/modules/commercial-orders/application/commercial-orders-repository.ts`
- `src/modules/commercial-orders/application/commercial-orders-service.ts`
- `src/modules/commercial-orders/index.ts`
- `src/adapters/supabase/commercial-orders-repository.ts`
- `src/server/api/commercial-orders-routes.ts`

**Câblage**

- `src/server/api/gescom-routes.ts`
- `supabase/functions/magrit-api/index.ts`

**Module commercial-quotes (modifications)**

- `src/modules/commercial-quotes/api/contracts.ts`
- `src/adapters/supabase/commercial-quotes-repository.ts`
- `src/modules/commercial-quotes/ui/workspace/QuoteEditorPage.tsx`

**UI transverse**

- `src/shared/presentation/testIds.ts`

**Tests**

- `tests/contract/commercial-orders.contract.test.ts`
- `tests/contract/_fakes/commercial-orders-repository.fake.ts`
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts`

**Artefact**

- `_bmad-output/implementation-artifacts/story-E10-12-conversion-commande.md`

##### QA Results

###### Verdict : ACCEPTÉ (Round 2 — Approved)

**Bloquants fermés** :

- **B1** : CTE pattern périmé → FOR UPDATE (verrou de ligne, lecture garantie post-commit). Testé concurrence réelle (dblink) : 5 conversions simultanées → 1 commande, 4 rejets nets.
- **B2** : `current_state.status` périmé sur 409 → relecture après échec.

**Réserves non bloquantes** (8, tracées, aucune action requise pour clôture) :

- **R1** : Idempotence côté client (uuid régénéré à chaque appel) — préexistant E10.3, même patron E10.10a.
- **R2** : Filtre `status` invalide ignoré silencieusement (400 attendu) — identique behavior existing `commercial-quotes-routes.ts`.
- **R3** : Schéma charge utile événement déclaré non validé à l'exécution.
- **R4** : Branche non conforme convention (hors «une story = une branche») — héritée b-1/b-2/b-3.
- **R5** : Incohérence traduction erreur Supabase vs HTTP adapter (chemin injoignable en pratique).
- **R6** : Vocabulaire `CDE-AAAA-NNNNN` + statut initial `validated` gravés en base — **confirmation Arnaud nécessaire avant mise en service** (non bloquant pour tech review, bloquant avant déploiement production).
- **R7** : Contrat promet `current_state` toujours présent, code peut l'omettre si relecture échoue — assouplissement contrat potentiel.
- **R8** : Privilège TRUNCATE sur table audit (anon/authenticated) — pré-existant Supabase, sans rapport.

**Dettes tracées** (hors périmètre accepté) :

- **(d)** Aucune annulation de commande — à traiter E10.13+ (confirmation Arnaud si besoin d'UI « êtes-vous sûr ? » avancée).
- **(e)** Vocabulaire R6 (voir ci-dessus).
- **(f)** Confrontation CA Notion vs contrat par scribe/humain (en cours).
- **M2** Publication `quote.converted` best-effort hors transaction (dette socle E10.0, inchangée).

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-178](https://app.notion.com/3cad0131973c8132a731d392e5da61fe) | GC — Valider un devis et le transformer en commande | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.12, E10.16 |
| [TF-179](https://app.notion.com/3cad0131973c818e8516e8053baedac8) | GC — Limite : double validation d'un devis, une seule commande créée | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.12 |
| [TF-184](https://app.notion.com/3cad0131973c81dd9925ec7a18081c38) | GC — Fiche commande complète et prix non modifiables | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.16, E10.12, E10.14 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
