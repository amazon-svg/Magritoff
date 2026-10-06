-- E4.4a — audit immuable des informations éditables de la commande canonique.
create table public.tenant_order_metadata_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.tenant_orders(id) on delete cascade,
  actor_id uuid references public.app_users(id) on delete set null,
  changes jsonb not null check (
    jsonb_typeof(changes) = 'object' and changes <> '{}'::jsonb
  ),
  occurred_at timestamptz not null default clock_timestamp()
);

create index tenant_order_metadata_events_order_idx
  on public.tenant_order_metadata_events(order_id,occurred_at,id);

alter table public.tenant_order_metadata_events enable row level security;
alter table public.tenant_order_metadata_events force row level security;

create policy tenant_order_metadata_events_read
  on public.tenant_order_metadata_events for select to magrit_api
  using (exists(
    select 1 from public.tenant_orders orders where orders.id=order_id
  ));

create policy tenant_order_metadata_events_insert
  on public.tenant_order_metadata_events for insert to magrit_api
  with check (exists(
    select 1 from public.tenant_orders orders where orders.id=order_id
  ));

revoke all on table public.tenant_order_metadata_events from public;
grant select,insert on table public.tenant_order_metadata_events to magrit_api;

comment on table public.tenant_order_metadata_events is
  'Journal immuable des changements de référence client et de notes d une commande canonique.';
