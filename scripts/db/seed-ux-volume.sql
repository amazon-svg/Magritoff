create or replace function pg_temp.ux_uuid(seed text)
returns uuid language sql immutable strict as $$
  select (
    substr(md5(seed), 1, 8) || '-' || substr(md5(seed), 9, 4) || '-4' ||
    substr(md5(seed), 14, 3) || '-a' || substr(md5(seed), 18, 3) || '-' ||
    substr(md5(seed), 21, 12)
  )::uuid
$$;

create temporary table ux_seed_tenant_specs (
  slug text primary key,
  name text not null,
  customer_count integer not null,
  order_count integer not null,
  quote_count integer not null
) on commit drop;

insert into ux_seed_tenant_specs
select seed.slug, seed.name,
  current_setting('ux.seed.customer_count')::integer,
  current_setting('ux.seed.order_count')::integer,
  current_setting('ux.seed.quote_count')::integer
from (values
  ('pressetout', 'Presse Tout'),
  ('atelier-lumiere', 'Atelier Lumière'),
  ('imprimerie-du-parc', 'Imprimerie du Parc')
) seed(slug, name)
where current_setting('ux.seed.all')::boolean
union all
select current_setting('ux.seed.tenant_slug'),
  initcap(replace(current_setting('ux.seed.tenant_slug'), '-', ' ')),
  current_setting('ux.seed.customer_count')::integer,
  current_setting('ux.seed.order_count')::integer,
  current_setting('ux.seed.quote_count')::integer
where not current_setting('ux.seed.all')::boolean;

insert into public.tenants (id, slug, name, plan, settings)
select pg_temp.ux_uuid('ux-tenant:' || slug), slug, name, 'pro', '{"ux_fixture":true}'::jsonb
from ux_seed_tenant_specs
on conflict (slug) do update set
  name = excluded.name,
  plan = excluded.plan,
  settings = public.tenants.settings || excluded.settings,
  updated_at = now();

create temporary table ux_seed_context on commit drop as
select tenant.id as tenant_id, spec.slug as tenant_slug, spec.customer_count,
  spec.order_count, spec.quote_count, actor.id as actor_id
from ux_seed_tenant_specs spec
join public.tenants tenant on tenant.slug = spec.slug
cross join lateral (
  select id from public.app_users
  where email_normalized = current_setting('ux.seed.actor_email')
) actor;

do $$ begin
  if not exists (select 1 from ux_seed_context) then
    raise exception 'Utilisateur de developpement introuvable pour le seed UX';
  end if;
end $$;

insert into public.tenant_members (tenant_id, user_id, role)
select tenant_id, actor_id, 'owner' from ux_seed_context
on conflict (tenant_id, user_id) do update set role = 'owner';

insert into public.shops (
  id, tenant_id, owner_user_id, slug, name, description, theme,
  contact_email, active, tagline, access_mode, deleted_at
)
select pg_temp.ux_uuid('ux-shop:' || tenant_slug), tenant_id, actor_id,
  tenant_slug || '-ux', tenant_slug || ' — Boutique UX',
  'Boutique générée pour les tests UX volumiques',
  '{"primaryColor":"#1e3a8a","accentColor":"#f59e0b","mode":"light"}'::jsonb,
  current_setting('ux.seed.actor_email'), true,
  'Données synthétiques de démonstration', 'self_signup', null
from ux_seed_context
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, theme = excluded.theme,
  contact_email = excluded.contact_email, active = true, tagline = excluded.tagline,
  access_mode = excluded.access_mode, deleted_at = null;

create temporary table ux_seed_shops on commit drop as
select context.*, shop.id as shop_id
from ux_seed_context context
join public.shops shop on shop.slug = context.tenant_slug || '-ux';

