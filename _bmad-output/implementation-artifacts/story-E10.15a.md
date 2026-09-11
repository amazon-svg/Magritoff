---
id: E10.15a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.0, E10.13]
blocks: [E10.15b, E10.15c, E10.15d, E10.15e]
---
# E10.15a — Notifications multicanal : le socle configurable, aucun envoi

Contrat déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.23,
`openapi/magrit-core.v1.yaml` — 5 chemins/7 opérations, 15 schémas,
capability `can_manage_notifications`, 3 réglages sur `CommercialSettings`),
non modifié par ce lot (`git diff openapi/` vide).

Périmètre strict, repris tel qu'écrit au §8.23 §8, ligne « E10.15a — le socle
configurable » : migration `notification_templates` + 3 colonnes de
réglages ; module `src/modules/notifications/` ; moteur de rendu et liste
blanche ; les **six** opérations de configuration (catalogue, liste,
création, fiche, modification, aperçu) ; droit `can_manage_notifications` ;
tests de contrat. **Aucun envoi, aucune file, aucune UI.**

`GET /notification-logs` (`listNotificationLogs`) et la table
`notification_logs` **ne sont pas dans ce lot** : le contrat les décrit déjà
(§8.23 §2/§4), mais le tableau de décomposition (§8.23 §8) les assigne
explicitement à **E10.15c** (« Migration `notification_logs` [...],
`GET /notification-logs` »). Vérifié ligne à ligne avant de coder — ne pas
les implémenter ici était la lecture correcte, pas une omission.

## qa-review round 1 — REJETÉ, deux bloquants corrigés

Une première remise a été **rejetée** (2 majeurs B1/B2, 2 mineurs m1/m2).
Corrigés dans cette même passe, avant remise pour une nouvelle revue :

- **B1 (MAJEUR)** — `updateNotificationTemplate` ne revalidait AUCUNE règle
  structurelle par canal sur l'état résultant (`merged` ne portait pas
  `channel`), produisant un **500** au lieu du 422 exigé par le contrat
  (« mêmes motifs que `createNotificationTemplate` »). Corrigé : `channel`
  ajouté au `merged` du service ; `channelShapeIssues()` (fonction pure,
  **partagée** entre le `.superRefine()` Zod de création et le service, qui
  seul connaît le `channel` courant à la modification) revalide sujet
  exigé/interdit et corps ≤ 480 sur SMS, sur l'état résultant du PATCH ; 422
  `api.validation_failed` via la nouvelle erreur de domaine
  `NotificationTemplateChannelShapeError`. `mapNotificationTemplateError`
  (adaptateur) traduit aussi le `check_violation` (23514) correspondant en
  422 nommé plutôt qu'en 500 brut (défense en profondeur, la validation
  applicative prévient déjà le cas en usage normal).
- **B2 (MAJEUR, GRAVE)** — `production_step_id` acceptait l'identifiant
  d'un **AUTRE TENANT**, et la FK `on delete cascade` permettait à ce
  tenant tiers de **détruire en cascade** une ligne d'un autre espace — sur
  une table où le contrat garantit explicitement qu'il n'existe **aucun
  DELETE**. Corrigé en DEUX endroits, comme les deux précédents du dépôt
  (`project_tag_links_assert_same_tenant`,
  `document_pdf_template_fields_assert_same_tenant`) : (1) **EN BASE**,
  trigger neuf `notification_templates_assert_same_tenant` (même patron
  exact), qui refuse tout `production_step_id` n'appartenant pas au tenant
  du modèle ; (2) **côté application**,
  `NotificationTemplatesRepository.stepBelongsToTenant()` (nouveau port),
  appelé par le service avant toute écriture qui pose `production_step_id`,
  422 `api.validation_failed` (« étape inconnue ») — y compris pour un id
  simplement **inexistant**, qui levait auparavant une violation de FK
  brute (500). Cas SQL dédié ajouté (scénario 6bis), qui rejoue EXACTEMENT
  le scénario destructeur signalé (INSERT puis UPDATE cross-tenant, les
  deux refusés).
