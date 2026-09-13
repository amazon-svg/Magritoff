-- ============================================================================
-- E10.18b — les deux vues privees de l export comptable des commandes,
-- `private.commercial_order_export_headers` / `private.commercial_order_
-- export_lines`. Migration `20260912000400`. Contrat : docs/api/CONVENTIONS.md
-- §8.24, points 4/5/6/8 (ligne E10.18b).
-- ----------------------------------------------------------------------------
-- CE QUE CE FICHIER PROUVE, ET CE QU IL NE PROUVE PAS (a lire avant toute
-- modification) :
--
--   - PROUVE l INACCESSIBILITE (scenario 1) : ni `anon`, ni `authenticated`,
--     ni MEME `service_role` ne peuvent `select` sur les deux vues
--     aujourd hui — ce lot ne pose AUCUN chemin de lecture, pas meme pour
--     `service_role` (aucun `grant` n est ajoute par la migration ;
--     `private` n a reçu aucun `alter default privileges`, contrairement a
--     `public`, cf. `20260819000100_service_role_table_grants.sql`, qui ne
--     porte que sur le schema `public`). Le seul chemin a venir est la
--     fonction `security definer` `api_read_order_export_rows` (E10.18c),
--     qui s executera avec les privileges de son PROPRIETAIRE (postgres),
--     jamais avec ceux du role appelant — aucun grant direct sur la vue n
--     est donc necessaire ni souhaitable, meme pour service_role : c est la
--     meme discipline que `private.commercial_order_totals_at_conversion`
--     (aucun grant, appelee uniquement depuis une fonction security definer).
--   - PROUVE que la MATIERE de l isolation est saine (scenarios 2 a 5) :
--     tenant_id present, jamais nul, et EGAL AU TENANT DE LA COMMANDE (pas
--     d une table jointe — verifie par une commande dont le client
--     reference appartient DELIBEREMENT a un autre tenant, scenario 4) ; les
--     jointures ne font traverser aucune ligne d un tenant a l autre (deux
--     tenants aux donnees VOLONTAIREMENT VOISINES, meme raison sociale,
--     scenario 3) ; les jointures ne multiplient aucune ligne (une commande
--     a trois lignes rend exactement trois lignes en granularite `lines` et
--     une seule en granularite `headers`, scenario 2).
--   - PROUVE les cas de donnees exiges par le cadrage (scenario 5) : client
--     `company` vs `individual`, remise LIGNE (`discount_rate`) vs remise
--     GLOBALE (`global_discount`), interlocuteur NUL, commande SANS etape de
--     production, et les deux exemples arbitres du "PU HT indicatif"
--     (1000,00 / 3 -> 333,3333 ; 90,00 / 1000 -> 0,0900).
--   - NE PROUVE PAS l isolation de tenant au sens du FILTRAGE : aucun
--     scenario ci-dessous n ecrit de `where tenant_id = ...` pour ensuite le
--     verifier — ce serait tester sa propre clause, pas le produit. Cette
--     preuve appartient a E10.18c, avec `api_read_order_export_rows`. Tous
--     les scenarios 2 a 5 lisent les vues SANS AUCUN FILTRE de tenant (role
--     ambiant `postgres`, superutilisateur de la session de test), et
--     distinguent les lignes de chaque tenant en JOIGNANT sur `order_id`
--     depuis la table de contexte — jamais en filtrant par tenant.
--
-- CORRECTIFS qa-review round 1 (lot REJETE, corrige ici) :
--   - B1 : `customer_company_a` porte desormais DEUX interlocuteurs (un
--     second, non primaire, non reference par aucune commande). Sans cette
--     deuxieme ligne, une jointure fautive `cc.customer_id = o.customer_id`
--     (au lieu de `cc.id = o.customer_contact_id`) ne multipliait RIEN dans
--     ce jeu de donnees — le scenario 2 etait aveugle a la SEULE jointure
--     capable de rompre la propriete qu il pretend garder. Verifie par
--     mutation : voir rapport de fin de story.
--   - B2 : `order_cross` porte desormais UNE ligne de commande. Le scenario
--     4 interroge maintenant `commercial_order_export_lines` en plus de
--     `commercial_order_export_headers` — avant ce correctif, une mutation
--     `c.tenant_id` au lieu de `o.tenant_id` dans `_lines` restait invisible
--     puisque aucune ligne de order_cross n existait. Verifie par mutation :
--     voir rapport de fin de story.
--   - Catalogue de colonnes (4 corrections validees par Arnaud) : voir
--     scenarios 5a et 5d, qui verifient desormais `customer_vat_number`,
--     `quote_number` (deplace dans le bloc partage, teste aux DEUX
--     granularites) et `bracket_amount_excl_tax` (renomme depuis
--     `customer_price`).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_18b_context (
  tenant_a                uuid not null,
  tenant_b                uuid not null,
  customer_company_a      uuid not null,
  customer_individual_a   uuid not null,
  customer_company_b      uuid not null,
  contact_a1              uuid not null,
  order_1                 uuid not null,  -- 3 lignes, etape posee, interlocuteur pose
  order_2                 uuid not null,  -- 1 ligne, SANS etape, SANS interlocuteur
  order_b                 uuid not null,  -- tenant B, donnees VOISINES (meme raison sociale)
  order_cross             uuid not null,  -- tenant A, mais customer_id D UN AUTRE TENANT
  order_1_line_1          uuid not null,  -- 1000,00 / 3   -> PU 333,3333
  order_1_line_2          uuid not null,  -- 90,00 / 1000  -> PU 0,0900
  order_1_line_3          uuid not null,  -- 100,00 / 10   -> PU 10,0000 (temoin)
  order_cross_line        uuid not null   -- qa-review round 1, correctif B2 :
                                           -- LIGNE de order_cross (aucune ligne
                                           -- n existait avant, le scenario 4
                                           -- n interrogeait donc jamais
                                           -- commercial_order_export_lines)
);

