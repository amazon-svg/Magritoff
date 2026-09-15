---
id: E10.18e-2
epic: E10 — Gestion commerciale
status: qa-review-round3-approved-sous-reserve-recette-navigateur
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.18a, E10.18c, E10.18e-1]
blocks: []
---
# E10.18e-2 — Export comptable depuis la grille « Commandes atelier »

## qa-review round 3 (2026-09-15) — APPROUVÉ sous réserve de la recette navigateur ; deux cas de survie mutationnelle ajoutés (F1c : 401 durable, arrêt en 1 appel ; F2 : 500 puis `ready` en 2 appels), aucun code de production changé, gates (`tests/modules/commercial-orders`, `tests/modules/order-exports`, `pnpm typecheck`) verts.

## qa-review round 2 (2026-09-15) — REJETÉ (1 bloquant, 1 moyen, 2 mineurs), CORRIGÉ

Rapport complet et sondes de la qa-review dans le scratchpad du coordinateur
(`mutate_e2r2.py`, `mutations_e2r2.log`, `qa_e2r2_probe.test.ts`). La sonde
R1 (idempotence, mutations rejouées du round 1) est repassée verte sans
modification — c est la sonde R2 (`404 durable`) qui a fait tomber le point
bloquant ci-dessous.

### BLOQUANT M1 — le suivi corrigé au round 1 ne s arrête PLUS JAMAIS, et `onError` ne fait rien

**Le défaut.** Le correctif du round 1 (« un échec transitoire ne fige plus
le suivi ») avait supprimé TOUTE condition d arrêt sur échec : `tick()`
rappelait `scheduleNext()` après n importe quelle erreur, y compris un 404
ou un 403 PERMANENTS (route disparue, droit retiré). Sonde qa-review R2,
rejouée : un `GET` rejetant en 404 sur toute la durée du test a produit
**84 appels en 10 minutes**, sans jamais s arrêter. Aggravant : `onError`
dans `OrderExportPanel.tsx` (lignes 150-153) était un corps VIDE — même un
403 authentique (droit retiré en cours de route) laissait la ligne affichée
« En cours » **indéfiniment**, sans aucun signal.

**Corrigé — trois volets, tous dans `order-export.helpers.ts`.**

1. **Arrêt DÉFINITIF sur 401/403/404.** `isOrderExportPollingFatal(cause)`
   (nouvelle fonction pure, `cause instanceof ApiClientError &&
   [401,403,404].includes(cause.problem.status)`, même patron que
   `isMissingStorefrontSession`/`useStorefrontSession.ts`) est vérifiée dans
   la branche d échec de `tick()`, APRÈS que `onError` a déjà été notifié
   (le message reste `cause.message`, donc `ApiClientError.message` —
   `problem.detail ?? problem.title` — jamais de JSON brut, garantie déjà
   en place avant ce correctif). Si fatal : `stopped = true`, aucun
   `scheduleNext()`. Sinon (réseau, 5xx, tout le reste) : comportement du
   round 1 INCHANGÉ, reprise à la même cadence.
2. **Borne de durée totale, `ORDER_EXPORT_POLL_MAX_DURATION_MS = 10 *
   60_000`.** Motif écrit en commentaire au point de déclaration :
   `magrit-order-export-runner` est déclenché par un `pg_cron` **à la
   minute** (`* * * * *`, migration `20260913000000_gescom_e10_18c_
   order_exports.sql`, même cadence que `magrit-outbox-dispatch`/`magrit-
   notification-send`) — un export qui n a pas atteint un état terminal
   après DIX cycles de runner signale une anomalie (file bloquée, incident
   du runner) que reprendre indéfiniment, même à basse fréquence, ne résout
   pas et masque à l utilisateur. La vérification vit au SEUL point qui
   programme un sondage de plus (`scheduleNext()`), donc couvre aussi bien
   le chemin de succès (statut non terminal persistant) que le chemin
   d échec réseau/5xx. À l échéance : `onError(message dédié, "10
   minutes")`, arrêt, et **aucun** sondage de plus.
3. **`onError` du panneau fait enfin quelque chose.** Avant : commentaire
   « rien de plus à faire ici ». Après : `OrderExportPanel.tsx` porte un
   nouvel état `pollErrorsById` (même famille que `downloadErrorsById`
   existant) — le dernier message de suivi reçu pour une demande s affiche
   sous son statut, et s efface au sondage RÉUSSI suivant (un échec
   transitoire s efface donc de lui-même ; un arrêt définitif — fatal ou
   échéance — reste affiché puisqu aucun succès ne viendra plus l effacer).

**Mutations et tests, tous rejoués RÉELLEMENT contre le code d avant ce
correctif (édition manuelle du bloc `scheduleNext`/`tick`, restauration
vérifiée par diff) — les quatre tombent en ROUGE, confirmés avant d écrire
le correctif :**

| Cas | Résultat sur le code D AVANT ce correctif |
|---|---|
| `un GET rejetant en 404 donne exactement UN appel puis un onError, et le suivi s ARRETE` | ROUGE — 84 appels au lieu de 1, sonde R2 reproduite à l identique |
| `idem en 403` | ROUGE — même défaut |
| `un 503 (transitoire) suivi de ready ABOUTIT` | VERT (déjà couvert par le comportement round 1, non régressé) |
| `l ECHEANCE de duree (10 min) arrete le suivi... et le SIGNALE` | ROUGE — `onError` jamais appelé pour ce motif, aucune borne n existait |

Les quatre sont VERTS sur le code corrigé (`tests/modules/commercial-orders/
order-export.helpers.test.ts`, describe « BLOQUANT M1 (qa-review round 2,
2026-09-15) »). Voir « Gates rejouées après corrections round 2 » plus bas
pour la preuve d exécution complète (RED avant, GREEN après, sur les DEUX
fichiers touchés par ce round).

### MOYEN M2 — URL de téléchargement signée SANS forcer le téléchargement

**Le défaut.** `SupabaseOrderExportsRepository.toDto()`
(`src/adapters/supabase/order-exports-repository.ts:157`) signait l URL avec
`createSignedUrl(row.storage_path, DOWNLOAD_URL_TTL_SECONDS)` — **sans**
troisième argument — alors que `SupabaseOrderFilesRepository.toDetailDto()`
(`order-files-repository.ts:345`) pose déjà `{ download: row.filename }`
pour le même besoin. L ancre détachée de `triggerBrowserDownload()`
(`OrderExportPanel.tsx`, correctif M2 du round 1) pointe vers l **origine du
bucket Supabase Storage**, distincte de celle de l application : l attribut
`download` d une ancre HTML n est honoré par le navigateur sur une URL
**cross-origin** que si la réponse porte déjà `Content-Disposition:
attachment` — précisément ce que l option `download` de `createSignedUrl()`
ajoute côté serveur. Sans elle, un CSV/XLSX servi en `inline` aurait fait
**naviguer l onglet** vers l URL signée au lieu de déclencher un
téléchargement — l exact contournement que l ancre détachée avait pour
mandat d empêcher (round 1, décision 8 du story doc).

**Vérifié avant de corriger** (mandat explicite : « si l OpenAPI ou §8.24
fixent autre chose sur `download_url`, STOP ») : ni le schéma `OrderExport`
(`openapi/magrit-core.v1.yaml`, propriété `download_url`) ni §8.24 point 7
(« le lien vit 300 s... ») ne décrivent l option de signature — ils décrivent
le comportement OBSERVABLE (URL signée de courte durée), pas l implémentation.
`file_name` (même schéma) est en revanche décrit comme « Nom **proposé au
téléchargement**, formé par le serveur » — cohérent avec l intention de ce
correctif, pas contradictoire avec elle. **Aucune contradiction trouvée**,
correctif appliqué sans remonter à l architecte.

**Corrigé.** `createSignedUrl(row.storage_path, DOWNLOAD_URL_TTL_SECONDS, {
download: row.file_name as string })` — même modèle exact qu
`order-files-repository.ts`. `row.file_name` est TOUJOURS non nul quand la
branche s exécute (`isOwnerReady` exige déjà `status === 'ready'` et
`typeof row.storage_path === 'string'`) : `markReady()` pose `storage_path`
ET `file_name` dans la MÊME écriture SQL (`order-exports-repository.ts`,
méthode `markReady`), jamais l un sans l autre.

**Test, nouveau fichier `tests/adapters/supabase/order-exports-repository.test.ts`**
(ce repository n avait AUCUN test dédié avant ce round) :
- rejoué RÉELLEMENT contre le code D AVANT ce correctif (`createSignedUrl`
  sans troisième argument, restauré après vérification) : **ROUGE** —
  `expected undefined to deeply equal { download: '...' }` ;
- **VERT** sur le code corrigé : `createSignedUrlCalls[0].options` vaut
  exactement `{ download: FILE_NAME }` ;
- second cas (non muté, couverture positive) : un appelant qui n est PAS le
  demandeur ne déclenche AUCUN appel à `createSignedUrl` (`download_url`
  reste `null`) — non régressé par ce correctif.

**Redéploiement requis : OUI.** Ce fichier est un adaptateur SERVEUR
(`src/adapters/supabase/order-exports-repository.ts`), consommé par
`src/server/api/order-exports-routes.ts` puis par
`supabase/functions/magrit-api/index.ts` — la correction ne prend effet en
production/staging qu après un redéploiement de l Edge Function
**`magrit-api`**. Aucune migration SQL n est requise (aucun schéma de base
touché), et aucun autre Edge Function (`magrit-order-export-runner`,
`magrit-order-export-purge`) n est concerné par ce fichier.

### MINEUR — littéral `50` dupliqué dans `OrderExportPanel.tsx`

**Corrigé.** Nouvelle constante exportée `ORDER_EXPORT_REGISTRY_PAGE_SIZE =
50` (`order-export.helpers.ts`) — remplace le littéral de `api.list({
pageSize: 50 })` (ligne 118) ET celui du texte du signal `hasMore` (ligne
277, désormais interpolé : `` Registre limité aux ${ORDER_EXPORT_REGISTRY_
PAGE_SIZE} demandes... ``). Même famille de correctif que le mineur
« registre limité à 50 » du round 1 : une seule source, jamais deux
littéraux qui pourraient diverger sans qu aucun test ne le remarque.

