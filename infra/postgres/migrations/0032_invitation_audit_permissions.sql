drop policy tenant_member_events_insert on public.tenant_member_events;

create policy tenant_member_events_insert on public.tenant_member_events
  for insert with check (
    tenant_id = magrit.current_tenant_id()
    and (
      magrit.actor_has_capability(tenant_id, 'can_manage_members')
      or (
        event_type = 'invitation_revoked'
        and magrit.actor_has_capability(tenant_id, 'can_invite')
      )
    )
  );

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
           or (
             requested_capability='can_invite'
             and m.permissions @> '{"can_invite":true}'::jsonb
           )
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

comment on policy tenant_member_events_insert on public.tenant_member_events is
  'Les gestionnaires de membres journalisent toutes les mutations ; can_invite ne couvre que les révocations d invitations.';
