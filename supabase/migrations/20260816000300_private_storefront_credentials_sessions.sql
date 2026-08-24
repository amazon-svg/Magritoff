-- UM2.2 — Stockage privé des credentials et sessions storefront.
-- Aucun secret n'est exposé par PostgREST et aucune clé service_role n'est
-- requise dans magrit-api. Les fonctions SQL étroites arriveront avec UM2.3.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shop_customer_accounts_id_shop_unique'
      and conrelid = 'public.shop_customer_accounts'::regclass
  ) then
    alter table public.shop_customer_accounts
      add constraint shop_customer_accounts_id_shop_unique unique (id, shop_id);
  end if;
end;
$$;

create table if not exists private.shop_customer_credentials (
  shop_customer_account_id uuid primary key
    references public.shop_customer_accounts(id) on delete cascade,
  password_hash text not null,
  password_algorithm text not null default 'bcrypt-sha256-v1',
  credential_version integer not null default 1,
  failed_attempt_count integer not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shop_customer_credentials_hash_check
    check (length(password_hash) between 32 and 1024),
  constraint shop_customer_credentials_algorithm_check
    check (password_algorithm in ('bcrypt-sha256-v1')),
  constraint shop_customer_credentials_version_check
    check (credential_version > 0),
  constraint shop_customer_credentials_attempts_check
    check (failed_attempt_count between 0 and 1000000)
);

create table if not exists private.shop_customer_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null,
  shop_id uuid not null,
  token_hash bytea not null unique,
  session_kind text not null default 'direct',
  actor_magrit_user_id uuid references auth.users(id) on delete set null,
  delegation_id uuid,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_ip_hash bytea,
  user_agent_hash bytea,

  constraint shop_customer_sessions_account_shop_fkey
    foreign key (shop_customer_account_id, shop_id)
    references public.shop_customer_accounts(id, shop_id) on delete cascade,
  constraint shop_customer_sessions_token_hash_check
    check (octet_length(token_hash) = 32),
  constraint shop_customer_sessions_kind_check
    check (session_kind in ('direct', 'delegated')),
  constraint shop_customer_sessions_expiry_check
    check (expires_at > issued_at),
  constraint shop_customer_sessions_actor_check
    check (
      (session_kind = 'direct' and actor_magrit_user_id is null and delegation_id is null)
      or
      (session_kind = 'delegated' and actor_magrit_user_id is not null and delegation_id is not null)
    )
);

create index if not exists shop_customer_sessions_account_expiry_idx
  on private.shop_customer_sessions (shop_customer_account_id, expires_at desc);
create index if not exists shop_customer_sessions_shop_expiry_idx
  on private.shop_customer_sessions (shop_id, expires_at desc);

comment on table private.shop_customer_credentials is
  'Credentials storefront hachés ; jamais exposés via PostgREST.';
comment on column private.shop_customer_credentials.password_hash is
  'Hash bcrypt du SHA-256 du secret, format versionné v1, vérifié dans une primitive SQL privée.';
comment on table private.shop_customer_sessions is
  'Sessions storefront opaques ; seul le SHA-256 du jeton est stocké.';
comment on column public.shop_customer_accounts.auth_subject_id is
  'Lien Supabase Auth transitoire, non utilisé par le nouveau storefront.';

alter table private.shop_customer_credentials enable row level security;
alter table private.shop_customer_sessions enable row level security;
revoke all on table private.shop_customer_credentials from public, anon, authenticated;
revoke all on table private.shop_customer_sessions from public, anon, authenticated;

notify pgrst, 'reload schema';
