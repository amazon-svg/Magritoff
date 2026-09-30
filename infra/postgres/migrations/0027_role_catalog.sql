create table public.shops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_user_id uuid not null references public.app_users(id) on delete restrict,
  slug text not null unique,
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index shops_tenant_idx on public.shops (tenant_id) where deleted_at is null;

create table public.tenant_role_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 50),
  description text not null default '' check (char_length(description) <= 500),
  capabilities jsonb not null check (jsonb_typeof(capabilities)='object'),
  notify_policy text not null default 'chain_next' check (notify_policy in ('chain_next','all_roles','none')),
  scope text not null default 'tenant' check (scope in ('tenant','shop')),
  scope_shop_id uuid references public.shops(id) on delete restrict,
  ordering_index integer not null default 0,
  system_key text,
  identity_context text not null default 'magrit' check (identity_context='magrit'),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references public.app_users(id) on delete set null,
  archived_at timestamptz,
  constraint tenant_role_scope_check check (
    (scope='tenant' and scope_shop_id is null) or (scope='shop' and scope_shop_id is not null)
  )
);
create unique index tenant_role_name_uidx on public.tenant_role_definitions (tenant_id,lower(btrim(name)));
create unique index tenant_role_system_key_uidx on public.tenant_role_definitions (tenant_id,system_key) where system_key is not null;
create index tenant_role_active_idx on public.tenant_role_definitions (tenant_id,ordering_index,id) where archived_at is null;

create table public.tenant_role_assignments (
  id uuid primary key default gen_random_uuid(),
  role_definition_id uuid not null references public.tenant_role_definitions(id) on delete restrict,
  user_id uuid not null references public.app_users(id) on delete cascade,
  assigned_at timestamptz not null default clock_timestamp(),
  assigned_by uuid references public.app_users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete set null
);
create unique index tenant_role_assignment_active_uidx
  on public.tenant_role_assignments (role_definition_id,user_id) where revoked_at is null;
create index tenant_role_assignment_user_idx on public.tenant_role_assignments (user_id) where revoked_at is null;

create function magrit.assert_role_shop_tenant()
returns trigger language plpgsql as $$
begin
  if new.scope_shop_id is not null and not exists (
    select 1 from public.shops s where s.id=new.scope_shop_id and s.tenant_id=new.tenant_id and s.deleted_at is null
  ) then
    raise exception using errcode='23514',message='role_scope_shop_tenant_mismatch';
  end if;
  return new;
end $$;
create trigger tenant_role_shop_tenant before insert or update on public.tenant_role_definitions
for each row execute function magrit.assert_role_shop_tenant();

create function magrit.assert_role_assignment_member()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.tenant_role_definitions d join public.tenant_members m on m.tenant_id=d.tenant_id
     where d.id=new.role_definition_id and m.user_id=new.user_id and d.archived_at is null
  ) then raise exception using errcode='23514',message='role_assignment_member_mismatch'; end if;
  return new;
end $$;
create trigger tenant_role_assignment_member before insert or update on public.tenant_role_assignments
for each row execute function magrit.assert_role_assignment_member();

insert into public.tenant_role_definitions
  (tenant_id,name,description,capabilities,ordering_index,notify_policy,scope,system_key)
select id,'Boutiques','Créer des boutiques et administrer les siennes','{"can_manage_shops":true}'::jsonb,10,'none','tenant','option_shops'
from public.tenants
union all
select id,'Commandes','Administrer les commandes','{"can_validate":true,"can_modify":true,"can_cancel":true,"can_export":true}'::jsonb,20,'none','tenant','option_orders'
from public.tenants;

create function magrit.seed_tenant_roles()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  insert into public.tenant_role_definitions
    (tenant_id,name,description,capabilities,ordering_index,notify_policy,scope,system_key)
  values
    (new.id,'Boutiques','Créer des boutiques et administrer les siennes','{"can_manage_shops":true}',10,'none','tenant','option_shops'),
    (new.id,'Commandes','Administrer les commandes','{"can_validate":true,"can_modify":true,"can_cancel":true,"can_export":true}',20,'none','tenant','option_orders');
  return new;
end $$;
create trigger tenants_seed_roles after insert on public.tenants for each row execute function magrit.seed_tenant_roles();

create or replace function magrit.actor_has_capability(requested_tenant_id uuid,requested_capability text)
returns boolean language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select coalesce(
    exists (select 1 from public.user_preferences p where p.user_id=magrit.current_user_id() and p.is_admin)
    or exists (select 1 from public.tenant_members m where m.user_id=magrit.current_user_id() and m.tenant_id=requested_tenant_id and m.role in ('owner','admin'))
    or exists (
      select 1 from public.tenant_role_assignments a
      join public.tenant_role_definitions d on d.id=a.role_definition_id
      where a.user_id=magrit.current_user_id() and a.revoked_at is null and d.archived_at is null
        and d.tenant_id=requested_tenant_id and coalesce((d.capabilities->>requested_capability)::boolean,false)
    ),false)
$$;

alter table public.shops enable row level security; alter table public.shops force row level security;
alter table public.tenant_role_definitions enable row level security; alter table public.tenant_role_definitions force row level security;
alter table public.tenant_role_assignments enable row level security; alter table public.tenant_role_assignments force row level security;
create policy shops_select on public.shops for select using (tenant_id=magrit.current_tenant_id());
create policy roles_select on public.tenant_role_definitions for select using (tenant_id=magrit.current_tenant_id());
create policy roles_write on public.tenant_role_definitions for all using (tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_members')) with check (tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_members'));
create policy assignments_select on public.tenant_role_assignments for select using (exists (select 1 from public.tenant_role_definitions d where d.id=role_definition_id and d.tenant_id=magrit.current_tenant_id()));
create policy assignments_write on public.tenant_role_assignments for all using (exists (select 1 from public.tenant_role_definitions d where d.id=role_definition_id and d.tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(d.tenant_id,'can_manage_members'))) with check (exists (select 1 from public.tenant_role_definitions d where d.id=role_definition_id and d.tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(d.tenant_id,'can_manage_members')));
grant select on public.shops to magrit_api;
grant select,insert,update,delete on public.tenant_role_definitions,public.tenant_role_assignments to magrit_api;
