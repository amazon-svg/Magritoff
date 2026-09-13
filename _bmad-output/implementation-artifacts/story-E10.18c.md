---
id: E10.18c
epic: E10 — Gestion commerciale
status: corrected-after-qa-review-round-3
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.18a, E10.18b]
blocks: [E10.18d, E10.18e, E10.18f]
---
# E10.18c — Export comptable des commandes : la ressource, la file, le chemin de lecture, le CSV et la purge de rétention (extension de `magrit-order-file-purge`)

Contrat déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.24, commit
`bc4b8333` ; `openapi/magrit-core.v1.yaml`), **non modifié par ce lot**
(`pnpm gen:api:check` vert, aucun diff sous `openapi/` ni
`src/platform/api/generated/`).

Périmètre livré : table `commercial_order_exports` + trigger d'immuabilité +
RLS testée ; `api_request_order_export`, `api_claim_order_exports`,
`api_read_order_export_rows` (descendue du lot (b), point 4 du contrat) ;
bucket Storage `order_exports` ; purge de rétention 7 jours (partielle — voir
blocage ci-dessous) ; les trois endpoints REST ; module `order-exports` ;
routes ; tests de contrat ; runner (Edge Function + composition) ; renderer
CSV. Aucun rendu XLSX (lot d), aucun écran (lot e), aucun `net.http_post` de
réveil immédiat (lot f, optionnel, non livré).

## qa-review round 1 (2026-09-13) — REJETÉ, CORRIGÉ

La qa-review a rejeté ce lot sur deux points bloquants et un écart d'ordre
qu'aucune des relectures précédentes (dev, cadrage, qa-review elle-même au
premier passage) n'avait vu. L'architecte a tranché quatre arbitrages ;
tous appliqués dans cette révision. Traité point par point :

1. **BLOQUANT — `order_status` sortait en code technique brut (`validated`)
   dans le fichier remis au comptable.** CORRIGÉ. La règle de traduction
   (contrat point 4) était juste, son *énumération* de colonnes à traduire
   ne l'était pas : une liste de deux colonnes (`customer_type`,
   `vat_regime`) présentée comme exhaustive avait laissé passer une
   troisième. Remplacée par un **critère vérifiable** : une colonne se
   traduit *si et seulement si* sa valeur provient d'une énumération fermée
   de ce contrat. Trois colonnes s'en déduisent : `customer_type`,
   `order_status` (`validated` → « Validée »), `vat_regime`. Le piège
   inverse est rangé correctement : « Étape de production » (libellé de
   tenant, aucune énumération) **ne se traduit pas**. Chaque table de
   traduction est désormais vérifiée **exhaustive au compilateur**
   (`satisfies Record<Enum, string>` contre les types générés depuis
   l'OpenAPI) et `translateEnum()` **échoue bruyamment** (throw, capturé par
   le renderer en `order_export.generation_failed`) sur toute valeur
   rencontrée à l'exécution qui ne figurerait pas dans la table — plus de
   repli silencieux `?? raw`. Fichier :
   `src/modules/order-exports/application/order-export-columns.ts`. Tests :
   `tests/modules/order-exports/csv-renderer.test.ts` (traduction
   `order_status`, non-traduction d'« Étape de production », échec bruyant
   sur les trois enums).
2. **BLOQUANT — deux affirmations fausses sur `storage.protect_delete()`.**
   CORRIGÉ. La garde n'est pas inconditionnelle : elle est contournable par
   `set local storage.allow_delete_query = 'true'` (vérifié par exécution
   réelle, dans les deux sens). On ne l'emprunte pas pour autant — motif
   corrigé et opposable : un `DELETE` direct sur `storage.objects` ne
   retirerait que la métadonnée, jamais le binaire, qui resterait orphelin
   dans le backend de stockage — pire que ne rien purger sur un fichier
   portant le CA complet et les SIRET. Les trois endroits qui affirmaient
   une impossibilité (migration, commentaire de fonction, ce document) sont
   corrigés.
3. **La purge doit vraiment détruire le fichier, pas seulement marquer la
   ligne.** ARBITRAGE : une purge de LIGNES se fait en SQL direct ; une
   purge d'OBJETS DE STOCKAGE passe par l'API Storage, donc par une Edge
   Function. Le bon précédent était déjà dans le dépôt :
   `magrit-order-file-purge` (E10.22b) détruit déjà des objets Storage sur
   planification quotidienne, marquage transactionnel PUIS retrait par lot
   best-effort. **`purge_expired_order_exports()` est retirée**, remplacée
   par `public.api_claim_order_exports_for_purge(p_limit)` — réclame et
   marque `ready -> expired` (SQL pur, transactionnel, `for update skip
   locked`) ET rend `storage_path` pour destruction réelle. **Aucune
   troisième Edge Function** : `magrit-order-file-purge` est ÉTENDUE
   (`supabase/functions/magrit-order-file-purge/index.ts` appelle
   maintenant deux applications indépendantes, chacune dans son propre
   `try/catch`) via un nouveau point de composition
   `src/server/api/order-export-purge-composition.ts`, un nouveau port
   `src/modules/order-exports/application/order-export-purge-repository.ts`
   et un nouvel adaptateur `SupabaseOrderExportPurgeRepository`
   (`src/adapters/supabase/order-exports-repository.ts`) qui reprend la
   discipline de `SupabaseOrderFilePurgeExecutionRepository` (marquage
   avant retrait, compte rendu dérivé du résultat réel de `remove()`, jamais
   de `rows.length`).
4. **L'ordre des colonnes divergeait entre le contrat et le fichier
   réellement produit** (trois colonnes déplacées, deux divergences
   supplémentaires non relevées au premier passage : position de « Taux de
   remise ligne », intitulé « Désignation » au lieu de « Libellé produit »).
   ARBITRAGE : l'OpenAPI (`OrderExportGranularity`) est désormais **la seule
   source d'ordre**, alignée sur le catalogue de (b) (jugé meilleur), ordre
   **arrêté définitivement** — tout déplacement futur exigera
   `layout_version: 2` et un préavis. `order-export-columns.ts` reproduit
   cet ordre à l'identique (onze colonnes partagées, « Désignation »
   renommée). Vérifié par génération d'un fichier CSV réel et comparaison
   colonne par colonne au contrat (voir « Tests exécutés » ci-dessous) :
   correspondance exacte, aux 19 colonnes `order` et 18 colonnes `line`.
5. **« Courriel interlocuteur » ajoutée aux deux vues du lot (b), migration
   additive dans (c).** FAIT. `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`,
   section « 1bis » : `create or replace view` sur les deux vues du lot (b),
   colonne `cc.email` sur le `left join` déjà présent (clé primaire, aucun
   risque de multiplication — propriété déjà prouvée en (b), non retestée).
   **Piège rencontré et corrigé en cours de route** : Postgres refuse
   qu'un `create or replace view` renomme/déplace une colonne de sortie
   existante (`SQLSTATE 42P16`, confirmé par exécution réelle contre
   Supabase local) — la colonne ne peut être ajoutée qu'**en dernière
   position** du `select`. Sa place au rang 9 du *fichier* est donc
   reconstruite par `order-export-columns.ts`, qui lit les colonnes de la
   vue **par nom**, jamais par position physique : l'ordre de sortie SQL de
   la vue n'a jamais été un contrat, seul le nom des colonnes l'est.
   `api_read_order_export_rows` propage `customer_contact_email` dans les
   deux branches (`order`/`line`) du payload jsonb. Les deux autres colonnes
   citées par l'ancien texte narratif (« Date de livraison prévue »,
   « Origine de la ligne ») sont retirées du contrat par l'architecte :
   rien à faire côté code, elles n'étaient déjà pas exposées.
