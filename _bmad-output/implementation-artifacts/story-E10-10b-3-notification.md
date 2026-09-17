---
id: E10.10b-3
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.0, E10.3, E10.5, E10.10a, E10.10b-1, E10.10b-2]
blocks: [E10.10b-4]
---
# E10.10b-3 — Notification (premier relais réel de l'outbox + courriel client)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.10b-3 — Notification (relais outbox + courriel client sur quote.sent)](https://app.notion.com/p/3d5d0131973c8173940ee64016487698) · extrait le 17/09/2026 · page modifiée le 08/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | L | Terminé | Claude code | Pro+ | WM 01/09/2026 | — |

### Description fonctionnelle (Notion)

**En tant que** client boutique, **je veux** être averti par email quand un devis m'est adressé, **afin de** ne pas manquer une opportunité commerciale et de pouvoir réagir rapidement en acceptant ou refusant.

##### Statut

Terminé — qa-review round 1 (**Changes requested**, 2 bloquants B1/B2), qa-review round 2 **Approuvé, 0 bloquant**.

##### Contexte produit

Troisième sous-chantier d'E10.10b (§8.13sexies de `docs/api/CONVENTIONS.md`), à la suite d'**E10.10b-1** (lecture, Terminé) et **E10.10b-2** (décision client, Terminé). Premier **consommateur réel** de la file `outbox_events` créée par E10.10a : chaque événement `quote.sent` déclenche un drain périodique qui notifie le client par email Resend.

Chaîne : atelier envoie un devis → événement `quote.sent` inscrit dans `outbox_events` → `pg_cron` appelle l'Edge Function `magrit-outbox-dispatcher` → `api_claim_outbox_events` réclame un lot → `OutboxDispatcher` remet chaque événement au consommateur `QuoteSentNotificationConsumer` → email à tous les comptes `active`/`invited` du client → statut marqué livré/échoué/rebuté.

Cadré par l'architecte le 07/09/2026 (§8.13sexies), implémenté et validé le 08/09/2026 sur la même branche que b-1/b-2 (`feat/gescom-e10-4-entite-client`, non mergée).

##### Critères d'acceptation (contrat §8.13sexies, tenus un par un)

1. Drain périodique déclenché de l'extérieur (pas de trigger sur insert, pas de poll opportuniste, pas de process long-vivant) — **fait**, `pg_cron`+`pg_net`, migration + Edge Function dédiée.
2. `pg_cron`/`pg_net` activés par migration versionnée, URL/secret du déclencheur lus depuis Supabase Vault, jamais en clair — **fait**, testé en local (branches secrets présents/absents).
3. Aucun endpoint `/api/v1` nouveau, contrat en description seule — **fait**, `pnpm gen:api:check` inchangé.
4. `api_claim_outbox_events` : `security definer`, grantée au seul `service_role`, `for update skip locked`, incrémente `delivery_attempts` et repousse `next_attempt_at` dans la même instruction que la réclamation — **fait**, vérifié en base réelle et en concurrence réelle (deux transactions simultanées, intersection des lignes réclamées vide).
5. `next_attempt_at` (4ème colonne mutable) : garde d'immuabilité étendue, grant étendu, index partiel posé, `tests/sql/gescom-outbox-append-only.sql` mis à jour — **fait**.
6. Passif mis au rebut au déploiement (`delivery_attempts=5`, `last_error` explicite), geste borné par un horodatage **littéral figé** (`created_at < '2026-09-08 00:00:00+00'`) — **fait**, corrigé au round 1 (B1), idempotent au rejeu, un événement postérieur à la borne n'est plus rebuté à tort.
7. Isolation tenant — jointure explicite `shops.tenant_id` en plus de la chaîne `customer_id → customer_contacts → shop_customer_accounts` — **fait**, corrigé au round 1 (B2) par un test qui observe réellement les filtres posés, confirmé par test de mutation en round 2.
8. Zéro destinataire n'est pas un échec (`quote.created`/`quote.accepted`/`quote.rejected` sans consommateur, ou `quote.sent` sans compte boutique ouvert) — **fait**, marqué livré sans erreur.
9. Contenu de l'email : aucun montant, nom du client, nom de la boutique, numéro du devis, date de validité, lien — **fait**, textes des deux variantes (premier envoi/renvoi) validés par Arnaud et codés tels quels.
10. `valid_until` lu sur le devis **à la remise**, jamais déduit de la charge utile de l'événement (`QuoteSentPayload` non élargi) — **fait**.
11. Comptes `invited` notifiés comme `active` ; `suspended`/`delegated_only` exclus — **fait**, les quatre statuts exercés.
12. Lien serveur littéral (`/shop/{slug}/account/quotes`), jamais `portalRuntimePaths` (registre navigateur) — **fait**, test de parité avec le chemin dérivé du registre.
13. Client avec comptes dans deux boutiques → deux emails distincts, jamais un email à deux liens — **fait**, testé.
14. Échec Resend / secret absent → l'adaptateur ne lève jamais, `last_error` écrit, reprise au tour suivant — **fait**, vérifié en exécution réelle de l'Edge Function sous Deno sans `RESEND_API_KEY`.
15. Tentatives épuisées (5) ou événement trop vieux (24h) → rebut, pas de nouvel état ni nouvelle table — **fait**.
16. Secret de l'Edge Function (`MAGRIT_OUTBOX_DISPATCH_SECRET`) vérifié en temps constant (`timingSafeEqual`), absent/faux → 401 sans corps — **fait**, testé en exécution réelle sous Deno.

