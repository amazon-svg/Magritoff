---
id: E10.17a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.12, E10.16]
blocks: [E10.17b]
---
# E10.17a — Fichiers d'une commande : contrat servi (base + API)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.17a — Base et API du dépôt de fichiers par commande](https://app.notion.com/p/3d6d0131973c8173b186ee43f41e3c53) · extrait le 17/09/2026 · page modifiée le 09/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | M | Terminé | Claude code | Pro+ | WM 01/09/2026 | — |

### Description fonctionnelle (Notion)

**En tant que** module d'atelier (fiche commande), **je veux** une API de dépôt, confirmation, listage, bascule de visibilité et suppression de fichiers rattachés à une commande, **afin de** servir la couche métier avant son intégration dans un écran (E10.17b).

##### Statut

Terminé — qa-review round 2, Approuvé. Première moitié d'une décomposition en deux : E10.17a (ici, base + API, **aucun effet observable par un utilisateur**, attendu par le contrat) puis E10.17b (panneau UI sur la fiche commande, à suivre).

##### Contexte produit

Prochain maillon du sprint après la clôture complète d'E10.10b-4a/4b/4c, débloqué par E10.16 (fiche commande). L'architecte a repris le patron déjà éprouvé d'E10.10b-4a : billet d'upload signé, chemin de stockage recalculé SERVEUR (jamais lu d'une colonne), RLS sans capability dédiée.

**Trois arbitrages produit d'Arnaud (2026-09-09), tous appliqués** :

1. **Périmètre confirmé « fichiers légers uniquement »** — plafond 50 Mo, sert les échanges courants (BAT, justificatifs, visuel de référence). Le vrai fichier de production haute résolution est HORS périmètre, renvoyé à une story future E10.20 (lien public de dépôt, pas encore cadrée) — à ne pas rouvrir plus tard comme une ambiguïté.
2. **ZIP autorisé** (`application/zip` ET `application/x-zip-compressed`, les deux car le MIME posé par le navigateur dépend de l'OS du déposant) malgré son opacité — impossible de valider le contenu côté serveur, risque connu et accepté (contenu arbitraire mitigé par le téléchargement toujours forcé ; bombe de décompression IMPOSSIBLE côté serveur car la confirmation ne lit que `info(path)`, ne télécharge et ne décompresse jamais). `application/octet-stream` reste refusé.
3. **Suppression ouverte à tout membre du tenant** — aucune capability dédiée, cohérent avec `convertQuote`/`changeOrderProductionStep` déjà dans le contrat.

##### Critères d'acceptation (contrat §8.19, tous tenus)

1. **Migration + RLS testée réellement** — table `commercial_order_files`, bucket privé (50 Mo, 7 types MIME dont les deux ZIP), isolation inter-tenant prouvée par exécution (tenant B → 0 ligne visible), écriture PostgREST **entièrement fermée** (plus strict qu'E10.10b-4a : même un admin ne peut pas écrire directement en table, seule voie = les 3 fonctions `security definer`), clé étrangère composite `(order_id, order_line_id)` rendant une ligne d'une autre commande structurellement impossible.
2. **Module `api/` + `application/`**, même patron que `document-templates`/`quote-documents`. Pas de `manifest.ts`/`ui/` (aucune capability, aucun écran dans ce lot).
3. **Les six opérations telles que contractées** — `issueOrderFileUploadUrl`, `listOrderFiles`, `confirmOrderFileUpload`, `getOrderFile`, `updateOrderFile`, `deleteOrderFile`. Chemin de stockage `<tenant_id>/<order_id>/<file_id>` TOUJOURS recalculé, jamais lu d'une colonne.
4. **Aucun composant React n'appelle Supabase directement** — sans objet direct (pas d'UI dans ce lot), le client API (`uploadOrderFile()`) est déjà en `fetch` nu, prêt pour 17b.
5. **Suppression = octets détruits, ligne conservée**, ordre précis (ligne PUIS objet de stockage), échec journalisé jamais rendu à l'appelant. Pas de `sha256` (juste `info()` du stockage — imposer un hash ferait transiter jusqu'à 50 Mo à travers la façade, interdit par R5).
6. **Correspondance extension→MIME FERMÉE** côté client : ne se fie jamais à `File.type` du navigateur (non fiable, dépend de l'OS) — `resolveOrderFileContentType()` pose le `Content-Type` du `PUT` depuis l'extension, refuse tout type inconnu (aucun repli permissif).
7. **Visibilité `customer` persistée mais INERTE** — aucune surface storefront ne l'exploite dans ce lot (aucune référence sous `storefront-quotes`/`src/app`/`src/surfaces`), confirmé par grep.

##### Dev Agent Record

###### Agent Model Used

Architecte (cadrage §8.19 + 3 arbitrages Arnaud, Claude Opus) → `dev-story` (implémentation, Claude Sonnet) → `qa-review` (Claude Opus, 2 rounds).

###### Completion Notes

**qa-review round 1 — Changes Requested, 1 réserve BLOQUANTE + 6 non bloquantes** :

- **B1 — trace d'audit forgeable.** Un paramètre `p_actor_label` fourni par l'appelant ÉCRASAIT le libellé de l'auteur authentifié au lieu d'être un simple repli — alors que le contrat promettait explicitement une trace fiable (« le libellé figé survit à la suppression du compte, c'est sa raison d'être »). Prouvé par exploitation réelle : un membre ordinaire du tenant, appel direct à la RPC, pouvait faire apparaître n'importe quel nom comme auteur du dépôt ou de la suppression. Circonstance aggravante : dans ce lot, l'acteur est TOUJOURS authentifié, ce paramètre n'avait donc AUCUN usage légitime — pur vecteur de forgerie. **Corrigé en retirant entièrement le paramètre** des deux fonctions (`api_confirm_order_file_upload` 9→8 arguments, `api_delete_order_file` 4→3 arguments), de leurs corps, commentaires, grants, et des deux appels RPC de l'adaptateur.
- **N1-N6, toutes traitées** : un scénario SQL qui ne prouvait pas la contrainte qu'il prétendait tester (corrigé, n'accepte plus que `foreign_key_violation`) ; un autre qui n'assertionnait jamais son résultat (corrigé) ; deux points de recalcul du chemin de stockage (`findById`/`toDetailDto`, `remove()`) sans test dédié alors que ce sont exactement les endroits où la faille B1 originale (E10.10b-4a) était réapparue lors d'un refactor (deux tests ajoutés) ; une colonne sélectionnée sans être consommée (retirée) ; une affirmation inexacte du rapport sur l'étendue des tests rejoués (corrigée) ; un appel réseau de stockage inutile pour calculer un ETag (éliminé via une nouvelle méthode `getRawById()`).

**Incident de session** : une coupure réseau transitoire a interrompu le premier tour de correction. Repris proprement — l'agent a vérifié l'état réel du travail déjà fait (le retrait de `p_actor_label` était déjà en place) avant de continuer, plutôt que de supposer ou de tout refaire.

**Correctif transverse découvert et corrigé** : le socle `gescom-middleware.ts` ne savait rendre AUCUN 204 réel avant `deleteOrderFile` (premier `operationId` de la façade à en avoir besoin) — `new Response(body, {status:204})` lève une exception si un corps est fourni, la spec Fetch l'interdit. Corrigé dans le socle transverse (pas contourné localement), changement additif, aucun autre endpoint affecté (vérifié par les 329 tests de contrat, aucune régression sur les lots antérieurs 4a/4b/4c).

**qa-review round 2 — Approved.** Chaque correction vérifiée PAR MUTATION (désactiver délibérément la protection en base ou dans le code pour prouver que le test dedié échoue bien sans elle), pas par simple relecture — méthode plus rigoureuse que les rounds précédents du sprint. La faille B1 re-testée par exploitation réelle : l'appel forgé échoue désormais en `undefined_function` (signature à 8 paramètres, pas 9), le libellé enregistré reste toujours l'email authentifié. Aucune régression.

###### Vérifications

- `pnpm typecheck` : 0 erreur
- `deno check supabase/functions/magrit-api/index.ts` : 0 erreur
- `pnpm gen:api:check` : ✅ aligné (aucune touche à openapi/magrit-core.v1.yaml)
- `pnpm test:architecture` : 146/146 (34 fichiers)
- `pnpm test:contract` : 329/329 (18 fichiers, dont 20 nouveaux pour order-files)
- `pnpm test` (suite complète) : 1938 passés / 36 skip, 3 échecs pré-existants sans rapport (projet Supabase distant, cause déjà établie par E10.10b-4a)
- `tests/sql/gescom-e10-17a-order-files.sql` : exécuté réellement à plusieurs reprises (dont après `pnpm db:local:reset` complet, nécessaire suite au changement de signature des fonctions), 0 erreur à chaque fois, isolé et enchainé avec les cas SQL compatibles des lots précédents

###### File List

- Migration : `supabase/migrations/20260909060000_gescom_e10_17a_order_files.sql`
- Module : `src/modules/order-files/api/contracts.ts`, `api/content-type-map.ts`, `api/client.ts`, `application/order-files-repository.ts`, `application/order-files-service.ts`, `index.ts`
- Adaptateur : `src/adapters/supabase/order-files-repository.ts`
- Routes : `src/server/api/order-files-routes.ts`, enregistrement dans `gescom-routes.ts`
- Correctif transverse : `src/server/api/gescom-middleware.ts` (204 réel), `tests/contract/_harness.ts`
- Câblage : `supabase/functions/magrit-api/index.ts`
- Tests : `tests/contract/order-files.contract.test.ts`, `tests/contract/_fakes/order-files-repository.fake.ts`, `tests/adapters/supabase/order-files-repository.test.ts`, `tests/modules/order-files/content-type-map.test.ts`, `tests/sql/gescom-e10-17a-order-files.sql`

##### QA Results

**Verdict : Approuvé** — round 2. Une réserve bloquante (B1, trace d'audit forgeable) trouvée par exploitation empirique round 1, corrigée en retirant entièrement le vecteur (pas seulement neutralisée). Six réserves non bloquantes traitées. Round 2 : chaque correction validée par mutation (désactivation délibérée de la protection pour prouver que le test échoue sans elle) — pas seulement relue. Non-régression de la faille de traversee de tenant (modèle B1 d'E10.10b-4a) confirmée sur cinq vecteurs d'exploitation distincts. Aucune réserve bloquante restante.

**Dettes tracées, non bloquantes, toutes héritées du patron déjà accepté sur E10.12/E10.14/E10.10b-4a (à traiter au niveau du sprint, pas de cette story)** :

- Les fonctions serveur restent appelables directement par un membre du tenant via PostgREST, sans revalidation des métadonnées du fichier (nom, type, taille) contre le fichier réel — portée limitée au tenant de l'appelant.
- Le billet d'upload reste valide \~2h après confirmation, permettant en théorie un remplacement tardif (borné par le type de fichier accepté et le téléchargement toujours forcé).
- Mécanisme de clé de service inerte pour toute la façade E10, pas seulement ce lot.
- Comportement réel du navigateur sur les fichiers `.zip` non mesuré (aucun navigateur disponible dans l'environnement du dev) — à vérifier par E10.17b sur au moins deux systèmes d'exploitation.
- Aucun cahier de test Notion (TF-XX) pour cette story (attendu, sera créé avec l'UI de 17b).

##### Change Log

- 2026-09-09 — Cadrage architecte §8.19 + 3 arbitrages Arnaud (périmètre 50 Mo, ZIP autorisé, suppression tout membre).
- 2026-09-09 — Livraison initiale, qa-review round 1, Changes Requested (B1 + N1-N6).
- 2026-09-09 — Coupure réseau transitoire pendant la correction, reprise vérifiée sur l'état réel du travail.
- 2026-09-09 — Corrections complètes, qa-review round 2 (vérification par mutation), Approuvé.
- 2026-09-09 — Fiche créée dans Notion à partir du story document livré et du verdict qa-review final.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-208](https://app.notion.com/3d7d0131973c8155a8bac9c54e5b04d8) | TF-001 — Emission de billet, depot et confirmation d'un fichier de commande (chemin nominal) | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.17a |
| [TF-209](https://app.notion.com/3d7d0131973c818388f2d9906e8d5e6a) | TF-002 — Confirmation refusee : type hors liste ou poids superieur a 50 Mo | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B5 | E10.17a |
| [TF-210](https://app.notion.com/3d7d0131973c81d0a8a9c0c9a5d89393) | TF-003 — Isolation RLS en lecture entre tenants | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.17a |
| [TF-211](https://app.notion.com/3d7d0131973c81f0af44d442a24074f5) | TF-004 — Ecriture PostgREST directe totalement fermee, meme pour un admin | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.17a |
| [TF-212](https://app.notion.com/3d7d0131973c81d3ace0ccb139963896) | TF-005 — Le libelle d'auteur reste celui du jeton authentifie, jamais usurpe | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B5 | E10.17a |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
