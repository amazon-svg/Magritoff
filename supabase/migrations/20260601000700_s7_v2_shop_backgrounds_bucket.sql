-- =============================================================================
-- Migration S-PIM-VISUELS-2 (Sprint 7, 2026-06-01)
--
-- Crée le bucket Storage `shop_backgrounds` pour les uploads utilisateur de
-- fonds personnalisés par boutique.
--
-- Convention chemin : shop_backgrounds/<shop_id>/<uuid>.{jpg,png,webp}
-- Public-read (CDN cache, accès anonyme pour rendu mockup).
-- Write : admin tenant qui possède le shop, validation MIME/poids via
-- l'edge function upload-shop-background (S-PIM-VISUELS-2).
--
-- Limites :
--   - file_size_limit : 5 MB (5_242_880 octets)
--   - allowed_mime_types : image/jpeg, image/png, image/webp
-- =============================================================================

-- Création bucket via insertion dans storage.buckets (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop_backgrounds',
  'shop_backgrounds',
  true, -- public read pour mockup rendering
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- ─── Policies RLS pour storage.objects sur ce bucket ─────────────────────
-- Pattern : convention path = "<shop_id>/<filename>" (premier segment = shop_id).

-- SELECT public read (sinon CDN ne peut pas servir le fond aux navigateurs anon)
drop policy if exists "shop_backgrounds_public_read" on storage.objects;
create policy "shop_backgrounds_public_read" on storage.objects
  for select using (bucket_id = 'shop_backgrounds');

-- INSERT : admin tenant qui possède le shop encodé dans le 1er segment du path
drop policy if exists "shop_backgrounds_upload_owner" on storage.objects;
create policy "shop_backgrounds_upload_owner" on storage.objects
  for insert with check (
    bucket_id = 'shop_backgrounds'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.shops s
        where s.id::text = (storage.foldername(name))[1]
          and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
      )
    )
  );

-- DELETE : idem (cleanup ancien fond après upload nouveau)
drop policy if exists "shop_backgrounds_delete_owner" on storage.objects;
create policy "shop_backgrounds_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'shop_backgrounds'
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
