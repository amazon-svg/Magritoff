-- UM5.1 — Délégation storefront courte, auditée et limitée à une boutique.

create table if not exists private.shop_customer_delegations (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null,
  shop_id uuid not null,
  actor_magrit_user_id uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  reason text,
  constraint shop_customer_delegations_account_shop_fkey
    foreign key (shop_customer_account_id, shop_id)
    references public.shop_customer_accounts(id, shop_id) on delete cascade,
  constraint shop_customer_delegations_expiry_check check (expires_at > issued_at),
  constraint shop_customer_delegations_reason_check check (reason is null or length(reason) <= 500)
);

create index if not exists shop_customer_delegations_actor_expiry_idx
  on private.shop_customer_delegations (actor_magrit_user_id, expires_at desc);
create index if not exists shop_customer_delegations_account_expiry_idx
  on private.shop_customer_delegations (shop_customer_account_id, expires_at desc);
alter table private.shop_customer_delegations enable row level security;
revoke all on table private.shop_customer_delegations from public, anon, authenticated;

alter table private.shop_customer_sessions
  add constraint shop_customer_sessions_delegation_fkey
  foreign key (delegation_id) references private.shop_customer_delegations(id) on delete cascade;

create or replace function public.api_start_self_shop_customer_delegation(
  p_tenant_id uuid,
  p_shop_id uuid,
  p_reason text default null,
  p_expires_seconds integer default 1800
)
returns table (
  opaque_token text,
  account_id uuid,
  shop_id uuid,
  email text,
  normalized_email text,
  full_name text,
  account_status text,
  auth_subject_id uuid,
  created_by_magrit_user_id uuid,
  account_created_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  delegation_id uuid,
  actor_magrit_user_id uuid,
  issued_at timestamptz,
  expires_at timestamptz,
  reason text,
  shop_slug text
)
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_customer record;
  v_delegation_id uuid;
  v_issued_at timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_token text;
  v_shop_slug text;
begin
  if v_actor is null or p_expires_seconds not between 300 and 3600
    or length(coalesce(p_reason, '')) > 500 then return; end if;

  select s.slug into v_shop_slug from public.shops s
  where s.id = p_shop_id and s.tenant_id = p_tenant_id and s.active = true
    and public.user_has_capability(p_tenant_id, 'can_impersonate_shop_customer');
  if v_shop_slug is null then return; end if;

  select * into v_customer
  from public.api_ensure_self_shop_customer(p_tenant_id, p_shop_id);
  if v_customer.account_id is null or v_customer.status = 'suspended' then return; end if;

  update private.shop_customer_delegations d
  set revoked_at = coalesce(d.revoked_at, v_issued_at)
  where d.actor_magrit_user_id = v_actor and d.shop_id = p_shop_id and d.revoked_at is null;
  update private.shop_customer_sessions sess
  set revoked_at = coalesce(sess.revoked_at, v_issued_at)
  where sess.actor_magrit_user_id = v_actor and sess.shop_id = p_shop_id
    and sess.session_kind = 'delegated' and sess.revoked_at is null;

  v_expires_at := v_issued_at + make_interval(secs => p_expires_seconds);
  insert into private.shop_customer_delegations (
    shop_customer_account_id, shop_id, actor_magrit_user_id,
    issued_at, expires_at, reason
  ) values (
    v_customer.account_id, p_shop_id, v_actor,
    v_issued_at, v_expires_at, nullif(btrim(p_reason), '')
  ) returning id into v_delegation_id;

  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  insert into private.shop_customer_sessions (
    shop_customer_account_id, shop_id, token_hash, session_kind,
    actor_magrit_user_id, delegation_id, issued_at, expires_at
  ) values (
    v_customer.account_id, p_shop_id,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'delegated',
    v_actor, v_delegation_id, v_issued_at, v_expires_at
  );

  return query select v_token, v_customer.account_id, p_shop_id,
    v_customer.email, v_customer.normalized_email, v_customer.full_name, v_customer.status,
    v_customer.auth_subject_id, v_customer.created_by_magrit_user_id,
    v_customer.created_at, v_customer.activated_at, v_customer.suspended_at,
    v_delegation_id, v_actor, v_issued_at, v_expires_at,
    nullif(btrim(p_reason), ''), v_shop_slug;
end;
$$;

create or replace function public.api_resolve_shop_customer_session(p_opaque_token text)
returns table (
  account_id uuid, shop_id uuid, email text, full_name text,
  account_status text, session_kind text, actor_magrit_user_id uuid,
  delegation_id uuid, expires_at timestamptz
)
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_hash bytea;
begin
  if length(p_opaque_token) not between 32 and 512
    or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then return; end if;
  v_hash := extensions.digest(convert_to(p_opaque_token, 'UTF8'), 'sha256');
  update private.shop_customer_sessions s
  set last_seen_at = clock_timestamp()
  from public.shop_customer_accounts a
  where s.token_hash = v_hash
    and s.shop_customer_account_id = a.id
    and s.shop_id = a.shop_id
    and s.revoked_at is null
    and s.expires_at > clock_timestamp()
    and (a.status = 'active' or (s.session_kind = 'delegated' and a.status in ('delegated_only', 'invited')))
  returning a.id, a.shop_id, a.email, a.full_name, a.status,
    s.session_kind, s.actor_magrit_user_id, s.delegation_id, s.expires_at
  into account_id, shop_id, email, full_name, account_status,
    session_kind, actor_magrit_user_id, delegation_id, expires_at;
  if account_id is not null then return next; end if;
end;
$$;

create or replace function public.api_revoke_shop_customer_session(p_opaque_token text)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_hash bytea; v_delegation_id uuid; v_revoked boolean := false;
begin
  if length(p_opaque_token) not between 32 and 512
    or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then return false; end if;
  v_hash := extensions.digest(convert_to(p_opaque_token, 'UTF8'), 'sha256');
  update private.shop_customer_sessions
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where token_hash = v_hash and revoked_at is null
  returning delegation_id into v_delegation_id;
  v_revoked := found;
  if v_delegation_id is not null then
    update private.shop_customer_delegations
    set revoked_at = coalesce(revoked_at, clock_timestamp())
    where id = v_delegation_id;
  end if;
  return v_revoked;
end;
$$;

revoke all on function public.api_start_self_shop_customer_delegation(uuid, uuid, text, integer) from public, anon;
grant execute on function public.api_start_self_shop_customer_delegation(uuid, uuid, text, integer) to authenticated;
revoke all on function public.api_revoke_shop_customer_session(text) from public, authenticated;
grant execute on function public.api_revoke_shop_customer_session(text) to anon;

notify pgrst, 'reload schema';
