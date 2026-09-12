-- ============================================================================
-- E10.18a — bornes de periode (`created_from`/`created_to`) sur
-- `listCommercialOrders`, EN COMBINAISON avec `sort=production_step`
-- (E10.13). Migration `20260912000300` : `public.
-- list_commercial_orders_by_production_step` gagne deux parametres
-- OPTIONNELS `p_created_from`/`p_created_to` (`default null`), portes en fin
-- de liste.
-- ----------------------------------------------------------------------------
-- Le chemin de tri PAR DEFAUT (`-created_at`/`created_at`) est un SELECT
-- PostgREST direct (`.gte()`/`.lte()` dans l adaptateur) : une comparaison de
-- `timestamptz` n a rien de specifique a ce lot et n exige aucun test SQL
-- dedie. Ce fichier teste PRECISEMENT ce qui EST specifique : la fonction SQL
-- de tri par etape, seul chemin qui exigeait une migration pour ce lot.
--
-- Scenarios :
--   1. Retrocompatibilite — appel a 11 arguments (l ancienne signature
--      E10.13), SANS les deux nouveaux parametres : comportement INCHANGE,
--      aucun filtre de periode applique.
--   2. Bornes INCLUSIVES aux DEUX BORDS d un mois, fuseau Europe/Paris,
--      MEME EXEMPLE que le contrat (docs/api/CONVENTIONS.md §8.24) : une
--      commande a 2026-08-31T22:30:00Z (1er septembre 00h30 a Paris) entre
--      dans une demande de septembre (2026-09-01T00:00:00+02:00 ->
--      2026-08-31T22:00:00Z) et sort d une demande d aout
--      (jusqu a 2026-08-31T21:59:59.999Z). Bord symetrique a l autre
--      extremite du mois (2026-09-30T22:30:00Z, 1er octobre a Paris).
--   3. Etanchéité inter-tenant, CONTROLE POSITIF ET NEGATIF (qa-review
--      E10.18a round 1, M4 — un scenario purement negatif ne prouve rien :
--      si la fonction rendait zero ligne pour TOUT LE MONDE sous le role
--      `authenticated`, un test qui n asserte que "0 ligne pour l acteur B"
--      resterait vert sans que l isolation soit demontree) :
--        3a. l acteur A (membre du tenant A, role `authenticated`, PAS
--            superuser) voit bien ses 3 commandes de test — preuve que la
--            fonction REND des lignes sous RLS quand l acces est legitime ;
--        3b. l acteur B (membre du tenant B), meme en fournissant
--            explicitement `p_tenant_id` du tenant A et une periode qui
--            couvre tout, ne voit AUCUNE commande du tenant A (RLS
--            `commercial_orders_select`, `security invoker` : cette fonction
--            ne contourne rien, meme apres l ajout des deux parametres).
--      Les scenarios 1 et 2 tournent en SUPERUSER (RLS contournee) : ils
--      prouvent le comportement de la fonction, pas l isolation. 3a/3b sont
--      les seuls scenarios de ce fichier executes sous `set local role
--      authenticated`.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_18a_context (
  actor_a       uuid not null,
  actor_b       uuid not null,
  tenant_a      uuid not null,
  tenant_b      uuid not null,
  order_low     uuid not null,
  order_high    uuid not null,
  order_mid     uuid not null
);

grant select on e10_18a_context to authenticated;

