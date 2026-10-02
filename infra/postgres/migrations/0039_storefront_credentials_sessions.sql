create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to magrit_api;

create table private.shop_customer_credentials (
  shop_customer_account_id uuid primary key references public.shop_customer_accounts(id) on delete cascade,
  password_hash text not null check (char_length(password_hash) between 32 and 1024),
  password_algorithm text not null default 'scrypt-v1' check (password_algorithm='scrypt-v1'),
  credential_version integer not null default 1 check (credential_version>0),
  failed_attempt_count integer not null default 0 check (failed_attempt_count between 0 and 1000000),
  last_failed_at timestamptz,
  locked_until timestamptz,
  password_changed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table private.shop_customer_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null,
  shop_id uuid not null,
  token_hash bytea not null unique check (octet_length(token_hash)=32),
  session_kind text not null default 'direct' check (session_kind in ('direct','delegated')),
  actor_magrit_user_id uuid references public.app_users(id) on delete set null,
  delegation_id uuid,
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  foreign key (shop_customer_account_id,shop_id) references public.shop_customer_accounts(id,shop_id) on delete cascade,
  constraint shop_customer_sessions_expiry check (expires_at>issued_at),
  constraint shop_customer_sessions_actor check (
    (session_kind='direct' and actor_magrit_user_id is null and delegation_id is null)
    or (session_kind='delegated' and actor_magrit_user_id is not null and delegation_id is not null)
  )
);
create index shop_customer_sessions_account_expiry_idx on private.shop_customer_sessions(shop_customer_account_id,expires_at desc);
create index shop_customer_sessions_shop_expiry_idx on private.shop_customer_sessions(shop_id,expires_at desc);

revoke all on table private.shop_customer_credentials,private.shop_customer_sessions from public;
grant select,insert,update,delete on table private.shop_customer_credentials,private.shop_customer_sessions to magrit_api;

comment on table private.shop_customer_credentials is 'Credentials scrypt du storefront, accessibles uniquement au BFF.';
comment on table private.shop_customer_sessions is 'Sessions storefront opaques ; seul le SHA-256 du jeton est persiste.';
