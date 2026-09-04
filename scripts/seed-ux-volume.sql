-- Jeu de donnees volumique pour tester les listes, recherches, filtres et
-- etats denses de l'UX locale. Les UUID sont deterministes : relancer le
-- script met a jour les memes fixtures sans creer de doublons.

begin;

select set_config('ux.seed.tenant_slug', :'tenant_slug', true);

create or replace function pg_temp.ux_uuid(seed text)
returns uuid
language sql
immutable
strict
as $$
  select (
    substr(md5(seed), 1, 8) || '-' ||
    substr(md5(seed), 9, 4) || '-4' ||
    substr(md5(seed), 14, 3) || '-a' ||
    substr(md5(seed), 18, 3) || '-' ||
    substr(md5(seed), 21, 12)
  )::uuid;
$$;

create temporary table ux_seed_context on commit drop as
select
  tenant.id as tenant_id,
  :'tenant_slug'::text as tenant_slug,
  :'customer_count'::integer as customer_count,
  :'order_count'::integer as order_count,
  (
    select member.user_id
      from public.tenant_members member
     where member.tenant_id = tenant.id
       and member.role = 'admin'
     order by member.user_id
     limit 1
  ) as actor_id
from public.tenants tenant
where tenant.slug = :'tenant_slug';

do $$
declare
  context_row record;
  shop_count integer;
begin
  select * into context_row from ux_seed_context;
  if context_row is null then
    raise exception 'Tenant introuvable: %', current_setting('ux.seed.tenant_slug');
  end if;
  if context_row.actor_id is null then
    raise exception 'Le tenant % ne possede aucun administrateur', context_row.tenant_slug;
  end if;
  select count(*) into shop_count
    from public.shops
   where tenant_id = context_row.tenant_id;
  if shop_count = 0 then
    raise exception 'Le tenant % ne possede aucune boutique', context_row.tenant_slug;
  end if;
end;
$$;

create temporary table ux_seed_shops on commit drop as
select
  shop.id,
  row_number() over (order by shop.created_at, shop.id)::integer as position,
  count(*) over ()::integer as shop_count
from public.shops shop
join ux_seed_context context on context.tenant_id = shop.tenant_id;

insert into public.customers (
  id, tenant_id, type, company_name, siret, vat_number,
  civility, first_name, last_name, billing_address, shipping_address,
  is_active, siret_verified, siret_verified_at, created_by,
  created_at, updated_at
)
select
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-customer:' || series.number),
  context.tenant_id,
  case when series.number % 3 = 0 then 'individual' else 'company' end,
  case when series.number % 3 <> 0
    then '[UX] Entreprise ' || lpad(series.number::text, 3, '0')
  end,
  case when series.number % 3 <> 0
    then '99123456' || lpad(series.number::text, 6, '0')
  end,
  case when series.number % 3 <> 0
    then 'FR' || lpad((10 + series.number % 89)::text, 2, '0') || '99123456' || lpad(series.number::text, 6, '0')
  end,
  case when series.number % 3 = 0 and series.number % 2 = 0 then 'mrs'
       when series.number % 3 = 0 then 'mr'
  end,
  case when series.number % 3 = 0
    then (array['Camille', 'Alex', 'Morgan', 'Sacha', 'Lou'])[1 + series.number % 5]
  end,
  case when series.number % 3 = 0
    then (array['Martin', 'Bernard', 'Dubois', 'Robert', 'Richard', 'Petit'])[1 + series.number % 6]
  end,
  jsonb_build_object(
    'line1', (10 + series.number) || ' rue des Imprimeurs',
    'postal_code', lpad((75000 + series.number % 20)::text, 5, '0'),
    'city', (array['Paris', 'Lyon', 'Lille', 'Nantes', 'Bordeaux'])[1 + series.number % 5],
    'country', 'FR'
  ),
  case when series.number % 4 = 0 then null else jsonb_build_object(
    'line1', (20 + series.number) || ' avenue du Papier',
    'postal_code', lpad((69000 + series.number % 20)::text, 5, '0'),
    'city', (array['Paris', 'Lyon', 'Lille', 'Nantes', 'Bordeaux'])[1 + series.number % 5],
    'country', 'FR'
  ) end,
  series.number % 10 <> 0,
  series.number % 3 <> 0 and series.number % 4 = 0,
  case when series.number % 3 <> 0 and series.number % 4 = 0
    then now() - (series.number % 30 || ' days')::interval
  end,
  context.actor_id,
  now() - ((series.number * 7) % 365 || ' days')::interval,
  now() - ((series.number * 3) % 90 || ' days')::interval