**Hors périmètre, confirmé** : aucune notification à l'atelier sur la décision du client (réserve d du cadrage — story future à ouvrir si Arnaud confirme le besoin), aucune UI (ni bouton « relancer » atelier, ni UI portail), aucune surface de supervision de la file au rebut (dette tracée, pas comblée ici).

##### Contrat API

Aucun endpoint `/api/v1` nouveau — le contrat n'a reçu que des changements de **description** (déjà écrits par l'architecte, §8.13sexies point 2) : `info.description` (principe de livraison au moins une fois + état réel de la livraison), commentaire d'en-tête de `webhooks:`, scope `events:subscribe` marqué RÉSERVÉ. `pnpm gen:api:check` reste vert, inchangé. Le relais est une Edge Function dédiée (`supabase/functions/magrit-outbox-dispatcher/`), hors façade `/api/v1`, protégée par secret partagé comparé en temps constant.

##### Dev Agent Record

###### Agent Model Used

Architecte (cadrage §8.13sexies, Claude Opus) → `dev-story` (Claude Sonnet) → `qa-review` (Claude Opus) round 1 → `dev-story` (correctifs) → `qa-review` round 2.

###### Completion Notes

**QA-review round 1 — Changes requested, 2 bloquants**

- **B1 — Rebut accidentel d'événements neufs.** Le geste de mise au rebut du passif n'était borné par aucune date (`where published_at is null and delivery_attempts < 5`), alors que la migration se prétendait rejouable et que le message d'avertissement (secrets Vault absents) instruisait explicitement de la rejouer — scénario nominal du premier déploiement réel, puisque les secrets ne peuvent être posés qu'après coup. qa-review a prouvé en exécution qu'un rejeu rebutait à tort un événement créé après le premier passage, avec un `last_error` mensonger sur son ancienneté.
- **B2 — Garde-fou tenant non testé.** La jointure `shops.tenant_id` — seul rempart réel, le client étant `service_role` donc hors RLS — n'était couverte par aucun test qui observe réellement les filtres posés. qa-review l'a prouvé en cassant la garde en base (contre-preuve : un devis part bien chez un tiers sans le filtre).

**Correctifs dev-story** : B1 fermé par une borne littérale figée (`created_at < '2026-09-08 00:00:00+00'`) + un bloc SQL de planification du déclencheur séparé du geste de rebut + prose corrigée (section « REJOUABILITÉ » distinguant les parties idempotentes du geste ponctuel). B2 fermé par un nouveau test (`quote-notification-gateway.test.ts`) qui enregistre réellement chaque appel `.eq()`/`.in()` du faux client PostgREST et vérifie que `tenant_id`, `customer_id` et le filtre de statut sont tous posés.

**QA-review round 2 — Approuvé, 0 bloquant**

- B1 revu par reproduction exacte du scénario cassé : un événement postérieur à la borne n'est plus rebuté, le comportement nominal (événements antérieurs) reste correct, rejeu confirmé idempotent.
- B2 revu par **test de mutation réel** : trois mutants (retrait du filtre tenant, élargissement des statuts notifiables, mauvaise colonne de jointure) tués individuellement, code d'origine restauré et vérifié par empreinte SHA-256 identique.
- Gates : `pnpm typecheck` 0 erreur, `pnpm gen:api:check` vert inchangé, `pnpm test:contract` 242/242, `pnpm test:architecture` 144/144, `npx vitest run` 1675 passés / 3 échecs préexistants sans rapport (`tests/storage/product_mockups_isolation.test.ts`, bucket Storage absent en local) / 36 skip. Cas SQL exécutés réellement contre Docker local.

###### Réserves non bloquantes (7, aucune ne bloque le merge)