grant select on e10_18b_context to authenticated, anon;

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_company_a uuid;
  v_customer_individual_a uuid;
  v_customer_company_b uuid;
  v_contact_a1 uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_quote_1 uuid;
  v_quote_2 uuid;
  v_quote_b uuid;
  v_quote_cross uuid;
  v_qline_1 uuid;
  v_qline_2 uuid;
  v_qline_3 uuid;
  v_qline_b uuid;
  v_qline_cross uuid;
  v_order_1 uuid;
  v_order_2 uuid;
  v_order_b uuid;
  v_order_cross uuid;
  v_line_1 uuid;
  v_line_2 uuid;
  v_line_3 uuid;
  v_line_cross uuid;
  v_step_a_pao uuid;
  v_step_b_any uuid;
begin
  insert into public.tenants (slug, name) values ('e10-18b-tenant-a', 'E10.18b Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-18b-tenant-b', 'E10.18b Tenant B') returning id into v_tenant_b;

  -- ── Clients — company vs individual (scenario 5), et DEUX SOCIETES DE
  --    MEME RAISON SOCIALE dans deux tenants DIFFERENTS (scenario 3) ───────
  -- qa-review round 1, correction 1 (numero de TVA du client) : vat_number
  -- pose ICI pour verifier que la colonne ajoutee `customer_vat_number`
  -- rejoint bien `customers.vat_number` (scenario 5a).
  insert into public.customers (tenant_id, type, company_name, siret, vat_number)
    values (v_tenant_a, 'company', 'E10.18b Client Frontiere', '73282932000074', 'FR40303265045')
    returning id into v_customer_company_a;

  insert into public.customers (tenant_id, type, civility, first_name, last_name)
    values (v_tenant_a, 'individual', 'mrs', 'Alix', 'Bernard')
    returning id into v_customer_individual_a;

  -- MEME raison sociale que customer_company_a, TENANT B, SIRET different.
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.18b Client Frontiere', '39872154200011')
    returning id into v_customer_company_b;

  insert into public.customer_contacts (customer_id, first_name, last_name, email, is_primary)
    values (v_customer_company_a, 'Jean', 'Dupont', 'jean.dupont@example.test', true)
    returning id into v_contact_a1;

  -- qa-review round 1, correctif B1 : UN SECOND interlocuteur sur le MEME
  -- client (`customer_company_a`), NON primaire, NON reference par
  -- `commercial_orders.customer_contact_id` d aucune commande. Sans cette
  -- deuxieme ligne, `customer_contacts` ne compte qu UNE ligne pour
  -- `customer_company_a` et un fan-out `cc.id = o.customer_id` (au lieu de
  -- `cc.id = o.customer_contact_id`) ne multiplierait RIEN dans ce jeu de
  -- donnees — c est exactement la faute que le scenario 2 doit attraper.
  insert into public.customer_contacts (customer_id, first_name, last_name, email, is_primary)
    values (v_customer_company_a, 'Sophie', 'Martin', 'sophie.martin@example.test', false);

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_company_a, 'Projet E10.18b A') returning id into v_project_a;
  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_b, v_customer_company_b, 'Projet E10.18b B') returning id into v_project_b;

  -- ── Devis (minimaux, `draft` : le statut du devis n a aucun effet sur les
  --    vues, seul `commercial_orders.quote_id` -> `commercial_quotes.number`
  --    est lu) ────────────────────────────────────────────────────────────
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_company_a, v_project_a, 'DEV-2026-98001', 'draft', '2099-01-01', true)
    returning id into v_quote_1;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_individual_a, v_project_a, 'DEV-2026-98002', 'draft', '2099-01-01', true)
    returning id into v_quote_2;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_company_b, v_project_b, 'DEV-2026-98003', 'draft', '2099-01-01', true)
    returning id into v_quote_b;
  -- Devis-vehicule pour le scenario 4 (customer_id CROISE) : quote_id doit
  -- rester UNIQUE sur commercial_orders, ce devis n est la que pour cela.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_company_a, v_project_a, 'DEV-2026-98004', 'draft', '2099-01-01', true)
    returning id into v_quote_cross;

  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_1, null, 'free', 'Depliants A5', 3, 0, 300.00, 1200.00, 1100.00, 1.0000, 1000.00, 0.0909,
            '[{"post":"total","cost":"300.00","margin_rate":"1.0000","price":"1200.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_1;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_1, null, 'free', 'Flyers A6', 1000, 1, 50.00, 120.00, 95.00, 1.0000, 90.00, 0.0526,
            '[{"post":"total","cost":"50.00","margin_rate":"1.0000","price":"120.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_2;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_1, null, 'free', 'Cartes de visite', 10, 2, 20.00, 110.00, 105.00, 1.0000, 100.00, 0.0476,
            '[{"post":"total","cost":"20.00","margin_rate":"1.0000","price":"110.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_3;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_b, null, 'free', 'Affiches A3', 2, 0, 40.00, 260.00, 260.00, 1.0000, 260.00, 0.0000,
            '[{"post":"total","cost":"40.00","margin_rate":"1.0000","price":"260.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_b;
  -- qa-review round 1, correctif B2 : ligne du devis-vehicule de order_cross,
  -- seulement pour porter la ligne de commande ci-dessous.
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_cross, null, 'free', 'Marque-pages', 5, 0, 5.00, 25.00, 25.00, 1.0000, 25.00, 0.0000,
            '[{"post":"total","cost":"5.00","margin_rate":"1.0000","price":"25.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_cross;

  -- ── Etapes de production — deja SEMEES par le trigger `tenants_seed_
  --    catalogs` a la creation des deux tenants ci-dessus (E10.13). ────────
  select id into v_step_a_pao from public.production_steps where tenant_id = v_tenant_a and label = 'PAO';
  select id into v_step_b_any from public.production_steps where tenant_id = v_tenant_b order by position limit 1;

  -- ── Commandes, inserees DIRECTEMENT (aucun trigger ne bloque l INSERT —
  --    seuls UPDATE/DELETE sont geles par `commercial_orders_immutable()`) ──

  -- order_1 : TENANT A, interlocuteur POSE, etape POSEE, remise GLOBALE
  -- signee (majoration), 3 lignes avec remise LIGNE sur chacune.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax,
    current_production_step_id, customer_contact_id
  ) values (
    v_tenant_a, v_customer_company_a, v_quote_1, 'CDE-2026-98001', 'validated', 'sent',
    1190.00, -5.00, -0.0042, 1195.00,
    0.2000, 'metropole_fr', 239.00, 1434.00,
    v_step_a_pao, v_contact_a1
  ) returning id into v_order_1;

  -- order_2 : TENANT A, SANS interlocuteur (nul), SANS etape de production,
  -- SANS ligne (fixture corrigee — mineur qa-review round 1 : les totaux
  -- doivent rester coherents avec l absence de ligne, aucun test ne les
  -- somme mais un lecteur de (c) reprenant ce jeu de donnees s y serait
  -- trompe).
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax,
    current_production_step_id, customer_contact_id
  ) values (
    v_tenant_a, v_customer_individual_a, v_quote_2, 'CDE-2026-98002', 'validated', 'accepted',
    0.00, 0.00, null, 0.00,
    0.2000, 'metropole_fr', 0.00, 0.00,
    null, null
  ) returning id into v_order_2;

  -- order_b : TENANT B, donnees VOISINES de order_1 (meme raison sociale
  -- cliente que le tenant A).
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax,
    current_production_step_id, customer_contact_id
  ) values (
    v_tenant_b, v_customer_company_b, v_quote_b, 'CDE-2026-98003', 'validated', 'sent',
    500.00, 0.00, 0.0000, 500.00,
    0.2000, 'metropole_fr', 100.00, 600.00,
    v_step_b_any, null
  ) returning id into v_order_b;

  -- order_cross : TENANT A, mais `customer_id` pointe vers un client du
  -- TENANT B (donnee volontairement ABERRANTE — aucune contrainte en base
  -- n empeche cette combinaison, seule la couche applicative la garantit
  -- normalement). Sert a prouver que `tenant_id` dans la vue vient de
  -- `commercial_orders.tenant_id`, jamais de `customers.tenant_id` —
  -- desormais en granularite HEADERS ET LIGNES (correctif B2, une ligne est
  -- ajoutee plus bas). Totaux coherents avec cette unique ligne (25,00 HT,
  -- TVA 20% = 5,00, TTC 30,00).
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax,
    current_production_step_id, customer_contact_id
  ) values (
    v_tenant_a, v_customer_company_b, v_quote_cross, 'CDE-2026-98004', 'validated', 'sent',
    25.00, 0.00, 0.0000, 25.00,
    0.2000, 'metropole_fr', 5.00, 30.00,
    null, null
  ) returning id into v_order_cross;

  -- ── Lignes de order_1 — LES DEUX EXEMPLES ARBITRES DU PU HT INDICATIF ───
  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, applied_rule_id,
    sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown
  ) values (
    v_order_1, v_qline_1, 'free', 'Depliants A5', 3, 0,
    300.00, 1200.00, 1100.00, 1.0000, null,
    1000.00, null, 0.0909, null,
    '[{"post":"total","cost":"300.00","margin_rate":"1.0000","price":"1200.00","source":"prix_marche"}]'::jsonb
  ) returning id into v_line_1;

  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, applied_rule_id,
    sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown
  ) values (
    v_order_1, v_qline_2, 'free', 'Flyers A6', 1000, 1,
    50.00, 120.00, 95.00, 1.0000, null,
    90.00, null, 0.0526, null,
    '[{"post":"total","cost":"50.00","margin_rate":"1.0000","price":"120.00","source":"prix_marche"}]'::jsonb
  ) returning id into v_line_2;

  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, applied_rule_id,
    sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown
  ) values (
    v_order_1, v_qline_3, 'free', 'Cartes de visite', 10, 2,
    20.00, 110.00, 105.00, 1.0000, null,
    100.00, null, 0.0476, null,
    '[{"post":"total","cost":"20.00","margin_rate":"1.0000","price":"110.00","source":"prix_marche"}]'::jsonb
  ) returning id into v_line_3;

  -- qa-review round 1, correctif B2 : UNE LIGNE pour order_cross — avant ce
  -- correctif, order_cross n avait AUCUNE ligne de commande, donc le
  -- scenario 4 ne pouvait interroger que `commercial_order_export_headers`,
  -- jamais `commercial_order_export_lines`. `customer_id` de order_cross
  -- pointe TOUJOURS vers un client du TENANT B alors que la commande est du
  -- TENANT A : si `_lines` lisait `c.tenant_id` au lieu de `o.tenant_id`,
  -- cette ligne le revelerait.
  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, applied_rule_id,
    sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown
  ) values (
    v_order_cross, v_qline_cross, 'free', 'Marque-pages', 5, 0,
    5.00, 25.00, 25.00, 1.0000, null,
    25.00, null, 0.0000, null,
    '[{"post":"total","cost":"5.00","margin_rate":"1.0000","price":"25.00","source":"prix_marche"}]'::jsonb
  ) returning id into v_line_cross;

  insert into e10_18b_context (
    tenant_a, tenant_b, customer_company_a, customer_individual_a, customer_company_b,
    contact_a1, order_1, order_2, order_b, order_cross,
    order_1_line_1, order_1_line_2, order_1_line_3, order_cross_line
  ) values (
    v_tenant_a, v_tenant_b, v_customer_company_a, v_customer_individual_a, v_customer_company_b,
    v_contact_a1, v_order_1, v_order_2, v_order_b, v_order_cross,
    v_line_1, v_line_2, v_line_3, v_line_cross
  );