### MINEUR — génération de la clé d idempotence figée à la durée de vie de la modale (fermeture pendant l envoi)

**Analysé, retenu comme DETTE CONNUE — pas corrigé dans ce round.** Le cas
signalé : la modale envoie une demande, l utilisateur la ferme AVANT la
réponse (le `<OrderExportDialog>` est démonté — montage conditionnel par le
panneau, `{dialogOpen && <OrderExportDialog .../>}`), puis la RÉOUVRE et
soumet une seconde fois avant que la première réponse ne soit arrivée.

**Pourquoi ce n est PAS un simple déplacement de la génération de clé.** Le
verrou qui empêche un double envoi (`inFlight`, `createOrderExportSubmit
Controller()`) vit dans la FERMETURE du contrôleur, lui-même créé par
`useRef` **à l intérieur** d `OrderExportDialog` (décision 3 du round 0) :
fermer la modale démonte le composant, donc détruit le contrôleur ET son
`inFlight`, quelle que soit la provenance de la clé. Déplacer SEULEMENT la
génération de la clé vers le panneau (qui survit, lui, à l ouverture/
fermeture) ne rétablirait PAS la garde de double-clic pour ce scénario
précis : il faudrait déplacer le CONTRÔLEUR ENTIER (ou au moins un
équivalent d `inFlight`) au niveau du panneau, ce qui change la forme du
composant au-delà d un « déplacement simple » — exactement le type de
changement structurel que le mandat demande de NE PAS trancher seul quand
il dépasse la portée d un correctif borné.

**Risque réel, borné.** Si la clé n est PAS déplacée (état actuel), la
réouverture génère une clé NEUVE (`opened` régénère toujours) : la seconde
soumission part avec une clé **différente** de la première, donc **crée
réellement un second export** si la première réponse arrive après coup —
un doublon métier (deux lignes dans le registre), pas une erreur 409. C est
borné par construction : chaque export coûte un clic conscient et se
retrouve, visible et attribuable, dans le registre TENANT-LARGE (aucune
donnée n est perdue ni corrompue), et le scénario exige une fermeture puis
une réouverture délibérées pendant la fenêtre (généralement sub-seconde)
d un aller-retour réseau.

**Chemin de mise en conformité, si retenu prioritaire :** lever le
contrôleur ET son verrou `inFlight` au niveau d`OrderExportPanel.tsx`
(passé en prop à `OrderExportDialog`, comme le panneau le fait déjà pour
`filters`/`selectedCustomerLabel`/`stepCatalog`), pour qu il survive à un
cycle fermeture/réouverture de la modale. Ajouté à la table de dette
ci-dessous.

### Gates rejouées après corrections round 2

- **RED confirmé avant correctif** (édition manuelle, restauration
  vérifiée) : les 3 tests du BLOQUANT M1 et le test du MOYEN M2 échouent
  tous sur le code D AVANT ce round — voir le détail dans chaque section.
- `pnpm typecheck` : **0 erreur**.
- `pnpm exec vitest run tests/modules/commercial-orders tests/modules/order-exports tests/surfaces tests/platform/api tests/adapters/supabase/order-exports-repository.test.ts` :
  **17 fichiers, 325 cas, tous verts** (+6 par rapport aux 319 de la remise
  round 1 : 4 nouveaux cas dans `order-export.helpers.test.ts` (M1), 2
  nouveaux cas dans le fichier de test NOUVEAU `order-exports-repository.test.ts` (M2)).
- `pnpm test:contract` : **23 fichiers, 432/432**, inchangé — aucune route
  ni aucun contrat touché par ce round.
- `pnpm test:architecture` : **35 fichiers, 153/153**, inchangé.
- `pnpm gen:api:check` : **aligné**, aucune dérive — confirme qu aucun
  fichier `openapi/` n a été touché par ce round.
- `pnpm test` (suite complète) : **273 fichiers passés, 2618 cas passés, 36
  ignorés, 1 fichier en échec — `tests/storage/product_mockups_
  isolation.test.ts` (3 cas), échec PRÉEXISTANT et SANS RAPPORT** (bucket
  `product_mockups` absent de l environnement local — inchangé depuis les
  remises round 0 et round 1).

### Fichiers modifiés en round 2

- `src/modules/commercial-orders/ui/components/order-export.helpers.ts` —
  `isOrderExportPollingFatal()` (nouvelle fonction pure), arrêt définitif du
  suivi sur 401/403/404 dans `startOrderExportPolling`, borne de durée
  `ORDER_EXPORT_POLL_MAX_DURATION_MS`/`resolveOrderExportPollingTimeoutMessage()`,
  constante `ORDER_EXPORT_REGISTRY_PAGE_SIZE` (mineur littéral `50`).
- `src/modules/commercial-orders/ui/components/OrderExportPanel.tsx` —
  `pollErrorsById` (nouvel état, affiché sous le statut de chaque ligne),
  câblage réel du deuxième argument (`onError`) de `startOrderExportPolling`
  (avant : corps vide), `ORDER_EXPORT_REGISTRY_PAGE_SIZE` importée et
  utilisée aux deux points qui portaient le littéral `50`.
- `src/adapters/supabase/order-exports-repository.ts` — `createSignedUrl`
  signé avec `{ download: row.file_name }` dans `toDto()` (MOYEN M2).
- `tests/modules/commercial-orders/order-export.helpers.test.ts` — +4 cas
  (describe « BLOQUANT M1 (qa-review round 2, 2026-09-15) »).
- `tests/adapters/supabase/order-exports-repository.test.ts` — **NOUVEAU
  FICHIER**, 2 cas (MOYEN M2) ; ce repository n avait aucun test avant ce
  round.

Aucun fichier `openapi/`, `docs/api/CONVENTIONS.md` ni aucune migration
`supabase/migrations/` modifié par cet agent dans ce round. Aucun commit
créé (mandat explicite). `CLAUDE.md`, `SPRINT_HANDOFF.md`,
`docs/project-context.md` : apparaissaient déjà modifiés dans `git status`
AVANT que cet agent ne commence (travail concurrent d un autre agent, même
constat qu au round 1) — non touchés par cet agent.

### Dette introduite ou héritée — mise à jour round 2

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **Nouvelle, mineure, round 2** | Fermer la modale d export PENDANT un envoi puis la RÉOUVRIR avant la réponse peut créer un second export (clé neuve à chaque `opened`, verrou `inFlight` détruit avec le composant démonté) — voir section dédiée ci-dessus pour l analyse complète et pourquoi ce n est pas un simple déplacement de constante. | Lever `createOrderExportSubmitController()` (contrôleur ET verrou `inFlight`) au niveau d`OrderExportPanel.tsx`, passé en prop à `OrderExportDialog` comme les autres données déjà partagées (`filters`, `selectedCustomerLabel`, `stepCatalog`) — pas un simple changement de l endroit où la clé est générée. **Solution alternative, PLUS SIMPLE, proposée par la qa-review round 3 (2026-09-15), NON IMPLÉMENTÉE** : empêcher la FERMETURE de la modale tant qu un envoi est `submitting` (griser/retirer la croix et le clic sur l overlay pendant `disabled`, même garde que les deux `fieldset`) — élimine le scénario à la racine (le composant ne se démonte plus pendant l envoi) sans avoir à lever le contrôleur au niveau du panneau. Les deux chemins restent ouverts pour un futur correctif ; celui-ci n a pas été retenu par cet agent car il change un comportement UX visible (le bouton fermer devient inopérant) et n a pas été arbitré. |
| *(héritées du round 1, inchangées)* | Voir la table « Dette introduite ou héritée » du round 1 plus bas — aucune de ses lignes n est concernée par ce round. | — |

---

## qa-review round 1 (2026-09-15) — REJETÉ (2 bloquants, 3 moyens, 4 mineurs), CORRIGÉ

Journal et sondes de la qa-review dans le scratchpad du coordinateur
(`mutate_e2.py`, `mutations_e2.log`, `qa_e2_probe.test.ts`). Chaque point
ci-dessous est traité séparément : le défaut, le correctif, la mutation qui
le met en défaut et le test qui tombe.

### BLOQUANT B1 — même clé d'idempotence pour un corps différent

**Le défaut.** `orderExportDialogReducer` acceptait `formatChanged`/
`granularityChanged` après un `submitFailed` **sans jamais renouveler la
clé**. L'empreinte serveur couvre le corps (`gescom-middleware.ts:366-371`) :
après une coupure survenue une fois la demande créée, changer le format
puis réessayer rejouait la MÊME clé sur un corps DIFFÉRENT → 409
`api.idempotency_key_reused` à chaque tentative, modale bloquée. Sonde
qa-review Q1, rejouée avant correction : `calls[0].key === calls[1].key`
avec des corps différents — reproduite telle quelle.

