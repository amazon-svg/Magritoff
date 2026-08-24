-- UM2.4 — Primitive atomique d'authentification storefront.
-- Le résultat vide constitue l'unique refus observable. Le hash du mot de
-- passe ne quitte jamais le schéma private et seul le jeton brut nouvellement
-- généré est retourné une fois au BFF pour être placé en cookie HttpOnly.

create table if not exists private.storefront_auth_settings (
  singleton boolean primary key default true check (singleton),
  dummy_password_hash text not null,
  max_failed_attempts integer not null default 5
    check (max_failed_attempts between 1 and 20),
  lock_seconds integer not null default 900
    check (lock_seconds between 60 and 86400),
  session_seconds integer not null default 28800
    check (session_seconds between 60 and 86400)
);

insert into private.storefront_auth_settings (singleton, dummy_password_hash)
values (
  true,
  extensions.crypt(
    encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex'),
    extensions.gen_salt('bf', 12)
  )
)
on conflict (singleton) do nothing;

alter table private.storefront_auth_settings enable row level security;
revoke all on table private.storefront_auth_settings from public, anon, authenticated;

create or replace function public.api_authenticate_shop_customer(
  p_shop_slug text,
  p_email text,
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
  v_shop_id uuid;
  v_account public.shop_customer_accounts%rowtype;
  v_credential private.shop_customer_credentials%rowtype;
  v_settings private.storefront_auth_settings%rowtype;
  v_now timestamptz := clock_timestamp();
  v_password_digest text;
  v_password_matches boolean := false;
  v_token text;
  v_next_failed_attempts integer;
begin
  select * into strict v_settings
  from private.storefront_auth_settings
  where singleton = true;

  -- Le pré-hash SHA-256 supprime la limite de longueur bcrypt sans stocker le
  -- secret. La même opération coûteuse est exécutée pour un compte inconnu.
  v_password_digest := encode(
    extensions.digest(convert_to(p_password, 'UTF8'), 'sha256'),
    'hex'
  );

  select s.id into v_shop_id
  from public.shops s
  where s.slug = lower(btrim(p_shop_slug))
    and s.active = true
  limit 1;

  if v_shop_id is null then
    perform extensions.crypt(v_password_digest, v_settings.dummy_password_hash);
    return;
  end if;

  select a.* into v_account
  from public.shop_customer_accounts a
  where a.shop_id = v_shop_id
    and a.normalized_email = lower(btrim(p_email))
  limit 1;

  if v_account.id is null then
    perform extensions.crypt(v_password_digest, v_settings.dummy_password_hash);
    return;
  end if;

  select c.* into v_credential
  from private.shop_customer_credentials c
  where c.shop_customer_account_id = v_account.id
  for update;

  if v_credential.shop_customer_account_id is null then
    perform extensions.crypt(v_password_digest, v_settings.dummy_password_hash);
    return;
  end if;

  v_password_matches := extensions.crypt(
    v_password_digest,
    v_credential.password_hash
  ) = v_credential.password_hash;

  if v_credential.locked_until is not null and v_credential.locked_until > v_now then
    return;
  end if;

  if not v_password_matches or v_account.status <> 'active' then
    if not v_password_matches then
      v_next_failed_attempts := v_credential.failed_attempt_count + 1;
      update private.shop_customer_credentials
      set failed_attempt_count = v_next_failed_attempts,
          last_failed_at = v_now,
          locked_until = case
            when v_next_failed_attempts >= v_settings.max_failed_attempts
              then v_now + make_interval(secs => v_settings.lock_seconds)
            else null
          end,
          updated_at = v_now
      where shop_customer_account_id = v_account.id;
    end if;
    return;
  end if;

  update private.shop_customer_credentials
  set failed_attempt_count = 0,
      last_failed_at = null,
      locked_until = null,
      updated_at = v_now
  where shop_customer_account_id = v_account.id;

  v_token := translate(
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
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
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
    v_account.status,
    v_now,
    v_now + make_interval(secs => v_settings.session_seconds),
    v_token;
end;
$$;

revoke all on function public.api_authenticate_shop_customer(text, text, text)
  from public, authenticated;
grant execute on function public.api_authenticate_shop_customer(text, text, text)
  to anon;

comment on function public.api_authenticate_shop_customer(text, text, text) is
  'Vérifie boutique/email/secret, verrouille les échecs et émet atomiquement une session opaque.';

notify pgrst, 'reload schema';