end;
$$;

-- ── 1. INACCESSIBILITE — anon/authenticated/service_role tous refuses ──────
-- Ce lot ne pose AUCUN chemin de lecture (§8.24 point 4) : le seul acces a
-- venir est `api_read_order_export_rows` (E10.18c), `security definer`, qui
-- s executera avec les privileges de son PROPRIETAIRE, jamais avec ceux du
-- role appelant. Un grant direct sur la vue, meme a `service_role`, n est
-- donc ni necessaire ni souhaitable aujourd hui.
do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role anon;
    perform 1 from private.commercial_order_export_headers limit 1;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 1 : anon a pu lire private.commercial_order_export_headers';
  end if;
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role authenticated;
    perform 1 from private.commercial_order_export_headers limit 1;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 1 : authenticated a pu lire private.commercial_order_export_headers';
  end if;
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role service_role;
    perform 1 from private.commercial_order_export_headers limit 1;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 1 : service_role a pu lire private.commercial_order_export_headers SANS passer par api_read_order_export_rows (E10.18c) — chemin de lecture premature';
  end if;
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role anon;
    perform 1 from private.commercial_order_export_lines limit 1;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 1 : anon a pu lire private.commercial_order_export_lines';
  end if;
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role authenticated;
    perform 1 from private.commercial_order_export_lines limit 1;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 1 : authenticated a pu lire private.commercial_order_export_lines';
  end if;
