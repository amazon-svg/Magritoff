---
id: E10.15d-2
epic: E10 — Gestion commerciale
status: ready-for-qa-review
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.15a, E10.15b, E10.15c, E10.15d-1]
blocks: [E10.15e]
---
# E10.15d-2 — Notifications multicanal : `order.files_submitted` et le rendu différé de `{{files.count}}`

Second et dernier lot d'E10.15d (§8.23 §8 : « le regroupement n'a d'effet
observable qu'en (d) »). Cadrage déjà écrit par l'architecte
(`docs/api/CONVENTIONS.md` §8.23 point 11, arbitrage du 2026-09-12 qui lève
la réserve (i)) — ce lot l'implémente à la lettre : le mécanisme de rendu
différé (point 11.1-11.3), sa migration (point 11.4) et son branchement sur
le cinquième et dernier événement notifiable, `order.files_submitted`.

`openapi/magrit-core.v1.yaml` et `docs/api/CONVENTIONS.md` **non modifiés
par cet agent** — le contrat était déjà à jour avant que ce lot ne commence
(`NotificationTag.render_stage`, `NotificationEventDescriptor.
coalescing_window_minutes`, tout posé par l'architecte lors de l'arbitrage
du point 11 puis exploité tel quel par E10.15d-1 pour la métadonnée de
catalogue). Vérifié par `pnpm gen:api:check` avant et après ce lot (aligné
dans les deux cas) et par `git status` (aucun fichier sous `openapi/` ni
`docs/api/` dans le diff de ce lot).

## Ce qui est livré

### 1. Migration SQL additive — `20260912000200_gescom_e10_15d_notification_deferred_render.sql`

Fichier neuf, **ne modifie pas** `20260912000100_gescom_e10_15c_
notification_dispatch.sql` (déjà déployée en production). Contenu exact
prescrit par §8.23 point 11.4 :

1. `alter table notification_logs add column deferred_render jsonb` —
   nullable, interne, jamais exposée par l'API (`notificationLogSchema`
   reste `.strict()` sans ce champ, inchangé).
2. `grant update (subject, body, deferred_render) ... to service_role` — en
   ajout du grant de colonnes existant.
3. `notification_logs_reject_mutation()` — `create or replace`, trois
   ajouts : `subject`/`body` modifiables **ssi** `old.status = 'pending' and
   new.status is distinct from 'pending'` (le scellement) ; `deferred_render`
   modifiable **ssi** non-nul → `null` ; refus explicite de
   `new.status = 'pending' and old.status is distinct from 'pending'` (un
   statut terminal ne redevient jamais `pending`). La tolérance `template_id`
   non-nul → `null` d'E10.15c est **conservée mot pour mot**.
4. Index `notification_logs_grouping_uidx` — `drop` puis `create unique
   index` avec `and attempts = 0` en plus (§8.23 point 11.2 : la fenêtre de
   regroupement se ferme à la réclamation, pas seulement par le temps).
5. `api_enqueue_notification_message` — `drop function` (signature à 13
   arguments) **puis** `create function` (14 arguments,
   `p_deferred_render jsonb default null`) — jamais `create or replace`
   (évite la double-surcharge PostgREST). `revoke`/`grant`/`comment on
   function` refaits avec la nouvelle signature. Corps : la recherche de la
   branche (b) gagne `and attempts = 0`, l'insertion de la branche (c) écrit
   `deferred_render = p_deferred_render`, le filet `exception when
   unique_violation` relit selon la même clé élargie.
6. `api_claim_notification_messages` — **non touchée** (rend `setof
   notification_logs`, la colonne neuve la traverse sans changement de
   signature).
7. `notify pgrst, 'reload schema';` en fin de fichier.

**Appliquée avec succès** sur Supabase local (`pnpm db:local:reset` — 96
migrations rejouées de zéro, dont celle-ci, sans erreur).

