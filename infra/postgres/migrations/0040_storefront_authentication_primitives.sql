create function magrit.storefront_authentication_record(requested_shop_slug text,requested_email text)
returns table(account_id uuid,shop_id uuid,email text,full_name text,status text,password_hash text,failed_attempt_count integer,locked_until timestamptz)
language sql stable security definer set search_path=pg_catalog,public,private,magrit as $$
  select a.id,a.shop_id,a.email,a.full_name,a.status,c.password_hash,c.failed_attempt_count,c.locked_until
  from public.shops s
  join public.shop_customer_accounts a on a.shop_id=s.id
  join private.shop_customer_credentials c on c.shop_customer_account_id=a.id
  where s.slug=requested_shop_slug and s.active and s.deleted_at is null
    and a.normalized_email=requested_email
$$;

create function magrit.register_storefront_account(requested_shop_slug text,requested_email text,requested_full_name text,requested_password_hash text)
returns table(account_id uuid,shop_id uuid,email text,full_name text,status text)
language plpgsql security definer set search_path=pg_catalog,public,private,magrit as $$
declare selected_shop record; created_account public.shop_customer_accounts%rowtype;
begin
  select id,tenant_id into selected_shop from public.shops
   where slug=requested_shop_slug and active and deleted_at is null and access_mode='self_signup' for update;
  if not found then return; end if;
  insert into public.shop_customer_accounts(tenant_id,shop_id,email,normalized_email,full_name,status,activated_at)
  values(selected_shop.tenant_id,selected_shop.id,requested_email,requested_email,requested_full_name,'active',clock_timestamp())
  returning * into created_account;
  insert into private.shop_customer_credentials(shop_customer_account_id,password_hash)
  values(created_account.id,requested_password_hash);
  return query select created_account.id,created_account.shop_id,created_account.email,created_account.full_name,created_account.status;
end $$;

create function magrit.resolve_storefront_session(requested_token_hash bytea)
returns table(session_kind text,actor_magrit_user_id uuid,delegation_id uuid,expires_at timestamptz,account_id uuid,shop_id uuid,email text,full_name text,status text)
language sql volatile security definer set search_path=pg_catalog,public,private,magrit as $$
  update private.shop_customer_sessions sess set last_seen_at=clock_timestamp()
  from public.shop_customer_accounts a,public.shops s
  where sess.token_hash=requested_token_hash and sess.revoked_at is null and sess.expires_at>clock_timestamp()
    and a.id=sess.shop_customer_account_id and s.id=a.shop_id and s.active and s.deleted_at is null and a.status<>'suspended'
  returning sess.session_kind,sess.actor_magrit_user_id,sess.delegation_id,sess.expires_at,a.id,a.shop_id,a.email,a.full_name,a.status
$$;

revoke all on function magrit.storefront_authentication_record(text,text) from public;
revoke all on function magrit.register_storefront_account(text,text,text,text) from public;
revoke all on function magrit.resolve_storefront_session(bytea) from public;
grant execute on function magrit.storefront_authentication_record(text,text),magrit.register_storefront_account(text,text,text,text),magrit.resolve_storefront_session(bytea) to magrit_api;
