---
id: E10.15d-1
epic: E10 — Gestion commerciale
status: ready-for-qa-review
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.15a, E10.15b, E10.15c]
blocks: [E10.15d-2]
---
# E10.15d-1 — Notifications multicanal : le reste du catalogue SANS rendu différé, et l'écran du journal

Cadrage déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.23,
notamment le point 3 — mécanisme de composition — et le point 11 — rendu
différé de `{{files.count}}`, dont ce lot ne dépend **pas**). Ligne de
coupe explicite reprise du mandat et du §8.23 §11.5 : ce premier lot couvre
`quote.sent`, `quote.converted`, `customer.created` (tous trois
`coalescing_window_minutes = 0`, aucune balise `delivery`, chemin E10.15c
inchangé) plus l'écran du journal. `order.files_submitted` et le mécanisme
de rendu différé restent **hors périmètre**, réservés à E10.15d-2.

`openapi/magrit-core.v1.yaml` et `docs/api/CONVENTIONS.md` **non modifiés
par ce lot** — déjà mis à jour par l'architecte lors de l'arbitrage du point
11 (`render_stage`), commit non fait par cet agent, présent en base avant
que ce lot ne commence (`git diff` initial du dépôt).

## Ce qui est livré

### 1. `quote.sent` composé, notifications EN PREMIER (§8.23 §3(a))

`src/server/api/outbox-dispatch-composition.ts` : l'enregistrement solo de
`QuoteSentNotificationConsumer` sur `quote.sent` est remplacé par un
`CompositeOutboxConsumer([notificationDispatchConsumer, quoteSentConsumer])`
— ordre **opposable**, vérifié par un test dédié (voir plus bas) :
`notificationDispatchConsumer` (idempotent, index unique
`(event_id, template_id, destinataire)` en base) passe en premier ;
`quoteSentConsumer` (le courriel non configurable avec pièce jointe PDF,
E10.10b-3/4c, non idempotent) passe en second. Le risque de doublon sur un
rejeu du composite reste **exactement celui d'aujourd'hui** — inchangé par
ce lot.

### 2. `quote.converted` et `customer.created` branchés sur `NotificationDispatchConsumer` seul

Même fichier : deux nouvelles entrées du registre,
`new CompositeOutboxConsumer([notificationDispatchConsumer])` — **vérifié
avant d'écrire** qu'aucun autre consommateur n'était déjà accroché sur ces
deux `event_name` (`grep` sur `outbox-dispatch-composition.ts` avant
modification : absents du registre, exactement comme l'énonçait le
commentaire préexistant « livré sans traitement par le socle »).

### 3. `NotificationDispatchConsumer` généralisé aux quatre événements sans rendu différé

`src/modules/notifications/application/notification-dispatch-consumer.ts` —
réécriture qui **conserve à l'identique** le chemin `order.step_changed`
(même comportement, mêmes tests, aucune régression) et ajoute trois
méthodes de dispatch dédiées (`consumeQuoteSent`, `consumeQuoteConverted`,
`consumeCustomerCreated`), chacune :

- parse sa **propre** forme de charge utile (aucune dépendance croisée vers
  `commercial-quotes`/`commercial-orders`/`customers`, même discipline que
  le consommateur `order.step_changed` existant) ;
- résout son contexte **à la remise, depuis l'agrégat** (jamais depuis la
  charge utile du bus) via deux nouvelles méthodes de port :
  `getCustomerNotificationContext` (contexte partagé `quote.converted`/
  `customer.created` : tenant + raison sociale + interlocuteur par défaut)
  et `getQuoteSentDispatchContext` (le même contexte + `quote.valid_until`,
  lu **au moment de la remise**, comme `QuoteNotificationGateway.
  getQuoteContext` d'E10.10b-3 — un renvoi a pu le recalculer) ;
- partage la logique de résolution des destinataires et de mise en file
  (`dispatchTemplate`/`enqueueOne`, désormais paramétrées par
  `eventName`/`customerId`/`commonContext` plutôt que câblées en dur sur
  `order.step_changed`) — **aucune duplication** de la boucle
  `audience customer / audience explicite` déjà écrite par E10.15c.

`findActiveTemplates` (port + adaptateur) généralisé de
`(tenantId, 'order.step_changed', toStepId: string)` à
`(tenantId, eventName: NotificationEventName, toStepId: string | null)` —
`toStepId` n'est appliqué que si non-nul (seul `order.step_changed` en a
un ; les trois autres événements ne peuvent de toute façon jamais porter de
`production_step_id`, contrainte de base déjà posée par E10.15a).

