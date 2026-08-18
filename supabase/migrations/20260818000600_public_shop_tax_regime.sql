-- UM10.2 — Le storefront reçoit sa politique fiscale depuis la boutique visitée.
-- La fonction n'expose qu'une valeur commerciale non sensible et évite toute
-- lecture navigateur de `tenants` (protégée par RLS et réservée à Magrit).

create or replace function public.api_get_public_shop_tax_regime(p_shop_slug text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tax_regime text;
begin
  if p_shop_slug is null or length(trim(p_shop_slug)) not between 1 and 160 then
    raise exception 'invalid_request: shop slug invalid';
  end if;

  select coalesce(t.tax_regime::text, 'metropole_fr')
    into v_tax_regime
  from public.shops s
  join public.tenants t on t.id = s.tenant_id
  where s.slug = p_shop_slug
    and s.active = true;

  if v_tax_regime is null then
    raise exception 'shop_not_found';
  end if;

  return v_tax_regime;
end;
$$;

revoke all on function public.api_get_public_shop_tax_regime(text) from public;
grant execute on function public.api_get_public_shop_tax_regime(text) to anon, authenticated;

notify pgrst, 'reload schema';
