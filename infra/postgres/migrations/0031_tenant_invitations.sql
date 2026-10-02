create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  invited_by uuid references public.app_users(id) on delete set null,
  access_scope text not null default 'magrit_full'
    check (access_scope in ('magrit_full', 'shop_only')),
  allowed_shop_ids uuid[] not null default '{}'::uuid[],
  permissions jsonb not null default
    '{"can_quote":true,"can_order":true,"can_invite":false}'::jsonb
    check (jsonb_typeof(permissions) = 'object'),
  pending_role_ids uuid[] not null default '{}'::uuid[],
  accepted_at timestamptz,
  accepted_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  constraint tenant_invitations_email_normalized check (
    email = lower(btrim(email)) and char_length(email) between 3 and 320
  )
);

create unique index tenant_invitations_pending_email_uidx
  on public.tenant_invitations (tenant_id, email)
  where accepted_at is null;
create index tenant_invitations_tenant_created_idx
  on public.tenant_invitations (tenant_id, created_at desc, id desc);

-- Cette table n'est jamais exposee directement. Le serveur applicatif effectue
-- les controles d'acteur avant mutation et ne conserve que le condensat du
-- jeton. L'acceptation, qui doit franchir les politiques des tables membres et
-- roles, passe par la fonction security definer bornee ci-dessous.
grant select, insert, update, delete on public.tenant_invitations to magrit_api;

create or replace function magrit.accept_tenant_invitation(requested_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  invitation public.tenant_invitations%rowtype;
  actor_id uuid := magrit.current_user_id();
  actor_email text;
  role_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'invitation_authentication_required';
  end if;

  select * into invitation
    from public.tenant_invitations
   where token_hash = requested_token_hash
   for update;

  if invitation.id is null then
    raise exception using errcode = '22023', message = 'invitation_invalid';
  end if;

  select email_normalized into actor_email
    from public.app_users
   where id = actor_id and status = 'active';

  if actor_email is null or actor_email <> invitation.email then
    raise exception using errcode = '22023', message = 'invitation_email_mismatch';
  end if;

  if invitation.accepted_at is not null then
    if invitation.accepted_by = actor_id then return invitation.tenant_id; end if;
    raise exception using errcode = '22023', message = 'invitation_invalid';
  end if;
  if invitation.expires_at <= clock_timestamp() then
    raise exception using errcode = '22023', message = 'invitation_expired';
  end if;

  insert into public.tenant_members (
    tenant_id, user_id, role, invited_by,
    access_scope, allowed_shop_ids, permissions
  ) values (
    invitation.tenant_id, actor_id, invitation.role, invitation.invited_by,
    invitation.access_scope, invitation.allowed_shop_ids, invitation.permissions
  );

  foreach role_id in array invitation.pending_role_ids loop
    insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
    select definition.id, actor_id, invitation.invited_by
      from public.tenant_role_definitions definition
     where definition.id = role_id
       and definition.tenant_id = invitation.tenant_id
       and definition.identity_context = 'magrit'
       and definition.system_key in ('option_shops', 'option_orders')
       and definition.archived_at is null;
  end loop;

  update public.tenant_invitations
     set accepted_at = clock_timestamp(), accepted_by = actor_id
   where id = invitation.id;

  return invitation.tenant_id;
exception
  when unique_violation then
    if exists (
      select 1 from public.tenant_members
       where tenant_id = invitation.tenant_id and user_id = actor_id
    ) then
      raise exception using errcode = '23505', message = 'invitation_already_member';
    end if;
    raise;
end
$$;

revoke all on function magrit.accept_tenant_invitation(text) from public;
grant execute on function magrit.accept_tenant_invitation(text) to magrit_api;

create or replace function magrit.actor_has_capability(
  requested_tenant_id uuid,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,magrit
as $$
  select (
    requested_capability = any(array[
      'can_manage_pricing','can_manage_notifications','can_manage_production_steps',
      'can_manage_document_templates','can_manage_members','can_invite'
    ]::text[])
    or exists (
      select 1 from public.tenant_role_definitions known
       where known.tenant_id=requested_tenant_id
         and known.archived_at is null
         and known.capabilities ? requested_capability
    )
  ) and coalesce(
    exists (
      select 1 from public.user_preferences p
       where p.user_id=magrit.current_user_id() and p.is_admin
    )
    or exists (
      select 1 from public.tenant_members m
       where m.user_id=magrit.current_user_id()
         and m.tenant_id=requested_tenant_id
         and (
           m.role in ('owner','admin')
           or coalesce((m.permissions->>'can_invite')::boolean,false)
         )
    )
    or exists (
      select 1
        from public.tenant_role_assignments a
        join public.tenant_role_definitions d on d.id=a.role_definition_id
       where a.user_id=magrit.current_user_id()
         and a.revoked_at is null
         and d.archived_at is null
         and d.tenant_id=requested_tenant_id
         and d.capabilities @> jsonb_build_object(requested_capability,true)
    ),
    false
  )
$$;

comment on table public.tenant_invitations is
  'Invitations Magrit portables. Seul le SHA-256 du jeton opaque est conserve.';
