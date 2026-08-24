-- UM2.8 — Activation autonome d'un credential boutique par jeton à usage unique.

create table if not exists private.shop_customer_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null
    references public.shop_customer_accounts(id) on delete cascade,
  token_hash bytea not null unique,
  issued_by_magrit_user_id uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint shop_customer_activation_expiry_check check (expires_at > issued_at),
  constraint shop_customer_activation_hash_check check (octet_length(token_hash) = 32)
);

create index if not exists shop_customer_activation_account_idx
  on private.shop_customer_activation_tokens (shop_customer_account_id, expires_at desc);
alter table private.shop_customer_activation_tokens enable row level security;
revoke all on table private.shop_customer_activation_tokens from public, anon, authenticated;

create or replace function public.api_issue_shop_customer_activation(
  p_tenant_id uuid,
  p_shop_id uuid,
  p_account_id uuid,
  p_expires_seconds integer default 86400
)
returns text
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_token text; v_actor uuid := auth.uid();
begin
  if v_actor is null
    or p_expires_seconds not between 900 and 604800
    or not exists (
      select 1 from public.shops s
      join public.shop_customer_accounts a on a.shop_id = s.id
      where s.id = p_shop_id and s.tenant_id = p_tenant_id and a.id = p_account_id
        and a.status in ('delegated_only', 'invited')
        and public.user_has_capability(p_tenant_id, 'can_manage_shop_customers')
    ) then
    return null;
  end if;

  update private.shop_customer_activation_tokens
  set consumed_at = clock_timestamp()
  where shop_customer_account_id = p_account_id and consumed_at is null;

  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  insert into private.shop_customer_activation_tokens (
    shop_customer_account_id, token_hash, issued_by_magrit_user_id, expires_at
  ) values (
    p_account_id,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    v_actor,
    clock_timestamp() + make_interval(secs => p_expires_seconds)
  );
  update public.shop_customer_accounts set status = 'invited' where id = p_account_id;
  return v_token;
end;
$$;

create or replace function public.api_activate_shop_customer(
  p_token text,
  p_password text
)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_activation private.shop_customer_activation_tokens%rowtype;
  v_settings private.storefront_auth_settings%rowtype;
  v_digest text;
  v_hash text;
  v_now timestamptz := clock_timestamp();
begin
  select * into strict v_settings from private.storefront_auth_settings where singleton = true;
  if length(p_password) < 8 or length(p_password) > 1024 then return false; end if;
  v_digest := encode(extensions.digest(convert_to(p_password, 'UTF8'), 'sha256'), 'hex');

  if length(p_token) not between 32 and 512 or p_token !~ '^[A-Za-z0-9_-]+$' then
    perform extensions.crypt(v_digest, v_settings.dummy_password_hash);
    return false;
  end if;

  select * into v_activation
  from private.shop_customer_activation_tokens
  where token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
  for update;

  if v_activation.id is null or v_activation.consumed_at is not null or v_activation.expires_at <= v_now
    or not exists (
      select 1 from public.shop_customer_accounts a
      where a.id = v_activation.shop_customer_account_id
        and a.status in ('delegated_only', 'invited')
    ) then
    perform extensions.crypt(v_digest, v_settings.dummy_password_hash);
    return false;
  end if;

  v_hash := extensions.crypt(v_digest, extensions.gen_salt('bf', 12));
  insert into private.shop_customer_credentials (
    shop_customer_account_id, password_hash, password_algorithm,
    credential_version, password_changed_at, updated_at
  ) values (
    v_activation.shop_customer_account_id, v_hash, 'bcrypt-sha256-v1', 1, v_now, v_now
  )
  on conflict (shop_customer_account_id) do update
  set password_hash = excluded.password_hash,
      password_algorithm = excluded.password_algorithm,
      credential_version = private.shop_customer_credentials.credential_version + 1,
      failed_attempt_count = 0, last_failed_at = null, locked_until = null,
      password_changed_at = v_now, updated_at = v_now;

  update public.shop_customer_accounts
  set status = 'active', activated_at = coalesce(activated_at, v_now), suspended_at = null
  where id = v_activation.shop_customer_account_id;
  update private.shop_customer_activation_tokens set consumed_at = v_now where id = v_activation.id;
  update private.shop_customer_sessions set revoked_at = coalesce(revoked_at, v_now)
  where shop_customer_account_id = v_activation.shop_customer_account_id and revoked_at is null;
  return true;
end;
$$;

revoke all on function public.api_issue_shop_customer_activation(uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.api_issue_shop_customer_activation(uuid, uuid, uuid, integer) to authenticated;
revoke all on function public.api_activate_shop_customer(text, text) from public, authenticated;
grant execute on function public.api_activate_shop_customer(text, text) to anon;

notify pgrst, 'reload schema';
