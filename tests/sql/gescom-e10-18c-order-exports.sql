-- ============================================================================
-- E10.18c — la ressource, la file, LE CHEMIN DE LECTURE et le CSV. Migration
-- `20260913000000_gescom_e10_18c_order_exports.sql`. Contrat :
-- docs/api/CONVENTIONS.md §8.24, points 3/4/5/6/8 (ligne E10.18c).
-- ----------------------------------------------------------------------------
-- CE QUE CE FICHIER PROUVE — et c est le SEUL fichier de toute la story qui
-- le peut (contrat : « c est ici, et seulement ici, que l ISOLATION DE
-- TENANT se prouve ») :
--   1. RLS de `commercial_order_exports` — GARDEE PAR CAPABILITY (pas
--      seulement le tenant) : un membre SANS `can_export_orders` ne voit
--      RIEN, meme dans son propre tenant ; un porteur du droit ne voit
--      JAMAIS les lignes d un autre tenant.
--   2. Immuabilite (trigger) — colonnes de definition figees, DELETE
--      TOUJOURS refuse (contrairement a `notification_logs`), machine a
--      etats du statut (`expired`/`failed` sont des puits, `ready` ne peut
--      plus que passer `expired`).
--   3. `api_request_order_export` — cree la demande, `permission_denied`
--      sans le droit, `order_export.pending_limit_reached` a la 4e demande
--      non terminee du meme acteur.
--   4. `api_claim_order_exports` — reclamation atomique (`running`,
--      `attempts`+1, `started_at`), rebut par fraicheur sans generation.
--   5. `api_read_order_export_rows` — LE CŒUR DE CE LOT : un export du
--      tenant A ne rend JAMAIS une ligne du tenant B (meme quand un ordre
--      tres proche existe cote B), les filtres enregistres (customer_id,
--      date) s appliquent EN SQL, la pagination par cle avance sans trou ni
--      doublon, les colonnes TECHNIQUES (tenant_id/order_id/line_id)
--      n apparaissent JAMAIS dans `row`, et chaque valeur NUMERIQUE arrive
--      en CHAINE JSON (jamais un nombre natif — condition du point de
--      conversion unique cote generateur).
--   6. Privileges d execution — `api_claim_order_exports`/
--      `api_read_order_export_rows` : `service_role` SEUL.
--      `api_request_order_export` : `authenticated` SEUL (ni anon, ni
--      service_role).
--   7. `api_claim_order_exports_for_purge()` + `api_confirm_order_export_
--      files_purged()` (REECRIT qa-review round 2, BLOQUANT) — un export
--      `ready` ECHU passe `expired` et REND son `storage_path` (la ligne
--      SURVIT, contrat point 3(f)) ; un export `ready` NON ECHU n est
--      jamais reclame ; un export `expired` dont `storage_path` reste NON
--      NUL (retrait Storage pas encore confirme) EST RE-RECLAME au tour
--      suivant (REPRISE, corrige — ce n etait pas le cas avant round 2) ;
--      une confirmation efface `storage_path` et ferme l invariant : un
--      export CONFIRME n est plus jamais reclame. La destruction REELLE de
--      l objet Storage (Edge Function `magrit-order-file-purge`, ETENDUE)
--      n est pas du ressort de ce test SQL.
--   8. `purge_attempts` (REECRIT qa-review round 3, mecanisme (a) de
--      l arbitrage) — plafonne a TROIS reclamations SANS confirmation ;
--      au-dela, la ligne N EST PLUS RECLAMEE, reste `expired`/`storage_path`
--      non nul/`purge_attempts`=3 — ETAT VISIBLE, pas un nouveau statut.
--   9. `api_claim_orphan_order_export_objects()` (AJOUTE qa-review round 3,
--      mecanisme (c), SOLUTION PORTEUSE) — categorie (a) objet SANS AUCUNE
--      ligne dont `storage_path` le reference, au-dela de la marge de 24h
--      (fenetre depot->markReady) ; categorie (b) ligne `expired` dont
--      `purge_attempts` est EPUISE, SANS delai supplementaire, avec
--      `matched_export_id` correct ; ligne VIVANTE et objet d un AUTRE
--      bucket JAMAIS candidats ; privileges `authenticated`/`anon` refuses.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre), ou
-- individuellement :
--   docker exec -i supabase_db_magritoff-v5 psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
--     < tests/sql/gescom-e10-18c-order-exports.sql
-- ============================================================================

begin;

create temporary table e10_18c_context (
  tenant_a    uuid not null,
  tenant_b    uuid not null,
  actor_a     uuid not null,  -- admin tenant A (porte can_export_orders par derivation)
  actor_a2    uuid not null,  -- membre simple tenant A (SANS can_export_orders)
  actor_b     uuid not null,  -- admin tenant B
  order_a     uuid not null,  -- tenant A, 2 lignes, cree le 2026-03-15
  order_a2    uuid not null,  -- tenant A, 1 ligne, cree le 2026-06-01 (hors periode de filtre)
  order_b     uuid not null,  -- tenant B, DONNEES VOISINES (meme raison sociale que order_a)
  customer_a  uuid not null
);

