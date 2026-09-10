---
id: E10.22a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: []
blocks: [E10.22b, E10.22c]
---
# E10.22a + E10.22a-bis — l'échéance, les rappels, et la preuve de livraison

Contrat déjà écrit par l'architecte : `docs/api/CONVENTIONS.md` §8.22 (cadrage
dense, révisé le 2026-09-10 : deux réserves fermées — blocage de la purge
sans rappel confirmé délivré, aucune exemption/prorogation), et
`openapi/magrit-core.v1.yaml` (déjà à jour : `OrderFile.purge_at`,
`OrderFileDetail.purge_at`, `OrderFilePurgeStage`,
`OrderFilesPurgeScheduledPayload`, `OrderFilesPurgedPayload`, webhooks
`order_files.purge_scheduled`/`order_files.purged`, `EventName` étendu).
**`openapi/magrit-core.v1.yaml` non touché par ce lot** (`pnpm gen:api:check`
vert, aucun diff sur le fichier).

**Périmètre STRICT tenu** : E10.22a (échéance + rappels) et E10.22a-bis
(preuve de livraison) **fusionnées dans ce lot**, comme le permet le contrat
(§8.22 §8 : « à fusionner avec `a` seulement si Arnaud préfère un lot de plus
gros grain » — la preuve de livraison est un préalable fonctionnel : sans
elle, aucune donnée n'aurait jamais pu satisfaire la garde de purge future).
**E10.22b (purge réelle) et E10.22c (objets orphelins) ne sont PAS ce lot** —
rien n'est détruit par ce qui suit, aucune ligne `commercial_order_files`
n'est marquée `purged_at`, aucun objet de stockage n'est retiré.

## qa-review round 1 (« REJETÉ », un bloquant critique + un bloquant fonctionnel) → corrections

La première soumission a été **rejetée**. Le cœur du mécanisme (garde de purge
non falsifiable, preuve Resend, RLS, isolation, idempotence, sécurité du
déclencheur) a été vérifié en base par la qa-review et n'a **pas** été
retouché. Détail des deux bloquants et des corrections apportées :

### B1 — BLOQUANT CRITIQUE (migration), corrigé

**Constat exact.** Dans `20260910000500_gescom_e10_22a_purge_notices.sql`,
l'ORDRE était inversé entre la reprise du passif (`UPDATE` sur
`commercial_order_files`, **sans** `where`, donc sur TOUTES les lignes
existantes) et le désarmement du trigger `commercial_order_files_set_
updated_at()`. Au moment où l'`UPDATE` de reprise s'exécutait, l'ANCIEN
trigger (posé par `20260909060000`, qui bump `updated_at` de façon
inconditionnelle) était encore actif — conséquence prouvée par la qa-review
en rejouant la migration en base locale : `updated_at` de TOUS les fichiers
déjà en production (E10.17a/17b/20b) aurait sauté à l'instant du déploiement,
périmant leur `ETag` sans qu'aucun utilisateur n'ait rien fait — exactement
le dommage que le contrat §8.22 §2 exige d'empêcher.

**Corrigé.** Le bloc `create or replace function public.
commercial_order_files_set_updated_at()` a été déplacé **au-dessus** de
l'`UPDATE` de reprise, dans le même fichier de migration (cette migration
n'a jamais été déployée nulle part au-delà de cette session locale — le
correctif est un simple réordonnancement du fichier, pas une migration
inverse). L'en-tête du fichier et la numérotation des sections (`── 1.` à
`── 4.`) ont été mis à jour pour refléter l'ordre RÉEL d'exécution. **Prouvé
par un rejeu réel complet** (`pnpm db:local:reset`, 95 migrations, 0 erreur)
et par un **scénario SQL dédié (scénario 0)** ajouté à
`tests/sql/gescom-e10-22a-order-file-purge-notices.sql` : un fichier réel
subit exactement la FORME de l'instruction `UPDATE` de la reprise du passif,
et `updated_at` en sort inchangé.

### B2 — BLOQUANT FONCTIONNEL, corrigé

