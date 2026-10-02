create or replace function magrit.activate_storefront_account(requested_token_hash bytea,requested_password_hash text,requested_session_hash bytea,requested_issued_at timestamptz,requested_expires_at timestamptz)
returns table(account_id uuid,shop_id uuid,email text,full_name text,status text)
language plpgsql security definer set search_path=pg_catalog,public,private,magrit as $$
declare activation private.shop_customer_activation_tokens%rowtype; selected public.shop_customer_accounts%rowtype;
begin
  select * into activation from private.shop_customer_activation_tokens token where token.token_hash=requested_token_hash for update;
  if activation.id is null or activation.consumed_at is not null or activation.expires_at<=requested_issued_at then return; end if;
  select account.* into selected from public.shop_customer_accounts account
   where account.id=activation.shop_customer_account_id and account.status in ('delegated_only','invited') for update;
  if selected.id is null then return; end if;
  insert into private.shop_customer_credentials(shop_customer_account_id,password_hash)
  values(selected.id,requested_password_hash) on conflict(shop_customer_account_id) do update set
    password_hash=excluded.password_hash,password_algorithm='scrypt-v1',credential_version=private.shop_customer_credentials.credential_version+1,
    failed_attempt_count=0,last_failed_at=null,locked_until=null,password_changed_at=requested_issued_at,updated_at=requested_issued_at;
  update public.shop_customer_accounts account set status='active',activated_at=coalesce(account.activated_at,requested_issued_at),suspended_at=null where account.id=selected.id;
  update private.shop_customer_activation_tokens token set consumed_at=requested_issued_at where token.id=activation.id;
  update private.shop_customer_sessions session set revoked_at=coalesce(session.revoked_at,requested_issued_at) where session.shop_customer_account_id=selected.id and session.revoked_at is null;
  insert into private.shop_customer_sessions(shop_customer_account_id,shop_id,token_hash,issued_at,expires_at,last_seen_at)
  values(selected.id,selected.shop_id,requested_session_hash,requested_issued_at,requested_expires_at,requested_issued_at);
  return query select selected.id,selected.shop_id,selected.email,selected.full_name,'active'::text;
end $$;
