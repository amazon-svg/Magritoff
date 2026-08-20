-- AF31 — identité client des commandes modernes.
--
-- Le dashboard Orders doit afficher le compte boutique qui a passé la
-- commande sans ouvrir la table complète des comptes clients aux rôles qui
-- savent seulement consulter les commandes.

create or replace function public.api_get_order_customer_identities(
  p_order_ids uuid[]
)
returns table (
  order_id uuid,
  customer_name text,
  customer_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    orders.id,
    accounts.full_name,
    accounts.email
  from public.tenant_orders orders
  left join public.shop_customer_accounts accounts
    on accounts.id = orders.shop_customer_account_id
   and accounts.shop_id = orders.shop_id
  where orders.id = any(coalesce(p_order_ids, array[]::uuid[]))
    and (
      public.current_user_can_access_shop(orders.shop_id)
      or public.is_super_admin()
    );
$$;

revoke all on function public.api_get_order_customer_identities(uuid[]) from public, anon;
grant execute on function public.api_get_order_customer_identities(uuid[]) to authenticated;

-- La lecture storefront reste bornée par la session opaque et la boutique.
-- Le nom et l'email proviennent du compte résolu par cette session ; aucun
-- autre compte de la boutique n'est exposé.
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
    'tax_regime', tenant.tax_regime,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', scoped.id,
        'shop_id', scoped.shop_id,
        'created_at', scoped.created_at,
        'customer_name', v_session.full_name,
        'customer_email', v_session.email,
        'total_ht', scoped.total_ht,
        'status', scoped.status,
        'tenant_order_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_label', item.product_label,
            'quantity', item.quantity,
            'unit_price_ht', item.unit_price_ht
          ) order by item.created_at, item.id)
          from public.tenant_order_items item
          where item.order_id = scoped.id
        ), '[]'::jsonb)
      ) order by scoped.created_at desc, scoped.id)
      from (
        select orders.id, orders.shop_id, orders.created_at, orders.total_ht, orders.status
        from public.tenant_orders orders
        where orders.shop_id = p_shop_id
          and orders.shop_customer_account_id = v_session.account_id
        order by orders.created_at desc, orders.id
        limit 100
      ) scoped
    ), '[]'::jsonb)
  ) into v_result
  from public.shops shop
  join public.tenants tenant on tenant.id = shop.tenant_id
  where shop.id = p_shop_id and shop.active = true;

  if v_result is null then raise exception 'shop_not_found'; end if;
  return v_result;
end;
$$;

revoke all on function public.api_get_storefront_portal_orders(text, uuid) from public;
grant execute on function public.api_get_storefront_portal_orders(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
