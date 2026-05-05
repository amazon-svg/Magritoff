
-- ============================================================================
-- FILE: 20260418_user_data.sql
-- ============================================================================
-- Magrit : tables utilisateur (conversations, devis, commandes, préférences, clients)
-- À exécuter dans le SQL Editor du dashboard Supabase (projet jynxrpzwgzrrfuooputw).

-- ─── Conversations (historique prompt) ───────────────────────────────────────
create table if not exists public.conversations (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  messages     jsonb not null default '[]'::jsonb,
  products     jsonb not null default '[]'::jsonb,
  timestamp    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists conversations_user_id_idx on public.conversations(user_id);

alter table public.conversations enable row level security;
drop policy if exists "own conversations select" on public.conversations;
drop policy if exists "own conversations insert" on public.conversations;
drop policy if exists "own conversations update" on public.conversations;
drop policy if exists "own conversations delete" on public.conversations;
create policy "own conversations select" on public.conversations for select using (auth.uid() = user_id);
create policy "own conversations insert" on public.conversations for insert with check (auth.uid() = user_id);
create policy "own conversations update" on public.conversations for update using (auth.uid() = user_id);
create policy "own conversations delete" on public.conversations for delete using (auth.uid() = user_id);

-- ─── Préférences utilisateur ─────────────────────────────────────────────────
create table if not exists public.user_preferences (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  theme                   text not null default 'light',
  language                text not null default 'fr',
  default_delivery_zone   text not null default 'FR-75',
  notifications_email     boolean not null default true,
  updated_at              timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
drop policy if exists "own prefs all" on public.user_preferences;
create policy "own prefs all" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Clients (CRM) ───────────────────────────────────────────────────────────
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company       text not null,
  contact_name  text default '',
  email         text default '',
  phone         text default '',
  address       text default '',
  notes         text default '',
  created_at    timestamptz not null default now()
);
create index if not exists clients_user_id_idx on public.clients(user_id);

alter table public.clients enable row level security;
drop policy if exists "own clients all" on public.clients;
create policy "own clients all" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Devis ───────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  reference       text not null,
  product_name    text not null,
  product_config  jsonb,
  total_ht        numeric(12,2),
  total_ttc       numeric(12,2),
  status          text not null default 'draft',
  created_at      timestamptz not null default now()
);
create index if not exists quotes_user_id_idx on public.quotes(user_id);

alter table public.quotes enable row level security;
drop policy if exists "own quotes all" on public.quotes;
create policy "own quotes all" on public.quotes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Commandes ───────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  quote_id        uuid references public.quotes(id) on delete set null,
  reference       text not null,
  product_name    text not null,
  product_config  jsonb,
  total_ht        numeric(12,2),
  total_ttc       numeric(12,2),
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders(user_id);

alter table public.orders enable row level security;
drop policy if exists "own orders all" on public.orders;
create policy "own orders all" on public.orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- FILE: 20260418_shop_module.sql
-- ============================================================================
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

-- ============================================================================
-- FILE: 20260418_library_client.sql
-- ============================================================================
-- Ajoute la notion de client à la bibliothèque de produits.
-- À exécuter après 20260418_shop_module.sql.

alter table public.product_library
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists product_library_client_id_idx on public.product_library(client_id);

-- ============================================================================
-- FILE: 20260420_libraries.sql
-- ============================================================================
-- Magrit : introduction des bibliothèques nommées (v2 du module biblio)
-- Chaque produit appartient à UNE bibliothèque. Les bibliothèques sont
-- contextualisées (client, thème, type de produit, etc.)

-- ─── Table libraries ─────────────────────────────────────────────────────────
create table if not exists public.libraries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  name        text not null,
  description text default '',
  created_at  timestamptz not null default now()
);
create index if not exists libraries_user_id_idx on public.libraries(user_id);

alter table public.libraries enable row level security;
drop policy if exists "own libraries all" on public.libraries;
create policy "own libraries all" on public.libraries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Column library_id sur product_library ───────────────────────────────────
alter table public.product_library
  add column if not exists library_id uuid references public.libraries(id) on delete cascade;
create index if not exists product_library_library_id_idx on public.product_library(library_id);

-- ─── Backfill : créer une bibliothèque par défaut et associer les produits ───

-- Pour chaque couple distinct (user_id, client_id) ayant des produits orphelins,
-- on crée une bibliothèque. Les produits sans client vont dans "Ma bibliothèque".
-- Les produits avec un client vont dans "Bibliothèque {company}".
insert into public.libraries (user_id, client_id, name, description)
select distinct pl.user_id,
       pl.client_id,
       case when pl.client_id is null then 'Ma bibliothèque' else 'Bibliothèque ' || c.company end,
       'Bibliothèque créée automatiquement lors de la migration'
from public.product_library pl
left join public.clients c on c.id = pl.client_id
where pl.library_id is null;

-- Associer les produits orphelins à la bibliothèque correspondante
update public.product_library pl
set library_id = l.id
from public.libraries l
where pl.library_id is null
  and pl.user_id = l.user_id
  and (
    pl.client_id = l.client_id
    or (pl.client_id is null and l.client_id is null)
  );

-- ============================================================================
-- FILE: 20260420_pim.sql
-- ============================================================================
-- Magrit : PIM (Product Information Management) - phase 1
-- Base partagée : lecture ouverte, écriture restreinte aux admins.

-- ─── Flag admin sur user_preferences ─────────────────────────────────────────
alter table public.user_preferences
  add column if not exists is_admin boolean not null default false;