insert into public.customers (
  id, tenant_id, type, company_name, siret, vat_number, civility,
  first_name, last_name, billing_address, shipping_address, is_active,
  siret_verified, siret_verified_at, created_by, created_at, updated_at
)
select pg_temp.ux_uuid(context.tenant_id::text || ':ux-customer:' || series.number),
  context.tenant_id,
  case when series.number % 3 = 0 then 'individual' else 'company' end,
  case when series.number % 3 <> 0 then '[UX] Entreprise ' || lpad(series.number::text, 4, '0') end,
  case when series.number % 3 <> 0 then '99123456' || lpad(series.number::text, 6, '0') end,
  case when series.number % 3 <> 0 then 'FR' || lpad((10 + series.number % 89)::text, 2, '0') || '99123456' || lpad(series.number::text, 6, '0') end,
  case when series.number % 3 = 0 and series.number % 2 = 0 then 'mrs' when series.number % 3 = 0 then 'mr' end,
  case when series.number % 3 = 0 then (array['Camille','Alex','Morgan','Sacha','Lou'])[1 + series.number % 5] end,
  case when series.number % 3 = 0 then (array['Martin','Bernard','Dubois','Robert','Richard','Petit'])[1 + series.number % 6] end,
  jsonb_build_object('line1', (10 + series.number) || ' rue des Imprimeurs', 'postal_code', lpad((75000 + series.number % 20)::text, 5, '0'), 'city', (array['Paris','Lyon','Lille','Nantes','Bordeaux'])[1 + series.number % 5], 'country', 'FR'),
  jsonb_build_object('line1', (20 + series.number) || ' avenue du Papier', 'postal_code', lpad((69000 + series.number % 20)::text, 5, '0'), 'city', (array['Paris','Lyon','Lille','Nantes','Bordeaux'])[1 + series.number % 5], 'country', 'FR'),
  series.number % 10 <> 0, series.number % 3 <> 0 and series.number % 4 = 0,
  case when series.number % 3 <> 0 and series.number % 4 = 0 then now() - (series.number % 30 || ' days')::interval end,
  context.actor_id, now() - ((series.number * 7) % 365 || ' days')::interval,
  now() - ((series.number * 3) % 90 || ' days')::interval
from ux_seed_context context
cross join lateral generate_series(1, context.customer_count) series(number)
on conflict (id) do update set
  company_name = excluded.company_name, siret = excluded.siret, vat_number = excluded.vat_number,
  civility = excluded.civility, first_name = excluded.first_name, last_name = excluded.last_name,
  billing_address = excluded.billing_address, shipping_address = excluded.shipping_address,
  is_active = excluded.is_active, updated_at = excluded.updated_at;

insert into public.customer_contacts (
  id, customer_id, first_name, last_name, role, email, phone, is_primary, created_at, updated_at
)
select pg_temp.ux_uuid(context.tenant_id::text || ':ux-contact:' || series.number),
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-customer:' || series.number),
  (array['Alice','Nora','Hugo','Jules','Ines'])[1 + series.number % 5],
  (array['Martin','Bernard','Dubois','Robert','Richard','Petit'])[1 + series.number % 6],
  (array['Direction','Achats','Communication','Production'])[1 + series.number % 4],
  'ux.' || context.tenant_slug || '.' || lpad(series.number::text, 4, '0') || '@example.test',
  '+33 6 ' || lpad((series.number % 100)::text, 2, '0') || ' 12 34 56', true,
  now() - ((series.number * 7) % 365 || ' days')::interval,
  now() - ((series.number * 3) % 90 || ' days')::interval
from ux_seed_context context
cross join lateral generate_series(1, context.customer_count) series(number)
on conflict (id) do update set
  first_name = excluded.first_name, last_name = excluded.last_name, role = excluded.role,
  email = excluded.email, phone = excluded.phone, is_primary = true;

insert into public.shop_customer_accounts (
  id, shop_id, tenant_id, email, normalized_email, full_name, status,
  created_by_magrit_user_id, customer_contact_id, activated_at, created_at
)
select pg_temp.ux_uuid(context.tenant_id::text || ':ux-account:' || series.number),
  context.shop_id, context.tenant_id,
  'ux.' || context.tenant_slug || '.' || lpad(series.number::text, 4, '0') || '@example.test',
  'ux.' || context.tenant_slug || '.' || lpad(series.number::text, 4, '0') || '@example.test',
  'Client UX ' || lpad(series.number::text, 4, '0'), 'active', context.actor_id,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-contact:' || series.number),
  now() - ((series.number * 5) % 180 || ' days')::interval,
  now() - ((series.number * 7) % 365 || ' days')::interval
from ux_seed_shops context
cross join lateral generate_series(1, context.customer_count) series(number)
on conflict (id) do update set
  email = excluded.email, normalized_email = excluded.normalized_email,
  full_name = excluded.full_name, status = 'active', activated_at = excluded.activated_at,
  customer_contact_id = excluded.customer_contact_id;

