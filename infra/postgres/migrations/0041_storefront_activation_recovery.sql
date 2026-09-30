create table private.shop_customer_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null references public.shop_customer_accounts(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash)=32),
  issued_by_magrit_user_id uuid not null references public.app_users(id) on delete restrict,
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at>issued_at)
);
create index shop_customer_activation_account_idx on private.shop_customer_activation_tokens(shop_customer_account_id,expires_at desc);

create table private.shop_customer_password_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null references public.shop_customer_accounts(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash)=32),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at>issued_at)
);
create index shop_customer_recovery_account_idx on private.shop_customer_password_recovery_tokens(shop_customer_account_id,issued_at desc);
revoke all on table private.shop_customer_activation_tokens,private.shop_customer_password_recovery_tokens from public;

create function magrit.issue_storefront_activation(requested_tenant_id uuid,requested_shop_id uuid,requested_account_id uuid,requested_token_hash bytea,requested_expires_at timestamptz)
returns table(customer_email text,customer_name text,shop_name text,shop_slug text)
language plpgsql security definer set search_path=pg_catalog,public,private,magrit as $$
declare selected record; actor_id uuid:=magrit.current_user_id();
begin
  if actor_id is null or requested_tenant_id is distinct from magrit.current_tenant_id()
     or not magrit.actor_has_capability(requested_tenant_id,'can_manage_shop_customers') then return; end if;
  select a.email,a.full_name,s.name,s.slug into selected from public.shops s
  join public.shop_customer_accounts a on a.shop_id=s.id
  where s.id=requested_shop_id and s.tenant_id=requested_tenant_id and s.deleted_at is null
    and a.id=requested_account_id and a.status in ('delegated_only','invited') for update of a;
  if not found then return; end if;
  update private.shop_customer_activation_tokens set consumed_at=coalesce(consumed_at,clock_timestamp())
   where shop_customer_account_id=requested_account_id and consumed_at is null;
  insert into private.shop_customer_activation_tokens(shop_customer_account_id,token_hash,issued_by_magrit_user_id,expires_at)
  values(requested_account_id,requested_token_hash,actor_id,requested_expires_at);
  update public.shop_customer_accounts set status='invited',suspended_at=null where id=requested_account_id;
  return query select selected.email,selected.full_name,selected.name,selected.slug;
end $$;

create function magrit.activate_storefront_account(requested_token_hash bytea,requested_password_hash text,requested_session_hash bytea,requested_issued_at timestamptz,requested_expires_at timestamptz)
returns table(account_id uuid,shop_id uuid,email text,full_name text,status text)
language plpgsql security definer set search_path=pg_catalog,public,private,magrit as $$
declare activation private.shop_customer_activation_tokens%rowtype; selected public.shop_customer_accounts%rowtype;
begin
  select * into activation from private.shop_customer_activation_tokens where token_hash=requested_token_hash for update;
  if activation.id is null or activation.consumed_at is not null or activation.expires_at<=requested_issued_at then return; end if;
  select * into selected from public.shop_customer_accounts where id=activation.shop_customer_account_id and status in ('delegated_only','invited') for update;
  if selected.id is null then return; end if;
  insert into private.shop_customer_credentials(shop_customer_account_id,password_hash)
  values(selected.id,requested_password_hash) on conflict(shop_customer_account_id) do update set
    password_hash=excluded.password_hash,password_algorithm='scrypt-v1',credential_version=private.shop_customer_credentials.credential_version+1,
    failed_attempt_count=0,last_failed_at=null,locked_until=null,password_changed_at=requested_issued_at,updated_at=requested_issued_at;
  update public.shop_customer_accounts set status='active',activated_at=coalesce(activated_at,requested_issued_at),suspended_at=null where id=selected.id;
  update private.shop_customer_activation_tokens set consumed_at=requested_issued_at where id=activation.id;
  update private.shop_customer_sessions set revoked_at=coalesce(revoked_at,requested_issued_at) where shop_customer_account_id=selected.id and revoked_at is null;
  insert into private.shop_customer_sessions(shop_customer_account_id,shop_id,token_hash,issued_at,expires_at,last_seen_at)
  values(selected.id,selected.shop_id,requested_session_hash,requested_issued_at,requested_expires_at,requested_issued_at);
  return query select selected.id,selected.shop_id,selected.email,selected.full_name,'active'::text;
end $$;

create function magrit.issue_storefront_password_recovery(requested_shop_slug text,requested_email text,requested_token_hash bytea,requested_now timestamptz)
returns table(customer_email text,customer_name text,shop_name text,shop_slug text)
language plpgsql security definer set search_path=pg_catalog,public,private,magrit as $$
declare selected record;
begin
  select a.id,a.email,a.full_name,s.name,s.slug into selected from public.shops s
  join public.shop_customer_accounts a on a.shop_id=s.id
  where s.slug=requested_shop_slug and s.active and s.deleted_at is null and a.normalized_email=requested_email and a.status='active' for update of a;
  if not found or exists(select 1 from private.shop_customer_password_recovery_tokens where shop_customer_account_id=selected.id and issued_at>requested_now-interval '1 minute') then return; end if;
  update private.shop_customer_password_recovery_tokens set consumed_at=coalesce(consumed_at,requested_now) where shop_customer_account_id=selected.id and consumed_at is null;
  insert into private.shop_customer_password_recovery_tokens(shop_customer_account_id,token_hash,issued_at,expires_at)
  values(selected.id,requested_token_hash,requested_now,requested_now+interval '1 hour');
  return query select selected.email,selected.full_name,selected.name,selected.slug;
end $$;

create function magrit.reset_storefront_password(requested_token_hash bytea,requested_password_hash text,requested_now timestamptz)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private,magrit as $$
declare recovery private.shop_customer_password_recovery_tokens%rowtype;
begin
  select * into recovery from private.shop_customer_password_recovery_tokens where token_hash=requested_token_hash for update;
  if recovery.id is null or recovery.consumed_at is not null or recovery.expires_at<=requested_now
     or not exists(select 1 from public.shop_customer_accounts where id=recovery.shop_customer_account_id and status='active') then return false; end if;
  update private.shop_customer_credentials set password_hash=requested_password_hash,password_algorithm='scrypt-v1',credential_version=credential_version+1,
    failed_attempt_count=0,last_failed_at=null,locked_until=null,password_changed_at=requested_now,updated_at=requested_now
  where shop_customer_account_id=recovery.shop_customer_account_id;
  if not found then return false; end if;
  update private.shop_customer_password_recovery_tokens set consumed_at=requested_now where id=recovery.id;
  update private.shop_customer_sessions set revoked_at=coalesce(revoked_at,requested_now) where shop_customer_account_id=recovery.shop_customer_account_id and revoked_at is null;
  return true;
end $$;

revoke all on function magrit.issue_storefront_activation(uuid,uuid,uuid,bytea,timestamptz),magrit.activate_storefront_account(bytea,text,bytea,timestamptz,timestamptz),magrit.issue_storefront_password_recovery(text,text,bytea,timestamptz),magrit.reset_storefront_password(bytea,text,timestamptz) from public;
grant execute on function magrit.issue_storefront_activation(uuid,uuid,uuid,bytea,timestamptz),magrit.activate_storefront_account(bytea,text,bytea,timestamptz,timestamptz),magrit.issue_storefront_password_recovery(text,text,bytea,timestamptz),magrit.reset_storefront_password(bytea,text,timestamptz) to magrit_api;
