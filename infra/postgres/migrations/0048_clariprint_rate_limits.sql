create table public.api_rate_limits (
  scope text primary key check (scope in (
    'clariprint_quote_visitor',
    'clariprint_quote_member',
    'clariprint_quote_public_daily'
  )),
  max_hits integer not null check (max_hits > 0),
  window_kind text not null check (window_kind in ('fixed_seconds', 'civil_day')),
  window_seconds integer check (window_seconds > 0),
  civil_day_timezone text,
  updated_at timestamptz not null default clock_timestamp(),
  constraint api_rate_limits_window_shape check (
    (window_kind = 'fixed_seconds' and window_seconds is not null and civil_day_timezone is null)
    or (window_kind = 'civil_day' and window_seconds is null and civil_day_timezone is not null)
  )
);

create table public.api_rate_limit_counters (
  scope text not null references public.api_rate_limits(scope) on delete cascade,
  key_hash text not null check (length(key_hash) > 0),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (scope, key_hash, window_start),
  constraint api_rate_limit_counters_key_hash_not_raw_ip check (
    key_hash !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
    and key_hash !~ '^[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,7}$'
  )
);

create index api_rate_limit_counters_purge_idx
  on public.api_rate_limit_counters(window_start);

alter table public.api_rate_limits enable row level security;
alter table public.api_rate_limits force row level security;
alter table public.api_rate_limit_counters enable row level security;
alter table public.api_rate_limit_counters force row level security;

create policy api_rate_limits_server_only on public.api_rate_limits
  for all to magrit_api using (true) with check (true);
create policy api_rate_limit_counters_server_only on public.api_rate_limit_counters
  for all to magrit_api using (true) with check (true);

revoke all on table public.api_rate_limits from public;
revoke all on table public.api_rate_limit_counters from public;
grant select, update on table public.api_rate_limits to magrit_api;
grant select, insert, update, delete on table public.api_rate_limit_counters to magrit_api;

insert into public.api_rate_limits (
  scope, max_hits, window_kind, window_seconds, civil_day_timezone
) values
  ('clariprint_quote_visitor', 30, 'fixed_seconds', 600, null),
  ('clariprint_quote_member', 120, 'fixed_seconds', 600, null),
  ('clariprint_quote_public_daily', 500, 'civil_day', null, 'Europe/Paris');

comment on table public.api_rate_limits is
  'Configuration serveur des quotas Clariprint, modifiable sans redeploiement.';
comment on table public.api_rate_limit_counters is
  'Compteurs atomiques Clariprint. Une IP est toujours stockee sous forme de HMAC.';
