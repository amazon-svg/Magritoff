-- Repare uniquement les instantanes UX produits par l'ancien generateur.
-- Le verrou et la transaction empechent toute ecriture concurrente pendant
-- la suspension du seul trigger d'immuabilite ; les contraintes restent actives.
do $$ begin
  if exists (
    select 1 from public.tenant_order_items
    where clariprint_options @> '{"ux_fixture":true}'::jsonb
      and breakdown @> '[{"label":"Impression"}]'::jsonb
  ) then
    lock table public.tenant_order_items in access exclusive mode;
    alter table public.tenant_order_items disable trigger tenant_order_items_require_draft;
    update public.tenant_order_items set breakdown = jsonb_build_array(jsonb_build_object(
      'post', 'printing', 'cost', production_price::text,
      'margin_rate', applied_margin_rate::text, 'price', sale_price::text,
      'source', 'prix_marche'
    ))
    where clariprint_options @> '{"ux_fixture":true}'::jsonb
      and breakdown @> '[{"label":"Impression"}]'::jsonb;
    alter table public.tenant_order_items enable trigger tenant_order_items_require_draft;
  end if;
end $$;
