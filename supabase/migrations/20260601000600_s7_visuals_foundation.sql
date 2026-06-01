-- =============================================================================
-- Migration S-PIM-VISUELS-1 + -3 fondations (Sprint 7, 2026-06-01)
--
-- Pose les fondations DB de la couche "visuels boutique" :
--   - magrit_background_library : catalog public 10 fonds pré-conçus
--   - shop_visual_preferences : 1 row par boutique (fond + primary color)
--   - shop_gamme_visual_preferences : override par gamme dans la boutique
--   - helper SQL resolve_shop_background(shop_id, gamme_slug) avec cascade
--     gamme → shop → default Magrit
--
-- Pivot 2026-05-21 (vault) : visuels shop-scoped (vs tenant initial). Une
-- boutique = une identité visuelle B2B (espace ERAM, franchise, etc.).
--
-- ADR §4.13 (à formaliser) : "Composition 3 layers shop-scoped pour mockup
-- engine" — couvre cette migration + S-PIM-VISUELS-5 (refonte mockup-gen).
-- =============================================================================

-- ─── 1. magrit_background_library : catalog public ───────────────────────
-- Sert de réserve initiale Magrit (10 fonds curatés Sally). Les shops
-- peuvent SELECT pour sélectionner un fond catalogue, ou uploader leur
-- propre fichier (S-PIM-VISUELS-2 — bucket shop_backgrounds).
create table if not exists public.magrit_background_library (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text not null default '',
  /** URL publique du fond (Supabase Storage public OU CDN externe). */
  url             text not null,
  /** URL miniature pour UI sélecteur (peut être identique à url si pas optimisée). */
  thumbnail_url   text null,
  /** Tags pour catégorisation UI (kraft, marble, desk, hands, etc.). */
  tags            text[] not null default '{}',
  ordering_index  int not null default 0,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz null
);
create index if not exists magrit_background_library_active_idx
  on public.magrit_background_library (ordering_index)
  where archived_at is null;

alter table public.magrit_background_library enable row level security;

-- SELECT public (catalog visible à tous, même non authentifiés pour preview)
drop policy if exists magrit_background_library_select on public.magrit_background_library;
create policy magrit_background_library_select on public.magrit_background_library
  for select using (true);

-- INSERT/UPDATE/DELETE super_admin only (gestion catalog par Magrit)
drop policy if exists magrit_background_library_write on public.magrit_background_library;
create policy magrit_background_library_write on public.magrit_background_library
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── 2. shop_visual_preferences : 1 row par boutique ─────────────────────
create table if not exists public.shop_visual_preferences (
  id                       uuid primary key default gen_random_uuid(),
  shop_id                  uuid not null unique references public.shops(id) on delete cascade,
  /** URL du fond actif (résolue depuis library_id OU upload_url). */
  background_url           text null,
  /** Source du fond : 'default' (= null/biblio Magrit fallback), 'library' (= magrit_background_library row), 'upload' (= shop_backgrounds bucket). */
  background_source        text not null default 'default'
    check (background_source in ('default', 'library', 'upload')),
  /** Si source='library', réf vers magrit_background_library (FK SET NULL si archive). */
  background_library_id    uuid null references public.magrit_background_library(id) on delete set null,
  /** Couleur primaire shop (override defaut #1e3a8a). Utilisée dans templates SVG (--shop-primary). */
  primary_color            text not null default '#1e3a8a',
  updated_at               timestamptz not null default now(),
  updated_by               uuid null references auth.users(id) on delete set null
);
create index if not exists shop_visual_preferences_shop_idx
  on public.shop_visual_preferences (shop_id);

alter table public.shop_visual_preferences enable row level security;

-- SELECT public read (rendu mockup boutique anonyme = catalog visible)
drop policy if exists shop_visual_preferences_select on public.shop_visual_preferences;
create policy shop_visual_preferences_select on public.shop_visual_preferences
  for select using (true);

-- INSERT/UPDATE/DELETE : tenant member admin avec can_manage_catalog
drop policy if exists shop_visual_preferences_write on public.shop_visual_preferences;
create policy shop_visual_preferences_write on public.shop_visual_preferences
  for all using (
    public.is_super_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id
        and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
    )
  ) with check (
    public.is_super_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id
        and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
    )
  );

-- ─── 3. shop_gamme_visual_preferences : override par gamme ───────────────
create table if not exists public.shop_gamme_visual_preferences (
  id                       uuid primary key default gen_random_uuid(),
  shop_id                  uuid not null references public.shops(id) on delete cascade,
  /** Slug gamme (réf product_gammes.slug, pas de FK pour cohérence shared catalog). */
  gamme_slug               text not null,
  background_url           text null,
  background_source        text not null default 'default'
    check (background_source in ('default', 'library', 'upload')),
  background_library_id    uuid null references public.magrit_background_library(id) on delete set null,
  /** Couleur primaire override (null = hérite shop.primary_color). */
  primary_color            text null,
  updated_at               timestamptz not null default now(),
  updated_by               uuid null references auth.users(id) on delete set null,
  unique (shop_id, gamme_slug)
);
create index if not exists shop_gamme_visual_preferences_shop_idx
  on public.shop_gamme_visual_preferences (shop_id);