**Corrigé.** `formatChanged`/`granularityChanged` portent désormais un
`freshIdempotencyKey` (fourni par l'appelant, jamais généré dans le
réducteur — même discipline que `opened`/`submitSucceeded`). Le réducteur
**décide seul** de l'utiliser : uniquement si `state.status === 'error'`
(un envoi a déjà été tenté avec la clé courante, donc le prochain corps
sera différent) ; sinon la clé courante est conservée. Un réessai à
l'identique (aucun `formatChanged`/`granularityChanged` entre-temps)
continue de réutiliser la même clé — c'est le comportement voulu par le
contrat (« réutilisée si l'envoi est rejoué »).

**Mutations et tests.**

| Mutation | Test qui tombe |
|---|---|
| `formatChanged` renouvelle TOUJOURS la clé (même hors échec) | « hors echec (modale a peine ouverte)... GARDENT la cle courante » |
| `formatChanged`/`granularityChanged` NE renouvellent JAMAIS (même après échec) | « APRES un echec, changer le FORMAT renouvelle la cle... » / « ...la GRANULARITE renouvelle aussi la cle » |

Les deux mutations ont été **rejouées réellement** contre le code corrigé
(édition, exécution de la suite, restauration vérifiée par hash SHA-256) :
les deux tombent bien en rouge. Un troisième cas ferme l'autre moitié de la
sonde Q1 : « un REESSAI A L IDENTIQUE... GARDE la meme cle ».

### BLOQUANT B2 — le panneau n'est pas une coquille

**Le défaut.** `OrderExportPanel.tsx` écrivait à la main les libellés des
trois cas `download_url: null` (« Demandé par un autre membre », « Expiré »,
« — ») dans le JSX (mutation D04, permutation des deux premiers,
survivante), et un ternaire local pour la granularité qui ignorait
`ORDER_EXPORT_GRANULARITY_OPTIONS` — deux sources pour la même information
(mutation D05, survivante).

**Corrigé.** Deux fonctions pures nouvelles dans `order-export.helpers.ts` :
- `describeOrderExportDownload(item)` → `{ kind, label, downloadable }`,
  table `ORDER_EXPORT_DOWNLOAD_LABELS` unique (un cas par
  `OrderExportDownloadState['kind']`) — **sans URL** (voir M2 ci-dessous) ;
- `describeOrderExportRow(item)` → combine format/granularité (lus depuis
  `ORDER_EXPORT_FORMAT_OPTIONS`/`ORDER_EXPORT_GRANULARITY_OPTIONS`, **les
  mêmes tableaux que la modale**), `requestedByLabel`, `status` et
  `download` dans un seul descripteur.

Le JSX du panneau ne garde plus qu'**une seule branche générique** pour le
téléchargement (`row.download.downloadable ? <button>… : <span>…`) et lit
`row.formatLabel`/`row.granularityLabel` au lieu d'un ternaire local.

**Mutations et tests.**

| Mutation | Test qui tombe |
|---|---|
| D04 — permuter les libellés `expired`/`not_requester` dans `ORDER_EXPORT_DOWNLOAD_LABELS` | `describeOrderExportDownload` — table `it.each`, cas `expired`/`not_requester` |
| D05 — lire `item.format` au lieu de `item.granularity` dans `describeOrderExportRow` (même bug, translaté depuis le JSX vers la fonction pure) | « le libelle de granularite vient de ORDER_EXPORT_GRANULARITY_OPTIONS... » |

Les deux ont été **rejouées réellement** (mutation D04 via le harnais de
vérification ; mutation D05 via une édition manuelle ciblée, voir
« Mutations rejouées » plus bas) : les deux tombent en rouge.

**Ce qui reste, structurellement, hors de portée d'un test** (ce dépôt n'a
aucun outil de rendu React) : la boucle de rendu elle-même (le JSX lit-il
vraiment `row.download.downloadable`, ou une copie figée) — même limite que
R04/R04b d'E10.18e-1. Signalé, pas caché.

### MOYEN M1 — le suivi se fige sur un échec transitoire

**Le défaut.** Un `GET /{id}` en échec (réseau coupé un instant) arrêtait
la boucle de sondage : `onError` était appelé une fois puis plus rien —
l'export restait affiché « En cours » indéfiniment, `pollersRef` gardait
l'id mais aucun poller actif ne le portait plus. Sonde Q3 : un seul appel
`get()` en 120 s, `updates` vide — reproduite telle quelle avant correction.

**Corrigé.** La branche d'échec de `tick()` appelle désormais
`scheduleNext()` (même cadence que le cas normal — 2 s, puis 10 s au-delà
d'une minute écoulée) au lieu de s'arrêter. `onError` continue d'être
notifié à **chaque** échec (le panneau peut signaler un suivi dégradé),
mais le sondage ne s'interrompt plus tout seul. Arbitrage assumé et écrit :
un échec **permanent** reprendrait indéfiniment à la cadence d'espacement
(bornée, basse fréquence) plutôt que de s'arrêter en silence — l'autre
option proposée par la qa-review (« retrait de `pollersRef` avec affichage
`suivi interrompu` ») a été écartée parce qu'elle aurait, dans le cas
nominal (coupure d'une seconde), abandonné le suivi d'un export qui allait
réussir juste après.

**Mutations et tests.**

| Mutation | Test qui tombe |
|---|---|
| Retirer `scheduleNext()` de la branche d'échec | « un GET qui echoue UNE FOIS puis reussit aboutit a `ready`... » (rejouée réellement, RED confirmé) |

Trois tests dédiés : reprise après un échec unique (sonde Q3, aboutit à
`ready`), notification `onError` à chaque échec même si le suivi reprend,
cadence inchangée après un échec (2 s, pas de réessai immédiat).

### MOYEN M2 — lien périmé conservé (URL signée exposée dans le DOM)

**Le défaut.** Le lien de téléchargement était un `<a href={url}>` portant
l'URL signée déjà connue (potentiellement périmée de plusieurs minutes) —
un clic milieu, « ouvrir dans un nouvel onglet » ou un copier-coller de
lien contournaient le rafraîchissement au clic (mutation L02, retrait de
`preventDefault()`, survivante ; L01, lecture de `item.download_url` en
cache au lieu de `refreshOrderExportDownloadUrl()`, survivante).

**Corrigé — deux niveaux.** *(1)* `describeOrderExportDownload()` ne rend
plus **jamais** l'URL — seul un booléen `downloadable` en sort
(`OrderExportDownloadDisplay` n'a pas de champ `url`). C'est une
impossibilité **structurelle**, pas une discipline de composant à
respecter : rien de ce que cette fonction rend ne peut devenir un `href`.
*(2)* Le contrôle visible est un `<button>`, jamais un `<a>` : aucune URL
n'est donc jamais posée dans le DOM avant le clic. `handleDownloadClick()`
ne reçoit que l'`exportId` (jamais l'objet `item` du registre), pour
rendre plus difficile un futur retour accidentel à `item.download_url` en
cache. Au clic, `refreshOrderExportDownloadUrl()` relit l'export
(`GET .../{id}`, URL fraîche de 300 s) puis `triggerBrowserDownload()`
déclenche le téléchargement.

**Choix technique retenu pour déclencher le téléchargement, et pourquoi**
(demande explicite de la qa-review) : une **ancre détachée** (`document.
createElement('a')`, `download=''`, `click()` synthétique, puis retrait
immédiate du DOM) plutôt que :
- `window.open(url, '_blank')` — **écarté**, c'est exactement le piège
  signalé par la qa-review : un appel après un `await` n'est plus
  rattaché, du point de vue du navigateur, au geste utilisateur, et peut
  être bloqué comme une fenêtre popup non sollicitée ;
- `window.location.assign(url)` — **écarté** : ferait **quitter
  l'application** (navigation de l'onglet courant) si l'objet Storage
  signé ne porte pas `Content-Disposition: attachment` — un réglage produit
  par `createSignedUrl()` côté E10.18c/d, hors périmètre de cette story, et
  qu'elle ne peut pas garantir.

L'ancre détachée ne quitte jamais la page, n'ouvre aucune fenêtre, et n'est
**jamais** exposée à un clic droit/milieu puisqu'elle n'existe que le temps
d'un appel synchrone. Limite assumée, non vérifiable par ce lot : le
comportement réel de l'attribut `download` sur une URL **cross-origin**
dépend du navigateur et peut être ignoré par certains — dans ce cas, le
clic se comporte comme une navigation vers l'URL signée, sans quitter
visuellement la page si le serveur répond avec un type de contenu non
affichable inline (XLSX) ; à confirmer en recette navigateur.

**Mutations.** L01/L02 ciblaient un code JSX qui n'existe plus (l'ancien
`<a href>` avec `preventDefault()`) — la correction retire la SURFACE du
bug plutôt que d'ajouter une garde qu'on pourrait retirer par erreur. Le
comportement de `refreshOrderExportDownloadUrl()` lui-même (ne jamais
rendre une URL en cache) reste couvert par un test dédié (L03/L04, voir
ci-dessous).

**Mutation L03/L04 — la fonction pure sous-jacente.**

| Mutation | Test qui tombe |
|---|---|
| `refreshOrderExportDownloadUrl` recopie `item.download_url` brut au lieu de passer par `resolveOrderExportDownloadState` | « ignore un download_url RESIDUEL quand le statut n est pas ready... » (nouveau) |

### MOYEN M3 — preuves manquantes dans le code pur

- **S02/S03 (stop() pendant un GET en vol).** Nouveau test :
  deux sondages programmés, le second est laissé délibérément EN VOL
  (promesse contrôlée à la main) au moment de `stop()` ; sa résolution
  tardive ne déclenche ni `onUpdate` ni nouveau sondage. Mutations
  rejouées réellement : retirer `stopped = true` dans `stop()` (S02) et
  retirer la garde `if (stopped) return;` avant `onUpdate` (S03) — les
  deux font tomber ce test.
- **C02 (chemin `/{id}` de `get()`).** Nouveau test : capture l'URL réelle
  et vérifie `pathname.endsWith('/commercial-order-exports/{id}')` **et**
  `search === ''` — une régression vers `?id=` (mutation C02 de la qa)
  tombe.
- **C03 (`request()` pourrait partir en GET).** Nouveau test : capture
  `init.method` et vérifie `'POST'` explicitement.
- **V02 (clé de droit mal orthographiée).** `CAN_EXPORT_ORDERS` déplacée
  d'une constante locale à `OrderExportPanel.tsx` vers une constante
  **exportée** d'`order-export.helpers.ts`, fixée par un test dédié
  (`expect(CAN_EXPORT_ORDERS).toBe('can_export_orders')`).

### MINEUR Q2 — `listLoaded` effaçait une demande créée localement

**Le défaut.** Si un export était créé (`exportCreated`) avant qu'une
lecture du registre partie plus tôt ne réponde, `listLoaded`
**remplaçait** entièrement `state.items` — la ligne fraîchement créée
disparaissait, et son poller (qui lisait `state.items` pour décider quoi
suivre) n'était plus jamais relancé. Sonde qa-review Q2, reproduite avant
correction : `s2.items` valait `['ancien']`, la demande `'neuf'` avait
disparu.

