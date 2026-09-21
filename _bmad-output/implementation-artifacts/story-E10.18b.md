---
id: E10.18b
epic: E10 — Gestion commerciale
status: ready-for-qa-review (round 2 — corrections B1/B2 + catalogue appliquees)
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.0, E10.12, E10.13, E10.16, E10.18a]
blocks: [E10.18c]
---
# E10.18b — Export XLSX/CSV des commandes : « le jeu de données, et rien qui le lise »

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

Deuxième des six lots d'E10.18. Cadrage déjà écrit par l'architecte
(`docs/api/CONVENTIONS.md` §8.24, point 4 pour le schéma de données et les
trois arbitrages de colonnes, point 5 pour les règles opposables sur
montants/dates/fuseau, point 6 pour le domicile du code, ligne E10.18b du
point 8 pour le périmètre exact). `openapi/magrit-core.v1.yaml` et
`docs/api/CONVENTIONS.md` **non modifiés par cet agent** — vérifié par
`git status` (aucun fichier sous `openapi/` ni `docs/api/` dans le diff de
ce lot) et par `pnpm gen:api:check`, vert avant et après.

**Ce lot ne produit délibérément aucun fichier applicatif** : deux vues SQL
et leurs tests. Aucune table, aucune fonction d'accès, aucun endpoint, aucun
renderer, aucune UI — `api_read_order_export_rows` est explicitement
**descendue en (c)** par la CINQUIÈME CORRECTION du cadrage du 2026-09-12
(elle résout le tenant depuis `commercial_order_exports`, table qui n'existe
pas encore).

## Ce qui a été livré

