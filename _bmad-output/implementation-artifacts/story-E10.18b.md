---
id: E10.18b
epic: E10 — Gestion commerciale
status: ready-for-qa-review (round 2 — corrections B1/B2 + catalogue appliquees)
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.0, E10.12, E10.13, E10.16, E10.18a]
blocks: [E10.18c]
---
# E10.18b — Export XLSX/CSV des commandes : « le jeu de données, et rien qui le lise »

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