**Corrigé.** `listLoaded` **fusionne** désormais (`mergeOrderExportItems`,
nouvelle fonction pure et testée séparément) : le serveur fait foi pour
tout id qu'il connaît déjà (statut, `download_url`... rafraîchis), mais un
id présent localement et absent de la réponse est **conservé**. Le
résultat est retrié par `requested_at` décroissant. **La sonde Q2, rejouée
littéralement telle qu'écrite par la qa-review, échoue maintenant** —
c'est attendu : son assertion (`['ancien']`) encodait le comportement
BUGUÉ ; le comportement corrigé et désiré (`['neuf', 'ancien']`) est
couvert par les tests dédiés du fichier de tests.

### MINEUR Q4 — clé vide envoyée si `submit()` est appelé avant `opened`

**Le défaut.** Rien n'empêchait `createOrderExportSubmitController.submit()`
d'envoyer une `Idempotency-Key` **vide** si, par un chemin d'appel
anormal, la modale n'avait pas encore reçu `opened`. Sonde qa-review Q4,
reproduite avant correction : `api.request.mock.calls[0][1] === ''`.

**Corrigé.** `submit()` refuse désormais l'envoi si `!state.idempotencyKey`
(même famille de garde défensive que `inFlight`) — aucun appel réseau
n'est émis, `dispatch` n'est pas sollicité. **La sonde Q4, rejouée
littéralement, échoue maintenant** (`calls[0]` n'existe plus) — c'est
attendu, pour la même raison que Q2 : elle encodait le défaut.

### MINEUR — testid `panel` déclaré mais jamais posé

Corrigé : `data-testid={T.panel}` posé sur la racine de `OrderExportPanel`.

### MINEUR — registre limité à 50 sans signal

**Choix retenu : un signal explicite, pas un « Charger plus ».** Un champ
`hasMore` (dérivé de `page.nextCursor !== null` à la lecture) est ajouté à
`OrderExportRegistryState` ; le panneau affiche, quand il vaut vrai :
« Registre limité aux 50 demandes les plus récentes — les demandes plus
anciennes ne sont pas listées. ». Motif du choix : le volume attendu
d'exports par tenant est structurellement petit (ce n'est pas la grille
des commandes), et un signal textuel évite d'ajouter une seconde
pagination par curseur pour un cas qui ne s'est jamais présenté — si la
qa-review ou la recette constate un tenant qui dépasse régulièrement 50
exports actifs, le patron `buildLoadMoreRequest`/curseur d'`orders-list.
helpers.ts` est directement réutilisable.

### Mutations rejouées — vérification indépendante (harnais dédié)

Onze mutations ciblant directement le code corrigé ont été **rejouées
réellement** (édition du fichier source à l'emplacement exact, exécution
de la suite concernée, restauration vérifiée par comparaison SHA-256) via
un harnais dédié (`verify_fixes.py`, scratchpad du coordinateur) :

| Mutation | Résultat |
|---|---|
| B1 — `formatChanged` renouvelle toujours la clé | TUÉE |
| B1 — `formatChanged`/`granularityChanged` ne renouvellent jamais | TUÉE |
| Q4 — garde de clé vide retirée | TUÉE |
| M1 — `scheduleNext()` retiré de la branche d'échec | TUÉE |
| Q2 — `listLoaded` remplace au lieu de fusionner | TUÉE |
| D04 — libellés `expired`/`not_requester` permutés | TUÉE |
| V02 — `CAN_EXPORT_ORDERS` mal orthographiée | TUÉE |
| S02 — `stop()` ne pose pas `stopped` | TUÉE |
| S03 — réponse après `stop()` appliquée quand même | TUÉE |
| C02 — `get()` part sur un mauvais chemin | TUÉE |
| C03 — `request()` part en GET | TUÉE |
| D05 (équivalent) — `describeOrderExportRow` lit `item.format` au lieu de `item.granularity` pour la granularité | TUÉE |

`=== RESTAURATION OK` à chaque exécution (hash SHA-256 des trois fichiers
mutés identique avant/après).

### Gates rejouées après corrections

- `pnpm typecheck` : **0 erreur**.
- `pnpm exec vitest run tests/modules/commercial-orders tests/modules/order-exports tests/surfaces tests/platform/api` :
  **16 fichiers, 319 cas, tous verts** (+28 par rapport aux 291 de la
  remise round 0 : 76 cas dans `order-export.helpers.test.ts`, contre 50 ;
  7 cas dans `order-exports-api-client.test.ts`, contre 5).
- `pnpm test:contract` : **23 fichiers, 432/432**, inchangé.
- `pnpm test:architecture` : **35 fichiers, 153/153**, inchangé.
- `pnpm gen:api:check` : **aligné**, aucune dérive.
- `pnpm test` (suite complète) : **272 fichiers passés, 2612 cas passés,
  36 ignorés, 1 fichier en échec — `tests/storage/product_mockups_
  isolation.test.ts` (3 cas), échec PRÉEXISTANT et SANS RAPPORT**
  (inchangé depuis la remise round 0).

### Fichiers modifiés en round 1

- `src/modules/commercial-orders/ui/components/order-export.helpers.ts` — `freshIdempotencyKey` sur `formatChanged`/`granularityChanged` (B1), garde de clé vide dans le contrôleur (Q4), reprise du suivi sur échec transitoire (M1), fusion `listLoaded`/`mergeOrderExportItems` + `hasMore` (Q2 + mineur pagination), `CAN_EXPORT_ORDERS` exportée (V02), `describeOrderExportDownload`/`describeOrderExportRow` (B2).
- `src/modules/commercial-orders/ui/components/OrderExportDialog.tsx` — les deux `dispatch` de changement de format/granularité fournissent `freshIdempotencyKey`.
- `src/modules/commercial-orders/ui/components/OrderExportPanel.tsx` — `CAN_EXPORT_ORDERS` importée (V02), lien de téléchargement remplacé par un bouton + `triggerBrowserDownload()` (M2), rendu de ligne réécrit autour de `describeOrderExportRow` (B2), `data-testid={T.panel}` posé (mineur), signal `hasMore` (mineur).
- `tests/modules/commercial-orders/order-export.helpers.test.ts` — +26 cas (B1, Q2, Q4, M1, M3/S02-S03, B2/`describeOrderExportDownload`+`describeOrderExportRow`, V02, L03/L04).
- `tests/modules/order-exports/order-exports-api-client.test.ts` — +2 cas (C02, C03).

Aucun fichier `openapi/`, `docs/api/CONVENTIONS.md` ni `supabase/` modifié
par cet agent. **`SPRINT_HANDOFF.md` apparaît modifié dans `git status` au
moment de cette révision, mais PAS PAR CET AGENT** — le coordinateur y a
consigné un smoke E2E boutique daté du 2026-09-15, sans rapport avec cette
story, pendant que cette correction était en cours (travail concurrent
constaté dans le même arbre de travail, cf. la note « aucune recette
navigateur pendant qu'un agent écrit dans le dépôt » qu'il y a lui-même
ajoutée). Non touché, non commité par cet agent.

---

Cadrage déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.24, bandeau
quatorzième/quinzième entrées, point 8 « E10.18e — périmètre arrêté le
2026-09-14 », consigne « E10.18e-2 — export », points 1 à 11) — ce lot
l'implémente à la lettre. **Aucune contradiction trouvée** entre le cadrage,
le contrat (`openapi/magrit-core.v1.yaml`, ressources `/commercial-order-
exports`) et le code existant (module `order-exports` livré en E10.18c/d,
grille livrée en E10.18e-1) : rien n'a été remonté, rien n'a été tranché
seul (point 7 du mandat).

**Vérifié avant d'écrire une ligne** : `git branch --show-current` =
`feat/gescom-e10-4-entite-client` (HEAD `24b97008`), aucun `git stash`/
`checkout`/`reset` lancé, `_bmad-output/Visuels produits/` non touché.

## Ce qui existait déjà et n'a pas été retouché

- Le contrat (`OrderExportFormat`, `OrderExportGranularity`, `OrderExportFilters`,
  `RequestOrderExportCommand`, `OrderExport`, `OrderExportStatus`, droit
  `can_export_orders`) : écrit par l'architecte, non modifié.
- Le service, le repository, les routes serveur, le générateur, les deux
  renderers (CSV/XLSX), le runner, la purge (E10.18b/c/d) : non touchés.
- `src/modules/commercial-orders/ui/workspace/orders-list.helpers.ts` et
  `OrdersListPage.tsx` (E10.18e-1) : **réutilisés tels quels** — voir
  décision 1 ci-dessous. Seul un import et un appel de composant ont été
  ajoutés à `OrdersListPage.tsx` (11 lignes), aucune ligne de logique.

## Critères d'acceptation, un par un

**1. Bouton d'export → modale (format/granularité) → `POST` avec les
filtres ACTIFS de la grille, tirés par un helper pur du même état ; tri NON
repris et dit à l'écran ; `Idempotency-Key` générée à l'ouverture ; bouton
inactif pendant l'envoi ; un double-clic ne crée qu'une seule demande.**
FAIT. `OrderExportPanel.tsx` porte le bouton (`orders-export-btn`), monte
`OrderExportDialog.tsx` à l'ouverture. `buildOrderExportFilters()`
(`order-export.helpers.ts`) tire les filtres **de la même fonction**
(`buildOrdersListQuery`) que la requête de grille — voir décision 1. Le
texte « Le fichier est trié par date de commande puis par numéro — le tri
de la grille n'est pas repris. » est affiché dans la modale, en clair.
`orderExportDialogReducer` porte le cycle de la clé (créée à `opened`,
inchangée à `submitFailed`, renouvelée à `submitSucceeded`) —
`isOrderExportSubmitDisabled(state)` pilote `disabled` sur les trois
champs (format, granularité, bouton). `createOrderExportSubmitController()`
garde un booléen `inFlight` **dans sa fermeture**, posé de façon
**synchrone avant le premier `await`** — un double-clic (deux appels
synchrones) ne déclenche qu'un seul appel réseau, **prouvé sans rendre de
composant** (`tests/modules/commercial-orders/order-export.helpers.test.ts`,
« un double-clic... »).

**2. Panneau des exports (`GET /commercial-order-exports`), suivi
périodique tant qu'une demande est en cours, testé à horloge simulée et
arrêté au démontage ; table pure pour chaque statut ; lien de
téléchargement réservé au demandeur ; URL réémise au clic/rafraîchissement,
testé.** FAIT. `OrderExportPanel.tsx` charge le registre au montage
(`api.list({ pageSize: 50 })`), démarre un `startOrderExportPolling()` par
demande **non terminale** (`nonTerminalOrderExportIds`), arrête **tous**
les pollers actifs au démontage (`useEffect` de nettoyage sans dépendance).
`nextOrderExportPollDelayMs()` est une fonction de calendrier pure (2 s,
puis 10 s au-delà d'une minute écoulée depuis le premier sondage) ;
`startOrderExportPolling()` s'arrête de lui-même sur un état terminal —
les deux comportements sont testés à horloge simulée
(`vi.useFakeTimers()`/`vi.advanceTimersByTimeAsync()`), y compris l'arrêt
au `stop()` explicite. `describeOrderExportStatus()` est la table pure
statut → affichage (un cas par valeur de `OrderExportStatus`).
`resolveOrderExportDownloadState()` distingue les trois cas de
`download_url: null` (pas prêt, expiré, pas le demandeur) **par le
statut**, jamais par une supposition sur `requested_by` — testé. Le lien
n'est rendu dans le JSX que pour `kind: 'available'`. Au clic,
`refreshOrderExportDownloadUrl()` relit l'export (`GET .../{id}`) et
n'ouvre **que** l'URL fraîchement reçue — jamais celle en mémoire ; testé
(URL fraîche, et `url: null` si l'export a expiré entre-temps). Voir
décision 4 sur la portée exacte de « ou du rafraîchissement ».

**3. Messages : `row_limit_exceeded` → « resserrez la période », SANS
CHIFFRE ; `pending_limit_reached` → affiché en clair ; toute autre 4xx →
telle que le serveur la renvoie.** FAIT. `resolveOrderExportFailureMessage()`
est le seul endroit qui traduit `error_code` ; testé pour l'ABSENCE de
chiffre (`expect(message).not.toMatch(/\d/)`) — une régression qui
écrirait « 2 500 » ou « 5 000 » ferait tomber ce test précis, pas
seulement un test de présence de texte. `pending_limit_reached` est un
422 **au moment du `POST`** (pas un statut d'export) : `createOrderExport
SubmitController` ne réécrit **jamais** le message d'échec
(`cause.message`, déjà égal à `problem.detail ?? problem.title` —
`ApiClientError`) ; testé avec le message exact que le serveur produit
(`OrderExportPendingLimitReachedError`, "Trois demandes non terminées...").
Toute autre erreur suit le même chemin générique, donc la même garantie.

**4. Testids repris à l'identique du cahier Notion TF-187, plus les deux
demandés par le cadrage.** FAIT, avec un écart signalé — voir « Points
remontés ». `orders-export-btn`, `orders-export-dialog`, `orders-export-
format-radio` (+ `data-format`), `orders-export-granularity-radio` (+
`data-granularity`), `orders-export-submit-btn`, `orders-export-download-
link`, `orders-export-row` (+ `data-export-id`), `orders-export-status`
(+ `data-status`) : tous posés, tous déclarés dans `testIds.ts` (bloc
`orderExport`). **Trois testids AJOUTÉS, non demandés par la consigne** :
`orders-export-error-banner` (bandeau d'échec de la modale),
`orders-export-panel` (conteneur du registre), `orders-export-load-error-
banner` (échec de **chargement** du registre, distinct de l'échec d'un
export). Nécessaires pour que la recette navigateur ait une prise stable
sur ces trois états — même logique que `listStepsLoadErrorBanner` ajouté
en E10.18e-1.

**5. Page coquille générique : réducteur de la modale, descripteurs et
suivi du panneau purs et testés ; le JSX ne fait que les parcourir.**
FAIT, DURCI en qa-review round 1 (B2). `orderExportDialogReducer`,
`orderExportRegistryReducer`, `mergeOrderExportItems`,
`nextOrderExportPollDelayMs`/`startOrderExportPolling`,
`describeOrderExportStatus`, `describeOrderExportDownload`,
`describeOrderExportRow`, `buildOrderExportFilters`,
`buildOrderExportFilterSummary` sont tous purs (ou orchestrent via une API
injectée, jamais de dépendance cachée) et testés. Les deux groupes de
boutons radio sont rendus par une boucle sur `ORDER_EXPORT_FORMAT_OPTIONS`/
`ORDER_EXPORT_GRANULARITY_OPTIONS`. **La réserve du round 0** (les quatre
issues de `OrderExportDownloadState` rendues par des `if`/`&&` écrits à la
main, le libellé de granularité en ternaire local ignorant `ORDER_EXPORT_
GRANULARITY_OPTIONS`) **est fermée** : `describeOrderExportRow()` est
désormais le SEUL descripteur consulté par la ligne du panneau, et le JSX
ne garde plus qu'une branche générique (`row.download.downloadable ? bouton
: texte`) — voir « BLOQUANT B2 » ci-dessus pour le détail et les mutations
qui le prouvent.

**6. Domicile : écran dans `commercial-orders/ui/`, client API dans
`order-exports`.** FAIT. `OrderExportDialog.tsx`/`OrderExportPanel.tsx`/
`order-export.helpers.ts` → `src/modules/commercial-orders/ui/components/`.
`OrderExportsApiClient` → `src/modules/order-exports/api/client.ts`,
exposé par `src/modules/order-exports/index.ts` (racine du module —
première entrée publique de ce module, qui n'avait pas d'UI avant ce lot).
`tests/architecture/modular-ui-boundaries.test.ts` (35/35 fichiers, 153/153
cas) confirme que l'import depuis `commercial-orders/ui/` passe bien par
`@/modules/order-exports`.

**7. Aucune contradiction cadrage/contrat/code — rien tranché seul.** FAIT.
Voir « Points remontés » : une seule question ouverte, non bloquante,
signalée plutôt que tranchée en silence.

## Points remontés au cadrage

**Aucun blocage.** Un point à confirmer, non tranché seul :

1. **Le cahier Notion TF-187 n'a pas pu être consulté** (pas d'accès à
   Notion pour cet agent, comme signalé par l'architecte lui-même en tête
   du §8.24 et par le dev-story d'E10.18e-1). Les six testids « repris à
   l'identique » viennent du **mandat**, pas d'une lecture directe du
   cahier — s'il nomme différemment un « Hint DOM » (ex. un texte de
   bouton, une structure de ligne), c'est le cahier qui fait foi et les
   testids se corrigent en dual-tag. Les trois testids ajoutés
   (`errorBanner`, `panel`, `loadErrorBanner`) sont à confronter au cahier
   par le scribe/coordinateur.
2. **« ou du rafraîchissement »** (contrat, `getCommercialOrderExport`) —
   voir décision 4. Interprété comme « au clic », qui est la seule
   interaction de rafraîchissement explicite de ce lot. Aucun bouton
   « Actualiser » distinct n'a été ajouté au panneau (dette mineure,
   listée plus bas) : si la qa-review ou la recette juge qu'un
   rafraîchissement manuel séparé est attendu, c'est un ajout, pas une
   correction d'un choix contradictoire.

## Décisions prises et leur motif

1. **`buildOrderExportFilters()` appelle `buildOrdersListQuery()` — la
   fonction de la grille elle-même — plutôt que de relire `state.filters`
   champ par champ.** C'est ce qui rend « exactement les filtres de la
   grille » une propriété **structurelle** (impossible de diverger sans
   toucher aux deux call sites) et non une simple ressemblance de code
   entretenue à la main. Conséquence directe : `sort` ne peut **pas**
   fuiter dans les filtres d'export, puisque cette fonction ne le lit
   jamais depuis le résultat de `buildOrdersListQuery()` — ce n'est pas
   un `if` qui l'exclut, c'est l'absence de tout code qui pourrait le lire.
2. **`createOrderExportSubmitController()` garde `inFlight` dans sa
   fermeture plutôt que de s'appuyer sur `state.status`.** Un
   `if (state.status === 'submitting')` seul ne protège pas d'un double
   appel synchrone : les deux appels verraient le même `state` (React n'a
   pas encore re-rendu entre les deux). Même famille de défaut que
   `createDebouncedSearch()`/`inFlightCustomerIds` (E10.18e-1) : l'état
   React ne suffit jamais à garder une invariante qui doit tenir **entre
   deux rendus**, il faut une variable qui survit à la fermeture.
3. **Un seul `OrderExportSubmitController` par montage de la modale**
   (`useRef`, jamais recréé), et non une fonction `submitOrderExport()`
   appelée directement : un contrôleur recréé à chaque rendu perdrait son
   `inFlight` et redeviendrait vulnérable au double-clic — même piège que
   celui corrigé en E10.18e-1 round 3 pour `CustomerFilterSelect`
   (initialisation paresseuse du `ref`).
4. **« Au clic » couvre le contrat, « au rafraîchissement » n'a pas reçu
   d'affordance séparée.** Le contrat dit que l'URL est réémise « à chaque
   appel » de `getCommercialOrderExport` — c'est vrai pour **tous** les
   appels que ce lot émet réellement : le chargement initial du registre
   (`list()`, qui resigne déjà les URLs des exports `ready` de l'acteur —
   vérifié dans `SupabaseOrderExportsRepository.toDto()`, appelée par
   `list()` **et** `findById()`) et le clic sur « Télécharger ». Aucun
   troisième déclencheur n'est décrit ailleurs dans le cadrage ; un bouton
   « Actualiser » séparé aurait été une capacité **ajoutée**, pas une
   capacité déjà décidée — listé en dette plutôt qu'inventé.
5. **(RENVERSÉE en qa-review round 1, MOYEN M1) Le suivi périodique
   REPREND sur un échec transitoire de sondage, il ne s'arrête plus.** La
   décision d'origine (« un échec arrête le sondage, `onError` notifié une
   fois ») s'est révélée fausse à l'usage : elle figeait indéfiniment un
   export dont le réseau avait simplement eu un accroc d'une seconde
   (sonde qa-review Q3). Retenu : le sondage reprend à la même cadence
   après un échec, `onError` est notifié à CHAQUE échec (pas seulement au
   premier). Voir « MOYEN M1 » ci-dessus pour le détail et l'arbitrage
   assumé (un échec permanent repolle indéfiniment, à basse fréquence,
   plutôt que d'abandonner un export en train de réussir).
6. **(AMENDÉE en qa-review round 1) Le panneau ne pagine toujours pas
   (`page[size]: 50`), mais porte désormais un SIGNAL EXPLICITE.** Un
   champ `hasMore` (dérivé de `nextCursor !== null`) affiche un texte
   quand le registre est tronqué à 50 — voir « MINEUR — registre limité à
   50 » ci-dessus. Le choix « signal plutôt que pagination complète » est
   maintenu et documenté à cet endroit.
7. **`can_export_orders` est vérifié dans `OrderExportPanel.tsx` lui-même**
   (`useAccessProfile().hasCapability(...)`), pas remonté en prop depuis
   `OrdersListPage.tsx` : le composant reste un point d'appel unique et
   autonome, comme `OrderStatusButton`/`OrderStatusDialog` (E10.14) —
   `OrdersListPage.tsx` n'a besoin de rien savoir du droit `can_export_
   orders` pour monter `<OrderExportPanel>`.
8. **(REMPLACÉE en qa-review round 1, MOYEN M2) Le téléchargement ne
   passe plus par `window.open()`.** Retenu : une ancre détachée
   (`document.createElement('a')` + `download` + `click()` synthétique).
   Motif complet et alternatives écartées (`window.open` bloqué après un
   `await`, `window.location.assign` qui ferait quitter l'application) :
   voir « MOYEN M2 » ci-dessus. Aucune nouvelle bibliothèque, aucune
   dépendance ajoutée.

## Ce qui n'est pas prouvé par un test — et pourquoi

Ce dépôt n'a **aucun outil de rendu React** (constat déjà fait par
l'architecte et par le dev-story d'E10.18e-1). Ce qui reste, structurellement,
hors de portée d'un test qui ne rend rien :

- La boucle générique des radios (`ORDER_EXPORT_FORMAT_OPTIONS.map(...)`,
  `ORDER_EXPORT_GRANULARITY_OPTIONS.map(...)`) et la branche générique de
  téléchargement (`row.download.downloadable ? bouton : texte`) — lisent-
  elles réellement les descripteurs, ou une copie figée ? Même limite que
  R04/R04b (E10.18e-1). **Réduite en round 1** : il ne reste plus qu'UNE
  branche de rendu par ligne (au lieu de quatre écrites à la main).
- Le clic réel sur le bouton de téléchargement, l'exécution effective de
  `triggerBrowserDownload()` (l'ancre détachée déclenche-t-elle vraiment
  un téléchargement dans un vrai navigateur, pour les deux formats), et le
  contenu du fichier reçu. Point d'attention signalé en round 1 (MOYEN M2) :
  le comportement de l'attribut `download` sur une URL cross-origin varie
  selon le navigateur — à confirmer en recette.
- Le double-clic **au sens DOM** (deux `click` réels sur le même bouton,
  avant que React n'ait eu le temps de poser `disabled`) — le test unitaire
  prouve la garde `inFlight` sur deux appels synchrones de la fonction,
  pas l'événement DOM lui-même. C'est la même limite, en plus favorable :
  ici la garde ne dépend PAS du rendu, contrairement à `disabled`.
- La visibilité réelle du bouton/panneau selon le rôle (`can_export_orders`)
  dans un vrai navigateur, session admin vs membre.
- Le parcours P13 de bout en bout **avec le runner actif** : en
  production, une demande créée reste `pending` tant que les secrets Vault
  et le `pg_cron` de `magrit-order-export-runner` ne sont pas posés
  (bandeau §8.24, quinzième entrée — non bloquant pour ce lot, condition
  de sortie de la recette, pas du développement).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **Fermée en qa-review round 1 (B2)** | ~~`OrderExportDownloadState` rendu par 4 branches fixes plutôt qu'une boucle sur des descripteurs~~ | `describeOrderExportRow()` + une seule branche générique dans le JSX. |
| **Nouvelle, mineure — AMENDÉE round 1** | Pas de pagination du registre des exports (`page[size]: 50` fixe) — un SIGNAL explicite (`hasMore`) prévient désormais l'utilisateur plutôt que de tronquer en silence. | Si un tenant dépasse durablement 50 exports actifs : reprendre le patron `buildLoadMoreRequest`/curseur d'`orders-list.helpers.ts`. |
| **Nouvelle, mineure** | Pas de bouton « Actualiser » séparé sur le panneau — seul le clic sur le bouton de téléchargement rafraîchit explicitement l'URL au moment voulu. | Ajout simple si la recette/qa-review le juge nécessaire (point remonté 2). |
| **Nouvelle, mineure, round 1 (M2)** | Le comportement de l'attribut `download` d'une ancre sur une URL Storage cross-origin n'est pas vérifié (peut être ignoré par certains navigateurs, auquel cas le clic se comporte comme une navigation vers l'URL signée). | À vérifier en recette navigateur (XLSX et CSV, au moins un navigateur Chromium et un WebKit) ; si nécessaire, faire porter `download=<nom-de-fichier>` par le serveur via l'option `download` de `createSignedUrl()` (hors périmètre de cette story, ajustement E10.18c/d). |
| **Héritée, non aggravée** | D5 (résolution N+1 des noms de client) : non touchée par ce lot, qui n'affiche aucun nom de client (le panneau affiche `requested_by_label`, déjà résolu par le serveur). | Sans objet pour ce lot. |

## Dérogations R5

Aucune.

## Testids posés

Bloc `orderExport` de `src/shared/presentation/testIds.ts` :

| Clé | Valeur | Porté par |
|---|---|---|
| `btn` | `orders-export-btn` | Bouton « Exporter » (`OrderExportPanel.tsx`) |
| `dialog` | `orders-export-dialog` | Conteneur de la modale (`OrderExportDialog.tsx`) |
| `formatRadio` (+ `data-format`) | `orders-export-format-radio` | Chaque bouton radio de format |
| `granularityRadio` (+ `data-granularity`) | `orders-export-granularity-radio` | Chaque bouton radio de granularité |
| `submitBtn` | `orders-export-submit-btn` | Bouton d'envoi de la modale |
| `errorBanner` *(ajouté)* | `orders-export-error-banner` | Bandeau d'échec de la modale |
| `downloadLink` | `orders-export-download-link` | Lien de téléchargement d'une ligne `ready` |
| `panel` *(ajouté)* | `orders-export-panel` | Posé sur la racine du panneau depuis round 1 (mineur qa-review : déclaré mais jamais posé en round 0) — non utilisé dans un test faute d'outil de rendu, prêt pour la recette |
| `row` (+ `data-export-id`) | `orders-export-row` | Chaque ligne du registre |
| `status` (+ `data-status`) | `orders-export-status` | Cellule de statut d'une ligne |
| `loadErrorBanner` *(ajouté)* | `orders-export-load-error-banner` | Échec de chargement du registre (distinct d'un export en échec) |

**Aucun cahier de test Notion accessible à cet agent** (pas d'accès à
Notion) : les six testids non marqués « ajouté » viennent du mandat
(cahier TF-187) tel que transmis ; à confronter au cahier réel par le
scribe/coordinateur avant que la recette P13 ne s'appuie dessus.

## Mutations prouvées — remise round 0 (raisonnées, sans campagne automatisée)

**Historique, avant qa-review.** Voir en tête de document la section
« qa-review round 1 » pour les mutations REJOUÉES RÉELLEMENT (campagne de
la qa-review, plus le harnais de vérification indépendant de cet agent).
Les mutations ci-dessous sont celles identifiées en écrivant chaque test
de la remise initiale, et vérifiées par relecture du test contre le code —
pas rejouées avec un outil de mutation testing à l'époque.

| Mutation envisagée | Test qui tombe |
|---|---|
| `buildOrderExportFilters` copie `gridQuery.sort` dans le résultat | « LE TRI N EST JAMAIS REPRIS... » |
| `buildOrderExportFilters` envoie `''`/`null` au lieu d'omettre une clé absente | « omet un axe ABSENT de la grille... » |
| `orderExportDialogReducer.submitSucceeded` garde l'ancienne clé | « cree la cle a l ouverture... » (assertion `key-b`) |
| `orderExportDialogReducer.submitFailed` régénère une clé | même test (assertion `key-a` après échec) |
| `createOrderExportSubmitController` retire la garde `inFlight` (ou la remplace par `state.status`) | « un double-clic... » |
| `resolveOrderExportFailureMessage` écrit un chiffre en dur pour `row_limit_exceeded` | « ...SANS AUCUN CHIFFRE » |
| `resolveOrderExportDownloadState` rend `available` avec une url nulle | « ready SANS download_url -> not_requester » |
| `startOrderExportPolling` ne teste pas `isOrderExportTerminalStatus` avant `scheduleNext()` | « S ARRETE D ELLE-MEME... » |
| `startOrderExportPolling.stop()` ne pose pas `stopped = true` | « S ARRETE AU DEMONTAGE... » |
| `nextOrderExportPollDelayMs` compare `>` au lieu de `>=`, ou inverse les deux constantes | les deux cas de `nextOrderExportPollDelayMs` |
| `orderExportRegistryReducer.exportCreated` duplique un id déjà présent | « NE DUPLIQUE PAS un rejeu... » |
| `orderExportRegistryReducer.exportUpdated` crée une ligne pour un id absent | « pour un id ABSENT... ne fait rien » |

## Gates exécutées — remise round 0 (historique)

- `pnpm typecheck` : **0 erreur**.
- `pnpm exec vitest run tests/modules/commercial-orders tests/modules/order-exports tests/surfaces tests/platform/api` :
  **16 fichiers, 291 cas, tous verts** (dont les 50 nouveaux cas
  d'`order-export.helpers.test.ts` et les 5 nouveaux cas d'`order-exports-
  api-client.test.ts`).
- `pnpm test:contract` : **23 fichiers, 432/432**, inchangé — aucune route
  touchée par ce lot (déjà livrées en E10.18c).
- `pnpm test:architecture` : **35 fichiers, 153/153**, inchangé — confirme
  la frontière `@/modules/order-exports` depuis `commercial-orders/ui/`.
- `pnpm gen:api:check` : **aligné**, aucune dérive — confirme qu'aucun
  fichier `openapi/`/`docs/api/CONVENTIONS.md` n'a été touché par cet agent.
- `pnpm test` (suite complète) : **272 fichiers passés, 2584 cas passés,
  36 ignorés, 1 fichier en échec — `tests/storage/product_mockups_
  isolation.test.ts` (3 cas), échec PRÉEXISTANT et SANS RAPPORT** (bucket
  `product_mockups` absent de l'environnement local, feature non touchée
  par ce lot — connu et documenté dans le mandat).

**Voir « Gates rejouées après corrections » en tête de document pour
l'état à jour après qa-review round 1** (319 cas sur le périmètre ciblé,
2612 cas sur la suite complète).

## Fichiers créés — remise round 0 (historique, non retouchés en round 1 sauf mention contraire)

- `src/modules/order-exports/api/client.ts` — `OrderExportsApiClient` (`list`/`request`/`get`), `Idempotency-Key` pilotée par l'appelant.
- `src/modules/order-exports/index.ts` — première entrée publique du module (consommée par `commercial-orders/ui/`).
- `src/modules/commercial-orders/ui/components/order-export.helpers.ts` — toute la logique pure (parité des filtres, réducteur de modale, contrôleur de soumission, registre, calendrier de suivi, tables statut/téléchargement). **Retouché en round 1** — voir « Fichiers modifiés en round 1 » en tête de document.
- `src/modules/commercial-orders/ui/components/OrderExportDialog.tsx` — modale (coquille). **Retouché en round 1.**
- `src/modules/commercial-orders/ui/components/OrderExportPanel.tsx` — bouton, montage de la modale, registre (coquille). **Retouché en round 1.**
- `tests/modules/order-exports/order-exports-api-client.test.ts` — 5 cas en round 0, **7 cas après round 1**.
- `tests/modules/commercial-orders/order-export.helpers.test.ts` — 50 cas en round 0, **76 cas après round 1**.
- `_bmad-output/implementation-artifacts/story-E10.18e-2.md` (ce document).

## Fichiers modifiés — remise round 0 (historique)

- `src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx` — un import et un appel de composant (`<OrderExportPanel filters=... selectedCustomerLabel=... stepCatalog=... />`) sous le bouton « Charger plus ». Aucune logique déplacée ni dupliquée : les trois props sont lues directement depuis `state` (le réducteur d'E10.18e-1, non modifié). **Non retouché en round 1.**
- `src/shared/presentation/testIds.ts` — bloc `orderExport` (11 clés). **Non retouché en round 1** (les 11 clés posées en round 0 couvraient déjà `panel`, seul son usage dans le JSX manquait — corrigé en round 1 sans toucher `testIds.ts`).

Aucun fichier `openapi/`, `docs/api/CONVENTIONS.md` ni `supabase/` modifié
par cet agent, aux deux rounds. Aucune dépendance ajoutée à `package.json`/
`pnpm-lock.yaml`. Aucune commande de reset de base jouée. **`SPRINT_HANDOFF.
md`** : voir la note de fin de la section « qa-review round 1 » — modifié
par un autre agent en tâche de fond pendant cette session, non touché par
celui-ci.

## Recette navigateur — NON JOUÉE par cet agent

Par construction (cadrage, condition (b2)/point 11) : la recette du
parcours P13 en local, runner servi, est la **condition de sortie** de ce
lot, distincte de la qa-review. Preuves à établir par le coordinateur,
dans un vrai navigateur, serveur de dev de **cette** copie de travail
(`git branch --show-current` vérifié dans le dossier servi) :

1. L'onglet réseau montre un corps de `POST /commercial-order-exports`
   dont `filters` sont ceux de la requête de grille visible juste avant
   (mêmes valeurs que l'onglet réseau de la requête `GET
   /commercial-orders` précédente).
2. Un double-clic réel sur « Exporter » ne produit qu'une seule ligne au
   registre (même `Idempotency-Key` observée dans les deux tentatives
   réseau si le second clic passe malgré `disabled`).
3. Le fichier téléchargé s'ouvre (XLSX et CSV).
4. Un export au-delà du plafond (2 500 lignes aujourd'hui) affiche
   « resserrez la période », sans aucun chiffre.
5. L'entrée est visible pour un administrateur et absente/masquée pour un
   membre sans `can_export_orders` (à vérifier : le contrat dit que la
   lecture du registre est elle-même gardée par le droit, donc un membre
   sans le droit ne doit voir ni le bouton ni un panneau vide).
6. Le suivi périodique est visible dans l'onglet réseau (un `GET
   .../{id}` toutes les 2 s, espacé au-delà d'une minute), et s'arrête à
   l'état terminal.

## Recette navigateur — défauts R1 à R3 (CORRIGÉS, plus R4 ajouté en cours de lot, 2026-09-15)

La recette navigateur locale annoncée ci-dessus a été jouée par le
coordinateur le 2026-09-15 et a trouvé trois défauts (R1 à R3), puis un
quatrième (R4, mineur) signalé en cours de correctif. Les quatre sont
CORRIGÉS dans ce lot, worktree isolé (HEAD de départ `c9603433`), sans
navigateur ni serveur de dev lancés par cet agent.

### R1 — `download_url` pointait vers l'hôte interne Docker (`kong`), un navigateur ne le résout pas

**Le défaut.** En local, `SupabaseOrderExportsRepository.toDto()`
(`createSignedUrl`, déjà porteuse de `{ download: row.file_name }` depuis le
MOYEN M2 de la qa-review round 2 — ce paramètre-là n'était pas en cause)
rendait l'URL signée TELLE QUE le client Storage `service_role` (construit
sur `SUPABASE_URL`, `http://kong:8000` sous Docker local) la produit. Le
clic sur « Télécharger » faisait donc naviguer l'onglet vers un hôte que le
navigateur ne résout jamais.

