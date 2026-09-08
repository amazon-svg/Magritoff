-- ============================================================================
-- E10.13 — etapes de production configurables et ordonnancables :
-- seed du jeu standard a la creation d un tenant, RLS (isolation inter-tenant
-- + garde can_manage_production_steps EN BASE), creation (plafond, unicite du
-- libelle), suppression (409 in_use tenu par FK, reindexation), reordonnancement
-- (exhaustivite, deferrable), conversion d un devis (etape initiale posee /
-- null sans erreur si aucune etape active), tri du tableau de bord (CA6).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le seed, les
-- trois fonctions `api_*`, la RLS et le cablage de `api_convert_commercial_
-- quote` vivent ENTIEREMENT dans la migration `20260908020000` — une lecture
-- de son texte ne prouve pas qu ils se comportent correctement sous appel
-- reel (meme lecons que E10.9/E10.12).
--
-- Scenarios :
--   1. Seed a la creation d un tenant (CA1) : six etapes, dans l ordre exact,
--      « Livré » seule etape terminale.
--   2. RLS lecture : un membre du tenant B ne voit AUCUNE etape du tenant A.
--   3. RLS ecriture : un membre SANS can_manage_production_steps ne peut ni
--      creer (fonction) ni modifier (UPDATE direct) une etape de SON PROPRE
--      tenant ; un admin (capability par derivation) le peut.
--   4. api_create_production_step : position en fin de flux (= compte
--      courant), libelle unique NORMALISE (rejet meme sur une etape
--      DESACTIVEE), plafond de 50 (`production_step.limit_reached`).
--   5. api_delete_production_step : reindexation 0..n-1 des etapes restantes
--      dans la meme transaction ; `production_step.not_found` hors tenant.
--   6. updateProductionStep (UPDATE direct garde par la RLS) : renommage,
--      desactivation/reactivation, AUCUNE colonne `position` modifiable par
--      ce chemin (absente du contrat, jamais testee ici en ecriture directe
--      pour cette raison).
--   7. api_convert_commercial_quote (E10.13) : la conversion pose l etape
--      ACTIVE de position la plus basse sur la commande creee ; dans un
--      tenant dont TOUTES les etapes sont desactivees, la conversion REUSSIT
--      avec `current_production_step_id: null`.
--   8. CA3 : `deleteProductionStep` sur l etape portee par une commande
--      echoue en violation de cle etrangere (`production_step.in_use`),
--      TENUE EN BASE par `commercial_orders.current_production_step_id ...
--      on delete restrict`.
--   9. api_reorder_production_steps : reordonnancement valide (deferrable),
--      et rejet `production_step.positions_mismatch` sur un ensemble
--      incomplet/duplique.
--  10. `list_commercial_orders_by_production_step` (CA6) : tri croissant et
--      decroissant par etape courante, commandes SANS etape TOUJOURS en
--      dernier dans les deux sens.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_13_context (
  actor_admin   uuid not null,
  actor_member  uuid not null,
  actor_b       uuid not null,
  tenant_a      uuid not null,
  tenant_b      uuid not null,
  customer_a    uuid not null,
  step_recu     uuid not null,
  step_pao      uuid not null,
  step_valide   uuid not null,
  step_prod     uuid not null,
  step_exped    uuid not null,
  step_livre    uuid not null
);

grant select on e10_13_context to authenticated;