end;
$$;

-- qa-review round 1, mineur ACL : le NOTICE de cloture annonce les TROIS
-- roles pour LES DEUX vues, mais seul `_headers` etait teste sur les trois
-- roles (anon/authenticated/service_role) — `_lines` n etait teste que sur
-- `authenticated`. Verifie ici en plus, aucun risque reel (memes GRANT sur
-- les deux vues), mais un intitule faux reste un intitule faux.
do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role service_role;
    perform 1 from private.commercial_order_export_lines limit 1;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 1 : service_role a pu lire private.commercial_order_export_lines SANS passer par api_read_order_export_rows (E10.18c) — chemin de lecture premature';
  end if;
  raise notice 'scenario 1 (inaccessibilite anon/authenticated/service_role, headers ET lignes) OK';
end;
$$;

-- ── 2. AUCUNE MULTIPLICATION — 3 lignes -> exactement 3 rangs `lines`, ─────
--    1 rang `headers` ────────────────────────────────────────────────────
do $$
declare
  v_order_1 uuid;
  v_lines_count integer;
  v_headers_count integer;
begin
  select order_1 into v_order_1 from e10_18b_context;

  select count(*) into v_lines_count
    from private.commercial_order_export_lines where order_id = v_order_1;
  if v_lines_count <> 3 then
    raise exception 'scenario 2 : % ligne(s) rendue(s) pour order_1, attendu exactement 3 — une jointure duplique des lignes', v_lines_count;
  end if;

  select count(*) into v_headers_count
    from private.commercial_order_export_headers where order_id = v_order_1;
  if v_headers_count <> 1 then
    raise exception 'scenario 2 : % rang(s) rendu(s) pour order_1 en granularite headers, attendu exactement 1 — une jointure duplique l entete', v_headers_count;
  end if;

  raise notice 'scenario 2 (aucune multiplication) OK';
