create function magrit.current_storefront_account_id()
returns uuid language sql stable as $$
  select nullif(current_setting('magrit.storefront_account_id',true),'')::uuid
$$;

create policy tenant_orders_storefront_access on public.tenant_orders
  for all to magrit_api using (
    shop_customer_account_id=magrit.current_storefront_account_id()
  ) with check (
    shop_customer_account_id=magrit.current_storefront_account_id()
  );

create function magrit.active_shop_context(requested_shop_id uuid)
returns table(shop_id uuid,tenant_id uuid)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select id,tenant_id from public.shops
   where id=requested_shop_id and active and deleted_at is null
$$;
revoke all on function magrit.active_shop_context(uuid) from public;
grant execute on function magrit.active_shop_context(uuid) to magrit_api;

create function magrit.order_context(requested_order_id uuid)
returns table(
  order_id uuid,tenant_id uuid,shop_id uuid,created_by uuid,
  shop_customer_account_id uuid,status public.tenant_order_status
)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select id,tenant_id,shop_id,created_by,shop_customer_account_id,status
    from public.tenant_orders where id=requested_order_id
$$;
revoke all on function magrit.order_context(uuid) from public;
grant execute on function magrit.order_context(uuid) to magrit_api;

create function magrit.resolve_storefront_catalog_price(requested_shop_id uuid,requested_product_id uuid)
returns table(price_ht numeric(12,2),in_scope boolean)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  with context as (
    select s.library_ids,s.excluded_product_ids,s.pim_catalog_mode,s.pim_gamme_slugs
      from public.shops s where s.id=requested_shop_id and s.active and s.deleted_at is null
  ), candidate as (
    select p.id,p.price_ht,p.active,p.library_id,p.gamme_slug from public.product_library p
     where p.id=requested_product_id
  ), resolved as (
    select
      coalesce(override.price_ht_override,manual.price_ht,
        case when candidate.active then candidate.price_ht end) price_ht,
      manual.id is not null or (
        candidate.active
        and not (requested_product_id=any(coalesce(context.excluded_product_ids,'{}'::uuid[])))
        and (
          candidate.library_id=any(coalesce(context.library_ids,'{}'::uuid[]))
          or (context.pim_catalog_mode and candidate.gamme_slug=any(coalesce(context.pim_gamme_slugs,'{}'::text[])))
        )
      ) in_scope
    from context
    left join candidate on true
    left join lateral (
      select sp.id,sp.price_ht from public.shop_products sp
       where sp.shop_id=requested_shop_id and sp.product_id=requested_product_id
       order by sp.created_at limit 1
    ) manual on true
    left join public.shop_product_pricing override
      on override.shop_id=requested_shop_id and override.library_product_id=requested_product_id
  )
  select case when in_scope then price_ht else null end,in_scope from resolved
$$;
revoke all on function magrit.resolve_storefront_catalog_price(uuid,uuid) from public;
grant execute on function magrit.resolve_storefront_catalog_price(uuid,uuid) to magrit_api;

comment on function magrit.current_storefront_account_id() is
  'Compte storefront resolu par le BFF dans la transaction courante.';
