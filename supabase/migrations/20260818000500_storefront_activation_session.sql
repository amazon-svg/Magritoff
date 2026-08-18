-- UM2.11 — Une activation réussie ouvre immédiatement une session storefront.
-- Le mot de passe, l'activation du compte, la consommation du lien et
-- l'émission du jeton opaque restent dans une seule transaction SQL.

drop function if exists public.api_activate_shop_customer(text, text);

create function public.api_activate_shop_customer(
  p_token text,
  p_password text
)
returns table (
  account_id uuid,
  shop_id uuid,
  email text,
  full_name text,
  account_status text,
  issued_at timestamptz,
  expires_at timestamptz,
  opaque_token text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_activation private.shop_customer_activation_tokens%rowtype;
  v_account public.shop_customer_accounts%rowtype;
  v_settings private.storefront_auth_settings%rowtype;
  v_digest text;
  v_hash text;
  v_session_token text;
  v_now timestamptz := clock_timestamp();
begin
  select * into strict v_settings
  from private.storefront_auth_settings
  where singleton = true;

  if length(p_password) < 8 or length(p_password) > 1024 then return; end if;
  v_digest := encode(extensions.digest(convert_to(p_password, 'UTF8'), 'sha256'), 'hex');

  if length(p_token) not between 32 and 512 or p_token !~ '^[A-Za-z0-9_-]+$' then
    perform extensions.crypt(v_digest, v_settings.dummy_password_hash);
    return;
  end if;

  select * into v_activation
  from private.shop_customer_activation_tokens
  where token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
  for update;

  if v_activation.id is null or v_activation.consumed_at is not null or v_activation.expires_at <= v_now then
    perform extensions.crypt(v_digest, v_settings.dummy_password_hash);
    return;
  end if;

  select * into v_account
  from public.shop_customer_accounts
  where id = v_activation.shop_customer_account_id
    and status in ('delegated_only', 'invited')
  for update;

  if v_account.id is null then
    perform extensions.crypt(v_digest, v_settings.dummy_password_hash);
    return;
  end if;

  v_hash := extensions.crypt(v_digest, extensions.gen_salt('bf', 12));
  insert into private.shop_customer_credentials (
    shop_customer_account_id, password_hash, password_algorithm,
    credential_version, password_changed_at, updated_at
  ) values (
    v_account.id, v_hash, 'bcrypt-sha256-v1', 1, v_now, v_now
  )
  on conflict (shop_customer_account_id) do update
  set password_hash = excluded.password_hash,
      password_algorithm = excluded.password_algorithm,
      credential_version = private.shop_customer_credentials.credential_version + 1,
      failed_attempt_count = 0,
      last_failed_at = null,
      locked_until = null,
      password_changed_at = v_now,
      updated_at = v_now;

  update public.shop_customer_accounts
  set status = 'active',
      activated_at = coalesce(activated_at, v_now),
      suspended_at = null
  where id = v_account.id;

  update private.shop_customer_activation_tokens
  set consumed_at = v_now
  where id = v_activation.id;

  update private.shop_customer_sessions
  set revoked_at = coalesce(revoked_at, v_now)
  where shop_customer_account_id = v_account.id
    and revoked_at is null;

  v_session_token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );

  insert into private.shop_customer_sessions (
    shop_customer_account_id,
    shop_id,
    token_hash,
    session_kind,
    issued_at,
    expires_at,
    last_seen_at
  ) values (
    v_account.id,
    v_account.shop_id,
    extensions.digest(convert_to(v_session_token, 'UTF8'), 'sha256'),
    'direct',
    v_now,
    v_now + make_interval(secs => v_settings.session_seconds),
    v_now
  );

  return query select
    v_account.id,
    v_account.shop_id,
    v_account.email,
    v_account.full_name,
    'active'::text,
    v_now,
    v_now + make_interval(secs => v_settings.session_seconds),
    v_session_token;
end;
$$;

revoke all on function public.api_activate_shop_customer(text, text)
  from public, authenticated;
grant execute on function public.api_activate_shop_customer(text, text)
  to anon;

comment on function public.api_activate_shop_customer(text, text) is
  'Active un compte invité et émet atomiquement sa première session storefront.';

notify pgrst, 'reload schema';