grant select on e10_18c_context to authenticated, anon;

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_actor_a uuid := gen_random_uuid();
  v_actor_a2 uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_quote_a uuid;
  v_quote_a2 uuid;
  v_quote_b uuid;
  v_qline_a1 uuid;
  v_qline_a2 uuid;
  v_qline_a3 uuid;
  v_qline_b uuid;
  v_order_a uuid;
  v_order_a2 uuid;
  v_order_b uuid;
  v_step_a uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_a, 'e10-18c-actor-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_a2, 'e10-18c-actor-a2@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-18c-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-18c-tenant-a', 'E10.18c Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-18c-tenant-b', 'E10.18c Tenant B') returning id into v_tenant_b;

  -- actor_a = admin (porte can_export_orders par derivation d appartenance) ;
  -- actor_a2 = membre SIMPLE (aucune capacite metier), scenario 1.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a2, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.18c Client Frontiere', '73282932000074')
    returning id into v_customer_a;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.18c Client Frontiere', '39872154200011')
    returning id into v_customer_b;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet E10.18c A') returning id into v_project_a;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet E10.18c B') returning id into v_project_b;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-99001', 'draft', '2099-01-01', true)
    returning id into v_quote_a;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-99002', 'draft', '2099-01-01', true)
    returning id into v_quote_a2;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_b, v_project_b, 'DEV-2026-99003', 'draft', '2099-01-01', true)
    returning id into v_quote_b;

  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a, null, 'free', 'Depliants A5', 3, 0, 300.00, 1200.00, 1100.00, 1.0000, 1000.00, 0.0909,
            '[{"post":"total","cost":"300.00","margin_rate":"1.0000","price":"1200.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_a1;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a, null, 'free', 'Flyers A6', 1000, 1, 50.00, 120.00, 95.00, 1.0000, 90.00, 0.0526,
            '[{"post":"total","cost":"50.00","margin_rate":"1.0000","price":"120.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_a2;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a2, null, 'free', 'Cartes de visite', 10, 0, 20.00, 110.00, 105.00, 1.0000, 100.00, 0.0476,
            '[{"post":"total","cost":"20.00","margin_rate":"1.0000","price":"110.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_a3;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_b, null, 'free', 'Affiches A3', 2, 0, 40.00, 260.00, 260.00, 1.0000, 260.00, 0.0000,
            '[{"post":"total","cost":"40.00","margin_rate":"1.0000","price":"260.00","source":"prix_marche"}]'::jsonb)
    returning id into v_qline_b;

  select id into v_step_a from public.production_steps where tenant_id = v_tenant_a order by position limit 1;

  -- order_a : TENANT A, 2 lignes, CREE LE 2026-03-15 (dans la periode de test).
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax,
    current_production_step_id, created_at
  ) values (
    v_tenant_a, v_customer_a, v_quote_a, 'CDE-2026-99001', 'validated', 'sent',
    1090.00, 0.00, 0.0000, 1090.00,
    0.2000, 'metropole_fr', 218.00, 1308.00,
    v_step_a, '2026-03-15T10:00:00+00:00'
  ) returning id into v_order_a;

  -- order_a2 : TENANT A, 1 ligne, CREE LE 2026-06-01 (HORS de la periode de
  -- test 2026-03-01..2026-03-31) — verifie le filtre created_from/created_to.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax,
    current_production_step_id, created_at
  ) values (
    v_tenant_a, v_customer_a, v_quote_a2, 'CDE-2026-99002', 'validated', 'accepted',
    100.00, 0.00, 0.0000, 100.00,
    0.2000, 'metropole_fr', 20.00, 120.00,
    null, '2026-06-01T10:00:00+00:00'
  ) returning id into v_order_a2;

  -- order_b : TENANT B, DONNEES VOISINES (meme raison sociale, MEME PERIODE
  -- que order_a) — c est la commande qui doit RESTER INVISIBLE d un export
  -- du tenant A, meme si rien ne la distingue a l oeil nu.
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax,
    current_production_step_id, created_at
  ) values (
    v_tenant_b, v_customer_b, v_quote_b, 'CDE-2026-99003', 'validated', 'sent',
    260.00, 0.00, 0.0000, 260.00,
    0.2000, 'metropole_fr', 52.00, 312.00,
    null, '2026-03-15T10:00:00+00:00'
  ) returning id into v_order_b;

  insert into public.commercial_order_lines (order_id, source_quote_line_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_order_a, v_qline_a1, 'free', 'Depliants A5', 3, 0, 300.00, 1200.00, 1100.00, 1.0000, 1000.00, 0.0909,
            '[{"post":"total","cost":"300.00","margin_rate":"1.0000","price":"1200.00","source":"prix_marche"}]'::jsonb);
  insert into public.commercial_order_lines (order_id, source_quote_line_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_order_a, v_qline_a2, 'free', 'Flyers A6', 1000, 1, 50.00, 120.00, 95.00, 1.0000, 90.00, 0.0526,
            '[{"post":"total","cost":"50.00","margin_rate":"1.0000","price":"120.00","source":"prix_marche"}]'::jsonb);
  insert into public.commercial_order_lines (order_id, source_quote_line_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_order_a2, v_qline_a3, 'free', 'Cartes de visite', 10, 0, 20.00, 110.00, 105.00, 1.0000, 100.00, 0.0476,
            '[{"post":"total","cost":"20.00","margin_rate":"1.0000","price":"110.00","source":"prix_marche"}]'::jsonb);
  insert into public.commercial_order_lines (order_id, source_quote_line_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_order_b, v_qline_b, 'free', 'Affiches A3', 2, 0, 40.00, 260.00, 260.00, 1.0000, 260.00, 0.0000,
            '[{"post":"total","cost":"40.00","margin_rate":"1.0000","price":"260.00","source":"prix_marche"}]'::jsonb);

  insert into e10_18c_context (tenant_a, tenant_b, actor_a, actor_a2, actor_b, order_a, order_a2, order_b, customer_a)
  values (v_tenant_a, v_tenant_b, v_actor_a, v_actor_a2, v_actor_b, v_order_a, v_order_a2, v_order_b, v_customer_a);
end;
$$;

