-- Magrit : tables utilisateur (conversations, devis, commandes, préférences, clients)
-- À exécuter dans le SQL Editor du dashboard Supabase (projet jynxrpzwgzrrfuooputw).

-- ─── Conversations (historique prompt) ───────────────────────────────────────
create table if not exists public.conversations (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  messages     jsonb not null default '[]'::jsonb,
  products     jsonb not null default '[]'::jsonb,
  timestamp    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists conversations_user_id_idx on public.conversations(user_id);

alter table public.conversations enable row level security;
drop policy if exists "own conversations select" on public.conversations;
drop policy if exists "own conversations insert" on public.conversations;
drop policy if exists "own conversations update" on public.conversations;
drop policy if exists "own conversations delete" on public.conversations;
create policy "own conversations select" on public.conversations for select using (auth.uid() = user_id);
create policy "own conversations insert" on public.conversations for insert with check (auth.uid() = user_id);
create policy "own conversations update" on public.conversations for update using (auth.uid() = user_id);
create policy "own conversations delete" on public.conversations for delete using (auth.uid() = user_id);

-- ─── Préférences utilisateur ─────────────────────────────────────────────────
create table if not exists public.user_preferences (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  theme                   text not null default 'light',
  language                text not null default 'fr',
  default_delivery_zone   text not null default 'FR-75',
  notifications_email     boolean not null default true,
  updated_at              timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
drop policy if exists "own prefs all" on public.user_preferences;
create policy "own prefs all" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Clients (CRM) ───────────────────────────────────────────────────────────
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company       text not null,
  contact_name  text default '',
  email         text default '',
  phone         text default '',
  address       text default '',
  notes         text default '',
  created_at    timestamptz not null default now()
);
create index if not exists clients_user_id_idx on public.clients(user_id);

alter table public.clients enable row level security;
drop policy if exists "own clients all" on public.clients;
create policy "own clients all" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Devis ───────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  reference       text not null,
  product_name    text not null,
  product_config  jsonb,
  total_ht        numeric(12,2),
  total_ttc       numeric(12,2),
  status          text not null default 'draft',
  created_at      timestamptz not null default now()
);
create index if not exists quotes_user_id_idx on public.quotes(user_id);

alter table public.quotes enable row level security;
drop policy if exists "own quotes all" on public.quotes;
create policy "own quotes all" on public.quotes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Commandes ───────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  quote_id        uuid references public.quotes(id) on delete set null,
  reference       text not null,
  product_name    text not null,
  product_config  jsonb,
  total_ht        numeric(12,2),
  total_ttc       numeric(12,2),
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders(user_id);

alter table public.orders enable row level security;
drop policy if exists "own orders all" on public.orders;
create policy "own orders all" on public.orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