**Relevé avant de corriger, comme demandé.** `SupabaseQuoteDocumentsRepository`
et `SupabaseOrderDocumentsRepository` (`quote-documents-repository.ts` l.143,
`order-documents-repository.ts` l.150) signent leur URL de la MÊME façon,
SANS AUCUNE réécriture d'origine — **le même défaut existe chez eux en
local**, non corrigé par ce lot (hors périmètre E10.18e-2 : ces deux
adaptateurs ne sont touchés par aucun de ses fichiers). `SupabaseOrderFiles
Repository.toDetailDto()` (`order-files-repository.ts` l.345) est dans le
même cas. Le SEUL mécanisme de réécriture d'origine déjà présent dans le
dépôt est `publicAssetUrl()`/`publicSupabaseUrl()`
(`src/adapters/supabase/shops-repository.ts` + `supabase/functions/magrit-
api/index.ts`), déjà câblé pour `SupabaseShopsRepository` (logos, fonds de
boutique, mockups) — **jamais encore réutilisé ailleurs** avant ce
correctif.

**Corrigé, en réutilisant CE mécanisme, sans en inventer un second.**
`SupabaseOrderExportsRepository` reçoit un troisième paramètre de
constructeur optionnel, `publicBaseUrl?: string`, et `toDto()` applique
`publicAssetUrl(signed.signedUrl, this.publicBaseUrl)` — fonction PURE déjà
existante, qui ne réécrit QUE l'origine (protocole/hôte/port) quand elle
vaut `kong` en environnement loopback, conserve TOUJOURS le chemin, le
jeton et `download=`, et rend l'URL INCHANGÉE si `publicBaseUrl` est absent
ou si l'origine n'est pas `kong` (donc INERTE en production/staging, où
`SUPABASE_URL` est déjà public). `supabase/functions/magrit-api/index.ts`
câble `publicSupabaseUrl(request, supabaseUrl)` en troisième argument,
exactement comme il le fait déjà pour `SupabaseShopsRepository` (l.192).

