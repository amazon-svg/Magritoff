-- AF6 — complète le détail Orders partagé avec la date de création.

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
notify pgrst, 'reload schema';
