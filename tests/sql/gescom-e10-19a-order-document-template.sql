-- ============================================================================
-- E10.19a — le gabarit de bon de commande : `document_pdf_templates.
-- document_type` elargi a `order` (arbitrage (A)), `document_pdf_template_
-- fields.field` elargi aux cinq valeurs `order.*` (contrat §4, sans
-- `order.status` — DEFINITIF), et les DEUX COLONNES GELEES de la decision
-- (D) sur `commercial_orders` (`show_discounts`, `customer_reference`),
-- recopiees a la conversion et protegees par le trigger d immuabilite.
-- Migration : 20260910000100. Contrat : docs/api/CONVENTIONS.md §8.20.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : les deux
-- `check` elargis, la recopie dans `api_convert_commercial_quote` et
-- l extension du trigger d immuabilite vivent ENTIEREMENT dans la migration
-- 20260910000100 — une lecture de son texte ne prouve pas qu ils se
-- comportent correctement sous appel reel (meme lecon que E10.12/E10.10b-4b).
--
-- Scenarios :
--   1. `document_pdf_templates.document_type` accepte desormais `order` ;
--      une valeur hors enumeration reste refusee. Un tenant peut avoir SON
--      PROPRE defaut par type EN MEME TEMPS (`quote` ET `order`) — l index
--      unique partiel `(tenant_id, document_type) where is_default` est
--      bien PORTE PAR TYPE, pas par tenant seul (arbitrage (A)).
--   2. `document_pdf_template_fields.field` accepte les cinq valeurs
--      `order.*` ; `order.status` reste refuse EN BASE (DEFINITIF, contrat :
--      "un statut de production imprime sur une piece figee est faux des le
--      lendemain").
--   3. `api_convert_commercial_quote` RECOPIE `commercial_quotes.
--      show_discounts` sur `commercial_orders.show_discounts` — verifie sur
--      DEUX devis (`true` puis `false`) pour prouver une recopie REELLE, pas
--      une valeur par defaut constante. `customer_reference` vaut NULL
--      (aucune source amont, ecart de donnees documente).
--   4. Immuabilite EN BASE : `show_discounts`/`customer_reference` ne se
--      modifient JAMAIS apres conversion (`order.immutable`) ; `status`/
--      `updated_at` restent mutables (regression guard, le trigger entier a
--      ete RECREE par cette migration).
--   5. RLS — isolation inter-tenant en LECTURE, INCHANGEE mais reverifiee
--      sur un gabarit `order` (meme policy que pour `quote`, aucune policy
--      neuve dans ce lot).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_19a_context (
  tenant_a     uuid not null,
  tenant_b     uuid not null,
  actor_a      uuid not null,
  actor_b      uuid not null,
  customer_a   uuid not null,
  -- Renseignes par le scenario 3, relus par le scenario 4 — un ID de
  -- commande, jamais un numero suppose (le compteur de sequence n est pas
  -- l objet de ce test).
  order_shown  uuid,
  order_hidden uuid
);

grant select on e10_19a_context to authenticated;

do $$
declare
  v_actor_a uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project_a uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_a, 'e10-19a-actor-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-19a-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-19a-tenant-a', 'E10.19a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-19a-tenant-b', 'E10.19a Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.19a Client A', '73282932000074') returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet E10.19a') returning id into v_project_a;

  insert into e10_19a_context (tenant_a, tenant_b, actor_a, actor_b, customer_a)
  values (v_tenant_a, v_tenant_b, v_actor_a, v_actor_b, v_customer_a);

  -- Le project_id n est pas reutilise hors de ce bloc ; conserve via une
  -- table temporaire distincte serait superflu, les quotes ci-dessous
  -- referencent v_project_a directement dans le MEME bloc plus bas via
  -- une sous-requete sur public.projects.
end;
$$;

-- ── 1. document_type ELARGI, defaut PAR TYPE ────────────────────────────────
do $$
declare
  v_tenant uuid;
  v_template_quote uuid;
  v_template_order uuid;
  v_rejected boolean;
  v_default_quote boolean;
  v_default_order boolean;