alter table public.shop_gamme_visual_preferences enable row level security;

drop policy if exists shop_gamme_visual_preferences_select on public.shop_gamme_visual_preferences;
create policy shop_gamme_visual_preferences_select on public.shop_gamme_visual_preferences
  for select using (true);

drop policy if exists shop_gamme_visual_preferences_write on public.shop_gamme_visual_preferences;
create policy shop_gamme_visual_preferences_write on public.shop_gamme_visual_preferences
  for all using (
    public.is_super_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id
        and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
    )
  ) with check (
    public.is_super_admin()
    or exists (
      select 1 from public.shops s
      where s.id = shop_id
        and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
    )
  );

-- ─── 4. Helper SQL resolve_shop_background ───────────────────────────────
-- Cascade : gamme preference > shop preference > default Magrit.
-- Retourne 1 row avec background_url + primary_color + source.
create or replace function public.resolve_shop_background(
  p_shop_id uuid,
  p_gamme_slug text
)
returns table (
  background_url text,
  primary_color  text,
  source         text
)
language sql stable security invoker set search_path = public as $$
  with gamme_pref as (
    select sgvp.background_url, sgvp.primary_color
    from public.shop_gamme_visual_preferences sgvp
    where sgvp.shop_id = p_shop_id
      and sgvp.gamme_slug = p_gamme_slug
    limit 1
  ),
  shop_pref as (
    select svp.background_url, svp.primary_color
    from public.shop_visual_preferences svp
    where svp.shop_id = p_shop_id
    limit 1
  )
  select
    coalesce(
      (select background_url from gamme_pref where background_url is not null),
      (select background_url from shop_pref where background_url is not null),
      null
    ) as background_url,
    coalesce(
      (select primary_color from gamme_pref where primary_color is not null),
      (select primary_color from shop_pref where primary_color is not null),
      '#1e3a8a'
    ) as primary_color,
    case
      when exists (select 1 from gamme_pref where background_url is not null) then 'gamme'
      when exists (select 1 from shop_pref where background_url is not null) then 'shop'
      else 'default'
    end as source;
$$;

grant execute on function public.resolve_shop_background(uuid, text) to anon, authenticated;

-- ─── 5. Seed magrit_background_library : 10 fonds pré-conçus ─────────────
-- Sources Unsplash libres de droits (Public Domain via Unsplash license).
-- Sally curation : photos B2B print friendly (desk wood, marble, kraft,
-- hands holding card, minimal gradient, blueprint, paper texture, etc.).
-- URLs format Unsplash + paramètre w=1024 pour résolution mockup-friendly.
-- thumbnail_url = même URL avec w=200 pour UI sélecteur compact.

insert into public.magrit_background_library (name, description, url, thumbnail_url, tags, ordering_index) values
  ('Desk wood', 'Plan de travail bois clair — accueil chaleureux B2B',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=200&fit=crop',
    array['desk', 'wood', 'warm'], 10),
  ('Marble blanc', 'Marbre blanc texturé — élégance minimaliste',
    'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?w=200&fit=crop',
    array['marble', 'white', 'elegant'], 20),
  ('Kraft texture', 'Papier kraft brut — artisanal',
    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=200&fit=crop',
    array['kraft', 'paper', 'craft'], 30),
  ('Hands holding card', 'Mains présentant un produit — humain',
    'https://images.unsplash.com/photo-1556742393-d75f468bfcb0?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1556742393-d75f468bfcb0?w=200&fit=crop',
    array['hands', 'human', 'presentation'], 40),
  ('Minimal gradient', 'Gradient minimaliste neutre',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=200&fit=crop',
    array['gradient', 'minimal', 'neutral'], 50),
  ('Blueprint architecte', 'Plan architecte — technique professionnel',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&fit=crop',
    array['blueprint', 'technical', 'architect'], 60),
  ('Paper texture beige', 'Texture papier beige naturel',
    'https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?w=200&fit=crop',
    array['paper', 'beige', 'natural'], 70),
  ('Workspace moderne', 'Espace de travail moderne minimaliste',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&fit=crop',
    array['workspace', 'office', 'modern'], 80),
  ('Concrete gris', 'Béton gris industriel',
    'https://images.unsplash.com/photo-1517511620798-cec17d428bc0?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1517511620798-cec17d428bc0?w=200&fit=crop',
    array['concrete', 'industrial', 'grey'], 90),
  ('Linen blanc cassé', 'Tissu lin blanc cassé — doux artisanal',
    'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=1024&fit=crop',
    'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=200&fit=crop',
    array['linen', 'fabric', 'soft'], 100)
on conflict do nothing;

notify pgrst, 'reload schema';
