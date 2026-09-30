create function magrit.public_shop_probe(requested_slug text)
returns table(id uuid,tenant_id uuid,access_mode text)
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select shop.id,shop.tenant_id,shop.access_mode
  from public.shops shop
  where shop.slug=requested_slug and shop.active and shop.deleted_at is null
    and char_length(requested_slug) between 1 and 160
$$;

create function magrit.public_shop_catalog_data(requested_slug text)
returns jsonb
language sql stable security definer
set search_path=pg_catalog,public,magrit
as $$
  select jsonb_build_object(
    'shop',to_jsonb(shop),
    'taxRegime',tenant.tax_regime,
    'products',coalesce((select jsonb_agg(to_jsonb(product) order by product.display_order,product.id)
      from public.shop_products product where product.shop_id=shop.id),'[]'::jsonb),
    'libraryProducts',coalesce((select jsonb_agg(to_jsonb(product) order by product.created_at desc,product.id)
      from public.product_library product
      where product.tenant_id=shop.tenant_id and product.active
        and not(product.id=any(shop.excluded_product_ids))
        and ((product.library_id is not null and product.library_id=any(shop.library_ids))
          or (shop.pim_catalog_mode and product.gamme_slug is not null and product.gamme_slug=any(shop.pim_gamme_slugs)))),'[]'::jsonb),
    'pricing',coalesce((select jsonb_agg(to_jsonb(pricing)) from public.shop_product_pricing pricing
      where pricing.shop_id=shop.id),'[]'::jsonb),
    'gammes',coalesce((select jsonb_agg(to_jsonb(gamme) order by gamme.display_order,gamme.slug)
      from public.product_gammes gamme),'[]'::jsonb),
    'definitions',coalesce((select jsonb_agg(to_jsonb(definition) order by definition.gamme_slug,definition.locale)
      from public.product_definitions definition),'[]'::jsonb),
    'subscribedSlugs',coalesce((select jsonb_agg(subscription.gamme_slug order by subscription.display_order,subscription.gamme_slug)
      from public.tenant_gamme_subscriptions subscription
      where subscription.tenant_id=shop.tenant_id and subscription.active),'[]'::jsonb),
    'customMockups',coalesce((select jsonb_agg(to_jsonb(mockup) order by mockup.template_type,mockup.view)
      from public.shop_template_mockups mockup where mockup.shop_id=shop.id),'[]'::jsonb)
  )
  from public.shops shop
  join public.tenants tenant on tenant.id=shop.tenant_id
  where shop.slug=requested_slug and shop.active and shop.deleted_at is null
    and char_length(requested_slug) between 1 and 160
$$;

revoke all on function magrit.public_shop_probe(text),magrit.public_shop_catalog_data(text) from public;
grant execute on function magrit.public_shop_probe(text),magrit.public_shop_catalog_data(text) to magrit_api;

comment on function magrit.public_shop_catalog_data(text) is
  'Projection storefront non sensible. Le BFF applique le controle invite_only avant de renvoyer cette projection.';
