-- =============================================================================
-- Migration S-ORDER-ROLES-3-UI T3 (Sprint 6+, 2026-06-09)
--
-- RPC `get_portal_orders_workflow(p_shop_id, p_tab, p_user_id)` qui retourne
-- les UUIDs des commandes appartenant au tab demandé. Le client query ensuite
-- les détails via `tenant_orders.select(...).in('id', uuids)`. Évite de
-- dupliquer le schéma tenant_orders dans le RETURNS de la RPC et reste
-- compatible avec le système de cohabitation dual-read (shop_orders legacy).
--
-- Tabs supportés (alignés sur PortalOrdersTab helpers TS) :
--   'mine'        — créateur OU rôle Acheteur assigné
--   'to_validate' — draft + can_validate ET ordering_index < MAX
--   'to_approve'  — draft + can_validate ET ordering_index = MAX
--   'to_produce'  — (validated, in_production) + rôle Producteur
--
-- SECURITY INVOKER : repose sur les RLS existantes de tenant_orders pour
-- garantir que le user ne voit que ses propres tenants. Cohérent avec
-- get_portal_orders_counters (migration 20260609000200).
--
-- p_tab invalide ou null → renvoie set vide (pas d'erreur).
-- =============================================================================

create or replace function public.get_portal_orders_workflow(
  p_shop_id uuid,
  p_tab     text,
  p_user_id uuid default auth.uid()
)
returns table (order_id uuid)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_tenant_id uuid;
  v_max_validator_ordering int;
begin
  if p_user_id is null then
    return;
  end if;

  -- Identifie le tenant cible + max ordering_index validateurs
  select s.tenant_id into v_tenant_id
    from public.shops s
   where s.id = p_shop_id;

  if v_tenant_id is null then
    return;
  end if;

  select max(ordering_index) into v_max_validator_ordering
    from public.tenant_role_definitions
   where tenant_id = v_tenant_id
     and archived_at is null
     and coalesce((capabilities->>'can_validate')::boolean, false) = true;

  case p_tab
    when 'mine' then
      return query
      select distinct o.id
        from public.tenant_orders o
       where o.shop_id = p_shop_id
         and (
           o.created_by = p_user_id
           or exists (
             select 1
               from public.tenant_order_roles tor
               join public.tenant_role_definitions trd on trd.id = tor.role_definition_id
              where tor.order_id = o.id
                and tor.user_id = p_user_id
                and tor.revoked_at is null
                and trd.name = 'Acheteur'
                and trd.archived_at is null
           )
         );

    when 'to_validate' then
      return query
      select distinct o.id
        from public.tenant_orders o
        join public.tenant_order_roles tor on tor.order_id = o.id
        join public.tenant_role_definitions trd on trd.id = tor.role_definition_id
       where o.shop_id = p_shop_id
         and o.status = 'draft'
         and tor.user_id = p_user_id
         and tor.revoked_at is null
         and trd.archived_at is null
         and coalesce((trd.capabilities->>'can_validate')::boolean, false) = true
         and (v_max_validator_ordering is null
              or trd.ordering_index < v_max_validator_ordering);

    when 'to_approve' then
      return query
      select distinct o.id
        from public.tenant_orders o
        join public.tenant_order_roles tor on tor.order_id = o.id
        join public.tenant_role_definitions trd on trd.id = tor.role_definition_id
       where o.shop_id = p_shop_id
         and o.status = 'draft'
         and tor.user_id = p_user_id
         and tor.revoked_at is null
         and trd.archived_at is null
         and coalesce((trd.capabilities->>'can_validate')::boolean, false) = true
         and v_max_validator_ordering is not null
         and trd.ordering_index = v_max_validator_ordering;

    when 'to_produce' then
      return query
      select distinct o.id
        from public.tenant_orders o
        join public.tenant_order_roles tor on tor.order_id = o.id
        join public.tenant_role_definitions trd on trd.id = tor.role_definition_id
       where o.shop_id = p_shop_id
         and o.status in ('validated', 'in_production')
         and tor.user_id = p_user_id
         and tor.revoked_at is null
         and trd.name = 'Producteur'
         and trd.archived_at is null;

    else
      return;
  end case;
end;
$$;

grant execute on function public.get_portal_orders_workflow(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';