create temporary table ux_seed_quotes on commit drop as
select context.*, series.number,
  1 + (series.number - 1) % context.customer_count as customer_number,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-project:' || series.number) as project_id,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-quote:' || series.number) as quote_id,
  case series.number % 5 when 0 then 'draft' when 1 then 'sent' when 2 then 'accepted' when 3 then 'rejected' else 'converted' end as target_status,
  now() - ((series.number * 11) % 365 || ' days')::interval as fixture_created_at
from ux_seed_shops context
cross join lateral generate_series(1, context.quote_count) series(number);

insert into public.projects (id, tenant_id, customer_id, name, status, created_by, created_at, updated_at)
select project_id, tenant_id,
  pg_temp.ux_uuid(tenant_id::text || ':ux-customer:' || customer_number),
  '[UX] Projet ' || lpad(number::text, 5, '0'),
  case when target_status = 'converted' then 'archived' else 'active' end,
  actor_id, fixture_created_at, fixture_created_at
from ux_seed_quotes
on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = excluded.updated_at;

update public.commercial_quotes quote set status = 'draft'
from ux_seed_quotes fixture where quote.id = fixture.quote_id and quote.status <> 'draft';

insert into public.commercial_quotes (
  id, tenant_id, customer_id, project_id, number, status, valid_until,
  show_discounts, global_discount_rate, vat_rate, created_by, created_at, updated_at
)
select quote_id, tenant_id,
  pg_temp.ux_uuid(tenant_id::text || ':ux-customer:' || customer_number), project_id,
  'DEV-' || extract(year from current_date)::integer || '-' || lpad((50000 + number)::text, 5, '0'),
  'draft', current_date + (15 + number % 60), number % 3 = 0,
  case when number % 3 = 0 then 0.0500 end, 0.2000, actor_id,
  fixture_created_at, fixture_created_at
from ux_seed_quotes
on conflict (id) do update set
  customer_id = excluded.customer_id, project_id = excluded.project_id,
  valid_until = excluded.valid_until, show_discounts = excluded.show_discounts,
  global_discount_rate = excluded.global_discount_rate, vat_rate = excluded.vat_rate,
  created_at = excluded.created_at;

insert into public.commercial_quote_lines (
  id, quote_id, origin, label, description_html, product_config, quantity,
  position, production_price, public_price, customer_price, applied_margin_rate,
  sale_price, sale_margin_rate, discount_rate, margin_variation, breakdown, created_at
)
select pg_temp.ux_uuid(fixture.quote_id::text || ':line:' || line.number), fixture.quote_id,
  'free', (array['Flyers A5','Cartes de visite','Brochure A4','Affiche A2'])[1 + (fixture.number + line.number) % 4],
  '<p>Ligne synthétique pour les tests UX</p>',
  jsonb_build_object('ux_fixture', true, 'gamme_slug', (array['standard','premium','eco'])[1 + (fixture.number + line.number) % 3]),
  line.number * 100, line.number - 1,
  (40 + (fixture.number % 20) * 2)::numeric(12,2),
  (70 + (fixture.number % 20) * 3)::numeric(12,2),
  (65 + (fixture.number % 20) * 3)::numeric(12,2), 0.3500,
  (65 + (fixture.number % 20) * 3)::numeric(12,2), 0.3000,
  case when fixture.number % 3 = 0 then 0.0500 end, 0.0000,
  jsonb_build_array(jsonb_build_object(
    'post', 'printing',
    'cost', ((40 + (fixture.number % 20) * 2)::numeric(12,2))::text,
    'margin_rate', '0.3500',
    'price', ((65 + (fixture.number % 20) * 3)::numeric(12,2))::text,
    'source', 'prix_marche'
  )),
  fixture.fixture_created_at
from ux_seed_quotes fixture
cross join lateral generate_series(1, 1 + fixture.number % 3) line(number)
on conflict (id) do update set
  label = excluded.label, product_config = excluded.product_config, quantity = excluded.quantity,
  position = excluded.position, production_price = excluded.production_price,
  public_price = excluded.public_price, customer_price = excluded.customer_price,
  sale_price = excluded.sale_price, breakdown = excluded.breakdown;