-- ── 1 — RLS : gardee par CAPABILITY, ET par TENANT ───────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
begin
  select tenant_a, tenant_b into v_tenant_a, v_tenant_b from e10_18c_context;

  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters)
    values (v_tenant_a, 'pending', 'csv', 'order', '{}'::jsonb);
  -- Tenant B : statut `expired` DES LE DEPART (pas `pending`) — ce scenario
  -- ne teste que la VISIBILITE (RLS), pas la file de reclamation ; une ligne
  -- `pending` laissee ici serait ensuite claimee par le scenario 4 (le drain
  -- de generation balaie TOUS les tenants) et fausserait son compte attendu.
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters)
    values (v_tenant_b, 'expired', 'csv', 'order', '{}'::jsonb);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_a::text from e10_18c_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.commercial_order_exports where tenant_id = (select tenant_a from e10_18c_context);
  if v_n <> 1 then
    raise exception 'scenario 1 : admin tenant A devrait voir 1 export, obtenu %', v_n;
  end if;

  select count(*) into v_n from public.commercial_order_exports where tenant_id = (select tenant_b from e10_18c_context);
  if v_n <> 0 then
    raise exception 'scenario 1 (MAJEUR) : admin tenant A a pu lire % export(s) du tenant B', v_n;
  end if;

  raise notice 'scenario 1a (RLS, admin tenant A voit son export, jamais celui de B) OK';
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_a2::text from e10_18c_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_n integer;
begin
  -- Membre SIMPLE, SANS can_export_orders : ne voit RIEN, meme dans son
  -- propre tenant — la RLS de ce module GARDE PAR CAPABILITY, pas seulement
  -- par appartenance (ecart deliberer avec le reste du depot).
  select count(*) into v_n from public.commercial_order_exports where tenant_id = (select tenant_a from e10_18c_context);
  if v_n <> 0 then
    raise exception 'scenario 1b (MAJEUR) : un membre SANS can_export_orders a pu lire % export(s) de son propre tenant', v_n;
  end if;

  raise notice 'scenario 1b (RLS, membre simple SANS can_export_orders ne voit rien) OK';
end;
$$;

reset role;

-- ── 2 — Immuabilite (trigger) : colonnes figees, DELETE TOUJOURS refuse ────
do $$
declare
  v_id uuid;
  v_tenant_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_18c_context;
  select id into v_id from public.commercial_order_exports where tenant_id = v_tenant_a limit 1;

  -- Colonnes de suivi : mutables.
  update public.commercial_order_exports set status = 'running', started_at = now(), attempts = 1 where id = v_id;
  if (select status from public.commercial_order_exports where id = v_id) <> 'running' then
    raise exception 'scenario 2 : status aurait du etre mutable';
  end if;

  -- Definition : immuable (filters).
  begin
    update public.commercial_order_exports set filters = '{"customer_id": "00000000-0000-0000-0000-000000000000"}'::jsonb where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'commercial_order_exports_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : les filtres d un export ont pu etre reecrits apres insertion';
  end if;

  -- Definition : immuable (format/granularity).
  v_rejected := false;
  begin
    update public.commercial_order_exports set granularity = 'line' where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'commercial_order_exports_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : la granularite d un export a pu etre reecrite apres insertion';
  end if;

  -- Machine a etats : ready -> pending REFUSE.
  update public.commercial_order_exports set status = 'ready', completed_at = now(), row_count = 0 where id = v_id;
  v_rejected := false;
  begin
    update public.commercial_order_exports set status = 'pending' where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'commercial_order_exports_status_terminal:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : un export ready a pu revenir a pending';
  end if;

  -- Machine a etats : ready -> expired AUTORISE.
  update public.commercial_order_exports set status = 'expired' where id = v_id;
  if (select status from public.commercial_order_exports where id = v_id) <> 'expired' then
    raise exception 'scenario 2 : ready -> expired aurait du etre accepte';
  end if;

  -- Machine a etats : expired est un PUITS.
  v_rejected := false;
  begin
    update public.commercial_order_exports set status = 'ready' where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'commercial_order_exports_status_terminal:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : un export expired a pu changer de statut';
  end if;

  -- DELETE TOUJOURS REFUSE (contrairement a notification_logs) — c est LA
  -- seule preuve durable d un acces massif, elle ne se purge jamais.
  v_rejected := false;
  begin
    delete from public.commercial_order_exports where id = v_id;
  exception
    when insufficient_privilege then
      if sqlerrm like 'commercial_order_exports_immutable:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 (MAJEUR) : un export a pu etre SUPPRIME';
  end if;

  raise notice 'scenario 2 (immuabilite, machine a etats, DELETE toujours refuse) OK';
end;
$$;

-- Rien a nettoyer ici : DELETE est TOUJOURS refuse sur cette table (scenario
-- 2 vient de le prouver), y compris pour la session de test. Sans
-- consequence sur le scenario 3 : la ligne laissee par les scenarios 1/2 est
-- `expired` (TERMINALE), et le plafond de `api_request_order_export` ne
-- compte que `pending`/`running`.