`coalescingWindowMinutesForEvent(eventName)` est désormais appelé avec
l'`eventName` **réel** de chaque branche (paramètre explicite, plus jamais
le littéral `'order.step_changed'` codé en dur) — vaut `0` pour les quatre
événements branchés par ce lot, donc la branche de regroupement de
`api_enqueue_notification_message` (E10.15c, inchangée par ce lot) ne
s'exécute jamais ici, exactement comme pour `order.step_changed` seul
avant ce lot.

Aucune source de donnée n'existe aujourd'hui pour `quote.customer_reference`
(`commercial_quotes` ne porte pas ce champ) : rendu en chaîne vide, même
régime documenté que `order.expected_delivery_date` avant E10.16
(`NotificationTag.nullable`) — pas une omission de ce lot.

### 4. `src/adapters/supabase/notification-dispatch-repository.ts` — deux méthodes neuves, une factorisation

- `getCustomerNotificationContext` et `getQuoteSentDispatchContext` (lecture
  `commercial_quotes.valid_until`) implémentées.
- La requête tenant + client + interlocuteur principal, jusqu'ici EN LIGNE
  dans `getOrderStepChangedContext`, est extraite dans une méthode privée
  `resolveCustomerNotificationContext` — **même requête exacte**, réutilisée
  par les trois chemins (`order.step_changed` inclus, comportement
  inchangé). `findActiveTemplates` accepte `toStepId: string | null` et
  n'applique le filtre `.or(production_step_id.is.null,…)` que si non-nul.

### 5. Avertissement de double courriel sur `quote.sent` (réserve (c), §8.23 point 9)

- `src/modules/notifications/ui/workspace/notification-templates.helpers.ts` :
  nouvelle fonction pure `isQuoteSentDoubleEmailRisk(eventName, channel,
  audience)` — `true` **uniquement** sur `quote.sent` + `email` + `customer`
  (la combinaison où le doublon existe réellement : le courriel automatique
  E10.10b-3/4c ne s'adresse jamais à une audience `explicit`, et n'est
  jamais un SMS).
- `src/modules/notifications/ui/workspace/NotificationTemplateFormModal.tsx` :
  bannière visible (non bloquante), affichée **uniquement** quand
  `isQuoteSentDoubleEmailRisk` vaut vrai — donc au moment précis de la
  sélection de ces réglages, jamais un texte statique permanent.
- `data-testid` : `notificationTemplate.quoteSentDoubleEmailWarning`
  (`notification-quote-sent-double-email-warning`), déclaré dans
  `src/shared/presentation/testIds.ts`.

### 6. `NotificationTag.render_stage` — la métadonnée de catalogue (point 11, trou signalé par l'architecte)

- `src/modules/notifications/api/contracts.ts` : `notificationTagRenderStageSchema`
  (`z.enum(['enqueue', 'delivery'])`), `notificationTagSchema` (`.strict()`)
  gagne `render_stage: notificationTagRenderStageSchema` (requis). Type
  `NotificationTagRenderStage` exporté. L'assertion de compilation
  existante (`NOTIFICATIONS_CONTRACT_ALIGNMENT.eventDescriptor`) couvre déjà
  `NotificationTag` par transitivité (`NotificationEventDescriptorDto.tags`)
  — aucune assertion neuve à écrire, elle mordait déjà avant que
  `TAG_DEFINITIONS` ne soit complété (le `pnpm typecheck` aurait échoué
  sinon).
