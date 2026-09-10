-- ============================================================================
-- qa-review round 1 (B2, BLOQUANT GRAVE) sur E10.22c (objets orphelins) --
-- migration `20260910000700`. Contrat : docs/api/CONVENTIONS.md §8.22 §6.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le refus
-- `order_file.upload_expired` vit ENTIEREMENT dans les DEUX fonctions de
-- confirmation retouchees par cette migration -- relire leur texte ne prouve
-- pas qu elles se comportent correctement sous appel reel.
--
-- CE QUE CE FICHIER PROUVE, ET POURQUOI IL EXISTE : le scenario de course
-- documente en tete de `20260910000700` (billet emis, PUT reussi, confirmation
-- tardive APRES que l objet a ete liste comme candidat orphelin) est
-- STRUCTURELLEMENT IRREPRODUCTIBLE une fois ce correctif en place -- prouve
-- ici en simulant directement l etat "objet plus vieux que 24h" (insertion
-- DIRECTE dans storage.objects avec un `created_at` recule, equivalent d un
-- PUT reussi puis d une confirmation tardive) et en verifiant que LES DEUX
-- fonctions de confirmation REFUSENT, jamais qu elles reussissent.
--
-- Scenarios :
--   1. api_confirm_order_file_upload (E10.17a) : objet DEJA vieux de 25h ->
--      order_file.upload_expired, AUCUNE ligne creee.
--   2. api_confirm_order_file_upload : objet depose il y a 1h (billet
--      recent, legitime) -> confirmation REUSSIE.
--   3. api_confirm_order_file_upload : AUCUN objet a l endroit attendu ->
--      comportement INCHANGE par ce correctif (la fonction ne verifiait deja
--      pas l existence avant ce lot -- hors perimetre de B2, qui ne traite
--      QUE l expiration) : confirmation REUSSIE (le contrat de confiance
--      existant, pas retouche ici, reste ce qu il etait).
--   4. api_confirm_order_file_upload_by_link (E10.20b) : objet DEJA vieux de
--      25h -> order_file.upload_expired, AUCUNE ligne creee, deposited_count
--      du lien INCHANGE.
--   5. api_confirm_order_file_upload_by_link : objet depose il y a 1h ->
--      confirmation REUSSIE.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_22c_b2_context (
  tenant_a     uuid not null,
  admin_a      uuid not null,
  order_a      uuid not null
);

do $$
declare
  v_admin_a uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_item_a uuid;
  v_quote_a uuid;
  v_quote_line_a uuid;
  v_order_a uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_admin_a, 'e10-22c-b2-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-22c-b2-tenant-a', 'E10.22c B2 Tenant A') returning id into v_tenant_a;
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_admin_a, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.22c B2 Client A', '73282932000074') returning id into v_customer_a;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet E10.22c B2 A') returning id into v_project_a;
  insert into public.project_items (project_id, label, position) values (v_project_a, 'Item A', 0) returning id into v_item_a;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-99401', 'draft', '2099-01-01', true)
    returning id into v_quote_a;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_a, v_item_a, 'Ligne A', 10, 0, 5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_a;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_a, v_customer_a, v_quote_a, 'CDE-2026-99401', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_a;

  insert into e10_22c_b2_context (tenant_a, admin_a, order_a) values (v_tenant_a, v_admin_a, v_order_a);
end;
$$;

grant select on e10_22c_b2_context to authenticated;

-- ── 1 — api_confirm_order_file_upload : objet DEJA vieux de 25h ────────────
do $$
declare
  v_tenant_a uuid;
  v_admin_a uuid;
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_path text;
  v_rejected boolean := false;
begin
  select tenant_a, admin_a, order_a into v_tenant_a, v_admin_a, v_order_a from e10_22c_b2_context;
  v_path := v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text;

  insert into storage.objects (bucket_id, name, metadata, created_at)
    values ('commercial_order_files', v_path, jsonb_build_object('size', 100, 'mimetype', 'application/pdf'), now() - interval '25 hours');

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_confirm_order_file_upload(
      v_tenant_a, v_order_a, v_file_id, 'trop-vieux.pdf', null, null, 'application/pdf', 100
    );
  exception when others then
    if sqlerrm like 'order_file.upload_expired%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'scenario 1 (B2) : confirmation sur un objet vieux de 25h aurait du etre refusee (order_file.upload_expired)';
  end if;
  if exists (select 1 from public.commercial_order_files where id = v_file_id) then
    raise exception 'scenario 1 (B2) : aucune ligne ne doit exister apres un refus order_file.upload_expired';
  end if;

  raise notice 'scenario 1 (B2, api_confirm_order_file_upload, objet expire) OK';
end;
$$;

-- ── 2 — api_confirm_order_file_upload : objet depose il y a 1h (legitime) ──
do $$
declare
  v_tenant_a uuid;
  v_admin_a uuid;
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_path text;
  v_row public.commercial_order_files;