**Redéploiement de `magrit-api` requis : OUI**, pour que la correction
prenne effet en local (Docker) comme en tout environnement où `SUPABASE_URL`
serait un jour interne. Aucune migration SQL, aucun autre Edge Function
concerné.

**Cette correction ne touche PAS** `SupabaseQuoteDocumentsRepository`,
`SupabaseOrderDocumentsRepository` ni `SupabaseOrderFilesRepository` : ils
partagent le même défaut potentiel en local (voir ci-dessus), signalé mais
laissé en dette, hors périmètre de cette story (aucun de leurs fichiers n'a
été touché par E10.18e-2). Chemin de mise en conformité, s'il est retenu :
même patron exact (troisième paramètre `publicBaseUrl`, `publicAssetUrl()`
dans leur `toDto`/`toDetailDto`), câblé dans `index.ts` au même endroit que
`documentTemplatesStorageClient` est construit.

**Test** (`tests/adapters/supabase/order-exports-repository.test.ts`,
describe « DEFAUT R1 ») : avec une base publique fournie, une URL signée
dont l'hôte vaut `kong` est réécrite (origine remplacée, chemin/jeton/
`download` conservés à l'identique) ; sans base publique, l'URL reste
inchangée. RED confirmé contre le code d'avant ce correctif (`AssertionError:
expected 'http://kong:8000/...' to be 'http://127.0.0.1:54321/...'`), GREEN
après.

### R2 — le `detail` du 422 `order_export.pending_limit_reached` recopiait le message SQL brut

**Le défaut.** `mapRequestOrderExportError()` (`src/adapters/supabase/order-
exports-repository.ts`) passait le message d'exception SQL BRUT (`order_
export.pending_limit_reached: trois demandes non terminees deja en file
pour cet acteur`, migration `20260913000000` l.516) directement au
constructeur d'`OrderExportPendingLimitReachedError`, écrasant ainsi son
message par défaut — déjà propre — par le code technique. La route
(`order-exports-routes.ts`) recopie ensuite `error.message` tel quel dans
`detail` (comportement correct et voulu par §8.24 point 8 : « le "trois"
vient du serveur, via `detail` » — ce n'est PAS la route qu'il fallait
changer, mais ce qu'elle reçoit).

**Corrigé.** `OrderExportPendingLimitReachedError` porte désormais un
message par défaut entièrement français, sans code ni `_` : « Vous avez
déjà trois demandes d'export en cours. Attendez qu'une d'elles se termine
avant d'en lancer une autre. ». `mapRequestOrderExportError()` journalise le
message SQL brut côté serveur (`console.error`, diagnostic) puis construit
l'erreur SANS ARGUMENT, pour que ce message par défaut soit celui qui
atteint `detail`. Le titre (« Trop de demandes en file ») et le code
(`order_export.pending_limit_reached`) sont INCHANGÉS.

**Vérifié avant de corriger** : ni l'OpenAPI (`OrderExport`/le 422 de
`requestCommercialOrderExport`) ni §8.24 ne fixent un texte précis pour ce
`detail` — seule la présence du nombre est exigée (« le "trois" vient du
serveur »). Aucune contradiction, aucune remontée à l'architecte
nécessaire.

**Test**, nouveau fichier `tests/server/api/order-exports-routes.test.ts` —
exerce la ROUTE RÉELLE au-dessus du REPOSITORY RÉEL
(`SupabaseOrderExportsRepository`), avec un faux client Supabase qui rend
l'EXACTE erreur SQL de la migration (pas une erreur fabriquée). RED
confirmé contre le code d'avant ce correctif (`detail` contenait `order_
export.` et `_`), GREEN après : le `detail` ne contient ni `order_export.`
ni `_`, et contient « trois ».

### R3 — une panne réseau s'affichait en anglais brut (« Failed to fetch »)

**Le défaut.** `FetchApiClient.send()` ne capture jamais le rejet de
`fetch()` lui-même (seul un échec HTTP DÉJÀ RÉPONDU devient une
`ApiClientError`) : une panne réseau (mise hors ligne, coupure) rejette
avec une `TypeError` du NAVIGATEUR, dont le texte (« Failed to fetch » sous
Chromium, variantes sous Firefox/Safari) n'est fixé par AUCUNE norme —
seul le TYPE (`TypeError`) l'est. Deux endroits affichaient ce texte tel
quel : le catch de `createOrderExportSubmitController()` (modale, après un
envoi hors ligne) et la branche d'échec de `tick()` dans
`startOrderExportPolling()` (ligne du registre, pendant une coupure
passagère du suivi).

**Recherché d'abord** (`grep -rn "Failed to fetch\|isNetworkError\|Network
Error"`) : aucun utilitaire commun n'existait dans le dépôt. Un seul créé,
réutilisé aux deux endroits.