update public.commercial_quotes quote set
  status = fixture.target_status,
  sent_at = case when fixture.target_status <> 'draft' then fixture.fixture_created_at + interval '1 day' end,
  last_sent_at = case when fixture.target_status <> 'draft' then fixture.fixture_created_at + interval '1 day' end,
  sent_by = case when fixture.target_status <> 'draft' then fixture.actor_id end,
  decided_at = case when fixture.target_status in ('accepted','rejected','converted') then fixture.fixture_created_at + interval '3 days' end,
  converted_at = case when fixture.target_status = 'converted' then fixture.fixture_created_at + interval '4 days' end,
  updated_at = fixture.fixture_created_at + interval '4 days'
from ux_seed_quotes fixture where quote.id = fixture.quote_id;

-- Les devis convertis alimentent la même table canonique que la boutique.
insert into public.tenant_orders (
  id, tenant_id, shop_id, created_by, status, total_ht, currency, notes,
  order_origin, customer_id, customer_contact_id, quote_id, number,
  source_quote_status, current_production_step_id, expected_delivery_date,
  show_discounts, customer_reference, lines_subtotal, global_discount,
  effective_discount_rate, net_total, vat_rate, vat_amount, total_incl_tax,
  created_at, updated_at
)
select pg_temp.ux_uuid(fixture.quote_id::text || ':commercial-order'),
  fixture.tenant_id, null, fixture.actor_id, 'validated', totals.net_total, 'EUR', '', 'quote',
  pg_temp.ux_uuid(fixture.tenant_id::text || ':ux-customer:' || fixture.customer_number),
  pg_temp.ux_uuid(fixture.tenant_id::text || ':ux-contact:' || fixture.customer_number),
  fixture.quote_id,
  'CDE-' || extract(year from current_date)::integer || '-' || lpad((50000 + fixture.number)::text, 5, '0'),
  'accepted', step.id, current_date + (7 + fixture.number % 45),
  fixture.number % 3 = 0, 'UX-' || lpad(fixture.number::text, 5, '0'),
  totals.subtotal, totals.discount,
  case when totals.subtotal = 0 then null else round(totals.discount / totals.subtotal, 4) end,
  totals.net_total, 0.2000, round(totals.net_total * 0.2000, 2),
  totals.net_total + round(totals.net_total * 0.2000, 2), fixture.fixture_created_at + interval '4 days',
  fixture.fixture_created_at + interval '4 days'
from ux_seed_quotes fixture
cross join lateral (
  select production_step.id from public.production_steps production_step
  where production_step.tenant_id = fixture.tenant_id and production_step.is_active
  order by production_step.position, production_step.id limit 1
) step
cross join lateral (
  select subtotal,
    round(subtotal * case when fixture.number % 3 = 0 then 0.0500 else 0 end, 2) as discount,
    subtotal - round(subtotal * case when fixture.number % 3 = 0 then 0.0500 else 0 end, 2) as net_total
  from (
    select coalesce(sum(line.sale_price), 0)::numeric(12,2) as subtotal
    from public.commercial_quote_lines line where line.quote_id = fixture.quote_id
  ) amount
) totals
where fixture.target_status = 'converted'
on conflict (id) do nothing;

select set_config('magrit.quote_conversion', 'on', true);
insert into public.tenant_order_items (
  id, order_id, source_quote_line_id, line_origin, product_label, description_html,
  clariprint_options, quantity, position, unit_price_ht, line_total_ht, price_origin,
  production_price, public_price,
  customer_price, applied_margin_rate, applied_rule_id, sale_price,
  sale_margin_rate, discount_rate, margin_variation, breakdown, created_at
)
select pg_temp.ux_uuid(order_row.id::text || ':line:' || quote_line.position),
  order_row.id, quote_line.id, quote_line.origin, quote_line.label,
  quote_line.description_html, quote_line.product_config, quote_line.quantity,
  quote_line.position, round(quote_line.sale_price / quote_line.quantity, 2),
  quote_line.sale_price, 'quoted', quote_line.production_price, quote_line.public_price,
  quote_line.customer_price, quote_line.applied_margin_rate,
  quote_line.applied_rule_id, quote_line.sale_price,
  quote_line.sale_margin_rate, quote_line.discount_rate,
  quote_line.margin_variation, quote_line.breakdown, quote_line.created_at
from ux_seed_quotes fixture
join public.tenant_orders order_row on order_row.quote_id = fixture.quote_id
join public.commercial_quote_lines quote_line on quote_line.quote_id = fixture.quote_id
where fixture.target_status = 'converted'
on conflict (id) do nothing;
select set_config('magrit.quote_conversion', 'off', true);

