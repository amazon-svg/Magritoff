---
id: E10.18
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c812e9a64c38bb31b5add
---
# E10.18 — Export XLSX et CSV des commandes pour la comptabilité

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.18 — Export XLSX et CSV des commandes pour la comptabilité](https://app.notion.com/p/3cad0131973c812e9a64c38bb31b5add) · extrait le 17/09/2026 · page modifiée le 15/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

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

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Lots développés sous leur propre story document

- [E10.18a](story-E10.18a.md)
- [E10.18b](story-E10.18b.md)
- [E10.18c](story-E10.18c.md)
- [E10.18d](story-E10.18d.md)
- [E10.18e-1](story-E10.18e-1.md)
- [E10.18e-2](story-E10.18e-2.md)

### Fichiers du dépôt qui citent E10.18

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-E10.18a.md`
- `_bmad-output/implementation-artifacts/story-E10.18b.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/STORY_DOCUMENT_STANDARD.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/modules/order-exports/api/contracts.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `supabase/migrations/20260901000300_gescom_e10_4_customers.sql`
- `supabase/migrations/20260913000000_gescom_e10_18c_order_exports.sql`
