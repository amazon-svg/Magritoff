-- AF5.2a — création atomique et idempotente d une commande avec ses lignes.

create or replace function public.api_create_tenant_order(
  p_shop_id uuid,
  p_currency text,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_order_id uuid;
  v_total_ht numeric(12,2);
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
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

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':order.create:' || p_idempotency_key, 0));

  select result into v_result
    from public.order_command_receipts
   where actor_user_id = v_actor
     and command_type = 'order.create'
     and idempotency_key = p_idempotency_key;
  if v_result is not null then
    return v_result || jsonb_build_object('replayed', true);
  end if;

  select tenant_id into v_tenant_id
    from public.shops
   where id = p_shop_id and active = true;
  if v_tenant_id is null then
    raise exception 'shop_not_found';
  end if;
  if not public.current_user_can_access_shop(p_shop_id)
     or not public.user_can_create_order(v_tenant_id) then
    raise exception 'permission_denied: order creation forbidden';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) item
     where nullif(trim(item->>'product_label'), '') is null
        or coalesce((item->>'quantity')::numeric, 0) <= 0
        or coalesce((item->>'unit_price_ht')::numeric, -1) < 0
  ) then
    raise exception 'invalid_order_items: invalid label, quantity or price';
  end if;

  select round(sum(
    ((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric)
  ), 2) into v_total_ht
    from jsonb_array_elements(p_items) item;

  insert into public.tenant_orders
    (tenant_id, shop_id, created_by, status, total_ht, currency, notes)
  values
    (v_tenant_id, p_shop_id, v_actor, 'draft', v_total_ht, p_currency, coalesce(p_notes, ''))
  returning id into v_order_id;

  insert into public.tenant_order_items
    (order_id, product_id, product_label, clariprint_options, quantity, unit_price_ht, line_total_ht)
  select
    v_order_id,
    case when nullif(item->>'product_id', '') is null then null else (item->>'product_id')::uuid end,
    trim(item->>'product_label'),
    coalesce(item->'clariprint_options', '{}'::jsonb),
    (item->>'quantity')::integer,
    (item->>'unit_price_ht')::numeric,
    round((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric, 2)
  from jsonb_array_elements(p_items) item;

  v_result := jsonb_build_object(
    'order_id', v_order_id,
    'tenant_id', v_tenant_id,
    'shop_id', p_shop_id,
    'total_ht', v_total_ht,
    'currency', p_currency,
    'replayed', false
  );

  insert into public.order_command_receipts
    (actor_user_id, command_type, idempotency_key, aggregate_id, result)
  values
    (v_actor, 'order.create', p_idempotency_key, v_order_id, v_result);

  return v_result;
exception
  when invalid_text_representation then
    raise exception 'invalid_order_items: malformed product id or numeric value';
end;
$$;

grant execute on function public.api_create_tenant_order(uuid, text, text, jsonb, text) to authenticated;
notify pgrst, 'reload schema';
