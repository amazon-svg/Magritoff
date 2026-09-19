-- Q17-a — le serveur cesse de faire confiance au prix envoye par le
-- navigateur (docs/api/CONVENTIONS.md §8.25 point 12). Decision d Arnaud du
-- 2026-09-19 : « recalcul cote serveur lance le lot ».
--
-- Migration ADDITIVE. Aucune commande existante n est retouchee : les lignes
-- deja en base recoivent `price_origin = 'legacy'` et la garde de transition
-- ne leur demande jamais d acquittement (point 12 (g)).
--
-- Contenu :
--   1. `tenant_order_items.price_origin` (enum texte ferme) + backfill
--      `legacy` sur l existant.
--   2. `tenant_orders.has_unverified_prices` (miroir, pour l atelier).
--   3. Trigger `tenant_order_items_immutable_after_draft` — gele les lignes
--      des que la commande n est plus `draft` (point 12 (g)).
--   4. `private.resolve_storefront_catalog_price` — la hierarchie opposable
--      du point 12 (b), reprise de `publicCatalog`
--      (`src/adapters/supabase/shops-repository.ts`), pas reinventee.
--   5. `private.classify_storefront_order_line` — classifie une ligne
--      (`catalog` / `client_unverified`) et signale un ecart de prix.
--   6. Recreation de `api_create_storefront_order` (verifie le perimetre,
--      recalcule, refuse en 409/422) et de `api_update_order_draft_for_identity`
--      (meme regle sur la branche storefront, point 12 (e)).
--   7. Recreation de `transition_tenant_order_status` (+ ses deux appelants)
--      pour rejouer la verification a la transition `draft -> validated`
--      (point 12 (e)), avec acquittement explicite et trace (point 12 (c)).
--   8. `api_get_order_draft_for_identity` expose `price_origin` par ligne et
--      `has_unverified_prices` sur la commande (point 12 (h) — Q17-c lit ces
--      deux champs par la facade, jamais une table en direct).

-- ─── 1. tenant_order_items.price_origin ────────────────────────────────────

alter table public.tenant_order_items
  add column if not exists price_origin text;

update public.tenant_order_items
   set price_origin = 'legacy'
 where price_origin is null;

alter table public.tenant_order_items
  alter column price_origin set not null;

do $$ begin
  alter table public.tenant_order_items
    add constraint tenant_order_items_price_origin_check
    check (price_origin in ('catalog', 'quoted', 'client_unverified', 'legacy'));
exception when duplicate_object then null;
end $$;

comment on column public.tenant_order_items.price_origin is
  'Q17-a — provenance du prix de la ligne : catalog (recalcule et verifie par le serveur), quoted (Q17-b, devis serveur non perime), client_unverified (le serveur ne peut pas verifier), legacy (ligne anterieure a cette regle, migration de reprise uniquement). Aucun defaut implicite : chaque ecriture le calcule.';

-- ─── 2. tenant_orders.has_unverified_prices ────────────────────────────────

alter table public.tenant_orders
  add column if not exists has_unverified_prices boolean not null default false;

comment on column public.tenant_orders.has_unverified_prices is
  'Q17-a — miroir de "au moins une ligne price_origin = client_unverified", maintenu par api_create_storefront_order / api_update_order_draft_for_identity. Les commandes anterieures a Q17-a restent a false (point 12 (g)) : leurs lignes sont legacy, jamais unverified.';

-- ─── 3. Immuabilite des lignes hors brouillon ──────────────────────────────
-- Meme mecanique que `commercial_order_lines_immutable`
-- (20260908010000_gescom_e10_12_quote_conversion.sql) : la cascade depuis la
-- suppression de la commande PARENTE reste legitime (le SELECT sur
-- tenant_orders ne trouve alors plus la ligne, la commande ayant deja ete
-- supprimee dans la meme transaction). `tenant_order_items` ne peut pas etre
-- immuable TOUT COURT : l auteur a le droit documente de modifier son
-- brouillon (`api_update_order_draft_for_identity`), ce n est pas une dette.

create or replace function public.tenant_order_items_immutable_after_draft()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status::text into v_status
    from public.tenant_orders
   where id = coalesce(old.order_id, new.order_id);

  if v_status is null then
    -- Cascade depuis la suppression de la commande parente : legitime.
    return old;
  end if;

  if v_status = 'draft' then
    -- Autorise : l auteur a le droit documente de modifier son brouillon.
    -- Un `before update` qui rendrait `old` ecrirait la ligne INCHANGEE au
    -- lieu de laisser passer la modification demandee (defaut trouve a
    -- l execution de ce lot, corrige avant la revue : `get diagnostics
    -- row_count` rendait 1 ligne modifiee, mais la valeur relue restait
    -- celle d avant l UPDATE). `DELETE` n a pas de `new`, seul `old` existe.
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'order_item.immutable: une ligne de commande ne se supprime plus une fois la commande hors brouillon (commande %, statut %)', old.order_id, v_status;
  end if;

  raise exception 'order_item.immutable: une ligne de commande ne se modifie plus une fois la commande hors brouillon (commande %, statut %)', old.order_id, v_status;
