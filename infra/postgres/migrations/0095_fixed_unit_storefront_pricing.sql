-- E4.FIXED-PRICE : contexte interne uniquement. Le moteur PricingEngine calcule
-- les prix ; cette fonction fournit des montants exacts et des règles résolues.
create function magrit.storefront_fixed_price_context(requested_shop_id uuid,requested_product_id uuid,requested_account_id uuid default null)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  with shop as (
    select * from public.shops where id=requested_shop_id and active and deleted_at is null
  ), resolved as (
    select resolved.* from magrit.resolve_storefront_catalog_price(requested_shop_id,requested_product_id) resolved
  ), target as (
    select shop.tenant_id,
      coalesce(manual.gamme_slug,product.gamme_slug) gamme_slug,
      resolved.reference_config, resolved.price_ht, resolved.in_scope,
      override.price_ht_override,
      customer.id customer_id
    from shop cross join resolved
    left join public.product_library product on product.id=requested_product_id and product.tenant_id=shop.tenant_id
    left join lateral (select sp.gamme_slug from public.shop_products sp
      where sp.shop_id=shop.id and sp.product_id=requested_product_id order by sp.created_at limit 1) manual on true
    left join public.shop_product_pricing override on override.shop_id=shop.id and override.library_product_id=requested_product_id
    left join public.shop_customer_accounts account on account.id=requested_account_id and account.shop_id=shop.id and account.tenant_id=shop.tenant_id
    left join public.customer_contacts contact on contact.id=account.customer_contact_id
    left join public.customers customer on customer.id=contact.customer_id and customer.tenant_id=shop.tenant_id
  )
  select jsonb_build_object('cost',target.price_ht::text,'config',target.reference_config,
    'inScope',target.in_scope,'override',target.price_ht_override::text,
    'defaultMargin',margin.margin_rate::text,
    'rule',case when rule.id is null then null else jsonb_build_object('id',rule.id,'value_type',rule.value_type,'value',rule.value::text) end)
  from target
  left join public.product_gammes gamme on gamme.slug=target.gamme_slug
  left join public.product_range_default_margins margin on margin.tenant_id=target.tenant_id and margin.product_range_id=gamme.id
  left join lateral (
    select pr.* from public.price_rules pr
    where pr.tenant_id=target.tenant_id and pr.is_active
      and pr.valid_from <= current_date and (pr.valid_to is null or pr.valid_to >= current_date)
      and (pr.scope='global'
        or (pr.scope='range' and pr.product_range_id=gamme.id)
        or (pr.scope='customer' and pr.customer_id=target.customer_id)
        or (pr.scope='customer_range' and pr.customer_id=target.customer_id and pr.product_range_id=gamme.id))
    order by case pr.scope when 'customer_range' then 3 when 'customer' then 2 when 'range' then 1 else 0 end desc,
      pr.created_at desc,pr.id desc limit 1
  ) rule on true
  where target.in_scope and target.reference_config->>'pricing_mode'='fixed_unit'
$$;
revoke all on function magrit.storefront_fixed_price_context(uuid,uuid,uuid) from public;
grant execute on function magrit.storefront_fixed_price_context(uuid,uuid,uuid) to magrit_api;
-- Retour arrière : drop function magrit.storefront_fixed_price_context(uuid,uuid,uuid);
