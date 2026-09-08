---
id: E10.10b-3
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.0, E10.3, E10.5, E10.10a, E10.10b-1, E10.10b-2]
blocks: [E10.10b-4]
---
# E10.10b-3 — Notification (premier relais réel de l'outbox + courriel client)

Troisième sous-chantier d'E10.10b (le devis dans la boutique du client),
scindé en quatre par l'architecte (§8.13 de `docs/api/CONVENTIONS.md`) : b-1
lecture (livrée), b-2 accepter/refuser (livrée), b-3 notification email (ce
lot), b-4 PDF. Cadrage complet de l'architecte :
`docs/api/CONVENTIONS.md` §8.13sexies. Aucune modification du contrat
OpenAPI par ce lot (description seule, déjà écrite par l'architecte).

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260908000000` | (1) `create extension if not exists pg_cron`/`pg_net` (déjà installée en local, testée). Déclencheur `pg_cron` (`* * * * *`) appelant `net.http_post` vers `magrit-outbox-dispatcher`, URL et secret lus depuis `vault.decrypted_secrets` (`magrit_outbox_dispatch_url`/`magrit_outbox_dispatch_secret`) — **absents → avertissement, aucune planification, migration non bloquante** (testé les deux branches en local). (2) `outbox_events.next_attempt_at timestamptz not null default now()` — 4ème colonne mutable ; `grant update` étendu ; index partiel `outbox_events_pending_due_idx` ; `outbox_events_reject_mutation()` recréée (`create or replace`, comportement inchangé — la colonne était déjà implicitement mutable, non nommée dans la garde). (3) `api_claim_outbox_events(p_limit, p_max_attempts, p_max_age)` — `security definer`, `grant execute` au **seul** `service_role`, `for update skip locked`, incrémente `delivery_attempts`/repousse `next_attempt_at` **dans la même instruction** que la réclamation, rebut immédiat (`delivery_attempts = p_max_attempts`, `last_error` explicite) des événements trop vieux, **sans jamais poser `published_at`** (le rebut n'est pas une livraison). (4) Passif au rebut : `update ... set delivery_attempts = 5, last_error = '...' where published_at is null and delivery_attempts < 5` — geste **unique**, au déploiement. |
| Backoff | 1 / 5 / 25 / 125 minutes = `5^(delivery_attempts-1)`, plafonné au palier 4. **Vérifié par exécution réelle**, palier par palier (tolérance ±0.1 min), pas relu dans le texte de la fonction. |
| Réglages | `limit=25`, `max_attempts=5`, `max_age=24h` — valeurs confirmées par Arnaud (réserve e), en dur dans `DEFAULT_OUTBOX_DISPATCH_SETTINGS` (`outbox-dispatcher.ts`) et dans la composition (`outbox-dispatch-composition.ts`). |
| Socle (`src/modules/_shared/application/outbox-dispatcher.ts`) | `OutboxDispatcher.runOnce()` : réclame un lot, remet chaque événement au consommateur enregistré pour son `event_name` (registre `Partial<Record<EventNameDto, OutboxEventConsumer>>`), rend la main. **Aucun** import d'un module métier (frontière vérifiée par `tests/architecture/gescom-api-socle-boundaries.test.ts`, déjà verte). Un événement sans consommateur enregistré est marqué **livré**, jamais en échec. Un consommateur qui lève (au lieu de rendre `{delivered:false,reason}`) est traité comme un échec — défense en profondeur. |
| Adaptateur file (`src/adapters/supabase/outbox-dispatch-repository.ts`) | `SupabaseOutboxDispatchRepository` — `claim()` délègue à `api_claim_outbox_events` (RPC), `markDelivered()`/`markFailed()` sont de simples `UPDATE` colonne (grants déjà posés par la migration). Client `service_role` requis (documenté en tête de fichier). |
| Consommateur métier (`src/modules/commercial-quotes/application/quote-sent-notification-consumer.ts`) | `QuoteSentNotificationConsumer` — résout `valid_until` **à la remise** (jamais déduit du payload), résout les destinataires **à la remise** (`shop_customer_accounts` `active`/`invited`, `suspended`/`delegated_only` exclus). Zéro destinataire ou devis introuvable dans ce tenant → `delivered:true` (cas nominal, pas un échec). Échec partiel sur plusieurs destinataires → événement entier en échec (unité de livraison, doublon assumé au rejeu). `buildAccountQuotesLink()` — littéral serveur `/shop/{slug}/account/quotes`, **testé** contre `portalRuntimePaths` (voir plus bas). `formatFrenchDate()` — parsing manuel des composants `YYYY-MM-DD` (pas de `Date`/`Intl`, aucun risque de décalage de jour). |
| Adaptateur email (`src/adapters/resend/quote-sent-email-sender.ts`) | `ResendQuoteSentEmailSender` — **strictement** le patron de `ResendStorefrontActivationEmailSender` (`apiKey: string \| null` injecté, `fetch` injectable, jamais de `throw`, `{sent, reason?}`). Textes **exacts** validés par Arnaud (premier envoi / renvoi), testés caractère près (sujet, corps HTML/texte, `validUntilLabel` omis proprement si `null`). |
| Résolution des destinataires (`SupabaseQuoteNotificationGateway`, ajoutée à `src/adapters/supabase/commercial-quotes-repository.ts`) | Port dédié (`QuoteNotificationGateway`), pas une extension de `CommercialQuotesRepository`. Jointure **explicite** `shops.tenant_id = <tenant de l'événement>` **en plus de** la chaîne `customer_id → customer_contacts → shop_customer_accounts` (`.eq('customer_contacts.customer_id', ...).eq('shops.tenant_id', ...)`, syntaxe PostgREST **vérifiée en local par requête HTTP réelle** contre l'API REST du Supabase local — confirmé qu'un mismatch de tenant rend un tableau vide, pas une fuite). |
| Composition (`src/server/api/outbox-dispatch-composition.ts`) | `createOutboxDispatchApplication()` — même contre-mesure que `createMagritApiApplication()` pour la dette M1 : câblage des adaptateurs dans un fichier **typecheckée et testable**, pas dans l'Edge Function. Un seul consommateur enregistré aujourd'hui : `quote.sent`. |
| Edge Function (`supabase/functions/magrit-outbox-dispatcher/index.ts`) | Ne contient QUE l'instanciation des adaptateurs + le contrôle du secret (`X-Magrit-Outbox-Secret`, comparé en temps constant via `timingSafeEqual` **réexporté** depuis `outbox.ts`, pas réimplémenté). Absent/faux → 401 sans corps, sans distinguer la cause. `verify_jwt = false` posé dans `supabase/config.toml` (pg_net ne présente aucun JWT). |
| Contrat OpenAPI | **Non touché** — déjà à jour (description seule, écrite par l'architecte avant ce lot, §8.13sexies point 2). `pnpm gen:api:check` reste vert. |

## Le lien — piège explicité par l'architecte, et sa fermeture

`portalRuntimePaths.accountQuotes` (registre **navigateur**) n'est **pas**
réutilisé côté serveur. `buildAccountQuotesLink()` est un littéral unique
(`/shop/${slug}/account/quotes`), et
`tests/modules/commercial-quotes/quote-sent-notification-consumer.test.ts`
assère son égalité avec
`` `/${portalRuntimePaths.shopRoot.replace(':slug', slug)}/${portalRuntimePaths.accountQuotes}` ``
(résolu : `/shop/atelier-test/account/quotes`) — si quelqu'un renomme la
route du portail sans mettre à jour ce littéral, ce test tombe.

## Ce qui n'est PAS dans le périmètre

- **Aucune notification à l'atelier** sur `quote.accepted`/`quote.rejected` (réserve d, hors périmètre confirmé).
- **Aucune UI** — pas de bouton « relancer la notification » côté atelier, aucune UI côté portail.
- **Aucun endpoint `/api/v1`**, aucune `Idempotency-Key`, aucun `If-Match`, aucun test de contrat nouveau — la non-duplication est portée par la réclamation atomique SQL (`for update skip locked`).
- **Aucune surface de supervision de la file au rebut** — dette explicitement tracée par l'architecte (§8.13sexies point 5), pas comblée ici.
- **Aucune livraison HTTP vers un abonné tiers** — `buildDeliveryHeaders()`/le scope `events:subscribe` restent sans appelant.
- **`QuoteSentPayload` inchangé** — toujours `quote_id`/`customer_id`/`number`/`is_resend`.

## Dérogation R5 — pas de dérogation d'architecture, mais un correctif de test hors axe strict

`tests/sql/gescom-outbox-append-only.sql` (fichier que ce lot devait de
toute façon étendre pour la 4ème colonne mutable, §8.13sexies point 3)
échouait dès son setup, **avant même d'atteindre les scénarios de ce lot**,
sur `insert into tenant_members (..., role, ...) values (..., 'owner', ...)`
— `role='owner'` est **inécrivable** depuis la migration `20260814000200`
("un seul profil d'administration : admin", décision Arnaud du 2026-08-14),
antérieure à ce fichier de test. Corrigé en une ligne (`'owner'` → `'admin'`)
**dans ce seul fichier**, avec un commentaire expliquant pourquoi
(`current_user_tenant_ids()` n'exploite aucun filtre sur `role`, donc le
comportement RLS testé est inchangé). `tests/sql/legacy-shop-only-write-freeze.sql`
porte la **même** dérive et **n'a pas été touché** (hors périmètre de ce
lot) — signalé ci-dessous comme dette v1 confirmée, déjà documentée par b-2.
Chemin de mise en conformité : correction généralisée de `role='owner'` →
`'admin'` dans les cas SQL antérieurs au 2026-08-14, hors d'une story
fonctionnelle.

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **v1** (héritée, confirmée à nouveau) | `pnpm test:storefront:sql` (harnais complet) échoue toujours sur `tests/sql/legacy-shop-only-write-freeze.sql` (`role='owner'` inécrivable depuis le 2026-08-14) — **même dette que documentée par b-2**, indépendante de ce lot. Un `db:local:reset` complet a de plus révélé que plusieurs autres cas **antérieurs** au Sprint 5 (`storefront-credential-activation.sql`, `gescom-e10-5-shop-customer-link.sql`, `gescom-e10-3-commercial-quotes.sql`, `gescom-e10-6-price-rules.sql`, `gescom-devis-unification-pim-triggers.sql`, `gescom-e10-9-quote-line-discounts.sql`, `gescom-e10-10a-quote-send-duplicate.sql`) supposent un environnement local **déjà peuplé** par un usage manuel accumulé (shops avec `owner_user_id` réel, plusieurs comptes Auth non super-admin, `product_library` alimentée) — absent d'un reset propre, sans lien avec E10.10b-3. Vérifié explicitement : **tous** les cas non affectés (dont `gescom-outbox-append-only.sql` étendu et le nouveau `gescom-e10-10b-3-outbox-dispatcher.sql`) passent, isolément et interleavés dans une exécution large couvrant 20 fichiers de la suite. | Reconstitution d'un fixture réaliste (tenants/shops/comptes/`product_library`) hors d'une story fonctionnelle — déjà signalé par b-2, confirmé structurel. |
| **v2** (nouvelle, mineure) | La concurrence réelle de `api_claim_outbox_events` (`skip locked`, deux tours qui se chevauchent) n'est PAS exercée par deux transactions Postgres distinctes dans le cas SQL — `dblink` rendrait le test trivialement vide (les lignes insérées dans la transaction du test ne sont pas commises, donc invisibles d'une seconde connexion), incompatible avec la convention `begin...rollback` de ce dépôt. Remplacé par une vérification **en base** (`pg_get_functiondef`) que la fonction déployée porte bien `for update skip locked` — plus fort qu'une lecture du fichier de migration, mais pas une preuve d'exécution concurrente réelle. Même famille que la dette v4 de b-2 (garde structurelle non testée en concurrence réelle). | Harnais de concurrence réelle (deux connexions psql simultanées), à lever collectivement si une story future l'introduit — pas spécifique à ce lot. |
| **v3** (héritée, non ouverte ici) | Aucune surface de supervision de la file au rebut (§8.13sexies point 5) — un devis peut n'avoir jamais été notifié sans que l'atelier ni Arnaud ne l'apprennent. | `GET /outbox-events` réservé super-admin, ou alerte au premier rebut — non cadré, non tranché par l'architecte. |