begin
  select tenant_a, admin_a, order_a into v_tenant_a, v_admin_a, v_order_a from e10_22c_b2_context;
  v_path := v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text;

  insert into storage.objects (bucket_id, name, metadata, created_at)
    values ('commercial_order_files', v_path, jsonb_build_object('size', 100, 'mimetype', 'application/pdf'), now() - interval '1 hour');

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_row := public.api_confirm_order_file_upload(
    v_tenant_a, v_order_a, v_file_id, 'recent.pdf', null, null, 'application/pdf', 100
  );
  reset role;

  if v_row.id is distinct from v_file_id then
    raise exception 'scenario 2 (B2) : confirmation LEGITIME (objet depose il y a 1h) refusee a tort';
  end if;

  raise notice 'scenario 2 (B2, api_confirm_order_file_upload, objet recent) OK';
end;
$$;

-- ── 3 — api_confirm_order_file_upload : AUCUN objet -- comportement INCHANGE
do $$
declare
  v_tenant_a uuid;
  v_admin_a uuid;
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_row public.commercial_order_files;
begin
  select tenant_a, admin_a, order_a into v_tenant_a, v_admin_a, v_order_a from e10_22c_b2_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_row := public.api_confirm_order_file_upload(
    v_tenant_a, v_order_a, v_file_id, 'sans-objet.pdf', null, null, 'application/pdf', 100
  );
  reset role;

  if v_row.id is distinct from v_file_id then
    raise exception 'scenario 3 (B2) : comportement INCHANGE attendu (aucun objet -- hors perimetre B2) -- confirmation aurait du reussir';
  end if;

  raise notice 'scenario 3 (B2, api_confirm_order_file_upload, aucun objet, comportement inchange) OK';
end;
$$;

-- ── 4 — api_confirm_order_file_upload_by_link : objet DEJA vieux de 25h ────
do $$
declare
  v_tenant_a uuid;
  v_admin_a uuid;
  v_order_a uuid;
  v_link_row record;
  v_file_id uuid := gen_random_uuid();
  v_path text;
  v_rejected boolean := false;
begin
  select tenant_a, admin_a, order_a into v_tenant_a, v_admin_a, v_order_a from e10_22c_b2_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_link_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, 'lien B2', 30, 2);
  reset role;

  v_path := v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text;
  insert into storage.objects (bucket_id, name, metadata, created_at)
    values ('commercial_order_files', v_path, jsonb_build_object('size', 100, 'mimetype', 'application/pdf'), now() - interval '25 hours');

  set local role service_role;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_link_row.token, v_file_id, 'trop-vieux-lien.pdf');
  exception when others then
    if sqlerrm like 'order_file.upload_expired%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'scenario 4 (B2) : confirmation par lien sur un objet vieux de 25h aurait du etre refusee (order_file.upload_expired)';
  end if;
  if exists (select 1 from public.commercial_order_files where id = v_file_id) then
    raise exception 'scenario 4 (B2) : aucune ligne ne doit exister apres un refus order_file.upload_expired (lien)';
  end if;
  if (select deposited_count from public.commercial_order_upload_links where id = v_link_row.id) <> 0 then
    raise exception 'scenario 4 (B2) : deposited_count du lien ne doit PAS bouger sur un refus order_file.upload_expired';
  end if;

  raise notice 'scenario 4 (B2, api_confirm_order_file_upload_by_link, objet expire) OK';
end;
$$;

-- ── 5 — api_confirm_order_file_upload_by_link : objet depose il y a 1h ─────
do $$
declare
  v_tenant_a uuid;
  v_admin_a uuid;
  v_order_a uuid;
  v_link_row record;
  v_file_id uuid := gen_random_uuid();
  v_path text;
  v_confirmed record;
begin
  select tenant_a, admin_a, order_a into v_tenant_a, v_admin_a, v_order_a from e10_22c_b2_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_link_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, 'lien B2 recent', 30, 2);
  reset role;

  v_path := v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text;
  insert into storage.objects (bucket_id, name, metadata, created_at)
    values ('commercial_order_files', v_path, jsonb_build_object('size', 100, 'mimetype', 'application/pdf'), now() - interval '1 hour');

  set local role service_role;
  select * into v_confirmed from public.api_confirm_order_file_upload_by_link(v_link_row.token, v_file_id, 'recent-lien.pdf');
  reset role;

  if v_confirmed.file_id is distinct from v_file_id then
    raise exception 'scenario 5 (B2) : confirmation par lien LEGITIME (objet depose il y a 1h) refusee a tort';
  end if;
  if (select deposited_count from public.commercial_order_upload_links where id = v_link_row.id) <> 1 then
    raise exception 'scenario 5 (B2) : deposited_count du lien doit etre incremente sur une confirmation reussie';
  end if;

  raise notice 'scenario 5 (B2, api_confirm_order_file_upload_by_link, objet recent) OK';
end;
$$;

rollback;
