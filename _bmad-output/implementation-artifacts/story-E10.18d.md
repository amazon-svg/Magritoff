---
id: E10.18d
epic: E10 — Gestion commerciale
status: corrected-qa-review-round-4
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.18a, E10.18b, E10.18c]
blocks: [E10.18e, E10.18f]
---
# E10.18d — Export comptable des commandes : le renderer XLSX, derrière le même port que le CSV (E10.18c)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.18 — Export XLSX et CSV des commandes pour la comptabilité](https://app.notion.com/p/3cad0131973c812e9a64c38bb31b5add) · extrait le 17/09/2026 · page modifiée le 15/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.
> Ce story document est un **lot** de la story Notion **E10.18** : le périmètre ci-dessous est celui de la story entière ; la part propre à ce lot est décrite dans la partie implémentation.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | M | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 21 |

### Description fonctionnelle (Notion)

**En tant que** gestionnaire, **je veux** exporter les commandes et leur détail au format Excel ou CSV, **afin de** transmettre les données à un service comptable qui ne se connecte pas par API.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : le format Excel (XLSX) est le standard retenu, avec une variante CSV. Constat de Xavier Péchoultres : les services comptables sont fermés aux connexions directes par API et s'appuient sur des fichiers XLSX ou CSV pour éviter la ressaisie. L'export est donc un livrable de première classe, pas un pis-aller.

##### Critères d'acceptation

1. Un bouton « Exporter » est disponible sur la grille des commandes et respecte les filtres actifs.
2. Deux formats sont proposés : XLSX et CSV (séparateur point-virgule, encodage UTF-8 avec BOM).
3. Deux granularités sont proposées : une ligne par commande (entêtes) ou une ligne par ligne de commande (détail).
4. Les colonnes couvrent au minimum : numéro de commande, date, client, SIRET, numéro de TVA, interlocuteur, libellé produit, quantité, prix unitaire HT, montant HT, remise, statut courant, devis d'origine.
5. Les montants sont exportés en numérique typé, pas en texte ; les dates au format ISO.
6. Le fichier XLSX comporte une ligne d'en-tête figée et des largeurs de colonnes lisibles — il est destiné à être ouvert tel quel.
7. Un export de plus de 5 000 lignes est généré en tâche de fond et mis à disposition par lien de téléchargement.
8. L'export respecte le périmètre du tenant et les droits de l'utilisateur.

##### Tâches / Sous-tâches

- [ ] Service `src/services/exports/orders.ts` — construction du jeu de données (CA : 1, 3, 4, 8)
- [ ] Générateur XLSX (CA : 2, 5, 6)
- [ ] Générateur CSV avec BOM et point-virgule (CA : 2)
- [ ] Modale de choix format et granularité (CA : 2, 3)
- [ ] Bascule en génération asynchrone au-delà du seuil (CA : 7)

##### Dev Notes

###### Contraintes techniques

- CSV à destination d'Excel francophone : séparateur `;` et BOM UTF-8, faute de quoi les accents et les colonnes se cassent à l'ouverture — c'est exactement le problème que l'export doit éviter.
- Ne pas formater les montants en chaîne côté serveur : un nombre exporté en texte oblige la comptabilité à reformater, donc à ressaisir.
- La construction du jeu de données passe par une vue SQL dédiée, pas par une agrégation côté client.

###### data-testid

`orders-export-btn`, `orders-export-dialog`, `orders-export-format-radio` (+ `data-format="xlsx"|"csv"`), `orders-export-granularity-radio` (+ `data-granularity="order"|"line"`), `orders-export-submit-btn`, `orders-export-download-link`

###### Dépendances

- Bloquée par : E10.12, E10.16

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0**.

