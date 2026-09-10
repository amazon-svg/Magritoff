-- ============================================================================
-- E10.19b — la production et la remise du bon de commande PDF : table
-- `order_documents`, bucket prive, RLS (isolation inter-tenant, append-only),
-- trigger de coherence tenant, fonction `api_register_order_document`.
-- Migration : 20260910000200. Contrat : docs/api/CONVENTIONS.md §8.20,
-- openapi/magrit-core.v1.yaml (OrderDocument, getOrderDocument,
-- generateOrderDocument).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le seed, la
-- fonction, la RLS vivent ENTIEREMENT dans la migration 20260910000200 — une
-- lecture de son texte ne prouve pas qu ils se comportent correctement sous
-- appel reel (meme lecon que 4c/19a).
--
-- Scenarios :
--   1. RLS lecture ATELIER : un membre du tenant B ne voit AUCUN document du
--      tenant A ; un membre du tenant A voit SON document.
--   2. APPEND-ONLY : un membre authentifie (admin inclus) ne peut PAS
--      inserer/mettre a jour/supprimer une ligne en DIRECT — seule la
--      fonction `api_register_order_document` (ou `service_role`) le peut.
--   3. Trigger de coherence tenant (meme patron que 4c) : une insertion
--      privilegiee avec `order_id`/`template_id` d un AUTRE tenant que
--      `tenant_id` est refusee.
--   4. `api_register_order_document` : succes (resout generated_by/
--      generated_by_label depuis auth.uid()/email), `permission_denied` pour
--      un acteur non membre, `order.not_found` pour une commande inconnue/
--      d un autre tenant, `order.document_template_missing` pour un gabarit
--      absent OU d un AUTRE type (`quote`, AUCUN repli jamais), et
--      `order.document_already_generated` sur une SECONDE production de la
--      MEME commande (unique_violation traduite).
--   5. `template_id on delete restrict` : un gabarit `order` encore porte
--      par un document ne peut plus etre supprime
--      (`document_pdf_template.in_use`) — ETEND la branche deja prouvee par
--      4c pour `quote_documents`, sans qu aucune ligne de
--      `api_delete_document_pdf_template` (20260909020000) n ait change.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_19b_context (
  actor_admin_a   uuid not null,
  actor_member_a  uuid not null,
  actor_admin_b   uuid not null,
  actor_outsider  uuid not null,
  tenant_a        uuid not null,
  tenant_b        uuid not null,
  template_order_a uuid not null,
  template_quote_a  uuid not null,
  template_order_b  uuid not null,
  order_a         uuid not null,
  order_b         uuid not null,
  document_a      uuid
);

grant select on e10_19b_context to authenticated;

