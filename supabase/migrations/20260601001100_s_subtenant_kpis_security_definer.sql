-- =============================================================================
-- Fix S-SUBTENANT-SCOPE KPIs (Sprint 8, 2026-06-01)
--
-- get_subtenant_kpis en INVOKER bloquait sur RLS tenant_orders_select car
-- l'admin racine n'est pas membre DIRECT des sous-tenants (uniquement
-- hérité via parent). Bascule en SECURITY DEFINER : la garde d'accès est
-- déjà appliquée upstream par get_user_subtenants (qui reste INVOKER et
-- vérifie member_direct OR member_inherited).
--
-- En clair : on ne lit que les commandes des sous-tenants pour lesquels
-- l'user authn a déjà passé le check via get_user_subtenants. Pas de
-- fuite de données possible vers des tenants tiers.
-- =============================================================================

create or replace function public.get_subtenant_kpis(p_parent_tenant_id uuid)
returns table (
  tenant_id          uuid,
  tenant_name        text,
  tenant_slug        text,
  created_at         timestamptz,
  member_count       bigint,
  month_order_count  bigint,
  month_ca_ht        numeric
)
language sql stable security definer set search_path = public as $$
  select
    t.id as tenant_id,
    t.name::text as tenant_name,
    t.slug::text as tenant_slug,
    t.created_at,
    (select count(*) from public.tenant_members tm where tm.tenant_id = t.id) as member_count,
    (select count(*) from public.tenant_orders o
       where o.tenant_id = t.id and o.created_at >= date_trunc('month', now())) as month_order_count,
    (select coalesce(sum(o.total_ht), 0) from public.tenant_orders o
       where o.tenant_id = t.id and o.created_at >= date_trunc('month', now())) as month_ca_ht
  from public.get_user_subtenants(p_parent_tenant_id) t
  order by t.name;
$$;
grant execute on function public.get_subtenant_kpis(uuid) to authenticated;

notify pgrst, 'reload schema';