## Vérifications

`pnpm typecheck` : 0 erreur. `pnpm gen:api:check` : aligné, inchangé (ce lot
ne modifie aucun schéma/chemin). `pnpm test:contract` : **242/242** passés
(12 fichiers), **inchangé** (ce lot n'ajoute aucun endpoint). `pnpm
test:architecture` : **144/144** (33 fichiers), inchangé — la frontière
"le socle ne dépend d'aucun module métier" couvre `outbox-dispatcher.ts`
sans modification. `npx vitest run` : **1673 passés** (+35 nouveaux tests de
ce lot), **3 échecs pré-existants sans rapport**
(`tests/storage/product_mockups_isolation.test.ts` — feature S4.1a distincte,
`.env.test` pointe vers le projet Supabase **partagé distant**
`ightkxebexuzfjdbpsdg`, pas le local ; confirmé indépendant de tout
`db:local:reset` par la présence de l'URL distante dans `.env.test`), 36
skip — même baseline que documentée par b-2.

**Nouveaux tests (35)** : `tests/modules/_shared/outbox-dispatcher.test.ts`
(7 — livraison sans consommateur, remise au bon consommateur, échec
explicite, consommateur qui lève, lot mixte, lot vide, réglages par défaut),
`tests/adapters/resend/quote-sent-email-sender.test.ts` (6 — repli explicite,
échec Resend, fetch injoignable, **textes exacts** premier envoi/renvoi,
omission propre de la date), `tests/modules/commercial-quotes/quote-sent-notification-consumer.test.ts`
(13 — dont la **parité du lien** avec `portalRuntimePaths`, zéro destinataire,
devis introuvable, base publique absente, payload invalide, deux comptes
distincts → deux courriels avec chacun son lien, échec partiel → événement
entier en échec), `tests/server/api/outbox-dispatch-composition.test.ts`
(4 — composition réelle avec faux client Supabase réaliste : livraison
`quote.sent`, événement sans consommateur, échec explicite base publique
absente, lot vide), `tests/adapters/supabase/outbox-dispatch-repository.test.ts`
(5 — mapping RPC, conversion secondes→intervalle, erreurs explicites).

`tests/sql/gescom-e10-10b-3-outbox-dispatcher.sql` : **exécuté réellement**
(Docker local, migration appliquée via `pnpm db:local:push` puis validée par
un `pnpm db:local:reset` complet rejouant les **107** migrations du dépôt
sans erreur). 7 scénarios, tous **ROLLBACK**, 0 erreur : (1) réclamation d'un
lot mixte frais/trop-vieux — rebut silencieux du vieux (`published_at`
JAMAIS posé), le frais rendu avec `delivery_attempts=1` ; (2) reclamation
immédiate → lot vide ; (3) progression EXACTE du backoff sur 4 paliers
forcés (1/5/25/125 min, tolérance ±0.1 min) ; (4) épuisement — plus jamais
réclamable une fois `delivery_attempts=max` ; (5) `for update skip locked`
vérifié sur la définition **déployée** (`pg_get_functiondef`), pas sur le
texte de la migration ; (6) privilèges — `anon`/`authenticated` refusés
(`insufficient_privilege`), `service_role` seul ; (7) append-only —
`next_attempt_at` mutable, le contenu métier (`payload`) reste refusé sur un
événement qui a transité par le drain.

`tests/sql/gescom-outbox-append-only.sql` : **étendu** (4ème colonne
mutable, scénario 3) et **rejoué réellement** après correction du
`role='owner'` non lié à ce lot (voir dérogation ci-dessus) — les 7
scénarios originaux (append-only, isolation RLS inter-tenant, privilèges
`authenticated`) restent verts, inchangés dans leur intention.

## Critères d'acceptation (cadrage §8.13sexies, tenus un par un)

1. Drain périodique déclenché de l'extérieur, pas de trigger/poll/process long-vivant — **fait**, `pg_cron`+`pg_net`, migration + Edge Function dédiée.
2. `pg_cron`/`pg_net` activés par migration versionnée, URL/secret via Vault, jamais en clair — **fait**, testé en local (branche "secrets présents" ET branche "secrets absents").
3. Aucun endpoit `/api/v1` nouveau, contrat en description seule — **fait**, `pnpm gen:api:check` inchangé.
4. `api_claim_outbox_events` : `security definer`, `service_role` seul, `for update skip locked`, incrémente/repousse dans la même instruction — **fait**, testé en base réelle (scénarios 1, 4-6 du cas SQL).
5. `next_attempt_at` 4ème colonne mutable, garde append-only étendue, grant étendu, index posé, cas SQL de base mis à jour — **fait**.
6. Passif mis au rebut au déploiement (`delivery_attempts=5`, `last_error` explicite) — **fait**, geste unique borné par un horodatage littéral figé (`created_at < '2026-09-08 00:00:00+00'`, corrigé en qa-review round 1 B1 : la version initiale n'avait aucune borne de date et rebutait à tort tout événement créé après un second passage de la migration, y compris postérieur au déploiement). Idempotent depuis la borne (rejouer ne touche plus les lignes déjà rebutées ni les événements créés après le déploiement), mais la planification du déclencheur pg_cron ne repasse plus par un rejeu de cette migration : bloc SQL autonome dédié en pied de fichier.
7. Isolation — jointure explicite `shops.tenant_id` en plus de la chaîne `customer_id→customer_contacts→shop_customer_accounts` — **fait**, vérifiée en base réelle (contre-preuve qa-review : ligne cross-tenant insérée délibérément, absente du résultat avec le filtre, présente sans) ET couverte par un test qui observe les couples `(colonne, valeur)` réellement passés à `.eq()`/`.in()` sur la chaîne de résolution (corrigé en qa-review round 1 B2 : aucun test ne descendait jusqu'à la requête avant ce correctif — les faux clients existants ignoraient les filtres).
8. Zéro destinataire n'est pas un échec ; `quote.created`/`accepted`/`rejected` livrés sans consommateur — **fait**, testé (socle + consommateur).
9. Textes des deux emails codés tels quels (pas reformulés) — **fait**, testés caractère près.
10. `valid_until` lu à la remise, jamais déduit du payload, formaté en français lisible — **fait**, testé (dates + cas `null`).
11. Comptes `invited` notifiés comme `active`, `suspended`/`delegated_only` exclus — **fait**, implémenté dans la requête (`in('status', ['active','invited'])`).
12. Lien serveur littéral, testé contre `portalRuntimePaths` — **fait**.
13. Échec Resend/secret absent → pas de `throw`, `last_error` écrit, reprise au tour suivant — **fait**, testé (socle + consommateur + adaptateur Resend).
14. Tentatives épuisées ou événement trop vieux → rebut, pas de nouvel état/table — **fait**, testé en base.
15. Échec partiel sur plusieurs destinataires → événement entier en échec — **fait**, testé.
16. Aucune notification atelier sur la décision du client, aucune UI — **fait** (non fait, hors périmètre confirmé).

## Fichiers créés/modifiés

**Migration et tests SQL**
- `supabase/migrations/20260908000000_gescom_e10_10b_3_outbox_dispatcher.sql` (nouveau)
- `tests/sql/gescom-e10-10b-3-outbox-dispatcher.sql` (nouveau)
- `tests/sql/gescom-outbox-append-only.sql` (étendu — 4ème colonne mutable + correctif `role` hors axe, voir dérogation)
- `scripts/test-storefront-sql.sh` (ajout du nouveau cas)

**Socle transverse**
- `src/modules/_shared/application/outbox-dispatcher.ts` (nouveau — `OutboxDispatcher`, ports, registre de consommateurs)
- `src/modules/_shared/application/outbox.ts` (`timingSafeEqual` exportée, réutilisée par l'Edge Function)
- `src/modules/_shared/application/index.ts` (exports)

**Adaptateurs**
- `src/adapters/supabase/outbox-dispatch-repository.ts` (nouveau — `SupabaseOutboxDispatchRepository`)
- `src/adapters/resend/quote-sent-email-sender.ts` (nouveau — `ResendQuoteSentEmailSender`)
- `src/adapters/supabase/commercial-quotes-repository.ts` (ajout — `SupabaseQuoteNotificationGateway`)

**Module `commercial-quotes`**
- `src/modules/commercial-quotes/application/quote-sent-notification-consumer.ts` (nouveau — consommateur, ports `QuoteNotificationGateway`/`QuoteSentEmailSender`, `buildAccountQuotesLink()`, `formatFrenchDate()`)
- `src/modules/commercial-quotes/index.ts` (exports)

**Composition et Edge Function**
- `src/server/api/outbox-dispatch-composition.ts` (nouveau — `createOutboxDispatchApplication()`)
- `src/server/api/index.ts` (export)
- `supabase/functions/magrit-outbox-dispatcher/index.ts` (nouveau — composition uniquement)
- `supabase/config.toml` (`[functions.magrit-outbox-dispatcher]`, `verify_jwt = false`)

**Tests**
- `tests/modules/_shared/outbox-dispatcher.test.ts` (nouveau, 7 tests)
- `tests/adapters/resend/quote-sent-email-sender.test.ts` (nouveau, 6 tests)
- `tests/modules/commercial-quotes/quote-sent-notification-consumer.test.ts` (nouveau, 13 tests)
- `tests/server/api/outbox-dispatch-composition.test.ts` (nouveau, 4 tests)
- `tests/adapters/supabase/outbox-dispatch-repository.test.ts` (nouveau, 5 tests)

**Story document**
- `_bmad-output/implementation-artifacts/story-E10-10b-3-notification.md` (ce fichier)

Aucun fichier `openapi/magrit-core.v1.yaml`/`docs/api/CONVENTIONS.md`/
`src/platform/api/generated/magrit-core.v1.ts` n'a été touché par cette
story — déjà à jour avant le démarrage de ce lot (description seule).

## Non déployé sur le projet Supabase partagé

Conformément à la consigne, **rien n'a été poussé** sur le projet Supabase
partagé `ightkxebexuzfjdbpsdg` (B4+B5). La migration a été testée
**localement uniquement** (`pnpm db:local:push` puis `pnpm db:local:reset`
complet, 107 migrations, 0 erreur). Avant tout déploiement réel :
1. Un PAT Supabase à régénérer (à demander à Arnaud, rappel `CLAUDE.md`).
2. Poser les deux secrets Vault sur le projet partagé (`magrit_outbox_dispatch_url`, `magrit_outbox_dispatch_secret`) — le déclencheur `pg_cron` ne se planifie QUE si les deux existent (testé, pas de risque de planification prématurée).
3. Poser `MAGRIT_OUTBOX_DISPATCH_SECRET`, `RESEND_API_KEY`, `MAGRIT_FROM_EMAIL=Magrit <devis@magritapp.com>`, `MAGRIT_PUBLIC_APP_URL=https://magritapp.com` en secrets Edge Function.
4. Déployer `supabase/functions/magrit-outbox-dispatcher/`.
