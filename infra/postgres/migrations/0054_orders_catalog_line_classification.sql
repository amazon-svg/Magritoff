drop function magrit.resolve_storefront_catalog_price(uuid,uuid);

create function magrit.resolve_storefront_catalog_price(requested_shop_id uuid,requested_product_id uuid)
returns table(price_ht numeric(12,2),reference_config jsonb,in_scope boolean)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  with context as (
    select s.library_ids,s.excluded_product_ids,s.pim_catalog_mode,s.pim_gamme_slugs
      from public.shops s where s.id=requested_shop_id and s.active and s.deleted_at is null
  ), candidate as (
    select p.id,p.price_ht,p.config,p.active,p.library_id,p.gamme_slug
      from public.product_library p where p.id=requested_product_id
  ), resolved as (
    select
      case
        when override.price_ht_override>0 then override.price_ht_override
        when manual.price_ht>0 then manual.price_ht
        when candidate.active and candidate.price_ht>0 then candidate.price_ht
        else null
      end price_ht,
      coalesce(manual.config,candidate.config,'{}'::jsonb) reference_config,
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
      select sp.id,sp.price_ht,sp.config from public.shop_products sp
       where sp.shop_id=requested_shop_id and sp.product_id=requested_product_id
       order by sp.created_at limit 1
    ) manual on true
    left join public.shop_product_pricing override
      on override.shop_id=requested_shop_id and override.library_product_id=requested_product_id
  )
  select case when in_scope then price_ht else null end,reference_config,in_scope from resolved
$$;
revoke all on function magrit.resolve_storefront_catalog_price(uuid,uuid) from public;
grant execute on function magrit.resolve_storefront_catalog_price(uuid,uuid) to magrit_api;

create function magrit.classify_storefront_order_line(
  requested_shop_id uuid,
  requested_product_id uuid,
  requested_options jsonb,
  submitted_price numeric
)
returns table(
  resolved_unit_price_ht numeric(12,2),
  price_origin text,
  in_scope boolean,
  mismatch boolean,
  reference_price numeric(12,2)
)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  with resolved as (
    select * from magrit.resolve_storefront_catalog_price(requested_shop_id,requested_product_id)
  ), classified as (
    select
      coalesce(resolved.in_scope,false) scope,
      resolved.price_ht,
      coalesce(requested_options,'{}'::jsonb)=coalesce(resolved.reference_config,'{}'::jsonb)
        and resolved.price_ht is not null catalog_price
    from (select 1) seed left join resolved on true
  )
  select
    case
      when requested_product_id is null then round(submitted_price,2)
      when catalog_price then price_ht
      else round(submitted_price,2)
    end,
    case when requested_product_id is not null and catalog_price
      then 'catalog' else 'client_unverified' end,
    case when requested_product_id is null then true else scope end,
    requested_product_id is not null and catalog_price and round(submitted_price,2)<>price_ht,
    price_ht
  from classified
$$;
revoke all on function magrit.classify_storefront_order_line(uuid,uuid,jsonb,numeric) from public;
grant execute on function magrit.classify_storefront_order_line(uuid,uuid,jsonb,numeric) to magrit_api;

comment on function magrit.classify_storefront_order_line(uuid,uuid,jsonb,numeric) is
  'Classe une ligne Orders avec la hierarchie de prix et une egalite JSONB stricte des options.';
