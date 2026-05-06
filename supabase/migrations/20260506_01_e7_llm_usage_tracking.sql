-- =============================================================================
-- Migration E7.1 / v4 — Suivi de consommation LLM par utilisateur
-- -----------------------------------------------------------------------------
-- Trace chaque appel LLM (Claude pour l'instant, OpenAI/autres plus tard) avec
-- les tokens consommes (input + output), le modele, l'endpoint et le contexte
-- (user, tenant). Permet :
--   * facturation interne / quotas par tier
--   * dashboard ops "top consommateurs"
--   * detection d'anomalies (pic d'usage)
--   * base pour T-06 (sponsoring publicitaire CPL/conversion)
--
-- Pas de TimescaleDB (overkill pour V1, < 10M lignes/an attendues). Si volume
-- explose, basculer plus tard sur ClickHouse externe sans changer le schema.
-- =============================================================================

create table if not exists public.llm_usage_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  tenant_id       uuid references public.tenants(id) on delete set null,
  endpoint        text not null,            -- 'claude-proxy', 'pim-generate', 'pim-ingest', etc.
  model           text not null,            -- 'claude-sonnet-4-20250514', 'claude-haiku-4-5', etc.
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  total_tokens    integer generated always as (input_tokens + output_tokens) stored,
  -- Contexte additionnel (request_id, latence, status, ...) pour debug.
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists llm_usage_user_created_idx
  on public.llm_usage_events(user_id, created_at desc);
create index if not exists llm_usage_tenant_created_idx
  on public.llm_usage_events(tenant_id, created_at desc);
create index if not exists llm_usage_endpoint_idx
  on public.llm_usage_events(endpoint);

alter table public.llm_usage_events enable row level security;

-- L'insert se fait depuis edge functions avec service_role (bypass RLS).
-- Pour le SELECT cote client : un user voit son propre usage, un superadmin
-- voit tout, un owner/admin de tenant voit l'usage de son tenant.
drop policy if exists "llm_usage_select" on public.llm_usage_events;
create policy "llm_usage_select" on public.llm_usage_events for select using (
  public.is_super_admin()
  or user_id = auth.uid()
  or (
    tenant_id is not null
    and public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  )
);

-- ─── RPC : agreger l'usage par utilisateur sur une periode ─────────────────
-- Retourne tokens entree, sortie, total + nb de requetes. Utilise par l'UI
-- pour afficher "X devis ce mois sur Y autorises".
create or replace function public.get_user_llm_usage(
  p_user_id uuid,
  p_period_start timestamptz default date_trunc('month', now()),
  p_period_end   timestamptz default now()
)
returns table (
  input_tokens   bigint,
  output_tokens  bigint,
  total_tokens   bigint,
  request_count  bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(input_tokens), 0)::bigint  as input_tokens,
    coalesce(sum(output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(total_tokens), 0)::bigint  as total_tokens,
    count(*)::bigint                        as request_count
  from public.llm_usage_events
  where user_id = p_user_id
    and created_at >= p_period_start
    and created_at <  p_period_end;
$$;

grant execute on function public.get_user_llm_usage(uuid, timestamptz, timestamptz) to authenticated;

-- ─── RPC : usage agrege par tenant (pour Pro+, vue admin) ──────────────────
create or replace function public.get_tenant_llm_usage(
  p_tenant_id uuid,
  p_period_start timestamptz default date_trunc('month', now()),
  p_period_end   timestamptz default now()
)
returns table (
  user_id        uuid,
  total_tokens   bigint,
  request_count  bigint
)
language sql stable security definer set search_path = public as $$
  select
    user_id,
    coalesce(sum(total_tokens), 0)::bigint as total_tokens,
    count(*)::bigint                        as request_count
  from public.llm_usage_events
  where tenant_id = p_tenant_id
    and created_at >= p_period_start
    and created_at <  p_period_end
  group by user_id
  order by sum(total_tokens) desc nulls last;
$$;

grant execute on function public.get_tenant_llm_usage(uuid, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