-- ── 3 — api_request_order_export : creation, droit, plafond ─────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_a::text from e10_18c_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_row public.commercial_order_exports;
begin
  select tenant_a into v_tenant_a from e10_18c_context;

  v_row := public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
  if v_row.status <> 'pending' or v_row.requested_by is distinct from (select actor_a from e10_18c_context) then
    raise exception 'scenario 3 : la demande devrait etre pending, portee par l acteur';
  end if;
  if v_row.requested_by_label is null or v_row.requested_by_label !~ '@' then
    raise exception 'scenario 3 : requested_by_label devrait etre resolu (email) — obtenu %', v_row.requested_by_label;
  end if;

  raise notice 'scenario 3a (creation, requested_by/label resolus) OK';
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_denied boolean := false;
begin
  select tenant_a into v_tenant_a from e10_18c_context;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', (select actor_a2::text from e10_18c_context), 'role', 'authenticated')::text, true);

  begin
    perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
  exception
    when others then
      if sqlerrm like '%permission_denied%' then v_denied := true; else raise; end if;
  end;
  if not v_denied then
    raise exception 'scenario 3b (MAJEUR) : un membre SANS can_export_orders a pu demander un export';
  end if;
  raise notice 'scenario 3b (permission_denied sans le droit) OK';
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_a::text from e10_18c_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_denied boolean := false;
begin
  select tenant_a into v_tenant_a from e10_18c_context;
  -- Une demande deja creee au scenario 3a : DEUX de plus portent le total a
  -- trois demandes non terminees ; la QUATRIEME doit etre refusee.
  perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
  perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);

  begin
    perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
  exception
    when others then
      if sqlerrm like '%order_export.pending_limit_reached%' then v_denied := true; else raise; end if;
  end;
  if not v_denied then
    raise exception 'scenario 3c (MAJEUR) : une quatrieme demande non terminee aurait du etre refusee';
  end if;
  raise notice 'scenario 3c (plafond de trois demandes non terminees) OK';
end;
$$;

reset role;

-- ── 4 — api_claim_order_exports : reclamation, rebut par fraicheur ──────────
do $$
declare
  v_tenant_a uuid;
  v_n integer;
  v_stale_id uuid;
begin
  select tenant_a into v_tenant_a from e10_18c_context;

  -- Trois demandes `pending` existent deja (scenario 3). On en ajoute une
  -- QUATRIEME, ARTIFICIELLEMENT VIEILLE, pour le rebut par fraicheur.
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters, requested_at, next_attempt_at)
    values (v_tenant_a, 'pending', 'csv', 'order', '{}'::jsonb, now() - interval '1 hour', now() - interval '1 hour')
    returning id into v_stale_id;

  set local role service_role;

  select count(*) into v_n from public.api_claim_order_exports(10, 3, interval '15 minutes');
  -- Trois demandes FRAICHES reclamees (running) + zero pour la stale
  -- (rebutee directement en failed, jamais rendue par la fonction).
  if v_n <> 3 then
    raise exception 'scenario 4a : trois demandes fraiches auraient du etre reclamees, obtenu %', v_n;
  end if;

  reset role;

  if (select status from public.commercial_order_exports where id = v_stale_id) <> 'failed' then
    raise exception 'scenario 4a (MAJEUR) : la demande stale aurait du etre rebutee en failed SANS generation';
  end if;
  if (select attempts from public.commercial_order_exports where tenant_id = v_tenant_a and status = 'running' limit 1) <> 1 then
    raise exception 'scenario 4a : attempts aurait du etre incremente A LA RECLAMATION';
  end if;

  raise notice 'scenario 4a (reclamation atomique, rebut par fraicheur) OK';
end;
$$;

-- ── 5 — api_read_order_export_rows : ISOLATION DE TENANT, filtres, pagination, types ──
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_order_a uuid;
  v_export_order uuid;
  v_export_line uuid;
  v_export_filtered uuid;
  v_page record;
  v_all_rows jsonb := '[]'::jsonb;
  v_after jsonb := null;
  v_page1_count integer;
  v_page2_count integer;
  v_page3_count integer;
