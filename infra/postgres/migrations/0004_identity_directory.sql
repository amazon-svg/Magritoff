create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique,
  display_name text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_normalized check (
    email_normalized = lower(btrim(email_normalized))
    and char_length(email_normalized) between 3 and 320
  ),
  constraint app_users_status check (status in ('active', 'disabled'))
);

create table public.user_identities (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  provider_type text not null,
  provider_id text not null,
  issuer text not null,
  subject text not null,
  created_at timestamptz not null default now(),
  constraint user_identities_provider_type check (provider_type in ('local', 'oidc')),
  constraint user_identities_provider_id_length check (char_length(provider_id) between 1 and 200),
  constraint user_identities_issuer_length check (char_length(issuer) between 1 and 2048),
  constraint user_identities_subject_length check (char_length(subject) between 1 and 500),
  constraint user_identities_issuer_subject_unique unique (issuer, subject)
);

create index user_identities_app_user_id_idx on public.user_identities (app_user_id);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_tenant_id uuid references public.tenants(id) on delete restrict,
  plan text not null default 'standard',
  is_system_tenant boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  constraint tenants_name_length check (char_length(btrim(name)) between 1 and 200),
  constraint tenants_settings_object check (jsonb_typeof(settings) = 'object')
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null default 'member',
  invited_by uuid references public.app_users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint tenant_members_role check (role in ('owner', 'admin', 'member', 'partner'))
);

create index tenant_members_user_id_idx on public.tenant_members (user_id, tenant_id);

alter table public.conversations
  add constraint conversations_user_id_fk
  foreign key (user_id) references public.app_users(id) on delete cascade;

alter table public.conversations
  add constraint conversations_tenant_id_fk
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

grant select on table public.app_users, public.user_identities, public.tenants, public.tenant_members
  to magrit_api;

comment on table public.app_users is
  'Identite applicative stable, independante du fournisseur d authentification.';
comment on table public.user_identities is
  'Correspondance serveur entre un sujet OIDC externe et un utilisateur Magrit.';
comment on table public.tenant_members is
  'Appartenances autorisees utilisees par le resoluteur d acteur avant le contexte RLS.';
