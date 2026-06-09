-- =============================================================================
-- Migration S-ORDER-ROLES-3-UI T2-ter (Sprint 6+, 2026-06-09)
--
-- RPC `get_portal_orders_counters(p_shop_id, p_user_id)` qui retourne en
-- un seul round-trip les 4 compteurs des tabs PortalOrders refondu :
--   - mine        : commandes où user = créateur OU rôle 'Acheteur' assigné
--   - to_validate : commandes draft où user a can_validate=true et N'EST PAS
--                   validateur final (ordering_index < MAX can_validate)
--   - to_approve  : commandes draft où user EST validateur final
--                   (ordering_index = MAX can_validate non-archivé)
--   - to_produce  : commandes (validated, in_production) où user a rôle
--                   'Producteur' assigné
--
-- SECURITY INVOKER : la RPC s'appuie sur les RLS existantes pour le filtrage,
-- l'agrégation reste dans le périmètre légitime du user. auth.uid() par défaut
-- si p_user_id null pour appel client direct.
--
-- Spec : `.design-handoff/wireframes/S-ORDER-ROLES-3-portal-orders.md`
-- §Compteurs RPC. Schéma simplifié vs draft Sally (pas de statut
-- 'pending_validation' qui n'existe pas dans l'enum canonique v1.1).
-- =============================================================================

create or replace function public.get_portal_orders_counters(
  p_shop_id uuid,
  p_user_id uuid default auth.uid()
)
returns table (
  mine int,
  to_validate int,
  to_approve int,
  to_produce int
)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_tenant_id uuid;
  v_max_validator_ordering int;
begin
  -- Identifie le tenant cible (RLS shops select garde) + l'ordering_index
  -- max parmi les validateurs non archivés du tenant. Si pas de validateur
  -- final identifié (tenant sans validateur configuré), v_max_validator_ordering
  -- reste null → tab "to_approve" sera vide.
  select s.tenant_id into v_tenant_id
    from public.shops s
   where s.id = p_shop_id;

  if v_tenant_id is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  select max(ordering_index) into v_max_validator_ordering
    from public.tenant_role_definitions
   where tenant_id = v_tenant_id
     and archived_at is null
     and coalesce((capabilities->>'can_validate')::boolean, false) = true;

  return query
  select
    -- mine : créateur OU rôle 'Acheteur' assigné non révoqué
    (select count(*)::int
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
        )
    ),

    -- to_validate : draft + user can_validate via assignment commande
    --   ET (ordering_index < max OU max null) — validateur intermédiaire
    (select count(*)::int
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
             or trd.ordering_index < v_max_validator_ordering)
    ),

    -- to_approve : draft + user can_validate ET ordering_index = max (validateur final)
    (select count(*)::int
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
        and trd.ordering_index = v_max_validator_ordering
    ),

    -- to_produce : (validated, in_production) + rôle 'Producteur' assigné
    (select count(*)::int
       from public.tenant_orders o
       join public.tenant_order_roles tor on tor.order_id = o.id
       join public.tenant_role_definitions trd on trd.id = tor.role_definition_id
      where o.shop_id = p_shop_id
        and o.status in ('validated', 'in_production')
        and tor.user_id = p_user_id
        and tor.revoked_at is null
        and trd.name = 'Producteur'
        and trd.archived_at is null
    );
end;
$$;

grant execute on function public.get_portal_orders_counters(uuid, uuid) to authenticated;

-- Reload schema cache PostgREST
notify pgrst, 'reload schema';