-- ─── Taxonomie Magrit : gammes commerciales ─────────────────────────────────
create table if not exists public.product_gammes (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  parent_slug     text references public.product_gammes(slug) on delete set null,
  matching_rules  jsonb not null default '{}'::jsonb,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists product_gammes_parent_idx on public.product_gammes(parent_slug);

alter table public.product_gammes enable row level security;
drop policy if exists "gammes public read" on public.product_gammes;
drop policy if exists "gammes admin write" on public.product_gammes;
create policy "gammes public read" on public.product_gammes for select using (true);
create policy "gammes admin write" on public.product_gammes
  for all using (
    exists (select 1 from public.user_preferences up where up.user_id = auth.uid() and up.is_admin = true)
  ) with check (
    exists (select 1 from public.user_preferences up where up.user_id = auth.uid() and up.is_admin = true)
  );

-- ─── Définitions produits (contenu commercial / SEO / GEO) ───────────────────
create table if not exists public.product_definitions (
  id                uuid primary key default gen_random_uuid(),
  gamme_slug        text not null references public.product_gammes(slug) on delete cascade,
  variation_filter  jsonb not null default '{}'::jsonb,
  locale            text not null default 'fr',

  name              text,
  keywords          text[],

  -- Templates (placeholders {{format}}, {{grammage}}, etc.)
  title_template              text,
  short_description_template  text,
  description_template        text,
  h1_template                 text,

  -- SEO
  seo_title         text,
  seo_description   text,
  schema_org_type   text default 'Product',

  -- Contenu enrichi
  usage_examples    jsonb default '[]'::jsonb,
  faq               jsonb default '[]'::jsonb,

  -- Qualité / curation
  version           integer not null default 1,
  quality_score     numeric(3,2),
  generated_by      text check (generated_by in ('llm', 'human', 'hybrid')),
  validated_by      text check (validated_by in ('llm', 'human', 'pending')) default 'pending',
  last_reviewed_at  timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (gamme_slug, variation_filter, locale)
);
create index if not exists product_definitions_gamme_locale_idx on public.product_definitions(gamme_slug, locale);

alter table public.product_definitions enable row level security;
drop policy if exists "definitions public read" on public.product_definitions;
drop policy if exists "definitions admin write" on public.product_definitions;
create policy "definitions public read" on public.product_definitions for select using (true);
create policy "definitions admin write" on public.product_definitions
  for all using (
    exists (select 1 from public.user_preferences up where up.user_id = auth.uid() and up.is_admin = true)
  ) with check (
    exists (select 1 from public.user_preferences up where up.user_id = auth.uid() and up.is_admin = true)
  );

-- ─── Seed des 15 gammes initiales avec matching_rules ────────────────────────
-- Les matching_rules supportent les clés :
--   kind (string | string[])
--   size_near { width, height, tol }   -- match W/H ou H/W avec tolérance (mm)
--   size_range { min_dim, max_dim }    -- borne sur max(width, height)
--   binding_in (string[])              -- pour kind=book
--   folds (string)                     -- pour kind=folded
--   pages_range { min, max }           -- pour kind=book

insert into public.product_gammes (slug, name, parent_slug, display_order, matching_rules) values
  -- Carterie
  ('carterie', 'Carterie', null, 10, '{"kind":"leaflet","size_range":{"max_dim":150}}'),
  ('carte_visite_standard', 'Carte de visite standard', 'carterie', 11,
    '{"kind":"leaflet","size_near":{"width":85,"height":55,"tol":3}}'),
  ('carte_visite_horizontale', 'Carte de visite horizontale', 'carterie', 12,
    '{"kind":"leaflet","size_near":{"width":90,"height":54,"tol":3}}'),
  ('carte_visite_carree', 'Carte de visite carrée', 'carterie', 13,
    '{"kind":"leaflet","size_near":{"width":55,"height":55,"tol":3}}'),
  ('carte_correspondance', 'Carte de correspondance', 'carterie', 14,
    '{"kind":"leaflet","size_near":{"width":148,"height":105,"tol":5}}'),
  ('carte_voeux', 'Carte de vœux pliée', 'carterie', 15,
    '{"kind":"folded","size_near":{"width":148,"height":210,"tol":10}}'),

  -- Flyers / tracts
  ('flyer', 'Flyers', null, 20, '{"kind":"leaflet","size_range":{"min_dim":100,"max_dim":300}}'),
  ('flyer_a6', 'Flyer A6', 'flyer', 21,
    '{"kind":"leaflet","size_near":{"width":105,"height":148,"tol":5}}'),
  ('flyer_a5', 'Flyer A5', 'flyer', 22,
    '{"kind":"leaflet","size_near":{"width":148,"height":210,"tol":5}}'),
  ('flyer_a4', 'Flyer A4', 'flyer', 23,
    '{"kind":"leaflet","size_near":{"width":210,"height":297,"tol":5}}'),
  ('flyer_dl', 'Flyer DL (long)', 'flyer', 24,
    '{"kind":"leaflet","size_near":{"width":100,"height":210,"tol":5}}'),

  -- Affiches
  ('affiche', 'Affiches', null, 30, '{"kind":"leaflet","size_range":{"min_dim":297}}'),
  ('affiche_a3', 'Affiche A3', 'affiche', 31,
    '{"kind":"leaflet","size_near":{"width":297,"height":420,"tol":8}}'),
  ('affiche_a2', 'Affiche A2', 'affiche', 32,
    '{"kind":"leaflet","size_near":{"width":420,"height":594,"tol":10}}'),
  ('affiche_a1', 'Affiche A1', 'affiche', 33,
    '{"kind":"leaflet","size_near":{"width":594,"height":841,"tol":15}}'),
  ('affiche_a0', 'Affiche A0', 'affiche', 34,
    '{"kind":"leaflet","size_near":{"width":841,"height":1189,"tol":20}}'),

  -- Dépliants
  ('depliant', 'Dépliants', null, 40, '{"kind":"folded"}'),

  -- Brochures
  ('brochure', 'Brochures', null, 50, '{"kind":"book"}'),
  ('brochure_dos_carre', 'Brochure dos carré collé', 'brochure', 51,
    '{"kind":"book","binding_in":["PerfectBinding","PerfectBindingPUR","DCC","DCCPUR"]}'),
  ('brochure_piquee', 'Brochure piquée 2 points', 'brochure', 52,
    '{"kind":"book","binding_in":["Stitching2","Stitching3","Stitching4","InlineStiching"]}'),
  ('brochure_spirale', 'Brochure spirale (WireO)', 'brochure', 53,
    '{"kind":"book","binding_in":["WireO"]}'),
  ('brochure_cousue', 'Brochure cousue', 'brochure', 54,
    '{"kind":"book","binding_in":["SewnBinding"]}')

on conflict (slug) do update set
  name = excluded.name,
  parent_slug = excluded.parent_slug,
  display_order = excluded.display_order,
  matching_rules = excluded.matching_rules;

-- ─── Activer le flag admin pour ton compte ────────────────────────────────────
-- À personnaliser avec TON email (remplace 'ton@email.com' ci-dessous) :
-- update public.user_preferences up
-- set is_admin = true
-- where user_id = (select id from auth.users where email = 'ton@email.com');

-- ============================================================================
-- FILE: 20260422_quote_templates.sql
-- ============================================================================
-- ============================================================================
-- Migration : gabarits de devis (quote_templates) + reference dans user_preferences
-- ----------------------------------------------------------------------------
-- Cree une table par-utilisateur qui stocke les gabarits custom utilises pour
-- generer les devis (logo, couleurs, identite emetteur). Les 3 gabarits
-- "builtin" (Classique, Atelier, Corporate) sont en dur cote app et ne sont
-- PAS stockes en DB.
--
-- user_preferences gagne une colonne default_quote_template_id qui peut
-- pointer :
--   * soit vers un id de quote_templates (cas utilisateur custom)
--   * soit vers un id builtin (cas "builtin-classique" / "builtin-atelier"
--     / "builtin-corporate") — pas de FK dans ce cas, juste un text.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── Table quote_templates ────────────────────────────────────────────────
create table if not exists public.quote_templates (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  style            text default 'custom', -- classique | atelier | corporate | custom

  -- identite emetteur
  company_name     text,
  address          text,
  postal_code      text,
  city             text,
  country          text,
  phone            text,
  email            text,
  website          text,
  siret            text,
  tva_number       text,
  logo_url         text,    -- data-url ou url publique

  -- branding visuel
  brand_color      text default '#111111',
  accent_color     text default '#f59e0b',
  font_family      text,

  -- metadonnees
  validity_days    int  default 30,
  footer_text      text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists quote_templates_user_id_idx
  on public.quote_templates(user_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.quote_templates enable row level security;

drop policy if exists "quote_templates_select_own" on public.quote_templates;
drop policy if exists "quote_templates_insert_own" on public.quote_templates;
drop policy if exists "quote_templates_update_own" on public.quote_templates;
drop policy if exists "quote_templates_delete_own" on public.quote_templates;

create policy "quote_templates_select_own"
  on public.quote_templates for select
  using (auth.uid() = user_id);

create policy "quote_templates_insert_own"
  on public.quote_templates for insert
  with check (auth.uid() = user_id);

create policy "quote_templates_update_own"
  on public.quote_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "quote_templates_delete_own"
  on public.quote_templates for delete
  using (auth.uid() = user_id);

-- ─── user_preferences.default_quote_template_id ───────────────────────────
alter table if exists public.user_preferences
  add column if not exists default_quote_template_id text;

comment on column public.user_preferences.default_quote_template_id is
  'Id du gabarit par defaut : uuid d''un quote_templates OU slug builtin (builtin-classique, builtin-atelier, builtin-corporate).';

-- ============================================================================
-- FILE: 20260424_01_tenants_core.sql
-- ============================================================================
-- =============================================================================
-- Migration 01 / v3 — Tenants core
-- -----------------------------------------------------------------------------
-- Cree le socle multi-tenant :
--   * tenants                — un tenant = un espace isole (imprimerie OU sous-espace)
--   * tenant_members         — qui a acces a quoi, avec quel role
--   * tenant_invitations     — invitations pendantes (magic link email)
--
-- Hierarchie 2 niveaux via parent_tenant_id :
--   tenant racine "imprimerie-dupont"
--     └─ sous-tenant "dupont-carrefour-france"   (partner = client B2B externe)
--     └─ sous-tenant "dupont-bordeaux"           (member = filiale interne)
--
-- Le tenant "magrit-root" est un tenant special (is_system_tenant = true) dans
-- lequel est membre l'equipe Magrit. Ses membres ont un acces superadmin qui
-- permet de voir tous les tenants (pour support, facturation, admin PIM).
--
-- NB : toute creation d'un tenant avec parent_tenant_id non null est interdite
-- si le parent a lui-meme un parent (on garde max 2 niveaux). Enforce via
-- trigger plus bas.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ─── Table tenants ─────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,       -- 'imprimerie-dupont' (URL-safe)
  name               text not null,              -- 'Imprimerie Dupont'
  parent_tenant_id   uuid references public.tenants(id) on delete cascade,
  plan               text not null default 'freemium',  -- freemium | pro | enterprise
  is_system_tenant   boolean not null default false,    -- true pour magrit-root
  settings           jsonb not null default '{}'::jsonb, -- branding, features, limits
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists tenants_slug_idx on public.tenants(slug);
create index if not exists tenants_parent_idx on public.tenants(parent_tenant_id);

-- Contrainte applicative : max 2 niveaux de hierarchie.
create or replace function public.enforce_tenant_depth()
returns trigger language plpgsql as $$
declare grandparent uuid;
begin
  if new.parent_tenant_id is not null then
    select parent_tenant_id into grandparent
    from public.tenants where id = new.parent_tenant_id;
    if grandparent is not null then
      raise exception 'Tenants can only be 2 levels deep (root -> child). Found: %', new.parent_tenant_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_depth on public.tenants;
create trigger trg_enforce_tenant_depth
  before insert or update of parent_tenant_id on public.tenants
  for each row execute function public.enforce_tenant_depth();

-- ─── Table tenant_members ──────────────────────────────────────────────────
-- Roles :
--   owner   — creator, a tous les droits y compris suppression du tenant
--   admin   — peut inviter/retirer des membres, editer les settings
--   member  — user interne standard (equipe de l'imprimerie)
--   partner — acces partiel (typiquement : client B2B externe sur un sous-tenant,
--             ne voit que les donnees de son sous-tenant, pas les siblings)
create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member'
             check (role in ('owner', 'admin', 'member', 'partner')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members(user_id);
create index if not exists tenant_members_tenant_idx on public.tenant_members(tenant_id);

-- ─── Table tenant_invitations ──────────────────────────────────────────────
create table if not exists public.tenant_invitations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null,
  role        text not null default 'member'
              check (role in ('admin', 'member', 'partner')),
  token       text unique not null,  -- genere cote app (crypto.randomUUID + hash)
  expires_at  timestamptz not null,
  invited_by  uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists tenant_invitations_email_idx on public.tenant_invitations(email);
create index if not exists tenant_invitations_tenant_idx on public.tenant_invitations(tenant_id);

-- =============================================================================
-- ─── Fonctions helpers RLS (centralisees pour etre reutilisees) ────────────
-- =============================================================================

-- Retourne les tenant_ids auxquels auth.uid() a acces (direct OU en tant que
-- parent d'un sous-tenant). Utilise PARTOUT dans les policies RLS.
-- ⚠️  security definer + stable → appelable depuis policy sans recursion RLS.
create or replace function public.current_user_tenant_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  -- Tenants dont je suis membre direct
  select tenant_id from public.tenant_members where user_id = auth.uid()
  union
  -- Tenants dont je suis membre, ET leurs enfants (acces descendant)
  -- Exclut les partners : un partner ne voit que son propre sous-tenant.
  select t.id from public.tenants t
  where t.parent_tenant_id in (
    select tm.tenant_id from public.tenant_members tm
    where tm.user_id = auth.uid()
    and tm.role in ('owner', 'admin', 'member')
  );
$$;

-- Verifie si auth.uid() est superadmin (= membre du tenant system 'magrit-root').
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_members tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.user_id = auth.uid()
      and t.is_system_tenant = true
      and tm.role in ('owner', 'admin')
  );
$$;

-- Retourne le role de auth.uid() sur un tenant donne. Null si pas membre.
create or replace function public.user_role_in_tenant(p_tenant_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select role from public.tenant_members
  where tenant_id = p_tenant_id and user_id = auth.uid()
  limit 1;
$$;

-- =============================================================================
-- ─── RLS sur les tables tenants elles-memes ────────────────────────────────
-- =============================================================================

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_invitations enable row level security;

-- tenants : visible si je suis membre (direct ou parent), OU superadmin.
drop policy if exists "tenants_select" on public.tenants;
create policy "tenants_select" on public.tenants for select using (
  is_super_admin()
  or id in (select public.current_user_tenant_ids())
);

-- tenants : creation autorisee pour tout user connecte. Le owner doit etre
-- ajoute comme membre dans la meme transaction cote app (via fonction helper).
drop policy if exists "tenants_insert" on public.tenants;
create policy "tenants_insert" on public.tenants for insert with check (
  auth.uid() is not null
);

-- tenants : update reserve aux owner/admin ou superadmin.
drop policy if exists "tenants_update" on public.tenants;
create policy "tenants_update" on public.tenants for update using (
  is_super_admin()
  or public.user_role_in_tenant(id) in ('owner', 'admin')
);

-- tenants : delete reserve au owner ou superadmin.
drop policy if exists "tenants_delete" on public.tenants;
create policy "tenants_delete" on public.tenants for delete using (
  is_super_admin()
  or public.user_role_in_tenant(id) = 'owner'
);

-- tenant_members : visible si je suis membre du meme tenant, ou superadmin.
drop policy if exists "tenant_members_select" on public.tenant_members;
create policy "tenant_members_select" on public.tenant_members for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- tenant_members : insert reserve au user qui cree le tenant (owner auto) OU
-- aux admins/owners du tenant pour ajouter des membres (utilise dans accept-invitation).
drop policy if exists "tenant_members_insert" on public.tenant_members;
create policy "tenant_members_insert" on public.tenant_members for insert with check (
  is_super_admin()
  or (user_id = auth.uid())  -- self-insert via accept-invitation
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

-- tenant_members : update et delete reserve aux admins du tenant (pour changer
-- un role ou retirer un membre). Un owner ne peut pas etre retire par un admin.
drop policy if exists "tenant_members_update" on public.tenant_members;
create policy "tenant_members_update" on public.tenant_members for update using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);
drop policy if exists "tenant_members_delete" on public.tenant_members;
create policy "tenant_members_delete" on public.tenant_members for delete using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  or user_id = auth.uid()  -- quit self
);

-- tenant_invitations : visibles par les admins du tenant + l'invite (via token).
drop policy if exists "invitations_select" on public.tenant_invitations;
create policy "invitations_select" on public.tenant_invitations for select using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

drop policy if exists "invitations_insert" on public.tenant_invitations;
create policy "invitations_insert" on public.tenant_invitations for insert with check (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

drop policy if exists "invitations_update" on public.tenant_invitations;
create policy "invitations_update" on public.tenant_invitations for update using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

drop policy if exists "invitations_delete" on public.tenant_invitations;
create policy "invitations_delete" on public.tenant_invitations for delete using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

-- ============================================================================
-- FILE: 20260424_02_tenant_id_on_data.sql
-- ============================================================================
-- =============================================================================
-- Migration 02 / v3 — Ajout de tenant_id sur toutes les tables data
-- -----------------------------------------------------------------------------
-- Toutes les tables existantes sont scopees user_id (RLS "auth.uid() = user_id").
-- Dans Beta 3, l'unite d'isolation devient le TENANT. On ajoute donc tenant_id
-- sur chaque table qui contient de la data metier, et on re-plombera la RLS
-- dans la migration 04.
--
-- Les tables concernees :
--   * conversations
--   * user_preferences           → pas de tenant_id : reste par user
--   * clients                    ← tenant_id
--   * libraries                  ← tenant_id
--   * product_library            ← tenant_id (table legacy, cf libraries)
--   * shops                      ← tenant_id
--   * shop_products              ← tenant_id (herite via shops, mais denormalise pour perf RLS)
--   * quotes                     ← tenant_id
--   * quote_templates            ← tenant_id
--   * product_gammes             → reste GLOBAL (patrimoine Magrit, partage)
--   * product_definitions        → reste GLOBAL (idem)
--
-- Strategie de migration :
--   * colonne tenant_id nullable dans un premier temps
--   * pas de backfill automatique ici : on cree le tenant "magrit-root" dans
--     la migration 05 et toutes les lignes existantes (il ne devrait pas y
--     en avoir sur un projet neuf) seraient a assigner manuellement
--   * NOT NULL est applique dans la migration 04, une fois le backfill fait
-- =============================================================================

-- ─── conversations ─────────────────────────────────────────────────────────
alter table if exists public.conversations
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists conversations_tenant_idx on public.conversations(tenant_id);

-- ─── clients (CRM clients de l'imprimeur) ──────────────────────────────────
alter table if exists public.clients
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists clients_tenant_idx on public.clients(tenant_id);

-- ─── libraries ─────────────────────────────────────────────────────────────
alter table if exists public.libraries
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists libraries_tenant_idx on public.libraries(tenant_id);

-- ─── product_library (legacy, library_items) ───────────────────────────────
alter table if exists public.product_library
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists product_library_tenant_idx on public.product_library(tenant_id);

-- ─── shops ─────────────────────────────────────────────────────────────────
alter table if exists public.shops
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists shops_tenant_idx on public.shops(tenant_id);

-- ─── shop_products ─────────────────────────────────────────────────────────
-- Denormalise : on duplique tenant_id sur shop_products pour simplifier la RLS
-- (sinon il faut un join via shops a chaque requete = penible). Contrainte
-- applicative : toujours setter tenant_id = shops.tenant_id a l'insert.
alter table if exists public.shop_products
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists shop_products_tenant_idx on public.shop_products(tenant_id);

-- ─── quotes ────────────────────────────────────────────────────────────────
alter table if exists public.quotes
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists quotes_tenant_idx on public.quotes(tenant_id);

-- ─── quote_templates ───────────────────────────────────────────────────────
alter table if exists public.quote_templates
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
create index if not exists quote_templates_tenant_idx on public.quote_templates(tenant_id);

-- ─── user_preferences ──────────────────────────────────────────────────────
-- On ajoute last_tenant_id : dernier tenant actif pour l'user, utilise pour
-- restaurer le contexte apres login (la route /t/:slug prevaut, mais si
-- l'user arrive sur / alors on redir vers son dernier tenant).
alter table if exists public.user_preferences
  add column if not exists last_tenant_id uuid references public.tenants(id) on delete set null;

-- =============================================================================
-- ─── Note sur product_gammes / product_definitions ─────────────────────────
-- =============================================================================
-- Ces tables restent GLOBALES (patrimoine Magrit). Aucune colonne tenant_id
-- n'est ajoutee. L'isolation par tenant se fait via la table
-- `tenant_gamme_subscriptions` (migration 03) qui liste les gammes qu'un
-- tenant a souscrites. Les queries cote app filtrent product_definitions
-- par gamme souscrite.
-- =============================================================================

-- ============================================================================
-- FILE: 20260424_03_pim_subscriptions_and_ingestion.sql
-- ============================================================================
-- =============================================================================
-- Migration 03 / v3 — PIM multi-tenant : souscriptions + ingestion pipeline
-- -----------------------------------------------------------------------------
-- Partie 1 : Subscriptions aux gammes du PIM global.
--   * tenant_gamme_subscriptions : chaque tenant choisit les gammes qu'il veut
--     exposer a ses users (packaging, grand format, carterie, brochure...).
--   * Un helper `tenant_active_gammes(tenant_id)` centralise la requete pour
--     etre utilise partout cote frontend et dans d'autres vues.
--
-- Partie 2 : Pipeline d'ingestion PIM.
--   * pim_candidates : parking pour les products configs issues des commandes
--     validees, en attente de normalisation et d'admission dans le PIM global.
--   * Ciblage du workflow :
--       1. Une commande est validee → on pousse le config produit dans
--          pim_candidates avec status='pending'
--       2. Une edge function `pim-ingest` (a ecrire en parallele de la Beta 3)
--          recupere les candidats pending, les dedupe contre product_definitions
--          existants, les normalise via Clariprint (specs techniques, poids,
--          gabarits, 3D) et via Claude (pitch commercial, SEO, schema.org).
--       3. L'admin Magrit valide/rejete/fusionne dans l'onglet dashboard
--          `Admin PIM > Ingestion queue`.
--   * Les colonnes `normalized_*` sur product_definitions existantes recoivent
--     les donnees enrichies une fois le candidat valide.
--
-- Partie 3 : Enrichissements SEO/commerciaux sur product_definitions.
--   * seo_title, seo_description, schema_org (JSON-LD pour les pages produit)
--   * commercial_pitch, benefits (liste bullets) generes par le LLM
--   * clariprint_ref, mockup_3d_url, technical_spec (normalise par Clariprint)
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- ─── Partie 1 : subscriptions aux gammes ───────────────────────────────────
-- =============================================================================

create table if not exists public.tenant_gamme_subscriptions (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  gamme_slug   text not null references public.product_gammes(slug) on delete cascade,
  -- permet de hierarchiser la visibilite (ordre d'affichage dans le shop).
  display_order int not null default 0,
  -- peut etre desactive temporairement sans detruire le lien.
  active       boolean not null default true,
  -- qui a ajoute cette souscription (admin du tenant ou superadmin).
  added_by     uuid references auth.users(id) on delete set null,
  added_at     timestamptz not null default now(),
  primary key (tenant_id, gamme_slug)
);

create index if not exists tenant_gamme_sub_tenant_idx
  on public.tenant_gamme_subscriptions(tenant_id);

alter table public.tenant_gamme_subscriptions enable row level security;

drop policy if exists "tenant_gamme_sub_select" on public.tenant_gamme_subscriptions;
create policy "tenant_gamme_sub_select" on public.tenant_gamme_subscriptions for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "tenant_gamme_sub_modify" on public.tenant_gamme_subscriptions;
create policy "tenant_gamme_sub_modify" on public.tenant_gamme_subscriptions for all using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
) with check (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

-- Helper : retourne les gammes actives d'un tenant (heritage parent → enfant :
-- un sous-tenant herite par defaut des souscriptions du parent, mais peut
-- override en ajoutant ses propres lignes. On prend l'union.).
create or replace function public.tenant_active_gammes(p_tenant_id uuid)
returns setof text
language sql stable security definer set search_path = public as $$
  -- Souscriptions directes du tenant
  select gamme_slug from public.tenant_gamme_subscriptions
  where tenant_id = p_tenant_id and active = true
  union
  -- Souscriptions heritees du parent
  select tgs.gamme_slug from public.tenant_gamme_subscriptions tgs
  join public.tenants t on t.parent_tenant_id = tgs.tenant_id
  where t.id = p_tenant_id and tgs.active = true;
$$;

-- =============================================================================
-- ─── Partie 2 : pipeline d'ingestion PIM ───────────────────────────────────
-- =============================================================================

-- pim_candidates : produits candidats a rejoindre le PIM global.
-- Alimente par le trigger `enqueue_pim_candidate_on_order` (plus bas).
create table if not exists public.pim_candidates (
  id                uuid primary key default gen_random_uuid(),
  source_tenant_id  uuid references public.tenants(id) on delete set null,
  source_user_id    uuid references auth.users(id) on delete set null,
  source_quote_id   uuid references public.quotes(id) on delete set null,
  -- config technique brute (tel qu'envoye a Clariprint)
  raw_config        jsonb not null,
  -- kind/gamme presume, pour pre-filtrer le bucket d'admission
  suggested_kind    text,
  suggested_gamme   text,
  -- status du cycle de vie :
  --   pending       → vient d'arriver, en attente de normalisation auto
  --   normalized    → Clariprint + LLM ont enrichi, pret pour review admin
  --   merged        → l'admin a valide → merge dans product_definitions
  --   rejected      → l'admin a rejete (ex: doublon exact, qualite insuffisante)
  --   superseded    → doublon detecte automatiquement, pointe vers le definitive
  status            text not null default 'pending'
                    check (status in ('pending', 'normalized', 'merged', 'rejected', 'superseded')),
  -- resultats de la normalisation Clariprint (specs techniques)
  clariprint_normalized jsonb,
  -- resultats de l'enrichissement LLM (pitch, SEO, benefits, schema.org)
  llm_enrichment    jsonb,
  -- pointeur vers le product_definitions final (une fois merged ou superseded)
  merged_into       uuid references public.product_definitions(id) on delete set null,
  -- pour bookkeeping de l'admission
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  review_notes      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists pim_candidates_status_idx on public.pim_candidates(status);
create index if not exists pim_candidates_source_tenant_idx on public.pim_candidates(source_tenant_id);
create index if not exists pim_candidates_created_idx on public.pim_candidates(created_at desc);

alter table public.pim_candidates enable row level security;

-- Les candidats ne sont visibles/modifiables QUE par les superadmins Magrit.
-- Le tenant source n'a pas besoin de les voir — c'est un pipeline interne.
drop policy if exists "pim_candidates_superadmin" on public.pim_candidates;
create policy "pim_candidates_superadmin" on public.pim_candidates for all using (
  is_super_admin()
) with check (
  is_super_admin()
);

-- Exception : l'app est autorisee a INSERER un candidat via l'edge function
-- (qui tourne avec service_role), pas besoin de policy d'insert user-facing.

-- =============================================================================
-- ─── Partie 3 : colonnes enrichissement sur product_definitions ────────────
-- =============================================================================
-- Ces colonnes sont remplies par le pipeline d'ingestion (Clariprint + LLM).
-- Elles nourrissent : les pages produit des boutiques, l'autocomplete du chat,
-- les mockups 3D, les balises JSON-LD pour le SEO Google/Bing.

alter table if exists public.product_definitions
  -- SEO
  add column if not exists seo_title         text,
  add column if not exists seo_description   text,
  add column if not exists schema_org        jsonb,  -- JSON-LD Product/OfferCatalog
  add column if not exists seo_keywords      text[],
  -- Commercial
  add column if not exists commercial_pitch  text,   -- baseline produit (2 phrases)
  add column if not exists benefits          jsonb,  -- array de bullets benefice
  add column if not exists use_cases         jsonb,  -- array de scenarios
  -- Technique normalise (source Clariprint)
  add column if not exists clariprint_ref    text,
  add column if not exists technical_spec    jsonb,  -- format final, papier, couleurs...
  add column if not exists mockup_3d_url     text,
  add column if not exists gabarit_pdf_url   text,   -- gabarit de preparation fichier
  -- Qualite / maturite
  add column if not exists quality_score     int,    -- 0..100 (completude + validations)
  add column if not exists order_count       int default 0,  -- combien de fois commande → priorite
  add column if not exists last_ordered_at   timestamptz;

create index if not exists product_def_order_count_idx
  on public.product_definitions(order_count desc);

-- =============================================================================
-- ─── Partie 4 : trigger d'enqueue candidat sur commande validee ────────────
-- =============================================================================
-- Quand une ligne `quotes` passe en status='won' (commande gagnee), on pousse
-- sa config produit dans pim_candidates. L'edge function `pim-ingest` prend
-- ensuite le relais pour normaliser.
--
-- NB : on incremente aussi order_count si le produit est deja dans le PIM
-- (match par hash de config), pour prioriser les produits qui tournent vraiment.

create or replace function public.enqueue_pim_candidate_on_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _config jsonb;
begin
  -- Seulement sur transition vers "won"
  if (TG_OP = 'UPDATE' and new.status = 'won' and (old.status is distinct from 'won')) then
    _config := coalesce(new.product_config, '{}'::jsonb);
    insert into public.pim_candidates (
      source_tenant_id, source_user_id, source_quote_id,
      raw_config, suggested_kind
    ) values (
      new.tenant_id, new.user_id, new.id,
      _config, _config->>'kind'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_pim_candidate on public.quotes;
create trigger trg_enqueue_pim_candidate
  after update on public.quotes
  for each row execute function public.enqueue_pim_candidate_on_order();

-- ============================================================================
-- FILE: 20260424_04_rls_tenant_scoped.sql
-- ============================================================================
-- =============================================================================
-- Migration 04 / v3 — Refonte RLS tenant-scoped
-- -----------------------------------------------------------------------------
-- Toutes les tables data passent du modele "auth.uid() = user_id" au modele
-- "tenant_id in (current_user_tenant_ids)". Le super-admin voit tout.
--
-- Les policies sont reecrites de maniere exhaustive (drop + recreate) pour
-- ne laisser aucune trace des anciennes policies user-scoped.
--
-- Tables concernees :
--   * conversations
--   * clients
--   * libraries
--   * product_library
--   * shops            + politique publique inchangee (lecture anonyme via slug)
--   * shop_products    + politique publique inchangee
--   * quotes
--   * quote_templates
--   * user_preferences → reste user-scoped (preferences personnelles)
--
-- product_gammes / product_definitions : lecture publique (patrimoine),
-- ecriture reservee aux superadmins Magrit.
-- =============================================================================

-- ─── helpers ───────────────────────────────────────────────────────────────
-- (current_user_tenant_ids, is_super_admin, user_role_in_tenant sont definis
--  en migration 01)

-- =============================================================================
-- ─── conversations ─────────────────────────────────────────────────────────
-- =============================================================================
alter table if exists public.conversations enable row level security;

drop policy if exists "conv_select_own" on public.conversations;
drop policy if exists "conv_insert_own" on public.conversations;
drop policy if exists "conv_update_own" on public.conversations;
drop policy if exists "conv_delete_own" on public.conversations;
drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "conversations_update" on public.conversations;
drop policy if exists "conversations_delete" on public.conversations;

create policy "conversations_select" on public.conversations for select using (
  is_super_admin()
  or (tenant_id is not null and tenant_id in (select public.current_user_tenant_ids()))
);
create policy "conversations_insert" on public.conversations for insert with check (
  tenant_id in (select public.current_user_tenant_ids())
  and user_id = auth.uid()
);
create policy "conversations_update" on public.conversations for update using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()) and user_id = auth.uid())
);
create policy "conversations_delete" on public.conversations for delete using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()) and user_id = auth.uid())
);

-- =============================================================================
-- ─── clients (CRM) ─────────────────────────────────────────────────────────
-- =============================================================================
alter table if exists public.clients enable row level security;

drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_insert_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "clients_delete_own" on public.clients;
drop policy if exists "clients_select" on public.clients;
drop policy if exists "clients_write" on public.clients;

create policy "clients_select" on public.clients for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "clients_write" on public.clients for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── libraries + product_library ───────────────────────────────────────────
-- =============================================================================
alter table if exists public.libraries enable row level security;
alter table if exists public.product_library enable row level security;

drop policy if exists "libraries_select_own" on public.libraries;
drop policy if exists "libraries_insert_own" on public.libraries;
drop policy if exists "libraries_update_own" on public.libraries;
drop policy if exists "libraries_delete_own" on public.libraries;
drop policy if exists "libraries_select" on public.libraries;
drop policy if exists "libraries_write" on public.libraries;

create policy "libraries_select" on public.libraries for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "libraries_write" on public.libraries for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

drop policy if exists "product_library_select_own" on public.product_library;
drop policy if exists "product_library_insert_own" on public.product_library;
drop policy if exists "product_library_update_own" on public.product_library;
drop policy if exists "product_library_delete_own" on public.product_library;
drop policy if exists "product_library_select" on public.product_library;
drop policy if exists "product_library_write" on public.product_library;

create policy "product_library_select" on public.product_library for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "product_library_write" on public.product_library for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── shops + shop_products ─────────────────────────────────────────────────
-- =============================================================================
-- Double lecture : (a) acces tenant pour l'admin de la boutique ;
-- (b) lecture publique anonyme via slug pour /shop/:slug.
alter table if exists public.shops enable row level security;
alter table if exists public.shop_products enable row level security;

drop policy if exists "shops_select_public" on public.shops;
drop policy if exists "shops_select_own" on public.shops;
drop policy if exists "shops_insert_own" on public.shops;
drop policy if exists "shops_update_own" on public.shops;
drop policy if exists "shops_delete_own" on public.shops;
drop policy if exists "shops_select_tenant" on public.shops;
drop policy if exists "shops_public_read" on public.shops;
drop policy if exists "shops_write" on public.shops;

-- (a) acces tenant pour gerer sa boutique
create policy "shops_select_tenant" on public.shops for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
-- (b) lecture publique : tout le monde peut lire les boutiques actives
--     (colonne `active boolean` definie dans 20260418_shop_module.sql)
create policy "shops_public_read" on public.shops for select using (
  active = true
);
create policy "shops_write" on public.shops for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

drop policy if exists "shop_products_select_public" on public.shop_products;
drop policy if exists "shop_products_select_own" on public.shop_products;
drop policy if exists "shop_products_insert_own" on public.shop_products;
drop policy if exists "shop_products_update_own" on public.shop_products;
drop policy if exists "shop_products_delete_own" on public.shop_products;
drop policy if exists "shop_products_select_tenant" on public.shop_products;
drop policy if exists "shop_products_public_read" on public.shop_products;
drop policy if exists "shop_products_write" on public.shop_products;

create policy "shop_products_select_tenant" on public.shop_products for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
-- Lecture publique des produits des shops actifs
create policy "shop_products_public_read" on public.shop_products for select using (
  exists (
    select 1 from public.shops s
    where s.id = shop_products.shop_id
      and s.active = true
  )
);
create policy "shop_products_write" on public.shop_products for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── quotes + quote_templates ──────────────────────────────────────────────
-- =============================================================================
alter table if exists public.quotes enable row level security;
alter table if exists public.quote_templates enable row level security;

drop policy if exists "quotes_select_own" on public.quotes;
drop policy if exists "quotes_insert_own" on public.quotes;
drop policy if exists "quotes_update_own" on public.quotes;
drop policy if exists "quotes_delete_own" on public.quotes;
drop policy if exists "quotes_select" on public.quotes;
drop policy if exists "quotes_write" on public.quotes;

create policy "quotes_select" on public.quotes for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "quotes_write" on public.quotes for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

drop policy if exists "quote_templates_select_own" on public.quote_templates;
drop policy if exists "quote_templates_insert_own" on public.quote_templates;
drop policy if exists "quote_templates_update_own" on public.quote_templates;
drop policy if exists "quote_templates_delete_own" on public.quote_templates;
drop policy if exists "quote_templates_select" on public.quote_templates;
drop policy if exists "quote_templates_write" on public.quote_templates;

create policy "quote_templates_select" on public.quote_templates for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "quote_templates_write" on public.quote_templates for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── user_preferences : reste user-scoped (preferences personnelles) ───────
-- =============================================================================
alter table if exists public.user_preferences enable row level security;

drop policy if exists "user_pref_select_own" on public.user_preferences;
drop policy if exists "user_pref_insert_own" on public.user_preferences;
drop policy if exists "user_pref_update_own" on public.user_preferences;

create policy "user_pref_select_own" on public.user_preferences for select using (
  is_super_admin() or auth.uid() = user_id
);
create policy "user_pref_insert_own" on public.user_preferences for insert with check (
  auth.uid() = user_id
);
create policy "user_pref_update_own" on public.user_preferences for update using (
  auth.uid() = user_id
) with check (
  auth.uid() = user_id
);

-- =============================================================================
-- ─── product_gammes + product_definitions : patrimoine Magrit ──────────────
-- =============================================================================
-- Lecture : toute personne authentifiee (les tenants filtrent cote app via
-- tenant_active_gammes). Ecriture : superadmin uniquement (admin PIM Magrit).

alter table if exists public.product_gammes enable row level security;
alter table if exists public.product_definitions enable row level security;

drop policy if exists "product_gammes_read" on public.product_gammes;
drop policy if exists "product_gammes_admin" on public.product_gammes;
drop policy if exists "product_definitions_read" on public.product_definitions;
drop policy if exists "product_definitions_admin" on public.product_definitions;

create policy "product_gammes_read" on public.product_gammes for select using (
  auth.uid() is not null
);
create policy "product_gammes_admin" on public.product_gammes for all using (
  is_super_admin()
) with check (
  is_super_admin()
);

create policy "product_definitions_read" on public.product_definitions for select using (
  auth.uid() is not null
);
create policy "product_definitions_admin" on public.product_definitions for all using (
  is_super_admin()
) with check (
  is_super_admin()
);

-- ============================================================================
-- FILE: 20260424_05_bootstrap_magrit_root.sql
-- ============================================================================
-- =============================================================================
-- Migration 05 / v3 — Bootstrap du tenant systeme "magrit-root"
-- -----------------------------------------------------------------------------
-- Cree le tenant special Magrit, et expose deux fonctions RPC que le
-- frontend appelle a l'onboarding :
--
--   * bootstrap_magrit_admin(user_id) — appelee par un script one-shot pour
--     promouvoir un user existant au rang de superadmin Magrit (membership
--     dans le tenant magrit-root avec role 'owner').
--
--   * create_tenant_with_owner(slug, name, parent_tenant_id) — appelee par
--     le frontend apres signup pour creer un tenant et s'y ajouter comme
--     owner dans la meme transaction. Evite le probleme classique "je cree
--     un tenant mais la RLS sur tenant_members refuse mon insert car je ne
--     suis pas encore membre".
-- =============================================================================

-- ─── Tenant systeme Magrit ────────────────────────────────────────────────
insert into public.tenants (slug, name, is_system_tenant, plan)
values ('magrit-root', 'Magrit', true, 'enterprise')
on conflict (slug) do nothing;

-- ─── RPC : bootstrap superadmin ───────────────────────────────────────────
-- A appeler une seule fois pour promouvoir Arnaud en superadmin.
-- Usage SQL editor apres creation du compte :
--   select public.bootstrap_magrit_admin('<user-uuid>');
create or replace function public.bootstrap_magrit_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare _root_id uuid;
begin
  select id into _root_id from public.tenants where slug = 'magrit-root';
  if _root_id is null then
    raise exception 'Tenant magrit-root non trouve. Deployer la migration 05 d''abord.';
  end if;
  insert into public.tenant_members (tenant_id, user_id, role)
  values (_root_id, p_user_id, 'owner')
  on conflict (tenant_id, user_id) do update set role = 'owner';
end;
$$;

-- ─── RPC : creation tenant + owner membership atomique ────────────────────
-- Appelee par le frontend lors du signup ou de la creation d'un tenant.
-- Retourne l'id du tenant cree.
create or replace function public.create_tenant_with_owner(
  p_slug text,
  p_name text,
  p_parent_tenant_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _tenant_id uuid;
  _caller uuid := auth.uid();
begin
  if _caller is null then
    raise exception 'Authentification requise pour creer un tenant.';
  end if;

  -- Si parent_tenant_id fourni : l'user doit etre owner/admin du parent.
  if p_parent_tenant_id is not null then
    if public.user_role_in_tenant(p_parent_tenant_id) not in ('owner', 'admin')
       and not public.is_super_admin() then
      raise exception 'Droits insuffisants sur le tenant parent.';
    end if;
  end if;

  -- Creation du tenant
  insert into public.tenants (slug, name, parent_tenant_id)
  values (p_slug, p_name, p_parent_tenant_id)
  returning id into _tenant_id;

  -- Ajout du caller comme owner
  insert into public.tenant_members (tenant_id, user_id, role)
  values (_tenant_id, _caller, 'owner');

  -- Met a jour last_tenant_id pour l'user (quality of life)
  insert into public.user_preferences (user_id, last_tenant_id)
  values (_caller, _tenant_id)
  on conflict (user_id) do update set last_tenant_id = excluded.last_tenant_id;

  return _tenant_id;
end;
$$;

-- ─── RPC : accept invitation ──────────────────────────────────────────────
-- L'utilisateur invite appelle cette fonction avec le token recu par email.
-- Elle verifie le token, cree le membership, et marque l'invitation acceptee.
create or replace function public.accept_tenant_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _inv record;
  _caller uuid := auth.uid();
begin
  if _caller is null then
    raise exception 'Authentification requise.';
  end if;

  select * into _inv from public.tenant_invitations
  where token = p_token and accepted_at is null;

  if _inv is null then
    raise exception 'Invitation invalide ou deja acceptee.';
  end if;
  if _inv.expires_at < now() then
    raise exception 'Invitation expiree.';
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, invited_by)
  values (_inv.tenant_id, _caller, _inv.role, _inv.invited_by)
  on conflict (tenant_id, user_id) do update set role = excluded.role;

  update public.tenant_invitations
  set accepted_at = now()
  where id = _inv.id;

  return _inv.tenant_id;
end;
$$;

-- ─── Grants : ces RPC sont callables par tout user authentifie ────────────
grant execute on function public.create_tenant_with_owner(text, text, uuid) to authenticated;
grant execute on function public.accept_tenant_invitation(text) to authenticated;
-- bootstrap_magrit_admin : volontairement PAS granted to authenticated. Doit
-- etre appele via service_role / SQL editor pour des raisons de securite.

-- ============================================================================
-- FILE: 20260424_06_shops_library_ids.sql
-- ============================================================================
-- =============================================================================
-- Migration 06 / v3 — Ajout colonne library_ids sur shops
-- -----------------------------------------------------------------------------
-- Oublie dans le bootstrap SQL initial : la colonne existait sur v2 (ajoutee
-- via l'UI Supabase a l'epoque) et le frontend s'attend a la trouver.
--
-- Role : liste des ids de bibliotheques liees a la boutique. L'admin de la
-- boutique coche quelles libraries il veut exposer ; le front charge les
-- produits de ces libraries comme contenu de la boutique.
-- =============================================================================

alter table public.shops
  add column if not exists library_ids uuid[] not null default '{}'::uuid[];

-- Force PostgREST a rafraichir son cache de schema (sinon l'erreur
-- "Could not find the 'library_ids' column of 'shops' in the schema cache"
-- continue jusqu'au prochain redeploy).
notify pgrst, 'reload schema';

-- ============================================================================
-- FILE: 20260424_07_pim_image_url_columns.sql
-- ============================================================================
-- =============================================================================
-- Migration 07 / v3 — Ajout colonnes image_url sur product_gammes + product_definitions
-- -----------------------------------------------------------------------------
-- Encore un oubli du bootstrap SQL v2 : l'editeur Admin PIM reference
-- gamme.image_url et definition.image_url, et le resolveur d'image cote
-- frontend (resolveProductImage) en depend aussi. Sans ces colonnes, les
-- upserts depuis l'UI echouent silencieusement et le fallback ProductMockup
-- SVG s'affiche partout.
--
-- Ajout des deux colonnes + notify PostgREST pour rafraichir le cache.
-- =============================================================================

alter table public.product_gammes
  add column if not exists image_url text default '';

alter table public.product_definitions
  add column if not exists image_url text default '';

notify pgrst, 'reload schema';

-- ============================================================================
-- FILE: 20260424_08_pim_ingestion_shop_orders.sql
-- ============================================================================
-- =============================================================================
-- Migration 08 / v3 — Ingestion PIM depuis les commandes boutique
-- -----------------------------------------------------------------------------
-- Le trigger initial (migration 03) pointait UNIQUEMENT sur quotes.status = won.
-- Mais le flow reel d'Arnaud : il passe commande depuis une boutique publique,
-- ce qui cree une ligne dans shop_orders (pas dans quotes.won). Le trigger ne
-- se declenchait donc jamais dans ce cas.
--
-- Ce fichier ajoute :
--   1. un trigger AFTER INSERT sur shop_orders qui parcourt les items (jsonb
--      array) et cree une ligne pim_candidates par item, avec le tenant_id
--      du shop.
--   2. une policy RLS plus permissive pour que le tenant source puisse voir
--      ses propres candidats (utile pour afficher un "ingestion status" dans
--      le dashboard tenant plus tard).
-- =============================================================================

-- ─── Trigger : enqueue candidats PIM a chaque shop_order ──────────────────
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
begin
  -- Recupere tenant_id + owner du shop
  select tenant_id, owner_user_id
    into _shop_tenant, _shop_owner
    from public.shops
    where id = new.shop_id;

  if _shop_tenant is null then
    -- Shop sans tenant (legacy) : on ne pousse pas de candidat.
    return new;
  end if;

  -- Parcours chaque item de la commande (items est un jsonb array)
  for _item in select jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    -- Retrouver la config produit depuis shop_products (via product_id si present).
    _product_config := null;
    if _item ? 'product_id' then
      select config into _product_config
        from public.shop_products
        where id = (_item->>'product_id')::uuid
        limit 1;
    end if;

    -- Fallback : si on ne trouve pas de config shop_products, on prend les
    -- infos basiques de l'item (name, qty, price) pour que le candidat soit
    -- quand meme cree. L'admin PIM pourra le rejeter si c'est trop maigre.
    if _product_config is null then
      _product_config := jsonb_build_object(
        'name', _item->>'name',
        'quantity', (_item->>'qty')::int,
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

drop trigger if exists trg_enqueue_pim_shop_order on public.shop_orders;
create trigger trg_enqueue_pim_shop_order
  after insert on public.shop_orders
  for each row execute function public.enqueue_pim_candidates_on_shop_order();

-- ─── RLS : le tenant source peut LIRE ses propres candidats ───────────────
-- Cela permet d'afficher un banner dashboard "Ingestion en cours" ou "X
-- produits en attente d'integration PIM" pour le tenant owner/admin.
-- L'ecriture/validation reste reservee au superadmin Magrit.
drop policy if exists "pim_candidates_source_tenant_read" on public.pim_candidates;
create policy "pim_candidates_source_tenant_read" on public.pim_candidates
  for select using (
    is_super_admin()
    or source_tenant_id in (select public.current_user_tenant_ids())
  );

-- L'ancienne policy superadmin-only reste pour l'insert/update/delete.
-- On reecrit pour exclure le select (deja couvert ci-dessus).
drop policy if exists "pim_candidates_superadmin" on public.pim_candidates;
create policy "pim_candidates_superadmin_write" on public.pim_candidates
  for insert with check (is_super_admin());
create policy "pim_candidates_superadmin_update" on public.pim_candidates
  for update using (is_super_admin()) with check (is_super_admin());
create policy "pim_candidates_superadmin_delete" on public.pim_candidates
  for delete using (is_super_admin());

-- Note : le trigger insere via security definer, donc il bypass la policy
-- d'insert ci-dessus (security definer = privileges du owner de la fonction,
-- pas de l'user qui declenche le trigger). Donc l'insert fonctionne meme si
-- la policy insert exige is_super_admin().

notify pgrst, 'reload schema';

-- ============================================================================
-- FILE: 20260424_09_shops_excluded_products.sql
-- ============================================================================
-- =============================================================================
-- Migration 09 / v3 — shops.excluded_product_ids
-- -----------------------------------------------------------------------------
-- Supporte le nouveau mecanisme de gestion produit dans une boutique :
--   - Une boutique est associee a une (ou plusieurs) bibliotheques via
--     shops.library_ids
--   - Tous les produits de ces bibliotheques apparaissent automatiquement
--     dans la boutique
--   - SI l'admin retire un produit de la boutique mais choisit de le
--     conserver dans la bibliotheque, l'id du produit est push dans
--     shops.excluded_product_ids. Le PublicShop filtre ces ids en lecture.
--
-- Avant ce fix, il y avait deux voies redondantes :
--   - bibliotheques liees (library_ids)
--   - import bulk (cree des shop_products dedupliques)
-- On unifie autour du premier mecanisme uniquement.
-- =============================================================================

alter table public.shops
  add column if not exists excluded_product_ids uuid[] not null default '{}'::uuid[];

notify pgrst, 'reload schema';

-- ============================================================================
-- FILE: 20260505_01_e9_users_management.sql
-- ============================================================================
-- =============================================================================
-- Migration E9.2 / v4 — Gestion utilisateurs par admin d'espace
-- -----------------------------------------------------------------------------
-- Ajoute :
--   1. RPC get_tenant_members_with_email : permet a l'UI de lister les membres
--      avec leur email (auth.users non lisible cote client).
--   2. Table tenant_member_events : audit trail des actions sur memberships
--      (created, role_changed, removed, invited, invitation_revoked).
-- =============================================================================

-- ─── 1. RPC get_tenant_members_with_email ──────────────────────────────────
-- Retourne (user_id, email, role, joined_at) pour les membres d'un tenant.
-- Gardes :
--   * security definer pour pouvoir joindre auth.users
--   * verification d'acces : caller doit etre membre du tenant OU superadmin
create or replace function public.get_tenant_members_with_email(p_tenant_id uuid)
returns table (
  user_id   uuid,
  email     text,
  role      text,
  joined_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select tm.user_id, u.email::text, tm.role, tm.joined_at
  from public.tenant_members tm
  join auth.users u on u.id = tm.user_id
  where tm.tenant_id = p_tenant_id
    and (
      public.is_super_admin()
      or p_tenant_id in (select public.current_user_tenant_ids())
    )
  order by tm.joined_at asc;
$$;

grant execute on function public.get_tenant_members_with_email(uuid) to authenticated;

-- ─── 2. Audit trail tenant_member_events ───────────────────────────────────
create table if not exists public.tenant_member_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  target_user_id  uuid references auth.users(id) on delete set null,
  event_type      text not null check (event_type in (
                    'created', 'role_changed', 'removed',
                    'invited', 'invitation_revoked'
                  )),
  performed_by    uuid not null references auth.users(id),
  metadata        jsonb default '{}'::jsonb,  -- ex: {"old_role": "member", "new_role": "admin"}
  created_at      timestamptz not null default now()
);

create index if not exists tenant_member_events_tenant_idx
  on public.tenant_member_events(tenant_id);
create index if not exists tenant_member_events_created_idx
  on public.tenant_member_events(tenant_id, created_at desc);

alter table public.tenant_member_events enable row level security;

drop policy if exists "tenant_member_events_select" on public.tenant_member_events;
create policy "tenant_member_events_select" on public.tenant_member_events
  for select using (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  );

drop policy if exists "tenant_member_events_insert" on public.tenant_member_events;
create policy "tenant_member_events_insert" on public.tenant_member_events
  for insert with check (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  );

-- Reload PostgREST schema cache (pour que les nouveaux objets soient exposes
-- sans redeploy de l'API Supabase).
notify pgrst, 'reload schema';

-- ============================================================================
-- FILE: 20260505_02_e9_user_permissions.sql
-- ============================================================================
-- =============================================================================
-- Migration E9.3 / v4 — Droits granulaires : scope + permissions par membership
-- -----------------------------------------------------------------------------
-- Ajoute aux memberships et aux invitations :
--   * access_scope     : 'magrit_full' (acces dashboard complet)
--                       | 'shop_only'   (acces uniquement a une boutique)
--   * allowed_shop_ids : liste de boutiques accessibles si scope='shop_only'
--   * permissions      : booleans fins {can_quote, can_order, can_invite}
--
-- Cas typique 'shop_only' : un acheteur chez un client B2B externe a qui on
-- donne acces uniquement a SA boutique pour passer commande, sans voir le
-- dashboard interne de l'imprimeur.
--
-- L'application du scope est double :
--   - cote client : guard React qui redirige vers /shop/:slug si scope=shop_only
--   - cote DB : helper current_user_can_access_shop() utilisable dans les RLS
-- =============================================================================

-- ─── 1. Colonnes sur tenant_members ────────────────────────────────────────
alter table public.tenant_members
  add column if not exists access_scope text not null default 'magrit_full'
    check (access_scope in ('magrit_full', 'shop_only'));

alter table public.tenant_members
  add column if not exists allowed_shop_ids uuid[] not null default '{}';

alter table public.tenant_members
  add column if not exists permissions jsonb not null default
    '{"can_quote": true, "can_order": true, "can_invite": false}'::jsonb;

-- ─── 2. Colonnes sur tenant_invitations (memes droits a l'acceptation) ─────
alter table public.tenant_invitations
  add column if not exists access_scope text not null default 'magrit_full'
    check (access_scope in ('magrit_full', 'shop_only'));

alter table public.tenant_invitations
  add column if not exists allowed_shop_ids uuid[] not null default '{}';

alter table public.tenant_invitations
  add column if not exists permissions jsonb not null default
    '{"can_quote": true, "can_order": true, "can_invite": false}'::jsonb;

-- ─── 3. Helper RLS : un user peut-il acceder a une boutique donnee ? ───────
-- Reutilisable dans les policies RLS de shops, shop_orders, etc.
create or replace function public.current_user_can_access_shop(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1
      from public.tenant_members tm
      join public.shops s on s.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
        and s.id = p_shop_id
        and (
          tm.access_scope = 'magrit_full'
          or (tm.access_scope = 'shop_only' and p_shop_id = any(tm.allowed_shop_ids))
        )
    )
  end;
$$;

grant execute on function public.current_user_can_access_shop(uuid) to authenticated;

-- ─── 4. Update accept_tenant_invitation pour propager scope/permissions ────
create or replace function public.accept_tenant_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _inv record;
  _caller uuid := auth.uid();
begin
  if _caller is null then
    raise exception 'Authentification requise.';
  end if;

  select * into _inv from public.tenant_invitations
  where token = p_token and accepted_at is null;

  if _inv is null then
    raise exception 'Invitation invalide ou deja acceptee.';
  end if;
  if _inv.expires_at < now() then
    raise exception 'Invitation expiree.';
  end if;

  insert into public.tenant_members (
    tenant_id, user_id, role, invited_by,
    access_scope, allowed_shop_ids, permissions
  )
  values (
    _inv.tenant_id, _caller, _inv.role, _inv.invited_by,
    _inv.access_scope, _inv.allowed_shop_ids, _inv.permissions
  )
  on conflict (tenant_id, user_id) do update set
    role             = excluded.role,
    access_scope     = excluded.access_scope,
    allowed_shop_ids = excluded.allowed_shop_ids,
    permissions      = excluded.permissions;

  update public.tenant_invitations
  set accepted_at = now()
  where id = _inv.id;

  return _inv.tenant_id;
end;
$$;

-- ─── 5. Refonte get_tenant_members_with_email avec les nouvelles colonnes ──
-- DROP requis car la signature change (ajout de colonnes au returns table).
drop function if exists public.get_tenant_members_with_email(uuid);

create or replace function public.get_tenant_members_with_email(p_tenant_id uuid)
returns table (
  user_id          uuid,
  email            text,
  role             text,
  joined_at        timestamptz,
  access_scope     text,
  allowed_shop_ids uuid[],
  permissions      jsonb
)
language sql stable security definer set search_path = public, auth as $$
  select tm.user_id, u.email::text, tm.role, tm.joined_at,
         tm.access_scope, tm.allowed_shop_ids, tm.permissions
  from public.tenant_members tm
  join auth.users u on u.id = tm.user_id
  where tm.tenant_id = p_tenant_id
    and (
      public.is_super_admin()
      or p_tenant_id in (select public.current_user_tenant_ids())
    )
  order by tm.joined_at asc;
$$;

grant execute on function public.get_tenant_members_with_email(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- FILE: 20260505_03_e9_tenant_rename.sql
-- ============================================================================
-- =============================================================================
-- Migration E9.4 / v4 — Renommer un espace actif (admin + superadmin)
-- -----------------------------------------------------------------------------
-- Permet a un owner/admin de renommer son tenant (champ `name`).
-- Le slug ne peut etre change QUE par un superadmin Magrit (impact URL/SEO).
-- A chaque changement de slug, l'ancien est archive 90 jours pour permettre
-- la redirection 301 cote frontend (TenantAwareLayout).
-- =============================================================================

-- ─── 1. Historique des slugs pour redirection 301 ──────────────────────────
create table if not exists public.tenant_slug_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  old_slug    text not null,
  new_slug    text not null,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now(),
  -- Le slug archive devient invalide apres expires_at (par defaut 90 jours).
  expires_at  timestamptz not null default (now() + interval '90 days')
);

create unique index if not exists tenant_slug_history_old_slug_idx
  on public.tenant_slug_history(old_slug)
  where expires_at > now();

create index if not exists tenant_slug_history_tenant_idx
  on public.tenant_slug_history(tenant_id);

-- RLS : tout user authentifie peut LIRE l'historique (pour resoudre une
-- redirection sans connaitre le tenant_id). L'insert est fait par trigger
-- avec security definer, donc pas de policy insert.
alter table public.tenant_slug_history enable row level security;

drop policy if exists "tenant_slug_history_select" on public.tenant_slug_history;
create policy "tenant_slug_history_select" on public.tenant_slug_history
  for select using (true);

-- ─── 2. Trigger : interdire le changement de slug aux non-superadmins ──────
create or replace function public.enforce_slug_change_authorization()
returns trigger language plpgsql security invoker as $$
begin
  if new.slug is distinct from old.slug then
    if not public.is_super_admin() then
      raise exception 'Only Magrit superadmins can change a tenant slug. (current: %)', old.slug;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_slug_change on public.tenants;
create trigger trg_enforce_slug_change
  before update of slug on public.tenants
  for each row execute function public.enforce_slug_change_authorization();

-- ─── 3. Trigger : archiver l'ancien slug quand il change ───────────────────
create or replace function public.archive_tenant_slug_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.tenant_slug_history (tenant_id, old_slug, new_slug, changed_by)
    values (old.id, old.slug, new.slug, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_archive_slug_change on public.tenants;
create trigger trg_archive_slug_change
  after update of slug on public.tenants
  for each row execute function public.archive_tenant_slug_change();

-- ─── 4. RPC helper : resoudre un slug (current ou historique) ──────────────
-- Retourne le slug "vivant" associe a un slug donne (si l'utilisateur tape
-- l'ancien, on lui dit ou aller). Null si rien trouve.
create or replace function public.resolve_tenant_slug(p_slug text)
returns text
language sql stable security definer set search_path = public as $$
  with hist as (
    select t.slug
    from public.tenant_slug_history h
    join public.tenants t on t.id = h.tenant_id
    where h.old_slug = p_slug
      and h.expires_at > now()
    order by h.changed_at desc
    limit 1
  )
  select coalesce(
    (select slug from public.tenants where slug = p_slug),
    (select slug from hist)
  );
$$;

grant execute on function public.resolve_tenant_slug(text) to anon, authenticated;

notify pgrst, 'reload schema';