**Constat exact.** Le contrat §8.22 §4 exige explicitement des liens vers les
fiches commande dans le texte du rappel (jusqu'à 50 `order_ids`, même
discipline que E10.10b-3 : `MAGRIT_PUBLIC_APP_URL` absente → aucun envoi,
échec explicite). Le SQL émettait bien `order_ids` dans la charge utile
outbox, mais `parsePurgeScheduledPayload` ne le lisait pas,
`PurgeNoticeNotificationConsumerDependencies` n'avait aucun `publicAppUrl`,
et les corps d'e-mail ne contenaient aucun lien — un atelier recevait « 2
fichiers déposés sur 1 commande seront supprimés » sans numéro de commande ni
lien, inactionnable dès que plusieurs commandes étaient concernées.

**Corrigé.** `publicAppUrl: string | null` ajouté aux dépendances du
consommateur (propagé depuis `outbox-dispatch-composition.ts`, même flux que
le consommateur devis) ; échec explicite `{delivered:false, reason:
'MAGRIT_PUBLIC_APP_URL non configurée'}` si absente, **avant** toute
résolution de destinataire ; `order_ids` lu et validé dans le payload
(requis, non vide — payload invalide sinon) ; `buildOrderDetailLink()`
compose un lien LITTÉRAL serveur par `order_id`
(`/t/<tenantSlug>/dashboard/commercial-orders/<orderId>`) ; le slug du tenant
est résolu via une nouvelle méthode `getTenantSlug()` sur le gateway
(lecture directe de `public.tenants`, le consommateur ne connaissait que
l'UUID du tenant). **Un test dédié** assère l'égalité du chemin composé avec
le registre de surfaces (`workspaceSurface`, route
`commercial-orders.workspace.detail`) ET avec le montage littéral de
`src/app/routes.tsx` (`/t/:tenantSlug/dashboard/...`) — même discipline que
`buildAccountQuotesLink` (E10.10b-3), en notant une limite : contrairement au
portail client (`portalRuntimePaths.ts`), **aucun registre équivalent
n'existe pour le préfixe `/t/:tenantSlug/dashboard`** côté workspace (vérifié
en base de code, pas supposé) — le test s'appuie donc sur le registre pour le
segment `commercial-orders/:orderId` et sur une assertion littérale
hardcodée pour le préfixe, la meilleure approximation disponible de la
discipline demandée.

### Réserve de fond sur le texte (corrigée dans la même passe)