end;
$$;

drop trigger if exists tenant_order_items_immutable_after_draft on public.tenant_order_items;
create trigger tenant_order_items_immutable_after_draft
  before update or delete on public.tenant_order_items
  for each row execute function public.tenant_order_items_immutable_after_draft();

comment on trigger tenant_order_items_immutable_after_draft on public.tenant_order_items is
  'Q17-a (point 12 (g)) — ferme le constat du 2026-09-19 : avant ce trigger, la seule policy (tenant_order_items_update, 20260824000400) autorisait tout acteur can_manage_tenant_orders() a reecrire le prix d une ligne validee/produite/expediee/facturee, sans laisser de trace.';

-- ─── 4. Hierarchie opposable du prix ferme (point 12 (b)) ──────────────────
-- Reprend exactement `publicCatalog` (shops-repository.ts) : ne la reecrit
-- pas. `shops.library_ids` reference des GROUPES (`libraries.id`), pas des
-- product_library.id — `product_library.library_id` est la colonne qui les
-- relie (20260420000001_libraries.sql).

create or replace function private.resolve_storefront_catalog_price(
  p_shop_id uuid,
  p_product_id uuid
)
returns table (price_ht numeric(12,2), reference_config jsonb, in_scope boolean)
language plpgsql
stable
set search_path = public, private
as $$
declare
  v_shop record;
  v_manual record;
  v_library record;
  v_override numeric(12,2);
  v_in_scope boolean := false;
  v_price numeric(12,2) := null;
begin
  -- Chaque colonne est qualifiee par sa table : `price_ht`, `config` et
  -- `in_scope` sont AUSSI les noms des colonnes de sortie de cette fonction
  -- (`returns table (...)`), donc des variables PL/pgSQL implicites dans ce
  -- corps. Un SELECT non qualifie leve "column reference is ambiguous" (leve
  -- reellement a l execution locale de ce lot, corrige avant la revue).
  select shops.library_ids, shops.excluded_product_ids, shops.pim_catalog_mode, shops.pim_gamme_slugs
    into v_shop
    from public.shops
   where shops.id = p_shop_id;

  select shop_products.price_ht, shop_products.config into v_manual
    from public.shop_products
   where shop_products.shop_id = p_shop_id and shop_products.product_id = p_product_id
   order by shop_products.created_at asc
   limit 1;

  select product_library.price_ht, product_library.config, product_library.active,
         product_library.gamme_slug, product_library.library_id into v_library
    from public.product_library
   where product_library.id = p_product_id;

  select shop_product_pricing.price_ht_override into v_override
    from public.shop_product_pricing
   where shop_product_pricing.shop_id = p_shop_id
     and shop_product_pricing.library_product_id = p_product_id;

  v_in_scope := v_manual.price_ht is not null
    or (
      v_library.active is true
      and not (p_product_id = any(coalesce(v_shop.excluded_product_ids, '{}'::uuid[])))
      and (
        (v_library.library_id is not null
          and v_library.library_id = any(coalesce(v_shop.library_ids, '{}'::uuid[])))
        or (
          v_shop.pim_catalog_mode is true
          and v_library.gamme_slug is not null
          and v_library.gamme_slug = any(coalesce(v_shop.pim_gamme_slugs, '{}'::text[]))
        )
      )
    );

  if v_override is not null and v_override > 0 then
    v_price := v_override;
  elsif v_manual.price_ht is not null and v_manual.price_ht > 0 then
    v_price := v_manual.price_ht;
  elsif v_in_scope and v_library.price_ht is not null and v_library.price_ht > 0 then
    v_price := v_library.price_ht;
  end if;

  return query select
    v_price,
    coalesce(v_manual.config, v_library.config, '{}'::jsonb),
    v_in_scope;
end;
$$;

revoke all on function private.resolve_storefront_catalog_price(uuid, uuid) from public, anon, authenticated;

comment on function private.resolve_storefront_catalog_price is
  'Q17-a (point 12 (b)) — rang 1 shop_product_pricing.price_ht_override, rang 2 shop_products.price_ht (product_id = X), rang 3 product_library.price_ht si dans le perimetre de la boutique, rang 4 aucun prix ferme (null). Zero est saute, jamais retenu (point 4, "jamais 0 euro").';