-- ── Prealables, joues en tant que postgres ─────────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_step_count integer;
  v_step_recu uuid;
  v_step_pao uuid;
  v_step_valide uuid;
  v_step_prod uuid;
  v_step_exped uuid;
  v_step_livre uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-13-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member, 'e10-13-member@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-13-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  -- ── 1. Seed a la creation d un tenant (CA1) — trigger tenants_seed_catalogs
  insert into public.tenants (slug, name) values ('e10-13-tenant-a', 'E10.13 Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-13-tenant-b', 'E10.13 Tenant B') returning id into v_tenant_b;

  select count(*) into v_step_count from public.production_steps where tenant_id = v_tenant_a;
  if v_step_count <> 6 then
    raise exception 'seed_tenant_catalogs() : % etape(s) seedee(s) pour un tenant neuf (attendu 6)', v_step_count;
  end if;

  select id into v_step_recu   from public.production_steps where tenant_id = v_tenant_a and position = 0;
  select id into v_step_pao    from public.production_steps where tenant_id = v_tenant_a and position = 1;
  select id into v_step_valide from public.production_steps where tenant_id = v_tenant_a and position = 2;
  select id into v_step_prod   from public.production_steps where tenant_id = v_tenant_a and position = 3;
  select id into v_step_exped  from public.production_steps where tenant_id = v_tenant_a and position = 4;
  select id into v_step_livre  from public.production_steps where tenant_id = v_tenant_a and position = 5;

  if (select label from public.production_steps where id = v_step_recu) <> 'Fichier reçu' then
    raise exception 'position 0 inattendue : %', (select label from public.production_steps where id = v_step_recu);
  end if;
  if (select label from public.production_steps where id = v_step_livre) <> 'Livré' then
    raise exception 'position 5 inattendue : %', (select label from public.production_steps where id = v_step_livre);
  end if;
  if (select is_terminal from public.production_steps where id = v_step_livre) is not true then
    raise exception '« Livré » doit etre la seule etape terminale';
  end if;
  if exists (select 1 from public.production_steps where tenant_id = v_tenant_a and id <> v_step_livre and is_terminal) then
    raise exception 'une etape autre que « Livré » est terminale a la creation';
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.13 Client A', '73282932000074') returning id into v_customer_a;

  insert into e10_13_context (
    actor_admin, actor_member, actor_b, tenant_a, tenant_b, customer_a,
    step_recu, step_pao, step_valide, step_prod, step_exped, step_livre
  ) values (
    v_actor_admin, v_actor_member, v_actor_b, v_tenant_a, v_tenant_b, v_customer_a,
    v_step_recu, v_step_pao, v_step_valide, v_step_prod, v_step_exped, v_step_livre
  );
end;
$$;

-- ── 2. RLS lecture — un membre du tenant B ne voit rien du tenant A ────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_13_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
begin
  select tenant_a into v_tenant_a from e10_13_context;
  select count(*) into v_visible from public.production_steps where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % etape(s) du tenant A — production_steps_select rompue', v_visible;
  end if;
end;
$$;

reset role;

-- ── 3. RLS ecriture — membre SANS can_manage_production_steps refuse ───────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_13_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_step_pao uuid;
  v_updated integer;
begin
  select tenant_a, step_pao into v_tenant_a, v_step_pao from e10_13_context;

  update public.production_steps set label = 'PAO modifie' where id = v_step_pao;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'un membre SANS can_manage_production_steps a pu modifier une etape (production_steps_write rompue)';
  end if;
end;
$$;

reset role;

-- api_create_production_step, sous l acteur SANS le droit -> permission_denied.
do $$
declare
  v_tenant_a uuid;
  v_actor_member uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_member into v_tenant_a, v_actor_member from e10_13_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_create_production_step(v_tenant_a, 'Etape refusee', 'slate', false);
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un membre SANS can_manage_production_steps a pu creer une etape (attendu permission_denied)';
  end if;
end;
$$;

-- ── 4. api_create_production_step, sous l ADMIN (capability par derivation) ─
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_created public.production_steps;
  v_normalized_conflict boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_13_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_created := public.api_create_production_step(v_tenant_a, 'Controle qualite', 'red', false);
  reset role;

  if v_created.position <> 6 then
    raise exception 'position de la 7e etape inattendue : % (attendu 6, fin de flux)', v_created.position;
  end if;

  -- Libelle deja pris, meme normalise (casse/espaces), y compris via l index
  -- unique fonctionnel — teste directement l INSERT (le chemin de l API
  -- passera par la meme contrainte).
  begin
    insert into public.production_steps (tenant_id, label, position, color, is_terminal)
    values (v_tenant_a, '  pao  ', 99, 'blue', false);
  exception
    when unique_violation then v_normalized_conflict := true;
  end;
  if not v_normalized_conflict then
    raise exception 'un libelle "  pao  " a ete accepte alors que "PAO" existe deja (unicite normalisee)';
  end if;
end;
$$;

-- Plafond de 50 etapes (production_step.limit_reached).
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_i integer;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_13_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 7 etapes existent deja (6 seed + 1 creee ci-dessus) : 43 de plus portent
  -- le total a 50, la 51e doit etre refusee.
  for v_i in 1..43 loop
    perform public.api_create_production_step(v_tenant_a, 'Etape generee ' || v_i::text, 'slate', false);
  end loop;

  begin
    perform public.api_create_production_step(v_tenant_a, 'Etape en trop', 'slate', false);
  exception
    when others then
      if sqlerrm like 'production_step.limit_reached%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une 51e etape a ete creee (attendu production_step.limit_reached)';
  end if;
