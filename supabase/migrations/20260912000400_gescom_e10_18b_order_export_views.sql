-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.18b : « le jeu de donnees, ET RIEN
-- QUI LE LISE » — deux vues PRIVEES pour l export comptable des commandes.
-- Contrat : docs/api/CONVENTIONS.md §8.24, points 4/5/6/8 (ligne E10.18b).
-- ----------------------------------------------------------------------------
-- CE QUE CE LOT FAIT, ET RIEN D AUTRE :
--
--   Deux vues dans le schema `private` (NON expose par PostgREST, deja cree
--   et deja revoke de public/anon/authenticated par
--   `20260816000300_private_storefront_credentials_sessions.sql` — ce lot ne
--   recree pas le schema) :
--     - private.commercial_order_export_headers — une ligne PAR COMMANDE ;
--     - private.commercial_order_export_lines    — une ligne PAR LIGNE DE
--       COMMANDE.
--
--   Precedent suivi a l identique : private.legacy_shop_customer_migration_plan
--   (20260817000700, une VUE) et private.commercial_order_totals_at_conversion
--   (20260908010000 — une FONCTION `security definer`, PAS une vue ; corrige
--   ici suite a qa-review round 1, l objet differe mais la discipline de
--   `revoke` est identique) — meme schema `private` non expose dans les deux
--   cas.
--
--   AUCUNE fonction d acces (`api_read_order_export_rows` N EST PAS ICI —
--   elle resout le tenant depuis `commercial_order_exports`, table qui NAIT
--   EN (c), motif complet au point 4 du contrat, CINQUIEME CORRECTION du
--   2026-09-12). AUCUN fichier, AUCUNE table, AUCUN endpoint, AUCUN
--   renderer, AUCUNE UI.
--
-- ----------------------------------------------------------------------------
-- CE QUE CE LOT PROUVE, ET CE QU IL NE PROUVE PAS (contrat, point 4) :
--
--   - PROUVE l INACCESSIBILITE : ni `anon`, ni `authenticated`, ni MEME
--     `service_role` ne peuvent `select` sur ces vues aujourd hui (schema
--     `private` non expose par PostgREST + `revoke all ... from public, anon,
--     authenticated` ci-dessous, qui NE MENTIONNE PAS `service_role` — donc ne
--     lui accorde rien). CORRECTION qa-review round 1 : ce n est PAS "plus
--     strict que la lettre du cadrage", c est EXACTEMENT la discipline deja
--     en place pour `private.legacy_shop_customer_migration_plan`, jamais
--     grantee a `service_role` non plus et lue uniquement depuis une fonction
--     `security definer` (meme mecanisme prevu pour
--     `api_read_order_export_rows`, E10.18c : elle s executera avec les
--     privileges de son PROPRIETAIRE, jamais avec ceux du role appelant, donc
--     n a besoin d aucun grant sur la vue).
--   - PROUVE que la MATIERE de l isolation est saine : `tenant_id` est
--     PRESENT, JAMAIS NUL, et vaut le tenant de LA COMMANDE
--     (`commercial_orders.tenant_id`) — jamais celui d une table jointe
--     (client, devis) ; les jointures NE FONT TRAVERSER aucune ligne d un
--     tenant a l autre ; et elles NE MULTIPLIENT aucune ligne (chaque
--     jointure ci-dessous se fait sur une CLE PRIMAIRE ou une colonne
--     `unique` de la table jointe, donc au plus UNE ligne correspondante :
--     `commercial_orders.quote_id` est `unique` vers `commercial_quotes`,
--     `customer_id`/`customer_contact_id`/`current_production_step_id`
--     pointent chacun vers une cle primaire).
--   - NE PROUVE PAS l isolation de tenant au sens du FILTRAGE : il n y a rien
--     a filtrer puisqu il n y a rien qui lit. Cette preuve appartient a (c),
--     avec `api_read_order_export_rows`. Le cas SQL de ce lot ne pose donc
--     AUCUN test qui ecrirait lui-meme un `where tenant_id = ...` pour
--     ensuite le verifier — ce serait tester sa propre clause, pas le
--     produit (avertissement explicite du contrat).
--
-- ----------------------------------------------------------------------------
-- LE CATALOGUE DE COLONNES — fige ICI, PAS publie en enumeration (§8.24
-- point 2 : "aucun catalogue de colonnes en enumeration — la liste est fixe,
-- la publier en enum laisserait croire qu un appelant la choisit").
--
-- Deux colonnes TECHNIQUES en tete de chaque vue (tenant_id, order_id, et
-- line_id pour `_lines`) : JAMAIS exportees dans le fichier remis au
-- comptable, reservees au futur chemin de lecture pagine par cle (E10.18c,
-- "lecture par pages sur cle (p_after)").
--
-- CORRECTIF qa-review round 1 (4 corrections de catalogue, validees par
-- Arnaud) — le bloc PARTAGE passe de HUIT a DIX colonnes :
--   1. Numero de TVA du client (`customer_vat_number`, `customers.
--      vat_number`) AJOUTE dans le bloc partage, a cote de `customer_siret` :
--      oublie au premier jet alors que le CA4 de la fiche client (E10.4)
--      l exige nommement et que la donnee existe deja. Sans elle un
--      comptable qui facture en intra-UE ressaisit a la main.
--   2. Numero de devis d origine (`quote_number`) DEPLACE de "propre a
--      `_headers`" vers le bloc PARTAGE : c est le detail LIGNE que le
--      comptable recoit (le cahier de tests Notion s intitule "export XLSX
--      des commandes au detail ligne"), et un numero de devis est une
--      colonne d IDENTIFICATION comme `order_number` deja repete a la ligne
--      — pas un total, donc rien de l arbitrage "aucun total repete a la
--      ligne" ne s y oppose.
--   3. `customer_price` RENOMME `bracket_amount_excl_tax` ("Montant HT
--      bareme (avant remise)") — voir justification detaillee plus bas,
--      section `_lines`.
--   4. Traduction des codes techniques (`customer_type`: company/individual,
--      `vat_regime`: cinq valeurs + le cas nul) : EXPLICITEMENT HORS
--      PERIMETRE ICI — voir avertissement en fin de bloc, qui en donne la
--      liste exhaustive.
--
-- DIX colonnes PARTAGEES, DANS LE MEME ORDRE, entre `_headers` et `_lines`
-- (etend l arbitrage colonne 3 du contrat, "les huit premieres colonnes des
-- deux jeux sont identiques", aux deux colonnes ajoutees ci-dessus — ce sont
-- toutes des colonnes d IDENTIFICATION, jamais des totaux, donc sans risque a
-- repeter sur chaque ligne d une meme commande) :
--   1.  order_number            — Numero de commande
--   2.  quote_number            — Numero de devis d origine (deplace ici,
--       correction 2 ci-dessus ; `commercial_orders.quote_id` est `not null
--       unique` (E10.12), la jointure vers `commercial_quotes` est donc un
--       `join` normal, jamais nulle, jamais multipliante)
--   3.  order_created_at        — Date de commande (timestamptz BRUT, UTC ;
--       AUCUNE conversion de fuseau ici — meme discipline que
--       `list_commercial_orders_by_production_step`, "cette fonction ne
--       connait aucun fuseau" (E10.18a) : la resolution Europe/Paris et le
--       formatage de cellule sont un souci du GENERATEUR, pas de la vue)
--   4.  customer_type           — Type de client (`company`/`individual`) —
--       CODE TECHNIQUE BRUT, voir avertissement de traduction ci-dessous
--   5.  customer_name           — Client (raison sociale, ou nom complet)
--   6.  customer_siret          — SIRET (nul pour un particulier)
--   7.  customer_vat_number     — Numero de TVA intracommunautaire du client
--       (AJOUTE, correction 1 ci-dessus ; `customers.vat_number`, nullable —
--       non tous les clients n en ont un, en particulier `individual`)
--   8.  customer_contact_name   — Interlocuteur (nullable — arbitrage Arnaud
--       (i) : GARDEE MEME VIDE, une macro comptable se casse quand une
--       colonne APPARAIT plus tard)
--   9.  order_status            — Statut commercial (arbitrage colonne 2) —
--       CODE TECHNIQUE BRUT, voir avertissement de traduction ci-dessous
--   10. production_step_label   — Etape de production (nullable — arbitrage
--       colonne 2 : deux colonnes, jamais fondues, invariant tenu depuis
--       E10.13)
--
-- ⚠️ EXIGENCE OPPOSABLE AU LOT (c) — TRADUCTION DES CODES TECHNIQUES :
-- `customer_type` et `vat_regime` SORTENT BRUTS de ces deux vues. Ce lot les
-- laisse volontairement tels quels : une vue qui traduit est une vue qui
-- PRESENTE, donc une seconde verite (la traduction est le travail du
-- GENERATEUR DE CELLULE, jamais de la source de donnees). LE LOT (c), qui
-- consommera ces vues pour produire le fichier remis au comptable, NE DOIT
-- PAS livrer une colonne "Type de client" affichant litteralement `company`,
-- ni un "Regime de TVA" affichant `metropole_fr`.
--
-- LA LISTE EXHAUSTIVE DES VALEURS A TRADUIRE, et elle est ici parce qu une
-- liste tronquee est le defaut meme que cette exigence existe pour empecher
-- (qa-review round 2) :
--   `customer_type`  : `company`, `individual`.
--   `vat_regime`     : `metropole_fr`, `dom_tom`, `franchise_tva`,
--                      `export_eu`, `export_world` — CINQ valeurs, PLUS le
--                      cas NUL (surcharge explicite prevue par le contrat,
--                      `CommercialOrderLine.vat_regime`).
-- Le jeu de fixtures de `tests/sql/gescom-e10-18b-order-export-views.sql` ne
-- contient que `metropole_fr` : un dev de (c) qui traduirait les seules
-- valeurs rencontrees en test laisserait passer `dom_tom` dans le fichier d
-- un imprimeur ultramarin, sans qu aucun test ne bronche. La source qui fait
-- foi reste la description de `vat_regime` dans `openapi/magrit-core.v1.yaml`
-- et le §8.24 : si un regime est ajoute, c est la qu il apparait d abord.
--
-- Puis les colonnes PROPRES a chaque granularite :
--
-- `_headers` (une commande = un total, jamais reparti sur les lignes) :
--   11. lines_subtotal          — Sous-total HT
--   12. global_discount         — Remise globale HT (SIGNEE : une majoration
--       est legitime, cf. E10.10a)
--   13. effective_discount_rate — Taux de remise effectif (nullable)
--   14. net_total               — Net HT
--   15. vat_rate                — Taux de TVA
--   16. vat_regime               — Regime de TVA (nullable) — CODE TECHNIQUE
--       BRUT, voir avertissement de traduction ci-dessus
--   17. vat_amount               — Montant TVA
--   18. total_incl_tax           — Total TTC
--   AUCUNE colonne "Total TTC" (ni aucun des huit totaux) sur `_lines` :
--   arbitrage colonne 3, "une colonne Total TTC recopiee sur les quatre
--   lignes d une meme commande se somme en quatre fois le TTC — le pire
--   genre d erreur qu un export puisse produire". La TVA n existe pas non
--   plus a la ligne (le taux est porte par l entete).
--
-- `_lines` (une ligne de commande) :
--   11. line_position            — Position (ordre dans la commande)
--   12. line_label                — Designation
--   13. quantity                  — Quantite
--   14. bracket_amount_excl_tax   — "Montant HT bareme (avant remise)" —
--       RENOMME depuis `customer_price` (correction 3 ci-dessus). Le contrat
--       (`openapi/magrit-core.v1.yaml`, `CommercialOrderLine.customer_price`)
--       est formel : c est un TOTAL pour `quantity`, pas un prix unitaire —
--       or "Prix client" ne le disait pas et la colonne siegeait entre
--       `quantity` et un PU HT, ce qui la faisait lire comme un prix
--       unitaire bareme. Dans ce catalogue, "Montant" est deja le marqueur
--       du total (cf. "Montant HT" = `sale_price`, "Montant TVA") et "Prix"
--       devient reserve a l unitaire (`unit_price_indicative`, "PU HT
--       indicatif") : le nouvel intitulé aligne le mot sur la grandeur.
--       Renommage aussi cote SQL (`customer_price` ->
--       `bracket_amount_excl_tax`) pour que le nom de colonne porte la meme
--       information que l intitule : "bracket" = le bareme/la tranche de
--       prix resolue par la regle, avant tout geste commercial de la
--       commande, "excl_tax" = HT (la TVA n existe qu a l entete). La
--       verification par difference voulue par le contrat
--       (`bracket_amount_excl_tax - sale_price` = remise en valeur, ex.
--       1100,00 - 1000,00 = 100,00) en sort renforcee : les deux grandeurs
--       comparees portent enfin le meme mot ("Montant").
--   15. discount_rate             — Taux de remise ligne (nullable, signe)
--   16. unit_price_indicative     — "PU HT indicatif", Montant HT / Quantite,
--       ARRONDI A QUATRE DECIMALES (arbitrage Arnaud du 2026-09-12, reserve
--       (c) : "sous 0,50 €/unite est la norme du metier, pas l exception").
--       `round()` PostgreSQL sur `numeric` arrondit "au plus proche, demi
--       vers le haut" pour toute valeur NON NEGATIVE (round half away from
--       zero == round half up quand le signe est positif) — exactement la
--       regle d arrondi arbitree, et `sale_price >= 0`/`quantity > 0` sont
--       deja garantis par les CHECK de `commercial_order_lines` (E10.12).
--       NON TYPEE `numeric(6,4)` (Rate, borne a ±100) : la valeur peut
--       depasser cette borne pour un petit tirage a prix unitaire eleve —
--       seul le NOMBRE DE DECIMALES (4) rejoint la famille des taux, jamais
--       la borne. "Montant HT" reste la SEULE valeur qui fait foi ; cette
--       colonne est INDICATIVE, elle ne se somme ni ne se remultiplie
--       exactement (ecart residuel borne par quantite x 0,00005).
--   17. sale_price                — Montant HT (grandeur qui fait foi,
--       IMMEDIATEMENT A DROITE de la colonne indicative — arbitrage colonne
--       1, disposition (ii) : "la grandeur qui fait foi est toujours dans
--       le champ de vision")
--
-- Deux exemples arbitres, VERIFIES PAR CE LOT (test SQL) :
--   - 1000,00 / 3   -> PU HT indicatif 333,3333 (ecart residuel : la ligne
--     ne remultiplie qu a 999,9999, jamais 1000,00 — attendu, documente)
--   - 90,00 / 1000  -> PU HT indicatif 0,0900 (le cas qui a fait basculer
--     l arbitrage de 1 a 4 decimales : a 1 decimale, 0,1 ; a 0, 0,0 — les
--     deux vides de sens sur un tirage tres courant chez un imprimeur)
-- ============================================================================

-- ── 1. Vue ENTETE — une ligne par commande ─────────────────────────────────
create or replace view private.commercial_order_export_headers as
select
  -- Colonnes TECHNIQUES — jamais exportees, reservees au futur chemin de
  -- lecture (E10.18c). tenant_id vaut CELUI DE LA COMMANDE.
  o.tenant_id                as tenant_id,
  o.id                       as order_id,

  -- ── Les DIX colonnes partagees avec commercial_order_export_lines ────────
  -- (qa-review round 1 : quote_number et customer_vat_number REJOIGNENT le
  -- bloc partage, voir catalogue en-tete de migration, corrections 1 et 2)
  o.number                   as order_number,
  q.number                   as quote_number,
  o.created_at               as order_created_at,
  c.type                     as customer_type,
  case
    when c.type = 'company' then c.company_name
    else btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
  end                        as customer_name,
  c.siret                    as customer_siret,
  c.vat_number               as customer_vat_number,
  case
    when cc.id is not null
      then btrim(coalesce(cc.first_name, '') || ' ' || coalesce(cc.last_name, ''))
    else null
  end                        as customer_contact_name,
  o.status                   as order_status,
  ps.label                   as production_step_label,

  -- ── Colonnes propres a l entete ───────────────────────────────────────────
  o.lines_subtotal           as lines_subtotal,
  o.global_discount          as global_discount,
  o.effective_discount_rate  as effective_discount_rate,
  o.net_total                as net_total,
  o.vat_rate                 as vat_rate,
  o.vat_regime               as vat_regime,
  o.vat_amount               as vat_amount,
  o.total_incl_tax           as total_incl_tax
from public.commercial_orders o
join public.customers c
  on c.id = o.customer_id
join public.commercial_quotes q
  on q.id = o.quote_id
left join public.customer_contacts cc
  on cc.id = o.customer_contact_id
left join public.production_steps ps
  on ps.id = o.current_production_step_id;

comment on view private.commercial_order_export_headers is
  'E10.18b — jeu de donnees ENTETE (une ligne par commande) de l export comptable, catalogue de colonnes FIGE (voir en-tete de la migration 20260912000400). Schema `private`, NON expose par PostgREST : aucun appelant HTTP ne peut la joindre. AUCUN filtre de tenant integre (sans objet : la seule lectrice, api_read_order_export_rows, nait en E10.18c). `customer_type`/`vat_regime` sortent BRUTS : la traduction est a la charge du generateur de cellule (c)/(d), jamais de cette vue. Precedent : private.legacy_shop_customer_migration_plan.';

revoke all on private.commercial_order_export_headers from public, anon, authenticated;

-- ── 2. Vue LIGNES — une ligne par ligne de commande ────────────────────────
create or replace view private.commercial_order_export_lines as
select
  -- Colonnes TECHNIQUES — jamais exportees. tenant_id vaut CELUI DE LA
  -- COMMANDE (commercial_order_lines n a pas de colonne tenant_id propre :
  -- c est un fait, pas une omission — la ligne EST du tenant de sa commande).
  o.tenant_id                as tenant_id,
  o.id                       as order_id,
  l.id                       as line_id,

  -- ── Les DIX colonnes partagees avec commercial_order_export_headers ──────
  -- (qa-review round 1 : quote_number et customer_vat_number REJOIGNENT le
  -- bloc partage, voir catalogue en-tete de migration, corrections 1 et 2)
  o.number                   as order_number,
  q.number                   as quote_number,
  o.created_at               as order_created_at,
  c.type                     as customer_type,
  case
    when c.type = 'company' then c.company_name
    else btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
  end                        as customer_name,
  c.siret                    as customer_siret,
  c.vat_number               as customer_vat_number,
  case
    when cc.id is not null
      then btrim(coalesce(cc.first_name, '') || ' ' || coalesce(cc.last_name, ''))
    else null
  end                        as customer_contact_name,
  o.status                   as order_status,
  ps.label                   as production_step_label,

  -- ── Colonnes propres a la ligne ───────────────────────────────────────────
  l.position                          as line_position,
  l.label                             as line_label,
  l.quantity                          as quantity,
  -- "Montant HT bareme (avant remise)" — RENOMME depuis `customer_price`
  -- (qa-review round 1, correction 3) : c est un TOTAL pour `quantity`
  -- (contrat `CommercialOrderLine.customer_price`), jamais un prix unitaire.
  l.customer_price                    as bracket_amount_excl_tax,
  l.discount_rate                     as discount_rate,
  -- "PU HT indicatif" — Montant HT / Quantite, 4 decimales. sale_price >= 0
  -- et quantity > 0 sont garantis par les CHECK de commercial_order_lines
  -- (E10.12) : round() sur une valeur non negative arrondit "au plus proche,
  -- demi vers le haut", exactement la regle arbitree.
  round(l.sale_price / l.quantity, 4) as unit_price_indicative,
  l.sale_price                        as sale_price
from public.commercial_order_lines l
join public.commercial_orders o
  on o.id = l.order_id
join public.customers c
  on c.id = o.customer_id
join public.commercial_quotes q
  on q.id = o.quote_id
left join public.customer_contacts cc
  on cc.id = o.customer_contact_id
left join public.production_steps ps
  on ps.id = o.current_production_step_id;

comment on view private.commercial_order_export_lines is
  'E10.18b — jeu de donnees LIGNES (une ligne par ligne de commande) de l export comptable, catalogue de colonnes FIGE (voir en-tete de la migration 20260912000400). AUCUN total d entete reconduit ici (arbitrage colonne 3 : une colonne Total TTC repetee sur les lignes se sommerait en N fois le TTC). `bracket_amount_excl_tax` (ex-`customer_price`) est un TOTAL pour `quantity`, pas un prix unitaire. `customer_type` sort BRUT : la traduction est a la charge du generateur de cellule (c)/(d), jamais de cette vue. Schema `private`, NON expose par PostgREST. Precedent : private.legacy_shop_customer_migration_plan.';

revoke all on private.commercial_order_export_lines from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   drop view if exists private.commercial_order_export_lines;
--   drop view if exists private.commercial_order_export_headers;
--   notify pgrst, 'reload schema';
--
-- Aucune table n est touchee, aucune fonction, aucun trigger : le retrait est
-- sans effet de bord au-dela de la disparition des deux vues elles-memes.
-- Aucun autre objet du depot ne les reference (E10.18c, qui les lira, n est
-- pas encore livree).
-- ============================================================================