-- ─── 5. Classification d une ligne (point 12 (a) et (b)) ───────────────────
-- Ne LEVE jamais : rend une classification, la RPC appelante decide de la
-- politique (create refuse le hors-perimetre, update ne le peut pas puisque
-- le product_id n est pas resoumis).

create or replace function private.classify_storefront_order_line(
  p_shop_id uuid,
  p_product_id uuid,
  p_clariprint_options jsonb,
  p_unit_price_ht numeric
)
returns table (price_origin text, in_scope boolean, reference_price numeric(12,2), mismatch boolean)
language plpgsql
stable
set search_path = public, private
as $$
declare
  v_resolved record;
begin
  if p_product_id is null then
    return query select 'client_unverified'::text, true, null::numeric(12,2), false;
    return;
  end if;

  select * into v_resolved
    from private.resolve_storefront_catalog_price(p_shop_id, p_product_id);

  -- Le discriminant catalogue/configure est SERVEUR (point 12 (a), dernier
  -- paragraphe) : egalite jsonb, deja normalisee (cles triees) par Postgres,
  -- jamais une declaration du navigateur.
  if v_resolved.in_scope
     and v_resolved.price_ht is not null
     and coalesce(p_clariprint_options, '{}'::jsonb) = coalesce(v_resolved.reference_config, '{}'::jsonb)
  then
    return query select
      'catalog'::text,
      v_resolved.in_scope,
      v_resolved.price_ht,
      round(p_unit_price_ht, 2) <> v_resolved.price_ht;
  else
    return query select
      'client_unverified'::text,
      v_resolved.in_scope,
      v_resolved.price_ht,
      false;
  end if;
end;
$$;

revoke all on function private.classify_storefront_order_line(uuid, uuid, jsonb, numeric) from public, anon, authenticated;

-- ─── 6a. api_create_storefront_order — RECREATION complete ─────────────────

