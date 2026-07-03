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
