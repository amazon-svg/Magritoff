---
id: E10.22b
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.22a]
blocks: []
---
# E10.22b — la purge réelle + E10.22c — les objets orphelins (dette D7)

Contrat déjà écrit par l'architecte : `docs/api/CONVENTIONS.md` §8.22 §5 (la
purge réelle) et §6 (les objets orphelins, dette D7 d'origine),
`openapi/magrit-core.v1.yaml` (déjà à jour : webhook `order_files.purged` et
schéma `OrderFilesPurgedPayload` **entièrement écrits** par l'architecte,
vérifiés ligne à ligne avant d'écrire une seule ligne de code de ce lot).
**`openapi/magrit-core.v1.yaml` non touché par ce lot** (`pnpm gen:api:check`
vert, `git diff --stat openapi/magrit-core.v1.yaml` vide).

**Périmètre STRICT tenu** : E10.22b (purge effective) et E10.22c (objets
orphelins) **fusionnées dans ce lot**, comme le permet le contrat (§8.22 §8 :
« court, indépendant, sans effet sur les lignes » — les deux volets
s'appuient sur le même déclencheur, la même Edge Function étendue, sans
partager de logique). E10.22a/E10.22a-bis (échéance, rappels, preuve de
livraison) sont livrées, approuvées en 2 rounds de `qa-review`, **non
retouchées** par ce lot (aucune colonne, fonction ni trigger de la migration
`20260910000500` n'est modifié).

## qa-review round 1 (« REJETÉ », deux bloquants + deux points modérés) → corrections

La première soumission a été **rejetée**. La garde absolue (les DEUX rappels
confirmés avant toute purge), la réutilisation du régime E10.17a, l'ordre des
étapes, la concurrence et l'événement `order_files.purged` ont tous été
vérifiés corrects par exécution réelle contre Postgres local et **n'ont pas
été retouchés**. Détail des quatre points et des corrections apportées :

### B1 — BLOQUANT (observabilité, arbitrage Arnaud non tenu), corrigé

**Constat exact.** Le contrat §5 exige explicitement : *« le balayage de
purge compte les fichiers échus qu'il refuse de détruire, par espace et par
motif (rappel non émis / rappel non confirmé / rappel en échec), et l'Edge
Function journalise ce compte à chaque tour »* — c'est la raison d'être des
deux tables de suivi construites en E10.22a. Ce comptage était **absent** de
la remise initiale (`PurgeSweepReport` ne portait que 7 compteurs, aucun sur
les blocages) et **non déclaré en dette**. Conséquence concrète : tant que le
domaine Resend n'est pas vérifié (réserve (e), aucun rappel jamais confirmé),
le balayage rend `filesPurged: 0` chaque nuit — **indistinguable** d'un espace
où il n'y a légitimement rien à purger.

**Corrigé.** Fonction SQL neuve `api_count_blocked_order_file_purges()`
(lecture seule, `20260910000600`) : compte, **par tenant et par motif**
(`rappel_non_emis` / `rappels_identiques` / `rappel_en_echec` /
`rappel_non_confirme`), les fichiers échus (`purge_at <= now()`, vivants) que
la garde refuse de détruire — **négation EXACTE** de la garde de
`api_claim_order_files_for_purge` (tout écart entre les deux fait l'objet
d'un commentaire opposable dans la migration). Port `countBlockedFiles()`
ajouté à `PurgeExecutionRepository`, étape 6 du balayage (`PurgeSweepService`,
**après** la purge réelle pour refléter le reliquat post-tour), champ
`blockedFiles` ajouté à `PurgeSweepReport`, et **journalisé** (`console.warn`)
par `magrit-order-file-purge/index.ts` à chaque tour où au moins un fichier
est bloqué — le corps de réponse HTTP seul n'étant pas un canal
d'observabilité fiable (réponse `pg_net` typiquement non relue).

### B2 — BLOQUANT GRAVE (destruction de données légitimes), corrigé

**Constat exact, prouvé par exécution réelle par la qa-review.** Scénario de
course : (1) billet émis, `PUT` réussi, confirmation échouée (réseau, onglet
fermé, 500 transitoire) → objet en storage, aucune ligne
`commercial_order_files` ; (2) à T+25h, `api_claim_orphan_order_file_objects`
liste légitimement ce chemin comme candidat orphelin ; (3) juste après, une
confirmation tardive (reprise, nouveau clic) **aboutit** et crée une ligne
**vivante** au même chemin ; (4) l'Edge Function, qui a déjà la liste de
l'étape 2, retire l'objet — **détruisant les octets d'une ligne vivante**,
sans trace (`deleted_at` reste `NULL`, aucun événement). Racine : rien ne
bornait l'âge de l'objet storage **au moment de la confirmation**, ni
`api_confirm_order_file_upload` (E10.17a) ni
`api_confirm_order_file_upload_by_link` (E10.20b).

**Corrigé, déterministe et symétrique de la garde du §5** — pas une simple
re-vérification côté adaptateur (contournable par un appel direct à la RPC).
Migration neuve `20260910000700_gescom_e10_22c_qa_round1_confirm_expiry_guard.sql`
(les deux fonctions retouchées sont **déjà committées** — E10.17a/E10.20b —
jamais éditées directement, `create or replace function` uniquement, même
discipline que `commercial_order_files_set_updated_at()` en `20260910000500`) :
les **deux** fonctions de confirmation refusent désormais explicitement toute
confirmation dont l'objet storage est **déjà** plus vieux que le délai des
orphelins (24h, même valeur que `api_claim_orphan_order_file_objects`,
littéral dupliqué documenté — nouveau code `order_file.upload_expired`, 409,
même statut que `quote.decision_expired`). Avec ce refus, une ligne ne peut
plus **structurellement** devenir vivante sur un chemin déjà candidat au
nettoyage orphelins : soit la confirmation arrive avant 24h (l'objet n'est
pas encore candidat), soit elle arrive après et elle est **refusée**. Le
scénario de course devient **irreproductible**, par construction.
`OrderFileUploadExpiredError` ajouté au domaine `order-files`, **réutilisée**
(pas dupliquée) par le module `order-upload-links` — même discipline que
`OrderFileUploadMissingError`/`OrderFileRejectedError` — et mappée en 409 dans
les deux fichiers de routes concernés.

### M1 — MODÉRÉ (défense en profondeur sur LA garde la plus sensible), corrigé

Les deux `exists` de la garde de purge n'excluaient pas un rappel
`failed_at` (une relecture tardive « delivered » arrivant après expiration
peut laisser `confirmed_at` **et** `failed_at` tous deux non nuls, cf. N2
d'E10.22a-bis) et rien n'empêchait `purge_notice_1_id = purge_notice_2_id`
(le même rappel compterait pour deux preuves). Ni l'un ni l'autre n'est
atteignable par l'API actuelle (défense en profondeur), mais c'est **la**
garde la plus sensible du chantier : elle doit être vraie **par elle-même**.
**Corrigé** : `and n.failed_at is null` ajouté aux deux `exists`,
`and f.purge_notice_1_id is distinct from f.purge_notice_2_id` ajouté au
filtre des candidats — répercuté à l'identique dans la négation exacte de
`api_count_blocked_order_file_purges` (B1).

### M2 — MODÉRÉ (fuite storage silencieuse), corrigé

La branche (b) du nettoyage orphelins filtrait sur `purged_at is not null`
(purge **automatique** seule) : un objet résiduel d'une suppression
**manuelle** (E10.17a, `deleted_at` posé) dont le retrait best-effort a
échoué n'était **jamais** rattrapé (la branche (a) ne matche pas non plus,
la ligne existe toujours). Le contrat §6 parle de « l'objet dont le retrait a
échoué » sans distinguer la cause. **Corrigé** : la branche (b) filtre
désormais sur `deleted_at is not null` (couvre purge automatique **et**
suppression manuelle — `purged_at` reste un sous-ensemble non nul de
`deleted_at`).

### N1-N4 (mineurs), tous corrigés dans la même passe

- **N1** — `removeOrphanObjects` rendait `rows.length` même si `.remove()`
  échouait (retraits annoncés qui n'ont pas eu lieu). **Corrigé** : le compte
  dérive du résultat réel de `.remove()` (`removed?.length ?? 0`), `0` sur
  erreur. Testé (`tests/server/api/order-file-purge-composition.test.ts`).
- **N2** — un échec de `api_record_order_files_purged` pour **un** tenant
  faisait `throw`, avortant tout le tour **après** que d'autres tenants
  avaient déjà été purgés (objets déjà retirés) mais **sans** que leur
  événement `order_files.purged` ne soit jamais écrit, et sans que l'étape 5
  (orphelins) ne tourne. **Corrigé** : l'échec est journalisé
  (`console.error`) et le tour continue pour les tenants suivants et les
  étapes suivantes. Testé.
- **N3** — un chemin à 2 segments ou un `.emptyFolderPlaceholder` (3ᵉ segment
  vide) étaient candidats au nettoyage orphelins. **Corrigé** :
  `and split_part(o.name, '/', 3) <> ''` ajouté aux deux branches.
- **N4** — la garde de purge ne vérifiait pas que le rappel pointé appartient
  au même tenant que le fichier. Non atteignable aujourd'hui, coût nul.
  **Corrigé** : jointure qualifiée `n.tenant_id = o.tenant_id` ajoutée aux
  deux `exists` (et à la négation exacte de B1).

### Tests rejoués après corrections

`./scripts/supabase-local.sh reset` (migrations `20260910000600` retouchée +
`20260910000700` neuve, appliquées proprement de bout en bout, 0 erreur) ;
cas SQL de ce lot rejoué (**6 scénarios**, 0 erreur) ; **cas SQL neuf**
`gescom-e10-22c-qa-round1-confirm-expiry-guard.sql` créé pour B2 (**5
scénarios**, 0 erreur) ; non-régression rejouée individuellement sur
`gescom-e10-17a-order-files.sql`, `gescom-e10-19a-order-document-template.sql`,
`gescom-e10-19b-order-documents.sql`, `gescom-e10-20a-order-upload-links.sql`,
`gescom-e10-20b-order-upload-link-deposit.sql`,
`gescom-e10-22a-order-file-purge-notices.sql` — **0 erreur** ; l'intégralité
de la séquence (17a→19a→19b→20a→20b→22a→22b/22c→22c-B2) rejouée **dans
l'ordre, contre la même base fraîchement réinitialisée**, 0 erreur ;
`pnpm typecheck`/`gen:api:check`/`test:architecture`/`test:contract` verts ;
suite complète **2114 passés / 36 skip / 3 échecs** (mêmes 3 échecs
pré-existants sans rapport, D11, +4 tests nets vs. la remise initiale de ce
lot). Détail complet en fin de document.

## Critères d'acceptation transmis, tenus un par un

1. **La garde de purge : LES DEUX rappels (J+10 et J+15) doivent chacun avoir un `notice` avec `confirmed_at` non nul.** — **fait, vérifié à la lettre du contrat, pas supposé.** Relu §5 du contrat au mot près : le bloc SQL prescrit teste explicitement `purge_notice_1_id` **et** `purge_notice_2_id`, chacun avec son propre `exists (... confirmed_at is not null)`. `api_claim_order_files_for_purge` reprend cette forme **littéralement** (`supabase/migrations/20260910000600_gescom_e10_22b_22c_purge_execution.sql`). Vérifié en base réelle (scénario 1 du cas SQL) : un fichier avec un seul rappel confirmé sur deux **n'est jamais** reclamé, même très au-delà de `purge_at`. **Durcie en qa-review round 1 (M1, N4)** : `failed_at is null` sur les deux rappels, rappels DISTINCTS, MÊME TENANT que le fichier — défense en profondeur sur la garde la plus sensible du chantier.
2. **À J+30 (ou plus tard si la garde n'est pas remplie), suppression de l'objet réel + `deleted_at`/`purged_at` posés, ligne conservée.** — **fait.** `api_claim_order_files_for_purge` marque `deleted_at`/`purged_at` (transactionnel, `for update skip locked`), `deleted_by = null`, `deleted_by_label = 'Purge automatique'` — **même mécanisme que la suppression manuelle d'E10.17a** (`api_delete_order_file`), vérifié comme identique plutôt que dupliqué (voir « Réutilisation vérifiée » ci-dessous) : **AUCUN `DELETE` SQL**, **AUCUN second régime de destruction** sur `commercial_order_files`. `SupabaseOrderFilePurgeExecutionRepository.purgeEligibleFiles()` retire ensuite les objets par lot (`storage.remove()`), **best-effort**, ordre PRESCRIT (ligne d'abord, objet ensuite) respecté à l'identique de §5. **qa-review round 1 (B1)** : le balayage compte désormais aussi, par espace et par motif, les fichiers échus que la garde REFUSE de détruire (`api_count_blocked_order_file_purges`) — sans ce compte, un blocage systémique (ex. domaine Resend non vérifié) était indistinguable de « rien à purger ».
3. **Même déclencheur que E10.22a : le second `pg_cron` → `magrit-order-file-purge`, étendue.** — **fait.** Aucune nouvelle Edge Function : `supabase/functions/magrit-order-file-purge/index.ts` inchangé dans sa structure (secret partagé, `timingSafeEqual`, `createOrderFilePurgeSweepApplication()`), seule sa docstring est mise à jour. Toute l'extension vit dans `PurgeSweepService.runOnce()` (étapes 4 et 5 ajoutées) et dans `order-file-purge-composition.ts` (deux nouveaux adaptateurs injectés).
4. **Notification après la purge réelle ?** — **oui, le contrat le prescrit explicitement (§5, §9), fait.** Un événement `order_files.purged` **par espace**, émis **après** le retrait des objets, quel que soit le résultat du retrait (`byte_size_freed` compte les octets **déclarés en base**, pas une mesure réelle du stockage — §9 du contrat, `OrderFilesPurgedPayload`). Écrit via `api_record_order_files_purged`, dans `outbox_events` (même bus que `order_files.purge_scheduled`, aucun bus neuf). **Aucun consommateur enregistré** — conforme au contrat (« seule trace versionnée et horodatée d'une destruction que personne n'a demandée »).
5. **(E10.22c) Périmètre : objets storage déposés via billet mais jamais confirmés.** — **fait.** `api_claim_orphan_order_file_objects` liste `storage.objects` (bucket `commercial_order_files`) sans ligne `commercial_order_files` correspondante (`split_part(name, '/', 3)` = `file_id`, jointure par absence). **qa-review round 1 (N3)** : chemins à segment vide (dossier, `.emptyFolderPlaceholder`) exclus des deux branches.
6. **Délai 24h, valeur par défaut codée.** — **fait.** `DEFAULT_PURGE_SWEEP_SETTINGS.orphanObjectOlderThanHours = 24` (réserve (b) du contrat, valeur proposée reprise sans arbitrage supplémentaire, comme demandé). Paramètre de la fonction SQL (`p_older_than interval default '24 hours'`) et du service (`PurgeSweepSettings`), **jamais un littéral figé dans la clause `WHERE`** — ajustable sans migration neuve. **qa-review round 1 (B2)** : cette seule marge ne fermait PAS l'invariant de sûreté (course avec une confirmation tardive, voir ci-dessous) — fermée PAR CONSTRUCTION par `20260910000700`.
7. **Même cron/Edge Function que E10.22a/b, étape supplémentaire.** — **fait**, voir point 3.
8. **Détection réelle des objets orphelins vs. dépôt en cours : méthode documentée, faisabilité vérifiée avant d'écrire le code.** — **fait, méthode explicitée dans la migration et ci-dessous — DURCIE en qa-review round 1 (B2, BLOQUANT GRAVE).** Le balayage **lit `storage.objects` directement en SQL** (`security definer`, même patron déjà éprouvé par E10.20b — `20260910000400`, qui relit `storage.objects`/`storage.buckets` sous le même régime — **réutilisé**, pas réinventé). `storage.objects.created_at` existe (colonne standard, vérifié par `\d storage.objects` sur la base locale avant d'écrire la fonction) et sert de date de dépôt réelle. Le délai de 24h **seul** ne suffisait PAS à garantir qu'un objet listé candidat ne devienne jamais une ligne vivante ensuite (course prouvée par exécution réelle, voir qa-review round 1 B2 ci-dessus) : **`api_confirm_order_file_upload` ET `api_confirm_order_file_upload_by_link` refusent désormais explicitement (`order_file.upload_expired`) toute confirmation dont l'objet est déjà plus vieux que ce même délai** (`20260910000700`) — l'invariant « un objet candidat au nettoyage ne peut jamais redevenir une ligne vivante » est désormais vrai **par construction**, pas par hypothèse de timing. **`storage.delete_object` n'existe pas comme fonction SQL appelable** (déjà constaté par E10.20b, reconfirmé ici) : le retrait reste **entièrement côté adaptateur** (`storageClient.storage.from(BUCKET).remove(...)`), jamais en SQL — cohérent avec le point 2.

## Réutilisation vérifiée avant d'écrire une nouvelle brique (R5)

Avant d'écrire `api_claim_order_files_for_purge`, vérification faite (pas
supposée) du régime de suppression manuelle d'E10.17a
(`supabase/migrations/20260909060000_gescom_e10_17a_order_files.sql`,
`api_delete_order_file`) : **même forme exacte** — `deleted_at`/`deleted_by`/
`deleted_by_label`, ligne conservée, jamais de `DELETE` SQL. La purge réelle
**rejoue ce régime à l'identique**, elle n'en crée pas un second — c'est la
même conclusion que §5 du contrat impose et que E10.22a-bis avait déjà posée
en réservant la colonne `purged_at`. `BUCKET`/`storagePathFor` réutilisés
depuis `order-files-repository.ts` (E10.17a) plutôt que redéfinis une
troisième fois (déjà réexportés pour E10.20a/E10.20b) — un scénario dédié
(scénario 5 du cas SQL de ce lot) **rejoue littéralement `api_delete_order_file`
après le déploiement de cette migration**, pour prouver que la suppression
manuelle se comporte encore exactement comme avant ce lot (`purged_at` reste
`NULL` sur une suppression manuelle — discriminant jamais confondu).

## Écart constaté avec le contrat, signalé plutôt que corrigé en silence

**`OrderFile.purge_at`/`OrderFileDetail.purge_at` restent `optional` dans
`openapi/magrit-core.v1.yaml`.** Le §9 du contrat (tableau « Ce que le
contrat gagne ») prévoit explicitement : *« E10.22a la sert sur tous les
fichiers, **E10.22b la promeut `required`** (optionnel → requis est
compatible au sens du CA13) »*. Ce lot **ne l'a pas fait** : le mandat de
`dev-story` est absolu — *« tu ne modifies jamais `openapi/` toi-même »* — et
aucune instruction transmise pour cette story n'en faisait une dérogation
explicite. **Chemin de mise en conformité : l'agent `architecte`** promeut
`purge_at`/`OrderFileDetail.purge_at` en `required` sur `OrderFile`/
`OrderFileDetail` — changement compatible (CA13), aucun code applicatif à
changer côté `dev-story` (la colonne est déjà `not null` en base depuis
`20260910000500`, et toujours servie sur tous les fichiers).

## Décisions de conception notables

- **Aucune colonne neuve.** `deleted_at`/`deleted_by`/`deleted_by_label`
  (E10.17a) et `purged_at` (E10.22a, réservée dès l'origine pour ce lot)
  existaient déjà — ce lot n'écrit que trois fonctions `security definer`
  neuves (`api_claim_order_files_for_purge`, `api_record_order_files_purged`,
  `api_claim_orphan_order_file_objects`).
- **`storage_path` jamais rendu par une fonction SQL, jamais transporté en
  donnée.** Même discipline que partout ailleurs dans ce lot de stories
  (qa-review B1/N4 d'E10.10b-4a/E10.17a) : `api_claim_order_files_for_purge`
  rend `tenant_id`/`order_id`/`file_id`/`byte_size`, l'adaptateur recompose
  le chemin via `storagePathFor()`.
- **`updated_at` n'est PAS protégé lors de la purge réelle, et c'est
  volontaire.** Contrairement à E10.22a (rattachement de rappel sur une ligne
  **vivante**, où bumper `updated_at` périmerait un `ETag` sous les pieds
  d'un utilisateur), la purge réelle pose `deleted_at` — une colonne déjà
  suivie par le trigger. La ligne purgée **cesse d'être rendue** par
  `listByOrder`/`findById` (filtre `deleted_at is null` déjà en place) :
  aucun consommateur ne peut plus jamais lire son `ETag`, donc aucun conflit
  n'est atteignable. Relu explicitement au contrat (`OrderFile.updated_at`)
  avant d'écrire le code, pour ne pas reproduire à tort la garde d'E10.22a
  là où elle ne s'applique pas.
- **Ordre des cinq étapes du balayage, et pourquoi.** 1) rappels, 2) relecture
  de livraison, 3) expiration, 4) purge réelle, 5) orphelins — étape 4
  **après** l'étape 2 (une confirmation relue **dans le même tour** rend
  immédiatement un fichier purgeable, sans attendre le tour suivant) ; étape
  5 **après** l'étape 4 (un retrait d'objet raté à l'étape 4, dans **ce même
  tour**, peut être rattrapé immédiatement par l'étape 5 — cas (b) du contrat
  §6). Documenté en tête de `purge-sweep-service.ts` et prouvé par deux tests
  d'ordre d'appel (`callOrder`) dans `purge-sweep-service.test.ts`.