begin
  select tenant_a into v_tenant from e10_19a_context;

  insert into public.document_pdf_templates (tenant_id, name, document_type, status, is_default, is_active, page_count, pages)
    values (v_tenant, 'Papier devis', 'quote', 'ready', true, true, 1, '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb)
    returning id into v_template_quote;

  insert into public.document_pdf_templates (tenant_id, name, document_type, status, is_default, is_active, page_count, pages)
    values (v_tenant, 'Papier commande', 'order', 'ready', true, true, 1, '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb)
    returning id into v_template_order;

  select is_default into v_default_quote from public.document_pdf_templates where id = v_template_quote;
  select is_default into v_default_order from public.document_pdf_templates where id = v_template_order;
  if not v_default_quote or not v_default_order then
    raise exception 'un tenant doit pouvoir avoir un defaut quote ET un defaut order SIMULTANEMENT (index unique PAR TYPE) — quote=%, order=%', v_default_quote, v_default_order;
  end if;

  v_rejected := false;
  begin
    insert into public.document_pdf_templates (tenant_id, name, document_type, status)
      values (v_tenant, 'Papier invalide', 'bogus', 'awaiting_upload');
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'document_type = ''bogus'' aurait du etre refuse par le check elargi';
  end if;
end;
$$;

-- ── 2. field ELARGI aux cinq valeurs order.*, order.status TOUJOURS refuse ─
do $$
declare
  v_tenant uuid;
  v_template_order uuid;
  v_inserted integer;
  v_rejected boolean;
begin
  select tenant_a into v_tenant from e10_19a_context;
  select id into v_template_order from public.document_pdf_templates where tenant_id = v_tenant and document_type = 'order';

  insert into public.document_pdf_template_fields
    (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
  values
    (v_template_order, v_tenant, 'order.number', 0, 50, 780, 'left', 'helvetica', 12, '#111111'),
    (v_template_order, v_tenant, 'order.created_at', 0, 50, 760, 'left', 'helvetica', 10, '#111111'),
    (v_template_order, v_tenant, 'order.quote_number', 0, 50, 740, 'left', 'helvetica', 10, '#111111'),
    (v_template_order, v_tenant, 'order.customer_reference', 0, 50, 720, 'left', 'helvetica', 10, '#111111'),
    (v_template_order, v_tenant, 'order.expected_delivery_date', 0, 50, 700, 'left', 'helvetica', 10, '#111111');

  select count(*) into v_inserted
    from public.document_pdf_template_fields
   where template_id = v_template_order
     and field in ('order.number', 'order.created_at', 'order.quote_number', 'order.customer_reference', 'order.expected_delivery_date');
  if v_inserted <> 5 then
    raise exception 'les cinq valeurs order.* auraient du etre acceptees par le check elargi (% inseree(s))', v_inserted;
  end if;

  v_rejected := false;
  begin
    insert into public.document_pdf_template_fields
      (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
    values (v_template_order, v_tenant, 'order.status', 0, 50, 680, 'left', 'helvetica', 10, '#111111');
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'order.status doit rester refuse EN BASE, DEFINITIVEMENT (contrat : un statut de production imprime sur une piece figee est faux des le lendemain)';
  end if;
end;
$$;

-- ── 3. api_convert_commercial_quote RECOPIE show_discounts, PAS customer_reference ─
do $$
declare
  v_tenant uuid;
  v_actor uuid;
  v_customer uuid;
  v_project uuid;
  v_quote_shown uuid;
  v_quote_hidden uuid;
  v_order_shown uuid;
  v_order_hidden uuid;
  v_row record;
begin
  select tenant_a, actor_a, customer_a into v_tenant, v_actor, v_customer from e10_19a_context;
  select id into v_project from public.projects where tenant_id = v_tenant limit 1;

  -- Devis 1 : show_discounts = true.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant, v_customer, v_project, 'DEV-2026-93001', 'draft', '2099-01-01', true)
    returning id into v_quote_shown;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_shown, null, 'free', 'Flyers', 100, 0, 40.00, 80.00, 80.00, 1.0000, 75.00, 0.0625, '[{"post":"total","cost":"40.00","margin_rate":"1.0000","price":"80.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_shown;
  perform set_config('magrit.quote_transition', '', true);

  -- Devis 2 : show_discounts = false.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant, v_customer, v_project, 'DEV-2026-93002', 'draft', '2099-01-01', false)
    returning id into v_quote_hidden;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_hidden, null, 'free', 'Cartes', 200, 0, 30.00, 60.00, 60.00, 1.0000, 60.00, 0.0000, '[{"post":"total","cost":"30.00","margin_rate":"1.0000","price":"60.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_hidden;
  perform set_config('magrit.quote_transition', '', true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.api_convert_commercial_quote(v_tenant, v_quote_shown) into v_order_shown;
  select public.api_convert_commercial_quote(v_tenant, v_quote_hidden) into v_order_hidden;
  reset role;

  select * into v_row from public.commercial_orders where id = v_order_shown;
  if v_row.show_discounts is distinct from true then
    raise exception 'show_discounts=true du devis source aurait du etre RECOPIE sur la commande, obtenu %', v_row.show_discounts;
  end if;
  if v_row.customer_reference is not null then
    raise exception 'customer_reference doit valoir NULL (aucune source amont sur commercial_quotes), obtenu %', v_row.customer_reference;
  end if;

  select * into v_row from public.commercial_orders where id = v_order_hidden;
  if v_row.show_discounts is distinct from false then
    raise exception 'show_discounts=false du devis source aurait du etre RECOPIE sur la commande (preuve d une recopie REELLE, pas d une constante), obtenu %', v_row.show_discounts;
  end if;

  update e10_19a_context set order_shown = v_order_shown, order_hidden = v_order_hidden;
end;
$$;

-- ── 4. Immuabilite EN BASE des deux colonnes GELEES (D) ─────────────────────
do $$
declare
  v_order uuid;
  v_blocked boolean;
begin
  select order_shown into v_order from e10_19a_context;

  v_blocked := false;
  begin
    update public.commercial_orders set show_discounts = not show_discounts where id = v_order;
  exception when others then
    if sqlerrm like 'order.immutable%' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'show_discounts a pu etre modifie apres conversion (doit etre GELE, decision D)'; end if;

  v_blocked := false;
  begin
    update public.commercial_orders set customer_reference = 'CMD-FORGEE' where id = v_order;
  exception when others then
    if sqlerrm like 'order.immutable%' then v_blocked := true; else raise; end if;
  end;
  if not v_blocked then raise exception 'customer_reference a pu etre modifie apres conversion (doit etre GELE, decision D)'; end if;

  -- Regression guard : le trigger entier a ete RECREE par cette migration,
  -- `status`/`updated_at` doivent rester mutables (E10.13/E10.14 y posent
  -- leurs transitions).
  update public.commercial_orders set status = 'validated' where id = v_order;
end;
$$;

-- ── 5. RLS — isolation inter-tenant en LECTURE, reverifiee sur un gabarit `order` ─
do $$
declare
  v_actor_b uuid;
  v_visible integer;
begin
  select actor_b into v_actor_b from e10_19a_context limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible from public.document_pdf_templates where document_type = 'order';
  reset role;

  if v_visible <> 0 then
    raise exception 'le tenant B voit % gabarit(s) order du tenant A — document_pdf_templates_select rompue', v_visible;
  end if;
end;
$$;

rollback;
