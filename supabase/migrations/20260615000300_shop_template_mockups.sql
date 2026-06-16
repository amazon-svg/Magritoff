-- =============================================================================
-- P4-VISUELS — Upload custom de mockups produits per-shop
-- -----------------------------------------------------------------------------
-- Pour chaque boutique (admin tenant), permet d'override le mockup généré
-- par défaut (mockup-generator edge function brandé Magrit) par un fichier
-- custom uploadé. Scope per-shop x template-type (carteVisite/flyer/brochure/
-- etiquette/kakemono) x view (front/back).
--
-- Use case Arnaud 2026-06-15 :
--   "On conserve la possibilité pour le client de charger ses propres images
--    pour que les produits soient personnalisés à sa guise."
--
-- Le fallback est layered :
--   1. shop_template_mockups.mockup_image_url (si défini, custom URL)
--   2. mockup-generator edge function (Magrit-brandé par défaut)
--
-- RLS :
--   - tenant_select / tenant_write : admin tenant gère ses overrides
--   - public_read : portail acheteur anonyme via shops.active=true
-- =============================================================================

-- ─── 1. Table shop_template_mockups ─────────────────────────────────────────
create table if not exists public.shop_template_mockups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  template_type text not null check (template_type in (
    'carteVisite', 'flyer', 'brochure', 'etiquette', 'kakemono',
    -- P15 (2026-06-16) : nouveaux templates ajoutes
    'packaging', 'depliant'
  )),
  view text not null default 'front' check (view in ('front', 'back')),
  mockup_image_url text not null,
  tenant_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unicité : un seul override par couple (shop, template, view)
create unique index if not exists ux_shop_template_mockups_couple
  on public.shop_template_mockups (shop_id, template_type, view);

-- Index lecture frequente par shop (portail acheteur)
create index if not exists ix_shop_template_mockups_shop
  on public.shop_template_mockups (shop_id);
create index if not exists ix_shop_template_mockups_tenant
  on public.shop_template_mockups (tenant_id);

alter table public.shop_template_mockups enable row level security;

drop policy if exists "shop_template_mockups_select_tenant" on public.shop_template_mockups;
drop policy if exists "shop_template_mockups_write" on public.shop_template_mockups;
drop policy if exists "shop_template_mockups_public_read" on public.shop_template_mockups;

create policy "shop_template_mockups_select_tenant"
  on public.shop_template_mockups
  for select using (
    is_super_admin()
    or (tenant_id in (select public.current_user_tenant_ids()))
  );

create policy "shop_template_mockups_write"
  on public.shop_template_mockups
  for all using (
    is_super_admin()
    or (tenant_id in (select public.current_user_tenant_ids()))
  ) with check (
    is_super_admin()
    or (tenant_id in (select public.current_user_tenant_ids()))
  );

-- Lecture publique anonyme pour le portail acheteur (shops actifs uniquement)
create policy "shop_template_mockups_public_read"
  on public.shop_template_mockups
  for select using (
    exists (
      select 1 from public.shops s
      where s.id = shop_template_mockups.shop_id
        and s.active = true
    )
  );

-- ─── 2. Bucket Storage shop_product_mockups ─────────────────────────────────
-- Convention chemin : <shop_id>/<template_type>-<view>.<ext>
-- Mime types : image/png, image/jpeg, image/webp, image/svg+xml
-- Taille max : 5 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop_product_mockups',
  'shop_product_mockups',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- SELECT public read (sinon le portail anonyme ne peut pas servir le mockup)
drop policy if exists "shop_product_mockups_public_read" on storage.objects;
create policy "shop_product_mockups_public_read" on storage.objects
  for select using (bucket_id = 'shop_product_mockups');

-- INSERT : admin tenant du shop dont l'id est dans le 1er segment du path
drop policy if exists "shop_product_mockups_upload_owner" on storage.objects;
create policy "shop_product_mockups_upload_owner" on storage.objects
  for insert with check (
    bucket_id = 'shop_product_mockups'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
      )
    )
  );

-- DELETE : idem (cleanup ancien mockup après upload nouveau)
drop policy if exists "shop_product_mockups_delete_owner" on storage.objects;
create policy "shop_product_mockups_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'shop_product_mockups'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
      )
    )
  );

-- UPDATE : autorisé (replace upload)
drop policy if exists "shop_product_mockups_update_owner" on storage.objects;
create policy "shop_product_mockups_update_owner" on storage.objects
  for update using (
    bucket_id = 'shop_product_mockups'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
      )
    )
  );

notify pgrst, 'reload schema';