begin
  select tenant_a, tenant_b, customer_a, order_a into v_tenant_a, v_tenant_b, v_customer_a, v_order_a from e10_18c_context;

  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters)
    values (v_tenant_a, 'running', 'csv', 'order', '{}'::jsonb) returning id into v_export_order;
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters)
    values (v_tenant_a, 'running', 'csv', 'line', '{}'::jsonb) returning id into v_export_line;
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters)
    values (
      v_tenant_a, 'running', 'csv', 'order',
      jsonb_build_object('customer_id', v_customer_a, 'created_from', '2026-03-01', 'created_to', '2026-03-31')
    ) returning id into v_export_filtered;

  set local role service_role;

  -- 5a — ISOLATION : granularite `order`, AUCUN filtre — doit rendre les
  -- DEUX commandes du tenant A (order_a, order_a2) et JAMAIS order_b, alors
  -- meme que order_b existe, meme periode, meme raison sociale cliente.
  -- PAGINATION PAR CLE explicite (p_limit=1, exactement 2 lignes attendues) :
  -- page 1 rend une ligne + un curseur, page 2 (avec ce curseur) rend la
  -- SECONDE ligne, page 3 (avec le curseur de la page 2) ne rend RIEN — ce
  -- qui prouve a la fois l avancement (pas de doublon) et la terminaison
  -- (pas de boucle infinie), sans boucle PL/pgSQL a borner arbitrairement.
  select count(*) into v_page1_count from public.api_read_order_export_rows(v_export_order, v_after, 1);
  for v_page in select * from public.api_read_order_export_rows(v_export_order, v_after, 1) loop
    v_all_rows := v_all_rows || jsonb_build_array(v_page.payload);
    v_after := v_page.cursor;
  end loop;

  select count(*) into v_page2_count from public.api_read_order_export_rows(v_export_order, v_after, 1);
  for v_page in select * from public.api_read_order_export_rows(v_export_order, v_after, 1) loop
    v_all_rows := v_all_rows || jsonb_build_array(v_page.payload);
    v_after := v_page.cursor;
  end loop;

  select count(*) into v_page3_count from public.api_read_order_export_rows(v_export_order, v_after, 1);

  if v_page1_count <> 1 or v_page2_count <> 1 or v_page3_count <> 0 then
    raise exception 'scenario 5a : pagination par cle attendue 1/1/0, obtenu %/%/%', v_page1_count, v_page2_count, v_page3_count;
  end if;

  if jsonb_array_length(v_all_rows) <> 2 then
    raise exception 'scenario 5a (MAJEUR) : 2 commandes du tenant A attendues (pagination par cle), obtenu %', jsonb_array_length(v_all_rows);
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_all_rows) r
     where r->>'order_number' = 'CDE-2026-99003'
  ) then
    raise exception 'scenario 5a (CRITIQUE) : la commande du TENANT B (CDE-2026-99003) est apparue dans un export du tenant A';
  end if;

  -- 5b — Colonnes TECHNIQUES absentes de `row`.
  if (v_all_rows->0) ? 'tenant_id' or (v_all_rows->0) ? 'order_id' then
    raise exception 'scenario 5b (MAJEUR) : une colonne technique (tenant_id/order_id) fuit dans la charge utile';
  end if;

  -- 5b-bis (qa-review round 1, migration additive) — « Courriel
  -- interlocuteur » DOIT etre presente dans la charge utile (cle existe,
  -- meme si NULLE : aucun customer_contact_id n est renseigne sur les
  -- fixtures de ce fichier, donc la valeur EST null ici, mais la CLE doit
  -- exister -- preuve que la vue etendue par la section 1bis de la
  -- migration est bien celle lue par cette fonction).
  if not ((v_all_rows->0) ? 'customer_contact_email') then
    raise exception 'scenario 5b-bis (MAJEUR) : customer_contact_email absente de la charge utile (migration additive section 1bis non prise en compte)';
  end if;

  -- 5c — Chaque valeur NUMERIQUE arrive en CHAINE JSON, jamais un nombre
  -- natif (condition du point de conversion UNIQUE cote generateur,
  -- contrat §8.24 point 5).
  if jsonb_typeof(v_all_rows->0->'lines_subtotal') <> 'string' then
    raise exception 'scenario 5c (MAJEUR) : lines_subtotal devrait etre une CHAINE JSON, type obtenu %', jsonb_typeof(v_all_rows->0->'lines_subtotal');
  end if;
  if (v_all_rows->0->>'lines_subtotal') !~ '^\d+\.\d{2}$' then
    raise exception 'scenario 5c : lines_subtotal devrait porter deux decimales exactes, obtenu %', (v_all_rows->0->>'lines_subtotal');
  end if;

  -- 5d — Granularite `line` : la commande order_a (2 lignes) rend
  -- EXACTEMENT deux lignes, jamais celles de order_b.
  if (
    select count(*) from public.api_read_order_export_rows(v_export_line, null, 100)
  ) <> 3 then
    -- order_a (2 lignes) + order_a2 (1 ligne) = 3, JAMAIS la ligne de order_b.
    raise exception 'scenario 5d (MAJEUR) : 3 lignes attendues (order_a + order_a2, tenant A), obtenu un autre compte';
  end if;

  -- 5e — Filtres ENREGISTRES (customer_id + periode) : seule order_a
  -- (2026-03-15, dans la periode) doit ressortir, PAS order_a2 (2026-06-01,
  -- hors periode).
  if (select count(*) from public.api_read_order_export_rows(v_export_filtered, null, 100)) <> 1 then
    raise exception 'scenario 5e (MAJEUR) : le filtre de periode (created_from/created_to) n a pas ete applique';
  end if;
  if (
    select payload->>'order_number' from public.api_read_order_export_rows(v_export_filtered, null, 100)
  ) <> 'CDE-2026-99001' then
    raise exception 'scenario 5e : la seule commande rendue devrait etre CDE-2026-99001 (order_a)';
  end if;

  reset role;
  raise notice 'scenario 5 (isolation de tenant, colonnes techniques absentes, types stricts, filtres, pagination) OK';
end;
$$;

-- ── 6 — Privileges d execution ───────────────────────────────────────────────
do $$
declare
  v_denied boolean := false;
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_18c_context;

  begin
    set local role authenticated;
    perform 1 from public.api_claim_order_exports(1, 3, interval '15 minutes');
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 6a : authenticated a pu executer api_claim_order_exports';
  end if;

  v_denied := false;
  begin
    set local role anon;
    perform 1 from public.api_claim_order_exports(1, 3, interval '15 minutes');
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 6b : anon a pu executer api_claim_order_exports';
  end if;

  v_denied := false;
  begin
    set local role authenticated;
    perform 1 from public.api_read_order_export_rows(gen_random_uuid(), null, 10);
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 6c (CRITIQUE) : authenticated a pu executer api_read_order_export_rows';
  end if;

  -- 6d — `api_request_order_export` n est GRANTEE QU A `authenticated` (ni
  -- `service_role`, ni `anon`) : verifie DIRECTEMENT au catalogue, plus sur
  -- que de tenter l appel (dont l echec pourrait venir de
  -- `authentication_required` — service_role n a pas de session — et non
  -- d un `insufficient_privilege`, ce qui masquerait un grant residuel).
  if exists (
    select 1 from information_schema.role_routine_grants
     where routine_name = 'api_request_order_export' and grantee in ('service_role', 'anon')
  ) then
    raise exception 'scenario 6d (MAJEUR) : api_request_order_export est grantee a service_role ou anon (ne devrait l etre qu a authenticated)';
  end if;
  if not exists (
    select 1 from information_schema.role_routine_grants
     where routine_name = 'api_request_order_export' and grantee = 'authenticated'
  ) then
    raise exception 'scenario 6d : api_request_order_export devrait etre grantee a authenticated';
  end if;

  raise notice 'scenario 6 (privileges d execution) OK';
end;
$$;