| Méthode | Route | Objet |
|---|---|---|
| POST | `/api/v1/orders/exports` | Demande un export : \`{ format: "xlsx" ⚠️ *cellule arrivée tronquée à l’extraction — lire la page Notion* |
| GET | `/api/v1/orders/exports/{jobId}` | État de la tâche et URL de téléchargement quand elle est prête |

Les filtres acceptés sont **exactement** ceux de `GET /api/v1/orders` : un export doit toujours pouvoir être reproduit à partir d'une vue de la grille. Le jeu de données est construit par une vue SQL dédiée, jamais par une agrégation côté client.

##### Tests

Parcours P13 — export XLSX au détail ligne sur une sélection filtrée, contrôle des colonnes et du typage numérique des montants.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Sonnet (dev-story : E10.18d, E10.18e-2) + Opus (qa-review : rounds multiples)

###### Debug Log References

(aucune fournie par le dev-story)

###### Completion Notes

**Lot E10.18a-b-c-d-e-1** : voir commits antérieurs.

**Lot E10.18e-2** (2026-09-15) — Interface utilisateur d'export (modale format/granularité, panneau de registre, suivi périodique, téléchargement à l'écart du navigateur). qa-review round 3 (2026-09-15) : APPROUVÉ sous réserve recette navigateur. Deux rounds de corrections : (1) doublon métier si fermeture pendant envoi, clé d'idempotence sur formatChanged/granularityChanged hors échec, modale générique, téléchargement par ancre détachée ; (2) arrêt définitif du suivi sur 401/403/404 et borne 10 min, URL signée avec `{ download: file_name }`. Recette navigateur jouée le 2026-09-15 sur recette-e10 : second passage CONFORME — parité filtres, double-clic = 1 POST, clé renouvelée, suivi 2 s avant terminal, reprise après coupure, `Content-Disposition: attachment`, téléchargement 14 lignes, messages français, registre 50 + mention. magrit-api v38 déployée le 2026-09-15.

**Lot E10.18d** (2026-09-13) — Renderer XLSX + recadrage du plafond. `write-excel-file` 4.1.1 entrée `/node`, `fflate` 0.8.3, tous deux épinglés exactement dans `package.json` et import-map Deno. Format par FAMILLE de cellule : `money` → `0.00`, `rate` → `0.0000` (quatre colonnes sans exception), `integer` → `0`. Dates natives en `Date.UTC` après résolution civile `Europe/Paris`. Cellule nulle → vide, jamais `0`. En-tête figée, largeurs de colonnes par colonne. Nombres natifs sans conversion chaîne côté serveur. **qa-review adversariale en cinq rounds** : (1) test Worker cassé ne simulait rien, cellules nulles non testées, (2) témoin négatif acceptait n'importe quelle erreur, (3-4) correctifs de commentaires et vocabulaire, (5) détection d'import `fflate` via regex restait sensible aux commentaires en bloc. **Passage 3 : recadrage architecte** — CPU tue l'export (pas mémoire) → plafond 50k → 5k lignes, une seule exécution de filet de reprise (migration `20260913010000` : export `running` depuis \>15 min → `failed`), formateur `Intl` mis en cache (1757 ms → 70 ms pour 50k lignes). Tous les critères d'acceptation vérifiés par mutation testing (44 cas nouveaux, 312 cas totaux order-exports). **Migration `20260913010000` appliquée, `magrit-order-export-runner` et `magrit-api` redéployés le 2026-09-13.** Runner reste INERTE (aucun secret Vault, aucun `pg_cron`).

###### File List

**Fichiers créés :**

- `src/modules/order-exports/application/renderers/xlsx-renderer.ts`
- `tests/modules/order-exports/xlsx-renderer.test.ts`
- `tests/modules/order-exports/xlsx-renderer.reference.test.ts`
- `tests/modules/order-exports/xlsx-renderer.volume.test.ts`
- `tests/server/api/order-export-run-composition.test.ts`
- `supabase/migrations/20260913010000_gescom_e10_18d_order_export_recovery_net.sql`
- `tests/sql/gescom-e10-18d-order-export-recovery-net.sql`
- `scripts/bench/order-export/` (archive complet : `harness/`, `Dockerfile.bench`, `c1/`, `README.md`)

**Fichiers modifiés :**

- `package.json`, `pnpm-lock.yaml` (ajout exact `write-excel-file: "4.1.1"`, `fflate: "0.8.3"`)
- `supabase/functions/magrit-order-export-runner/deno.json` (entries import-map)
- `src/modules/order-exports/application/order-export-columns.ts` (correction en-tête rate/Rate)
- `src/modules/order-exports/application/renderers/xlsx-renderer.ts` (format integer, épinglage fflate)
- `src/modules/order-exports/application/order-export-generation-service.ts` (`ORDER_EXPORT_ROW_LIMIT: 50_000 → 5_000`)
- `src/modules/order-exports/application/order-export-run-repository.ts` (`DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit: 5 → 1`)
- `src/kernel/clock/timezone.ts` (formateur DateTimeFormat mis en cache)
- `tests/kernel/timezone.test.ts` (2 nouveaux tests, formateur utilisé une fois)
- `tests/modules/order-exports/xlsx-renderer.reference.test.ts` (29 cas : +5 nouveaux, cellules nulles, colonne par colonne, fuseau forcé)
- `tests/modules/order-exports/xlsx-renderer.volume.test.ts` (réécriture complète round 1 : Worker cassé réellement, témoin négatif obligatoire)
- `tests/modules/order-exports/order-export-generation-service.test.ts` (assertions valeur + message resserrez)
- `tests/architecture/order-export-xlsx-library-boundaries.test.ts` (détection d'import via AST TypeScript, export/import=require)
- `scripts/test-storefront-sql.sh` (ajout nouveau fichier SQL, 50/51 → 51/51)
- `.github/workflows/architecture.yml` (étape bloquante tests/modules/order-exports après test:contract)
- `deno.lock` (2 lignes : `npm:fflate@0.8.3`, `npm:write-excel-file@4.1.1`)
- `_bmad-output/implementation-artifacts/story-E10.18d.md` (ce story document)

**E10.18e-2 (UI et recette), commits 3b6489e2 + 7466bbd6 + 8b23db6a :**

- `src/modules/commercial-orders/ui/components/order-export.helpers.ts` (réducteurs de modale/registre, descripteurs purs, suivi à horloge simulée)
- `src/modules/commercial-orders/ui/components/OrderExportDialog.tsx` (modale format/granularité)
- `src/modules/commercial-orders/ui/components/OrderExportPanel.tsx` (registre, suivi, téléchargement)
- `tests/modules/commercial-orders/order-export.helpers.test.ts` (+26 cas round 1, +4 cas round 2)
- `src/adapters/supabase/order-exports-repository.ts` (URL signée avec `{ download }`)
- `tests/adapters/supabase/order-exports-repository.test.ts` (nouveau, 2 cas MOYEN M2)

##### QA Results

**Accepté** (5 rounds : 2 bloquants + plusieurs mineurs détectés et corrigés, tous trous fermés par mutation testing). Verdict final qa-review round 3 (passage architecte) : vert. Critique : tests qui n'attrapaient rien ont été identifiés (Worker, cellules nulles, versions divergentes) et complètement réécrits. Migration de filet de reprise validée par exécution SQL réelle en 5 scénarios. Aucun faux positif détecté.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-187](https://app.notion.com/3cad0131973c811081d5ec192b193681) | GC — Export XLSX des commandes au détail ligne pour la comptabilité | OK | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.18, E10.16 |
| [TF-238](https://app.notion.com/3dbd0131973c810ca614fc5d54b0df48) | GC — Grille Commandes atelier : colonnes, filtres, tri, Charger plus et menu | OK | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.18, E10.18a, E10.18e-1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Contrat déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.24,
**onzième correction du bandeau ajoutée en cours de ce lot, 2026-09-13**,
`openapi/magrit-core.v1.yaml`), **non modifié par ce lot**
(`pnpm gen:api:check` vert, aucun diff sous `openapi/` ni
`src/platform/api/generated/`).

Périmètre livré : renderer XLSX (`write-excel-file` 4.1.1, entrée `/node`,
version épinglée), enregistré dans `order-export-composition.ts` aux côtés
du CSV (E10.18c). En-tête figée, largeurs de colonnes, nombres et dates
natifs, formats `0.00`/`0.0000`/`0` par famille de cellule. Aucune
migration, aucun endpoint, aucune UI (lot (e)) : le seul fichier de
production nouveau est `renderers/xlsx-renderer.ts`, plus l'enregistrement
dans la composition et l'import-map Deno.

## qa-review round 1 (2026-09-13) — REJETÉ, CORRIGÉ

La qa-review a rejeté ce lot sur deux points bloquants et quatre mineurs.
Le comportement du renderer sur le fichier réel était conforme ; ce sont
des PREUVES qui manquaient (des tests qui ne mettaient rien en défaut) et
une affirmation fausse dans un commentaire. Traité point par point :

### BLOQUANT B1 — le test de volume ne simulait PAS l'Edge Runtime

**Le défaut.** `xlsx-renderer.volume.test.ts` cassait `globalThis.Worker`.
Sous vitest (Node), le spécificateur nu `fflate` résout — via les
`exports` conditionnels de son `package.json`, condition `"node"` — sur
`esm/index.mjs`, qui ne lit **jamais** `globalThis.Worker` : il fait
`var require = createRequire('/')` puis
`Worker = require('worker_threads').Worker`, **au chargement du module**.
La sonde de la qa-review l'a prouvé par exécution réelle :
`write-excel-file/universal`, 5 000 lignes, `globalThis.Worker` cassé →
VERT quand même, `sheet1.xml` à 410 491 octets — la sonde ne protégeait
rien. Et le premier « témoin négatif » de ce lot (mutation `/node` →
`/universal` avec l'ancienne sonde) ne tombait que parce que `/universal`
n'expose pas `.toBuffer()` — pas parce que le Worker était réellement
indisponible.

**Corrigé.** Le vrai point d'injection sous Node est
`require('node:worker_threads').Worker`. `breakNodeWorkerThreads()` patche
directement l'objet retourné par `require('node:worker_threads')` (le même
singleton que lira `fflate`) puis appelle `module.syncBuiltinESMExports()`.
**Piège trouvé en écrivant la correction, et documenté dans le fichier** :
`fflate` capture `Worker` dans une variable de FERMETURE au chargement du
module — une fois chargé, aucune restauration ni `vi.resetModules()` ne
peut plus l'atteindre (un module npm externalisé, une fois évalué par le
vrai chargeur ESM de Node, reste en cache pour toute la durée du
**processus**). Le fichier n'importe donc plus **statiquement** ni le
renderer, ni `write-excel-file`, ni `fflate` (seul un `import type`,
effacé à la compilation, reste statique) : tout est importé
**dynamiquement**, **après** `beforeAll()` qui casse le Worker. Vitest
isole chaque fichier de test dans son propre processus (vérifié par
exécution réelle, section « Tests exécutés ») : cette poison ne fuit donc
jamais vers les autres tests XLSX.

**Témoin négatif OBLIGATOIRE ajouté** : le même harnais (Worker cassé)
appliqué à `write-excel-file/universal` + `.toBlob()` sur 5 000 lignes
**ÉCHOUE** (`rejects.toThrow()`) — sinon rien ne prouvait que le harnais
attrapait quoi que ce soit. Preuve par mutation dans les deux sens (voir
« Tests exécutés »).

**Commentaires faux corrigés** : `xlsx-renderer.volume.test.ts` (réécrit
en tête de fichier, explique le vrai mécanisme et le piège rencontré) et
`xlsx-renderer.ts` (renvoi corrigé vers `xlsx-renderer.volume.test.ts` —
il pointait à tort vers `xlsx-renderer.reference.test.ts`).

### BLOQUANT B2 — « cellule money/rate nulle = vide, jamais 0 » n'était tenue par AUCUN test

Les mutations « montant nul écrit 0 » et « taux nul écrit 0 » ne faisaient
tomber aucun test — le seul test existant sur une cellule nulle portait
sur une colonne `text` (« Interlocuteur »), jamais sur `money`/`rate`.

**Corrigé.** **Deux nouveaux tests portant QUATRE assertions** dans
`xlsx-renderer.reference.test.ts`, un test par granularité, chacun
couvrant une paire (money, rate) : `order` → « Total lignes HT » (money) +
« Taux de remise effectif » (rate) ; `line` → « Montant HT barème (avant
remise) » (money) + « Taux de remise ligne » (rate). Chaque assertion
vérifie l'**ABSENCE** de la cellule dans le XML (pas juste une valeur
nulle). Vérifié par mutation dans les deux sens (voir « Tests exécutés »)
: les quatre assertions tombent sous les deux mutations (money→0,
rate→0).

### M1 — `Position` et `Quantité` sans format `0`

Le cadrage exige `integer` → format `0` ; la première version du lot
omettait le `format` sur les cellules `integer` (elles héritaient du
format General d'Excel — lisible, mais pas une garantie du produit).

**Corrigé.** `NUMBER_FORMAT_BY_CELL_KIND` étendue à
`Record<'money' | 'rate' | 'integer', string>` (`integer: '0'`), utilisée
dans la branche `case 'integer'` de `dataCell()`. Couvert par le nouveau
test M2 (colonne par colonne), qui vérifie le `numFmt` de `Position` et
`Quantité`. Vérifié par mutation (voir « Tests exécutés »).

### M2 — « Taux de remise effectif » et « Taux de remise ligne » jamais vérifiées

Aucun test antérieur ne touchait le `numFmt` de ces deux colonnes.

**Corrigé.** Un test unique, paramétré sur les deux granularités, compare
**colonne par colonne** l'intitulé, la position, le type de cellule XML
(`t=`) et le `numFmt` à une table dérivée de `OrderExportGranularity`
(l'ordre du contrat — la même source que le test A). Couvre les **19 +
18** colonnes des deux granularités en un seul test lisible, ferme
définitivement le trou (et celui de M1 sur `integer`).

### M3 — `Date.UTC` prouvé seulement sur une machine en CEST

Sous `TZ=UTC` (le réglage typique d'un runner CI), `new Date(a, m, j)`
(constructeur LOCAL, celui de la mutation à détecter) produit EXACTEMENT
le même instant que `Date.UTC(a, m, j)` — la mutation ne faisait alors
tomber aucun test. **Vérifié par exécution réelle** :
`TZ=UTC pnpm exec vitest run tests/modules/order-exports/xlsx-renderer.reference.test.ts`
avec le code MUTÉ (constructeur local) laissait passer les deux tests de
date existants (aucun n'est tombé).

**Corrigé.** Nouveau test qui force `process.env.TZ = 'America/Los_Angeles'`
en `beforeAll` (restauré en `afterAll`), indépendamment du fuseau ambiant
de la machine qui exécute la suite. Preuve complète, dans les deux sens
(voir « Tests exécutés ») : sous `TZ=UTC` côté machine, avec le code
correct, ce test passe ; avec le code muté, il échoue (série fractionnaire
`46266,29166...` au lieu de `46266`).

### M4 — le motif du test d'architecture sur `/universal` avait des trous

Il ratait `'npm:write-excel-file@4.1.1/universal'` (valeur d'import-map),
`await import('write-excel-file/universal')` et
`import 'write-excel-file/universal'` (effet de bord) ; et `git grep` sans
`--untracked` ignorait un fichier créé mais pas encore `git add`-é —
exactement l'état de `xlsx-renderer.ts` pendant une bonne partie de ce lot,
ce qui rendait le test aveugle à une régression dans le fichier même qu'il
est censé garder.

**Corrigé.** Motif unique et large :
`['"](npm:)?write-excel-file(@[^'"/]+)?/universal['"]` — toute chaîne
ENTRE GUILLEMETS DROITS (jamais les accents graves des commentaires de ce
dépôt) qui correspond au spécificateur interdit, quelle que soit la
syntaxe autour. `--untracked` ajouté à l'appel `git grep`. Vérifié par
exécution réelle : une ligne probe `import x from 'write-excel-file/universal';`
ajoutée à `xlsx-renderer.ts` (untracked à ce moment) est bien détectée
avec `--untracked`, invisible sans (voir « Tests exécutés »).

### m1 — marqueur « EN ATTENTE ARBITRAGE / PROVISOIRE » encore présent

`xlsx-renderer.reference.test.ts` portait encore le marqueur alors que le
point est tranché par l'architecte (onzième correction du bandeau,
2026-09-13, voir section dédiée plus bas). Corrigé : le commentaire cite
désormais l'arbitrage tranché.

### m2 — chiffres du story doc faux

Recomptés après correction (voir « Tests exécutés ») : 44 cas nouveaux
répartis sur 5 fichiers, pas 67/9/34 comme annoncé initialement.

### m3 — commentaire « lockfile fflate » présentait pnpm-lock comme une garantie côté Deno

Deno ignore entièrement `pnpm-lock.yaml` (résolution npm propre, via son
propre cache/import-map). Nuancé : le test vérifie la résolution PNPM
(utilisée par `vitest`), pas la résolution Deno — l'épinglage de `fflate`
côté Deno est un chantier distinct, instruit en parallèle par
l'architecte (second passage, non touché ici : ni `ORDER_EXPORT_ROW_LIMIT`
ni l'import-map `fflate` ne sont modifiés par cette correction).

## qa-review round 2 (2026-09-13) — REJETÉ sur UN point, 17 mutations tenues

Round 2 a vérifié en profondeur (17 mutations exécutées) tout ce qui avait
été corrigé au round 1 — **tout tient, sauf un reste du bloquant B1**. Trois
mineurs traités dans le même passage.

### BLOQUANT — reste de B1 : le témoin négatif acceptait N'IMPORTE QUELLE erreur

`xlsx-renderer.volume.test.ts` : le témoin négatif se terminait par
`rejects.toThrow()` **sans argument**. Il échouait aujourd'hui pour la
bonne raison (`ReferenceError: Worker is not defined (...)`), mais
l'assertion ne le VÉRIFIAIT pas — elle acceptait n'importe quelle erreur.
**Double mutation de la qa-review, exécutée** : casse du Worker
NEUTRALISÉE (la ligne qui remplace `workerThreads.Worker` retirée) **ET**
une cellule du témoin rendue invalide (`{ value: 'pas-un-nombre', type:
Number }`) → **aucun test ne tombait**, le harnais était inerte (le
`.toBlob()` échoue bien, mais avec `Invalid cell value: pas-un-nombre.
Expected a number`, pas avec une erreur de Worker) et le témoin restait
vert.

**Corrigé** : `rejects.toThrow(/Worker is not defined/)`. Preuves par
mutation, exécutées dans les deux sens (voir « Tests exécutés »).

### Mineurs traités dans le même passage

1. **Ordre du `throw`/`expect`** (`xlsx-renderer.volume.test.ts`, test
   positif) : le `throw` qui porte le `code`/`detail` de l'échec est
   désormais posé **avant** `expect(result.ok).toBe(true)`, pour que sous
   mutation on lise la VRAIE cause plutôt que le seul « expected false to
   be true ».
2. **Story doc, B2** : reformulé « 2 tests portant 4 assertions » (le
   total de 44 cas restait juste, seule la description du nombre de
   *tests* — par opposition aux *assertions* — était ambiguë).
3. **Vocabulaire du seuil de 160 Ko** : l'architecte a tranché dans
   `docs/api/CONVENTIONS.md` §8.24 (treizième correction, point (i)) —
   « taille **BRUTE** de chaque fichier interne de l'archive », ni
   « compressée » (ce que disaient à tort `xlsx-renderer.ts` et le test
   d'architecture), ni la taille du classeur final (qui est environ NEUF
   FOIS plus petit que `sheet1.xml`). Alignés : en-tête de
   `xlsx-renderer.ts` (lignes 11-19), en-tête du test d'architecture
   (lignes 5-9), en-tête du test de volume (section « Le seuil exact »),
   et le point 3 de la section « Décisions et leur motif » de ce document.
   **Aucun écart trouvé** entre ce cadrage et l'implémentation elle-même
   (le comportement — `size < 160000` sur la taille brute d'un fichier
   interne — était déjà correct ; seuls des commentaires disaient
   « compressée » à tort).

## Passage 3 (2026-09-13) — RECADRAGE ARCHITECTE : le CPU tue, pas la mémoire, plafond corrigé à 5 000

L'architecte a rejoué la mesure du plafond avec un protocole tiers, plus
fidèle que les deux précédents (le mien, escaladé en fin de round 2, et
celui du 12/09) : l'Edge Function **réelle** servie en *user worker*
(`EdgeRuntime.userWorkers.create`) sous **les limites exactes du `main.ts`
de la CLI Supabase** (256 Mo, CPU 1000/2000 ms), verdict lu au
**superviseur** (`Shutdown.reason`, `cpu_time_used`, `memory_used`), pas au
conteneur. Conclusion : **c'est le CPU qui tue l'export, jamais la
mémoire** — mon propre protocole (RSS d'un conteneur `--memory=256m` tout
entier) mesurait autre chose, ce que j'avais moi-même signalé sans
pouvoir trancher. `docs/api/CONVENTIONS.md` §8.24 porte désormais une
douzième entrée (plafond, réserve (g) rouverte) et une treizième
complétée (C1 fflate, C2 vocabulaire, CI, filet de reprise). Détail complet
et cinq constats : voir le contrat, non reproduits ici en entier.

**Ce que ce passage corrige, dans l'ordre des consignes reçues :**

1. **`src/kernel/clock/timezone.ts` — `Intl.DateTimeFormat` mis en
   cache.** `formatCivilDateInReferenceTimeZone` construisait un nouveau
   formateur `en-CA` À CHAQUE APPEL — 1 757 ms pour 50 000 lignes contre
   70 ms avec un formateur réutilisé (mesure architecte, point 4). Sorti
   en constante `CIVIL_DATE_FORMATTER`, en portée de module. **Aucun
   changement de comportement** : `Intl.DateTimeFormat.prototype.format()`
   est pure vis-à-vis de son instance. Les tests existants du kernel et
   d'E10.18a (la grille) restent verts **sans modification** (vérifié :
   `pnpm exec vitest run tests/kernel` inchangé en nombre de cas avant
   d'ajouter les deux nouveaux). Nouveau test dédié : un espion sur le
   CONSTRUCTEUR `Intl.DateTimeFormat` (pas sur le résultat), qui compte
   les appels avec le premier argument `'en-CA'` avant/après 25 appels à
   `formatCivilDateInReferenceTimeZone` — doit rester à 1. Piège rencontré
   et corrigé en écrivant ce test : `vi.spyOn(...)` seul ne fonctionne PAS
   sur un constructeur (`new` sur le mock rend `undefined`, pas une
   instance) — il faut un `mockImplementation` qui délègue explicitement
   au vrai constructeur via une fonction ORDINAIRE (pas une flèche, qui
   n'a pas de `[[Construct]]`).
2. **`ORDER_EXPORT_ROW_LIMIT` : `50_000` → `5_000`.** Toutes les autres
   mentions de `50 000`/`50_000` dans `src/`, `tests/` alignées
   (`order-export-renderer.ts`, `order-export-generation-service.test.ts`)
   — hors migrations déjà déployées, qu'on ne touche jamais. Deux
   assertions de valeur ajoutées (`ORDER_EXPORT_ROW_LIMIT` et
   `DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit`, voir point 3), là où
   aucune n'existait avant (seul le comportement dérivé — combien de pages
   sont acceptées — était testé, jamais le chiffre lui-même).
3. **`DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit` : `5` → `1`.** Mesuré par
   l'architecte : le budget CPU se cumule sur le LOT que `runOnce()` traite
   dans une même invocation, pas par export — un XLSX de 10 000 lignes
   passe seul, cinq dans le même tour sont tués (même constat pour un CSV
   de 50 000). Le plafond de 5 000 lignes n'est donc valable QUE si le lot
   réclamé vaut 1.
4. **Filet de reprise — nouvelle migration `20260913010000`.** Défaut
   réel : un export tué par le superviseur reste `running` pour toujours
   (`api_claim_order_exports` d'origine ne réclame que `pending`), et
   compte dans le plafond de trois demandes non terminées par acteur — au
   troisième export tué, l'acteur ne peut plus jamais exporter.
   `create or replace function public.api_claim_order_exports` (signature,
   grants et logique de réclamation `pending` INCHANGÉS, copiés caractère
   par caractère depuis `20260913000000` — jamais éditée) : AJOUTE en tête
   de fonction un balayage, sous verrou (`for update skip locked`), des
   lignes `running` dont `started_at` date de plus de 15 minutes (plus du
   double de la limite d'horloge d'une invocation, 400 s) → `failed`
   (JAMAIS `pending` : une mise à mort par ressources est déterministe,
   la rejouer brûlerait les tentatives pour rien ; le trigger
   d'immuabilité, vérifié PAR EXÉCUTION RÉELLE, refuse d'ailleurs
   `running → pending` sans incrément d'`attempts`). Nouveau fichier
   `tests/sql/gescom-e10-18d-order-export-recovery-net.sql` (5 scénarios),
   ajouté à `scripts/test-storefront-sql.sh` (50/50 → **51/51**). Signalé
   dans l'en-tête de la nouvelle migration, comme demandé : le commentaire
   de `20260913000000` (« 50k lignes : 22 Mo ») reste FAUX et n'est pas
   éditable (migration déjà déployée) — sa fausseté exacte est expliquée
   plutôt que simplement citée.
5. **C1 — épinglage de `fflate` côté Deno.** Mesuré par l'architecte
   (sondes `c1a`-`c1d`, archivées) : ni une entrée d'import-map seule, ni
   un `deno.lock`, ne figent la version transitive résolue pour
   `write-excel-file` (qui déclare `fflate: ^0.8.2`) — seul un **import
   réel** à version exacte, à CÔTÉ d'une entrée d'import-map identique, le
   fait. `fflate` déplacé en `dependencies` de `package.json` (vérifié :
   toujours `0.8.3` exactement, résolu par le lockfile après le
   déplacement) ; `"fflate": "npm:fflate@0.8.3"` ajouté à l'import-map du
   runner ; `import 'fflate';` ajouté dans `xlsx-renderer.ts`, commenté.
   `tests/architecture/order-export-xlsx-library-boundaries.test.ts`
   étendu : les versions de l'import-map DOIVENT être strictement égales
   (dérivées l'une de l'autre, jamais deux constantes recopiées) à celles
   de `package.json`, pour `write-excel-file` ET `fflate` ; un test dédié
   vérifie l'import réel de `fflate`. **Piège rencontré et corrigé en
   écrivant ce dernier test** : un motif sans ancrage de début de ligne
   matchait la PHRASE DU COMMENTAIRE qui cite `import 'fflate';` pour
   L'EXPLIQUER, pas seulement le vrai import — le test restait vert même
   après suppression réelle de l'import (démontré par mutation). Corrigé
   par un ancrage `^...`/drapeau `m` : une vraie instruction commence
   toujours sa ligne dans ce dépôt, une citation en commentaire ne le fait
   jamais. Aucun `deno.lock` créé (vérifié en fin de session).
6. **C2 — vocabulaire du seuil de 160 Ko, déjà aligné au passage
   précédent.** Vérifié à nouveau : `xlsx-renderer.ts` dit désormais
   explicitement « 160 000 OCTETS NON COMPRESSÉS, PAR FICHIER INTERNE À
   L'ARCHIVE » (précision demandée), et non plus une simple mention en
   « Ko ». Aucun écart avec le cadrage.
7. **CI — étape bloquante ajoutée à `.github/workflows/architecture.yml`**
   (`pnpm exec vitest run tests/modules/order-exports`), après l'étape
   `test:contract`. Vérifié : ni Docker ni Supabase local ne sont requis
   par aucun fichier de `tests/modules/order-exports/` (tous des tests
   unitaires/fakes) ; et sous `TZ=UTC` en local (conditions du runner
   `ubuntu-latest`), les 69 cas passent, **y compris** le test qui force
   `America/Los_Angeles` en interne (M3, qa-review round 1) — c'est
   exactement la condition que cette étape est censée tenir.
8. **Archive du banc de l'architecte** sous `scripts/bench/order-export/`
   (`harness/`, `Dockerfile.bench`, `c1/`, plus un `README.md`). Chemins
   absolus du scratchpad retirés de tous les scripts copiés (remplacés par
   une résolution relative au script lui-même, `$(dirname "${BASH_SOURCE[0]}")`).
   Aucun secret (vérifié par grep sur les motifs usuels) : les identifiants
   du harness (`bench-secret`, `bench-service-role-key`) sont des valeurs
   de test en clair, sans rapport avec un environnement réel. Non archivés
   : le binaire `edge-runtime.bin` (163 Mo), les instantanés `proj*`/
   `lib-only` (copies du code du dépôt à un instant donné, régénérables,
   documentées dans le README), et les logs de campagne volumineux hors
   `c1/*.log` (chiffres clés résumés dans le README à la place).

**Aucun écart avec le cadrage de ce passage** : chaque consigne a été
appliquée telle que reçue, aucune contradiction trouvée entre les
consignes elles-mêmes ni avec le code existant qui aurait nécessité une
escalade.

## Un arbitrage architecte est arrivé PENDANT ce lot — traité, pas tranché par moi

En préparant ce lot, `docs/api/CONVENTIONS.md` a été mis à jour sur le
disque (hors de mon contrôle, non commité) avec une **onzième correction du
bandeau §8.24**, datée du même jour, qui **résout exactement** la réserve
que le mandat me demandait de signaler sans trancher (format XLSX des
colonnes de kind `rate` autres que « PU HT indicatif »).

**Décision de l'architecte, telle qu'écrite dans le contrat** : un format
par **FAMILLE DE CELLULE**, jamais par colonne — `money` → `0.00`, `rate` →
`0.0000`, **sans exception**, sur les **quatre** colonnes `rate`
(« Taux de remise effectif », « Taux de TVA », « Taux de remise ligne »,
« PU HT indicatif »). Aucun format pourcentage. Une cellule `money`/`rate`
nulle est vide, jamais `0`. `rate` désigne une **échelle de quatre
décimales**, pas littéralement le type DB `Rate` (« PU HT indicatif » a une
partie entière non bornée, `12000.0000` pour un exemplaire à 12 000 €, ce
qui ne passe pas le motif de `Rate`).

**Ce que j'ai fait de cette découverte, et pourquoi ce n'est pas moi qui
tranche** : ma table `NUMBER_FORMAT_BY_CELL_KIND` appliquait *déjà*
`rate: '0.0000'` **uniformément aux quatre colonnes** (c'était ma valeur
provisoire, retenue par symétrie avec le motif du PU) — **aucun changement
de comportement n'a donc été nécessaire**. J'ai seulement :
1. retiré le marqueur `EN ATTENTE ARBITRAGE ARCHITECTE (E10.18d)` et
   remplacé le commentaire par une citation du contrat désormais tranché
   (fichier `xlsx-renderer.ts`) — laisser un marqueur « en attente » sur une
   question déjà réglée dans le document que je suis censé consulter aurait
   été exactement la faute que ce contrat critique tout du long (« un
   commentaire qui affirme ce que le code n'est plus ») ;
2. corrigé, sur demande explicite du contrat (« la correction du commentaire
   est à router par le coordinateur, puisqu'un dev-story travaille dans
   `src/` » — je suis ce dev-story, dans ce fichier même), l'en-tête de
   `order-export-columns.ts` (E10.18c) qui affirmait à tort « `rate` =
   `numeric(6,4)` (`Rate`) » — faux pour « PU HT indicatif », dont la partie
   entière n'est pas bornée.

**Aucune ligne de comportement n'a changé** pour le format `rate`
(`toSpreadsheetNumber` ne validait déjà pas contre le motif borné de
`Rate`, la table de formats était déjà uniforme). Seul le format `integer`
a changé de comportement, mais c'est une correction distincte (M1
ci-dessus, qa-review), pas cet arbitrage.

**Je ne revendique aucun mérite sur cet arbitrage** : je ne l'ai pas
demandé, il est apparu sur le disque pendant que je travaillais (le
dépôt est partagé, cf. mise en garde du mandat) et je me contente de m'y
aligner en toute transparence, plutôt que de laisser mon code contredire
silencieusement un contrat déjà corrigé.

## Décisions et leur motif

1. **Dépendance `write-excel-file@4.1.1`, épinglée EXACTEMENT** (pas de
   `^`), `pnpm add -E`. `fflate` résolu par le lockfile : **`0.8.3`**
   (dépendance transitive unique de `write-excel-file`, ajoutée en
   devDependency EXACTE pour le test A, qui la dézippe directement).
2. **Import-map Deno** : `supabase/functions/magrit-order-export-runner/deno.json`
   — nouvelle entrée `"write-excel-file/node": "npm:write-excel-file@4.1.1/node"`,
   forme déduite du style des entrées existantes du fichier (`npm:<pkg>@<version>`),
   étendue au sous-chemin `/node` selon la convention standard des
   spécificateurs `npm:` de Deno (aucune documentation Deno spécifique
   consultée via Context7 — je n'y ai pas accès ; validé indirectement par
   `deno check` réel sur l'Edge Function, qui résout correctement l'import).
3. **`write-excel-file/universal` JAMAIS importé** — vérifié dans le code
   source du paquet (`modules/export/writeXlsxFileUniversal.js`,
   `modules/zip/zipToArrayBuffer.js`, `modules/zip/zipToStream.js`) : `/universal`
   délègue à `zip()` de `fflate` (entrée Node : `esm/index.mjs`), qui
   bascule sur `new Worker(...)` **sans aucune détection de disponibilité**
   dès que la **TAILLE BRUTE (avant compression) d'un fichier interne à
   l'archive** dépasse **160 000 octets** — vocabulaire aligné sur la
   treizième correction du bandeau §8.24, point (i) (2026-09-13) : ni
   « données compressées » (formulation initiale de ce lot, imprécise et
   corrigée en qa-review round 2), ni la taille du classeur final (environ
   neuf fois plus petit que `sheet1.xml`). Constaté dans le code source :
   `size < 160000` → synchrone, sinon → `deflate()` async, lequel appelle
   `wk()` → `new Worker(...)` sans garde. `/node` utilise `ZipDeflate`
   (`new Deflate(...)`, **jamais** `Worker`, quelle que soit la taille) —
   vérifié dans `modules/zip/zipToStream.js`,
   `COMPRESS_FILES_IN_PARALLEL = false`. Test d'architecture dédié
   (`tests/architecture/order-export-xlsx-library-boundaries.test.ts`),
   corrigé en qa-review round 1 (M4) pour couvrir toute forme
   d'importation réelle, `--untracked` compris.
4. **Renderer `xlsxOrderExportRenderer`** (`format: 'xlsx'`,
   `contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`
   — orthographe vérifiée contre `src/modules/order-exports/api/contracts.ts`,
   `orderExportContentTypeSchema` —, `fileExtension: 'xlsx'`). Consomme
   `orderExportColumnsFor(granularity)` : en-têtes et ordre viennent
   EXCLUSIVEMENT de là. Ne `throw` jamais vers l'appelant : verdict
   `{ok:false, code:'order_export.generation_failed', detail}` sur toute
   erreur interne (largeur de colonne manquante, décimal invalide, énumération
   inconnue), même discipline que le CSV.
5. **En-tête figée** (`stickyRowsCount: 1`) — vérifié dans le XML produit
   (`<pane ... state="frozen">`), pas seulement dans la documentation du
   paquet.
6. **Largeurs de colonnes** : table `COLUMN_WIDTH_BY_HEADER`, **une entrée
   par en-tête** (jamais une liste positionnelle parallèle au catalogue —
   exigence du contrat, onzième correction : « portées par la colonne ou
   dérivées d'elle »). Une colonne future sans entrée fait échouer le rendu
   (throw interne, attrapé en verdict) plutôt que de produire un classeur
   avec une largeur manquante en silence.
7. **Nombres natifs** : `toSpreadsheetNumber(decimal: string): number`, LE
   SEUL point de conversion `string → number` de ce lot (le CSV n'en a
   aucun). Refuse tout ce qui n'est pas un décimal strict
   (`/^-?\d+(\.\d+)?$/`, donc sans notation scientifique ni séparateur de
   milliers) et tout résultat non fini, par un `throw` interne attrapé par
   `render()`. **Ne borne jamais le nombre de chiffres de la partie
   entière** — condition nécessaire pour que « PU HT indicatif » (partie
   entière non bornée) passe, voir la section « arbitrage architecte »
   ci-dessus.
8. **Dates natives** : `civilInstantToSpreadsheetDate()` — **ordre imposé et
   vérifié, INDÉPENDAMMENT DU FUSEAU DE LA MACHINE (qa-review M3)** :
   `formatCivilDateInReferenceTimeZone()` (réexportée par
   `order-export-columns.ts`, jamais réimplémentée) PUIS
   `Date.UTC(a, m-1, j)`. Format d'affichage `yyyy-mm-dd`.
9. **Format `integer` (« Position », « Quantité ») : `0`** — ajouté en
   qa-review round 1 (M1), voir section dédiée.
10. **Enregistrement dans la composition** :
    `order-export-composition.ts` câble désormais `{ csv, xlsx }` — les
    affirmations « `xlsx` n'a aucun renderer avant E10.18d » (composition,
    service de génération) sont retirées, remplacées par une description de
    l'état actuel (les deux formats sont livrés).

## Points signalés — TOUS TRANCHÉS ou explicitement non résolus

### 1. Format XLSX des colonnes `rate` autres que « PU HT indicatif » — RÉSOLU PENDANT LE LOT

Voir section dédiée ci-dessus. Tranché par l'architecte (onzième correction
du bandeau §8.24), pas par moi. Aucun changement de comportement dans mon
code, seulement des commentaires alignés sur le contrat désormais à jour.

### 2. Mesure Docker (Test C) — DIVERGENCE IMPORTANTE AVEC LE CONTRAT, NON RÉSOLUE, ESCALADÉE

> **RÉSOLU au passage 3 (2026-09-13) — par l'architecte, pas par moi.**
> L'escalade ci-dessous a été suivie d'effet : l'architecte a rejoué la
> mesure avec un TROISIÈME protocole (Edge Function réelle en *user
> worker*, limites exactes de la CLI, verdict au superviseur) et a confirmé
> que ni mon chiffre ni celui du 12/09 n'étaient représentatifs — voir
> « Passage 3 » plus haut dans ce document et `docs/api/CONVENTIONS.md`
> §8.24, douzième entrée du bandeau. Conclusion : **c'est le CPU qui tue,
> jamais la mémoire**, et le plafond correct est **5 000 lignes**, pas
> 50 000. Section conservée TELLE QUELLE ci-dessous, pour l'historique de
> l'escalade — c'est elle qui a déclenché la remesure.

**Ce que le contrat affirmait ALORS** (§8.24 point 7, réserve (a), avant le
passage 3) : `write-excel-file`
rend 50 000 lignes en 519 ms pour 22 Mo, dans l'image officielle
`supabase/edge-runtime:v1.69.12`.

**Ce que j'ai mesuré, dans la MÊME image, avec le VRAI graphe de modules de
production** (mon point d'entrée importe `xlsxOrderExportRenderer` exactement
comme le fait `order-export-composition.ts`, donc traverse aussi
`order-export-columns.ts` → `order-exports/api/contracts.ts` → `zod`
(4,35 Mo de source) → les contrats `commercial-quotes`/`commercial-orders`/
`pricing` → le fichier généré `platform/api/generated/magrit-core.v1.ts`
(889 Ko) — ce n'est pas une bibliothèque isolée, c'est le graphe complet
qu'importe réellement `magrit-order-export-runner`) :

- **1 ligne** : OK, ~15-30 ms, 597-3 741 octets.
- **5 000 lignes, conteneur à 256 Mo (le budget du contrat)** : OK, de
  manière répétée, **460-1 000 ms**, fichier final **343 314-343 960 octets**
  (deux mesures légèrement différentes : Docker vs `vitest`, fixtures
  légèrement différentes). **Cohérent avec le contrat sur ce volume.**
- **10 000 lignes et au-delà, conteneur à 256 Mo** : ÉCHEC reproductible
  (`HTTP:000`, connexion perdue) — parfois le CONTENEUR ENTIER est tué par
  le noyau (`docker inspect` : `OOMKilled=true`, `exitcode=137`, limite
  cgroup confirmée à 268 435 456 octets = 256 Mio), parfois seul le
  travailleur de la requête échoue sans faire tomber le conteneur.
- **50 000 lignes** : échoue à 256 Mo, 512 Mo, 640 Mo, 768 Mo, 1 Go,
  1 088 Mo, **1 152 Mo** ; **réussit à partir de 1 280 Mo** (confirmé deux
  fois, 4,3-4,95 s, fichier final valide de 3 372 326 octets, signature ZIP
  correcte). **Le point de bascule se situe donc entre 1 152 Mo et 1 280 Mo
  dans ma mesure — environ CINQUANTE FOIS le budget de 256 Mo du contrat.**
- **Fait troublant qui m'empêche de conclure que XLSX est en cause** :
  **le renderer CSV** (E10.18c, DÉJÀ LIVRÉ et déployé, dont le contrat ne
  signale AUCUN problème de mémoire) **échoue LUI AUSSI à 50 000 lignes
  sous 256 Mo dans mon harnais** — testé à la fois en servant le
  répertoire source brut (`--main-service <dir>`) ET en servant un `.eszip`
  pré-empaqueté (`edge-runtime bundle`), les deux échouent pareillement.
  Le CSV ne dépend ni de `write-excel-file` ni de `fflate` : son échec dans
  MON harnais, sur une charge que le contrat dit sûre, indique que le
  surcoût vient probablement de **mon protocole de mesure** (le graphe de
  modules complet chargé à froid via `--main-service` — sans le pipeline de
  build/bundling réel de `supabase functions deploy`, que je n'ai pas
  reproduit) plutôt qu'un défaut du renderer XLSX lui-même.

**Je n'ai PAS pu isoler la cause exacte** (temps alloué à ce lot, et ce
n'est de toute façon pas à moi de trancher une divergence avec une mesure
déjà actée au contrat). **Ce que je peux affirmer avec certitude, parce que
je l'ai mesuré plusieurs fois de façon reproductible** :
1. Le lot est **conforme au CA à 5 000 lignes** (le volume que le mandat
   demandait explicitement de mesurer pour le test de non-régression) :
   confortablement sous 256 Mo, rapide, fichier valide.
2. **Je ne peux pas confirmer, avec mon protocole, que 50 000 lignes XLSX
   tient dans le budget de 256 Mo cité par le contrat** — et je ne peux pas
   non plus l'infirmer avec certitude, puisque le même protocole fait
   également échouer le CSV, déjà connu pour fonctionner en production à ce
   volume.

**Escaladé, pas tranché** : je recommande à l'architecte ou au coordinateur
de reproduire la mesure du 12/09 (celle qui a produit les chiffres « 50 k :
519 ms / 22 Mo ») pour confirmer si elle isolait `write-excel-file` seul
(sans le graphe de modules complet de Magrit) — ce qui expliquerait
l'écart — ou si mon protocole (conteneur `--memory`, `DENO_DIR` partagé,
absence du pipeline de bundling réel) souffre d'un défaut que je n'ai pas
identifié. **Aucune ligne de ce lot ne dépend de la résolution de ce
point** : le plafond de 50 000 lignes est une constante du code
(`ORDER_EXPORT_ROW_LIMIT`, E10.18c), pas du contrat, et se révise sans
toucher `/api/v1` si la mesure confirmée l'exige. **Note qa-review round 1
(m3)** : l'architecte instruit en parallèle le plafond mémoire et
l'épinglage de `fflate` côté Deno — ni `ORDER_EXPORT_ROW_LIMIT` ni
l'import-map `fflate` ne sont touchés par cette correction, ce sera un
second passage.

**Méthode et artefacts** : banc construit dans un répertoire temporaire non
committé (`.scratch-xlsx-bench/`, supprimé en fin de session), qui importe
le renderer réel via un point d'entrée Deno minimal, servi par
`edge-runtime start --main-service` dans l'image officielle
`supabase/edge-runtime:v1.69.12` (et une fois via `edge-runtime bundle` pour
écarter un biais du chargement de source brute). `DENO_DIR` partagé avec le
cache hôte pour éviter un besoin d'accès réseau depuis le conteneur.
Mesures par `docker inspect`/`docker ps` (statut, `OOMKilled`, code de
sortie) plutôt que par `Deno.memoryUsage()` (indisponible dans ce runtime :
`TypeError: Deno.memoryUsage is not a function`, constaté).

### 3. `deno check` — FAIT, VERT sur les deux Edge Functions

`deno check supabase/functions/magrit-order-export-runner/index.ts` → vert
(confirme que tous les imports relatifs, y compris ceux ajoutés par ce lot,
portent l'extension `.ts`, et que l'import-map résout `write-excel-file/node`).
`deno check supabase/functions/magrit-order-file-purge/index.ts` → vert
(non touchée par ce lot, revérifiée par prudence).

## Critères d'acceptation — vérifiés un par un

- **Dépendance épinglée exactement, `package.json` + import-map Deno** :
  FAIT. `write-excel-file: "4.1.1"` (pas de `^`), `fflate: "0.8.3"` en
  devDependency exacte (résolue par le lockfile). Testé par
  `tests/architecture/order-export-xlsx-library-boundaries.test.ts`,
  vérifié par mutation (voir « Tests exécutés »).
- **`write-excel-file/universal` jamais importé, avec commentaire du
  motif** : FAIT. Testé par le même fichier d'architecture, CORRIGÉ en
  qa-review round 1 (M4) pour couvrir toute forme d'importation réelle et
  les fichiers `--untracked`. Vérifié par mutation.
- **Renderer XLSX derrière `OrderExportRenderer`, pur, verdict jamais
  `throw`** : FAIT. `src/modules/order-exports/application/renderers/xlsx-renderer.ts`.
- **En-tête figée, largeurs de colonnes** : FAIT. `<pane ... state="frozen">`
  vérifié dans le XML produit ; `<cols><col .../></cols>` avec
  `customWidth="1"` pour chaque colonne, vérifié par comptage exact contre
  le catalogue.
- **Nombres natifs, jamais de chaîne formatée côté serveur** : FAIT.
  `toSpreadsheetNumber()`, point de conversion UNIQUE. Testé unitairement
  (arrondis, négatifs, `"0.0900"`, `"333.3333"`, grande valeur
  `numeric(12,2)`, rejets) et par le fichier de référence (valeurs
  numériques natives, sans `t="s"`).
- **Dates natives, `Date.UTC` après résolution civile Europe/Paris,
  format `yyyy-mm-dd`, PROUVÉ INDÉPENDAMMENT DU FUSEAU DE LA MACHINE** :
  FAIT, corrigé en qa-review round 1 (M3). Testé sur le cas explicitement
  demandé par le mandat (commande créée le 1er du mois à 00h30 Paris =
  veille 22h30 UTC en été) — la cellule porte le 1er, série ENTIÈRE — ET
  sur un test dédié qui force `TZ=America/Los_Angeles`, prouvant que la
  propriété tient quel que soit le fuseau ambiant de la machine (y compris
  `TZ=UTC`, le réglage typique d'un runner CI).
- **Formats `0.00`/`0.0000`/`0` par famille de cellule** : FAIT. `0.0000`
  sur les QUATRE colonnes `rate` (arbitrage architecte, voir section
  dédiée) ; `0` sur les colonnes `integer` (qa-review round 1, M1).
  Vérifié colonne par colonne, pour les deux granularités, contre l'ordre
  du contrat (qa-review round 1, M2).
- **Cellule nulle → cellule vide, jamais `0`, jamais un tiret** : FAIT et
  TESTÉ (qa-review round 1, B2 — bloquant à l'origine, la propriété était
  vraie mais non tenue par un test). Quatre tests dédiés (money/rate ×
  order/line), vérifiés par mutation dans les deux sens.
- **Traductions déjà dans le catalogue, aucun code brut, piège inverse
  tenu** : FAIT. Testé sur `order_status`, `customer_type`, `vat_regime`
  (traduits) et « Étape de production » (non traduite, `draft` reste
  `draft`) — sur les chaînes partagées RÉELLEMENT DÉCODÉES du classeur, pas
  sur une supposition.
- **Enregistrement dans `order-export-composition.ts`, affirmations
  périmées retirées** : FAIT. Testé par
  `tests/server/api/order-export-run-composition.test.ts` (fake client
  Supabase minimal, exerçant les VRAIS adaptateurs) : un export `xlsx`
  réclamé produit un fichier déposé (signature ZIP vérifiée), jamais
  `order_export.format_not_implemented`.
- **Extension `.ts` explicite sur tout import relatif atteignable depuis
  l'Edge Function** : FAIT, vérifié par grep exhaustif ET par `deno check`
  réel (qui échouerait sans l'extension).
- **Tests de fichier de référence (Test A) pour les deux granularités,
  contre l'ordre du contrat** : FAIT.
  `tests/modules/order-exports/xlsx-renderer.reference.test.ts` (29 cas
  après qa-review round 1) — dézippage réel (`fflate`), lecture de
  `xl/worksheets/sheetN.xml`, `xl/styles.xml`, `xl/sharedStrings.xml`.
- **Test de non-régression à volume réaliste franchissant réellement le
  seuil des 160 Ko, Worker RÉELLEMENT rendu indisponible (Test B)** :
  FAIT, CORRIGÉ EN PROFONDEUR en qa-review round 1 (B1 — la première
  version ne simulait rien). `tests/modules/order-exports/xlsx-renderer.volume.test.ts`
  (2 cas) — 5 000 lignes, `xl/worksheets/sheet1.xml` non compressé mesuré à
  **3 045 419 octets** (19× le seuil de 160 000), classeur final
  **343 960 octets**, ET un témoin négatif obligatoire (`/universal` +
  `.toBlob()` sur le même harnais, doit échouer — échoue bien).
- **Mesure Docker (Test C)** : FAIT PARTIELLEMENT, divergence importante
  signalée, voir section dédiée ci-dessus. `deno check` réel : FAIT, vert.

## Dérogation R5 utilisée

Aucune. La forme du renderer suit à l'identique le patron du CSV
(E10.18c) : port `OrderExportRenderer`, verdict jamais `throw`, catalogue
de colonnes unique. Le seul choix qui aurait pu en être une (le format des
colonnes `rate` autres que le PU) a été tranché par l'architecte pendant ce
lot, pas par moi — voir section dédiée.

## Tests exécutés

### Round 1 (avant qa-review)

Voir historique — chiffres corrigés ci-dessous (qa-review m2 : les
premiers chiffres annoncés étaient faux).

### Round 2 (après correction qa-review round 1, 2026-09-13)

- `pnpm typecheck` → vert.
- `pnpm exec vitest run tests/modules/order-exports tests/server/api tests/architecture`
  → vert, **312 cas, 54 fichiers**.
- Décompte PRÉCIS des fichiers de ce lot (qa-review m2, les chiffres
  précédents — 67/9/34 — étaient faux) :
  - `tests/modules/order-exports/xlsx-renderer.reference.test.ts` → **29 cas**
    (24 avant qa-review + 5 nouveaux : 1 test M3 fuseau forcé, 2 tests B2
    cellule nulle absente (order + line), 2 tests M2 colonne par colonne
    (order + line, chacun couvrant 18-19 colonnes)).
  - `tests/modules/order-exports/xlsx-renderer.test.ts` → **7 cas**
    (inchangé, unitaire `toSpreadsheetNumber`).
  - `tests/modules/order-exports/xlsx-renderer.volume.test.ts` → **2 cas**
    (réécrit en profondeur, qa-review B1 : 1 positif + 1 témoin négatif
    obligatoire, contre 1 cas auparavant).
  - `tests/server/api/order-export-run-composition.test.ts` → **1 cas**
    (inchangé).
  - `tests/architecture/order-export-xlsx-library-boundaries.test.ts` →
    **5 cas** (inchangé en nombre, motif de recherche élargi — qa-review
    M4).
  - **Total ce lot : 44 cas** (contre les 67 annoncés à tort au round 1).
- `pnpm test:contract` → vert, **432 cas, 23 fichiers, inchangé** (aucun
  endpoint modifié par ce lot).
- `pnpm test:architecture` → vert, **151 cas, 35 fichiers** (146 + 5 pour
  la bibliothèque XLSX).
- `pnpm gen:api:check` → vert, aucun diff `openapi/`.
- `pnpm test` (suite complète) → **2407 passés**, mêmes **3 échecs
  préexistants, sans rapport** (`tests/storage/product_mockups_isolation.test.ts`,
  bucket `product_mockups` absent de l'environnement local — feature non
  touchée par ce lot), 36 ignorés.
- `pnpm test:storefront:sql` — non exécuté sur instruction explicite du
  mandat (« rouge pour une cause préexistante sans rapport »).
- `deno check` réel sur les deux Edge Functions : vert sur les deux
  (inchangé).

- **Vérifications par mutation (règle opposable du contrat §8.24 point 8 :
  « une correction de revue n'est acquise que si un test la tient »),
  UNE mutation PAR correction, exécutée, résultat rapporté** :

  1. **B1 (té moin négatif)** — mutation `/node` → `/universal` dans
     `xlsx-renderer.ts` (import + type import), avec le NOUVEAU harnais
     `worker_threads` : le test d'architecture **échoue** (import
     `/universal` détecté), le test de fichier de référence **échoue**
     (`workbook.toBuffer is not a function`), le test de volume **échoue**
     (le renderer `/node`-attendu échoue désormais lui aussi). Restauré,
     `diff` confirmé identique, tout repasse au vert.
  2. **B1 (harnais lui-même)** — preuve que le NOUVEAU harnais
     (`require('node:worker_threads').Worker` cassé) fonctionne
     correctement, ce que l'ANCIEN (`globalThis.Worker`) ne faisait pas :
     exécution réelle démontrant que `write-excel-file/universal` + 5 000
     lignes échoue sous le nouveau harnais (`rejects.toThrow()` — cas
     « TÉMOIN NÉGATIF OBLIGATOIRE » du fichier), alors qu'avec l'ancien
     harnais (`globalThis.Worker` cassé), le même appel réussissait
     (vérifié en cours de diagnostic, avant réécriture — voir le
     changelog du fichier). Piège intermédiaire rencontré et corrigé
     pendant l'écriture : un `import { unzipSync } from 'fflate'`
     STATIQUE en tête de fichier chargeait `fflate` (donc capturait un
     `Worker` intact) AVANT que `beforeAll()` ne le casse, ce qui faisait
     échouer silencieusement le témoin négatif (`fflate` déjà chargé avec
     un Worker fonctionnel). Corrigé en rendant `unzipSync` lui aussi
     dynamique.
  3. **B2** — mutation de `dataCell()` : `case 'money'`, cellule nulle →
     `{value: 0, ...}` au lieu de `null`. Résultat : les DEUX tests B2
     (order ET line) **échouent** sur leur assertion "Total lignes
     HT"/"Montant HT barème" (cellule reçue au lieu d'absente). Restauré.
     Puis mutation symétrique sur `case 'rate'` : les DEUX tests B2
     **échouent** sur leur assertion "Taux de remise
     effectif"/"Taux de remise ligne". Restauré, `diff` confirmé
     identique, les 29 cas du fichier repassent au vert.
  4. **M1** — mutation de `case 'integer'` : format retiré
     (`{value: cell.value, type: Number}`, sans `format`). Le nouveau test
     M2 (colonne par colonne) **échoue** sur la colonne « Position »
     (`numFmt` attendu `'0'`, reçu `null`). Restauré.
  5. **M3** — exécution RÉELLE de la suite avec `TZ=UTC` CÔTÉ MACHINE
     (`TZ=UTC pnpm exec vitest run tests/modules/order-exports/xlsx-renderer.reference.test.ts`)
     et le code MUTÉ (`civilInstantToSpreadsheetDate` reconstruite avec
     `new Date(annee, mois, jour)`, constructeur local, au lieu de
     `Date.UTC`) : SEUL le nouveau test M3 (qui force
     `TZ=America/Los_Angeles` en interne) **échoue**
     (`expected 46266.29166666667 to be 46266`) — les deux tests de date
     préexistants restent VERTS sous `TZ=UTC` avec le code muté,
     confirmant EXACTEMENT le défaut décrit par la qa-review. Restauré,
     `diff` confirmé identique, `TZ=UTC pnpm exec vitest run ...`
     repasse au vert sur les 29 cas.
  6. **M4** — ligne probe `// test probe: import x from 'write-excel-file/universal';`
     ajoutée à `xlsx-renderer.ts` (fichier UNTRACKED à ce moment) :
     `git grep --untracked` avec le nouveau motif la détecte
     (`exit:0`, fichier listé) ; sans `--untracked`, la même commande ne
     la voit pas (`exit:1`, aucun résultat) — preuve directe du défaut
     décrit par la qa-review et de sa correction. Ligne retirée.

### Round 3 (après correction qa-review round 2, 2026-09-13)

- `pnpm typecheck` → vert.
- `pnpm exec vitest run tests/modules/order-exports tests/server/api tests/architecture`
  → vert, **312 cas, 54 fichiers, inchangé** (la correction du reste de B1
  ne change aucun compte de cas — même test, assertion resserrée).
- `pnpm test:contract` → vert, **432 cas, 23 fichiers, inchangé**.
- `pnpm test:architecture` → vert, **151 cas, 35 fichiers, inchangé**.
- `pnpm gen:api:check` → vert, aucun diff `openapi/`.
- `deno check supabase/functions/magrit-order-export-runner/index.ts` →
  vert.

- **Preuves par mutation, DEUX EXÉCUTIONS RÉELLES demandées par la
  qa-review, résultats rapportés** :
  1. **Double mutation (« harnais inerte »)** — dans
     `breakNodeWorkerThreads()`, la ligne qui remplace
     `workerThreads.Worker` par la classe qui lève est RETIRÉE (casse du
     Worker neutralisée) **ET**, dans `buildWitnessSheetData()`, la
     cellule numérique du témoin est rendue invalide
     (`{ value: 'pas-un-nombre', type: Number }`). Résultat : le témoin
     négatif **échoue** —
     `expected [Function] to throw error matching /Worker is not defined/
     but got 'Invalid cell value: pas-un-nombre. Expected a number'` —
     exactement le défaut décrit (avant la correction, `toThrow()` sans
     argument aurait laissé passer cette erreur SANS RAPPORT avec le
     Worker, rendant le harnais inerte indétectable). Cellule du témoin
     restaurée pour l'étape suivante.
  2. **Neutralisation SEULE de la casse du Worker** (donnée du témoin
     valide, restaurée) : le témoin négatif **échoue toujours**, pour une
     raison différente et également correcte —
     `promise resolved "Blob { size: 120102, ... }" instead of rejecting`
     (le Worker fonctionne réellement, `/universal` réussit, il n'y a
     plus rien à rejeter). Code entièrement restauré (`diff` confirmé
     identique à l'original), les 2 cas du fichier repassent au vert.

### Round 4 (passage 3, recadrage architecte, 2026-09-13)

- `pnpm typecheck` → vert.
- `pnpm exec vitest run tests/modules/order-exports tests/server/api tests/architecture tests/kernel`
  → vert, **335 cas, 56 fichiers** (312 + 2 nouveaux tests kernel
  (formateur en cache) + 2 nouvelles valeurs — `ORDER_EXPORT_ROW_LIMIT`,
  `DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit` — + 2 nouveaux tests
  d'architecture fflate — import réel + une version — dans les fichiers
  existants, pas de nouveau fichier de test).
- `pnpm test:contract` → vert, **432 cas, 23 fichiers, inchangé**.
- `pnpm test:architecture` → vert, **153 cas, 35 fichiers** (151 + 2, les
  deux tests fflate).
- `pnpm gen:api:check` → vert, aucun diff `openapi/`.
- `deno check supabase/functions/magrit-order-export-runner/index.ts` →
  vert (import `fflate` résolu via l'import-map, sans `deno.lock`).
- `pnpm test:storefront:sql` → vert, **51/51** (50 précédents + le
  nouveau `gescom-e10-18d-order-export-recovery-net.sql`).
- `pnpm test` (suite complète) → **2413 passés**, mêmes **3 échecs
  préexistants, sans rapport** (`tests/storage/product_mockups_isolation.test.ts`),
  36 ignorés.

- **Preuves par mutation, exécutées pour CHAQUE correction de ce passage** :
  1. **Formateur de date mis en cache** — `CIVIL_DATE_FORMATTER.format(date)`
     remplacé temporairement par un `new Intl.DateTimeFormat('en-CA', {...})`
     reconstruit à chaque appel : le nouveau test kernel **échoue**
     (`expected 26 to be 1` — 1 construction au chargement du module + 25
     dans la boucle, au lieu d'1 seule). Restauré, `diff` confirmé
     identique, 15 cas du fichier repassent au vert.
  2. **`ORDER_EXPORT_ROW_LIMIT`/`DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit`**
     — valeurs directement assertées (`toBe(5_000)`/`toBe(1)`) : les tests
     échoueraient trivialement sur toute régression de valeur (pas de
     mutation supplémentaire nécessaire au-delà de la valeur elle-même,
     déjà l'objet du test).
  3. **Filet de reprise (migration `20260913010000`)** — la fonction
     `public.api_claim_order_exports` REMISE à sa version d'origine
     (`20260913000000`, sans le bloc `with stuck as (...) update ...`) :
     `tests/sql/gescom-e10-18d-order-export-recovery-net.sql` **échoue**
     dès le scénario 1 (`ERROR: scenario 1 (BLOQUANT) : une ligne running
     vieille de 16 minutes aurait du passer failed, obtenu running`),
     transaction ANNULÉE (aucun `ROLLBACK` explicite atteint, le script
     s'arrête sur l'erreur). Fonction restaurée en rejouant
     `20260913010000` telle quelle (`create or replace`), `pnpm db:local:push`
     confirmé à jour, le fichier SQL repasse à 5/5 scénarios verts.
  4. **fflate — version divergente dans l'import-map** —
     `"fflate": "npm:fflate@0.8.2"` (au lieu de `0.8.3`) dans le
     `deno.json` du runner : le test d'architecture dédié **échoue**
     (`expected 'npm:fflate@0.8.2' to be 'npm:fflate@0.8.3'`). Restauré,
     `diff` confirmé identique.
  5. **fflate — import retiré** — `import 'fflate';` supprimé de
     `xlsx-renderer.ts` : le test d'architecture dédié **échoue**
     (aucune correspondance du motif ancré `^import ...`). **Piège
     rencontré en écrivant CE test avant la mutation** : la première
     version du motif (sans ancrage `^`) restait VERTE même après cette
     même suppression, parce qu'elle matchait la PHRASE DU COMMENTAIRE qui
     cite `import 'fflate';` pour l'expliquer — corrigé par l'ancrage de
     début de ligne, puis la mutation refaite a bien fait tomber le test
     corrigé. Restauré, `diff` confirmé identique.

## Fichiers créés

- `src/modules/order-exports/application/renderers/xlsx-renderer.ts`
- `tests/modules/order-exports/xlsx-renderer.test.ts` (unitaire,
  `toSpreadsheetNumber`, 7 cas)
- `tests/modules/order-exports/xlsx-renderer.reference.test.ts` (fichier de
  référence, dézippage réel, 29 cas après qa-review round 1)
- `tests/modules/order-exports/xlsx-renderer.volume.test.ts` (non-régression
  à volume réel, `worker_threads.Worker` réellement cassé après qa-review
  round 1 (B1), 2 cas)
- `tests/server/api/order-export-run-composition.test.ts` (composition,
  fake client Supabase minimal, 1 cas)
- `tests/architecture/order-export-xlsx-library-boundaries.test.ts`
  (interdiction de `/universal`, épinglage de version, motif élargi après
  qa-review round 1 (M4), 5 cas)
- `_bmad-output/implementation-artifacts/story-E10.18d.md` — ce document.

Round 4 (passage 3, recadrage architecte, 2026-09-13) :
- `supabase/migrations/20260913010000_gescom_e10_18d_order_export_recovery_net.sql`
  — filet de reprise (`create or replace function public.api_claim_order_exports`,
  signature/grants inchangés, balayage `running` → `failed` ajouté en tête).
- `tests/sql/gescom-e10-18d-order-export-recovery-net.sql` (5 scénarios).
- `scripts/bench/order-export/` — archive du banc de l'architecte
  (`harness/`, `Dockerfile.bench`, `c1/`, `README.md`).

## Fichiers modifiés

Round 1 :
- `package.json` — ajout de `write-excel-file: "4.1.1"` (dependencies,
  exact) et `fflate: "0.8.3"` (devDependencies, exact).
- `pnpm-lock.yaml` — résolution des deux paquets ci-dessus.
- `src/server/api/order-export-composition.ts` — enregistrement du
  renderer XLSX (`renderers: { csv, xlsx }`), commentaire mis à jour (les
  affirmations « xlsx n'a aucun renderer avant E10.18d » sont retirées).
- `src/modules/order-exports/application/order-export-generation-service.ts`
  — commentaire de `renderers` mis à jour (même motif).
- `supabase/functions/magrit-order-export-runner/deno.json` — nouvelle
  entrée d'import-map `write-excel-file/node`.
- `src/modules/order-exports/application/order-export-columns.ts` —
  correction de l'en-tête (E10.18c) sur `rate`/`Rate` (voir « arbitrage
  architecte » ci-dessus), routée par le contrat vers un dev-story.

Round 2 (correction qa-review round 1, 2026-09-13) :
- `src/modules/order-exports/application/renderers/xlsx-renderer.ts` —
  ajout du format `integer: '0'` à `NUMBER_FORMAT_BY_CELL_KIND` et à
  `case 'integer'` de `dataCell()` (M1) ; commentaire de tête corrigé
  (renvoi vers le bon fichier de test, mécanisme réel de simulation du
  Worker — B1).
- `tests/modules/order-exports/xlsx-renderer.volume.test.ts` — réécrit en
  profondeur (B1) : `require('node:worker_threads').Worker` cassé au lieu
  de `globalThis.Worker`, plus aucun import statique de `fflate`/
  `write-excel-file`, témoin négatif obligatoire sur `/universal` +
  `.toBlob()`.
- `tests/modules/order-exports/xlsx-renderer.reference.test.ts` —
  commentaire « EN ATTENTE ARBITRAGE » retiré (m1) ; 2 nouveaux tests
  portant 4 assertions B2 (cellule money/rate nulle absente, order + line)
  ; nouveau test M3
  (fuseau forcé) ; nouveau test M2 paramétré (comparaison colonne par
  colonne, 2 granularités) ; fixture `lineRow()` du test M2 enrichie
  (SIRET/TVA non nuls, pour couvrir toutes les colonnes).
- `tests/architecture/order-export-xlsx-library-boundaries.test.ts` —
  motif de recherche élargi et unifié (M4), `--untracked` ajouté à
  `git grep`, commentaire sur le lockfile fflate nuancé (m3).

Round 3 (correction qa-review round 2, 2026-09-13) :
- `tests/modules/order-exports/xlsx-renderer.volume.test.ts` — témoin
  négatif resserré à `rejects.toThrow(/Worker is not defined/)` (reste de
  B1) ; ordre `throw`/`expect` inversé dans le test positif (mineur 1) ;
  en-tête « Le seuil exact » aligné sur le vocabulaire de la treizième
  correction du bandeau §8.24 (« taille BRUTE, avant compression » — mineur
  3, vocabulaire).
- `src/modules/order-exports/application/renderers/xlsx-renderer.ts` —
  en-tête « NE JAMAIS importer `write-excel-file/universal` » aligné sur le
  même vocabulaire (mineur 3).
- `tests/architecture/order-export-xlsx-library-boundaries.test.ts` —
  en-tête « PRECAUTION 1 » aligné sur le même vocabulaire (mineur 3).
- `_bmad-output/implementation-artifacts/story-E10.18d.md` — ce document
  (section « qa-review round 2 », reformulation B2 en « 2 tests portant 4
  assertions » — mineur 2, vocabulaire du seuil dans « Décisions et leur
  motif » point 3, tests exécutés, listes de fichiers).

Round 4 (passage 3, recadrage architecte, 2026-09-13) :
- `src/kernel/clock/timezone.ts` — `CIVIL_DATE_FORMATTER` sorti en
  constante de module, réutilisé par `formatCivilDateInReferenceTimeZone`.
  Aucun autre changement.
- `tests/kernel/timezone.test.ts` — 2 nouveaux tests (formateur construit
  une seule fois, comportement inchangé après mise en cache). Tests
  préexistants NON modifiés.
- `src/modules/order-exports/application/order-export-generation-service.ts`
  — `ORDER_EXPORT_ROW_LIMIT` : `50_000` → `5_000` ; commentaire réécrit
  (renvoi au contrat, CPU pas mémoire).
- `src/modules/order-exports/application/order-export-renderer.ts` —
  mentions de `50 000` remplacées par un renvoi à `ORDER_EXPORT_ROW_LIMIT`.
- `src/modules/order-exports/application/order-export-run-repository.ts`
  — `DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit` : `5` → `1`, motif en
  commentaire.
- `tests/modules/order-exports/order-export-generation-service.test.ts` —
  2 nouvelles assertions de valeur ; commentaires/titres de `describe`/`it`
  qui citaient « 50 000 » littéralement, alignés sur le nom de la
  constante (comportement de test INCHANGÉ, déjà écrit contre la
  constante, pas contre un nombre en dur).
- `package.json` — `fflate` déplacé de `devDependencies` vers
  `dependencies` (toujours `0.8.3` exact).
- `pnpm-lock.yaml` — resynchronisé après le déplacement (`pnpm install`).
- `supabase/functions/magrit-order-export-runner/deno.json` — nouvelle
  entrée d'import-map `"fflate": "npm:fflate@0.8.3"`.
- `src/modules/order-exports/application/renderers/xlsx-renderer.ts` —
  `import 'fflate';` ajouté (épinglage transitif côté Deno, commenté) ;
  en-tête « NE JAMAIS importer .../universal » reformulé pour dire
  explicitement « 160 000 octets NON COMPRESSÉS, PAR FICHIER INTERNE À
  L'ARCHIVE » (C2).
- `tests/architecture/order-export-xlsx-library-boundaries.test.ts` —
  étendu : égalité stricte des versions import-map/package.json pour
  `write-excel-file` ET `fflate` (`describe.each`, dérivée plutôt que
  recopiée) ; nouveau test de l'import réel de `fflate` (ancré en début de
  ligne, voir le piège corrigé en l'écrivant, section « Tests exécutés »,
  Round 4).
- `scripts/test-storefront-sql.sh` — ajout de
  `tests/sql/gescom-e10-18d-order-export-recovery-net.sql` à la chaîne
  (50/50 → 51/51).
- `.github/workflows/architecture.yml` — étape bloquante
  `pnpm exec vitest run tests/modules/order-exports` ajoutée après
  `test:contract`.
- `_bmad-output/implementation-artifacts/story-E10.18d.md` — ce document
  (section « Passage 3 », note de résolution sur le point 2 des « Points
  signalés », Round 4 des tests exécutés, listes de fichiers).

## Points HORS de mon contrôle, trouvés sur le disque pendant la session

`git status` a montré, pendant ce lot, des modifications non commitées sur
`docs/api/CONVENTIONS.md` (onzième, douzième puis treizième corrections du
bandeau, traitées ci-dessus au fil des passages) et sur `SPRINT_HANDOFF.md`
— un autre agent travaille sur ces fichiers dans le même répertoire de
travail (confirmé par le coordinateur) : je n'y ai pas touché et je ne les
ai pas inspectés, au-delà de LIRE `docs/api/CONVENTIONS.md` (lecture
obligatoire, jamais une écriture). Le commit `b5be938d` (`tests/sql`,
gate storefront de nouveau verte à 50/50) a été signalé par le
coordinateur comme déjà fait par un autre agent : non touché, ma seule
modification de la chaîne SQL est l'AJOUT du fichier de ce lot (50 → 51).

## qa-review round 3 (2026-09-13) — REJETÉ sur UN bloquant, 5 mineurs dans le même passage

Tout le reste (passage 3) jugé tenu, migration jugée sûre pour la
production. Mêmes contraintes reconduites : aucun commit, `openapi/`,
`docs/api/CONVENTIONS.md` et `SPRINT_HANDOFF.md` non touchés par moi.

### BLOQUANT — le motif regex du test « importe REELLEMENT fflate » était satisfait par un bloc commenté

`tests/architecture/order-export-xlsx-library-boundaries.test.ts` détectait
l'import de `fflate` par une expression régulière ancrée en début de ligne
sur le texte source brut. Un bloc `/* import 'fflate'; */` place l'import
seul sur sa ligne : la regex ne voit pas le commentaire et le test reste
VERT alors que l'épinglage transitif C1 n'est plus garanti par rien.

Correctif appliqué (prescrit tel quel par la qa-review, alternative
« retirer les commentaires puis regex » explicitement écartée comme moins
sûre) : lecture des déclarations d'import RÉELLES via l'API du compilateur
TypeScript.

- `parseTypeScriptFile()` — `ts.createSourceFile()` sur le texte source
  exact du fichier.
- `hasRealImportMatching(sourceFile, matches)` — parcours récursif
  (`ts.forEachChild`) qui reconnaît :
  - un `ImportDeclaration` non `type-only` dont le `moduleSpecifier` est un
    littéral de chaîne correspondant au prédicat ;
  - un appel `import(...)` dynamique (`node.expression.kind ===
    ts.SyntaxKind.ImportKeyword`) ou un `require(...)` dont le premier
    argument littéral correspond.
  - Un commentaire, quelle que soit sa forme (`/* */` multi-ligne, `//`
    par ligne, bloc où l'import occupe seule sa ligne), n'a AUCUNE
    représentation dans l'AST : structurellement invisible à ce parcours,
    contrairement à une regex sur texte brut.