1. **`supabase/migrations/20260912000400_gescom_e10_18b_order_export_views.sql`**
   — deux vues dans le schéma `private` (déjà créé et déjà revoke de
   `public, anon, authenticated` par `20260816000300`, non recréé ici) :
   - `private.commercial_order_export_headers` — une ligne par commande.
   - `private.commercial_order_export_lines` — une ligne par ligne de
     commande.

   Même précédent suivi à l'identique que `private.legacy_shop_customer_
   migration_plan` (une **vue**, comme ici) : `revoke all on <vue> from
   public, anon, authenticated;`, aucun grant ajouté nulle part (pas même à
   `service_role` — voir plus bas). `private.commercial_order_totals_at_
   conversion` reste un précédent valide pour la **discipline de revoke**,
   mais **correction round 2** : c'est une **fonction** `security definer`,
   pas une vue — les deux mentions du dépôt qui la citaient comme précédent
   de vue (cette migration et ce document) sont corrigées.

2. **`tests/sql/gescom-e10-18b-order-export-views.sql`** — sept scénarios
   (six + le 4bis, plus les extensions round 2 des scénarios 1/4/5a/5d),
   ajouté à `scripts/test-storefront-sql.sh`. Exécuté réellement contre
   Supabase local (voir « Gates »).

## Le catalogue de colonnes — fixé dans ce lot, documenté en tête de migration

Le cadrage n'énumère pas de liste littérale de colonnes (il donne des
arbitrages sur des colonnes précises — PU HT indicatif, statut en deux
colonnes, aucun total répété à la ligne, interlocuteur gardé même vide —
mais pas un catalogue complet ordonné). Ce lot le fixe, dans le respect
strict de ces arbitrages, et le documente en tête de la migration pour que
personne n'ait à le reconstituer :

- Deux colonnes **techniques**, jamais exportées (`tenant_id`, `order_id`,
  et `line_id` pour `_lines`) : réservées au futur chemin de lecture par clé
  (E10.18c, « lecture par pages sur clé »).
- **Dix colonnes partagées** (huit à l'origine, **étendues à dix en round 2
  qa-review**), dans le même ordre, entre `_headers` et `_lines` (arbitrage
  colonne 3 étendu : « les colonnes partagées des deux jeux sont
  identiques ») : `order_number`, `quote_number`, `order_created_at`,
  `customer_type`, `customer_name`, `customer_siret`, `customer_vat_number`,
  `customer_contact_name`, `order_status`, `production_step_label` — toutes
  des colonnes d'**identification**, jamais des totaux, donc sans risque à
  répéter sur chaque ligne. `quote_number` (déplacé depuis `_headers` seule)
  et `customer_vat_number` (nouvelle, `customers.vat_number`) sont les deux
  ajouts round 2 — voir section dédiée ci-dessous.
- `_headers` ajoute ensuite les huit totaux figés (`lines_subtotal`,
  `global_discount`, `effective_discount_rate`, `net_total`, `vat_rate`,
  `vat_regime`, `vat_amount`, `total_incl_tax`).
- `_lines` ajoute ensuite `line_position`, `line_label`, `quantity`,
  `bracket_amount_excl_tax` (« Montant HT barème (avant remise) », **renommé
  round 2** depuis `customer_price`/« Prix client barème HT »),
  `discount_rate` (« Taux de remise ligne »), `unit_price_indicative` (« PU
  HT indicatif », 4 décimales), puis **immédiatement à sa droite**
  `sale_price` (« Montant HT », la grandeur qui fait foi) — ordre imposé par
  l'arbitrage colonne 1, disposition (ii) du contrat.
- **Codes techniques bruts, traduction hors périmètre** : `customer_type`
  (`company`/`individual`) et `vat_regime` (`metropole_fr`/...) sortent
  **littéralement** de ces deux vues. C'est **volontaire** (une vue qui
  traduit présente, donc porte une seconde vérité) et **opposable au lot
  (c)** : le générateur de cellule qui consommera ces vues DOIT traduire ces
  deux colonnes avant remise au comptable. Exigence écrite explicitement en
  commentaire de la migration (`20260912000400`, bloc catalogue) pour ne pas
  être oubliée.

**Dérogation R5 à signaler explicitement** : ce catalogue (noms de colonnes,
ordre exact au-delà des colonnes partagées) est une décision de `dev-story`,
faute d'énumération littérale dans le cadrage transmis. Elle respecte tous
les arbitrages écrits (colonnes 1, 2, 3, interlocuteur, colonnes partagées,
aucun total à la ligne), mais l'intitulé français exact de chaque en-tête et
l'ordre fin des colonnes propres à chaque granularité n'ont **pas** été vus
par Arnaud. Les **quatre corrections de catalogue du round 2** (TVA client,
devis en ligne, renommage `bracket_amount_excl_tax`), elles, **ont** été
présentées à Arnaud et validées (« gère au mieux ») — seul l'intitulé
français exact et l'ordre fin restent sous la même dérogation R5. **Chemin
de mise en conformité** : `qa-review` vérifie la cohérence avec le cadrage ;
si un intitulé doit changer, c'est un changement de vue SQL (pas de
migration de données) et le mécanisme `layout_version` — prévu pour
exactement ce cas — absorbera le changement au lot (c)/(e) sans casser ce
lot-ci.

## Ce que ce lot prouve, et ce qu'il ne prouve pas (repris du cadrage, vérifié)

- **PROUVE l'inaccessibilité** : ni `anon`, ni `authenticated`, **ni même
  `service_role`** ne peuvent `select` sur les deux vues aujourd'hui.
  Vérifié en base (scénario 1 du test SQL, **étendu round 2** aux trois
  rôles sur les **deux** vues — voir mineur ACL ci-dessous) : tous échouent
  en `insufficient_privilege` (42501). **Reformulation round 2** (qa-review
  a signalé un déséquilibre de méthode dans la version round 1) : ce n'est
  **pas** « plus strict que la lettre du cadrage », c'est **exactement** la
  discipline déjà en place et vérifiée en base pour
  `private.legacy_shop_customer_migration_plan` — jamais grantée, pas même à
  `service_role`. Ce lot ne pose **aucun** grant parce que le schéma
  `private` n'a jamais reçu d'`alter default privileges` (contrairement à
  `public`, cf. `20260819000100_service_role_table_grants.sql`, qui ne
  porte que sur `public`) et que le seul accès prévu,
  `api_read_order_export_rows` (E10.18c), sera `security definer` — il
  s'exécutera avec les privilèges de son **propriétaire**, jamais avec ceux
  du rôle appelant, donc n'a besoin d'aucun grant sur la vue.
- **PROUVE que la matière de l'isolation est saine** : `tenant_id` présent,
  jamais nul (scénario 4bis, désormais sur `order_cross` aussi en
  granularité lignes), et **valant le tenant de la commande** — vérifié par
  une commande insérée directement avec un `customer_id` pointant vers un
  client d'un **autre** tenant (donnée délibérément aberrante, scénario 4,
  **round 2 : `order_cross` porte désormais une ligne de commande**, la
  vérification porte sur `commercial_order_export_headers` **et**
  `commercial_order_export_lines`) : la colonne `tenant_id` rendue reste
  celle de la commande, jamais celle du client joint, sur les deux vues. Les
  jointures ne font traverser aucune ligne d'un tenant à l'autre — vérifié
  avec deux tenants aux données **volontairement voisines** (même raison
  sociale « E10.18b Client Frontière » dans les deux tenants, SIRET
  distincts, scénario 3) : le SIRET rendu pour chaque commande est bien
  celui du client de **son** tenant. Les jointures ne multiplient aucune
  ligne — une commande à trois lignes rend exactement trois lignes en
  granularité `lines` et un seul rang en granularité `headers` (scénario 2,
  **round 2 : `customer_company_a` porte désormais deux interlocuteurs**,
  ce qui rend le scénario capable d'attraper un fan-out sur
  `customer_contacts` — voir « qa-review round 1 » ci-dessous).
- **NE PROUVE PAS l'isolation de tenant au sens du filtrage.** Aucun
  scénario n'écrit de `where tenant_id = ...` pour ensuite le vérifier —
  documenté explicitement en tête du fichier de test. Cette preuve
  appartient à E10.18c, avec `api_read_order_export_rows`.

## Cas de test exigés par le cadrage (ligne E10.18b du point 8) — tous couverts

| Cas exigé | Scénario du test SQL |
|---|---|
| Bornes de fuseau aux deux bords d'un mois | 6 — mêmes instants que le contrat et qu'E10.18a (`2026-08-31T22:30:00Z`, `2026-09-30T22:30:00Z`) ; la vue ne déforme pas l'instant brut, et une bucketisation Europe/Paris calculée **uniquement dans le test** place chaque bord dans le bon mois civil |
| Client `company` vs `individual` | 5a |
| Remise ligne vs remise globale | 5c |
| Interlocuteur nul | 5b (`order_2`) |
| Commande sans étape de production | 5b (`order_2`) |
| PU HT indicatif — quantité non divisible (`1000,00 ÷ 3`) | 5d → `333.3333`, `sale_price` reste `1000.00` |
| PU HT indicatif — grand tirage à prix unitaire faible (`90,00 ÷ 1000`) | 5d → `0.0900` |

## Gates exécutées, chiffres réels

- `pnpm gen:api:check` → **vert**, aucune dérive (`openapi/` non touché).
- `pnpm typecheck` → **vert** (aucun TypeScript dans ce lot).
- `pnpm test:architecture` → **vert**, **146 tests, 34 fichiers** (inchangé
  par rapport à l'état de remise du cadrage — ce lot ne touche aucun
  fichier gardé par ces tests).
- `pnpm test:contract` → **vert**, **416 tests, 22 fichiers** (inchangé —
  aucune route créée ou modifiée par ce lot).
- **Test SQL exécuté réellement**, pas seulement relu : `pnpm db:local:reset`
  a réappliqué toutes les migrations dans l'ordre, **y compris la version
  corrigée, sans erreur**. `tests/sql/gescom-e10-18b-order-export-views.sql`
  exécuté individuellement via
  `docker exec -i supabase_db_magritoff-v5 psql -v ON_ERROR_STOP=1 -U postgres -d postgres`
  : **sept scénarios (1, 2, 3, 4, 4bis, 5a-5d, 6), tous `NOTICE ... OK`, zéro
  exception**.
- **Preuves de mutation exigées par qa-review round 1 (B1 et B2), exécutées
  réellement** — voir section dédiée ci-dessous pour le détail : les deux
  mutations font échouer le test correspondant, et le test repasse au vert
  une fois la mutation retirée.
- `pnpm test:storefront:sql` (suite complète) : **échoue dès le premier
  fichier de la liste**, `tests/sql/storefront-session-lifecycle.sql`
  (`Utilisateur Auth requis pour le scénario UM2.6` — ce cas exige un
  `auth.users` préexistant que `db reset` + `seed.sql` ne fournissent pas
  dans cet environnement). C'est un défaut d'environnement **antérieur et
  sans rapport** avec ce lot (le premier fichier de la liste, exécuté avant
  que la suite n'atteigne quoi que ce soit touché par E10.18b) — distinct du
  défaut `legacy-shop-only-write-freeze.sql` signalé par le mandat, mais de
  même nature (état de seed local incomplet). Non traité ici, hors
  périmètre. **Mon fichier, seul, s'exécute sans erreur** (ci-dessus), ce
  qui est la vérification que ce lot doit produire.

## Critères d'acceptation — vérifiables un par un

Ce lot n'a pas de CA numérotés propres (il exécute la ligne E10.18b du
tableau de découpage, point 8). Reprise de cette ligne, terme à terme :

1. **Les deux vues existent, dans `private`** — fait : `private.
   commercial_order_export_headers` / `private.commercial_order_export_
   lines`, créées par la migration `20260912000400`.
2. **Le catalogue de colonnes est figé** — fait : documenté en tête de
   migration, voir section dédiée ci-dessus (avec la dérogation R5 sur les
   intitulés exacts, non vus par Arnaud ; les quatre corrections de fond du
   round 2, elles, ont été validées par Arnaud).
3. **Les tests SQL couvrent inaccessibilité / matière de l'isolation /
   jointures sans traversée ni multiplication / cas de données exigés** —
   fait, sept scénarios, tous exécutés réellement et verts (voir ci-dessus),
   **et round 2 : les propriétés « aucune multiplication » (scénario 2) et
   « tenant_id vient de la commande » (scénario 4) sont désormais prouvées
   capables d'échouer** (mutation exécutée, constatée, retirée — voir
   section « qa-review round 1 » ci-dessous), ce que le round 1 ne pouvait
   pas démontrer.
4. **`api_read_order_export_rows` n'est pas ici** — fait : aucune fonction
   d'accès, aucune table, aucun fichier applicatif produit par ce lot (`git
   status` : deux fichiers créés, tous deux sous `supabase/migrations/` et
   `tests/sql/`, plus l'ajout d'une ligne dans `scripts/test-storefront-
   sql.sh`).
5. **Aucun débordement sur (a)/(c)/(d)/(e)/(f)** — fait : aucun fichier de
   `src/modules/order-exports/`, `src/adapters/`, `src/server/api/order-
   export*`, `supabase/functions/magrit-order-export-runner/` n'a été créé.

## qa-review round 1 — rejeté sur B1/B2, corrigé

Le lot round 1 a été **rejeté**. Motif : deux propriétés que le cadrage
exige (« aucune multiplication de ligne par une jointure », « `tenant_id`
vaut le tenant de la commande ») étaient **écrites mais structurellement
incapables d'échouer**, faute d'un jeu de données assez exigeant pour les
mettre en tension. La revue a muté les vues, rejoué la suite, constaté
qu'elle restait verte sur des vues cassées.

### BLOQUANT B1 — corrigé

**Défaut** : `customer_company_a` ne portait qu'**un seul**
`customer_contacts`. Une jointure fautive `cc.id = o.customer_id` (fan-out
sur `customer_id` au lieu de `cc.id = o.customer_contact_id`, la clé
primaire) ne pouvait rien multiplier dans ce jeu de données — le scénario 2
restait vert.

**Correction** : un **second** `customer_contacts` (« Sophie Martin »), non
primaire, non référencé par aucune commande, ajouté sur `customer_company_a`
(`tests/sql/gescom-e10-18b-order-export-views.sql`, insertion juste après le
premier contact).

**Preuve de mutation, exécutée réellement** :
1. Mutation appliquée à la migration (`_lines`) :
   `on cc.id = o.customer_contact_id` → `on cc.customer_id = o.customer_id`.
2. `pnpm db:local:reset` puis exécution du test :
   **échec constaté** — `scenario 2 : 6 ligne(s) rendue(s) pour order_1,
   attendu exactement 3 — une jointure duplique des lignes` (3 lignes × 2
   interlocuteurs = 6, exactement le fan-out prédit par la revue).
3. Mutation retirée (fichier restauré à l'identique, vérifié par `diff`).
4. `pnpm db:local:reset` puis exécution du test : **succès constaté** —
   sept scénarios `NOTICE ... OK`, zéro exception.

### BLOQUANT B2 — corrigé

**Défaut** : `order_cross` (commande du tenant A, `customer_id` pointant
vers un client du tenant B) n'avait **aucune ligne de commande**. Le
scénario 4 ne pouvait donc interroger que
`commercial_order_export_headers` ; une mutation de `_lines` lisant
`c.tenant_id` au lieu de `o.tenant_id` restait invisible.

**Correction** : une ligne de commande (« Marque-pages », `source_quote_
line_id` porté par un devis-véhicule dédié `v_qline_cross`) ajoutée sur
`order_cross`. Scénario 4 étendu pour vérifier `tenant_id` sur
`commercial_order_export_lines` en plus de `commercial_order_export_
headers` ; scénario 4bis étendu pour couvrir aussi cette ligne. Totaux
d'entête de `order_cross` mis à jour en cohérence (25,00 HT / 5,00 TVA /
30,00 TTC) pour ne pas reproduire le défaut mineur signalé sur `order_2`
(voir plus bas).

**Preuve de mutation, exécutée réellement** :
1. Mutation appliquée à la migration (`_lines`) : `o.tenant_id as tenant_id`
   → `c.tenant_id as tenant_id`.
2. `pnpm db:local:reset` puis exécution du test : **échec constaté** —
   `scenario 4 : tenant_id (lignes) rendu = <tenant B>, attendu le tenant de
   LA COMMANDE (tenant A = <tenant A>) — la vue LIGNES lit le tenant d'une
   table jointe`.
3. Mutation retirée (fichier restauré à l'identique, vérifié par `diff`).
4. `pnpm db:local:reset` puis exécution du test : **succès constaté**.

### Catalogue de colonnes — quatre corrections appliquées

Voir section dédiée en tête de document et commentaires de la migration
`20260912000400` : numéro de TVA client (`customer_vat_number`) et numéro
de devis (`quote_number`) ajoutés au bloc partagé (testés aux deux
granularités, scénarios 5a et 5d) ; `customer_price` renommé
`bracket_amount_excl_tax` (« Montant HT barème (avant remise) ») ; exigence
de traduction des codes techniques écrite en commentaire de migration et
opposable au lot (c).

### Tracé sans correction (mandat)

- **M2** : `tests/sql/gescom-e10-18b-order-export-views.sql` reste en
  **dernière** position de `SQL_CASES` dans `scripts/test-storefront-sql.sh`
  ; `pnpm test:storefront:sql` échoue **dès le premier fichier**
  (`storefront-session-lifecycle.sql`, `auth.users` absent après reset).
  Confirmé à nouveau ce round : mon fichier n'est jamais atteint par la
  gate complète. Défaut d'environnement antérieur, hors périmètre de ce
  lot.
- **Mineur ACL** : corrigé (voir plus haut, scénario 1 étendu à `anon` et
  `service_role` sur `_lines`).
- **Mineur précédent mal nommé** : corrigé — la migration et ce document ne
  citent plus `private.commercial_order_totals_at_conversion` comme
  précédent de *vue* ; c'est une *fonction*, la discipline de `revoke` reste
  l'argument valide.
- **Mineur fixture `order_2`** : corrigé — `lines_subtotal`/`net_total`/
  `vat_amount`/`total_incl_tax` ramenés à `0.00`, cohérents avec l'absence
  de ligne.

## Fichiers créés / modifiés

- `supabase/migrations/20260912000400_gescom_e10_18b_order_export_views.sql`
  (créé round 1, **corrigé round 2** : catalogue étendu, colonne renommée,
  commentaires reformulés)
- `tests/sql/gescom-e10-18b-order-export-views.sql` (créé round 1,
  **corrigé round 2** : B1, B2, ACL, assertions catalogue, fixtures)
- `scripts/test-storefront-sql.sh` (modifié round 1 — une ligne ajoutée à
  `SQL_CASES` — inchangé round 2)
- `_bmad-output/implementation-artifacts/story-E10.18b.md` (ce document)

Aucun fichier `openapi/`, `docs/api/`, `src/` ni `package.json` touché.
