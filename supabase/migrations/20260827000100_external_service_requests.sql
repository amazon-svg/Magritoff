-- Registre générique des appels HTTP sortants de Magrit.
-- Les secrets d'authentification ne doivent jamais être enregistrés ici.

create table if not exists public.external_service_requests (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  operation text not null,
  method text not null default 'POST',
  url text not null,
  state text not null default 'pending'
    check (state in ('pending', 'succeeded', 'http_error', 'network_error', 'timeout', 'invalid_response')),
  request_payload jsonb,
  response_payload jsonb,
  request_size_bytes integer,
  response_size_bytes integer,
  response_content_type text,
  http_status integer check (http_status is null or http_status between 100 and 599),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer generated always as (
    case
      when input_tokens is null and output_tokens is null then null
      else coalesce(input_tokens, 0) + coalesce(output_tokens, 0)
    end
  ) stored,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  constraint external_service_requests_request_payload_size
    check (request_payload is null or octet_length(request_payload::text) <= 524288),
  constraint external_service_requests_response_payload_size
    check (response_payload is null or octet_length(response_payload::text) <= 524288)
);

create index if not exists external_service_requests_tenant_started_idx
  on public.external_service_requests(tenant_id, started_at desc);
create index if not exists external_service_requests_user_started_idx
  on public.external_service_requests(user_id, started_at desc);
create index if not exists external_service_requests_provider_started_idx
  on public.external_service_requests(provider, started_at desc);
create index if not exists external_service_requests_correlation_idx
  on public.external_service_requests(correlation_id);
create index if not exists external_service_requests_state_started_idx
  on public.external_service_requests(state, started_at desc);
create index if not exists external_service_requests_expiry_idx
  on public.external_service_requests(expires_at);

comment on table public.external_service_requests is
  'Journal d audit des appels HTTP externes, partitionné logiquement par tenant et utilisateur.';
comment on column public.external_service_requests.request_payload is
  'Entrée métier sans en-têtes ni secrets, limitée à 512 Kio.';
comment on column public.external_service_requests.response_payload is
  'Sortie métier ou aperçu tronqué, limitée à 512 Kio.';

alter table public.external_service_requests enable row level security;

drop policy if exists external_service_requests_select on public.external_service_requests;
create policy external_service_requests_select
  on public.external_service_requests for select
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or (
      tenant_id is not null
      and public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
    )
  );

revoke all on public.external_service_requests from anon;
revoke insert, update, delete on public.external_service_requests from authenticated;
grant select on public.external_service_requests to authenticated;

create or replace function public.purge_expired_external_service_requests()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.external_service_requests where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_external_service_requests() from public, anon, authenticated;
grant execute on function public.purge_expired_external_service_requests() to service_role;

notify pgrst, 'reload schema';
