-- La page publique de depot reprend l identite de la boutique pour les
-- commandes storefront. Les commandes issues d un devis conservent le seul
-- nom du tenant et des champs boutique nuls.

drop function magrit.touch_order_upload_link_context(text);

create function magrit.touch_order_upload_link_context(p_token_hash text)
returns table(
  printer_name text,
  shop_name text,
  shop_logo_url text,
  order_number text,
  label text,
  expires_at timestamptz,
  max_files integer,
  deposited_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  selected_link public.commercial_order_upload_links;
begin
  select links.* into selected_link
    from public.commercial_order_upload_links links
   where links.token_hash = p_token_hash
     and links.revoked_at is null
     and links.expires_at > clock_timestamp()
   for update;
  if not found then return; end if;

  update public.commercial_order_upload_links links
     set use_count = links.use_count + 1,
         first_used_at = coalesce(links.first_used_at, clock_timestamp()),
         last_used_at = clock_timestamp()
   where links.id = selected_link.id;

  return query
  select tenants.name,
         case when orders.order_origin = 'storefront' then shops.name else null end,
         case when orders.order_origin = 'storefront' then nullif(btrim(shops.logo_url), '') else null end,
         coalesce(orders.number, upper(left(orders.id::text, 8))),
         selected_link.label,
         selected_link.expires_at,
         selected_link.max_files,
         selected_link.deposited_count
    from public.tenant_orders orders
    join public.tenants tenants on tenants.id = orders.tenant_id
    left join public.shops shops on shops.id = orders.shop_id
   where orders.id = selected_link.order_id;
end
$$;

revoke all on function magrit.touch_order_upload_link_context(text) from public;
grant execute on function magrit.touch_order_upload_link_context(text) to magrit_api;
