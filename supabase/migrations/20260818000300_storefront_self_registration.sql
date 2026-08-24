-- UM9.1 — Auto-inscription storefront sans identité Magrit.
--
-- Une boutique `self_signup` crée désormais un compte strictement lié à la
-- boutique, son credential privé et sa première session dans une transaction
-- unique. Aucun auth.users, tenant_member, allowed_shop_ids ou rôle Acheteur
-- n'est créé.

create or replace function public.api_register_shop_customer(
  p_shop_slug text,
  p_email text,
  p_full_name text,
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
  v_settings private.storefront_auth_settings%rowtype;
  v_now timestamptz := clock_timestamp();
  v_normalized_email text := lower(btrim(p_email));
  v_normalized_name text := btrim(p_full_name);
  v_password_digest text;
  v_password_hash text;
  v_token text;
begin
  select * into strict v_settings
    from private.storefront_auth_settings
   where singleton = true;

  v_password_digest := encode(
    extensions.digest(convert_to(p_password, 'UTF8'), 'sha256'),
    'hex'
  );

  select s.id into v_shop_id
    from public.shops s
   where s.slug = lower(btrim(p_shop_slug))
     and s.active = true
     and s.access_mode = 'self_signup'
   limit 1;

  if v_shop_id is null
     or length(v_normalized_email) not between 3 and 320
     or v_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_normalized_name) not between 1 and 200
     or length(p_password) not between 8 and 1024 then
    perform extensions.crypt(v_password_digest, v_settings.dummy_password_hash);
    return;
  end if;

  insert into public.shop_customer_accounts (
    shop_id,
    email,
    full_name,
    status,
    created_by_magrit_user_id,
    activated_at
  ) values (
    v_shop_id,
    v_normalized_email,
    v_normalized_name,
    'active',
    null,
    v_now
  )
  on conflict on constraint shop_customer_accounts_shop_email_unique do nothing
  returning * into v_account;

  if v_account.id is null then
    perform extensions.crypt(v_password_digest, v_settings.dummy_password_hash);
    return;
  end if;

  v_password_hash := extensions.crypt(
    v_password_digest,
    extensions.gen_salt('bf', 12)
  );

  insert into private.shop_customer_credentials (
    shop_customer_account_id,
    password_hash,
    password_algorithm,
    credential_version,
    password_changed_at,
    created_at,
    updated_at
  ) values (
    v_account.id,
    v_password_hash,
    'bcrypt-sha256-v1',
    1,
    v_now,
    v_now,
    v_now
  );

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

revoke all on function public.api_register_shop_customer(text, text, text, text)
  from public, authenticated;
grant execute on function public.api_register_shop_customer(text, text, text, text)
  to anon;

-- L'ancien parcours fabriquait un tenant_member shop_only, désormais interdit.
revoke all on function public.self_register_shop_buyer(uuid) from authenticated;

comment on function public.api_register_shop_customer(text, text, text, text) is
  'Crée atomiquement un compte, un credential et une session propres à une boutique self_signup.';

notify pgrst, 'reload schema';