end;
$$;

-- Nettoyage des 44 etapes generees pour ce scenario (garde le reste des
-- scenarios lisible sur le jeu standard de 7).
delete from public.production_steps
 where tenant_id = (select tenant_a from e10_13_context)
   and label like 'Etape generee %';

-- Reindexation apres ce nettoyage manuel (hors fonction : nettoyage de test,
-- pas un geste API) pour que les scenarios suivants retrouvent 0..6 contigus.
do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_13_context;
  with ranked as (
    select id, row_number() over (order by position) - 1 as new_position
    from public.production_steps where tenant_id = v_tenant_a
  )
  update public.production_steps ps set position = ranked.new_position
    from ranked where ps.id = ranked.id and ps.position <> ranked.new_position;
end;
$$;

-- ── 5. api_delete_production_step — reindexation, not_found hors tenant ────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_controle_id uuid;
  v_controle_position integer;
  v_after_position integer;
  v_not_found boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_13_context;
  select id, position into v_controle_id, v_controle_position
    from public.production_steps where tenant_id = v_tenant_a and label = 'Controle qualite';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.api_delete_production_step(v_tenant_a, v_controle_id);
  reset role;

  if exists (select 1 from public.production_steps where id = v_controle_id) then
    raise exception 'l etape "Controle qualite" existe encore apres suppression';
  end if;

  -- Aucun trou : le nombre d etapes a une position >= v_controle_position
  -- doit etre CONTIGU a partir de v_controle_position.
  select count(*) into v_after_position
    from public.production_steps
   where tenant_id = v_tenant_a and position >= v_controle_position;
  if exists (
    select 1 from public.production_steps
     where tenant_id = v_tenant_a and position > v_controle_position + v_after_position
  ) then
    raise exception 'un trou subsiste dans les positions apres suppression';
  end if;

  -- Suppression d une etape d un AUTRE tenant -> not_found.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_delete_production_step(v_tenant_a, gen_random_uuid());
  exception
    when others then
      if sqlerrm like 'production_step.not_found%' then v_not_found := true; else reset role; raise; end if;
  end;
  reset role;
  if not v_not_found then
    raise exception 'la suppression d un id inexistant a reussi (attendu production_step.not_found)';
  end if;
end;
$$;

-- ── 6. updateProductionStep (UPDATE direct garde par la RLS) ───────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_step_pao uuid;
  v_updated integer;
begin
  select tenant_a, actor_admin, step_pao into v_tenant_a, v_actor_admin, v_step_pao from e10_13_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.production_steps set label = 'PAO (renommee)', is_active = false where id = v_step_pao;
  get diagnostics v_updated = row_count;
  reset role;

  if v_updated <> 1 then
    raise exception 'un admin n a pas pu renommer/desactiver une etape de son tenant (% ligne(s))', v_updated;
  end if;
  if (select is_active from public.production_steps where id = v_step_pao) is not false then
    raise exception 'la desactivation de PAO n a pas ete appliquee';
  end if;

  -- Reactivation, pour laisser un jeu standard actif aux scenarios suivants.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.production_steps set label = 'PAO', is_active = true where id = v_step_pao;
  reset role;
end;
$$;

-- ── 7. api_convert_commercial_quote : etape initiale posee a la conversion ─
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_customer_a uuid;
  v_step_recu uuid;
  v_project uuid;
  v_quote uuid;
  v_order uuid;
  v_current_step uuid;