-- ── Prealables, joues en tant que postgres ─────────────────────────────────
do $$
declare
  v_actor_admin_a uuid := gen_random_uuid();
  v_actor_member_a uuid := gen_random_uuid();
  v_actor_admin_b uuid := gen_random_uuid();
  v_actor_outsider uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_quote_a uuid;
  v_quote_b uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_template_order_a uuid;
  v_template_quote_a uuid;
  v_template_order_b uuid;
  v_pages jsonb := '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin_a, 'e10-19b-admin-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member_a, 'e10-19b-member-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_admin_b, 'e10-19b-admin-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_outsider, 'e10-19b-outsider@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-19b-tenant-a', 'E10.19b Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-19b-tenant-b', 'E10.19b Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin_a, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member_a, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_admin_b, 'admin', 'magrit_full', '{}');
  -- v_actor_outsider n est membre d AUCUN des deux tenants (permission_denied).

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.19b Client A', '73282932000074') returning id into v_customer_a;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.19b Client B', '22222222200005') returning id into v_customer_b;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet A') returning id into v_project_a;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet B') returning id into v_project_b;

  -- ── Gabarits : un `order` READY par tenant (A et B), UN `quote` READY sur
  -- A (pour le scenario "AUCUN repli sur quote", meme s il est deja eligible
  -- comme gabarit devis).
  insert into public.document_pdf_templates (tenant_id, name, document_type, status, is_default, is_active, page_count, pages, byte_size, sha256)
    values (v_tenant_a, 'Papier commande A', 'order', 'ready', true, true, 1, v_pages, 1000, repeat('a', 64))
    returning id into v_template_order_a;
  update public.document_pdf_templates set storage_path = v_tenant_a::text || '/' || v_template_order_a::text || '.pdf' where id = v_template_order_a;

  insert into public.document_pdf_templates (tenant_id, name, document_type, status, is_default, is_active, page_count, pages, byte_size, sha256)
    values (v_tenant_a, 'Papier devis A', 'quote', 'ready', true, true, 1, v_pages, 1000, repeat('b', 64))
    returning id into v_template_quote_a;
  update public.document_pdf_templates set storage_path = v_tenant_a::text || '/' || v_template_quote_a::text || '.pdf' where id = v_template_quote_a;

  insert into public.document_pdf_templates (tenant_id, name, document_type, status, is_default, is_active, page_count, pages, byte_size, sha256)
    values (v_tenant_b, 'Papier commande B', 'order', 'ready', true, true, 1, v_pages, 1000, repeat('c', 64))
    returning id into v_template_order_b;
  update public.document_pdf_templates set storage_path = v_tenant_b::text || '/' || v_template_order_b::text || '.pdf' where id = v_template_order_b;

  -- ── Deux commandes REELLES, produites par api_convert_commercial_quote
  -- (meme chemin que la production — pas une insertion directe de
  -- commercial_orders, qui exigerait de reconstruire tous les totaux a la
  -- main pour rien).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-92001', 'draft', '2099-01-01', true)
    returning id into v_quote_a;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a, null, 'free', 'Flyers A5', 200, 0, 100.00, 200.00, 200.00, 1.0000, 190.00, 0.0500, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_a;
  perform set_config('magrit.quote_transition', '', true);

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_b, v_project_b, 'DEV-2026-92002', 'draft', '2099-01-01', true)
    returning id into v_quote_b;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_b, null, 'free', 'Cartes de visite', 500, 0, 50.00, 100.00, 100.00, 1.0000, 95.00, 0.0500, '[{"post":"total","cost":"50.00","margin_rate":"1.0000","price":"100.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_b;
  perform set_config('magrit.quote_transition', '', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.api_convert_commercial_quote(v_tenant_a, v_quote_a) into v_order_a;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.api_convert_commercial_quote(v_tenant_b, v_quote_b) into v_order_b;
  reset role;

  insert into e10_19b_context (
    actor_admin_a, actor_member_a, actor_admin_b, actor_outsider, tenant_a, tenant_b,
    template_order_a, template_quote_a, template_order_b, order_a, order_b
  ) values (
    v_actor_admin_a, v_actor_member_a, v_actor_admin_b, v_actor_outsider, v_tenant_a, v_tenant_b,
    v_template_order_a, v_template_quote_a, v_template_order_b, v_order_a, v_order_b
  );
end;
$$;

-- ── 4 (place ici pour alimenter les scenarios 1/2/3/5 avec un document REEL) —
-- api_register_order_document, cas NOMINAL ──────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_template_order_a uuid;
  v_actor_member_a uuid;
  v_row record;
begin
  select tenant_a, order_a, template_order_a, actor_member_a
    into v_tenant_a, v_order_a, v_template_order_a, v_actor_member_a
    from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_register_order_document(
    v_tenant_a, v_order_a, v_template_order_a,
    v_tenant_a::text || '/' || v_order_a::text || '.pdf',
    12345, repeat('d', 64), 1, now()
  );
  reset role;

  if v_row.order_id is distinct from v_order_a then
    raise exception 'api_register_order_document n a pas enregistre la commande attendue (attendu %, obtenu %)', v_order_a, v_row.order_id;
  end if;
  if v_row.generated_by is distinct from v_actor_member_a then
    raise exception 'generated_by aurait du etre l acteur ayant appele la fonction (attendu %, obtenu %)', v_actor_member_a, v_row.generated_by;
  end if;
  if v_row.generated_by_label is distinct from 'e10-19b-member-a@example.test' then
    raise exception 'generated_by_label aurait du etre resolu depuis auth.users (attendu email, obtenu %)', v_row.generated_by_label;
  end if;

  update e10_19b_context set document_a = v_row.id;
end;
$$;

-- ── 1. RLS lecture ATELIER ───────────────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin_b uuid;
  v_visible integer;
begin
  select tenant_a, actor_admin_b into v_tenant_a, v_actor_admin_b from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible from public.order_documents where tenant_id = v_tenant_a;
  reset role;

  if v_visible <> 0 then
    raise exception 'le tenant B lit % document(s) du tenant A — order_documents_select rompue', v_visible;
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin_a uuid;
  v_visible integer;
begin
  select tenant_a, actor_admin_a into v_tenant_a, v_actor_admin_a from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible from public.order_documents where tenant_id = v_tenant_a;
  reset role;

  if v_visible <> 1 then
    raise exception 'un membre du tenant A ne lit pas son propre document (attendu 1, lu %)', v_visible;
  end if;
end;
$$;

-- ── 2. APPEND-ONLY : authenticated ne peut jamais ecrire en DIRECT ──────────
do $$
declare
  v_tenant_a uuid;
  v_template_order_a uuid;
  v_order_b uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, template_order_a, order_b, actor_admin_a
    into v_tenant_a, v_template_order_a, v_order_b, v_actor_admin_a
    from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    -- v_order_b n appartient meme pas au tenant A : peu importe, la RLS de
    -- grant (insert absent) doit refuser AVANT que le trigger de coherence
    -- ait la moindre chance de s exprimer.
    insert into public.order_documents (tenant_id, order_id, template_id, storage_path, byte_size, sha256, page_count, generated_at)
      values (v_tenant_a, v_order_b, v_template_order_a, v_tenant_a::text || '/' || v_order_b::text || '.pdf', 100, repeat('e', 64), 1, now());
  exception
    when insufficient_privilege then v_rejected := true;
    when others then reset role; raise;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un admin (authenticated) a pu inserer un order_document en DIRECT — reserve a api_register_order_document (migration 20260910000200)';
  end if;
end;
$$;

do $$
declare
  v_document_a uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select document_a, actor_admin_a into v_document_a, v_actor_admin_a from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.order_documents set byte_size = 1 where id = v_document_a;
  exception
    when insufficient_privilege then v_rejected := true;
    when others then reset role; raise;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un admin (authenticated) a pu MODIFIER un order_document en DIRECT — append-only';
  end if;
end;
$$;

do $$
declare
  v_document_a uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select document_a, actor_admin_a into v_document_a, v_actor_admin_a from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    delete from public.order_documents where id = v_document_a;
  exception
    when insufficient_privilege then v_rejected := true;
    when others then reset role; raise;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un admin (authenticated) a pu SUPPRIMER un order_document en DIRECT — append-only';
  end if;
end;
$$;

-- ── 3. Trigger de coherence tenant (insertion PRIVILEGIEE, hors RLS) ────────
do $$
declare
  v_tenant_a uuid;
  v_order_b uuid;
  v_template_order_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, order_b, template_order_a into v_tenant_a, v_order_b, v_template_order_a from e10_19b_context;

  begin
    insert into public.order_documents (tenant_id, order_id, template_id, storage_path, byte_size, sha256, page_count, generated_at)
      values (v_tenant_a, v_order_b, v_template_order_a, v_tenant_a::text || '/' || v_order_b::text || '.pdf', 100, repeat('f', 64), 1, now());
  exception
    when others then v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'un document a pu etre insere avec un order_id d un AUTRE tenant que tenant_id (trigger order_documents_same_tenant rompu)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_template_order_b uuid;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, template_order_b into v_tenant_a, v_order_a, v_template_order_b from e10_19b_context;

  begin
    insert into public.order_documents (tenant_id, order_id, template_id, storage_path, byte_size, sha256, page_count, generated_at)
      values (v_tenant_a, v_order_a, v_template_order_b, v_tenant_a::text || '/' || v_order_a::text || '.pdf', 100, repeat('0', 64), 1, now());
  exception
    when others then v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'un document a pu etre insere avec un template_id d un AUTRE tenant que tenant_id (trigger order_documents_same_tenant rompu)';
  end if;
end;
$$;

-- ── 4bis. api_register_order_document — les branches d echec ────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_template_order_a uuid;
  v_actor_outsider uuid;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, template_order_a, actor_outsider
    into v_tenant_a, v_order_a, v_template_order_a, v_actor_outsider
    from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_outsider::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_register_order_document(
      v_tenant_a, v_order_a, v_template_order_a,
      v_tenant_a::text || '/' || v_order_a::text || '.pdf', 100, repeat('1', 64), 1, now()
    );
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un acteur NON MEMBRE du tenant a pu produire un bon de commande (attendu permission_denied)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_template_order_a uuid;
  v_actor_member_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, template_order_a, actor_member_a into v_tenant_a, v_template_order_a, v_actor_member_a from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_register_order_document(
      v_tenant_a, gen_random_uuid(), v_template_order_a,
      v_tenant_a::text || '/inexistante.pdf', 100, repeat('2', 64), 1, now()
    );
  exception
    when others then
      if sqlerrm like 'order.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une commande INEXISTANTE a pu recevoir un bon de commande (attendu order.not_found)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_template_quote_a uuid;
  v_actor_member_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, template_quote_a, actor_member_a
    into v_tenant_a, v_order_a, v_template_quote_a, v_actor_member_a
    from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    -- v_template_quote_a existe, est READY, appartient au BON tenant — mais
    -- son document_type EST 'quote'. AUCUN repli n est tente.
    perform public.api_register_order_document(
      v_tenant_a, v_order_a, v_template_quote_a,
      v_tenant_a::text || '/' || v_order_a::text || '.pdf', 100, repeat('3', 64), 1, now()
    );
  exception
    when others then
      if sqlerrm like 'order.document_template_missing%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un gabarit de type quote a pu etre utilise pour produire un bon de commande (AUCUN repli attendu, order.document_template_missing)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_template_order_a uuid;
  v_actor_member_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, template_order_a, actor_member_a
    into v_tenant_a, v_order_a, v_template_order_a, v_actor_member_a
    from e10_19b_context;

  -- v_order_a porte DEJA son document (scenario nominal ci-dessus) : une
  -- SECONDE production doit etre refusee par la contrainte unique order_id,
  -- traduite en order.document_already_generated.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_register_order_document(
      v_tenant_a, v_order_a, v_template_order_a,
      v_tenant_a::text || '/' || v_order_a::text || '.pdf', 999, repeat('4', 64), 1, now()
    );
  exception
    when others then
      if sqlerrm like 'order.document_already_generated%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une commande DEJA porteuse de son document a pu en recevoir un second (attendu order.document_already_generated)';
  end if;
end;
$$;

-- ── 5. `template_id on delete restrict` — ETEND la branche prouvee par 4c ───
do $$
declare
  v_tenant_a uuid;
  v_template_order_a uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, template_order_a, actor_admin_a into v_tenant_a, v_template_order_a, v_actor_admin_a from e10_19b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_delete_document_pdf_template(v_tenant_a, v_template_order_a);
  exception
    when others then
      if sqlerrm like 'document_pdf_template.in_use%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un gabarit ORDER encore porte par un document a pu etre supprime (attendu document_pdf_template.in_use)';
  end if;
end;
$$;

rollback;
