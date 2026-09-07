---
id: E10.10b-2
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.3, E10.5, E10.9, E10.10a, E10.10b-1]
blocks: [E10.10b-3, E10.10b-4]
---
# E10.10b-2 — Décision du client (accepter/refuser un devis)

Deuxième sous-chantier d'E10.10b (le devis dans la boutique du client),
scindé en quatre par l'architecte (§8.13 de `docs/api/CONVENTIONS.md`) : b-1
lecture (livrée), b-2 accepter/refuser (ce lot), b-3 notification email, b-4
PDF. Le contrat OpenAPI (`decideStorefrontQuote`, schémas
`StorefrontQuoteDecision`/`StorefrontQuoteDecisionCommand`/
`QuoteDecisionPayload`, codes `quote.decision_forbidden_delegated`/
`quote.decision_forbidden_status`/`quote.decision_expired`, événements
`quote.accepted`/`quote.rejected`) était déjà écrit par l'architecte
(§8.13quinquies) au moment de démarrer ce lot. Recommandation de l'architecte
suivie : b-1 et b-2 développées d'affilée, remontées ensemble, sur la même
branche, pas encore mergées vers `main`.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260907000000` | (1) Deux colonnes d'entête sur `commercial_quotes` : `decided_at`, `decided_by_account_id` (FK `shop_customer_accounts`, `on delete set null`). (2) `commercial_quote_header_audit` gagne les actions `accepted`/`rejected` (mêmes contraintes de forme que `resent`/`duplicated`/`status_forced`). (3) **Dette v3 tranchée** : `api_list_storefront_quotes`/`api_get_storefront_quote` **remplacées** (`create or replace function`, jamais une édition de la migration `20260906170000` déjà passée) avec jointure explicite `shops.tenant_id = customers.tenant_id`, en défense en profondeur du trigger `enforce_shop_customer_contact_tenant_match()` (E10.5). (4) `api_decide_storefront_quote` — transition atomique `sent → accepted/rejected`, `security definer`, `grant execute to anon`, ré-vérifie elle-même toute la chaîne d'autorisation. |
| Ordre des refus (contrat, décision #3) | 404 `quote.not_found` (invisible, zéro ligne rendue par la fonction SQL, jamais une exception) → 403 `quote.decision_forbidden_delegated` (session déléguée) → 409 `quote.decision_forbidden_status` (pas `sent`) → 409 `quote.decision_expired` (`valid_until` dépassée, horloge serveur) → 428/400/409 (précondition `If-Match`, **en dernier**, inverse de `sendQuote`). Implémenté à deux niveaux : la **route** (`storefront-quotes-routes.ts`) lit d'abord le devis via `getDetail()` et applique cet ordre pour produire le message correct au cas nominal ; la **fonction SQL** réapplique l'intégralité de la chaîne (y compris la transition atomique) en défense en profondeur, puisqu'elle est `grant execute to anon` et donc joignable hors façade. |
| Transition atomique | `update commercial_quotes set status = p_decision, decided_at = now(), decided_by_account_id = ... where id = ... and status = 'sent' returning id` — garde de statut et écriture dans **la même instruction**, `found` testé juste après (alias `cq` obligatoire pour lever une ambiguïté Postgres réelle entre la colonne `commercial_quotes.id` et le paramètre de sortie `id` de `returns table`, trouvée par exécution). Si `not found` (race entre deux décisions concurrentes), la fonction lève le **même** `quote.decision_forbidden_status` que le refus ordinaire — la route ne le voit jamais au cas nominal (elle a déjà vérifié le statut juste avant), c'est un filet pour l'appel RPC direct ou la vraie concurrence. |
| Immuabilité (B7 appliqué à cette fonction) | Échappatoire `magrit.quote_transition`/`magrit.change_set_id` (`commercial_quotes_require_draft_before_write`, migration `20260906160000`) posée puis **remise à vide explicitement avant chaque retour**, y compris le retour d'échec de la transition atomique — même correctif que B7 (E10.10a round 5) : `set_config(..., true)` est porté par la transaction englobante, pas par la fonction. Vérifié par exécution réelle (scénario 8 du cas SQL). |
| Audit d'entête | `field`/`quote_snapshot` NULL (l'instantané pris à l'envoi fait déjà foi, un devis `sent` étant immuable), `previous_value = 'sent'`, `new_value` = la décision, `actor_id` **NULL** (ce n'est pas un utilisateur Magrit), `actor_label` = libellé figé du compte boutique (`full_name`, à défaut `email`). |
| `POST /storefront-quotes/{quoteId}/decisions` | `decideStorefrontQuote` — `authentication: 'shop_customer'`, `createsResource: true`, `Idempotency-Key` **et** `If-Match` exigés, rend `StorefrontQuoteDetail` (201) + `ETag`, jamais `QuoteDetail`. Session déléguée (`sessionKind: 'delegated'`) refusée avant même d'atteindre le repository. |
| Événement sortant | `quote.accepted`/`quote.rejected` **écrits** dans `outbox_events` par `StorefrontQuotesService.decide()` après une décision réussie (`QuoteDecisionPayload` : `quote_id`, `customer_id`, `number` — **jamais** l'identité du compte boutique). `customer_id` ne fait partie d'**aucune** représentation servie au client (liste blanche `StorefrontQuote*`) : la fonction SQL le rend en plus de l'`id` (`returns table (id, customer_id)`, pas un simple `uuid`) pour que le service puisse publier sans seconde lecture ; la route, elle, ne transmet jamais ce champ. Aucun relais (b-3, hors périmètre). |
| Correctif de socle — idempotence par **compte**, pas par espace seul | Trouvé en ouvrant l'écriture à un acteur non-membre (contrat §8.13quinquies, "trois points que dev-story ne doit pas découvrir en route", point 1) : `api_idempotency_keys` étant unique sur `(tenant_id, idempotency_key)`, deux acheteurs distincts du même imprimeur choisissant par hasard la même valeur de clé sur deux devis différents auraient vu le second refusé en 409 `api.idempotency_key_reused` — un client bloquant un autre. Corrigé dans `gescom-middleware.ts` (`createGescomApiHandler`) : pour un `ShopCustomerPrincipal`, la clé **stockée** dérive du compte (`deriveShopCustomerIdempotencyStorageKey`, `sca.<accountId>.<sha256(clé) hex>`, 105 caractères, `idempotency.ts`) ; la clé **présentée** par l'appelant (celle qui apparaît dans `detail` d'un 409) reste inchangée ; aucun autre mode d'authentification n'est affecté. |
| UI | `PortalQuotes` (onglet « Mes devis ») gagne deux boutons Accepter/Refuser, visibles uniquement pour un devis `status === 'sent' && !expired` (affichage seul, aucune garde métier côté navigateur). `StorefrontQuoteDecisionConfirmDialog` (nouveau composant, même patron que `CancelOrderConfirmDialog` — `AlertDialog` shadcn/Radix, focus trap, erreur affichée sans fermer le modal pour permettre un retry sur 409). `If-Match` repris de la **dernière lecture réelle** du devis (`useStorefrontQuotesList` porte désormais l'`ETag` à côté du détail), jamais reconstruit côté client. |
| Module `commercial-quotes` (atelier) | `Quote`/`QuoteDetail` gagnent `decided_at`/`decided_by_account_id` (contrat), `QuoteAuditAction` gagne `accepted`/`rejected`. Adaptateur Supabase et faux de test mis à jour. |

## Ce qui n'est PAS dans le périmètre

- **Aucun relais d'événement** (E10.10b-3) — `quote.accepted`/`quote.rejected` sont écrits dans `outbox_events`, n'atteignent aucun consommateur.
- **Aucun renvoi d'un devis décidé** — `sendQuote` continue de refuser `accepted`/`rejected` en 409 (comportement inchangé, motif documenté dans le contrat déjà révisé par l'architecte).
- **Aucun motif de refus collecté** — point ouvert du contrat (§8.13quinquies), forme choisie pour être additive (`StorefrontQuoteDecisionCommand` objet, `QuoteDecisionPayload` nommé) sans être tranchée ici.
- **Aucune levée de la garde "session déléguée ne décide pas"** — réserve du contrat signalée mais non traitée (nécessite un arbitrage d'Arnaud et une opération d'atelier distincte si confirmé).
- **PDF téléchargeable** (E10.10b-4) — hors périmètre.

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **v1** (héritée, inchangée) | `pnpm test:storefront:sql` (harnais complet) échoue toujours sur `tests/sql/legacy-shop-only-write-freeze.sql` et plusieurs autres cas **antérieurs** à E10.10b (dérive d'environnement local documentée depuis b-1, sans rapport avec ce lot). Vérifié à nouveau explicitement dans cette story : **tous** les cas non affectés par cette dette passent isolément, y compris `gescom-e10-10a-quote-send-duplicate.sql` et `gescom-e10-10b-1-storefront-quotes.sql` (non cassés par le renforcement `tenant_id`), et le nouveau `gescom-e10-10b-2-storefront-quote-decision.sql`. | `pnpm db:local:reset` complet, investigation dédiée (hors périmètre d'une story fonctionnelle). |
| **v3** (héritée d'E10.10b-1, **close par ce lot**) | ~~`api_list_storefront_quotes`/`api_get_storefront_quote` ne filtraient que sur `customer_id`, sans jointure explicite au tenant.~~ | Clos — voir migration `20260907000000`, section 3. |
| **v4** (nouvelle, mineure) | La course entre la lecture business (`getDetail()` côté route) et l'écriture atomique (fonction SQL) n'est pas exercée par un test de **concurrence réelle** (deux transactions en parallèle) — seule la garde structurelle (`update ... where status = 'sent'`) le protège, vérifiée par relecture et par le fait que `sendQuote`/E10.10a n'a jamais eu ce test non plus (même famille de garde, même absence de test de concurrence réelle documentée dans ce dépôt). | Aucun changement demandé : cohérent avec le reste du dépôt sur ce point précis ; à lever collectivement si une story future introduit un harnais de concurrence réelle (deux connexions psql simultanées). |

## Vérifications

`pnpm typecheck` : 0 erreur. `pnpm gen:api:check` : aligné (types déjà régénérés par l'architecte avec le contrat). `pnpm test:contract` : **242/242** passés (12 fichiers), dont +19 nouveaux tests `storefront-quotes.contract.test.ts` (décision : succès×2 avec assertion outbox, replay idempotent, 404×3 causes, 403 délégué, 403 acteur utilisateur, 409 statut, 409 expiré, 428, 400 `*`, 409 conflit, 422 décision invalide, 400 clé manquante, 401, réserve idempotence inter-comptes) et +2 nouveaux tests `gescom-middleware.contract.test.ts` (fixture `shop_customer`+`createsResource` dédiée : deux comptes distincts même clé → les deux réussissent ; même compte même clé → rejeu, pas une seconde écriture) — **et les 16 échecs prédits par le contrat** (`commercial-quotes.contract.test.ts`, `decided_at`/`decided_by_account_id` manquants sur `QuoteDetail`) sont **résolus** par l'implémentation (schémas, adaptateur, faux de test), passage de 207 à 242 tests verts. `pnpm test:architecture` : 144/144 (33 fichiers), inchangé. `npx vitest run` : 1638 passés, 3 échecs pré-existants sans rapport (`tests/storage/product_mockups_isolation.test.ts`, bucket Storage absent en local — identique à la baseline avant ce lot), 36 skip.

`tests/sql/gescom-e10-10b-2-storefront-quote-decision.sql` : **exécuté réellement** (Docker local disponible, migration appliquée via `psql` direct — `supabase db push` a échoué sur ce poste avec une erreur d'authentification Management API sans rapport avec la migration elle-même, contournée en appliquant le fichier directement contre le conteneur `supabase_db_magritoff-v5`). 9 scénarios : accepter (statut, `decided_at`/`decided_by_account_id`, audit), refuser (symétrique), session déléguée refusée sans écriture, devis déjà décidé refusé sans écriture, devis périmé refusé sans écriture, isolation inter-client/inter-tenant (zéro ligne), jeton invalide (zéro ligne), B7 (GUC vidés après retour), décision hors énumération (zéro ligne, défense en profondeur) — tous **ROLLBACK**, 0 erreur. `tests/sql/gescom-e10-10b-1-storefront-quotes.sql` et `tests/sql/gescom-e10-10a-quote-send-duplicate.sql` rejoués après le renforcement `tenant_id` (dette v3) : **inchangés, toujours verts** — le renforcement n'a rien cassé.

## Critères d'acceptation (contrat §8.13quinquies, tenus un par un)

1. `POST /storefront-quotes/{quoteId}/decisions`, ressource d'acte plutôt qu'un `PATCH` — **fait**, `Idempotency-Key` branchée nativement (`createsResource: true`).
2. Une seule opération pour les deux sens (`decision` au corps) — **fait**, `StorefrontQuoteDecisionCommand` objet.
3. Ordre des refus normatif (404→403→409→409→428/400/409, précondition en dernier) — **fait**, implémenté dans la route ET réappliqué dans la fonction SQL ; testé par `it.each`/tests dédiés sur chaque code.
4. Un seul code pour "le devis n'est plus sent" (`quote.decision_forbidden_status`) — **fait**, jamais de code par état rencontré.
5. Le 201 rend `StorefrontQuoteDetail`, jamais `QuoteDetail` — **fait**, `dataSchema: storefrontQuoteDetailSchema`, testé.
6. Charge utile commune, deux noms d'événement, `customer_id` dans l'événement mais jamais dans la représentation client — **fait**, testé (assertions outbox + schéma `.strict()` de `StorefrontQuoteDetail`).
7. `decided_by_account_id`/`actor_label`/`actor_id: null` — **fait**, testé (SQL scénario 1).
8. `decided_at` en colonne, publiée sur `Quote`/`QuoteDetail` (atelier) — **fait**, schémas + adaptateur mis à jour, 16 tests de contrat corrigés.
9. Garde de péremption : même expression exacte que `StorefrontQuote.expired`, vérifiée en base dans la transaction d'écriture — **fait**, testé (SQL scénario 5, contrat 409 `quote.decision_expired`).
10. Session déléguée refusée (`quote.decision_forbidden_delegated`), lecture inchangée — **fait**, testé (SQL scénario 3, contrat 403).
11. Audit d'entête : deux actions, forme correcte (`field`/`quote_snapshot` NULL) — **fait**, contrainte SQL étendue + testé.
12. Aucun second `quote_snapshot` sur `accepted`/`rejected` — **fait**, par construction (contrainte `commercial_quote_header_audit_shape`).
13. Dette v3 (renforcement `tenant_id`) tranchée par une migration **nouvelle**, jamais une édition de `20260906170000` — **fait**, vérifié par lecture et par ré-exécution de `gescom-e10-10b-1-storefront-quotes.sql`.
14. Correctif de socle — idempotence par compte pour `ShopCustomerPrincipal` — **fait**, testé à deux niveaux (fixture middleware générique + scénario réel `decideStorefrontQuote`).
15. Fermeture de l'échappatoire d'immuabilité (B7 appliqué à cette fonction) — **fait**, testé (SQL scénario 8).
16. Transition atomique (`update ... where status='sent'`, garde et écriture dans la même instruction) — **fait**, implémenté et documenté ; non exercé par un test de concurrence réelle (dette v4 ci-dessus).
17. UI : boutons Accepter/Refuser visibles seulement pour un devis `sent` non périmé, confirmation avant envoi, aucun contrôle métier côté navigateur — **fait**, `PortalQuotes`/`StorefrontQuoteDecisionConfirmDialog`.

## Fichiers créés/modifiés

**Migration et tests SQL**
- `supabase/migrations/20260907000000_gescom_e10_10b_2_storefront_quote_decision.sql` (nouveau)
- `tests/sql/gescom-e10-10b-2-storefront-quote-decision.sql` (nouveau)
- `scripts/test-storefront-sql.sh` (ajout du nouveau cas)

**Module `storefront-quotes`**
- `src/modules/storefront-quotes/api/contracts.ts` (schéma décision)
- `src/modules/storefront-quotes/api/client.ts` (`decide()`, `get()` rend désormais l'ETag)
- `src/modules/storefront-quotes/application/storefront-quotes-repository.ts` (interface `decide()`, erreurs de domaine, `StorefrontQuoteDecisionResult`)
- `src/modules/storefront-quotes/application/storefront-quotes-service.ts` (`decide()` + publication outbox, dépendances `{repository, outbox}`)
- `src/modules/storefront-quotes/index.ts` (exports)
- `src/modules/storefront-quotes/ui/PortalQuotes.tsx`, `src/modules/storefront-quotes/ui/StorefrontQuoteDecisionConfirmDialog.tsx` (nouveau), `src/modules/storefront-quotes/ui/hooks/useStorefrontQuotesList.ts`
- `src/adapters/supabase/storefront-quotes-repository.ts` (`decide()`, mapping d'erreurs)
- `src/server/api/storefront-quotes-routes.ts` (route `decideStorefrontQuote`)

**Socle transverse**
- `src/server/api/gescom-middleware.ts` (dérivation de clé d'idempotence par compte)
- `src/modules/_shared/application/idempotency.ts` (`deriveShopCustomerIdempotencyStorageKey`)
- `src/modules/_shared/application/index.ts`, `src/modules/_shared/application/outbox.ts` (versions d'événements), `src/modules/_shared/api/contracts.ts` (noms d'événements)

**Module `commercial-quotes` (atelier)**
- `src/modules/commercial-quotes/api/contracts.ts` (`decided_at`/`decided_by_account_id`, `QuoteAuditAction`)
- `src/adapters/supabase/commercial-quotes-repository.ts` (mapping)
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts` (faux mis à jour)

**Types générés / DB**
- `src/types/database.types.ts` (ajout manuel de `api_decide_storefront_quote`, même patron que b-1 — ce fichier est généré depuis le projet Supabase **partagé**, pas depuis le local, et n'a pas encore été régénéré pour ce lot)

**Tests**
- `tests/contract/storefront-quotes.contract.test.ts` (+19 tests, fixtures étendues)
- `tests/contract/gescom-middleware.contract.test.ts` (+2 tests, fixture dédiée)

**Story document**
- `_bmad-output/implementation-artifacts/story-E10-10b-2-decision-client.md` (ce fichier)

Aucun fichier `openapi/magrit-core.v1.yaml`/`docs/api/CONVENTIONS.md`/`src/platform/api/generated/magrit-core.v1.ts` n'a été touché par cette story — déjà écrits par l'architecte avant le démarrage de ce lot.