from ux_seed_context context
cross join lateral generate_series(1, context.customer_count) as series(number)
on conflict (id) do update set
  company_name = excluded.company_name,
  siret = excluded.siret,
  vat_number = excluded.vat_number,
  civility = excluded.civility,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  billing_address = excluded.billing_address,
  shipping_address = excluded.shipping_address,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;

insert into public.customer_contacts (
  id, customer_id, first_name, last_name, role, email, phone,
  is_primary, created_at, updated_at
)
select
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-contact:' || series.number),
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-customer:' || series.number),
  (array['Alice', 'Nora', 'Hugo', 'Jules', 'Ines'])[1 + series.number % 5],
  (array['Martin', 'Bernard', 'Dubois', 'Robert', 'Richard', 'Petit'])[1 + series.number % 6],
  (array['Direction', 'Achats', 'Communication', 'Production'])[1 + series.number % 4],
  'ux.client.' || lpad(series.number::text, 4, '0') || '@example.test',
  '+33 6 ' || lpad((series.number % 100)::text, 2, '0') || ' 12 34 56',
  true,
  now() - ((series.number * 7) % 365 || ' days')::interval,
  now() - ((series.number * 3) % 90 || ' days')::interval
from ux_seed_context context
cross join lateral generate_series(1, context.customer_count) as series(number)
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  role = excluded.role,
  email = excluded.email,
  phone = excluded.phone,
  is_primary = excluded.is_primary,
  updated_at = excluded.updated_at;

insert into public.shop_customer_accounts (
  id, shop_id, email, full_name, status, created_by_magrit_user_id,
  activated_at, customer_contact_id, created_at
)
select
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-account:' || series.number),
  shop.id,
  'ux.client.' || lpad(series.number::text, 4, '0') || '@example.test',
  'Client UX ' || lpad(series.number::text, 3, '0'),
  'active',
  context.actor_id,
  now() - ((series.number * 5) % 180 || ' days')::interval,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-contact:' || series.number),
  now() - ((series.number * 7) % 365 || ' days')::interval
from ux_seed_context context
cross join lateral generate_series(1, context.customer_count) as series(number)
join ux_seed_shops shop
  on shop.position = 1 + (series.number - 1) % shop.shop_count
on conflict (id) do update set
  shop_id = excluded.shop_id,
  email = excluded.email,
  full_name = excluded.full_name,
  status = excluded.status,
  activated_at = excluded.activated_at,
  customer_contact_id = excluded.customer_contact_id;

create temporary table ux_seed_orders on commit drop as
select
  series.number,
  1 + (series.number - 1) % context.customer_count as customer_number,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-order:' || series.number) as order_id,
  shop.id as shop_id,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-account:' || (1 + (series.number - 1) % context.customer_count)) as account_id,
  case series.number % 7
    when 0 then 'draft'::public.tenant_order_status
    when 1 then 'validated'::public.tenant_order_status
    when 2 then 'in_production'::public.tenant_order_status
    when 3 then 'shipped'::public.tenant_order_status
    when 4 then 'delivered'::public.tenant_order_status
    when 5 then 'invoiced'::public.tenant_order_status
    else 'cancelled'::public.tenant_order_status
  end as status,
  now()
    - ((series.number * 37) % 400 || ' days')::interval
    - ((series.number * 17) % 24 || ' hours')::interval as created_at