create or replace function public.api_create_storefront_order(
  p_opaque_token text,
  p_shop_id uuid,
  p_currency text,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session record;
  v_tenant_id uuid;
  v_order_id uuid;
  v_total_ht numeric(12,2);
  v_result jsonb;
  v_actor uuid;
  v_item jsonb;
  v_product_id uuid;
  v_unit_price numeric;
  v_options jsonb;
  v_classified record;
  v_computed_items jsonb := '[]'::jsonb;
  v_mismatches jsonb := '[]'::jsonb;
  v_has_unverified boolean := false;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'permission_denied: storefront session invalid';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency_key_required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_order_items: at least one item is required';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;

  select * into v_session
    from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null or v_session.shop_id <> p_shop_id then
    raise exception 'permission_denied: storefront session shop mismatch';
  end if;

  select tenant_id into v_tenant_id
    from public.shops
   where id = p_shop_id and active = true;
  if v_tenant_id is null then
    raise exception 'shop_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_session.account_id::text || ':storefront-order.create:' || p_idempotency_key, 0
  ));

  select result into v_result
    from private.storefront_order_command_receipts
   where shop_customer_account_id = v_session.account_id
     and idempotency_key = p_idempotency_key;
  if v_result is not null then
    return v_result || jsonb_build_object('replayed', true);
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
     where nullif(trim(item->>'product_label'), '') is null
        or coalesce((item->>'quantity')::numeric, 0) <= 0
        or coalesce((item->>'unit_price_ht')::numeric, -1) < 0
  ) then
    raise exception 'invalid_order_items: invalid label, quantity or price';
  end if;

  -- Q17-a (point 12) — le serveur ne fait plus confiance au prix du
  -- navigateur : chaque ligne reliee a un produit est controlee contre le
  -- catalogue de CETTE boutique (point 12 (b), constat du 2026-09-19) et son
  -- prix est recalcule contre la hierarchie opposable. Boucle plutot que
  -- set-based : la branche differe par ligne et un `case` set-based serait
  -- illisible et invraisemblable a relire en revue.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := case when nullif(v_item->>'product_id', '') is null then null else (v_item->>'product_id')::uuid end;
    v_unit_price := round((v_item->>'unit_price_ht')::numeric, 2);
    v_options := coalesce(v_item->'clariprint_options', '{}'::jsonb);

    select * into v_classified
      from private.classify_storefront_order_line(p_shop_id, v_product_id, v_options, v_unit_price);

    if v_product_id is not null and not v_classified.in_scope then
      raise exception 'product_not_in_shop: % is not in the catalog of shop %', v_product_id, p_shop_id;
    end if;

    if v_classified.mismatch then
      v_mismatches := v_mismatches || jsonb_build_array(jsonb_build_object(
        'product_label', trim(v_item->>'product_label'),
        'submitted', v_unit_price::text,
        'current', v_classified.reference_price::text
      ));
    end if;

    if v_classified.price_origin = 'client_unverified' then
      v_has_unverified := true;
    end if;

    v_computed_items := v_computed_items || jsonb_build_array(
      v_item || jsonb_build_object('price_origin', v_classified.price_origin)
    );
  end loop;

  if jsonb_array_length(v_mismatches) > 0 then
    raise exception 'price_changed:%', v_mismatches::text;
  end if;

  select round(sum(
    ((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric)
  ), 2) into v_total_ht
    from jsonb_array_elements(p_items) item;

  v_actor := case when v_session.session_kind = 'delegated'
    then v_session.actor_magrit_user_id else null end;

  insert into public.tenant_orders (
    tenant_id, shop_id, created_by, shop_customer_account_id,
    acted_by_magrit_user_id, status, total_ht, currency, notes,
    has_unverified_prices
  ) values (
    v_tenant_id, p_shop_id, v_actor, v_session.account_id,
    v_actor, 'draft', v_total_ht, p_currency, coalesce(p_notes, ''),
    v_has_unverified
  ) returning id into v_order_id;

  insert into public.tenant_order_items (
    order_id, product_id, product_label, clariprint_options,
    quantity, unit_price_ht, line_total_ht, price_origin
  )
  select
    v_order_id,
    case when nullif(item->>'product_id', '') is null then null else (item->>'product_id')::uuid end,
    trim(item->>'product_label'),
    coalesce(item->'clariprint_options', '{}'::jsonb),
    (item->>'quantity')::integer,
    (item->>'unit_price_ht')::numeric,
    round((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric, 2),
    item->>'price_origin'
  from jsonb_array_elements(v_computed_items) item;

  v_result := jsonb_build_object(
    'order_id', v_order_id,
    'tenant_id', v_tenant_id,
    'shop_id', p_shop_id,
    'total_ht', v_total_ht,
    'currency', p_currency,
    'replayed', false
  );

  insert into private.storefront_order_command_receipts (
    shop_customer_account_id, idempotency_key, aggregate_id, result
  ) values (
    v_session.account_id, p_idempotency_key, v_order_id, v_result
  );

  return v_result;
exception
  when invalid_text_representation then
    raise exception 'invalid_order_items: malformed product id or numeric value';
end;
$$;

revoke all on function public.api_create_storefront_order(text, uuid, text, text, jsonb, text) from public;
grant execute on function public.api_create_storefront_order(text, uuid, text, text, jsonb, text) to anon, authenticated;

-- ─── 6b. api_update_order_draft_for_identity — RECREATION (branche storefront) ─
-- La branche `magrit_user` continue de deleguer a
-- `api_update_tenant_order_draft`, INCHANGEE (hors perimetre de Q17-a, point
-- 9 (i) : cette fonction n est pas dans la liste des fichiers recrees).

create or replace function public.api_get_order_draft_for_identity(
  p_order_id uuid,
  p_opaque_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_session_account_id uuid;
  v_session_shop_id uuid;
  v_order record;
  v_result jsonb;
  v_storefront_allowed boolean := false;
begin
  if p_opaque_token is not null then
    if length(p_opaque_token) not between 32 and 512
       or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
      raise exception 'permission_denied: storefront session invalid';
    end if;
    select account_id, shop_id into v_session_account_id, v_session_shop_id
      from public.api_resolve_shop_customer_session(p_opaque_token);
  end if;

  select id, shop_id, shop_customer_account_id, created_by
    into v_order from public.tenant_orders where id = p_order_id;
  if v_order.id is null then raise exception 'order_not_found: %', p_order_id; end if;

  v_storefront_allowed := v_session_account_id is not null
    and v_session_account_id = v_order.shop_customer_account_id
    and v_session_shop_id = v_order.shop_id;
  if not v_storefront_allowed and (v_actor is null or v_order.created_by <> v_actor) then
    raise exception 'permission_denied: order identity mismatch';
  end if;

  -- Q17-a (point 12 (h)) — `price_origin` par ligne et `has_unverified_prices`
  -- sur la commande : c est par CETTE facade, jamais une table en direct, que
  -- Q17-c lira l ecart au catalogue.
  select jsonb_build_object(
    'order_id', orders.id,
    'status', orders.status::text,
    'created_at', orders.created_at,
    'total_ht', orders.total_ht,
    'has_unverified_prices', orders.has_unverified_prices,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', items.id,
        'product_id', items.product_id,
        'product_label', items.product_label,
        'clariprint_options', items.clariprint_options,
        'quantity', items.quantity,
        'unit_price_ht', items.unit_price_ht,
        'line_total_ht', items.line_total_ht,
        'price_origin', items.price_origin
      ) order by items.created_at, items.id)
      from public.tenant_order_items items where items.order_id = orders.id
    ), '[]'::jsonb)
  ) into v_result
  from public.tenant_orders orders where orders.id = p_order_id;
  return v_result;
