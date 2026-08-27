-- Configuration Clariprint Studio par tenant.
-- Le mot de passe est chiffré en AES-256-GCM par le backend avant stockage.

create table if not exists public.tenant_hopstudio_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  hope_studio_url text,
  clariprint_user text,
  clariprint_password_encrypted text,
  clariprint_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_hopstudio_settings_hope_url_check
    check (hope_studio_url is null or hope_studio_url ~ '^https?://'),
  constraint tenant_hopstudio_settings_clariprint_url_check
    check (clariprint_url is null or clariprint_url ~ '^https?://')
);

comment on table public.tenant_hopstudio_settings is
  'Configuration backend Clariprint Studio isolée par tenant.';
comment on column public.tenant_hopstudio_settings.clariprint_password_encrypted is
  'Secret AES-256-GCM versionné ; ne contient jamais le mot de passe en clair.';

alter table public.tenant_hopstudio_settings enable row level security;

drop policy if exists tenant_hopstudio_settings_admin_select
  on public.tenant_hopstudio_settings;
create policy tenant_hopstudio_settings_admin_select
  on public.tenant_hopstudio_settings for select
  using (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) = 'admin'
  );

drop policy if exists tenant_hopstudio_settings_admin_insert
  on public.tenant_hopstudio_settings;
create policy tenant_hopstudio_settings_admin_insert
  on public.tenant_hopstudio_settings for insert
  with check (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) = 'admin'
  );

drop policy if exists tenant_hopstudio_settings_admin_update
  on public.tenant_hopstudio_settings;
create policy tenant_hopstudio_settings_admin_update
  on public.tenant_hopstudio_settings for update
  using (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) = 'admin'
  )
  with check (
    public.is_super_admin()
    or public.user_role_in_tenant(tenant_id) = 'admin'
  );

revoke all on public.tenant_hopstudio_settings from anon;
grant select, insert, update on public.tenant_hopstudio_settings to authenticated;

notify pgrst, 'reload schema';