-- ── 7 — api_claim_order_exports_for_purge() + api_confirm_order_export_files_purged() ──
-- REECRIT (qa-review round 2, BLOQUANT) : la version round 1 de ce scenario
-- prouvait par erreur qu un export DEJA expired n etait JAMAIS reclame une
-- seconde fois -- c etait EXACTEMENT LE DEFAUT (aucune reprise possible sur
-- un echec de retrait Storage, un fichier au CA complet restait orphelin
-- POUR TOUJOURS). Ce scenario prouve maintenant la PROPRIETE INVERSE et
-- CORRECTE : un export `expired` dont `storage_path` est ENCORE NON NUL
-- (retrait Storage pas encore confirme) EST RE-RECLAME au tour suivant ; un
-- export `expired` dont `storage_path` a ete mis a `null` (retrait
-- CONFIRME) N EST PLUS JAMAIS reclame. La DESTRUCTION REELLE de l objet
-- Storage n est PAS du ressort de SQL (elle vit dans l Edge Function
-- `magrit-order-file-purge`, ETENDUE, testee par ailleurs cote TypeScript/
-- adaptateur) : ce scenario simule sa CONFIRMATION par un appel direct a
-- `api_confirm_order_export_files_purged`, exactement le geste que fait
-- l adaptateur apres un `remove()` sans erreur.
do $$
declare
  v_tenant_a uuid;
  v_id uuid;
  v_id_not_due uuid;
  v_claimed record;
  v_claimed_count integer := 0;
  v_reclaimed_count integer := 0;
  v_confirmed_count integer;
begin
  select tenant_a into v_tenant_a from e10_18c_context;

  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, completed_at, expires_at, storage_path, row_count
  ) values (
    v_tenant_a, 'ready', 'csv', 'order', '{}'::jsonb, now() - interval '8 days', now() - interval '1 day',
    v_tenant_a::text || '/purge-test.csv', 2
  ) returning id into v_id;

  -- Export ready MAIS PAS ENCORE echu (expires_at dans le futur) : ne doit
  -- JAMAIS etre reclame par ce tour.
  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, completed_at, expires_at, storage_path, row_count
  ) values (
    v_tenant_a, 'ready', 'csv', 'order', '{}'::jsonb, now(), now() + interval '6 days',
    v_tenant_a::text || '/not-due-yet.csv', 1
  ) returning id into v_id_not_due;

  -- 7a — PREMIERE RECLAMATION : marque ready -> expired, rend storage_path.
  for v_claimed in select * from public.api_claim_order_exports_for_purge(500) loop
    v_claimed_count := v_claimed_count + 1;
    if v_claimed.purged_export_id = v_id then
      if v_claimed.purged_tenant_id <> v_tenant_a then
        raise exception 'scenario 7a (MAJEUR) : purged_tenant_id incorrect';
      end if;
      if v_claimed.purged_storage_path <> (v_tenant_a::text || '/purge-test.csv') then
        raise exception 'scenario 7a (MAJEUR) : purged_storage_path incorrect, obtenu %', v_claimed.purged_storage_path;
      end if;
    end if;
    if v_claimed.purged_export_id = v_id_not_due then
      raise exception 'scenario 7a (MAJEUR) : un export ready NON ECHU a ete reclame par la purge';
    end if;
  end loop;

  if v_claimed_count = 0 then
    raise exception 'scenario 7a (MAJEUR) : aucun export echu reclame, la fonction n a rien rendu';
  end if;

  if (select status from public.commercial_order_exports where id = v_id) <> 'expired' then
    raise exception 'scenario 7a (MAJEUR) : un export ready expire aurait du passer expired';
  end if;
  if (select row_count from public.commercial_order_exports where id = v_id) <> 2 then
    raise exception 'scenario 7a : row_count devrait survivre a expired (contrat point 3(f))';
  end if;
  if (select storage_path from public.commercial_order_exports where id = v_id) is null then
    raise exception 'scenario 7a (MAJEUR) : storage_path ne doit PAS etre efface par la seule reclamation (seule api_confirm_order_export_files_purged le fait)';
  end if;
  if (select status from public.commercial_order_exports where id = v_id_not_due) <> 'ready' then
    raise exception 'scenario 7a (MAJEUR) : un export ready NON ECHU ne doit PAS passer expired';
  end if;

  -- 7b — REPRISE (LA CORRECTION DU BLOQUANT round 2) : simule un tour ou le
  -- retrait Storage a echoue -- AUCUNE confirmation n a ete appelee. Un
  -- second appel de reclamation DOIT rendre a nouveau v_id (storage_path
  -- toujours non nul), PAS l inverse. C est la propriete que la version
  -- round 1 de ce scenario prouvait, A TORT, comme absente.
  for v_claimed in select * from public.api_claim_order_exports_for_purge(500) loop
    if v_claimed.purged_export_id = v_id then
      v_reclaimed_count := v_reclaimed_count + 1;
      if v_claimed.purged_storage_path <> (v_tenant_a::text || '/purge-test.csv') then
        raise exception 'scenario 7b (MAJEUR) : storage_path re-rendu incorrect, obtenu %', v_claimed.purged_storage_path;
      end if;
    end if;
  end loop;
  if v_reclaimed_count <> 1 then
    raise exception 'scenario 7b (BLOQUANT round 2) : un export expired dont le retrait Storage a echoue (storage_path non nul) doit etre RE-RECLAME au tour suivant -- obtenu % reclamation(s)', v_reclaimed_count;
  end if;
  if (select status from public.commercial_order_exports where id = v_id) <> 'expired' then
    raise exception 'scenario 7b (MAJEUR) : la re-reclamation ne doit PAS faire sortir la ligne de expired (transition expired->expired seulement)';
  end if;

  -- 7c — CONFIRMATION (le geste que l adaptateur fait APRES un remove() sans
  -- erreur) : efface storage_path, ferme l invariant de reprise.
  select public.api_confirm_order_export_files_purged(array[v_id]) into v_confirmed_count;
  if v_confirmed_count <> 1 then
    raise exception 'scenario 7c (MAJEUR) : api_confirm_order_export_files_purged aurait du confirmer exactement 1 ligne, obtenu %', v_confirmed_count;
  end if;
  if (select storage_path from public.commercial_order_exports where id = v_id) is not null then
    raise exception 'scenario 7c (MAJEUR) : storage_path aurait du etre efface apres confirmation';
  end if;
  if (select status from public.commercial_order_exports where id = v_id) <> 'expired' then
    raise exception 'scenario 7c (MAJEUR) : le statut doit rester expired apres confirmation (seul storage_path change)';
  end if;

  -- 7d — Un export CONFIRME (storage_path null) n est PLUS JAMAIS reclame :
  -- c est la propriete miroir de 7b, et c est elle qui prouve que
  -- l elargissement du predicat en 7b n introduit pas une boucle infinie.
  if exists (
    select 1 from public.api_claim_order_exports_for_purge(500) c where c.purged_export_id = v_id
  ) then
    raise exception 'scenario 7d (MAJEUR) : un export CONFIRME (storage_path null) a ete reclame de nouveau';
  end if;

  -- 7e — Defense en profondeur : confirmer un id qui ne correspond a AUCUNE
  -- ligne `expired` (ou n existe pas) est un NO-OP silencieux, jamais une
  -- erreur (un double appel de l adaptateur, par exemple sur retry reseau,
  -- ne doit jamais faire echouer le tour).
  select public.api_confirm_order_export_files_purged(array[gen_random_uuid()]) into v_confirmed_count;
  if v_confirmed_count <> 0 then
    raise exception 'scenario 7e (MAJEUR) : confirmer un id inconnu devrait rendre 0, obtenu %', v_confirmed_count;
  end if;

  raise notice 'scenario 7 (purge : reclamation SQL ready/expired->expired, storage_path rendu, REPRISE PROUVEE sur echec de retrait (7b, correction du bloquant round 2), confirmation ferme l invariant (7c/7d), non echu jamais reclame, confirmation d un id inconnu = no-op) OK';
