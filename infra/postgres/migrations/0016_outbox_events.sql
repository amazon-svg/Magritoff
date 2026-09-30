create table public.outbox_events (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_name text not null,
  event_version integer not null default 1,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  published_at timestamptz,
  delivery_attempts integer not null default 0,
  next_attempt_at timestamptz not null default clock_timestamp(),
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  constraint outbox_events_name_shape check (
    event_name ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'
  ),
  constraint outbox_events_aggregate_type_shape check (
    aggregate_type ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint outbox_events_version_positive check (event_version >= 1),
  constraint outbox_events_attempts_positive check (delivery_attempts >= 0),
  constraint outbox_events_payload_is_object check (jsonb_typeof(payload) = 'object')
);

create index outbox_events_pending_idx on public.outbox_events (next_attempt_at, occurred_at)
  where published_at is null;
create index outbox_events_tenant_idx on public.outbox_events (tenant_id, occurred_at desc);
create index outbox_events_aggregate_idx on public.outbox_events (aggregate_type, aggregate_id, occurred_at desc);

create function magrit.outbox_events_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.published_at is null then
      raise exception using errcode = '42501',
        message = 'outbox_append_only: pending event cannot be deleted';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.event_name is distinct from old.event_name
     or new.event_version is distinct from old.event_version
     or new.aggregate_type is distinct from old.aggregate_type
     or new.aggregate_id is distinct from old.aggregate_id
     or new.payload is distinct from old.payload
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501',
      message = 'outbox_append_only: event content is immutable';
  end if;
  return new;
end
$$;

create trigger outbox_events_append_only
  before update or delete on public.outbox_events
  for each row execute function magrit.outbox_events_reject_mutation();

alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;

create policy outbox_events_api_insert on public.outbox_events
  for insert to magrit_api
  with check (tenant_id = magrit.current_tenant_id());

create policy outbox_events_api_select on public.outbox_events
  for select to magrit_api
  using (tenant_id = magrit.current_tenant_id());

create policy outbox_events_worker on public.outbox_events
  for all to magrit_worker
  using (true) with check (true);

revoke all on table public.outbox_events from public;
grant select, insert on table public.outbox_events to magrit_api;
grant select, insert, update, delete on table public.outbox_events to magrit_worker;

comment on table public.outbox_events is
  'File durable des evenements metier. Le contenu est append-only ; seules les colonnes de livraison evoluent.';
