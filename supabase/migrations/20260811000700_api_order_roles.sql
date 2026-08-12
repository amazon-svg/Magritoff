-- AF6.2 / AF7 — capacités et rôles Orders exposés sans lecture table front.

create or replace function public.api_get_tenant_order_roles(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_actor uuid := auth.uid();
  v_created_by uuid;
  v_shop_id uuid;
  v_roles jsonb;
  v_caps jsonb := '{
    "can_quote": false,
    "can_order": false,
    "can_invite": false,
    "can_validate": false,
    "can_cancel": false,
    "can_modify": false,
    "can_export": false,
    "can_manage_catalog": false,
    "can_manage_roles": false
  }'::jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select created_by, shop_id into v_created_by, v_shop_id
    from public.tenant_orders
   where id = p_order_id;
  if v_shop_id is null or not public.current_user_can_access_shop(v_shop_id) then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', assignments.id,
    'role_definition_id', definitions.id,
    'name', definitions.name,
    'capabilities', definitions.capabilities,
    'notify_policy', definitions.notify_policy,
    'ordering_index', definitions.ordering_index
  ) order by definitions.ordering_index), '[]'::jsonb)
  into v_roles
  from public.tenant_order_roles assignments
  join public.tenant_role_definitions definitions
    on definitions.id = assignments.role_definition_id
   and definitions.archived_at is null
  where assignments.order_id = p_order_id
    and assignments.user_id = v_actor
    and assignments.revoked_at is null;

  select v_caps || coalesce(jsonb_object_agg(capability.key, true), '{}'::jsonb)
  into v_caps
  from public.tenant_order_roles assignments
  join public.tenant_role_definitions definitions
    on definitions.id = assignments.role_definition_id
   and definitions.archived_at is null
  cross join lateral jsonb_each_text(definitions.capabilities) capability
  where assignments.order_id = p_order_id
    and assignments.user_id = v_actor
    and assignments.revoked_at is null
    and capability.value = 'true';

  return jsonb_build_object(
    'roles', v_roles,
    'capabilities', v_caps,
    'is_creator', v_created_by = v_actor
  );
end;
$$;

grant execute on function public.api_get_tenant_order_roles(uuid) to authenticated;
notify pgrst, 'reload schema';
