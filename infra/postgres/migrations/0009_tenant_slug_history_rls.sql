alter table public.tenant_slug_history enable row level security;
alter table public.tenant_slug_history force row level security;

create policy tenant_slug_history_authenticated_read
  on public.tenant_slug_history
  for select
  using (magrit.current_user_id() is not null);

revoke all on table public.tenant_slug_history from magrit_readonly;

comment on policy tenant_slug_history_authenticated_read
  on public.tenant_slug_history is
  'La resolution des anciens slugs exige un contexte utilisateur API.';
