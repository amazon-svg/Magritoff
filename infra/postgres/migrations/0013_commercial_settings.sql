create table public.commercial_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  default_validity_days integer default 30,
  order_file_purge_enabled boolean not null default false,
  order_file_purge_enabled_at timestamptz,
  notification_retention_days integer not null default 90,
  notification_sms_enabled boolean not null default false,
  notification_sms_daily_cap integer not null default 200,
  updated_at timestamptz not null default now(),
  constraint commercial_settings_default_validity_days_range check (
    default_validity_days is null or default_validity_days between 1 and 3650
  ),
  constraint commercial_settings_purge_activation_coherence check (
    (order_file_purge_enabled and order_file_purge_enabled_at is not null)
    or (not order_file_purge_enabled and order_file_purge_enabled_at is null)
  ),
  constraint commercial_settings_notification_retention_days_range check (
    notification_retention_days between 7 and 730
  ),
  constraint commercial_settings_notification_sms_daily_cap_range check (
    notification_sms_daily_cap between 0 and 10000
  )
);

create function magrit.current_user_can_access_tenant(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, magrit
as $$
  select coalesce(
    exists (
      select 1
        from public.user_preferences p
       where p.user_id = magrit.current_user_id()
         and p.is_admin
    )
    or exists (
      select 1
        from public.tenant_members m
       where m.user_id = magrit.current_user_id()
         and m.tenant_id = requested_tenant_id
    ),
    false
  )
$$;

create function magrit.actor_has_capability(
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
      select 1
        from public.user_preferences p
       where p.user_id = magrit.current_user_id()
         and p.is_admin
    )
    or exists (
      select 1
        from public.tenant_members m
       where m.user_id = magrit.current_user_id()
         and m.tenant_id = requested_tenant_id
         and m.role in ('owner', 'admin')
    ),
    false
  ) and requested_capability in ('can_manage_pricing', 'can_manage_notifications')
$$;

create function magrit.commercial_settings_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.order_file_purge_enabled_at := case
      when new.order_file_purge_enabled then clock_timestamp()
      else null
    end;
  elsif new.order_file_purge_enabled and not old.order_file_purge_enabled then
    new.order_file_purge_enabled_at := clock_timestamp();
  elsif not new.order_file_purge_enabled then
    new.order_file_purge_enabled_at := null;
  else
    new.order_file_purge_enabled_at := old.order_file_purge_enabled_at;
  end if;

  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger commercial_settings_before_write
  before insert or update on public.commercial_settings
  for each row execute function magrit.commercial_settings_before_write();

alter table public.commercial_settings enable row level security;
alter table public.commercial_settings force row level security;

create policy commercial_settings_select on public.commercial_settings
  for select
  using (
    tenant_id = magrit.current_tenant_id()
    and magrit.current_user_can_access_tenant(tenant_id)
  );

create policy commercial_settings_insert on public.commercial_settings
  for insert
  with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  );

create policy commercial_settings_update on public.commercial_settings
  for update
  using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  )
  with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  );

create function magrit.get_commercial_settings(requested_tenant_id uuid)
returns setof public.commercial_settings
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
begin
  if requested_tenant_id is distinct from magrit.current_tenant_id()
     or not magrit.current_user_can_access_tenant(requested_tenant_id) then
    return;
  end if;

  insert into public.commercial_settings (tenant_id)
  values (requested_tenant_id)
  on conflict (tenant_id) do nothing;

  return query
    select settings.*
      from public.commercial_settings settings
     where settings.tenant_id = requested_tenant_id;
end
$$;

revoke all on table public.commercial_settings from public;
revoke all on function magrit.current_user_can_access_tenant(uuid) from public;
revoke all on function magrit.actor_has_capability(uuid, text) from public;
revoke all on function magrit.get_commercial_settings(uuid) from public;
grant select, insert, update on table public.commercial_settings to magrit_api;
grant execute on function magrit.current_user_can_access_tenant(uuid) to magrit_api;
grant execute on function magrit.actor_has_capability(uuid, text) to magrit_api;
grant execute on function magrit.get_commercial_settings(uuid) to magrit_api;

comment on table public.commercial_settings is
  'Reglages commerciaux portables, singleton par tenant et proteges par le contexte RLS Magrit.';
comment on function magrit.actor_has_capability(uuid, text) is
  'Modele transitoire de capacites : super-administrateurs et administrateurs de tenant disposent des capacites commerciales migrees.';
