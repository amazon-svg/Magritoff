alter table public.tenant_members
  add column access_scope text not null default 'magrit_full',
  add column allowed_shop_ids uuid[] not null default '{}'::uuid[],
  add column permissions jsonb not null default
    '{"can_quote":true,"can_order":true,"can_invite":false}'::jsonb,
  add constraint tenant_members_access_scope_check
    check (access_scope in ('magrit_full', 'shop_only')),
  add constraint tenant_members_permissions_object_check
    check (jsonb_typeof(permissions) = 'object');

create table public.tenant_member_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_user_id uuid references public.app_users(id) on delete set null,
  event_type text not null check (event_type in (
    'role_changed', 'access_changed', 'removed', 'invitation_revoked'
  )),
  performed_by uuid references public.app_users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default clock_timestamp()
);

create index tenant_member_events_tenant_created_idx
  on public.tenant_member_events (tenant_id, created_at desc, id desc);

alter table public.tenant_member_events enable row level security;
alter table public.tenant_member_events force row level security;

create policy tenant_member_events_select on public.tenant_member_events
  for select using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_members')
  );
create policy tenant_member_events_insert on public.tenant_member_events
  for insert with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_members')
  );

create or replace function magrit.actor_has_capability(
  requested_tenant_id uuid,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, magrit
as $$
  select coalesce(
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
    or exists (
      select 1 from public.tenant_members m
       where m.user_id = magrit.current_user_id()
         and m.tenant_id = requested_tenant_id
         and m.role in ('owner', 'admin')
    ),
    false
  ) and requested_capability in (
    'can_manage_pricing',
    'can_manage_notifications',
    'can_manage_production_steps',
    'can_manage_document_templates',
    'can_manage_members'
  )
$$;

grant select, update, delete on table public.tenant_members to magrit_api;
grant select, insert on table public.tenant_member_events to magrit_api;

comment on table public.tenant_member_events is
  'Journal append-only des mutations d appartenance, avec acteur Magrit explicite.';