**5 scénarios prouvés par l'exécution réelle** (`tests/sql/gescom-e10-15d-2-
notification-deferred-render.sql`, nouveau, additif à celui d'E10.15c) :
(a) le sceau passe sur `pending → sent` et **échoue** sur `sent → sent` (un
message déjà scellé ne peut plus être réécrit une seconde fois) ; (b)
`sent → pending` est refusé (le sceau ne peut jamais être rouvert) ; (c) une
ligne réclamée (`attempts = 1`, simulant la réclamation du drain) n'absorbe
**pas** une occurrence survenue après coup — un second message naît, avec
sa propre fenêtre ; (d) **non-régression explicite** de la tolérance
`template_id` non-nul → `null` d'E10.15c, rejouée après la réécriture du
trigger par cette migration (suppression d'une étape de production portant
un modèle journalisé) ; (e) le regroupement nominal — cinq dépôts en dix
minutes, **un** message, `occurrence_count = 5`, corps resté celui de la
première occurrence.

L'exécution du fichier E10.15c (`gescom-e10-15c-notification-dispatch.sql`)
a été rejouée **après** l'application de cette migration : ses 8 scénarios
passent tous, confirmant qu'aucune régression n'a été introduite sur le
comportement E10.15c.

### 2. Le moteur de rendu à deux sorties — `notification-tag-renderer.ts`

`renderNotificationTagsWithDeferred(text, context, deferred)` — balayage
**unique** (même automate `scanNotificationTagSpans` que `renderNotificationTags`,
aucune divergence possible entre les deux chemins), qui produit :
- un texte **provisoire** (`.text`) : balises `enqueue` déjà substituées,
  balises `deferred` **laissées en clair** ;
- une liste de **segments** (`.segments`, `RenderedSegment[]` :
  `{kind:'literal', text}` | `{kind:'tag', id}`).

`joinDeferredSegments(segments, values)` — **concaténation pure**, aucun
balayage : chaque segment littéral est recopié, chaque segment de balise est
résolu dans `values`. C'est cette absence de second balayage qui garantit la
propriété non négociable du point 11.1 : une occurrence de `{{files.count}}`
venue d'une donnée client se trouve, par construction, à l'intérieur d'un
segment littéral (recopié tel quel) et ne peut donc **jamais** être résolue
par `joinDeferredSegments`. Testé explicitement (`notification-tag-renderer.test.ts`,
nouveau bloc `renderNotificationTagsWithDeferred`/`joinDeferredSegments`, 12
cas dont le cas adversarial « raison sociale contenant littéralement
`{{files.count}}` »).

`DeferredRenderPayload` (forme persistée, `{ subject: RenderedSegment[] |
null; body: RenderedSegment[] }`) exportée depuis ce module — type partagé
entre la mise en file (`EnqueuedNotificationMessage.deferredRender`) et la
remise (`ClaimedNotificationMessage.deferredRender`), jamais dupliqué.

`renderNotificationTags` (chemin `enqueue` historique) **n'est pas
modifiée** — elle reste le chemin de l'aperçu, de l'audience `dropped` et
des douze balises `enqueue`, conformément au cadrage.

### 3. `notification-event-catalog.ts` — `deferredTagsForEvent`

Fonction neuve, source **unique** lue par la mise en file (même discipline
que `coalescingWindowMinutesForEvent`) : sous-ensemble de
`allowedTagsForEvent(eventName)` dont `render_stage === 'delivery'`. Rend un
ensemble vide sur un événement inconnu ou sans balise différée — jamais une
erreur. Aujourd'hui, seule `order.files_submitted` en propose une
(`files.count`). Testé (`notification-event-catalog.test.ts`, 3 cas neufs).

### 4. `NotificationDispatchConsumer` — cinquième événement branché, rendu différé

`src/modules/notifications/application/notification-dispatch-consumer.ts` :

- `HANDLED_EVENT_NAMES` gagne `'order.files_submitted'` ; `consume()` route
  dessus via `consumeOrderFilesSubmitted`.
- `OrderFilesSubmittedDispatchContext` (type neuf) : contexte partagé +
  `orderCustomerReference`, résolu **à la remise** depuis `commercial_orders`
  (même discipline que `order.step_changed`) — jamais depuis la charge
  utile du bus. `files.count` n'y figure **pas** : elle n'est jamais
  résolue à la mise en file.
- `consumeOrderFilesSubmitted` : parse sa propre forme de charge utile
  (`file_id`/`upload_link_id`/`order_id`/`order_number`/`customer_id`,
  celle publiée par `OrderUploadLinksService.confirmFileUpload`), résout le
  contexte, construit `commonContext` avec **`'files.count': '1'`** en
  valeur de repli — utilisée **uniquement** par le chemin non différé
  (entrée `dropped`, ou modèle n'employant pas la balise) : « une entrée
  `dropped` n'est jamais réclamée ni regroupée, son `occurrence_count` vaut
  `1` pour toujours, donc "1" est la valeur exacte » (point 11.1, dernier
  paragraphe). Le chemin différé ignore cette valeur (la balise est
  segmentée, jamais lue dans `context`).
- `enqueueOne` (partagé par les cinq événements) réécrit pour décider,
  **par message**, si le rendu différé s'applique — condition **volontairement
  étroite** (point 11.1) : `input.status === 'pending'` **ET**
  `coalescingWindowMinutes > 0` **ET** au moins une balise différée figure
  dans le sujet **ou** le corps du modèle (pas seulement parce que
  l'événement en propose une au catalogue). Si oui : `renderNotificationTagsWithDeferred`
  appelée sur le corps **et** sur le sujet (si non nul, même segmenté sans
  balise différée — un cas légitime, pas une erreur), `p_deferred_render`
  transmis à l'écriture. Sinon : chemin **strictement** E10.15c/d-1 inchangé,
  `deferredRender: null`.
- `NotificationLogsWriteGateway.enqueue()`/`EnqueuedNotificationMessage`
  gagnent le champ `deferredRender: DeferredRenderPayload | null`.

### 5. `SupabaseNotificationDispatchGateway` — `getOrderFilesSubmittedContext` + `p_deferred_render`

`src/adapters/supabase/notification-dispatch-repository.ts` : méthode
neuve (lecture `commercial_orders.customer_reference` + contexte client
partagé, même requête que les autres événements) ; `enqueue()` transmet
désormais `p_deferred_render: message.deferredRender ?? null` au `rpc`.

### 6. Câblage manquant trouvé et corrigé — `outbox-dispatch-composition.ts`

**Constat fait en cours de lot, non signalé par le mandat** : bien que
`NotificationDispatchConsumer` sache désormais router `order.files_submitted`,
le registre du drain (`OutboxConsumerRegistry`, `src/server/api/outbox-dispatch-composition.ts`)
ne contenait **aucune** entrée pour cet événement — il aurait été « livré
sans traitement par le socle », exactement comme `quote.created`/
`quote.rejected`, et le mécanisme de rendu différé serait resté **inerte en
production** malgré tout le reste du lot correctement écrit. Corrigé :
`'order.files_submitted': new CompositeOutboxConsumer([notificationDispatchConsumer])`
ajouté au registre (sixième entrée), commentaires de tête et de section mis
à jour en conséquence. Vérifié par un test dédié (voir plus bas) qui
observe réellement l'appel `rpc('api_enqueue_notification_message', ...)`
avec `p_deferred_render` renseigné — pas seulement que la route existe.

### 7. `NotificationSender` — le sceau à la remise

`src/modules/notifications/application/notification-sender.ts` :

- `ClaimedNotificationMessage` gagne `occurrenceCount: number` (compteur
  **arrêté à la réclamation**, point 11.2 — jamais relu après coup) et
  `deferredRender: DeferredRenderPayload | null`.
- `NotificationSendSeal` (type neuf, `{ subject: string | null; body:
  string }`) et `resolveFinalRender(message)` (fonction pure, exportée et
  testée isolément) : `deferredRender` nul → `{ subject: message.subject,
  body: message.body, seal: null }` (chemin E10.15c/d-1 **octet pour
  octet**) ; non nul → `joinDeferredSegments` sur corps **et** sujet avec
  `{ 'files.count': String(occurrenceCount) }`, sceau = texte final.
- `NotificationSendRepository.markSent`/`markFailed` gagnent un troisième
  paramètre `seal: NotificationSendSeal | null` — `null` : aucune colonne de
  texte touchée (comportement inchangé) ; non nul : **la même** `UPDATE` qui
  pose le statut terminal écrit aussi `subject`/`body` = texte final et
  `deferred_render = null` (le sceau, une seule écriture SQL, jamais deux).
  `markRetry` **inchangé**, aucun paramètre de sceau : un échec retentable
  ne scelle jamais (le texte provisoire et les segments restent en place,
  la tentative suivante refait le rendu différé avec le compteur d'alors).
- `runOnce()` : `resolveFinalRender` appelé **avant** l'appel au canal — le
  canal (`NotificationChannelAdapter.send()`) reçoit toujours le texte
  **final**, ne sait jamais qu'il a été différé (port inchangé). Le sceau
  est passé à `markSent`/`markFailed` (verdicts terminaux) ; **aucun** sceau
  sur `markRetry`.

### 8. `SupabaseNotificationSendRepository` — mappage + écriture du sceau

`src/adapters/supabase/notification-send-repository.ts` :
- `claim()` mappe `occurrence_count` → `occurrenceCount` et
  `deferred_render` (jsonb brut) → `DeferredRenderPayload | null` via
  `toDeferredRender()`, validation **défensive** de la forme JSON
  (`isRenderedSegmentArray`/`isRenderedSegment`) — une forme inattendue rend
  `null` (chemin sans rendu différé), **jamais une exception**.
- `markSent`/`markFailed` : le patch d'`UPDATE` ne porte `subject`/`body`/
  `deferred_render` **que** si `seal` est non nul — sinon strictement le
  même patch qu'avant ce lot.

### 9. Écran du journal — vérifié SANS modification (point 5 du mandat)

`NotificationLogsPage.tsx` (livré E10.15d-1) affiche déjà `body`/`subject`
tels quels et détecte une balise non substituée par sous-chaîne
(`containsUnsubstitutedTag`, `includes('{{')`), sans jamais tenter de
résoudre quoi que ce soit côté navigateur. Ce comportement est **désormais
observable en conditions réelles** pour la première fois (D3 de la dette
d'E10.15d-1) : une entrée `pending` d'`order.files_submitted` porte
effectivement `{{files.count}}` en clair dans `body`, et l'écran l'affiche
tel quel avec la mention `deferredBodyNotice`. **Aucune modification** de ce
fichier n'a été nécessaire — vérifié par lecture et par le fait qu'aucun
test existant ne le concerne.

## Tests exécutés

- `pnpm gen:api:check` : **aligné**, aucune dérive. Confirme qu'aucun
  fichier `openapi/`/`docs/api/CONVENTIONS.md` n'a été touché par cet agent.
- `pnpm typecheck` (`typecheck:modular`) : **0 erreur**.
- `pnpm test:architecture` : **146/146** (34 fichiers), inchangé.
- `pnpm test:contract` : **412/412** (22 fichiers), inchangé (ce lot n'ajoute
  ni ne modifie aucune route).
- `pnpm test:storefront:sql` (Docker disponible, `pnpm db:local:reset`
  exécuté avec succès — 96 migrations rejouées) :
  - `tests/sql/gescom-e10-15d-2-notification-deferred-render.sql` (nouveau) :
    **5/5 scénarios OK** (a-e ci-dessus).
  - `tests/sql/gescom-e10-15c-notification-dispatch.sql` (existant, **rejoué
    après** cette migration) : **8/8 scénarios OK**, aucune régression.
  - La suite **complète** (`./scripts/test-storefront-sql.sh`) n'a **pas**
    pu être exécutée de bout en bout après un `db reset` à froid : le
    premier fichier de la liste (`storefront-session-lifecycle.sql`)
    suppose un `auth.users` déjà peuplé par un usage antérieur de
    l'environnement local (aucune insertion dans `supabase/seed.sql`), et un
    second fichier plus loin (`legacy-shop-only-write-freeze.sql`) échoue
    sur une contrainte `tenant_members_role_admin_check` sans rapport avec
    ce lot. **Aucun des deux échecs ne mentionne `notification`** et aucun
    des deux fichiers n'a été modifié par ce lot — vérifié en exécutant
    chaque fichier `gescom-e10-15c*`/`gescom-e10-15d-2*` **individuellement**
    contre le conteneur (résultats ci-dessus), ce qui est la preuve
    pertinente pour ce lot.
- `pnpm vitest run tests/modules/notifications` : **124/124** (5 fichiers) —
  `notification-dispatch-consumer.test.ts` (30 tests, dont 8 nouveaux sur
  `order.files_submitted` : charge utile invalide, aucun modèle actif,
  contexte introuvable défensif, rendu différé avec segments vérifiés,
  modèle n'employant pas la balise → aucun rendu différé, entrée `dropped`
  → `files.count` rend "1", plusieurs destinataires → segments indépendants,
  canal SMS sans sujet), `notification-sender.test.ts` (15 tests, dont 7
  nouveaux sur `resolveFinalRender` et le sceau appliqué au verdict
  terminal), `notification-tag-renderer.test.ts` (28 tests, dont 12
  nouveaux sur `renderNotificationTagsWithDeferred`/`joinDeferredSegments`),
  `notification-event-catalog.test.ts` (13 tests, dont 3 nouveaux sur
  `deferredTagsForEvent`), `notification-templates-ui-helpers.test.ts`
  (38 tests, inchangé).
- `pnpm vitest run tests/server/api/outbox-dispatch-composition.test.ts` :
  **9/9** (8 existants + 1 nouveau qui verrouille le câblage manquant §6
  ci-dessus : `order.files_submitted` met en file via `rpc
  api_enqueue_notification_message` **avec** `p_deferred_render` renseigné,
  et n'envoie **aucun** courriel — le consommateur reste sans appel réseau).
- `pnpm vitest run tests/adapters/supabase/notification-send-repository.test.ts`
  (nouveau) : **8/8** — mappage `occurrence_count`/`deferred_render` (cas
  valide, `null`, et deux cas de forme malformée → défensif), et le sceau
  `markSent`/`markFailed` avec/sans `seal`.
- `npx vitest run --maxWorkers=2` (suite complète) : **2288 passés / 36
  skip**, **3 échecs pré-existants et sans rapport**
  (`tests/storage/product_mockups_isolation.test.ts` — `StorageApiError:
  Bucket not found`, bucket Storage local absent de l'environnement, déjà
  signalé identique dans le rapport E10.15d-1, aucune mention de
  `notification`).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **D1 — nouvelle, mineure** | `SupabaseNotificationDispatchGateway.getOrderFilesSubmittedContext` n'a pas de test adaptateur dédié (même situation qu'E10.15c/d-1 pour les méthodes analogues) — couvert indirectement par le test de composition `outbox-dispatch-composition.test.ts` (E10.15d-2). | Cohérent avec le précédent établi par E10.15c/d-1 ; si un test adaptateur dédié devient la norme, à généraliser à toutes les méthodes de ce gateway en un seul lot. |
| **D2 — héritée, non aggravée** | `send-order-notification` (Edge Function pré-E10) reste un doublon fonctionnel potentiel, non traité par ce lot (signalé §8.23 §9(f), déjà noté par E10.15d-1). | Arbitrage déjà demandé à Arnaud par le contrat ; aucune action de ce lot. |
| **D3 — close par ce lot** | La branche « balise `{{files.count}}` non substituée » de l'écran du journal, signalée non observable par E10.15d-1 (D3 de son rapport), est **désormais exercée en conditions réelles** dès qu'un modèle `order.files_submitted` est configuré. | Fermée — aucune action supplémentaire. |
| **D4 — nouvelle, mineure** | La suite complète `pnpm test:storefront:sql` ne peut pas être rejouée de bout en bout immédiatement après un `db reset` à froid (dépendance implicite d'un fichier antérieur à un `auth.users` pré-peuplé, et un défaut sans rapport dans `legacy-shop-only-write-freeze.sql`) — contournée en exécutant les fichiers `gescom-e10-15c`/`gescom-e10-15d-2` individuellement. | Hors périmètre de ce lot (aucun des deux fichiers fautifs n'appartient au module notifications) ; à signaler séparément si la CI rencontre le même ordre d'exécution à froid. |

## Critères d'acceptation (mandat de ce lot, tenus un par un)

1. **Migration SQL neuve, additive, ne modifie pas `20260912000100`** —
   **fait**. `20260912000200_gescom_e10_15d_notification_deferred_render.sql`,
   les 7 points du point 11.4 réalisés à la lettre (colonne, grant, trigger,
   index, `drop`+`create function`, `api_claim_notification_messages` non
   touchée, `notify pgrst`). Appliquée avec succès en local
   (`pnpm db:local:reset`). 5 scénarios prouvés par l'exécution réelle +
   non-régression du fichier SQL E10.15c rejoué après.
2. **Le moteur de rendu produit deux sorties, jamais un texte re-balayé** —
   **fait**. `renderNotificationTagsWithDeferred`/`joinDeferredSegments`,
   12 tests dédiés dont le cas adversarial (donnée client contenant
   littéralement `{{files.count}}`).
3. **`NotificationDispatchConsumer` route `order.files_submitted`, résout
   le contexte, utilise le moteur à deux sorties, passe
   `p_deferred_render`, isolation multi-tenant respectée** — **fait**.
   `consumeOrderFilesSubmitted` + `OrderFilesSubmittedDispatchContext` +
   `getOrderFilesSubmittedContext` (même discipline d'isolation tenant que
   les quatre méthodes existantes : filtre `.eq('tenant_id', tenantId)`
   explicite). **Câblage du registre du drain trouvé manquant et corrigé**
   (point 6 ci-dessus, hors mandat explicite mais nécessaire à ce que le
   mécanisme soit autre chose qu'inerte).
4. **`NotificationSender` reconstitue le texte final au compteur arrêté à
   la réclamation, l'envoie au canal, et l'écrit dans la même transition
   d'état que le verdict terminal ; comportement des 4 autres événements
   inchangé** — **fait**. `resolveFinalRender`, `NotificationSendSeal`,
   `markSent`/`markFailed` à 3 arguments (`seal` nul = chemin E10.15c/d-1
   octet pour octet, prouvé par test), `markRetry` inchangé (aucun sceau).
5. **Écran du journal vérifié sans régression, modifié seulement si un test
   le prouve nécessaire** — **fait, aucune modification nécessaire**.
   `NotificationLogsPage.tsx` non touché ; son comportement générique
   (affichage tel quel + détection par sous-chaîne) couvre déjà le cas
   `order.files_submitted` désormais réel.
6. **Contrat non touché ; `deferred_render` absente de tout DTO exposé** —
   **fait**. `openapi/` et `docs/api/CONVENTIONS.md` non modifiés par cet
   agent (vérifié `git status` + `pnpm gen:api:check` avant/après).
   `notificationLogSchema` reste `.strict()` sans `deferred_render` —
   vérifié par lecture, aucun test de contrat n'échoue.

## Dérogations R5

Aucune.

## Fichiers créés

- `supabase/migrations/20260912000200_gescom_e10_15d_notification_deferred_render.sql`
- `tests/sql/gescom-e10-15d-2-notification-deferred-render.sql`
- `tests/adapters/supabase/notification-send-repository.test.ts`

## Fichiers modifiés

- `src/modules/notifications/application/notification-tag-renderer.ts`
- `src/modules/notifications/application/notification-event-catalog.ts`
- `src/modules/notifications/application/notification-dispatch-consumer.ts`
- `src/modules/notifications/application/notification-sender.ts`
- `src/adapters/supabase/notification-dispatch-repository.ts`
- `src/adapters/supabase/notification-send-repository.ts`
- `src/server/api/outbox-dispatch-composition.ts`
- `scripts/test-storefront-sql.sh` (ajout de la ligne du nouveau fichier SQL)
- `tests/modules/notifications/notification-dispatch-consumer.test.ts`
- `tests/modules/notifications/notification-sender.test.ts`
- `tests/modules/notifications/notification-tag-renderer.test.ts`
- `tests/modules/notifications/notification-event-catalog.test.ts`
- `tests/server/api/outbox-dispatch-composition.test.ts`

Aucun fichier `openapi/` ni `docs/api/CONVENTIONS.md` modifié par cet agent.
