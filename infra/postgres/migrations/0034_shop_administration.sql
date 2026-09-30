alter table public.shops
  add column description text not null default '',
  add column theme jsonb not null default '{"primaryColor":"#1e3a8a","accentColor":"#f59e0b","mode":"light","secondaryColor":"#6b7280","textColor":"#0f172a","bgColor":"#ffffff","fontPairing":"system"}'::jsonb,
  add column logo_url text not null default '',
  add column address text not null default '',
  add column contact_email text not null default '',
  add column active boolean not null default true,
  add column library_ids uuid[] not null default '{}',
  add column excluded_product_ids uuid[] not null default '{}',
  add column hero_image_url text,
  add column tagline text,
  add column pim_catalog_mode boolean not null default false,
  add column pim_gamme_slugs text[] not null default '{}',
  add column access_mode text not null default 'invite_only',
  add constraint shops_theme_object check (jsonb_typeof(theme)='object'),
  add constraint shops_tagline_length check (tagline is null or char_length(tagline)<=120),
  add constraint shops_access_mode_check check (access_mode in ('invite_only','self_signup')),
  add constraint shops_id_tenant_unique unique (id,tenant_id);

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  tenant_id uuid not null,
  product_id uuid,
  name text not null check (btrim(name)<>''),
  category text not null default 'Autres',
  description text not null default '',
  price_ht numeric(12,2) not null default 0 check (price_ht>=0),
  image_url text not null default '',
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object'),
  display_order integer not null default 0,
  gamme_slug text,
  origin text not null default 'manual' check (origin in ('manual','ai')),
  config_hash text,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (shop_id,tenant_id) references public.shops(id,tenant_id) on delete cascade
);
create index shop_products_shop_order_idx on public.shop_products(shop_id,display_order,id);
create index shop_products_tenant_idx on public.shop_products(tenant_id);
create unique index shop_products_ai_config_uidx on public.shop_products(shop_id,config_hash) where config_hash is not null;

create table public.shop_product_pricing (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  tenant_id uuid not null,
  library_product_id uuid not null,
  price_ht_override numeric(12,2) not null check (price_ht_override>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (shop_id,tenant_id) references public.shops(id,tenant_id) on delete cascade,
  unique (shop_id,library_product_id)
);
create index shop_product_pricing_tenant_idx on public.shop_product_pricing(tenant_id);

create table public.shop_template_mockups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  tenant_id uuid not null,
  template_type text not null check (template_type in ('carteVisite','flyer','brochure','etiquette','kakemono','packaging','depliant')),
  view text not null check (view in ('front','back')),
  mockup_image_url text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (shop_id,tenant_id) references public.shops(id,tenant_id) on delete cascade,
  unique (shop_id,template_type,view)
);
create index shop_template_mockups_tenant_idx on public.shop_template_mockups(tenant_id);

drop policy shops_select on public.shops;
create policy shops_select on public.shops for select using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
create policy shops_write on public.shops for all using (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
);

alter table public.shop_products enable row level security;
alter table public.shop_products force row level security;
alter table public.shop_product_pricing enable row level security;
alter table public.shop_product_pricing force row level security;
alter table public.shop_template_mockups enable row level security;
alter table public.shop_template_mockups force row level security;

create policy shop_products_read on public.shop_products for select using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
create policy shop_products_write on public.shop_products for all using (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
);
create policy shop_product_pricing_read on public.shop_product_pricing for select using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
create policy shop_product_pricing_write on public.shop_product_pricing for all using (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
);
create policy shop_template_mockups_read on public.shop_template_mockups for select using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
create policy shop_template_mockups_write on public.shop_template_mockups for all using (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shops')
);

revoke all on table public.shop_products,public.shop_product_pricing,public.shop_template_mockups from public;
grant select,insert,update,delete on table public.shops,public.shop_products,public.shop_product_pricing,public.shop_template_mockups to magrit_api;

comment on table public.shop_products is 'Produits manuels ou calcules rattaches a une boutique portable.';
comment on table public.shop_product_pricing is 'Surcharges de prix propres a une boutique.';
comment on table public.shop_template_mockups is 'References S3 des mockups personnalises d une boutique.';
