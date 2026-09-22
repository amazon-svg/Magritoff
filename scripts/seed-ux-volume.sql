-- Jeu de donnees autonome pour tester le multi-tenant, les listes, recherches,
-- filtres et etats denses de l'UX locale. Les UUID sont deterministes :
-- relancer le script met a jour les memes fixtures sans creer de doublons.

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

-- Compte local commun aux tenants de demonstration. L'identite email est
-- creee directement dans GoTrue afin que le jeu soit utilisable apres un reset
-- sans passer par l'ecran d'inscription.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  pg_temp.ux_uuid('ux-demo-admin'),
  'authenticated',
  'authenticated',
  'demo@magrit.local',
  extensions.crypt('magrit-demo', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'sub', pg_temp.ux_uuid('ux-demo-admin')::text,
    'email', 'demo@magrit.local',
    'full_name', 'Admin Démo',
    'email_verified', true,
    'phone_verified', false
  ),
  now(),
  now()
where not exists (
  select 1 from auth.users where email = 'demo@magrit.local'
);

update auth.users
   set encrypted_password = extensions.crypt('magrit-demo', extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now()),
       confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change = coalesce(email_change, ''),
       updated_at = now()
 where email = 'demo@magrit.local';

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  pg_temp.ux_uuid('ux-demo-admin-identity'),
  demo.id::text,
  demo.id,
  jsonb_build_object(
    'sub', demo.id::text,
    'email', demo.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users demo
where demo.email = 'demo@magrit.local'
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

create temporary table ux_seed_tenant_specs (
  slug text primary key,
  name text not null,
  customer_count integer not null,
  order_count integer not null
) on commit drop;

insert into ux_seed_tenant_specs (slug, name, customer_count, order_count)
select seed.slug, seed.name, seed.customer_count, seed.order_count
from (
  values
    ('pressetout'::text, 'Presse Tout'::text, :'customer_count'::integer, :'order_count'::integer),
    ('atelier-lumiere'::text, 'Atelier Lumière'::text, :'customer_count'::integer, :'order_count'::integer),
    ('imprimerie-du-parc'::text, 'Imprimerie du Parc'::text, :'customer_count'::integer, :'order_count'::integer)
) as seed(slug, name, customer_count, order_count)
where :'seed_all'::boolean
   or seed.slug = :'tenant_slug'
union all
select
  :'tenant_slug',
  initcap(replace(:'tenant_slug', '-', ' ')),
  :'customer_count'::integer,
  :'order_count'::integer
where not :'seed_all'::boolean
  and :'tenant_slug' not in ('pressetout', 'atelier-lumiere', 'imprimerie-du-parc');

insert into public.tenants (id, slug, name, plan, settings)
select
  pg_temp.ux_uuid('ux-tenant:' || spec.slug),
  spec.slug,
  spec.name,
  'pro',
  jsonb_build_object('ux_fixture', true)
from ux_seed_tenant_specs spec
on conflict (slug) do update set
  name = excluded.name,
  plan = excluded.plan,
  settings = public.tenants.settings || excluded.settings,
  updated_at = now();

-- Trois membres connectables par tenant : un profil Commandes, un profil
-- Boutiques et un membre sans option. Ils partagent le mot de passe local
-- "magrit-demo", mais restent chacun limites a leur propre tenant.
create temporary table ux_seed_user_specs (
  tenant_slug text not null,
  email text primary key,
  full_name text not null,
  option_key text
) on commit drop;

insert into ux_seed_user_specs (tenant_slug, email, full_name, option_key)
select
  tenant.slug,
  profile.email_prefix || '.' || tenant.slug || '@magrit.local',
  profile.full_name,
  profile.option_key
from ux_seed_tenant_specs tenant
cross join (values
  ('commandes', 'Camille — Commandes', 'option_orders'),
  ('boutiques', 'Morgan — Boutiques', 'option_shops'),
  ('equipe', 'Sacha — Équipe', null)
) as profile(email_prefix, full_name, option_key);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  pg_temp.ux_uuid('ux-demo-user:' || spec.email),
  'authenticated',
  'authenticated',
  spec.email,
  extensions.crypt('magrit-demo', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'sub', pg_temp.ux_uuid('ux-demo-user:' || spec.email)::text,
    'email', spec.email,
    'full_name', spec.full_name,
    'email_verified', true,
    'phone_verified', false
  ),
  '', '', '', '',
  now(),
  now()
from ux_seed_user_specs spec
where not exists (select 1 from auth.users account where account.email = spec.email);

update auth.users account
   set encrypted_password = extensions.crypt('magrit-demo', extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(account.email_confirmed_at, now()),
       raw_user_meta_data = coalesce(account.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
         'sub', account.id::text,
         'email', account.email,
         'full_name', spec.full_name,
         'email_verified', true,
         'phone_verified', false
       ),
       confirmation_token = coalesce(account.confirmation_token, ''),
       recovery_token = coalesce(account.recovery_token, ''),
       email_change_token_new = coalesce(account.email_change_token_new, ''),
       email_change = coalesce(account.email_change, ''),
       updated_at = now()
  from ux_seed_user_specs spec
 where account.email = spec.email;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  pg_temp.ux_uuid('ux-demo-identity:' || spec.email),
  account.id::text,
  account.id,
  jsonb_build_object(
    'sub', account.id::text,
    'email', account.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from ux_seed_user_specs spec
join auth.users account on account.email = spec.email
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

insert into public.tenant_members (tenant_id, user_id, role, invited_by)
select tenant.id, demo.id, 'admin', demo.id
from ux_seed_tenant_specs spec
join public.tenants tenant on tenant.slug = spec.slug
cross join lateral (
  select id from auth.users where email = 'demo@magrit.local'
) demo
on conflict (tenant_id, user_id) do update set role = 'admin';

insert into public.tenant_members (
  tenant_id, user_id, role, invited_by, access_scope, allowed_shop_ids
)
select tenant.id, account.id, 'member', admin.id, 'magrit_full', '{}'::uuid[]
from ux_seed_user_specs spec
join public.tenants tenant on tenant.slug = spec.tenant_slug
join auth.users account on account.email = spec.email
cross join lateral (
  select id from auth.users where email = 'demo@magrit.local'
) admin
on conflict (tenant_id, user_id) do update set
  role = 'member',
  access_scope = 'magrit_full',
  allowed_shop_ids = '{}'::uuid[];

update public.user_preferences preferences
   set last_tenant_id = tenant.id,
       updated_at = now()
  from ux_seed_user_specs spec
  join auth.users account on account.email = spec.email
  join public.tenants tenant on tenant.slug = spec.tenant_slug
 where preferences.user_id = account.id;

insert into public.tenant_role_assignments (
  id, role_definition_id, user_id, assigned_by, revoked_at, revoked_by
)
select
  pg_temp.ux_uuid('ux-role-assignment:' || spec.email || ':' || spec.option_key),
  definition.id,
  account.id,
  admin.id,
  null,
  null
from ux_seed_user_specs spec
join auth.users account on account.email = spec.email
join public.tenants tenant on tenant.slug = spec.tenant_slug
join public.tenant_role_definitions definition
  on definition.tenant_id = tenant.id
 and definition.system_key = spec.option_key
 and definition.identity_context = 'magrit'
 and definition.archived_at is null
cross join lateral (
  select id from auth.users where email = 'demo@magrit.local'
) admin
where spec.option_key is not null
on conflict (id) do update set
  role_definition_id = excluded.role_definition_id,
  user_id = excluded.user_id,
  assigned_by = excluded.assigned_by,
  revoked_at = null,
  revoked_by = null;

update public.user_preferences preferences
   set last_tenant_id = tenant.id,
       updated_at = now()
  from auth.users demo
  join public.tenants tenant on tenant.slug = 'pressetout'
 where demo.email = 'demo@magrit.local'
   and preferences.user_id = demo.id
   and exists (select 1 from ux_seed_tenant_specs where slug = 'pressetout');

insert into public.shops (
  id, owner_user_id, slug, name, description, theme, contact_email,
  active, tenant_id, tagline, access_mode, deleted_at
)
select
  pg_temp.ux_uuid('ux-shop:' || spec.slug || ':' || shop.position),
  demo.id,
  spec.slug || '-' || shop.slug_suffix,
  spec.name || ' — ' || shop.label,
  'Boutique de démonstration créée par db:seed:ux',
  jsonb_build_object(
    'primaryColor', case shop.position when 1 then '#1e3a8a' else '#7c3aed' end,
    'accentColor', case shop.position when 1 then '#f59e0b' else '#22c55e' end,
    'mode', 'light'
  ),
  'demo@magrit.local',
  true,
  tenant.id,
  case shop.position when 1 then 'Vos imprimés, simplement' else 'L’atelier des projets sur mesure' end,
  case shop.position when 1 then 'self_signup' else 'invite_only' end,
  null
from ux_seed_tenant_specs spec
join public.tenants tenant on tenant.slug = spec.slug
cross join lateral (
  select id from auth.users where email = 'demo@magrit.local'
) demo
cross join (values (1, 'public', 'Boutique publique'), (2, 'pro', 'Espace professionnels'))
  as shop(position, slug_suffix, label)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  theme = excluded.theme,
  contact_email = excluded.contact_email,
  active = true,
  tenant_id = excluded.tenant_id,
  tagline = excluded.tagline,
  access_mode = excluded.access_mode,
  deleted_at = null;

create temporary table ux_seed_context on commit drop as
select
  tenant.id as tenant_id,
  spec.slug as tenant_slug,
  spec.customer_count,
  spec.order_count,
  demo.id as actor_id
from ux_seed_tenant_specs spec
join public.tenants tenant on tenant.slug = spec.slug
cross join lateral (
  select id from auth.users where email = 'demo@magrit.local'
) demo;

do $$
begin
  if not exists (select 1 from ux_seed_context) then
    raise exception 'Aucun tenant a alimenter';
  end if;
  if exists (select 1 from ux_seed_context where actor_id is null) then
    raise exception 'Le compte administrateur de demonstration est introuvable';
  end if;
  if exists (
    select 1
      from ux_seed_context context
     where not exists (
       select 1 from public.shops shop where shop.tenant_id = context.tenant_id
     )
  ) then
    raise exception 'Une boutique de demonstration est introuvable';
  end if;
end;
$$;

create temporary table ux_seed_shops on commit drop as
select
  shop.id,
  context.tenant_id,
  row_number() over (partition by context.tenant_id order by shop.slug)::integer as position,
  count(*) over (partition by context.tenant_id)::integer as shop_count
from public.shops shop
join ux_seed_context context on context.tenant_id = shop.tenant_id
where shop.slug in (context.tenant_slug || '-public', context.tenant_slug || '-pro');

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
  on shop.tenant_id = context.tenant_id
 and shop.position = 1 + (series.number - 1) % shop.shop_count
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
  context.tenant_id,
  1 + (series.number - 1) % context.customer_count as customer_number,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-order:' || series.number) as order_id,
  shop.id as shop_id,
  pg_temp.ux_uuid(context.tenant_id::text || ':ux-account:' || (1 + (series.number - 1) % context.customer_count)) as account_id,
  'draft'::public.tenant_order_status as status,
  case series.number % 7
    when 0 then 'draft'::public.tenant_order_status
    when 1 then 'validated'::public.tenant_order_status
    when 2 then 'in_production'::public.tenant_order_status
    when 3 then 'shipped'::public.tenant_order_status
    when 4 then 'delivered'::public.tenant_order_status
    when 5 then 'invoiced'::public.tenant_order_status
    else 'cancelled'::public.tenant_order_status
  end as target_status,
  now()
    - ((series.number * 37) % 400 || ' days')::interval
    - ((series.number * 17) % 24 || ' hours')::interval as created_at
from ux_seed_context context
cross join lateral generate_series(1, context.order_count) as series(number)
join ux_seed_shops shop
  on shop.tenant_id = context.tenant_id
 and shop.position = 1 + ((1 + (series.number - 1) % context.customer_count) - 1) % shop.shop_count;

-- Le rejeu peut devoir repasser temporairement une commande finale en brouillon.
select set_config('magrit.order_status_transition', 'true', true);

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
  case when orders.target_status = 'invoiced'
    then 'UX-FACT-' || lpad(orders.number::text, 5, '0')
  end,
  orders.created_at,
  orders.created_at + interval '2 hours',
  case when orders.target_status = 'cancelled' then orders.created_at + interval '1 day' end
from ux_seed_orders orders
join ux_seed_context context on context.tenant_id = orders.tenant_id
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
  quantity, unit_price_ht, line_total_ht, price_origin, created_at
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
  'catalog',
  orders.created_at
from ux_seed_orders orders
cross join lateral generate_series(1, 1 + orders.number % 3) as item(number)
on conflict (id) do update set
  product_label = excluded.product_label,
  clariprint_options = excluded.clariprint_options,
  quantity = excluded.quantity,
  unit_price_ht = excluded.unit_price_ht,
  line_total_ht = excluded.line_total_ht,
  price_origin = excluded.price_origin,
  created_at = excluded.created_at;

-- Les lignes sont immuables des que la commande quitte `draft`. Les fixtures
-- sont donc completees en deux temps : lignes d abord, statut cible ensuite.
-- Le marqueur est necessaire au rejeu, quand une commande existe deja dans un
-- statut final et doit revenir temporairement a `draft` pour etre resynchronisee.
update public.tenant_orders orders
   set status = fixture.target_status,
       cancelled_at = case
         when fixture.target_status = 'cancelled' then orders.created_at + interval '1 day'
       end,
       updated_at = orders.created_at + interval '2 hours'
  from ux_seed_orders fixture
 where orders.id = fixture.order_id
   and orders.status is distinct from fixture.target_status;

select set_config('magrit.order_status_transition', '', true);

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
