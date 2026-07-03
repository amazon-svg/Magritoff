-- =============================================================================
-- Migration S3.2-residual (Sprint 5, 2026-05-23) — Permission can_order honoree
-- par RLS INSERT sur tenant_orders.
--
-- Contexte audit prod 23/05 :
--   - tenant_members.permissions.can_order existe deja (E9.3 migration
--     20260505_02_e9_user_permissions.sql, default true)
--   - MAIS la policy tenant_orders_insert (livree S1.4 migration
--     20260509_01_e1_orders_v1_1.sql) ne verifie QUE :
--       current_user_can_access_shop(shop_id) AND created_by = auth.uid()
--     → un user avec can_order=false dans permissions pouvait toujours
--       INSERT une commande, la permission n'etait pas appliquee cote DB.
--
-- Cette migration :
--   1. Ajoute helper public.user_can_create_order(tenant_id) qui check le flag
--   2. Etend la policy tenant_orders_insert pour appeler ce helper
--
-- Back-compat : default true si la cle n'existe pas dans permissions (defense
-- en profondeur contre les rows historiques sans la cle).
-- =============================================================================

-- ─── 1. Helper RLS : user has can_order=true sur le tenant ? ──────────────
create or replace function public.user_can_create_order(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1
      from public.tenant_members tm
      where tm.user_id = auth.uid()
        and tm.tenant_id = p_tenant_id
        and coalesce((tm.permissions->>'can_order')::boolean, true) = true
    )
  end;
$$;

grant execute on function public.user_can_create_order(uuid) to authenticated;

-- ─── 2. Extension policy INSERT tenant_orders ─────────────────────────────
-- Drop + recreate avec le 3e check sur la permission.
drop policy if exists tenant_orders_insert on public.tenant_orders;

create policy tenant_orders_insert on public.tenant_orders
  for insert with check (
    public.current_user_can_access_shop(shop_id)
    and created_by = auth.uid()
    and public.user_can_create_order(tenant_id)
  );

-- Reload schema cache PostgREST pour que le helper soit visible.
notify pgrst, 'reload schema';