Le texte du palier J+10 disait « Sauf action de votre part, ils seront
supprimés automatiquement… », laissant croire qu'un geste peut EMPÊCHER la
suppression. La réserve (a) d'Arnaud, **fermée** le 2026-09-10 (contrat
§8.22 §10) : aucune exemption, aucune prorogation, aucun geste « Conserver ce
fichier » n'existe. **Corrigé** : les deux textes disent désormais
explicitement que la SEULE action possible est de télécharger le fichier
avant l'échéance — jamais un recours qui n'existe pas. Le palier J+15 (déjà
jugé correct par la qa-review, « c'est le moment de les récupérer ») est
inchangé dans son esprit. **Toujours ⚠️ non validé par Arnaud** — même réserve
que pour `ResendQuoteSentEmailSender`.

### Non bloquants, corrigés dans la même passe (N1, N2, N3)

- **N1** — `PurgeSweepService.runOnce()` relisait `GET /emails/{id}` (étape
  de confirmation) **après** avoir expiré les rappels sans confirmation :
  dans le tour où la fenêtre de 3 jours se ferme, une confirmation arrivée
  entre-temps n'avait pas la chance d'être consignée avant l'expiration.
  **Corrigé** : la relecture des livraisons s'exécute désormais **avant**
  `expireStaleNotices()`, dans le même tour.
- **N2** — `api_record_order_file_purge_notice_delivery_check` propageait
  `confirmed_at` sur le rappel sans vérifier `failed_at is null` : une
  relecture tardive « delivered » sur un rappel déjà expiré polluait le
  suivi opérationnel (un rappel `failed_at` ET `confirmed_at` tous deux non
  nuls). **Corrigé** : `and failed_at is null` ajouté à la clause de
  propagation.
- **N3** — Le cas SQL promettait de tester l'isolation tenant sur les DEUX
  tables (`..._purge_notices` ET `..._deliveries`) mais le scénario 7
  n'interrogeait que la première. **Corrigé** : quatre assertions ajoutées
  (lecture croisée tenant A/B, écriture directe refusée) sur
  `commercial_order_file_purge_notice_deliveries`.

### D1 (owner vs admin) — confirmé correct par la qa-review

La qa-review a vérifié elle-même la migration `20260814000200` (owner
n'existe plus comme rôle écrit, aucune colonne `owner_user_id` sur
`tenants`) : l'implémentation « tous les admins » est la seule lecture
fidèle possible, le contrat §8.22 §4 est **périmé** sur ce point précis, pas
le code. Rien changé ici — reste dette **D1**, documentée ci-dessous, à
corriger par l'architecte dans le contrat prose (pas dans le code).

### Tests rejoués après corrections

`pnpm db:local:reset` (95 migrations, 0 erreur) ; le cas SQL de ce lot
rejoué, **10 scénarios (0 à 9)**, 0 erreur ; non-régression rejouée
individuellement sur `gescom-e10-17a-order-files.sql`,
`gescom-e10-19a-order-document-template.sql`,
`gescom-e10-19b-order-documents.sql`, `gescom-e10-20a-order-upload-links.sql`,
`gescom-e10-20b-order-upload-link-deposit.sql` — 0 erreur, aucune régression ;
`pnpm typecheck`/`gen:api:check`/`test:architecture`/`test:contract` verts ;
suite complète **2106 passés / 36 skip / 3 échecs** (mêmes 3 échecs
pré-existants sans rapport, D5 ci-dessous, +8 tests nets vs la remise
initiale). Détail complet en fin de document.

## Écart constaté avec la lettre du contrat, signalé au lieu d'être corrigé en silence

**§8.22 §4 du contrat décrit « tous les `owner`, repli sur `admin` ».**
Vérification faite (pas supposée) sur le schéma réel de la base locale :
depuis `20260814000200_admin_unique.sql` (chantier UM1, antérieur à cette
story), **`owner` n'est plus une valeur écrivable de `tenant_members`** — le
`CHECK` limite désormais `role` à `admin`/`member`/`partner`, et
`user_has_capability()` ne connaît plus que le profil `admin`. Le cadrage
§8.22 cite la migration D'ORIGINE de `tenant_members` (`20260424000100`),
pas son état réel après le chantier UM1.

**Implémenté : « tous les `admin` joignables du tenant »**, sans palier
`owner` (il n'existe plus rien au-dessus). C'est le comportement
fonctionnellement équivalent : `admin` porte aujourd'hui exactement le droit
que `owner` portait dans le cadrage. Documenté à trois endroits pour qu'il ne
soit jamais redécouvert par surprise : commentaire de la fonction SQL
`api_resolve_order_file_purge_recipients`, en-tête du fichier de migration,
en-tête du cas SQL de test. **Chemin de mise en conformité** : l'agent
`architecte` met à jour §8.22 §4 du contrat pour remplacer « owner, repli sur
admin » par « admin » — aucun code n'est à changer, l'implémentation est déjà
correcte au regard de l'état réel de la base.

## Critères d'acceptation transmis, tenus un par un

1. **Schéma de données : deux tables de suivi + deux colonnes de pointeur sur `commercial_order_files`, `purge_at` figée au dépôt.** — **fait.** `commercial_order_file_purge_notices` (un rappel, un palier, une date annoncée, `confirmed_at` = première livraison confirmée) et `commercial_order_file_purge_notice_deliveries` (un message Resend par destinataire, `provider_message_id`, `last_status`). `commercial_order_files` gagne `purge_at` (`not null default now()+30j`), `purge_notice_1_id`/`purge_notice_2_id` (pointeurs), `purged_at` (réservée à E10.22b). Reprise du passif avec **plancher explicite** (horodatage littéral `2026-09-10`, jamais `now()`) — sans effet ici (table vide au déploiement local, `UPDATE 0` vérifié).
2. **Mécanisme de rappel à J+10/J+15, propriétaire résolu à l'émission — corrigé « à la remise » par la lettre du contrat.** — **fait.** Le balayage réclame par seuil de recul depuis `purge_at` (20j/15j, jamais depuis `deposited_at`), groupe par `(tenant, purge_at)`, vérifie qu'au moins un destinataire existe (`api_resolve_order_file_purge_recipients`), crée le rappel, insère `order_files.purge_scheduled` dans `outbox_events` — **dans la même transaction**. Le drain **existant** (`magrit-outbox-dispatcher`, minute par minute) porte l'événement au `PurgeNoticeNotificationConsumer` neuf, qui **résout les destinataires à nouveau, à la remise** (jamais transportés par la charge utile) — c'est ce qui répond sans effort à « le propriétaire change entre les deux rappels ». Second `pg_cron` **quotidien**, **dédié** (`magrit-order-file-purge`, nouvelle Edge Function), déclencheur non planifié dans cette migration (secrets Vault absents en local — bloc SQL différé documenté en pied de fichier, même patron que `20260908000000`). **qa-review round 1 (B1)** : le trigger `updated_at` est désormais désarmé **avant** la reprise du passif dans le fichier de migration (voir section dédiée ci-dessus).
3. **Preuve de livraison via `GET /emails/{id}` avant confirmation.** — **fait.** `ResendEmailDeliveryStatusGateway` relit `last_event` ; seul `"delivered"` confirme (`api_record_order_file_purge_notice_delivery_check`, propage `notices.confirmed_at`, **sauf si le rappel est déjà `failed_at`** — qa-review round 1 N2). Vérifié sur `https://resend.com/openapi.json` le 2026-09-10 (HTTP 200) : **aucune énumération exhaustive de `last_event` n'est publiée** — limite documentée dans le code (adaptateur + migration), pas devinée. `POST /emails` ne rend que `{id}` : remonté explicitement (`providerMessageId`), jamais confondu avec une confirmation.
4. **Reprise après échec (3 jours, rattachement remis à zéro).** — **fait.** `api_expire_order_file_purge_notices(interval)` : un rappel sans aucune livraison confirmée après la fenêtre est marqué `failed_at`, et **le pointeur du fichier est remis à `null`** — le balayage du lendemain en émet un neuf, vers les destinataires du moment. Fenêtre par défaut 3 jours (réserve (h) du contrat, valeur de départ). **qa-review round 1 (N1)** : la relecture de livraison s'exécute désormais **avant** l'expiration dans le même tour, pour lui laisser la chance de confirmer un rappel sur le point d'expirer.
5. **Textes des rappels rédigés, signalés NON VALIDÉS, lien vers les fiches commande (contrat §4).** — **fait, signalé explicitement.** `ResendOrderFilePurgeNoticeEmailSender` porte deux jeux de textes (J+10/J+15), chacun listant un lien par `order_id` de la charge utile (`buildOrderDetailLink`, résolu via le slug du tenant). **qa-review round 1 (B2)** : liens ajoutés (absents de la remise initiale), `MAGRIT_PUBLIC_APP_URL` absente → échec explicite. **qa-review round 1 (réserve de fond)** : le texte J+10 ne promet plus de recours inexistant (« sauf action de votre part » retiré). **⚠️ Rédaction de travail, pas validée par Arnaud** — même réserve que `ResendQuoteSentEmailSender` (E10.10b-4c), écrite en tête du fichier.
6. **Migration Supabase, réversible, testée.** — **fait.** `20260910000500_gescom_e10_22a_purge_notices.sql`. Réversible (bloc de retrait documenté en pied de fichier). Testée **réellement** contre Postgres local (`pnpm db:local:reset` complet + `tests/sql/gescom-e10-22a-order-file-purge-notices.sql`, **10 scénarios (0 à 9)**, **rejoué avec succès** — scénario 0 ajouté en qa-review round 1 pour B1).

## Ce qui est livré

| Élément | Détail |
|---|---|
| **Migration `20260910000500`** | 4 colonnes sur `commercial_order_files` (`purge_at`, `purge_notice_1_id`, `purge_notice_2_id`, `purged_at`) ; trigger `commercial_order_files_set_updated_at` **désarmé** sur les 4 colonnes de purge (ETag jamais périmé par la tâche de fond) **AVANT** la reprise du passif avec plancher (qa-review round 1, B1) ; 2 tables neuves avec trigger « append-only assoupli » (contenu immuable, suivi mutable — même régime qu'`outbox_events`) et RLS (lecture ouverte au tenant, écriture PostgREST directe fermée) ; 6 fonctions `security definer`, `service_role` seul (`api_resolve_order_file_purge_recipients`, `api_claim_order_file_purge_notices`, `api_expire_order_file_purge_notices`, `api_record_order_file_purge_notice_delivery_attempt`, `api_claim_order_file_purge_notice_deliveries_for_check`, `api_record_order_file_purge_notice_delivery_check` — cette dernière ne propage `confirmed_at` que si `failed_at is null`, qa-review round 1 N2). |
| **Module `order-files` (application, étendu)** | `purge-notice-gateway.ts` (ports résolution destinataires + slug tenant + consignation — `getTenantSlug` ajouté en qa-review round 1, B2), `purge-notice-email-sender.ts` (port d'envoi, porte désormais `orderLinks`), `purge-notice-notification-consumer.ts` (consommateur outbox `order_files.purge_scheduled`, `publicAppUrl` + `buildOrderDetailLink` ajoutés en B2), `purge-sweep-repository.ts` (port du balayage), `purge-sweep-service.ts` (orchestrateur, `runOnce()` — relecture AVANT expiration depuis N1), `purge-notice-delivery-status-gateway.ts` (port de relecture Resend). |
| **Adaptateurs** | `src/adapters/supabase/order-file-purge-repository.ts` (deux classes : `SupabaseOrderFilePurgeSweepRepository`, `SupabaseOrderFilePurgeNoticeGateway`, `service_role` uniquement). `src/adapters/resend/order-file-purge-notice-email-sender.ts` (⚠️ textes non validés). `src/adapters/resend/resend-email-delivery-status-gateway.ts`. |
| **Composition** | `src/server/api/order-file-purge-composition.ts` (`createOrderFilePurgeSweepApplication` pour l'Edge Function quotidienne, `createOrderFilePurgeNoticeConsumer` branché dans `outbox-dispatch-composition.ts` sous la clé `order_files.purge_scheduled`). |
| **Edge Function neuve** | `supabase/functions/magrit-order-file-purge/` (`index.ts` + `deno.json`), patron exact de `magrit-outbox-dispatcher` : secret partagé `MAGRIT_ORDER_FILE_PURGE_SECRET` comparé en temps constant, `verify_jwt = false` déclaré dans `supabase/config.toml`. **N'envoie aucun courriel** — écrit `outbox_events`, le drain existant s'en charge. |
| **Contrat lecture** | `OrderFile.purge_at`/`OrderFileDetail.purge_at` servis (optionnel, comme le contrat le prescrit) : `order-files/api/contracts.ts` + `order-files-repository.ts` (colonne ajoutée à `FILE_COLUMNS`, mappée via `toIsoTimestamp`). |
| **Registre d'événements** | `order_files.purge_scheduled` ajouté à `OUTBOX_EVENT_NAMES` (`_shared/api/contracts.ts`) et `OUTBOX_EVENT_VERSIONS` (`_shared/application/outbox.ts`). `order_files.purged` **volontairement pas ajouté** — non émis par ce lot (E10.22b). |

## Décisions de conception notables

- **Groupement `(tenant, purge_at)`, pas `(tenant, jour)`.** Le contrat est explicite : tous les fichiers d'une même émission partagent la même date annoncée. Deux fichiers déposés à des jours différents peuvent croiser le même seuil le même jour (rattrapage après une panne) sans partager le même rappel — implémenté par une CTE `candidates` (verrouillée `for update skip locked`, sans `GROUP BY` — Postgres l'interdit) puis une CTE `groups` qui agrège sur les lignes déjà verrouillées.
- **`api_resolve_order_file_purge_recipients` unique, appelée deux fois.** À la réclamation (existence seule, `exists(...)`) et à la remise (résolution réelle par le consommateur outbox) — une seule règle, jamais deux copies qui pourraient diverger.
- **Unité de livraison différente de `quote.sent`.** Pour `quote.sent`, un échec partiel fait échouer l'événement entier. Ici, **un seul destinataire accepté par Resend suffit** à livrer l'événement (le contrat le dit : « confirmed_at = première livraison confirmée, un destinataire joint suffit »). Zéro acceptation → l'événement est rejoué par le drain, avec le **même** `notice_id` (jamais `event_id`) : aucune seconde ligne de suivi n'est créée au rejeu.
- **Upsert idempotent sur `(notice_id, recipient_email)`, jamais de régression après confirmation.** `api_record_order_file_purge_notice_delivery_attempt` ne réécrit pas une livraison déjà `confirmed_at` — prouvé par le scénario 8 du cas SQL (rejeu après confirmation, `provider_message_id`/`confirmed_at` inchangés).
- **`last_event` : limite documentée, pas devinée.** Resend ne publie aucune énumération exhaustive. Seul `"delivered"` confirme ; tout le reste (y compris `"bounced"`, dont seul le nom de l'événement **webhook** est confirmé par la spec, jamais la valeur exacte de `last_event`) reste **pendant** jusqu'à expiration de la fenêtre de 3 jours — la fenêtre, pas une énumération, est le mécanisme de secours général.
- **Lien vers la fiche commande, jamais vers un fichier (qa-review round 1, B2).** Le slug du tenant est inconnu du consommateur (il ne porte que l'UUID `tenantId`) : `getTenantSlug()` le résout via une lecture directe de `public.tenants`. Aucun registre équivalent à `portalRuntimePaths.ts` n'existe côté workspace (vérifié, pas supposé) : `buildOrderDetailLink()` combine le segment `commercial-orders/:orderId` du registre de surfaces avec un préfixe littéral `/t/:tenantSlug/dashboard`, et un test dédié fige les deux.
- **Ordre des étapes du balayage : relecture de livraison AVANT expiration (qa-review round 1, N1).** Dans le tour où la fenêtre de 3 jours se ferme, une confirmation Resend arrivée entre-temps doit avoir la chance d'être consignée avant que le rappel ne soit marqué en échec pour défaut de confirmation.

## Dette introduite

| Réf. | Point | Chemin de mise en conformité |
|---|---|---|
| **D1** | Écart §4 du contrat (« owner, repli admin ») vs comportement réel implémenté (« admin » seul) — voir section dédiée ci-dessus. | Agent `architecte` : mettre à jour §8.22 §4 de `docs/api/CONVENTIONS.md`. Aucun changement de code nécessaire. |
| **D2** | Heure exacte du balayage quotidien (réserve (c) du contrat) non arbitrée — le déclencheur `pg_cron` n'est **pas planifié** par cette migration (secrets Vault absents en local, bloc SQL différé documenté). | Geste d'exploitation : poser les secrets `magrit_order_file_purge_url`/`magrit_order_file_purge_secret` puis exécuter le bloc `PLANIFICATION DIFFÉRÉE DU DÉCLENCHEUR` en pied de migration. |
| **D3** | Fenêtre de relecture (3 jours) et plafond de tentatives de relecture (20, `p_max_attempts` par défaut de `api_claim_order_file_purge_notice_deliveries_for_check`) sont des valeurs de départ non arbitrées formellement par Arnaud (réserve (h) du contrat, « valeurs de départ raisonnables »). | À confirmer si le comportement observé en production déplaît — réglable sans changement de forme (paramètres de fonction). |
| **D4** | `order_files.purged` ajouté au contrat OpenAPI mais **pas** à `OUTBOX_EVENT_NAMES`/`OUTBOX_EVENT_VERSIONS` (non émis par ce lot). | À ajouter par E10.22b, qui émettra réellement cet événement. |
| **D5 (héritée, sans rapport)** | `tests/storage/product_mockups_isolation.test.ts` échoue (3 tests, « Bucket not found ») — ce test cible un projet Supabase **distant** configuré via `.env.test` (`SUPABASE_URL`/clés), pas l'instance Docker locale sur laquelle ce lot a été développé et testé. Sans rapport avec la purge de fichiers. | Hors périmètre. |
| **D6 (héritée, sans rapport)** | `pnpm typecheck:all` (`tsconfig.json`, **`strict: false`** à la racine — `tsconfig.modular.json` l'étend en `strict: true`) porte 167 erreurs pré-existantes, confirmées par `git stash` + rejeu (149 erreurs sur HEAD propre sans le travail en cours de cette session ; l'écart tient à d'autres fichiers de session, pas de ce lot). Une seule erreur touchait un fichier de ce lot (`purge-notice-notification-consumer.ts`, narrowing d'union discriminée non fiable via `.find()`/indexation sous `strict:false`) — **corrigée** (garde de type explicite `isFailedDelivery`), donc retirée de cette dette. Les erreurs restantes sont toutes dans des fichiers de test (motif `vi.fn().mock.calls[0]?.[1]`, déjà présent avant ce lot) ou dans `OrderFilesBlock.tsx` (UI non touchée par ce lot). | Hors périmètre — `pnpm typecheck` (`tsconfig.modular.json`, alias CI-bloquant, `strict: true`) reste **vert, 0 erreur**. |
| **D7** | Aucun test de composant React : ce lot ne porte **aucune UI** (mécanisme de fond, contrat §8.22 §9 : « aucun endpoint `/api/v1` nouveau »). Conforme au périmètre transmis. | Sans objet. |

## Tests exécutés

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (`tsconfig.modular.json`) | **vert**, 0 erreur |
| `pnpm typecheck:all` (`tsconfig.json`) | Aucune erreur nouvelle imputable à cette story (voir D6, comparé par `git stash`) |
| `pnpm gen:api:check` | **vert**, aligné — `openapi/magrit-core.v1.yaml` non touché |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests |
| `pnpm test:contract` | **vert**, 20 fichiers / 381 tests (aucun test de contrat neuf — aucun endpoint créé/modifié, conforme au contrat §8.22 §9) |
| `pnpm vitest run tests/modules/order-files/purge-notice-notification-consumer.test.ts tests/modules/order-files/purge-sweep-service.test.ts` | **vert**, 18 tests (dont plusieurs nouveaux qa-review round 1 : `publicAppUrl` absent/tenant introuvable/liens de commande/`buildOrderDetailLink`) |
| `pnpm vitest run tests/adapters/resend/order-file-purge-notice-email-sender.test.ts tests/adapters/resend/resend-email-delivery-status-gateway.test.ts` | **vert**, 17 tests (dont plusieurs nouveaux qa-review round 1 : réserve de texte J+10, liens de commande) |
| `pnpm vitest run tests/server/api/order-file-purge-composition.test.ts tests/server/api/outbox-dispatch-composition.test.ts` | **vert**, 11 tests (assertions de lien/slug tenant ajoutées en qa-review round 1) |
| `pnpm vitest run` (suite complète) | **2106 passés / 36 skip / 3 échecs** — les 3 échecs restent `tests/storage/product_mockups_isolation.test.ts`, pré-existants, sans rapport (D5). +8 tests nets vs la remise initiale (2098) |
| `pnpm db:local:reset` (95 migrations) | **0 erreur**, migration `20260910000500` (réordonnée, B1) appliquée proprement de bout en bout, rejouée plusieurs fois pendant le développement et après correction |
| `tests/sql/gescom-e10-22a-order-file-purge-notices.sql` | **RÉELLEMENT exécuté** contre Postgres local (Docker disponible dans cet environnement — pas la limite habituelle). **10 scénarios (0 à 9)** : **0. (qa-review round 1, B1)** trigger `updated_at` désarmé AVANT la forme exacte de l'UPDATE de reprise du passif ; 1. résolution des destinataires (admin seul, email requis) ; 2. réclamation groupée par `(tenant, purge_at)`, trigger `updated_at` désarmé ; 3. idempotence de la réclamation ; 4. indépendance des deux paliers ; 5. privilèges (`service_role` seul sur les 6 fonctions) ; 6. append-only assoupli (contenu immuable, suivi mutable, DELETE refusé tant qu'aucun état terminal) ; 7. RLS lecture/écriture **sur les DEUX tables** (qa-review round 1, N3 : assertions deliveries ajoutées) ; 8. cycle complet de preuve de livraison (accepté → relu → confirmé, upsert idempotent sans régression) ; 9. expiration sans livraison confirmée. **0 erreur.** |
| Non-régression SQL rejouée individuellement | `gescom-e10-17a-order-files.sql`, `gescom-e10-19a-order-document-template.sql`, `gescom-e10-19b-order-documents.sql`, `gescom-e10-20a-order-upload-links.sql`, `gescom-e10-20b-order-upload-link-deposit.sql` — **0 erreur**, aucune régression après le réordonnancement de migration (B1) |
| `pnpm test:storefront:sql` (script complet) | Échoue dès le **premier** cas (`storefront-session-lifecycle.sql`, « Utilisateur Auth requis pour le scénario UM2.6 ») — **confirmé pré-existant**, sans rapport avec ce lot : le cas de ce lot a été vérifié **individuellement**, avec succès, contre la même base fraîchement réinitialisée (voir ligne ci-dessus). |

## Fichiers créés/modifiés

**Créés** :
- `supabase/migrations/20260910000500_gescom_e10_22a_purge_notices.sql`
- `supabase/functions/magrit-order-file-purge/index.ts`
- `supabase/functions/magrit-order-file-purge/deno.json`
- `src/modules/order-files/application/purge-notice-gateway.ts`
- `src/modules/order-files/application/purge-notice-email-sender.ts`
- `src/modules/order-files/application/purge-notice-notification-consumer.ts`
- `src/modules/order-files/application/purge-sweep-repository.ts`
- `src/modules/order-files/application/purge-sweep-service.ts`
- `src/modules/order-files/application/purge-notice-delivery-status-gateway.ts`
- `src/adapters/supabase/order-file-purge-repository.ts`
- `src/adapters/resend/order-file-purge-notice-email-sender.ts` (⚠️ textes non validés par Arnaud)
- `src/adapters/resend/resend-email-delivery-status-gateway.ts`
- `src/server/api/order-file-purge-composition.ts`
- `tests/sql/gescom-e10-22a-order-file-purge-notices.sql`
- `tests/modules/order-files/purge-notice-notification-consumer.test.ts`
- `tests/modules/order-files/purge-sweep-service.test.ts`
- `tests/adapters/resend/order-file-purge-notice-email-sender.test.ts`
- `tests/adapters/resend/resend-email-delivery-status-gateway.test.ts`
- `tests/server/api/order-file-purge-composition.test.ts`

**Modifiés** :
- `src/adapters/supabase/order-files-repository.ts` (`purge_at` ajouté à `FILE_COLUMNS`/`toFileDto`/`toDetailDto`)
- `src/modules/order-files/api/contracts.ts` (`purge_at: timestampSchema.optional()` sur `orderFileSchema`/`orderFileDetailSchema`)
- `src/modules/_shared/api/contracts.ts` (`order_files.purge_scheduled` ajouté à `OUTBOX_EVENT_NAMES`)
- `src/modules/_shared/application/outbox.ts` (`order_files.purge_scheduled` ajouté à `OUTBOX_EVENT_VERSIONS`)
- `src/server/api/outbox-dispatch-composition.ts` (consommateur `order_files.purge_scheduled` branché, mêmes dépendances que `quote.sent`)
- `supabase/config.toml` (`[functions.magrit-order-file-purge]`, `verify_jwt = false`)
- `scripts/test-storefront-sql.sh` (ajout du cas SQL de ce lot)
- `tests/server/api/outbox-dispatch-composition.test.ts` (2 tests neufs : wiring du consommateur E10.22a, assertion de lien ajoutée en round 1)

**qa-review round 1 — aucun fichier NEUF, tous les fichiers ci-dessus (Créés) retouchés** : migration réordonnée (B1) ; `purge-notice-gateway.ts` (`getTenantSlug`, B2) ; `purge-notice-email-sender.ts` (`orderLinks`, B2) ; `purge-notice-notification-consumer.ts` (`publicAppUrl`, `order_ids`, `buildOrderDetailLink`, `isFailedDelivery`, B2 + fix typecheck strict) ; `purge-sweep-service.ts` (ordre relecture/expiration, N1) ; `order-file-purge-repository.ts` (`getTenantSlug`, B2) ; `order-file-purge-notice-email-sender.ts` (texte J+10, liens, réserve de fond) ; `order-file-purge-composition.ts` (`publicAppUrl`, B2) ; `tests/sql/gescom-e10-22a-order-file-purge-notices.sql` (scénario 0 pour B1, assertions deliveries pour N3) ; tests unitaires/composition correspondants.

**Non touchés (rappel R5)** : `openapi/magrit-core.v1.yaml`,
`src/platform/api/generated/magrit-core.v1.ts` — le contrat était déjà écrit
par l'architecte ; le seul écart constaté (D1, « owner » périmé) est une
dette signalée avec chemin de mise en conformité, pas un défaut corrigé sans
mandat.

## Fin de lot

E10.22a + E10.22a-bis livrent le mécanisme d'annonce complet : aucun fichier
n'est détruit, `purge_at` apparaît au contrat, les propriétaires (admin du
tenant) reçoivent leurs deux rappels par courriel avec preuve de livraison
suivie. **E10.22b (purge effective) ne doit pas être entamée avant une revue
`qa-review` distincte de ce lot**, conformément à la règle du dépôt. E10.22c
(objets orphelins) reste également non entamée.