end;
$$;

-- ── 3. AUCUNE TRAVERSEE INTER-TENANT — donnees VOISINES (meme raison ───────
--    sociale), verifiees par CONTENU, pas seulement par identifiant ────────
do $$
declare
  v_order_1 uuid;
  v_order_b uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_row_a private.commercial_order_export_headers%rowtype;
  v_row_b private.commercial_order_export_headers%rowtype;
begin
  select order_1, order_b, tenant_a, tenant_b into v_order_1, v_order_b, v_tenant_a, v_tenant_b
    from e10_18b_context;

  select * into v_row_a from private.commercial_order_export_headers where order_id = v_order_1;
  select * into v_row_b from private.commercial_order_export_headers where order_id = v_order_b;

  if v_row_a.customer_name is distinct from 'E10.18b Client Frontiere'
     or v_row_b.customer_name is distinct from 'E10.18b Client Frontiere' then
    raise exception 'scenario 3 : jeu de test invalide, les deux raisons sociales devraient etre identiques par construction';
  end if;

  if v_row_a.tenant_id <> v_tenant_a then
    raise exception 'scenario 3 : order_1.tenant_id rendu = %, attendu tenant A', v_row_a.tenant_id;
  end if;
  if v_row_b.tenant_id <> v_tenant_b then
    raise exception 'scenario 3 : order_b.tenant_id rendu = %, attendu tenant B', v_row_b.tenant_id;
  end if;

  -- Meme raison sociale, mais SIRET distinct par tenant : si une jointure
  -- avait traverse (par ex. jointure sur company_name au lieu de l id),
  -- les deux SIRET rendus seraient identiques ou echanges.
  if v_row_a.customer_siret <> '73282932000074' then
    raise exception 'scenario 3 : SIRET rendu pour order_1 = %, attendu celui du client du TENANT A (73282932000074) — traversee suspectee', v_row_a.customer_siret;
  end if;
  if v_row_b.customer_siret <> '39872154200011' then
    raise exception 'scenario 3 : SIRET rendu pour order_b = %, attendu celui du client du TENANT B (39872154200011) — traversee suspectee', v_row_b.customer_siret;
  end if;

  raise notice 'scenario 3 (aucune traversee inter-tenant, donnees voisines) OK';
end;
$$;

-- ── 4. tenant_id VIENT DE LA COMMANDE, JAMAIS D UNE TABLE JOINTE ───────────
-- order_cross porte un customer_id du TENANT B tout en etant lui-meme une
-- commande du TENANT A (donnee volontairement aberrante, §0 du fichier) :
-- si la vue selectionnait `c.tenant_id` au lieu de `o.tenant_id`, ce test
-- le revelerait immediatement. Verifie sur LES DEUX granularites — HEADERS
-- ET LIGNES (correctif B2, qa-review round 1 : avant ce correctif,
-- order_cross n avait AUCUNE ligne de commande, donc `commercial_order_
-- export_lines` n etait JAMAIS interrogee ici ; une vue `_lines` lisant
-- `c.tenant_id` au lieu de `o.tenant_id` serait restee invisible).
do $$
declare
  v_order_cross uuid;
  v_order_cross_line uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_rendered_tenant_id_header uuid;
  v_rendered_tenant_id_line uuid;
begin
  select order_cross, order_cross_line, tenant_a, tenant_b
    into v_order_cross, v_order_cross_line, v_tenant_a, v_tenant_b
    from e10_18b_context;

  select tenant_id into v_rendered_tenant_id_header
    from private.commercial_order_export_headers where order_id = v_order_cross;

  if v_rendered_tenant_id_header is null then
    raise exception 'scenario 4 : tenant_id NUL pour order_cross (headers) — l isolation n a plus de matiere sur laquelle s appuyer';
  end if;
  if v_rendered_tenant_id_header <> v_tenant_a then
    raise exception 'scenario 4 : tenant_id (headers) rendu = % (tenant B = %), attendu le tenant de LA COMMANDE (tenant A = %) — la vue lit le tenant d une table jointe', v_rendered_tenant_id_header, v_tenant_b, v_tenant_a;
  end if;

  select tenant_id into v_rendered_tenant_id_line
    from private.commercial_order_export_lines where line_id = v_order_cross_line;

  if v_rendered_tenant_id_line is null then
    raise exception 'scenario 4 : tenant_id NUL pour la ligne de order_cross — l isolation n a plus de matiere sur laquelle s appuyer';
  end if;
  if v_rendered_tenant_id_line <> v_tenant_a then
    raise exception 'scenario 4 : tenant_id (lignes) rendu = % (tenant B = %), attendu le tenant de LA COMMANDE (tenant A = %) — la vue LIGNES lit le tenant d une table jointe', v_rendered_tenant_id_line, v_tenant_b, v_tenant_a;
  end if;

  raise notice 'scenario 4 (tenant_id vient de la commande, headers ET lignes) OK';
