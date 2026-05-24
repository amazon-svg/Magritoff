-- =============================================================================
-- S-FIX-PANIER-11/05 (bug #4d) — Trigger PIM ingestion : cast UUID defensif
-- -----------------------------------------------------------------------------
-- Bug reporte par Arnaud le 2026-05-11 : passer commande depuis la boutique
-- Eram avec un produit issu de la library declenche l erreur PostgreSQL
--    invalid input syntax for type uuid: "lib-477af866-558b-4201-879f-8c3fcd2db48c"
--
-- Cause : le trigger `enqueue_pim_candidates_on_shop_order` (migration
-- 20260424_08) cast `items[].product_id` en uuid via `::uuid`, sans
-- verifier le format. Les produits library ont un id `lib-...` qui n est
-- pas un UUID PostgreSQL valide → l insert echoue cote shop_orders.
--
-- Fix : on filtre via une regex UUID v4 avant cast. Si le product_id n est
-- pas un UUID valide, on saute la lecture shop_products (le fallback
-- jsonb_build_object prend le relais). Idempotent.
-- =============================================================================

create or replace function public.enqueue_pim_candidates_on_shop_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _shop_tenant uuid;
  _shop_owner uuid;
  _item jsonb;
  _product_config jsonb;
  _product_id_raw text;
begin
  select tenant_id, owner_user_id
    into _shop_tenant, _shop_owner
    from public.shops
    where id = new.shop_id;

  if _shop_tenant is null then
    return new;
  end if;

  for _item in select jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    _product_config := null;
    _product_id_raw := _item->>'product_id';

    -- Defense bug #4d : cast UUID uniquement si le format matche v4.
    -- Sinon (ex: "lib-..." pour produit library), on saute le lookup
    -- shop_products et on tombe sur le fallback jsonb_build_object plus bas.
    if _product_id_raw is not null
       and _product_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      select config into _product_config
        from public.shop_products
        where id = _product_id_raw::uuid
        limit 1;
    end if;

    if _product_config is null then
      _product_config := jsonb_build_object(
        'name', _item->>'name',
        'quantity', coalesce((_item->>'quantity_ex')::int, (_item->>'qty')::int),
        'price_ht', _item->>'price_ht'
      );
    end if;

    insert into public.pim_candidates (
      source_tenant_id,
      source_user_id,
      source_quote_id,
      raw_config,
      suggested_kind,
      suggested_gamme,
      status
    ) values (
      _shop_tenant,
      _shop_owner,
      null,
      _product_config,
      _product_config->>'kind',
      _product_config->>'gamme_slug',
      'pending'
    );
  end loop;

  return new;
end;
$$;

notify pgrst, 'reload schema';
