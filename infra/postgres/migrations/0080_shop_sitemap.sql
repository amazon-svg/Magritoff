create function magrit.public_shop_sitemap(requested_shop_slug text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, magrit
as $$
  select jsonb_build_object(
    'shop_slug', shop.slug,
    'gamme_slugs', coalesce(
      (
        select jsonb_agg(subscription.gamme_slug order by subscription.display_order, subscription.gamme_slug)
          from public.tenant_gamme_subscriptions subscription
         where subscription.tenant_id = shop.tenant_id
           and subscription.active
      ),
      (
        select jsonb_agg(gamme.slug order by gamme.display_order, gamme.slug)
          from public.product_gammes gamme
         where gamme.parent_slug is null
      ),
      '[]'::jsonb
    )
  )
    from public.shops shop
   where shop.slug = btrim(requested_shop_slug)
     and shop.deleted_at is null
     and shop.active
     and shop.access_mode = 'self_signup'
$$;

revoke all on function magrit.public_shop_sitemap(text)
  from public, magrit_worker, magrit_readonly;
grant execute on function magrit.public_shop_sitemap(text) to magrit_api;

comment on function magrit.public_shop_sitemap(text) is
  'Expose uniquement les slugs publics necessaires au sitemap d une boutique ouverte.';