**Corrigé.** Nouvelle fonction pure, `resolveOrderExportUnreachableMessage
(cause, { genericMessage, networkMessage })` (`order-export.helpers.ts`) :
une `ApiClientError` garde SON message (déjà français, posé par le
serveur), INCHANGÉ ; une `TypeError` (panne réseau, quel que soit son texte
exact) reçoit `networkMessage`, fourni par l'appelant ; toute autre `Error`
garde SON message (comportement INCHANGÉ pour ce cas, déjà couvert par des
tests existants avec un message métier arbitraire) ; une valeur qui n'est
même pas une `Error` reçoit `genericMessage`. Les deux appelants fournissent
CHACUN son propre texte : la modale, « Connexion impossible. Vérifiez votre
réseau, puis réessayez. » ; le registre, « Connexion perdue. Nouvel essai
automatique… » (le suivi reprend réellement — `scheduleNext()` n'est pas
concerné par ce correctif). Une `ApiClientError` continue d'afficher
`problem.detail ?? problem.title` sans aucun changement.

**Tests** : describe dédié sur la fonction pure (TypeError avec plusieurs
textes de navigateur, `ApiClientError`, `Error` quelconque, valeur non-
`Error`) ; un test à chaque point d'appel réel (`createOrderExportSubmit
Controller` avec une `TypeError('Failed to fetch')`, `startOrderExportPolling`
avec la même). RED confirmé contre le code d'avant ce correctif (le
contrôleur dispatchait littéralement « Failed to fetch », le suivi
notifiait littéralement « Failed to fetch »), GREEN après. Les tests
existants qui attendaient un message `Error` quelconque TEL QUEL (`new
Error('reseau')`, `new Error('order_export.pending_limit_reached: 3
demandes en cours')`) restent verts SANS MODIFICATION : ce ne sont pas des
`TypeError`, la branche « comportement inchangé » les couvre.

**Dette signalée, non corrigée dans ce lot** (hors périmètre exact du
signalement du coordinateur, « en deux endroits ») : `OrderExportPanel.tsx`
porte deux AUTRES points qui lisent `cause instanceof Error ? cause.message
: ...` de la même façon (l'échec de CHARGEMENT du registre au montage, et
l'échec de RAFRAÎCHISSEMENT de l'URL au clic sur « Télécharger ») — non
mentionnés par le défaut relevé en recette, non corrigés ici. Chemin de mise
en conformité : même fonction `resolveOrderExportUnreachableMessage()`,
déjà exportée, à appeler aux deux endroits avec un texte dédié.

### R4 — la ligne d'un export `expired` affichait « Expiré » deux fois (trouvé en cours de correctif des trois défauts ci-dessus)

**Le défaut.** `describeOrderExportStatus()` (colonne Statut) ET
`ORDER_EXPORT_DOWNLOAD_LABELS` (colonne Téléchargement, via `describe
OrderExportDownload()`) rendaient chacune « Expiré » pour le MÊME statut —
le panneau affichait les deux, sur la même ligne (« Excel (XLSX) · Une
ligne par commande recette.admin@magrit.local Expiré Expiré », relevé en
recette).

**Corrigé.** `ORDER_EXPORT_DOWNLOAD_LABELS.expired` vaut désormais `'—'`,
comme `not_ready`/`failed` : le statut suffit, la colonne Téléchargement
reste vide pour les trois cas non téléchargeables. Le cas `not_requester`
(« Prêt » au statut, « Demandé par un autre membre » au téléchargement)
est explicitement PRÉSERVÉ : ce sont deux informations DIFFÉRENTES, pas une
répétition, conformément à la consigne.

**Tests** : la table `it.each` de `describeOrderExportDownload` (déjà
existante, mutée : `expired` attend désormais `'—'`) et un test dédié sur
`describeOrExportRow` qui vérifie `row.status.label === 'Expiré'` ET
`row.download.label !== 'Expiré'` (`=== '—'`) pour un export `expired`, plus
un test de non-régression explicite sur le cas `not_requester` (« Prêt »
puis « Demandé par un autre membre », inchangé). RED confirmé contre le
code d'avant ce correctif (`row.download.label` valait `'Expiré'`), GREEN
après.

### Gates rejouées après R1 à R4

- RED confirmé, un par un, contre le code d'avant chaque correctif
  (édition manuelle via `git stash push -u` sur les seuls fichiers
  source concernés, restauration par `git stash apply` puis `git stash
  drop`, jamais de `pop`) : voir chaque section ci-dessus pour la preuve
  d'exécution.
- `pnpm typecheck` : **0 erreur**.
- `pnpm exec vitest run tests/modules/commercial-orders tests/modules/order-exports tests/adapters tests/server tests/platform/api` :
  **tous verts** (642 cas, 39 ignorés — inchangé, aucun rapport avec ce lot).
- `pnpm test:contract` : **23 fichiers, 432/432**, inchangé.
- `pnpm test:architecture` : **35 fichiers, 153/153**, inchangé.
- `pnpm gen:api:check` : **aligné**, aucune dérive — aucun fichier
  `openapi/` touché par ces quatre correctifs.
- `deno check --no-lock supabase/functions/magrit-api/index.ts` : **0
  erreur**.
- `pnpm test` (suite complète) : **267 fichiers passés, 2593 cas passés,
  86 ignorés, 0 échec.**

### Fichiers modifiés (R1 à R4)

- `src/adapters/supabase/order-exports-repository.ts` — R1 (troisième
  paramètre `publicBaseUrl`, `publicAssetUrl()` dans `toDto()`) ; R2
  (`mapRequestOrderExportError` ne recopie plus le message SQL brut).
- `src/modules/order-exports/application/order-exports-repository.ts` — R2
  (message par défaut français de `OrderExportPendingLimitReachedError`).
- `supabase/functions/magrit-api/index.ts` — R1 (`publicSupabaseUrl(request,
  supabaseUrl)` câblé en troisième argument de `SupabaseOrderExportsRepository`).
- `src/modules/commercial-orders/ui/components/order-export.helpers.ts` —
  R3 (`resolveOrderExportUnreachableMessage()`, nouvelle fonction pure,
  câblée dans `createOrderExportSubmitController()` et
  `startOrderExportPolling()`) ; R4 (`ORDER_EXPORT_DOWNLOAD_LABELS.expired`).
- `tests/adapters/supabase/order-exports-repository.test.ts` — +2 cas (R1).
- `tests/server/api/order-exports-routes.test.ts` — **NOUVEAU FICHIER**, 1
  cas (R2).
- `tests/modules/commercial-orders/order-export.helpers.test.ts` — +9 cas
  (R3 : describe dédié + 2 cas aux points d'appel réels ; R4 : 1 cas muté
  + 2 cas nouveaux), aucun test existant supprimé.

Aucun fichier `openapi/` ni `docs/api/CONVENTIONS.md` modifié par cet agent.
Aucune migration `supabase/migrations/` créée ou modifiée. Aucun navigateur
ni serveur de dev lancé par cet agent.
