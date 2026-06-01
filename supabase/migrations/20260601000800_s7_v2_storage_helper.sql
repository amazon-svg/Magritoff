-- =============================================================================
-- Migration S-PIM-VISUELS-2 patch (Sprint 7, 2026-06-01)
--
-- Helper SECURITY DEFINER user_can_manage_shop_assets(shop_id) qui :
--   - Bypass la RLS shops_select_tenant pour le check policy storage
--   - Vérifie can_manage_catalog sur le tenant qui possède le shop
--
-- Sans ça, la sub-query "select 1 from shops s where s.id = ..."
-- intégrée dans la policy storage.objects est évaluée sous le RLS
-- shops_select_tenant qui exige tenant member — fonctionne pour les
-- members mais parfois renvoie 0 selon le contexte d'évaluation Supabase
-- Storage. Le helper SECURITY DEFINER élimine cette dépendance.
-- =============================================================================

create or replace function public.user_can_manage_shop_assets(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1 from public.shops s
      where s.id = p_shop_id
        and public.user_has_capability(s.tenant_id, 'can_manage_catalog')
    )
  end;
$$;

grant execute on function public.user_can_manage_shop_assets(uuid) to authenticated, anon;

-- Re-définit les policies storage.objects en utilisant le helper
drop policy if exists "shop_backgrounds_upload_owner" on storage.objects;
create policy "shop_backgrounds_upload_owner" on storage.objects
  for insert with check (
    bucket_id = 'shop_backgrounds'
    and public.user_can_manage_shop_assets(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "shop_backgrounds_delete_owner" on storage.objects;
create policy "shop_backgrounds_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'shop_backgrounds'
    and public.user_can_manage_shop_assets(((storage.foldername(name))[1])::uuid)
  );

notify pgrst, 'reload schema';
