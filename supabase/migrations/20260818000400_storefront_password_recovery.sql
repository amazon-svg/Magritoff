-- UM9.2 — Récupération de mot de passe propre à une boutique.

create table if not exists private.shop_customer_password_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null references public.shop_customer_accounts(id) on delete cascade,
  token_hash bytea not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint shop_customer_recovery_expiry_check check (expires_at > issued_at),
  constraint shop_customer_recovery_hash_check check (octet_length(token_hash) = 32)
);
create index if not exists shop_customer_recovery_account_idx
  on private.shop_customer_password_recovery_tokens (shop_customer_account_id, issued_at desc);
alter table private.shop_customer_password_recovery_tokens enable row level security;
revoke all on table private.shop_customer_password_recovery_tokens from public, anon, authenticated;

create or replace function public.api_issue_shop_customer_password_recovery(
  p_shop_slug text,
  p_email text
)
returns table (opaque_token text, email text, full_name text, shop_name text, shop_slug text)
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_account public.shop_customer_accounts%rowtype;
  v_shop public.shops%rowtype;
  v_token text;
  v_now timestamptz := clock_timestamp();
begin
  select a.* into v_account
    from public.shop_customer_accounts a
    join public.shops s on s.id = a.shop_id
   where s.slug = lower(btrim(p_shop_slug)) and s.active = true
     and a.normalized_email = lower(btrim(p_email)) and a.status = 'active'
   limit 1;
  if v_account.id is null then return; end if;
  select s.* into v_shop from public.shops s where s.id = v_account.shop_id;

  -- Une émission maximum par minute et par compte.
  if exists (
    select 1 from private.shop_customer_password_recovery_tokens t
     where t.shop_customer_account_id = v_account.id
       and t.issued_at > v_now - interval '1 minute'
  ) then return; end if;

  update private.shop_customer_password_recovery_tokens
     set consumed_at = coalesce(consumed_at, v_now)
   where shop_customer_account_id = v_account.id and consumed_at is null;
  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  insert into private.shop_customer_password_recovery_tokens (
    shop_customer_account_id, token_hash, issued_at, expires_at
  ) values (
    v_account.id, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), v_now, v_now + interval '1 hour'
  );
  return query select v_token, v_account.email, v_account.full_name, v_shop.name, v_shop.slug;
end;
$$;

create or replace function public.api_reset_shop_customer_password(p_token text, p_password text)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_recovery private.shop_customer_password_recovery_tokens%rowtype;
  v_settings private.storefront_auth_settings%rowtype;
  v_digest text;
  v_hash text;
  v_now timestamptz := clock_timestamp();
begin
  select * into strict v_settings from private.storefront_auth_settings where singleton = true;
  v_digest := encode(extensions.digest(convert_to(coalesce(p_password, ''), 'UTF8'), 'sha256'), 'hex');
  if length(p_password) not between 8 and 1024
     or length(p_token) not between 32 and 512 or p_token !~ '^[A-Za-z0-9_-]+$' then
    perform extensions.crypt(v_digest, v_settings.dummy_password_hash);
    return false;
  end if;
  select * into v_recovery from private.shop_customer_password_recovery_tokens
   where token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256') for update;
  if v_recovery.id is null or v_recovery.consumed_at is not null or v_recovery.expires_at <= v_now
     or not exists (select 1 from public.shop_customer_accounts a where a.id = v_recovery.shop_customer_account_id and a.status = 'active') then
    perform extensions.crypt(v_digest, v_settings.dummy_password_hash);
    return false;
  end if;
  v_hash := extensions.crypt(v_digest, extensions.gen_salt('bf', 12));
  update private.shop_customer_credentials
     set password_hash = v_hash, password_algorithm = 'bcrypt-sha256-v1',
         credential_version = credential_version + 1, failed_attempt_count = 0,
         last_failed_at = null, locked_until = null, password_changed_at = v_now, updated_at = v_now
   where shop_customer_account_id = v_recovery.shop_customer_account_id;
  if not found then return false; end if;
  update private.shop_customer_password_recovery_tokens set consumed_at = v_now where id = v_recovery.id;
  update private.shop_customer_sessions set revoked_at = coalesce(revoked_at, v_now)
   where shop_customer_account_id = v_recovery.shop_customer_account_id and revoked_at is null;
  return true;
end;
$$;

revoke all on function public.api_issue_shop_customer_password_recovery(text, text) from public, authenticated;
grant execute on function public.api_issue_shop_customer_password_recovery(text, text) to anon;
revoke all on function public.api_reset_shop_customer_password(text, text) from public, authenticated;
grant execute on function public.api_reset_shop_customer_password(text, text) to anon;
notify pgrst, 'reload schema';