from ux_seed_context context
cross join lateral generate_series(1, context.order_count) as series(number)
join ux_seed_shops shop
  on shop.position = 1 + ((1 + (series.number - 1) % context.customer_count) - 1) % shop.shop_count;

insert into public.tenant_orders (
  id, tenant_id, shop_id, created_by, shop_customer_account_id,
  status, total_ht, currency, notes, invoice_number,
  created_at, updated_at, cancelled_at
)
select
  orders.order_id,
  context.tenant_id,
  orders.shop_id,
  null,
  orders.account_id,
  orders.status,
  totals.total_ht,
  'EUR',
  '[UX] Commande volumique ' || lpad(orders.number::text, 4, '0'),
  case when orders.status = 'invoiced'
    then 'UX-FACT-' || lpad(orders.number::text, 5, '0')
  end,
  orders.created_at,
  orders.created_at + interval '2 hours',
  case when orders.status = 'cancelled' then orders.created_at + interval '1 day' end
from ux_seed_orders orders
cross join ux_seed_context context
cross join lateral (
  select sum((10 + ((orders.number + item.number) % 20) * 2.5) * (item.number * 100))::numeric(12,2) as total_ht
  from generate_series(1, 1 + orders.number % 3) as item(number)
) totals
on conflict (id) do update set
  shop_id = excluded.shop_id,
  shop_customer_account_id = excluded.shop_customer_account_id,
  status = excluded.status,
  total_ht = excluded.total_ht,
  notes = excluded.notes,
  invoice_number = excluded.invoice_number,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  cancelled_at = excluded.cancelled_at;

insert into public.tenant_order_items (
  id, order_id, product_label, clariprint_options,
  quantity, unit_price_ht, line_total_ht, created_at
)
select
  pg_temp.ux_uuid(orders.order_id::text || ':item:' || item.number),
  orders.order_id,
  (array['Flyers A5', 'Cartes de visite', 'Brochure A4', 'Affiche A2'])[1 + (orders.number + item.number) % 4],
  jsonb_build_object(
    'kind', (array['flyer', 'business_card', 'brochure', 'poster'])[1 + (orders.number + item.number) % 4],
    'gamme_slug', (array['standard', 'premium', 'eco'])[1 + (orders.number + item.number) % 3],
    'ux_fixture', true
  ),
  item.number * 100,
  (10 + ((orders.number + item.number) % 20) * 2.5)::numeric(12,2),
  ((10 + ((orders.number + item.number) % 20) * 2.5) * (item.number * 100))::numeric(12,2),
  orders.created_at
from ux_seed_orders orders
cross join lateral generate_series(1, 1 + orders.number % 3) as item(number)
on conflict (id) do update set
  product_label = excluded.product_label,
  clariprint_options = excluded.clariprint_options,
  quantity = excluded.quantity,
  unit_price_ht = excluded.unit_price_ht,
  line_total_ht = excluded.line_total_ht,
  created_at = excluded.created_at;

insert into public.tenant_order_status_events (
  id, order_id, actor_id, from_status, to_status, reason, metadata,
  created_at, shop_customer_account_id
)
select
  pg_temp.ux_uuid(orders.order_id::text || ':status-event'),
  orders.order_id,
  null,
  null,
  orders.status,
  'Fixture UX volumique',
  jsonb_build_object('ux_fixture', true),
  orders.created_at,
  orders.account_id
from ux_seed_orders orders
on conflict (id) do update set
  to_status = excluded.to_status,
  created_at = excluded.created_at,
  shop_customer_account_id = excluded.shop_customer_account_id;

select
  context.tenant_slug,
  (select count(*) from public.customers customer where customer.tenant_id = context.tenant_id) as total_customers,
  (select count(*) from public.tenant_orders orders where orders.tenant_id = context.tenant_id) as total_orders,
  (select count(*) from public.tenant_order_items item join public.tenant_orders orders on orders.id = item.order_id where orders.tenant_id = context.tenant_id) as total_order_items,
  context.customer_count as ux_customers_requested,
  context.order_count as ux_orders_requested
from ux_seed_context context;

commit;
