create function magrit.create_subtenant(
  requested_parent_tenant_id uuid,
  requested_slug text,
  requested_name text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  actor_id uuid := magrit.current_user_id();
  actor_is_super_admin boolean;
  parent_is_root boolean;
  created_tenant_id uuid;
begin
  if actor_id is null then
    return null;
  end if;

  select coalesce(p.is_admin, false)
    into actor_is_super_admin
    from public.user_preferences p
   where p.user_id = actor_id;
  actor_is_super_admin := coalesce(actor_is_super_admin, false);

  select t.parent_tenant_id is null
    into parent_is_root
    from public.tenants t
   where t.id = requested_parent_tenant_id;

  if parent_is_root is not true then
    return null;
  end if;

  if not actor_is_super_admin and not exists (
    select 1
      from public.tenant_members m
     where m.tenant_id = requested_parent_tenant_id
       and m.user_id = actor_id
       and m.role in ('owner', 'admin')
  ) then
    return null;
  end if;

  insert into public.tenants (slug, name, parent_tenant_id, plan)
  values (requested_slug, requested_name, requested_parent_tenant_id, 'freemium')
  returning id into created_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (created_tenant_id, actor_id, 'admin');

  return created_tenant_id;
end
$$;

create function magrit.remove_subtenant(
  requested_parent_tenant_id uuid,
  requested_subtenant_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  actor_id uuid := magrit.current_user_id();
  actor_is_super_admin boolean;
begin
  if actor_id is null then
    return 'permission_denied';
  end if;

  select coalesce(p.is_admin, false)
    into actor_is_super_admin
    from public.user_preferences p
   where p.user_id = actor_id;
  actor_is_super_admin := coalesce(actor_is_super_admin, false);

  if not actor_is_super_admin and not exists (
    select 1
      from public.tenant_members m
     where m.tenant_id = requested_parent_tenant_id
       and m.user_id = actor_id
       and m.role in ('owner', 'admin')
  ) then
    return 'permission_denied';
  end if;

  delete from public.tenants
   where id = requested_subtenant_id
     and parent_tenant_id = requested_parent_tenant_id;

  if not found then
    return 'not_found';
  end if;
  return 'removed';
end
$$;

revoke all on function magrit.create_subtenant(uuid, text, text) from public;
revoke all on function magrit.remove_subtenant(uuid, uuid) from public;
grant execute on function magrit.create_subtenant(uuid, text, text) to magrit_api;
grant execute on function magrit.remove_subtenant(uuid, uuid) to magrit_api;

comment on function magrit.create_subtenant(uuid, text, text) is
  'Creation bornee a un parent racine administre par l acteur.';
comment on function magrit.remove_subtenant(uuid, uuid) is
  'Suppression bornee a un enfant direct du parent administre.';