6. **Points tracés, non corrigés sur décision explicite** :
   - Clause de tenant redondante dans la RLS de `commercial_order_exports`
     (`tenant_id in (select current_user_tenant_ids())` aux côtés de
     `user_has_capability`) — défense en profondeur légitime, commentée en
     l'état dans la migration, **non retirée**.
   - Injection de formule CSV (`=`, `+`, `@` en tête d'une raison sociale,
     interprétés comme formule par Excel) — **hors contrat, hors périmètre
     de ce lot**, tracée au backlog ci-dessous.

### Backlog (hors périmètre de ce lot, tracé pour un lot futur)

- **Injection de formule CSV** : une raison sociale, un nom d'interlocuteur
  ou un libellé de ligne commençant par `=`, `+`, `-` ou `@` est interprété
  comme une formule par Excel/LibreOffice à l'ouverture. Standard de
  correction connu (préfixer d'une apostrophe ou d'un guillemet neutralisant
  ces cinq caractères en tête de champ) — à instruire dans un lot XLSX/CSV
  ultérieur (E10.18d probablement, puisque le même risque existe côté
  XLSX), pas ajouté ici sans mandat explicite (le contrat de ce lot ne le
  cite pas).

## qa-review round 2 (2026-09-13) — REJETÉ sur un seul bloquant, CORRIGÉ

