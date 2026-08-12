-- AF5.2b — édition atomique et idempotente des lignes d une commande brouillon.

create or replace function public.api_get_tenant_order_draft(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select jsonb_build_object(
    'order_id', orders.id,
    'status', orders.status::text,
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
      ) order by items.created_at)
      from public.tenant_order_items items
      where items.order_id = orders.id
    ), '[]'::jsonb)
  ) into v_result
  from public.tenant_orders orders
  where orders.id = p_order_id
    and orders.created_by = v_actor;

  if v_result is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;
  return v_result;
end;
$$;

grant execute on function public.api_get_tenant_order_draft(uuid) to authenticated;

create or replace function public.api_update_tenant_order_draft(
  p_order_id uuid,
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
  v_created_by uuid;
  v_status text;
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

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':order.update:' || p_idempotency_key, 0));

  select result into v_result
    from public.order_command_receipts
   where actor_user_id = v_actor
     and command_type = 'order.update'
     and idempotency_key = p_idempotency_key;
  if v_result is not null then
    return v_result || jsonb_build_object('replayed', true);
  end if;

  select created_by, status::text
    into v_created_by, v_status
    from public.tenant_orders
   where id = p_order_id
   for update;
  if v_created_by is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;
  if v_created_by <> v_actor then
    raise exception 'permission_denied: only the order author can edit it';
  end if;
  if v_status <> 'draft' then
    raise exception 'order_not_editable: status is %', v_status;
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) item
     where nullif(item->>'id', '') is null
        or nullif(trim(item->>'product_label'), '') is null
        or coalesce((item->>'quantity')::numeric, 0) <= 0
        or (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric)
        or coalesce((item->>'unit_price_ht')::numeric, -1) < 0
  ) then
    raise exception 'invalid_order_items: invalid id, label, quantity or price';
  end if;

  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct item->>'id') from jsonb_array_elements(p_items) item) then
    raise exception 'invalid_order_items: duplicate item id';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) item
      left join public.tenant_order_items existing
        on existing.id = (item->>'id')::uuid
       and existing.order_id = p_order_id
     where existing.id is null
  ) then
    raise exception 'invalid_order_items: item does not belong to order';
  end if;

  delete from public.tenant_order_items existing
   where existing.order_id = p_order_id
     and not exists (
       select 1
         from jsonb_array_elements(p_items) item
        where (item->>'id')::uuid = existing.id
     );

  update public.tenant_order_items existing
     set product_label = trim(item->>'product_label'),
         quantity = (item->>'quantity')::integer,
         unit_price_ht = (item->>'unit_price_ht')::numeric,
         line_total_ht = round(
           (item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric,
           2
         )
    from jsonb_array_elements(p_items) item
   where existing.order_id = p_order_id
     and existing.id = (item->>'id')::uuid;

  select round(sum(line_total_ht), 2)
    into v_total_ht
    from public.tenant_order_items
   where order_id = p_order_id;

  update public.tenant_orders
     set total_ht = v_total_ht
   where id = p_order_id;

  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'total_ht', v_total_ht,
    'replayed', false
  );

  insert into public.order_command_receipts
    (actor_user_id, command_type, idempotency_key, aggregate_id, result)
  values
    (v_actor, 'order.update', p_idempotency_key, p_order_id, v_result);

  return v_result;
exception
  when invalid_text_representation then
    raise exception 'invalid_order_items: malformed item id or numeric value';
end;
$$;

grant execute on function public.api_update_tenant_order_draft(uuid, jsonb, text) to authenticated;
notify pgrst, 'reload schema';