do $$
declare
  v_actor_a uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project uuid;
  v_quote_low uuid;
  v_quote_high uuid;
  v_quote_mid uuid;
  v_order_low uuid;
  v_order_high uuid;
  v_order_mid uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_a, 'e10-18a-actor-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-18a-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-18a-tenant-a', 'E10.18a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-18a-tenant-b', 'E10.18a Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.18a Client A', '73282932000074') returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_a, 'Projet E10.18a') returning id into v_project;

  -- Trois devis MINIMAUX distincts (quote_id UNIQUE sur commercial_orders).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-97001', 'draft', '2099-01-01', true) returning id into v_quote_low;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-97002', 'draft', '2099-01-01', true) returning id into v_quote_high;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-97003', 'draft', '2099-01-01', true) returning id into v_quote_mid;

  -- BORD BAS : 2026-08-31T22:30:00Z = 1er septembre 00h30 CEST a Paris.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id, created_at
  )
  values (v_tenant_a, v_customer_a, v_quote_low, 'CDE-2026-97001', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, null, timestamptz '2026-08-31T22:30:00Z')
  returning id into v_order_low;

  -- BORD HAUT (symetrique) : 2026-09-30T22:30:00Z = 1er octobre 00h30 CEST a Paris.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id, created_at
  )
  values (v_tenant_a, v_customer_a, v_quote_high, 'CDE-2026-97002', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, null, timestamptz '2026-09-30T22:30:00Z')
  returning id into v_order_high;

  -- Controle, franchement au milieu de septembre.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id, created_at
  )
  values (v_tenant_a, v_customer_a, v_quote_mid, 'CDE-2026-97003', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, null, timestamptz '2026-09-15T12:00:00Z')
  returning id into v_order_mid;

  insert into e10_18a_context (actor_a, actor_b, tenant_a, tenant_b, order_low, order_high, order_mid)
    values (v_actor_a, v_actor_b, v_tenant_a, v_tenant_b, v_order_low, v_order_high, v_order_mid);
end;
$$;

-- ── 1. Retrocompatibilite — 11 arguments (signature E10.13), aucun filtre ──
-- de periode applique : les trois commandes de test restent visibles.
do $$
declare
  v_tenant_a uuid;
  v_order_low uuid;
  v_order_high uuid;
  v_order_mid uuid;
  v_count integer;
begin
  select tenant_a, order_low, order_high, order_mid into v_tenant_a, v_order_low, v_order_high, v_order_mid
    from e10_18a_context;

  select count(*) into v_count
    from public.list_commercial_orders_by_production_step(
      v_tenant_a, null, null, null, null, false, 100, false, null, null, null
    )
   where id in (v_order_low, v_order_high, v_order_mid);

  if v_count <> 3 then
    raise exception 'retrocompatibilite 11 arguments : % commande(s) visible(s), attendu 3 (aucun filtre de periode)', v_count;
  end if;
end;
$$;

-- ── 2. Bornes INCLUSIVES aux deux bords d un mois, Europe/Paris ────────────
do $$
declare
  v_tenant_a uuid;
  v_order_low uuid;
  v_order_high uuid;
  v_order_mid uuid;
  v_ids uuid[];