begin
  select tenant_a, actor_admin, customer_a, step_recu
    into v_tenant_a, v_actor_admin, v_customer_a, v_step_recu
    from e10_13_context;

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_a, 'Projet E10.13') returning id into v_project;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-95001', 'draft', '2099-01-01', true)
    returning id into v_quote;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote, null, 'free', 'Flyers E10.13', 100, 0, 40.00, 80.00, 80.00, 1.0000, 80.00, 0.0000, '[{"post":"total","cost":"40.00","margin_rate":"1.0000","price":"80.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote;
  perform set_config('magrit.quote_transition', '', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.api_convert_commercial_quote(v_tenant_a, v_quote) into v_order;
  reset role;

  select current_production_step_id into v_current_step from public.commercial_orders where id = v_order;
  if v_current_step is distinct from v_step_recu then
    raise exception 'etape initiale inattendue : % (attendu l etape de position 0, %)', v_current_step, v_step_recu;
  end if;

  -- Publie l id de la commande pour les scenarios suivants via une table
  -- dediee (e10_13_context n a pas de colonne prevue pour elle).
  create temporary table if not exists e10_13_order_context (order_id uuid, quote_id uuid, step_recu_id uuid);
  insert into e10_13_order_context (order_id, quote_id, step_recu_id) values (v_order, v_quote, v_step_recu);
end;
$$;

-- ── 8. CA3 : suppression de l etape portee par une commande -> in_use ──────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_step_recu uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin from e10_13_context into v_tenant_a, v_actor_admin;
  select step_recu_id into v_step_recu from e10_13_order_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_delete_production_step(v_tenant_a, v_step_recu);
  exception
    when others then
      if sqlerrm like 'production_step.in_use%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'l etape portee par une commande a pu etre supprimee (attendu production_step.in_use, CA3)';
  end if;

  if not exists (select 1 from public.production_steps where id = v_step_recu) then
    raise exception 'l etape portee par une commande a disparu malgre le refus attendu';
  end if;
end;
$$;

-- ── Conversion dans un tenant SANS AUCUNE etape active : null, pas d erreur ─
do $$
declare
  v_tenant_c uuid;
  v_actor_c uuid := gen_random_uuid();
  v_customer_c uuid;
  v_project_c uuid;
  v_quote_c uuid;
  v_order_c uuid;
  v_current_step uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor_c, 'e10-13-actor-c@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenants (slug, name) values ('e10-13-tenant-c', 'E10.13 Tenant C (sans etape active)') returning id into v_tenant_c;
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_c, v_actor_c, 'admin', 'magrit_full', '{}');
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_c, 'company', 'E10.13 Client C', '73282932000074') returning id into v_customer_c;

  -- Desactive TOUTES les etapes seedees (un administrateur peut le faire :
  -- aucune garde ne l en empeche).
  update public.production_steps set is_active = false where tenant_id = v_tenant_c;

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_c, v_customer_c, 'Projet C') returning id into v_project_c;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_c, v_customer_c, v_project_c, 'DEV-2026-95002', 'draft', '2099-01-01', true)
    returning id into v_quote_c;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_c, null, 'free', 'Article C', 1, 0, 10.00, 20.00, 20.00, 1.0000, 20.00, 0.0000, '[{"post":"total","cost":"10.00","margin_rate":"1.0000","price":"20.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_c;
  perform set_config('magrit.quote_transition', '', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_c::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.api_convert_commercial_quote(v_tenant_c, v_quote_c) into v_order_c;
  reset role;

  if v_order_c is null then
    raise exception 'la conversion dans un tenant sans etape active a leve une erreur (attendu : succes, current_production_step_id null)';
  end if;

  select current_production_step_id into v_current_step from public.commercial_orders where id = v_order_c;
  if v_current_step is not null then
    raise exception 'current_production_step_id inattendu : % (attendu null, tenant sans etape active)', v_current_step;
  end if;
end;
$$;

-- ── 9. api_reorder_production_steps ─────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_ids uuid[];
  v_reversed uuid[];
  v_first_label text;
  v_last_label text;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_13_context;

  select array_agg(id order by position) into v_ids
    from public.production_steps where tenant_id = v_tenant_a;
  select array_agg(id order by position desc) into v_reversed
    from public.production_steps where tenant_id = v_tenant_a;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.api_reorder_production_steps(v_tenant_a, v_reversed);
  reset role;

  select label into v_first_label from public.production_steps where tenant_id = v_tenant_a and position = 0;
  select label into v_last_label from public.production_steps
    where tenant_id = v_tenant_a and position = (select max(position) from public.production_steps where tenant_id = v_tenant_a);
  if v_first_label <> 'Livré' then
    raise exception 'apres inversion, position 0 devrait etre "Livré", obtenu %', v_first_label;
  end if;
  if v_last_label <> 'Fichier reçu' then
    raise exception 'apres inversion, la derniere position devrait etre "Fichier reçu", obtenu %', v_last_label;
  end if;

  -- Remet l ordre standard pour la lisibilite du scenario 10.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.api_reorder_production_steps(v_tenant_a, v_ids);
  reset role;

  -- Ensemble incomplet -> positions_mismatch, AUCUNE position changee.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_reorder_production_steps(v_tenant_a, v_ids[1:array_length(v_ids,1)-1]);
  exception
    when others then
      if sqlerrm like 'production_step.positions_mismatch%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;
  if not v_rejected then
    raise exception 'un reordonnancement incomplet a reussi (attendu production_step.positions_mismatch)';
  end if;
end;
$$;

-- ── 10. Tri par etape courante (CA6) — nulls toujours en dernier ───────────
do $$
declare
  v_tenant_a uuid;
  v_customer_a uuid;
  v_step_pao uuid;
  v_step_livre uuid;
  v_project uuid;
  v_quote_pao uuid;
  v_quote_livre uuid;
  v_quote_null uuid;
  v_order_pao uuid;
  v_order_livre uuid;
  v_order_null uuid;
begin
  select tenant_a, customer_a, step_pao, step_livre into v_tenant_a, v_customer_a, v_step_pao, v_step_livre from e10_13_context;

  select id into v_project from public.projects where tenant_id = v_tenant_a limit 1;

  -- Trois devis MINIMAUX distincts (`commercial_orders.quote_id` est UNIQUE :
  -- trois commandes exigent trois devis), pour trois commandes directement
  -- inserees (hors conversion, pour maitriser l etape courante de chacune
  -- independamment) : une sur PAO, une sur "Livré", une SANS etape (null).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-96001', 'draft', '2099-01-01', true) returning id into v_quote_pao;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-96002', 'draft', '2099-01-01', true) returning id into v_quote_livre;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-96003', 'draft', '2099-01-01', true) returning id into v_quote_null;

  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id
  )
  values (v_tenant_a, v_customer_a, v_quote_pao, 'CDE-2026-90001', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, v_step_pao)
  returning id into v_order_pao;

  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id
  )
  values (v_tenant_a, v_customer_a, v_quote_livre, 'CDE-2026-90002', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, v_step_livre)
  returning id into v_order_livre;

  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id
  )
  values (v_tenant_a, v_customer_a, v_quote_null, 'CDE-2026-90003', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, null)
  returning id into v_order_null;

  -- Tri croissant (`production_step`) : PAO (position 1) avant Livré
  -- (position 5), la commande SANS etape toujours en dernier. Le rang
  -- (`row_number() over ()`) est calcule APRES le filtre `where id in (...)`
  -- dans la MEME sous-requete (ordre logique SQL : FROM -> WHERE -> fenetre),
  -- donc sur l ordre REEL rendu par la fonction, jamais un ORDER BY
  -- applicatif ajoute ici.
  if not exists (
    select 1 from (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, false, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_pao
    join (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, false, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_livre on ranked_pao.id = v_order_pao and ranked_livre.id = v_order_livre and ranked_pao.rn < ranked_livre.rn
  ) then
    raise exception 'tri ascendant : la commande sur PAO (position 1) devrait venir avant celle sur Livre (position 5)';
  end if;

  if not exists (
    select 1 from (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, false, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_livre
    join (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, false, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_null on ranked_livre.id = v_order_livre and ranked_null.id = v_order_null and ranked_livre.rn < ranked_null.rn
  ) then
    raise exception 'tri ascendant : la commande SANS etape devrait toujours venir en dernier';
  end if;

  -- Tri DECROISSANT : Livré (position 5) avant PAO (position 1), la commande
  -- SANS etape TOUJOURS en dernier malgre l inversion.
  if not exists (
    select 1 from (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, true, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_livre
    join (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, true, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_pao on ranked_livre.id = v_order_livre and ranked_pao.id = v_order_pao and ranked_livre.rn < ranked_pao.rn
  ) then
    raise exception 'tri descendant : la commande sur Livre (position 5) devrait venir avant celle sur PAO (position 1)';
  end if;

  if not exists (
    select 1 from (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, true, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_pao
    join (
      select id, row_number() over () as rn
        from public.list_commercial_orders_by_production_step(
          v_tenant_a, null, null, null, null, true, 100, false, null, null, null
        )
       where id in (v_order_pao, v_order_livre, v_order_null)
    ) ranked_null on ranked_pao.id = v_order_pao and ranked_null.id = v_order_null and ranked_pao.rn < ranked_null.rn
  ) then
    raise exception 'tri descendant : la commande SANS etape devrait toujours venir en dernier (nulls last dans les deux sens)';
  end if;

  -- Filtre `current_production_step_id` : ne retient que la commande sur PAO.
  if (
    select count(*) from public.list_commercial_orders_by_production_step(
      v_tenant_a, null, null, null, v_step_pao, false, 100, false, null, null, null
    ) where id in (v_order_pao, v_order_livre, v_order_null)
  ) <> 1 then
    raise exception 'le filtre current_production_step_id ne retient pas exactement une commande';
  end if;
end;
$$;

rollback;
