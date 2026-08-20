-- UM6.3 — lecture et édition des brouillons par compte boutique, avec repli
-- explicite sur l'identité Magrit lorsque celle-ci possède la commande.

create table if not exists private.storefront_order_update_receipts (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null,
  idempotency_key text not null,
  aggregate_id uuid not null references public.tenant_orders(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (shop_customer_account_id, idempotency_key)
);
alter table private.storefront_order_update_receipts enable row level security;
revoke all on table private.storefront_order_update_receipts from public, anon, authenticated;

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

  select jsonb_build_object(
    'order_id', orders.id,
    'status', orders.status::text,
    'created_at', orders.created_at,
    'total_ht', orders.total_ht,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', items.id,
        'product_id', items.product_id,
        'product_label', items.product_label,
        'clariprint_options', items.clariprint_options,
        'quantity', items.quantity,
        'unit_price_ht', items.unit_price_ht,
        'line_total_ht', items.line_total_ht
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

  delete from public.tenant_order_items existing
   where existing.order_id = p_order_id
     and not exists (
       select 1 from jsonb_array_elements(p_items) item where (item->>'id')::uuid = existing.id
     );
  update public.tenant_order_items existing
     set product_label = trim(item->>'product_label'),
         quantity = (item->>'quantity')::integer,
         unit_price_ht = (item->>'unit_price_ht')::numeric,
         line_total_ht = round((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric, 2)
    from jsonb_array_elements(p_items) item
   where existing.order_id = p_order_id and existing.id = (item->>'id')::uuid;

  select round(sum(line_total_ht), 2) into v_total_ht
    from public.tenant_order_items where order_id = p_order_id;
  update public.tenant_orders set total_ht = v_total_ht where id = p_order_id;

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
notify pgrst, 'reload schema';
