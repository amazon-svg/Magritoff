create table public.tenant_hopstudio_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  hope_studio_url text,
  clariprint_user text,
  clariprint_password_encrypted text,
  clariprint_url text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint tenant_hopstudio_settings_hope_url_check
    check (hope_studio_url is null or hope_studio_url ~ '^https://'),
  constraint tenant_hopstudio_settings_clariprint_url_check
    check (clariprint_url is null or clariprint_url ~ '^https://')
);

alter table public.tenant_hopstudio_settings enable row level security;
alter table public.tenant_hopstudio_settings force row level security;

create policy tenant_hopstudio_settings_api on public.tenant_hopstudio_settings
  for all to magrit_api
  using (
    magrit.current_user_id() is null
    or exists (
      select 1 from public.user_preferences preference
       where preference.user_id = magrit.current_user_id() and preference.is_admin
    )
    or exists (
      select 1 from public.tenant_members member
         where member.tenant_id = tenant_hopstudio_settings.tenant_id
         and member.user_id = magrit.current_user_id()
         and member.role in ('owner','admin')
    )
    or magrit.actor_has_capability(
      tenant_hopstudio_settings.tenant_id,
      'can_manage_integrations'
    )
  )
  with check (
    magrit.current_user_id() is null
    or exists (
      select 1 from public.user_preferences preference
       where preference.user_id = magrit.current_user_id() and preference.is_admin
    )
    or exists (
      select 1 from public.tenant_members member
         where member.tenant_id = tenant_hopstudio_settings.tenant_id
         and member.user_id = magrit.current_user_id()
         and member.role in ('owner','admin')
    )
    or magrit.actor_has_capability(
      tenant_hopstudio_settings.tenant_id,
      'can_manage_integrations'
    )
  );

revoke all on table public.tenant_hopstudio_settings from public, magrit_worker, magrit_readonly;
grant select,insert,update on table public.tenant_hopstudio_settings to magrit_api;

comment on table public.tenant_hopstudio_settings is
  'Configuration HopeStudio portable ; les secrets Clariprint sont chiffres par le serveur Node.';
