-- UM8.3 — Séparer le catalogue de rôles Magrit du rôle Acheteur historique.
--
-- Le rôle canonique Acheteur reste physiquement présent pour préserver les
-- audits et les reprises UM7, mais il ne peut plus être attribué à une
-- identité Magrit ni propagé par une invitation tenant.

alter table public.tenant_role_definitions
  add column if not exists identity_context text not null default 'magrit';

alter table public.tenant_role_definitions
  drop constraint if exists tenant_role_definitions_identity_context_check;
alter table public.tenant_role_definitions
  add constraint tenant_role_definitions_identity_context_check
  check (identity_context in ('magrit', 'storefront_legacy'));

update public.tenant_role_definitions
   set identity_context = 'storefront_legacy'
 where name = 'Acheteur';

create or replace function public.classify_tenant_role_identity_context()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name = 'Acheteur' then
    new.identity_context := 'storefront_legacy';
  elsif new.identity_context is null then
    new.identity_context := 'magrit';
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_role_definitions_classify_identity_context
  on public.tenant_role_definitions;
create trigger tenant_role_definitions_classify_identity_context
before insert or update of name, identity_context
on public.tenant_role_definitions
for each row execute function public.classify_tenant_role_identity_context();

create or replace function public.enforce_magrit_role_assignment_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_context text;
begin
  if new.revoked_at is not null then
    return new;
  end if;

  select identity_context into v_context
    from public.tenant_role_definitions
   where id = new.role_definition_id;

  if v_context is distinct from 'magrit' then
    raise exception 'role_identity_context_mismatch: storefront roles cannot be assigned to Magrit users';
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_role_assignments_enforce_identity_context
  on public.tenant_role_assignments;
create trigger tenant_role_assignments_enforce_identity_context
before insert or update of role_definition_id, revoked_at
on public.tenant_role_assignments
for each row execute function public.enforce_magrit_role_assignment_context();

create or replace function public.enforce_magrit_invitation_role_context()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
      from unnest(coalesce(new.pending_role_ids, '{}')) role_id
      left join public.tenant_role_definitions definition on definition.id = role_id
     where definition.id is null
        or definition.tenant_id <> new.tenant_id
        or definition.identity_context <> 'magrit'
  ) then
    raise exception 'role_identity_context_mismatch: storefront roles cannot be propagated to Magrit users';
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_invitations_enforce_role_identity_context
  on public.tenant_invitations;
create trigger tenant_invitations_enforce_role_identity_context
before insert or update of tenant_id, pending_role_ids
on public.tenant_invitations
for each row execute function public.enforce_magrit_invitation_role_context();

comment on column public.tenant_role_definitions.identity_context is
  'UM8: magrit pour les rôles équipe ; storefront_legacy pour Acheteur conservé uniquement en transition.';

notify pgrst, 'reload schema';
