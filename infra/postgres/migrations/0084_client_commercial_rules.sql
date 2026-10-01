create table public.client_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 200),
  created_at timestamptz not null default clock_timestamp(),
  unique (tenant_id,name)
);

create table public.client_group_members (
  group_id uuid not null references public.client_groups(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  added_at timestamptz not null default clock_timestamp(),
  primary key (group_id,user_id)
);

create index client_group_members_user_idx on public.client_group_members(user_id);

create table public.client_price_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 300),
  scope_type text not null check (scope_type in ('tenant','group','user')),
  group_id uuid references public.client_groups(id) on delete cascade,
  user_id uuid references public.app_users(id) on delete cascade,
  target_type text not null check (target_type in ('all','gamme','product')),
  gamme_slug text references public.product_gammes(slug) on delete cascade,
  product_definition_id uuid references public.product_definitions(id) on delete cascade,
  adjust_mode text not null check (adjust_mode in ('margin_pct','discount_pct','fixed_price')),
  value numeric(12,4) not null check (value >= 0),
  priority integer not null default 100,
  active boolean not null default true,
  valid_from date,
  valid_until date,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint client_price_rules_scope_shape check (
    (scope_type='tenant' and group_id is null and user_id is null)
    or (scope_type='group' and group_id is not null and user_id is null)
    or (scope_type='user' and group_id is null and user_id is not null)
  ),
  constraint client_price_rules_target_shape check (
    (target_type='all' and gamme_slug is null and product_definition_id is null)
    or (target_type='gamme' and gamme_slug is not null and product_definition_id is null)
    or (target_type='product' and gamme_slug is null and product_definition_id is not null)
  ),
  constraint client_price_rules_validity check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  )
);

create index client_price_rules_tenant_active_idx
  on public.client_price_rules(tenant_id,active,priority,created_at desc);

alter table public.client_groups enable row level security;
alter table public.client_groups force row level security;
alter table public.client_group_members enable row level security;
alter table public.client_group_members force row level security;
alter table public.client_price_rules enable row level security;
alter table public.client_price_rules force row level security;

create policy client_groups_read on public.client_groups for select to magrit_api
  using (tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id));
create policy client_groups_write on public.client_groups for all to magrit_api
  using (tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_pricing'))
  with check (tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_pricing'));

create policy client_group_members_read on public.client_group_members for select to magrit_api
  using (exists(select 1 from public.client_groups groups where groups.id=group_id));
create policy client_group_members_write on public.client_group_members for all to magrit_api
  using (exists(
    select 1 from public.client_groups groups where groups.id=group_id
      and magrit.actor_has_capability(groups.tenant_id,'can_manage_pricing')
  ))
  with check (exists(
    select 1 from public.client_groups groups where groups.id=group_id
      and magrit.actor_has_capability(groups.tenant_id,'can_manage_pricing')
  ));

create policy client_price_rules_read on public.client_price_rules for select to magrit_api
  using (tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id));
create policy client_price_rules_write on public.client_price_rules for all to magrit_api
  using (tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_pricing'))
  with check (tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_pricing'));

revoke all on public.client_groups,public.client_group_members,public.client_price_rules from public;
grant select,insert,update,delete on public.client_groups,public.client_group_members,public.client_price_rules to magrit_api;

comment on table public.client_price_rules is
  'Regles commerciales historiques de l ecran groupes clients, portees hors Supabase.';
