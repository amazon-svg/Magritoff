-- Repare uniquement les instantanes UX produits par l'ancien generateur.
-- Le verrou et la transaction empechent toute ecriture concurrente pendant
-- la suspension du seul trigger d'immuabilite ; les contraintes restent actives.
do $$ begin
  if exists (
    select 1 from public.commercial_order_lines
    where product_config @> '{"ux_fixture":true}'::jsonb
      and breakdown @> '[{"label":"Impression"}]'::jsonb
  ) then
    lock table public.commercial_order_lines in access exclusive mode;
    alter table public.commercial_order_lines disable trigger commercial_order_lines_immutable;
    update public.commercial_order_lines set breakdown = jsonb_build_array(jsonb_build_object(
      'post', 'printing', 'cost', production_price::text,
      'margin_rate', applied_margin_rate::text, 'price', sale_price::text,
      'source', 'prix_marche'
    ))
    where product_config @> '{"ux_fixture":true}'::jsonb
      and breakdown @> '[{"label":"Impression"}]'::jsonb;
    alter table public.commercial_order_lines enable trigger commercial_order_lines_immutable;
  end if;
end $$;