Round 2 a vérifié en profondeur (exécution réelle, pas relecture) tout ce
qui avait été corrigé au round 1 — traduction `order_status`, piège inverse
« Étape de production », exhaustivité au compilateur testée dans les deux
sens (retrait de `dom_tom` → erreur TS ; ajout de `"cancelled"` à
l'énumération → échec ciblé), ordre des colonnes recomparé en-tête par
en-tête sur le fichier produit, absence de multiplication de ligne après
l'extension du `left join`, `deno check` réel, `purge_expired_order_exports`
bien absente — **tout ce périmètre est validé, rien n'y a bougé**. Un seul
bloquant, ciblé.

### BLOQUANT — la purge « se rattrape au tour suivant » ne se rattrapait jamais

**Ce que le code faisait réellement, contrairement à quatre commentaires**
(migration, port TypeScript deux fois, adaptateur) : `api_claim_order_
exports_for_purge` marquait la ligne `expired` **dès la réclamation**,
avant toute tentative de retrait Storage. Le trigger d'immuabilité de
`commercial_order_exports` interdit **toute sortie** de `expired`. Une
ligne marquée `expired` dont le `remove()` échouait (5xx, ou retrait
partiel d'un lot) **n'était donc plus jamais réclamée** — le
`console.error` sur `removeError` journalisait un échec qu'aucun tour
suivant ne rejouait. Aggravant : contrairement au patron `commercial_order_
files` (E10.22b), qui a un filet dédié (balayage d'objets orphelins,
E10.22c), ce filet est **codé en dur sur l'autre bucket**
(`where o.bucket_id = 'commercial_order_files'`, migration
`20260910000600`) — rien ne balaie `order_exports`. Un fichier non retiré y
restait orphelin **pour toujours**, sans le moindre signal (le corps de
réponse HTTP n'est pas relu par `pg_net`). Exactement le défaut que
l'arbitrage de purge existe pour interdire (docs/api/CONVENTIONS.md,
« la rétention serait tenue dans le registre et violée sur le disque »).

**Correction, sans fonction SQL ni état supplémentaire au-delà d'UNE
fonction de confirmation** — l'invariant devient auto-porteur : *une ligne
`expired` avec `storage_path` non nul = l'objet est encore présent*.

- `api_claim_order_exports_for_purge` réclame désormais `status in
  ('ready', 'expired')` (au lieu de `'ready'` seul) — une ligne déjà
  `expired` dont l'objet n'a pas été confirmé retiré (`storage_path` encore
  non nul) est **re-réclamée**. La transition `expired -> expired` passe le
  trigger sans exception (`old.status is distinct from new.status` est
  faux). `storage_path` n'est **plus jamais** mis à `null` par cette
  fonction.
- Nouvelle fonction `public.api_confirm_order_export_files_purged(p_export_ids
  uuid[])` — met `storage_path` à `null`, **uniquement** pour les ids
  passés, **uniquement** si `status = 'expired'`. Rend le nombre de lignes
  réellement mises à jour (0 si déjà nettoyées — no-op, jamais une erreur).
  C'est elle, et elle seule, qui ferme l'invariant.
- `SupabaseOrderExportPurgeRepository.purgeExpiredFiles` : appelle cette
  confirmation **uniquement** après un `remove()` sans erreur. Sur
  `removeError` **ou** sur un échec de la confirmation elle-même, la ligne
  reste `expired` avec `storage_path` non nul → re-réclamée au tour
  suivant. `objectsRemoved` est désormais dérivé du **nombre de lignes
  réellement confirmées** (retour de la RPC), plus de `removed?.length`
  (dont la fiabilité inter-backends n'est pas garantie, cf. commentaire
  ajouté dans le port).
- Edge Function `magrit-order-file-purge/index.ts` : `console.warn` ajouté
  quand `objectsRemoved < filesMarkedExpired` (précédent `blockedFiles`
  d'E10.22b — seul canal réellement observable, `pg_net` ne relit pas le
  corps HTTP). `createOrderExportPurgeApplication(...)` déplacée **dans**
  le `try` (elle ne fait qu'instancier, mais une instanciation qui lèverait
  ne doit pas non plus faire disparaître le rapport du balayage précédent).
- **Les quatre commentaires faux corrigés**, plus l'erreur factuelle
  adjacente (« le même bucket Storage privé » — ce sont deux buckets
  distincts, `commercial_order_files`/`order_exports` ; c'est probablement
  la source de la méprise, la discipline `PurgeExecutionRepository` ayant
  été recopiée sans remarquer que son filet d'orphelins ne couvrait pas ce
  bucket-ci) : migration `20260913000000` (section 8 réécrite, commentaires
  de table/colonne), `order-export-purge-repository.ts` (port, réécrit),
  `order-exports-repository.ts` (adaptateur, réécrit).
- **Scénario 7 du cas SQL réécrit pour prouver la reprise**, pas son
  absence : un export `expired` dont `storage_path` reste non nul est
  **re-réclamé** ; un export `expired` dont `storage_path` a été mis à
  `null` (confirmation simulée par appel direct à
  `api_confirm_order_export_files_purged`) n'est **plus jamais** réclamé ;
  un export `ready` non échu n'est toujours jamais réclamé.

### Trois mineurs traités

- **Titre du point 2 signalé au premier passage** : marqué `[CORRIGÉ —
  FAUX]` dans son titre (pas seulement dans un bandeau interne) — c'est le
  seul niveau que lit un sommaire.
- **`translateEnum` sur `Object.hasOwn`** : `labels[raw] === undefined`
  remplacé par `!Object.hasOwn(labels, raw)`, pour qu'une valeur brute
  littérale `"toString"`/`"constructor"` (héritée d'`Object.prototype`) ne
  puisse pas échapper au throw. Injoignable en pratique (colonne contrainte
  par énumération en base), corrigé quand même.
- **`createOrderExportPurgeApplication(...)` hors de tout `try`** : déplacée
  dans le `try` de la purge des exports — voir ci-dessus.

## qa-review round 3 (2026-09-13) — REJETÉ sur le retrait partiel, CORRIGÉ (arbitrage architecte : deux mécanismes)

Round 3 a rouvert la correction du round 2 et trouvé qu'elle fermait le cas
« `remove()` en **erreur** » (vérifié par sonde) mais pas le **retrait
partiel**, qui ne lève aucune erreur : `SupabaseOrderExportPurgeRepository`
confirmait **tous** les ids réclamés dès que `remove()` rendait
`error: null`, **sans regarder `data`**. Un lot de 3, `remove()` rendant
`{data: [1 élément], error: null}`, effaçait les trois `storage_path` → 2
fichiers orphelins **définitifs**, et le `console.warn` ne se déclenchait
pas non plus (`objectsRemoved` était compté égal à `filesMarkedExpired`).
Quatre commentaires + le titre du point 2 signalé au premier passage
répétaient la même famille d'erreur (une reprise affirmée qui ne l'était
pas, ou une affirmation non nuancée).

### Le fait établi (vérifié sur le code source du serveur Storage)

Filtrer sur `data` est une **approximation**, jamais une preuve, **dans les
deux sens** : `data` = les lignes réellement supprimées de
`storage.objects` (`DELETE … RETURNING *`), mais (i) la RLS filtre
silencieusement ce qui n'est pas visible (faux négatif possible) ; (ii)
quand le backend S3 sous-jacent rend un 200 avec des erreurs **par clé**,
l'adaptateur serveur Storage n'inspecte **pas** `result.Errors` — un chemin
peut figurer dans `data` alors que l'objet binaire **survit** (faux positif
possible). Conclusion opposable : filtrer sur `data` produit des faux
positifs, pas seulement des faux négatifs.

### L'arbitrage — (c) porteur, (a) par-dessus

- **(c) SOLUTION PORTEUSE, pas un complément** : nouveau balayage d'objets
  orphelins **dédié au bucket `order_exports`**
  (`public.api_claim_orphan_order_export_objects`, migration
  `20260913000000` section 9), qui rattrape tout ce que la reclamation
  normale n'a pas confirmé retiré. Motif : toute solution, y compris un
  filtre parfait sur `data`, finit par un cas où l'on n'a pas pu confirmer
  — sans filet indépendant, chaque branche finit par une fuite. **Ce filet
  est sûr ici** (contrairement à `commercial_order_files`/E10.22c, où une
  course réelle a été documentée) : le chemin `<tenant_id>/<export_id>.
  <ext>` porte un `export_id` **neuf à chaque demande**, jamais réutilisé —
  aucune confirmation légitime ne peut jamais rattraper un objet que ce
  balayage vient de retirer. Chemin isolé par **égalité directe** sur
  `storage_path` (pas de `split_part`, plus simple que le patron E10.22c
  puisque cette colonne stocke déjà le chemin complet).
- **(a) PAR-DESSUS** : nouvelle colonne `purge_attempts` (plafond **3**,
  aligné sur `attempts`). Épuisée, `api_claim_order_exports_for_purge`
  cesse de réclamer la ligne **sans rien confirmer** — elle reste visible
  (`expired`, `storage_path` non nul, `purge_attempts`=3), jamais un
  nouveau statut (`OrderExport.status` continue de décrire le cycle de vie
  de la *demande*, jamais la santé du ménage).
- **(b) refusé** (documenter le comportement actuel) : une rétention est
  une promesse de **destruction**, pas de marquage, et un événement rare et
  invisible est celui dont on n'apprend jamais qu'il s'est produit.
- **Simplification retenue** : `storage_path` n'est écrit qu'en un seul
  endroit (`markReady()`), après un dépôt réussi — une génération qui
  échoue laisse `failed` + `storage_path` nul. Le cas « fichier jamais
  écrit » ne peut donc pas produire un `storage_path` non nul ; seule la
  suppression manuelle (rare) justifie la catégorie (a) du balayage, avec
  une marge de 24h (fenêtre dépôt→`markReady`, close en quelques secondes
  en usage normal — pas par symétrie avec E10.22c, pour ce motif précis).

### Corrections appliquées

- `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql` —
  colonne `purge_attempts` ajoutée ; `api_claim_order_exports_for_purge`
  plafonnée (`purge_attempts < 3`, incrémentée à chaque réclamation) ;
  nouvelle fonction `api_claim_orphan_order_export_objects(p_older_than,
  p_limit)` (deux catégories, `matched_export_id` pour la catégorie (b)) ;
  commentaires de section 8 réécrits (le fait établi, l'arbitrage complet).
- `src/modules/order-exports/application/order-export-purge-repository.ts`
  — port réécrit : `OrderExportPurgeRepository.purgeExpiredFiles` documente
  la confirmation **ciblée** (jamais en bloc) ; nouveau port
  `OrderExportOrphanRepository.removeOrphanObjects`.
- `src/modules/order-exports/application/order-export-purge-service.ts`
  (nouveau) — `OrderExportPurgeService`, orchestrateur à deux étages
  (réclamation normale PUIS balayage d'objets orphelins), testable sans
  Supabase.
- `src/adapters/supabase/order-exports-repository.ts` —
  `SupabaseOrderExportPurgeRepository.purgeExpiredFiles` réécrite : confirme
  **uniquement** les ids dont le chemin figure dans `data` (jamais tous les
  ids réclamés en bloc). Nouvelle classe
  `SupabaseOrderExportOrphanRepository`, qui confirme en plus les objets de
  la catégorie (b) effectivement retirés.
- `src/server/api/order-export-purge-composition.ts` — recâblé sur
  `OrderExportPurgeService` (deux repositories au lieu d'un).
- `supabase/functions/magrit-order-file-purge/index.ts` — `console.warn`
  reformulé (approximation, pas une certitude) et enrichi de
  `orphanObjectsRemoved`.
- **Titre du point 2 signalé au premier passage** : marqué `[CORRIGÉ —
  FAUX]` **dans le titre**, plus seulement dans un bandeau interne (mineur
  round 3).
- **Erreur factuelle « le même bucket »** répétée dans la partie corrective
  (pas le bloc préservé comme faux) du point 2 signalé au premier
  passage : corrigée (mineur round 3, voir ce point).
- **Titre du story doc** : mentionne désormais l'extension de purge, qui
  est un livrable de ce lot (mineur round 3).

### Second manquement, sans arbitrage : aucun test ne tenait la correction round 2

`grep -rn "purgeExpiredFiles|OrderExportPurge" tests/` rendait zéro avant ce
round. **Corrigé** : `tests/server/api/order-export-purge-composition.test.ts`
(8 cas), qui couvre remove() en erreur ⇒ aucune confirmation, confirmation
en erreur ⇒ `objectsRemoved=0`, **retrait partiel ⇒ seuls les chemins de
`data` confirmés** (le cas central de ce round), succès ⇒ `objectsRemoved`
dérivé du retour RPC (pas de `data.length`), et le balayage d'objets
orphelins (deux catégories, confirmation ciblée sur la catégorie (b)).

**Vérifié par mutation, comme demandé, DEUX résultats rapportés** :
1. `SupabaseOrderExportPurgeRepository.purgeExpiredFiles` régressée pour
   confirmer tous les ids réclamés dès que `error === null` (le défaut
   exact du round 2) → le test « RETRAIT PARTIEL » **échoue**
   (`expected ['exp-a'] received ['exp-a', 'exp-b']`), les six autres
   passent — la mutation est **ciblée**, le test **prouve** la propriété.
   Code restauré, les 8 cas repassent au vert.
2. `api_claim_order_exports_for_purge` régressée pour retirer le plafond
   `purge_attempts` (`and e.purge_attempts < 3` remplacé par `and true`) →
   le scénario 8 du cas SQL **échoue**
   (`un export dont purge_attempts=3 a ete reclame une quatrieme fois`).
   Migration restaurée, `pnpm db:local:reset` + cas SQL repassent au vert
   (9 scénarios).

## Points signalés a l'architecte au premier passage — TOUS TRANCHÉS ci-dessus

### 1. Écart entre le catalogue de colonnes narratif de l'OpenAPI et les vues du lot (b) — TRANCHÉ, voir qa-review round 1 point 5 ci-dessus.

`openapi/magrit-core.v1.yaml` (`OrderExportGranularity`, description texte)
cite trois colonnes que les vues `private.commercial_order_export_headers`/
`_lines` (migration `20260912000400`, lot (b), hors de mon périmètre) **ne
sélectionnent pas** :
- « Courriel interlocuteur » — existerait via `customer_contacts.email`
  (colonne réelle, non nulle) ;
- « Date de livraison prévue » — existerait via
  `commercial_orders.expected_delivery_date` (colonne réelle, E10.16) ;
- « Origine de la ligne » — existerait via `commercial_order_lines.origin`
  (colonne réelle, E10.12).

Vérifié par `git log`/`git show` : le texte de `OrderExportGranularity` a été
écrit au cadrage initial (commit `4ff70d3a`) et amendé une fois
(`bc4b8333`, qa-review de (b)) sans que ces trois colonnes ne soient
reconciliées avec ce que (b) livre réellement. Ce n'est donc pas une
hypothèse : les trois colonnes correspondent à de la donnée réelle, non
exposée par les vues actuelles.

**Ce lot (c) ne modifie pas les vues du lot (b)** (hors de son périmètre
déclaré) : le générateur CSV se limite aux dix colonnes partagées + colonnes
propres réellement exposées (catalogue documenté en tête de la migration
`20260912000400` et repris dans
`src/modules/order-exports/application/order-export-columns.ts`). Le fichier
produit est utile et exact ; il est simplement plus court que le catalogue
narratif de l'OpenAPI.

**Mise en conformité, à trancher par l'architecte** : soit étendre les vues
du lot (b) (migration additive, aucun risque de sécurité — mêmes jointures
déterministes déjà en place), soit corriger le texte de
`OrderExportGranularity`.

### 2. La purge ne détruit PAS l'objet Storage — impossibilité confirmée par exécution réelle [CORRIGÉ — FAUX, voir « qa-review round 1 » point 2 et « qa-review round 2 » ci-dessus]

Le contrat (§8.24 point 3(e)) demande un « appel SQL direct par `pg_cron`...
pas d'Edge Function pour un delete » qui « détruit l'objet Storage ». La
version d'origine de `purge_expired_order_exports()` faisait
`delete from storage.objects ...`. **Exécutée réellement** contre Supabase
local (`pnpm db:local:push` puis le cas SQL de ce lot), elle échoue
systématiquement :

```
ERROR: Direct deletion from storage tables is not allowed. Use the Storage API instead.
CONTEXT: PL/pgSQL function storage.protect_delete() line 5 at RAISE
```

Supabase pose lui-même un trigger (`storage.protect_delete()`) qui rejette
tout `DELETE` direct sur `storage.objects`, **inconditionnellement**, y
compris depuis une fonction `security definer`. Les deux exigences du
contrat (« détruit l'objet Storage » ET « aucune Edge Function pour un
delete ») sont **mutuellement exclusives** sur cette version de Supabase —
ce n'est pas un risque, c'est une impossibilité technique, prouvée en
environnement réel.

**Décision conservatoire prise ici, en attendant l'arbitrage** :
`purge_expired_order_exports()` effectue **seulement** la transition d'état
`ready -> expired` (SQL pur, toujours possible) et **ne supprime pas
l'objet**. Conséquence à ne pas minimiser : le fichier reste physiquement
dans le bucket au-delà des 7 jours promis, tant que ce point n'est pas
tranché — un écart réel au contrat sur la promesse de rétention, documenté
en clair dans la migration (§8) et le test SQL (scénario 7), pas corrigé en
silence par un mécanisme qui semblerait fonctionner.

Deux voies de mise en conformité, à arbitrer par l'architecte :
1. une petite Edge Function (ou une extension de
   `magrit-order-export-runner`) appelant le client Storage `service_role`
   pour le `DELETE` réel, déclenchée par le même `pg_cron` quotidien — le
   contrat renoncerait alors à « aucune Edge Function pour un delete » ;
2. une politique de cycle de vie du bucket au niveau du backend de stockage
   sous-jacent, **à vérifier**, pas à supposer.

> ⚠️ **CORRECTION (qa-review round 1, 2026-09-13)** : le paragraphe
> ci-dessus, section 2, affirme que `storage.protect_delete()` rejette tout
> `DELETE` direct **inconditionnellement** et qualifie cela d'**impossibilité
> technique**. **C'est faux, vérifié par exécution réelle dans les deux
> sens** : la garde est *conditionnelle*
> (`current_setting('storage.allow_delete_query', true)`), contournable
> explicitement. Ce paragraphe est conservé **tel quel, non réécrit**,
> pour qu'on voie exactement où l'erreur est née (une lecture partielle du
> message d'erreur de Postgres, sans aller lire le corps de la fonction
> `storage.protect_delete()`) — la correction opposable, le motif exact
> pour lequel on n'emprunte quand même pas cette porte, et l'arbitrage rendu
> sont dans la section « qa-review round 1 » ci-dessus, point 2, et dans
> `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`
> section 8 (corrigée). **Voie 1 ci-dessus est celle retenue**, mais PAS sur
> `magrit-order-export-runner` : sur `magrit-order-file-purge` (E10.22b),
> qui tournait déjà quotidiennement pour le même GESTE (marquage puis
> retrait Storage par lot) sur un BUCKET DISTINCT
> (`commercial_order_files`, PAS `order_exports` — deux buckets, deux
> tables, un seul mécanisme réutilisé ; corrigé qa-review round 3, où cette
> même erreur factuelle — « le même bucket » — s'était reproduite une
> seconde fois, voir plus bas) (voir qa-review round 1, point 3).

## Critères d'acceptation — vérifiés un par un

- **Table + trigger + RLS testée** : FAIT. `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`.
  RLS gardée par capability (`can_export_orders`) **et** tenant — pas
  seulement l'appartenance, écart documenté et testé (scénario 1a/1b du cas
  SQL). Trigger d'immuabilité : colonnes de définition figées, machine à
  états du statut, **DELETE toujours refusé** (écart volontaire avec
  `notification_logs`, motivé : cette table n'a pas de retention par
  DELETE).
- **`api_request_order_export`** : FAIT. Sécurisé (capability vérifiée en
  interne, defense en profondeur), plafond de 3 demandes non terminées par
  acteur, `requested_by`/`requested_by_label` résolus depuis `auth.uid()`.
- **`api_claim_order_exports`** : FAIT. Copie conforme du patron
  `api_claim_notification_messages` (`for update skip locked`, incrément
  d'`attempts` à la réclamation), rebut par fraîcheur sans génération.
- **`api_read_order_export_rows`** : FAIT, et c'est le cœur du lot.
  Signature exacte `(p_export_id, p_after, p_limit)`, aucun paramètre de
  tenant ni de filtre. Isolation de tenant **prouvée par exécution réelle**
  (scénario 5 du cas SQL) **et prouvée savoir échouer** (mutation délibérée
  du filtre `tenant_id`, confirmée faire échouer le test avant d'être
  restaurée). Filtres (`customer_id`, période) appliqués en SQL contre les
  colonnes brutes de `commercial_orders`, rejointes par la colonne technique
  `order_id` exposée par les vues du lot (b). Chaque valeur numérique sort
  en **chaîne JSON** (cast explicite `::text`), jamais un nombre natif —
  condition du point de conversion unique côté générateur (contrat §8.24
  point 5) : vérifié par le scénario 5c.
- **Bucket `order_exports`** : FAIT. Privé, aucune policy `storage.objects`,
  types MIME limités au format.
- **Purge de rétention 7 jours** : FAIT (corrigée trois fois — qa-review
  round 1 : la destruction Storage n'existait pas ; round 2 : la reprise
  sur échec de retrait n'était pas réelle ; round 3 : le retrait partiel
  contournait encore la reprise, voir section « qa-review round 3 » pour
  l'arbitrage complet à deux mécanismes). `api_claim_order_exports_for_purge()`
  réclame `status in ('ready','expired')` et `purge_attempts < 3`, marque/
  maintient `expired`, incrémente `purge_attempts`, rend `storage_path`
  tant qu'il n'est pas confirmé retiré ; l'Edge Function
  `magrit-order-file-purge` (E10.22b, **étendue**, pas une troisième Edge
  Function) retire réellement l'objet Storage par lot, best-effort, PUIS
  confirme (`api_confirm_order_export_files_purged`) **uniquement** les ids
  dont le chemin figure dans la réponse de retrait (round 3 : jamais tous
  les ids réclamés en bloc — un retrait partiel, sans erreur de lot, ne
  doit confirmer que ce qui est réellement rendu). Au-delà de trois
  réclamations sans confirmation, la ligne cesse d'être réclamée par cette
  fonction (état visible : `expired`/`storage_path` non nul/`purge_attempts`=3)
  et devient candidate au balayage d'objets orphelins **dédié**
  (`api_claim_orphan_order_export_objects`, **solution porteuse**, pas un
  complément — arbitrage architecte round 3). Un `console.warn` signale
  tout tour où `objectsRemoved < filesMarkedExpired`. Vérifié par les
  scénarios 7 (réclamation + reprise), 8 (plafond `purge_attempts`) et 9
  (balayage d'objets orphelins, deux catégories) du cas SQL, et par
  `tests/server/api/order-export-purge-composition.test.ts` (8 cas,
  couvrant explicitement le retrait partiel — **vérifiés par mutation dans
  les deux sens**, voir section « qa-review round 3 ») — la destruction
  réelle de l'objet (appel HTTP à l'API Storage) n'est pas du ressort d'un
  test SQL, elle vit dans `src/adapters/supabase/order-exports-repository.ts`
  (`SupabaseOrderExportPurgeRepository`/`SupabaseOrderExportOrphanRepository`).
- **Trois endpoints REST** : FAIT.
  `src/server/api/order-exports-routes.ts`, enregistrés dans
  `gescom-routes.ts`. Gardés par `can_export_orders` sur les trois
  opérations (lecture comprise, écart documenté au contrat). Filtres de
  `requestCommercialOrderExport` héritent de la validation calendaire de
  `listCommercialOrders` **sans en recopier la logique**
  (`resolveCalendarBoundOrThrow`, extrait en fonction partagée
  `src/modules/_shared/application/calendar-bounds.ts`, réutilisée par
  `commercial-orders-routes.ts` — comportement inchangé, vérifié par
  `pnpm test:contract`).
- **Module `order-exports`** : FAIT. `api/contracts.ts`,
  `application/{order-exports-service,order-exports-repository,
  order-export-run-repository,order-export-storage,
  order-export-generation-service,order-export-columns,order-export-renderer,
  renderers/csv-renderer}.ts`. Aucun `client.ts` ni UI : pas de consommateur
  dans ce lot (lot (e)), YAGNI assumé.
- **Adaptateurs Supabase** : FAIT.
  `src/adapters/supabase/order-exports-repository.ts` (QUATRE classes
  depuis la correction qa-review round 3 : `SupabaseOrderExportsRepository`
  sur le client `authenticated`, `SupabaseOrderExportRunRepository`,
  `SupabaseOrderExportPurgeRepository` et `SupabaseOrderExportOrphanRepository`
  sur `service_role`) et `order-exports-storage.ts`.
- **Tests de contrat** : FAIT. `tests/contract/order-exports.contract.test.ts`
  (16 cas), fake `tests/contract/_fakes/order-exports-repository.fake.ts`.
  Non couvert (documenté en tête du fichier) : la validation `quote_id`
  inconnu (le chemin de code est identique à celui, déjà testé, de
  `commercial-orders.contract.test.ts` ; `CommercialQuotesService` a un
  graphe de dépendances lourd sans rapport avec ce module).
- **Runner (Edge Function + composition)** : FAIT.
  `src/server/api/order-export-composition.ts`,
  `supabase/functions/magrit-order-export-runner/`. Extension `.ts`
  explicite sur tous les imports relatifs atteignables depuis Deno —
  vérifié par grep exhaustif (aucun import sans extension dans l'arborescence
  du module + composition + adaptateurs + edge function).
- **Renderer CSV** : FAIT.
  `src/modules/order-exports/application/renderers/csv-renderer.ts`. Forme
  non négociable (`;`, `,` décimal, BOM UTF-8, CRLF, guillemets doubles)
  testée par `tests/modules/order-exports/csv-renderer.test.ts` (24 cas
  après correction qa-review round 1), traduction des **trois** codes
  techniques (`customer_type`, `order_status`, `vat_regime`) selon le
  critère « énumération fermée du contrat » (exhaustivité vérifiée au
  compilateur, échec bruyant sur valeur inconnue à l'exécution, testé pour
  les trois), non-traduction d'« Étape de production » testée
  explicitement, ordre **définitif** des colonnes par granularité (onze
  colonnes partagées dont « Courriel interlocuteur » au rang 9,
  « Désignation ») vérifié contre le contrat ET contre un fichier CSV
  réellement produit (comparaison colonne par colonne, voir « Tests
  exécutés »).
- **Plafond de 50 000 lignes, vérifié AVANT le renderer** : FAIT.
  `ORDER_EXPORT_ROW_LIMIT` dans `order-export-generation-service.ts`, testé
  par `tests/modules/order-exports/order-export-generation-service.test.ts`
  (le renderer n'est **jamais appelé** au-delà du plafond — assertion
  explicite `expect(renderer.render).not.toHaveBeenCalled()`).
- **`Idempotency-Key` sur la création** : FAIT, mécanisme générique du socle
  (`defineGescomRoute({ createsResource: true })`), non retesté
  spécifiquement (couvert par les tests génériques du socle E10.0).
- **CA13/R13, contrat additif** : FAIT, aucune modification d'`openapi/`.

## Dérogation R5 utilisée

- **Choix d'implémentation non explicitement écrit par le cadrage** :
  interprétation Europe/Paris des filtres `created_from`/`created_to` faite
  **en SQL natif** (`at time zone`) dans `api_read_order_export_rows`,
  plutôt qu'en TypeScript, parce que la signature de la fonction (fixée par
  l'architecte à `(p_export_id, p_after, p_limit)`) ne peut recevoir des
  bornes déjà résolues sans réintroduire un paramètre de filtre. Documenté
  en détail dans la migration. Chemin de mise en conformité si contesté :
  aucun changement de signature n'est possible sans rouvrir le point 4 du
  contrat — la question serait alors de confirmer que Postgres, qui porte
  nativement le même référentiel IANA tzdata qu'`Intl.DateTimeFormat`, est
  un choix acceptable pour cette seule conversion (jamais une validation,
  déjà faite côté route via `civilDateToUtc`).

## Tests exécutés

### Round 1 (avant qa-review)

- `pnpm gen:api:check` → vert.
- `pnpm typecheck` → vert.
- `pnpm test:architecture` → vert (146 cas, 34 fichiers, inchangé — aucune
  frontière nouvelle requise par ce lot).
- `pnpm test:contract` → vert (432 cas, 23 fichiers ; +16 par rapport à la
  base 416).
- `pnpm exec vitest run tests/modules/order-exports` → vert (26 cas : 17
  renderer CSV, 9 drain de génération/nom de fichier).
- `pnpm test` (suite complète) → 2352 passés, 3 échecs **préexistants, sans
  rapport** (`tests/storage/product_mockups_isolation.test.ts`, bucket
  `product_mockups` absent de l'environnement local — feature non touchée
  par ce lot), 36 ignorés.
- `tests/sql/gescom-e10-18c-order-exports.sql`, exécuté réellement : 7
  scénarios verts, dont la transition d'état seule pour la purge (blocage
  n°2 d'alors).

### Round 2 (après correction qa-review round 1, 2026-09-13)

- `pnpm gen:api:check` → vert (aucun diff `openapi/`, contrat déjà régénéré
  par l'architecte).
- `pnpm typecheck` → vert.
- `pnpm test:architecture` → vert, inchangé (146 cas, 34 fichiers).
- `pnpm test:contract` → vert, inchangé (432 cas, 23 fichiers — aucun
  endpoint REST modifié par cette correction).
- `pnpm exec vitest run tests/modules/order-exports` → vert, **29 cas**
  (24 renderer CSV + 5 nouveaux : traduction `order_status`, non-traduction
  d'« Étape de production », échec bruyant sur les trois enums ; 9 drain de
  génération/nom de fichier, inchangé).
- `pnpm test` (suite complète) → **2355 passés**, mêmes 3 échecs
  **préexistants, sans rapport** avec ce lot
  (`tests/storage/product_mockups_isolation.test.ts`, bucket
  `product_mockups` absent de l'environnement local), 36 ignorés.
- **`supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`,
  exécutée individuellement** via `pnpm db:local:reset` (reconstruction
  complète de la base locale depuis zéro, pour garantir que la migration
  corrigée s'applique proprement dans la chaîne — pas seulement `db push`,
  dont l'historique de version aurait pu masquer un problème de contenu sur
  un fichier déjà appliqué sous le même horodatage) → **appliquée sans
  erreur**. Un premier essai a révélé un piège Postgres réel : `create or
  replace view` refuse de renommer/déplacer une colonne de sortie existante
  (`SQLSTATE 42P16`) — corrigé en ajoutant `customer_contact_email` en
  dernière position du `select` des deux vues (voir qa-review round 1,
  point 5).
- **`tests/sql/gescom-e10-18c-order-exports.sql`, exécuté réellement**
  (`docker exec ... psql < tests/sql/...`, base reconstruite ci-dessus) :
  **7 scénarios, tous verts**, avec deux scénarios enrichis pour cette
  correction :
  - scénario 5 : ajout de la vérification 5b-bis, la clé
    `customer_contact_email` doit être présente dans la charge utile
    (preuve que `api_read_order_export_rows` lit bien la vue étendue) ;
  - scénario 7 (réécrit) : preuve de la réclamation SQL
    `api_claim_order_exports_for_purge()` — marquage `ready -> expired`
    transactionnel, `storage_path` rendu à l'appelant, un export `ready`
    **non échu** n'est jamais réclamé, un export déjà `expired` n'est
    **jamais réclamé deux fois**. La destruction réelle de l'objet Storage
    (appel HTTP) n'est pas du ressort d'un test SQL — voir
    `SupabaseOrderExportPurgeRepository`.
- **`deno check` sur les deux Edge Functions, exécuté réellement** (pas une
  relecture) :
  `deno check supabase/functions/magrit-order-file-purge/index.ts` → vert ;
  `deno check supabase/functions/magrit-order-export-runner/index.ts` →
  vert (inchangée par cette correction, revérifiée par prudence puisqu'elle
  importe depuis le même module `order-exports`).
- **Fichier CSV réellement produit et comparé au contrat, colonne par
  colonne** (méthode qui a justement attrapé l'écart d'ordre au tour
  précédent — relecture seule ne suffit pas) : rendu du
  `csvOrderExportRenderer` sur une ligne `order` et une ligne `line` avec
  jeu de données réaliste (traduction, montants signés, `customer_contact_
  email` renseignée), fichier décodé octet par octet (BOM `EF BB BF`
  confirmé en hexadécimal, fin de chaque ligne `\r\n` confirmée). En-têtes
  obtenus :
  - `order` (19 colonnes) : `Numéro de commande ; Devis d'origine ; Date de
    commande ; Type de client ; Client ; SIRET ; Numéro de TVA ;
    Interlocuteur ; Courriel interlocuteur ; Statut commercial ; Étape de
    production ; Total lignes HT ; Remise globale ; Taux de remise
    effectif ; Net HT ; Taux de TVA ; Régime de TVA ; Montant TVA ; Total
    TTC` — **identique, colonne par colonne, au bloc `OrderExportGranularity`
    de l'OpenAPI**.
  - `line` (18 colonnes) : mêmes onze premières colonnes, puis `Position ;
    Désignation ; Quantité ; Montant HT barème (avant remise) ; Taux de
    remise ligne ; PU HT indicatif ; Montant HT` — **identique**.
  - Ligne de données `order` obtenue :
    `CDE-2026-00001;DEV-2026-00001;2026-03-15;Société;Client Test;
    73282932000074;FR40303265045;Jean Dupont;jean.dupont@example.test;
    Validée;PAO;1090,00;0,00;;1090,00;0,2000;France métropolitaine;
    218,00;1308,00` — confirme la traduction de `order_status` (« Validée »,
    plus jamais `validated`), la présence de l'adresse courriel, la virgule
    décimale et l'absence de conversion numérique.
  - `pnpm test:storefront:sql` (suite complète) échoue toujours dès son
    premier fichier (`storefront-session-lifecycle.sql`) sur le même défaut
    d'environnement préexistant, sans rapport avec ce lot — signalé, non
    traité, le cas de ce lot étant vérifié individuellement ci-dessus.

### Round 3 (après correction qa-review round 2, 2026-09-13)

- `pnpm gen:api:check` → vert (aucun diff `openapi/`).
- `pnpm typecheck` → vert.
- `pnpm test:architecture` → vert, inchangé (146 cas, 34 fichiers).
- `pnpm test:contract` → vert, inchangé (432 cas, 23 fichiers).
- `pnpm exec vitest run tests/modules/order-exports` → vert, inchangé
  (29 cas — cette correction touche la purge, non couverte par des tests
  unitaires TypeScript, convention déjà en place pour
  `SupabaseOrderFilePurgeExecutionRepository`).
- `pnpm test` (suite complète) → 2355 passés, mêmes 3 échecs préexistants
  sans rapport, 36 ignorés.
- `deno check` réel sur les deux Edge Functions (dont
  `magrit-order-file-purge/index.ts`, modifiée pour cette correction) →
  vert sur les deux.
- **`supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`,
  exécutée individuellement** via `pnpm db:local:reset` (reconstruction
  complète) → appliquée sans erreur.
- **`tests/sql/gescom-e10-18c-order-exports.sql`, exécuté réellement** :
  **7 scénarios, tous verts**. Scénario 7 entièrement réécrit pour
  **prouver la reprise**, propriété que la version round 1 prouvait à tort
  comme absente : 7a (réclamation initiale, marquage, `storage_path`
  rendu), **7b (le cœur de la correction) — un export `expired` dont
  `storage_path` reste non nul, simulant un échec de retrait Storage non
  confirmé, est RE-RÉCLAMÉ au tour suivant**, 7c (`api_confirm_order_
  export_files_purged` efface `storage_path`, statut inchangé), 7d (un
  export confirmé n'est plus jamais réclamé — preuve miroir de 7b, ferme la
  boucle), 7e (confirmer un id inconnu est un no-op silencieux, jamais une
  erreur).

### Round 4 (après correction qa-review round 3, 2026-09-13 — retrait partiel de la purge)

- `pnpm gen:api:check` → vert (aucun diff `openapi/`).
- `pnpm typecheck` → vert.
- `pnpm test:architecture` → vert, inchangé (146 cas, 34 fichiers).
- `pnpm test:contract` → vert, inchangé (432 cas, 23 fichiers).
- `pnpm exec vitest run tests/modules/order-exports` → vert, inchangé
  (29 cas).
- `pnpm exec vitest run tests/server/api/order-export-purge-composition.test.ts`
  (NOUVEAU, second manquement round 3 fermé) → vert, **8 cas** : rapport
  vide sans effet de bord, `remove()` en erreur ⇒ aucune confirmation,
  confirmation en erreur ⇒ `objectsRemoved=0`, **retrait partiel ⇒ seul
  l'id dont le chemin figure dans `data` est confirmé** (cœur de la
  correction), succès ⇒ `objectsRemoved` dérivé du retour RPC (pas de
  `data.length`), balayage d'objets orphelins (confirmation ciblée sur la
  catégorie `matched_export_id`), échec de retrait d'orphelins ⇒ compte à
  0, réglages par défaut transmis aux deux RPC.
- `pnpm test` (suite complète) → **2363 passés** (2355 + 8 nouveaux), mêmes
  3 échecs préexistants sans rapport, 36 ignorés.
- `deno check` réel sur les deux Edge Functions (dont
  `magrit-order-file-purge/index.ts`, modifiée) → vert sur les deux.
- **`supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`,
  exécutée individuellement** via `pnpm db:local:reset` → appliquée sans
  erreur.
- **`tests/sql/gescom-e10-18c-order-exports.sql`, exécuté réellement** :
  **9 scénarios, tous verts** — 7 inchangé, **8 nouveau** (plafond
  `purge_attempts` à 3, la ligne cesse d'être réclamée au-delà, état
  visible), **9 nouveau** (balayage d'objets orphelins : catégorie (a)
  objet jamais référencé au-delà de 24h, catégorie (b) `purge_attempts`
  épuisé sans délai avec `matched_export_id` correct, ligne vivante et
  objet d'un autre bucket jamais candidats, privilèges refusés).
- **Vérification par mutation, DEUX résultats rapportés** (méthode qui a
  attrapé le bloquant round 3, appliquée ici aux deux nouvelles propriétés) :
  1. `SupabaseOrderExportPurgeRepository.purgeExpiredFiles` régressée pour
     confirmer tous les ids réclamés dès que `error === null` (défaut exact
     du round 2) → test « RETRAIT PARTIEL » **échoue**
     (`['exp-a']` attendu, `['exp-a', 'exp-b']` reçu), les 7 autres cas
     passent. Code restauré (`diff` confirmé identique à l'original), les
     8 cas repassent au vert.
  2. `api_claim_order_exports_for_purge` régressée pour retirer le plafond
     (`and e.purge_attempts < 3` → `and true`) → scénario 8 du cas SQL
     **échoue** (`un export dont purge_attempts=3 a ete reclame une
     quatrieme fois`). Migration restaurée (`diff` confirmé identique),
     `pnpm db:local:reset` + cas SQL repassent au vert (9 scénarios).

## Fichiers créés

Round 1 :
- `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`
- `supabase/functions/magrit-order-export-runner/{index.ts,deno.json}`
- `src/server/api/order-export-composition.ts`
- `src/server/api/order-exports-routes.ts`
- `src/modules/order-exports/api/contracts.ts`
- `src/modules/order-exports/application/order-exports-repository.ts`
- `src/modules/order-exports/application/order-exports-service.ts`
- `src/modules/order-exports/application/order-export-columns.ts`
- `src/modules/order-exports/application/order-export-renderer.ts`
- `src/modules/order-exports/application/order-export-run-repository.ts`
- `src/modules/order-exports/application/order-export-storage.ts`
- `src/modules/order-exports/application/order-export-generation-service.ts`
- `src/modules/order-exports/application/renderers/csv-renderer.ts`
- `src/adapters/supabase/order-exports-repository.ts`
- `src/adapters/supabase/order-exports-storage.ts`
- `src/modules/_shared/application/calendar-bounds.ts`
- `tests/contract/order-exports.contract.test.ts`
- `tests/contract/_fakes/order-exports-repository.fake.ts`
- `tests/modules/order-exports/csv-renderer.test.ts`
- `tests/modules/order-exports/order-export-generation-service.test.ts`
- `tests/sql/gescom-e10-18c-order-exports.sql`

Round 2 (correction qa-review round 1, 2026-09-13) :
- `src/modules/order-exports/application/order-export-purge-repository.ts`
  — port de la purge de retention des fichiers (point 3(e) du contrat,
  corrigé).
- `src/server/api/order-export-purge-composition.ts` — composition de la
  nouvelle application de purge, consommée par l'Edge Function
  `magrit-order-file-purge` (étendue, pas créée).

Round 4 (correction qa-review round 3, 2026-09-13 — retrait partiel de la purge) :
- `src/modules/order-exports/application/order-export-purge-service.ts` —
  `OrderExportPurgeService`, orchestrateur à deux étages (réclamation
  normale PUIS balayage d'objets orphelins), testable sans Supabase.
- `tests/server/api/order-export-purge-composition.test.ts` — 8 cas,
  second manquement round 3 fermé (aucun test ne tenait la correction
  round 2 avant ce fichier).

## Fichiers modifiés

Round 1 :
- `src/kernel/clock/timezone.ts` / `index.ts` — ajout de
  `formatCivilDateInReferenceTimeZone` (sens inverse de
  `startOfDayInReferenceTimeZone`/`endOfDayInReferenceTimeZone`, nécessaire
  à la colonne « Date de commande » du fichier).
- `src/server/api/commercial-orders-routes.ts` — extraction de
  `resolveCalendarBoundOrThrow` vers `_shared/application/calendar-bounds.ts`
  (comportement inchangé, pour que `requestCommercialOrderExport` en hérite
  sans dupliquer la logique).
- `src/modules/_shared/application/index.ts` — export de
  `resolveCalendarBoundOrThrow`.
- `src/server/api/gescom-routes.ts` — enregistrement du module.
- `supabase/functions/magrit-api/index.ts` — câblage de
  `OrderExportsService`.
- `supabase/config.toml` — `verify_jwt = false` pour
  `magrit-order-export-runner`.
- `scripts/test-storefront-sql.sh` — ajout du nouveau cas SQL.

Round 2 (correction qa-review round 1, 2026-09-13) :
- `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql` —
  voir la section « qa-review round 1 » ci-dessus pour le détail complet :
  section « 1bis » ajoutée (migration additive `customer_contact_email`,
  en dernière position des deux `select`, motif Postgres `SQLSTATE 42P16`
  documenté) ; `api_read_order_export_rows` propage cette colonne dans les
  deux branches ; `purge_expired_order_exports()` retirée, remplacée par
  `api_claim_order_exports_for_purge()` (marque ET rend `storage_path`) ;
  section 8 réécrite (motif corrigé, `storage.allow_delete_query`
  documenté) ; RLS commentée sur la clause de tenant redondante (tracée,
  non retirée) ; bloc de réversibilité mis à jour ; les commentaires de
  table/colonne qui affirmaient la destruction de l'objet par l'ancienne
  fonction sont corrigés.
- `src/modules/order-exports/application/order-export-columns.ts` —
  réécrit : ajout de la colonne « Courriel interlocuteur » (rang 9),
  traduction d'`order_status` (nouvelle table `ORDER_STATUS_LABELS`),
  passage des trois tables de traduction en `satisfies Record<Enum,
  string>` (exhaustivité compilateur) avec échec bruyant via
  `translateEnum()` (plus de repli `?? raw`), renommage « Libellé produit »
  → « Désignation ».
- `src/adapters/supabase/order-exports-repository.ts` — ajout de la classe
  `SupabaseOrderExportPurgeRepository` (troisième classe du fichier).
- `supabase/functions/magrit-order-file-purge/index.ts` — étendue pour
  appeler `createOrderExportPurgeApplication()` en plus de
  `createOrderFilePurgeSweepApplication()`, chacune dans son propre
  `try/catch`, réponse HTTP agrégeant les deux rapports.
- `tests/modules/order-exports/csv-renderer.test.ts` — fixtures enrichies
  de `customer_contact_email`, en-têtes attendus mis à jour (onze colonnes
  partagées, « Désignation »), tests ajoutés (traduction `order_status`,
  non-traduction de l'étape de production, échec bruyant sur enum
  inconnue).
- `tests/sql/gescom-e10-18c-order-exports.sql` — scénario 5 enrichi
  (5b-bis, présence de `customer_contact_email`), scénario 7 réécrit
  (réclamation SQL de la purge, non plus transition seule), en-tête du
  fichier mis à jour.
- `_bmad-output/implementation-artifacts/story-E10.18c.md` — ce document
  (section « qa-review round 1 », critères d'acceptation, tests, listes de
  fichiers).

Round 3 (correction qa-review round 2, 2026-09-13 — BLOQUANT sur la reprise
de la purge) :
- `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql` —
  `api_claim_order_exports_for_purge` élargie à `status in ('ready',
  'expired')` (au lieu de `'ready'` seul), ne met plus jamais `storage_path`
  à `null` ; nouvelle fonction `public.api_confirm_order_export_files_purged
  (p_export_ids uuid[])`, seule habilitée à effacer `storage_path`, après
  retrait confirmé ; commentaires de section 8, de table et de colonne
  `expires_at` corrigés (la reprise n'était pas réelle) ; bloc de
  réversibilité mis à jour (drop de la nouvelle fonction).
- `src/modules/order-exports/application/order-export-purge-repository.ts`
  — réécrit : commentaire corrigé (la reprise n'était pas réelle, erreur
  factuelle sur « le même bucket » corrigée — deux buckets distincts),
  `OrderExportPurgeSummary.objectsRemoved` redocumenté comme dérivé de la
  confirmation, pas de `remove()`.
- `src/adapters/supabase/order-exports-repository.ts` —
  `SupabaseOrderExportPurgeRepository.purgeExpiredFiles` réécrite : appelle
  `api_confirm_order_export_files_purged` uniquement après un `remove()`
  sans erreur ; sur `removeError` ou sur un échec de confirmation, ne touche
  plus `storage_path` (reprise réelle au tour suivant) ; `objectsRemoved`
  dérivé du nombre de lignes confirmées, plus de `removed?.length`.
- `supabase/functions/magrit-order-file-purge/index.ts` —
  `createOrderExportPurgeApplication(...)` déplacée dans son `try` ;
  `console.warn` ajouté quand `objectsRemoved < filesMarkedExpired`.
- `src/modules/order-exports/application/order-export-columns.ts` —
  `translateEnum` : `labels[raw] === undefined` remplacé par
  `!Object.hasOwn(labels, raw)`.
- `tests/sql/gescom-e10-18c-order-exports.sql` — scénario 7 entièrement
  réécrit pour prouver la reprise (7a-7e, voir « Tests exécutés », round 3),
  en-tête du fichier mis à jour.
- `_bmad-output/implementation-artifacts/story-E10.18c.md` — ce document
  (section « qa-review round 2 », titre du point 2 corrigé, critères
  d'acceptation, tests, listes de fichiers).

Round 4 (correction qa-review round 3, 2026-09-13 — retrait partiel de la
purge, deux mécanismes (a)/(c) arbitrés) :
- `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql` —
  colonne `purge_attempts` ajoutée (plafond 3) ; `api_claim_order_exports_for_purge`
  plafonnée et incrémentant `purge_attempts` ; `api_confirm_order_export_files_purged`
  redocumentée (appel CIBLÉ, jamais en bloc) ; nouvelle fonction
  `api_claim_orphan_order_export_objects(p_older_than, p_limit)` (section 9,
  deux catégories, `matched_export_id`) ; grants et bloc de réversibilité
  mis à jour ; commentaires de section 8, de table et des colonnes réécrits
  (le fait établi sur `data`, l'arbitrage à deux mécanismes).
- `src/modules/order-exports/application/order-export-purge-repository.ts`
  — réécrit : historique complet des deux corrections, nouveau port
  `OrderExportOrphanRepository`, `OrderExportPurgeSummary.objectsRemoved`
  redocumenté comme approximation (jamais une preuve).
- `src/adapters/supabase/order-exports-repository.ts` —
  `SupabaseOrderExportPurgeRepository.purgeExpiredFiles` réécrite :
  confirmation CIBLÉE sur les ids dont le chemin figure dans `data` (jamais
  tous les ids réclamés en bloc) ; nouvelle fonction utilitaire
  `removedPathsFrom()` ; nouvelle classe `SupabaseOrderExportOrphanRepository`.
- `src/server/api/order-export-purge-composition.ts` — recâblé sur
  `OrderExportPurgeService` (deux repositories, `settings` remplace `limit`).
- `supabase/functions/magrit-order-file-purge/index.ts` — type du rapport
  étendu (`orphanObjectsRemoved`), `console.warn` reformulé (approximation)
  et enrichi.
- `tests/sql/gescom-e10-18c-order-exports.sql` — scénarios 8 (plafond
  `purge_attempts`) et 9 (balayage d'objets orphelins) ajoutés, en-tête du
  fichier mis à jour.
- `_bmad-output/implementation-artifacts/story-E10.18c.md` — ce document
  (section « qa-review round 3 », titre du document, titre et bandeau du
  point 2 signalé au premier passage, critères d'acceptation, tests, listes
  de fichiers).