- Le test « importe RÉELLEMENT fflate » compare désormais
  `hasRealImportMatching(sourceFile, (s) => s === 'fflate')` à `true`, sans
  toucher au texte source.
- Même parcours appliqué au contrôle `/universal` : les fichiers `.ts`/
  `.tsx` candidats (repérés par `git grep` avec `--untracked`, qui reste le
  bon outil pour une recherche large de CANDIDATS, jamais pour trancher)
  sont ensuite filtrés par `hasRealImportMatching` avant d'être retenus
  comme des IMPORTS réels ; les fichiers non `.ts`/`.tsx` (ex. `deno.json`,
  sans syntaxe TypeScript à parser) restent tranchés par le `git grep`
  seul, comme demandé.

**Preuves (mutation, exécution, restauration exacte)** — sur
`src/modules/order-exports/application/renderers/xlsx-renderer.ts`,
sauvegarde préalable (`/tmp/xlsx-renderer.ts.bak5`) :

1. **Bloc sans astérisque intérieur** (l'import occupe seule sa ligne à
   l'intérieur d'un `/* ... */` multi-ligne) : le test « importe RÉELLEMENT
   fflate » tombe (`hasRealImportMatching` retourne `false`) — FAIT.
2. **Commentaire `//`** (`// import 'fflate';`) : même échec — FAIT.
3. **Import retiré** (ligne supprimée purement et simplement) : même
   échec — FAIT.