end;
$$;

create or replace function public.api_update_order_draft_for_identity(
  p_order_id uuid,
  p_items jsonb,
  p_idempotency_key text,
  p_opaque_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_session_account_id uuid;
  v_session_shop_id uuid;
  v_order record;
  v_total_ht numeric(12,2);
  v_result jsonb;
  v_storefront_allowed boolean := false;
  v_item jsonb;
  v_existing record;
  v_classified record;
  v_unit_price numeric;
  v_computed_items jsonb := '[]'::jsonb;
  v_mismatches jsonb := '[]'::jsonb;
  v_has_unverified boolean := false;
begin
  if p_opaque_token is not null then
    if length(p_opaque_token) not between 32 and 512
       or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
      raise exception 'permission_denied: storefront session invalid';
    end if;
    select account_id, shop_id into v_session_account_id, v_session_shop_id
      from public.api_resolve_shop_customer_session(p_opaque_token);
  end if;

  select id, shop_id, shop_customer_account_id, created_by, status::text
    into v_order from public.tenant_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'order_not_found: %', p_order_id; end if;

  v_storefront_allowed := v_session_account_id is not null
    and v_session_account_id = v_order.shop_customer_account_id
    and v_session_shop_id = v_order.shop_id;
  if not v_storefront_allowed then
    if v_actor is null or v_order.created_by <> v_actor then
      raise exception 'permission_denied: order identity mismatch';
    end if;
    return public.api_update_tenant_order_draft(p_order_id, p_items, p_idempotency_key);
  end if;

  if nullif(trim(p_idempotency_key), '') is null then raise exception 'idempotency_key_required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_order_items: at least one item is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_session_account_id::text || ':storefront-order.update:' || p_idempotency_key, 0
  ));
  select result into v_result from private.storefront_order_update_receipts
   where shop_customer_account_id = v_session_account_id and idempotency_key = p_idempotency_key;
  if v_result is not null then return v_result || jsonb_build_object('replayed', true); end if;
  if v_order.status <> 'draft' then raise exception 'order_not_editable: status is %', v_order.status; end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
     where nullif(item->>'id', '') is null
        or nullif(trim(item->>'product_label'), '') is null
        or coalesce((item->>'quantity')::numeric, 0) <= 0
        or (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric)
        or coalesce((item->>'unit_price_ht')::numeric, -1) < 0
  ) then raise exception 'invalid_order_items: invalid id, label, quantity or price'; end if;

  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct item->>'id') from jsonb_array_elements(p_items) item) then
    raise exception 'invalid_order_items: duplicate item id';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    left join public.tenant_order_items existing
      on existing.id = (item->>'id')::uuid and existing.order_id = p_order_id
    where existing.id is null
  ) then raise exception 'invalid_order_items: item does not belong to order'; end if;

  -- Q17-a (point 12 (e)) — meme regle qu a la creation : le product_id et les
  -- clariprint_options d une ligne ne sont PAS resoumis par cette commande
  -- (`updateDraftOrderItemSchema` ne les porte pas) ; ils restent ceux deja
  -- en base, et c est contre EUX que le nouveau prix soumis est recalcule.
  -- Sans cela la garde de la creation se contournerait en deux appels :
  -- creer juste, modifier faux.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select product_id, clariprint_options into v_existing
      from public.tenant_order_items
     where id = (v_item->>'id')::uuid and order_id = p_order_id;

    v_unit_price := round((v_item->>'unit_price_ht')::numeric, 2);

    select * into v_classified
      from private.classify_storefront_order_line(
        v_order.shop_id, v_existing.product_id, v_existing.clariprint_options, v_unit_price
      );

    if v_classified.mismatch then
      v_mismatches := v_mismatches || jsonb_build_array(jsonb_build_object(
        'product_label', trim(v_item->>'product_label'),
        'submitted', v_unit_price::text,
        'current', v_classified.reference_price::text
      ));
    end if;

    if v_classified.price_origin = 'client_unverified' then
      v_has_unverified := true;
    end if;

    v_computed_items := v_computed_items || jsonb_build_array(
      v_item || jsonb_build_object('price_origin', v_classified.price_origin)
    );
  end loop;

  if jsonb_array_length(v_mismatches) > 0 then
    raise exception 'price_changed:%', v_mismatches::text;
  end if;

  delete from public.tenant_order_items existing
   where existing.order_id = p_order_id
     and not exists (
       select 1 from jsonb_array_elements(p_items) item where (item->>'id')::uuid = existing.id
     );
  update public.tenant_order_items existing
     set product_label = trim(item->>'product_label'),
         quantity = (item->>'quantity')::integer,
         unit_price_ht = (item->>'unit_price_ht')::numeric,
         line_total_ht = round((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric, 2),
         price_origin = item->>'price_origin'
    from jsonb_array_elements(v_computed_items) item
   where existing.order_id = p_order_id and existing.id = (item->>'id')::uuid;

  select round(sum(line_total_ht), 2) into v_total_ht
    from public.tenant_order_items where order_id = p_order_id;
  update public.tenant_orders
     set total_ht = v_total_ht,
         has_unverified_prices = exists (
           select 1 from public.tenant_order_items
            where order_id = p_order_id and price_origin = 'client_unverified'
         )
   where id = p_order_id;

  v_result := jsonb_build_object(
    'order_id', p_order_id, 'total_ht', v_total_ht, 'replayed', false
  );
  insert into private.storefront_order_update_receipts (
    shop_customer_account_id, idempotency_key, aggregate_id, result
  ) values (v_session_account_id, p_idempotency_key, p_order_id, v_result);
  return v_result;
exception
  when invalid_text_representation then
    raise exception 'invalid_order_items: malformed item id or numeric value';
end;
$$;

revoke all on function public.api_get_order_draft_for_identity(uuid, text) from public;
revoke all on function public.api_update_order_draft_for_identity(uuid, jsonb, text, text) from public;
grant execute on function public.api_get_order_draft_for_identity(uuid, text) to anon, authenticated;
grant execute on function public.api_update_order_draft_for_identity(uuid, jsonb, text, text) to anon, authenticated;

-- ─── 7. La verification se REFAIT a la transition (point 12 (e)) ──────────
-- Un `If-Match` ne fermerait pas le trou : l atelier ne modifie pas la
-- ligne, il valide sans l avoir revue. C est donc la transition
-- `draft -> validated`, et elle seule, qui recalcule et qui refuse.
--
-- `drop function` puis `create` plutot que `create or replace` seul : les
-- trois fonctions ci-dessous GAGNENT un parametre. `create or replace`
-- n identifie une fonction QUE par son nom et la liste des TYPES de ses
-- parametres — un parametre de plus, meme avec une valeur par defaut, change
-- cette liste et cree un SECOND overload au lieu de remplacer le premier.
-- Constate a l execution de ce lot : sans ce `drop`,
-- `api_transition_order_for_identity(uuid, unknown, unknown, unknown, text)`
-- devenait ambigu entre l ancien signature a 5 parametres et la nouvelle a 6.

drop function if exists public.transition_tenant_order_status(uuid, text, text);
create or replace function public.transition_tenant_order_status(
  p_order_id        uuid,
  p_new_status_code text,
  p_reason          text default null,
  p_acknowledge_unverified_prices boolean default false
)
returns text
language plpgsql security definer set search_path = public, private as $$
declare
  _caller          uuid := auth.uid();
  _order           record;
  _transition      record;
  _new_status_def  record;
  _is_admin_tenant boolean;
  _is_creator      boolean;
  _has_capability  boolean := false;
  _old_status      text;
  _item            record;
  _classified      record;
  _mismatches      jsonb := '[]'::jsonb;
  _has_unverified  boolean := false;
  _unverified_labels text[] := array[]::text[];
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  select * into _order from public.tenant_orders where id = p_order_id;
  if _order is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  -- Vérifie que le statut cible existe dans la matrice tenant
  select * into _new_status_def from public.tenant_order_status_definitions
    where tenant_id = _order.tenant_id and code = p_new_status_code and archived_at is null;
  if _new_status_def is null then
    raise exception 'status_code_unknown: % not defined for tenant %', p_new_status_code, _order.tenant_id;
  end if;

  _old_status := _order.status::text;

  -- Vérifie que la transition est légale
  select * into _transition from public.tenant_order_status_transitions
    where tenant_id = _order.tenant_id
      and from_status_code = _old_status
      and to_status_code = p_new_status_code
      and archived_at is null;

  if _transition is null then
    raise exception 'transition_not_allowed: % -> % not in matrix for tenant', _old_status, p_new_status_code;
  end if;

  -- Autorisation
  _is_creator := (_order.created_by = _caller);
  select exists (
    select 1 from public.tenant_members tm
    where tm.user_id = _caller
      and tm.tenant_id = _order.tenant_id
      and tm.role in ('owner', 'admin')
  ) into _is_admin_tenant;

  if _transition.self_service_creator and _is_creator then
    -- OK : self-service auteur
    null;
  elsif _is_admin_tenant or public.is_super_admin() then
    -- OK : admin tenant ou super_admin passe outre
    null;
  elsif _transition.required_capability is not null then
    -- Sinon : capability requise sur un rôle assigné non-révoqué
    select public.user_has_order_role(p_order_id, _transition.required_capability) into _has_capability;
    if not _has_capability then
      raise exception 'permission_denied: capability % required for % -> %',
        _transition.required_capability, _old_status, p_new_status_code;
    end if;
  else
    raise exception 'permission_denied: transition requires admin tenant';
  end if;

  -- Q17-a (point 12 (c), (d), (e)) — SEULE la transition draft -> validated
  -- rejoue la verification : c est le seul moment ou l atelier engage la
  -- commande sans plus pouvoir revenir en arriere sur ce qu il a vu.
  if _old_status = 'draft' and p_new_status_code = 'validated' then
    for _item in
      select id, product_id, clariprint_options, unit_price_ht, product_label, price_origin
        from public.tenant_order_items
       where order_id = p_order_id
    loop
      if _item.price_origin = 'catalog' then
        select * into _classified from private.classify_storefront_order_line(
          _order.shop_id, _item.product_id, _item.clariprint_options, _item.unit_price_ht
        );
        if _classified.mismatch then
          _mismatches := _mismatches || jsonb_build_array(jsonb_build_object(
            'product_label', _item.product_label,
            'submitted', _item.unit_price_ht::text,
            'current', _classified.reference_price::text
          ));
        end if;
      elsif _item.price_origin = 'client_unverified' then
        _has_unverified := true;
        _unverified_labels := array_append(_unverified_labels, _item.product_label);
      end if;
      -- 'quoted' (Q17-b, pas encore livree) et 'legacy' (point 12 (g)) : ne
      -- bloquent jamais cette transition.
    end loop;

    if jsonb_array_length(_mismatches) > 0 then
      raise exception 'price_changed:%', _mismatches::text;
    end if;

    if _has_unverified and not p_acknowledge_unverified_prices then
      raise exception 'unverified_prices:%', array_to_json(_unverified_labels)::text;
    end if;
  end if;

  -- UPDATE statut + audit
  update public.tenant_orders
    set status = p_new_status_code::public.tenant_order_status,
        updated_at = now(),
        cancelled_at = case when p_new_status_code = 'cancelled' then now() else cancelled_at end
    where id = p_order_id;

  insert into public.tenant_order_status_events
    (order_id, actor_id, from_status, to_status, reason, metadata)
  values (
    p_order_id, _caller,
    _old_status::public.tenant_order_status,
    p_new_status_code::public.tenant_order_status,
    p_reason,
    jsonb_build_object(
      'via_rpc', 'transition_tenant_order_status',
      'is_admin_tenant', _is_admin_tenant,
      'is_creator', _is_creator,
      'capability_used', _transition.required_capability
    ) || case when _old_status = 'draft' and p_new_status_code = 'validated' and _has_unverified
      then jsonb_build_object(
        'acknowledged_unverified_prices', p_acknowledge_unverified_prices,
        'acknowledged_line_labels', to_jsonb(_unverified_labels)
      )
      else '{}'::jsonb
    end
  );

  return p_new_status_code;
end;
$$;

grant execute on function public.transition_tenant_order_status(uuid, text, text, boolean) to authenticated;

drop function if exists public.api_transition_tenant_order_status(uuid, text, text, text);
create or replace function public.api_transition_tenant_order_status(
  p_order_id uuid,
  p_new_status_code text,
  p_reason text,
  p_idempotency_key text,
  p_acknowledge_unverified_prices boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from_status text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency_key_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':order.transition:' || p_idempotency_key, 0));

  select result into v_result
    from public.order_command_receipts
   where actor_user_id = v_actor
     and command_type = 'order.transition'
     and idempotency_key = p_idempotency_key;
  if v_result is not null then
    return v_result || jsonb_build_object('replayed', true);
  end if;

  select status::text into v_from_status
    from public.tenant_orders
   where id = p_order_id;
  if v_from_status is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  perform public.transition_tenant_order_status(p_order_id, p_new_status_code, p_reason, p_acknowledge_unverified_prices);
  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_from_status,
    'to_status', p_new_status_code,
    'replayed', false
  );

  insert into public.order_command_receipts
    (actor_user_id, command_type, idempotency_key, aggregate_id, result)
  values
    (v_actor, 'order.transition', p_idempotency_key, p_order_id, v_result);

  return v_result;