- **m1** — Le moteur de rendu n'implémentait pas l'automate décrit par le
  contrat (« lit jusqu'au `}}` correspondant ») : la regex `[^{}]*`
  **sautait silencieusement** l'ouverture externe d'une balise imbriquée
  (`{{ {{order.number}} }}` était accepté et rendu `{{ CDE-2026-00042 }}`,
  accolades parasites livrées au client). Corrigé : `notification-tag-renderer.ts`
  remplace la regex par un balayage procédural (`scanNotificationTagSpans`,
  partagé entre extraction/validation ET rendu) qui capture tout le contenu
  jusqu'au **premier** `}}` rencontré, y compris s'il contient lui-même des
  accolades — ce contenu ne correspond alors à AUCUN `NotificationTagId`
  connu et la balise imbriquée est donc **refusée**, jamais mal-parsée.
  Tests unitaires ajoutés (extraction, validation, rendu).
- **m2** — Le cas SQL ne vérifiait l'isolation RLS en écriture qu'entre un
  membre SANS capability et le même tenant ; aucun scénario ne vérifiait
  qu'un **admin du tenant B** (capability complète, mais dans le mauvais
  tenant) ne peut ni modifier ni créer une ligne du tenant A. Scénario 2bis
  ajouté (`.claude/rules/db.md` : isolation lecture **et** écriture).

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260911010000` | (1) Table **neuve** `notification_templates` (`id`, `tenant_id`, `event_name`, `channel`, `audience`, `recipients`, `production_step_id`, `name`, `subject`, `body`, `is_active`, `created_by/_at`, `updated_by/_at`), `check` sur `event_name`/`channel`/`audience` (pas d'enum Postgres, liste additive), cohérences croisées par `check` (`recipients` exigé ssi `audience='explicit'`, `production_step_id` valide ssi `event_name='order.step_changed'`, `subject` exigé ssi `channel='email'`, corps ≤ 480 sur `sms`). (2) Trigger `notification_templates_guard` (`before insert or update`) : plafond de 100 modèles/tenant sous verrou consultatif (`pg_advisory_xact_lock`, même patron que `api_create_production_step`), immuabilité de `event_name`/`channel` après création, horodatage/auteur posés côté base. (2bis, **qa-review B2**) Trigger `notification_templates_assert_same_tenant` (`before insert or update`) : refuse un `production_step_id` n'appartenant pas au **même tenant** que le modèle — même patron exact que `project_tag_links_assert_same_tenant`/`document_pdf_template_fields_assert_same_tenant` — sans quoi la FK `on delete cascade` laissait un tenant tiers détruire indirectement une ligne d'un autre espace. **Aucune fonction `security definer` dédiée** (à la différence de `production_steps`) : les deux triggers s'appliquent quel que soit le chemin d'écriture. (3) RLS : `notification_templates_select` (isolation tenant standard) ; `notification_templates_insert`/`_update` gardées par `user_has_capability(tenant_id, 'can_manage_notifications')` ; **aucune policy DELETE** (ni `for all`) — un `DELETE` est donc refusé EN BASE, pas seulement absent de l'API (contrat : « pas de suppression »). (4) Trois colonnes neuves sur `commercial_settings` : `notification_retention_days` (90 par défaut, 7–730), `notification_sms_enabled` (false), `notification_sms_daily_cap` (200, 0–10000). (5) Trigger `commercial_settings_guard_notification_fields` (`before insert or update`) : refuse EN BASE toute écriture des trois champs de notification par un acteur dépourvu de `can_manage_notifications`, **même s'il porte `can_manage_pricing`** — défense en profondeur du contrôle déjà posé côté service. |
| Module `notifications` (nouveau) | `api/contracts.ts` (schémas Zod miroir du contrat + alignement de compilation, `channelShapeIssues()` **partagée** entre Zod et le service — qa-review B1) ; `api/client.ts` (consommé par la future UI E10.15b, pas encore utilisé) ; `application/notification-event-catalog.ts` (catalogue EN DUR des 5 événements notifiables, CA1/CA4, matrice événement→balises — **décision de ce lot**, voir Dette) ; `application/notification-tag-renderer.ts` (moteur de rendu à **grammaire fermée**, balayage procédural `scanNotificationTagSpans` — qa-review m1 — lit jusqu'au premier `}}` correspondant, refuse toute balise imbriquée, aucune valeur substituée n'est re-balayée) ; `application/notification-templates-service.ts` (garde `can_manage_notifications`, règles croisées CA5, revalidation de la forme par canal ET de l'appartenance tenant de `production_step_id` sur l'état résultant — qa-review B1/B2) ; `application/notification-templates-repository.ts` (port + 9 erreurs de domaine, dont `NotificationTemplateChannelShapeError`/`NotificationTemplateProductionStepInvalidError` neuves, + `stepBelongsToTenant()`) ; `index.ts`. |
| Adaptateur Supabase | `src/adapters/supabase/notification-templates-repository.ts` — `create`/`update` sont des `INSERT`/`UPDATE` **directs**, gardés par la RLS + le trigger (aucune fonction `security definer` dédiée, contrairement à `production_steps`) ; `isSmsEnabled()` lit `CommercialSettings.notification_sms_enabled` via `api_get_commercial_settings` (pas de dépendance croisée TS vers le module `commercial-settings`). |
| `GET /notification-events` | `listNotificationEvents` — catalogue des 5 événements notifiables (`quote.sent`, `quote.converted`, `order.step_changed`, `order.files_submitted`, `customer.created`), sans `order.created` (n'existe pas dans `OUTBOX_EVENT_NAMES`, contrat). `channels` dépend de `CommercialSettings.notification_sms_enabled` du tenant. Aucune clé de service, aucune pagination. |
| `GET /notification-templates` | `listNotificationTemplates` — liste triée `event_name` puis `name`, filtres `event_name`/`channel`/`status`, sans pagination (plafond de 100), sans ETag de collection. |
| `POST /notification-templates` | `createNotificationTemplate` — 201, `Idempotency-Key` exigée, `is_active: false` par défaut. 422 `notification_template.unknown_tag` (CA5, avec `errors[]` nommant le champ `subject`/`body` fautif), `recipients_required`, `step_filter_not_applicable`, `limit_reached`. |
| `GET /notification-templates/{templateId}` | `getNotificationTemplate` — fiche + `ETag` du modèle, précondition de `updateNotificationTemplate`. |
| `PATCH /notification-templates/{templateId}` | `updateNotificationTemplate` — `If-Match` exigé, `event_name`/`channel` absents de la commande (immuables). Garde `can_manage_notifications` posée **avant** la lecture qui alimente l'ETag (403 avant 409/428). |
| `POST /notification-templates/{templateId}/previews` | `previewNotificationTemplate` — 200 (jamais 201), **aucune** `Idempotency-Key` (fonction pure), rend le modèle (ou le texte de l'écran) sur le jeu d'exemple **fictif** du catalogue. **Aucun envoi réel, aucune écriture.** |
| Capability nouvelle | `can_manage_notifications` — lecture ouverte à tout membre, écriture réservée, détenue par un `admin` par dérivation (`user_has_capability`), aucune délégation aujourd'hui. |
| `CommercialSettings` étendu | 3 champs de notification, **garde AU CHAMP** : `updateCommercialSettings` continue de déclarer `can_manage_pricing` (droit minimal de l'opération), mais l'écriture des 3 champs de notification exige EN PLUS `can_manage_notifications` — refus 403 **`identity.capability_required`** (code neuf, additif, distinct de `identity.role_required`). `CommercialSettingsService.assertCanManageNotificationFields()` (nouveau), appelé par la route avant toute lecture de ressource, même ordre que `assertCanManagePricing`. |
| Câblage edge function | `supabase/functions/magrit-api/index.ts` — `NotificationTemplatesService` instancié sur `client`, injecté dans `gescomServices`. |

## Le moteur de rendu — décision technique

Le contrat (§8.23 §5) tranchait : « pas de moteur de gabarit tiers, une
grammaire fermée et un automate ». Implémenté en TypeScript pur
(`notification-tag-renderer.ts`, aucune dépendance externe) :
- `scanNotificationTagSpans()` (fonction interne, **partagée** par
  extraction/validation et rendu — qa-review m1) — balayage procédural
  caractère par caractère : à chaque `{{` rencontré, cherche le **premier**
  `}}` qui suit (`indexOf`), sans exclure les accolades du contenu capturé.
  Une balise imbriquée (`{{ {{order.number}} }}`) capture donc un contenu
  qui contient lui-même des accolades (`" {{order.number"`), qui ne
  correspondra **jamais** à un `NotificationTagId` connu — elle est ainsi
  **refusée explicitement**, jamais mal-parsée en sautant silencieusement
  l'ouverture externe (bug corrigé en round 1 : le texte fuitait
  `{{ CDE-2026-00042 }}`, accolades parasites livrées au client).
- `extractNotificationTagTokens()` — un seul balayage, extrait le contenu
  brut de chaque span, dans l'ordre, sans doublon.
- `assertKnownNotificationTags()` — refuse si au moins un jeton extrait ne
  correspond pas **exactement** (sans trim) à un `NotificationTagId` connu.
  Une variante avec espaces (`{{ order.number }}`) est donc **refusée comme
  balise inconnue**, jamais acceptée comme texte littéral ni confondue avec
  la balise valide — comportement explicitement annoncé par le contrat
  (« le validateur refusera » ces variantes) et couvert par un test dédié.
- `renderNotificationTags()` — construit la sortie en recopiant les segments
  littéraux et en insérant les valeurs substituées dans une chaîne
  **distincte** du texte source : une valeur substituée n'est jamais
  re-balayée (testé : une raison sociale contenant littéralement
  `{{order.number}}` n'est pas interprétée une seconde fois).

## Ce qui n'est PAS dans le périmètre

- **Aucun envoi réel, aucune file, aucun consumer outbox** — `notification_logs`, `api_claim_notification_messages`, le trigger d'immuabilité du journal, la purge de rétention, `NotificationDispatchConsumer`/`CompositeOutboxConsumer`, l'Edge Function `magrit-notification-sender`, l'adaptateur courriel Resend générique : **E10.15c**.
- **Aucun branchement sur un événement du bus** — ni `order.step_changed`, ni `quote.sent`/`quote.converted`/`customer.created`/`order.files_submitted`. Le socle ne consomme rien.
- **Aucune UI** — `src/modules/notifications/ui/` n'existe pas. `api/client.ts` est écrit (pattern des 10 autres modules E10.x) mais n'est consommé par aucun écran dans ce dépôt à ce jour.
- **Aucun canal SMS réel** — le canal existe au contrat/schéma (`NotificationChannel`), aucun prestataire n'est choisi (réserve (b) du contrat, non tranchée), aucune normalisation E.164, aucun comptage de segments réel (l'estimation de `previewNotificationTemplate.sms_segment_count` est un calcul arithmétique provisoire, explicitement documenté comme tel — voir Dette).
- **`GET /notification-logs`** — assigné à E10.15c par le découpage du contrat, vérifié explicitement en tête de ce document.

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **D1 — nouvelle** | La matrice **événement → balises autorisées** (`allowedTagsForEvent`, `notification-event-catalog.ts`) est une **décision de ce lot**, pas une prescription littérale du contrat (qui fixe les 5 événements et les 13 balises séparément, jamais la matrice). Choix documenté dans le code : une balise n'est proposée sur un événement que si la donnée est raisonnablement disponible au rendu (vérifié contre `QuoteConversionPayload`/`OrderStepChangedPayload`/`OrderFilesSubmittedPayload`). | À confirmer par `qa-review` ou un humain produit avant E10.15b (écran de paramétrage) — un ajustement de la matrice est additif (un `NotificationEventDescriptor.tags` qui grandit), jamais cassant. |
| **D2 — nouvelle, mineure** | `NotificationPreview.sms_segment_count` est calculé par une estimation arithmétique fixe (160 caractères/segment, hypothèse GSM-7), **provisoire** — le contrat lui-même le dit (« confirmée contre la documentation du prestataire retenu, jamais devinée »), et aucun prestataire n'est choisi (réserve (b)). | E10.15e (canal SMS) recalcule ce chiffre contre la documentation officielle du prestataire retenu, via Context7 ou lecture directe, jamais de mémoire — règle absolue déjà rappelée par le contrat lui-même. |
| **D3 — nouvelle, mineure** | La contrainte `check` de cohérence `recipients` (table `notification_templates`) ne peut **pas** valider la longueur individuelle de chaque destinataire (3–320 caractères) : Postgres refuse une sous-requête dans un `check` (`SQLSTATE 0A000`, constaté à l'exécution réelle de la migration). Seules l'exigence/interdiction selon l'audience et la borne de compte (1–10) sont portées en base ; la longueur par entrée reste portée par `notificationRecipientsSchema` (Zod) seul. | Chemin de mise en conformité si jugé nécessaire : une fonction `plpgsql` dédiée (pas un `check` inline) qui boucle sur `unnest(recipients)` — coût et complexité jugés disproportionnés pour un backstop déjà couvert côté application ; non fait ici. |
| **D4 — héritée, confirmée par ce lot** | `send-order-notification` (Edge Function pré-E10, S3.2-residual) envoie déjà un courriel d'atelier à la création d'une commande boutique, avec une heuristique « admin tenant » écrite en dur — signalée par le contrat (§8.23 §1, §9 réserve (f)) comme un doublon fonctionnel dès qu'un tenant configure un modèle E10.15 équivalent. Ni reprise ni retirée par ce lot. | À arbitrer par Arnaud : laisser vivre, ou remplacer par un modèle une fois E10.15d livrée (contrat, réserve (f)). |
| **D5 — héritée, ouverte** | Réserve RGPD (a) du contrat : durée de conservation par défaut de `notification_retention_days` (90 jours écrits au contrat, 12 mois proposés par la fiche Notion source) — **non tranchée par Arnaud** à ce jour. Ce lot implémente le défaut **écrit au contrat** (90 jours), sans trancher la réserve lui-même. | Si Arnaud retient une autre valeur, une seule ligne de migration change (`default 90`) — additif, sans rupture. |
| **D6 — nouvelle, mineure, sur l'UM1** | Le scénario SQL de la garde « au champ » (`commercial_settings_guard_notification_fields`) ne peut être joué avec un acteur RÉEL séparant `can_manage_pricing` et `can_manage_notifications` : le modèle Magrit actuel (verrou UM1 « admin unique ») interdit toute affectation de rôle portant une capability métier à un membre `magrit_full` (prouvé par `gescom-e10-11-can-manage-pricing.sql`), et le chemin `shop_only` est figé (`freeze_legacy_shop_only_write()`). Le cas SQL construit donc cette **fixture** avec le trigger UM1 `tenant_role_assignments_only_options` désactivé pour une seule instruction (rôle `postgres` uniquement — un acteur `authenticated` ne peut pas le faire), même patron déjà précédenté par `gescom-e10-22d-purge-activation.sql`. | Aucune action requise : c'est un artifice de TEST, documenté comme tel dans le fichier SQL, pas un contournement produit. Le comportement réel de la garde est néanmoins prouvé (403 avant 409, refus au champ, admin réussit sur les trois champs). |

## Vérifications

`pnpm typecheck` (= `typecheck:modular`) : **0 erreur**. `pnpm typecheck:all`
(`tsconfig.json`, couvre aussi `tests/**`) : **pré-existant en échec, sans
rapport avec ce lot** — des dizaines d'erreurs dans des fichiers jamais
touchés ici (`tests/utils/productEnrichment.test.ts`,
`tests/server/roles-routes.test.ts`, `tests/modules/shop-customers/*`,
etc.), confirmé en isolant : `tests/server/api/magrit-api-composition.test.ts`
construit un `GescomServices` **déjà partiel** avant ce lot (il n'incluait
déjà ni `productionSteps`, ni `documentTemplates`, ni `orderFiles`, etc.) —
l'ajout de `notificationTemplates` au type n'a fait qu'ajouter une ligne à
une erreur de forme déjà présente, pas créé une régression. `pnpm
gen:api:check` : aligné (`git diff openapi/` vide, aucune modification du
contrat par ce lot). `pnpm test:architecture` : **146/146** (34 fichiers),
inchangé. `pnpm test:contract` : **405/405** (21 fichiers, `notifications.
contract.test.ts` à 21 cas — 15 initiaux + 6 qa-review round 1 (B1×3, B2×3),
`commercial-settings.contract.test.ts` à 6 cas — 3 initiaux + 3 garde au
champ), en hausse de 24 par rapport à la baseline de 381 laissée par le
cadrage de l'architecte. `npx vitest run --maxWorkers=2` (suite complète) :
**2171 passés / 36 skip**, 3 échecs **pré-existants et sans rapport**
(`tests/storage/product_mockups_isolation.test.ts` — bucket Storage local
introuvable, `StorageApiError: Bucket not found`, avant **et** après ce
lot, aucune mention de `notification`/`commercial_settings` dans le fichier).

**Tests unitaires du moteur de rendu**
(`tests/modules/notifications/notification-tag-renderer.test.ts`, 19 cas —
16 initiaux + 3 qa-review m1) : extraction sans doublon, texte sans balise
inchangé, accolade isolée non reconnue comme jeton, variante avec espaces
capturée telle quelle puis refusée par le validateur, **balise imbriquée
(`{{ {{order.number}} }}`) capturée avec ses accolades et donc refusée,
jamais mal-parsée, aucune fuite d'accolades au rendu**, balise connue
substituée, balise absente du contexte rend une chaîne vide (jamais un
tiret), **une valeur substituée contenant elle-même un jeton littéral n'est
pas re-interprétée**, balise répétée substituée à chaque occurrence.
`tests/modules/notifications/notification-event-catalog.test.ts` (9 cas) :
les 5 événements notifiables exacts (jamais `order.created`), `channels`
filtré par `notification_sms_enabled`, seul `order.step_changed` supporte
le filtre d'étape, seul `order.files_submitted` regroupe, chaque balise
proposée appartient à la liste blanche, aucune balise de
montant/taux/remise/statut.

`tests/sql/gescom-e10-15a-notification-templates.sql` : **exécuté
réellement** (Docker local, migration appliquée par `pnpm db:local:reset`,
rejoué après les correctifs B1/B2/m1/m2). `rollback` final, 0 erreur :
(0) `commercial_settings` — défauts (90/false/200), bornes de plage
(7–730, 0–10000) sous un acteur authentifié portant `can_manage_notifications` ;
(1) RLS lecture — un membre du tenant B ne voit aucun modèle du tenant A ;
(2) RLS écriture — un membre sans `can_manage_notifications` ne peut ni
créer ni modifier un modèle de SON PROPRE tenant ; **(2bis, qa-review m2)**
RLS écriture INTER-TENANT — un **admin du tenant B** (capability complète
chez lui) ne peut ni modifier ni créer une ligne sous `tenant_id = tenant A` ;
(3) **aucun `DELETE`**, même pour un admin (aucune policy DELETE n'existe,
garde EN BASE, pas seulement l'absence d'un endpoint) ; (4) immuabilité de
`event_name`/`channel` après création
(`notification_template.immutable_field`) ; (5) coherences `check` —
`recipients` exigé/interdit selon l'audience, filtre d'étape valide sur
`order.step_changed` seul, sujet exigé/interdit selon le canal, corps SMS
≤ 480 (borne inclusive testée) ; (6) `production_step_id ... on delete
cascade` — un modèle rattaché à une étape supprimée disparaît avec elle ;
**(6bis, qa-review B2, MAJEUR)** `notification_templates_assert_same_tenant`
— un `production_step_id` du **tenant B** est refusé à l'INSERT ET à
l'UPDATE d'un modèle du tenant A, rejouant exactement le scénario
destructeur signalé (sans ce trigger, l'admin du tenant B supprimant SA
propre étape aurait détruit en cascade une ligne du tenant A) ;
(7) plafond de 100 modèles/tenant sous verrou (101e refusé,
`notification_template.limit_reached`) — joué **en dernier** parmi les
scénarios `notification_templates`, pour ne pas fausser les insertions
valides des scénarios précédents ; (8) `commercial_settings_guard_
notification_fields` — un acteur portant `can_manage_pricing` SEUL modifie
`default_validity_days` mais est refusé (`permission_denied`) sur les trois
champs de notification ; un admin (dérivation `can_manage_notifications`)
réussit sur les trois. Non-régression complète de la chaîne SQL existante
rejouée individuellement (`docker exec ... psql`, pas seulement via
`pnpm test:storefront:sql`, dont le premier script — sans rapport,
`storefront-session-lifecycle.sql` — exige un `auth.users` pré-existant
qu'un reset propre ne fournit jamais) : `gescom-e10-17a-order-files.sql`,
`gescom-e10-19a-order-document-template.sql`,
`gescom-e10-19b-order-documents.sql`, `gescom-e10-20a-order-upload-links.sql`,
`gescom-e10-20b-order-upload-link-deposit.sql`,
`gescom-e10-22a-order-file-purge-notices.sql`,
`gescom-e10-22b-22c-purge-execution.sql`,
`gescom-e10-22c-qa-round1-confirm-expiry-guard.sql`,
`gescom-e10-22d-purge-activation.sql`, ainsi que
`gescom-e10-13-production-steps.sql` (dépendance FK
`production_step_id`) — **tous OK, 0 erreur**.

## Critères d'acceptation (contrat §8.23, tenus un par un)

Numérotation reprise du tableau de décomposition §8.23 §8 (ligne E10.15a) et
du corps du §8.23, faute d'accès Notion direct (même réserve que
E10.12/E10.13, non levée par cet agent).

1. **Catalogue des faits notifiables, avec balises et audiences (CA1, CA4)** — **fait**. `GET /notification-events`, 5 événements en dur côté serveur, testé (contrat + unitaire).
2. **Six opérations de configuration (catalogue, liste, création, fiche, modification, aperçu)** — **fait**. Les six routes existent, enregistrées dans `gescom-routes.ts`, testées contre le contrat (15 cas).
3. **Modification partielle, `event_name`/`channel` immuables** — **fait**. `UpdateNotificationTemplateCommand` ne les porte pas ; garde EN BASE par le trigger (testé SQL scénario 4) en plus de l'absence au contrat.
4. **Balise inconnue refusée À L'ENREGISTREMENT, jamais à l'envoi (CA5)** — **fait**. `createNotificationTemplate`/`updateNotificationTemplate`/`previewNotificationTemplate` : 422 `notification_template.unknown_tag`, `errors[]` par balise fautive nommant le champ. Aucun mécanisme d'envoi n'existe dans ce lot — la contrainte « jamais à l'envoi » est vraie par absence de tout chemin d'envoi. Balise **imbriquée** également refusée (qa-review m1), et le `production_step_id` d'un autre tenant refusé EN BASE et à l'application (qa-review B2) — deux trous fermés qui, non corrigés, auraient laissé passer une donnée malformée ou une écriture inter-tenant à l'enregistrement.
5. **Grammaire fermée, pas de regex artisanale, pas de moteur tiers** — **fait**. `notification-tag-renderer.ts`, balayage à un seul passage, aucune substitution re-balayée, testé unitairement (16 cas) y compris le cas explicite d'une valeur contenant un jeton littéral.
6. **Aperçu sur un jeu d'exemple fictif, aucun envoi (CA6)** — **fait**. `POST /notification-templates/{id}/previews`, 200, aucune `Idempotency-Key`, testé (contrat).
7. **Droit `can_manage_notifications` dédié, lecture ouverte, écriture réservée** — **fait**. RLS + service + route, testé (contrat 403 `identity.role_required` ; SQL scénarios 2/8).
8. **Trois réglages sur `CommercialSettings`, garde au champ distincte de `can_manage_pricing`** — **fait**. Migration, service (`assertCanManageNotificationFields`), route, trigger EN BASE, testé (contrat 6 cas ; SQL scénario 8, artifice documenté en D6).
9. **`GET /notification-logs`, table `notification_logs`** — **HORS PÉRIMÈTRE**, assigné explicitement à E10.15c par le tableau de décomposition du contrat (§8.23 §8). Ni compté comme fait, ni comme dette d'implémentation de ce lot.
10. **Aucun envoi, aucune file, aucun consumer outbox, aucune UI** — **respecté par construction**. Aucun fichier de ce lot n'ouvre de connexion réseau sortante ni ne touche `outbox_events`/un consumer ; `src/modules/notifications/ui/` n'existe pas.

## Fichiers créés/modifiés

**Migration et tests SQL**
- `supabase/migrations/20260911010000_gescom_e10_15a_notification_templates.sql` (nouveau)
- `tests/sql/gescom-e10-15a-notification-templates.sql` (nouveau)
- `scripts/test-storefront-sql.sh` (ajout du nouveau cas)

**Module `notifications` (nouveau)**
- `src/modules/notifications/api/contracts.ts`
- `src/modules/notifications/api/client.ts`
- `src/modules/notifications/application/notification-event-catalog.ts`
- `src/modules/notifications/application/notification-tag-renderer.ts`
- `src/modules/notifications/application/notification-templates-service.ts`
- `src/modules/notifications/application/notification-templates-repository.ts`
- `src/modules/notifications/index.ts`

**Adaptateur et routes**
- `src/adapters/supabase/notification-templates-repository.ts` (nouveau ; qa-review round 1 : `stepBelongsToTenant()`, mapping étendu des `check_violation`/FK/trigger cross-tenant)
- `src/server/api/notification-templates-routes.ts` (nouveau ; qa-review round 1 : mapping `NotificationTemplateChannelShapeError`/`NotificationTemplateProductionStepInvalidError` → `api.validation_failed`)
- `src/server/api/gescom-routes.ts` (enregistrement du module)
- `supabase/functions/magrit-api/index.ts` (câblage `NotificationTemplatesService`)

**Socle transverse**
- `src/modules/_shared/application/problem.ts` (code `identity.capability_required` + `capabilityRequired()`)
- `src/modules/_shared/application/index.ts` (export)

**Module `commercial-settings` (étendu, 3 réglages de notification)**
- `src/modules/commercial-settings/api/contracts.ts`
- `src/modules/commercial-settings/application/commercial-settings-repository.ts` (`CommercialSettingsFieldCapabilityDeniedError`)
- `src/modules/commercial-settings/application/commercial-settings-service.ts` (`assertCanManageNotificationFields`)
- `src/adapters/supabase/commercial-settings-repository.ts`
- `src/server/api/commercial-settings-routes.ts`

**Tests**
- `tests/contract/notifications.contract.test.ts` (nouveau, 21 cas — 15 initiaux + 6 qa-review round 1)
- `tests/contract/_fakes/notification-templates-repository.fake.ts` (nouveau ; qa-review round 1 : `seedProductionStepForTest()`, `stepBelongsToTenant()`)
- `tests/contract/commercial-settings.contract.test.ts` (6 cas — 3 initiaux + 3 garde au champ)
- `tests/contract/_fakes/commercial-settings-repository.fake.ts` (3 champs ajoutés)
- `tests/modules/notifications/notification-tag-renderer.test.ts` (nouveau, 19 cas — 16 initiaux + 3 qa-review m1)
- `tests/modules/notifications/notification-event-catalog.test.ts` (nouveau, 9 cas)
