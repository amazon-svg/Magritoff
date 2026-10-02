create table private.shop_customer_delegations (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null,
  shop_id uuid not null,
  actor_magrit_user_id uuid not null references public.app_users(id) on delete restrict,
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  reason text,
  foreign key (shop_customer_account_id,shop_id) references public.shop_customer_accounts(id,shop_id) on delete cascade,
  constraint shop_customer_delegations_expiry check (expires_at>issued_at),
  constraint shop_customer_delegations_reason check (reason is null or char_length(reason)<=500)
);
create index shop_customer_delegations_actor_expiry_idx on private.shop_customer_delegations(actor_magrit_user_id,expires_at desc);
create index shop_customer_delegations_account_expiry_idx on private.shop_customer_delegations(shop_customer_account_id,expires_at desc);
alter table private.shop_customer_sessions add constraint shop_customer_sessions_delegation_fkey
  foreign key (delegation_id) references private.shop_customer_delegations(id) on delete cascade;
revoke all on table private.shop_customer_delegations from public;

create function magrit.start_self_shop_customer_delegation(
  requested_tenant_id uuid,
  requested_shop_id uuid,
  requested_actor_id uuid,
  requested_token_hash bytea,
  requested_reason text,
  requested_expires_seconds integer
)
returns table(
  account_id uuid,shop_id uuid,email text,normalized_email text,full_name text,
  account_status text,auth_subject_id uuid,created_by_magrit_user_id uuid,
  account_created_at timestamptz,activated_at timestamptz,suspended_at timestamptz,
  delegation_id uuid,actor_magrit_user_id uuid,issued_at timestamptz,
  expires_at timestamptz,reason text,shop_slug text
)
language plpgsql security definer
set search_path=pg_catalog,public,private,magrit
as $$
declare
  selected_shop public.shops%rowtype;
  selected_user public.app_users%rowtype;
  selected_account public.shop_customer_accounts%rowtype;
  created_delegation private.shop_customer_delegations%rowtype;
  issued timestamptz:=clock_timestamp();
  normalized_reason text:=nullif(btrim(requested_reason),'');
begin
  if requested_actor_id is distinct from magrit.current_user_id()
     or requested_tenant_id is distinct from magrit.current_tenant_id()
     or requested_expires_seconds not between 300 and 3600
     or octet_length(requested_token_hash)<>32
     or char_length(coalesce(normalized_reason,''))>500
     or not magrit.actor_has_capability(requested_tenant_id,'can_impersonate_shop_customer') then
    return;
  end if;

  select shop.* into selected_shop from public.shops shop
   where shop.id=requested_shop_id and shop.tenant_id=requested_tenant_id
     and shop.active and shop.deleted_at is null for update;
  if not found then return; end if;

  select app_user.* into selected_user from public.app_users app_user
   where app_user.id=requested_actor_id;
  if not found then return; end if;

  select account.* into selected_account from public.shop_customer_accounts account
   where account.shop_id=requested_shop_id and account.normalized_email=selected_user.email_normalized
   for update;
  if not found then
    insert into public.shop_customer_accounts(
      tenant_id,shop_id,email,normalized_email,full_name,status,created_by_magrit_user_id
    ) values (
      requested_tenant_id,requested_shop_id,selected_user.email_normalized,selected_user.email_normalized,
      coalesce(nullif(btrim(selected_user.display_name),''),split_part(selected_user.email_normalized,'@',1)),
      'delegated_only',requested_actor_id
    ) returning * into selected_account;
  end if;
  if selected_account.status='suspended' then return; end if;

  update private.shop_customer_delegations delegation
     set revoked_at=coalesce(delegation.revoked_at,issued)
   where delegation.actor_magrit_user_id=requested_actor_id
     and delegation.shop_id=requested_shop_id and delegation.revoked_at is null;
  update private.shop_customer_sessions session
     set revoked_at=coalesce(session.revoked_at,issued)
   where session.actor_magrit_user_id=requested_actor_id
     and session.shop_id=requested_shop_id and session.session_kind='delegated'
     and session.revoked_at is null;

  insert into private.shop_customer_delegations(
    shop_customer_account_id,shop_id,actor_magrit_user_id,issued_at,expires_at,reason
  ) values (
    selected_account.id,requested_shop_id,requested_actor_id,issued,
    issued+make_interval(secs=>requested_expires_seconds),normalized_reason
  ) returning * into created_delegation;
  insert into private.shop_customer_sessions(
    shop_customer_account_id,shop_id,token_hash,session_kind,actor_magrit_user_id,
    delegation_id,issued_at,expires_at,last_seen_at
  ) values (
    selected_account.id,requested_shop_id,requested_token_hash,'delegated',requested_actor_id,
    created_delegation.id,issued,created_delegation.expires_at,issued
  );

  return query select
    selected_account.id,selected_account.shop_id,selected_account.email,selected_account.normalized_email,
    selected_account.full_name,selected_account.status,selected_account.auth_subject_id,
    selected_account.created_by_magrit_user_id,selected_account.created_at,selected_account.activated_at,
    selected_account.suspended_at,created_delegation.id,created_delegation.actor_magrit_user_id,
    created_delegation.issued_at,created_delegation.expires_at,created_delegation.reason,selected_shop.slug;
end $$;
revoke all on function magrit.start_self_shop_customer_delegation(uuid,uuid,uuid,bytea,text,integer) from public;
grant execute on function magrit.start_self_shop_customer_delegation(uuid,uuid,uuid,bytea,text,integer) to magrit_api;

comment on table private.shop_customer_delegations is
  'Delegations storefront courtes et auditees. Les sessions associees ne conservent que le hash du jeton opaque.';