end;
$$;

-- ── 8 — purge_attempts : PLAFOND (arbitrage architecte round 3, mecanisme (a)) ──
-- Trois reclamations SANS confirmation epuisent le plafond : la QUATRIEME
-- reclamation NE DOIT PLUS rendre la ligne, qui reste `expired`,
-- `storage_path` NON NUL, `purge_attempts` = 3 -- ETAT VISIBLE, lisible en
-- une requete, PAS un nouveau statut (contrat, `OrderExport.status` inchange).
do $$
declare
  v_tenant_a uuid;
  v_id uuid;
  v_attempts integer;
begin
  select tenant_a into v_tenant_a from e10_18c_context;

  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, completed_at, expires_at, storage_path, row_count
  ) values (
    v_tenant_a, 'ready', 'csv', 'order', '{}'::jsonb, now() - interval '8 days', now() - interval '1 day',
    v_tenant_a::text || '/purge-attempts-test.csv', 1
  ) returning id into v_id;

  -- Trois reclamations successives (aucune confirmation entre les deux) :
  -- purge_attempts doit passer de 0 a 3.
  perform public.api_claim_order_exports_for_purge(500);
  perform public.api_claim_order_exports_for_purge(500);
  perform public.api_claim_order_exports_for_purge(500);

  select purge_attempts into v_attempts from public.commercial_order_exports where id = v_id;
  if v_attempts <> 3 then
    raise exception 'scenario 8 (MAJEUR) : purge_attempts attendu a 3 apres trois reclamations, obtenu %', v_attempts;
  end if;

  -- QUATRIEME reclamation : la ligne NE DOIT PLUS etre rendue (plafond
  -- atteint) -- ELLE RESTE expired/storage_path non nul/purge_attempts=3,
  -- ETAT VISIBLE qui signale un menage a bout de tentatives NORMALES (le
  -- balayage d objets orphelins, scenario 9, prend alors le relais).
  if exists (
    select 1 from public.api_claim_order_exports_for_purge(500) c where c.purged_export_id = v_id
  ) then
    raise exception 'scenario 8 (BLOQUANT round 3, mecanisme (a)) : un export dont purge_attempts=3 a ete reclame une quatrieme fois';
  end if;
  if (select purge_attempts from public.commercial_order_exports where id = v_id) <> 3 then
    raise exception 'scenario 8 (MAJEUR) : purge_attempts ne doit PAS depasser 3 (la ligne n est plus reclamee)';
  end if;
  if (select status from public.commercial_order_exports where id = v_id) <> 'expired' then
    raise exception 'scenario 8 (MAJEUR) : le statut doit rester expired, jamais un nouveau statut';
  end if;
  if (select storage_path from public.commercial_order_exports where id = v_id) is null then
    raise exception 'scenario 8 (MAJEUR) : storage_path doit rester NON NUL (rien n a jamais ete confirme) -- c est cet etat qui signale le relais au balayage d objets orphelins';
  end if;

  raise notice 'scenario 8 (purge_attempts : plafond a 3, arbitrage (a), la ligne reste visible expired/storage_path non nul/purge_attempts=3, jamais reclamee au-dela) OK';
end;
$$;

-- ── 9 — api_claim_orphan_order_export_objects() : SOLUTION PORTEUSE (arbitrage (c)) ──
-- DEUX categories : (a) objet SANS AUCUNE ligne dont storage_path le
-- reference, plus vieux que 24h (fenetre depot->markReady) ; (b) ligne
-- expired avec purge_attempts epuise (>= 3), SANS delai supplementaire.
-- Egalite DIRECTE sur storage_path (pas de split_part, contrairement au
-- patron E10.22c) : verifie ici que la jointure fonctionne EXACTEMENT sur
-- le chemin stocke, forme <tenant_id>/<export_id>.<ext>.
do $$
declare
  v_tenant_a uuid;
  v_id_exhausted uuid;    -- ligne cote (8), purge_attempts=3, storage_path non nul.
  v_id_not_due uuid;      -- ligne ready NON echue -- son objet ne doit jamais etre candidat.
  v_path_never_referenced_old text := gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.csv';
  v_path_never_referenced_recent text := gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.csv';
  v_path_exhausted text;
  v_path_live text;
  v_path_other_bucket text := gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.csv';
  v_candidates record;
  v_found_never_referenced_old boolean := false;
  v_found_exhausted boolean := false;
  v_matched_export_id_for_exhausted uuid := null;
