create table public.conversations (
  id text primary key,
  user_id uuid not null,
  tenant_id uuid not null,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  products jsonb not null default '[]'::jsonb,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_id_length check (char_length(id) between 1 and 200),
  constraint conversations_title_length check (char_length(title) <= 500),
  constraint conversations_messages_array check (jsonb_typeof(messages) = 'array'),
  constraint conversations_products_array check (jsonb_typeof(products) = 'array')
);

create index conversations_tenant_timestamp_idx
  on public.conversations (tenant_id, timestamp desc);
create index conversations_user_id_idx
  on public.conversations (user_id);

alter table public.conversations enable row level security;
alter table public.conversations force row level security;

create policy conversations_select on public.conversations
  for select
  using (tenant_id = magrit.current_tenant_id());

create policy conversations_insert on public.conversations
  for insert
  with check (
    tenant_id = magrit.current_tenant_id()
    and user_id = magrit.current_user_id()
  );

create policy conversations_update on public.conversations
  for update
  using (
    tenant_id = magrit.current_tenant_id()
    and user_id = magrit.current_user_id()
  )
  with check (
    tenant_id = magrit.current_tenant_id()
    and user_id = magrit.current_user_id()
  );

create policy conversations_delete on public.conversations
  for delete
  using (
    tenant_id = magrit.current_tenant_id()
    and user_id = magrit.current_user_id()
  );

comment on table public.conversations is
  'Premier domaine migre hors Supabase ; le FK user_id sera ajoute avec app_users.';