end;
$$;

grant execute on function public.api_transition_tenant_order_status(uuid, text, text, text, boolean) to authenticated;

drop function if exists public.api_transition_order_for_identity(uuid, text, text, text, text);
create or replace function public.api_transition_order_for_identity(
  p_order_id uuid,
  p_new_status_code text,
  p_reason text,
  p_idempotency_key text,
  p_opaque_token text default null,
  p_acknowledge_unverified_prices boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_session_account_id uuid;
  v_session_shop_id uuid;
  v_session_actor uuid;
  v_order record;
  v_result jsonb;
  v_storefront_allowed boolean := false;
begin
  if p_opaque_token is not null then
    if length(p_opaque_token) not between 32 and 512
       or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
      raise exception 'permission_denied: storefront session invalid';
    end if;
    select account_id, shop_id, actor_magrit_user_id
      into v_session_account_id, v_session_shop_id, v_session_actor
      from public.api_resolve_shop_customer_session(p_opaque_token);
  end if;

  select id, shop_id, shop_customer_account_id, created_by, status::text
    into v_order from public.tenant_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'order_not_found: %', p_order_id; end if;

  v_storefront_allowed := v_session_account_id is not null
    and v_session_account_id = v_order.shop_customer_account_id
    and v_session_shop_id = v_order.shop_id;
  if not v_storefront_allowed then
    if v_actor is null then raise exception 'permission_denied: order identity mismatch'; end if;
    return public.api_transition_tenant_order_status(
      p_order_id, p_new_status_code, p_reason, p_idempotency_key, p_acknowledge_unverified_prices
    );
  end if;

  if nullif(trim(p_idempotency_key), '') is null then raise exception 'idempotency_key_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    v_session_account_id::text || ':storefront-order.transition:' || p_idempotency_key, 0
  ));
  select result into v_result from private.storefront_order_transition_receipts
   where shop_customer_account_id = v_session_account_id and idempotency_key = p_idempotency_key;
  if v_result is not null then return v_result || jsonb_build_object('replayed', true); end if;

  if p_new_status_code <> 'cancelled' then
    raise exception 'permission_denied: storefront customers may only cancel orders';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'transition_not_allowed: % -> cancelled', v_order.status;
  end if;

  update public.tenant_orders
     set status = 'cancelled', cancelled_at = now(), updated_at = now()
   where id = p_order_id;
  insert into public.tenant_order_status_events (
    order_id, actor_id, shop_customer_account_id, acted_by_magrit_user_id,
    from_status, to_status, reason, metadata
  ) values (
    p_order_id, v_session_actor, v_session_account_id, v_session_actor,
    'draft', 'cancelled', p_reason,
    jsonb_build_object('source', 'storefront_customer')
  );

  v_result := jsonb_build_object(
    'order_id', p_order_id, 'from_status', 'draft',
    'to_status', 'cancelled', 'replayed', false
  );
  insert into private.storefront_order_transition_receipts (
    shop_customer_account_id, idempotency_key, aggregate_id, result
  ) values (v_session_account_id, p_idempotency_key, p_order_id, v_result);
  return v_result;
