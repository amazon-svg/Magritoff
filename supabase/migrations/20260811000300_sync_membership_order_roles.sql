-- AF5.1 correctif UX — synchronise les memberships owner/admin avec les
-- rôles fonctionnels utilisés par user_has_capability.

create or replace function public.sync_membership_functional_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_role_name text;
  v_role_definition_id uuid;
begin
  v_expected_role_name := case
    when new.role = 'owner' then 'Owner'
    when new.role = 'admin' then 'Admin'
    else null
  end;

  -- Une promotion/dégradation ne doit pas laisser un ancien rôle privilégié actif.
  update public.tenant_role_assignments assignment
     set revoked_at = now(), revoked_by = auth.uid()
    from public.tenant_role_definitions definition
   where assignment.role_definition_id = definition.id
     and assignment.user_id = new.user_id
     and assignment.revoked_at is null
     and definition.tenant_id = new.tenant_id
     and definition.name in ('Owner', 'Admin')
     and (v_expected_role_name is null or definition.name <> v_expected_role_name);

  if v_expected_role_name is null then
    return new;
  end if;

  select id into v_role_definition_id
    from public.tenant_role_definitions
   where tenant_id = new.tenant_id
     and name = v_expected_role_name
     and archived_at is null
   limit 1;

  if v_role_definition_id is not null and not exists (
    select 1
      from public.tenant_role_assignments
     where role_definition_id = v_role_definition_id
       and user_id = new.user_id
       and revoked_at is null
  ) then
    insert into public.tenant_role_assignments
      (role_definition_id, user_id, assigned_by)
    values
      (v_role_definition_id, new.user_id, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_membership_functional_role on public.tenant_members;
create trigger trg_sync_membership_functional_role
  after insert or update of role on public.tenant_members
  for each row execute function public.sync_membership_functional_role();

-- Backfill des espaces déjà créés. Le trigger n'existait pas lors de leur INSERT.
insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
select definition.id, member.user_id, member.user_id
  from public.tenant_members member
  join public.tenant_role_definitions definition
    on definition.tenant_id = member.tenant_id
   and definition.name = case member.role when 'owner' then 'Owner' when 'admin' then 'Admin' end
   and definition.archived_at is null
 where member.role in ('owner', 'admin')
   and not exists (
     select 1
       from public.tenant_role_assignments assignment
      where assignment.role_definition_id = definition.id
        and assignment.user_id = member.user_id
        and assignment.revoked_at is null
   );

notify pgrst, 'reload schema';
