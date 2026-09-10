---
id: E10.20b
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.20a]
blocks: []
---
# E10.20b — Le dépôt par le lien : dernière sous-story du lot E10.19/E10.20

Contrat déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.21/§8bis,
`openapi/magrit-core.v1.yaml` déjà à jour : `issueOrderUploadLinkFileUrl`,
`confirmOrderUploadLinkFile`, schémas `ConfirmOrderUploadLinkFileCommand`,
`OrderUploadLinkDeposit`, `OrderFileDepositChannel`, `OrderFilesSubmittedPayload`,
webhook `order.files_submitted`). **`openapi/magrit-core.v1.yaml` et
`tests/contract/_lint.ts` n'ont pas été touchés** (`git diff` vide sur les
deux, vérifié en fin de story ; `pnpm gen:api:check` vert).

Périmètre strict, tel que découpé au contrat (§8.21 §5, ligne E10.20b) :
`api_confirm_order_file_upload_by_link` (SQL), les deux opérations de dépôt
(`issueOrderUploadLinkFileUrl`/`confirmOrderUploadLinkFile`), émission de
`order.files_submitted`, `deposited_via` servi sur tous les fichiers, page
publique de dépôt, affichage à l'atelier de l'origine du fichier. E10.20a
(socle, 4ᵉ mode d'authentification) n'a pas été remis en cause.

## qa-review round 1 (« REJETÉ », faille de sécurité prouvée par exploitation réelle) → corrections

La première soumission a été **rejetée** avec une **vraie faille de sécurité
prouvée par exploitation réelle** (pas théorique) — priorité absolue posée
sur B1. Détail des deux bloquants et des corrections apportées :

### B1 — BLOQUANT SÉCURITÉ, CRITIQUE (corrigé)

**Constat exact, prouvé par la qa-review.** `api_confirm_order_file_upload_by_link`
était `grant execute ... to anon` et ne vérifiait **ni** l'existence de
l'objet dans le storage, **ni** le type MIME réel, **ni** la taille réelle :
elle insérait `p_filename`/`p_content_type`/`p_byte_size` tels que reçus en
paramètres. Conséquence prouvée : appel direct à
`POST /rest/v1/rpc/api_confirm_order_file_upload_by_link` avec la clé `anon`
publique (celle du bundle front) + un jeton de lien légitime → création
réussie d'une ligne `commercial_order_files` avec
`filename="facture-verolee.exe"`, `content_type="application/x-msdownload"`,
`byte_size=999999999999`, **sans qu'aucun octet n'ait été déposé**. Répété 9
fois pour saturer `max_files`. Conséquences : lignes fantômes qui font
planter `getOrderFile` (atelier) au téléchargement, données mensongères en
base malgré la promesse contractuelle, déni de service métier (3 liens
suffisent à saturer les 30 fichiers vivants d'une commande). Seul chemin
d'écriture métier ouvert à `anon` dans tout le lot E10.20 — 20a n'exposait à
`anon` que de la lecture.

**Corrigé, en DEUX temps cumulatifs (aucun ne suffit seul), tous deux prouvés
par exécution réelle (pas seulement relus)** :

1. **GRANT EXECUTE `service_role` UNIQUEMENT** (`revoke` explicite d'`anon`
   **et** d'`authenticated`) — la fonction n'est plus joignable par la clé
   publique. L'adaptateur (`order-upload-links-repository.ts`) appelle
   désormais cette RPC via `storageClient` (service_role), jamais
   `anonClient` — patron exact de la restriction d'`api_confirm_order_file_upload`
   (E10.17a, réservée à `authenticated`, jamais `anon`/`public`).
2. **Défense en profondeur réelle dans la fonction SQL elle-même.** La
   signature perd `p_content_type`/`p_byte_size` (réduite à
   `p_token`/`p_file_id`/`p_filename` — DROP explicite de l'ancienne
   signature à 5 paramètres, `create or replace` ne suffit pas à retirer une
   surcharge). La fonction relit désormais l'objet **réel** dans
   `storage.objects` (`metadata->>'size'`/`metadata->>'mimetype'`) et les
   limites **réelles** du bucket dans `storage.buckets`
   (`file_size_limit`/`allowed_mime_types`, jamais un second jeu de
   littéraux qui pourrait diverger silencieusement du bucket) : refuse si
   l'objet est **absent** (`order_file.upload_missing`), si son type est
   **hors liste fermée**, ou si son poids **dépasse le plafond du bucket**
   (`order_file.rejected` dans les deux cas) — codes RÉUTILISÉS d'E10.17a.

**Preuve par exploitation réelle, pas seulement relue** — vérifié à la main
contre Postgres local **avant** d'écrire le cas SQL formel, puis reproduit
dans `tests/sql/gescom-e10-20b-order-upload-link-deposit.sql` (scénarios
2bis/2ter/2quater) :
- appel direct sous `anon` (rôle simulé) avec un jeton légitime →
  `insufficient_privilege`, avant même l'examen du jeton (GRANT fermé) ;
- appel sous `service_role` (le seul rôle habilité), jeton et `file_id`
  valides, **aucun objet déposé** → `order_file.upload_missing`, **aucune
  ligne fantôme créée** (vérifié explicitement en base) ;
- objet **inséré directement dans `storage.objects`** (le `PUT` normal ne
  peut pas produire un tel objet — le bucket refuse déjà ces cas à l'upload,
  ce test prouve que la fonction reste correcte **indépendamment de la
  source de la ligne**) avec un type hors liste (`application/x-msdownload`)
  → `order_file.rejected`, aucune ligne créée ;
- même chose avec un poids mensonger (999999999999 octets, type par
  ailleurs accepté) → `order_file.rejected`, aucune ligne créée, `deposited_count`
  du lien resté à 0 après les deux refus (zéro effet de bord).

L'adaptateur (`confirmFileUpload`) et le mappeur d'erreurs
(`mapOrderUploadLinkFileError`) ont été mis à jour en conséquence :
`order_file.upload_missing`/`order_file.rejected` sont désormais aussi levés
par la fonction SQL elle-même (le contrôle côté adaptateur, via `info()`,
redevient un **confort** — message d'erreur rapide sans attendre
l'aller-retour SQL — la garde qui **compte** est dans la fonction).

### B2 — BLOQUANT FONCTIONNEL (corrigé)

**Constat exact.** Dans `UploadLinkDepositPage.tsx`, le billet était posé en
état **avant** le `PUT` réussi, et le prédicat de reprise
(`resumeFromConfirm: pending.status === 'error' && pending.ticket !== undefined`)
ne distinguait pas « l'upload a échoué » de « l'upload a réussi mais la
confirmation a échoué ». Scénario qui casse : un client perd le réseau
**pendant** l'envoi d'un fichier de 30 Mo → `pending.ticket` est déjà défini
(posé dès l'émission du billet, avant le `PUT`) → le clic « Réessayer »
saute le `PUT` et appelle directement `confirmFile` → 404
`order_file.upload_missing` → message affiché à tort « le fichier a été
transmis mais n'a pas pu être enregistré » → chaque nouveau clic reproduit
le même échec, client bloqué jusqu'au rechargement complet de la page.

**Corrigé** — `PendingDeposit` porte désormais `uploaded?: boolean`, posé
`false` dès l'émission du billet et **uniquement** passé à `true` juste
après un `PUT` réellement abouti. `retryPending()` ne reprend à la
confirmation (`resumeFromConfirm: true`, même billet, même clé
d'idempotence) **que** si `uploaded === true` ; sinon il relance un envoi
**complet** (nouveau billet, nouveau `PUT`). En plus : si la confirmation
échoue avec `order_file.upload_missing` **après** un `PUT` cru réussi (cas
résiduel — TOCTOU, objet orphelin), le billet/la clé/le drapeau `uploaded`
sont explicitement réinitialisés dans l'état d'erreur, pour qu'un nouveau
« Réessayer » reparte d'un envoi complet plutôt que de rejouer la même
confirmation vouée au même échec en boucle. `describeUploadLinkDepositFailure`
gère désormais `order_file.upload_missing` avec un message **dédié**
(`errorUploadMissing`), distinct d'`errorConfirmFailed` qui affirme à tort
qu'un transfert a eu lieu — prouvé par un test dédié
(`result.message).not.toBe(errorConfirmFailed)`).

### Majeurs — traités ou documentés comme demandé

- **M1 (non implémenté, documenté — hors périmètre contractuel actuel)** :
  `issueOrderUploadLinkFileUrl` n'a aucun frein sur le nombre de billets
  émis non confirmés — un porteur de lien peut générer des billets à
  l'infini et remplir le bucket d'objets jamais confirmés (le contrat dit
  « sans confirmation les octets sont ignorés », pas « supprimés »). Aucune
  purge/garbage collection n'existe. Voir dette **D7**.
- **M2 (corrigé)** : `filename` n'était filtré nulle part (caractères de
  contrôle acceptés, alimentent `Content-Disposition` via `createSignedUrl`
  en aval). Corrigé aux DEUX endroits demandés : schéma Zod
  (`confirmOrderUploadLinkFileCommandSchema.filename`, regex
  `/^[^\x00-\x1F\x7F]+$/`) **et** contrainte `CHECK` SQL
  (`commercial_order_files_filename_check`, `filename !~ '[[:cntrl:]]'`,
  `drop`/`add` — Postgres ne permet pas de modifier l'expression d'une
  contrainte existante). Prouvé par un test de contrat dédié (tabulation
  intérieure, non retirée par `.trim()`, → 422 `api.validation_failed`).
- **M3 (non corrigé, documenté)** : `createSignedUploadUrl` avec
  `upsert: true` et un billet valide ~2h permet à un porteur de lien de
  remplacer le contenu d'un fichier déjà valide après coup. Hérité du
  patron 17a, mais l'acteur y était un membre nommé — ici il est anonyme.
  Voir dette **D8**.
- **M4 (documenté)** : ordre de déploiement obligatoire — la migration
  `20260910000400` (qui ajoute `deposited_via` **et** corrige la fonction de
  confirmation) **doit** être déployée **avant** le redéploiement de l'edge
  function `magrit-api`, sinon `listOrderFiles` (déjà en service depuis
  E10.17b) casse en erreur (colonne attendue absente). Voir dette **D9**.

### Mineurs — tous corrigés

- **N1** : `depositAnotherBtn` déclaré mais porté par aucun bouton — la
  dropzone réapparaît déjà automatiquement après un dépôt réussi
  (`!atCapacity && !pending`), aucun second geste n'est nécessaire. Testid
  **retiré** de `testIds.ts` et de la copie.
- **N2** : `isUploadLinkInvalidFailure` exportée/testée mais jamais appelée
  dans la page — **désormais utilisée** dans les deux `catch` de
  `runDeposit` (émission du billet, confirmation), au lieu de dupliquer la
  condition `cause instanceof ApiClientError && cause.problem.code === 'upload_link.invalid'`.
- **N5** : le plafond de 30 existait en plusieurs exemplaires dispersés
  (littéral `30` dans `order-files-repository.issueUploadUrl`, constante
  locale `ORDER_FILE_LIVE_LIMIT` dupliquée dans `order-upload-links-repository.ts`).
  **Regroupé** en une seule constante exportée `ORDER_FILE_LIVE_LIMIT`
  (`order-files-repository.ts`), réutilisée par `order-upload-links-repository.ts`.
  La copie UI (`order-files.helpers.ts`, `ORDER_FILE_MAX_COUNT`) **reste
  séparée** (une UI de module ne peut pas importer depuis `adapters/` —
  frontière MUX) mais porte désormais un commentaire explicite de
  synchronisation. Les littéraux SQL (deux fonctions `security definer`
  distinctes, 17a inchangée + 20b) restent des littéraux : Postgres n'a pas
  de mécanisme de constante partagée aussi simple qu'un module TypeScript,
  et toucher la fonction 17a déjà livrée est hors périmètre.

## Critères d'acceptation transmis, tenus un par un

1. **`issueOrderUploadLinkFileUrl` : réutilise le mécanisme d'`order-files`, plafonds appliqués.** — **fait.** Patron exact d'`issueUploadUrl` (E10.17a) : `file_id` alloué, URL signée, aucune ligne créée. `ACCEPTED_CONTENT_TYPES`/`MAX_UPLOAD_BYTE_SIZE`/`ORDER_FILE_LIVE_LIMIT` **réutilisées telles quelles** (exportées depuis `order-files-repository.ts`, aucune seconde constante — voir N5). Les DEUX plafonds (lien `max_files`/`deposited_count`, commande 30 fichiers vivants) sont vérifiés ici **par courtoisie**, sous `storageClient` (service_role, bypass RLS — ce repository n'a aucun JWT membre). Vérifié par 2 tests de contrat + le scénario 5/6 du cas SQL (la barrière qui compte).
2. **`confirmOrderUploadLinkFile` : nouvelle fonction SQL propre, pas de réutilisation forcée d'`api_confirm_order_file_upload`.** — **fait, et durci en round 1.** `api_confirm_order_file_upload_by_link` est une **seconde** fonction, DISTINCTE, qui prend son libellé du **lien** (`deposited_by_label` composé : « Dépôt client — *label* » ou « Dépôt client par lien ») et re-vérifie le jeton elle-même — jamais `auth.uid()`. `api_confirm_order_file_upload` (E10.17a) n'a pas été rouverte. **Depuis le correctif B1**, elle ne fait plus non plus confiance aux paramètres de type/poids : elle les relit de l'objet réel. Le fichier confirmé apparaît dans `listOrderFiles` (E10.17a/17b, même table `commercial_order_files`) avec `deposited_by: null`, `deposited_via: 'upload_link'` — badge dédié ajouté à `OrderFilesBlock.tsx` (`data-testid: order-files-upload-link-badge`), jamais déduit de `deposited_by_label` (interdiction contractuelle respectée).
3. **`order.files_submitted` émis via `outbox_events`, une fois par fichier.** — **fait.** `OrderUploadLinksService.confirmFileUpload()` publie l'événement **après** l'écriture du repository (même dette M2/§8.2 déjà acceptée que `quote.created`/`quote.sent`), avec `file_id`/`upload_link_id`/`order_id`/`order_number`/`customer_id`. Aucune notification/consommation ajoutée : le contrat ne décrit aucun consommateur pour cet événement (E10.15 non livrée) — `outbox-dispatch-composition.ts` n'a **pas** été modifié. Vérifié par un test de contrat qui compte les événements publiés (1 par dépôt, pas de second sur rejeu idempotent).
4. **Opération PUBLIQUE, même rigueur de sécurité qu'E10.20a ; `Idempotency-Key` dérivée via `deriveUploadLinkIdempotencyStorageKey` déjà écrite en E10.20a ; plafonds appliqués côté serveur.** — **fait, et la rigueur de sécurité a été RÉELLEMENT vérifiée par la qa-review (round 1), qui a trouvé un écart et forcé sa correction (B1).** Les deux routes déclarent `authentication: 'upload_link'` (cloisonnement fermé dans les deux sens, prouvé par E10.20a et re-testé ici). `confirmOrderUploadLinkFile` déclare `createsResource: true` : `deriveUploadLinkIdempotencyStorageKey(linkId, key)` a son premier appelant réel, inchangée. Les deux plafonds ET désormais le type/poids réels sont vérifiés **sous verrou** dans la fonction SQL, jamais seulement côté client. RLS : aucune nouvelle table ; la seule colonne neuve (`deposited_via`) est couverte par la policy déjà en place ; le CHECK de `filename` a été durci (M2).
5. **Page publique de dépôt sur `/depot/:token`, réutilisant si possible `OrderFilesBlock` sans dupliquer inutilement, sans rien qui suppose une session workspace.** — **fait, avec un écart assumé documenté ci-dessous, et corrigé pour le blocage B2.** `UploadLinkDepositPage.tsx` montée sous `StorefrontRuntimeBoundary` (aucune identité Magrit). Réutilise réellement le code critique d'`order-files` : `resolveOrderFileContentType`/`supportedOrderFileExtensions` et `uploadFileToSignedUrl` (extrait dans `signed-upload.ts`, les deux clients délèguent au même helper). **N'importe PAS `OrderFilesBlock`** : trop couplé aux gestes d'atelier (ETag, visibilité, suppression, liste) — l'importer aurait exigé d'en désactiver la moitié, moins robuste qu'une page neuve et courte.
6. **Migration Supabase.** — **fait, réécrite en round 1 (B1/M2).** `20260910000400_gescom_e10_20b_order_upload_link_deposit.sql`, réversible, **rejouée réellement** (`pnpm db:local:reset` complet, plusieurs fois pendant la correction, 0 erreur) et testée par `tests/sql/gescom-e10-20b-order-upload-link-deposit.sql` (12 groupes de scénarios, dont 3 nouveaux prouvant B1 par exploitation réelle).
7. **Retrait/adaptation de l'avertissement `depotPageNotReadyNotice` posé en E10.20a.** — **fait.** Bloc et `data-testid` retirés de `OrderUploadLinksPanel.tsx`/`testIds.ts`.

## Écart de méthode signalé, pas tranché seul : `deposited_via` reste `optional` dans les schémas Zod

Le contrat (§8.21 §8bis, « note de méthode ») **prescrit** que cette
sous-story promeuve `OrderFile.deposited_via`/`OrderFileDetail.deposited_via`
de `optional` à `required` dans **l'OpenAPI**, maintenant qu'un émetteur
existe. **Cette promotion n'a pas été faite** : `openapi/magrit-core.v1.yaml`
est le domaine exclusif de l'agent `architecte`, et la tâche transmise
l'interdit explicitement à `dev-story`. Voir dette **D1**.

## Ce qui est livré

| Élément | Détail |
|---|---|
| **Migration `20260910000400`** | `commercial_order_files.deposited_via` (`text not null default 'workspace'`, check `workspace`/`upload_link` — ADDITIF, `api_confirm_order_file_upload` d'E10.17a inchangée). `commercial_order_files_filename_check` DURCI (M2, refus des caractères de contrôle). Fonction `api_confirm_order_file_upload_by_link(p_token, p_file_id, p_filename)` — **signature réduite en round 1** (B1 : `p_content_type`/`p_byte_size` retirés), re-vérifie le jeton, verrou consultatif **PARTAGÉ** avec `api_confirm_order_file_upload` (même clé — les deux voies d'entrée se sérialisent sur le MÊME plafond de 30), **relit l'objet réel dans `storage.objects`/`storage.buckets`** (B1, défense en profondeur), incrémente `deposited_count` atomiquement, `deposited_by` NUL, `visibility`/`order_line_id` figés. **GRANT EXECUTE `service_role` UNIQUEMENT** (B1 — `anon` retiré, faille fermée). |
| **Module `order-upload-links`** | `api/contracts.ts` : `confirmOrderUploadLinkFileCommandSchema` (filename filtré, M2), `orderUploadLinkDepositSchema` ; réexporte `OrderFileUploadTicket` d'`order-files`. `application/order-upload-links-repository.ts` : `issueFileUploadUrl`/`confirmFileUpload`, `OrderUploadLinkFileLimitReachedError`, `ConfirmOrderUploadLinkFileResult`. `application/order-upload-links-service.ts` : dépendance `outbox: OutboxPublisher` (changement de signature de constructeur, tous les appelants mis à jour), `confirmFileUpload()` publie `order.files_submitted` après l'écriture. |
| **Adaptateur Supabase** | `order-upload-links-repository.ts` reçoit un **troisième client** (`storageClient`, service_role, réutilisé). `resolveLinkForDeposit()` (privé) réutilise `api_resolve_order_upload_link_principal` (E10.20a) pour reformer le chemin de stockage. **`confirmFileUpload` appelle désormais la RPC via `storageClient`, jamais `anonClient`, sans `p_content_type`/`p_byte_size`** (B1). `storagePathFor`/`decodeSignedUploadTicketExpiry`/`BUCKET`/`ORDER_FILE_LIVE_LIMIT` **exportés** depuis `order-files-repository.ts` (E10.17a, N5) et réutilisés tels quels. |
| **Routes** | `issueOrderUploadLinkFileUrl` (200) et `confirmOrderUploadLinkFile` (201, `createsResource: true`) enregistrées. Traduction d'erreurs : `upload_link.invalid` (401), `upload_link.file_limit_reached` (409), `order_file.already_confirmed` (409), `order_file.upload_missing` (404), `order_file.rejected` (422) — tous codes RÉUTILISÉS. |
| **Édge function** | `supabase/functions/magrit-api/index.ts` : `SupabaseOrderUploadLinksRepository` reçoit `documentTemplatesStorageClient` en troisième argument ; `OrderUploadLinksService` reçoit un `OutboxPublisher`. **Ordre de déploiement OBLIGATOIRE : migration AVANT edge function (M4, dette D9).** |
| **UI** | `UploadLinkDepositPage.tsx`, montée sur `/depot/:token` sous `StorefrontRuntimeBoundary`. `upload-link-deposit.helpers.ts` — **corrigé en round 1 (B2)** : `errorUploadMissing` dédié, `isUploadMissingFailure`, `isUploadLinkInvalidFailure` désormais utilisée (N2). `OrderUploadLinkDepositApiClient` : jeton en en-tête `X-Magrit-Upload-Link`. `signed-upload.ts` réutilisé par les deux clients. Badge `deposited_via: upload_link` sur `OrderFilesBlock.tsx`. |
| **Retiré** | `OrderUploadLinksPanel` : bloc et testid `depotPageNotReadyNotice` (CA7). `testIds.uploadLinkDepot.depositAnotherBtn` (N1). |

## Décisions de conception notables

- **Deux plafonds, un seul verrou consultatif partagé.** La fonction SQL
  prend délibérément la **même** clé d'`pg_advisory_xact_lock` que
  `api_confirm_order_file_upload` (E10.17a), plutôt qu'une clé propre. Deux
  clés distinctes auraient permis à un dépôt atelier et un dépôt par lien de
  s'exécuter en parallèle et de compter chacun 29 fichiers vivants avant que
  l'un des deux n'insère. Prouvé par le scénario 6 du cas SQL.
- **La fonction SQL relit l'objet réel plutôt que de faire confiance à
  l'appelant, même privilégié (B1).** Le GRANT `service_role` seul aurait
  suffi à fermer l'exploitation prouvée par la qa-review (un appelant public
  ne peut plus l'atteindre) ; la relecture de `storage.objects`/`storage.buckets`
  est une **seconde** barrière indépendante, qui protège aussi contre un bug
  futur de l'adaptateur (qui n'aurait pas fait son propre `info()`) — défense
  en profondeur réelle, pas décorative : prouvée par insertion **directe**
  dans `storage.objects` (hors du `PUT` normal, que le bucket bloque déjà
  pour ces cas), pour tester la fonction indépendamment de la source de la
  ligne.
- **`uploaded: boolean` distinct de `ticket !== undefined` (B2).** Un billet
  existe dès son émission, **avant** toute tentative de `PUT` — sa seule
  présence ne prouve jamais qu'un envoi a eu lieu. Séparer explicitement
  « un billet existe » de « le PUT a réussi » est ce qui rend la reprise
  après une perte réseau correcte plutôt que bloquante.
- **`OrderUploadLinkDepositApiClient` distinct d'`OrderUploadLinksApiClient`**
  dans le même fichier `client.ts` : le premier ne prend jamais de jeton
  utilisateur, le second n'a jamais accès à l'en-tête de lien.

## Dette introduite

| Réf. | Point | Chemin de mise en conformité |
|---|---|---|
| **D1** | `OrderFile.deposited_via`/`OrderFileDetail.deposited_via` restent `optional` dans l'OpenAPI alors que le contrat (§8.21 §8bis) prescrit leur promotion en `required`. Non fait ICI : `openapi/` est le domaine exclusif de l'agent `architecte`. | À faire par l'agent `architecte` — promotion `optional → required` (compatible CA13). Retirer `.optional()` des deux schémas Zod dans la même story. |
| **D2** | `confirmFileUpload` résout le lien DEUX fois (une fois côté adaptateur pour calculer le chemin de stockage, une seconde fois à l'intérieur de la fonction SQL, qui re-vérifie le jeton sous verrou). Accepté comme le coût du modèle « jamais confiance dans un identifiant déjà résolu ». | Non prioritaire : mesurer le coût réel en production avant d'envisager de le réduire. |
| **D3 (héritée, sans rapport)** | `tests/storage/product_mockups_isolation.test.ts` échoue (3 tests, « Bucket not found »). Confirmé **pré-existant** par `git stash` + rejeu, identique avant toute modification de cette story. | Hors périmètre. |
| **D4 (héritée, sans rapport)** | `pnpm test:storefront:sql` (script complet, séquentiel, `set -e`) échoue dès `tests/sql/legacy-shop-only-write-freeze.sql` (rôle `owner` refusé par un check UM1) — confirmé **pré-existant** par `git stash` + rejeu identique. Plusieurs cas SQL antérieurs exigent un état de base « vécu » (utilisateurs Auth accumulés) plutôt qu'un reset strict. Le cas de cette story a été rejoué avec succès individuellement, en séquence avec ses dépendances (`17a`/`19a`/`19b`/`20a`), et à plusieurs reprises après `pnpm db:local:reset` complet pendant la correction B1/M2. | Hors périmètre — signalé pour qu'il ne soit pas reperdu. |
| **D5 (héritée, sans rapport)** | `pnpm typecheck:all` porte une classe d'erreurs pré-existante déjà documentée par E10.19b/E10.20a (`Id<string>`/`brand<T>()`, `Property 'error'` sur un résultat discriminé…) — confirmé pré-existant par `git stash` + rejeu. | Hors périmètre. `pnpm typecheck` (`tsconfig.modular.json`, alias CI-bloquant) reste **vert, 0 erreur**. |
| **D6** | Aucun test de composant React (RTL) pour `UploadLinkDepositPage`/`OrderFilesBlock` (badge). Conforme au précédent établi (aucun framework de test de composant dans le dépôt). | Testids posés selon la convention, à faire confirmer par le `scribe`/Sally dès que le cahier TF existera. |
| **D7 (M1, signalé, non implémenté)** | `issueOrderUploadLinkFileUrl` n'a aucun frein sur le nombre de billets émis non confirmés : un porteur de lien peut générer des billets à l'infini et remplir le bucket d'objets jamais confirmés (le contrat dit « sans confirmation les octets sont ignorés », pas « supprimés » — aucune garbage collection). | À remonter à l'agent `architecte` : décider d'une politique de purge (ex. tâche planifiée qui retire les objets orphelins de `commercial_order_files`/lien plus vieux qu'un délai), hors périmètre contractuel actuel de ce lot. |
| **D8 (M3, signalé, non corrigé)** | `createSignedUploadUrl` avec `upsert: true` et un billet valide ~2h permet à un porteur de lien de remplacer le contenu d'un fichier déjà valide après coup, tant que la confirmation n'a pas eu lieu. Hérité du patron 17a (mêmes paramètres), mais l'acteur y était un membre nommé — ici il est anonyme. | Correction rapide possible (`upsert: false` sur ce chemin précis) mais change le comportement de reprise après un échec réseau (un second `PUT` sur le même `file_id` échouerait). Pas fait sans arbitrage explicite du produit : à remonter à l'architecte/Arnaud. |
| **D9 (M4, signalé)** | Ordre de déploiement **obligatoire** : la migration `20260910000400` (colonne `deposited_via` + fonction de confirmation corrigée) doit être déployée **avant** le redéploiement de l'edge function `magrit-api`, sinon `listOrderFiles` (déjà en service depuis E10.17b, qui sélectionne désormais `deposited_via` dans `FILE_COLUMNS`) casse en erreur (colonne attendue absente en base). | À vérifier explicitement au déploiement réel (pipeline CI/CD ou procédure manuelle) — pas un problème de code, un problème de séquencement d'infrastructure. |

## Tests exécutés

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (`tsconfig.modular.json`) | **vert**, 0 erreur (rejoué après B1/B2/M2/N5) |
| `pnpm typecheck:all` (`tsconfig.json`) | Aucune erreur nouvelle imputable à cette story (voir D5) |
| `pnpm gen:api:check` | **vert**, aligné — `openapi/magrit-core.v1.yaml` non touché |
| `git diff --stat openapi/magrit-core.v1.yaml tests/contract/_lint.ts` | **vide**, confirmé après correction |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests |
| `pnpm test:contract` | **vert**, 20 fichiers / **381 tests** (order-upload-links.contract.test.ts : **27 tests**, +1 pour M2 depuis la remise initiale) |
| `pnpm exec vitest run tests/modules/order-upload-links/upload-link-deposit.helpers.test.ts` | **vert**, **15 tests** (+3 pour B2/N2 depuis la remise initiale : `errorUploadMissing` dédié, `isUploadMissingFailure`) |
| `pnpm exec vitest run` (suite complète) | **2063 passés / 36 skip / 3 échecs** — les 3 échecs restent `tests/storage/product_mockups_isolation.test.ts`, préexistants, sans rapport (D3) |
| `pnpm db:local:reset` (88 migrations) | **0 erreur**, rejoué **4 fois** pendant la correction (B1 : DROP+CREATE de la fonction à signature réduite ; M2 : DROP+ADD du CHECK filename) — la migration reste applicable proprement de bout en bout |
| `tests/sql/gescom-e10-20b-order-upload-link-deposit.sql` | **RÉÉCRIT** (round 1) : **12 groupes de scénarios** (9 initiaux + 3 nouveaux 2bis/2ter/2quater prouvant B1 par exploitation réelle — anon refusé au GRANT, objet absent refusé, objet illégitime inséré directement dans `storage.objects` refusé pour type ET pour poids). Rejoué réellement **plusieurs fois** : **0 erreur**, `ROLLBACK` propre |
| `tests/sql/gescom-e10-17a-order-files.sql`, `-19a-order-document-template.sql`, `-19b-order-documents.sql`, `-20a-order-upload-links.sql` rejoués après le correctif | **0 erreur**, aucune régression (vérifié après le durcissement du CHECK `filename` partagé par `commercial_order_files`) |
| Exploitation manuelle du scénario qa-review (curl PUT réel sur un objet `.exe` refusé par le bucket ; probes SQL directes anon/service_role) | Exploit initial **reproduit puis fermé** ; nettoyage des fixtures de probe effectué (`pnpm db:local:reset`) |

## Fichiers créés/modifiés

**Créés** :
- `supabase/migrations/20260910000400_gescom_e10_20b_order_upload_link_deposit.sql`
- `src/modules/order-files/api/signed-upload.ts`
- `src/modules/order-upload-links/ui/UploadLinkDepositPage.tsx`
- `src/modules/order-upload-links/ui/upload-link-deposit.helpers.ts`
- `tests/sql/gescom-e10-20b-order-upload-link-deposit.sql`
- `tests/modules/order-upload-links/upload-link-deposit.helpers.test.ts`

**Modifiés (remise initiale + round 1)** :
- `src/adapters/supabase/order-files-repository.ts` (`BUCKET`/`storagePathFor`/`decodeSignedUploadTicketExpiry` exportés ; `deposited_via` ajouté à `FILE_COLUMNS`/`toFileDto`/`toDetailDto` ; **round 1 (N5)** : `ORDER_FILE_LIVE_LIMIT` exportée et réutilisée dans `issueUploadUrl`)
- `src/adapters/supabase/order-upload-links-repository.ts` (troisième client `storageClient` ; **round 1 (B1)** : `confirmFileUpload` appelle la RPC via `storageClient` sans `p_content_type`/`p_byte_size` ; `mapOrderUploadLinkFileError` étendu ; **round 1 (N5)** : `ORDER_FILE_LIVE_LIMIT` importée plutôt que dupliquée)
- `src/app/routes.tsx` (route `/depot/:token` sous `StorefrontRuntimeBoundary`)
- `src/modules/order-files/api/client.ts` (délègue à `signed-upload.ts`)
- `src/modules/order-files/api/contracts.ts` (`orderFileDepositChannelSchema`, `deposited_via` optionnel)
- `src/modules/order-files/index.ts` (exports `uploadFileToSignedUrl`, `orderFileDepositChannelSchema`, `OrderFileDepositChannel`)
- `src/modules/order-files/ui/OrderFilesBlock.tsx` (badge `deposited_via: upload_link`)
- `src/modules/order-files/ui/order-files.helpers.ts` (copie du badge ; **round 1 (N5)** : commentaire de synchronisation sur `ORDER_FILE_MAX_COUNT`)
- `src/modules/order-upload-links/api/client.ts` (`OrderUploadLinkDepositApiClient`)
- `src/modules/order-upload-links/api/contracts.ts` (`confirmOrderUploadLinkFileCommandSchema` ; **round 1 (M2)** : `filename` filtré des caractères de contrôle ; `orderUploadLinkDepositSchema`)
- `src/modules/order-upload-links/application/order-upload-links-repository.ts` (port étendu, `OrderUploadLinkFileLimitReachedError`, `ConfirmOrderUploadLinkFileResult`)
- `src/modules/order-upload-links/application/order-upload-links-service.ts` (dépendance `outbox`, `issueFileUploadUrl`/`confirmFileUpload`)
- `src/modules/order-upload-links/ui/OrderUploadLinksPanel.tsx` (retrait de l'avertissement CA7)
- `src/modules/order-upload-links/ui/UploadLinkDepositPage.tsx` (**round 1 (B2/N2)** : `uploaded` distinct de `ticket !== undefined`, reset du billet sur `order_file.upload_missing`, `isUploadLinkInvalidFailure` réutilisée)
- `src/modules/order-upload-links/ui/upload-link-deposit.helpers.ts` (**round 1 (B2/N1)** : `errorUploadMissing`, `isUploadMissingFailure`, retrait de `depositAnotherBtn`)
- `src/modules/order-upload-links/ui/index.ts` (export `UploadLinkDepositPage`)
- `src/server/api/order-upload-links-routes.ts` (deux routes enregistrées)
- `src/shared/presentation/testIds.ts` (scope `uploadLinkDepot`, badge `orderFiles.uploadLinkBadge`, retrait de `depotPageNotReadyNotice` et **round 1 (N1)** `depositAnotherBtn`)
- `supabase/functions/magrit-api/index.ts` (composition : troisième client, `OutboxPublisher`)
- `scripts/test-storefront-sql.sh` (ajout du cas SQL de ce lot)
- `tests/contract/_fakes/order-files-repository.fake.ts` (`deposited_via: 'workspace'`)
- `tests/contract/_fakes/order-upload-links-repository.fake.ts` (`issueFileUploadUrl`/`confirmFileUpload`, `stageUploadForTest`, `seedLiveFileCountForTest`)
- `tests/contract/order-upload-links.contract.test.ts` (outbox de test, tests de dépôt ; **round 1 (M2)** : test filename avec caractère de contrôle)

**Non touchés (rappel R5)** : `openapi/magrit-core.v1.yaml`,
`src/platform/api/generated/magrit-core.v1.ts`, `tests/contract/_lint.ts` —
le contrat et son lint étaient déjà écrits par l'architecte ; le seul écart
constaté (D1, promotion `deposited_via` en `required`) est une dette
signalée, pas un défaut corrigé sans mandat. `pnpm gen:api:check` confirme
l'alignement.

## Fin de lot

E10.20b est la dernière sous-story du lot cadré par l'architecte le
2026-09-10 (§8.21). Avec cette livraison **corrigée** (round 1 de qa-review,
B1/B2 fermés), **E10.19a, E10.19b, E10.20a et E10.20b sont toutes livrées** :
le lot bon de commande PDF + lien public de dépôt est clos, sous réserve
d'une **nouvelle revue `qa-review`** (cette soumission n'a pas encore été
validée) et des dettes D1 (promotion de contrat, domaine `architecte`),
D7/D8/D9 (M1/M3/M4, signalées, non implémentées par mandat explicite de la
qa-review).
