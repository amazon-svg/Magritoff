create table public.libraries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete restrict,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default clock_timestamp(),
  constraint libraries_name_check check (btrim(name)<>'' and char_length(name)<=200),
  constraint libraries_description_check check (char_length(description)<=2000),
  unique(id,tenant_id)
);
create index libraries_tenant_created_idx on public.libraries(tenant_id,created_at desc);

create table public.product_library (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete restrict,
  library_id uuid,
  name text not null,
  category text not null default 'Autres',
  description text not null default '',
  price_ht numeric(12,2) not null default 0,
  image_url text not null default '',
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  gamme_slug text references public.product_gammes(slug) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(library_id,tenant_id) references public.libraries(id,tenant_id) on delete cascade,
  constraint product_library_name_check check (btrim(name)<>'' and char_length(name)<=300),
  constraint product_library_category_check check (char_length(category)<=200),
  constraint product_library_description_check check (char_length(description)<=5000),
  constraint product_library_price_check check (price_ht>=0),
  constraint product_library_image_check check (char_length(image_url)<=4000),
  constraint product_library_config_check check (jsonb_typeof(config)='object')
);
create index product_library_tenant_created_idx on public.product_library(tenant_id,created_at desc);
create index product_library_library_idx on public.product_library(library_id) where library_id is not null;
create index product_library_gamme_idx on public.product_library(tenant_id,gamme_slug) where gamme_slug is not null;

alter table public.shop_products add constraint shop_products_product_fkey
  foreign key(product_id) references public.product_library(id) on delete set null;
alter table public.shop_product_pricing add constraint shop_product_pricing_library_product_fkey
  foreign key(library_product_id) references public.product_library(id) on delete cascade;

alter table public.libraries enable row level security;
alter table public.libraries force row level security;
alter table public.product_library enable row level security;
alter table public.product_library force row level security;
create policy libraries_tenant_access on public.libraries for all using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
create policy product_library_tenant_access on public.product_library for all using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
revoke all on table public.libraries,public.product_library from public;
grant select,insert,update,delete on table public.libraries,public.product_library to magrit_api;

comment on table public.libraries is 'Bibliotheques de produits portables, isolees par tenant.';
comment on table public.product_library is 'Produits de bibliotheque et produits PIM materialises, sans dependance Supabase.';