end;
$$;

revoke all on function public.api_transition_order_for_identity(uuid, text, text, text, text, boolean) from public;
grant execute on function public.api_transition_order_for_identity(uuid, text, text, text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. Deux familles
-- d objets, deux traitements :
--
--   1. Objets NEUFS (surs a DROP directement) :
--
--   drop trigger if exists tenant_order_items_immutable_after_draft on public.tenant_order_items;
--   drop function if exists public.tenant_order_items_immutable_after_draft();
--   drop function if exists private.classify_storefront_order_line(uuid, uuid, jsonb, numeric);
--   drop function if exists private.resolve_storefront_catalog_price(uuid, uuid);
--   alter table public.tenant_order_items drop column if exists price_origin;
--   alter table public.tenant_orders drop column if exists has_unverified_prices;
--
--   2. Fonctions RECREEES (leur ancienne definition doit etre REJOUEE telle
--      quelle, pas seulement DROP — sinon la route casse) : rejouer, DANS CET
--      ORDRE, le corps `create or replace function` exact de chacune des
--      migrations suivantes, qui restaure la version pre-Q17-a :
--
--   drop function if exists public.transition_tenant_order_status(uuid, text, text, boolean);
--   drop function if exists public.api_transition_tenant_order_status(uuid, text, text, text, boolean);
--   drop function if exists public.api_transition_order_for_identity(uuid, text, text, text, text, boolean);
--     -- puis rejouer, dans cet ordre :
--     --   20260601000300_s_order_roles_2_rpc.sql (transition_tenant_order_status/3)
--     --   20260811000200_api_order_transition_idempotency.sql (api_transition_tenant_order_status/4)
--     --   20260817000400_storefront_order_cancellation.sql (api_transition_order_for_identity/5)
--     --   20260817000100_storefront_order_identity.sql (api_create_storefront_order)
--     --   20260817000300_storefront_order_drafts.sql (api_get_order_draft_for_identity, api_update_order_draft_for_identity)
--
--   notify pgrst, 'reload schema';
--
-- Aucune commande existante n est modifiee par cette migration (point 12 (g)) :
-- un retrait ne perd aucune donnee, il ne fait que redonner au serveur sa
-- credulite d avant Q17-a.
-- ============================================================================