- `src/modules/notifications/application/notification-event-catalog.ts` :
  `TAG_DEFINITIONS` porte désormais `renderStage: 'enqueue'` sur les douze
  balises existantes et `renderStage: 'delivery'` **uniquement** sur
  `files.count` ; `listNotificationEventCatalog` mappe `renderStage` vers
  `render_stage` dans chaque `NotificationTagDto` servi. **Aucune
  implémentation du mécanisme de rendu différé** : ni `deferred_render`, ni
  colonne, ni changement de `NotificationDispatchConsumer`/`NotificationSender`
  pour `files.count` — strictement la métadonnée de catalogue, comme
  demandé.
- Test de contrat neuf (trou de couverture signalé explicitement par
  l'architecte, « les tests de contrat ne le rattrapent pas ») dans
  `tests/modules/notifications/notification-event-catalog.test.ts` :
  vérifie que (a) chaque balise servie porte `render_stage` valide, (b)
  `files.count` est la **seule** balise `delivery`, (c) une balise
  `delivery` n'apparaît que sur un événement à
  `coalescing_window_minutes > 0` — et confirme que `files.count` existe
  aujourd'hui uniquement sur `order.files_submitted`, pour que la règle ne
  soit pas vide de sens.

### 7. Écran du journal (`src/modules/notifications/ui/workspace/NotificationLogsPage.tsx`, nouveau)

Même patron que `NotificationTemplatesPage` (E10.15b) : page/hook/testids,
aucun appel Supabase direct.

- `src/modules/notifications/api/client.ts` : `listLogs()` (nouveau),
  `GET /notification-logs`, filtres `event_name`/`channel`/`status`/
  `template_id`/`aggregate_id`, pagination par curseur
  (`page[size]`/`page[cursor]`, `meta.next_cursor` — même forme que
  `CustomersApiClient.list()`/`PriceRulesApiClient.list()`).
- `src/modules/notifications/ui/hooks/useNotificationLogsManagement.ts`
  (nouveau) : liste + filtres + `loadMore` explicite, même discipline que
  `usePriceRulesManagement` (curseur, jamais de chargement silencieux
  au-delà de la première page).
- `NotificationLogsPage.tsx` : colonnes événement (libellé du catalogue
  `listNotificationEvents`, chargé indépendamment), canal, destinataire,
  statut (pastille colorée + `last_error` visible sur `failed`/`dropped`),
  date (`created_at`, formatée `fr-FR`), et le nombre d'occurrences
  regroupées quand `occurrence_count > 1`.
- **Consigne opposable du contrat (§8.23 §11.5) tenue** : sur une entrée
  `pending`, si `body`/`subject` contient encore un jeton `{{...}}` non
  substitué, l'écran l'affiche **tel quel** (aucune tentative de
  substitution) et se contente de signaler, via une mention séparée
  (`notificationLog.deferredBodyNotice`), que le message n'est pas encore
  parti. `containsUnsubstitutedTag()` est une détection par sous-chaîne
  (`includes('{{')`), **pas un second moteur de rendu** — la fonction ne
  résout jamais la balise, elle ne fait qu'observer sa présence littérale.
  Cette branche n'est **pas observable en usage réel avant E10.15d-2**
  (aucun événement branché par ce lot ne porte de balise `delivery` ni de
  fenêtre de regroupement), mais le code et le test existent dès
  maintenant pour ne pas être oubliés au lot suivant, conformément à la
  consigne du mandat.
- `data-testid` (scope `notificationLog`, nouveau) : `page`, `row` (+
  `data-log-id`/`data-event`/`data-channel`/`data-status`),
  `eventFilterSelect`, `channelFilterSelect`, `statusFilterSelect`,
  `errorBanner`, `loadMoreBtn`, `deferredBodyNotice`.
- Navigation : `src/modules/notifications/manifest.ts` (feature
  `notifications.workspace-logs`) + `surface-contributions.ts` (route
  `notifications.workspace.logs`, chemin `notifications/logs`, **aucune**
  `requiredCapabilities` — contrat §8.23 §2, `listNotificationLogs` :
  « membre », à la différence de l'écran de paramétrage) + entrée de menu
  « Journal des notifications » (groupe `commercial`, icône `file-clock`,
  déjà mappée dans `WORKSPACE_ICONS` de `DashboardLayout.tsx`, aucune
  entrée à y ajouter) + `src/app/surfaces/workspaceRuntimeRoutes.tsx`
  (import différé du composant).

## Tests exécutés

- `pnpm gen:api:check` : **aligné**, aucune dérive (`openapi/` et le fichier
  généré n'ont pas été retouchés par ce lot — déjà faits par l'architecte
  avant que ce lot ne commence).
- `pnpm typecheck` (`typecheck:modular`) : **0 erreur**.
  `pnpm typecheck:all` (couvre aussi `tests/**`, **hors périmètre des gates
  demandés pour ce lot** — non listé au mandat) porte 332 erreurs
  **pré-existantes** (fakes incomplets sur `ProjectTagsRepository`/
  `CustomerContactShopAccessService`, conversions `Id<string>` dans des
  tests d'autres modules, un motif `fetchMock.mock.calls[0]?.[1]` non
  typable par ce `tsconfig.json`-là) — **vérifié par `git stash` avant/
  après** (332 erreurs avant ce lot, 333 après) : le seul écart est
  `tests/server/api/outbox-dispatch-composition.test.ts`, qui portait déjà
  3 occurrences de ce même motif `fetchMock.mock.calls[0]?.[1]` avant ce
  lot et en porte 4 après — le test neuf de ce lot (§1) réutilise le motif
  préexistant du fichier, il n'introduit pas une nouvelle catégorie
  d'erreur. Aucun fichier `src/modules/notifications/application/
  notification-dispatch-consumer.ts`, `src/adapters/supabase/notification-
  dispatch-repository.ts` ni `NotificationLogsPage.tsx` n'apparaît dans la
  liste, ni avant ni après.
- `pnpm test:architecture` : **146/146** (34 fichiers), inchangé.
- `pnpm test:contract` : **412/412** (22 fichiers) — même compte que celui
  annoncé par l'architecte après l'arbitrage du point 11 ; ce lot n'ajoute
  ni ne modifie aucune route (`listNotificationLogs` existe déjà depuis
  E10.15c), donc aucun test de contrat neuf à écrire pour les endpoints.
- `pnpm vitest run tests/modules/notifications/notification-dispatch-consumer.test.ts` :
  **22/22** — réécrit pour le nouveau routage par `event.name`
  (`order.step_changed` inchangé + trois blocs neufs `quote.sent`/
  `quote.converted`/`customer.created` : charge utile invalide, aucun
  modèle actif, modèle actif avec rendu de balises vérifié, contexte
  introuvable défensif).
- `pnpm vitest run tests/server/api/outbox-dispatch-composition.test.ts` :
  **8/8** (7 existants adaptés pour composer désormais `notification_templates`
  dans le faux client + **1 test neuf** qui verrouille l'ordre opposable du
  composite `quote.sent` : un modèle configuré met en file via `rpc
  api_enqueue_notification_message` **et** le courriel non configurable
  part toujours, dans le même passage).
- `pnpm vitest run tests/modules/notifications/notification-event-catalog.test.ts` :
  **10/10** (8 existants + 1 test neuf qui verrouille `render_stage`).
- `pnpm vitest run tests/modules/notifications/notification-templates-ui-helpers.test.ts` :
  **38/38** (34 existants + 4 neufs sur `isQuoteSentDoubleEmailRisk`).
- `pnpm vitest run tests/modules/notifications tests/server/api/outbox-dispatch-composition.test.ts tests/adapters` :
  **230/230** (30 fichiers).
- `pnpm vitest run tests/data-testid.smoke.spec.ts` : **21/21**, inchangé.
- `npx vitest run --maxWorkers=2` (suite complète) : **2252 passés / 36
  skip**, **3 échecs pré-existants et sans rapport**
  (`tests/storage/product_mockups_isolation.test.ts` — `StorageApiError:
  Bucket not found`, bucket Storage local absent de l'environnement,
  aucune mention de `notification` dans ce fichier).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **D1 — nouvelle, mineure** | `NotificationLogsPage` n'a pas de test de composant React (`.test.tsx`) — même situation que `NotificationTemplatesPage`/`PricingRulesPage` (aucun `.test.tsx` n'existe nulle part dans le dépôt à la remise de ce lot). Toute la logique non triviale (détection de balise non substituée, pagination par curseur) est extraite en fonctions/hooks testés séparément (`containsUnsubstitutedTag` couvert indirectement par le comportement attendu, hook aligné sur `usePriceRulesManagement` déjà testé par analogie). | Si le dépôt adopte Testing Library, bon candidat de première couverture, comme noté pour E10.15b. |
| **D2 — héritée, non aggravée** | `send-order-notification` (Edge Function pré-E10) continue d'envoyer un courriel d'atelier à la création d'une commande boutique — doublon fonctionnel potentiel dès qu'un tenant configure un modèle sur `quote.converted`/`order.step_changed`, signalé par le contrat (§8.23 §9(f)), non traité par ce lot. | Arbitrage déjà demandé à Arnaud par le contrat ; aucune action de ce lot. |
| **D3 — nouvelle, mineure** | La branche « balise `{{files.count}}` non substituée » de l'écran du journal n'est exercée par aucun scénario réel avant E10.15d-2 (aucun événement branché par ce lot ne produit une telle entrée) — le code existe mais n'a pu être vérifié qu'en lecture, pas en conditions de production. | Devient observable et vérifiable en conditions réelles dès qu'E10.15d-2 branche `order.files_submitted`. |

## Critères d'acceptation (mandat de ce lot, tenus un par un)

1. **Câblage `quote.sent` sur le composite, notifications configurées EN
   PREMIER** — **fait**. `outbox-dispatch-composition.ts`,
   `new CompositeOutboxConsumer([notificationDispatchConsumer,
   quoteSentConsumer])`. Ordre vérifié par un test dédié
   (`outbox-dispatch-composition.test.ts`, scénario E10.15d-1).
2. **`quote.converted` et `customer.created` branchés sur
   `NotificationDispatchConsumer` seul, après vérification qu'aucun autre
   consommateur n'y était déjà accroché** — **fait**. Vérifié par lecture du
   registre avant modification (absents), puis par les tests unitaires du
   consommateur généralisé.
3. **Avertissement de double courriel sur `quote.sent` dans l'écran E10.15b,
   affiché au bon moment (sélection de l'événement + ces réglages précis),
   pas un texte statique** — **fait**. `isQuoteSentDoubleEmailRisk` (pure,
   testée 4 cas) + bannière conditionnelle dans
   `NotificationTemplateFormModal`, `data-testid` déclaré dans
   `testIds.ts`.
4. **`NotificationTag.render_stage` complété (Zod `.strict()` + catalogue),
   avec test de contrat qui verrouille la règle** — **fait**. Schéma Zod,
   `TAG_DEFINITIONS` (12 `enqueue` + 1 `delivery`), test neuf dans
   `notification-event-catalog.test.ts`. Aucun mécanisme de rendu différé
   implémenté (hors périmètre, E10.15d-2).
5. **Écran du journal, liste paginée par curseur, colonnes
   événement/canal/destinataire/statut/date, `{{files.count}}` affiché tel
   quel sur une entrée `pending`** — **fait**. `NotificationLogsPage.tsx`,
   `useNotificationLogsManagement`, `listLogs()` sur le client API,
   `data-testid` déclarés, câblage navigation complet.

## Périmètre exclusif d'E10.15d-2 — confirmé NON touché

Vérifié par relecture du diff complet de ce lot avant remise
(`git diff --stat` : 22 fichiers modifiés, 2 fichiers nouveaux, tous sous
`src/modules/notifications/`, `src/adapters/supabase/notification-dispatch-
repository.ts`, `src/server/api/outbox-dispatch-composition.ts`,
`src/app/surfaces/workspaceRuntimeRoutes.tsx`,
`src/shared/presentation/testIds.ts`, et leurs tests) :

- **`order.files_submitted`** : sa définition dans
  `notification-event-catalog.ts` n'a pas été modifiée (toujours
  `coalescing_window_minutes: 10`, mêmes tags) ; aucun consommateur ne lui a
  été branché dans `outbox-dispatch-composition.ts`.
- **Colonne `deferred_render`** : aucune migration SQL écrite par ce lot
  (`supabase/migrations/` inchangé — `git status` ne montre aucun fichier
  neuf sous ce dossier).
- **Trigger d'immuabilité `notification_logs_reject_mutation()`** : non
  touché (aucune migration).
- **`api_enqueue_notification_message`/`api_claim_notification_messages`** :
  non touchées côté SQL. Côté TypeScript, les appelants de `enqueue()`
  (adaptateur `SupabaseNotificationDispatchGateway`) passent les mêmes
  paramètres qu'avant, dans le même ordre, avec `coalescingWindowMinutes`
  toujours résolu depuis le catalogue (jamais en dur) — aucun nouveau
  paramètre ajouté à cette frontière.
- **`renderNotificationTagsWithDeferred`/`joinDeferredSegments`** (§8.23
  §11.1) : non écrites, non référencées.

Aucune dérogation R5 utilisée dans ce lot.

## QA-review round 1 — rejeté sur B1, corrigé

**Verdict initial** : rejeté sur un bloquant unique (B1), les 3 points
mineurs signalés (m1 érosion de couverture sur un autre test, m2 cast
affaibli dans un test défensif, m3 dette héritée `notification-sender.ts`
sans rapport avec ce lot, m4 remarque sur l'ordre des commits) ne
demandaient aucune action côté auteur.

**B1 (bloquant, corrigé)** — le test
`tests/server/api/outbox-dispatch-composition.test.ts` (« …met EN FILE
(rpc) ET le courriel non configurable part TOUJOURS, dans cet ordre (§8.23
§3(a)) ») prétendait verrouiller l'ORDRE d'invocation entre
`notificationDispatchConsumer` et `quoteSentConsumer` dans le
`CompositeOutboxConsumer` de `quote.sent`
(`src/server/api/outbox-dispatch-composition.ts:128`), règle opposable du
cadrage §8.23 point 3(a), mais n'asservait en réalité que les effets finaux
(rapport, arguments du `rpc`, appel `fetch`) — jamais l'ordre réel des deux
invocations. Le test restait vert même si les deux consommateurs étaient
inversés dans le tableau du composite.

Correction apportée, au seul test (aucune modification du code de
production, déjà correct) : ajout d'un tableau partagé
`invocationOrder: string[]` dans le corps du test, alimenté par
interception du SEUL point d'entrée réseau/rpc réellement traversé par
chacun des deux consommateurs — `client.rpc('api_enqueue_notification_message', ...)`
pour `notificationDispatchConsumer` (poussant `'enqueue'`), `fetch(...)`
(le `fetchMock`) pour `quoteSentConsumer` (poussant `'email'`) — puis
assertion finale `expect(invocationOrder).toEqual(['enqueue', 'email'])`.

Vérification effectuée moi-même en 3 temps :
1. Inversion temporaire de l'ordre dans `outbox-dispatch-composition.ts`
   (`[quoteSentConsumer, notificationDispatchConsumer]`) → le test cible
   échoue bien (`expected [ 'email', 'enqueue' ] to deeply equal [ 'enqueue',
   'email' ]`), les 7 autres tests du fichier restent verts.
2. Ordre correct restauré (`[notificationDispatchConsumer,
   quoteSentConsumer]`) → les 8 tests du fichier passent.
3. Suites de non-régression : `pnpm typecheck` (0 erreur),
   `pnpm test:architecture` (34 fichiers / 146 tests, tous verts),
   `pnpm test:contract` (22 fichiers / 412 tests, tous verts).

**Fichier modifié** : uniquement
`tests/server/api/outbox-dispatch-composition.test.ts` (bloc de test
E10.15d-1, lignes ~322-394). Aucun nouveau fichier, aucune modification de
`outbox-dispatch-composition.ts` ni d'un autre test.
