-- Magrit : module boutique (plans, bibliothèque, shops, commandes)
-- À exécuter dans le SQL Editor du dashboard Supabase.

-- ─── Plans utilisateur ───────────────────────────────────────────────────────
alter table public.user_preferences
  add column if not exists plan text not null default 'freemium';

alter table public.user_preferences
  drop constraint if exists user_preferences_plan_check;
alter table public.user_preferences
  add constraint user_preferences_plan_check
    check (plan in ('freemium', 'pro', 'enterprise'));

-- Trigger : initialisation de user_preferences au signup
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id, plan)
  values (new.id, 'freemium')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rattrapage : insérer les prefs pour les users existants sans row
insert into public.user_preferences (user_id, plan)
select u.id, 'freemium'
from auth.users u
left join public.user_preferences p on p.user_id = u.id
where p.user_id is null;

-- ─── Bibliothèque de produits ────────────────────────────────────────────────
create table if not exists public.product_library (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  category     text not null default 'Autres',
  description  text default '',
  price_ht     numeric(12,2) not null default 0,
  image_url    text default '',
  config       jsonb not null default '{}'::jsonb,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists product_library_user_id_idx on public.product_library(user_id);

alter table public.product_library enable row level security;
drop policy if exists "own library all" on public.product_library;
create policy "own library all" on public.product_library
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Boutiques ───────────────────────────────────────────────────────────────
create table if not exists public.shops (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,
  slug           text unique not null,
  name           text not null,
  description    text default '',
  theme          jsonb not null default '{"primaryColor":"#1e3a8a","accentColor":"#f59e0b","mode":"light"}'::jsonb,
  logo_url       text default '',
  address        text default '',
  contact_email  text default '',
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists shops_owner_idx on public.shops(owner_user_id);

alter table public.shops enable row level security;
drop policy if exists "shops owner all" on public.shops;
create policy "shops owner all" on public.shops
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- Lecture publique (anonyme) limitée aux shops actifs (pour /shop/:slug)
drop policy if exists "shops public select" on public.shops;
create policy "shops public select" on public.shops
  for select using (active = true);

-- ─── Produits d'une boutique ─────────────────────────────────────────────────
create table if not exists public.shop_products (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops(id) on delete cascade,
  product_id       uuid references public.product_library(id) on delete set null,
  name             text not null,
  category         text not null default 'Autres',
  description      text default '',
  price_ht         numeric(12,2) not null default 0,
  image_url        text default '',
  config           jsonb not null default '{}'::jsonb,
  display_order    integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists shop_products_shop_id_idx on public.shop_products(shop_id);

alter table public.shop_products enable row level security;
drop policy if exists "shop_products owner all" on public.shop_products;
create policy "shop_products owner all" on public.shop_products
  for all using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_user_id = auth.uid())
  );

drop policy if exists "shop_products public select" on public.shop_products;
create policy "shop_products public select" on public.shop_products
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.active = true)
  );

-- ─── Commandes boutique (mini-checkout) ──────────────────────────────────────
create table if not exists public.shop_orders (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id) on delete cascade,
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text default '',
  items           jsonb not null default '[]'::jsonb,
  total_ht        numeric(12,2) not null default 0,
  total_ttc       numeric(12,2) not null default 0,
  notes           text default '',
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);
create index if not exists shop_orders_shop_id_idx on public.shop_orders(shop_id);

alter table public.shop_orders enable row level security;

-- Owner voit/gère les commandes de ses shops
drop policy if exists "shop_orders owner" on public.shop_orders;
create policy "shop_orders owner" on public.shop_orders
  for all using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_user_id = auth.uid())
  );

-- Anonymes peuvent créer une commande (checkout public)
drop policy if exists "shop_orders public insert" on public.shop_orders;
create policy "shop_orders public insert" on public.shop_orders
  for insert with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.active = true)
  );
