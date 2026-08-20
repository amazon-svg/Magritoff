-- UM6.2 — lecture du portail client par compte boutique.

create or replace function public.api_get_storefront_portal_orders(
  p_opaque_token text,
  p_shop_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session record;
  v_result jsonb;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'permission_denied: storefront session invalid';
  end if;

  select * into v_session
    from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null or v_session.shop_id <> p_shop_id then
    raise exception 'permission_denied: storefront session shop mismatch';
  end if;

  select jsonb_build_object(
    'tax_regime', t.tax_regime,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', scoped.id,
        'shop_id', scoped.shop_id,
        'created_at', scoped.created_at,
        'total_ht', scoped.total_ht,
        'status', scoped.status,
        'tenant_order_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_label', i.product_label,
            'quantity', i.quantity,
            'unit_price_ht', i.unit_price_ht
          ) order by i.created_at, i.id)
          from public.tenant_order_items i
          where i.order_id = scoped.id
        ), '[]'::jsonb)
      ) order by scoped.created_at desc, scoped.id)
      from (
        select o.id, o.shop_id, o.created_at, o.total_ht, o.status
        from public.tenant_orders o
        where o.shop_id = p_shop_id
          and o.shop_customer_account_id = v_session.account_id
        order by o.created_at desc, o.id
        limit 100
      ) scoped
    ), '[]'::jsonb)
  ) into v_result
  from public.shops s
  join public.tenants t on t.id = s.tenant_id
  where s.id = p_shop_id and s.active = true;

  if v_result is null then raise exception 'shop_not_found'; end if;
  return v_result;
end;
$$;

revoke all on function public.api_get_storefront_portal_orders(text, uuid) from public;
grant execute on function public.api_get_storefront_portal_orders(text, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