end;
$$;

-- ── 4bis. tenant_id JAMAIS NUL, sur la totalite des lignes de test ─────────
do $$
declare
  v_null_headers integer;
  v_null_lines integer;
begin
  select count(*) into v_null_headers
    from private.commercial_order_export_headers h
    join e10_18b_context ctx on h.order_id in (ctx.order_1, ctx.order_2, ctx.order_b, ctx.order_cross)
   where h.tenant_id is null;
  if v_null_headers <> 0 then
    raise exception 'scenario 4bis : % rang(s) headers avec tenant_id NUL', v_null_headers;
  end if;

  select count(*) into v_null_lines
    from private.commercial_order_export_lines l
    join e10_18b_context ctx on l.order_id in (ctx.order_1, ctx.order_2, ctx.order_b, ctx.order_cross)
   where l.tenant_id is null;
  if v_null_lines <> 0 then
    raise exception 'scenario 4bis : % rang(s) lines avec tenant_id NUL', v_null_lines;
  end if;

  raise notice 'scenario 4bis (tenant_id jamais nul) OK';
end;
$$;

-- ── 5. Les cas de donnees exiges par le cadrage ────────────────────────────

-- 5a. Client company vs individual — les deux formes de customer_name/type.
do $$
declare
  v_order_1 uuid;
  v_order_2 uuid;
  v_row_company private.commercial_order_export_headers%rowtype;
  v_row_individual private.commercial_order_export_headers%rowtype;
begin
  select order_1, order_2 into v_order_1, v_order_2 from e10_18b_context;

  select * into v_row_company from private.commercial_order_export_headers where order_id = v_order_1;
  select * into v_row_individual from private.commercial_order_export_headers where order_id = v_order_2;

  if v_row_company.customer_type <> 'company' or v_row_company.customer_name <> 'E10.18b Client Frontiere' then
    raise exception 'scenario 5a : client COMPANY mal rendu (type=%, nom=%)', v_row_company.customer_type, v_row_company.customer_name;
  end if;
  if v_row_individual.customer_type <> 'individual' or v_row_individual.customer_name <> 'Alix Bernard' then
    raise exception 'scenario 5a : client INDIVIDUAL mal rendu (type=%, nom=%)', v_row_individual.customer_type, v_row_individual.customer_name;
  end if;
  if v_row_individual.customer_siret is not null then
    raise exception 'scenario 5a : SIRET non nul pour un client individual (%)', v_row_individual.customer_siret;
  end if;

  -- qa-review round 1, corrections 1 et 2 du catalogue de colonnes.
  if v_row_company.customer_vat_number <> 'FR40303265045' then
    raise exception 'scenario 5a : numero de TVA attendu FR40303265045 pour le client COMPANY, rendu %', v_row_company.customer_vat_number;
  end if;
  if v_row_individual.customer_vat_number is not null then
    raise exception 'scenario 5a : numero de TVA non nul pour un client individual sans vat_number pose (%)', v_row_individual.customer_vat_number;
  end if;
  if v_row_company.quote_number <> 'DEV-2026-98001' then
    raise exception 'scenario 5a : numero de devis attendu DEV-2026-98001 pour order_1, rendu %', v_row_company.quote_number;
  end if;

  raise notice 'scenario 5a (company vs individual, TVA client, devis d origine) OK';
end;
$$;

-- 5b. Interlocuteur POSE vs NUL, etape de production POSEE vs NULLE (les
--     deux au meme endroit : order_1 a les deux, order_2 n a ni l un ni l
--     autre — "commande sans etape de production").
do $$
declare
  v_order_1 uuid;
  v_order_2 uuid;
  v_row_1 private.commercial_order_export_headers%rowtype;
  v_row_2 private.commercial_order_export_headers%rowtype;
begin
  select order_1, order_2 into v_order_1, v_order_2 from e10_18b_context;

  select * into v_row_1 from private.commercial_order_export_headers where order_id = v_order_1;
  select * into v_row_2 from private.commercial_order_export_headers where order_id = v_order_2;

  if v_row_1.customer_contact_name <> 'Jean Dupont' then
    raise exception 'scenario 5b : interlocuteur attendu "Jean Dupont" pour order_1, rendu %', v_row_1.customer_contact_name;
  end if;
  if v_row_1.production_step_label <> 'PAO' then
    raise exception 'scenario 5b : etape de production attendue "PAO" pour order_1, rendue %', v_row_1.production_step_label;
  end if;

  if v_row_2.customer_contact_name is not null then
    raise exception 'scenario 5b : interlocuteur devrait etre NUL pour order_2 (aucun customer_contact_id pose), rendu %', v_row_2.customer_contact_name;
  end if;
  if v_row_2.production_step_label is not null then
    raise exception 'scenario 5b : etape de production devrait etre NULLE pour order_2 (commande sans etape), rendue %', v_row_2.production_step_label;
  end if;

  raise notice 'scenario 5b (interlocuteur nul + commande sans etape) OK';
