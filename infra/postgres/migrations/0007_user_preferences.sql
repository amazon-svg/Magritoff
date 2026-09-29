create table public.user_preferences (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  theme text not null default 'light',
  language text not null default 'fr',
  default_delivery_zone text not null default 'FR-75',
  notifications_email boolean not null default true,
  plan text not null default 'freemium',
  is_admin boolean not null default false,
  last_tenant_id uuid references public.tenants(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint user_preferences_theme check (theme in ('light', 'dark')),
  constraint user_preferences_language check (language in ('fr', 'en')),
  constraint user_preferences_plan check (plan in ('freemium', 'pro', 'enterprise'))
);

alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

create policy user_preferences_self on public.user_preferences
  for all
  using (user_id = magrit.current_user_id())
  with check (user_id = magrit.current_user_id());

grant select, insert, update, delete on public.user_preferences to magrit_api;

comment on table public.user_preferences is
  'Preferences workspace portables, protegees par le contexte utilisateur Magrit.';
