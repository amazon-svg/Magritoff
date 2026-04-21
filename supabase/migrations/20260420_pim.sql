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