end;
$$;

-- 5c. Remise LIGNE (discount_rate) vs remise GLOBALE (global_discount) —
--     deux notions distinctes, jamais fondues.
do $$
declare
  v_order_1 uuid;
  v_line_1 uuid;
  v_header_row private.commercial_order_export_headers%rowtype;
  v_line_discount numeric;
begin
  select order_1, order_1_line_1 into v_order_1, v_line_1 from e10_18b_context;

  select * into v_header_row from private.commercial_order_export_headers where order_id = v_order_1;
  select discount_rate into v_line_discount from private.commercial_order_export_lines where line_id = v_line_1;

  if v_header_row.global_discount <> -5.00 then
    raise exception 'scenario 5c : remise GLOBALE (entete) attendue -5.00 (majoration), rendue %', v_header_row.global_discount;
  end if;
  if v_line_discount <> 0.0909 then
    raise exception 'scenario 5c : remise LIGNE (order_1_line_1) attendue 0.0909, rendue %', v_line_discount;
  end if;

  raise notice 'scenario 5c (remise ligne vs remise globale) OK';
end;
$$;

-- 5d. LES DEUX EXEMPLES ARBITRES DU "PU HT INDICATIF", a 4 decimales.
do $$
declare
  v_line_1 uuid;
  v_line_2 uuid;
  v_line_3 uuid;
  v_pu_1 numeric;
  v_pu_2 numeric;
  v_pu_3 numeric;
  v_sale_1 numeric;
  v_sale_2 numeric;
  v_bracket_1 numeric;
  v_quote_number_1 text;
  v_vat_number_1 text;
begin
  select order_1_line_1, order_1_line_2, order_1_line_3
    into v_line_1, v_line_2, v_line_3
    from e10_18b_context;

  select unit_price_indicative, sale_price, bracket_amount_excl_tax, quote_number, customer_vat_number
    into v_pu_1, v_sale_1, v_bracket_1, v_quote_number_1, v_vat_number_1
    from private.commercial_order_export_lines where line_id = v_line_1;
  select unit_price_indicative, sale_price into v_pu_2, v_sale_2
    from private.commercial_order_export_lines where line_id = v_line_2;
  select unit_price_indicative into v_pu_3
    from private.commercial_order_export_lines where line_id = v_line_3;

  -- qa-review round 1, corrections 1/2/3 du catalogue : ces trois colonnes
  -- (ajoutees ou renommees) doivent etre lisibles a la granularite LIGNE, et
  -- la verification par difference voulue par le contrat doit fonctionner
  -- (`bracket_amount_excl_tax - sale_price` = remise en valeur).
  if v_bracket_1 <> 1100.00 then
    raise exception 'scenario 5d : Montant HT bareme (bracket_amount_excl_tax, ex-customer_price) attendu 1100.00 pour order_1_line_1, rendu %', v_bracket_1;
  end if;
  if v_bracket_1 - 1000.00 <> 100.00 then
    raise exception 'scenario 5d : verification par difference (bracket_amount_excl_tax - sale_price) attendue 100.00, rendue %', v_bracket_1 - 1000.00;
  end if;
  if v_quote_number_1 <> 'DEV-2026-98001' then
    raise exception 'scenario 5d : numero de devis attendu DEV-2026-98001 a la granularite LIGNE, rendu %', v_quote_number_1;
  end if;
  if v_vat_number_1 <> 'FR40303265045' then
    raise exception 'scenario 5d : numero de TVA client attendu FR40303265045 a la granularite LIGNE, rendu %', v_vat_number_1;
  end if;

  -- 1000,00 / 3 -> 333,3333 (arbitrage Arnaud du 2026-09-12, quantite NON
  -- DIVISIBLE : l ecart residuel est CONNU et ASSUME, "Montant HT" (ici
  -- 1000,00) reste la seule valeur qui fait foi).
  if v_pu_1 <> 333.3333 then
    raise exception 'scenario 5d : PU HT indicatif attendu 333.3333 pour 1000,00 / 3, rendu %', v_pu_1;
  end if;
  if v_sale_1 <> 1000.00 then
    raise exception 'scenario 5d : Montant HT (sale_price) attendu 1000.00 pour order_1_line_1, rendu %', v_sale_1;
  end if;

  -- 90,00 / 1000 -> 0,0900 (le cas qui a fait basculer l arbitrage de 1 a 4
  -- decimales : a 1 decimale, la colonne aurait affiche 0,1 ; a 0, 0,0).
  if v_pu_2 <> 0.0900 then
    raise exception 'scenario 5d : PU HT indicatif attendu 0.0900 pour 90,00 / 1000, rendu %', v_pu_2;
  end if;
  if v_sale_2 <> 90.00 then
    raise exception 'scenario 5d : Montant HT (sale_price) attendu 90.00 pour order_1_line_2, rendu %', v_sale_2;
  end if;

  -- Temoin (division exacte) : 100,00 / 10 -> 10,0000.
  if v_pu_3 <> 10.0000 then
    raise exception 'scenario 5d : PU HT indicatif attendu 10.0000 pour 100,00 / 10, rendu %', v_pu_3;
  end if;

  raise notice 'scenario 5d (PU HT indicatif, deux exemples arbitres) OK';