| Réf. | Trou | Note |
| --- | --- | --- |
| **R1** | Secret du déclencheur cron persisté en clair dans `cron.job.command` malgré lecture Vault | Atténué par une RLS qui limite la visibilité à `postgres`/`supabase_admin`. Chemin de conformité : résoudre le secret à chaque exécution plutôt que de l'interpoler. |
| **R2** | `pnpm test:storefront:sql` aveugle au nouveau cas (s'arrête avant sur `legacy-shop-only-write-freeze.sql`) | Porte cassée depuis au moins b-1, préexistante, sans rapport avec ce lot. |
| **R3** | `occurred_at` non normalisé par `toIsoTimestamp()` dans l'adaptateur neuf | Sans conséquence (champ non sérialisé dans une réponse), dérive de convention. |
| **R4** | Grant colonne décoratif — `service_role` a déjà `UPDATE` table-level par défaut Supabase | Préexistant à ce lot (défaut E10.0), la garde réelle est le trigger append-only. |
| **R5** | Déclencheur jamais exercé de bout en bout via un vrai tour pg_cron→pg_net→Edge Function | À faire au premier déploiement réel, avec relecture de `cron.job_run_details`/`net._http_response`. |
| **R6** | `OutboxDispatcher.runOnce()` interrompt tout le lot sur une erreur de marquage isolée | Sans perte (échéance déjà repoussée), mais le rapport de tour devient une exception plutôt qu'un compte rendu partiel. |
| **R7** | `timingSafeEqual` fuit la longueur du secret par construction | Hérité d'`outbox.ts`, désigné par le cadrage comme la fonction à réutiliser, non actionnable. |

###### File List

**Migration et tests SQL** : `supabase/migrations/20260908000000_gescom_e10_10b_3_outbox_dispatcher.sql`, `tests/sql/gescom-e10-10b-3-outbox-dispatcher.sql`, `tests/sql/gescom-outbox-append-only.sql` (étendu), `scripts/test-storefront-sql.sh`.

**Socle transverse** : `src/modules/_shared/application/outbox-dispatcher.ts`, `outbox.ts` (export `timingSafeEqual`), `index.ts`.

**Adaptateurs** : `src/adapters/supabase/outbox-dispatch-repository.ts`, `src/adapters/resend/quote-sent-email-sender.ts`, `src/adapters/supabase/commercial-quotes-repository.ts` (+ `SupabaseQuoteNotificationGateway`), `tests/adapters/supabase/quote-notification-gateway.test.ts` (correctif B2).

**Module commercial-quotes** : `src/modules/commercial-quotes/application/quote-sent-notification-consumer.ts`, `index.ts`.

**Composition et Edge Function** : `src/server/api/outbox-dispatch-composition.ts`, `index.ts`, `supabase/functions/magrit-outbox-dispatcher/index.ts`, `supabase/config.toml`.

**Tests** (35 nouveaux) : `tests/modules/_shared/outbox-dispatcher.test.ts`, `tests/adapters/resend/quote-sent-email-sender.test.ts`, `tests/modules/commercial-quotes/quote-sent-notification-consumer.test.ts`, `tests/server/api/outbox-dispatch-composition.test.ts`, `tests/adapters/supabase/outbox-dispatch-repository.test.ts`.

Détail complet : `_bmad-output/implementation-artifacts/story-E10-10b-3-notification.md`.

##### Notes opérationnelles — rien n'est déployé

Migration et Edge Function testées **localement uniquement**. Avant tout déploiement réel sur le projet Supabase partagé `ightkxebexuzfjdbpsdg` (B4+B5) :

1. **PAT Supabase** à régénérer (à demander à Arnaud).
2. **Secrets Vault** : URL et secret du déclencheur (le job `pg_cron` ne se planifie que si les deux existent — sans eux, aucune erreur, juste aucun envoi).
3. **Secrets Edge Function** : `MAGRIT_OUTBOX_DISPATCH_SECRET` (nouveau, à générer), `RESEND_API_KEY` (déjà existant sur ce compte Resend), `MAGRIT_FROM_EMAIL=Magrit <devis@magritapp.com>`, `MAGRIT_PUBLIC_APP_URL=https://magritapp.com`.
4. Déployer la migration + l'Edge Function `magrit-outbox-dispatcher`.

Domaine `magritapp.com` déjà vérifié sur Resend (confirmé par appel API direct le 07/09/2026).

##### Change Log

- 2026-09-07 — v1 — Cadrage architecte (§8.13sexies).
- 2026-09-08 — v2 — Implémentation dev-story, qa-review round 1 Changes requested (B1/B2).
- 2026-09-08 — v3 — Correctifs dev-story, qa-review round 2 Approuvé. Commit `a2dca84` (implémentation), `c9817a3` (contrat, architecte).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
