---
id: E10.17a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.12, E10.16]
blocks: [E10.17b]
---
# E10.17a — Fichiers d'une commande : contrat servi (base + API)

Contrat écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.19, trois
arbitrages d'Arnaud du 2026-09-09 : plafond de 50 Mo confirmé comme périmètre,
ZIP autorisé, suppression ouverte à tout membre). Périmètre **strict** de
cette sous-story, repris tel que découpé au contrat (§8.19 §5) : migration,
module `order-files` (`api/` + `application/`), adaptateur, routes, **les
six opérations**, tests de contrat, tests SQL réels. **Aucune UI** — c'est
E10.17b, qui n'a pas démarré.

**Cette story a fait l'objet d'un round de `qa-review` "Changes Requested"**
(une réserve bloquante B1, six non bloquantes N1-N6), traité en intégralité —
voir la section dédiée ci-dessous.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260909060000` | Index unique `(order_id, id)` sur `commercial_order_lines` (prérequis à la clé composite). Table **neuve** `commercial_order_files` (`id`, `order_id`, `order_line_id` nullable, `filename`, `content_type`, `byte_size`, `visibility` `internal`/`customer` défaut `internal`, `storage_path`, `deposited_by`/`deposited_by_label`, `deposited_at`, `updated_at`, `deleted_at`/`deleted_by`/`deleted_by_label`). **Pas de colonne `tenant_id`** (écart assumé avec `document_pdf_templates`, tenant lu par jointure sur `commercial_orders`, même parti que `commercial_order_step_changes`). Clé étrangère **composite** `(order_id, order_line_id) -> commercial_order_lines(order_id, id)` : une ligne d'une autre commande est **structurellement impossible**. Contrainte `check` sur la **forme** du chemin de stockage. Bucket Storage **privé** `commercial_order_files`, 50 Mo, sept types MIME (cinq usuels + `application/zip`/`application/x-zip-compressed`), aucune policy `storage.objects`. `revoke insert, update, delete ... from authenticated, anon` — motif explicitement **pas** l'append-only (la table est mutable), c'est la fermeture du chemin PostgREST direct. Trois fonctions `security definer` (`api_confirm_order_file_upload`, `api_update_order_file_visibility`, `api_delete_order_file`), **aucune garde de capability**, appartenance au tenant seule vérifiée, **aucun paramètre de libellé d'auteur** (voir B1 ci-dessous). Migration **appliquée réellement** en local par reset complet (`pnpm db:local:reset`), 0 erreur. |
| RLS | `commercial_order_files_select` — lecture **ouverte à tout membre du tenant** (jointure sur `commercial_orders`), aucune clause `user_has_capability`. **Aucune policy d'écriture** : contrairement à `document_pdf_templates`, **même un admin ne peut pas écrire directement** — la seule voie est les trois fonctions `security definer`. Vérifié par exécution SQL réelle (scénario 4 du fichier de test, assertion explicite sur le `DELETE` direct depuis le round qa-review), pas seulement déclaré. |
| Module `order-files` (`api/` + `application/`) | `api/contracts.ts` (schémas Zod miroir du contrat + alignement de compilation), `api/content-type-map.ts` (correspondance **fermée** extension→MIME, consigne opposable à 17b), `api/client.ts` (`uploadOrderFile()` = `fetch(url, {method:'PUT'})` **nu**, `Content-Type` posé depuis l'extension, jamais `File.type`), `application/order-files-repository.ts` (port + huit erreurs de domaine + `findRawById`, ajouté au round qa-review), `application/order-files-service.ts` (orchestration pure, **aucune garde de capability**, `getRawById` ajouté), `index.ts`. **Aucun `manifest.ts`/`surface-contributions.ts`/`ui/`** : pas de capability à déclarer, pas d'écran dans ce lot (même parti que `quote-documents`, module serveur pur). |
| Adaptateur Supabase | `src/adapters/supabase/order-files-repository.ts` — deux clients distincts (`client` JWT appelant, `storageClient` `service_role` **réutilisé** de `documentTemplatesStorageClient`, aucune spécificité de bucket). Chemin de stockage **TOUJOURS recalculé** `tenantId/orderId/fileId`, jamais lu d'une colonne ni reçu en paramètre de la fonction SQL — y compris dans `findRawById()` (nouveau) et re-confirmé par test dédié sur `findById`/`remove()` (N3). `confirmUpload()` relit la métadonnée (`info(path)`, sans transférer les octets), vérifie type/poids en défense en profondeur (le bucket refuse déjà ces cas au `PUT`), retire l'objet avant de rejeter si hors bornes. `remove()` respecte l'ordre **prescrit** : ligne (RPC transactionnel) puis objet de stockage (best-effort, échec journalisé via `console.error`, jamais renvoyé à l'appelant HTTP). `FILE_COLUMNS` ne sélectionne plus `storage_path` (N4). |
| Routes | `src/server/api/order-files-routes.ts` — les **six** opérations. `issueOrderFileUploadUrl`/`confirmOrderFileUpload`/`updateOrderFile`/`deleteOrderFile` réservées à `authentication: 'user'` (jamais une clé de service, décision #5) ; `listOrderFiles`/`getOrderFile` ouvertes au jeton utilisateur et aux clés `orders:read`. `deleteOrderFile` rend un **204 sans corps** — premier `operationId` de cette facade à le faire réellement. `updateOrderFile` calcule désormais sa précondition `If-Match` via `service.getRawById()` (sans signature d'URL Storage), plus par `service.getById()` — voir N6. Enregistré dans `gescom-routes.ts` (`GescomServices.orderFiles`). |
| Câblage edge function | `supabase/functions/magrit-api/index.ts` — `SupabaseOrderFilesRepository` construit sur `client` + `documentTemplatesStorageClient` **réutilisé**, `OrderFilesService` injecté dans `gescomServices`. `deno check supabase/functions/magrit-api/index.ts` : **0 erreur**. |
| Correctif transverse | `src/server/api/gescom-middleware.ts` (`renderSuccess`) et `tests/contract/_harness.ts` (`checkResponseAgainstContract`) — voir « Écart trouvé » ci-dessous (inchangé depuis la remise initiale, non concerné par le round qa-review). |

## qa-review round 1 (« Changes Requested ») → corrections

### B1 — BLOQUANT, trace d'audit forgeable → corrigé

**Constat de la qa-review, confirmé exact.** `p_actor_label` **écrasait** le
libellé de l'auteur authentifié (`select email into v_actor_label from
auth.users ...` suivi d'un `if p_actor_label is not null ... then v_actor_label
:= p_actor_label; end if;`) au lieu d'être un repli exclusif pour le cas
« acteur sans jeton utilisateur » — cas qui **n'existe pas** dans ce lot
(décision #5 du contrat : dépôt/suppression réservés au jeton utilisateur,
jamais une clé de service). Un membre ordinaire du tenant, JWT en main,
appelant directement `POST /rest/v1/rpc/api_confirm_order_file_upload` avec
`p_actor_label: 'patron@usurpe.test'`, aurait vu la ligne créée avec ce
libellé **forgé** — une trace d'audit dont l'auteur affiché ne serait pas
l'auteur réel.

**Corrigé en RETIRANT `p_actor_label` des deux signatures**
(`api_confirm_order_file_upload` : 9 → 8 paramètres ; `api_delete_order_file` :
4 → 3 paramètres), de leurs corps (`select email into v_actor_label from
auth.users where id = v_actor;`, sans branche de repli — `v_actor` n'est
JAMAIS nul dans ce lot), de leurs `comment on function`/`revoke`/`grant`, du
bloc de réversibilité en pied de migration, et des deux appels RPC de
l'adaptateur (`order-files-repository.ts`, `p_actor_label: null` retiré des
deux payloads). Solution retenue exactement comme demandé : suppression
plutôt que réplication de l'`if`/`else` exclusif d'E10.14, aucun appelant
légitime de ce lot n'utilisant ce paramètre.

**Correction de l'affirmation erronée du round précédent** : le rapport
initial affirmait une reprise « EXACTE » du patron d'E10.14
(`api_change_commercial_order_production_step`) — ce n'était **pas** le cas
avant cette correction (le patron d'E10.14 est un `if`/`else` exclusif, ce
lot faisait un écrasement inconditionnel). Cette formulation est retirée ;
le tableau « Ce qui est livré » ci-dessus décrit maintenant le comportement
réel, sans référence à une reprise exacte qui ne l'était pas.

**Preuve ajoutée, côté SQL** (`tests/sql/gescom-e10-17a-order-files.sql`,
scénarios « B1 round 2 ») : un appel à **neuf** arguments sur
`api_confirm_order_file_upload` (respectivement **quatre** sur
`api_delete_order_file`) — reproduisant l'exploitation décrite par la
qa-review — échoue en `undefined_function` **avant même d'atteindre le corps
de la fonction** (la signature ne porte structurellement plus ce paramètre),
et le libellé effectivement enregistré est **toujours** l'e-mail de l'acteur
authentifié, jamais une valeur fournie par l'appelant. Exécuté réellement
contre Postgres local, **0 erreur**.

### N1 — scénario 9 (FK composite) ne prouvait que la contrainte de forme → corrigé

Le `storage_path` du scénario (`'peu-importe/' || v_order_a::text || ...`)
violait la contrainte `commercial_order_files_storage_path_shape` **avant**
même d'atteindre la clé étrangère composite qu'il devait prouver — Postgres
levait `check_violation`, pas `foreign_key_violation`, et le test acceptait
les deux indistinctement. La FK existe réellement (vérifiée indépendamment
par la qa-review), mais ce scénario ne le démontrait pas : elle aurait pu
disparaître sans le faire échouer.

**Corrigé** : le chemin est désormais de **forme canonique**
(`gen_random_uuid()::text || '/' || v_order_a::text || '/' || v_file_id::text`
— un UUID quelconque en premier segment, cette table n'ayant pas de colonne
`tenant_id` à viser correctement de toute façon), si bien que seule la FK
peut encore le refuser. Le bloc `exception` n'accepte plus que
`foreign_key_violation` ; un `check_violation` fait désormais échouer le
test explicitement avec un message qui dit pourquoi, plutôt que d'être
avalé silencieusement.

### N2 — scénario 4 (DELETE direct par un admin) sans assertion → corrigé

`get diagnostics v_updated = row_count` était lu mais jamais confronté à
rien, et aucun `raise` ne sanctionnait un DELETE direct réussi. Si
`revoke delete` disparaissait un jour, ce scénario serait resté vert.
**Corrigé** : le bloc réinitialise `v_rejected := false` avant la tentative
de DELETE, capture `insufficient_privilege` comme pour l'INSERT/UPDATE
précédents, et lève une exception explicite si l'acteur a réussi à
supprimer directement.

### N3 — chemin recalculé non testé sur `toDetailDto()`/`remove()` → corrigé

Le test dédié ne couvrait que `confirmUpload()`. **Deux tests ajoutés** à
`tests/adapters/supabase/order-files-repository.test.ts` :
- `findById` (qui délègue à `toDetailDto()`) : la ligne renvoyée par le faux
  client porte volontairement une propriété parasite `storage_path` (chemin
  forgé) ; le test prouve que `createSignedUrl` est appelé au chemin
  **recalculé**, jamais à cette valeur.
- `remove()` : la fonction RPC (`api_delete_order_file`) renvoie, dans le
  faux client, une ligne dont `storage_path` est forgé ; le test prouve que
  `storage.remove()` est appelé au chemin **recalculé**, jamais à la valeur
  rendue par la fonction SQL.

Ce sont exactement les deux points où la faille B1 originale (E10.10b-4a)
était réapparue lors d'un refactor — un futur refactor qui réintroduirait
`row.storage_path`/`data.storage_path` fait désormais échouer un test.

### N4 — `storage_path` sélectionné sans être consommé → corrigé

`FILE_COLUMNS` ne sélectionne plus `storage_path` : la colonne existe en
base mais rien dans l'adaptateur n'a le droit de la lire, autant ne pas la
lire du tout.

### N5 — affirmation inexacte sur « la chaîne complète » → corrigée

Le rapport initial affirmait avoir rejoué la suite « dans la chaîne complète
de `pnpm test:storefront:sql` ». **Faux, corrigé** : ce script s'arrête au
premier cas en échec à cause de `set -euo pipefail`, et — vérifié à nouveau
dans ce round, après un `pnpm db:local:reset` complet — il échoue dès le
**premier** cas (`storefront-session-lifecycle.sql`, qui exige un
`auth.users` préexistant qu'un reset frais ne fournit pas), donc **n'atteint
jamais** E10.17a. Cette sensibilité à l'état accumulé des `auth.users`/tenants
locaux est une dette déjà documentée par E10.10b-4a/E10.13, sans rapport avec
cette story. Le texte exact, maintenant : `gescom-e10-17a-order-files.sql` a
été rejoué **isolément** (à plusieurs reprises, y compris après un reset
complet) et **enchaîné manuellement** avec les cas qui, eux, n'exigent pas de
`auth.users` préexistant (`gescom-e10-10b-3`, `-12`, `-13`, `-14`, `-16`,
`-10b-4a/4b/4c`) — jamais dans une exécution de bout en bout du script
`pnpm test:storefront:sql`, qui n'existe pas dans cet état de la base locale.

### N6 — `updateOrderFile` signait une URL Storage inutilement → corrigé

`updateOrderFile` appelait `service.getById()` (qui signe `download_url` via
Storage) uniquement pour calculer l'`ETag` de précondition, alors que cet
`ETag` exclut déjà `download_url`/`download_url_expires_at`
(`fileDetailEntityTag`). Coût : un aller-retour Storage inutile à **chaque**
bascule de visibilité, et une panne Storage transitoire y aurait produit un
500 brut là où seul un 404 `order_file.not_found` a un sens.

**Corrigé** : ajout de `OrderFilesRepository.findRawById()` /
`OrderFilesService.getRawById()`, qui rendent la **même projection stable**
qu'`OrderFile` (mêmes champs que ceux couverts par l'`ETag`) sans jamais
toucher au Storage. `updateOrderFile` utilise désormais `getRawById()` +
`fileEntityTag()` pour la précondition — la valeur de l'`ETag` calculée est
identique bit à bit à l'ancienne (mêmes champs, `stableStringify` trie les
clés), donc **aucun client existant n'est affecté**. Testé indirectement par
`order-files.contract.test.ts` (le test `updateOrderFile` existant reste
vert, `If-Match`/409/428 inchangés).

### N7/N8/N9 — non traitées, sur instruction explicite

Qualifiées par la qa-review comme héritées du patron déjà en place sur
d'autres stories du sprint (E10.12/E10.14/E10.10b-4a) : à traiter au niveau
du sprint, pas de cette story. Non touchées.

## Écart trouvé et corrigé (hors qa-review, lors de la remise initiale) : le socle ne savait pas rendre un 204 réel

Aucune opération de la facade `/api/v1` gestion commerciale ne rendait un
**vrai** 204 avant `deleteOrderFile` — les 204 déjà présents dans le contrat
décrivent des `webhooks` (consommés par un tiers), jamais servis par ce
handler. `createGescomApiHandler` → `renderSuccess()` construisait
systématiquement `new Response(JSON.stringify(body), { status, headers })`,
quel que soit le statut. **La spécification Fetch interdit tout corps sur un
statut à corps nul** (204/205/304) : `new Response('...', { status: 204 })`
lève une `TypeError` (`Invalid response status code 204`), vérifié par
exécution réelle sous Node 20. `deleteOrderFile` aurait donc **planté à
l'exécution**, pas seulement échoué un test.

**Corrigé dans le socle** (`gescom-middleware.ts`), pas contourné dans le
module : `renderSuccess()` distingue désormais les statuts à corps nul et
rend `new Response(null, { status, headers })`, sans `Content-Type`. Même
correction apportée au harnais de test partagé (`tests/contract/_harness.ts`,
`checkResponseAgainstContract`) qui appelait `.json()` sans condition — un
204 réel y aurait fait échouer le test avant même de vérifier le contrat.
Aucun autre `operationId` existant n'est affecté (aucun ne rend 204/205/304
aujourd'hui) : changement additif.

## Ce qui n'est pas dans le périmètre (rappel du contrat §8.19 §5/§7)

- **Aucune UI** — panneau de fichiers sur `OrderDetailPage`, `data-testid`
  `order-files-block`, dépôt avec barre de progression : E10.17b.
- **Aucune modification de `CommercialOrderDetail`** — pas de bloc, pas de
  compteur, pas de lien.
- **Aucun événement publié** — `order.files_submitted` reste sans émetteur
  (décision #10 du contrat, réservé à E10.20).
- **Aucune inspection de contenu, aucune décompression, aucun `sha256`.**
- **Aucune capability neuve, aucun scope neuf, aucune écriture joignable par
  clé de service.**

## Tests exécutés — TOUS les gates rejoués depuis le début après correction

| Commande | Résultat |
|---|---|
| `pnpm typecheck` | **vert**, 0 erreur |
| `deno check supabase/functions/magrit-api/index.ts` | **vert**, 0 erreur |
| `pnpm gen:api:check` | **vert**, aligné (types déjà générés par l'architecte, aucun champ HTTP touché par les corrections — B1/N1-N6 sont internes à la base et à l'adaptateur) |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests, inchangé |
| `pnpm test:contract` | **vert**, 18 fichiers / **329 tests** (dont les 20 d'`order-files.contract.test.ts`, tous rejoués après corrections — `updateOrderFile` notamment, qui exerce désormais `getRawById()`) |
| `tests/server/api/api-facade-router.test.ts` + `magrit-api-composition.test.ts` + `gescom-routes.contract.test.ts` + `order-files.contract.test.ts` + `order-files-repository.test.ts` (adaptateur) + `content-type-map.test.ts` | **vert**, 69/69 en un seul run explicite |
| `tests/adapters/supabase/order-files-repository.test.ts` | **vert**, **5/5** (3 initiaux + **2 nouveaux**, N3) |
| `tests/modules/order-files/content-type-map.test.ts` | **vert**, 13/13, inchangé |
| `pnpm test` (suite complète) | **1938 passés / 36 skip / 3 échecs pré-existants** (`tests/storage/product_mockups_isolation.test.ts`, projet Supabase distant, cause déjà établie par E10.10b-4a — sans rapport avec ce lot ; +2 par rapport à la remise initiale, les deux tests N3) |
| `pnpm db:local:reset` | **exécuté réellement** — nécessaire car `create or replace function` ne permet pas de retirer un paramètre de signature (même contrainte que documentée par E10.10b-4a) ; les 8 arguments de `api_confirm_order_file_upload` et les 3 de `api_delete_order_file` sont désormais les SEULES signatures existantes en base, 0 erreur de migration. |
| `tests/sql/gescom-e10-17a-order-files.sql` | **exécuté réellement** contre Postgres local, **à trois reprises** dans ce round (juste après le reset, après l'ajout des scénarios B1 round 2, et en vérification finale) : **0 erreur** à chaque fois, `ROLLBACK` propre. Rejoué aussi **enchaîné manuellement** derrière les cas SQL auto-suffisants du sprint (`gescom-e10-10b-3/-12/-13/-14/-16/-10b-4a/4b/4c`) : **0 erreur**. Voir N5 pour la formulation exacte concernant « la chaîne complète ». |

### Test dédié — chemin de stockage recalculé (reproduction du modèle qa-review B1, E10.10b-4a, étendue par N3)

`tests/adapters/supabase/order-files-repository.test.ts` (5 tests) prouve
désormais, sur les **trois** points d'accès au Storage de l'adaptateur :
1. `confirmUpload()` — une `ConfirmOrderFileUploadCommand` **forgée** (`as
   any`) portant un `path`/`storage_path` est ignorée : `info()` est appelé
   au chemin **canonique** recalculé, et la fonction RPC ne reçoit **aucun**
   paramètre de chemin.
2. `findById()`/`toDetailDto()` (N3, ajouté) — une ligne dont
   `storage_path` est une propriété parasite forgée ne change rien :
   `createSignedUrl` est appelé au chemin recalculé.
3. `remove()` (N3, ajouté) — une réponse RPC dont `storage_path` est forgé
   ne change rien : `storage.remove()` est appelé au chemin recalculé.

Côté SQL, le scénario 8 de `gescom-e10-17a-order-files.sql` reproduit le même
modèle que le scénario 8 de E10.10b-4a : un `storage_path` avec un mauvais
`order_id`/`file_id` est refusé par la contrainte `check` **même en écriture
privilégiée**. **Écart honnête signalé, pas caché** : cette table ne porte
pas `tenant_id` (décision assumée du contrat, §8.19 §3), donc la contrainte
`check` **ne peut pas** vérifier la valeur du premier segment (un `check`
Postgres ne peut interroger aucune autre table) — seule sa forme (un UUID)
l'est. Le scénario 8a-bis **prouve** cette limite plutôt que de la passer
sous silence : un chemin bien formé mais pointant vers un autre tenant, avec
le bon `order_id`/`id`, est **accepté** par la contrainte. La protection
réelle contre cela reste entièrement portée par la fonction `security
definer`, qui ne reçoit jamais de chemin en paramètre (scénario 5) — c'est
exactement ce que le contrat dit lui-même (§8.19 §3 : « la seconde barrière
est plus faible ici qu'en E10.10b-4a »), vérifié plutôt qu'affirmé.

**Extension B1 round 2** : le scénario 9 (FK composite) a été corrigé pour ne
prouver QUE la clé étrangère (N1, voir plus haut) ; deux nouveaux scénarios
prouvent que les fonctions `api_confirm_order_file_upload`/
`api_delete_order_file`, appelées avec un neuvième/quatrième argument
(reproduisant l'exploitation décrite en B1), échouent en `undefined_function`
et que le libellé enregistré reste l'e-mail authentifié.

## Critères d'acceptation (périmètre de la sous-story, tenus un par un)

1. **Migration** : table de fichiers de commande, bucket privé, RLS testée
   réellement (isolation tenant, aucune capability), défense en profondeur
   `order_id`/`tenant_id`. — **fait.** Isolation inter-tenant, lecture
   ouverte à tout membre, écriture PostgREST **totalement** fermée (plus
   stricte qu'E10.10b-4a : même un admin ne peut pas écrire en direct,
   assertion désormais explicite — N2), clé étrangère composite
   structurellement impossible à contourner (preuve corrigée pour ne
   démontrer QUE la FK — N1) — vérifiés par exécution SQL réelle après un
   reset complet (scénarios 3, 4, 5, 5bis « B1 round 2 », 9).
2. **Module `api/` + `application/`**, convention du dépôt. — **fait**, même
   patron que `document-templates`/`quote-documents`, pas de sous-dossiers
   `routes/service/repository` littéraux. Pas de `manifest.ts`/`ui/` :
   aucune capability, aucun écran dans ce lot.
3. **Les six opérations implémentées exactement telles que contractées.** —
   **fait** : `issueOrderFileUploadUrl` (200, sans `Idempotency-Key`, plafond
   vérifié par courtoisie), `listOrderFiles` (borné, non paginé, sans URL),
   `confirmOrderFileUpload` (201, `Idempotency-Key`, `ETag`, seul endroit où
   un fichier existe, **aucun paramètre de libellé forgeable** depuis B1),
   `getOrderFile` (`OrderFileDetail`, URL signée 300 s, force le
   téléchargement), `updateOrderFile` (`If-Match` exigée, un seul champ,
   précondition calculée **sans** aller-retour Storage depuis N6),
   `deleteOrderFile` (204 sans corps, ligne conservée, **aucun paramètre de
   libellé forgeable**). Testées contre le contrat (20 tests).
4. **Aucun composant React n'appelle Supabase directement.** — **fait**, sans
   objet direct (aucune UI dans ce lot), mais le point de vigilance est déjà
   posé pour 17b : `uploadOrderFile()` du client API utilise `fetch` nu, pas
   le SDK Supabase.
5. **Tests : RLS réelle, contrat sur les 6 opérations, chemin de stockage
   recalculé (étendu aux 3 points d'accès Storage par N3), correspondance
   extension→MIME fermée.** — **fait**, voir tableau ci-dessus et sections
   dédiées.

## Ce qui reste à faire avant qu'E10.17b (le panneau UI) puisse démarrer

- **Rien de bloquant côté 17a** : les six opérations sont servies, testées,
  et `getOrderFile`/`listOrderFiles` rendent déjà tout ce dont un panneau
  groupé par item a besoin (`order_line_id`, `download_url` à la demande).
- **17a n'a AUCUN effet observable par un utilisateur** (le contrat le dit
  explicitement, §8.19 §5) : c'est attendu pour ce lot, pas un défaut.
- **`data-testid` `order-files-block`** reste à déclarer par 17b dans
  `src/shared/presentation/testIds.ts` — volontairement non posé ici (« pas
  de lien mort »).
- **Consigne opposable à 17b, déjà outillée** : `resolveOrderFileContentType()`
  (`src/modules/order-files/api/content-type-map.ts`) est prête à l'emploi
  pour poser le `Content-Type` du `PUT` depuis le nom de fichier — ne pas la
  redévelopper, ne pas se fier à `File.type`. Comportement du navigateur sur
  `.zip` **non mesuré** par cet agent sur un poste réel (aucun navigateur
  disponible dans cet environnement) : à vérifier par 17b sur au moins deux
  systèmes, comme demandé par le contrat.
- **Sally UX** : non requis pour 17a (aucun écran) ; probablement pertinent
  pour 17b (composant de dépôt de fichiers, confirmation de suppression
  irréversible) — à l'appréciation de l'orchestrateur du sprint.

## Dette introduite, points à faire confirmer

| Réf. | Point | Chemin de mise en conformité / statut |
|---|---|---|
| **D1** | Le socle `gescom-middleware.ts` ne rendait aucun 204 réel avant ce lot (`TypeError` a l'execution). | **Corrigé dans ce lot**, dans le socle transverse (pas un contournement local). Aucun autre `operationId` existant affecté. |
| **D2** | La contrainte `check` de forme sur `storage_path` ne peut pas vérifier la VALEUR du segment tenant (table sans colonne `tenant_id`, limite déjà actée au contrat §8.19 §3). | Assumé et **prouvé par test** (scénario 8a-bis) plutôt que découvert plus tard. Protection réelle : la fonction `security definer` ne reçoit jamais de chemin en paramètre. Aucune action requise — comportement conforme au contrat. |
| **N1 (héritée, sans rapport)** | `tests/storage/product_mockups_isolation.test.ts` cible le projet Supabase **distant** partagé, pas l'instance locale — 3 échecs pré-existants, cause déjà établie par E10.10b-4a. | Hors périmètre de cette story. |
| **N2 (héritée, sans rapport)** | `pnpm test:storefront:sql` (script complet) n'atteint jamais E10.17a : il échoue au premier cas des qu il rencontre une dependance a un `auth.users` preexistant que l etat courant de la base (fraiche ou accumulee) ne satisfait pas — dette de sensibilite a l etat local deja documentee par E10.10b-4a/E10.13, confirmee a nouveau dans ce round (arret des le 1er cas apres un reset complet, arret au 9e cas avant reset). Mon cas SQL est **auto-suffisant** (crée ses propres fixtures) et passe isolé et enchaîné manuellement avec les cas eux-mêmes auto-suffisants. | Hors périmètre de cette story — signalé une seconde fois pour qu'il ne soit pas reperdu. |

## Fichiers créés/modifiés

**Créés** :
- `supabase/migrations/20260909060000_gescom_e10_17a_order_files.sql`
- `src/modules/order-files/api/contracts.ts`
- `src/modules/order-files/api/content-type-map.ts`
- `src/modules/order-files/api/client.ts`
- `src/modules/order-files/application/order-files-repository.ts`
- `src/modules/order-files/application/order-files-service.ts`
- `src/modules/order-files/index.ts`
- `src/adapters/supabase/order-files-repository.ts`
- `src/server/api/order-files-routes.ts`
- `tests/contract/order-files.contract.test.ts`
- `tests/contract/_fakes/order-files-repository.fake.ts`
- `tests/adapters/supabase/order-files-repository.test.ts`
- `tests/modules/order-files/content-type-map.test.ts`
- `tests/sql/gescom-e10-17a-order-files.sql`

**Modifiés** :
- `src/server/api/gescom-routes.ts` (enregistrement `orderFiles`)
- `src/server/api/gescom-middleware.ts` (correctif 204, socle transverse)
- `tests/contract/_harness.ts` (correctif 204, harnais transverse)
- `supabase/functions/magrit-api/index.ts` (câblage edge function)
- `scripts/test-storefront-sql.sh` (ajout du cas SQL de ce lot)

**Modifiés au round qa-review (B1 + N1-N6)** :
- `supabase/migrations/20260909060000_gescom_e10_17a_order_files.sql` (retrait de `p_actor_label` des deux signatures/corps/comment/revoke/grant/réversibilité — B1)
- `src/adapters/supabase/order-files-repository.ts` (retrait de `p_actor_label` des deux appels RPC — B1 ; ajout `findRawById` — N6 ; retrait de `storage_path` de `FILE_COLUMNS` — N4)
- `src/modules/order-files/application/order-files-repository.ts` (ajout `findRawById` à l'interface — N6)
- `src/modules/order-files/application/order-files-service.ts` (ajout `getRawById` — N6)
- `src/server/api/order-files-routes.ts` (`updateOrderFile` utilise `getRawById`/`fileEntityTag` — N6)
- `tests/contract/_fakes/order-files-repository.fake.ts` (implémentation `findRawById` — N6)
- `tests/adapters/supabase/order-files-repository.test.ts` (deux tests ajoutés sur `findById`/`remove()` — N3)
- `tests/sql/gescom-e10-17a-order-files.sql` (retrait des arguments `p_actor_label` de tous les appels ; scénario 9 corrigé pour ne prouver que la FK — N1 ; scénario 4 avec assertion explicite sur le DELETE — N2 ; deux scénarios B1 round 2 ajoutés)
