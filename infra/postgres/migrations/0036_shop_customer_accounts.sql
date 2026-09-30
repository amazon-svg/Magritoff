create table public.shop_customer_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  tenant_id uuid not null,
  email text not null,
  normalized_email text not null,
  full_name text not null,
  auth_subject_id uuid,
  status text not null default 'delegated_only',
  created_by_magrit_user_id uuid references public.app_users(id) on delete set null,
  customer_contact_id uuid references public.customer_contacts(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  activated_at timestamptz,
  suspended_at timestamptz,
  foreign key (shop_id,tenant_id) references public.shops(id,tenant_id) on delete cascade,
  constraint shop_customer_accounts_email_shape check (char_length(btrim(email)) between 3 and 320 and position('@' in email)>1),
  constraint shop_customer_accounts_normalized_email check (char_length(normalized_email) between 3 and 320 and normalized_email=lower(btrim(normalized_email))),
  constraint shop_customer_accounts_full_name check (char_length(btrim(full_name)) between 1 and 200),
  constraint shop_customer_accounts_status check (status in ('delegated_only','invited','active','suspended')),
  constraint shop_customer_accounts_activation check (status<>'active' or activated_at is not null),
  constraint shop_customer_accounts_suspension check (status<>'suspended' or suspended_at is not null),
  unique (shop_id,normalized_email),
  unique (shop_id,customer_contact_id),
  unique (id,shop_id)
);
create index shop_customer_accounts_tenant_shop_status_idx on public.shop_customer_accounts(tenant_id,shop_id,status);
create index shop_customer_accounts_contact_idx on public.shop_customer_accounts(customer_contact_id) where customer_contact_id is not null;
create unique index shop_customer_accounts_auth_subject_uidx on public.shop_customer_accounts(auth_subject_id) where auth_subject_id is not null;

create function magrit.assert_shop_customer_contact_tenant()
returns trigger language plpgsql as $$
begin
  if new.customer_contact_id is not null and not exists (
    select 1 from public.customer_contacts contact
    join public.customers customer on customer.id=contact.customer_id
    where contact.id=new.customer_contact_id and customer.tenant_id=new.tenant_id
  ) then
    raise exception using errcode='23514',message='shop_customer_contact_tenant_mismatch';
  end if;
  return new;
end $$;
create trigger shop_customer_contact_tenant before insert or update of customer_contact_id,tenant_id
on public.shop_customer_accounts for each row execute function magrit.assert_shop_customer_contact_tenant();

create or replace function magrit.actor_has_capability(requested_tenant_id uuid,requested_capability text)
returns boolean language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select (
    requested_capability = any(array[
      'can_manage_pricing','can_manage_notifications','can_manage_production_steps',
      'can_manage_document_templates','can_manage_members','can_manage_shop_customers',
      'can_impersonate_shop_customer'
    ]::text[])
    or exists (
      select 1 from public.tenant_role_definitions known
       where known.tenant_id=requested_tenant_id and known.archived_at is null
         and known.capabilities ? requested_capability
    )
  ) and coalesce(
    exists (select 1 from public.user_preferences p where p.user_id=magrit.current_user_id() and p.is_admin)
    or exists (
      select 1 from public.tenant_members m where m.user_id=magrit.current_user_id()
       and m.tenant_id=requested_tenant_id and m.role in ('owner','admin')
    )
    or exists (
      select 1 from public.tenant_role_assignments a
      join public.tenant_role_definitions d on d.id=a.role_definition_id
      where a.user_id=magrit.current_user_id() and a.revoked_at is null and d.archived_at is null
        and d.tenant_id=requested_tenant_id
        and d.capabilities @> jsonb_build_object(requested_capability,true)
    ),false)
$$;

alter table public.shop_customer_accounts enable row level security;
alter table public.shop_customer_accounts force row level security;
create policy shop_customer_accounts_read on public.shop_customer_accounts for select using (
  tenant_id=magrit.current_tenant_id() and (
    magrit.actor_has_capability(tenant_id,'can_manage_shop_customers')
    or magrit.actor_has_capability(tenant_id,'can_impersonate_shop_customer')
  )
);
create policy shop_customer_accounts_write on public.shop_customer_accounts for all using (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shop_customers')
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shop_customers')
);

revoke all on table public.shop_customer_accounts from public;
grant select,insert,update,delete on table public.shop_customer_accounts to magrit_api;

comment on table public.shop_customer_accounts is
  'Comptes clients portables, strictement isoles par boutique et distincts des utilisateurs Magrit.';
