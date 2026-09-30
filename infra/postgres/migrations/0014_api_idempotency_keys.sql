create table public.api_idempotency_keys (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  idempotency_key text not null,
  fingerprint text not null,
  status text not null default 'in_progress',
  response_status integer,
  response_body jsonb,
  response_etag text,
  locked_until timestamptz not null default (clock_timestamp() + interval '10 minutes'),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  expires_at timestamptz not null default (clock_timestamp() + interval '24 hours'),
  primary key (tenant_id, idempotency_key),
  constraint api_idempotency_keys_key_shape check (
    idempotency_key ~ '^[A-Za-z0-9_.:-]{8,255}$'
  ),
  constraint api_idempotency_keys_fingerprint_shape check (
    fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint api_idempotency_keys_status_values check (
    status in ('in_progress', 'completed')
  ),
  constraint api_idempotency_keys_completed_shape check (
    status <> 'completed'
    or (response_status is not null and response_body is not null and completed_at is not null)
  ),
  constraint api_idempotency_keys_response_status_range check (
    response_status is null or response_status between 100 and 599
  )
);

create index api_idempotency_keys_expiry_idx
  on public.api_idempotency_keys (expires_at);

alter table public.api_idempotency_keys enable row level security;
alter table public.api_idempotency_keys force row level security;

create policy api_idempotency_keys_tenant on public.api_idempotency_keys
  for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());

revoke all on table public.api_idempotency_keys from public;
grant select, insert, update, delete on table public.api_idempotency_keys to magrit_api;

comment on table public.api_idempotency_keys is
  'Reponses idempotentes durables par tenant. Une reservation abandonnee peut etre reprise apres dix minutes.';