begin
  select tenant_a, order_low, order_high, order_mid into v_tenant_a, v_order_low, v_order_high, v_order_mid
    from e10_18a_context;

  -- Septembre entier (bornes deja resolues en UTC par la route, telles que
  -- startOfDayInReferenceTimeZone('2026-09-01')/endOfDayInReferenceTimeZone('2026-09-30') les rendraient).
  select array_agg(id) into v_ids
    from public.list_commercial_orders_by_production_step(
      v_tenant_a, null, null, null, null, false, 100, false, null, null, null,
      timestamptz '2026-09-01T00:00:00+02:00', timestamptz '2026-09-30T23:59:59.999+02:00'
    )
   where id in (v_order_low, v_order_high, v_order_mid);

  if not (v_order_low = any(v_ids)) then
    raise exception 'BORD BAS : la commande a 2026-08-31T22:30:00Z (1er septembre a Paris) devrait entrer dans la demande de septembre';
  end if;
  if v_order_high = any(v_ids) then
    raise exception 'BORD HAUT : la commande a 2026-09-30T22:30:00Z (1er octobre a Paris) ne devrait PAS entrer dans la demande de septembre';
  end if;
  if not (v_order_mid = any(v_ids)) then
    raise exception 'commande de controle (15 septembre) absente de la demande de septembre';
  end if;

  -- Aout entier : la commande du bord bas en SORT (malgre un instant UTC
  -- encore le 31 aout).
  select array_agg(id) into v_ids
    from public.list_commercial_orders_by_production_step(
      v_tenant_a, null, null, null, null, false, 100, false, null, null, null,
      timestamptz '2026-08-01T00:00:00+02:00', timestamptz '2026-08-31T23:59:59.999+02:00'
    )
   where id in (v_order_low, v_order_high, v_order_mid);

  if v_ids is not null and v_order_low = any(v_ids) then
    raise exception 'BORD BAS (symetrique) : la commande a 2026-08-31T22:30:00Z devrait sortir de la demande d aout';
  end if;

  -- Octobre entier : la commande du bord haut y ENTRE (malgre un instant
  -- UTC encore le 30 septembre).
  select array_agg(id) into v_ids
    from public.list_commercial_orders_by_production_step(
      v_tenant_a, null, null, null, null, false, 100, false, null, null, null,
      timestamptz '2026-10-01T00:00:00+02:00', timestamptz '2026-10-31T23:59:59.999+02:00'
    )
   where id in (v_order_low, v_order_high, v_order_mid);

  if v_ids is null or not (v_order_high = any(v_ids)) then
    raise exception 'BORD HAUT (symetrique) : la commande a 2026-09-30T22:30:00Z devrait entrer dans la demande d octobre';
  end if;
end;
$$;

-- ── 3a. CONTROLE POSITIF — l acteur A voit bien SES commandes ──────────────
-- (qa-review E10.18a round 1, M4). Sous `authenticated`, PAS superuser :
-- c est la seule maniere de prouver que la fonction REND des lignes quand
-- l acces est legitime, et donc que le "0 ligne" de 3b prouve une isolation
-- reelle et non un defaut qui masquerait tout le monde.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_a::text from e10_18a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_order_low uuid;
  v_order_high uuid;
  v_order_mid uuid;
  v_visible integer;
begin
  select tenant_a, order_low, order_high, order_mid into v_tenant_a, v_order_low, v_order_high, v_order_mid
    from e10_18a_context;

  select count(*) into v_visible
    from public.list_commercial_orders_by_production_step(
      v_tenant_a, null, null, null, null, false, 100, false, null, null, null,
      timestamptz '2000-01-01T00:00:00Z', timestamptz '2100-01-01T00:00:00Z'
    )
   where id in (v_order_low, v_order_high, v_order_mid);

  if v_visible <> 3 then
    raise exception 'CONTROLE POSITIF : l acteur A (membre du tenant A, role authenticated) voit % commande(s) sur 3 attendues via list_commercial_orders_by_production_step — la fonction ne rend rien sous RLS, le controle negatif 3b serait alors une preuve d absence de resultat, pas d isolation', v_visible;
  end if;
end;
$$;

-- ── 3b. CONTROLE NEGATIF — inchange par l ajout des deux parametres ────────
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_18a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
begin
  select tenant_a into v_tenant_a from e10_18a_context;

  -- Un membre du tenant B, meme en fournissant explicitement p_tenant_id du
  -- tenant A et une periode qui couvre tout, ne doit voir AUCUNE commande :
  -- security invoker, la RLS commercial_orders_select s applique normalement.
  select count(*) into v_visible
    from public.list_commercial_orders_by_production_step(
      v_tenant_a, null, null, null, null, false, 100, false, null, null, null,
      timestamptz '2000-01-01T00:00:00Z', timestamptz '2100-01-01T00:00:00Z'
    );

  if v_visible <> 0 then
    raise exception 'un membre du tenant B lit % commande(s) du tenant A via list_commercial_orders_by_production_step — RLS rompue par l ajout des parametres de periode', v_visible;
  end if;
end;
$$;

reset role;

rollback;