4. Restauration : `cp /tmp/xlsx-renderer.ts.bak5
   src/modules/order-exports/application/renderers/xlsx-renderer.ts`, puis
   `diff` contre la sauvegarde : IDENTIQUE. Les 7 cas du fichier
   d'architecture repassent au vert.

### Mineur 1 — assertion du message « resserrez la période »

`tests/modules/order-exports/order-export-generation-service.test.ts`,
test du plafond dépassé : ajout de
`expect(repository.failed[0]?.detail).toMatch(/resserrez la p[eé]riode/i);`
juste après l'assertion de code d'erreur. Mutation du message source
(`order-export-generation-service.ts`, message sans « resserrez ») : le
test tombe. Restauration exacte (`diff` contre sauvegarde) : 11/11 tests
du fichier repassent au vert.

### Mineur 2 — preuves `c1/c1.log` et `c1/c1-cd.log` inlinées dans le README (fichiers ignorés par git)

`scripts/bench/order-export/README.md` citait ces deux fichiers par chemin
seul, hors du dépôt (`.gitignore`, motif `*.log`). Contenu exact recopié
dans le README (187 et 166 octets, vérifiés par lecture directe des
fichiers), avec l'interprétation précise des quatre sondes (c1a-c1d) déjà
établie en passage 3. `git check-ignore -v` et `git status --porcelain
--ignored` confirment que les `.log` restent ignorés (`!!`) : aucun ajout
forcé.