- **Un événement par espace, jamais par fichier.** Regroupement fait
  **côté adaptateur** (`SupabaseOrderFilePurgeExecutionRepository`, `Map`
  par `tenant_id`), pas en SQL — la fonction de réclamation rend une ligne
  par fichier, le regroupement et la troncature à 50 `order_ids` sont un
  problème applicatif, pas un problème de base.
- **`OUTBOX_EVENT_NAMES`/`OUTBOX_EVENT_VERSIONS` complétés** (`order_files.purged`,
  version 1) — dette D4 explicitement laissée ouverte par E10.22a (« à
  ajouter par E10.22b, qui émettra réellement cet événement »), refermée
  ici.

## Dette introduite

| Réf. | Point | Chemin de mise en conformité |
|---|---|---|
| **D8** | `OrderFile.purge_at`/`OrderFileDetail.purge_at` restent `optional` au contrat alors que §9 prévoyait leur promotion `required` par ce lot (voir « Écart constaté » ci-dessus). | Agent `architecte` : promouvoir les deux champs en `required` dans `openapi/magrit-core.v1.yaml` (compatible CA13). Aucun changement de code applicatif. |
| **D9** | Réserve (b) du contrat (délai des objets orphelins, 24h) reste une valeur **proposée**, non arbitrée formellement par Arnaud — codée en défaut configurable (`DEFAULT_PURGE_SWEEP_SETTINGS.orphanObjectOlderThanHours`), comme demandé explicitement par le mandat de cette story. **Ce même délai est désormais dupliqué à TROIS endroits** (`api_claim_orphan_order_file_objects`, `api_confirm_order_file_upload`, `api_confirm_order_file_upload_by_link` — qa-review round 1, B2) : Postgres ne partage pas une constante entre fonctions aussi simplement qu'un module TypeScript, même discipline documentée que `ORDER_FILE_LIVE_LIMIT`. | À confirmer si le comportement observé en production déplaît — réglable sans migration côté balayage (paramètre de fonction + settings TS) ; **changer la valeur exige de retoucher les TROIS fonctions SQL** (migration neuve, `create or replace`), pas seulement le settings TS. |
| **D10** | Réserve (c) du contrat (heure exacte du balayage quotidien) reste non arbitrée — le déclencheur `pg_cron` d'E10.22a n'a jamais été planifié en production (secrets Vault absents, geste d'exploitation différé — héritée d'E10.22a, non aggravée par ce lot). | Geste d'exploitation, inchangé depuis E10.22a : poser les secrets Vault puis exécuter le bloc `PLANIFICATION DIFFÉRÉE` documenté en pied de `20260910000500`. |
| **D11 (héritée, sans rapport)** | `tests/storage/product_mockups_isolation.test.ts` échoue (3 tests, « Bucket not found » / 400 au lieu de 200) — cible un projet Supabase **distant** (`.env.test`), pas l'instance Docker locale utilisée pour développer/tester ce lot. Sans rapport avec la purge de fichiers de commande. | Hors périmètre. |
| **D12 (héritée, sans rapport)** | `pnpm typecheck:all` (`tsconfig.json`, `strict: false` à la racine) porte 167 erreurs pré-existantes — confirmées identiques avant/après ce lot par `git stash` + rejeu comparatif (`diff` : un seul écart, un déplacement de ligne dans un fichier de ce lot dû à l'ajout de code **au-dessus** d'une erreur pré-existante, pas une erreur nouvelle). Aucune erreur imputable à ce lot. | Hors périmètre — `pnpm typecheck` (`tsconfig.modular.json`, alias CI-bloquant, `strict: true`) reste **vert, 0 erreur**. |
| **D13** | Aucun test de composant React : ce lot ne porte aucune UI (mécanisme de fond, §9 du contrat : « aucun endpoint `/api/v1` nouveau »). | Sans objet, conforme au périmètre transmis. |