end;
$$;

-- ── 6. BORNES DE FUSEAU AUX DEUX BORDS D UN MOIS — la MATIERE exposee par
--    la vue (order_created_at) doit rester l INSTANT BRUT, inchange, pour
--    qu un filtrage Europe/Paris ulterieur (E10.18c) bucketise correctement.
--    MEME EXEMPLE que le contrat et que le cas SQL d E10.18a : une commande
--    a 2026-08-31T22:30:00Z vaut le 1er septembre 00h30 a Paris (CEST,
--    +02:00) — elle doit apparaitre en SEPTEMBRE, pas en aout, si l on
--    convertit cet instant BRUT en Europe/Paris. Ce scenario ne filtre
--    RIEN (§0 du fichier) : il verifie que la vue ne deforme pas l instant
--    (pas de troncature, pas de cast naif en `date`), et que la conversion
--    Europe/Paris — faite ICI SEULEMENT POUR VERIFIER, jamais en production
--    dans cette vue, qui "ne connait aucun fuseau" comme
--    `list_commercial_orders_by_production_step` (E10.18a) — place bien
--    chaque bord dans le bon mois CIVIL parisien. ─────────────────────────
do $$
declare
  v_tenant uuid;
  v_customer uuid;
  v_project uuid;
  v_quote_low uuid;
  v_quote_high uuid;
  v_order_low uuid;
  v_order_high uuid;
  v_rendered_low timestamptz;
  v_rendered_high timestamptz;
  v_stored_low constant timestamptz := timestamptz '2026-08-31T22:30:00Z';
  v_stored_high constant timestamptz := timestamptz '2026-09-30T22:30:00Z';
  v_month_low_paris integer;
  v_month_high_paris integer;
begin
  select tenant_a, customer_company_a into v_tenant, v_customer from e10_18b_context;

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant, v_customer, 'Projet E10.18b fuseau') returning id into v_project;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant, v_customer, v_project, 'DEV-2026-98005', 'draft', '2099-01-01', true)
    returning id into v_quote_low;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant, v_customer, v_project, 'DEV-2026-98006', 'draft', '2099-01-01', true)
    returning id into v_quote_high;

  -- BORD BAS : 2026-08-31T22:30:00Z = 1er septembre 00h30 CEST a Paris.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, created_at
  ) values (
    v_tenant, v_customer, v_quote_low, 'CDE-2026-98005', 'validated', 'sent',
    10.00, 0.00, null, 10.00, 0.2000, 'metropole_fr', 2.00, 12.00, v_stored_low
  ) returning id into v_order_low;

  -- BORD HAUT (symetrique) : 2026-09-30T22:30:00Z = 1er octobre 00h30 CEST.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, created_at
  ) values (
    v_tenant, v_customer, v_quote_high, 'CDE-2026-98006', 'validated', 'sent',
    10.00, 0.00, null, 10.00, 0.2000, 'metropole_fr', 2.00, 12.00, v_stored_high
  ) returning id into v_order_high;

  select order_created_at into v_rendered_low
    from private.commercial_order_export_headers where order_id = v_order_low;
  select order_created_at into v_rendered_high
    from private.commercial_order_export_headers where order_id = v_order_high;

  -- (i) L INSTANT BRUT n est ni tronque ni deforme par la vue.
  if v_rendered_low <> v_stored_low then
    raise exception 'scenario 6 : order_created_at rendu (%) different de l instant stocke (%) — la vue deforme le bord bas', v_rendered_low, v_stored_low;
  end if;
  if v_rendered_high <> v_stored_high then
    raise exception 'scenario 6 : order_created_at rendu (%) different de l instant stocke (%) — la vue deforme le bord haut', v_rendered_high, v_stored_high;
  end if;

  -- (ii) Preuve, calculee ICI (jamais en production dans la vue), que cet
  -- instant brut permet une bucketisation Europe/Paris correcte : le bord
  -- bas doit tomber en SEPTEMBRE (mois 9), le bord haut en OCTOBRE (10) —
  -- malgre un instant UTC encore le mois precedent dans les deux cas.
  v_month_low_paris := extract(month from (v_rendered_low at time zone 'Europe/Paris'))::integer;
  v_month_high_paris := extract(month from (v_rendered_high at time zone 'Europe/Paris'))::integer;

  if v_month_low_paris <> 9 then
    raise exception 'scenario 6 : bord bas (2026-08-31T22:30:00Z) devrait tomber en SEPTEMBRE a Paris, calcule mois %', v_month_low_paris;
  end if;
  if v_month_high_paris <> 10 then
    raise exception 'scenario 6 : bord haut (2026-09-30T22:30:00Z) devrait tomber en OCTOBRE a Paris, calcule mois %', v_month_high_paris;
  end if;

  raise notice 'scenario 6 (bornes de fuseau aux deux bords d un mois, matiere exposee intacte) OK';
end;
$$;

reset role;

rollback;
