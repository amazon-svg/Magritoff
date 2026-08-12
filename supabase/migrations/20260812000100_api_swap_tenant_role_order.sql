-- AF12.2 — permutation atomique de deux rôles d'un même tenant.
-- SECURITY INVOKER conserve auth.uid() et les policies RLS can_manage_roles.

create or replace function public.api_swap_tenant_role_order(
  p_tenant_id uuid,
  p_first_role_id uuid,
  p_second_role_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  _first_order integer;
  _second_order integer;
  _matched integer;
begin
  if p_first_role_id = p_second_role_id then
    raise exception using errcode = '22023', message = 'Les deux rôles doivent être différents.';
  end if;

  select
    max(ordering_index) filter (where id = p_first_role_id),
    max(ordering_index) filter (where id = p_second_role_id),
    count(*)
  into _first_order, _second_order, _matched
  from public.tenant_role_definitions
  where tenant_id = p_tenant_id
    and id in (p_first_role_id, p_second_role_id)
    and archived_at is null;

  if _matched <> 2 then
    raise exception using errcode = 'P0002', message = 'Rôle introuvable dans cet espace.';
  end if;

  update public.tenant_role_definitions
  set ordering_index = case
    when id = p_first_role_id then _second_order
    else _first_order
  end
  where tenant_id = p_tenant_id
    and id in (p_first_role_id, p_second_role_id)
    and archived_at is null;

  get diagnostics _matched = row_count;
  if _matched <> 2 then
    raise exception using errcode = '42501', message = 'Réordonnancement interdit.';
  end if;
end;
$$;

revoke all on function public.api_swap_tenant_role_order(uuid, uuid, uuid) from public, anon;
grant execute on function public.api_swap_tenant_role_order(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