## Tests exécutés

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (`tsconfig.modular.json`) | **vert**, 0 erreur (rejoué après corrections round 1) |
| `pnpm typecheck:all` (`tsconfig.json`) | 167 erreurs pré-existantes, **inchangées** avant/après ce lot (comparé par `git stash` + rejeu, `diff` : un seul déplacement de ligne dans un fichier retouché par ce lot, 0 erreur nouvelle imputable — voir D12) |
| `pnpm gen:api:check` | **vert**, aligné — `openapi/magrit-core.v1.yaml` non touché (`git diff --stat` vide, rejoué après corrections round 1) |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests |
| `pnpm test:contract` | **vert**, 20 fichiers / 381 tests (aucun test de contrat neuf — aucun endpoint créé/modifié, conforme au contrat §9) |
| `pnpm vitest run tests/modules/order-files/purge-sweep-service.test.ts` | **vert**, 9 tests (3 de la remise initiale + 1 neuf round 1 : B1, ordre countBlockedFiles APRES purgeEligibleFiles, pass-through par tenant/motif) |
| `pnpm vitest run tests/server/api/order-file-purge-composition.test.ts` | **vert**, 8 tests (1 de la remise initiale + 3 neufs round 1 : B1 compte par tenant/motif, N2 un échec de consignation pour UN tenant n'avorte pas le tour, N1 un échec de retrait storage ne compte pas comme un retrait réussi) |
| `pnpm vitest run` (suite complète) | **2114 passés / 36 skip / 3 échecs** — les 3 échecs restent `tests/storage/product_mockups_isolation.test.ts`, pré-existants, sans rapport (D11). +4 tests nets vs. la remise initiale de ce lot (round 1) |
| `tests/sql/gescom-e10-22b-22c-purge-execution.sql` | **Réellement exécuté** contre Postgres local (Docker disponible), rejoué APRÈS les corrections M1/M2/B1 (garde durcie, branche orphelins (b) sur `deleted_at`). **5 scénarios**, tous encore vrais avec la garde durcie : 1. garde des deux rappels confirmés (purge du fichier éligible, non-purge des 4 cas limites) ; 2. `order_files.purged` ; 3. objets orphelins ; 4. privilèges ; 5. régression E10.17a. **0 erreur.** |
| `tests/sql/gescom-e10-22c-qa-round1-confirm-expiry-guard.sql` **(NEUF, B2)** | **Réellement exécuté** contre Postgres local. **5 scénarios** : 1. `api_confirm_order_file_upload`, objet déjà vieux de 25h → `order_file.upload_expired`, AUCUNE ligne créée ; 2. même fonction, objet déposé il y a 1h → confirmation RÉUSSIE ; 3. même fonction, AUCUN objet → comportement INCHANGÉ (hors périmètre B2, confirmation réussit toujours, contrat de confiance existant non retouché) ; 4. `api_confirm_order_file_upload_by_link`, objet vieux de 25h → `order_file.upload_expired`, `deposited_count` du lien INCHANGÉ ; 5. même fonction, objet récent → confirmation RÉUSSIE, `deposited_count` incrémenté. **0 erreur.** |
| Non-régression SQL rejouée individuellement (APRÈS corrections round 1) | `gescom-e10-17a-order-files.sql`, `gescom-e10-19a-order-document-template.sql`, `gescom-e10-19b-order-documents.sql`, `gescom-e10-20a-order-upload-links.sql`, `gescom-e10-20b-order-upload-link-deposit.sql`, `gescom-e10-22a-order-file-purge-notices.sql` — **0 erreur**, aucune régression |
| Séquence complète, dans l'ordre, contre la même base fraîchement réinitialisée (`./scripts/supabase-local.sh reset`) | 17a → 19a → 19b → 20a → 20b → 22a → 22b/22c → 22c-B2 (confirm expiry guard) — **0 erreur sur les 8 fichiers**, preuve que les fonctions retouchées par B2 (déjà committées, E10.17a/E10.20b) restent compatibles avec TOUTE la suite existante |
| `pnpm test:storefront:sql` (script complet) | Échoue dès le **premier** cas (`storefront-session-lifecycle.sql`, « Utilisateur Auth requis pour le scénario UM2.6 ») — **pré-existant, sans rapport** avec ce lot (même limite d'environnement local que déjà signalée pour E10.22a) : les 8 cas SQL pertinents (17a/19a/19b/20a/20b/22a/22b-22c/22c-B2) ont été vérifiés **individuellement puis en séquence**, avec succès, contre la même base — voir lignes ci-dessus. Les deux fichiers de ce lot ont été ajoutés à `SQL_CASES` dans `scripts/test-storefront-sql.sh` pour que la CI future (une fois Docker disponible) les exécute automatiquement. |

## Fichiers créés/modifiés

**Créés (remise initiale)** :
- `supabase/migrations/20260910000600_gescom_e10_22b_22c_purge_execution.sql`
- `src/modules/order-files/application/purge-execution-repository.ts`
- `src/modules/order-files/application/orphan-object-repository.ts`
- `tests/sql/gescom-e10-22b-22c-purge-execution.sql`

**Créés (qa-review round 1)** :
- `supabase/migrations/20260910000700_gescom_e10_22c_qa_round1_confirm_expiry_guard.sql` (B2 — `create or replace` de `api_confirm_order_file_upload`/`api_confirm_order_file_upload_by_link`, DÉJÀ COMMITTÉES, jamais éditées directement)
- `tests/sql/gescom-e10-22c-qa-round1-confirm-expiry-guard.sql` (B2, 5 scénarios)

**Modifiés (remise initiale)** :
- `src/adapters/supabase/order-file-purge-repository.ts` (deux classes ajoutées : `SupabaseOrderFilePurgeExecutionRepository`, `SupabaseOrphanObjectRepository`)
- `src/modules/order-files/application/purge-sweep-service.ts` (étapes 4/5 du balayage, `PurgeSweepSettings`/`PurgeSweepReport` étendus)
- `src/server/api/order-file-purge-composition.ts` (deux adaptateurs neufs injectés dans `createOrderFilePurgeSweepApplication`)
- `supabase/functions/magrit-order-file-purge/index.ts` (docstring)
- `src/modules/_shared/api/contracts.ts` (`order_files.purged` ajouté à `OUTBOX_EVENT_NAMES` — refermait la dette D4 d'E10.22a)
- `src/modules/_shared/application/outbox.ts` (`order_files.purged` ajouté à `OUTBOX_EVENT_VERSIONS`)
- `scripts/test-storefront-sql.sh` (cas SQL de ce lot ajoutés à `SQL_CASES`)
- `tests/modules/order-files/purge-sweep-service.test.ts`
- `tests/server/api/order-file-purge-composition.test.ts`

**Modifiés (qa-review round 1)** :
- `supabase/migrations/20260910000600_gescom_e10_22b_22c_purge_execution.sql` — **retouchée en place** (jamais déployée ailleurs qu'en session locale, même traitement que le réordonnancement B1 d'E10.22a) : garde de purge durcie (M1 : `failed_at is null`, rappels distincts ; N4 : même tenant), fonction neuve `api_count_blocked_order_file_purges` (B1), branche orphelins (b) sur `deleted_at` au lieu de `purged_at` (M2), exclusion des chemins à segment vide (N3)
- `src/modules/order-files/application/purge-execution-repository.ts` (méthode `countBlockedFiles`, type `BlockedPurgeCount`/`BlockedPurgeReason` — B1)
- `src/adapters/supabase/order-file-purge-repository.ts` (`countBlockedFiles` — B1 ; N2 : échec de consignation journalisé, tour non avorté ; N1 : compte de retrait dérivé du résultat réel de `.remove()`)
- `src/modules/order-files/application/purge-sweep-service.ts` (étape 6 — comptage des blocages, B1)
- `src/server/api/order-file-purge-composition.ts` (docstring — B1)
- `supabase/functions/magrit-order-file-purge/index.ts` (`console.warn` des blocages à chaque tour — B1 ; docstring)
- `src/modules/order-files/application/order-files-repository.ts` (classe `OrderFileUploadExpiredError` — B2)
- `src/adapters/supabase/order-files-repository.ts` (mapping `order_file.upload_expired` — B2)
- `src/adapters/supabase/order-upload-links-repository.ts` (mapping `order_file.upload_expired`, RÉUTILISE `OrderFileUploadExpiredError` — B2)
- `src/server/api/order-files-routes.ts` (409 `order_file.upload_expired` — B2)
- `src/server/api/order-upload-links-routes.ts` (409 `order_file.upload_expired` — B2)
- `tests/modules/order-files/purge-sweep-service.test.ts` (fake `countBlockedFiles`, 1 test neuf — B1)
- `tests/server/api/order-file-purge-composition.test.ts` (fakes étendus, 3 tests neufs — B1/N1/N2)
- `scripts/test-storefront-sql.sh` (cas SQL B2 ajouté à `SQL_CASES`)

**Non touchés (rappel R5)** : `openapi/magrit-core.v1.yaml`,
`src/platform/api/generated/magrit-core.v1.ts`, la migration `20260910000500`
(E10.22a/a-bis, aucune colonne/fonction/trigger retouchée) — le contrat était
déjà écrit par l'architecte ; le seul écart constaté (D8, `purge_at` toujours
optionnel) est une dette signalée avec chemin de mise en conformité, pas un
défaut corrigé sans mandat. Les migrations `20260909060000` (E10.17a) et
`20260910000400` (E10.20b) ne sont **jamais éditées directement** malgré le
correctif B2 : la migration neuve `20260910000700` les retouche par
`create or replace function` uniquement, même discipline que
`commercial_order_files_set_updated_at()` en `20260910000500`.

## Fin de lot

E10.22b + E10.22c ferment le mécanisme de purge automatique des fichiers de
commande dans son intégralité : la garde des deux preuves de livraison
confirmées gouverne toute destruction (aucun affaiblissement de ce que
E10.22a/E10.22a-bis ont construit, et désormais durcie par M1/N4), les octets
sont réellement détruits (ligne conservée), une trace versionnée
(`order_files.purged`) existe pour chaque tour, la dette D7 (objets orphelins
jamais confirmés) est refermée, et le mécanisme est **réellement
observable** (B1 : comptage des blocages par tenant et par motif, journalisé
à chaque tour). Après qa-review round 1 (« REJETÉ » → corrections B1/B2/M1/M2
+ N1-N4), le scénario de destruction d'un fichier légitime en cours de dépôt
(B2) est devenu **structurellement irreproductible**. **Cette story n'est
prête pour merge qu'après une nouvelle revue `qa-review` distincte**,
conformément à la règle du dépôt.