### Mineur 3 — scénario 3 du test SQL de reprise, indépendant des données existantes

`tests/sql/gescom-e10-18d-order-export-recovery-net.sql`, scénario 3 :
supposait au plus 4 exports `pending` déjà dus dans une base partagée
(réclamation limitée à 5, triée par date de demande). Corrigé par un
contrôle CIBLÉ sur la seule ligne du scénario, jamais par une hypothèse
sur le contenu de la base :
- la ligne `pending` du scénario reçoit un `started_at` délibérément
  ancien (20 minutes), pour rester CAPABLE de détecter une régression du
  filtre `status = 'running'` du balayage ;
- l'assertion passe de `v_pending_status <> 'running'` (stricte) à
  `v_pending_status not in ('pending', 'running')` : elle échoue
  seulement si le balayage a fait sortir la ligne de son couple d'états
  attendu, jamais à cause d'une réclamation concurrente d'une autre ligne
  de la base partagée.

**Preuve (mutation « filtre status retiré »)** : recréation directe
(`psql`) de `public.api_claim_order_exports` sans la clause
`where status = 'running'` dans le CTE `stuck` du balayage. Rejeu du
fichier de test complet : ÉCHEC confirmé — le balayage, non filtré, tente
alors de faire passer à `failed` une ligne `ready` déjà présente dans la
base (fixture d'un autre scénario), et le trigger d'immuabilité
(`commercial_order_exports_reject_mutation`) lève
« un export ready ne peut plus que passer expired » — un échec dur,
exactement ce qu'exige la preuve de mutation (le script sort en erreur,
`ROLLBACK` n'est jamais atteint). Restauration : rejeu de
`supabase/migrations/20260913010000_gescom_e10_18d_order_export_recovery_net.sql`
tel quel (`CREATE FUNCTION` confirmé) ; rejeu du fichier de test :
5/5 scénarios de nouveau `OK`.

### Mineur 4 — bloc de réversibilité de la migration, aligné au caractère près

`supabase/migrations/20260913010000_..._recovery_net.sql`, section
« RÉVERSIBILITÉ » : comparaison ligne à ligne contre le texte d'origine
exact de `api_claim_order_exports` dans
`supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`
(lignes 545-607), après neutralisation du préfixe `--` et de
l'indentation de citation. Le bloc entier suit un décalage UNIFORME de 3
espaces (commentaire SQL) — sauf 4 lignes décalées de seulement 2
espaces : `from stale s`, `where e.id = s.id`, `from fresh f`,
`where e.id = f.id`. Un espace ajouté à chacune des 4 lignes. Diff final
(texte d'origine avec un décalage uniforme de 3 espaces appliqué
mécaniquement, comparé au bloc de réversibilité neutralisé de son
préfixe `--`) : IDENTIQUE.

### Mineur 5 — `deno.lock` racine : `deno check` sur les trois points d'entrée, diff inspecté

`deno check` exécuté sur `supabase/functions/magrit-order-export-runner/index.ts`,
`supabase/functions/magrit-api/index.ts` et
`supabase/functions/magrit-order-file-purge/index.ts` (les trois verts).
Diff du `deno.lock` racine (suivi par git) : **2 insertions, 0
suppression** — ajout de `npm:fflate@0.8.3` et
`npm:write-excel-file@4.1.1` à la liste des dépendances du workspace
racine (cohérent avec `package.json`, déjà `dependencies` exactes depuis
le passage 3). Vérification explicite : aucune version existante
déplacée, en particulier `@supabase/supabase-js` reste `2.103.3` partout
(les trois `deno.json` de fonction et le lockfile, avant et après) —
aucune trace de `2.49.8` dans ce diff. **Décision : le diff est gardé**
(cohérent avec le lot, rien d'autre touché). Aucun `deno.lock` local
parasite créé sous `supabase/functions/*/`.

### Tests exécutés (Round 5, qa-review round 3)

- `pnpm typecheck` — vert.
- `pnpm exec vitest run tests/modules/order-exports tests/server/api tests/architecture tests/kernel`
  — 56 fichiers / 335 tests, vert.
- `pnpm test:contract` — 23 fichiers / 432 tests, vert.
- `pnpm test:architecture` — 35 fichiers / 153 tests, vert.
- `pnpm gen:api:check` — vert (« Types generes alignes sur
  openapi/magrit-core.v1.yaml »).
- `pnpm test:storefront:sql` — 51/51 fichiers, exit 0, aucune erreur.
- `deno check` sur les trois points d'entrée — vert.
- `pnpm test` (suite complète) — 267 fichiers passés / 1 échoué, 2413 tests
  passés / 3 échoués / 36 ignorés — les 3 échecs, tous dans
  `tests/storage/product_mockups_isolation.test.ts` (`Bucket not found` /
  400 / cleanup), préexistants et sans rapport avec ce lot (infrastructure
  du bucket `product_mockups`, hors périmètre E10.18d).

### Fichiers modifiés dans ce passage

- `tests/architecture/order-export-xlsx-library-boundaries.test.ts` —
  détection d'import réécrite intégralement sur l'API du compilateur
  TypeScript (`ts.createSourceFile`, `hasRealImportMatching`), pour le
  test `fflate` ET pour le contrôle `/universal` sur les fichiers `.ts`/
  `.tsx` (le `git grep` reste seul juge pour les fichiers non-TS).
- `tests/modules/order-exports/order-export-generation-service.test.ts` —
  assertion du message « resserrez la période » ajoutée au test du
  plafond dépassé.
- `scripts/bench/order-export/README.md` — contenu exact de `c1/c1.log`
  et `c1/c1-cd.log` recopié dans le document (fichiers restés ignorés par
  git).
- `tests/sql/gescom-e10-18d-order-export-recovery-net.sql` — scénario 3
  rendu indépendant des données existantes (fixture `started_at` +
  assertion ciblée `not in ('pending', 'running')`).
- `supabase/migrations/20260913010000_gescom_e10_18d_order_export_recovery_net.sql`
  — bloc de réversibilité aligné au caractère près sur l'original (4
  lignes, +1 espace chacune).
- `deno.lock` (racine) — 2 lignes ajoutées (`npm:fflate@0.8.3`,
  `npm:write-excel-file@4.1.1`), gardées après vérification qu'aucune
  version existante (`@supabase/supabase-js` notamment) n'a bougé.

## qa-review round 4 (2026-09-13) — REJETÉ sur une RÉGRESSION introduite par le passage à l'AST (round 3)

Tout le reste (garde `fflate`, mineurs, `deno.lock`, migration) jugé tenu.
Un commit `3860bb4e` (`docs/api/CONVENTIONS.md` seul) a été fait
entre-temps par le coordinateur : non touché.

### BLOQUANT — `hasRealImportMatching` ne reconnaissait pas les réexportations ni `import x = require(...)`

En corrigeant le round 3 (passage regex → AST), `hasRealImportMatching` ne
reconnaissait que `ImportDeclaration`, `import()` dynamique et
`require()`. Or une réexportation `export { default } from
'write-excel-file/universal'` (ou `export * from '...'`) CHARGE le module
visé à l'exécution exactement comme un `import ... from`, et n'était
pourtant PAS reconnue — régression : cette forme était détectée par le
motif regex du round 1/2, invisible après le passage à l'AST. Même défaut
pour l'ancienne syntaxe CJS `import x = require('...')`
(`ImportEqualsDeclaration`).

**Corrigé** : `hasRealImportMatching` reconnaît désormais aussi :
- `ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier`
  (couvre `export { x } from` ET `export * from`, à l'exclusion de
  `export type { x } from`, qui n'exécute jamais rien) ;
- `ts.isImportEqualsDeclaration(node) && !node.isTypeOnly &&
  ts.isExternalModuleReference(node.moduleReference)` (couvre
  `import x = require('...')`, à l'exclusion de `import type x =
  require('...')`).

**MOYEN corrigé dans le même passage** — le motif `git grep` de
présélection des candidats (`UNIVERSAL_IMPORT_GREP_PATTERN`) n'acceptait
que les guillemets droits, jamais l'accent grave : un
`` import(`write-excel-file/universal`) `` (gabarit de texte SANS
substitution, un `NoSubstitutionTemplateLiteral` que `ts.isStringLiteralLike`
reconnaît DÉJÀ comme spécificateur valide côté AST) ne rendait donc jamais
le fichier candidat — l'AST qui l'aurait pourtant détecté ne voyait jamais
le fichier. Motif étendu à `['"` + accent grave + `]`. **Effet de bord
découvert en testant ce correctif** : le motif contenant un accent grave,
interpolé dans une chaîne shell via `execSync` + `JSON.stringify` (qui ne
produit qu'un échappement style JS, pas un échappement shell), déclenchait
une SUBSTITUTION DE COMMANDE dans `/bin/sh -c` et cassait `git grep` sur
TOUS les appels, pas seulement ceux visant `/universal`. Corrigé en
remplaçant `execSync` (chaîne interpolée, shell) par `execFileSync`
(argument de processus, JAMAIS de shell) — la bonne pratique indépendamment
du bug de l'accent grave.

`.mts`/`.cts` routés explicitement par l'AST (même syntaxe de commentaire
que `.ts`) plutôt que par le comportement « tout candidat non `.ts`/`.tsx`
est un contrevenant », qui ne les couvrait que par accident.

### Preuves par mutation (fichiers sondes non suivis, supprimés après chaque test)

| Sonde | Contenu | Résultat attendu | Résultat observé |
|---|---|---|---|
| `src/qa_probe_u1.ts` | `export { default } from "write-excel-file/universal";` | test « aucun fichier » tombe | tombé — FAIT |
| `src/qa_probe_u2.ts` | `export * from "write-excel-file/universal";` | tombe | tombé — FAIT |
| `src/qa_probe_u3.ts` | `import wef = require("write-excel-file/universal"); export { wef };` | tombe | tombé — FAIT |
| `src/qa_probe_u4.ts` | `` import(`write-excel-file/universal`) `` (gabarit, dynamique) | tombe | tombé — FAIT |
| `src/qa_probe_u5.ts` | `import type { X } from "write-excel-file/universal";` | NE tombe PAS | vert — FAIT |
| `src/qa_probe_u5b.ts` | `export type { X } from "write-excel-file/universal";` | NE tombe PAS | vert — FAIT |
| `src/qa_probe_r2_1.ts` | `import x from "write-excel-file/universal";` (round 2, forme 1) | tombe (non-régression) | tombé — FAIT |
| `src/qa_probe_r2_2.ts` | `import 'write-excel-file/universal';` (effet de bord) | tombe | tombé — FAIT |
| `src/qa_probe_r2_3.ts` | `await import('write-excel-file/universal')` | tombe | tombé — FAIT |
| `src/qa_probe_r2_4.ts` | `require('write-excel-file/universal');` | tombe | tombé — FAIT |
| `src/qa_probe_r2_5.ts` | `export { x } from "write-excel-file/universal";` | tombe | tombé — FAIT |
| `src/qa_probe_r2_6.mts` | `import x from "write-excel-file/universal";` (`.mts`) | tombe | tombé — FAIT |
| `supabase/functions/qa_probe_r2_7/deno.json` | `{"imports": {"x": "npm:write-excel-file@4.1.1/universal"}}` | tombe | tombé — FAIT |
| `xlsx-renderer.ts`, mutation « bloc `/* */` » | `/* import 'fflate'; */` | test fflate tombe | tombé — FAIT, restauré (`diff` identique) |
| `xlsx-renderer.ts`, mutation « commentaire `//` » | `// import 'fflate';` | tombe | tombé — FAIT, restauré |
| `xlsx-renderer.ts`, mutation « import retiré » | ligne supprimée | tombe | tombé — FAIT, restauré (`diff` identique, 7/7 verts) |

Toutes les sondes ont été supprimées après leur test (`git status
--porcelain` confirmé vide de toute trace `qa_probe`).

### Gates rejouées

- `pnpm typecheck` — vert.
- `pnpm exec vitest run tests/architecture tests/modules/order-exports` —
  40 fichiers / 222 tests, vert.
- `pnpm test:architecture` — 35 fichiers / 153 tests, vert.

### Fichiers modifiés dans ce passage

- `tests/architecture/order-export-xlsx-library-boundaries.test.ts` —
  `hasRealImportMatching` étendu (`ExportDeclaration`,
  `ImportEqualsDeclaration`/`ExternalModuleReference`) ; motif `git grep`
  étendu à l'accent grave ; `execSync` remplacé par `execFileSync` ;
  `.mts`/`.cts` routés explicitement par l'AST.

## 2026-09-15 — Plafond abaissé à 2 500 (décision Arnaud, petit lot)

**Décision.** Arnaud active le générateur d'exports en production **sans**
avoir pu rejouer la porte d'activation hébergée à 5 000 lignes (la
production ne contient encore aucune commande — ce test ne peut donc pas y
être joué). `ORDER_EXPORT_ROW_LIMIT` passe de `5_000` à `2_500`, par
prudence. `5 000` reste la valeur MESURÉE tenable localement (§8.24 point
4) — elle n'est pas invalidée, elle n'a simplement jamais été vérifiée sur
la plateforme hébergée. La valeur pourra remonter jusqu'à 5 000 le jour où
cette mesure hébergée sera jouée, jamais avant.

**Fichiers modifiés.**
- `src/modules/order-exports/application/order-export-generation-service.ts`
  — `ORDER_EXPORT_ROW_LIMIT = 2_500` ; commentaire réécrit pour distinguer
  la valeur RETENUE (2 500, décision du jour) de la valeur MESURÉE tenable
  (5 000, inchangée).
- `src/modules/order-exports/application/order-export-run-repository.ts` —
  commentaire de `DEFAULT_ORDER_EXPORT_RUN_SETTINGS` aligné (renvoi vers la
  valeur retenue en production).
- `src/kernel/clock/timezone.ts` — commentaire du formateur civil mis en
  cache aligné (le plafond « sans correctif serait 2 000 » reste vrai et
  documente le plafond TENABLE, pas la valeur retenue).
- `tests/kernel/timezone.test.ts` — libellé du test aligné, aucune
  assertion modifiée (ce test ne porte pas sur `ORDER_EXPORT_ROW_LIMIT`).
- `tests/modules/order-exports/order-export-generation-service.test.ts` —
  l'assertion `ORDER_EXPORT_ROW_LIMIT` passe à `2_500` ; les deux tests de
  bord (plafond respecté / dépassé) sont réécrits de façon GÉNÉRIQUE
  (`pagesForRowCount(n)`), car l'ancien calcul (`ORDER_EXPORT_ROW_LIMIT /
  1000`) supposait à tort un plafond multiple de 1000 — vrai pour 5 000,
  faux pour 2 500. Nouveaux bords vérifiés : 2 500 lignes acceptées, 2 501
  refusées en `order_export.row_limit_exceeded` (« resserrez la période »),
  AVANT tout appel au renderer.
- `scripts/bench/order-export/README.md` — une ligne ajoutée précisant que
  la valeur EN VIGUEUR en production est 2 500 depuis le 2026-09-15 ;
  aucune donnée de mesure du banc n'est modifiée (les mesures restent
  vraies pour 5 000, valeur qui n'a pas été rejouée).

**Preuve par mutation** (fichier de test ci-dessus) : `ORDER_EXPORT_ROW_LIMIT`
remis à `5_000` dans le service → le test qui verrouille la valeur en
vigueur tombe (`expected 5000 to be 2500`), les 10 autres tests du fichier
restent verts ; valeur restaurée à `2_500` → 11/11 verts.

**Non touché, par choix, avec justification** : `xlsx-renderer.ts` et
`tests/modules/order-exports/xlsx-renderer.volume.test.ts` contiennent des
mentions de « 5 000 lignes », mais elles décrivent un seuil TECHNIQUE
indépendant (le point de bascule Worker de `fflate`, mesuré à ~2 000
lignes côté bibliothèque zip) — un volume de test délibérément choisi
au-dessus de ce seuil pour le mettre en défaut, jamais le plafond métier
`ORDER_EXPORT_ROW_LIMIT`. Aucune modification.

**Gates rejouées** : `pnpm typecheck` ; `pnpm exec vitest run
tests/modules/order-exports tests/server/api tests/architecture` ;
`pnpm test:contract` ; `pnpm test:architecture` ; `deno check` sur
`magrit-order-export-runner`, `magrit-api`, `magrit-order-file-purge`.