begin
  select tenant_a into v_tenant_a from e10_18c_context;
  select id into v_id_exhausted from public.commercial_order_exports
   where tenant_id = v_tenant_a and storage_path = v_tenant_a::text || '/purge-attempts-test.csv';
  select storage_path into v_path_exhausted from public.commercial_order_exports where id = v_id_exhausted;

  -- Ligne ready NON echue, avec un chemin storage_path REEL -- son objet ne
  -- doit JAMAIS etre candidat (ni categorie (a), une ligne le reference ;
  -- ni categorie (b), la ligne n est pas expired).
  v_path_live := v_tenant_a::text || '/orphan-scenario-live.csv';
  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, expires_at, storage_path, row_count
  ) values (
    v_tenant_a, 'ready', 'csv', 'order', '{}'::jsonb, now() + interval '6 days', v_path_live, 1
  ) returning id into v_id_not_due;

  -- Objet SANS AUCUNE ligne, DEPOSE il y a 25h -- au-dela du delai de
  -- securite (24h, fenetre depot->markReady) -- categorie (a).
  insert into storage.objects (id, bucket_id, name, created_at)
    values (gen_random_uuid(), 'order_exports', v_path_never_referenced_old, now() - interval '25 hours');

  -- Objet SANS AUCUNE ligne, DEPOSE il y a 1h -- une generation EN COURS
  -- (fenetre depot->markReady, de l ordre de quelques SECONDES en usage
  -- normal, largement couverte par la marge de 24h) -- NE DOIT PAS etre
  -- candidat.
  insert into storage.objects (id, bucket_id, name, created_at)
    values (gen_random_uuid(), 'order_exports', v_path_never_referenced_recent, now() - interval '1 hour');

  -- Objet dont la ligne EST VIVANTE (ready, non echue) -- NE DOIT JAMAIS
  -- etre candidat.
  insert into storage.objects (id, bucket_id, name, created_at)
    values (gen_random_uuid(), 'order_exports', v_path_live, now() - interval '5 days');

  -- Objet correspondant a la ligne A BOUT DE TENTATIVES (scenario 8,
  -- purge_attempts=3) -- categorie (b), SANS delai supplementaire (l objet
  -- est ici TRES RECENT et doit NEANMOINS etre candidat).
  insert into storage.objects (id, bucket_id, name, created_at)
    values (gen_random_uuid(), 'order_exports', v_path_exhausted, now());

  -- Objet d un AUTRE bucket, meme forme de chemin -- JAMAIS candidat.
  insert into storage.objects (id, bucket_id, name, created_at)
    values (gen_random_uuid(), 'commercial_order_files', v_path_other_bucket, now() - interval '5 days');

  for v_candidates in select * from public.api_claim_orphan_order_export_objects(interval '24 hours', 200) loop
    if v_candidates.orphan_object_path = v_path_never_referenced_old then
      v_found_never_referenced_old := true;
      if v_candidates.matched_export_id is not null then
        raise exception 'scenario 9 (MAJEUR) : objet JAMAIS reference ne doit avoir AUCUN matched_export_id';
      end if;
    end if;
    if v_candidates.orphan_object_path = v_path_never_referenced_recent then
      raise exception 'scenario 9 (MAJEUR) : objet JAMAIS reference mais RECENT (1h, generation en cours) ne doit PAS etre candidat';
    end if;
    if v_candidates.orphan_object_path = v_path_live then
      raise exception 'scenario 9 (MAJEUR) : objet d une ligne VIVANTE (ready, non echue) ne doit JAMAIS etre candidat';
    end if;
    if v_candidates.orphan_object_path = v_path_other_bucket then
      raise exception 'scenario 9 (CRITIQUE) : objet d un AUTRE bucket ne doit JAMAIS etre candidat';
    end if;
    if v_candidates.orphan_object_path = v_path_exhausted then
      v_found_exhausted := true;
      v_matched_export_id_for_exhausted := v_candidates.matched_export_id;
    end if;
  end loop;

  if not v_found_never_referenced_old then
    raise exception 'scenario 9 (MAJEUR) : objet SANS ligne, depose il y a 25h, aurait du etre candidat (categorie a)';
  end if;
  if not v_found_exhausted then
    raise exception 'scenario 9 (BLOQUANT round 3, mecanisme (c)) : objet dont la ligne a EPUISE purge_attempts (categorie b) aurait du etre candidat SANS delai supplementaire';
  end if;
  if v_matched_export_id_for_exhausted <> v_id_exhausted then
    raise exception 'scenario 9 (MAJEUR) : matched_export_id incorrect pour la categorie (b), obtenu %, attendu %', v_matched_export_id_for_exhausted, v_id_exhausted;
  end if;

  -- Privilege : authenticated/anon refuses.
  set local role authenticated;
  begin
    perform 1 from public.api_claim_orphan_order_export_objects(interval '24 hours', 10);
    raise exception 'scenario 9 (MAJEUR) : authenticated a pu executer api_claim_orphan_order_export_objects';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'scenario 9 (balayage d objets orphelins order_exports : categorie (a) fenetre depot->markReady avec marge 24h, categorie (b) purge_attempts epuise SANS delai + matched_export_id correct, ligne vivante et autre bucket jamais candidats, privileges) OK';
end;
$$;

rollback;