create temporary table ux_seed_orders on commit drop as
select context.*, series.number,
  1 + (series.number - 1) % context.customer_count as customer_number,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-order:' || series.number) as order_id,
  case series.number % 7 when 0 then 'draft'::public.tenant_order_status
    when 1 then 'validated' when 2 then 'in_production' when 3 then 'shipped'
    when 4 then 'delivered' when 5 then 'invoiced' else 'cancelled' end as target_status,
  now() - ((series.number * 13) % 400 || ' days')::interval as fixture_created_at
from ux_seed_shops context
cross join lateral generate_series(1, context.order_count) series(number);

select set_config('magrit.order_transition', 'on', true);
update public.tenant_orders orders set status = 'draft'
from ux_seed_orders fixture where orders.id = fixture.order_id and orders.status <> 'draft';

insert into public.tenant_orders (
  id, tenant_id, shop_id, shop_customer_account_id, status, total_ht,
  currency, notes, invoice_number, created_at, updated_at, cancelled_at
)
select order_id, tenant_id, shop_id,
  pg_temp.ux_uuid(tenant_id::text || ':ux-account:' || customer_number), 'draft',
  (100 + (number % 50) * 12.5)::numeric(12,2), 'EUR',
  '[UX] Commande volumique ' || lpad(number::text, 5, '0'),
  case when target_status = 'invoiced' then 'UX-FACT-' || lpad(number::text, 5, '0') end,
  fixture_created_at, fixture_created_at, null
from ux_seed_orders
on conflict (id) do update set
  status = 'draft', total_ht = excluded.total_ht, notes = excluded.notes,
  invoice_number = excluded.invoice_number, created_at = excluded.created_at, cancelled_at = null;

insert into public.tenant_order_items (
  id, order_id, product_label, clariprint_options, quantity,
  unit_price_ht, line_total_ht, price_origin, created_at
)
select pg_temp.ux_uuid(fixture.order_id::text || ':item:' || item.number), fixture.order_id,
  (array['Flyers A5','Cartes de visite','Brochure A4','Affiche A2'])[1 + (fixture.number + item.number) % 4],
  jsonb_build_object('ux_fixture', true, 'gamme_slug', (array['standard','premium','eco'])[1 + (fixture.number + item.number) % 3]),
  item.number * 100, (10 + (fixture.number + item.number) % 20 * 2.5)::numeric(12,2),
  ((10 + (fixture.number + item.number) % 20 * 2.5) * item.number * 100)::numeric(12,2),
  'catalog', fixture.fixture_created_at
from ux_seed_orders fixture
cross join lateral generate_series(1, 1 + fixture.number % 3) item(number)
on conflict (id) do update set
  product_label = excluded.product_label, clariprint_options = excluded.clariprint_options,
  quantity = excluded.quantity, unit_price_ht = excluded.unit_price_ht,
  line_total_ht = excluded.line_total_ht, created_at = excluded.created_at;

update public.tenant_orders orders set
  status = fixture.target_status,
  cancelled_at = case when fixture.target_status = 'cancelled' then fixture.fixture_created_at + interval '1 day' end,
  updated_at = fixture.fixture_created_at + interval '2 hours'
from ux_seed_orders fixture where orders.id = fixture.order_id;
select set_config('magrit.order_transition', 'off', true);

insert into public.tenant_order_status_events (
  id, order_id, shop_customer_account_id, from_status, to_status, reason, metadata, created_at
)
select pg_temp.ux_uuid(order_id::text || ':status-event'), order_id,
  pg_temp.ux_uuid(tenant_id::text || ':ux-account:' || customer_number), null,
  target_status, 'Fixture UX volumique', '{"ux_fixture":true}'::jsonb, fixture_created_at
from ux_seed_orders
on conflict (id) do update set to_status = excluded.to_status, created_at = excluded.created_at;

select context.tenant_slug,
  context.customer_count as ux_customers,
  context.order_count as ux_orders,
  context.quote_count as ux_quotes,
  (select count(*) from public.tenant_orders orders
    join public.commercial_quotes quote on quote.id = orders.quote_id
    join public.projects project on project.id = quote.project_id
    where orders.tenant_id = context.tenant_id and orders.order_origin = 'quote'
      and project.name like '[UX]%') as ux_quote_orders
from ux_seed_context context order by context.tenant_slug;
